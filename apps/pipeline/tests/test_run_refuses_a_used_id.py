"""LEDGER-1.1 R1-R3 — `run` cannot overwrite a run, on the real checkpointer. Tier A.

**The defect, found by experiment at LEDGER-1's sign-off.** `run` builds a fresh `PipelineState`
and calls `graph.invoke(state, config)` on whatever thread `--run-id` names. On a thread that
exists that does not start a second run; it feeds the fresh state into the first. LangGraph applies
an input field whose value is not `None`, whose default is not, or that the constructor was given
(`model_fields_set`), so the run's `cost` (a `RunCost()`) and its `cms_leaf_ids`, `cms_narration`
and `cms_assets` (empty dicts) are **reset**, and so is `cms_track_id`, which the command passes
explicitly (as `None`). On `ikigai` that is $6.5755 of recorded spend gone, `narration_spent_usd`
back to zero so the $2.75 ceiling reads as unspent, and the links to its Payload Track and eighteen
Leaves cut, with no spend and no error. The lock does not help: one process and one slip (an
up-arrow on an old `run --run-id ikigai ...`) does it alone.

So these are not fakes of the checkpointer: a **real `PostgresSaver`** on the test database,
through the real `durable_graph`, with the repo's fakes (a scripted LLM, a fake embedder, a
refusing CMS) behind it, driven by **the command**. The sequence is the experiment's: run to the
gate, write a spend and the three Payload-linked fields into the checkpoint, run again on the
same id.

* the refusal is exit 2, nothing is invoked and the scripted LLM is never called;
* the checkpoint afterwards is **identical**, its latest checkpoint id included, so nothing was
  written at all;
* a **new** id (and no id at all) still runs to the gate: the risk of a guard like this is one
  that refuses a legitimate first `run`;
* and, separately, the reset itself is pinned as what the command does with its check taken out,
  so the test names the damage and not only the refusal.
"""

from __future__ import annotations

import inspect
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import psycopg
import pytest
import typer.main
from psycopg.rows import dict_row
from typer.testing import CliRunner

from zoomout_pipeline import cli
from zoomout_pipeline.cms.client import PayloadClient
from zoomout_pipeline.config import PipelineSettings
from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.graph.build import durable_graph
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.narration_nodes import narration_spent_usd
from zoomout_pipeline.graph.state import PipelineState
from zoomout_pipeline.models import Acquisition, BookAnalysis

from .conftest import (
    FakeEmbedder,
    RefusingPayloadClient,
    ScriptedLLM,
    leaf_generation_defaults,
    make_plan,
)

ANALYSIS = BookAnalysis(
    central_argument="A test argument.",
    themes=["one", "two"],
    key_concepts=["a", "b"],
    intended_reader="A test reader.",
    structure_notes="Test structure notes.",
)
README = (Path(__file__).resolve().parent.parent / "README.md").read_text(encoding="utf-8")

# Each real ingest of the sample EPUB makes BeautifulSoup say the document looks like XML. The
# ingest is not what these tests are about, and the other tests that ingest carry the same warning.
pytestmark = pytest.mark.filterwarnings(
    "ignore:It looks like you're using an HTML parser to parse an XML document"
)


@dataclass(frozen=True)
class Checkpoint:
    """What a run's saved state holds that `run` must not touch, and which checkpoint holds it."""

    checkpoint_id: str
    cost_entries: list[tuple[str, str, int, int]]
    cost_usd: float
    voiceover_usd: float
    cms_track_id: int | None
    cms_leaf_ids: dict[str, int]
    cms_narration: dict[str, dict[str, Any]]
    cms_assets: dict[str, dict[str, Any]]

    def damage_since(self, earlier: Checkpoint) -> str:
        return (
            f"cost {len(earlier.cost_entries)} entries ${earlier.cost_usd:.4f} -> "
            f"{len(self.cost_entries)} entries ${self.cost_usd:.4f}; voiceover spent "
            f"${earlier.voiceover_usd:.4f} -> ${self.voiceover_usd:.4f}; cms_leaf_ids "
            f"{earlier.cms_leaf_ids} -> {self.cms_leaf_ids}; cms_track_id "
            f"{earlier.cms_track_id} -> {self.cms_track_id}; cms_narration "
            f"{sorted(earlier.cms_narration)} -> {sorted(self.cms_narration)}; cms_assets "
            f"{sorted(earlier.cms_assets)} -> {sorted(self.cms_assets)}; latest checkpoint "
            f"{earlier.checkpoint_id} -> {self.checkpoint_id}"
        )


