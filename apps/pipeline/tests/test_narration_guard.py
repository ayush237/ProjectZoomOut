"""The narration guard: a blind transcript, compared word by word, and what counts as major.

Tested on its contract — what it sends, how it compares, how it grades — never on whether the
listening model hears well, which is a live-model question.
"""

from __future__ import annotations

import pytest

from zoomout_pipeline.assets.narration_guard import (
    GUARD_NODE,
    GuardSeverity,
    NarrationCheck,
    NarrationEnding,
    NarrationReading,
    check_narration,
    compare_words,
    guard_worst_case_usd,
    number_words,
    spoken_words,
)
from zoomout_pipeline.cost import TokenSpend

from .conftest import ScriptedLLM

EXPECTED = (
    "In Okinawa, residents form moai—informal groups of people with common interests who "
    "look after one another. The authors note that belonging lowers stress by 60 percent."
)


def check(transcript: str, **reading: object) -> NarrationCheck:
    heard = NarrationReading(
        transcript=transcript,
        ending=reading.pop("ending", NarrationEnding.CLEAN),  # type: ignore[arg-type]
        **reading,  # type: ignore[arg-type]
    )
    return NarrationCheck(
        reading=heard,
        diff=compare_words(EXPECTED, transcript),
        spend=TokenSpend(node=GUARD_NODE, model="gemini-3.6-flash"),
    )


def test_numbers_and_symbols_meet_their_spoken_forms() -> None:
    assert spoken_words("$20,000") == ["twenty", "thousand", "dollars"]
    assert spoken_words("twenty thousand dollars") == ["twenty", "thousand", "dollars"]
    assert spoken_words("80%") == spoken_words("eighty percent")
    assert spoken_words("a 70-year-old") == ["a", "seventy", "year", "old"]
    assert spoken_words("type 2 diabetes") == ["type", "two", "diabetes"]
    assert spoken_words("the object’s flaw") == spoken_words("the objects flaw")
    assert spoken_words("1.5 cups") == ["one", "point", "five", "cups"]
    assert number_words(150) == ["one", "hundred", "fifty"]
    assert number_words(2_000_045) == ["two", "million", "forty", "five"]


def test_a_word_for_word_reading_is_exact() -> None:
    heard = (
        "In Okinawa residents form moai informal groups of people with common interests who "
        "look after one another. The authors note that belonging lowers stress by sixty percent."
    )
    result = check(heard)

    assert result.diff.errors == 0
    assert result.severity is GuardSeverity.EXACT
    assert result.findings() == []


def test_a_transcriber_spelling_a_japanese_word_differently_is_minor() -> None:
    """Worth a listen — it may be a mispronunciation — and not worth a regeneration."""
    heard = EXPECTED.replace("moai", "mo eye")
    result = check(heard)

    assert result.diff.errors == 2
    assert result.severity is GuardSeverity.MINOR
    assert result.passed


def test_a_dropped_phrase_is_major() -> None:
    heard = EXPECTED.replace(" who look after one another", "")
    result = check(heard)

    assert result.diff.longest_run >= 3
    assert result.severity is GuardSeverity.MAJOR
    assert not result.passed
    assert "not heard: who look after one another" in " ".join(result.findings())


def test_a_changed_number_is_caught() -> None:
    """ "60 percent" read as "16 percent" is a fabricated claim in an author's name."""
    result = check(EXPECTED.replace("60 percent", "16 percent"))

    assert result.diff.errors >= 1
    assert result.severity is not GuardSeverity.EXACT
    assert "sixty" in result.diff.missing


def test_a_spoken_tag_is_major_on_its_own() -> None:
    result = check(EXPECTED, spoken_non_text=["short pause"])

    assert result.severity is GuardSeverity.MAJOR
    assert "spoken aloud: short pause" in result.findings()


def test_a_bad_ending_or_an_unclear_word_is_minor() -> None:
    assert check(EXPECTED, ending=NarrationEnding.CLIPPED).severity is GuardSeverity.MINOR
    assert check(EXPECTED, unclear_words=["moai"]).severity is GuardSeverity.MINOR


def test_mostly_wrong_is_major_even_without_a_long_run() -> None:
    scrambled = " ".join(
        word if index % 3 else "zzz" for index, word in enumerate(EXPECTED.split())
    )
    result = check(scrambled)

    assert result.diff.rate >= 0.10
    assert result.severity is GuardSeverity.MAJOR


def test_the_guard_listens_to_the_mp3_and_is_never_told_the_text() -> None:
    """Blind by construction. A transcriber shown the expected text hears it."""
    llm = ScriptedLLM([NarrationReading(transcript="hello there", ending=NarrationEnding.CLEAN)])

    result = check_narration(
        llm=llm, mp3=b"\xff\xf3mp3-bytes", expected=EXPECTED, model="gemini-3.6-flash"
    )

    (call,) = llm.calls
    assert call["node"] == GUARD_NODE
    assert call["audio"] == [b"\xff\xf3mp3-bytes"]
    assert call["images"] == []
    assert "Okinawa" not in call["prompt"] and "moai" not in call["prompt"]
    assert result.reading.transcript == "hello there"
    assert result.severity is GuardSeverity.MAJOR


def test_the_reading_must_parse() -> None:
    with pytest.raises(ValueError):
        NarrationReading.model_validate({"transcript": "", "ending": "clean"})
    with pytest.raises(ValueError):
        NarrationReading.model_validate({"transcript": "x", "ending": "fine"})


def test_the_worst_case_of_a_check_is_never_free() -> None:
    priced = guard_worst_case_usd(model="gemini-3.6-flash", audio_seconds=30.0)
    unpriced = guard_worst_case_usd(model="gemini-9-flash", audio_seconds=30.0)

    assert priced > 0.02, "a thinking model's output ceiling dominates"
    assert unpriced > priced


def test_words_the_voice_added_are_major() -> None:
    """The audition's summaries opened "You know, in Okinawa…" in four clips of six: words
    nobody wrote, spoken in a lesson about somebody's book."""
    result = check("You know, " + EXPECTED)

    assert result.diff.added == ("you", "know")
    assert result.severity is GuardSeverity.MAJOR
    assert "added, not in the text: you know" in " ".join(result.findings())


def test_a_skipped_pair_is_major_and_a_single_skipped_word_is_minor() -> None:
    two = check(EXPECTED.replace("common interests", "interests").replace("one another", "another"))
    assert two.diff.longest_gap == 1 and two.severity is GuardSeverity.MINOR

    pair = check(EXPECTED.replace(" with common interests", ""))
    assert pair.diff.longest_gap == 3 and pair.severity is GuardSeverity.MAJOR


def test_a_word_heard_differently_is_not_an_addition() -> None:
    result = check(EXPECTED.replace("moai", "mo eye"))

    assert result.diff.added == ()
    assert "heard instead: mo eye" in result.diff.summary()
