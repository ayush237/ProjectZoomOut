"""One spender per run: a lock on the cost ledger, held in the database the ledger lives in.

**What it guards.** A run's `cost` is part of its LangGraph checkpoint, in the pipeline's own
Postgres. A command that spends loads the whole object when it opens the run, adds its own spend in
memory and writes the whole object back, so two processes on one run overwrite each other's entries
(last writer wins) and each starts its budget from its own copy of what was spent: two of them can
each believe they have all the headroom. The voiceover ceiling is enforced by that ledger, and until
this module the only thing enforcing the ledger was a sentence in the README.

**Where it lives.** `runs/` is per worktree and gitignored, but the ledger is in the one shared
database, so a lock file under `runs/<run>/` would not stop a `narrate` started from one checkout
while another is running from a second. The lock has to be where the ledger is.

**What it is.** A *session-level* Postgres advisory lock on a connection of its own, keyed by the
run id. The server releases it when that connection ends, whichever way the process ends: a normal
exit, an exception, Ctrl-C, SIGTERM, SIGKILL. Nothing has to be cleaned up and a dead process never
leaves a run held. Measured against the pipeline's own container through Docker Desktop: the lock
was free 2 ms after SIGKILL and SIGTERM and 11 ms after SIGINT. That holds only while nothing pools
connections between the process and Postgres, because a transaction pooler would hand the lock to
whichever client shares the backend. Nothing does: `psycopg.connect` goes straight to the server in
`db/engine.py`, `runner.py` and `graph/build.py`.

**The shape of the guarantee.** A command takes its run's lock before it builds a client or reads
the ledger, holds it until the process ends (the command goes on to spend after the helper that
took it has returned) and a second process that wants the same run is refused at once. Taking it
again in the same process is not an error, so a command that opens a run twice cannot refuse
itself. It is per run: two different runs spend at once. Advisory locks are per database, so a
test database's locks can never collide with the real one's.

**What the lock cannot do.** If the lock's connection dies while the process lives (a network drop,
a Postgres restart, an operator's `pg_terminate_backend`), the process is silently unguarded. So
every write to the ledger first asks the lock's own connection whether it still holds the lock
(`require_held`), and a process that lost it stops and writes nothing further. That narrows the
window rather than closing it: the spend that was in flight when the lock went is the only one that
can follow it.
"""

from __future__ import annotations

import atexit
import hashlib
import os
import re
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

import psycopg
from psycopg import errors as pg_errors
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row

from zoomout_pipeline.config import get_settings
from zoomout_pipeline.db.engine import assert_pipeline_database
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

# Salts the run id into the key's hash, so it is a number only this package's locks use.
_KEY_NAMESPACE = "zoomout-pipeline/run-lock/v1"

# How soon a dead server or a dropped network is noticed, so a lock connection that has silently
# gone is found by the next `require_held` rather than after the operating system's own timeout
# (hours).
_CONNECTION_OPTIONS: dict[str, int] = {
    "connect_timeout": 5,
    "keepalives": 1,
    "keepalives_idle": 15,
    "keepalives_interval": 5,
    "keepalives_count": 3,
    "tcp_user_timeout": 20_000,
}

# The same, from the server's side, so it frees the lock of a client that vanished without a word
# (a machine that lost power) in about a minute, not the two hours of the operating system's
# default.
# `idle_session_timeout` is switched off for this one connection: it is idle by design, between
# the ledger writes of a run that spends most of its time waiting on a model, and a server
# configured to drop idle sessions would take the lock with it.
_SESSION_SETTINGS: tuple[tuple[str, int], ...] = (
    ("tcp_keepalives_idle", 15),
    ("tcp_keepalives_interval", 5),
    ("tcp_keepalives_count", 3),
    ("idle_session_timeout", 0),
)

# Postgres truncates `application_name` at NAMEDATALEN - 1 bytes, silently.
_APPLICATION_NAME_BYTES = 63
_HOLDER_PID = re.compile(r"\bpid (\d+)$")

_TRY_LOCK = "SELECT pg_try_advisory_lock(%s) AS got"

# Whether *this connection* holds the lock, asked of the server rather than assumed.
_STILL_HELD = """
SELECT EXISTS (
    SELECT 1 FROM pg_locks
    WHERE locktype = 'advisory' AND granted AND objsubid = 1
      AND classid::bigint = %s AND objid::bigint = %s
      AND pid = pg_backend_pid()
      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
) AS held
"""

