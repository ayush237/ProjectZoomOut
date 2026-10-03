"""LEDGER-1 — what the commands do with the run lock. Tier A.

`test_run_lock.py` is what the lock is. This is the other half of "a lock that is real in the tests
and absent in a command": every command is sorted by what it does to a run, and each group carries
the pins that make the sorting true.

* **Spenders** open a run for models, create one or write its checkpoint. Each takes the lock as its
  first act, before it builds a client or reads the ledger. Pinned in the source (order, once, not
  inside a branch, under its own registered name) **and** by behaviour: with a real second session
  holding the run, each is refused at once, exit 2, and every client, every graph and every write is
  made to explode if it is so much as reached.
* **Readers** read a run and write nothing to it. None touches the lock, and each works while a
  spender holds the run: `narration-stale` above all, because it is what you run while one is going.
* **The rest** have no run id at all.

A command on none of the lists fails `test_every_command_is_sorted_into_exactly_one_group`, which is
the point: the author of the next command has to decide, and the decision comes with its pins.
"""

from __future__ import annotations

import ast
import inspect
import re
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import NoReturn
from uuid import uuid4

import pytest
import typer
from typer.testing import CliRunner

from zoomout_pipeline import cli
from zoomout_pipeline.config import PipelineSettings
from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.db import run_lock
from zoomout_pipeline.db.run_lock import PostgresRunLocker, RunLockLostError, RunLockNotHeldError
from zoomout_pipeline.graph.narration_nodes import NARRATION_NODE
from zoomout_pipeline.graph.state import PipelineState
from zoomout_pipeline.models import Acquisition

from .run_lock_fakes import InProcessRunLocker
from .run_lock_support import ForeignHolders, advisory_locks, new_run_id, until_lost
from .test_narration_stale import Cms, a_book, run_stale

# --------------------------------------------------------------------------- the three groups

# Opens a run for models, creates a run, or writes a run's checkpoint: takes the lock.
RUN_SPENDERS = frozenset(
    {
        "run",
        "resume",
        "measure-breakdown",
        "write-drafts",
        "generate-assets",
        "review-track",
        "rewrite-leaf",
        "balance-distractors",
        "audition-voices",
        "narrate",
    }
)

# Reads a run's checkpoint and writes nothing to it: never takes the lock. `purge-raw-text` also
# deletes the *book's* raw-text rows (R6), which are not the ledger, and never writes the run.
RUN_READERS = frozenset({"status", "cost", "narration-stale", "purge-raw-text"})

# Takes no run id, so there is no run for it to open. `generate-covers` and `generate-greetings`
# spend, but against a ceiling of their own and not against a run's ledger: a different race, with
# nothing to key a lock on (see the report).
OPENS_NO_RUN = frozenset(
    {
        "doctor",
        "init-db",
        "attach-scenario-images",
        "check-variety",
        "contact-sheet",
        "generate-covers",
        "generate-greetings",
    }
)

# What a refused command must never reach. The lock comes before every one of these.
BEHIND_THE_LOCK = frozenset(
    {
        "run_context",
        "build_dependencies",
        "read_run_state",
        "open_run_for_models",
        "open_run_for_narration",
        "_Narration",
        "require_paid_tier",
        "get_settings",
        "write_run_state",
        "RunLedger",
        "PayloadClient",
        "ImageClient",
        "SpeechClient",
    }
)

# What a command that does not spend on a run must never name.
LOCK_AND_WRITE_NAMES = frozenset(
    {
        "hold_run",
        "open_run_for_models",
        "open_run_for_narration",
        "_Narration",
        "write_run_state",
        "RunLedger",
        "update_state",
    }
)

SOURCE = inspect.getsource(cli)
TREE = ast.parse(SOURCE)
README = (Path(__file__).resolve().parent.parent / "README.md").read_text(encoding="utf-8")


def _commands() -> dict[str, Callable[..., object]]:
    """Every registered command, by the name it is invoked under."""
    found: dict[str, Callable[..., object]] = {}
    for info in cli.app.registered_commands:
        assert info.callback is not None
        found[info.name or info.callback.__name__.replace("_", "-")] = info.callback
    return found


def _function(name: str) -> ast.FunctionDef:
    return next(
        node for node in ast.walk(TREE) if isinstance(node, ast.FunctionDef) and node.name == name
    )


def _call_name(call: ast.Call) -> str:
    target = call.func
    if isinstance(target, ast.Name):
        return target.id
    if isinstance(target, ast.Attribute):
        return target.attr
    return ""


