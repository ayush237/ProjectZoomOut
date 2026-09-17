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

import copy
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from zoomout_pipeline.assets.narration import NARRATED_GROUPS
from zoomout_pipeline.db.retrieval import Passage
from zoomout_pipeline.models import (
    UNKNOWN_AUTHOR,
    Acquisition,
    BookProvenance,
    EditorialFinding,
    GeneratedLeaf,
    GeneratedLeafRecord,
)

# Payload's own draft marker. Written explicitly on every create rather than relying on a
# `?draft=true` query parameter, so a caller that forgets the parameter still cannot publish.
DRAFT_STATUS = "draft"


class UnknownAuthorError(RuntimeError):
    """Refusing to create a Track whose author nobody recorded.

    **The sibling of the never-publish guard, and it sits here for the same reason.** The
    pipeline promises two things about what it writes: that it is a draft, and that it says
    where it came from. Both are enforced at the boundary rather than remembered upstream,
    because upstream is where a default quietly wins.

    "Unknown" is what `parse_book` falls back to when a PDF carries no metadata, which is most
    PDFs. Publishing a real author's ideas under that name breaks the attribution the fair-use
    position depends on, and `LEGAL.md` treats attribution as the highest-severity axis in the
    product. Re-ingest with `--author`; provenance is written once and is not patched after the
    fact.
    """


