"""The voiceover node: every narrated slide rendered once, checked, and attached as a draft.

A deliberate invocation over a finished run rather than a graph edge, for the reason
`generate-assets` gives: a node added behind `END` cannot reach a thread that already got
there, and Ikigai's has.

## Render — per line

Cache → budget → Cloud TTS → **disk** → level and edge → mp3 → measure → listen.

- **Cached by what was asked**, so nothing already paid for is bought twice. A re-run, a
  resumed run and the audition all draw from the same files; a new voice or a new direction
  is a new clip rather than a stale one.
- **On disk before anything can fail.** The raw audio is the thing that cost money, and WP30
  lost its most important evidence to a temporary directory.
- **Bounded regeneration.** A clip the guard calls major — a spoken tag, a dropped phrase —
  gets one more attempt. Then the better of the two is kept and named in the review, because
  a Leaf with a flagged clip is a listening task, and a Leaf with no clip is a player bug.

## Attach — per Leaf

1. **Refuse a Leaf that already has unpublished changes.** A draft write lands on the latest
   draft, and the founder's next publish would ship those changes along with the audio.
2. Snapshot both versions to disk, so a damaged write can be put back by hand.
3. **Find-then-upload** each clip by its content-hashed filename, and compare the bytes
   Payload serves with the bytes rendered — WP33.1's transfer proof, per clip.
4. **One PATCH**, of the four narrated groups whole, as a draft.
5. **Re-fetch both versions and compare.** The draft must hold exactly this audio and
   nothing else changed; the live Leaf must be exactly as it was, and still published.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Protocol

from zoomout_pipeline.assets.audio import (
    HEAD_PAD_SECONDS,
    TAIL_SILENCE_SECONDS,
    AudioError,
    ClipMetrics,
    EdgeReport,
    Pcm,
    decode_mp3,
    decode_wav,
    encode_mp3,
    level,
    measure,
    shape_edges,
)
from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.narration import (
    NARRATED_FIELDS,
    NarrationLine,
    clip_alt,
    clip_digest,
    clip_filename,
)
from zoomout_pipeline.assets.narration_guard import (
    GUARD_NODE,
    GuardSeverity,
    NarrationCheck,
    NarrationReading,
    check_narration,
    compare_words,
    guard_prompt_digest,
    guard_worst_case_usd,
    pace_is_natural,
    speaking_rate,
)
from zoomout_pipeline.assets.review_track import HeardClip
from zoomout_pipeline.assets.speech import (
    SpeechClient,
    SpeechError,
    speech_spend,
    worst_case_usd,
)
from zoomout_pipeline.cms.mapper import (
    AudioRef,
    WriteCheck,
    narration_patch,
    pending_changes_besides_narration,
    verify_live_untouched,
    verify_narration_write,
)
from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.llm.client import LLMError, StructuredClient
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

NARRATION_NODE = "narration"
NARRATION_NODES = frozenset({NARRATION_NODE, GUARD_NODE})

# One regeneration for a clip the guard calls major. Bounded, like every cycle here (R7): a
# second sample from the same model is a fresh bet at the same price, and a third is the same
# bet again.
MAX_NARRATION_ATTEMPTS = 2

MP3_MIME = "audio/mpeg"

# How long a clip of unknown length is assumed to run, for charging a call that timed out and
# never returned one. Measured on Ikigai: directed clips run about 12 characters a second.
ESTIMATED_CHARS_PER_SECOND = 12.0

# LINEAR16 as requested: a 44-byte header, then 24 kHz of 16-bit mono.
_WAV_HEADER_BYTES = 44
_BYTES_PER_SECOND = 24_000 * 2

SpendSink = Callable[[TokenSpend], None]


class NarrationWriteError(RuntimeError):
    """A Leaf could not be narrated safely. Nothing further is written to it."""


class NarrationHeldError(NarrationWriteError):
    """A Leaf's clips are not all the approved text. Held back whole; nothing was written.

    **A clip that says other words does not proceed — not with a flag.** It stays on disk and
    in the review track for a person to hear. The whole Leaf waits, because three clips and a
    silent fourth reads as a broken player rather than as a decision.
    """


def narration_spent_usd(cost: RunCost) -> float:
    """What this run has already spent on voiceover, across every earlier invocation."""
    return sum(entry.usd for entry in cost.entries if entry.node in NARRATION_NODES)


# ------------------------------------------------------------------------------ disk


@dataclass(frozen=True)
class ClipStore:
    """Where a run's narration lives on disk: `runs/<run>/audio/`.

    `raw/` holds what the model returned, named by what was asked. `checks/` holds what the
    guard heard, named by the clip and the bytes it heard. `final/` holds the mp3 each Leaf
    was given, under its upload filename. `snapshots/` holds each Leaf as it was before its
    write.
    """

    root: Path

    def raw_path(self, digest: str) -> Path:
        return self.root / "raw" / f"{digest}.wav"

    def save_raw(self, digest: str, wav: bytes, meta: Mapping[str, Any]) -> None:
        """Written whole or not at all. The WAV's existence is what marks a clip as paid for,
        so a file cut short by a killed process would be served from cache forever."""
        path = self.raw_path(digest)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.with_suffix(".json").write_text(
            json.dumps(dict(meta), indent=2, ensure_ascii=False), encoding="utf-8"
        )
        partial = path.with_suffix(".wav.partial")
        partial.write_bytes(wav)
        partial.replace(path)

    def check_path(self, digest: str, content_hash: str, model: str) -> Path:
        """Keyed by the clip, the bytes heard, the listening model **and what it was asked** —
        a rewritten guard prompt is a different check, and a cached reading from the old one
        must not answer for it."""
        return (
            self.root
            / "checks"
            / f"{digest[:16]}-{content_hash[:12]}-{model}-{guard_prompt_digest()[:8]}.json"
        )

    def final_path(self, filename: str) -> Path:
        return self.root / "final" / filename

    def snapshot(self, order: int, **documents: Mapping[str, Any]) -> Path:
        """Each write's "before", numbered, never overwritten. The first is the Leaf as it
        was before any narration touched it — the one a hand-restore needs — and a second voice
        or a re-run must not replace it with a later state."""
        folder = self.root / "snapshots"
        folder.mkdir(parents=True, exist_ok=True)
        taken = len(list(folder.glob(f"leaf-{order:02d}-before-*.json")))
        path = folder / f"leaf-{order:02d}-before-{taken + 1}.json"
        path.write_text(json.dumps(documents, indent=2, ensure_ascii=False), encoding="utf-8")
        return path


# ---------------------------------------------------------------------------- render


@dataclass(frozen=True)
class Guard:
    """The listening model, and which one it is."""

    llm: StructuredClient
    model: str


@dataclass(frozen=True)
class RenderedClip:
    """One narrated line, as it will be uploaded, and everything known about it."""

    line: NarrationLine
    voice: str
    prompt: str
    digest: str
    attempt: int
    mp3: bytes
    sha256: str
    duration_seconds: float
    pcm: Pcm
    gain_db: float
    edges: EdgeReport
    metrics: ClipMetrics
    check: NarrationCheck | None
    # True only when a guard was asked to listen and could not. A run with the guard switched
    # off says so once, in the review's preamble, rather than on every clip.
    guard_failed: bool
    from_cache: bool
    attempts_made: int = 1

    @property
    def words_per_minute(self) -> float:
        """The pace a listener hears: words over the clip's spoken span, pauses included."""
        spoken = self.duration_seconds - HEAD_PAD_SECONDS - TAIL_SILENCE_SECONDS
        return speaking_rate(self.line.text, spoken)

    @property
    def articulation_wpm(self) -> float:
        """Words over speech time only — what the pace check reads."""
        return speaking_rate(self.line.text, self.metrics.speech_seconds)

    @property
    def pace_natural(self) -> bool:
        return pace_is_natural(self.articulation_wpm)

    @property
    def severity(self) -> GuardSeverity | None:
        """The listening model's verdict — overruled to MAJOR by an unnatural pace, which is
        measured rather than heard and so holds when the transcriber leaves something out."""
        if not self.pace_natural:
            return GuardSeverity.MAJOR
        return self.check.severity if self.check is not None else None

    @property
    def passed(self) -> bool:
        return self.severity is not GuardSeverity.MAJOR

    def heard(self, title: str) -> HeardClip:
        return HeardClip(
            line=self.line,
            title=title,
            voice=self.voice,
            pcm=self.pcm,
            metrics=self.metrics,
            edges=self.edges,
            gain_db=self.gain_db,
            check=self.check,
            guard_failed=self.guard_failed,
        )