def _calls(node: ast.AST) -> list[ast.Call]:
    return sorted(
        (child for child in ast.walk(node) if isinstance(child, ast.Call)),
        key=lambda call: (call.lineno, call.col_offset),
    )


def _names(node: ast.AST) -> set[str]:
    return {n.id for n in ast.walk(node) if isinstance(n, ast.Name)} | {
        n.attr for n in ast.walk(node) if isinstance(n, ast.Attribute)
    }


def _position(call: ast.Call) -> tuple[int, int]:
    return call.lineno, call.col_offset


# ================================================================================ the sorting


def test_every_command_is_sorted_into_exactly_one_group() -> None:
    """**L5.** A new command that is on none of the lists fails here, so its author has to decide
    whether it spends on a run (takes the lock), only reads one (never takes it), or opens none —
    and the group it is put in carries the pins below."""
    registered = set(_commands())
    groups = [RUN_SPENDERS, RUN_READERS, OPENS_NO_RUN]
    sorted_ones = set().union(*groups)

    assert sum(len(group) for group in groups) == len(sorted_ones), "a command is in two groups"
    assert not registered - sorted_ones, (
        f"{sorted(registered - sorted_ones)} is registered and in no group. Decide whether it "
        "spends on a run, only reads one, or opens none, add it to that group in this file and "
        "give it the arguments its group's tests need."
    )
    assert not sorted_ones - registered, f"{sorted(sorted_ones - registered)} is not a command"


def test_a_command_takes_a_run_id_exactly_when_it_is_about_a_run() -> None:
    """The sorting's own check: a command with a run id is a spender or a reader, and one without
    cannot open a run, so there is nothing for it to lock."""
    for name, callback in _commands().items():
        takes_one = "run_id" in inspect.signature(callback).parameters
        assert takes_one == (name in RUN_SPENDERS | RUN_READERS), name


# ===================================================================== the pins on each group


@pytest.mark.parametrize("command", sorted(RUN_SPENDERS))
def test_a_spending_command_takes_its_runs_lock_first(command: str) -> None:
    """In the source: once, as a statement of its own (never inside a branch), under the name the
    command is registered as, and before the first thing that builds a client or reads the
    ledger."""
    function = _function(_commands()[command].__name__)
    calls = _calls(function)

    holds = [call for call in calls if _call_name(call) == "hold_run"]
    assert len(holds) == 1, f"{command} must call hold_run exactly once"
    hold = holds[0]
    assert any(
        isinstance(statement, ast.Expr) and statement.value is hold for statement in function.body
    ), f"{command}: hold_run is inside a branch, so it can be skipped"

    (run_id,) = hold.args
    assert isinstance(run_id, ast.Name) and run_id.id in {"run_id", "resolved_run_id"}
    named = {keyword.arg: keyword.value for keyword in hold.keywords}
    label = named.get("command")
    assert isinstance(label, ast.Constant) and label.value == command, (
        f"{command} must name itself as it is registered, so a refused process can say who holds it"
    )

    for later in calls:
        if _call_name(later) in BEHIND_THE_LOCK:
            assert _position(hold) < _position(later), (
                f"{command}: {_call_name(later)} (line {later.lineno}) comes before the lock "
                f"(line {hold.lineno})"
            )


@pytest.mark.parametrize("command", sorted(RUN_READERS | OPENS_NO_RUN))
def test_a_command_that_only_reads_or_opens_no_run_never_takes_the_lock_or_writes_a_run(
    command: str,
) -> None:
    """**L4.** `narration-stale` above all: it is what you run while a `narrate` is going."""
    function = _function(_commands()[command].__name__)

    assert _names(function) & LOCK_AND_WRITE_NAMES == set()


def test_no_command_writes_a_checkpoint_outside_the_one_door() -> None:
    """**L5, the structural pin** in the pattern of
    `test_no_command_loads_a_checkpoint_outside_the_two_helpers`: reading goes through two helpers,
    writing goes through one, and that one asks the lock first. So "no command writes a ledger
    unlocked" is a fact about `cli.py`, and a command added next year cannot forget."""
    functions = [n for n in ast.walk(TREE) if isinstance(n, ast.FunctionDef)]
    sites = [call for call in _calls(TREE) if _call_name(call) == "update_state"]

    owners = {
        min(
            (f for f in functions if f.lineno <= site.lineno <= (f.end_lineno or f.lineno)),
            key=lambda f: site.lineno - f.lineno,
        ).name
        for site in sites
    }
    assert owners == {"write_run_state"}, owners
    assert len(sites) == 1


