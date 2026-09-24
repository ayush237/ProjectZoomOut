"""ONBOARD-2 — a narrator's self-introduction: its own door, its budget, and its upload.

**Tier A** — what the voice may say is an exact, closed list; which voice says it cannot be
chosen wrongly; the ceiling holds across invocations and refuses before a call, not after; a
greeting that fails a check is never uploaded; nothing but Media is ever written.

**Tier B** — the direction, the stable references the app builds on, the resumable upload.

`tests/test_narration_budget.py` is this file's sibling. `graph/greeting_nodes.py` renders a
greeting with the same money handling as a Leaf's clip and, being a twin rather than a shared
function, is held to the same cases here: a fix to one is a test failing in the other.
"""

from __future__ import annotations

import ast
import inspect
from collections.abc import Sequence
from dataclasses import replace
from pathlib import Path
from typing import Any, TypeVar, get_type_hints

import pytest
from pydantic import BaseModel
from typer.testing import CliRunner

from zoomout_pipeline import cli
from zoomout_pipeline.assets import greeting as greeting_module
from zoomout_pipeline.assets.audio import AudioError
from zoomout_pipeline.assets.budget import BudgetExceededError, NarrationBudget
from zoomout_pipeline.assets.greeting import (
    NAME_SLOT_MAX_WORDS,
    NARRATOR_GREETINGS,
    GreetingDirectionError,
    NarratorGreeting,
    compare_greeting,
    greeting_alt,
    greeting_direction,
    greeting_filename,
    greeting_for,
    greeting_script,
)
from zoomout_pipeline.assets.narration import NARRATOR_VOICES, NarratedSlide, direction_for
from zoomout_pipeline.assets.narration_guard import (
    GUARD_NODE,
    MIN_NATURAL_WPM,
    GuardSeverity,
    NarrationCheck,
    NarrationEnding,
    NarrationReading,
    spoken_words,
)
from zoomout_pipeline.assets.speech import SpeechClient, SpeechError, worst_case_usd
from zoomout_pipeline.cms.client import PayloadError
from zoomout_pipeline.config import PipelineSettings
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph.greeting_nodes import (
    GREETING_CEILING_USD,
    GREETING_NODE,
    GreetingHeldError,
    GreetingLedger,
    GreetingLedgerError,
    GreetingRun,
    GreetingUploadError,
    MediaCms,
    RenderedGreeting,
    _keep_on_disk,
    render_greeting,
    run_greetings,
    upload_greeting,
    upload_greetings,
)
from zoomout_pipeline.graph.narration_nodes import ClipStore, Guard
from zoomout_pipeline.llm.client import GenerationResult, LLMError, StructuredClient
from zoomout_pipeline.models import NarratorId

from .conftest import TEST_DATABASE_URL, ScriptedLLM
from .narration_fakes import FakePayload, FakeSpeechBackend, google_error, speech_client

SOURCE_ROOT = Path(__file__).resolve().parent.parent / "src"
MODEL = "gemini-3.6-flash"
T = TypeVar("T", bound=BaseModel)

FEMALE_TEXT = "Hi, I'm Achernar. I'll be reading to you here, whenever you'd like the company."
MALE_TEXT = "Hey, I'm Sadaltager. I'll be reading to you here, whenever you'd like the company."


# ------------------------------------------------------------------------------ helpers


def _ignore(_narrator: NarratorId, _spend: TokenSpend) -> None:
    return None


def _hears(*transcripts: str) -> ScriptedLLM:
    """A listener that transcribes exactly what it is told to, in order."""
    return ScriptedLLM(
        [NarrationReading(transcript=t, ending=NarrationEnding.CLEAN) for t in transcripts]
    )


def _hears_both() -> ScriptedLLM:
    return _hears(FEMALE_TEXT, MALE_TEXT)


class DownLLM:
    """A listening model that is unreachable."""

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


def _render(
    tmp_path: Path,
    *,
    narrator: NarratorId = NarratorId.FEMALE,
    backend: FakeSpeechBackend | None = None,
    llm: StructuredClient | None = None,
    budget: NarrationBudget | None = None,
    spent: list[TokenSpend] | None = None,
    max_attempts: int = 2,
) -> RenderedGreeting:
    sink = spent if spent is not None else []
    return render_greeting(
        greeting=greeting_for(narrator),
        speech=speech_client(backend or FakeSpeechBackend()),
        prompt=greeting_direction(),
        store=ClipStore(tmp_path),
        budget=budget or NarrationBudget(ceiling_usd=GREETING_CEILING_USD),
        record=sink.append,
        guard=Guard(llm=llm if llm is not None else _hears(_text(narrator)), model=MODEL),
        max_attempts=max_attempts,
    )


