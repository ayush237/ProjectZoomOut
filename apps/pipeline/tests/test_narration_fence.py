"""ONBOARD-2.1 Part A — the legal fence around what the voice may say, pinned further.

`LEGAL.md`, "Narration": the voice narrates ZoomOut's own prose and nothing else. Exactly two
things reach it — a `NarrationLine` built from a Leaf's four fields by `narration_script`, and a
`NarratorGreeting` built by `greeting_for` from the closed `NARRATOR_GREETINGS`. **A source
quote is never narrated.** `test_narration_selection.py` and `test_greetings.py` fence those two
doors; this file closes what they could not see. **These pins may be strengthened and never
loosened, and no test that already existed was touched to add them.**

The structural pins are AST scans over all of `src/`. Each is checked twice:

* against **the real tree**, where it must find exactly the doors and nothing else; and
* against **synthetic source** (`test_the_scanner_sees_...`), where it must find each bypass
  shape it exists for. A pin that is green on the real tree proves nothing until it has been
  seen red, so the shapes are kept here rather than only tried once by hand.

What a static test cannot see, and this file does not claim to: `getattr(client, "_call")` and
any other dynamic access; an alias (`NL = NarrationLine`, `import ... as`) called afterwards;
`replace(x, **fields)`; and a `NarrationLine` whose text was replaced *at runtime*, where there
is no closed list to compare against (a greeting has one, and is checked at its door below).
"""

from __future__ import annotations

import ast
from collections.abc import Callable, Iterator, Mapping
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from zoomout_pipeline.assets.greeting import NARRATOR_GREETINGS, NarratorGreeting, greeting_for
from zoomout_pipeline.assets.narration import NARRATOR_VOICES, speakable
from zoomout_pipeline.assets.speech import SpeechError, SpeechFenceError
from zoomout_pipeline.models import NarratorId

from .narration_fakes import FakeSpeechBackend, speech_client

SOURCE_ROOT = Path(__file__).resolve().parent.parent / "src"

# The two places a synthesis request may be built from. `_call` takes raw text and is private
# by its underscore alone, so *nothing else* may reach it.
THE_TWO_DOORS = [
    "zoomout_pipeline/assets/speech.py:synthesize",
    "zoomout_pipeline/assets/speech.py:synthesize_greeting",
]
NARRATION_LINE_BUILDER = "zoomout_pipeline/assets/narration.py:narration_script"
NARRATOR_GREETING_BUILDER = "zoomout_pipeline/assets/greeting.py:greeting_for"

QUOTE = "a verbatim sentence lifted out of the book"


# --------------------------------------------------------------------------------- scanner


def _read_tree(root: Path) -> dict[str, str]:
    return {
        str(path.relative_to(root)): path.read_text(encoding="utf-8")
        for path in sorted(root.rglob("*.py"))
    }


def _with_scope(node: ast.AST, scope: str = "<module>") -> Iterator[tuple[ast.AST, str]]:
    """Every descendant of `node` with the innermost function or class it sits in, or
    `<module>` at the top level — the two places the old pins looked past."""
    for child in ast.iter_child_nodes(node):
        yield child, scope
        if isinstance(child, ast.FunctionDef | ast.AsyncFunctionDef):
            yield from _with_scope(child, child.name)
        elif isinstance(child, ast.ClassDef):
            yield from _with_scope(child, f"<class {child.name}>")
        else:
            yield from _with_scope(child, scope)


def _sites(sources: Mapping[str, str], matches: Callable[[ast.AST], bool]) -> list[str]:
    """`path:scope` for every node `matches`, sorted, duplicates kept — a door that reached
    `_call` twice is a different fact from one that reached it once."""
    return sorted(
        f"{path}:{scope}"
        for path, source in sources.items()
        for node, scope in _with_scope(ast.parse(source))
        if matches(node)
    )


def _is_named(func: ast.expr, name: str) -> bool:
    """`name(...)`, or `anything.name(...)` — a bare call *and* a module-qualified one."""
    return (isinstance(func, ast.Name) and func.id == name) or (
        isinstance(func, ast.Attribute) and func.attr == name
    )


def _reaches_private_call(node: ast.AST) -> bool:
    """Any *reference* to `_call`, on any receiver — not only a call, so `f = client._call`
    followed by `f(...)` is seen too. `_call_with_retry` is a different name and not matched."""
    return (isinstance(node, ast.Attribute) and node.attr == "_call") or (
        isinstance(node, ast.Name) and node.id == "_call"
    )


def _constructs(type_name: str) -> Callable[[ast.AST], bool]:
    return lambda node: isinstance(node, ast.Call) and _is_named(node.func, type_name)


def _replaces_text(node: ast.AST) -> bool:
    """`replace(x, text=...)` or `dataclasses.replace(x, text=...)`. **The `text` keyword is
    what is flagged, not `replace`** — it is legitimate on other dataclasses (`cli.py` uses
    `replace(clip, voice=label)`) and `str.replace` takes no keywords at all."""
    return (
        isinstance(node, ast.Call)
        and _is_named(node.func, "replace")
        and any(keyword.arg == "text" for keyword in node.keywords)
    )


