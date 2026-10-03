"""VO-4 Part 3 — a run over cached audio must be **unable** to buy a clip. Tier A.

Every case here goes through `render_line`, with a speech client whose backend **raises if it is
asked for anything** and a budget that records every reservation it is asked to make. "Unable" is
the claim, so "did not happen to" is not enough: the backend is booby-trapped, and the ledger is
read at the end.

`no_synthesis` forbids *speech* and only speech. The guard's listens still happen and still cost,
and one test here says so, because that is the money VO-4 actually spends.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest

from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.narration import (
    NARRATOR_VOICES,
    NarratedSlide,
    NarrationLine,
    direction_for,
    narration_script,
)
from zoomout_pipeline.assets.narration_guard import (
    GUARD_NODE,
    NarrationEnding,
    NarrationReading,
)
from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.graph.narration_nodes import (
    NARRATION_NODE,
    ClipStore,
    Guard,
    NarrationNotOnDiskError,
    RenderedClip,
    narration_spent_usd,
    render_line,
)

from .conftest import ScriptedLLM
from .narration_fakes import FakeSpeechBackend, leaf_doc, leaked_window, speech_client

MODEL = "gemini-3.6-flash"


class _ExplodingBackend(FakeSpeechBackend):
    """Cloud TTS, as a run that may not synthesise would meet it: any call is a failure."""

    def __init__(self) -> None:
        super().__init__()
        self.calls = 0

    def synthesize_speech(self, *, request: Any, retry: Any, timeout: float) -> Any:
        self.calls += 1
        raise AssertionError("Cloud TTS was called by a run that may not synthesise")


@dataclass
class _SpyBudget(NarrationBudget):
    """A budget that remembers what it was asked to reserve, and for what."""

    reserved: list[str] = field(default_factory=list)

    def reserve(self, *, worst_case_usd: float, what: str) -> None:
        self.reserved.append(what)
        super().reserve(worst_case_usd=worst_case_usd, what=what)

    @property
    def speech_reservations(self) -> list[str]:
        return [what for what in self.reserved if not what.startswith("listening to")]


def _line(slide: NarratedSlide = NarratedSlide.PAYOFF) -> NarrationLine:
    return next(line for line in narration_script(leaf_doc()) if line.slide is slide)


def _never_passes() -> ScriptedLLM:
    return ScriptedLLM(
        [],
        defaults={
            GUARD_NODE: NarrationReading(transcript="nothing like it", ending=NarrationEnding.CLEAN)
        },
    )


def _passes(line: NarrationLine) -> ScriptedLLM:
    return ScriptedLLM(
        [],
        defaults={GUARD_NODE: NarrationReading(transcript=line.text, ending=NarrationEnding.CLEAN)},
    )


def _render(
    store: Path,
    backend: FakeSpeechBackend,
    *,
    line: NarrationLine | None = None,
    voice: str = "Sulafat",
    budget: NarrationBudget | None = None,
    guard: Guard | None = None,
    max_attempts: int = 3,
    tempo: float = 1.0,
    no_synthesis: bool = False,
    spends: list[TokenSpend] | None = None,
) -> RenderedClip:
    line = line or _line()
    sink = spends if spends is not None else []
    return render_line(
        line=line,
        speech=speech_client(backend),
        voice=voice,
        prompt=direction_for(line.slide),
        store=ClipStore(store),
        budget=budget or NarrationBudget(ceiling_usd=3.00),
        record=sink.append,
        guard=guard,
        max_attempts=max_attempts,
        tempo=tempo,
        no_synthesis=no_synthesis,
    )


# =========================================================================== the four cases


def test_a_cached_first_attempt_renders_and_calls_nothing(tmp_path: Path) -> None:
    bought = FakeSpeechBackend()
    _render(tmp_path, bought, max_attempts=1)
    assert len(bought.requests) == 1, "the precondition: the clip is on disk"

    backend, budget = _ExplodingBackend(), _SpyBudget(ceiling_usd=3.00)
    clip = _render(tmp_path, backend, budget=budget, tempo=1.3, no_synthesis=True, max_attempts=1)

    assert clip.from_cache and clip.tempo == 1.3
    assert backend.calls == 0
    assert budget.reserved == [], "guard is off here, and speech is never reserved"


def test_a_first_attempt_that_is_not_on_disk_is_a_typed_error_naming_the_line(
    tmp_path: Path,
) -> None:
    line = _line(NarratedSlide.SCENARIO)
    backend, budget = _ExplodingBackend(), _SpyBudget(ceiling_usd=3.00)

    with pytest.raises(NarrationNotOnDiskError) as refused:
        _render(tmp_path, backend, line=line, budget=budget, voice="Achernar", no_synthesis=True)

    message = str(refused.value)
    assert line.label in message and "Achernar" in message and "attempt 1" in message
    # **Any twelve characters of the line, not just the whole of it** (VO-4.1 A5). This used to
    # refuse only `line.text` and `line.spoken` whole, so a message that quoted the first thirty
    # characters of the line - the Architect's prefix-leak mutant - passed.
    assert leaked_window(line.text, message) is None, "names the line, not its words"
    assert leaked_window(line.spoken, message) is None, "nor the words as they are spoken"
    assert backend.calls == 0
    assert budget.reserved == [], "nothing was reserved, so nothing could have been bought"
    assert not (tmp_path / "raw").exists(), "and nothing was stored"


def test_a_failing_first_attempt_with_a_missing_second_returns_the_first_and_buys_nothing(
    tmp_path: Path,
) -> None:
    """The clip the guard still fails after the stretch **holds its Leaf**. It must not cause a
    paid regeneration, because the whole point of the run is that it cannot pay for one."""
    _render(
        tmp_path,
        FakeSpeechBackend(),
        guard=Guard(llm=_never_passes(), model=MODEL),
        max_attempts=1,
    )

    backend, budget = _ExplodingBackend(), _SpyBudget(ceiling_usd=3.00)
    llm = _never_passes()
    clip = _render(
        tmp_path,
        backend,
        budget=budget,
        guard=Guard(llm=llm, model=MODEL),
        tempo=1.3,
        no_synthesis=True,
        max_attempts=3,
    )

    assert clip.attempt == 1 and clip.attempts_made == 1, "the best attempt so far, and named"
    assert not clip.passed, "flagged, so the Leaf that carries it is held"
    assert backend.calls == 0
    assert budget.speech_reservations == []
    assert len(llm.calls) == 1, "the guard listened to the stretched clip, once: that is allowed"


def test_the_second_attempt_is_used_when_it_is_on_disk_and_the_third_is_not(
    tmp_path: Path,
) -> None:
    """A later attempt that *is* on disk is drawn on as ever: only the missing one ends the line."""
    line = _line()
    wrong = NarrationReading(transcript="wrong words entirely", ending=NarrationEnding.CLEAN)
    still_wrong = NarrationReading(transcript="still nothing like it", ending=NarrationEnding.CLEAN)
    first = ScriptedLLM([wrong], defaults={GUARD_NODE: still_wrong})
    _render(
        tmp_path,
        FakeSpeechBackend(),
        line=line,
        guard=Guard(llm=first, model=MODEL),
        max_attempts=2,
    )

    backend = _ExplodingBackend()
    clip = _render(
        tmp_path,
        backend,
        line=line,
        guard=Guard(llm=_never_passes(), model=MODEL),
        no_synthesis=True,
        max_attempts=3,
    )

    assert clip.attempts_made == 2 and not clip.passed, "two attempts on disk, the third not"
    assert backend.calls == 0


def test_a_passing_clip_stops_at_the_first_attempt_as_ever(tmp_path: Path) -> None:
    line = _line()
    _render(tmp_path, FakeSpeechBackend(), line=line, max_attempts=1)

    clip = _render(
        tmp_path,
        _ExplodingBackend(),
        line=line,
        guard=Guard(llm=_passes(line), model=MODEL),
        no_synthesis=True,
    )

    assert clip.passed and clip.attempts_made == 1


# ===================================================== the ledger: $0 of speech, listens still paid


def test_the_speech_line_of_the_ledger_is_zero_after_a_full_pass(tmp_path: Path) -> None:
    """A whole Leaf, both narrators, every narrated slide — what `narrate` renders — over audio that
    is already on disk. The guard's eight listens are the whole bill, and the ledger says so."""
    doc = leaf_doc()
    lines = narration_script(doc)
    voices = list(NARRATOR_VOICES.values())
    bought = FakeSpeechBackend()
    for voice in voices:
        for line in lines:
            _render(tmp_path, bought, line=line, voice=voice, max_attempts=1)
    assert len(bought.requests) == 8, "the precondition: everything is on disk"

    backend, spends = _ExplodingBackend(), list[TokenSpend]()
    budget = _SpyBudget(ceiling_usd=3.00)
    clips = [
        _render(
            tmp_path,
            backend,
            line=line,
            voice=voice,
            budget=budget,
            guard=Guard(llm=_passes(line), model=MODEL),
            tempo=1.3,
            no_synthesis=True,
            spends=spends,
        )
        for voice in voices
        for line in lines
    ]

    ledger = RunCost(entries=list(spends))
    assert len(clips) == 8 and all(clip.from_cache and clip.passed for clip in clips)
    assert backend.calls == 0
    assert [entry for entry in ledger.entries if entry.node == NARRATION_NODE] == []
    assert sum(entry.usd for entry in ledger.entries if entry.node == NARRATION_NODE) == 0.0
    listens = [entry for entry in ledger.entries if entry.node == GUARD_NODE]
    assert len(listens) == 8 and narration_spent_usd(ledger) == pytest.approx(
        sum(entry.usd for entry in listens)
    ), "the guard's listens are still bought, and still counted"
    assert budget.speech_reservations == []
    assert len(budget.reserved) == 8, "and each was reserved for, as a listen"


def test_without_the_option_a_missing_clip_is_still_bought(tmp_path: Path) -> None:
    """The sibling: the refusal is the option's, and the default path is not touched by it."""
    backend = FakeSpeechBackend()

    clip = _render(tmp_path, backend, no_synthesis=False, max_attempts=1)

    assert len(backend.requests) == 1 and not clip.from_cache
