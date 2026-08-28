"""Translating generated content into Payload's shape.

WP15 shipped a mapper that dropped three optional fields with 932 tests green, because a
dropped optional field is indistinguishable from a field that legitimately has none. Source
references are optional fields, so these tests assert on *presence and shape*, not just that
a payload was produced.
"""

from __future__ import annotations

import pytest

from zoomout_pipeline.cms.mapper import DRAFT_STATUS, leaf_payload, source_references, track_payload
from zoomout_pipeline.db.retrieval import Passage
from zoomout_pipeline.models import (
    Acquisition,
    BookProvenance,
    Citation,
    Claim,
    GeneratedExtras,
    GeneratedLeafRecord,
    SlideKey,
    SourceFormat,
)

from .conftest import make_generated_leaf

PASSAGE = Passage(
    ref="P1",
    chunk_id=501,
    chapter_index=4,
    chapter_title="CHAPTER IV. The First Principle",
    position_in_chapter=2,
    text="There is a thinking stuff from which all things are made.",
    distance=0.1,
)


def provenance() -> BookProvenance:
    from datetime import UTC, datetime

    return BookProvenance(
        title="The Science of Getting Rich",
        author="W. D. Wattles",
        source="pg59844.epub",
        file_hash="abc123",
        source_format=SourceFormat.EPUB,
        acquisition=Acquisition.PUBLIC_DOMAIN,
        ingested_at=datetime(2026, 8, 27, tzinfo=UTC),
    )


def record(
    *, claims: list[Claim] | None = None, extras: GeneratedExtras | None = None
) -> GeneratedLeafRecord:
    return GeneratedLeafRecord(
        order=3,
        title="Gratitude is a mechanism, not a mood",
        leaf=make_generated_leaf(claims=claims or []),
        extras=extras or GeneratedExtras(),
        cited_chunk_ids=[501],
    )


# ------------------------------------------------------------------------- Track


def test_a_track_is_always_a_draft() -> None:
    payload = track_payload(
        provenance=provenance(),
        acquisition=Acquisition.PUBLIC_DOMAIN,
        leaf_count=18,
        description="A description.",
    )

    assert payload["_status"] == DRAFT_STATUS


def test_a_track_carries_its_acquisition_status() -> None:
    """R6: retroactively impossible to reconstruct, so it is written at the same moment as
    the Track or it is not written at all."""
    payload = track_payload(
        provenance=provenance(),
        acquisition=Acquisition.PUBLIC_DOMAIN,
        leaf_count=18,
        description="A description.",
    )

    assert payload["acquisition"] == "public-domain"


def test_a_track_omits_the_fields_a_human_must_supply() -> None:
    """Publisher, cover, retailer links and the disclaimer are publish-time requirements.

    The pipeline cannot know a retailer link or a cover image, and inventing them would be
    fabrication of a different kind. Payload relaxes required fields on drafts precisely so
    an incomplete record can exist while it is still being worked on.
    """
    payload = track_payload(
        provenance=provenance(),
        acquisition=Acquisition.PUBLIC_DOMAIN,
        leaf_count=18,
        description="A description.",
    )

    for human_supplied in ("publisher", "coverUrl", "purchaseLinks", "disclaimer"):
        assert human_supplied not in payload


def test_generated_content_is_not_marked_placeholder() -> None:
    payload = track_payload(
        provenance=provenance(),
        acquisition=Acquisition.PUBLIC_DOMAIN,
        leaf_count=18,
        description="A description.",
    )

    assert payload["isPlaceholder"] is False


# -------------------------------------------------------------------------- Leaf


def test_a_leaf_is_always_a_draft() -> None:
    payload = leaf_payload(record=record(), track_id=7, passages={501: PASSAGE})

    assert payload["_status"] == DRAFT_STATUS


