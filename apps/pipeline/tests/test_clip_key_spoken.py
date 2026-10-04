"""LEDGER-1 Part 3 — the raw cache is keyed on what is **spoken**, stated independently. Tier A.

`clip_key` hashes `line.spoken`, which is `speakable(text)`: whitespace collapsed and a closed-up em
dash spaced out ("team—a routine task" is sent to the voice as "team — a routine task"). The
Architect's independent mutation sample replaced it with `line.text` and **no test went red**.

Why none did, which is the reason this file is written the way it is: every existing test that
touches the key derives *both* sides of its comparison through `clip_key` itself (prime the cache
with `render_line`, then ask `missing_first_attempts`; or compare a rendered clip with a digest
built from `line.spoken` on a payoff that has no dash). A mutant that changes the key consistently
is invisible to a test that only asks the key whether it agrees with the key. Ikigai writes
closed-up em dashes (Leaves 2, 4, 7, 11 and 14), so for those Leaves the two keys differ, and a
cache keyed on the wrong one reads every such clip as missing, or serves a clip made for other
words.

So here the expected key is built **by hand from the spec** (`clip_digest` over the spoken text),
the raw files are put on disk under the key the spec says and under the key the mutant would use,
and the question is asked of the pre-flight, of what `narrate` says it will buy, and of the render.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from zoomout_pipeline import cli
from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.narration import (
    NARRATOR_VOICES,
    NarratedSlide,
    NarrationLine,
    clip_digest,
    direction_for,
    narration_script,
    speakable,
)
from zoomout_pipeline.graph.narration_nodes import (
    ClipStore,
    MissingClip,
    clip_key,
    missing_first_attempts,
    render_line,
)
from zoomout_pipeline.models import NarratorId

from .narration_fakes import FakeSpeechBackend, leaf_doc, speech_client

# The closed-up em dash, the way Ikigai writes it, and the way the voice is sent it.
WRITTEN = "You are building a form for your team—a routine task. How should you approach it?"
SPOKEN = "You are building a form for your team — a routine task. How should you approach it?"


def _doc() -> dict[str, Any]:
    doc = leaf_doc(order=4)
    doc["scenario"]["prompt"] = WRITTEN
    return doc


def _scenario(doc: dict[str, Any]) -> NarrationLine:
    return next(line for line in narration_script(doc) if line.slide is NarratedSlide.SCENARIO)


def _key(speech: Any, voice: str, line: NarrationLine, *, text: str, attempt: int = 1) -> str:
    """The key by the spec, not through `clip_key`: a hash of the request, over `text`."""
    return clip_digest(
        model=speech.model,
        voice=voice,
        language=speech.language_code,
        prompt=direction_for(line.slide),
        text=text,
        attempt=attempt,
    )


def _on_disk(store: ClipStore, key: str) -> None:
    path = store.raw_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"")


def test_the_fixture_is_a_line_whose_text_and_spoken_words_differ() -> None:
    """The premise of every test below: with no dash the two keys are the same and the mutant is
    invisible, which is how it went unseen."""
    line = _scenario(_doc())

    assert line.text == WRITTEN and line.spoken == SPOKEN
    assert "team—a routine task" in line.text and "team — a routine task" in line.spoken
    assert speakable(line.text) == SPOKEN


def test_the_key_is_a_hash_of_the_spoken_text_and_not_of_the_field() -> None:
    speech = speech_client(FakeSpeechBackend())
    line = _scenario(_doc())

    for voice in NARRATOR_VOICES.values():
        for attempt in (1, 2, 3):
            got = clip_key(
                speech=speech,
                voice=voice,
                prompt=direction_for(line.slide),
                line=line,
                attempt=attempt,
            )
            assert got == _key(speech, voice, line, text=SPOKEN, attempt=attempt)
            assert got != _key(speech, voice, line, text=WRITTEN, attempt=attempt), (
                "the key over the field's text is a different key, and not this one"
            )


def test_a_raw_file_under_the_field_text_key_reads_as_missing_to_the_pre_flight(
    tmp_path: Path,
) -> None:
    """**The pin.** The female clip is on disk under the key the spec gives; the male clip is on
    disk only under the key a `line.text` mutant would use. The first is present, the second is
    missing: audio made for the *written* words is not audio for the spoken ones."""
    speech = speech_client(FakeSpeechBackend())
    store = ClipStore(tmp_path)
    line = _scenario(_doc())
    female, male = NARRATOR_VOICES[NarratorId.FEMALE], NARRATOR_VOICES[NarratorId.MALE]
    _on_disk(store, _key(speech, female, line, text=SPOKEN))
    _on_disk(store, _key(speech, male, line, text=WRITTEN))

    absent = missing_first_attempts(
        lines=[line], narrators=NARRATOR_VOICES, speech=speech, store=store
    )

    assert [(clip.slide, clip.narrator, clip.voice) for clip in absent] == [
        (NarratedSlide.SCENARIO, NarratorId.MALE, male)
    ]


def test_with_nothing_on_disk_both_voices_are_missing_and_with_the_spoken_keys_neither_is(
    tmp_path: Path,
) -> None:
    speech = speech_client(FakeSpeechBackend())
    store = ClipStore(tmp_path)
    line = _scenario(_doc())

    def absent() -> list[MissingClip]:
        return missing_first_attempts(
            lines=[line], narrators=NARRATOR_VOICES, speech=speech, store=store
        )

    assert len(absent()) == 2
    for voice in NARRATOR_VOICES.values():
        _on_disk(store, _key(speech, voice, line, text=SPOKEN))
    assert absent() == []


def test_what_narrate_says_it_will_buy_is_decided_on_the_spoken_text(tmp_path: Path) -> None:
    """`_planned_purchases` is what `narrate` prints before its first call. Every clip of the Leaf
    is on disk under its spoken key except the male scenario, which is there only under the
    field-text key: that is the one thing it says it will buy."""
    speech = speech_client(FakeSpeechBackend())
    store = ClipStore(tmp_path)
    doc = _doc()
    male = NARRATOR_VOICES[NarratorId.MALE]
    for voice in NARRATOR_VOICES.values():
        for line in narration_script(doc):
            only_the_written_words = voice == male and line.slide is NarratedSlide.SCENARIO
            _on_disk(
                store,
                _key(
                    speech,
                    voice,
                    line,
                    text=line.text if only_the_written_words else speakable(line.text),
                ),
            )

    planned = cli._planned_purchases([doc], SimpleNamespace(speech=speech, store=store))

    assert [(order, clip.slide, clip.narrator) for order, clip in planned] == [
        (4, NarratedSlide.SCENARIO, NarratorId.MALE)
    ]
    assert cli._will_buy(planned).startswith(
        "will buy   : 1 clip — leaf 4 scenario (male, Sadaltager);"
    )


@pytest.mark.parametrize("voice_of", [NarratorId.FEMALE, NarratorId.MALE])
def test_the_render_stores_a_clip_under_the_spoken_key_and_says_what_was_spoken(
    tmp_path: Path, voice_of: NarratorId
) -> None:
    """The write side: the same key the pre-flight reads, by the spec, and the sidecar records the
    words the voice was sent."""
    backend = FakeSpeechBackend()
    speech = speech_client(backend)
    store = ClipStore(tmp_path)
    line = _scenario(_doc())
    voice = NARRATOR_VOICES[voice_of]

    clip = render_line(
        line=line,
        speech=speech,
        voice=voice,
        prompt=direction_for(line.slide),
        store=store,
        budget=NarrationBudget(ceiling_usd=3.00),
        record=lambda _spend: None,
        guard=None,
        max_attempts=1,
    )

    spoken_key = _key(speech, voice, line, text=SPOKEN)
    assert clip.digest == spoken_key
    assert store.raw_path(spoken_key).exists()
    assert not store.raw_path(_key(speech, voice, line, text=WRITTEN)).exists()
    sidecar = json.loads(store.raw_path(spoken_key).with_suffix(".json").read_text())
    assert sidecar["text"] == SPOKEN
    assert backend.requests[-1].input.text == SPOKEN, "and that is what the voice was sent"
