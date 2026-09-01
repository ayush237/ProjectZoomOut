"""Editorial review and bounded revision.

Advisory means advisory: nothing here has a pass/fail verdict, and the acceptance criterion
is that a Leaf proceeds *with findings outstanding* — there is no gate to prove passing
through, only the absence of one to prove doesn't exist.
"""

from __future__ import annotations

from pydantic import BaseModel

from zoomout_pipeline.config import PipelineSettings
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.db.retrieval import Passage
from zoomout_pipeline.graph.review import (
    review_and_revise,
    revise_leaf,
    run_editorial_review,
)
from zoomout_pipeline.models import (
    Citation,
    Claim,
    EditorialFinding,
    EditorialFindingCategory,
    EditorialReviewResult,
    GeneratedExtras,
    GeneratedLeaf,
    GeneratedLeafRecord,
    SlideKey,
)

from .conftest import ScriptedLLM, make_generated_leaf

PASSAGE = Passage(
    ref="P1",
    chunk_id=101,
    chapter_index=3,
    chapter_title="CHAPTER IV. The First Principle",
    position_in_chapter=0,
    text="There is a thinking stuff from which all things are made.",
    distance=0.1,
)


def _record(leaf: GeneratedLeaf | None = None) -> GeneratedLeafRecord:
    claim = Claim(
        slide_key=SlideKey.SUMMARY,
        text="A grounded claim.",
        citations=[Citation(passage_ref="P1", note="supports it")],
    )
    return GeneratedLeafRecord(
        order=0,
        title="A Leaf",
        leaf=leaf or make_generated_leaf(claims=[claim]),
        extras=GeneratedExtras(),
        cited_chunk_ids=[101],
        passage_refs={"P1": 101},
    )


def _finding(
    category: EditorialFindingCategory = EditorialFindingCategory.PROSE,
) -> EditorialFinding:
    return EditorialFinding(
        slide_key=SlideKey.PAYOFF,
        category=category,
        note="reads like a template",
        suggestion="a concrete rewrite",
    )


def _empty_review() -> EditorialReviewResult:
    return EditorialReviewResult(findings=[], overall_note="Reads well.")


def _review_with_findings() -> EditorialReviewResult:
    return EditorialReviewResult(findings=[_finding()], overall_note="Prose is stiff.")


# ------------------------------------------------------------------- run_editorial_review


def test_review_produces_structured_findings_on_contract() -> None:
    """Contract, not prose: the schema parses and the fields are what the caller reads."""
    llm = ScriptedLLM([_review_with_findings()])

    result, spend = run_editorial_review(llm=llm, record=_record(), model="m")

    assert len(result.findings) == 1
    assert result.findings[0].category == EditorialFindingCategory.PROSE
    assert result.overall_note
    assert isinstance(spend, TokenSpend)


def test_editorial_review_result_has_no_pass_fail_field() -> None:
    """Structural proof that this is advisory: there is nothing here to check for a verdict.

    R3's principle in code form — an editorial reviewer that could block would be a second
    legal gate nobody designed.
    """
    assert "passed" not in EditorialReviewResult.model_fields
    assert "verdict" not in EditorialReviewResult.model_fields


def test_an_empty_findings_list_is_a_valid_review() -> None:
    """A Leaf with no honest problems gets an empty list, not a manufactured finding."""
    llm = ScriptedLLM([_empty_review()])

    result, _spend = run_editorial_review(llm=llm, record=_record(), model="m")

    assert result.findings == []


# ------------------------------------------------------------------------- revise_leaf


def test_a_revision_that_stays_grounded_is_accepted() -> None:
    revised = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="A grounded claim, reworded.",
                citations=[Citation(passage_ref="P1", note="still supports it")],
            )
        ]
    )
    llm = ScriptedLLM([revised])

    result, spend = revise_leaf(
        llm=llm, record=_record(), review=_review_with_findings(), passages=[PASSAGE], model="m"
    )

    assert result is not None
    assert result.summary_body == revised.summary_body
    assert isinstance(spend, TokenSpend)


def test_a_revision_that_breaks_grounding_is_discarded() -> None:
    """The safety property the whole module rests on: a rewrite that invents a citation
    must not replace an already-grounded Leaf."""
    broken = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="An invented claim.",
                citations=[Citation(passage_ref="P9", note="a handle that was never shown")],
            )
        ]
    )
    llm = ScriptedLLM([broken])

    result, _spend = revise_leaf(
        llm=llm, record=_record(), review=_review_with_findings(), passages=[PASSAGE], model="m"
    )

    assert result is None, "an ungrounded revision must be discarded, not accepted"


