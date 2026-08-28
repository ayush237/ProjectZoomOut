"""The answer-length check.

WP17 measured the correct scenario option as the **longest of the three** in 15 of 18 Leaves
in a real Track, against a chance rate of roughly 6 of 18. Combined with the position bias
that same read-through found and WP17 already fixed with a per-Leaf shuffle, a reader could
score 83% on the unlock gate without reading the scenario at all. `PRODUCT.md` calls active
recall the product thesis; a gate answerable from formatting alone makes it decorative rather
than real.

**Ruled 2026-08-27: its own mechanical, deterministic check — not `ground_check`, and not the
advisory `editorial_review`.** Keeping it out of the legal gate is right for the same reason
the 1:1 structure check stays separate from editorial concerns: a style finding must never be
able to argue the legal gate out of a rejection, and folding a formatting tell into that gate
would blur exactly the line R3 draws. But an advisory finding is too weak a guard for a defect
that empties the product's core mechanic — the same reasoning that made the 1:1 structure
check mechanical rather than a line in a prompt applies here without needing to be re-derived.

**Measured per Track, not per Leaf.** One Leaf whose correct answer happens to be the longest
is chance. A Track where it is *almost always* the longest is a tell, in the same way one
Leaf drawing on a single chapter is fine but a plan where every Leaf does is a table of
contents (`structure_check.py`) — the same shape of check, applied to a different formatting
signal.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from zoomout_pipeline.models import GeneratedLeafRecord

# More than half the Track's Leaves having their correct option strictly the longest is the
# threshold. Chance on 3 options is 1/3 per Leaf if lengths were unrelated to correctness;
# 0.5 gives real headroom above that baseline before firing, so a Track that drifts a little
# above chance is not flagged, and the same principle as the structure check's thresholds
# applies — lean toward not missing the real tell rather than toward never being wrong.
MAX_LONGEST_CORRECT_RATIO = 0.5

# Ties are not evidence of a tell either way — a formatting bias would make the correct
# option unambiguously the longest, not tied for it — so a tie counts as "not the longest"
# rather than being excluded from the denominator.


class AnswerLengthCheckResult(BaseModel):
    """The verdict for one Track, plus the count behind it."""

    passed: bool
    longest_correct_ratio: float = Field(ge=0.0, le=1.0)
    leaves_checked: int
    leaves_with_longest_correct: int
    findings: list[str] = Field(default_factory=list)

    @property
    def feedback(self) -> str:
        return "\n".join(f"- {finding}" for finding in self.findings)


def _correct_is_strictly_longest(leaf: GeneratedLeafRecord) -> bool:
    options = leaf.leaf.scenario_options
    correct_indices = [index for index, option in enumerate(options) if option.is_correct]
    if not correct_indices:
        # Unreachable through the schema, which requires exactly one correct option — kept
        # because this is the function the whole check depends on, and it should not trust
        # a validator staying where it is.
        return False

    # Compared by position, not by value: filtering "every length that equals the correct
    # one's" would also drop a wrong option that merely ties with it, and drops all three
    # into an empty comparison when every option happens to be the same length — which the
    # default test fixture actually is. Ties are the case this function exists to get right;
    # crashing on them was the bug the first version of this function had.
    correct_index = correct_indices[0]
    correct_length = len(options[correct_index].text)
    other_lengths = [len(option.text) for i, option in enumerate(options) if i != correct_index]
    return correct_length > max(other_lengths)


def check_answer_length(records: list[GeneratedLeafRecord]) -> AnswerLengthCheckResult:
    """Measure a Track's Leaves for the correct-option-is-longest tell."""
    if not records:
        return AnswerLengthCheckResult(
            passed=True,
            longest_correct_ratio=0.0,
            leaves_checked=0,
            leaves_with_longest_correct=0,
        )

    longest_correct = [record for record in records if _correct_is_strictly_longest(record)]
    ratio = len(longest_correct) / len(records)

    findings: list[str] = []
    if ratio > MAX_LONGEST_CORRECT_RATIO:
        examples = ", ".join(str(r.order) for r in longest_correct[:5])
        findings.append(
            f"the correct option is the longest of the three in {ratio:.0%} of Leaves "
            f"(limit {MAX_LONGEST_CORRECT_RATIO:.0%}), including Leaves {examples}. A reader "
            "can pick the longest option without reading the scenario. Write substantive "
            "wrong options — a real temptation stated at comparable length — rather than "
            "shortening the correct one; a short correct answer just moves the tell to the "
            "other end of the option list."
        )

    return AnswerLengthCheckResult(
        passed=not findings,
        longest_correct_ratio=ratio,
        leaves_checked=len(records),
        leaves_with_longest_correct=len(longest_correct),
        findings=findings,
    )
