"""ONBOARD-2.1 Part B — the lines that enforce the voiceover ceiling, pinned in **both** copies.

`NarrationBudget.reserve` is a *stateless* check (`spent + worst_case > ceiling`), and `settle` is
the **only** thing that ever adds to `spent`. So without a settle the ceiling never trips within an
invocation, and without a reserve nothing refuses a call before it is made. Both lines had no test
in either `narration_nodes` (a Leaf's clip) or `greeting_nodes` (its twin): deleting one left the
suite green, which is how a later fix to one copy could go missing from the other unnoticed.

**Every test here runs the *uncached* branch and says so** — a clip already on disk skips the
speech reserve and settle, a reading already on disk skips the guard's, and a test that hit either
cache would pin nothing. Each asserts a call count of at least one to prove it did not.

**They pin the effect, not the call.** What the budget was *charged*, and what the model was or
was not asked. Ceilings are sized from `worst_case_usd` / `guard_worst_case_usd` rather than
hardcoded, and the arithmetic each test relies on is asserted first, so a test cannot go green
because its numbers stopped meaning what it thinks they mean.

`max_attempts=1` throughout: these are about one call's money, not about how many attempts a
clip gets (`test_attempt_defaults.py`).
"""

from __future__ import annotations

import shutil
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypeVar

import pytest
from pydantic import BaseModel

from zoomout_pipeline.assets.budget import BudgetExceededError, NarrationBudget
from zoomout_pipeline.assets.greeting import greeting_direction, greeting_script
from zoomout_pipeline.assets.narration import narration_script
from zoomout_pipeline.assets.narration_guard import (
    GUARD_NODE,
    NarrationEnding,
    NarrationReading,
    guard_worst_case_usd,
)
from zoomout_pipeline.assets.speech import SpeechClient, SpeechError, worst_case_usd
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph.greeting_nodes import GREETING_NODE, render_greeting
from zoomout_pipeline.graph.narration_nodes import NARRATION_NODE, ClipStore, Guard, render_line
from zoomout_pipeline.llm.client import GenerationResult, LLMError
from zoomout_pipeline.llm.ratelimit import MAX_RETRIES

from .conftest import ScriptedLLM
from .narration_fakes import FakeSpeechBackend, google_error, leaf_doc, speech_client

MODEL = "gemini-3.6-flash"
AMPLE = 100.0
LEAF_VOICE = "Achernar"
LEAF_PROMPT = "Warm."

T = TypeVar("T", bound=BaseModel)


class _DownLLM:
    """A listening model that is unreachable: the guard is asked, and never answers."""

    def generate_structured(
        self,
        *,
        prompt: str,
        schema: type[T],
        model: str,
        node: str,
        system_instruction: str | None = None,
        images: Sequence[bytes] | None = None,
        audio: Sequence[bytes] | None = None,
    ) -> GenerationResult[T]:
        raise LLMError("the listening model is unreachable")


def _hears(*items: Any) -> ScriptedLLM:
    """A listener that transcribes each item exactly, in order."""
    return ScriptedLLM(
        [NarrationReading(transcript=item.text, ending=NarrationEnding.CLEAN) for item in items]
    )


@dataclass(frozen=True)
class Copy:
    """One of the two renders that hold the money lines: what to render, and how."""

    name: str
    speech_node: str
    items: Callable[[], Sequence[Any]]
    render: Callable[..., Any]
    request_bytes: Callable[[SpeechClient, Any], int]


def _render_leaf(
    item: Any,
    *,
    speech: SpeechClient,
    store: ClipStore,
    budget: NarrationBudget,
    record: Callable[[TokenSpend], None],
    guard: Guard,
) -> Any:
    return render_line(
        line=item,
        speech=speech,
        voice=LEAF_VOICE,
        prompt=LEAF_PROMPT,
        store=store,
        budget=budget,
        record=record,
        guard=guard,
        max_attempts=1,
    )