# Who holds it: the backend that owns the lock row, with the name it connected under.
_WHO_HOLDS = """
SELECT a.pid AS backend_pid, a.application_name, a.backend_start AS since,
       now() - a.backend_start AS held_for
FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory' AND l.granted AND l.objsubid = 1
  AND l.classid::bigint = %s AND l.objid::bigint = %s
  AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
LIMIT 1
"""

type LockConnection = psycopg.Connection[dict[str, object]]


def lock_key(run_id: str) -> int:
    """The advisory lock key for a run: 64 bits of a hash of its id.

    A hash that is the same in every process (`hashlib`, not `hash()`, which Python salts per
    process, so two processes would take locks on different keys and never meet). Two run ids
    sharing a key would only make them refuse each other: the wrong way to be wrong.
    """
    digest = hashlib.sha256(f"{_KEY_NAMESPACE}:{run_id}".encode()).digest()
    return int.from_bytes(digest[:8], "big", signed=True)


def _lock_row_ids(key: int) -> tuple[int, int]:
    """`pg_locks` shows a bigint key as its high half in `classid` and its low half in `objid`,
    both unsigned."""
    unsigned = key & 0xFFFF_FFFF_FFFF_FFFF
    return unsigned >> 32, unsigned & 0xFFFF_FFFF


def application_name(command: str, run_id: str, pid: int) -> str:
    """What the lock's connection calls itself, so whoever is refused can be told who holds it:
    `zoomout-pipeline narrate ikigai pid 41233`. The pid stays whole; a long run id is shortened."""
    head = f"zoomout-pipeline {command}".strip()
    tail = f"pid {pid}"
    room = _APPLICATION_NAME_BYTES - len(head.encode()) - len(tail.encode()) - 2
    encoded = run_id.encode()
    if len(encoded) > room:
        run_id = encoded[: max(room - 1, 0)].decode(errors="ignore") + "~"
    return f"{head} {run_id} {tail}".encode()[:_APPLICATION_NAME_BYTES].decode(errors="ignore")


@dataclass(frozen=True)
class Holder:
    """Whoever holds a run's lock, as the server describes them."""

    backend_pid: int
    application_name: str
    since: datetime
    held_for: timedelta

    @property
    def client_pid(self) -> int | None:
        """The holder's own process id, when it connected under a name this module made."""
        found = _HOLDER_PID.search(self.application_name)
        return int(found.group(1)) if found else None


def _duration(seconds: float) -> str:
    whole = int(seconds)
    if whole < 60:
        return f"{whole} s"
    minutes, rest = divmod(whole, 60)
    if minutes < 60:
        return f"{minutes} min {rest} s"
    hours, minutes = divmod(minutes, 60)
    return f"{hours} h {minutes} min"


class RunLockError(RuntimeError):
    """Base of every refusal and failure of the run lock."""


class RunLockHeldError(RunLockError):
    """Another process holds this run's lock. Nothing was built, read, called or written."""

    def __init__(self, run_id: str, holder: Holder | None) -> None:
        self.run_id = run_id
        self.holder = holder
        who = holder.application_name if holder is not None else "unknown"
        super().__init__(f"run {run_id!r} is held by another process ({who})")

    def describe(self) -> str:
        """What the person who was refused reads: the run, who, and the two ways out."""
        lines = [
            f"RUN {self.run_id!r} IS HELD BY ANOTHER PROCESS — refused before anything was read, "
            "built, called or written.",
            "",
        ]
        holder = self.holder
        if holder is None:
            lines += [
                "  holder : not found — it may have let go a moment ago. Run this again.",
                "",
            ]
        else:
            since = holder.since.astimezone().strftime("%H:%M:%S")
            lines += [
                f"  holder : {holder.application_name}",
                f"           Postgres backend {holder.backend_pid}, holding it for "
                f"{_duration(holder.held_for.total_seconds())} (since {since})",
                "",
                "Two ways out:",
                "  - wait for it to finish, then run this again;",
            ]
            client_pid = holder.client_pid
            if client_pid is not None:
                lines += [
                    f'  - stop it ("kill {client_pid}", on the machine that started it). The',
                    "    server frees the run the moment that process's connection closes, so a",
                    "    stopped process never leaves it held.",
                ]
            else:
                lines += ["  - stop whatever started it."]
            lines += [
                "If that process is already gone and the server has not noticed:",
                f"  select pg_terminate_backend({holder.backend_pid});",
            ]
        lines.append(
            "There is no --force and no --wait: two processes spending on one run overwrite "
            "each other's ledger."
        )
        return "\n".join(lines)