def require_known_author(author: str) -> str:
    """The author, or a refusal naming the fix."""
    if author.strip().casefold() == UNKNOWN_AUTHOR.casefold() or not author.strip():
        raise UnknownAuthorError(
            f"refusing to create a Track with author {author!r}. The source file carried no "
            "author and none was supplied, so every claim on this Track would be attributed "
            'to nobody. Re-ingest with `zoomout-pipeline run --author "..."`.'
        )
    return author


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
        "author": require_known_author(provenance.author),
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
    findings: list[EditorialFinding] | None = None,
) -> dict[str, Any]:
    """A draft Leaf, in Payload's own shape.

    Note the two collection-shaped fields: `stickyNotes.notes` is rows of `{note}` and
    `scenario.options` is rows of `{text, isCorrect}`. Passing bare strings or a differently
    named key produces a document that saves cleanly and renders empty.

    `findings` arrives on the create rather than in a follow-up PATCH: since WP20 wired
    editorial review as a graph node, a Leaf is already reviewed by the time it is written,
    so its advisory notes are known at create time. The retrofit path in `review-track`
    still PATCHes them, because there the Leaf was written long before it was reviewed.
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
        **gate2_review_patch(findings=findings or []),
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


def rewritten_leaf_patch(
    *,
    record: GeneratedLeafRecord,
    existing: dict[str, Any],
    passages: dict[int, Passage],
) -> dict[str, Any]:
    """A PATCH body for a Leaf that was rewritten, not merely revised.

    **The difference from `revised_leaf_patch` is what it refuses to carry forward**, and it
    is the whole reason this exists as a second function rather than a flag on the first.

    `revised_leaf_patch` copies the existing Dinner Table fact, apply-in-life and
    `sourceReferences` forward, because editorial revision provably cannot have invalidated
    them: `revise` never touches extras, and it keeps a claim's original citation whenever
    the wording is unchanged. Neither holds for a rewrite. Ikigai's Leaf 17 carried the
    book's named framework in *three* places — the sticky notes, the Dinner Table fact, and
    a reference note reading "The ten rules include staying active without retiring, taking
    it slow, eating until 80% full…". Cleaning the slides and copying the other two forward
    would have moved the defect rather than fixed it, and the Leaf would have reported
    green.

    So extras are written from the record rather than preserved — including as `None`, which
    clears the field, because a rewrite that could not support a deep-cut fact must be able
    to say so — and `sourceReferences` is rebuilt from the claims the rewrite actually made.

    `passages` is keyed by chunk id, exactly as `leaf_payload` takes it.
    """
    patch = revised_leaf_patch(leaf=record.leaf, existing=existing)

    takeaway = dict(patch["takeaway"])
    takeaway["dinnerTableKnowledge"] = record.extras.dinner_table_knowledge
    takeaway["applyInLife"] = record.extras.apply_in_life
    patch["takeaway"] = takeaway

    patch["sourceReferences"] = source_references(record, passages)
    return patch


# ------------------------------------------------------------------------------- VO-2


# Fields that change on every write or that the write itself sets. Everything else a Leaf
# holds must read back exactly as it was.
_VOLATILE_LEAF_KEYS = frozenset({"updatedAt", "createdAt", "_status"})


@dataclass(frozen=True)
class AudioRef:
    """One slide's narration, in Payload's own shape: `{url, durationSeconds}`."""

    url: str
    duration_seconds: float

    def payload(self) -> dict[str, Any]:
        return {"url": self.url, "durationSeconds": self.duration_seconds}


def narration_patch(
    *, existing: Mapping[str, Any], audio: Mapping[str, AudioRef]
) -> dict[str, Any]:
    """A PATCH body that adds narration to a Leaf **without touching anything else on it.**

    **Whole groups, copied from the document as Payload holds it.** WP19 proved on the
    scenario group that a partial PATCH nulls the siblings it omits, so
    `{"summary": {"audio": …}}` would erase the summary's body. Each narrated group is sent
    complete: a deep copy of `existing[group]` — every field, including ones this module has
    never heard of, and array rows with their ids — with only `audio` replaced.
    `scenario_patch` rebuilds its group field by field; this one does not, because four groups
    rebuilt by hand is four chances to drop a field the schema grew after this was written.

    `existing` is the **draft** document, fetched immediately before this call. Only the four
    narrated groups can appear in the patch; anything else is refused.
    """
    unknown = sorted(set(audio) - set(NARRATED_GROUPS))
    if unknown:
        raise ValueError(f"narration may only write {NARRATED_GROUPS}; asked for {unknown}")

    patch: dict[str, Any] = {}
    for group, ref in audio.items():
        current = existing.get(group)
        if not isinstance(current, Mapping) or not current:
            raise ValueError(
                f"the Leaf has no {group!r} group to carry forward; refusing to write one "
                "that would hold nothing but audio"
            )
        whole = copy.deepcopy(dict(current))
        whole["audio"] = ref.payload()
        patch[group] = whole
    return patch


def _content(value: Any) -> Any:
    """A value with array-row ids removed, for comparing what a document *says*.

    Row ids are Payload's bookkeeping for which row is which. They are sent back unchanged,
    but a comparison that failed on a regenerated id would report damage where the content
    is intact — and the content is what a reader sees.
    """
    if isinstance(value, Mapping):
        return {key: _content(item) for key, item in value.items()}
    if isinstance(value, list):
        return [
            _content({k: v for k, v in item.items() if k != "id"})
            if isinstance(item, Mapping)
            else _content(item)
            for item in value
        ]
    return value


def _without_audio(value: Any) -> Any:
    if not isinstance(value, Mapping):
        return value
    return {key: item for key, item in value.items() if key != "audio"}


def pending_changes_besides_narration(
    *, draft: Mapping[str, Any], live: Mapping[str, Any]
) -> list[str]:
    """Fields where a Leaf's latest draft differs from its live version, narration aside.

    **A draft write lands on top of whatever the latest draft already is.** If a Leaf is
    carrying unpublished edits, the founder's next publish — the one that is meant to add
    audio — would ship those edits too, and nobody would have decided that. So a non-empty
    answer stops the write. Differences inside `audio` are excluded, because that is what a
    re-run of this package itself leaves behind.
    """
    changed: list[str] = []
    for key in sorted((set(draft) | set(live)) - _VOLATILE_LEAF_KEYS):
        was, now = live.get(key), draft.get(key)
        if key in NARRATED_GROUPS:
            was, now = _without_audio(was), _without_audio(now)
        if _content(was) != _content(now):
            changed.append(key)
    return changed


@dataclass(frozen=True)
class WriteCheck:
    """What a re-fetch showed about one write. Evidence, not the PATCH response."""

    order: int
    problems: tuple[str, ...]

    @property
    def passed(self) -> bool:
        return not self.problems


def verify_narration_write(
    *,
    order: int,
    before: Mapping[str, Any],
    after: Mapping[str, Any],
    audio: Mapping[str, AudioRef],
) -> WriteCheck:
    """Whether the **re-fetched** draft carries exactly the audio written, and nothing else
    moved.

    Every key the Leaf has is compared, not only the four groups: a write that kept the
    summary's body and lost `sourceReferences` would pass a sibling check scoped to the
    groups it meant to touch, and `sourceReferences` is the audit trail.
    """
    problems: list[str] = []
    for group, ref in audio.items():
        stored = (after.get(group) or {}).get("audio") or {}
        if stored.get("url") != ref.url:
            problems.append(f"{group}.audio.url is {stored.get('url')!r}, wrote {ref.url!r}")
        duration = stored.get("durationSeconds")
        if not isinstance(duration, int | float) or abs(duration - ref.duration_seconds) > 1e-6:
            problems.append(
                f"{group}.audio.durationSeconds is {duration!r}, wrote {ref.duration_seconds}"
            )

    for key in sorted((set(before) | set(after)) - _VOLATILE_LEAF_KEYS):
        was, now = before.get(key), after.get(key)
        if key in audio:
            was, now = _without_audio(was), _without_audio(now)
        if _content(was) != _content(now):
            problems.append(f"{key} changed")
    return WriteCheck(order=order, problems=tuple(problems))


def verify_live_untouched(
    *, order: int, before: Mapping[str, Any], after: Mapping[str, Any]
) -> WriteCheck:
    """Whether the **published** Leaf is exactly as it was, and still published.

    The machine key cannot edit a live document, and the whole arrangement — audio waits in a
    draft until the founder publishes again — rests on that staying true. So it is checked
    from the outside on every Leaf rather than trusted from the access rule.
    """
    problems: list[str] = []
    if after.get("_status") != "published":
        problems.append(f"_status is {after.get('_status')!r}, not 'published'")
    for key in sorted((set(before) | set(after)) - {"updatedAt"}):
        if _content(before.get(key)) != _content(after.get(key)):
            problems.append(f"live {key} changed")
    return WriteCheck(order=order, problems=tuple(problems))