_SEVERITY_RANK = {GuardSeverity.EXACT: 0, GuardSeverity.MINOR: 1, GuardSeverity.MAJOR: 2}


def _rank(clip: RenderedClip) -> tuple[int, int, int]:
    severity = clip.severity
    rank = 1 if severity is None else _SEVERITY_RANK[severity]
    errors = clip.check.diff.errors if clip.check is not None else 0
    return (rank, errors, clip.attempt)


def render_line(
    *,
    line: NarrationLine,
    speech: SpeechClient,
    voice: str,
    prompt: str,
    store: ClipStore,
    budget: NarrationBudget,
    record: SpendSink,
    guard: Guard | None,
    max_attempts: int = MAX_NARRATION_ATTEMPTS,
) -> RenderedClip:
    """One line, spoken, checked, and ready to upload — the best of at most `max_attempts`."""
    tried: list[RenderedClip] = []
    for attempt in range(1, max_attempts + 1):
        clip = _render_attempt(
            line=line,
            speech=speech,
            voice=voice,
            prompt=prompt,
            attempt=attempt,
            store=store,
            budget=budget,
            record=record,
            guard=guard,
        )
        tried.append(clip)
        if clip.passed:
            break
        _log.warning(
            "narration.guard_major",
            leaf=line.order,
            slide=line.slide.value,
            attempt=attempt,
            articulation_wpm=round(clip.articulation_wpm),
            findings=clip.check.findings() if clip.check is not None else [],
        )

    best = min(tried, key=_rank)
    if not best.passed:
        _log.error(
            "narration.guard_exhausted",
            leaf=line.order,
            slide=line.slide.value,
            attempts=len(tried),
            articulation_wpm=round(best.articulation_wpm),
            findings=best.check.findings() if best.check is not None else [],
        )
    return replace(best, attempts_made=len(tried))