class RunLockLostError(RunLockError):
    """This process held the run's lock and does not any more. It must write nothing further."""

    def __init__(self, run_id: str, reason: str) -> None:
        self.run_id = run_id
        self.reason = reason
        super().__init__(f"the lock on run {run_id!r} was lost: {reason}")

    def describe(self, *, unrecorded_usd: float = 0.0) -> str:
        lines = [
            "THE RUN LOCK WAS LOST — stopping before anything more is recorded.",
            f"This process held run {self.run_id!r}, and the database connection that held it "
            f"is gone ({self.reason}).",
            "Another process may be spending on the run now, so this one writes nothing further "
            "to its ledger.",
        ]
        if unrecorded_usd > 0:
            lines.append(f"Not recorded: ${unrecorded_usd:.4f}.")
        lines.append(
            "What was already paid for is on disk and the next run reuses it for free; read "
            f"`cost --run-id {self.run_id}` against the files before spending on it again."
        )
        return "\n".join(lines)


class RunLockNotHeldError(RunLockError):
    """A run was written without its lock ever having been taken: a command forgot to take it.

    Not a refusal to render and not a state to recover from. It is a defect in a command, and it
    stops that command loudly rather than letting it write a ledger nothing protects.
    """

    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        super().__init__(
            f"run {run_id!r} was used without taking its lock; a command that writes a run "
            "calls `hold_run` first"
        )


class RunLockUnavailableError(RunLockError):
    """The database that holds the lock could not be reached, so it could not be taken."""

    def __init__(self, run_id: str, cause: Exception) -> None:
        self.run_id = run_id
        super().__init__(
            f"the lock on run {run_id!r} could not be taken: the pipeline's database did not "
            f"answer ({type(cause).__name__}: {cause}). Nothing was started; a command that "
            "cannot take its run's lock does not spend on it."
        )


class RunLocker(Protocol):
    """Takes and keeps run locks. Postgres in production; a fake that never touches a database in
    the tests that are not about the lock."""

    def acquire(self, run_id: str, *, command: str) -> None: ...

    def require_held(self, run_id: str) -> None: ...

    def release_all(self) -> None: ...


@dataclass
class _Held:
    run_id: str
    key: int
    who: str
    pid: int
    connection: LockConnection
    lost: str | None = None


def _close_quietly(connection: LockConnection) -> None:
    """Closing a connection that is already dead has nothing left to report."""
    try:
        connection.close()
    except psycopg.Error:
        return


