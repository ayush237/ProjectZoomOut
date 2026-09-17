"""Tier A — the voiceover ceiling halts a run before a call that could cross it, and a clip
that is already paid for is never bought again.

The founder ruled $3 as "the stop signal, not a target". A budget that only reported the
overrun afterwards would be the WP30 failure — $10.07 against $5, narrated twice mid-run and
never stopped.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from zoomout_pipeline.assets.audio import AudioError
from zoomout_pipeline.assets.budget import BudgetExceededError, NarrationBudget
from zoomout_pipeline.assets.narration import NarratedSlide, direction_for, narration_script
from zoomout_pipeline.assets.narration_guard import (
    GUARD_NODE,
    MIN_NATURAL_WPM,
    GuardSeverity,
    NarrationEnding,
    NarrationReading,
    pace_is_natural,
    speaking_rate,
)
from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.graph.narration_nodes import (
    NARRATION_NODE,
    ClipStore,
    Guard,
    RenderedClip,
    narration_spent_usd,
    render_line,
)

from .conftest import ScriptedLLM
from .narration_fakes import FakeSpeechBackend, google_error, leaf_doc, speech_client


def test_a_call_whose_worst_case_would_cross_the_ceiling_is_refused() -> None:
    budget = NarrationBudget(ceiling_usd=1.00, spent_usd=0.90)

    budget.reserve(worst_case_usd=0.10, what="a clip that fits exactly")
    with pytest.raises(BudgetExceededError, match="ceiling"):
        budget.reserve(worst_case_usd=0.11, what="a clip that might not")

    assert budget.spent_usd == pytest.approx(0.90), "a refusal spends nothing"


def test_settling_counts_what_was_actually_spent() -> None:
    budget = NarrationBudget(ceiling_usd=3.00)
    budget.settle(0.004)
    budget.settle(0.006)

    assert budget.spent_usd == pytest.approx(0.010)
    assert budget.calls == 2
    assert budget.remaining_usd == pytest.approx(2.99)


def test_the_ceiling_is_for_the_package_not_the_invocation() -> None:
    """An audition, a render and a regeneration draw on one number."""
    cost = RunCost(
        entries=[
            TokenSpend(node=NARRATION_NODE, model="gemini-2.5-flash-tts", output_tokens=50_000),
            TokenSpend(node=GUARD_NODE, model="gemini-3.6-flash", input_tokens=40_000),
            TokenSpend(node="assets", model="gemini-3.6-flash", output_tokens=1_000_000),
        ]
    )

    assert narration_spent_usd(cost) == pytest.approx(0.50 + 0.03)


def _render(tmp_path: Path, backend: FakeSpeechBackend, budget: NarrationBudget) -> RenderedClip:
    line = next(
        line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.SUMMARY
    )
    return render_line(
        line=line,
        speech=speech_client(backend),
        voice="Sulafat",
        prompt=direction_for(line.slide),
        store=ClipStore(tmp_path),
        budget=budget,
        record=lambda _spend: None,
        guard=None,
    )


def test_the_ceiling_is_checked_before_the_call_not_after(tmp_path: Path) -> None:
    backend = FakeSpeechBackend()
    budget = NarrationBudget(ceiling_usd=3.00, spent_usd=2.90)

    with pytest.raises(BudgetExceededError):
        _render(tmp_path, backend, budget)

    assert backend.requests == [], "no call is made that the budget refused"


def test_a_rendered_clip_is_never_bought_twice(tmp_path: Path) -> None:
    """Cached by what was asked, on disk before anything else can fail."""
    backend = FakeSpeechBackend()
    spent: list[TokenSpend] = []
    budget = NarrationBudget(ceiling_usd=3.00)
    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)

    def render() -> RenderedClip:
        return render_line(
            line=line,
            speech=speech_client(backend),
            voice="Sulafat",
            prompt=direction_for(line.slide),
            store=ClipStore(tmp_path),
            budget=budget,
            record=spent.append,
            guard=None,
        )

    first = render()
    second = render()

    assert len(backend.requests) == 1
    assert len(spent) == 1
    assert first.from_cache is False
    assert second.from_cache is True
    assert first.sha256 == second.sha256, "the same bytes, twice"
    assert list((tmp_path / "raw").glob("*.wav")) and list((tmp_path / "raw").glob("*.json"))


def test_a_new_voice_or_direction_is_a_new_clip(tmp_path: Path) -> None:
    backend = FakeSpeechBackend()
    budget = NarrationBudget(ceiling_usd=3.00)
    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)

    for voice, prompt in [("Sulafat", "Warm."), ("Achird", "Warm."), ("Sulafat", "Brisk.")]:
        render_line(
            line=line,
            speech=speech_client(backend),
            voice=voice,
            prompt=prompt,
            store=ClipStore(tmp_path),
            budget=budget,
            record=lambda _spend: None,
            guard=None,
        )

    assert len(backend.requests) == 3


def test_regeneration_is_bounded_and_keeps_the_better_attempt(tmp_path: Path) -> None:
    """A clip the guard calls major gets one more attempt, then the better one is kept and
    named — never a third bet, never a Leaf with a missing slide."""
    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)
    backend = FakeSpeechBackend()
    llm = ScriptedLLM(
        [
            NarrationReading(transcript="wrong words entirely", ending=NarrationEnding.CLEAN),
            NarrationReading(transcript=line.text, ending=NarrationEnding.CLIPPED),
        ]
    )
    spent: list[TokenSpend] = []

    clip = render_line(
        line=line,
        speech=speech_client(backend),
        voice="Sulafat",
        prompt="Warm.",
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=3.00),
        record=spent.append,
        guard=Guard(llm=llm, model="gemini-3.6-flash"),
        max_attempts=2,
    )

    assert len(backend.requests) == 2
    assert clip.attempt == 2 and clip.attempts_made == 2
    assert clip.check is not None and clip.check.passed
    assert [s.node for s in spent] == [NARRATION_NODE, GUARD_NODE, NARRATION_NODE, GUARD_NODE]


def test_a_clip_that_never_passes_is_still_returned_and_named(tmp_path: Path) -> None:
    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)
    backend = FakeSpeechBackend()
    llm = ScriptedLLM(
        [],
        defaults={
            GUARD_NODE: NarrationReading(transcript="nothing like it", ending=NarrationEnding.CLEAN)
        },
    )

    clip = render_line(
        line=line,
        speech=speech_client(backend),
        voice="Sulafat",
        prompt="Warm.",
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=3.00),
        record=lambda _spend: None,
        guard=Guard(llm=llm, model="gemini-3.6-flash"),
        max_attempts=2,
    )

    assert len(backend.requests) == 2, "bounded: two attempts, not a loop"
    assert clip.check is not None and not clip.check.passed


def test_a_guard_reading_is_cached_with_its_clip(tmp_path: Path) -> None:
    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)
    backend = FakeSpeechBackend()
    llm = ScriptedLLM([NarrationReading(transcript=line.text, ending=NarrationEnding.CLEAN)])

    for _ in range(2):
        clip = render_line(
            line=line,
            speech=speech_client(backend),
            voice="Sulafat",
            prompt="Warm.",
            store=ClipStore(tmp_path),
            budget=NarrationBudget(ceiling_usd=3.00),
            record=lambda _spend: None,
            guard=Guard(llm=llm, model="gemini-3.6-flash"),
        )
        assert clip.check is not None and clip.check.passed

    assert len(llm.calls) == 1, "the second run heard the same bytes from disk"


def test_a_timed_out_attempt_is_counted_as_spent(tmp_path: Path) -> None:
    backend = FakeSpeechBackend(failures=[google_error(504, "slow")])
    spent: list[TokenSpend] = []
    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)

    render_line(
        line=line,
        speech=speech_client(backend),
        voice="Sulafat",
        prompt="Warm.",
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=3.00),
        record=spent.append,
        guard=None,
    )

    assert len(spent) == 2, "the ledger may over-report a timeout; it must not under-report"


def test_audio_that_cannot_be_read_is_kept_and_still_charged(tmp_path: Path) -> None:
    """Paid for is paid for. The raw response is on disk before anything tries to read it,
    and the ledger counts it before the error surfaces."""

    class Garbled(FakeSpeechBackend):
        def synthesize_speech(self, *, request: object, retry: object, timeout: float) -> object:
            self.requests.append(request)

            class _Response:
                audio_content = b"RIFF" + bytes(48_040)

            return _Response()

    spent: list[TokenSpend] = []
    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)

    with pytest.raises(AudioError):
        render_line(
            line=line,
            speech=speech_client(Garbled()),
            voice="Sulafat",
            prompt="Warm.",
            store=ClipStore(tmp_path),
            budget=NarrationBudget(ceiling_usd=3.00),
            record=spent.append,
            guard=None,
        )

    assert len(list((tmp_path / "raw").glob("*.wav"))) == 1
    assert not list((tmp_path / "raw").glob("*.partial"))
    assert len(spent) == 1 and spent[0].output_tokens == 25, "about one second, charged"


def test_a_clip_far_longer_than_its_words_is_major_even_when_the_transcript_is_exact(
    tmp_path: Path,
) -> None:
    """**The failure the first audition found, and the transcriber hid.** Twelve directed clips
    spoke the style direction before the text; nine of their transcripts left it out and read
    word for word. Only the pace gave them away — so the pace decides on its own."""
    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)
    # Five times the natural length: the text plus a minute of something else.
    backend = FakeSpeechBackend(seconds_per_char=0.26)
    llm = ScriptedLLM(
        [],
        defaults={GUARD_NODE: NarrationReading(transcript=line.text, ending=NarrationEnding.CLEAN)},
    )

    clip = render_line(
        line=line,
        speech=speech_client(backend),
        voice="Sulafat",
        prompt="Warm.",
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=3.00),
        record=lambda _spend: None,
        guard=Guard(llm=llm, model="gemini-3.6-flash"),
        max_attempts=2,
    )

    assert clip.check is not None and clip.check.severity is GuardSeverity.EXACT
    assert clip.words_per_minute < MIN_NATURAL_WPM
    assert clip.severity is GuardSeverity.MAJOR and not clip.passed
    assert len(backend.requests) == 2, "regenerated once, then kept and named"


def test_the_pace_check_holds_without_the_guard(tmp_path: Path) -> None:
    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)
    backend = FakeSpeechBackend(seconds_per_char=0.26)

    clip = render_line(
        line=line,
        speech=speech_client(backend),
        voice="Sulafat",
        prompt="Warm.",
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=3.00),
        record=lambda _spend: None,
        guard=None,
    )

    assert clip.check is None
    assert clip.severity is GuardSeverity.MAJOR
    assert len(backend.requests) == 2


def test_natural_pace_is_bounded_both_ways() -> None:
    """Measured on the audition's own numbers: seconds of speech for the 42-word scenario."""
    forty_two = " ".join(["word"] * 42)
    assert pace_is_natural(speaking_rate(forty_two, 13.85)), "undirected"
    assert pace_is_natural(speaking_rate(forty_two, 15.67)), "directed, the fixed direction"
    assert not pace_is_natural(speaking_rate(forty_two, 59.92)), "the direction read aloud"
    assert not pace_is_natural(speaking_rate(forty_two, 5.0)), "a truncated or rushed clip"
    assert speaking_rate(forty_two, 0.0) == 0.0


