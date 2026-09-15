"""Rewriting a Leaf against a human's findings.

**Two of these are Tier A and are about what a rewrite is not allowed to buy.** The
grounding gate exists so that no editorial argument can put an unsupported claim in front of
a reader; a rewrite driven by a *human's* findings is exactly the case where that pressure is
strongest, because the person asking has already decided the current text is wrong. So a
revision that fails grounding is discarded and the original stands, and the same holds
independently for regenerated extras.

**Nothing here asserts on prose.** `surviving_phrases` is tested on its contract — that it
finds a listed phrase wherever a reader would see it, including in a source-reference note —
never on whether some rewrite reads well. Whether Leaf 17 stopped reproducing the ten rules
is a reading, and a test that claimed to answer it would be lying about what it measured.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from zoomout_pipeline.cms.mapper import rewritten_leaf_patch
from zoomout_pipeline.db.retrieval import Passage
from zoomout_pipeline.graph.rewrite import (
    MAX_REWRITE_ATTEMPTS,
    RewriteBrief,
    RewriteBriefError,
    load_brief,
    rewrite_leaf,
    surviving_phrases,
)
from zoomout_pipeline.models import (
    Citation,
    Claim,
    EditorialFinding,
    EditorialFindingCategory,
    GeneratedExtras,
    GeneratedLeaf,
    GeneratedLeafRecord,
    ScenarioOptionDraft,
    SlideKey,
)

from .conftest import ScriptedLLM

PASSAGE = Passage(
    ref="P1",
    chunk_id=261,
    chapter_index=61,
    chapter_title="The ten rules of ikigai",
    position_in_chapter=0,
    text=(
        "Stay active; don't retire. Those who give up the things they love doing and do "
        "well lose their purpose in life. Take it slow. Don't fill your stomach."
    ),
    distance=0.1,
)

GROUNDED_CLAIM = Claim(
    slide_key=SlideKey.SUMMARY,
    text="The authors report that people who give up what they love lose their purpose.",
    citations=[Citation(passage_ref="P1", note="on giving up what you love")],
)

TAKEAWAY_CLAIM = Claim(
    slide_key=SlideKey.TAKEAWAY,
    text="Purpose is sustained by continuing to do what you value.",
    citations=[Citation(passage_ref="P1", note="on continuing to do things of value")],
)

# A citation naming a passage that was never retrieved. Grounding calls this invented, which
# is the whole reason a rewrite is not allowed to ship on its own say-so.
UNGROUNDED_CLAIM = Claim(
    slide_key=SlideKey.SUMMARY,
    text="A claim the rewrite invented.",
    citations=[Citation(passage_ref="P9", note="a handle nobody was given")],
)


def _leaf(*, sticky: list[str] | None = None, claims: list[Claim] | None = None) -> GeneratedLeaf:
    return GeneratedLeaf(
        summary_body="A summary that says something.",
        scenario_prompt="You are deciding how to spend an ordinary Tuesday.",
        scenario_options=[
            ScenarioOptionDraft(text="The considered choice", is_correct=True),
            ScenarioOptionDraft(text="The tempting shortcut", is_correct=False),
            ScenarioOptionDraft(text="The comfortable delay", is_correct=False),
        ],
        payoff_body="Why the first option is the one that works.",
        sticky_notes=sticky or ["First note", "Second note"],
        takeaway_body="The one thing to carry away.",
        claims=claims if claims is not None else [GROUNDED_CLAIM, TAKEAWAY_CLAIM],
    )


def _record(
    leaf: GeneratedLeaf | None = None, extras: GeneratedExtras | None = None
) -> GeneratedLeafRecord:
    return GeneratedLeafRecord(
        order=17,
        title="Synthesizing purpose and lifestyle",
        leaf=leaf or _leaf(),
        extras=extras or GeneratedExtras(),
        cited_chunk_ids=[261],
        passage_refs={"P1": 261},
    )


def _brief(**overrides: object) -> RewriteBrief:
    defaults: dict[str, object] = {
        "findings": (
            EditorialFinding(
                slide_key=SlideKey.STICKY_NOTES,
                category=EditorialFindingCategory.PEDAGOGY,
                note="these are the book's own named rules",
                suggestion="teach the idea instead of listing them",
            ),
        ),
        "overall_note": "Reproduces a named framework.",
        "forbidden_phrases": ("Stay active; don't retire", "Eat until 80% full"),
        "extras_instruction": "Do not restate any of the book's numbered rules.",
    }
    defaults.update(overrides)
    return RewriteBrief(**defaults)  # type: ignore[arg-type]


# ------------------------------------------------------------------ the mechanical check


def test_a_forbidden_phrase_in_a_sticky_note_is_found() -> None:
    record = _record(_leaf(sticky=["Stay active; don't retire", "Something else"]))
    assert surviving_phrases(record, ("Stay active; don't retire",)) == (
        ("stickyNotes[0]", "Stay active; don't retire"),
    )


def test_a_clean_leaf_has_no_survivors() -> None:
    assert surviving_phrases(_record(), ("Stay active; don't retire",)) == ()


def test_a_curly_apostrophe_is_not_a_different_sentence() -> None:
    """The book's own text uses typographic quotes and the brief will not.

    Folded under exactly the rule the grounding gate uses for quotes, so the two agree
    about what counts as the same words.
    """
    record = _record(_leaf(sticky=["Stay active; don’t retire", "Something else"]))
    assert len(surviving_phrases(record, ("Stay active; don't retire",))) == 1


def test_a_phrase_lifted_into_a_longer_sentence_is_found() -> None:
    """Substring, not equality — the failure is a phrase carried inside prose."""
    leaf = _leaf()
    leaf = leaf.model_copy(
        update={"summary_body": "The authors advise readers to eat until 80% full at meals."}
    )
    found = surviving_phrases(_record(leaf), ("Eat until 80% full",))
    assert found == (("summary", "Eat until 80% full"),)


def test_a_phrase_surviving_in_a_source_reference_note_is_found() -> None:
    """The sibling case, and the one that motivated this check.

    Ikigai's Leaf 17 carried the framework in three places, and one of them was a citation
    note — which `source_references` turns into a `sourceReferences` row the reader sees. A
    check that looked only at the five slides would have called that Leaf clean.
    """
    claim = Claim(
        slide_key=SlideKey.SUMMARY,
        text="A claim.",
        citations=[
            Citation(
                passage_ref="P1",
                note="The ten rules include staying active and eat until 80% full.",
            )
        ],
    )
    record = _record(_leaf(claims=[claim, TAKEAWAY_CLAIM]))
    found = surviving_phrases(record, ("Eat until 80% full",))
    assert found == (("sourceReferences[summary].note", "Eat until 80% full"),)


def test_a_phrase_surviving_in_the_dinner_table_fact_is_found() -> None:
    extras = GeneratedExtras(
        dinner_table_knowledge="The 80 percent rule says to eat until 80% full.",
        claims=[TAKEAWAY_CLAIM],
    )
    found = surviving_phrases(_record(extras=extras), ("Eat until 80% full",))
    assert found == (("takeaway.dinnerTableKnowledge", "Eat until 80% full"),)


# ---------------------------------------------------------------------------- the brief


def test_a_brief_parses_into_findings(tmp_path: Path) -> None:
    path = tmp_path / "brief.yaml"
    path.write_text(
        "overall_note: Reproduces a named framework.\n"
        "forbidden_phrases:\n"
        "  - Eat until 80% full\n"
        "extras_instruction: Do not restate the rules.\n"
        "findings:\n"
        "  - slide_key: stickyNotes\n"
        "    category: pedagogy\n"
        "    note: these are the book's own rules\n"
        "    suggestion: teach the idea instead\n",
        encoding="utf-8",
    )
    brief = load_brief(path)
    assert len(brief.findings) == 1
    assert brief.findings[0].slide_key is SlideKey.STICKY_NOTES
    assert brief.forbidden_phrases == ("Eat until 80% full",)
    assert brief.review.findings[0].suggestion == "teach the idea instead"


def test_a_brief_with_no_findings_is_refused(tmp_path: Path) -> None:
    """`revise` fixes what a finding names. With none, it is regeneration by another name."""
    path = tmp_path / "brief.yaml"
    path.write_text("forbidden_phrases: [x]\n", encoding="utf-8")
    with pytest.raises(RewriteBriefError, match="findings"):
        load_brief(path)


def test_a_brief_with_an_invalid_finding_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "brief.yaml"
    path.write_text(
        "findings:\n  - slide_key: nosuchslide\n    category: prose\n"
        "    note: n\n    suggestion: s\n",
        encoding="utf-8",
    )
    with pytest.raises(RewriteBriefError):
        load_brief(path)


# ------------------------------------------------------------------------- Tier A: money
# cannot buy its way past the grounding gate, in either of the two calls a rewrite makes.


def test_a_rewrite_that_fails_grounding_is_discarded_and_the_original_stands() -> None:
    """Every attempt ungrounded, so the Leaf that was already safe is the Leaf that stays."""
    original = _record()
    ungrounded = _leaf(claims=[UNGROUNDED_CLAIM, TAKEAWAY_CLAIM])
    llm = ScriptedLLM([ungrounded, ungrounded])

    outcome = rewrite_leaf(
        llm=llm,
        record=original,
        passages=[PASSAGE],
        brief=_brief(),
        revise_model="m",
        extras_model="m",
        concept="a concept",
        with_extras=False,
    )

    assert outcome.revised is False
    assert outcome.record.leaf is original.leaf
    assert outcome.attempts == MAX_REWRITE_ATTEMPTS
    assert any("invented" in failure for failure in outcome.grounding_failures)


def test_the_second_attempt_is_told_what_the_first_one_broke() -> None:
    """Retried with the failures quoted back, not with the same prompt again.

    `review_and_revise` stops on a grounding failure precisely because retrying blind is a
    second roll of the same dice. This is the other case: the prompt changes.
    """
    grounded = _leaf(sticky=["A grounded note", "And another"])
    llm = ScriptedLLM([_leaf(claims=[UNGROUNDED_CLAIM, TAKEAWAY_CLAIM]), grounded])

    outcome = rewrite_leaf(
        llm=llm,
        record=_record(),
        passages=[PASSAGE],
        brief=_brief(),
        revise_model="m",
        extras_model="m",
        concept="a concept",
        with_extras=False,
    )

    assert outcome.revised is True and outcome.attempts == 2
    assert outcome.grounding_failures == ()
    first, second = (call["prompt"] for call in llm.calls if call["node"] == "revise")
    assert "rejected by the grounding check" not in first
    assert "rejected by the grounding check" in second
    assert "which was never retrieved" in second


def test_the_retry_is_capped() -> None:
    """R7: every cycle in this service is bounded, and this one sits in front of a Pro model."""
    ungrounded = _leaf(claims=[UNGROUNDED_CLAIM, TAKEAWAY_CLAIM])
    llm = ScriptedLLM([ungrounded] * 6)

    rewrite_leaf(
        llm=llm,
        record=_record(),
        passages=[PASSAGE],
        brief=_brief(),
        revise_model="m",
        extras_model="m",
        concept="a concept",
        with_extras=False,
    )

    assert len([c for c in llm.calls if c["node"] == "revise"]) == MAX_REWRITE_ATTEMPTS


def test_extras_are_not_regenerated_when_the_slides_were_not_rewritten() -> None:
    """The bug this command shipped with, and what it cost.

    Extras follow the takeaway. When the rewrite is discarded the takeaway is unchanged, so
    regenerating them answers a question nobody asked — and the first real run of this
    command did exactly that, clearing a grounded Dinner Table fact off a Leaf whose text it
    had just declined to touch. Paid for, and strictly worse than doing nothing.
    """
    kept = GeneratedExtras(dinner_table_knowledge="A grounded fact.", claims=[TAKEAWAY_CLAIM])
    ungrounded = _leaf(claims=[UNGROUNDED_CLAIM, TAKEAWAY_CLAIM])
    llm = ScriptedLLM([ungrounded, ungrounded])

    outcome = rewrite_leaf(
        llm=llm,
        record=_record(extras=kept),
        passages=[PASSAGE],
        brief=_brief(),
        revise_model="m",
        extras_model="m",
        concept="a concept",
    )

    assert outcome.revised is False
    assert outcome.extras_replaced is False
    assert outcome.record.extras.dinner_table_knowledge == "A grounded fact."
    assert [call["node"] for call in llm.calls] == ["revise", "revise"]


def test_regenerated_extras_that_fail_grounding_leave_the_originals_in_place() -> None:
    """Independently gated from the slides, because they are a separate call.

    An accepted rewrite of the five slides must not drag an ungrounded Dinner Table fact in
    behind it — `LEGAL.md` singles that field out as the one most likely to be repeated
    aloud as fact about a named author.
    """
    kept = GeneratedExtras(dinner_table_knowledge="A grounded fact.", claims=[TAKEAWAY_CLAIM])
    original = _record(extras=kept)
    llm = ScriptedLLM(
        [
            _leaf(sticky=["A rewritten note", "And another"]),
            GeneratedExtras(dinner_table_knowledge="Invented.", claims=[UNGROUNDED_CLAIM]),
        ]
    )

    outcome = rewrite_leaf(
        llm=llm,
        record=original,
        passages=[PASSAGE],
        brief=_brief(),
        revise_model="m",
        extras_model="m",
        concept="a concept",
    )

    assert outcome.revised is True
    assert outcome.extras_replaced is False
    assert outcome.record.extras.dinner_table_knowledge == "A grounded fact."


# -------------------------------------------------------------------------- the happy path


def test_a_grounded_rewrite_replaces_the_slides_and_the_extras() -> None:
    original = _record(
        _leaf(sticky=["Stay active; don't retire", "Walk slowly and go far"]),
        GeneratedExtras(dinner_table_knowledge="Eat until 80% full.", claims=[TAKEAWAY_CLAIM]),
    )
    llm = ScriptedLLM(
        [
            _leaf(sticky=["Keep doing what you value", "Start before you feel ready"]),
            GeneratedExtras(
                dinner_table_knowledge="Something else the passages support.",
                apply_in_life="Do one specific thing tomorrow.",
                claims=[TAKEAWAY_CLAIM],
            ),
        ]
    )

    outcome = rewrite_leaf(
        llm=llm,
        record=original,
        passages=[PASSAGE],
        brief=_brief(),
        revise_model="m",
        extras_model="m",
        concept="a concept",
    )

    assert outcome.revised and outcome.extras_replaced
    assert outcome.cleared
    assert outcome.record.leaf.sticky_notes[0] == "Keep doing what you value"
    assert outcome.record.extras.apply_in_life == "Do one specific thing tomorrow."
    assert outcome.record.attempts == original.attempts + 1


def test_the_extras_instruction_reaches_the_extras_call_and_not_the_prompt_file() -> None:
    """Prepended like `draft_leaf`'s grounding feedback, not edited into `extra_content.md`.

    What one Leaf must stop saying is not a property of the library, and a constraint written
    into the shared prompt file would be sent with every Leaf of every book afterwards.
    """
    llm = ScriptedLLM([_leaf(), GeneratedExtras(claims=[])])
    rewrite_leaf(
        llm=llm,
        record=_record(),
        passages=[PASSAGE],
        brief=_brief(extras_instruction="Do not restate the numbered rules."),
        revise_model="m",
        extras_model="m",
        concept="a concept",
    )

    extras_prompt = next(call["prompt"] for call in llm.calls if call["node"] == "extra_content")
    assert "Do not restate the numbered rules." in extras_prompt
    assert "Do not restate the numbered rules." not in Path(
        "src/zoomout_pipeline/prompts/extra_content.md"
    ).read_text(encoding="utf-8")


def test_a_rewrite_that_lands_first_time_makes_exactly_two_calls() -> None:
    """No retry when there is nothing to retry — the cap is a ceiling, not a quota."""
    llm = ScriptedLLM([_leaf(), GeneratedExtras(claims=[])])
    outcome = rewrite_leaf(
        llm=llm,
        record=_record(),
        passages=[PASSAGE],
        brief=_brief(),
        revise_model="m",
        extras_model="m",
        concept="a concept",
    )
    assert [call["node"] for call in llm.calls] == ["revise", "extra_content"]
    assert outcome.attempts == 1


# ------------------------------------------------------------------------------ the patch


def test_the_patch_replaces_the_extras_rather_than_carrying_them_forward() -> None:
    """The difference from `revised_leaf_patch`, and the reason for a second function.

    Leaf 17's Dinner Table fact was itself one of the book's ten rules. A patch that copied
    the existing one forward — which is correct after an editorial revision, because revision
    cannot touch extras — would have left the breach in place and reported success.
    """
    record = _record(
        extras=GeneratedExtras(
            dinner_table_knowledge="A new deep cut.",
            apply_in_life="A new action.",
            claims=[TAKEAWAY_CLAIM],
        )
    )
    existing = {
        "takeaway": {
            "body": "the old takeaway",
            "dinnerTableKnowledge": "Eat until 80% full.",
            "applyInLife": "Stop at 80 percent.",
        }
    }

    patch = rewritten_leaf_patch(record=record, existing=existing, passages={261: PASSAGE})

    assert patch["takeaway"]["dinnerTableKnowledge"] == "A new deep cut."
    assert patch["takeaway"]["applyInLife"] == "A new action."


def test_the_patch_clears_extras_the_rewrite_could_not_support() -> None:
    """`None` is written, not omitted. Returning nothing is a correct answer for these two
    fields, and a patch that silently kept the old value would turn it into a lie."""
    patch = rewritten_leaf_patch(
        record=_record(extras=GeneratedExtras(claims=[])),
        existing={"takeaway": {"dinnerTableKnowledge": "Eat until 80% full."}},
        passages={261: PASSAGE},
    )
    assert patch["takeaway"]["dinnerTableKnowledge"] is None


def test_the_patch_rebuilds_source_references_from_the_rewrites_own_claims() -> None:
    """Otherwise a stale note outlives the text it was written for.

    `revised_leaf_patch` deliberately leaves `sourceReferences` alone, which is right when
    citations are preserved by the prompt. A rewrite rebuilds its claims, so its references
    have to be rebuilt too — and in Leaf 17's case the old note enumerated the framework.
    """
    patch = rewritten_leaf_patch(record=_record(), existing={}, passages={261: PASSAGE})
    references = patch["sourceReferences"]
    assert [reference["note"] for reference in references] == [
        "on giving up what you love",
        "on continuing to do things of value",
    ]
    assert all(reference["chapter"] == "The ten rules of ikigai" for reference in references)


# --------------------------------------------------------------------------- retention


def test_candidates_are_written_to_disk_with_their_alt_text(tmp_path: Path) -> None:
    """The image and what it was asked to show, together.

    A PNG with no record of its intended subject cannot be checked against its own scenario
    later, which is most of what looking at the set is for.
    """
    from zoomout_pipeline.assets.images import save_candidates

    written = save_candidates(
        tmp_path, order=7, candidates=[(b"\x89PNG-one", "a dim stairwell"), (b"two", "a yard")]
    )

    assert [path.name for path in written] == [
        "leaf-07-scenario-1.png",
        "leaf-07-scenario-2.png",
    ]
    assert written[0].read_bytes() == b"\x89PNG-one"
    assert (tmp_path / "leaf-07-scenario-1.txt").read_text(encoding="utf-8") == "a dim stairwell"


def test_saving_creates_the_directory_it_was_given(tmp_path: Path) -> None:
    """A run pointed at a fresh `runs/<id>/images` should not have to be told twice."""
    from zoomout_pipeline.assets.images import save_candidates

    target = tmp_path / "runs" / "ikigai" / "images"
    written = save_candidates(target, order=0, candidates=[(b"png", "alt")])
    assert written[0].exists()
