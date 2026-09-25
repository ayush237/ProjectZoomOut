"""ONBOARD-2.1 Part D — how many attempts a clip gets **by default**, pinned where it is stated.

The founder ruled on 2026-09-18, and again on 2026-09-22, that `narrate` defaults to three
attempts: one difficult line holds a whole Leaf and costs founder attention plus a re-run, which
is dearer than a third render and listen. It stayed at two because **nothing pinned the default**:
every existing test passes `max_attempts` explicitly, so a recorded ruling could go unimplemented
with the suite green.

The number lives in four places that must not drift apart — the library constant, the library
function's default, the command's option, and the README — and the greeting library is a fifth,
which stays at two on its own constant. An ear-driven job on a small cap: a third paid attempt is
the founder's decision, not a default.
"""

from __future__ import annotations

import ast
import inspect
import re
from pathlib import Path
from typing import Any

import pytest
import typer.main
from typer.testing import CliRunner

from zoomout_pipeline import cli
from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.greeting import greeting_direction, greeting_for
from zoomout_pipeline.assets.narration import direction_for, narration_script
from zoomout_pipeline.assets.narration_guard import GUARD_NODE, NarrationEnding, NarrationReading
from zoomout_pipeline.graph import greeting_nodes
from zoomout_pipeline.graph.greeting_nodes import (
    GREETING_CEILING_USD,
    MAX_GREETING_ATTEMPTS,
    render_greeting,
    run_greetings,
)
from zoomout_pipeline.graph.narration_nodes import (
    MAX_NARRATION_ATTEMPTS,
    ClipStore,
    Guard,
    render_line,
)
from zoomout_pipeline.models import NarratorId

from .conftest import ScriptedLLM
from .narration_fakes import SENTINEL, FakeSpeechBackend, leaf_doc, speech_client

MODEL = "gemini-3.6-flash"
PIPELINE_ROOT = Path(__file__).resolve().parent.parent


def _never_passes() -> ScriptedLLM:
    """A listener that always hears something else, so every attempt fails and none is enough."""
    return ScriptedLLM(
        [],
        defaults={
            GUARD_NODE: NarrationReading(transcript="nothing like it", ending=NarrationEnding.CLEAN)
        },
    )


def _option(command: str, name: str) -> Any:
    """The command's real option object, as the parser holds it. Untyped on purpose: which click
    Typer builds on is Typer's business (0.27 vendors its own), and the option's `default` and
    `type.min/max` are the same either way."""
    group: Any = typer.main.get_command(cli.app)
    (found,) = [param for param in group.commands[command].params if param.name == name]
    return found


def _signature_default(function: Any, name: str) -> Any:
    return inspect.signature(function).parameters[name].default


# ================================================================ the ruled numbers (Tier A)


def test_narration_is_ruled_at_three_attempts_and_greetings_at_two() -> None:
    """Asserted exactly. If this fails because a number moved: `narrate`'s is the founder's ruling
    of 2026-09-18 and 2026-09-22, and the greeting library's is a decision about paid attempts on
    an ear-driven job. Neither is an edit to make quietly."""
    assert MAX_NARRATION_ATTEMPTS == 3
    assert MAX_GREETING_ATTEMPTS == 2


def test_the_greeting_library_no_longer_borrows_the_narration_constant() -> None:
    """Raising `MAX_NARRATION_ATTEMPTS` used to move the greeting library with it, silently,
    while `generate-greetings --max-attempts` stayed a literal 2."""
    assert not hasattr(greeting_nodes, "MAX_NARRATION_ATTEMPTS")


# ============================================================ every place the default is stated


def test_the_narrate_option_defaults_to_the_library_constant() -> None:
    """The option is a literal, not an import: the command imports the narration modules lazily,
    inside itself, so that `zoomout-pipeline --help` does not load numpy and the audio stack. A
    literal can drift, so this is what stops it doing so unnoticed."""
    option = _option("narrate", "max_attempts")

    assert option.default == MAX_NARRATION_ATTEMPTS


def test_the_generate_greetings_option_defaults_to_the_greeting_constant() -> None:
    assert _option("generate-greetings", "max_attempts").default == MAX_GREETING_ATTEMPTS


@pytest.mark.parametrize("command", ["narrate", "generate-greetings"])
def test_the_option_still_admits_its_own_default(command: str) -> None:
    """`min=1, max=3` is unchanged; a default outside it would be refused on every bare run."""
    option = _option(command, "max_attempts")

    assert type(option.type).__name__ == "IntRange"
    assert (option.type.min, option.type.max) == (1, 3)
    assert isinstance(option.default, int) and 1 <= option.default <= 3


@pytest.mark.parametrize(
    ("function", "constant"),
    [
        (render_line, MAX_NARRATION_ATTEMPTS),
        (render_greeting, MAX_GREETING_ATTEMPTS),
        (run_greetings, MAX_GREETING_ATTEMPTS),
    ],
    ids=["render_line", "render_greeting", "run_greetings"],
)
def test_each_library_function_defaults_to_its_own_constant(function: Any, constant: int) -> None:
    assert _signature_default(function, "max_attempts") == constant


