"""Tier A — the 1:1 chapter-structure check must actually fire.

`LEGAL.md`'s original-structure requirement is load-bearing for the fair-use position, and
the whole point of the check is that it is not a prompt instruction. These tests are what
prove it is not.
"""

from __future__ import annotations

import pytest

from zoomout_pipeline.graph.structure_check import (
    MAX_SEQUENTIAL_PAIR_RATIO,
    MAX_SINGLE_CHAPTER_LEAF_RATIO,
    check_structure,
)
from zoomout_pipeline.models import LeafPlan, PlannedLeaf

from .conftest import make_plan


def test_rejects_a_plan_that_mirrors_the_chapter_structure() -> None:
    """One Leaf per chapter, in the book's own order — the failure this exists to catch."""
    plan = make_plan(leaves=17, mirror=True, chapter_count=17)

    result = check_structure(plan, chapter_count=17)

    assert result.passed is False
    assert result.findings, "a rejection must say what is wrong; breakdown revises from it"
    assert result.single_chapter_leaf_ratio == 1.0
    assert result.sequential_pair_ratio == 1.0
    assert result.chapter_count_parity is True


def test_accepts_a_plan_that_synthesises_across_chapters() -> None:
    plan = make_plan(leaves=22, chapters_per_leaf=3, chapter_count=17)

    result = check_structure(plan, chapter_count=17)

    assert result.passed is True
    assert result.findings == []


def test_slicing_fails_even_when_the_order_is_scrambled() -> None:
    """Reordering a one-chapter-per-Leaf plan does not rescue it.

    The cheapest way for a model to 'fix' a rejection is to shuffle the same plan. Each
    signal therefore has to stand on its own.
    """
    plan = LeafPlan(
        leaves=[
            PlannedLeaf(
                order=index,
                title=f"Leaf {index}",
                concept=f"Concept {index}",
                source_chapters=[(index * 7) % 17],
            )
            for index in range(20)
        ]
    )

    result = check_structure(plan, chapter_count=17)

    assert result.passed is False
    assert result.sequential_pair_ratio < MAX_SEQUENTIAL_PAIR_RATIO
    assert result.single_chapter_leaf_ratio > MAX_SINGLE_CHAPTER_LEAF_RATIO


def test_sequential_order_alone_passes_when_the_plan_is_not_one_per_chapter() -> None:
    """A finer-grained walk is not a 1:1 reproduction.

    30 Leaves over 17 chapters is not the table of contents even read front to back, so the
    ordering signal deliberately requires the count signal alongside it.
    """
    plan = LeafPlan(
        leaves=[
            PlannedLeaf(
                order=index,
                title=f"Leaf {index}",
                concept=f"Concept {index}",
                source_chapters=sorted({index % 17, (index + 3) % 17}),
            )
            for index in range(30)
        ]
    )

    result = check_structure(plan, chapter_count=17)

    assert result.chapter_count_parity is False
    assert result.passed is True


def test_findings_name_the_measurements_the_reviser_needs() -> None:
    result = check_structure(make_plan(leaves=17, mirror=True, chapter_count=17), chapter_count=17)

    joined = result.feedback
    assert "one chapter" in joined
    assert "%" in joined, "the feedback should carry the numbers, not just a verdict"


@pytest.mark.parametrize("chapter_count", [0, -1])
def test_parity_is_false_rather_than_dividing_by_zero(chapter_count: int) -> None:
    result = check_structure(make_plan(leaves=20, chapter_count=17), chapter_count=chapter_count)
    assert result.chapter_count_parity is False
