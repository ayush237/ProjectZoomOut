"""Fakes for the voiceover tests: a Leaf as Payload returns it, a Cloud TTS that records what
it was asked, and a Payload that versions drafts the way the real one does.

**The fake Payload replaces a PATCHed group wholesale.** That is the behaviour WP19 proved by
hand on the scenario group — a partial group PATCH nulls the siblings it omits — so a narration
write that sent `{"summary": {"audio": …}}` would lose the summary's body here exactly as it
would in the real CMS.
"""

from __future__ import annotations

import copy
import io
import wave
from collections.abc import Callable
from typing import Any

import numpy as np
from google.api_core import exceptions as google_exceptions

from zoomout_pipeline.assets.speech import SpeechClient

RATE = 24_000

# `google.api_core`'s exception classes carry no annotations; typed once here.
_GOOGLE_ERRORS: dict[int, Callable[[str], Exception]] = {
    400: google_exceptions.InvalidArgument,
    429: google_exceptions.ResourceExhausted,
    503: google_exceptions.ServiceUnavailable,
    504: google_exceptions.DeadlineExceeded,
}


def google_error(code: int, message: str) -> Exception:
    """The exception the TTS client raises for `code`, as its message renders it."""
    return _GOOGLE_ERRORS[code](message)


def speech_like_wav(
    seconds: float,
    *,
    rate: int = RATE,
    tail_noise_seconds: float = 0.0,
    pause_seconds: float = 0.2,
) -> bytes:
    """A 16-bit mono WAV that the audio module will treat as speech.

    Voiced bursts of a gliding tone separated by short pauses, with silence either side — enough
    structure for levelling, edging, pause counting and pitch tracking to have something to do.
    """
    head = np.zeros(int(0.3 * rate), dtype=np.float32)
    tail = np.zeros(int(0.5 * rate), dtype=np.float32)
    pieces = [head]
    remaining = seconds
    frequency = 140.0
    while remaining > 0:
        burst = min(0.7, remaining)
        t = np.arange(int(burst * rate)) / rate
        glide = frequency * (1 + 0.25 * t / max(burst, 1e-3))
        phase = 2 * np.pi * np.cumsum(glide) / rate
        envelope = np.minimum(1.0, np.minimum(t, burst - t) / 0.02)
        pieces.append((0.25 * np.sin(phase) * envelope).astype(np.float32))
        pieces.append(np.zeros(int(pause_seconds * rate), dtype=np.float32))
        remaining -= burst
        frequency = 120.0 if frequency > 150 else frequency + 20.0
    if tail_noise_seconds:
        noise = np.random.default_rng(7).standard_normal(int(tail_noise_seconds * rate))
        pieces.append((noise * 10 ** (-38 / 20)).astype(np.float32))
    pieces.append(tail)
    samples = np.concatenate(pieces)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(rate)
        writer.writeframes(np.round(samples * 32767).astype("<i2").tobytes())
    return buffer.getvalue()


SENTINEL = "SENTINEL-NEVER-SPOKEN"


def leaf_doc(order: int = 4, *, sentinel: str | None = None, leaf_id: int = 266) -> dict[str, Any]:
    """A published Leaf, shaped exactly as `GET /api/leaves/:id?depth=0` returns one.

    With `sentinel`, every text field that must never be narrated carries it — the book's
    quotes above all — so a test can prove it reached nothing.
    """
    mark = f" {sentinel}" if sentinel else ""
    # VO-1.1: a narrated slide's `audio` is an array, empty until a narrator is attached —
    # confirmed against the live migration (collaboration-log.md, VO-1.1 Part C): `summary.
    # audio` reads back as `[]`, not the old single-reference group shape.
    silent_audio: list[dict[str, Any]] = []
    return {
        "id": leaf_id,
        "trackId": 50,
        "orderIndex": order,
        "title": f"Calibrating challenge{mark}",
        "isPlaceholder": False,
        "gateTwoStatus": "approved",
        "_status": "published",
        "createdAt": "2026-09-11T10:00:00.000Z",
        "updatedAt": "2026-09-15T14:23:17.600Z",
        "summary": {
            "body": "The author argues that flow occurs between boredom and anxiety.",
            "audio": list(silent_audio),
        },
        "scenario": {
            "prompt": "You are building a routine form for your team—a task you could do on "
            "autopilot. How should you approach it?",
            "options": [
                {"id": "a1", "text": f"Add a small stretch{mark}", "isCorrect": True},
                {"id": "a2", "text": f"Rush it{mark}", "isCorrect": False},
                {"id": "a3", "text": f"Delegate it{mark}", "isCorrect": False},
            ],
            "image": {"url": "/api/media/file/leaf-04-scenario-8.png", "alt": f"A desk{mark}"},
            "audio": list(silent_audio),
        },
        "payoff": {
            "body": "A slight stretch creates the middle path where deep focus becomes possible.",
            "audio": list(silent_audio),
        },
        "stickyNotes": {
            "notes": [
                {"id": "n1", "note": f"Boredom is too easy{mark}"},
                {"id": "n2", "note": f"Anxiety is too hard{mark}"},
            ],
            "diagram": None,
            "audio": list(silent_audio),
        },
        "takeaway": {
            "body": "You cannot always choose your work, but you can choose how you do it.",
            "dinnerTableKnowledge": f"Flow was named by Mihaly Csikszentmihalyi{mark}",
            "applyInLife": f"Add one constraint to a dull task today{mark}",
            "audio": list(silent_audio),
        },
        "sourceReferences": [
            {
                "id": "r1",
                "slideKey": "summary",
                "chapter": f"Flow{mark}",
                "note": f"The channel between boredom and anxiety{mark}",
                "quote": f"verbatim words from the book{mark}",
                "page": None,
            }
        ],
        "editorialFindings": [{"id": "f1", "slideKey": "payoff", "note": f"fine{mark}"}],
        "imageCandidates": [{"id": "c1", "url": "/api/media/file/x.png", "alt": f"x{mark}"}],
    }


