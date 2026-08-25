"""The 1:1 chapter-structure check.

`LEGAL.md` requires that Leaf content never reproduces a book's own chapter structure or
named framework 1:1. That requirement is load-bearing for the fair-use position — it is
one of the mitigations that makes ZoomOut a complement to the book rather than a
substitute for it, which is the factor *Thomson Reuters v. Ross Intelligence* turned on.

**This is a check that fires, not a line in a prompt.** A prompt instruction is a request;
a model that ignores it produces a table of contents with the chapter numbers filed off
and nothing notices. So the plan is measured after the fact.

Rejection is cheap and acceptance is not
----------------------------------------
A rejected plan costs one bounded revision round and, at the cap, a human decision. A plan
wrongly accepted is a legal exposure that reaches readers. The thresholds below therefore
lean strict on purpose: a false positive is paid for in seconds of compute, a false
negative in the thing this whole policy exists to avoid.
"""

from __future__ import annotations

from itertools import pairwise

from pydantic import BaseModel, Field

from zoomout_pipeline.models import LeafPlan

# More than three-quarters of Leaves drawing on exactly one chapter means the plan is
# slicing the book rather than synthesising across it. Set at 0.75 rather than something
# tighter because genuinely atomic concepts do sometimes live in a single chapter, and a
# restructured plan is still allowed to contain plenty of them — what it must not be is
# almost entirely made of them.
MAX_SINGLE_CHAPTER_LEAF_RATIO = 0.75

# The fraction of adjacent Leaf pairs whose primary chapter never moves backwards. A plan
# that walks the book front to back scores 1.0. Some forward progression is pedagogically
# right — later concepts often do build on earlier ones — so this is not set near zero;
# 0.85 permits a broadly progressive plan while catching a straight read-through.
MAX_SEQUENTIAL_PAIR_RATIO = 0.85

# Leaf count within ±15% of chapter count is the "one Leaf per chapter" tell. On its own
# this proves nothing — a 17-Leaf plan for a 17-chapter book can be a complete restructure
# — so it never fails alone. It fails in combination with sequential ordering, because a
# plan that both walks the book in order AND has one Leaf per chapter is a table of
# contents whatever its titles say.
CHAPTER_COUNT_PARITY_BAND = 0.15


class StructureCheckResult(BaseModel):
    """The verdict, plus the numbers behind it.

    `findings` is written to be fed back into `breakdown` as revision feedback, so it says
    what is wrong in terms the next attempt can act on.
    """

    passed: bool
    single_chapter_leaf_ratio: float = Field(ge=0.0, le=1.0)
    sequential_pair_ratio: float = Field(ge=0.0, le=1.0)
    chapter_count_parity: bool
    leaf_count: int
    chapter_count: int
    findings: list[str] = Field(default_factory=list)

    @property
    def feedback(self) -> str:
        return "\n".join(f"- {finding}" for finding in self.findings)


def _single_chapter_ratio(plan: LeafPlan) -> float:
    if not plan.leaves:
        return 0.0
    single = sum(1 for leaf in plan.leaves if len(leaf.source_chapters) == 1)
    return single / len(plan.leaves)


def _sequential_pair_ratio(plan: LeafPlan) -> float:
    """How much of the plan follows the book's own order.

    'Primary chapter' is the lowest-numbered chapter a Leaf draws on — the earliest place
    in the book it depends on. Ordering by that is what makes a read-through detectable.
    """
    ordered = sorted(plan.leaves, key=lambda leaf: leaf.order)
    if len(ordered) < 2:
        return 1.0
    primaries = [min(leaf.source_chapters) for leaf in ordered]
    non_decreasing = sum(1 for earlier, later in pairwise(primaries) if later >= earlier)
    return non_decreasing / (len(primaries) - 1)


def _count_parity(leaf_count: int, chapter_count: int) -> bool:
    if chapter_count <= 0:
        return False
    return abs(leaf_count - chapter_count) / chapter_count <= CHAPTER_COUNT_PARITY_BAND


def check_structure(plan: LeafPlan, *, chapter_count: int) -> StructureCheckResult:
    """Measure a proposed plan against the original-structure requirement."""
    single_ratio = _single_chapter_ratio(plan)
    sequential_ratio = _sequential_pair_ratio(plan)
    parity = _count_parity(len(plan.leaves), chapter_count)

    findings: list[str] = []

    if single_ratio > MAX_SINGLE_CHAPTER_LEAF_RATIO:
        findings.append(
            f"{single_ratio:.0%} of Leaves draw on exactly one chapter "
            f"(limit {MAX_SINGLE_CHAPTER_LEAF_RATIO:.0%}). The plan is slicing the book "
            "rather than teaching across it. Build Leaves around concepts that the book "
            "develops in more than one place, and say which chapters each one draws on."
        )

    if sequential_ratio > MAX_SEQUENTIAL_PAIR_RATIO and parity:
        findings.append(
            f"The plan follows the book's own order in {sequential_ratio:.0%} of steps "
            f"(limit {MAX_SEQUENTIAL_PAIR_RATIO:.0%}) with {len(plan.leaves)} Leaves against "
            f"{chapter_count} chapters — close enough to one per chapter to read as the "
            "table of contents. Order the Leaves by what a learner needs first, not by "
            "where the material appears in the book."
        )

    return StructureCheckResult(
        passed=not findings,
        single_chapter_leaf_ratio=single_ratio,
        sequential_pair_ratio=sequential_ratio,
        chapter_count_parity=parity,
        leaf_count=len(plan.leaves),
        chapter_count=chapter_count,
        findings=findings,
    )
