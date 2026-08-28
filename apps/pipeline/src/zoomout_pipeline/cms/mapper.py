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
    EditorialFinding,
    GeneratedLeaf,
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


def revised_leaf_patch(*, leaf: GeneratedLeaf, existing: dict[str, Any]) -> dict[str, Any]:
    """A PATCH body for a Leaf whose text `revise` rewrote.

    **Read-modify-write, not trust-the-server-to-merge.** `revise` only ever touches the
    five slide-text fields on `GeneratedLeaf` — never `scenario.image`,
    `stickyNotes.diagram`, or `takeaway.dinnerTableKnowledge`/`applyInLife`, all of which
    live outside it (the image is a human's gate-2 pick; the DTK and apply-in-life fields
    come from `GeneratedExtras`, which revision explicitly does not touch). Whether
    Payload's PATCH deep-merges a nested group or replaces it wholesale was really only
    confirmed for one case — WP18 patched `stickyNotes.diagram` and `stickyNotes.notes`
    survived. That is not the same field pairing as `scenario.image` alongside a revised
    `scenario.prompt`, and a human's gate-2 image pick is not something to risk on an
    analogy. `existing` is that Leaf's current document, fetched immediately before this
    call — its sibling fields are copied forward unchanged rather than assumed to survive.

    Does not touch `sourceReferences`: revision keeps a claim's original citation whenever
    its wording is unchanged (the prompt says so explicitly), and rebuilding references here
    would need the same passage lookup `leaf_payload` does for a fresh Leaf — better done
    once, at generation, than duplicated for a narrower edit.
    """
    existing_scenario = existing.get("scenario") or {}
    existing_sticky = existing.get("stickyNotes") or {}
    existing_takeaway = existing.get("takeaway") or {}

    takeaway: dict[str, Any] = {"body": leaf.takeaway_body}
    if existing_takeaway.get("dinnerTableKnowledge"):
        takeaway["dinnerTableKnowledge"] = existing_takeaway["dinnerTableKnowledge"]
    if existing_takeaway.get("applyInLife"):
        takeaway["applyInLife"] = existing_takeaway["applyInLife"]

    scenario: dict[str, Any] = {
        "prompt": leaf.scenario_prompt,
        "options": [
            {"text": option.text, "isCorrect": option.is_correct}
            for option in leaf.scenario_options
        ],
    }
    if existing_scenario.get("image"):
        scenario["image"] = existing_scenario["image"]

    sticky_notes: dict[str, Any] = {"notes": [{"note": note} for note in leaf.sticky_notes]}
    if existing_sticky.get("diagram"):
        sticky_notes["diagram"] = existing_sticky["diagram"]

    return {
        "summary": {"body": leaf.summary_body},
        "scenario": scenario,
        "payoff": {"body": leaf.payoff_body},
        "stickyNotes": sticky_notes,
        "takeaway": takeaway,
    }


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


def gate2_review_patch(
    *,
    findings: list[EditorialFinding],
    candidates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """A PATCH body for the two gate-2 fields the pipeline is allowed to write.

    **Never `gateTwoStatus`.** That field is the human's decision alone — WP15.4 enforces
    this on Payload's side with field-level `access`, and this function enforces it here too
    by never having a parameter that could produce it. Two guards for one rule is deliberate:
    WP15.2's own finding was that a constraint believed applied and a constraint actually
    applied are different things.

    No read-modify-write needed, unlike `revised_leaf_patch`. Both fields are pipeline-owned
    top-level arrays with no sibling data a human edits — nothing else in Payload writes to
    `editorialFindings` or `imageCandidates`, so replacing either wholesale cannot clobber
    anything.

    Only includes a key when there is something to say. A Leaf reviewed clean (zero
    findings) omits `editorialFindings` from the patch rather than writing `[]` — Payload's
    own default is already `[]`, and a PATCH that changes nothing is not evidence the Leaf
    was reviewed. That evidence lives in the pipeline's own checkpointed state
    (`cms_reviews`), not in this field.
    """
    patch: dict[str, Any] = {}

    if findings:
        patch["editorialFindings"] = [
            {
                "slideKey": finding.slide_key.value,
                "category": finding.category.value,
                "note": finding.note,
                "suggestion": finding.suggestion,
            }
            for finding in findings
        ]

    if candidates:
        patch["imageCandidates"] = [
            {"url": candidate["url"], "alt": candidate["alt"]} for candidate in candidates
        ]

    return patch
