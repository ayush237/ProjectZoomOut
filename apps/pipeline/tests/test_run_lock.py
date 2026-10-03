"""LEDGER-1 — one spender per run, **on real connections and real processes**. Tier A.

A lock that is real in the tests and absent in a command, or one a crash leaves held for ever, is
the shape of defect that ships quietly. So nothing here is a mock of the lock: two or more real
Postgres sessions, and for the ends that matter a real child process (`_run_lock_child.py`, the
shape of `_durability_child.py`) that is really killed with SIGKILL. The database is the server's
own maintenance database (`lock_database`), so nothing here can meet a lock on a real run.

What the commands do with the lock is `test_run_lock_commands.py`. This file is what the lock *is*.
"""

from __future__ import annotations

import os
import signal
import time
from datetime import UTC, datetime, timedelta

import psycopg
import pytest

from zoomout_pipeline.db import run_lock
from zoomout_pipeline.db.engine import ForeignDatabaseError
from zoomout_pipeline.db.run_lock import (
    Holder,
    PostgresRunLocker,
    RunLockHeldError,
    RunLockLostError,
    RunLockNotHeldError,
    RunLockUnavailableError,
    application_name,
    lock_key,
)

from .run_lock_support import (
    ForeignHolders,
    acquire_until_free,
    acquire_within,
    advisory_locks,
    backend_pid_named,
    expect_line,
    new_run_id,
    reap,
    run_is_free,
    sessions_named,
    spawn_child,
    until_lost,
)

# ================================================================================ who holds it


def test_a_second_process_is_refused_at_once_and_told_who_holds_the_run(
    real_run_locker: PostgresRunLocker, lock_database: str
) -> None:
    """**L1.** The holder is a real process with a real connection; the second is this one. The
    refusal comes back at once (never a wait), names the holder as the holder named itself, and
    gives the backend pid that `pg_terminate_backend` needs."""
    run_id = new_run_id()
    holder = spawn_child("hold", run_id, lock_database)
    try:
        expect_line(holder, "HELD")

        started = time.monotonic()
        refused = acquire_within(real_run_locker, run_id)
        elapsed = time.monotonic() - started

        assert isinstance(refused, RunLockHeldError), refused
        assert elapsed < 2.0, f"a refusal is immediate, and this took {elapsed:.1f} s"
        who = refused.holder
        assert who is not None
        assert who.application_name == f"zoomout-pipeline narrate {run_id} pid {holder.pid}"
        assert who.client_pid == holder.pid
        assert who.backend_pid > 0 and who.held_for.total_seconds() >= 0
        text = refused.describe()
        assert run_id in text and "HELD BY ANOTHER PROCESS" in text
        assert who.application_name in text
        assert f'kill {holder.pid}"' in text
        assert f"pg_terminate_backend({who.backend_pid})" in text
        assert "no --force and no --wait" in text
        # The one connection the refused process opened is gone, and the holder still has its own.
        assert sessions_named(lock_database, f"zoomout-pipeline narrate {run_id}") == 1
    finally:
        reap(holder)


def test_a_session_that_is_not_a_command_is_named_too(
    real_run_locker: PostgresRunLocker, hold_elsewhere: ForeignHolders
) -> None:
    """Whoever holds it, `psql` included: the name it connected under, and its backend."""
    run_id = new_run_id()
    hold_elsewhere.hold(run_id, name="psql window")

    refused = acquire_within(real_run_locker, run_id)

    assert isinstance(refused, RunLockHeldError), refused
    assert refused.holder is not None and refused.holder.application_name == "psql window"
    assert refused.holder.client_pid is None
    text = refused.describe()
    assert "stop whatever started it" in text and "kill" not in text
    assert f"pg_terminate_backend({refused.holder.backend_pid})" in text


# ======================================================================= released on every end


@pytest.mark.parametrize("ending", ["exit", "raise", "SIGKILL", "SIGTERM", "SIGINT"])
def test_the_lock_is_released_however_the_holder_ends(
    ending: str, real_run_locker: PostgresRunLocker, lock_database: str
) -> None:
    """**L3, with a real child process.** A normal return, an exception, Ctrl-C, SIGTERM and **kill
    -9** all free the run with nothing to clean up: the server frees a session lock when the
    connection ends. A killed process that left the run held would block it until somebody
    noticed."""
    run_id = new_run_id()
    mode = ending if ending in {"exit", "raise"} else "hold"
    holder = spawn_child(mode, run_id, lock_database)
    try:
        expect_line(holder, "HELD")
        if mode == "hold":
            refused = acquire_within(real_run_locker, run_id)
            assert isinstance(refused, RunLockHeldError), "it holds the run while it is alive"
            holder.send_signal(getattr(signal, ending))
        holder.wait(timeout=30)

        if ending == "exit":
            assert holder.returncode == 0
        elif ending == "raise":
            assert holder.returncode not in (0, None)
        else:
            assert holder.returncode == -getattr(signal, ending), "it must have been signalled"

        outcome = acquire_until_free(real_run_locker, run_id)
        assert outcome is None, f"the run stayed held after the holder ended by {ending}: {outcome}"
    finally:
        reap(holder)


