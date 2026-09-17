"""Tier A — voiceover reads ZoomOut's own prose and never the book's words.

`LEGAL.md`, "Narration": reading `sourceReferences[].quote` aloud would produce an audio
reproduction of copyrighted text, which the fair-use position does not reach. The failure mode
is a reasonable instruction — "narrate the slide" — so these tests are about what *cannot*
happen, checked three ways:

* **behaviour** — a Leaf with a sentinel in every field that must stay silent goes through the
  whole render path, regeneration included, and the sentinel never reaches Cloud TTS;
* **structure** — the list of readable fields is asserted exactly, and a `NarrationLine` is
  built in one place in the source;
* **the entry point** — the TTS client takes a `NarrationLine`, so a string lifted out of a
  document by hand has no way in.
"""

from __future__ import annotations

import ast
import inspect
from pathlib import Path
from typing import get_type_hints

import pytest

from zoomout_pipeline.assets import narration
from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.narration import (
    NARRATED_FIELDS,
    NARRATED_GROUPS,
    NarratedSlide,
    NarrationDirectionError,
    NarrationLine,
    NarrationSourceError,
    direction_for,
    load_direction,
    narration_script,
    speakable,
)
from zoomout_pipeline.assets.narration_guard import (
    GUARD_NODE,
    NarrationEnding,
    NarrationReading,
    spoken_words,
)
from zoomout_pipeline.assets.speech import SpeechClient
from zoomout_pipeline.graph.narration_nodes import ClipStore, Guard, render_line

from .conftest import ScriptedLLM
from .narration_fakes import SENTINEL, FakeSpeechBackend, leaf_doc, speech_client

SOURCE_ROOT = Path(__file__).resolve().parent.parent / "src"


def test_narration_reads_exactly_four_fields_in_reading_order() -> None:
    """Asserted exactly, so widening the list is a deliberate act with a failing test.

    If this fails because a field was added: stop. `LEGAL.md` names the four. A fifth needs a
    ruling, not an edit here.
    """
    assert list(NARRATED_FIELDS.items()) == [
        (NarratedSlide.SUMMARY, ("summary", "body")),
        (NarratedSlide.SCENARIO, ("scenario", "prompt")),
        (NarratedSlide.PAYOFF, ("payoff", "body")),
        (NarratedSlide.TAKEAWAY, ("takeaway", "body")),
    ]
    assert NARRATED_GROUPS == ("summary", "scenario", "payoff", "takeaway")
    assert "stickyNotes" not in {slide.value for slide in NarratedSlide}


def test_the_script_is_the_four_bodies_and_nothing_else() -> None:
    doc = leaf_doc(sentinel=SENTINEL)
    script = narration_script(doc)

    assert [line.slide for line in script] == list(NarratedSlide)
    assert [line.text for line in script] == [
        doc["summary"]["body"],
        doc["scenario"]["prompt"],
        doc["payoff"]["body"],
        doc["takeaway"]["body"],
    ]
    assert all(line.order == 4 for line in script)
    assert not any(SENTINEL in line.text or SENTINEL in line.spoken for line in script)


def test_no_quote_or_extra_ever_reaches_cloud_tts(tmp_path: Path) -> None:
    """**The acceptance criterion, as behaviour.** The whole render path — direction, cache,
    budget, synthesis, the guard, and the guard-triggered regeneration — with a sentinel in
    every field that must stay silent: quotes, reference notes, Dinner Table Knowledge,
    apply-in-life, sticky notes, options, titles, alt text and editorial findings.

    The guard here always hears nonsense, so every line is regenerated once. That is on
    purpose: a second attempt is a second chance to reach the wrong field.
    """
    backend = FakeSpeechBackend()
    speech = speech_client(backend)
    guard_llm = ScriptedLLM(
        [],
        defaults={
            GUARD_NODE: NarrationReading(
                transcript="entirely different words", ending=NarrationEnding.CLEAN
            )
        },
    )
    doc = leaf_doc(sentinel=SENTINEL)

    for line in narration_script(doc):
        render_line(
            line=line,
            speech=speech,
            voice="Sulafat",
            prompt=direction_for(line.slide),
            store=ClipStore(tmp_path),
            budget=NarrationBudget(ceiling_usd=100.0),
            record=lambda _spend: None,
            guard=Guard(llm=guard_llm, model="gemini-3.6-flash"),
        )

    assert len(backend.requests) == 8, "four lines, each regenerated once"
    for request in backend.requests:
        assert SENTINEL not in request.input.text
        assert SENTINEL not in request.input.prompt
        assert "verbatim words from the book" not in request.input.text
    for call in guard_llm.calls:
        assert SENTINEL not in call["prompt"]

    sent = " ".join(request.input.text for request in backend.requests)
    for group, field in NARRATED_FIELDS.values():
        assert speakable(doc[group][field]) in sent


def test_a_leaf_missing_a_narrated_field_is_refused_not_skipped() -> None:
    doc = leaf_doc()
    doc["payoff"]["body"] = "   "

    with pytest.raises(NarrationSourceError, match=r"payoff\.body"):
        narration_script(doc)

    doc = leaf_doc()
    del doc["takeaway"]
    with pytest.raises(NarrationSourceError, match=r"takeaway\.body"):
        narration_script(doc)