class Harness:
    """A real checkpointed graph on the test database, the command in front of it."""

    def __init__(self, deps: NodeDependencies, llm: ScriptedLLM, epub: Path) -> None:
        self.deps = deps
        self.llm = llm
        self.epub = epub

    @contextmanager
    def context(self) -> Iterator[tuple[Any, NodeDependencies]]:
        """What `cli.run_context` is: the real `durable_graph`, on the real `PostgresSaver`."""
        with durable_graph(self.deps) as graph:
            yield graph, self.deps

    def run(self, *args: str) -> Any:
        return CliRunner().invoke(
            cli.app,
            ["run", "--source", str(self.epub), "--acquisition", "public-domain", *args],
        )

    def checkpoint(self, run_id: str) -> Checkpoint:
        with self.context() as (graph, _deps):
            snapshot = graph.get_state({"configurable": {"thread_id": run_id}})
        state = PipelineState.model_validate(snapshot.values)
        return Checkpoint(
            checkpoint_id=snapshot.config["configurable"]["checkpoint_id"],
            cost_entries=[
                (e.node, e.model, e.input_tokens, e.output_tokens) for e in state.cost.entries
            ],
            cost_usd=round(state.cost.total_usd, 6),
            voiceover_usd=round(narration_spent_usd(state.cost), 6),
            cms_track_id=state.cms_track_id,
            cms_leaf_ids=dict(state.cms_leaf_ids),
            cms_narration=dict(state.cms_narration),
            cms_assets=dict(state.cms_assets),
        )

    def write_up(self, run_id: str) -> None:
        """What a run that has been narrated carries: four ledger entries and the three fields that
        link it to Payload, written into the checkpoint the way the commands write one: with
        `update_state`."""
        cost = RunCost()
        for node, model, tokens_in, tokens_out in (
            ("narration", "gemini-2.5-flash-tts", 0, 40_000),
            ("narration", "gemini-2.5-flash-tts", 0, 20_000),
            ("narration_guard", "gemini-3.6-flash", 100_000, 20_000),
            ("narration_guard", "gemini-3.6-flash", 60_000, 10_000),
        ):
            cost.record(
                TokenSpend(node=node, model=model, input_tokens=tokens_in, output_tokens=tokens_out)
            )
        with self.context() as (graph, _deps):
            graph.update_state(
                {"configurable": {"thread_id": run_id}},
                {
                    "cost": cost,
                    "cms_track_id": 50,
                    "cms_leaf_ids": {"0": 301, "1": 302},
                    "cms_narration": {"0": {"leaf_id": 301, "verified": True}},
                    "cms_assets": {"0": {"recovered": True}},
                },
            )