def test_a_revision_may_not_change_the_correct_option() -> None:
    """Not enforced by revise_leaf itself (that would need cross-checking against the
    original) — enforced by the grounding gate having nothing to say about which option is
    correct. This test documents the boundary: revision is free to reshape prose, and
    nothing here re-validates the answer key, which is why the prompt is the thing carrying
    that rule, not the code. Included so the gap is a documented decision, not an oversight."""
    same_answer = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="Same claim.",
                citations=[Citation(passage_ref="P1", note="ok")],
            )
        ]
    )
    llm = ScriptedLLM([same_answer])

    result, _spend = revise_leaf(
        llm=llm, record=_record(), review=_review_with_findings(), passages=[PASSAGE], model="m"
    )

    assert result is not None
    assert sum(1 for o in result.scenario_options if o.is_correct) == 1


# --------------------------------------------------------------------- review_and_revise


def test_no_findings_means_no_revision_and_the_leaf_proceeds() -> None:
    """The trivial 'cannot block' case: nothing to fix, nothing changes."""
    llm = ScriptedLLM([_empty_review()])

    outcome = review_and_revise(
        llm=llm, record=_record(), passages=[PASSAGE], review_model="m", revise_model="m"
    )

    assert outcome.revised is False
    assert outcome.review.findings == []
    assert len(llm.calls) == 1, "no findings means no revise call at all"


def test_a_leaf_proceeds_with_findings_outstanding_after_the_cap() -> None:
    """The acceptance criterion, directly: editorial_review cannot block. A Leaf whose
    revision keeps failing grounding still comes back as a usable outcome, findings and all
    — never an exception, never a rejection."""
    broken = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="Invented.",
                citations=[Citation(passage_ref="P9", note="never shown")],
            )
        ]
    )
    llm = ScriptedLLM([_review_with_findings(), broken])

    outcome = review_and_revise(
        llm=llm, record=_record(), passages=[PASSAGE], review_model="m", revise_model="m"
    )

    assert outcome.record.leaf.summary_body == _record().leaf.summary_body, (
        "the original must stand, unchanged, when revision cannot stay grounded"
    )
    assert outcome.review.findings, "findings remain outstanding — this is the point"
    assert outcome.revised is False


def test_the_loop_terminates_at_the_cap_rather_than_looping_forever() -> None:
    """Tier A. A reviewer that always finds something and a revision that always succeeds
    is the shape that would spin forever without a cap.

    The expected count is a **hard-coded literal**, not `MAX_EDITORIAL_ATTEMPTS` read back
    from the module under test. A test that derives its own expectation from the same
    constant it is checking cannot fail when that constant changes — the actual behaviour
    and the test's belief about correct behaviour drift together. `max_attempts` is also
    passed explicitly for the same reason: the default parameter is not what is under test.
    """
    local_cap = 2
    good_revision = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="Still grounded.",
                citations=[Citation(passage_ref="P1", note="ok")],
            )
        ]
    )
    # Always finds something, every revision succeeds — the runaway case the cap exists for.
    # One extra review beyond `local_cap` proves the loop does not run one round too many.
    script: list[BaseModel] = [_review_with_findings()]
    for _ in range(local_cap + 1):
        script.extend([good_revision, _review_with_findings()])

    llm = ScriptedLLM(script)

    outcome = review_and_revise(
        llm=llm,
        record=_record(),
        passages=[PASSAGE],
        review_model="m",
        revise_model="m",
        max_attempts=local_cap,
    )

    revise_calls = [c for c in llm.calls if c["node"] == "revise"]
    review_calls = [c for c in llm.calls if c["node"] == "editorial_review"]
    assert len(revise_calls) == 2, "hard-coded: exactly two revise calls for a cap of two"
    assert len(review_calls) == 3, "one initial review plus one after each of the two revisions"
    assert outcome.revised is True


