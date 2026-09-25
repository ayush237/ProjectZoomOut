"""Speech synthesis, over Cloud Text-to-Speech and nothing else.

## Which door, checked rather than assumed

Gemini's TTS models are reachable three ways: the Developer API (AI Studio), Vertex, and Cloud
Text-to-Speech. Only the last is what the voiceover plan approved — billed to the project's
credit, Customer Data under the GCP DPA — and **the SDK a module imports is not evidence of
which one it reached.** So the client reads the endpoint it actually connected to off the
constructed transport, refuses anything that is not a Cloud TTS host, and reports it, and the
run records that report (`TransportRecord.endpoint`).

It takes no API key. Credentials are Application Default Credentials with the project named
as the quota project: with local user credentials a Cloud TTS call is otherwise refused, or
billed to whatever project somebody's gcloud happened to default to.

## One retry layer, one timeout

The generated client declares **no default timeout and no default retry** for
`synthesize_speech` (read from `transports/base.py` in 2.37.0, not assumed). Both are passed
explicitly on every call: `timeout` because a call with none waits forever — WP20's image call
hung for three hours and twelve minutes — and `retry=None` because this module's own bounded,
logged, limiter-aware loop is the retry layer, and a library default added in a later release
must not quietly stack a second one underneath it (WP20: 109 minutes of a two-hour run).
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from zoomout_pipeline.assets.greeting import NARRATOR_GREETINGS, NarratorGreeting
from zoomout_pipeline.assets.narration import MAX_FIELD_BYTES, NarrationLine, speakable
from zoomout_pipeline.cost import TokenSpend, rates_for
from zoomout_pipeline.llm.ratelimit import (
    MAX_RETRIES,
    RateLimiter,
    is_retryable,
    retry_delay_seconds,
)
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

CLOUD_TTS_HOST = "texttospeech.googleapis.com"

# Cloud TTS bills Gemini-TTS output in audio tokens, 25 per second (pricing page, 2026-09-17).
AUDIO_TOKENS_PER_SECOND = 25

# The longest a single Gemini-TTS response may be before Cloud TTS truncates it. It is the
# worst case a budget has to assume for one call, because the clip's length is the model's
# decision and is not known until it answers.
MAX_OUTPUT_SECONDS = 655.0

# Input tokens are not reported back by Cloud TTS, so they are estimated from bytes. English
# runs about four bytes a token; three over-counts on purpose. Input is under 5% of a clip's
# cost at these rates, so the estimate cannot move the total much in either direction.
BYTES_PER_INPUT_TOKEN = 3

# What an unpriced TTS model is assumed to cost: the dearest Gemini-TTS rate on the page.
# A zero here would let the budget wave through any number of calls.
_FALLBACK_RATES = (1.00, 20.00)

# A clip is ~20 seconds of audio and generation takes a few seconds; two minutes is long
# enough never to cut off real work and short enough that a wedged call surfaces quickly.
DEFAULT_SPEECH_TIMEOUT_SECONDS = 120.0

# Gemini-TTS quota on Cloud TTS is not documented. Paced well under anything plausible; 72
# clips at this rate is under four minutes of pacing, which is not the bottleneck.
SPEECH_REQUESTS_PER_MINUTE = 20


class SpeechError(RuntimeError):
    """A synthesis call failed or returned no audio.

    `possibly_billed` counts the attempts that died waiting — a call can be generated, and
    charged, on Google's side after the client has given up on it — so the caller can put
    them on the ledger even though no clip came back.
    """

    def __init__(self, message: str, *, possibly_billed: int = 0) -> None:
        super().__init__(message)
        self.possibly_billed = possibly_billed


class SpeechTransportError(SpeechError):
    """The client is not connected to Cloud Text-to-Speech. Refused before any call."""


class SpeechFenceError(SpeechError):
    """A greeting whose words are not the fixed sentence for its narrator. Refused before any
    request is built (`LEGAL.md`, "Narration": the voice says the four Leaf fields and the two
    fixed greetings, and nothing else)."""


# What a timeout looks like. A refused connection or a 429 never reached generation and is not
# billed; a deadline that expired may have.
_POSSIBLY_BILLED_MARKERS = ("deadline exceeded", "timed out", "timeout", "504")


def possibly_billed(error: Exception) -> bool:
    text = str(error).lower()
    return any(marker in text for marker in _POSSIBLY_BILLED_MARKERS)


def is_cloud_tts_host(endpoint: str) -> bool:
    """`texttospeech.googleapis.com`, or one of its regional forms (`eu-texttospeech…`)."""
    host = endpoint.split("://", 1)[-1].split("/", 1)[0].rsplit(":", 1)[0].lower()
    return host == CLOUD_TTS_HOST or host.endswith(f"-{CLOUD_TTS_HOST}")


def speech_usd(*, model: str, input_tokens: int, output_tokens: int) -> float:
    input_rate, output_rate = rates_for(model) or _FALLBACK_RATES
    return (input_tokens * input_rate + output_tokens * output_rate) / 1_000_000


def speech_spend(*, model: str, node: str, audio_seconds: float, request_bytes: int) -> TokenSpend:
    """What one synthesis cost, in the ledger's own unit.

    Output tokens come from the duration of the audio **as the model returned it**, before
    anything is trimmed — that is what was billed.
    """
    return TokenSpend(
        node=node,
        model=model,
        input_tokens=math.ceil(request_bytes / BYTES_PER_INPUT_TOKEN),
        output_tokens=math.ceil(audio_seconds * AUDIO_TOKENS_PER_SECOND),
    )


def worst_case_usd(*, model: str, request_bytes: int) -> float:
    """The most one synthesis call can cost: the longest response Cloud TTS will return."""
    return speech_usd(
        model=model,
        input_tokens=math.ceil(request_bytes / BYTES_PER_INPUT_TOKEN),
        output_tokens=math.ceil(MAX_OUTPUT_SECONDS * AUDIO_TOKENS_PER_SECOND),
    )


class SpeechBackend(Protocol):
    """The slice of `google.cloud.texttospeech.TextToSpeechClient` this module uses."""

    @property
    def api_endpoint(self) -> str: ...

    def synthesize_speech(self, *, request: Any, retry: Any, timeout: float) -> Any: ...


@dataclass(frozen=True)
class SynthesizedSpeech:
    """What the model returned for one line, and what was asked."""

    wav: bytes
    line: NarrationLine
    voice: str
    model: str
    prompt: str
    # Text plus prompt, the two fields input tokens are billed on.
    request_bytes: int
    # Attempts that timed out before this one answered. A timed-out call may still have been
    # generated and billed, so the caller counts these rather than assuming they were free.
    # A refused connection or a rate limit is not counted: it never reached generation.
    possibly_billed_attempts: int = 0


@dataclass(frozen=True)
class SynthesizedGreeting:
    """What the model returned for one narrator's greeting. `synthesize_greeting`'s answer, as
    `SynthesizedSpeech` is `synthesize`'s: a different type because there is no Leaf line."""

    wav: bytes
    greeting: NarratorGreeting
    voice: str
    model: str
    prompt: str
    request_bytes: int
    possibly_billed_attempts: int = 0