def _render_greeting(
    item: Any,
    *,
    speech: SpeechClient,
    store: ClipStore,
    budget: NarrationBudget,
    record: Callable[[TokenSpend], None],
    guard: Guard,
) -> Any:
    return render_greeting(
        greeting=item,
        speech=speech,
        prompt=greeting_direction(),
        store=store,
        budget=budget,
        record=record,
        guard=guard,
        max_attempts=1,
    )


LEAF = Copy(
    name="leaf",
    speech_node=NARRATION_NODE,
    items=lambda: narration_script(leaf_doc()),
    render=_render_leaf,
    request_bytes=lambda speech, item: speech.request_bytes(item, prompt=LEAF_PROMPT),
)
GREETING = Copy(
    name="greeting",
    speech_node=GREETING_NODE,
    items=greeting_script,
    render=_render_greeting,
    request_bytes=lambda speech, item: speech.greeting_request_bytes(
        item, prompt=greeting_direction()
    ),
)
COPIES = [LEAF, GREETING]
BOTH = pytest.mark.parametrize("copy", COPIES, ids=[c.name for c in COPIES])


def _pay_for_the_speech(copy: Copy, items: Sequence[Any], root: Path) -> list[Any]:
    """Render each item once with an unreachable listener, so its raw audio is on disk (paid for,
    and cached) and its reading is not. What is left uncached is exactly the guard's part."""
    return [
        copy.render(
            item,
            speech=speech_client(FakeSpeechBackend()),
            store=ClipStore(root),
            budget=NarrationBudget(ceiling_usd=AMPLE),
            record=lambda _spend: None,
            guard=Guard(llm=_DownLLM(), model=MODEL),
        )
        for item in items
    ]


# ============================================================================ speech (Tier A)


@BOTH
def test_an_uncached_clip_is_settled_for_what_its_speech_cost(copy: Copy, tmp_path: Path) -> None:
    """**Without this line the ceiling never trips within an invocation.** The listener is down,
    so the only thing settled is the speech: `spent_usd` must grow by exactly what the ledger was
    told, or the next call is reserved against a total that has forgotten this one."""
    backend = FakeSpeechBackend()
    budget = NarrationBudget(ceiling_usd=AMPLE)
    spent: list[TokenSpend] = []

    clip = copy.render(
        copy.items()[0],
        speech=speech_client(backend),
        store=ClipStore(tmp_path),
        budget=budget,
        record=spent.append,
        guard=Guard(llm=_DownLLM(), model=MODEL),
    )

    assert len(backend.requests) >= 1 and not clip.from_cache, "the uncached branch ran"
    speech_entries = [entry for entry in spent if entry.node == copy.speech_node]
    assert speech_entries and all(entry.usd > 0 for entry in speech_entries)
    assert budget.spent_usd == pytest.approx(sum(entry.usd for entry in speech_entries))
    assert budget.calls == len(speech_entries)


@BOTH
def test_a_second_uncached_clip_is_refused_only_because_the_first_was_settled(
    copy: Copy, tmp_path: Path
) -> None:
    """**Reserve and settle, together.** The ceiling is sized from the first call's worst case,
    plus half of what that call actually cost: the first call fits, and the second fits *only if
    the first cost nothing*. So it is refused if — and only if — the first was settled (else the
    total is still zero) **and** the reserve is there to refuse it (else nothing is checked)."""
    first, second = copy.items()[:2]
    probe = NarrationBudget(ceiling_usd=AMPLE)
    copy.render(
        first,
        speech=speech_client(FakeSpeechBackend()),
        store=ClipStore(tmp_path / "probe"),
        budget=probe,
        record=lambda _spend: None,
        guard=Guard(llm=_DownLLM(), model=MODEL),
    )
    settled = probe.spent_usd
    speech = speech_client(FakeSpeechBackend())
    worst_first = worst_case_usd(
        model=speech.model, request_bytes=copy.request_bytes(speech, first)
    )
    worst_second = worst_case_usd(
        model=speech.model, request_bytes=copy.request_bytes(speech, second)
    )
    ceiling = worst_first + settled / 2
    assert settled > 0, "the first call cost something"
    assert worst_first <= ceiling, "so it is admitted"
    assert settled + worst_second > ceiling, "and the second is not, once the first is counted"

    backend = FakeSpeechBackend()
    budget = NarrationBudget(ceiling_usd=ceiling)
    real = {
        "speech": speech_client(backend),
        "store": ClipStore(tmp_path / "real"),
        "budget": budget,
        "record": lambda _spend: None,
        "guard": Guard(llm=_DownLLM(), model=MODEL),
    }
    copy.render(first, **real)
    assert len(backend.requests) == 1, "the uncached branch ran"

    with pytest.raises(BudgetExceededError, match="ceiling"):
        copy.render(second, **real)

    assert len(backend.requests) == 1, "the refused clip never reached Cloud TTS"