def test_a_rejected_revision_stops_the_loop_early_rather_than_retrying() -> None:
    """A second attempt at the same failed rewrite is not a productive use of the cap."""
    broken = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="Invented.",
                citations=[Citation(passage_ref="P9", note="never shown")],
            )
        ]
    )
    llm = ScriptedLLM([_review_with_findings(), broken, _review_with_findings(), broken])

    review_and_revise(
        llm=llm, record=_record(), passages=[PASSAGE], review_model="m", revise_model="m"
    )

    revise_calls = [c for c in llm.calls if c["node"] == "revise"]
    assert len(revise_calls) == 1, "a rejected revision should stop the loop, not retry it"


def test_spend_is_accumulated_across_every_call_in_the_loop() -> None:
    good_revision = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="Still grounded.",
                citations=[Citation(passage_ref="P1", note="ok")],
            )
        ]
    )
    llm = ScriptedLLM([_review_with_findings(), good_revision, _empty_review()])

    outcome = review_and_revise(
        llm=llm, record=_record(), passages=[PASSAGE], review_model="m", revise_model="m"
    )

    assert len(outcome.spend) == 3
    assert outcome.total_cost.total_tokens > 0


# --------------------------------------------------------- _existing_claims_block


def test_existing_claims_are_rendered_with_their_exact_quote() -> None:
    """The actual fix: revision must be able to copy a citation verbatim rather than
    reconstruct it from memory. Found by running revision against two real Track 42 Leaves
    — grounding failed with 1 and 7 broken citations, on slides the findings never even
    asked to touch, because the prompt never showed the model what its own citations were."""
    from zoomout_pipeline.graph.review import _existing_claims_block

    leaf = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.SUMMARY,
                text="A specific claim.",
                citations=[
                    Citation(
                        passage_ref="P3",
                        note="supports it",
                        quote="an exact span from the passage",
                    )
                ],
            )
        ]
    )

    block = _existing_claims_block(leaf)

    assert "P3" in block
    assert "an exact span from the passage" in block
    assert "supports it" in block
    assert "summary" in block


def test_existing_claims_block_handles_a_claim_with_no_quote() -> None:
    """A note-only citation is valid (WP17) and must render without crashing or inventing
    a quote that was never there."""
    from zoomout_pipeline.graph.review import _existing_claims_block

    leaf = make_generated_leaf(
        claims=[
            Claim(
                slide_key=SlideKey.PAYOFF,
                text="A claim with no quote.",
                citations=[Citation(passage_ref="P1", note="a note, nothing more")],
            )
        ]
    )

    block = _existing_claims_block(leaf)

    assert "quote=" not in block
    assert "a note, nothing more" in block


def test_an_unclaimed_leaf_renders_as_none() -> None:
    from zoomout_pipeline.graph.review import _existing_claims_block

    assert _existing_claims_block(make_generated_leaf(claims=[])) == "(none)"


def test_revise_prompt_actually_carries_the_existing_claims_block() -> None:
    """Wiring proof: the block this fix adds must reach the prompt the model sees, not just
    exist as an unused helper function."""
    llm = ScriptedLLM([make_generated_leaf()])

    revise_leaf(
        llm=llm,
        record=_record(),
        review=_review_with_findings(),
        passages=[PASSAGE],
        model="m",
    )

    prompt = llm.calls[0]["prompt"]
    assert "P1" in prompt
    assert "There is a thinking stuff" in prompt or "supports it" in prompt


def test_the_cap_is_configurable_and_the_node_honours_the_setting() -> None:
    """WP20: the cap has to be answerable from configuration, not by editing a constant.

    A cap of 2 is up to five calls to the review model per Leaf. On Vertex the pro preview
    model would not sustain that: consecutive calls drifted from seconds to ten minutes,
    then seventeen, then forty-four, and an eighteen-Leaf Track stopped being reachable in
    a day. The bound that bit was throughput, not the cost bound the constant was chosen
    for — so it belongs in settings.

    The assertion that earns its keep is the second one. A setting that exists but is not
    threaded through to `review_and_revise` reads exactly like a working knob and changes
    nothing, which is a worse failure than not having it.
    """
    settings = PipelineSettings(
        database_url="postgresql://postgres:postgres@127.0.0.1:5433/zoomout_pipeline",
        gemini_api_key="k",
        editorial_attempts=1,
    )
    assert settings.editorial_attempts == 1

    import inspect

    from zoomout_pipeline.graph import leaf_nodes

    source = inspect.getsource(leaf_nodes.make_review_leaf_node)
    assert "max_attempts=deps.settings.editorial_attempts" in source, (
        "the review node must pass the configured cap; a setting nothing reads is a knob "
        "that appears to work and does nothing"
    )
