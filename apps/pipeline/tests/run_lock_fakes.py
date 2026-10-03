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
