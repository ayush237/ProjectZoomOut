"""The voiceover node: every narrated slide rendered once, checked, and attached as a draft.

A deliberate invocation over a finished run rather than a graph edge, for the reason
`generate-assets` gives: a node added behind `END` cannot reach a thread that already got
there, and Ikigai's has.

## Render — per line

Cache → budget → Cloud TTS → **disk** → level and edge (**and stretch**) → mp3 → measure → listen.

- **Cached by what was asked**, so nothing already paid for is bought twice. A re-run, a
  resumed run and the audition all draw from the same files; a new voice or a new direction
  is a new clip rather than a stale one.
- **On disk before anything can fail.** The raw audio is the thing that cost money, and WP30
  lost its most important evidence to a temporary directory.
- **Faster than the model, without buying anything (VO-4).** `tempo` speeds the speech up on the
  way to the mp3 (`shape_edges`, `change_tempo`), from the raw audio as the model returned it.
  `raw/` is never written by a stretch, so a stretched clip cannot be served back as raw and
  stretched again, and the cache key does not move: the same asked-for clip, a different mp3.
- **Unable to spend, on request.** `no_synthesis` refuses, before the budget or the client is
  touched, any clip whose audio is not already on disk. The guard's listening is a separate
  purchase and is not affected.
- **Bounded regeneration.** A clip the guard calls major — a spoken tag, a dropped phrase —
  is attempted again, up to `MAX_NARRATION_ATTEMPTS` in all. Then the best attempt is kept and
  named in the review, because a Leaf with a flagged clip is a listening task, and a Leaf with
  no clip is a player bug.

## Plan — before anything is bought (VO-4.1)

`narrate` asks the cache's own key, for free, what a run will need: `missing_first_attempts`
runs `clip_key` over each Leaf's *current* text. A `--no-synthesis` run **holds** a Leaf with any
clip missing — named, nothing rendered or listened to — and carries on with the next; a run that
may synthesise prints what it is about to buy. `render_line` and `_render_attempt` are unchanged
for library callers and still raise `NarrationNotOnDiskError`; deciding that one Leaf's edited
text must not stop eight clean ones is the command's job, not the render's. `review_target` is
the same kind of decision for the review tracks: a run overwrites a review only if it covers every
Leaf it was asked for **and every Leaf the review it replaces covers**; otherwise it writes beside
it, under a name no earlier review already has.

## Attach — per Leaf

**Both narrators or none** (VO-2.1): `attach_leaf_narration` takes one Leaf's clips across
*every* narrated slide **and every narrator together** — eight clips, not four. A reader who
chose one narrator must never be handed the other mid-book, so the all-or-nothing rule VO-2
already applied across a Leaf's four slides now applies across its two voices as well, in the
same refusal, before anything is read or uploaded.

1. **Refuse a Leaf that already has unpublished changes.** A draft write lands on the latest
   draft, and the founder's next publish would ship those changes along with the audio.
2. Snapshot both versions to disk, so a damaged write can be put back by hand.
3. **Find-then-upload** each clip by its content-hashed filename, and compare the bytes
   Payload serves with the bytes rendered — WP33.1's transfer proof, per clip.
4. **One PATCH**, of the four narrated groups whole, each `audio` now a two-row array keyed by
   narrator — still one write per Leaf, not one per voice.
5. **Re-fetch both versions and compare.** The draft must hold exactly this audio, both
   narrators, and nothing else changed; the live Leaf must be exactly as it was, and still
   published.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Protocol

from zoomout_pipeline.assets.audio import (
    HEAD_PAD_SECONDS,
    MIN_TEMPO,
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
    require_tempo,
    shape_edges,
)
from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.narration import (
    NARRATED_FIELDS,
    NARRATOR_VOICES,
    NarratedSlide,
    NarrationLine,
    clip_alt,
    clip_digest,
    clip_filename,
    direction_for,
    narrator_for_voice,
    text_digest,
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
    narration_already_attached,
    narration_patch,
    pending_changes_besides_narration,
    verify_live_untouched,
    verify_narration_write,
)
from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.llm.client import LLMError, StructuredClient
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import NarratorId

_log = get_logger(__name__)

NARRATION_NODE = "narration"
NARRATION_NODES = frozenset({NARRATION_NODE, GUARD_NODE})

# Three attempts for a clip the guard or the pace check calls major. **Ruled 2026-09-18 and again
# 2026-09-22**, against this constant's own earlier comment, which called a third attempt "the
# same bet again". The trade is not the odds of one sample but what a failure costs: one
# difficult line holds its **whole Leaf**, which costs the founder's attention and a re-run, and
# that is dearer than one more render and listen. Still bounded, like every cycle here (R7):
# after the third the best attempt is kept and named, and the voiceover ceiling stops the spend
# whatever this says. `narrate --max-attempts` defaults to it, pinned by
# `tests/test_attempt_defaults.py`; the greeting library keeps its own (`MAX_GREETING_ATTEMPTS`).
MAX_NARRATION_ATTEMPTS = 3

# How much faster than the model's own pace a book's narration is played (VO-4). **Ruled by the
# founder 2026-09-25**: at the device gate the lessons were "too slow and boring" next to the
# narrator hellos, and a constant time-stretch of the clips already on disk was chosen over an
# audition or a re-render. +30% takes the median lesson from about 160 to about 208 words a
# minute of speech - audiobook pace - and the fastest clip from about 215 to about 280, inside
# the pace band's 330. It is a founder's-ear number, not a derived one: matching the hellos would
# take about 1.5x, which is where a stretch starts to sound processed.
#
# `narrate --tempo` defaults to this and `tests/test_tempo_defaults.py` pins the five places it is
# stated. **`render_line`'s own default is 1.0, deliberately**: every other caller (the audition,
# every existing test) keeps the model's pace, and only the command the founder runs is faster.
NARRATION_TEMPO = 1.3

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


class NarrationNotOnDiskError(RuntimeError):
    """`no_synthesis` was asked to render a clip whose audio is not already on disk.

    Nothing was synthesised and nothing was reserved. It names the line and the voice, never the
    words: a Leaf's text is ZoomOut's own prose, but an error message is read and logged in
    places its text was never meant to be. `narrate` treats it as a hold on that one Leaf
    (VO-4.1), not a stop for the run.
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


