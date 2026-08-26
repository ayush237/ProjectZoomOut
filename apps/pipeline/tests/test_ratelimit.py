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
