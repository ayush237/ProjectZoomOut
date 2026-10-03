"""What the tests about the run lock call: real sessions, real child processes, real waiting.

No fixtures here (they are in `conftest.py`), only helpers. Nothing in this module takes a lock on a
run it was not given, and everything it opens it closes.
"""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any

import psycopg
import pytest

from zoomout_pipeline.db.run_lock import PostgresRunLocker, RunLockLostError, lock_key

CHILD = Path(__file__).resolve().parent / "_run_lock_child.py"
PACKAGE_ROOT = Path(__file__).resolve().parent.parent

type Session = psycopg.Connection[tuple[Any, ...]]

_THIS_DATABASE = "database = (SELECT oid FROM pg_database WHERE datname = current_database())"


def new_run_id() -> str:
    """A run id no other test, and no real run, shares."""
    return f"lock-test-{uuid.uuid4().hex[:10]}"


def advisory_locks(url: str) -> list[tuple[int, int]]:
    """Every advisory lock held in the database right now, as (backend pid, key's low half)."""
    with psycopg.connect(url, autocommit=True) as conn:
        rows = conn.execute(
            "SELECT pid, objid::bigint FROM pg_locks "
            f"WHERE locktype = 'advisory' AND {_THIS_DATABASE}"
        ).fetchall()
    return [(int(row[0]), int(row[1])) for row in rows]


def wait_until_no_locks(url: str, seconds: float = 5.0) -> list[tuple[int, int]]:
    """The locks still held after giving the server a moment to notice sessions that ended."""
    deadline = time.monotonic() + seconds
    while True:
        held = advisory_locks(url)
        if not held or time.monotonic() > deadline:
            return held
        time.sleep(0.02)


def sessions_named(url: str, prefix: str) -> int:
    """How many sessions are connected under a name that starts with `prefix`."""
    with psycopg.connect(url, autocommit=True) as conn:
        row = conn.execute(
            "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE %s", (prefix + "%",)
        ).fetchone()
    return int(row[0]) if row else 0


def backend_pid_named(url: str, name: str) -> int:
    with psycopg.connect(url, autocommit=True) as conn:
        row = conn.execute(
            "SELECT pid FROM pg_stat_activity WHERE application_name = %s", (name,)
        ).fetchone()
    assert row is not None, f"no session is connected as {name!r}"
    return int(row[0])


def run_is_free(url: str, run_id: str) -> bool:
    """Whether a brand-new session can take the run's lock right now (it lets go at once)."""
    key = lock_key(run_id)
    with psycopg.connect(url, autocommit=True) as probe:
        row = probe.execute("SELECT pg_try_advisory_lock(%s)", (key,)).fetchone()
        got = bool(row and row[0])
        if got:
            probe.execute("SELECT pg_advisory_unlock(%s)", (key,))
    return got


class ForeignHolders:
    """Sessions that are not this process, holding run locks the way a `psql` window would."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._sessions: list[Session] = []

    def hold(self, run_id: str, *, name: str = "psql") -> Session:
        session: Session = psycopg.connect(self._url, autocommit=True, application_name=name)
        self._sessions.append(session)
        row = session.execute("SELECT pg_try_advisory_lock(%s)", (lock_key(run_id),)).fetchone()
        assert row is not None and row[0] is True, f"could not take {run_id!r} for the test"
        return session

    def close(self) -> None:
        for session in self._sessions:
            session.close()
        self._sessions.clear()


# ----------------------------------------------------------------------------- child processes


def spawn_child(mode: str, run_id: str, url: str, *extra: str) -> subprocess.Popen[str]:
    """`_run_lock_child.py` in its own process, on the database `url`, with nothing of this
    environment but the two settings the pipeline needs to start (and a hash seed that is random,
    so a key built from `hash()` could not agree across processes by luck)."""
    env = {k: v for k, v in os.environ.items() if not k.startswith("ZOOMOUT_PIPELINE_")}
    env.update(
        {
            "ZOOMOUT_PIPELINE_DATABASE_URL": url,
            "ZOOMOUT_PIPELINE_GEMINI_API_KEY": "unused",
            "PYTHONHASHSEED": "random",
        }
    )
    return subprocess.Popen(
        [sys.executable, str(CHILD), mode, run_id, *extra],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=str(PACKAGE_ROOT),
        env=env,
    )


def reap(child: subprocess.Popen[str]) -> None:
    """End a child that is still running and collect it, whatever state the test left it in."""
    if child.poll() is None:
        child.kill()
    child.wait(timeout=30)
    if child.stdout is not None:
        child.stdout.close()


def expect_line(child: subprocess.Popen[str], expected: str) -> None:
    """The child's first line, or a failure that shows everything it said."""
    assert child.stdout is not None
    line = child.stdout.readline().strip()
    if line != expected:
        child.kill()
        rest = child.stdout.read()
        pytest.fail(f"the child said {line!r}, expected {expected!r}:\n{rest}")


# ---------------------------------------------------------------------------------- waiting


def acquire_within(
    locker: PostgresRunLocker, run_id: str, *, seconds: float = 15.0
) -> Exception | None:
    """What `acquire` raised, or None if it returned.

    **And a failure if it does not come back at all**: a refusal is immediate. A lock that waits for
    the holder is not a refusal, and it would hang the suite instead of failing it.
    """
    outcome: list[Exception | None] = []

    def attempt() -> None:
        try:
            locker.acquire(run_id, command="narrate")
        except Exception as error:
            outcome.append(error)
        else:
            outcome.append(None)

    thread = threading.Thread(target=attempt, daemon=True)
    thread.start()
    thread.join(seconds)
    if thread.is_alive():
        pytest.fail(f"acquire did not come back in {seconds} s: a refusal has to be immediate")
    return outcome[0]


def acquire_until_free(
    locker: PostgresRunLocker, run_id: str, *, seconds: float = 5.0
) -> Exception | None:
    """Keep trying until the run can be taken: None once it was, or the last refusal."""
    deadline = time.monotonic() + seconds
    while True:
        error = acquire_within(locker, run_id)
        if error is None or time.monotonic() > deadline:
            return error
        time.sleep(0.02)


def until_lost(locker: PostgresRunLocker, run_id: str, *, seconds: float = 5.0) -> RunLockLostError:
    """Ask until the locker says the lock is gone. A killed backend takes a moment to be gone."""
    deadline = time.monotonic() + seconds
    while True:
        try:
            locker.require_held(run_id)
        except RunLockLostError as lost:
            return lost
        if time.monotonic() > deadline:
            pytest.fail("a lock whose connection was terminated was never noticed")
        time.sleep(0.02)
