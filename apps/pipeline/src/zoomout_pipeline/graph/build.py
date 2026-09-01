"""Graph assembly and the durable checkpointer.

    ingest ─> analyze ─> breakdown ─> [HUMAN GATE 1] ─> draft_leaf ─> extra_content
                             ▲   │                          ▲              │
                             └───┘                          │              ▼
                    MAX_BREAKDOWN_ATTEMPTS                  ├──────── ground_check
                                                            │              │ passed
                                                  MAX_LEAF_ATTEMPTS        ▼
                                                            └───────── review_leaf
                                                        next Leaf          │ plan exhausted
                                                                           ▼
                                                              write_drafts_to_cms ─> END

`ground_check` routes two ways: back to `draft_leaf` with its findings when a Leaf fails and
the cap allows another attempt, and on to `review_leaf` when it passes.

`review_leaf` is the editorial pass — advisory by construction. It reviews, revises up to
its cap, and then routes: back to `draft_leaf` for the next Leaf, or on to the CMS write
when the plan is exhausted. **It cannot reject.** `EditorialReviewResult` has no verdict
field, so there is no value it could return that would stop a Leaf; R3 keeps the legal gate
unarguable, and an editorial reviewer with a veto is a second legal gate nobody designed.

Note where it sits: *after* `ground_check`, never before. Grounding is the legal gate, and
revision rewrites prose — so revision has to happen on text that has already been proven
against its sources, and the revised text is what the CMS then receives.

`write_drafts_to_cms` is §3.3's `publish_to_cms`, renamed: it writes drafts and must never
publish, and a node named for publishing is a name that eventually gets believed.

Assets are deliberately not in this graph. They run as their own invocation
(`generate-assets`) because images follow text: regenerating a Track's prose invalidates
its illustrations, and coupling them into one graph makes the cheap half impossible to
redo without the expensive half.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.serde.base import SerializerProtocol, maybe_add_typed_methods
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.graph.cms_node import make_write_drafts_node
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.leaf_nodes import (
    make_draft_leaf_node,
    make_extra_content_node,
    make_ground_check_node,
    make_review_leaf_node,
    route_after_ground_check,
    route_after_review,
)
from zoomout_pipeline.graph.nodes import (
    make_analyze_node,
    make_breakdown_node,
    make_human_gate_node,
    make_ingest_node,
    route_after_breakdown,
)
from zoomout_pipeline.graph.state import PipelineState
from zoomout_pipeline.graph.structure_check import StructureCheckResult
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import (
    Acquisition,
    BookAnalysis,
    BookProvenance,
    Citation,
    Claim,
    EditorialFinding,
    EditorialFindingCategory,
    EditorialReviewResult,
    GeneratedExtras,
    GeneratedLeaf,
    GeneratedLeafRecord,
    LeafPlan,
    PlannedLeaf,
    ScenarioOptionDraft,
    SlideKey,
    SourceFormat,
)

_log = get_logger(__name__)

# Every non-builtin type that ends up inside a checkpoint.
#
# LangGraph's default serializer accepts any type and warns that it will stop doing so.
# Naming them explicitly does two things: it survives that change instead of breaking every
# in-flight run when it lands, and it narrows deserialization to types we chose — the
# checkpoint tables are the one place a run's state comes back from, days later, in a
# different process.
_CHECKPOINTED_TYPES: tuple[type, ...] = (
    PipelineState,
    BookProvenance,
    BookAnalysis,
    LeafPlan,
    PlannedLeaf,
    StructureCheckResult,
    RunCost,
    TokenSpend,
    Acquisition,
    SourceFormat,
    # WP17 — everything a per-Leaf record puts into a checkpoint.
    GeneratedLeafRecord,
    GeneratedLeaf,
    GeneratedExtras,
    Claim,
    Citation,
    ScenarioOptionDraft,
    SlideKey,
    # WP20 — editorial review is a graph node now, so its findings are checkpointed.
    EditorialReviewResult,
    EditorialFinding,
    EditorialFindingCategory,
)


def pipeline_serializer() -> SerializerProtocol:
    """The checkpoint serializer, restricted to this package's own types."""
    restricted = JsonPlusSerializer(allowed_msgpack_modules=None)
    return maybe_add_typed_methods(restricted.with_msgpack_allowlist(_CHECKPOINTED_TYPES))


# StateGraph is generic over (state, context, input, output). This graph reads and writes
# one state model and takes no separate context.
type PipelineGraph = StateGraph[PipelineState, None, PipelineState, PipelineState]
type CompiledPipeline = CompiledStateGraph[PipelineState, None, PipelineState, PipelineState]


def build_graph(deps: NodeDependencies) -> PipelineGraph:
    """Wire the nodes. No checkpointer — compilation attaches that."""
    graph: PipelineGraph = StateGraph(PipelineState)

    graph.add_node("ingest", make_ingest_node(deps))
    graph.add_node("analyze", make_analyze_node(deps))
    graph.add_node("breakdown", make_breakdown_node(deps))
    graph.add_node("human_gate", make_human_gate_node(deps))
    graph.add_node("draft_leaf", make_draft_leaf_node(deps))
    graph.add_node("extra_content", make_extra_content_node(deps))
    graph.add_node("ground_check", make_ground_check_node(deps))
    graph.add_node("review_leaf", make_review_leaf_node(deps))
    graph.add_node("write_drafts_to_cms", make_write_drafts_node(deps))

    graph.add_edge(START, "ingest")
    graph.add_edge("ingest", "analyze")
    graph.add_edge("analyze", "breakdown")
    graph.add_conditional_edges(
        "breakdown",
        route_after_breakdown,
        {"breakdown": "breakdown", "human_gate": "human_gate"},
    )
    graph.add_edge("human_gate", "draft_leaf")
    graph.add_edge("draft_leaf", "extra_content")
    graph.add_edge("extra_content", "ground_check")
    graph.add_conditional_edges(
        "ground_check",
        route_after_ground_check,
        {"draft_leaf": "draft_leaf", "review_leaf": "review_leaf"},
    )
    graph.add_conditional_edges(
        "review_leaf",
        route_after_review,
        {"draft_leaf": "draft_leaf", "done": "write_drafts_to_cms"},
    )
    graph.add_edge("write_drafts_to_cms", END)

    return graph


def compile_graph(
    deps: NodeDependencies,
    checkpointer: BaseCheckpointSaver,  # type: ignore[type-arg]
) -> CompiledStateGraph:  # type: ignore[type-arg]
    return build_graph(deps).compile(checkpointer=checkpointer)


@contextmanager
def durable_graph(deps: NodeDependencies) -> Iterator[CompiledPipeline]:
    """A compiled graph backed by Postgres checkpoints.

    The checkpointer's tables live in the pipeline's own database alongside pgvector — not
    the backend's, not Payload's. A run has to survive the process being killed and
    restarted days later, because gate 1 is a human who is not waiting at the keyboard.
    """
    with PostgresSaver.from_conn_string(deps.settings.database_url) as checkpointer:
        checkpointer.serde = pipeline_serializer()
        checkpointer.setup()
        _log.debug("checkpointer.ready")
        yield compile_graph(deps, checkpointer)