def test_sticky_notes_become_rows_not_strings() -> None:
    """Payload stores them as `{note}` rows. Bare strings save cleanly and render empty."""
    payload = leaf_payload(record=record(), track_id=7, passages={501: PASSAGE})

    notes = payload["stickyNotes"]["notes"]
    assert notes == [{"note": "First note"}, {"note": "Second note"}]


def test_scenario_options_keep_their_answer_key_shape() -> None:
    payload = leaf_payload(record=record(), track_id=7, passages={501: PASSAGE})

    options = payload["scenario"]["options"]
    assert len(options) == 3
    assert sum(1 for option in options if option["isCorrect"]) == 1
    assert all(set(option) == {"text", "isCorrect"} for option in options)


def test_the_optional_takeaway_fields_survive_when_present() -> None:
    """The exact class of field WP15's mapper dropped."""
    extras = GeneratedExtras(
        dinner_table_knowledge="Wattles dismissed occult stunts.",
        apply_in_life="Write down one thing you already have before you ask for another.",
        claims=[
            Claim(
                slide_key=SlideKey.TAKEAWAY,
                text="Wattles dismissed occult stunts.",
                citations=[Citation(passage_ref="P1", note="the passage rejects them")],
            )
        ],
    )

    payload = leaf_payload(record=record(extras=extras), track_id=7, passages={501: PASSAGE})

    assert payload["takeaway"]["dinnerTableKnowledge"] == "Wattles dismissed occult stunts."
    assert payload["takeaway"]["applyInLife"].startswith("Write down one thing")


def test_the_optional_takeaway_fields_are_absent_when_not_generated() -> None:
    """Absent, not empty string — an empty string fails Payload's own min-length rule."""
    payload = leaf_payload(record=record(), track_id=7, passages={501: PASSAGE})

    assert "dinnerTableKnowledge" not in payload["takeaway"]
    assert "applyInLife" not in payload["takeaway"]


# ------------------------------------------------------------- source references


def test_every_reference_carries_a_note_and_a_locator() -> None:
    """Ruled 2026-08-08: a note alone says where a claim came from without letting anyone
    check it. The chapter title is always available because ingest preserved it."""
    claims = [
        Claim(
            slide_key=SlideKey.SUMMARY,
            text="A claim.",
            citations=[Citation(passage_ref="P1", note="the passage introduces it")],
        )
    ]

    references = source_references(record(claims=claims), {501: PASSAGE})

    assert len(references) == 1
    assert references[0]["note"] == "the passage introduces it"
    assert references[0]["chapter"] == "CHAPTER IV. The First Principle"
    assert references[0]["slideKey"] == "summary"


def test_a_quote_is_carried_through_when_the_model_supplied_one() -> None:
    claims = [
        Claim(
            slide_key=SlideKey.PAYOFF,
            text="A claim.",
            citations=[
                Citation(
                    passage_ref="P1",
                    note="verbatim",
                    quote="There is a thinking stuff from which all things are made.",
                )
            ],
        )
    ]

    references = source_references(record(claims=claims), {501: PASSAGE})

    assert references[0]["quote"].startswith("There is a thinking stuff")


def test_identical_citations_collapse_to_one_reference() -> None:
    """Two claims citing the same passage with the same note are one reference, not two
    identical rows for a writer to read twice."""
    citation = Citation(passage_ref="P1", note="same note")
    claims = [
        Claim(slide_key=SlideKey.SUMMARY, text="First.", citations=[citation]),
        Claim(slide_key=SlideKey.SUMMARY, text="Second.", citations=[citation]),
    ]

    references = source_references(record(claims=claims), {501: PASSAGE})

    assert len(references) == 1


def test_the_same_passage_on_different_slides_stays_two_references() -> None:
    """`slideKey` is part of what a reference means — the same passage supporting the
    summary and the takeaway is two separate traceability records."""
    claims = [
        Claim(
            slide_key=SlideKey.SUMMARY,
            text="First.",
            citations=[Citation(passage_ref="P1", note="same note")],
        ),
        Claim(
            slide_key=SlideKey.TAKEAWAY,
            text="Second.",
            citations=[Citation(passage_ref="P1", note="same note")],
        ),
    ]

    references = source_references(record(claims=claims), {501: PASSAGE})

    assert len(references) == 2
    assert {r["slideKey"] for r in references} == {"summary", "takeaway"}