# ================================================================ the real tree (Tier A)


def test_the_private_synthesis_call_is_reached_only_from_the_two_doors() -> None:
    """**A1.** `SpeechClient._call(text, voice, ...)` takes raw text. Before ONBOARD-2 the TTS
    call was inlined in `synthesize`, typed to a `NarrationLine`, so no raw-text function
    existed to misuse; now one does, and a scratch module calling it with a source quote left
    every fence test green. If this fails: something new can put arbitrary text in the voice's
    mouth. That is a `LEGAL.md` entry first, not an allowlist edit here."""
    assert _sites(_read_tree(SOURCE_ROOT), _reaches_private_call) == THE_TWO_DOORS


@pytest.mark.parametrize(
    ("type_name", "builder"),
    [
        ("NarrationLine", NARRATION_LINE_BUILDER),
        ("NarratorGreeting", NARRATOR_GREETING_BUILDER),
    ],
)
def test_a_line_is_constructed_in_one_place_in_whatever_shape(type_name: str, builder: str) -> None:
    """**A2.** The single-construction tests beside these see only a *bare-name* call *inside a
    function body*. This one also sees a module-qualified constructor (`narration.NarrationLine(
    ...)`) and a construction at module level — the shapes a reasonable change would take."""
    assert _sites(_read_tree(SOURCE_ROOT), _constructs(type_name)) == [builder]


def test_no_line_or_greeting_has_its_text_replaced_anywhere() -> None:
    """**A2.** `dataclasses.replace(greeting, text=quote)` builds a `NarratorGreeting` without
    calling its constructor, so no construction pin can see it. `NarrationLine` has the same
    `text` field and the same gap. Nothing in `src/` sets `text` through `replace`, and an
    allowlist is not kept for a use that does not exist: if a legitimate one appears, add it by
    name here and say why."""
    assert _sites(_read_tree(SOURCE_ROOT), _replaces_text) == []


# ================================================== the scanner itself, on synthetic source
#
# Each source below is a bypass, written the way a reasonable change would write it.

_BYPASS_SITE = "zoomout_pipeline/scratch.py"


@pytest.mark.parametrize(
    ("source", "scope"),
    [
        (
            "from zoomout_pipeline.assets.speech import SpeechClient\n"
            "def read_it(client: SpeechClient, quote: str) -> None:\n"
            "    client._call(text=quote, prompt='', voice='Achernar', label='x', context={})\n",
            "read_it",
        ),
        (
            "from zoomout_pipeline.assets.speech import SpeechClient\n"
            "def read_it(client: SpeechClient, quote: str) -> None:\n"
            "    SpeechClient._call(client, text=quote)\n",
            "read_it",
        ),
        (
            "def read_it(client, quote):\n    speak = client._call\n    speak(text=quote)\n",
            "read_it",
        ),
        ("client._call(text='q')\n", "<module>"),
        (
            "class Helper:\n    def go(self, quote):\n        return self.client._call(text=quote)",
            "go",
        ),
    ],
    ids=["another-function", "unbound", "aliased-then-called", "module-level", "method"],
)
def test_the_scanner_sees_a_private_call_from_anywhere_else(source: str, scope: str) -> None:
    assert _sites({_BYPASS_SITE: source}, _reaches_private_call) == [f"{_BYPASS_SITE}:{scope}"]


def test_the_scanner_does_not_mistake_another_call_for_the_private_one() -> None:
    """A different function that shares a prefix (`llm/client.py` has `_call_with_retry`) is
    not the door, and a pin that flagged it would be noise somebody allowlists away."""
    source = "def go(client):\n    return client._call_with_retry(1)\n"

    assert _sites({_BYPASS_SITE: source}, _reaches_private_call) == []


@pytest.mark.parametrize("type_name", ["NarrationLine", "NarratorGreeting"])
@pytest.mark.parametrize(
    ("template", "scope"),
    [
        ("def build(q):\n    return {t}(text=q)\n", "build"),
        ("import zoomout_pipeline.assets as assets\nx = assets.{t}(text='q')\n", "<module>"),
        (
            "from zoomout_pipeline.assets import narration\n"
            "def build(q):\n    return narration.{t}(text=q)\n",
            "build",
        ),
        ("LINE = {t}(text='q')\n", "<module>"),
        ("class Holder:\n    LINE = {t}(text='q')\n", "<class Holder>"),
    ],
    ids=[
        "bare-in-function",
        "module-qualified-at-module-level",
        "module-qualified-in-function",
        "module-level",
        "class-level",
    ],
)
def test_the_scanner_sees_a_construction_in_every_shape(
    type_name: str, template: str, scope: str
) -> None:
    source = template.format(t=type_name)

    assert _sites({_BYPASS_SITE: source}, _constructs(type_name)) == [f"{_BYPASS_SITE}:{scope}"]


