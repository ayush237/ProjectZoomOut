"""VO-4 Part 4 — `narrate` end to end, as far as it can go without Payload. Tier B.

ONBOARD-2.1 recorded that nothing ran the command beyond its help text (Tier C). VO-4 changes what
the command does when a clip is missing and what pace it renders at, so the pieces of that which
are the *command's* — the header, the hold, the review's note, the default that reaches the render —
are pinned here, with a session stub and nothing else stubbed: the render, the budget, the store
and the review writer are the real ones, over a real (fake-backed) speech client and a real cache.

VO-4.1 reversed one of them: a clip not on disk used to stop the run and now holds its Leaf on its
own (`test_narrate_hold.py` pins that across several Leaves). The single-Leaf test below is the one
existing test that changed with it.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from typer.testing import CliRunner

from zoomout_pipeline import cli
from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.narration import NARRATOR_VOICES, direction_for, narration_script
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph.narration_nodes import NARRATION_TEMPO, ClipStore, render_line

from .narration_fakes import FakeSpeechBackend, leaf_doc, leaked_window, speech_client

BOOK = "Ikigai"


class _ExplodingBackend(FakeSpeechBackend):
    def __init__(self) -> None:
        super().__init__()
        self.calls = 0

    def synthesize_speech(self, *, request: Any, retry: Any, timeout: float) -> Any:
        self.calls += 1
        raise AssertionError("Cloud TTS was called")


class _Session:
    """What `narrate` reads off `_Narration`, over the real render's pieces."""

    def __init__(self, root: Path, backend: FakeSpeechBackend) -> None:
        self.state = SimpleNamespace(cms_narration={}, cms_leaf_ids={"4": 266})
        self.leaves = [leaf_doc()]
        self.speech = speech_client(backend)
        self.store = ClipStore(root)
        self.budget = NarrationBudget(ceiling_usd=3.00)
        self.guard = None
        self.book_title = BOOK
        self.client = None
        self.spends: list[TokenSpend] = []

    def record(self, spend: TokenSpend) -> None:
        self.spends.append(spend)

    def checkpoint(self, **_values: Any) -> None:
        return None


