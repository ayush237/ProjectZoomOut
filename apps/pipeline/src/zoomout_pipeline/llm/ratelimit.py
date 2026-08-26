"""Pacing and retry for the embedding endpoint.

The proposal's §4a guessed that free-tier rate limits were "unlikely to bind" because this
pipeline makes a handful of requests between long human gates. That is true of the text
nodes and false of ingest: **the embedding endpoint counts each text as a request**, not
each batch, so one 22,000-word book is ~140 requests against a limit of 100 per minute. It
binds on the first real book.

Both the clock and the sleep are injected. A node that reads the clock inside its own body
cannot be tested, and a test that actually waited a minute would not be run.
"""

from __future__ import annotations

import re
import time
from collections.abc import Callable
from dataclasses import dataclass, field

from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

# The free tier allows 100 embed requests per minute. Pacing at 80 leaves room for the
# clock disagreeing with Google's and for a retry landing inside the same window.
DEFAULT_EMBED_REQUESTS_PER_MINUTE = 60

# Bounded, like every other cycle in this service.
MAX_RETRIES = 5

_RETRY_DELAY_PATTERN = re.compile(r"retry in ([0-9.]+)s", re.IGNORECASE)


def is_rate_limited(error: Exception) -> bool:
    text = str(error)
    return "429" in text or "RESOURCE_EXHAUSTED" in text


def retry_delay_seconds(error: Exception, *, attempt: int) -> float:
    """Prefer the delay the API asked for; fall back to exponential backoff."""
    match = _RETRY_DELAY_PATTERN.search(str(error))
    if match:
        return float(match.group(1)) + 1.0
    return min(2.0**attempt, 60.0)


@dataclass
class RateLimiter:
    """A sliding-window limiter measured in requests, not batches."""

    max_per_minute: int = DEFAULT_EMBED_REQUESTS_PER_MINUTE
    sleep: Callable[[float], None] = time.sleep
    monotonic: Callable[[], float] = time.monotonic
    _window: list[float] = field(default_factory=list)

    def acquire(self, units: int) -> None:
        """Block until `units` more requests fit inside the trailing minute."""
        while True:
            now = self.monotonic()
            self._window = [stamp for stamp in self._window if now - stamp < 60.0]

            if len(self._window) + units <= self.max_per_minute:
                self._window.extend([now] * units)
                return

            oldest = min(self._window)
            wait = 60.0 - (now - oldest) + 0.5
            _log.info("ratelimit.waiting", seconds=round(wait, 1), queued=units)
            self.sleep(max(wait, 0.1))

    def penalise(self) -> None:
        """Treat the window as full after the server said it was.

        Without this a retry re-calls immediately into the same full window and simply
        collects another 429 — which is how the first real run burned all five attempts in
        under a minute. A rejected request still counts against the quota, so the local
        window has to assume the worst rather than its own optimistic bookkeeping.
        """
        now = self.monotonic()
        self._window = [now] * self.max_per_minute
