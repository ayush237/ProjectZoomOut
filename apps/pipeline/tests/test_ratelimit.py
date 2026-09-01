"""Pacing and bounded retry for the embedding endpoint.

The clock and the sleep are injected, so these run instantly and deterministically instead
of actually waiting a minute — which is the difference between a test that runs in the gate
and one nobody ever runs.
"""

from __future__ import annotations

from zoomout_pipeline.llm.ratelimit import (
    MAX_RETRIES,
    RateLimiter,
    is_rate_limited,
    retry_delay_seconds,
)


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.slept: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


def _limiter(clock: FakeClock, *, max_per_minute: int = 80) -> RateLimiter:
    return RateLimiter(max_per_minute=max_per_minute, sleep=clock.sleep, monotonic=clock.monotonic)


def test_requests_inside_the_window_do_not_wait() -> None:
    clock = FakeClock()
    limiter = _limiter(clock)

    limiter.acquire(64)

    assert clock.slept == []


def test_exceeding_the_window_waits_for_it_to_slide() -> None:
    """136 chunks against a limit of 100 is the real case that broke the first run."""
    clock = FakeClock()
    limiter = _limiter(clock)

    limiter.acquire(64)
    limiter.acquire(64)  # 128 > 80, so this one has to wait
    assert clock.slept, "the second batch should have been paced"
    assert clock.now >= 60.0, "it must wait for the trailing minute to clear"


def test_the_window_forgets_old_requests() -> None:
    clock = FakeClock()
    limiter = _limiter(clock)

    limiter.acquire(80)
    clock.now += 61.0
    limiter.acquire(80)

    assert clock.slept == [], "requests older than a minute must not count against the limit"


def test_a_rate_limit_error_is_recognised() -> None:
    assert is_rate_limited(RuntimeError("429 RESOURCE_EXHAUSTED"))
    assert is_rate_limited(RuntimeError("RESOURCE_EXHAUSTED"))
    assert not is_rate_limited(RuntimeError("404 NOT_FOUND"))


def test_the_apis_own_retry_delay_is_preferred_over_backoff() -> None:
    """Google tells us how long to wait. Guessing shorter just burns another request."""
    error = RuntimeError("Quota exceeded ... Please retry in 26.416144061s.")

    assert retry_delay_seconds(error, attempt=0) == 27.416144061


def test_backoff_is_used_when_no_delay_is_given_and_stays_bounded() -> None:
    error = RuntimeError("RESOURCE_EXHAUSTED")

    delays = [retry_delay_seconds(error, attempt=n) for n in range(MAX_RETRIES)]

    assert delays == sorted(delays), "backoff should not shrink"
    assert max(delays) <= 60.0, "an unbounded wait is an unbounded cycle"


def test_penalise_makes_the_next_acquire_wait() -> None:
    """A 429 means the server's window is full, whatever our own bookkeeping thinks.

    Without this, a retry re-calls immediately into the window that just rejected it and
    burns every attempt inside a single minute — which is exactly what the first real run
    did against the free tier.
    """
    clock = FakeClock()
    limiter = _limiter(clock)

    limiter.penalise()
    limiter.acquire(25)

    assert clock.slept, "after a 429 the next attempt must wait for the window"
    assert clock.now >= 60.0


def test_the_sdk_does_not_retry_underneath_our_own_retry_loop() -> None:
    """WP20: two stacked retry layers cost 109 minutes of a two-hour run.

    `HttpOptions.timeout` bounds one HTTP attempt, not one call. The SDK retries 429s
    internally with its own exponential backoff before this package is told anything, so
    `_call_with_retry`'s five attempts and the limiter's 60-second `penalise()` sat on top
    of an invisible, unbounded loop. Every long gap in the run ended in `llm.retrying` —
    the delay had already happened inside a single call.

    Asserting on the constructed `HttpOptions` rather than on a live call, because the
    thing that regresses is someone rebuilding this object and dropping the field.
    """
    from google.genai import types

    from zoomout_pipeline.llm.client import GeminiClient

    captured: dict[str, object] = {}

    class _FakeClient:
        def __init__(self, **kwargs: object) -> None:
            captured.update(kwargs)

    import google.genai

    original = google.genai.Client
    google.genai.Client = _FakeClient  # type: ignore[misc, assignment]
    try:
        GeminiClient("key", request_timeout_seconds=180.0)
    finally:
        google.genai.Client = original  # type: ignore[misc]

    options = captured["http_options"]
    assert isinstance(options, types.HttpOptions)
    assert options.timeout == 180_000, "the per-attempt timeout must still be set"
    assert options.retry_options is not None, (
        "the SDK's retry layer must be configured, not left at its defaults"
    )
    assert options.retry_options.attempts == 1, (
        "attempts must be 1 — anything higher puts a second, silent retry loop under ours"
    )


def test_every_sdk_client_bounds_its_own_requests() -> None:
    """WP20: the text client had a timeout and a disabled SDK retry. The image client had
    neither, and nobody noticed until an asset run hung on one call for three hours and
    twelve minutes — process alive, budget charged, log silent.

    Parametrised over both constructors deliberately. The defect was never that one client
    was wrong; it was that two clients wrapping the same SDK, written weeks apart, held
    different ideas of what a request may do. A test that covers only the client someone
    happens to be editing is how they drift apart again.
    """
    import google.genai
    from google.genai import types

    from zoomout_pipeline.assets.images import ImageClient
    from zoomout_pipeline.llm.client import GeminiClient

    captured: list[dict[str, object]] = []

    class _FakeClient:
        def __init__(self, **kwargs: object) -> None:
            captured.append(kwargs)

    original = google.genai.Client
    google.genai.Client = _FakeClient  # type: ignore[misc, assignment]
    try:
        GeminiClient("key")
        ImageClient(project="p")
    finally:
        google.genai.Client = original  # type: ignore[misc]

    assert len(captured) == 2, "both clients must have been constructed"
    for name, kwargs in zip(("text", "image"), captured, strict=True):
        options = kwargs.get("http_options")
        assert isinstance(options, types.HttpOptions), f"{name} client sets no http_options"
        assert options.timeout and options.timeout > 0, (
            f"the {name} client has no request timeout — without one the SDK waits forever"
        )
        assert options.retry_options is not None and options.retry_options.attempts == 1, (
            f"the {name} client leaves the SDK's own retry loop under ours"
        )