def test_the_commands_pass_the_option_through_to_the_library() -> None:
    """A default that never reaches the render is a default in name only."""
    tree = ast.parse((PIPELINE_ROOT / "src/zoomout_pipeline/cli.py").read_text(encoding="utf-8"))
    passed: dict[str, list[str]] = {"narrate": [], "generate_greetings": []}
    for function in ast.walk(tree):
        if not isinstance(function, ast.FunctionDef) or function.name not in passed:
            continue
        for node in ast.walk(function):
            if not isinstance(node, ast.Call):
                continue
            for keyword in node.keywords:
                if keyword.arg == "max_attempts" and isinstance(keyword.value, ast.Name):
                    passed[function.name].append(f"{_callee(node)}={keyword.value.id}")

    assert passed == {
        "narrate": ["render_line=max_attempts"],
        "generate_greetings": ["run_greetings=max_attempts"],
    }


def _callee(call: ast.Call) -> str:
    return call.func.id if isinstance(call.func, ast.Name) else ast.unparse(call.func)


@pytest.mark.parametrize(("command", "default"), [("narrate", 3), ("generate-greetings", 2)])
def test_the_help_shows_the_default_a_bare_run_will_use(command: str, default: int) -> None:
    helped = CliRunner().invoke(cli.app, [command, "--help"])

    assert helped.exit_code == 0
    assert re.search(rf"default:\s*{default}\b", helped.output), helped.output


def test_the_readme_states_the_default_the_code_has() -> None:
    """The prose said "default 2" for as long as the code did, and would have been false the
    moment the code moved. Every stated default is checked, not just the one that was there."""
    readme = (PIPELINE_ROOT / "README.md").read_text(encoding="utf-8")

    stated = re.findall(r"`--max-attempts`[^)]*?default\s+(\d+)", readme, flags=re.DOTALL)
    assert stated == [str(MAX_NARRATION_ATTEMPTS)]
    assert not re.search(r"default\s+2\b", readme)


# ============================================================ by default, what actually happens


def test_a_clip_that_never_passes_is_attempted_three_times_by_default(tmp_path: Path) -> None:
    """**By default**: no `max_attempts` is passed. Each attempt is a render and a listen, so
    this is also the money effect — one more of each than before, and the ceiling still bounds
    it."""
    line = next(iter(narration_script(leaf_doc())))
    backend = FakeSpeechBackend()
    llm = _never_passes()

    clip = render_line(
        line=line,
        speech=speech_client(backend),
        voice="Achernar",
        prompt="Warm.",
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=100.0),
        record=lambda _spend: None,
        guard=Guard(llm=llm, model=MODEL),
    )

    assert len(backend.requests) == 3 and len(llm.calls) == 3
    assert clip.attempts_made == 3 and not clip.passed, "kept, named, and still bounded"


def test_a_greeting_that_never_passes_is_attempted_twice_by_default(tmp_path: Path) -> None:
    backend = FakeSpeechBackend()
    llm = _never_passes()

    clip = render_greeting(
        greeting=greeting_for(NarratorId.FEMALE),
        speech=speech_client(backend),
        prompt=greeting_direction(),
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=GREETING_CEILING_USD),
        record=lambda _spend: None,
        guard=Guard(llm=llm, model=MODEL),
    )

    assert len(backend.requests) == 2 and len(llm.calls) == 2
    assert clip.attempts_made == 2 and not clip.passed


def test_both_greetings_are_attempted_twice_each_by_default_through_run_greetings(
    tmp_path: Path,
) -> None:
    """The whole library path, as `generate-greetings` runs it: two narrators, two attempts each,
    and nothing uploaded because nothing passed."""
    backend = FakeSpeechBackend()

    result = run_greetings(
        speech=speech_client(backend),
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=GREETING_CEILING_USD),
        record=lambda _narrator, _spend: None,
        guard=Guard(llm=_never_passes(), model=MODEL),
        client=None,
    )

    assert len(backend.requests) == 4
    assert [clip.attempts_made for clip in result.rendered] == [2, 2]


def test_no_quote_reaches_cloud_tts_on_any_default_attempt(tmp_path: Path) -> None:
    """**The legal fence, through the extra attempt.** The sentinel test in
    `test_narration_selection.py` sends a marker through every field that must stay silent,
    regeneration included, and now names two attempts because it counts them. A second attempt
    is a second chance to reach the wrong field, and so is a third: this is the same walk at the
    default, every attempt of every line."""
    backend = FakeSpeechBackend()
    doc = leaf_doc(sentinel=SENTINEL)

    for line in narration_script(doc):
        render_line(
            line=line,
            speech=speech_client(backend),
            voice="Sulafat",
            prompt=direction_for(line.slide),
            store=ClipStore(tmp_path),
            budget=NarrationBudget(ceiling_usd=100.0),
            record=lambda _spend: None,
            guard=Guard(llm=_never_passes(), model=MODEL),
        )

    assert len(backend.requests) == 4 * MAX_NARRATION_ATTEMPTS, "four lines, every attempt"
    for request in backend.requests:
        assert SENTINEL not in request.input.text and SENTINEL not in request.input.prompt
        assert "verbatim words from the book" not in request.input.text
