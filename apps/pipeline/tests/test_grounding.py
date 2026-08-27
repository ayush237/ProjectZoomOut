"""Tier A — the grounding gate.

`LEGAL.md` names fabricated content attributed to a real author as the highest-severity risk
in the product. These are the tests that make that sentence mean something, so they assert
the *rejections*, not the happy path.
"""

from __future__ import annotations

import pytest

from zoomout_pipeline.db.retrieval import Passage
from zoomout_pipeline.graph.grounding import (
    MIN_QUOTE_CHARS,
    check_grounding,
    normalise_for_quote_match,
)
from zoomout_pipeline.models import (
    Citation,
    Claim,
    GeneratedExtras,
    GeneratedLeaf,
    ScenarioOptionDraft,
    SlideKey,
)

PASSAGE_TEXT = (
    "There is a thinking stuff from which all things are made, and which, in its original "
    "state, permeates, penetrates, and fills the interspaces of the universe."
)


def passage(ref: str = "P1", text: str = PASSAGE_TEXT, chunk_id: int = 101) -> Passage:
    return Passage(
        ref=ref,
        chunk_id=chunk_id,
        chapter_index=4,
        chapter_title="CHAPTER IV. The First Principle",
        position_in_chapter=0,
        text=text,
        distance=0.1,
    )


def leaf(claims: list[Claim]) -> GeneratedLeaf:
    return GeneratedLeaf(
        summary_body="A summary.",
        scenario_prompt="A scenario.",
        scenario_options=[
            ScenarioOptionDraft(text="a", is_correct=True),
            ScenarioOptionDraft(text="b", is_correct=False),
            ScenarioOptionDraft(text="c", is_correct=False),
        ],
        payoff_body="A payoff.",
        sticky_notes=["one", "two"],
        takeaway_body="A takeaway.",
        claims=claims,
    )


def test_a_claim_citing_a_passage_that_was_never_retrieved_is_rejected() -> None:
    """The core case. A handle the model was never shown is an invention, not a mistake."""
    claims = [
        Claim(
            slide_key=SlideKey.SUMMARY,
            text="Wattles claims that thought precedes wealth.",
            citations=[Citation(passage_ref="P7", note="invented")],
        )
    ]

    verdict = check_grounding(leaf=leaf(claims), extras=GeneratedExtras(), passages=[passage()])

    assert verdict.passed is False
    assert "invented" in verdict.feedback
    assert verdict.cited_chunk_ids == [], "an unresolvable citation must not mark anything cited"


def test_a_claim_citing_a_real_passage_passes() -> None:
    claims = [
        Claim(
            slide_key=SlideKey.SUMMARY,
            text="Wattles describes an original thinking substance.",
            citations=[Citation(passage_ref="P1", note="the passage introduces thinking stuff")],
        )
    ]

    verdict = check_grounding(leaf=leaf(claims), extras=GeneratedExtras(), passages=[passage()])

    assert verdict.passed is True
    assert verdict.cited_chunk_ids == [101], "cited passages must be marked; they survive the purge"


def test_a_paraphrased_quote_is_rejected() -> None:
    """A quote is verbatim or it is not a quote. This is the Bookey failure exactly."""
    claims = [
        Claim(
            slide_key=SlideKey.TAKEAWAY,
            text="The author on the origin of matter.",
            citations=[
                Citation(
                    passage_ref="P1",
                    note="paraphrase presented as a quotation",
                    quote="There is a thinking substance that makes everything in the cosmos",
                )
            ],
        )
    ]

    verdict = check_grounding(leaf=leaf(claims), extras=GeneratedExtras(), passages=[passage()])

    assert verdict.passed is False
    assert "verbatim" in verdict.feedback


def test_a_verbatim_quote_passes_through_typographic_noise() -> None:
    """Curly quotes and line wrapping are artefacts, not differences.

    Rejecting an honest quote because the EPUB used a curly apostrophe would push authors
    toward not quoting at all, which is the opposite of what the audit trail wants.
    """
    source = passage(text="He said, “the universe desires—above all—that you live abundantly.”")
    claims = [
        Claim(
            slide_key=SlideKey.PAYOFF,
            text="The book frames abundance as the universe's own intent.",
            citations=[
                Citation(
                    passage_ref="P1",
                    note="verbatim, with straight quotes and a hyphen",
                    quote="the universe desires-above all-that you live abundantly.",
                )
            ],
        )
    ]

    verdict = check_grounding(leaf=leaf(claims), extras=GeneratedExtras(), passages=[source])

    assert verdict.passed is True


def test_a_quote_too_short_to_attribute_is_rejected() -> None:
    """'the certain way' appears everywhere in this book and attributes nothing."""
    claims = [
        Claim(
            slide_key=SlideKey.SUMMARY,
            text="A claim.",
            citations=[Citation(passage_ref="P1", note="fragment", quote="thinking")],
        )
    ]

    verdict = check_grounding(leaf=leaf(claims), extras=GeneratedExtras(), passages=[passage()])

    assert verdict.passed is False
    assert str(MIN_QUOTE_CHARS) in verdict.feedback or "too short" in verdict.feedback


def test_dinner_table_knowledge_without_a_takeaway_source_is_rejected() -> None:
    """Tier A. LEGAL.md singles DTK out, and the shared schema enforces it in two places.

    This is the third, and it is the one that runs before anything reaches the CMS.
    """
    claims = [
        Claim(
            slide_key=SlideKey.SUMMARY,
            text="A well-sourced summary claim.",
            citations=[Citation(passage_ref="P1", note="supported")],
        )
    ]
    extras = GeneratedExtras(dinner_table_knowledge="Wattles died a year after publication.")

    verdict = check_grounding(leaf=leaf(claims), extras=extras, passages=[passage()])

    assert verdict.passed is False
    assert "Dinner Table Knowledge" in verdict.feedback


def test_dinner_table_knowledge_with_a_takeaway_source_passes() -> None:
    extras = GeneratedExtras(
        dinner_table_knowledge="The book predates the New Thought boom it helped cause.",
        claims=[
            Claim(
                slide_key=SlideKey.TAKEAWAY,
                text="The book predates the New Thought boom it helped cause.",
                citations=[Citation(passage_ref="P1", note="the passage dates the argument")],
            )
        ],
    )

    verdict = check_grounding(leaf=leaf([]), extras=extras, passages=[passage()])

    assert verdict.passed is True


def test_every_failure_is_reported_not_just_the_first() -> None:
    """A writer fixing one rejection at a time is a writer who stops reading the feedback."""
    claims = [
        Claim(
            slide_key=SlideKey.SUMMARY,
            text="First bad claim.",
            citations=[Citation(passage_ref="P9", note="invented")],
        ),
        Claim(
            slide_key=SlideKey.PAYOFF,
            text="Second bad claim.",
            citations=[
                Citation(passage_ref="P1", note="bad quote", quote="not in the passage at all")
            ],
        ),
    ]

    verdict = check_grounding(leaf=leaf(claims), extras=GeneratedExtras(), passages=[passage()])

    assert len(verdict.failures) == 2


@pytest.mark.parametrize(
    ("left", "right"),
    [
        ("He said “hello”", 'He said "hello"'),
        ("a—b", "a-b"),
        ("line one\n  line two", "line one line two"),
        ("It’s", "It's"),
    ],
)
def test_normalisation_folds_artefacts_but_not_words(left: str, right: str) -> None:
    assert normalise_for_quote_match(left) == normalise_for_quote_match(right)


def test_normalisation_does_not_fold_different_words() -> None:
    assert normalise_for_quote_match("thinking stuff") != normalise_for_quote_match(
        "thinking things"
    )