@pytest.fixture
def harness(
    settings: PipelineSettings,
    db_connection: psycopg.Connection[dict[str, object]],
    sample_epub: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Harness:
    """The command, on the real checkpointer, with the repo's fakes behind it and nothing else.

    The LLM answers each node from a default, not from a script in order: a run whose analysis
    survived skips `analyze` and asks for its plan first, and a script in order would hand it the
    analysis (which is what happened the first time this was written, and is the reset at work)."""
    llm = ScriptedLLM(
        [],
        defaults={
            **leaf_generation_defaults(),
            "analyze": ANALYSIS,
            "breakdown": make_plan(leaves=22, chapters_per_leaf=3, chapter_count=17),
        },
    )

    @contextmanager
    def connect() -> Iterator[psycopg.Connection[dict[str, object]]]:
        with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
            yield conn

    deps = NodeDependencies(
        settings=settings,
        llm=llm,
        embedder=FakeEmbedder(),
        connect=connect,
        now=lambda: datetime(2026, 10, 4, 12, 0, tzinfo=UTC),
        # Never a real client: see `RefusingPayloadClient`.
        payload_client=cast("PayloadClient", RefusingPayloadClient()),
    )
    built = Harness(deps, llm, sample_epub)
    monkeypatch.setattr(cli, "get_settings", lambda: settings)
    monkeypatch.setattr(cli, "run_context", built.context)
    return built


def _a_run_that_has_been_spent_on(harness: Harness, run_id: str) -> Checkpoint:
    first = harness.run("--run-id", run_id)
    assert first.exit_code == 0 and "PAUSED AT HUMAN GATE 1" in first.output, first.output
    harness.write_up(run_id)
    return harness.checkpoint(run_id)


# ===================================================================================== R1 and R2


def test_run_refuses_an_id_that_already_has_a_checkpoint(harness: Harness) -> None:
    """The up-arrow slip, as the command sees it: exit 2, before anything is invoked, with the way
    on named, and the scripted LLM is never asked anything."""
    before = _a_run_that_has_been_spent_on(harness, "an-existing-run")
    asked = len(harness.llm.calls)
    assert before.voiceover_usd > 0 and len(before.cost_entries) == 4, "the premise"

    again = harness.run("--run-id", "an-existing-run")

    assert again.exit_code == 2, again.output
    assert again.exception is None or isinstance(again.exception, SystemExit), again.exception
    assert "PAUSED AT HUMAN GATE" not in again.output, "the graph was invoked"
    assert len(harness.llm.calls) == asked, "the scripted LLM was never called"
    out = " ".join(again.output.split())
    assert "RUN 'an-existing-run' ALREADY EXISTS" in out
    assert (
        "`run` starts a NEW run" in out and "refused before anything was invoked or written" in out
    )
    assert "would reset its cost ledger" in out
    assert "links to its Payload Track, Leaves, narration and assets" in out
    assert "resume --run-id an-existing-run" in out, "the way to continue it"
    assert "run again with a new --run-id, or none" in out, "the way to start another"
    assert "There is no --force" in out


def test_the_refusal_leaves_the_checkpoint_exactly_as_it_was(harness: Harness) -> None:
    """**Data loss with no spend and no error is the shape of bug that ships quietly**, so what is
    asserted is the saved state itself: the ledger entry by entry and in total, what the voiceover
    ceiling would read, the three Payload-linked fields, and the latest checkpoint's id, so that
    nothing was written at all. If it fails, the message says what was lost."""
    before = _a_run_that_has_been_spent_on(harness, "an-existing-run")

    harness.run("--run-id", "an-existing-run")
    after = harness.checkpoint("an-existing-run")

    assert after == before, "the second run reset the run: " + after.damage_since(before)
    assert after.cms_leaf_ids == {"0": 301, "1": 302}
    assert after.cms_narration == {"0": {"leaf_id": 301, "verified": True}}
    assert after.cms_assets == {"0": {"recovered": True}}
    assert after.voiceover_usd > 0, "the $2.75 ceiling would read as unspent if this were zero"


def test_a_new_id_still_runs_to_the_gate_after_a_refusal(harness: Harness) -> None:
    """The risk of this guard is the one that refuses a legitimate first `run`."""
    _a_run_that_has_been_spent_on(harness, "an-existing-run")
    assert harness.run("--run-id", "an-existing-run").exit_code == 2

    fresh = harness.run("--run-id", "another-run")
    generated = harness.run()

    for result in (fresh, generated):
        assert result.exit_code == 0, result.output
        assert "PAUSED AT HUMAN GATE 1" in result.output
    assert harness.checkpoint("another-run").cost_entries, "it ran, and spent what a run spends"
    assert "ALREADY EXISTS" not in fresh.output + generated.output


def test_without_the_guard_a_second_run_resets_the_ledger_and_cuts_the_payload_links(
    harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    """**Evidence that the guard is for something.** The command with its check taken out, which is
    what `run` did before, and which holds whether or not the guard is in the source: a fresh state
    is invoked on the existing thread. The four ledger entries (two of narration, two of its guard)
    are replaced by the new run's own, the voiceover spend reads zero so the ceiling would read as
    unspent, the three Payload-linked fields are empty, **and so is the Track link**.

    That last one corrects the experiment this was written from, which kept it. LangGraph applies a
    `None` input when the constructor was given it, and the command gives `cms_track_id` (and
    `book_title`, `book_author`) explicitly, as `None`; a state built without that argument leaves
    the field alone, which is the next test."""
    before = _a_run_that_has_been_spent_on(harness, "an-existing-run")
    monkeypatch.setattr(cli, "refuse_a_run_in_use", lambda _graph, _run_id: None)

    again = harness.run("--run-id", "an-existing-run")
    after = harness.checkpoint("an-existing-run")

    assert again.exit_code == 0 and "PAUSED AT HUMAN GATE 1" in again.output, again.output
    assert before.voiceover_usd > 0 and len(before.cost_entries) == 4
    assert after.voiceover_usd == 0.0, "the voiceover ceiling would read as unspent"
    assert not any(node.startswith("narration") for node, *_ in after.cost_entries)
    assert len(after.cost_entries) < len(before.cost_entries), after.damage_since(before)
    assert after.cms_leaf_ids == {} and after.cms_narration == {} and after.cms_assets == {}
    assert after.cms_track_id is None, "the command passes cms_track_id explicitly, as None"


def test_a_state_built_without_the_track_id_leaves_that_link_alone(harness: Harness) -> None:
    """The variant that explains why the handoff's experiment saw the Track link survive:
    `graph.invoke` of a state that was not given `cms_track_id` keeps that link and resets the
    rest, where the command, which gives it, does not. It pins the LangGraph rule the guard rests
    on (a field the constructor was given is applied even as `None`), so an upgrade that changes it
    is noticed."""
    _a_run_that_has_been_spent_on(harness, "an-existing-run")
    fresh = PipelineState(
        run_id="an-existing-run",
        source_path=str(harness.epub),
        acquisition=Acquisition.PUBLIC_DOMAIN,
    )

    with harness.context() as (graph, _deps):
        graph.invoke(fresh, {"configurable": {"thread_id": "an-existing-run"}})
    after = harness.checkpoint("an-existing-run")

    assert after.cms_track_id == 50, "not given, so not applied"
    assert after.voiceover_usd == 0.0 and after.cms_leaf_ids == {}, "everything else is reset"


# ============================================================ the guard itself, without a database


class _Thread:
    def __init__(self, values: dict[str, Any], next_nodes: tuple[str, ...] = ()) -> None:
        self.values = values
        self.next = next_nodes
        self.asked: list[object] = []

    def get_state(self, config: object) -> SimpleNamespace:
        self.asked.append(config)
        return SimpleNamespace(values=self.values, next=self.next)

    def invoke(self, *_args: object, **_kwargs: object) -> None:
        raise AssertionError("the graph was invoked")


def test_a_thread_with_no_checkpoint_is_not_refused() -> None:
    """A first `run`, or one that died before its first checkpoint, has nothing to overwrite."""
    thread = _Thread({})

    cli.refuse_a_run_in_use(thread, "a-first-run")

    assert thread.asked == [{"configurable": {"thread_id": "a-first-run"}}], "it read that thread"


@pytest.mark.parametrize("next_nodes", [("human_gate",), ()], ids=["at a gate", "finished"])
def test_a_thread_with_a_checkpoint_is_refused_whether_it_is_waiting_or_finished(
    next_nodes: tuple[str, ...], capsys: pytest.CaptureFixture[str]
) -> None:
    """A finished run has nothing `next` and is overwritten by a fresh invoke just the same: the
    guard asks whether a checkpoint exists, not whether the run is in progress."""
    with pytest.raises(typer.Exit) as refused:
        cli.refuse_a_run_in_use(_Thread({"run_id": "x"}, next_nodes), "x")

    assert refused.value.exit_code == 2
    assert "ALREADY EXISTS" in capsys.readouterr().out


def test_run_has_no_force_option() -> None:
    group: Any = typer.main.get_command(cli.app)
    params = {param.name for param in group.commands["run"].params}

    assert not {name for name in params if "force" in name.lower()}


def test_the_guard_sits_after_the_lock_and_the_tier_refusal_and_before_the_invoke() -> None:
    """Where, and why: after the lock, so no other process can write the thread between the read and
    the invoke; after the paid-tier refusal, which is free and needs no database; and last, because
    it needs the graph and the graph only exists inside `run_context()`."""
    body = inspect.getsource(cli.run)

    order = [
        body.index(marker)
        for marker in (
            "hold_run(",
            "require_paid_tier(",
            "with run_context()",
            "refuse_a_run_in_use(",
            "graph.invoke(",
        )
    ]
    assert order == sorted(order), order


# ================================================================================ R3 — the README


def test_the_readme_says_run_starts_a_new_run_and_refuses_an_id_in_use() -> None:
    flat = " ".join(README.replace("*", "").split())

    assert (
        "`run` always starts a new run, and refuses a `--run-id` that already has a checkpoint"
        in flat
    )
    assert "resume --run-id <id>` continues one" in flat