@pytest.fixture
def drive(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Any:
    """`drive(backend, *args)` runs `narrate --run-id ikigai --no-guard --render-only <args>`."""

    def run(backend: FakeSpeechBackend, *args: str) -> tuple[Any, _Session]:
        session = _Session(tmp_path, backend)

        @contextmanager
        def fake_run_context() -> Iterator[tuple[None, None]]:
            yield None, None

        monkeypatch.setattr(cli, "run_context", fake_run_context)
        monkeypatch.setattr(cli, "_Narration", lambda _graph, _deps, _run, *, guard: session)
        result = CliRunner().invoke(
            cli.app,
            ["narrate", "--run-id", "ikigai", "--render-only", "--no-guard", *args],
        )
        return result, session

    return run


def _prime(tmp_path: Path) -> None:
    """Both narrators' four clips for the Leaf, bought from the fake, so a later run has a cache."""
    backend = FakeSpeechBackend()
    for voice in NARRATOR_VOICES.values():
        for line in narration_script(leaf_doc()):
            render_line(
                line=line,
                speech=speech_client(backend),
                voice=voice,
                prompt=direction_for(line.slide),
                store=ClipStore(tmp_path),
                budget=NarrationBudget(ceiling_usd=3.00),
                record=lambda _spend: None,
                guard=None,
                max_attempts=1,
            )
    assert len(backend.requests) == 8


# ======================================================================== the option's range


@pytest.mark.parametrize("tempo", ["0.9", "1.51", "2"])
def test_a_tempo_outside_the_range_is_refused_by_the_command_itself(tempo: str) -> None:
    result = CliRunner().invoke(cli.app, ["narrate", "--run-id", "ikigai", "--tempo", tempo])

    assert result.exit_code == 2
    assert "--tempo" in result.output


# ================================================================================ the hold


def test_a_clip_that_is_not_on_disk_holds_its_leaf_cleanly_and_names_it(drive: Any) -> None:
    """**Rewritten by VO-4.1 (A1); it used to pin "stops the run" and the HALTED line.** The live
    run found this on Leaf 9: no clip for the text it holds now. A run that may not synthesise
    holds that Leaf - named, free, a plain exit code and no traceback - and the words of the Leaf
    are never in what the command prints. `HALTED` is kept for a budget or a speech failure."""
    backend = _ExplodingBackend()
    texts = [line.text for line in narration_script(leaf_doc())]

    result, session = drive(backend, "--no-synthesis")

    assert result.exit_code == 1
    assert "HELD — NOT ON DISK" in result.output and "leaf  4" in result.output
    assert "payoff (female, Achernar)" in result.output
    assert "takeaway (male, Sadaltager)" in result.output
    assert "HALTED" not in result.output, "only a budget or a speech failure stops a run"
    assert result.exception is None or isinstance(result.exception, SystemExit), result.exception
    assert backend.calls == 0
    assert session.budget.spent_usd == 0.0 and session.spends == []
    assert "Traceback" not in result.output
    for text in texts:
        assert leaked_window(text, result.output) is None, "named by slide, never by its words"


# ================================================================ the header, the note, the pace


def test_the_header_and_the_review_say_what_pace_and_what_mode(drive: Any, tmp_path: Path) -> None:
    _prime(tmp_path)

    result, session = drive(_ExplodingBackend(), "--no-synthesis", "--tempo", "1.3")

    assert result.exit_code == 0, result.output
    assert re.search(
        r"^tempo\s+: x1\.3 — --no-synthesis: no clip can be bought$", result.output, re.M
    )
    assert result.output.count("(cached)") == 8
    for voice in NARRATOR_VOICES.values():
        review = (tmp_path / "review" / f"ikigai-narration-{voice.lower()}.md").read_text(
            encoding="utf-8"
        )
        assert "Time-stretched ×1.3" in review
    assert session.spends == [] and session.budget.spent_usd == 0.0


def test_without_no_synthesis_the_header_does_not_claim_it(drive: Any, tmp_path: Path) -> None:
    _prime(tmp_path)

    result, _session = drive(FakeSpeechBackend(), "--tempo", "1.0")

    assert re.search(r"^tempo\s+: x1$", result.output, re.M), result.output
    for voice in NARRATOR_VOICES.values():
        review = (tmp_path / "review" / f"ikigai-narration-{voice.lower()}.md").read_text(
            encoding="utf-8"
        )
        assert "Not stretched" in review and "Time-stretched" not in review


def test_the_default_pace_is_what_actually_reaches_the_render(drive: Any, tmp_path: Path) -> None:
    """**The fifth place, behaviourally.** With no `--tempo` at all, the lengths the command prints
    are those of a clip rendered at `NARRATION_TEMPO` - not at 1.0, and not at whatever the option
    happens to say."""
    _prime(tmp_path)
    line = next(line for line in narration_script(leaf_doc()) if line.slide.value == "payoff")

    def length(tempo: float) -> str:
        clip = render_line(
            line=line,
            speech=speech_client(_ExplodingBackend()),
            voice="Achernar",
            prompt=direction_for(line.slide),
            store=ClipStore(tmp_path),
            budget=NarrationBudget(ceiling_usd=3.00),
            record=lambda _spend: None,
            guard=None,
            max_attempts=1,
            tempo=tempo,
            no_synthesis=True,
        )
        return f"{clip.duration_seconds:>6.1f}s"

    result, _session = drive(_ExplodingBackend(), "--no-synthesis")

    payoff_lines = [
        row for row in result.output.splitlines() if "Achernar" in row and "payoff" in row
    ]
    assert len(payoff_lines) == 1
    assert length(NARRATION_TEMPO) in payoff_lines[0]
    assert length(1.0) not in payoff_lines[0], "not the model's own pace"