def test_the_one_door_asks_the_lock_before_it_writes() -> None:
    door = _calls(_function("write_run_state"))
    asked = next(call for call in door if _call_name(call) == "require_held")
    wrote = next(call for call in door if _call_name(call) == "update_state")

    assert _position(asked) < _position(wrote)


def test_the_helper_takes_the_lock_before_it_reads_the_checkpoint() -> None:
    """**L2, in the source.** A process that read `cost`, waited, and then acquired would write the
    holder's spend over with its own stale copy."""
    helper = _calls(_function("open_run_for_models"))
    hold = next(call for call in helper if _call_name(call) == "hold_run")
    read = next(call for call in helper if _call_name(call) == "read_run_state")

    assert _position(hold) < _position(read)


def test_the_ledger_and_the_narration_session_write_through_the_door() -> None:
    ledger = _names(_function("write"))
    checkpoint = _names(_function("checkpoint"))

    assert "write_run_state" in ledger
    assert "write" in checkpoint and not checkpoint & {"update_state", "write_run_state"}


# ============================================================ L2, L7(iv): refused, for real


SPENDER_ARGS: dict[str, list[str]] = {
    "run": [
        "--source",
        "book.epub",
        "--acquisition",
        Acquisition.PUBLIC_DOMAIN.value,
        "--run-id",
        "{run}",
    ],
    "resume": ["--run-id", "{run}"],
    "measure-breakdown": ["--run-id", "{run}", "--model", "a-model"],
    "write-drafts": ["--run-id", "{run}"],
    "generate-assets": ["--run-id", "{run}"],
    "review-track": ["--run-id", "{run}"],
    "rewrite-leaf": ["--run-id", "{run}", "--order", "1", "--brief", "no-such-brief.yaml"],
    "balance-distractors": ["--run-id", "{run}"],
    "audition-voices": ["--run-id", "{run}", "--voice", "Sulafat", "--line", "1:summary"],
    "narrate": ["--run-id", "{run}"],
}