# ============================================================================= guard (Tier A)


@BOTH
def test_an_uncached_listen_is_settled_for_what_the_guard_cost(copy: Copy, tmp_path: Path) -> None:
    """The guard's own settle. The speech is on disk, so it is not reserved or settled; what the
    budget is charged is the listening and only the listening."""
    item = copy.items()[0]
    _pay_for_the_speech(copy, [item], tmp_path)
    backend = FakeSpeechBackend()
    llm = _hears(item)
    budget = NarrationBudget(ceiling_usd=AMPLE)
    spent: list[TokenSpend] = []

    clip = copy.render(
        item,
        speech=speech_client(backend),
        store=ClipStore(tmp_path),
        budget=budget,
        record=spent.append,
        guard=Guard(llm=llm, model=MODEL),
    )

    assert clip.from_cache and backend.requests == [], "the speech came from disk"
    assert len(llm.calls) >= 1, "the listening did not: the uncached branch ran"
    guard_entries = [entry for entry in spent if entry.node == GUARD_NODE]
    assert len(guard_entries) == 1 and guard_entries[0].usd > 0
    assert budget.spent_usd == pytest.approx(guard_entries[0].usd)
    assert budget.calls == 1


@BOTH
def test_a_listen_that_could_cross_the_ceiling_is_refused_before_the_model_is_called(
    copy: Copy, tmp_path: Path
) -> None:
    """**The guard's reservation.** The ceiling is half of the listening's worst case, so it
    cannot fit whatever the reading would have cost. The refusal comes before the call: the
    listening model is asked nothing, and nothing is spent."""
    item = copy.items()[0]
    (clip,) = _pay_for_the_speech(copy, [item], tmp_path)
    worst = guard_worst_case_usd(model=MODEL, audio_seconds=clip.duration_seconds)
    budget = NarrationBudget(ceiling_usd=worst / 2)
    llm = _hears(item)

    with pytest.raises(BudgetExceededError, match="listening"):
        copy.render(
            item,
            speech=speech_client(FakeSpeechBackend()),
            store=ClipStore(tmp_path),
            budget=budget,
            record=lambda _spend: None,
            guard=Guard(llm=llm, model=MODEL),
        )

    assert llm.calls == [], "the model was never asked"
    assert budget.spent_usd == 0.0 and budget.calls == 0


