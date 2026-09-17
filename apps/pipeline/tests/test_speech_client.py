"""The Cloud TTS client: which door it uses, how it retries, and what a clip costs.

**The door is checked, not assumed.** Gemini's TTS models answer on the Developer API, on
Vertex and on Cloud Text-to-Speech, and only the last was approved for voiceover. The client
refuses any other host before a single call, and the host it reports is read off the
constructed client — the thing the run records.
"""

from __future__ import annotations

import inspect

import pytest
from google.cloud import texttospeech

from zoomout_pipeline.assets import speech as speech_module
from zoomout_pipeline.assets.narration import NarratedSlide, NarrationLine, narration_script
from zoomout_pipeline.assets.speech import (
    AUDIO_TOKENS_PER_SECOND,
    MAX_OUTPUT_SECONDS,
    SpeechClient,
    SpeechError,
    SpeechTransportError,
    is_cloud_tts_host,
    speech_spend,
    worst_case_usd,
)
from zoomout_pipeline.config import (
    DEFAULT_NARRATION_MODEL,
    NarrationTransportError,
    PipelineSettings,
    require_cloud_tts,
)
from zoomout_pipeline.llm.ratelimit import MAX_RETRIES
from zoomout_pipeline.models import Acquisition, Transport

from .conftest import TEST_DATABASE_URL
from .narration_fakes import FakeSpeechBackend, google_error, leaf_doc, speech_client


def _line(slide: NarratedSlide = NarratedSlide.PAYOFF) -> NarrationLine:
    return next(line for line in narration_script(leaf_doc()) if line.slide is slide)


# --------------------------------------------------------------------------- the door


@pytest.mark.parametrize(
    "endpoint",
    [
        "texttospeech.googleapis.com",
        "texttospeech.googleapis.com:443",
        "https://texttospeech.googleapis.com",
        "eu-texttospeech.googleapis.com:443",
    ],
)
def test_cloud_tts_hosts_are_accepted(endpoint: str) -> None:
    assert is_cloud_tts_host(endpoint)
    assert speech_client(FakeSpeechBackend(endpoint=endpoint)).endpoint == endpoint


@pytest.mark.parametrize(
    "endpoint",
    [
        # The Developer API — the tier WP32's check refuses for books, and never approved here.
        "generativelanguage.googleapis.com",
        # Vertex serves the same models, and is not the product the credit was scoped to.
        "aiplatform.googleapis.com:443",
        "us-central1-aiplatform.googleapis.com",
        "texttospeech.googleapis.com.evil.example",
        "localhost:8080",
    ],
)
def test_any_other_host_is_refused_before_a_call(endpoint: str) -> None:
    backend = FakeSpeechBackend(endpoint=endpoint)

    with pytest.raises(SpeechTransportError):
        speech_client(backend)

    assert backend.requests == []