def test_a_slow_read_full_of_pauses_is_not_a_leak(tmp_path: Path) -> None:
    """The probe's takeaway: word for word, 18 seconds, eleven pauses. Slow is a listening
    question, not a regeneration."""
    line = next(
        line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.TAKEAWAY
    )
    backend = FakeSpeechBackend(pause_seconds=1.2)

    clip = render_line(
        line=line,
        speech=speech_client(backend),
        voice="Sulafat",
        prompt="Warm.",
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=3.00),
        record=lambda _spend: None,
        guard=None,
    )

    assert clip.words_per_minute < MIN_NATURAL_WPM, "slow to the ear"
    assert clip.pace_natural and clip.passed, "but the speech itself is the text at a human rate"
    assert len(backend.requests) == 1


def test_a_rewritten_guard_prompt_is_a_new_check(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The first guard prompt let the transcriber drop spoken instructions; its readings must
    not answer for the rewritten one."""
    from zoomout_pipeline.assets import narration_guard

    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)
    reading = NarrationReading(transcript=line.text, ending=NarrationEnding.CLEAN)
    llm = ScriptedLLM([], defaults={GUARD_NODE: reading})

    def render() -> RenderedClip:
        return render_line(
            line=line,
            speech=speech_client(FakeSpeechBackend()),
            voice="Sulafat",
            prompt="Warm.",
            store=ClipStore(tmp_path),
            budget=NarrationBudget(ceiling_usd=3.00),
            record=lambda _spend: None,
            guard=Guard(llm=llm, model="gemini-3.6-flash"),
        )

    render()
    render()
    assert len(llm.calls) == 1

    monkeypatch.setattr(narration_guard, "load_prompt", lambda _name: "a different question")
    render()
    assert len(llm.calls) == 2


def test_a_run_that_dies_on_a_timeout_still_counts_it(tmp_path: Path) -> None:
    """The Sadaltager run's first attempt at Leaf 1's scenario timed out and every retry was
    refused by a dead network: no clip, and — before this — nothing on the ledger either."""
    from zoomout_pipeline.assets.speech import SpeechError
    from zoomout_pipeline.llm.ratelimit import MAX_RETRIES

    backend = FakeSpeechBackend(
        failures=[google_error(504, "Deadline Exceeded")]
        + [google_error(503, "Network is unreachable")] * (MAX_RETRIES - 1)
    )
    spent: list[TokenSpend] = []
    line = next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)

    with pytest.raises(SpeechError):
        render_line(
            line=line,
            speech=speech_client(backend),
            voice="Sulafat",
            prompt="Warm.",
            store=ClipStore(tmp_path),
            budget=NarrationBudget(ceiling_usd=3.00),
            record=spent.append,
            guard=None,
        )

    assert len(spent) == 1 and spent[0].output_tokens > 0, "one timeout, estimated and charged"
    assert not (tmp_path / "raw").exists() or not list((tmp_path / "raw").glob("*.wav"))


def test_spend_is_written_back_to_the_run_on_every_call() -> None:
    """A crash between two clips must not take the first one off the ledger."""
    from zoomout_pipeline.cli import RunLedger

    class Graph:
        def __init__(self) -> None:
            self.writes: list[tuple[dict[str, object], dict[str, object]]] = []

        def update_state(self, config: dict[str, object], values: dict[str, object]) -> None:
            self.writes.append((config, values))

    graph = Graph()
    ledger = RunLedger(graph, "ikigai", RunCost())
    first = TokenSpend(node=NARRATION_NODE, model="gemini-2.5-flash-tts", output_tokens=500)

    ledger.record(first)

    assert len(graph.writes) == 1
    config, values = graph.writes[0]
    assert config == {"configurable": {"thread_id": "ikigai"}}
    cost = values["cost"]
    assert isinstance(cost, RunCost) and cost.entries == [first]