# ----------------------------------------------------------------------------- plan
#
# What a run is going to do, decided before it does anything and for free. Nothing here calls a
# model, reads audio, or writes a file: a key, a `stat`, and the text of a review's cue sheet.


def clip_key(
    *, speech: SpeechClient, voice: str, prompt: str, line: NarrationLine, attempt: int
) -> str:
    """The raw cache's key for one attempt at one line — **the only place it is built for Leaf
    narration.** The greeting library builds its own (`graph/greeting_nodes.py`), from its own
    fixed sentences and its own cache, and does not go through here.

    `_render_attempt` reads and writes `raw/` through it, and the pre-flight below asks it
    whether a clip is already paid for. They must agree to the character, because the
    pre-flight is only worth anything if it answers the question the render is about to ask. The
    key includes the line's *text*, which is what turns a Leaf whose words were edited after it
    was narrated into a cache miss instead of a stale hit.
    """
    return clip_digest(
        model=speech.model,
        voice=voice,
        language=speech.language_code,
        prompt=prompt,
        text=line.spoken,
        attempt=attempt,
    )


@dataclass(frozen=True)
class MissingClip:
    """A clip whose first attempt is not in `raw/`, named by slide and narrator and **never by
    its words**: an error message is read and logged in places a Leaf's text was never meant
    to be."""

    slide: NarratedSlide
    narrator: NarratorId
    voice: str

    def describe(self) -> str:
        return f"{self.slide.value} ({self.narrator.value}, {self.voice})"


def missing_first_attempts(
    *,
    lines: Sequence[NarrationLine],
    narrators: Mapping[NarratorId, str],
    speech: SpeechClient,
    store: ClipStore,
    direction: Callable[[NarratedSlide], str] = direction_for,
) -> list[MissingClip]:
    """Every clip of `lines`, in every narrator's voice, whose first attempt is not on disk.

    **Through the cache's own key over the lines' current text** (`clip_key`), not through a
    proxy for it. The VO-4 handoff said all 144 accepted clips were cached, having checked by
    (Leaf, slide, voice); that key passes exactly when the text has drifted, which is the case
    that matters, and the run halted at Leaf 9's payoff for it. In render order: each narrator's
    voice in turn, each line in reading order.
    """
    missing: list[MissingClip] = []
    for narrator, voice in narrators.items():
        for line in lines:
            digest = clip_key(
                speech=speech, voice=voice, prompt=direction(line.slide), line=line, attempt=1
            )
            if not store.raw_path(digest).exists():
                missing.append(MissingClip(slide=line.slide, narrator=narrator, voice=voice))
    return missing