def _text(narrator: NarratorId) -> str:
    return NARRATOR_GREETINGS[narrator]


def _run(
    tmp_path: Path,
    *,
    backend: FakeSpeechBackend | None = None,
    llm: StructuredClient | None = None,
    client: MediaCms | None = None,
    budget: NarrationBudget | None = None,
) -> GreetingRun:
    return run_greetings(
        speech=speech_client(backend or FakeSpeechBackend()),
        store=ClipStore(tmp_path),
        budget=budget or NarrationBudget(ceiling_usd=GREETING_CEILING_USD),
        record=_ignore,
        guard=Guard(llm=llm if llm is not None else _hears_both(), model=MODEL),
        client=client,
    )


# ============================================================ what may be said (Tier A)


def test_the_greetings_are_exactly_these_two_sentences() -> None:
    """Asserted exactly, so a changed word is a deliberate act with a failing test.

    If this fails because the wording changed: that is the Architect's copy, and ONBOARD-3's app
    shows the same words on screen. Regenerate the clips, and tell whoever owns the beat.
    """
    assert dict(NARRATOR_GREETINGS) == {
        NarratorId.FEMALE: FEMALE_TEXT,
        NarratorId.MALE: MALE_TEXT,
    }
    assert list(NARRATOR_GREETINGS) == list(NarratorId)
    assert [greeting.narrator for greeting in greeting_script()] == list(NarratorId)


def test_each_narrator_introduces_themselves_as_the_voice_that_speaks() -> None:
    """ "I'm Achernar", in Sadaltager's voice, is the one error a reader could not miss and
    nothing else would catch."""
    for narrator, text in NARRATOR_GREETINGS.items():
        own = NARRATOR_VOICES[narrator]
        assert own in text
        for other_narrator, other_voice in NARRATOR_VOICES.items():
            if other_narrator is not narrator:
                assert other_voice not in text


def test_a_greeting_is_built_in_one_place() -> None:
    """Structural. `NarratorGreeting(...)` appears in `greeting_for` and nowhere else in the
    package, so there is one place to audit for what this door can say."""
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
                    and node.func.id == "NarratorGreeting"
                ):
                    builders.append(f"{path.relative_to(SOURCE_ROOT)}:{function.name}")

    assert builders == ["zoomout_pipeline/assets/greeting.py:greeting_for"]


def test_the_greeting_door_takes_a_greeting_and_nothing_else() -> None:
    """A bare string — a quote lifted out of a document by hand — has no way in, and the voice
    is not a parameter, so it cannot be the wrong one."""
    parameters = inspect.signature(SpeechClient.synthesize_greeting).parameters

    assert list(parameters) == ["self", "greeting", "prompt"]
    assert get_type_hints(SpeechClient.synthesize_greeting)["greeting"] is NarratorGreeting
    assert "text" not in parameters and "voice" not in parameters


def test_the_request_is_the_greeting_in_its_own_voice_with_the_direction() -> None:
    from google.cloud import texttospeech

    backend = FakeSpeechBackend()
    greeting = greeting_for(NarratorId.MALE)

    result = speech_client(backend).synthesize_greeting(greeting, prompt="Be warm.")

    (request,) = backend.requests
    assert request.input.text == greeting.spoken == MALE_TEXT
    assert request.input.prompt == "Be warm."
    assert request.voice.name == "Sadaltager"
    assert request.voice.model_name == "gemini-2.5-flash-tts"
    assert request.audio_config.audio_encoding == texttospeech.AudioEncoding.LINEAR16
    assert result.voice == "Sadaltager"
    assert result.request_bytes == len(MALE_TEXT.encode()) + len(b"Be warm.")
    (options,) = backend.call_options
    assert options["retry"] is None and 0 < options["timeout"] <= 300, "one retry layer"


def test_the_two_ruled_voices_speak_and_there_is_no_third(tmp_path: Path) -> None:
    backend = FakeSpeechBackend()

    _run(tmp_path, backend=backend)

    assert [request.voice.name for request in backend.requests] == ["Achernar", "Sadaltager"]
    assert {request.voice.name for request in backend.requests} == set(NARRATOR_VOICES.values())


def test_the_greeting_door_refuses_what_the_leaf_door_refuses() -> None:
    """One `_call` behind both doors, so the guarantees are one implementation: an oversized
    field, no voice and a refused host are refused here exactly as they are there."""
    with pytest.raises(SpeechError, match="4000"):
        speech_client(FakeSpeechBackend()).synthesize_greeting(
            greeting_for(NarratorId.FEMALE), prompt="x" * 4001
        )


