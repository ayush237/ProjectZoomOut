"""LEDGER-1.1 T4 — a test cannot undo the hermetic locker into the real one. Tier B.

The suite drives `narrate` under the run id `ikigai` with a faked graph, so every test is given a
locker that holds nothing (`hermetic_run_locks`, one function-scoped `monkeypatch.setattr`). A test
that called `monkeypatch.undo()` took it away, `run_lock._active` went back to `None`, and the next
`acquire` built the real locker from the environment's database URL and took a session lock there:
on this machine, the real one. LEDGER-1's first draft of a logging test did exactly that and was
spared only because the database its environment named did not exist.

So under the hermetic locker there is now a tripwire (`ForbiddenRunLocker`, installed for the whole
session by a fixture with a `MonkeyPatch` of its own that no test can undo), and the name
`run_lock._locker()` builds the real locker from stands for a function that refuses. The tests that
are about the lock construct the real class on purpose, from the name they imported.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from typer.testing import CliRunner

from zoomout_pipeline import cli
from zoomout_pipeline.db import run_lock
from zoomout_pipeline.db.run_lock import PostgresRunLocker

from .run_lock_fakes import ForbiddenRunLocker, InProcessRunLocker

# A database no locker could connect to, behind anything below that gets as far as building one.
NOBODY = "postgresql://nobody@127.0.0.1:1/none"


def test_each_test_is_given_the_hermetic_locker(hermetic_run_locks: InProcessRunLocker) -> None:
    assert run_lock._active is hermetic_run_locks


def test_a_test_that_undoes_the_hermetic_locker_fails_loudly_and_takes_no_lock(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """**The experiment, and the one `monkeypatch.undo()` a test may contain.** Undoing removes the
    hermetic locker. What is left is the tripwire: the lock is asked for and the test is told, in
    words, what it did, through the command as well as directly. Nothing was constructed, and no
    lock was taken in any database."""
    monkeypatch.undo()
    monkeypatch.setattr(run_lock, "get_settings", lambda: SimpleNamespace(database_url=NOBODY))

    assert isinstance(run_lock._active, ForbiddenRunLocker)
    with pytest.raises(AssertionError, match=r"do not call `monkeypatch\.undo\(\)`"):
        run_lock.acquire("ikigai", command="narrate")

    result = CliRunner().invoke(cli.app, ["narrate", "--run-id", "ikigai"])
    assert result.exit_code == 1
    assert isinstance(result.exception, AssertionError), result.exception
    assert "monkeypatch.undo()" in str(result.exception)


def test_the_real_locker_cannot_be_built_by_the_default_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The second wall, for a test that puts `None` back some other way: `_locker()` would build
    the real locker from the environment's URL, and it is refused, in words."""
    monkeypatch.setattr(run_lock, "_active", None)
    monkeypatch.setattr(run_lock, "get_settings", lambda: SimpleNamespace(database_url=NOBODY))

    with pytest.raises(AssertionError, match="constructed the real run locker"):
        run_lock.acquire("ikigai", command="narrate")


def test_the_tests_about_the_lock_still_build_the_real_class_on_purpose() -> None:
    """The class they imported is the real one; the name the module looks it up by is the tripwire.
    (This is what lets `real_run_locker` and `test_run_lock.py` exist.)"""
    assert run_lock.PostgresRunLocker is not PostgresRunLocker
    locker = PostgresRunLocker(NOBODY)  # built, not connected: nothing here asks it for a lock
    locker.release_all()