def test_exactly_one_of_several_racing_processes_gets_the_run(
    real_run_locker: PostgresRunLocker, lock_database: str
) -> None:
    """**The mutual exclusion itself**, between real processes that start at the same time."""
    run_id = new_run_id()
    racers = [spawn_child("try", run_id, lock_database, "4") for _ in range(4)]
    try:
        said = [racer.communicate(timeout=90)[0].strip() for racer in racers]
    finally:
        for racer in racers:
            reap(racer)

    assert sorted(said) == ["HELD", "REFUSED", "REFUSED", "REFUSED"], said


def test_release_all_frees_the_run_for_the_next_process(
    real_run_locker: PostgresRunLocker, hold_elsewhere: ForeignHolders, lock_database: str
) -> None:
    run_id = new_run_id()
    real_run_locker.acquire(run_id, command="narrate")
    # Kept here, so that only an explicit close can free the run: a connection nobody refers to any
    # more closes itself when it is collected, and would hide a `release_all` that did nothing.
    connection = real_run_locker._held[run_id].connection
    assert not run_is_free(lock_database, run_id)

    real_run_locker.release_all()

    assert connection.closed, "release_all closes the connections that hold the locks"
    assert run_is_free(lock_database, run_id)
    with pytest.raises(RunLockNotHeldError):
        real_run_locker.require_held(run_id)
    hold_elsewhere.hold(run_id)
    assert isinstance(acquire_within(real_run_locker, run_id), RunLockHeldError)


# ============================================================== per run, and the same process


def test_two_runs_are_held_at_once_and_neither_blocks_the_other(
    real_run_locker: PostgresRunLocker, hold_elsewhere: ForeignHolders, lock_database: str
) -> None:
    """**L4.** The lock is per run: one process can spend on two runs, and a second process on a
    third is not held up by either."""
    first, second, third = new_run_id(), new_run_id(), new_run_id()

    assert acquire_within(real_run_locker, first) is None
    assert acquire_within(real_run_locker, second) is None
    real_run_locker.require_held(first)
    real_run_locker.require_held(second)

    assert not run_is_free(lock_database, first) and not run_is_free(lock_database, second)
    assert run_is_free(lock_database, third)
    hold_elsewhere.hold(third)
    assert isinstance(acquire_within(real_run_locker, third), RunLockHeldError)
    real_run_locker.require_held(first)  # the other run's holder changes nothing here


def test_taking_the_lock_again_in_the_same_process_is_not_refused(
    real_run_locker: PostgresRunLocker, lock_database: str
) -> None:
    """**L3, re-entry.** A command that opens the same run twice must not refuse itself — the
    command takes it first and `open_run_for_models` takes it again — and the second taking is not
    a second connection."""
    run_id = new_run_id()

    real_run_locker.acquire(run_id, command="narrate")
    real_run_locker.acquire(run_id, command="narrate")
    run_lock.acquire(run_id, command="narrate")  # through the module's own door, as a command does

    real_run_locker.require_held(run_id)
    assert sessions_named(lock_database, f"zoomout-pipeline narrate {run_id}") == 1


def test_the_key_is_the_same_in_every_process_and_different_for_every_run(
    lock_database: str,
) -> None:
    """**L4's key.** A hash that is the same in every process: two processes that took locks on
    different keys would never meet, and Python's own `hash()` is salted per process."""
    run_id = new_run_id()
    child = spawn_child("key", run_id, lock_database)
    try:
        said = child.communicate(timeout=90)[0].strip().splitlines()
    finally:
        reap(child)

    assert int(said[-1]) == lock_key(run_id)
    assert lock_key("ikigai") == lock_key("ikigai")
    assert lock_key("ikigai") != lock_key("ikigai-2") != lock_key("ikigai-3")
    assert -(2**63) <= lock_key(run_id) < 2**63, "a Postgres bigint"


def test_a_refused_process_leaves_no_connection_behind(
    real_run_locker: PostgresRunLocker, hold_elsewhere: ForeignHolders, lock_database: str
) -> None:
    run_id = new_run_id()
    hold_elsewhere.hold(run_id)
    before = sessions_named(lock_database, "zoomout-pipeline")

    assert isinstance(acquire_within(real_run_locker, run_id), RunLockHeldError)

    assert sessions_named(lock_database, "zoomout-pipeline") == before
    with pytest.raises(RunLockNotHeldError):
        real_run_locker.require_held(run_id)