def test_a_narration_line_is_built_in_one_place() -> None:
    """Structural. `NarrationLine(...)` appears in `narration_script` and nowhere else in
    the package, so there is one place to audit for what can be spoken."""
    builders: list[str] = []
    for path in SOURCE_ROOT.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for function in ast.walk(tree):
            if not isinstance(function, ast.FunctionDef | ast.AsyncFunctionDef):
                continue
            for node in ast.walk(function):
                if (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Name)
                    and node.func.id == "NarrationLine"
                ):
                    builders.append(f"{path.relative_to(SOURCE_ROOT)}:{function.name}")

    assert builders == ["zoomout_pipeline/assets/narration.py:narration_script"]


def test_the_tts_client_only_accepts_a_narration_line() -> None:
    parameters = inspect.signature(SpeechClient.synthesize).parameters

    assert list(parameters)[:2] == ["self", "line"]
    assert get_type_hints(SpeechClient.synthesize)["line"] is NarrationLine
    assert "text" not in parameters


def test_the_spoken_text_is_the_same_words_in_the_same_order() -> None:
    """`speakable` may change spacing. It may not change a word."""
    samples = [
        "You are a software developer assigned to build a form for your team—a routine task.",
        "Continuous low-level stress weakens telomeres—the structures controlling cell "
        "regeneration—and so on.",
        "  In Okinawa,   residents form moai—informal groups.\nThey meet often.  ",
        "You have saved $20,000 and your 70-year-old neighbour eats until 80 percent full.",
        "Pages 2–6 cover it.",
    ]
    for text in samples:
        assert spoken_words(speakable(text)) == spoken_words(text)


def test_an_em_dash_is_spaced_and_an_en_dash_is_left_alone() -> None:
    assert speakable("team—a routine") == "team — a routine"
    assert speakable("team — a routine") == "team — a routine"
    assert speakable("pages 2–6") == "pages 2–6"


# ----------------------------------------------------------------------- direction


def test_every_slide_type_gets_the_shared_direction_and_its_own() -> None:
    rendered = load_direction()

    assert set(rendered) == set(NarratedSlide)
    shared = {direction_for(slide).split("\n\n")[0] for slide in NarratedSlide}
    own = {direction_for(slide).split("\n\n")[-1] for slide in NarratedSlide}
    assert len(shared) == 1, "one narrator: the shared block opens every slide's direction"
    assert len(own) == 4, "each slide type has its own direction"
    for slide in NarratedSlide:
        assert len(direction_for(slide).encode("utf-8")) <= narration.MAX_FIELD_BYTES


def test_the_direction_describes_delivery_and_never_asks_for_reading() -> None:
    """**The audition's finding, as a rule.** The first direction said "Read the text exactly
    as written: every word, in order…", and Gemini-TTS read aloud everything after the colon in
    12 of 13 clips. A style prompt that tells the model to read something gets read."""
    for slide in NarratedSlide:
        prompt = direction_for(slide)
        assert ":" not in prompt
        assert " read" not in f" {prompt.lower()}"
        assert '"' not in prompt and "“" not in prompt
        assert len(prompt.encode("utf-8")) <= 600, "short, like Google's own one-line examples"
        for chatty in ("friend", "telling", "chat", "conversation"):
            # "as if telling a friend" put "You know," in front of four summaries of six.
            assert chatty not in prompt.lower()


def test_the_direction_uses_no_inline_tags() -> None:
    """Emotion is set in prose. Google documents that emotional-adjective tags such as
    [curious] are spoken aloud as words, and an untested tag may behave the same way."""
    for slide in NarratedSlide:
        assert "[" not in direction_for(slide)


def test_the_direction_does_not_name_a_book() -> None:
    """Per slide type, not per book: the same file has to direct the second one."""
    for slide in NarratedSlide:
        prompt = direction_for(slide).lower()
        for specific in ("ikigai", "okinawa", "moai", "hara hachi"):
            assert specific not in prompt


@pytest.mark.parametrize(
    "source",
    [
        "## shared\nA\n\n## summary\nB\n\n## scenario\nC\n\n## payoff\nD\n",
        "## shared\nA\n\n## summary\nB\n\n## scenario\nC\n\n## payoff\nD\n\n## takeaway\n\n",
        "stray\n## shared\nA\n## summary\nB\n## scenario\nC\n## payoff\nD\n## takeaway\nE\n",
        "## shared\nA\n## summary\nB\n## summary\nB2\n"
        "## scenario\nC\n## payoff\nD\n## takeaway\nE\n",
        "## shared\nA\n## summary\nB\n## scenario\nC\n## payoff\nD\n## takeaway\nE\n## notes\nF\n",
    ],
    ids=["missing", "empty", "stray-text", "repeated", "extra"],
)
def test_a_malformed_direction_file_is_an_error(
    source: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(narration, "load_prompt", lambda _name: source)
    load_direction.cache_clear()
    try:
        with pytest.raises(NarrationDirectionError):
            load_direction()
    finally:
        load_direction.cache_clear()


def test_a_direction_over_the_byte_limit_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    huge = "x" * narration.MAX_FIELD_BYTES
    source = f"## shared\n{huge}\n## summary\nB\n## scenario\nC\n## payoff\nD\n## takeaway\nE\n"
    monkeypatch.setattr(narration, "load_prompt", lambda _name: source)
    load_direction.cache_clear()
    try:
        with pytest.raises(NarrationDirectionError, match="bytes"):
            load_direction()
    finally:
        load_direction.cache_clear()