def _render_attempt(
    *,
    line: NarrationLine,
    speech: SpeechClient,
    voice: str,
    prompt: str,
    attempt: int,
    store: ClipStore,
    budget: NarrationBudget,
    record: SpendSink,
    guard: Guard | None,
) -> RenderedClip:
    digest = clip_digest(
        model=speech.model,
        voice=voice,
        language=speech.language_code,
        prompt=prompt,
        text=line.spoken,
        attempt=attempt,
    )
    raw_path = store.raw_path(digest)
    from_cache = raw_path.exists()
    if from_cache:
        raw = decode_wav(raw_path.read_bytes())
    else:
        budget.reserve(
            worst_case_usd=worst_case_usd(
                model=speech.model, request_bytes=speech.request_bytes(line, prompt=prompt)
            ),
            what=f"{line.label} in {voice}",
        )
        try:
            result = speech.synthesize(line, voice=voice, prompt=prompt)
        except SpeechError as error:
            # No clip, but a call that timed out may still have been generated and charged.
            # Estimated from the text, and counted, before the failure surfaces.
            estimate = speech_spend(
                model=speech.model,
                node=NARRATION_NODE,
                audio_seconds=len(line.spoken) / ESTIMATED_CHARS_PER_SECOND,
                request_bytes=speech.request_bytes(line, prompt=prompt),
            )
            for _ in range(error.possibly_billed):
                record(estimate)
                budget.settle(estimate.usd)
            raise
        # On disk before anything below can fail — reading it included. This is the part that
        # cost money.
        store.save_raw(
            digest,
            result.wav,
            {
                "leaf": line.order,
                "slide": line.slide.value,
                "voice": voice,
                "model": speech.model,
                "language": speech.language_code,
                "endpoint": speech.endpoint,
                "attempt": attempt,
                "prompt": prompt,
                "text": line.spoken,
            },
        )
        try:
            raw = decode_wav(result.wav)
            billed_seconds = raw.seconds
        except AudioError:
            # Paid for and unreadable. Charged at what its size implies for 24 kHz 16-bit
            # mono — the format asked for — before the error surfaces, so the ledger is not
            # short by a clip it cannot read.
            billed_seconds = max(0.0, (len(result.wav) - _WAV_HEADER_BYTES) / _BYTES_PER_SECOND)
            unreadable = speech_spend(
                model=speech.model,
                node=NARRATION_NODE,
                audio_seconds=billed_seconds,
                request_bytes=result.request_bytes,
            )
            record(unreadable)
            budget.settle(unreadable.usd)
            raise
        spend = speech_spend(
            model=speech.model,
            node=NARRATION_NODE,
            audio_seconds=billed_seconds,
            request_bytes=result.request_bytes,
        )
        # A call that timed out may still have been generated and billed. Counted as if it
        # was: the ledger may over-report by a few tenths of a cent, never under-report.
        for _ in range(1 + result.possibly_billed_attempts):
            record(spend)
            budget.settle(spend.usd)

    levelled, gain_db = level(raw)
    shaped, edges = shape_edges(levelled)
    mp3 = encode_mp3(shaped)
    decoded = decode_mp3(mp3)
    content_hash = hashlib.sha256(mp3).hexdigest()

    check: NarrationCheck | None = None
    guard_failed = False
    if guard is not None:
        try:
            check = _listen(
                line=line,
                mp3=mp3,
                content_hash=content_hash,
                digest=digest,
                seconds=decoded.seconds,
                store=store,
                budget=budget,
                record=record,
                guard=guard,
            )
        except LLMError as error:
            # Not fatal to the clip — a guard outage is not a bad clip — and not silent: the
            # review names every clip nobody listened to.
            _log.error(
                "narration.guard_failed", leaf=line.order, slide=line.slide.value, error=str(error)
            )
            guard_failed = True

    return RenderedClip(
        line=line,
        voice=voice,
        prompt=prompt,
        digest=digest,
        attempt=attempt,
        mp3=mp3,
        sha256=content_hash,
        # Measured from the decoded upload, to the hundredth of a second — what the player
        # will actually play, encoder padding included.
        duration_seconds=round(decoded.seconds, 2),
        pcm=decoded,
        gain_db=round(gain_db, 2),
        edges=edges,
        metrics=measure(decoded),
        check=check,
        guard_failed=guard_failed,
        from_cache=from_cache,
    )


