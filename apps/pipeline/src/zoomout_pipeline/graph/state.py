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

from pydantic import BaseModel, Field

from zoomout_pipeline.cost import RunCost
from zoomout_pipeline.graph.structure_check import StructureCheckResult
from zoomout_pipeline.models import Acquisition, BookAnalysis, BookProvenance, LeafPlan

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

    # --- cost
    cost: RunCost = Field(default_factory=RunCost)

    @property
    def chapter_count(self) -> int:
        return len(self.chapter_titles)
