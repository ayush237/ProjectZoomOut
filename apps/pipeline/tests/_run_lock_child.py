"""A child process that takes a run's lock the way a command does, then ends the way the test asks.

Lives in its own module because the point is that the holder is a **different process**: its own
connection, its own file descriptors, and an end the parent can choose, `kill -9` included. It goes
through the production path (`run_lock.acquire`, the process's own locker built from
`ZOOMOUT_PIPELINE_DATABASE_URL`, closed at exit by `atexit`) so what is proved is what a command
does and not a test double of it. The same shape as `_durability_child.py`.

Usage: `python _run_lock_child.py <mode> <run-id> [<seconds>]`

* `hold`  — take the lock, print `HELD`, then wait to be killed.
* `exit`  — take it, print `HELD`, and end normally.
* `raise` — take it, print `HELD`, then fail with an exception.
* `try`   — take it if it can (`HELD`) or say `REFUSED` (exit 3); `<seconds>` keeps it that long.
* `key`   — print the run's lock key and take nothing.
"""

from __future__ import annotations

import logging
import signal
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from zoomout_pipeline.db import run_lock
from zoomout_pipeline.logging import configure_logging


def main() -> int:
    # A child started from a background job inherits "ignore SIGINT"; Ctrl-C has to mean Ctrl-C.
    signal.signal(signal.SIGINT, signal.default_int_handler)
    # Logging as the CLI configures it, but silent below an error: the parent reads this process's
    # stdout line by line, and an unconfigured structlog prints every debug event to it.
    configure_logging(level=logging.ERROR)

    mode, run_id = sys.argv[1:3]
    if mode == "key":
        print(run_lock.lock_key(run_id), flush=True)
        return 0

    try:
        run_lock.acquire(run_id, command="narrate")
    except run_lock.RunLockHeldError:
        print("REFUSED", flush=True)
        return 3
    print("HELD", flush=True)

    if mode == "hold":
        time.sleep(600)
        return 0
    if mode == "exit":
        return 0
    if mode == "raise":
        raise RuntimeError("the command failed after it took the lock")
    if mode == "try":
        time.sleep(float(sys.argv[3]) if len(sys.argv) > 3 else 0.0)
        return 0
    raise SystemExit(f"unknown mode {mode!r}")


if __name__ == "__main__":
    raise SystemExit(main())