_REVIEW_CLIPS = re.compile(r"\*\*(\d+) clips, ")
# One row of a cue sheet's "Every clip" table: `| 04:12 | Leaf 7 Payoff | 14.2s | ...`.
_REVIEW_ROW = re.compile(r"^\| \d+:\d\d \| Leaf (\d+) ", re.MULTILINE)
_REVIEW_SUFFIXES = (".mp3", ".md", ".html")


def leaves_label(orders: Iterable[int]) -> str:
    """Leaf orders as ranges, for a file name that says what it covers: `0-3+8+10-11`."""
    runs: list[list[int]] = []
    for order in sorted(set(orders)):
        if runs and order == runs[-1][1] + 1:
            runs[-1][1] = order
        else:
            runs.append([order, order])
    return "+".join(str(first) if first == last else f"{first}-{last}" for first, last in runs)


def existing_review_clips(destination: Path) -> int | None:
    """How many clips the review at `destination` (no suffix) holds: **0** if there is none, and
    **None** if there is one whose count cannot be read — which a caller must take as "do not
    overwrite", since a review nobody can read the size of cannot be shown to be smaller."""
    parts = [destination.with_suffix(suffix) for suffix in (".mp3", ".md", ".html")]
    if not any(part.exists() for part in parts):
        return 0
    sheet = destination.with_suffix(".md")
    if not sheet.exists():
        return None
    found = _REVIEW_CLIPS.search(sheet.read_text(encoding="utf-8"))
    return int(found.group(1)) if found else None


def existing_review_leaves(destination: Path) -> frozenset[int] | None:
    """Which Leaves the review at `destination` (no suffix) covers, read from its cue sheet's table:
    **empty** if there is no review, and **None** if there is one whose Leaves cannot be read, which
    a caller must take as "do not overwrite" for the same reason as an unreadable size: a review
    nobody can say the coverage of cannot be shown to be covered by anything."""
    parts = [destination.with_suffix(suffix) for suffix in _REVIEW_SUFFIXES]
    if not any(part.exists() for part in parts):
        return frozenset()
    sheet = destination.with_suffix(".md")
    if not sheet.exists():
        return None
    rows = _REVIEW_ROW.finditer(sheet.read_text(encoding="utf-8"))
    return frozenset(int(row.group(1)) for row in rows) or None


def _first_unused(stem: Path) -> Path:
    """`stem`, or `stem-2`, `stem-3`... — the first of them that no review file is already using."""
    candidate, number = stem, 1
    while any(candidate.with_suffix(suffix).exists() for suffix in _REVIEW_SUFFIXES):
        number += 1
        candidate = stem.with_name(f"{stem.name}-{number}")
    return candidate


@dataclass(frozen=True)
class ReviewTarget:
    """Where one voice's review is written, and whether that is beside the existing one."""

    destination: Path
    beside: bool
    existing_clips: int | None
    covered: str