class SpeechClient:
    """Gemini-TTS over Cloud Text-to-Speech."""

    def __init__(
        self,
        *,
        project: str,
        model: str,
        language_code: str,
        limiter: RateLimiter | None = None,
        timeout_seconds: float = DEFAULT_SPEECH_TIMEOUT_SECONDS,
        backend: SpeechBackend | None = None,
    ) -> None:
        if not project:
            raise SpeechError("Cloud TTS needs a project to bill; none was given.")
        if backend is None:
            from google.api_core.client_options import ClientOptions
            from google.cloud import texttospeech

            backend = texttospeech.TextToSpeechClient(
                client_options=ClientOptions(quota_project_id=project)
            )

        endpoint = str(backend.api_endpoint)
        if not is_cloud_tts_host(endpoint):
            raise SpeechTransportError(
                f"refusing to synthesize through {endpoint!r}. Voiceover is approved for "
                f"Cloud Text-to-Speech ({CLOUD_TTS_HOST}) billed to {project}, and nothing "
                "else — not the Developer API, not a proxy."
            )

        self.endpoint = endpoint
        self.project = project
        self.model = model
        self.language_code = language_code
        self._backend = backend
        self._timeout = timeout_seconds
        self._limiter = limiter or RateLimiter(max_per_minute=SPEECH_REQUESTS_PER_MINUTE)

    def request_bytes(self, line: NarrationLine, *, prompt: str) -> int:
        return len(line.spoken.encode("utf-8")) + len(prompt.encode("utf-8"))

    def greeting_request_bytes(self, greeting: NarratorGreeting, *, prompt: str) -> int:
        return len(greeting.spoken.encode("utf-8")) + len(prompt.encode("utf-8"))

    def synthesize(self, line: NarrationLine, *, voice: str, prompt: str) -> SynthesizedSpeech:
        """One line, spoken. LINEAR16, so the audio arrives lossless and with its own header.

        Lossless on purpose: the clip is measured, levelled and trimmed before it is encoded
        once for the app. Asking for mp3 here would mean decoding a lossy file to do that
        and encoding it a second time.
        """
        audio, timeouts = self._call(
            text=line.spoken,
            prompt=prompt,
            voice=voice,
            label=line.label,
            context={"leaf": line.order, "slide": line.slide.value},
        )
        return SynthesizedSpeech(
            wav=audio,
            line=line,
            voice=voice,
            model=self.model,
            prompt=prompt,
            request_bytes=self.request_bytes(line, prompt=prompt),
            possibly_billed_attempts=timeouts,
        )

    def synthesize_greeting(
        self, greeting: NarratorGreeting, *, prompt: str
    ) -> SynthesizedGreeting:
        """A narrator's self-introduction, **in that narrator's own voice.**

        The sibling of `synthesize`, through the same `_call`: a second door for a second kind
        of line (`assets/greeting.py` says why it is not the first door widened), not a second
        implementation of the request. There is no `voice` parameter to get wrong — the voice
        is the greeting's own, so "I'm Achernar" cannot be spoken by Sadaltager.

        **Refused unless its words are the closed list's.** A `NarratorGreeting` is built in one
        place, but `dataclasses.replace(greeting, text=...)` and `object.__setattr__` make one
        without calling that place, and `_call` will speak anything. So the door compares what it
        was handed with `NARRATOR_GREETINGS` — the one list a greeting can be held to, which a
        Leaf's line has no equivalent of — on **both what is stored (`text`) and what is sent
        (`spoken`)**, before any request is built. The error names the narrator and never repeats
        the words: a source quote in an error message is a source quote in a log.
        """
        sentence = NARRATOR_GREETINGS[greeting.narrator]
        if greeting.text != sentence or greeting.spoken != speakable(sentence):
            raise SpeechFenceError(
                f"refusing to speak the {greeting.narrator.value} greeting: its words are not the "
                "fixed greeting for that narrator (`NARRATOR_GREETINGS`). The voice says the four "
                "Leaf fields and the two fixed greetings, and nothing else (`LEGAL.md`, "
                '"Narration").'
            )
        audio, timeouts = self._call(
            text=greeting.spoken,
            prompt=prompt,
            voice=greeting.voice,
            label=greeting.label,
            context={"greeting": greeting.narrator.value},
        )
        return SynthesizedGreeting(
            wav=audio,
            greeting=greeting,
            voice=greeting.voice,
            model=self.model,
            prompt=prompt,
            request_bytes=self.greeting_request_bytes(greeting, prompt=prompt),
            possibly_billed_attempts=timeouts,
        )

    def _call(
        self, *, text: str, prompt: str, voice: str, label: str, context: Mapping[str, object]
    ) -> tuple[bytes, int]:
        """The one place a synthesis request is built, sent and retried: the audio it returned,
        and how many attempts timed out on the way (a timeout may still have been billed).

        Both public methods come through here, so the guarantees this module states at the top
        — one timeout, one retry layer, a refused host — hold for a greeting exactly as they do
        for a Leaf's line, and a fix made to one cannot be missing from the other.
        `context` is what the log lines are tagged with, and `label` is what an error names.
        """
        from google.cloud import texttospeech

        if not voice:
            raise SpeechError("no voice given — the narrator is a decision, not a default")
        for name, value in (("text", text), ("prompt", prompt)):
            size = len(value.encode("utf-8"))
            if size > MAX_FIELD_BYTES:
                raise SpeechError(
                    f"{label}: {name} is {size} bytes; Cloud TTS refuses over {MAX_FIELD_BYTES}"
                )

        request = texttospeech.SynthesizeSpeechRequest(
            input=texttospeech.SynthesisInput(text=text, prompt=prompt),
            voice=texttospeech.VoiceSelectionParams(
                language_code=self.language_code, name=voice, model_name=self.model
            ),
            audio_config=texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16
            ),
        )

        response: Any = None
        timeouts = 0
        for attempt in range(MAX_RETRIES):
            self._limiter.acquire(1)
            try:
                response = self._backend.synthesize_speech(
                    request=request, retry=None, timeout=self._timeout
                )
                break
            except Exception as error:
                timeouts += possibly_billed(error)
                if not is_retryable(error) or attempt == MAX_RETRIES - 1:
                    raise SpeechError(
                        f"{label}: synthesis with {self.model}/{voice} failed after "
                        f"{attempt + 1} attempt(s): {error}",
                        possibly_billed=timeouts,
                    ) from error
                delay = retry_delay_seconds(error, attempt=attempt)
                _log.warning(
                    "speech.retrying",
                    **context,
                    attempt=attempt + 1,
                    retry_in=round(delay, 1),
                    error=str(error)[:160],
                )
                self._limiter.penalise()
                self._limiter.sleep(delay)

        audio = bytes(getattr(response, "audio_content", b"") or b"")
        if not audio:
            raise SpeechError(
                f"{label}: {self.model}/{voice} returned no audio", possibly_billed=timeouts
            )

        _log.info(
            "speech.synthesized",
            **context,
            voice=voice,
            model=self.model,
            bytes=len(audio),
            endpoint=self.endpoint,
        )
        return audio, timeouts


__all__ = [
    "AUDIO_TOKENS_PER_SECOND",
    "CLOUD_TTS_HOST",
    "MAX_OUTPUT_SECONDS",
    "SpeechBackend",
    "SpeechClient",
    "SpeechError",
    "SpeechFenceError",
    "SpeechTransportError",
    "SynthesizedGreeting",
    "SynthesizedSpeech",
    "is_cloud_tts_host",
    "possibly_billed",
    "speech_spend",
    "speech_usd",
    "worst_case_usd",
]