@pytest.mark.parametrize("empty_quote", ["", "   "])
def test_a_blank_quote_is_dropped_rather_than_stored(empty_quote: str) -> None:
    """Payload trims on save, so a whitespace-only quote would become an empty string that
    satisfies 'a locator is present' on a technicality."""
    claims = [
        Claim(
            slide_key=SlideKey.SUMMARY,
            text="A claim.",
            citations=[Citation(passage_ref="P1", note="note", quote=empty_quote)],
        )
    ]

    references = source_references(record(claims=claims), {501: PASSAGE})

    assert "quote" not in references[0]


def test_non_contiguous_handles_resolve_to_the_chapters_the_model_cited() -> None:
    """The mis-attribution bug, caught for real by Payload on the first full Track.

    A Leaf cited P1, P7 and P9. `cited_chunk_ids` stores a *sorted set* of chunk ids, so
    rebuilding handles positionally produced P1..P3 — dropping two references outright and
    re-pointing the survivors at different chapters. Payload rejected the Leaf because the
    Dinner Table fact had lost its takeaway reference; the wrong-chapter half would have
    shipped silently, which is exactly the mis-attribution LEGAL.md exists to prevent.

    The fix is that `passage_refs` records which handle meant which chunk.
    """
    p1 = Passage(
        ref="P1",
        chunk_id=111,
        chapter_index=0,
        chapter_title="CHAPTER I. The Right to be Rich",
        position_in_chapter=0,
        text="first passage",
        distance=0.1,
    )
    p7 = Passage(
        ref="P7",
        chunk_id=117,
        chapter_index=6,
        chapter_title="CHAPTER VII. Gratitude",
        position_in_chapter=1,
        text="seventh passage",
        distance=0.2,
    )
    p9 = Passage(
        ref="P9",
        chunk_id=123,
        chapter_index=8,
        chapter_title="CHAPTER IX. How to Use the Will",
        position_in_chapter=2,
        text="ninth passage",
        distance=0.3,
    )
    passages = {p.chunk_id: p for p in (p1, p7, p9)}

    claims = [
        Claim(
            slide_key=SlideKey.SUMMARY,
            text="From the first chapter.",
            citations=[Citation(passage_ref="P1", note="a")],
        ),
        Claim(
            slide_key=SlideKey.TAKEAWAY,
            text="From the gratitude chapter.",
            citations=[Citation(passage_ref="P7", note="b")],
        ),
        Claim(
            slide_key=SlideKey.PAYOFF,
            text="From the will chapter.",
            citations=[Citation(passage_ref="P9", note="c")],
        ),
    ]

    references = source_references(record(claims=claims), passages)

    assert len(references) == 3, "no reference may be dropped because its handle is high"

    by_slide = {r["slideKey"]: r["chapter"] for r in references}
    assert by_slide["summary"] == "CHAPTER I. The Right to be Rich"
    assert by_slide["takeaway"] == "CHAPTER VII. Gratitude"
    assert by_slide["payoff"] == "CHAPTER IX. How to Use the Will"


def test_a_takeaway_reference_survives_so_dinner_table_knowledge_can_publish() -> None:
    """Payload refuses DTK without a takeaway source reference, and it was right to.

    Asserted here as well as in grounding because the failure happened *between* them: the
    claim existed, the reference did not survive the mapping, and only the CMS noticed.
    """
    p9 = Passage(
        ref="P9",
        chunk_id=123,
        chapter_index=8,
        chapter_title="CHAPTER IX. How to Use the Will",
        position_in_chapter=2,
        text="ninth passage",
        distance=0.3,
    )
    extras = GeneratedExtras(
        dinner_table_knowledge="A deep-cut fact.",
        claims=[
            Claim(
                slide_key=SlideKey.TAKEAWAY,
                text="A deep-cut fact.",
                citations=[Citation(passage_ref="P9", note="where it comes from")],
            )
        ],
    )

    payload = leaf_payload(record=record(extras=extras), track_id=7, passages={123: p9})

    takeaway_refs = [r for r in payload["sourceReferences"] if r["slideKey"] == "takeaway"]
    assert takeaway_refs, "DTK without a takeaway reference is rejected by Payload"
    assert takeaway_refs[0]["chapter"] == "CHAPTER IX. How to Use the Will"