# ================================================================================== a lost lock


def test_the_lock_connection_keeps_itself_alive(
    lock_database: str, hold_elsewhere: ForeignHolders
) -> None:
    """**L6's keepalives**, on both ends: libpq's own, so a dead server is noticed in seconds, and
    the server's, so a vanished client is freed in about a minute. And the server's idle-session
    timeout is switched off for this connection, which is idle by design between ledger writes: the
    database here is told to drop sessions idle for a minute, as a server configured to might."""
    run_id = new_run_id()
    locker = PostgresRunLocker(f"{lock_database}?options=-c%20idle_session_timeout%3D60000")
    try:
        locker.acquire(run_id, command="narrate")
        connection = locker._held[run_id].connection

        client = connection.info.get_parameters()
        assert client["keepalives_idle"] == "15"
        assert client["keepalives_interval"] == "5"
        assert client["keepalives_count"] == "3"
        assert client["tcp_user_timeout"] == "20000"
        assert client["connect_timeout"] == "5"
        assert client["application_name"] == f"zoomout-pipeline narrate {run_id} pid {os.getpid()}"
        assert "idle_session_timeout=60000" in client["options"].replace(" ", ""), "premise"

        for setting, expected in {
            "tcp_keepalives_idle": "15",
            "tcp_keepalives_interval": "5",
            "tcp_keepalives_count": "3",
            "idle_session_timeout": "0",
        }.items():
            row = connection.execute(f"SHOW {setting}").fetchone()
            assert row is not None and row[setting] == expected, setting
    finally:
        locker.release_all()


def test_a_lock_connection_that_dies_is_noticed_and_stays_lost(
    real_run_locker: PostgresRunLocker, lock_database: str
) -> None:
    """**L6.** The lock's connection dies while the process lives (a restart, a network drop, an
    operator's `pg_terminate_backend`). The next `require_held` says so, and a lock this process
    has lost stays lost: asking again, or taking it again, does not bring it back."""
    run_id = new_run_id()
    real_run_locker.acquire(run_id, command="narrate")
    real_run_locker.require_held(run_id)  # fine while the connection lives

    with psycopg.connect(lock_database, autocommit=True) as admin:
        pid = backend_pid_named(lock_database, application_name("narrate", run_id, os.getpid()))
        admin.execute("SELECT pg_terminate_backend(%s)", (pid,))

    lost = until_lost(real_run_locker, run_id)

    assert lost.run_id == run_id and lost.reason
    with pytest.raises(RunLockLostError) as again:
        real_run_locker.require_held(run_id)
    with pytest.raises(RunLockLostError) as retaken:
        real_run_locker.acquire(run_id, command="narrate")
    # Lost once is lost with the reason it was lost for: the closed connection would raise on its
    # own, with a different message, if nothing remembered.
    assert again.value.reason == lost.reason == retaken.value.reason
    assert run_is_free(lock_database, run_id), "and the server freed the run when it ended it"


@pytest.mark.filterwarnings("ignore:This process .* is multi-threaded:DeprecationWarning")
def test_a_forked_child_never_lets_go_of_its_parents_lock(
    real_run_locker: PostgresRunLocker, lock_database: str
) -> None:
    """The connection's socket is shared with a forked child, and closing it from the child would
    send the server a goodbye on the parent's behalf. `release_all` closes only what its own process
    took."""
    run_id = new_run_id()
    real_run_locker.acquire(run_id, command="narrate")

    child = os.fork()
    if child == 0:  # pragma: no cover - runs in the child, which must leave without cleaning up
        try:
            real_run_locker.release_all()
        finally:
            os._exit(0)
    _, status = os.waitpid(child, 0)

    assert os.waitstatus_to_exitcode(status) == 0
    real_run_locker.require_held(run_id)
    assert not run_is_free(lock_database, run_id), "the parent still holds the run"


def test_a_connection_that_is_alive_but_no_longer_holds_the_lock_is_noticed(
    real_run_locker: PostgresRunLocker,
) -> None:
    """The check asks the server what the connection holds; it does not just ask whether it is up.
    A connection that answers, and no longer holds the lock, is as lost as one that is gone."""
    run_id = new_run_id()
    real_run_locker.acquire(run_id, command="narrate")
    real_run_locker._held[run_id].connection.execute("SELECT pg_advisory_unlock_all()")

    with pytest.raises(RunLockLostError, match="no longer lists this lock"):
        real_run_locker.require_held(run_id)