# ================================================================== the direction (Tier B)


def test_the_direction_opens_with_the_shared_narrator_block() -> None:
    """The same narrator who introduces themselves then reads the lesson. If this fails because
    the shared block changed, that was a decision about how the narrator sounds — make it about
    this clip too, and regenerate."""
    shared = direction_for(NarratedSlide.SUMMARY).split("\n\n")[0]

    assert greeting_direction().split("\n\n")[0] == shared


def test_the_direction_describes_delivery_and_never_asks_for_reading() -> None:
    """The rules `test_narration_selection.py` holds a Leaf's direction to, over this one. A
    style prompt that tells the model to read something gets read (12 of 13 audition clips)."""
    prompt = greeting_direction()

    assert ":" not in prompt
    assert " read" not in f" {prompt.lower()}"
    assert '"' not in prompt and "“" not in prompt
    assert "[" not in prompt, "inline tags are spoken aloud"
    assert len(prompt.encode("utf-8")) <= 600, "short, like Google's own one-line examples"
    for chatty in ("friend", "telling", "chat", "conversation"):
        assert chatty not in prompt.lower()
    for specific in ("ikigai", "okinawa", "moai", "hara hachi"):
        assert specific not in prompt.lower()


def test_the_files_own_comment_is_never_sent() -> None:
    """A comment left in would be spoken aloud, header and all."""
    prompt = greeting_direction()

    assert "<!--" not in prompt and "-->" not in prompt
    assert "ONBOARD-2" not in prompt


