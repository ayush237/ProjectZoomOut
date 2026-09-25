"""The narrators' self-introductions: two clips, rendered, checked, uploaded. No Leaf, no run.

A deliberate invocation, for the reason `cover_nodes` and `narration_nodes` give: there is no
Leaf and no run behind these two clips, so nothing here touches `PipelineState` or the graph.
It borrows the pieces of voiceover that do not assume one.

## What is shared with a Leaf's narration, and what is not

**Shared, imported and not copied:** the transport (`SpeechClient` — one timeout, one retry
layer, a refused host), levelling and edging, the mp3 encoder, the blind transcript and the pace
check, the budget and the on-disk cache. A fix to any of them reaches these two clips.

**Not shared: `render_line`.** It is typed to `NarrationLine`, and `NarrationLine` is fenced so
that only a Leaf can produce one (`assets/greeting.py` says why the fence stays put). So the
render below is `narration_nodes._render_attempt`'s **sibling**, in the same order and with the
same money handling — a timeout counted as billed, unreadable audio charged by its size, the
worst case reserved before the call. **A fix to that handling belongs in both**, and
`tests/test_greetings.py` holds this one to the same cases `test_narration_budget.py` holds that.

## What is different, and why

- **A transcript is a deliverable, not an option.** The handoff asks for what the clip actually
  said, so a clip nobody could listen to is held, where a Leaf's is attached with a note.
- **Filenames are stable and carry no hash**, so the app can reference them. That gives up the
  "same name means same bytes" property a Leaf's clips have, and this module pays for it in
  `upload_greeting`: an existing document is *compared*, never assumed.
- **Spend is on disk between invocations** (`GreetingLedger`), because the ceiling belongs to
  the package and a budget that restarts at zero would let three invocations each spend it.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Protocol

from pydantic import BaseModel

from zoomout_pipeline.assets.audio import (
    AudioError,
    ClipMetrics,
    EdgeReport,
    decode_mp3,
    decode_wav,
    encode_mp3,
    level,
    measure,
    shape_edges,
)
from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.greeting import (
    NarratorGreeting,
    compare_greeting,
    greeting_alt,
    greeting_direction,
    greeting_filename,
    greeting_script,
)
from zoomout_pipeline.assets.narration import clip_digest
from zoomout_pipeline.assets.narration_guard import (
    GuardSeverity,
    NarrationCheck,
    NarrationReading,
    check_narration,
    guard_worst_case_usd,
    pace_is_natural,
    speaking_rate,
)
from zoomout_pipeline.assets.speech import (
    SpeechClient,
    SpeechError,
    speech_spend,
    worst_case_usd,
)
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph.narration_nodes import (
    _BYTES_PER_SECOND,
    _WAV_HEADER_BYTES,
    ESTIMATED_CHARS_PER_SECOND,
    MP3_MIME,
    ClipStore,
    Guard,
    SpendSink,
)
from zoomout_pipeline.llm.client import LLMError
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import NarratorId

_log = get_logger(__name__)

GREETING_NODE = "greeting"

# The ceiling for this package, and a stop rather than a target. **Not the figure the handoff
# expects to spend** (about a cent) — the budget reserves the most one call *could* cost, which
# for Cloud TTS is its longest response, and that is $0.16 on its own (`speech.worst_case_usd`).
# A ceiling under that refuses the first call, so this is the smallest round number that lets
# one clip through with room for a regeneration. What actually gets spent is far below it.
GREETING_CEILING_USD = 0.20

# Two attempts per greeting, on its own constant, **deliberately not `MAX_NARRATION_ATTEMPTS`**.
# `narrate` moved to three (ruled 2026-09-18 and 2026-09-22: one difficult line holds a whole
# Leaf), and this used to import that constant, so the move would have carried the greeting
# library to three with it while `generate-greetings --max-attempts` stayed a literal 2. This is
# an ear-driven job on a small cap: a third paid attempt is the founder's decision, not a
# default. `tests/test_attempt_defaults.py` pins the command's option to it.
MAX_GREETING_ATTEMPTS = 2

LEDGER_FILENAME = "spend.json"


class GreetingHeldError(RuntimeError):
    """A greeting cannot be uploaded: it failed a check, or nobody could listen to it.

    **A clip that says other words does not proceed — not with a flag.** It stays on disk for a
    person to hear, and neither greeting is uploaded, because one narrator's introduction
    without the other's is a half-built onboarding beat.
    """


class GreetingUploadError(RuntimeError):
    """A greeting could not be stored, or what Payload holds is not the clip that was checked."""


class GreetingLedgerError(RuntimeError):
    """The spend ledger cannot be read. Refused, not reset."""


# ------------------------------------------------------------------------------- spend


class LedgerEntry(BaseModel):
    narrator: NarratorId
    spend: TokenSpend


class GreetingLedger:
    """Every paid call this package has made, on disk after each one.

    **Per call, not per clip**, for the reason `cli.RunLedger` gives: a clip that was paid for
    and then lost its network must still be on the ledger. **And across invocations**, because
    `NarrationBudget` counts from what it is given — a re-run that started from zero would let
    every invocation spend the whole ceiling.

    An unreadable ledger is an error. Starting from zero would silently turn a ceiling into a
    suggestion, which is the failure this exists to prevent.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self.entries: list[LedgerEntry] = self._load()

    def _load(self) -> list[LedgerEntry]:
        if not self._path.exists():
            return []
        try:
            saved = json.loads(self._path.read_text(encoding="utf-8"))
            return [LedgerEntry.model_validate(item) for item in saved["entries"]]
        except (ValueError, KeyError, TypeError) as error:
            raise GreetingLedgerError(
                f"{self._path} is not a readable spend ledger ({error}). Refusing to start "
                "from zero: a ledger that silently resets is a ceiling that does not hold."
            ) from error

    def record(self, narrator: NarratorId, spend: TokenSpend) -> None:
        self.entries.append(LedgerEntry(narrator=narrator, spend=spend))
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # Whole or not at all, so a process killed mid-write leaves the last good ledger.
        partial = self._path.with_suffix(".partial")
        partial.write_text(
            json.dumps(
                {"entries": [entry.model_dump(mode="json") for entry in self.entries]}, indent=2
            ),
            encoding="utf-8",
        )
        partial.replace(self._path)

    @property
    def total_usd(self) -> float:
        return sum(entry.spend.usd for entry in self.entries)

    def usd_for(self, narrator: NarratorId) -> float:
        return sum(entry.spend.usd for entry in self.entries if entry.narrator is narrator)


