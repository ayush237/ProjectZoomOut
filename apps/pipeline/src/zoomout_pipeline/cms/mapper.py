"""Translating what the pipeline generated into what Payload stores.

Payload's shape is not the pipeline's shape, and the differences are load-bearing rather
than cosmetic: sticky notes are rows of `{note}` not strings, scenario options are rows of
`{text, isCorrect}`, and slide fields live inside groups. Getting any of that subtly wrong
produces a document Payload accepts and the app renders empty — which is exactly how WP15's
mapper dropped three fields with 932 tests green.

**Everything here writes drafts.** `_status` is `draft` on every payload this module builds,
and there is no code path that sets it otherwise.
"""

from __future__ import annotations

from typing import Any

from zoomout_pipeline.db.retrieval import Passage
from zoomout_pipeline.models import (
    Acquisition,
    BookProvenance,
    GeneratedLeafRecord,
)

# Payload's own draft marker. Written explicitly on every create rather than relying on a
# `?draft=true` query parameter, so a caller that forgets the parameter still cannot publish.
DRAFT_STATUS = "draft"


def track_payload(
    *,
    provenance: BookProvenance,
    acquisition: Acquisition,
    leaf_count: int,
    description: str,
) -> dict[str, Any]:
    """A draft Track.

    **The commercial fields are deliberately absent.** `publisher`, `coverUrl`,
    `purchaseLinks` and `disclaimer` are required *to publish*, and Payload relaxes required
    fields on drafts precisely so an incomplete record can exist while it is still being
    worked on. The pipeline cannot know a retailer link or a cover image, and inventing them
    would be fabrication of a different kind. A human supplies them at the publish gate,
    which is where the purchase-forward and non-endorsement requirements are actually
    enforced.

    `isPlaceholder` is false because this is real generated content, not mock data. It still
    cannot reach production until a human publishes it — `isProductionPublishable` needs both.
    """
    return {
        "bookTitle": provenance.title,
        "author": provenance.author,
        "description": description,
        "acquisition": acquisition.value,
        "leafCount": leaf_count,
        "isPlaceholder": False,
        "_status": DRAFT_STATUS,
    }


def source_references(
    record: GeneratedLeafRecord, passages: dict[int, Passage]
) -> list[dict[str, Any]]:
    """Turn citations into the audit trail `content.ts` requires.

    A reference needs a `note` **and at least one locator** (ruled 2026-08-08): a note alone
    says where a claim came from without letting anyone check it. The chapter title is always
    available because ingest preserved it on every chunk, so every reference carries a
    locator by construction rather than by hope.

    Deduplicated on the whole tuple: two claims citing the same passage with the same note
    are one reference, not two identical rows in the CMS.
    """
    seen: set[tuple[str, str, str, str]] = set()
    references: list[dict[str, Any]] = []

    for claim in [*record.leaf.claims, *record.extras.claims]:
        for citation in claim.citations:
            passage = _passage_for(citation.passage_ref, record, passages)
            if passage is None:
                continue

            chapter = passage.chapter_title
            quote = (citation.quote or "").strip()
            key = (claim.slide_key.value, chapter, quote, citation.note)
            if key in seen:
                continue
            seen.add(key)

            reference: dict[str, Any] = {
                "slideKey": claim.slide_key.value,
                "chapter": chapter,
                "note": citation.note,
            }
            if quote:
                reference["quote"] = quote
            references.append(reference)

    return references


def _passage_for(
    ref: str, record: GeneratedLeafRecord, passages: dict[int, Passage]
) -> Passage | None:
    """Resolve a `P<n>` handle against the passages this Leaf cited.

    Grounding has already rejected any handle that did not resolve, so a miss here means the
    passage set was rebuilt differently — worth returning None and dropping the reference
    rather than guessing at a locator that might name the wrong chapter.
    """
    by_ref = {passage.ref: passage for passage in passages.values()}
    return by_ref.get(ref)


def leaf_payload(
    *,
    record: GeneratedLeafRecord,
    track_id: int,
    passages: dict[int, Passage],
) -> dict[str, Any]:
    """A draft Leaf, in Payload's own shape.

    Note the two collection-shaped fields: `stickyNotes.notes` is rows of `{note}` and
    `scenario.options` is rows of `{text, isCorrect}`. Passing bare strings or a differently
    named key produces a document that saves cleanly and renders empty.
    """
    leaf = record.leaf
    extras = record.extras

    takeaway: dict[str, Any] = {"body": leaf.takeaway_body}
    if extras.dinner_table_knowledge:
        takeaway["dinnerTableKnowledge"] = extras.dinner_table_knowledge
    if extras.apply_in_life:
        takeaway["applyInLife"] = extras.apply_in_life

    return {
        "trackId": track_id,
        "orderIndex": record.order,
        "title": record.title,
        "isPlaceholder": False,
        "summary": {"body": leaf.summary_body},
        "scenario": {
            "prompt": leaf.scenario_prompt,
            "options": [
                {"text": option.text, "isCorrect": option.is_correct}
                for option in leaf.scenario_options
            ],
        },
        "payoff": {"body": leaf.payoff_body},
        "stickyNotes": {"notes": [{"note": note} for note in leaf.sticky_notes]},
        "takeaway": takeaway,
        "sourceReferences": source_references(record, passages),
        "_status": DRAFT_STATUS,
    }