@pytest.mark.parametrize(
    ("source", "match"),
    [("<!-- only a comment -->\n", "no text"), ("x" * 4001, "bytes")],
    ids=["empty", "oversized"],
)
def test_a_malformed_direction_is_an_error(
    source: str, match: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(greeting_module, "load_prompt", lambda _name: source)
    greeting_direction.cache_clear()
    try:
        with pytest.raises(GreetingDirectionError, match=match):
            greeting_direction()
    finally:
        greeting_direction.cache_clear()


def test_the_stable_references_the_app_builds_on() -> None:
    """These are a contract with ONBOARD-3, which reads the two clips by name and by Media id.
    Renaming one breaks a package that has already shipped."""
    assert greeting_filename(NarratorId.FEMALE) == "narrator-greeting-female.mp3"
    assert greeting_filename(NarratorId.MALE) == "narrator-greeting-male.mp3"


def test_the_alt_text_names_the_voice_and_says_what_is_said() -> None:
    for narrator in NarratorId:
        greeting = greeting_for(narrator)
        alt = greeting_alt(greeting)

        assert greeting.voice in alt and greeting.text in alt
        assert narrator.value in alt
        assert "\n" not in alt and "\r" not in alt, "it goes into a form header"


# ================================================================== the name (Tier A)

FEMALE_AS_HEARD = "Hi, I'm Aknar. I'll be reading to you here, whenever you'd like the company."
MALE_AS_HEARD = (
    "Hey, I'm Sedat Auger. I'll be reading to you here, whenever you'd like the company."
)


def test_each_greeting_says_its_narrators_name_exactly_once() -> None:
    """`compare_greeting` sets one slot aside; a name that appeared twice would be ambiguous."""
    for narrator in NarratorId:
        greeting = greeting_for(narrator)
        assert spoken_words(greeting.text).count(spoken_words(greeting.voice)[0]) == 1


def test_a_name_the_transcriber_spelled_differently_is_set_aside_and_reported() -> None:
    """**What the first real render found.** The transcriber wrote Achernar as "Aknar" and
    Sadaltager as "Sedat Auger" and, on a second take, "Sebal tager": two words for one, on a
    name that is in no dictionary. Compared like the rest, that fails every clip on a spelling
    guess. Whether the name is *pronounced* right is for a person, and is reported."""
    diff, name = compare_greeting(greeting_for(NarratorId.FEMALE), FEMALE_AS_HEARD)
    assert diff.errors == 0 and name == "aknar"

    diff, name = compare_greeting(greeting_for(NarratorId.MALE), MALE_AS_HEARD)
    assert diff.errors == 0 and name == "sedat auger"

    diff, name = compare_greeting(
        greeting_for(NarratorId.MALE), MALE_AS_HEARD.replace("Sedat Auger", "Sebal tager")
    )
    assert diff.errors == 0 and name == "sebal tager"


def test_a_name_heard_as_itself_is_returned_and_nothing_is_set_aside() -> None:
    diff, name = compare_greeting(greeting_for(NarratorId.FEMALE), FEMALE_TEXT)

    assert diff.errors == 0 and name == "achernar"


def test_a_dropped_name_is_not_set_aside() -> None:
    """The greeting exists to say the name. A clip that never says it must fail, and a
    comparison that set the slot aside could not see that."""
    diff, name = compare_greeting(
        greeting_for(NarratorId.FEMALE),
        "Hi, I'm. I'll be reading to you here, whenever you'd like the company.",
    )

    assert name is None
    assert diff.errors == 1 and diff.missing == ("achernar",)


def test_a_run_longer_than_a_name_is_not_set_aside() -> None:
    """Three words in the name's place is a transcriber failing on a rare word. More is the
    voice saying something else."""
    assert NAME_SLOT_MAX_WORDS == 3
    stretched = (
        "Hi, I'm a cher nar star. I'll be reading to you here, whenever you'd like the company."
    )

    diff, name = compare_greeting(greeting_for(NarratorId.FEMALE), stretched)

    assert name is None
    assert diff.errors > 0


def test_only_the_name_is_set_aside() -> None:
    """A misspelt name does not excuse a difference anywhere else in the sentence."""
    heard = "Hello there, I'm Aknar. I'll be reading to you here, whenever you'd like the company."

    diff, name = compare_greeting(greeting_for(NarratorId.FEMALE), heard)

    assert name == "aknar"
    assert diff.errors == 2, "'hi' heard as 'hello there' still counts"
    check = NarrationCheck(
        reading=NarrationReading(transcript=heard, ending=NarrationEnding.CLEAN),
        diff=diff,
        spend=TokenSpend(node=GUARD_NODE, model=MODEL),
    )
    assert check.severity is GuardSeverity.MAJOR


def test_a_name_that_is_not_in_the_sentence_is_an_error() -> None:
    """Not a shrug: the constants and the voices have drifted apart."""
    orphan = NarratorGreeting(narrator=NarratorId.FEMALE, text="Hello there, nice to meet you.")

    with pytest.raises(ValueError, match="Achernar"):
        compare_greeting(orphan, "Hello there, nice to meet you.")


def test_a_misheard_name_does_not_hold_a_greeting_and_the_clip_says_so(tmp_path: Path) -> None:
    """The rest of the sentence is exact, so the clip is not held — and it reports the name as
    heard, from the cache on a second render as much as from the first."""
    llm = _hears(FEMALE_AS_HEARD)

    first = _render(tmp_path, llm=llm)
    second = _render(tmp_path, llm=llm)

    for clip in (first, second):
        assert clip.check is not None
        assert clip.severity is GuardSeverity.EXACT and clip.uploadable
        assert clip.name_heard == "aknar"
    assert second.from_cache and len(llm.calls) == 1


def test_a_greeting_that_never_says_the_name_is_held(tmp_path: Path) -> None:
    """Every other word is exact, and the greeting is still wrong: it is the one word the
    comparison sets aside, so the clip's own verdict has to notice it is missing."""
    dropped = "Hi, I'm. I'll be reading to you here, whenever you'd like the company."
    backend = FakeSpeechBackend()
    llm = ScriptedLLM(
        [],
        defaults={GUARD_NODE: NarrationReading(transcript=dropped, ending=NarrationEnding.CLEAN)},
    )

    clip = _render(tmp_path, backend=backend, llm=llm)

    assert clip.name_heard is None
    assert clip.severity is GuardSeverity.MAJOR and not clip.uploadable
    assert len(backend.requests) == 2, "regenerated once, then kept and named"


# ============================================================ the ceiling and the money (Tier A)


def test_the_ceiling_admits_a_call_and_leaves_room_for_a_regeneration() -> None:
    """A ceiling under one call's worst case refuses the first call, so nothing would ever run.
    The budget reserves Cloud TTS's longest possible response, and that is most of it."""
    greeting = greeting_for(NarratorId.FEMALE)
    request_bytes = len(greeting.spoken.encode()) + len(greeting_direction().encode())
    worst = worst_case_usd(model="gemini-2.5-flash-tts", request_bytes=request_bytes)

    assert worst < GREETING_CEILING_USD
    assert GREETING_CEILING_USD - worst > 0.02, "room for what two clips actually cost"


def test_a_call_whose_worst_case_would_cross_the_ceiling_is_refused_before_it_is_made(
    tmp_path: Path,
) -> None:
    backend = FakeSpeechBackend()
    budget = NarrationBudget(ceiling_usd=GREETING_CEILING_USD, spent_usd=0.10)

    with pytest.raises(BudgetExceededError, match="ceiling"):
        _render(tmp_path, backend=backend, budget=budget)

    assert backend.requests == [], "no call is made that the budget refused"


def test_a_rendered_greeting_is_never_bought_twice(tmp_path: Path) -> None:
    """Cached by what was asked, on disk before anything else can fail — and the listening
    model's reading is cached with it."""
    backend = FakeSpeechBackend()
    llm = _hears(FEMALE_TEXT)
    spent: list[TokenSpend] = []

    first = _render(tmp_path, backend=backend, llm=llm, spent=spent)
    second = _render(tmp_path, backend=backend, llm=llm, spent=spent)

    assert len(backend.requests) == 1
    assert len(llm.calls) == 1, "the second run heard the same bytes from disk"
    assert [s.node for s in spent] == [GREETING_NODE, GUARD_NODE]
    assert first.from_cache is False and second.from_cache is True
    assert first.sha256 == second.sha256, "the same bytes, twice"
    assert list((tmp_path / "raw").glob("*.wav")) and list((tmp_path / "raw").glob("*.json"))


def test_regeneration_is_bounded_and_keeps_the_better_attempt(tmp_path: Path) -> None:
    """One more attempt for a greeting the guard calls major, then the better one is kept —
    never a third bet."""
    backend = FakeSpeechBackend()
    llm = ScriptedLLM(
        [
            NarrationReading(transcript="wrong words entirely", ending=NarrationEnding.CLEAN),
            NarrationReading(transcript=FEMALE_TEXT, ending=NarrationEnding.CLIPPED),
        ]
    )
    spent: list[TokenSpend] = []

    clip = _render(tmp_path, backend=backend, llm=llm, spent=spent)

    assert len(backend.requests) == 2
    assert clip.attempt == 2 and clip.attempts_made == 2
    assert clip.check is not None and clip.check.passed
    assert [s.node for s in spent] == [GREETING_NODE, GUARD_NODE, GREETING_NODE, GUARD_NODE]


def test_a_greeting_that_never_passes_is_still_returned_and_named(tmp_path: Path) -> None:
    backend = FakeSpeechBackend()
    llm = ScriptedLLM(
        [],
        defaults={
            GUARD_NODE: NarrationReading(transcript="nothing like it", ending=NarrationEnding.CLEAN)
        },
    )

    clip = _render(tmp_path, backend=backend, llm=llm)

    assert len(backend.requests) == 2, "bounded: two attempts, not a loop"
    assert clip.check is not None and not clip.check.passed
    assert not clip.uploadable


def test_a_greeting_far_longer_than_its_words_is_major_even_when_the_transcript_is_exact(
    tmp_path: Path,
) -> None:
    """**The failure the first audition found, and the transcriber hid.** A direction spoken
    aloud before the text left nine of twelve transcripts reading word for word; only the pace
    gave them away. The pace decides on its own."""
    backend = FakeSpeechBackend(seconds_per_char=0.26)
    llm = ScriptedLLM(
        [],
        defaults={
            GUARD_NODE: NarrationReading(transcript=FEMALE_TEXT, ending=NarrationEnding.CLEAN)
        },
    )

    clip = _render(tmp_path, backend=backend, llm=llm)

    assert clip.check is not None and clip.check.severity is GuardSeverity.EXACT
    assert clip.articulation_wpm < MIN_NATURAL_WPM
    assert clip.severity is GuardSeverity.MAJOR and not clip.passed and not clip.uploadable
    assert len(backend.requests) == 2, "regenerated once, then kept and named"


def test_a_timed_out_attempt_is_counted_as_spent(tmp_path: Path) -> None:
    backend = FakeSpeechBackend(failures=[google_error(504, "slow")])
    spent: list[TokenSpend] = []

    _render(tmp_path, backend=backend, spent=spent)

    speech = [s for s in spent if s.node == GREETING_NODE]
    assert len(speech) == 2, "the ledger may over-report a timeout; it must not under-report"


def test_a_run_that_dies_on_a_timeout_still_counts_it(tmp_path: Path) -> None:
    from zoomout_pipeline.llm.ratelimit import MAX_RETRIES

    backend = FakeSpeechBackend(
        failures=[google_error(504, "Deadline Exceeded")]
        + [google_error(503, "Network is unreachable")] * (MAX_RETRIES - 1)
    )
    spent: list[TokenSpend] = []

    with pytest.raises(SpeechError):
        _render(tmp_path, backend=backend, spent=spent)

    assert len(spent) == 1 and spent[0].output_tokens > 0, "one timeout, estimated and charged"
    assert not (tmp_path / "raw").exists() or not list((tmp_path / "raw").glob("*.wav"))


def test_audio_that_cannot_be_read_is_kept_and_still_charged(tmp_path: Path) -> None:
    """Paid for is paid for. The raw response is on disk before anything tries to read it, and
    the ledger counts it before the error surfaces."""

    class Garbled(FakeSpeechBackend):
        def synthesize_speech(self, *, request: object, retry: object, timeout: float) -> object:
            self.requests.append(request)

            class _Response:
                audio_content = b"RIFF" + bytes(48_040)

            return _Response()

    spent: list[TokenSpend] = []

    with pytest.raises(AudioError):
        _render(tmp_path, backend=Garbled(), spent=spent)

    assert len(list((tmp_path / "raw").glob("*.wav"))) == 1
    assert not list((tmp_path / "raw").glob("*.partial"))
    assert len(spent) == 1 and spent[0].output_tokens == 25, "about one second, charged"


def test_a_guard_outage_holds_the_greeting_because_a_transcript_is_a_deliverable(
    tmp_path: Path,
) -> None:
    """A Leaf's clip is attached with a note when nobody could listen to it. A greeting is not:
    what the clip actually said is part of what this package reports."""
    clip = _render(tmp_path, llm=DownLLM())

    assert clip.guard_failed and clip.check is None
    assert clip.passed, "the pace is natural, so it is not a failed clip"
    assert not clip.uploadable, "but nobody heard it"


# ======================================================================= the ledger (Tier A)


def test_spend_is_on_disk_after_every_call(tmp_path: Path) -> None:
    """A crash between two calls must not take the first one off the ledger."""
    path = tmp_path / "spend.json"
    ledger = GreetingLedger(path)
    on_disk: list[int] = []

    def record(narrator: NarratorId, spend: TokenSpend) -> None:
        ledger.record(narrator, spend)
        on_disk.append(len(GreetingLedger(path).entries))  # a fresh process reading the file

    run_greetings(
        speech=speech_client(FakeSpeechBackend()),
        store=ClipStore(tmp_path / "audio"),
        budget=NarrationBudget(ceiling_usd=GREETING_CEILING_USD),
        record=record,
        guard=Guard(llm=_hears_both(), model=MODEL),
        client=None,
    )

    assert on_disk == [1, 2, 3, 4], "speech and listening, for each of two narrators"
    reopened = GreetingLedger(path)
    assert reopened.total_usd == pytest.approx(ledger.total_usd)
    assert reopened.total_usd > 0
    assert reopened.usd_for(NarratorId.FEMALE) > 0 and reopened.usd_for(NarratorId.MALE) > 0
    assert not list(tmp_path.glob("*.partial")), "written whole or not at all"


def test_the_ceiling_is_for_the_package_not_the_invocation(tmp_path: Path) -> None:
    """A budget that started at zero each time would let every invocation spend the whole
    ceiling. The ledger is what carries it across."""
    path = tmp_path / "spend.json"
    earlier = GreetingLedger(path)
    earlier.record(
        NarratorId.FEMALE,
        TokenSpend(node=GREETING_NODE, model="gemini-2.5-flash-tts", output_tokens=15_000),
    )
    backend = FakeSpeechBackend()

    resumed = GreetingLedger(path)
    assert resumed.total_usd == pytest.approx(0.15)
    with pytest.raises(BudgetExceededError):
        _run(
            tmp_path / "audio",
            backend=backend,
            budget=NarrationBudget(ceiling_usd=GREETING_CEILING_USD, spent_usd=resumed.total_usd),
        )

    assert backend.requests == []


@pytest.mark.parametrize(
    "content", ["not json at all", '{"entries": "nope"}', '{"entries": [{"narrator": "x"}]}', "{}"]
)
def test_an_unreadable_ledger_is_an_error_not_a_fresh_start(tmp_path: Path, content: str) -> None:
    """Starting from zero would silently turn a ceiling into a suggestion."""
    path = tmp_path / "spend.json"
    path.write_text(content, encoding="utf-8")

    with pytest.raises(GreetingLedgerError, match="ceiling"):
        GreetingLedger(path)


# ==================================================================== the upload (Tier A / B)


def test_both_greetings_are_uploaded_to_media_and_nothing_else_is_touched(
    tmp_path: Path,
) -> None:
    """**The pipeline writes only what it was asked to.** A greeting has no Leaf, no Track and
    no draft: the CMS is asked to find, upload and serve Media, and never anything else."""
    cms = FakePayload()

    result = _run(tmp_path, client=cms)

    assert set(cms.calls) <= {"find_media", "upload_media", "fetch_media"}
    assert [upload["filename"] for upload in cms.uploads] == [
        "narrator-greeting-female.mp3",
        "narrator-greeting-male.mp3",
    ]
    assert {upload["mimeType"] for upload in cms.uploads} == {"audio/mpeg"}
    assert [upload["alt"] for upload in cms.uploads] == [
        greeting_alt(greeting) for greeting in greeting_script()
    ]
    assert [stored.narrator for stored in result.uploaded] == list(NarratorId)
    for stored, clip in zip(result.uploaded, result.rendered, strict=True):
        assert stored.passed and stored.uploaded
        assert stored.url == f"/api/media/file/{stored.filename}"
        assert stored.duration_seconds == clip.duration_seconds
        assert stored.sha256 == clip.sha256
        assert cms.blobs[stored.url] == clip.mp3, (
            "Payload holds exactly the bytes that were checked"
        )


def test_running_it_again_uploads_nothing_and_buys_nothing(tmp_path: Path) -> None:
    """Idempotent and free: the audio, the listening and the upload are each found first."""
    cms = FakePayload()
    first = _run(tmp_path, client=cms)
    backend = FakeSpeechBackend()

    second = _run(tmp_path, backend=backend, llm=_hears(), client=cms)  # a listener with no script

    assert backend.requests == []
    assert len(cms.uploads) == 2, "two uploads, ever"
    assert [stored.uploaded for stored in second.uploaded] == [False, False]
    assert [stored.media_id for stored in second.uploaded] == [
        stored.media_id for stored in first.uploaded
    ]


def test_a_partial_transport_failure_resumes_without_a_second_upload(tmp_path: Path) -> None:
    """The one real branch in the upload: the first document lands and the second does not."""

    class FlakyPayload(FakePayload):
        def __init__(self) -> None:
            super().__init__()
            self.armed = True

        def upload_media(
            self, *, data: bytes, filename: str, alt: str, mime_type: str = "image/png"
        ) -> dict[str, Any]:
            if self.armed and filename.endswith("-male.mp3"):
                self.armed = False
                raise PayloadError("connection reset by peer")
            return super().upload_media(data=data, filename=filename, alt=alt, mime_type=mime_type)

    cms = FlakyPayload()
    with pytest.raises(PayloadError):
        _run(tmp_path, client=cms)
    assert [upload["filename"] for upload in cms.uploads] == ["narrator-greeting-female.mp3"]

    resumed = _run(tmp_path, llm=_hears(), backend=FakeSpeechBackend(), client=cms)

    assert [upload["filename"] for upload in cms.uploads] == [
        "narrator-greeting-female.mp3",
        "narrator-greeting-male.mp3",
    ], "the female clip was found, not uploaded again"
    assert [stored.uploaded for stored in resumed.uploaded] == [False, True]


def test_a_document_that_holds_different_bytes_is_refused_and_named(tmp_path: Path) -> None:
    """The stable filename carries no hash, so a hit only means *a* file. The machine key can
    create Media but never delete or replace it, so this needs a person — and says so."""
    cms = FakePayload()
    url = "/api/media/file/narrator-greeting-female.mp3"
    cms.media["narrator-greeting-female.mp3"] = {
        "id": 7,
        "filename": "narrator-greeting-female.mp3",
        "alt": "an older take",
        "mimeType": "audio/mpeg",
        "url": url,
    }
    cms.blobs[url] = b"somebody else's bytes"

    with pytest.raises(GreetingUploadError, match=r"Media 7.*different bytes.*delete"):
        _run(tmp_path, client=cms)

    assert cms.uploads == [], "nothing was uploaded"


def test_bytes_that_are_not_the_ones_uploaded_are_refused(tmp_path: Path) -> None:
    cms = FakePayload()
    cms.serve_override = lambda data: data + b"\x00"

    with pytest.raises(GreetingUploadError, match="not the one checked"):
        _run(tmp_path, client=cms)


def test_a_document_stored_under_another_name_is_reported_not_passed(tmp_path: Path) -> None:
    """Payload renames a clashing upload, and a renamed clip is not the stable reference the
    app was promised."""

    class Renaming(FakePayload):
        def upload_media(
            self, *, data: bytes, filename: str, alt: str, mime_type: str = "image/png"
        ) -> dict[str, Any]:
            doc = super().upload_media(data=data, filename=filename, alt=alt, mime_type=mime_type)
            doc["filename"] = filename.replace(".mp3", "-1.mp3")
            return doc

    result = _run(tmp_path, client=Renaming())

    assert all(not stored.passed for stored in result.uploaded)
    assert "was stored as" in result.uploaded[0].problems[0]


def test_both_greetings_are_held_when_either_fails_and_the_cms_is_never_called(
    tmp_path: Path,
) -> None:
    """Both or neither: one narrator's introduction without the other's is a half-built beat.
    **A clip that says other words does not proceed — not with a flag.**"""
    fine = _render(tmp_path / "a", narrator=NarratorId.FEMALE)
    slow = _render(
        tmp_path / "b",
        narrator=NarratorId.MALE,
        backend=FakeSpeechBackend(seconds_per_char=0.26),
        llm=ScriptedLLM(
            [],
            defaults={
                GUARD_NODE: NarrationReading(transcript=MALE_TEXT, ending=NarrationEnding.CLEAN)
            },
        ),
    )
    cms = FakePayload()

    with pytest.raises(GreetingHeldError, match="male"):
        upload_greetings(client=cms, clips=[fine, slow])

    assert cms.calls == [] and cms.uploads == []


def test_an_unheard_greeting_holds_both(tmp_path: Path) -> None:
    heard = _render(tmp_path / "a", narrator=NarratorId.FEMALE)
    unheard = _render(tmp_path / "b", narrator=NarratorId.MALE, llm=DownLLM())
    cms = FakePayload()

    with pytest.raises(GreetingHeldError, match="nobody could listen"):
        upload_greetings(client=cms, clips=[heard, unheard])

    assert cms.calls == []


def test_one_narrator_alone_is_refused(tmp_path: Path) -> None:
    only = _render(tmp_path, narrator=NarratorId.FEMALE)
    cms = FakePayload()

    with pytest.raises(GreetingUploadError, match="together or not at all"):
        upload_greetings(client=cms, clips=[only])
    with pytest.raises(GreetingUploadError, match="together or not at all"):
        upload_greetings(client=cms, clips=[only, only])

    assert cms.calls == []


def test_an_upload_returns_the_id_and_url_payload_reported(tmp_path: Path) -> None:
    clip = _render(tmp_path)
    cms = FakePayload()

    stored = upload_greeting(client=cms, clip=clip)

    assert stored.media_id == 900
    assert stored.url == "/api/media/file/narrator-greeting-female.mp3"
    assert stored.filename == "narrator-greeting-female.mp3"


# ============================================================================ files on disk


def test_a_greeting_that_passes_is_kept_as_final_and_one_that_fails_as_held(
    tmp_path: Path,
) -> None:
    """A failed clip is never sitting under the name of a good one."""
    good = _run(tmp_path)
    for narrator, clip in zip(NarratorId, good.rendered, strict=True):
        path = tmp_path / "final" / f"narrator-greeting-{narrator.value}.mp3"
        assert good.files[narrator] == path and path.read_bytes() == clip.mp3
    assert not (tmp_path / "held").exists()

    bad = _run(
        tmp_path / "second",
        backend=FakeSpeechBackend(seconds_per_char=0.26),
        llm=ScriptedLLM(
            [],
            defaults={
                GUARD_NODE: NarrationReading(transcript=FEMALE_TEXT, ending=NarrationEnding.CLEAN)
            },
        ),
    )
    assert all(not clip.uploadable for clip in bad.rendered)
    assert all(path.parent.name == "held" for path in bad.files.values())
    assert not (tmp_path / "second" / "final").exists()


def test_a_clip_that_later_fails_does_not_leave_a_stale_final_copy(tmp_path: Path) -> None:
    """One copy, in the folder its verdict says. A clip that used to pass and now does not must
    not leave a "good" file behind for somebody to upload, and the reverse."""
    store = ClipStore(tmp_path)
    good = _render(tmp_path / "work")
    unheard = replace(good, check=None, guard_failed=True)
    assert good.uploadable and not unheard.uploadable

    final = _keep_on_disk(store, good)
    assert final == tmp_path / "final" / "narrator-greeting-female.mp3" and final.exists()

    held = _keep_on_disk(store, unheard)
    assert held == tmp_path / "held" / "narrator-greeting-female.mp3" and held.exists()
    assert not final.exists(), "the stale copy is gone"

    again = _keep_on_disk(store, good)
    assert again == final and again.read_bytes() == good.mp3
    assert not held.exists()


# ============================================================================== the command


def test_the_command_is_registered_and_refuses_to_run_off_vertex(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Refused before anything is built or sent: the listening goes through Vertex, and speech
    bills a named project."""
    from pydantic import SecretStr

    settings = PipelineSettings(database_url=TEST_DATABASE_URL, gemini_api_key=SecretStr("x"))
    monkeypatch.setattr(cli, "get_settings", lambda: settings)

    result = CliRunner().invoke(cli.app, ["generate-greetings"])

    assert result.exit_code == 2
    assert "ZOOMOUT_PIPELINE_USE_VERTEX" in result.output

    helped = CliRunner().invoke(cli.app, ["generate-greetings", "--help"])
    assert helped.exit_code == 0
    assert "--render-only" in helped.output and "--max-attempts" in helped.output