def _listen(
    *,
    line: NarrationLine,
    mp3: bytes,
    content_hash: str,
    digest: str,
    seconds: float,
    store: ClipStore,
    budget: NarrationBudget,
    record: SpendSink,
    guard: Guard,
) -> NarrationCheck:
    """The guard's reading of these exact bytes — from disk when it has already been paid for."""
    path = store.check_path(digest, content_hash, guard.model)
    if path.exists():
        saved = json.loads(path.read_text(encoding="utf-8"))
        reading = NarrationReading.model_validate(saved["reading"])
        return NarrationCheck(
            reading=reading,
            diff=compare_words(line.text, reading.transcript),
            spend=TokenSpend.model_validate(saved["spend"]),
        )

    budget.reserve(
        worst_case_usd=guard_worst_case_usd(model=guard.model, audio_seconds=seconds),
        what=f"listening to {line.label}",
    )
    check = check_narration(llm=guard.llm, mp3=mp3, expected=line.text, model=guard.model)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "reading": check.reading.model_dump(mode="json"),
                "spend": check.spend.model_dump(mode="json"),
                "expected": line.text,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    record(check.spend)
    budget.settle(check.spend.usd)
    return check


# ---------------------------------------------------------------------------- attach


class NarrationCms(Protocol):
    """The slice of `PayloadClient` narration writes through."""

    def get_leaf(self, leaf_id: int, *, draft: bool = True) -> dict[str, Any]: ...

    def find_media(self, *, filename: str) -> dict[str, Any] | None: ...

    def upload_media(
        self, *, data: bytes, filename: str, alt: str, mime_type: str = "image/png"
    ) -> dict[str, Any]: ...

    def fetch_media(self, url: str) -> bytes: ...

    def update_leaf_draft(self, *, leaf_id: int, patch: dict[str, Any]) -> dict[str, Any]: ...


@dataclass(frozen=True)
class AttachedLeaf:
    order: int
    leaf_id: int
    wrote: bool
    media: dict[str, dict[str, Any]]
    draft_check: WriteCheck
    live_check: WriteCheck
    uploads: int = 0
    problems: tuple[str, ...] = field(default_factory=tuple)

    @property
    def passed(self) -> bool:
        return self.draft_check.passed and self.live_check.passed and not self.problems