def _explode_everything(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Everything a refused command must never reach, made to fail if it is so much as called —
    every client, the graph, the checkpoint and every write — and the list of what was reached."""
    reached: list[str] = []

    def exploder(name: str) -> Callable[..., NoReturn]:
        def explode(*_args: object, **_kwargs: object) -> NoReturn:
            reached.append(name)
            raise AssertionError(f"a refused command reached {name}")

        return explode

    for name in (
        "run_context",
        "read_run_state",
        "open_run_for_models",
        "open_run_for_narration",
        "_Narration",
        "require_paid_tier",
        "write_run_state",
        "RunLedger",
    ):
        monkeypatch.setattr(cli, name, exploder(f"cli.{name}"))
    for target in (
        "zoomout_pipeline.runner.build_dependencies",
        "zoomout_pipeline.runner.durable_graph",
        "zoomout_pipeline.llm.client.GeminiClient.from_settings",
        "zoomout_pipeline.cms.client.PayloadClient",
        "zoomout_pipeline.assets.speech.SpeechClient",
        "zoomout_pipeline.assets.images.ImageClient",
        "zoomout_pipeline.assets.images.AnchorSet.load",
        "zoomout_pipeline.assets.budget.NarrationBudget",
        "zoomout_pipeline.assets.budget.ImageBudget",
        "zoomout_pipeline.graph.narration_nodes.Guard",
    ):
        monkeypatch.setattr(target, exploder(target))
    return reached


def test_every_spender_has_arguments_here() -> None:
    assert set(SPENDER_ARGS) == RUN_SPENDERS


@pytest.mark.parametrize("command", sorted(RUN_SPENDERS))
def test_a_spending_command_is_refused_at_once_while_another_process_holds_its_run(
    command: str,
    real_run_locker: PostgresRunLocker,
    hold_elsewhere: ForeignHolders,
    lock_database: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """**L1, L7(iv).** A real second session holds the run. Each spending command is refused — red,
    exit 2, naming the run and who holds it — and **nothing is built, read, called or written**:
    every client, every graph and every write is an exploder, and none was reached."""
    run_id = new_run_id()
    hold_elsewhere.hold(run_id, name=f"zoomout-pipeline narrate {run_id} pid 4242")
    reached = _explode_everything(monkeypatch)

    result = CliRunner().invoke(
        cli.app, [command, *(arg.replace("{run}", run_id) for arg in SPENDER_ARGS[command])]
    )

    assert result.exit_code == 2, result.output
    assert result.exception is None or isinstance(result.exception, SystemExit), result.exception
    assert reached == []
    out = result.output
    assert "HELD BY ANOTHER PROCESS" in out and run_id in out
    assert f"zoomout-pipeline narrate {run_id} pid 4242" in out and '"kill 4242"' in out
    assert len(advisory_locks(lock_database)) == 1, "only the holder's lock: the refused took none"


# =================================================================== L4: reads are free


class _Spy:
    """The real locker, and a record of every time anything asked it anything."""

    def __init__(self, inner: PostgresRunLocker) -> None:
        self.inner = inner
        self.calls: list[str] = []

    def acquire(self, run_id: str, *, command: str) -> None:
        self.calls.append(f"acquire {run_id}")
        self.inner.acquire(run_id, command=command)

    def require_held(self, run_id: str) -> None:
        self.calls.append(f"require_held {run_id}")
        self.inner.require_held(run_id)

    def release_all(self) -> None:
        self.inner.release_all()


class _ReadGraph:
    def get_state(self, _config: object) -> SimpleNamespace:
        return SimpleNamespace(values={"loaded": True}, next=(), tasks=())

    def update_state(self, *_args: object, **_kwargs: object) -> None:
        raise AssertionError("a reader wrote to the run")


def _state() -> PipelineState:
    return PipelineState(run_id="x", source_path="book.epub", acquisition=Acquisition.PUBLIC_DOMAIN)


def _hold_the_run(
    run_id: str,
    real_run_locker: PostgresRunLocker,
    hold_elsewhere: ForeignHolders,
    monkeypatch: pytest.MonkeyPatch,
) -> _Spy:
    hold_elsewhere.hold(run_id, name=f"zoomout-pipeline narrate {run_id} pid 4242")
    spy = _Spy(real_run_locker)
    monkeypatch.setattr(run_lock, "_active", spy)
    return spy


def _read_only(monkeypatch: pytest.MonkeyPatch, state: object) -> None:
    @contextmanager
    def fake_run_context() -> Iterator[tuple[_ReadGraph, None]]:
        yield _ReadGraph(), None

    monkeypatch.setattr(cli, "run_context", fake_run_context)
    monkeypatch.setattr(cli, "read_run_state", lambda _graph, _run_id: state)


@pytest.mark.parametrize("command", ["status", "cost"])
def test_status_and_cost_work_while_a_spender_holds_the_run(
    command: str,
    real_run_locker: PostgresRunLocker,
    hold_elsewhere: ForeignHolders,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_id = new_run_id()
    spy = _hold_the_run(run_id, real_run_locker, hold_elsewhere, monkeypatch)
    _read_only(monkeypatch, _state())

    result = CliRunner().invoke(cli.app, [command, "--run-id", run_id])

    assert result.exit_code == 0, result.output
    assert "cost (USD)" in result.output and "HELD BY" not in result.output
    assert spy.calls == [], "a reader never asks the lock anything"


def test_narration_stale_works_while_a_narrate_holds_the_run(
    real_run_locker: PostgresRunLocker,
    hold_elsewhere: ForeignHolders,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """**The one that matters**: the check you run while a `narrate` is going. The whole stale
    check, against Leaf 9's real shape, with the run held by another session — not blocked, still
    saying what is stale, and it never asked the lock."""
    spy = _hold_the_run("ikigai", real_run_locker, hold_elsewhere, monkeypatch)

    result = run_stale(monkeypatch, Cms(*a_book()))

    assert result.exit_code == 1, result.output
    assert "leaf  9  payoff    female live" in result.output and "HELD BY" not in result.output
    assert spy.calls == []


def test_purge_raw_text_works_while_a_spender_holds_the_run(
    real_run_locker: PostgresRunLocker,
    hold_elsewhere: ForeignHolders,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_id = new_run_id()
    spy = _hold_the_run(run_id, real_run_locker, hold_elsewhere, monkeypatch)
    state = _state().model_copy(update={"book_id": str(uuid4())})
    _read_only(monkeypatch, state)

    class Repository:
        def __init__(self, _conn: object) -> None:
            pass

        def purge_raw_text(self, _book: object) -> SimpleNamespace:
            return SimpleNamespace(
                raw_text_rows_deleted=3,
                chunk_texts_cleared=2,
                embeddings_retained=2,
                cited_passages_retained=1,
            )

    @contextmanager
    def fake_connect() -> Iterator[None]:
        yield None

    monkeypatch.setattr(cli, "BookRepository", Repository)
    monkeypatch.setattr(cli, "connect", fake_connect)

    result = CliRunner().invoke(cli.app, ["purge-raw-text", "--run-id", run_id])

    assert result.exit_code == 0, result.output
    assert "raw text rows deleted : 3" in result.output
    assert spy.calls == []


# ============================================================ L2: the helper, behaviourally


@pytest.fixture
def paid_settings(settings: PipelineSettings, monkeypatch: pytest.MonkeyPatch) -> PipelineSettings:
    monkeypatch.setattr(cli, "get_settings", lambda: settings)
    return settings


def test_open_run_for_models_takes_the_lock_before_it_reads_the_checkpoint(
    paid_settings: PipelineSettings, monkeypatch: pytest.MonkeyPatch
) -> None:
    """**L2, behaviourally.** The order of what happens to a run, as it happens."""
    events: list[str] = []

    class Locker(InProcessRunLocker):
        def acquire(self, run_id: str, *, command: str) -> None:
            events.append("lock")
            super().acquire(run_id, command=command)

    class Graph:
        def get_state(self, _config: object) -> SimpleNamespace:
            events.append("read")
            return SimpleNamespace(values=_state())

        def update_state(self, _config: object, _values: dict[str, object]) -> None:
            events.append("write")

    monkeypatch.setattr(run_lock, "_active", Locker())

    cli.open_run_for_models(Graph(), "ikigai")

    assert events == ["lock", "read", "write"]


def test_a_run_held_elsewhere_is_refused_before_its_checkpoint_is_read(
    real_run_locker: PostgresRunLocker,
    hold_elsewhere: ForeignHolders,
    paid_settings: PipelineSettings,
) -> None:
    """The helper alone, for a caller that never took the lock first: refused, and the ledger it
    would have read is untouched."""
    run_id = new_run_id()
    hold_elsewhere.hold(run_id)

    class Graph:
        def get_state(self, _config: object) -> NoReturn:
            raise AssertionError("the checkpoint was read before the lock was won")

        def update_state(self, *_args: object) -> NoReturn:
            raise AssertionError("the run was written without its lock")

    with pytest.raises(typer.Exit) as refused:
        cli.open_run_for_models(Graph(), run_id)

    assert refused.value.exit_code == 2


# ======================================================== L6: a lost lock stops the writing


class _LostLocker(InProcessRunLocker):
    """A locker whose lock has gone: every question about it says so."""

    def require_held(self, run_id: str) -> None:
        raise RunLockLostError(run_id, "OperationalError: the connection is gone")


class _WriteGraph:
    def __init__(self) -> None:
        self.writes: list[dict[str, object]] = []

    def update_state(self, _config: object, values: dict[str, object]) -> None:
        self.writes.append(values)


def _spend(output_tokens: int = 500) -> TokenSpend:
    return TokenSpend(
        node=NARRATION_NODE, model="gemini-2.5-flash-tts", output_tokens=output_tokens
    )


def test_a_write_by_a_process_that_lost_its_lock_stops_and_writes_nothing(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    graph = _WriteGraph()
    monkeypatch.setattr(run_lock, "_active", _LostLocker())

    with pytest.raises(typer.Exit) as stopped:
        cli.write_run_state(graph, "ikigai", {"cost": RunCost()}, unrecorded_usd=0.05)

    assert stopped.value.exit_code == 1
    assert graph.writes == []
    out = capsys.readouterr().out
    assert "THE RUN LOCK WAS LOST" in out and "Not recorded: $0.0500" in out


def test_the_ledger_says_what_it_could_not_record_and_adds_up_across_attempts(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Each entry is worth $0.0050 (500 audio tokens at the TTS rate). The first write goes through;
    the lock is lost; the next two stop and the second says what both were worth."""
    graph = _WriteGraph()
    ledger = cli.RunLedger(graph, "ikigai", RunCost())
    monkeypatch.setattr(run_lock, "_active", InProcessRunLocker())
    ledger.record(_spend())
    assert len(graph.writes) == 1

    monkeypatch.setattr(run_lock, "_active", _LostLocker())
    with pytest.raises(typer.Exit):
        ledger.record(_spend())
    assert "Not recorded: $0.0050" in capsys.readouterr().out
    with pytest.raises(typer.Exit):
        ledger.record(_spend())
    assert "Not recorded: $0.0100" in capsys.readouterr().out

    assert len(graph.writes) == 1, "nothing was written after the lock was lost"


def test_the_narration_session_checkpoints_through_the_ledger_and_so_through_the_door(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`_Narration.checkpoint` is the other ledger write on the voiceover path (L6 names both)."""
    graph = _WriteGraph()
    session = object.__new__(cli._Narration)
    session.ledger = cli.RunLedger(graph, "ikigai", RunCost())
    monkeypatch.setattr(run_lock, "_active", InProcessRunLocker())

    session.checkpoint(cms_narration={"4": {"verified": True}})
    assert graph.writes[-1]["cms_narration"] == {"4": {"verified": True}}
    assert isinstance(graph.writes[-1]["cost"], RunCost)

    monkeypatch.setattr(run_lock, "_active", _LostLocker())
    with pytest.raises(typer.Exit) as stopped:
        session.checkpoint(cms_narration={"5": {}})

    assert stopped.value.exit_code == 1 and len(graph.writes) == 1
    assert "THE RUN LOCK WAS LOST" in capsys.readouterr().out


def test_a_write_to_a_run_that_was_never_locked_is_a_defect_and_writes_nothing(
    real_run_locker: PostgresRunLocker,
) -> None:
    """Not a stop with a message: a command that writes a run it never locked is a bug, and it fails
    loudly instead of writing a ledger nothing protects."""
    graph = _WriteGraph()

    with pytest.raises(RunLockNotHeldError):
        cli.write_run_state(graph, new_run_id(), {"cost": RunCost()})

    assert graph.writes == []


def test_a_lock_that_really_died_stops_the_ledger_before_it_writes(
    real_run_locker: PostgresRunLocker, lock_database: str
) -> None:
    """**L6 end to end**: the real lock, its real connection terminated by the server, and the real
    door. Detection is `test_run_lock.py`; what this adds is that the door turns it into a stop."""
    import os

    import psycopg

    from .run_lock_support import backend_pid_named

    run_id = new_run_id()
    cli.hold_run(run_id, command="narrate")
    graph = _WriteGraph()
    ledger = cli.RunLedger(graph, run_id, RunCost())
    ledger.record(_spend())
    assert len(graph.writes) == 1

    with psycopg.connect(lock_database, autocommit=True) as admin:
        admin.execute(
            "SELECT pg_terminate_backend(%s)",
            (
                backend_pid_named(
                    lock_database, run_lock.application_name("narrate", run_id, os.getpid())
                ),
            ),
        )
    until_lost(real_run_locker, run_id)

    with pytest.raises(typer.Exit) as stopped:
        ledger.record(_spend())

    assert stopped.value.exit_code == 1
    assert len(graph.writes) == 1


def test_a_run_that_cannot_be_locked_because_the_database_is_down_stops_cleanly(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    locker = PostgresRunLocker("postgresql://postgres:postgres@127.0.0.1:1/postgres")
    monkeypatch.setattr(run_lock, "_active", locker)

    with pytest.raises(typer.Exit) as stopped:
        cli.hold_run("ikigai", command="narrate")

    assert stopped.value.exit_code == 1
    assert "could not be taken" in capsys.readouterr().out


# ================================================================================== L9: the README


def test_the_readme_says_what_is_true_about_the_lock() -> None:
    """The sentence that used to be the whole guard is gone, and the section that replaces it names
    every command on each side, the refusal's exit code, the absence of an override and the way out
    for a holder the server has not noticed is dead."""
    assert not re.search(r"one\s+`?narrate`?\s+at\s+a\s+time", README, re.IGNORECASE)
    assert "A second `narrate` on the same run is refused" in README

    section = README.split("## One spender per run", 1)[1].split("\n## ", 1)[0]
    for command in sorted(RUN_SPENDERS | RUN_READERS):
        assert f"`{command}`" in section, f"the section does not say what it does for {command}"
    flat = section.replace("**", "")
    assert "no `--force` and no `--wait`" in flat
    assert "exits with code 2" in flat
    assert "select pg_terminate_backend(" in section
    assert "kill -9" in section and "never leaves a run held" in flat
    assert "generate-covers" in section and "generate-greetings" in section