# ------------------------------------------------------------------------------ render


@dataclass(frozen=True)
class RenderedGreeting:
    """One narrator's greeting, as it will be uploaded, and everything known about it."""

    greeting: NarratorGreeting
    prompt: str
    digest: str
    attempt: int
    mp3: bytes
    sha256: str
    duration_seconds: float
    metrics: ClipMetrics
    edges: EdgeReport
    gain_db: float
    check: NarrationCheck | None
    # True only when the guard was asked to listen and could not.
    guard_failed: bool
    from_cache: bool
    attempts_made: int = 1

    @property
    def articulation_wpm(self) -> float:
        """Words over speech time only — what the pace check reads."""
        return speaking_rate(self.greeting.text, self.metrics.speech_seconds)

    @property
    def pace_natural(self) -> bool:
        return pace_is_natural(self.articulation_wpm)

    @property
    def name_heard(self) -> str | None:
        """What the transcriber wrote where the narrator's name is — `None` when it never said
        one. **Set aside by the comparison and never checked by it**: whether the name is
        pronounced right is for a person, and this is what tells them to listen for it."""
        if self.check is None:
            return None
        return compare_greeting(self.greeting, self.check.reading.transcript)[1]

    @property
    def severity(self) -> GuardSeverity | None:
        """The listening model's verdict on **the sentence apart from the name**, overruled to
        MAJOR by an unnatural pace — measured rather than heard, so it holds when the
        transcriber leaves something out — and by a name that was never said, which the
        comparison sets aside and so cannot see."""
        if not self.pace_natural:
            return GuardSeverity.MAJOR
        if self.check is None:
            return None
        if self.name_heard is None:
            return GuardSeverity.MAJOR
        return self.check.severity

    @property
    def passed(self) -> bool:
        return self.severity is not GuardSeverity.MAJOR

    @property
    def transcript(self) -> str | None:
        return self.check.reading.transcript if self.check is not None else None

    @property
    def filename(self) -> str:
        return greeting_filename(self.greeting.narrator)

    @property
    def uploadable(self) -> bool:
        """Passed, **and** somebody listened: the transcript is part of what is reported."""
        return self.passed and self.check is not None


_SEVERITY_RANK = {GuardSeverity.EXACT: 0, GuardSeverity.MINOR: 1, GuardSeverity.MAJOR: 2}


