"""The client's own rate-limit handling.

This file exists because the retry loop was written twice, and a Vertex refactor silently
deleted the copy in `embed`. Every test passed — they exercised `RateLimiter` directly and
never checked that the client actually used it. Testing the unit and not the wiring is how
a regression ships green.
"""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import BaseModel

from zoomout_pipeline.llm.client import GeminiClient, LLMError, LLMTransportError
from zoomout_pipeline.llm.ratelimit import MAX_RETRIES, RateLimiter


class Answer(BaseModel):
    answer: str


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.slept: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


class FakeSDK:
    """Stands in for `genai.Client`, failing a set number of times first."""

    def __init__(self, failures: int, *, error: Exception | None = None) -> None:
        self.remaining = failures
        self.error = error or RuntimeError("429 RESOURCE_EXHAUSTED. Please retry in 5s.")
        self.calls = 0
        self.models = self

    def _maybe_fail(self) -> None:
        self.calls += 1
        if self.remaining > 0:
            self.remaining -= 1
            raise self.error

    def generate_content(self, **_: Any) -> Any:
        self._maybe_fail()
        return type(
            "R", (), {"parsed": Answer(answer="ok"), "text": None, "usage_metadata": None}
        )()

    def embed_content(self, *, contents: list[str], **_: Any) -> Any:
        self._maybe_fail()
        values = [[1.0] + [0.0] * 767 for _ in contents]
        return type("R", (), {"embeddings": [type("E", (), {"values": v})() for v in values]})()


def _client(sdk: FakeSDK, clock: FakeClock) -> GeminiClient:
    client = GeminiClient(
        "test-key",
        limiter=RateLimiter(max_per_minute=60, sleep=clock.sleep, monotonic=clock.monotonic),
    )
    # Substituting the SDK is the point of this test; the attribute is typed as the
    # real client, so this one assignment has to be waived.
    client._client = sdk  # type: ignore[assignment]
    return client


def test_generate_retries_a_rate_limit_and_succeeds() -> None:
    clock = FakeClock()
    sdk = FakeSDK(failures=2)

    result = _client(sdk, clock).generate_structured(
        prompt="p", schema=Answer, model="m", node="breakdown"
    )

    assert result.value.answer == "ok"
    assert sdk.calls == 3, "it should have retried twice before succeeding"
    assert clock.slept, "a retry must wait rather than hammering the same window"


def test_embed_retries_too() -> None:
    """The half that was deleted. Same guarantee, same shared path."""
    clock = FakeClock()
    sdk = FakeSDK(failures=1)

    vectors, _spend = _client(sdk, clock).embed(texts=["a", "b"], model="m", node="ingest")

    assert len(vectors) == 2
    assert sdk.calls == 2
    assert clock.slept


def test_a_persistent_rate_limit_becomes_a_transport_error() -> None:
    """Bounded, and typed so a 429 is never mistaken for a bad prompt."""
    clock = FakeClock()
    sdk = FakeSDK(failures=99)

    with pytest.raises(LLMTransportError):
        _client(sdk, clock).generate_structured(
            prompt="p", schema=Answer, model="m", node="breakdown"
        )

    assert sdk.calls == MAX_RETRIES


def test_a_non_rate_limit_error_is_not_retried() -> None:
    """A 404 will still be a 404 in five seconds. Retrying it just wastes the run."""
    clock = FakeClock()
    sdk = FakeSDK(failures=99, error=RuntimeError("404 NOT_FOUND"))

    with pytest.raises(LLMError) as error:
        _client(sdk, clock).generate_structured(
            prompt="p", schema=Answer, model="m", node="breakdown"
        )

    assert not isinstance(error.value, LLMTransportError)
    assert sdk.calls == 1


def test_embedding_is_paced_per_text_not_per_call() -> None:
    """The endpoint counts each text as a request; pacing per call would undercount 25x."""
    clock = FakeClock()
    sdk = FakeSDK(failures=0)
    client = _client(sdk, clock)

    client.embed(texts=["x"] * 40, model="m", node="ingest")
    client.embed(texts=["x"] * 40, model="m", node="ingest")

    assert clock.slept, "80 texts against a 60/minute budget must have waited"


def test_a_timeout_is_retried_like_a_rate_limit() -> None:
    """A hung call is 'no answer yet', not 'a bad answer'.

    Before a request timeout existed, one wedged call held a Track run for 83 minutes and
    looked exactly like progress. The timeout makes it an error; this makes it a recoverable
    one.
    """
    clock = FakeClock()
    sdk = FakeSDK(failures=2, error=RuntimeError("504 Deadline Exceeded"))

    result = _client(sdk, clock).generate_structured(
        prompt="p", schema=Answer, model="m", node="draft_leaf"
    )

    assert result.value.answer == "ok"
    assert sdk.calls == 3


def test_a_request_timeout_is_configured_on_the_client() -> None:
    """The SDK defaults to waiting forever, which is the whole problem."""
    from zoomout_pipeline.config import PipelineSettings
    from zoomout_pipeline.llm.client import GeminiClient as _Client

    settings = PipelineSettings(
        database_url="postgresql://postgres:postgres@127.0.0.1:5433/zoomout_pipeline",
        gemini_api_key="k",
        request_timeout_seconds=12.0,
    )
    client = _Client.from_settings(settings)

    options = client._client._api_client._http_options
    assert int(getattr(options, "timeout", 0) or 0) == 12_000