class FakeSpeechBackend:
    """Cloud TTS, as far as `SpeechClient` can tell. Records every request it is sent."""

    def __init__(
        self,
        *,
        endpoint: str = "texttospeech.googleapis.com:443",
        # About 160 words a minute once the pauses are in — a natural pace.
        seconds_per_char: float = 0.052,
        failures: list[Exception] | None = None,
        tail_noise_seconds: float = 0.0,
        pause_seconds: float = 0.2,
    ) -> None:
        self.api_endpoint = endpoint
        self.requests: list[Any] = []
        self.call_options: list[dict[str, Any]] = []
        self._seconds_per_char = seconds_per_char
        self._failures = list(failures or [])
        self._tail_noise = tail_noise_seconds
        self._pause = pause_seconds
        self.before_call: Callable[[], None] | None = None

    def synthesize_speech(self, *, request: Any, retry: Any, timeout: float) -> Any:
        if self.before_call is not None:
            self.before_call()
        self.requests.append(request)
        self.call_options.append({"retry": retry, "timeout": timeout})
        if self._failures:
            raise self._failures.pop(0)
        seconds = max(0.5, len(request.input.text) * self._seconds_per_char)

        class _Response:
            audio_content = speech_like_wav(
                seconds, tail_noise_seconds=self._tail_noise, pause_seconds=self._pause
            )

        return _Response()


class FakeClock:
    """Time that passes only when something sleeps.

    A limiter given a no-op sleep and the real clock does not skip its wait — it spins until
    the real minute has passed. The retry tests cost four real minutes that way before this.
    """

    def __init__(self) -> None:
        self.now = 0.0
        self.slept: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


def speech_client(backend: FakeSpeechBackend | None = None, **overrides: Any) -> SpeechClient:
    from zoomout_pipeline.llm.ratelimit import RateLimiter

    clock = FakeClock()
    return SpeechClient(
        project=overrides.pop("project", "zoomout-vertex"),
        model=overrides.pop("model", "gemini-2.5-flash-tts"),
        language_code="en-US",
        backend=backend or FakeSpeechBackend(),
        limiter=RateLimiter(max_per_minute=10_000, sleep=clock.sleep, monotonic=clock.monotonic),
        **overrides,
    )


class FakePayload:
    """Leaves with a live and a draft version, a media collection, and a call log."""

    def __init__(self, *leaves: dict[str, Any]) -> None:
        self.live: dict[int, dict[str, Any]] = {
            int(doc["id"]): copy.deepcopy(doc) for doc in leaves
        }
        self.draft: dict[int, dict[str, Any]] = {}
        self.media: dict[str, dict[str, Any]] = {}
        self.blobs: dict[str, bytes] = {}
        self.calls: list[str] = []
        self.patches: list[tuple[int, dict[str, Any]]] = []
        self.uploads: list[dict[str, Any]] = []
        self.serve_override: Callable[[bytes], bytes] | None = None

    def latest(self, leaf_id: int) -> dict[str, Any]:
        return self.draft.get(leaf_id) or self.live[leaf_id]

    def get_leaf(self, leaf_id: int, *, draft: bool = True) -> dict[str, Any]:
        self.calls.append("get_leaf")
        source = self.latest(leaf_id) if draft else self.live[leaf_id]
        return copy.deepcopy(source)

    def update_leaf_draft(self, *, leaf_id: int, patch: dict[str, Any]) -> dict[str, Any]:
        self.calls.append("update_leaf_draft")
        self.patches.append((leaf_id, copy.deepcopy(patch)))
        updated = copy.deepcopy(self.latest(leaf_id))
        for key, value in patch.items():
            # Wholesale, as Payload does it: whatever the group did not carry is gone.
            updated[key] = copy.deepcopy(value)
        updated["_status"] = "draft"
        updated["updatedAt"] = "2026-09-17T12:00:00.000Z"
        self.draft[leaf_id] = updated
        return copy.deepcopy(updated)

    def find_media(self, *, filename: str) -> dict[str, Any] | None:
        self.calls.append("find_media")
        doc = self.media.get(filename)
        return copy.deepcopy(doc) if doc else None

    def upload_media(
        self, *, data: bytes, filename: str, alt: str, mime_type: str = "image/png"
    ) -> dict[str, Any]:
        self.calls.append("upload_media")
        url = f"/api/media/file/{filename}"
        doc = {
            "id": 900 + len(self.media),
            "filename": filename,
            "alt": alt,
            "mimeType": mime_type,
            "url": url,
        }
        self.media[filename] = doc
        self.blobs[url] = data
        self.uploads.append(dict(doc))
        return copy.deepcopy(doc)

    def fetch_media(self, url: str) -> bytes:
        self.calls.append("fetch_media")
        data = self.blobs[url]
        return self.serve_override(data) if self.serve_override else data