def test_a_run_written_without_its_lock_is_a_defect_and_not_a_refusal(
    real_run_locker: PostgresRunLocker,
) -> None:
    with pytest.raises(RunLockNotHeldError, match="hold_run"):
        real_run_locker.require_held(new_run_id())


# ============================================================================ taking it can fail


def test_a_database_that_cannot_be_reached_is_a_typed_error() -> None:
    """Nothing is started that cannot take its lock: no lock, no spend."""
    locker = PostgresRunLocker("postgresql://postgres:postgres@127.0.0.1:1/postgres")

    with pytest.raises(RunLockUnavailableError, match="Nothing was started"):
        locker.acquire(new_run_id(), command="narrate")


def test_the_lock_database_is_checked_to_be_the_pipelines_own(
    lock_database: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The lock connection is a connection to a database like any other: it is refused where the
    backend's or Payload's tables are, and it leaves nothing open when it is."""
    seen: list[object] = []

    def refuse(connection: object) -> None:
        seen.append(connection)
        raise ForeignDatabaseError("Database 'somebody-else' contains Payload's tables")

    monkeypatch.setattr(run_lock, "assert_pipeline_database", refuse)
    run_id = new_run_id()

    with pytest.raises(ForeignDatabaseError):
        PostgresRunLocker(lock_database).acquire(run_id, command="narrate")

    assert len(seen) == 1
    assert sessions_named(lock_database, f"zoomout-pipeline narrate {run_id}") == 0
    assert advisory_locks(lock_database) == []


# ======================================================================== what it says, in words


def _holder(name: str) -> Holder:
    return Holder(
        backend_pid=5190,
        application_name=name,
        since=datetime(2026, 10, 3, 16, 8, 27, tzinfo=UTC),
        held_for=timedelta(minutes=12, seconds=4),
    )


def test_the_refusal_names_the_run_the_holder_and_both_ways_out() -> None:
    text = RunLockHeldError(
        "ikigai", _holder("zoomout-pipeline narrate ikigai pid 41233")
    ).describe()

    assert text.startswith("RUN 'ikigai' IS HELD BY ANOTHER PROCESS")
    assert "refused before anything was read, built, called or written" in text
    assert "holder : zoomout-pipeline narrate ikigai pid 41233" in text
    assert "Postgres backend 5190, holding it for 12 min 4 s" in text
    assert "wait for it to finish" in text
    assert '"kill 41233"' in text
    assert "select pg_terminate_backend(5190);" in text
    assert "no --force and no --wait" in text


def test_a_holder_that_could_not_be_found_says_so_and_offers_no_kill() -> None:
    text = RunLockHeldError("ikigai", None).describe()

    assert "holder : not found" in text and "Run this again" in text
    assert "kill" not in text and "pg_terminate_backend" not in text
    assert "no --force and no --wait" in text


@pytest.mark.parametrize(
    ("held_for", "said"),
    [
        (timedelta(seconds=37), "holding it for 37 s"),
        (timedelta(minutes=12, seconds=4), "holding it for 12 min 4 s"),
        (timedelta(hours=2, minutes=5, seconds=9), "holding it for 2 h 5 min"),
    ],
)
def test_the_time_it_has_been_held_reads_naturally(held_for: timedelta, said: str) -> None:
    holder = Holder(5190, "zoomout-pipeline narrate x pid 1", datetime.now(UTC), held_for)

    assert said in RunLockHeldError("x", holder).describe()


def test_a_lost_lock_says_what_was_not_recorded() -> None:
    lost = RunLockLostError("ikigai", "OperationalError: server closed the connection")

    text = lost.describe(unrecorded_usd=0.0123)

    assert text.startswith("THE RUN LOCK WAS LOST")
    assert "OperationalError: server closed the connection" in text
    assert "Not recorded: $0.0123." in text
    assert "cost --run-id ikigai" in text
    assert "Not recorded" not in lost.describe(), "no figure when nothing is owed"


def test_the_holder_is_named_by_command_run_and_pid() -> None:
    assert (
        application_name("narrate", "ikigai", 41233) == "zoomout-pipeline narrate ikigai pid 41233"
    )
    assert application_name("", "ikigai", 7) == "zoomout-pipeline ikigai pid 7"


def test_a_long_run_id_is_shortened_and_the_pid_is_kept_whole() -> None:
    name = application_name("audition-voices", "r" * 80, 41233)

    assert len(name.encode()) <= 63, "Postgres would truncate it silently otherwise"
    assert name.startswith("zoomout-pipeline audition-voices r") and name.endswith(" pid 41233")
    assert "~" in name


def test_a_run_id_in_a_wide_script_is_never_cut_through_a_character() -> None:
    name = application_name("narrate", "é" * 60, 7)

    assert len(name.encode()) <= 63
    assert "�" not in name
    assert name.encode().decode() == name
