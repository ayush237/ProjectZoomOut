"""Tier A — the answer-length check must fire on a Track where the correct option is a
formatting tell, and must stay independent of the legal gate.

WP17 measured this for real: the correct option was the longest of three in 15 of 18 Leaves
in a live Track, against a chance rate of roughly 6 of 18. A reader could score 83% without
reading the scenario. This is the check that catches it before it ships.
"""

from __future__ import annotations

from zoomout_pipeline.graph.answer_length_check import (
    MAX_LONGEST_CORRECT_RATIO,
    check_answer_length,
)
from zoomout_pipeline.models import (
    GeneratedExtras,
    GeneratedLeafRecord,
    ScenarioOptionDraft,
)

from .conftest import make_generated_leaf


def _record(order: int, *, correct_is_longest: bool) -> GeneratedLeafRecord:
    if correct_is_longest:
        options = [
            ScenarioOptionDraft(text="The correct option, stated at real length", is_correct=True),
            ScenarioOptionDraft(text="A short wrong one", is_correct=False),
            ScenarioOptionDraft(text="Another short one", is_correct=False),
        ]
    else:
        options = [
            ScenarioOptionDraft(text="Correct", is_correct=True),
            ScenarioOptionDraft(
                text="A wrong option written at comparable length", is_correct=False
            ),
            ScenarioOptionDraft(
                text="Another wrong option at comparable length too", is_correct=False
            ),
        ]
    leaf = make_generated_leaf()
    leaf = leaf.model_copy(update={"scenario_options": options})
    return GeneratedLeafRecord(
        order=order, title=f"Leaf {order}", leaf=leaf, extras=GeneratedExtras(), cited_chunk_ids=[]
    )


def test_a_track_where_the_correct_option_is_always_longest_fails() -> None:
    """The real defect, reproduced: every correct option is the longest."""
    records = [_record(i, correct_is_longest=True) for i in range(18)]

    result = check_answer_length(records)

    assert result.passed is False
    assert result.longest_correct_ratio == 1.0
    assert result.leaves_with_longest_correct == 18
    assert "longest" in result.feedback


def test_a_track_where_lengths_are_comparable_passes() -> None:
    records = [_record(i, correct_is_longest=False) for i in range(18)]

    result = check_answer_length(records)

    assert result.passed is True
    assert result.findings == []


def test_a_track_right_at_the_threshold_is_not_flagged() -> None:
    """Half the Track is not a tell — the threshold has real headroom above chance."""
    tell = [_record(i, correct_is_longest=True) for i in range(9)]
    clean = [_record(i, correct_is_longest=False) for i in range(9, 18)]

    result = check_answer_length(tell + clean)

    assert result.longest_correct_ratio == 0.5
    assert result.passed is True, "exactly at the limit must pass; the limit is 'more than'"


def test_one_leaf_out_of_many_is_chance_not_a_tell() -> None:
    records = [_record(0, correct_is_longest=True)] + [
        _record(i, correct_is_longest=False) for i in range(1, 18)
    ]

    result = check_answer_length(records)

    assert result.passed is True
    assert result.leaves_with_longest_correct == 1


def test_a_tie_for_longest_does_not_count_as_the_correct_option_being_longest() -> None:
    """A tie is not evidence of the tell either way — a real bias makes the correct option
    unambiguously longest, not merely tied for it."""
    tied = GeneratedLeafRecord(
        order=0,
        title="Leaf 0",
        leaf=make_generated_leaf().model_copy(
            update={
                "scenario_options": [
                    ScenarioOptionDraft(text="Exactly ten", is_correct=True),
                    ScenarioOptionDraft(text="Exactly ten", is_correct=False),
                    ScenarioOptionDraft(text="short", is_correct=False),
                ]
            }
        ),
        extras=GeneratedExtras(),
        cited_chunk_ids=[],
    )

    result = check_answer_length([tied])

    assert result.leaves_with_longest_correct == 0


def test_an_empty_track_passes_trivially() -> None:
    result = check_answer_length([])

    assert result.passed is True
    assert result.leaves_checked == 0


def test_findings_name_the_actual_ratio_and_limit() -> None:
    records = [_record(i, correct_is_longest=True) for i in range(18)]

    result = check_answer_length(records)

    assert "100%" in result.feedback
    assert f"{MAX_LONGEST_CORRECT_RATIO:.0%}" in result.feedback


def test_the_check_reads_nothing_but_scenario_options() -> None:
    """Separation from `ground_check`, structurally rather than by convention: a Track with
    zero claims and zero citations — everything `ground_check` looks at — must still be
    measurable by this check, because they read disjoint parts of the same record."""
    leaf = make_generated_leaf(claims=[])
    record = GeneratedLeafRecord(
        order=0, title="Leaf 0", leaf=leaf, extras=GeneratedExtras(claims=[]), cited_chunk_ids=[]
    )

    result = check_answer_length([record] * 18)

    assert result.leaves_checked == 18