def review_target(
    *, folder: Path, name: str, asked: Iterable[int], covered: Iterable[int], clips: int
) -> ReviewTarget:
    """Where a run's review is written: over the existing one, or beside it.

    **A partial run cannot shrink a review.** VO-4's run covered Leaves 0-8, rebuilt `review/`
    from them, and replaced the 72-clip full-book tracks with 36-clip ones; the originals
    survived only because a copy had been taken by hand. So a run overwrites an existing review
    only when it covers **every Leaf it was asked for and every Leaf the review it replaces
    covers** (and at least as many clips, which for whole Leaves is the same thing said twice).
    **By Leaf, not by count**: a run over Leaves 9-17 has as many clips as a review of Leaves 0-8
    and shrinks nothing by that measure, yet it would take the 0-8 review's name and lose it.
    Anything else is written beside it, under a name that carries the coverage
    (`<name>-leaves-0-8+10-17`) **and that no review already has**: a second partial run of the same
    Leaves gets `-2`, never the first one's files. With no existing review there is nothing to
    shrink and the standard name is used; an existing review whose size or whose Leaves cannot be
    read is never overwritten.
    """
    standard = folder / name
    existing = existing_review_clips(standard)
    there = existing_review_leaves(standard)
    covered_set = set(covered)
    label = leaves_label(covered_set)
    if existing == 0:
        return ReviewTarget(standard, False, 0, label)
    if (
        existing is not None
        and there is not None
        and covered_set >= set(asked)
        and covered_set >= there
        and clips >= existing
    ):
        return ReviewTarget(standard, False, existing, label)
    return ReviewTarget(_first_unused(folder / f"{name}-leaves-{label}"), True, existing, label)


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
    # How much faster than the model's own audio this clip plays (1.0 = as it came back). Carried
    # so the run's state records which clips are stretched, and so a reader of `cms_narration`
    # never has to infer it from a filename or a date.
    tempo: float = MIN_TEMPO

    @property
    def words_per_minute(self) -> float:
        """The pace a listener hears: words over the clip's spoken span, pauses included.

        The head and the tail are subtracted as the constants they are: `_render_attempt` gives
        every clip the same 60 ms and 350 ms whatever its tempo, which is what keeps this figure
        honest for a stretched clip."""
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
    tempo: float = MIN_TEMPO,
    no_synthesis: bool = False,
) -> RenderedClip:
    """One line, spoken, checked, and ready to upload — the best of at most `max_attempts`.

    **`tempo`** speeds the speech up by that factor without synthesising anything: the clip is
    made from the model's audio as it came back, exactly as before, and stretched on the way to
    the mp3. Its default is 1.0 - the model's own pace - and stays there: `narrate` passes
    `NARRATION_TEMPO` and everything else, the audition included, keeps the pace it always had.

    **`no_synthesis`** makes the render unable to buy a clip. Cloud TTS is never called and no
    speech is reserved against the budget; the guard still listens, and still costs. A first
    attempt that is not on disk is a `NarrationNotOnDiskError`. A *later* attempt that is not on
    disk ends this line's retries and keeps the best attempt so far, the same outcome as
    attempts exhausted - so a clip the guard still fails holds its Leaf, and does not cause a
    paid regeneration.
    """
    tried: list[RenderedClip] = []
    for attempt in range(1, max_attempts + 1):
        try:
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
                tempo=tempo,
                no_synthesis=no_synthesis,
            )
        except NarrationNotOnDiskError:
            if not tried:
                raise
            _log.warning(
                "narration.retries_ended_not_on_disk",
                leaf=line.order,
                slide=line.slide.value,
                voice=voice,
                attempt=attempt,
            )
            break
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
    tempo: float,
    no_synthesis: bool,
) -> RenderedClip:
    # Before anything can be bought: a bad tempo found after a synthesis is a clip paid for and
    # never used.
    require_tempo(tempo)
    digest = clip_key(speech=speech, voice=voice, prompt=prompt, line=line, attempt=attempt)
    raw_path = store.raw_path(digest)
    from_cache = raw_path.exists()
    if from_cache:
        raw = decode_wav(raw_path.read_bytes())
    elif no_synthesis:
        # Refused before `budget.reserve` and before the client is touched: this branch is what
        # makes a run over cached audio unable to buy a clip.
        raise NarrationNotOnDiskError(
            f"{line.label} in {voice} (attempt {attempt}) is not on disk, and this run may not "
            "synthesise. Nothing was reserved and nothing was called."
        )
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

    # **Where the stretch goes, and why.** The model's audio is levelled and its edges decided as
    # ever, from the audio as the model returned it: `edges` is therefore the same at every tempo,
    # which is what the review's "cut a breath" and "ended mid-sound" notes rest on. A tempo above
    # 1.0 then speeds up only the speech between the two edges, inside `shape_edges`, so the head
    # and the tail are the 60 ms and 350 ms `words_per_minute` subtracts as constants rather than
    # those divided by the tempo. The result is levelled once more: a stretch is not exactly
    # level-neutral, and the loudness and the peak ceiling belong to what reaches the encoder.
    # Nothing here writes to `raw/`, which holds what the model returned and nothing else.
    levelled, gain_db = level(raw)
    shaped, edges = shape_edges(levelled, tempo=tempo)
    if tempo != MIN_TEMPO:
        shaped, _residual_gain_db = level(shaped)
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
        tempo=tempo,
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
    media: dict[str, dict[str, dict[str, Any]]]
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
    """Upload one Leaf's clips — every narrated slide, both narrators — and attach them to its
    draft, then prove what was stored.

    `clips` must be exactly one clip per (slide, narrator) pair: both of `NARRATOR_VOICES`,
    all four of `NARRATED_FIELDS`. A caller with only one narrator's clips is refused rather
    than partially attached — see the module docstring.
    """
    orders = {clip.line.order for clip in clips}
    if len(orders) != 1:
        raise NarrationWriteError(f"one Leaf's clips expected, got Leaves {sorted(orders)}")
    order = orders.pop()

    present = [(clip.line.slide, clip.voice) for clip in clips]
    if len(present) != len(set(present)):
        duplicates = sorted({str(key) for key in present if present.count(key) > 1})
        raise NarrationWriteError(f"Leaf {order}: more than one clip for {duplicates}")

    # Both narrators or none — extended from "every slide" (VO-2) to "every slide, every
    # narrator" (VO-2.1). Checked as a full set, not just a count, so a caller that swapped
    # one narrator's clips for a duplicate of the other's is refused too, not just one short.
    expected = {(slide, voice) for slide in NARRATED_FIELDS for voice in NARRATOR_VOICES.values()}
    missing = sorted(str(key) for key in expected - set(present))
    if missing:
        raise NarrationWriteError(
            f"Leaf {order}: missing clips for {missing} — both narrators are required on "
            "every narrated slide, or none are attached"
        )
    extra = sorted(str(key) for key in set(present) - expected)
    if extra:
        raise NarrationWriteError(f"Leaf {order}: clips for {extra} are not a ruled narrator")

    failing = [clip for clip in clips if not clip.passed]
    if failing:
        raise NarrationHeldError(
            f"Leaf {order} held: "
            + "; ".join(
                f"{clip.line.slide.value} ({clip.voice}) at {clip.articulation_wpm:.0f} words a "
                "minute of speech"
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

    refs: dict[str, list[AudioRef]] = {}
    media: dict[str, dict[str, dict[str, Any]]] = {}
    problems: list[str] = []
    uploads = 0
    for clip in clips:
        group, _field = NARRATED_FIELDS[clip.line.slide]
        narrator = narrator_for_voice(clip.voice)
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

        ref = AudioRef(
            narrator=narrator.value,
            url=url,
            duration_seconds=clip.duration_seconds,
            text_digest=text_digest(clip.line.text),
        )
        refs.setdefault(group, []).append(ref)
        media.setdefault(group, {})[narrator.value] = {
            "media_id": doc.get("id"),
            "url": url,
            "filename": filename,
            "alt": alt,
            "durationSeconds": clip.duration_seconds,
            "sha256": clip.sha256,
            "voice": clip.voice,
            "digest": clip.digest,
            "textDigest": ref.text_digest,
            "attempt": clip.attempt,
            "severity": clip.severity.value if clip.severity is not None else None,
            # Which clips are stretched, and by how much, is state worth keeping: nothing in
            # the CMS says so.
            "tempo": clip.tempo,
        }

    already = all(
        narration_already_attached(
            existing=(before_draft.get(group) or {}).get("audio"), refs=refs_for_group
        )
        for group, refs_for_group in refs.items()
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
    "NARRATION_TEMPO",
    "AttachedLeaf",
    "ClipStore",
    "Guard",
    "MissingClip",
    "NarrationCms",
    "NarrationHeldError",
    "NarrationNotOnDiskError",
    "NarrationWriteError",
    "RenderedClip",
    "ReviewTarget",
    "attach_leaf_narration",
    "clip_key",
    "existing_review_clips",
    "existing_review_leaves",
    "leaves_label",
    "missing_first_attempts",
    "narration_spent_usd",
    "render_line",
    "review_target",
]