def _rank(clip: RenderedGreeting) -> tuple[int, int, int]:
    severity = clip.severity
    rank = 1 if severity is None else _SEVERITY_RANK[severity]
    errors = clip.check.diff.errors if clip.check is not None else 0
    return (rank, errors, clip.attempt)


def render_greeting(
    *,
    greeting: NarratorGreeting,
    speech: SpeechClient,
    prompt: str,
    store: ClipStore,
    budget: NarrationBudget,
    record: SpendSink,
    guard: Guard,
    max_attempts: int = MAX_GREETING_ATTEMPTS,
) -> RenderedGreeting:
    """One greeting, spoken, checked, and ready to upload — the best of at most `max_attempts`.

    Bounded like every cycle here, and at `MAX_GREETING_ATTEMPTS` rather than a Leaf clip's
    `MAX_NARRATION_ATTEMPTS`: see the note on that constant for why the two are apart.
    """
    tried: list[RenderedGreeting] = []
    for attempt in range(1, max_attempts + 1):
        clip = _render_attempt(
            greeting=greeting,
            speech=speech,
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
            "greeting.guard_major",
            narrator=greeting.narrator.value,
            attempt=attempt,
            articulation_wpm=round(clip.articulation_wpm),
            findings=clip.check.findings() if clip.check is not None else [],
        )

    best = min(tried, key=_rank)
    if not best.passed:
        _log.error(
            "greeting.guard_exhausted",
            narrator=greeting.narrator.value,
            attempts=len(tried),
            articulation_wpm=round(best.articulation_wpm),
            findings=best.check.findings() if best.check is not None else [],
        )
    _log.info(
        "greeting.rendered",
        narrator=greeting.narrator.value,
        attempt=best.attempt,
        seconds=best.duration_seconds,
        speech_seconds=best.metrics.speech_seconds,
        articulation_wpm=round(best.articulation_wpm),
        severity=best.severity.value if best.severity is not None else None,
        from_cache=best.from_cache,
    )
    return replace(best, attempts_made=len(tried))