@pytest.mark.parametrize(
    "source",
    [
        "from dataclasses import replace\ndef f(g, q):\n    return replace(g, text=q)\n",
        "import dataclasses\ndef f(g, q):\n    return dataclasses.replace(g, text=q)\n",
        "import dataclasses\nX = dataclasses.replace(GREETING, text='q')\n",
    ],
    ids=["bare", "module-qualified", "module-level"],
)
def test_the_scanner_sees_a_text_replacement(source: str) -> None:
    assert len(_sites({_BYPASS_SITE: source}, _replaces_text)) == 1


@pytest.mark.parametrize(
    "source",
    [
        "from dataclasses import replace\ndef f(c, label):\n    return replace(c, voice=label)\n",
        "def f(s):\n    return s.replace('a', 'b')\n",
        "def f(s):\n    return s.replace('a', 'b', count=1)\n",
    ],
    ids=["another-field", "str-replace", "str-replace-count"],
)
def test_the_scanner_leaves_a_legitimate_replace_alone(source: str) -> None:
    """`replace` itself is not the finding — the `text` keyword is."""
    assert _sites({_BYPASS_SITE: source}, _replaces_text) == []


# ======================================================= the greeting door, at runtime (Tier A)


def _refuse_to_build_a_request(*_args: Any, **_kwargs: Any) -> Any:
    raise AssertionError("a synthesis request was built for a greeting the door should refuse")


@pytest.mark.parametrize("narrator", list(NarratorId))
def test_the_fixed_greetings_speak_exactly_as_before(narrator: NarratorId) -> None:
    """The refusal must not touch what is allowed: each real greeting still reaches the voice
    as its own sentence, in its own voice."""
    backend = FakeSpeechBackend()

    speech_client(backend).synthesize_greeting(greeting_for(narrator), prompt="Be warm.")

    (request,) = backend.requests
    assert request.input.text == speakable(NARRATOR_GREETINGS[narrator])
    assert request.voice.name == NARRATOR_VOICES[narrator]


def _off_list_greetings() -> dict[str, NarratorGreeting]:
    """Greetings whose words are not the closed constant, each built the way a bypass would."""
    female = greeting_for(NarratorId.FEMALE)
    tampered = greeting_for(NarratorId.FEMALE)
    object.__setattr__(tampered, "text", QUOTE)  # dynamic: no static pin can see this

    class OverridesWhatIsSent(NarratorGreeting):
        """Its stored `text` is the real sentence; what it *sends* is not."""

        @property
        def spoken(self) -> str:
            return QUOTE

    return {
        "a-source-quote": replace(female, text=QUOTE),
        "the-other-narrators-sentence": replace(female, text=NARRATOR_GREETINGS[NarratorId.MALE]),
        "the-sentence-with-a-word-added": replace(female, text=female.text + " Also, " + QUOTE),
        # Speaks identically (`speakable` collapses whitespace), so only the stored `text` can
        # tell it from the closed constant.
        "the-sentence-with-different-spacing": replace(female, text=female.text + "  "),
        "set-on-a-frozen-instance": tampered,
        "a-subclass-that-sends-other-words": OverridesWhatIsSent(
            narrator=NarratorId.FEMALE, text=NARRATOR_GREETINGS[NarratorId.FEMALE]
        ),
    }


@pytest.mark.parametrize("case", list(_off_list_greetings()))
def test_a_greeting_that_is_not_the_fixed_sentence_is_refused_before_any_request_is_built(
    case: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """**A3.** The refusal is at the door, and it is checked against `NARRATOR_GREETINGS`, the
    closed list — the one place a greeting *can* be compared with what it must say, which a
    Leaf's line cannot be. The fake backend records zero requests, and the request type itself
    is booby-trapped, so this fails if anything is built before the refusal and not only if
    something is sent."""
    from google.cloud import texttospeech

    monkeypatch.setattr(texttospeech, "SynthesizeSpeechRequest", _refuse_to_build_a_request)
    backend = FakeSpeechBackend()

    with pytest.raises(SpeechFenceError, match="not the fixed greeting"):
        speech_client(backend).synthesize_greeting(_off_list_greetings()[case], prompt="Be warm.")

    assert backend.requests == []


def test_the_refusal_names_the_narrator_and_never_repeats_the_words() -> None:
    """A source quote in an error message is a source quote in a log. Say who, not what."""
    tampered = replace(greeting_for(NarratorId.FEMALE), text=QUOTE)

    with pytest.raises(SpeechFenceError) as raised:
        speech_client(FakeSpeechBackend()).synthesize_greeting(tampered, prompt="Be warm.")

    assert "female" in str(raised.value)
    assert QUOTE not in str(raised.value)


def test_a_refused_greeting_is_a_speech_error_so_every_caller_stops_on_it() -> None:
    """`_render_attempt` and the command already stop on a `SpeechError`; the refusal is one,
    with no billed attempts, so the ledger is not charged for a call that was never made."""
    tampered = replace(greeting_for(NarratorId.MALE), text=QUOTE)

    with pytest.raises(SpeechError) as raised:
        speech_client(FakeSpeechBackend()).synthesize_greeting(tampered, prompt="Be warm.")

    assert isinstance(raised.value, SpeechFenceError)
    assert raised.value.possibly_billed == 0
