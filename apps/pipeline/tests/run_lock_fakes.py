"""The run lock, for every test that is not about the run lock.

**Why a fake at all.** Most of the suite drives a command through `CliRunner` with a faked graph and
no database, under a run id of `ikigai`. With the real lock each of them would open a connection
and take a lock on `ikigai` in whatever database `ZOOMOUT_PIPELINE_DATABASE_URL` names, which on
this machine is the real one, so a `pytest` run would refuse (or be refused by) a `narrate` that is
spending real money. So no test takes a real lock unless it asks for one (`real_run_locker`, in
`test_run_lock.py`, against a database of its own), and the conftest installs this in front of
all of them.

**Permissive on purpose.** `require_held` passes for any run. A test of a command's output has no
business knowing which of its writes the lock was asked about; what the lock does is tested with
the real one. It records what it was asked, so a test can still say "this command never touched it".
"""

from __future__ import annotations

from typing import NoReturn


class InProcessRunLocker:
    """Holds nothing and refuses nothing, and remembers every call."""

    def __init__(self) -> None:
        self.acquired: list[tuple[str, str]] = []
        self.checked: list[str] = []
        self.released = 0

    def acquire(self, run_id: str, *, command: str) -> None:
        self.acquired.append((run_id, command))

    def require_held(self, run_id: str) -> None:
        self.checked.append(run_id)

    def release_all(self) -> None:
        self.released += 1


class ForbiddenRunLocker:
    """What `run_lock._active` is for the whole of a test session before a test installs anything.

    **A tripwire, not a locker.** Every test gets the hermetic locker above through a
    function-scoped fixture; a test that calls `monkeypatch.undo()` takes it away again (it undoes
    everything that fixture patched), and what is left underneath is this, which fails loudly the
    first time anything asks it for a lock. Without it, what is left is `None`, and the next
    `acquire` builds the real locker from the environment's database URL and takes a session lock
    there: on this machine, the real one. LEDGER-1's first draft of a logging test did exactly that,
    and was spared only because the test database it named did not exist.
    """

    _WHY = (
        "a test asked for a run lock and none is installed. `hermetic_run_locks` installs one per "
        "test, and `monkeypatch.undo()` removes it, which is what puts this here: do not call "
        "`monkeypatch.undo()` in a test. A test that needs the real lock asks for "
        "`real_run_locker`."
    )

    def acquire(self, run_id: str, *, command: str) -> NoReturn:
        raise AssertionError(f"{self._WHY} (acquire {run_id!r} for {command!r})")

    def require_held(self, run_id: str) -> NoReturn:
        raise AssertionError(f"{self._WHY} (require_held {run_id!r})")

    def release_all(self) -> None:
        """Letting go of nothing is not a use of the lock, and teardown paths call it."""


def forbidden_real_locker(*_args: object, **_kwargs: object) -> NoReturn:
    """Stands where `run_lock.PostgresRunLocker` is for the whole of a test session.

    `run_lock._locker()` builds the real locker, from the environment's database URL, when nothing
    is installed. A test must never do that implicitly: it would take a lock in whatever database
    the environment names. The tests that are about the lock construct the real class on purpose,
    from the name they imported before this stood in its place, with a database URL of their own
    (`real_run_locker`, and the tests in `test_run_lock.py`).
    """
    raise AssertionError(
        "a test constructed the real run locker through `run_lock._locker()`, which would take a "
        "lock in the database the environment names. Install a locker (`hermetic_run_locks` does, "
        "per test) or ask for `real_run_locker`."
    )