def test_the_real_client_is_built_for_the_project_and_takes_no_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Built from ADC with the project named as the quota project — the one Cloud TTS bills
    — and with no way to pass an API key at all."""
    seen: dict[str, object] = {}

    class RecordingClient(FakeSpeechBackend):
        def __init__(self, *, client_options: object) -> None:
            super().__init__()
            seen["options"] = client_options

    monkeypatch.setattr(texttospeech, "TextToSpeechClient", RecordingClient)

    client = SpeechClient(project="zoomout-vertex", model="m", language_code="en-US")

    assert getattr(seen["options"], "quota_project_id", None) == "zoomout-vertex"
    assert getattr(seen["options"], "api_key", None) is None
    assert client.endpoint == "texttospeech.googleapis.com:443"
    assert not any("key" in name for name in inspect.signature(SpeechClient).parameters)


def test_the_transport_record_names_cloud_tts_and_the_billed_project() -> None:
    settings = PipelineSettings(
        database_url=TEST_DATABASE_URL, use_vertex=True, vertex_project="zoomout-vertex"
    )

    record = require_cloud_tts(Acquisition.UNDOCUMENTED, settings)

    assert record.transport is Transport.CLOUD_TTS
    assert record.project == "zoomout-vertex"
    assert record.model == DEFAULT_NARRATION_MODEL
    assert record.acquisition is Acquisition.UNDOCUMENTED
    assert record.endpoint is None, "filled from the constructed client, never from a constant"


def test_no_project_means_no_narration() -> None:
    settings = PipelineSettings(database_url=TEST_DATABASE_URL, use_vertex=True, vertex_project="x")
    settings.vertex_project = ""

    with pytest.raises(NarrationTransportError, match="ZOOMOUT_PIPELINE_VERTEX_PROJECT"):
        require_cloud_tts(Acquisition.UNDOCUMENTED, settings)


# ------------------------------------------------------------------------ the request


def test_the_request_is_the_spoken_line_the_voice_and_the_direction() -> None:
    backend = FakeSpeechBackend()
    line = _line(NarratedSlide.SCENARIO)

    result = speech_client(backend).synthesize(line, voice="Sulafat", prompt="Be warm.")

    (request,) = backend.requests
    assert request.input.text == line.spoken
    assert "team — a task" in request.input.text, "the em dash is spaced before it is sent"
    assert request.input.prompt == "Be warm."
    assert request.voice.name == "Sulafat"
    assert request.voice.model_name == "gemini-2.5-flash-tts"
    assert request.voice.language_code == "en-US"
    assert request.audio_config.audio_encoding == texttospeech.AudioEncoding.LINEAR16
    assert result.wav.startswith(b"RIFF")
    assert result.request_bytes == len(line.spoken.encode()) + len(b"Be warm.")


def test_every_call_carries_a_timeout_and_switches_the_library_retry_off() -> None:
    """One retry layer, and it is this module's. The generated client declares neither a
    default timeout nor a default retry today; passing both explicitly is what keeps a future
    library default from stacking a second layer underneath (WP20: 109 minutes lost)."""
    backend = FakeSpeechBackend()
    speech_client(backend).synthesize(_line(), voice="Sulafat", prompt="p")

    (options,) = backend.call_options
    assert options["retry"] is None
    assert isinstance(options["timeout"], float) and 0 < options["timeout"] <= 300


def test_a_rate_limit_or_a_refused_connection_is_retried_and_not_charged() -> None:
    """Neither reached generation, so neither is on the ledger."""
    backend = FakeSpeechBackend(
        failures=[
            google_error(429, "quota"),
            google_error(503, "failed to connect to all addresses; Network is unreachable"),
        ]
    )

    result = speech_client(backend).synthesize(_line(), voice="Sulafat", prompt="p")

    assert len(backend.requests) == 3
    assert result.possibly_billed_attempts == 0


def test_a_timeout_is_retried_and_counted_as_possibly_billed() -> None:
    backend = FakeSpeechBackend(failures=[google_error(504, "Deadline Exceeded")])

    result = speech_client(backend).synthesize(_line(), voice="Sulafat", prompt="p")

    assert len(backend.requests) == 2
    assert result.possibly_billed_attempts == 1


def test_a_call_that_never_answers_reports_its_timeouts() -> None:
    backend = FakeSpeechBackend(
        failures=[google_error(504, "Deadline Exceeded")]
        + [google_error(503, "Network is unreachable")] * (MAX_RETRIES - 1)
    )

    with pytest.raises(SpeechError) as error:
        speech_client(backend).synthesize(_line(), voice="Sulafat", prompt="p")

    assert error.value.possibly_billed == 1, "the timeout, not the refused connections"


def test_retrying_is_bounded() -> None:
    backend = FakeSpeechBackend(failures=[google_error(503, "busy")] * (MAX_RETRIES + 3))

    with pytest.raises(SpeechError, match="failed after"):
        speech_client(backend).synthesize(_line(), voice="Sulafat", prompt="p")

    assert len(backend.requests) == MAX_RETRIES


def test_a_bad_request_is_not_retried() -> None:
    backend = FakeSpeechBackend(failures=[google_error(400, "bad voice")])

    with pytest.raises(SpeechError, match="bad voice"):
        speech_client(backend).synthesize(_line(), voice="Nobody", prompt="p")

    assert len(backend.requests) == 1


def test_no_voice_is_refused() -> None:
    backend = FakeSpeechBackend()

    with pytest.raises(SpeechError, match="no voice"):
        speech_client(backend).synthesize(_line(), voice="", prompt="p")

    assert backend.requests == []


def test_an_oversized_field_is_refused_before_the_call() -> None:
    backend = FakeSpeechBackend()

    with pytest.raises(SpeechError, match="4000"):
        speech_client(backend).synthesize(_line(), voice="Sulafat", prompt="x" * 4001)

    assert backend.requests == []


def test_an_empty_response_is_an_error() -> None:
    class Silent(FakeSpeechBackend):
        def synthesize_speech(self, *, request: object, retry: object, timeout: float) -> object:
            class _Response:
                audio_content = b""

            return _Response()

    with pytest.raises(SpeechError, match="no audio"):
        speech_client(Silent()).synthesize(_line(), voice="Sulafat", prompt="p")


# ------------------------------------------------------------------------------ money


def test_a_clip_is_priced_by_the_seconds_the_model_spoke() -> None:
    spend = speech_spend(
        model="gemini-2.5-flash-tts", node="narration", audio_seconds=20.0, request_bytes=1200
    )

    assert spend.output_tokens == 20 * AUDIO_TOKENS_PER_SECOND
    assert spend.input_tokens == 400, "three bytes a token — an over-count, on purpose"
    assert spend.usd == pytest.approx((400 * 0.50 + 500 * 10.00) / 1_000_000)


def test_the_worst_case_is_the_longest_response_cloud_tts_returns() -> None:
    worst = worst_case_usd(model="gemini-2.5-flash-tts", request_bytes=1200)

    assert worst == pytest.approx(
        (400 * 0.50 + MAX_OUTPUT_SECONDS * AUDIO_TOKENS_PER_SECOND * 10.00) / 1_000_000
    )
    assert worst > 0.16


def test_an_unpriced_model_is_assumed_expensive_not_free() -> None:
    assert worst_case_usd(model="gemini-9-tts", request_bytes=0) > worst_case_usd(
        model="gemini-2.5-flash-tts", request_bytes=0
    )
    assert speech_module.speech_usd(model="gemini-9-tts", input_tokens=0, output_tokens=1) > 0
