"""The graph's durable state.

**The book's text is deliberately not in here.** State is checkpointed to Postgres after
every node, so anything placed in it is copied into the checkpoint tables — where
`purge_raw_text` would not reach it, and where it would survive exactly the deletion that
R6 requires. Nodes that need the text read it from the repository by `book_id` and let it
go again. What lives in state is the *plan*: provenance, structure, the analysis, and the
Leaf list.

Everything here has to survive a process being killed and restarted days later, because
gate 1 is human and asynchronous.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from zoomout_pipeline.cost import RunCost
from zoomout_pipeline.graph.structure_check import StructureCheckResult
from zoomout_pipeline.models import (
    Acquisition,
    BookAnalysis,
    BookProvenance,
    GeneratedExtras,
    GeneratedLeaf,
    GeneratedLeafRecord,
    LeafPlan,
)

# Initial attempt plus four revisions.
#
# R7 recommended two revision rounds, and its reasoning was cost: a runaway generator/checker
# cycle is where a graph burns money. That reasoning assumed a Pro-tier call. On Flash against
# credit a revision round is effectively free, and WP16's first Vertex run lost a whole plan to
# the cap while the check was still converging — waste in service of guarding a cost we no
# longer pay.
#
# Raised to 5 by Architect ruling, WP16.1. What R7 actually required is that the cycle is
# *bounded* and escapes to a human rather than looping, and that is unchanged.
MAX_BREAKDOWN_ATTEMPTS = 5

# Per-Leaf grounding revisions. Same principle as the breakdown cap: bounded, with a human
# at the end rather than another round. A Leaf that cannot be grounded in three attempts is
# telling you something about the plan, not about the generator.
MAX_LEAF_ATTEMPTS = 3


class PipelineState(BaseModel):
    """Everything a run knows about itself."""

    run_id: str
    source_path: str
    acquisition: Acquisition

    # --- ingest
    book_id: str | None = None
    provenance: BookProvenance | None = None
    chapter_titles: list[str] = Field(default_factory=list)
    chunk_count: int = 0
    parser_warnings: list[str] = Field(default_factory=list)

    # --- analyze
    analysis: BookAnalysis | None = None

    # --- breakdown
    plan: LeafPlan | None = None
    structure_check: StructureCheckResult | None = None
    breakdown_attempts: int = 0

    # Set when breakdown returned something that is not a valid LeafPlan at all — too few
    # Leaves, a gap in `order`, a missing field. Fed back into the next attempt, because a
    # model that produced malformed output and is simply asked again usually produces the
    # same malformed output.
    last_error: str | None = None

    # Set when the revision cap is reached with the check still failing. The run does not
    # stop — it goes to the human with the failure attached, which is what "escalate"
    # means here.
    escalation: str | None = None

    # --- gate 1
    plan_file: str | None = None
    approved: bool = False

    # --- WP17: per-Leaf generation
    #
    # `leaf_cursor` is the index into the approved plan currently being generated. Advancing
    # it is what makes the per-Leaf loop resumable: a run killed mid-Track restarts at the
    # Leaf it was on, not at the beginning.
    leaf_cursor: int = 0

    # Keyed by str(order) because checkpoint serialisation prefers string keys. Holds only
    # finished, grounded Leaves — a Leaf appears here once it has passed the gate, so
    # re-entry never regenerates one that is already done.
    generated: dict[str, GeneratedLeafRecord] = Field(default_factory=dict)

    # Chunk ids of the passages retrieved for the Leaf being worked on, in P1..Pn order.
    #
    # **Ids, not text.** State is checkpointed, so passage text placed here would be copied
    # into the checkpoint tables where `purge_raw_text` cannot reach it — the same trap the
    # raw book text avoids. Nodes reload the text by id when they need it.
    current_passage_ids: list[int] = Field(default_factory=list)

    leaf_attempts: int = 0
    leaf_escalations: dict[str, str] = Field(default_factory=dict)

    # The Leaf currently in flight. Cleared once it is grounded and filed into `generated`.
    #
    # These do carry short quoted spans, which is deliberate and within R6: cited passages
    # are exactly what retention keeps, because they are the audit trail that proves a claim
    # after the book itself is deleted. Whole retrieved passages still never come here.
    current_draft: GeneratedLeaf | None = None
    current_extras: GeneratedExtras | None = None

    # Set when grounding rejects the in-flight Leaf; consumed by the next draft attempt.
    grounding_feedback: str | None = None

    # --- WP17: the CMS boundary
    #
    # Recorded so a re-entered write does not create a second Track or duplicate Leaves.
    # Payload has no natural idempotency key for a create, so the run's own memory of what
    # it already wrote is the only thing standing between a retry and a duplicated Track.
    cms_track_id: int | None = None
    cms_leaf_ids: dict[str, int] = Field(default_factory=dict)

    # What WP18 attached, keyed like `generated`. Holds media ids and urls — never image
    # bytes, which belong in Payload rather than in a checkpoint.
    cms_assets: dict[str, dict[str, Any]] = Field(default_factory=dict)

    # --- cost
    cost: RunCost = Field(default_factory=RunCost)

    @property
    def chapter_count(self) -> int:
        return len(self.chapter_titles)
