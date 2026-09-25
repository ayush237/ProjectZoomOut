"""VO-4 Part 4 — the pace `narrate` defaults to, **pinned everywhere it is stated**.

The founder ruled on 2026-09-25 that the book narration plays 30% faster than the model returned
it, after the device gate found it "too slow and boring" beside the narrator hellos. A number that
a ruling set and that lives in five places is exactly what ONBOARD-2.1 found going unimplemented
with a green suite (`narrate --max-attempts` stayed at two), so each place is checked against the
others here, the way `test_attempt_defaults.py` does it for the attempts:

1. the constant, `NARRATION_TEMPO`;
2. the option's literal (`cli.py` imports the narration stack lazily, so it cannot import the
   constant, and a literal can drift);
3. `narrate`'s docstring;
4. the README;
5. the value `narrate` passes down to the render.

`render_line`'s own default is **1.0, deliberately different**: only the command the founder runs
is faster, and the audition and every other caller keep the model's pace. That is pinned too, and
pinned to *differ*, so the two cannot be "fixed" into agreement.
"""

from __future__ import annotations

import ast
import inspect
import re
from pathlib import Path
from typing import Any

import typer.main
from typer.testing import CliRunner

from zoomout_pipeline import cli
from zoomout_pipeline.assets.audio import MAX_TEMPO, MIN_TEMPO
from zoomout_pipeline.graph import greeting_nodes
from zoomout_pipeline.graph.narration_nodes import (
    NARRATION_TEMPO,
    _render_attempt,
    render_line,
)

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
_STATED = re.compile(r"--tempo`?\s*\(default\s+(\d+(?:\.\d+)?)")


def _option(command: str, name: str) -> Any:
    group: Any = typer.main.get_command(cli.app)
    (found,) = [param for param in group.commands[command].params if param.name == name]
    return found


def _default(function: Any, name: str) -> Any:
    return inspect.signature(function).parameters[name].default


def _keywords_passed(function_name: str, keyword: str) -> list[str]:
    """`callee=value` for every call inside `function_name` that passes `keyword=<anything>`.

    Any expression, not only a bare name: a hardcoded `tempo=1.3` slipped into the audition is
    exactly the drift this exists to see, and a name-only scan would walk straight past it."""
    tree = ast.parse((PIPELINE_ROOT / "src/zoomout_pipeline/cli.py").read_text(encoding="utf-8"))
    found: list[str] = []
    for function in ast.walk(tree):
        if not isinstance(function, ast.FunctionDef) or function.name != function_name:
            continue
        for node in ast.walk(function):
            if not isinstance(node, ast.Call):
                continue
            for arg in node.keywords:
                if arg.arg == keyword:
                    found.append(f"{ast.unparse(node.func)}={ast.unparse(arg.value)}")
    return found


# ================================================================ 1. the constant, and its range


def test_the_narration_tempo_is_ruled_at_one_point_three() -> None:
    """Asserted exactly. If this fails because the number moved: it is the founder's ruling of
    2026-09-25 (a founder's-ear number, not a derived one: matching the hellos would be about 1.5x,
    where a stretch starts to sound processed), and not an edit to make quietly."""
    assert NARRATION_TEMPO == 1.3


def test_the_range_the_stretch_accepts_is_one_to_one_and_a_half() -> None:
    assert (MIN_TEMPO, MAX_TEMPO) == (1.0, 1.5)
    assert MIN_TEMPO <= NARRATION_TEMPO <= MAX_TEMPO


# ============================================================ 2. the option's literal


def test_the_narrate_option_defaults_to_the_library_constant() -> None:
    """The option is a literal, because the command imports the narration modules lazily so that
    `--help` does not load numpy and the audio stack. A literal can drift; this stops it doing so
    unnoticed."""
    assert _option("narrate", "tempo").default == NARRATION_TEMPO


def test_the_option_range_is_the_librarys_and_admits_its_own_default() -> None:
    option = _option("narrate", "tempo")

    assert type(option.type).__name__ == "FloatRange"
    assert (option.type.min, option.type.max) == (MIN_TEMPO, MAX_TEMPO)
    assert MIN_TEMPO <= option.default <= MAX_TEMPO, "a default outside it is refused on every run"


def test_the_help_shows_the_default_a_bare_run_will_use() -> None:
    helped = CliRunner().invoke(cli.app, ["narrate", "--help"])

    assert helped.exit_code == 0
    assert "--tempo" in helped.output and "--no-synthesis" in helped.output
    assert re.search(r"default:\s*1\.3\b", helped.output), helped.output


def test_no_synthesis_is_off_by_default() -> None:
    """A run that cannot spend is opt-in: `narrate` at its bare defaults still buys what is
    missing, which is what every existing run relies on."""
    assert _option("narrate", "no_synthesis").default is False


# ============================================================ 3. narrate's docstring


def test_narrates_docstring_states_the_default_the_code_has() -> None:
    stated = _STATED.findall(inspect.getdoc(cli.narrate) or "")

    assert stated == [f"{NARRATION_TEMPO:g}"]


# ================================================================== 4. the README


def test_the_readme_states_the_default_the_code_has() -> None:
    """Every stated default is checked, not just the first."""
    readme = (PIPELINE_ROOT / "README.md").read_text(encoding="utf-8")

    stated = _STATED.findall(readme)
    assert stated, "the README says nothing about the default it is meant to state"
    assert set(stated) == {f"{NARRATION_TEMPO:g}"}, stated


# ================================================================= 5. what narrate passes down


def test_the_command_passes_the_option_and_the_switch_through_to_the_render() -> None:
    """A default that never reaches the render is a default in name only."""
    assert _keywords_passed("narrate", "tempo") == ["render_line=tempo"]
    assert _keywords_passed("narrate", "no_synthesis") == ["render_line=no_synthesis"]


def test_the_audition_keeps_the_models_pace_and_may_still_buy() -> None:
    """`audition-voices` is a measurement of how each voice behaves; it stays as it was."""
    assert _keywords_passed("audition_voices", "tempo") == []
    assert _keywords_passed("audition_voices", "no_synthesis") == []


# ==================================================================== the deliberate difference


def test_render_lines_own_default_is_the_models_pace_and_deliberately_not_the_ruled_one() -> None:
    assert _default(render_line, "tempo") == 1.0
    assert _default(render_line, "tempo") != NARRATION_TEMPO, (
        "every other caller keeps the pace it always had; only `narrate` is faster"
    )
    assert _default(render_line, "no_synthesis") is False


def test_the_render_attempt_must_be_told_its_tempo_and_whether_it_may_buy() -> None:
    """Explicit, so a future caller cannot inherit a default it never chose."""
    parameters = inspect.signature(_render_attempt).parameters

    assert parameters["tempo"].default is inspect.Parameter.empty
    assert parameters["no_synthesis"].default is inspect.Parameter.empty


def test_the_greeting_library_has_no_tempo_to_set() -> None:
    """The narrator hellos were re-paced by ONBOARD-2 and are the reference the lessons are being
    brought toward. Nothing in VO-4 may move them: their bytes are checked by hash in the completion
    report, and here they cannot be given a tempo at all."""
    for function in (greeting_nodes.render_greeting, greeting_nodes.run_greetings):
        assert "tempo" not in inspect.signature(function).parameters
        assert "no_synthesis" not in inspect.signature(function).parameters