@BOTH
def test_a_second_uncached_listen_is_refused_only_because_the_first_was_settled(
    copy: Copy, tmp_path: Path
) -> None:
    """The same shape as the speech test, sized from `guard_worst_case_usd`: the first listen
    fits, the second fits only if the first cost nothing, so it is refused if and only if the
    first was settled — and the model is asked once, not twice."""
    first, second = copy.items()[:2]
    clips = _pay_for_the_speech(copy, [first, second], tmp_path)
    probe_root = tmp_path.parent / f"{tmp_path.name}-probe"
    shutil.copytree(tmp_path, probe_root)
    probe = NarrationBudget(ceiling_usd=AMPLE)
    copy.render(
        first,
        speech=speech_client(FakeSpeechBackend()),
        store=ClipStore(probe_root),
        budget=probe,
        record=lambda _spend: None,
        guard=Guard(llm=_hears(first), model=MODEL),
    )
    settled = probe.spent_usd
    worst_first = guard_worst_case_usd(model=MODEL, audio_seconds=clips[0].duration_seconds)
    worst_second = guard_worst_case_usd(model=MODEL, audio_seconds=clips[1].duration_seconds)
    ceiling = worst_first + settled / 2
    assert settled > 0, "the first listen cost something"
    assert worst_first <= ceiling, "so it is admitted"
    assert settled + worst_second > ceiling, "and the second is not, once the first is counted"

    llm = _hears(first, second)
    real = {
        "speech": speech_client(FakeSpeechBackend()),
        "store": ClipStore(tmp_path),
        "budget": NarrationBudget(ceiling_usd=ceiling),
        "record": lambda _spend: None,
        "guard": Guard(llm=llm, model=MODEL),
    }
    copy.render(first, **real)
    assert len(llm.calls) == 1, "the uncached branch ran"

    with pytest.raises(BudgetExceededError, match="listening"):
        copy.render(second, **real)

    assert len(llm.calls) == 1, "the refused listen never reached the model"


# ============================================================ the two failure charges (Tier A)
#
# The mutation run over every `reserve` / `settle` line found these two unpinned as well: what
# `record` is told is asserted by the tests beside these, what `budget` is charged was not.


class _Garbled(FakeSpeechBackend):
    """Cloud TTS answering with audio the pipeline cannot read (paid for all the same)."""

    def synthesize_speech(self, *, request: object, retry: object, timeout: float) -> object:
        self.requests.append(request)

        class _Response:
            audio_content = b"RIFF" + bytes(48_040)

        return _Response()


@BOTH
def test_audio_that_cannot_be_read_is_charged_to_the_budget_not_just_the_ledger(
    copy: Copy, tmp_path: Path
) -> None:
    """Paid for and unreadable: charged at what its size implies (about a second) before the
    error surfaces, so the ceiling is not short by a clip nobody can play."""
    from zoomout_pipeline.assets.audio import AudioError

    backend = _Garbled()
    budget = NarrationBudget(ceiling_usd=AMPLE)
    spent: list[TokenSpend] = []

    with pytest.raises(AudioError):
        copy.render(
            copy.items()[0],
            speech=speech_client(backend),
            store=ClipStore(tmp_path),
            budget=budget,
            record=spent.append,
            guard=Guard(llm=_DownLLM(), model=MODEL),
        )

    assert len(backend.requests) >= 1, "the uncached branch ran"
    (entry,) = spent
    assert entry.usd > 0 and entry.node == copy.speech_node
    assert budget.spent_usd == pytest.approx(entry.usd) and budget.calls == 1


@BOTH
def test_a_call_that_timed_out_and_never_answered_is_charged_to_the_budget(
    copy: Copy, tmp_path: Path
) -> None:
    """A call that dies waiting may still have been generated and billed on Google's side. It is
    estimated from the text and counted, on the ledger **and** against the ceiling, before the
    failure surfaces."""
    backend = FakeSpeechBackend(
        failures=[google_error(504, "Deadline Exceeded")]
        + [google_error(503, "Network is unreachable")] * (MAX_RETRIES - 1)
    )
    budget = NarrationBudget(ceiling_usd=AMPLE)
    spent: list[TokenSpend] = []

    with pytest.raises(SpeechError):
        copy.render(
            copy.items()[0],
            speech=speech_client(backend),
            store=ClipStore(tmp_path),
            budget=budget,
            record=spent.append,
            guard=Guard(llm=_DownLLM(), model=MODEL),
        )

    assert len(backend.requests) >= 1, "the uncached branch ran"
    (entry,) = spent
    assert entry.usd > 0
    assert budget.spent_usd == pytest.approx(entry.usd) and budget.calls == 1