def attach_leaf_narration(
    *,
    client: NarrationCms,
    leaf_id: int,
    clips: Sequence[RenderedClip],
    book_title: str,
    store: ClipStore,
) -> AttachedLeaf:
    """Upload one Leaf's clips and attach them to its draft, then prove what was stored."""
    orders = {clip.line.order for clip in clips}
    if len(orders) != 1:
        raise NarrationWriteError(f"one Leaf's clips expected, got Leaves {sorted(orders)}")
    order = orders.pop()
    failing = [clip for clip in clips if not clip.passed]
    if failing:
        raise NarrationHeldError(
            f"Leaf {order} held: "
            + "; ".join(
                f"{clip.line.slide.value} at {clip.articulation_wpm:.0f} words a minute of speech"
                + (f" ({', '.join(clip.check.findings())})" if clip.check is not None else "")
                for clip in failing
            )
        )

    before_draft = client.get_leaf(leaf_id, draft=True)
    before_live = client.get_leaf(leaf_id, draft=False)
    if int(before_draft.get("orderIndex", -1)) != order:
        raise NarrationWriteError(
            f"Leaf id {leaf_id} is orderIndex {before_draft.get('orderIndex')!r}, not {order} — "
            "refusing to put one Leaf's narration on another"
        )
    pending = pending_changes_besides_narration(draft=before_draft, live=before_live)
    if pending:
        raise NarrationWriteError(
            f"Leaf {order} (id {leaf_id}) already has unpublished changes in {pending}. A draft "
            "write would bundle them into the founder's next publish. Publish or discard them "
            "first; nothing was written."
        )
    store.snapshot(order, draft=before_draft, live=before_live)

    refs: dict[str, AudioRef] = {}
    media: dict[str, dict[str, Any]] = {}
    problems: list[str] = []
    uploads = 0
    for clip in clips:
        group, _field = NARRATED_FIELDS[clip.line.slide]
        filename = clip_filename(
            book_title=book_title, line=clip.line, voice=clip.voice, content_hash=clip.sha256
        )
        alt = clip_alt(book_title=book_title, line=clip.line, voice=clip.voice)
        final = store.final_path(filename)
        final.parent.mkdir(parents=True, exist_ok=True)
        final.write_bytes(clip.mp3)

        doc = client.find_media(filename=filename)
        if doc is None:
            doc = client.upload_media(data=clip.mp3, filename=filename, alt=alt, mime_type=MP3_MIME)
            uploads += 1

        url = doc.get("url")
        if not isinstance(url, str) or not url:
            raise NarrationWriteError(f"Payload returned no url for {filename}")
        if doc.get("filename") not in (None, filename):
            # Payload renames a clashing upload. A renamed clip cannot be found by its name on
            # the next run, so the find-then-skip above would upload it again.
            problems.append(f"{filename} was stored as {doc.get('filename')!r}")
        if doc.get("alt") not in (None, alt):
            problems.append(f"{filename} carries alt {doc.get('alt')!r}, expected {alt!r}")

        served = hashlib.sha256(client.fetch_media(url)).hexdigest()
        if served != clip.sha256:
            raise NarrationWriteError(
                f"{filename}: Payload serves bytes {served[:12]}… but the clip rendered was "
                f"{clip.sha256[:12]}… — refusing to attach a file that is not the one checked"
            )

        refs[group] = AudioRef(url=url, duration_seconds=clip.duration_seconds)
        media[group] = {
            "media_id": doc.get("id"),
            "url": url,
            "filename": filename,
            "alt": alt,
            "durationSeconds": clip.duration_seconds,
            "sha256": clip.sha256,
            "voice": clip.voice,
            "digest": clip.digest,
            "attempt": clip.attempt,
            "severity": clip.severity.value if clip.severity is not None else None,
        }

    already = all(
        ((before_draft.get(group) or {}).get("audio") or {}) == ref.payload()
        for group, ref in refs.items()
    )
    if not already:
        client.update_leaf_draft(
            leaf_id=leaf_id, patch=narration_patch(existing=before_draft, audio=refs)
        )

    # Re-fetched, never read from the PATCH response: WP19 nulled a group's siblings by hand
    # and the response looked fine.
    after_draft = client.get_leaf(leaf_id, draft=True)
    after_live = client.get_leaf(leaf_id, draft=False)
    attached = AttachedLeaf(
        order=order,
        leaf_id=leaf_id,
        wrote=not already,
        media=media,
        draft_check=verify_narration_write(
            order=order, before=before_draft, after=after_draft, audio=refs
        ),
        live_check=verify_live_untouched(order=order, before=before_live, after=after_live),
        uploads=uploads,
        problems=tuple(problems),
    )
    _log.info(
        "narration.attached",
        leaf=order,
        leaf_id=leaf_id,
        wrote=attached.wrote,
        uploads=uploads,
        passed=attached.passed,
    )
    return attached


__all__ = [
    "MAX_NARRATION_ATTEMPTS",
    "NARRATION_NODE",
    "NARRATION_NODES",
    "AttachedLeaf",
    "ClipStore",
    "Guard",
    "NarrationCms",
    "NarrationHeldError",
    "NarrationWriteError",
    "RenderedClip",
    "attach_leaf_narration",
    "narration_spent_usd",
    "render_line",
]