class PostgresRunLocker:
    """The run locks of one process, each on a connection of its own."""

    def __init__(self, database_url: str) -> None:
        self._url = database_url
        self._held: dict[str, _Held] = {}
        self._mutex = threading.RLock()

    def acquire(self, run_id: str, *, command: str) -> None:
        """Take the run's lock, or raise `RunLockHeldError` at once. Taking it again in the same
        process is not an error; a lock this process has *lost* stays lost."""
        with self._mutex:
            held = self._held.get(run_id)
            if held is not None:
                self._check(held)
                return

            who = application_name(command, run_id, os.getpid())
            key = lock_key(run_id)
            try:
                connection: LockConnection = psycopg.connect(
                    make_conninfo(self._url, application_name=who, **_CONNECTION_OPTIONS),
                    autocommit=True,
                    row_factory=dict_row,
                )
            except psycopg.Error as error:
                raise RunLockUnavailableError(run_id, error) from error

            try:
                assert_pipeline_database(connection)
                self._tune(connection)
                row = connection.execute(_TRY_LOCK, (key,)).fetchone()
                got = bool(row and row["got"])
                holder = None if got else self._who_holds(connection, key)
            except psycopg.Error as error:
                _close_quietly(connection)
                raise RunLockUnavailableError(run_id, error) from error
            except BaseException:
                _close_quietly(connection)
                raise

            if not got:
                _close_quietly(connection)
                _log.warning(
                    "run.lock.refused",
                    run_id=run_id,
                    holder=holder.application_name if holder else None,
                    holder_backend_pid=holder.backend_pid if holder else None,
                )
                raise RunLockHeldError(run_id, holder)

            self._held[run_id] = _Held(run_id, key, who, os.getpid(), connection)
            _log.info("run.lock.acquired", run_id=run_id, who=who)

    def require_held(self, run_id: str) -> None:
        """Ask the server whether this process still holds the run's lock; if not, raise.

        One cheap query on the lock's own connection, so it sees what the lock sees: a connection
        that has died raises, and a live one that no longer holds the lock says so.
        """
        with self._mutex:
            held = self._held.get(run_id)
            if held is None:
                raise RunLockNotHeldError(run_id)
            self._check(held)

    def release_all(self) -> None:
        """Let go of every lock this process holds, by closing the connections that hold them. A
        forked child never closes its parent's connection."""
        with self._mutex:
            held, self._held = self._held, {}
        for entry in held.values():
            if entry.pid == os.getpid():
                _close_quietly(entry.connection)

    def _check(self, held: _Held) -> None:
        if held.lost is not None:
            raise RunLockLostError(held.run_id, held.lost)
        classid, objid = _lock_row_ids(held.key)
        try:
            row = held.connection.execute(_STILL_HELD, (classid, objid)).fetchone()
            reason = (
                ""
                if row and row["held"]
                else "the server no longer lists this lock for the connection that took it"
            )
        except psycopg.Error as error:
            reason = f"{type(error).__name__}: {error}"
        if reason:
            held.lost = reason
            _close_quietly(held.connection)
            _log.error("run.lock.lost", run_id=held.run_id, who=held.who, reason=reason)
            raise RunLockLostError(held.run_id, reason)

    @staticmethod
    def _tune(connection: LockConnection) -> None:
        for name, value in _SESSION_SETTINGS:
            try:
                connection.execute(f"SET {name} = {value}")
            except pg_errors.UndefinedObject:
                # A server older than the setting (`idle_session_timeout` is Postgres 14+): there
                # is nothing to switch off.
                continue

    @staticmethod
    def _who_holds(connection: LockConnection, key: int) -> Holder | None:
        classid, objid = _lock_row_ids(key)
        row = connection.execute(_WHO_HOLDS, (classid, objid)).fetchone()
        if row is None:
            return None
        return Holder(
            backend_pid=_as_int(row["backend_pid"]),
            application_name=str(row["application_name"] or ""),
            since=_as_datetime(row["since"]),
            held_for=_as_timedelta(row["held_for"]),
        )


def _as_int(value: object) -> int:
    if isinstance(value, int):
        return value
    raise TypeError(f"expected an integer from the server, got {type(value).__name__}")


def _as_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value
    raise TypeError(f"expected a timestamp from the server, got {type(value).__name__}")


def _as_timedelta(value: object) -> timedelta:
    if isinstance(value, timedelta):
        return value
    raise TypeError(f"expected an interval from the server, got {type(value).__name__}")


# --------------------------------------------------------------------- the process's own locker

_active: RunLocker | None = None


def _locker() -> RunLocker:
    """The process's locker, made on first use from the configured database. Its connections are
    closed cleanly at exit; the server would free the locks anyway, but a clean close says so."""
    global _active
    if _active is None:
        locker = PostgresRunLocker(get_settings().database_url)
        atexit.register(locker.release_all)
        _active = locker
    return _active


def acquire(run_id: str, *, command: str = "") -> None:
    """Take `run_id`'s lock for the life of this process, or raise `RunLockHeldError`."""
    _locker().acquire(run_id, command=command)


def require_held(run_id: str) -> None:
    """Raise unless this process holds `run_id`'s lock right now. Call it before a ledger write."""
    _locker().require_held(run_id)


def release_all() -> None:
    """Let go of every lock this process holds. Nothing needs it at exit; the tests do."""
    if _active is not None:
        _active.release_all()


__all__ = [
    "Holder",
    "PostgresRunLocker",
    "RunLockError",
    "RunLockHeldError",
    "RunLockLostError",
    "RunLockNotHeldError",
    "RunLockUnavailableError",
    "RunLocker",
    "acquire",
    "application_name",
    "lock_key",
    "release_all",
    "require_held",
]
