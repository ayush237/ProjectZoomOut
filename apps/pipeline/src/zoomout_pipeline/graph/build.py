"""Graph assembly and the durable checkpointer.

    ingest ─> analyze ─> breakdown ─> [HUMAN GATE 1] ─> END
                             ▲   │
                             └───┘  capped at MAX_BREAKDOWN_ATTEMPTS

WP16 stops at gate 1. Everything downstream of it — `draft_leaf`, `extra_content`,
`ground_check`, assets, `editorial_review` — is WP17 onwards and deliberately absent.
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
from zoomout_pipeline.graph.dependencies import NodeDependencies
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
    LeafPlan,
    PlannedLeaf,
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

    graph.add_edge(START, "ingest")
    graph.add_edge("ingest", "analyze")
    graph.add_edge("analyze", "breakdown")
    graph.add_conditional_edges(
        "breakdown",
        route_after_breakdown,
        {"breakdown": "breakdown", "human_gate": "human_gate"},
    )
    graph.add_edge("human_gate", END)

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