def _render_attempt(
    *,
    greeting: NarratorGreeting,
    speech: SpeechClient,
    prompt: str,
    attempt: int,
    store: ClipStore,
    budget: NarrationBudget,
    record: SpendSink,
    guard: Guard,
) -> RenderedGreeting:
    """`narration_nodes._render_attempt`'s sibling. Read that one first; see the module note."""
    voice = greeting.voice
    digest = clip_digest(
        model=speech.model,
        voice=voice,
        language=speech.language_code,
        prompt=prompt,
        text=greeting.spoken,
        attempt=attempt,
    )
    raw_path = store.raw_path(digest)
    from_cache = raw_path.exists()
    if from_cache:
        raw = decode_wav(raw_path.read_bytes())
    else:
        request_bytes = speech.greeting_request_bytes(greeting, prompt=prompt)
        budget.reserve(
            worst_case_usd=worst_case_usd(model=speech.model, request_bytes=request_bytes),
            what=f"the {greeting.label} in {voice}",
        )
        try:
            result = speech.synthesize_greeting(greeting, prompt=prompt)
        except SpeechError as error:
            # No clip, but a call that timed out may still have been generated and charged.
            estimate = speech_spend(
                model=speech.model,
                node=GREETING_NODE,
                audio_seconds=len(greeting.spoken) / ESTIMATED_CHARS_PER_SECOND,
                request_bytes=request_bytes,
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
                "greeting": greeting.narrator.value,
                "voice": voice,
                "model": speech.model,
                "language": speech.language_code,
                "endpoint": speech.endpoint,
                "attempt": attempt,
                "prompt": prompt,
                "text": greeting.spoken,
            },
        )
        try:
            raw = decode_wav(result.wav)
            billed_seconds = raw.seconds
        except AudioError:
            # Paid for and unreadable: charged at what its size implies, as a Leaf's is.
            billed_seconds = max(0.0, (len(result.wav) - _WAV_HEADER_BYTES) / _BYTES_PER_SECOND)
            unreadable = speech_spend(
                model=speech.model,
                node=GREETING_NODE,
                audio_seconds=billed_seconds,
                request_bytes=result.request_bytes,
            )
            record(unreadable)
            budget.settle(unreadable.usd)
            raise
        spend = speech_spend(
            model=speech.model,
            node=GREETING_NODE,
            audio_seconds=billed_seconds,
            request_bytes=result.request_bytes,
        )
        # A call that timed out may still have been billed. Counted as if it was: the ledger
        # may over-report by a few tenths of a cent, never under-report.
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
    try:
        check = _listen(
            greeting=greeting,
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
        # Not fatal to the clip, and not silent: the greeting is then held, because a
        # transcript is part of what this package reports.
        _log.error("greeting.guard_failed", narrator=greeting.narrator.value, error=str(error))
        guard_failed = True

    return RenderedGreeting(
        greeting=greeting,
        prompt=prompt,
        digest=digest,
        attempt=attempt,
        mp3=mp3,
        sha256=content_hash,
        # Measured from the decoded upload, to the hundredth of a second — what a player will
        # actually play, encoder padding included.
        duration_seconds=round(decoded.seconds, 2),
        gain_db=round(gain_db, 2),
        edges=edges,
        metrics=measure(decoded),
        check=check,
        guard_failed=guard_failed,
        from_cache=from_cache,
    )


def _listen(
    *,
    greeting: NarratorGreeting,
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
            diff=compare_greeting(greeting, reading.transcript)[0],
            spend=TokenSpend.model_validate(saved["spend"]),
        )

    budget.reserve(
        worst_case_usd=guard_worst_case_usd(model=guard.model, audio_seconds=seconds),
        what=f"listening to the {greeting.label}",
    )
    heard = check_narration(llm=guard.llm, mp3=mp3, expected=greeting.text, model=guard.model)
    # `check_narration` compares every word, the name included. Re-compared without it — see
    # `compare_greeting` — after the reading is saved, so the cache holds what was heard and
    # not a verdict that a later change to the comparison would leave stale.
    check = replace(heard, diff=compare_greeting(greeting, heard.reading.transcript)[0])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "reading": check.reading.model_dump(mode="json"),
                "spend": check.spend.model_dump(mode="json"),
                "expected": greeting.text,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    record(check.spend)
    budget.settle(check.spend.usd)
    return check


# ----------------------------------------------------------------------------- upload


class MediaCms(Protocol):
    """The slice of `PayloadClient` a greeting is stored through: Media, and nothing else.

    No Leaf, no Track, no draft — a test asserts this is all the CMS is ever asked.
    """

    def find_media(self, *, filename: str) -> dict[str, Any] | None: ...

    def upload_media(
        self, *, data: bytes, filename: str, alt: str, mime_type: str = "image/png"
    ) -> dict[str, Any]: ...

    def fetch_media(self, url: str) -> bytes: ...


@dataclass(frozen=True)
class UploadedGreeting:
    """What Payload holds for one greeting, as Payload reported it."""

    narrator: NarratorId
    media_id: int | str
    url: str
    filename: str
    alt: str
    duration_seconds: float
    sha256: str
    # False when the document was already there and this run only proved it held these bytes.
    uploaded: bool
    problems: tuple[str, ...] = field(default_factory=tuple)

    @property
    def passed(self) -> bool:
        return not self.problems


def _holds_different_bytes(
    *, doc: Mapping[str, Any], filename: str, served: str, clip: RenderedGreeting
) -> str:
    """The clause both refusals share: which document, and how it differs from the clip."""
    return (
        f"Media {doc.get('id')} ({filename}) already exists and holds different bytes "
        f"({served[:12]}…) from the clip just rendered ({clip.sha256[:12]}…)"
    )


_NEEDS_A_PERSON = (
    "The pipeline's key can create Media but never delete or replace it, so this needs a "
    "person: delete {which} in the admin UI, then run this again."
)


def upload_greeting(*, client: MediaCms, clip: RenderedGreeting) -> UploadedGreeting:
    """Find-then-upload one greeting, and prove Payload serves the bytes that were checked.

    **The find is by the stable filename, and a hit is compared, never trusted.** A Leaf's clip
    has its hash in its name, so a hit means the same file. This name has no hash, so a hit
    only means *a* file: it is fetched and hashed, and a different one is an error, because
    the alternative is telling the app to play something nobody listened to.
    """
    narrator = clip.greeting.narrator
    filename = greeting_filename(narrator)
    alt = greeting_alt(clip.greeting)

    doc = client.find_media(filename=filename)
    uploaded = doc is None
    if doc is None:
        doc = client.upload_media(data=clip.mp3, filename=filename, alt=alt, mime_type=MP3_MIME)

    url = doc.get("url")
    if not isinstance(url, str) or not url:
        raise GreetingUploadError(f"Payload returned no url for {filename}")

    served = hashlib.sha256(client.fetch_media(url)).hexdigest()
    if served != clip.sha256:
        if uploaded:
            raise GreetingUploadError(
                f"{filename}: Payload serves bytes {served[:12]}… but the clip uploaded was "
                f"{clip.sha256[:12]}… — refusing to report a file that is not the one checked"
            )
        # Reached only if the document changed after `upload_greetings` looked (its pre-flight
        # refuses a stale one first), or when this is called on its own. It knows about one
        # clip, and so **cannot say what became of the other**: it says only what is true.
        raise GreetingUploadError(
            _holds_different_bytes(doc=doc, filename=filename, served=served, clip=clip)
            + ". "
            + _NEEDS_A_PERSON.format(which="that Media document")
            + " This clip was not uploaded; the other narrator's greeting may already have been "
            "(a re-run finds it and accepts it, if it holds that clip's bytes)."
        )

    problems: list[str] = []
    if doc.get("filename") not in (None, filename):
        # Payload renames a clashing upload, and a renamed clip is not the stable reference
        # the app was promised.
        problems.append(f"{filename} was stored as {doc.get('filename')!r}")
    if doc.get("alt") not in (None, alt):
        problems.append(f"{filename} carries alt {doc.get('alt')!r}, expected {alt!r}")
    if doc.get("mimeType") not in (None, MP3_MIME):
        problems.append(f"{filename} was stored as {doc.get('mimeType')!r}, not {MP3_MIME}")
    if doc.get("filesize") not in (None, len(clip.mp3)):
        problems.append(f"{filename} is {doc.get('filesize')} bytes, not {len(clip.mp3)}")

    media_id = doc.get("id")
    if media_id is None:
        raise GreetingUploadError(f"Payload returned no id for {filename}")
    _log.info(
        "greeting.uploaded",
        narrator=narrator.value,
        media_id=media_id,
        uploaded=uploaded,
        problems=problems,
    )
    return UploadedGreeting(
        narrator=narrator,
        media_id=media_id,
        url=url,
        filename=filename,
        alt=alt,
        duration_seconds=clip.duration_seconds,
        sha256=clip.sha256,
        uploaded=uploaded,
        problems=tuple(problems),
    )


def _refuse_a_stale_document(*, client: MediaCms, clips: Sequence[RenderedGreeting]) -> None:
    """Look at **both** narrators' documents before anything is sent, and refuse if any holds
    bytes that are not its clip — naming every one, so a single visit to the admin fixes both.

    Each is found by its stable filename, fetched and hashed, exactly as `upload_greeting` does
    for the one it is on; what is new is that this happens for the second narrator *before the
    first is uploaded*. Identical bytes pass (that is what makes a re-run idempotent), and an
    absent document passes (it is about to be uploaded). Reads only: nothing is written here.
    """
    stale: list[str] = []
    for clip in clips:
        filename = greeting_filename(clip.greeting.narrator)
        doc = client.find_media(filename=filename)
        if doc is None:
            continue
        url = doc.get("url")
        if not isinstance(url, str) or not url:
            raise GreetingUploadError(
                f"Media {doc.get('id')} ({filename}) exists but Payload returned no url for it. "
                "Checked before anything was sent: nothing was uploaded."
            )
        served = hashlib.sha256(client.fetch_media(url)).hexdigest()
        if served != clip.sha256:
            stale.append(
                _holds_different_bytes(doc=doc, filename=filename, served=served, clip=clip)
            )
    if stale:
        which = "that Media document" if len(stale) == 1 else "those Media documents"
        raise GreetingUploadError(
            "; ".join(stale)
            + ". "
            + _NEEDS_A_PERSON.format(which=which)
            + " Checked before anything was sent: nothing was uploaded."
        )


def upload_greetings(
    *, client: MediaCms, clips: Sequence[RenderedGreeting]
) -> list[UploadedGreeting]:
    """Both greetings — **checked as a pair before anything is sent, not atomic across the two
    requests.**

    Verified first, as a full set: both narrators present exactly once, every clip passed **and**
    heard, and every document Payload already holds under a greeting's stable filename carrying
    exactly that clip's bytes (`_refuse_a_stale_document`). If any check fails, **nothing is
    uploaded** and the error says which document. Identical bytes are accepted, so a re-run is
    free.

    **What this cannot promise is atomicity.** Two uploads are two requests, and a *transport*
    failure between them still leaves the first one stored (a document that changes in that
    window is refused by `upload_greeting`, and says only what is true of its own clip). That
    case is resumable — the re-run finds what landed and accepts the identical clip — but it is
    not "neither".
    """
    order = {narrator: index for index, narrator in enumerate(NarratorId)}
    ordered = sorted(clips, key=lambda clip: order[clip.greeting.narrator])
    present = [clip.greeting.narrator for clip in ordered]
    if present != list(NarratorId):
        raise GreetingUploadError(
            f"both narrators' greetings are uploaded together or not at all; got "
            f"{[narrator.value for narrator in present]}"
        )

    held = [clip for clip in ordered if not clip.uploadable]
    if held:
        raise GreetingHeldError(
            "greetings held, nothing uploaded: "
            + "; ".join(
                f"{clip.greeting.narrator.value} {clip.greeting.name} "
                f"(voice {clip.greeting.voice}) at "
                f"{clip.articulation_wpm:.0f} words a minute of speech "
                + (
                    f"({', '.join(clip.check.findings())})"
                    if clip.check is not None
                    else "(nobody could listen to it)"
                )
                for clip in held
            )
        )
    _refuse_a_stale_document(client=client, clips=ordered)
    return [upload_greeting(client=client, clip=clip) for clip in ordered]


# ------------------------------------------------------------------------ the whole thing


@dataclass(frozen=True)
class GreetingRun:
    rendered: list[RenderedGreeting]
    uploaded: list[UploadedGreeting]
    # Where each narrator's mp3 is on disk, for a person to open.
    files: dict[NarratorId, Path]


def _keep_on_disk(store: ClipStore, clip: RenderedGreeting) -> Path:
    """The mp3 as a file a person can open: `final/` when it can be uploaded, `held/` when it
    cannot, so a clip that failed is never sitting under the name of a good one. The other
    folder's copy is removed, so a clip that used to pass and now does not cannot leave a stale
    "good" file behind."""
    settled, other = ("final", "held") if clip.uploadable else ("held", "final")
    (store.root / other / clip.filename).unlink(missing_ok=True)
    path = store.root / settled / clip.filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(clip.mp3)
    return path


def _sink_for(narrator: NarratorId, record: Callable[[NarratorId, TokenSpend], None]) -> SpendSink:
    """`record` with the narrator bound, so every call that clip makes lands on its line of the
    ledger. A function rather than a lambda in the loop: each clip must capture its own."""

    def sink(spend: TokenSpend) -> None:
        record(narrator, spend)

    return sink


def run_greetings(
    *,
    speech: SpeechClient,
    store: ClipStore,
    budget: NarrationBudget,
    record: Callable[[NarratorId, TokenSpend], None],
    guard: Guard,
    client: MediaCms | None,
    max_attempts: int = MAX_GREETING_ATTEMPTS,
    on_rendered: Callable[[RenderedGreeting], None] | None = None,
) -> GreetingRun:
    """Render both greetings, then — with a `client` — upload them.

    Without a client nothing leaves the machine but the two synthesis requests and the guard's
    listening. Errors propagate: what was paid for is already on disk and on the ledger.
    """
    prompt = greeting_direction()
    rendered: list[RenderedGreeting] = []
    files: dict[NarratorId, Path] = {}
    for greeting in greeting_script():
        clip = render_greeting(
            greeting=greeting,
            speech=speech,
            prompt=prompt,
            store=store,
            budget=budget,
            record=_sink_for(greeting.narrator, record),
            guard=guard,
            max_attempts=max_attempts,
        )
        rendered.append(clip)
        files[greeting.narrator] = _keep_on_disk(store, clip)
        if on_rendered is not None:
            on_rendered(clip)

    uploaded = upload_greetings(client=client, clips=rendered) if client is not None else []
    return GreetingRun(rendered=rendered, uploaded=uploaded, files=files)


__all__ = [
    "GREETING_CEILING_USD",
    "GREETING_NODE",
    "LEDGER_FILENAME",
    "MAX_GREETING_ATTEMPTS",
    "GreetingHeldError",
    "GreetingLedger",
    "GreetingLedgerError",
    "GreetingRun",
    "GreetingUploadError",
    "LedgerEntry",
    "MediaCms",
    "RenderedGreeting",
    "UploadedGreeting",
    "render_greeting",
    "run_greetings",
    "upload_greeting",
    "upload_greetings",
]