# --------------------------------------------------------------- revised_leaf_patch


def test_a_revision_patch_preserves_an_existing_image_pick() -> None:
    """The safety property this function exists for: a human's gate-2 image choice must
    survive an editorial revision of the surrounding text, regardless of what Payload's own
    PATCH merge semantics turn out to be for this specific field pairing."""
    from zoomout_pipeline.cms.mapper import revised_leaf_patch

    existing = {
        "scenario": {
            "prompt": "old prompt",
            "options": [],
            "image": {"url": "https://cdn.example/chosen.png", "alt": "chosen by a human"},
        }
    }

    patch = revised_leaf_patch(leaf=make_generated_leaf(), existing=existing)

    assert patch["scenario"]["image"] == existing["scenario"]["image"]
    assert patch["scenario"]["prompt"] != "old prompt", "the revision itself must still apply"


def test_a_revision_patch_preserves_an_existing_diagram() -> None:
    from zoomout_pipeline.cms.mapper import revised_leaf_patch

    existing = {
        "stickyNotes": {
            "notes": [{"note": "old note"}],
            "diagram": {
                "url": "https://cdn.example/diagram.png",
                "alt": "a flow diagram",
                "spec": "{}",
                "specFormat": "json",
            },
        }
    }

    patch = revised_leaf_patch(leaf=make_generated_leaf(), existing=existing)

    assert patch["stickyNotes"]["diagram"] == existing["stickyNotes"]["diagram"]


def test_a_revision_patch_preserves_dinner_table_knowledge_and_apply_in_life() -> None:
    """Revision never touches extras — these fields cannot come from the revised leaf at
    all, only from what was already there."""
    from zoomout_pipeline.cms.mapper import revised_leaf_patch

    existing = {
        "takeaway": {
            "body": "old body",
            "dinnerTableKnowledge": "a sourced deep-cut fact",
            "applyInLife": "a concrete action",
        }
    }

    patch = revised_leaf_patch(leaf=make_generated_leaf(), existing=existing)

    assert patch["takeaway"]["dinnerTableKnowledge"] == "a sourced deep-cut fact"
    assert patch["takeaway"]["applyInLife"] == "a concrete action"
    assert patch["takeaway"]["body"] != "old body", "the revised takeaway body must still apply"


def test_a_revision_patch_with_nothing_existing_omits_the_optional_fields() -> None:
    """No image was ever picked, no diagram ever attached — the patch must not invent
    empty groups for fields that were never there."""
    from zoomout_pipeline.cms.mapper import revised_leaf_patch

    patch = revised_leaf_patch(leaf=make_generated_leaf(), existing={})

    assert "image" not in patch["scenario"]
    assert "diagram" not in patch["stickyNotes"]
    assert "dinnerTableKnowledge" not in patch["takeaway"]
    assert "applyInLife" not in patch["takeaway"]


def test_a_revision_patch_never_touches_status_or_source_references() -> None:
    """The patch is a pure content update — `update_leaf_draft` is what adds `_status`,
    and rebuilding sourceReferences here would need the same passage lookup generation
    already does, duplicated for no reason."""
    from zoomout_pipeline.cms.mapper import revised_leaf_patch

    patch = revised_leaf_patch(leaf=make_generated_leaf(), existing={})

    assert "_status" not in patch
    assert "sourceReferences" not in patch
    assert "trackId" not in patch
    assert "orderIndex" not in patch
