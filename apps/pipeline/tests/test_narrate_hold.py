"""VO-4.1 Part A — `narrate` holds a Leaf on its own, does just the Leaves it is told, says what it
will buy, and cannot shrink a review. Tier A.

**Everything here runs the real command over several Leaves**, with the real render, the real raw
cache, the real attach logic over the fake CMS, and a listening model that hears each clip say the
text it was made from. Several Leaves because the bug these pin is about the *other* Leaves: VO-4's
run found one Leaf whose text had been edited, stopped there, and left eight clean ones undone.
And a listener that counts its calls, because "nothing was listened to for the held Leaf" has to be
a number and not an intention.

What each Leaf says is made different from the others on purpose (`distinct_leaf`): the raw cache
is keyed by text, so Leaves that shared their words would share their clips and a Leaf could not
drift on its own.
"""

from __future__ import annotations

import copy
import hashlib
import re
import shutil
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import Any, TypeVar, cast

import numpy as np
import pytest
import typer.main
from pydantic import BaseModel
from typer.testing import CliRunner

from zoomout_pipeline import cli
from zoomout_pipeline.assets.audio import Pcm, decode_wav, encode_wav
from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.narration import (
    NARRATED_FIELDS,
    NARRATOR_VOICES,
    NarratedSlide,
    direction_for,
    narration_script,
)
from zoomout_pipeline.assets.narration_guard import NarrationEnding, NarrationReading
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph import narration_nodes
from zoomout_pipeline.graph.narration_nodes import (
    NARRATION_NODE,
    ClipStore,
    Guard,
    clip_key,
    existing_review_clips,
    existing_review_leaves,
    leaves_label,
    missing_first_attempts,
    render_line,
    review_target,
)
from zoomout_pipeline.llm.client import GenerationResult
from zoomout_pipeline.models import NarratorId

from .narration_fakes import (
    FakePayload,
    FakeSpeechBackend,
    google_error,
    leaf_doc,
    leaked_window,
    speech_client,
)

T = TypeVar("T", bound=BaseModel)

MODEL = "gemini-3.6-flash"
BOOK = "Ikigai"
TEMPO = 1.3


# ------------------------------------------------------------------------------- the world


def distinct_leaf(order: int) -> dict[str, Any]:
    """A Leaf whose four narrated fields say something no other Leaf's do."""
    doc = leaf_doc(order=order, leaf_id=300 + order)
    for group, field in NARRATED_FIELDS.values():
        doc[group][field] = f"{doc[group][field]} Number {order} adds words of its own here."
    return doc


def edit_payoff(doc: dict[str, Any]) -> str:
    """The Leaf's payoff changed after it was narrated. Returns what it said before."""
    before = str(doc["payoff"]["body"])
    doc["payoff"]["body"] = before + " Then somebody reworded the end of it."
    return before


def texts_of(doc: dict[str, Any]) -> list[str]:
    return [line.text for line in narration_script(doc)]


class ContentBackend(FakeSpeechBackend):
    """A fake voice whose audio depends on *what it was asked to say*, not only on how long that is.

    The stock fake renders the same bytes for any two texts of one length, so Leaf 1's payoff and
    Leaf 2's are one clip to it, and a listener keyed by the bytes cannot tell which Leaf it is
    hearing. A very quiet noise floor seeded from the text makes every text its own audio, well
    under the level at which anything counts as sound, so levelling, edging and pace behave as
    they do for the stock fake.
    """

    def synthesize_speech(self, *, request: Any, retry: Any, timeout: float) -> Any:
        response = super().synthesize_speech(request=request, retry=retry, timeout=timeout)
        pcm = decode_wav(bytes(response.audio_content))
        seed = int.from_bytes(
            hashlib.sha256(request.input.text.encode("utf-8")).digest()[:8], "big"
        )
        floor = np.random.default_rng(seed).standard_normal(len(pcm.samples)) * 0.0005
        wav = encode_wav(Pcm(samples=(pcm.samples + floor).astype(np.float32), rate=pcm.rate))

        class _Response:
            audio_content = wav

        return _Response()


def prime(root: Path, docs: Sequence[dict[str, Any]]) -> dict[str, str]:
    """Buy every clip of every Leaf from the fake voice, so the raw cache holds them, and return
    what a listener should hear for each: `{sha256 of the mp3: the text it was made from}`.

    Rendered at the tempo the command will use, so its bytes are the command's bytes. **It refuses
    to return a registry in which two different texts share their bytes**: a listener built on
    one would hear the wrong text for one of them and every test on top of it would mean less.
    """
    heard: dict[str, str] = {}
    backend = ContentBackend()
    for doc in docs:
        for voice in NARRATOR_VOICES.values():
            for line in narration_script(doc):
                clip = render_line(
                    line=line,
                    speech=speech_client(backend),
                    voice=voice,
                    prompt=direction_for(line.slide),
                    store=ClipStore(root),
                    budget=NarrationBudget(ceiling_usd=3.00),
                    record=lambda _spend: None,
                    guard=None,
                    max_attempts=1,
                    tempo=TEMPO,
                )
                assert heard.setdefault(clip.sha256, line.text) == line.text, (
                    "two different texts rendered to the same bytes"
                )
    return heard


class EchoListener:
    """A listening model that hears each clip say the text it was made from, and counts.

    An unregistered clip is a `KeyError`: if the command listens to something the test did not
    expect it to, the test fails loudly rather than agreeing with it. `wrong` names clips it
    mishears, so a Leaf can be held for the old reason too.
    """

    def __init__(self, heard: dict[str, str], *, wrong: set[str] | None = None) -> None:
        self.heard = heard
        self.wrong = wrong or set()
        self.calls: list[str] = []

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
        assert audio, "the guard listens to audio"
        digest = hashlib.sha256(audio[0]).hexdigest()
        self.calls.append(digest)
        transcript = "nothing like it" if digest in self.wrong else self.heard[digest]
        reading = NarrationReading(transcript=transcript, ending=NarrationEnding.CLEAN)
        return GenerationResult(
            value=cast(T, reading),
            spend=TokenSpend(node=node, model=model, input_tokens=1000, output_tokens=500),
        )


class ExplodingBackend(FakeSpeechBackend):
    """Cloud TTS for a run that may not synthesise: any call at all is a failure."""

    def __init__(self) -> None:
        super().__init__()
        self.calls = 0

    def synthesize_speech(self, *, request: Any, retry: Any, timeout: float) -> Any:
        self.calls += 1
        raise AssertionError("Cloud TTS was called")


class Session:
    """What `narrate` reads off `_Narration`, over the real pieces."""

    def __init__(
        self,
        root: Path,
        backend: FakeSpeechBackend,
        docs: Sequence[dict[str, Any]],
        *,
        listener: EchoListener | None = None,
        ceiling: float = 3.00,
    ) -> None:
        self.state = SimpleNamespace(
            cms_narration={},
            cms_leaf_ids={str(doc["orderIndex"]): int(doc["id"]) for doc in docs},
        )
        self.leaves = sorted(docs, key=lambda doc: int(doc["orderIndex"]))
        self.speech = speech_client(backend)
        self.store = ClipStore(root)
        self.budget = NarrationBudget(ceiling_usd=ceiling)
        self.guard = Guard(llm=listener, model=MODEL) if listener is not None else None
        self.book_title = BOOK
        self.client = FakePayload(*docs)
        self.spends: list[TokenSpend] = []

    def record(self, spend: TokenSpend) -> None:
        self.spends.append(spend)

    def checkpoint(self, **_values: Any) -> None:
        return None

    @property
    def attached(self) -> list[int]:
        """The Leaf ids that were written to, in order."""
        return [leaf_id for leaf_id, _patch in self.client.patches]

    @property
    def speech_spends(self) -> list[TokenSpend]:
        return [spend for spend in self.spends if spend.node == NARRATION_NODE]


@pytest.fixture
def drive(monkeypatch: pytest.MonkeyPatch) -> Any:
    """`drive(session, *args)` runs `narrate --run-id ikigai <args>` against `session`."""

    def run(session: Session, *args: str) -> Any:
        @contextmanager
        def fake_run_context() -> Iterator[tuple[None, None]]:
            yield None, None

        monkeypatch.setattr(cli, "run_context", fake_run_context)
        monkeypatch.setattr(cli, "_Narration", lambda _graph, _deps, _run, *, guard: session)
        return CliRunner().invoke(cli.app, ["narrate", "--run-id", "ikigai", *args])

    return run


@pytest.fixture(scope="module")
def primed(
    tmp_path_factory: pytest.TempPathFactory,
) -> tuple[Path, list[dict[str, Any]], dict[str, str]]:
    """Three Leaves whose clips are bought once for the whole module: priming is the slow part,
    and every test needs the same one."""
    root = tmp_path_factory.mktemp("primed")
    docs = [distinct_leaf(order) for order in (1, 2, 3)]
    return root, docs, prime(root, docs)


@pytest.fixture
def world(
    tmp_path: Path, primed: tuple[Path, list[dict[str, Any]], dict[str, str]]
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Three Leaves and a raw cache that holds all their clips, private to this test: a copy, so
    that a test which edits a Leaf or reads `raw/` afterwards cannot touch another's."""
    template, docs, heard = primed
    shutil.copytree(template / "raw", tmp_path / "raw")
    return copy.deepcopy(docs), dict(heard)


def tree(folder: Path) -> dict[str, str]:
    return {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(folder.iterdir())
    }


# ================================================================ A1 — a Leaf is held on its own


def test_a_drifted_leaf_is_held_before_any_listen_and_the_run_carries_on(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """**The VO-4 failure, reproduced across three Leaves.** Leaf 2's payoff was edited after it
    was narrated, so there is no clip for the text it holds now. A run that may not synthesise
    holds *that Leaf* - and goes on to the Leaf after it."""
    docs, heard = world
    narrated_before = {int(doc["orderIndex"]): texts_of(doc) for doc in docs}
    edit_payoff(docs[1])
    listener, backend = EchoListener(heard), ExplodingBackend()
    session = Session(tmp_path, backend, docs, listener=listener)

    result = drive(session, "--no-synthesis")
    out = result.output

    assert result.exit_code == 1, out
    # Held, named by slide and narrator - and only the clips that are missing.
    assert "HELD — NOT ON DISK: payoff (female, Achernar), payoff (male, Sadaltager)" in out
    assert "summary (female" not in out and "takeaway (male" not in out
    assert "HALTED" not in out and "Traceback" not in out
    # The Leaf after it was done, and the one before it. Leaf 2 was never written to.
    assert session.attached == [301, 303], out
    assert out.count("draft written") == 2
    # Nothing was listened to for the held Leaf: sixteen listens, and none of them its clips.
    leaf_two_texts = set(narrated_before[2]) | set(texts_of(docs[1]))
    assert len(listener.calls) == 16
    assert all(heard[digest] not in leaf_two_texts for digest in listener.calls)
    # No speech was bought or even asked for, and the only spend is the guard's.
    assert backend.calls == 0 and session.speech_spends == []
    assert len(session.spends) == 16
    # The end of the run gives the held Leaf its own heading, the cause, and both ways out.
    assert "1 Leaf HELD — NOT ON DISK" in out
    assert "found while rendering" not in out, "the pre-flight found it: nothing was listened to"
    assert "narrate --run-id ikigai --leaf 2" in out and "revert the text" in out
    assert "text changed after it was narrated" in out
    # And never the words, not even twelve characters of them, from any Leaf.
    for doc in docs:
        for text in [*texts_of(doc), *narrated_before[int(doc["orderIndex"])]]:
            assert leaked_window(text, out) is None, "named by slide and narrator, not by words"


def test_two_drifted_leaves_are_each_held_and_the_rest_attach(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    docs, heard = world
    edit_payoff(docs[0])
    edit_payoff(docs[2])
    listener = EchoListener(heard)
    session = Session(tmp_path, ExplodingBackend(), docs, listener=listener)

    result = drive(session, "--no-synthesis")

    assert result.exit_code == 1
    assert "2 Leaves HELD — NOT ON DISK" in result.output
    assert "--leaf 1 --leaf 3" in result.output
    assert session.attached == [302] and len(listener.calls) == 8


def test_a_run_over_cached_audio_that_has_not_drifted_holds_nothing(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """The other side of the guard: the pre-flight does not hold a Leaf for no reason."""
    docs, heard = world
    session = Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard))

    result = drive(session, "--no-synthesis")

    assert result.exit_code == 0, result.output
    assert "NOT ON DISK" not in result.output
    assert session.attached == [301, 302, 303]


def test_render_only_holds_a_drifted_leaf_too_and_writes_nothing(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    docs, heard = world
    edit_payoff(docs[1])
    listener = EchoListener(heard)
    session = Session(tmp_path, ExplodingBackend(), docs, listener=listener)

    result = drive(session, "--no-synthesis", "--render-only")

    assert result.exit_code == 1
    assert "HELD — NOT ON DISK" in result.output
    assert session.attached == [] and session.client.calls == []
    assert len(listener.calls) == 16, "rendered and listened to for the Leaves that are there"


def test_a_leaf_the_guard_fails_is_still_held_and_the_exit_code_says_so(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """**Held for any reason is exit 1**, the old reason included: a clip the listener hears wrong
    holds its Leaf (and a retry that is not on disk ends the retries), and the run carries on."""
    docs, heard = world
    leaf_two_payoff = next(
        line.text for line in narration_script(docs[1]) if line.slide is NarratedSlide.PAYOFF
    )
    # Both narrators' clips of one text are the same bytes in the fake, so both are misheard.
    payoff = next(digest for digest, text in heard.items() if text == leaf_two_payoff)
    session = Session(
        tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard, wrong={payoff})
    )

    result = drive(session, "--no-synthesis")

    assert result.exit_code == 1, result.output
    assert "NOT ON DISK" not in result.output, "a different reason, a different heading"
    assert "1 Leaves HELD, their audio not attached" in result.output
    assert session.attached == [301, 303]


def test_a_budget_failure_still_stops_the_whole_run(tmp_path: Path, drive: Any, world: Any) -> None:
    """Only two things stop a run, and this is the first: the ceiling, before a call that could
    cross it. The Leaves after it are never reached."""
    docs, heard = world
    session = Session(
        tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard), ceiling=0.01
    )

    result = drive(session, "--no-synthesis")

    assert result.exit_code == 1
    assert "HALTED:" in result.output and "ceiling" in result.output
    assert "leaf  2" not in result.output and "leaf  3" not in result.output
    assert session.attached == []


def test_a_speech_failure_still_stops_the_whole_run(tmp_path: Path, drive: Any) -> None:
    """The second: a synthesis that fails. A run that may synthesise, over an empty cache."""
    docs = [distinct_leaf(order) for order in (1, 2, 3)]
    backend = FakeSpeechBackend(failures=[google_error(400, "refused")])
    session = Session(tmp_path, backend, docs, listener=None)

    result = drive(session)

    assert result.exit_code == 1
    assert "HALTED:" in result.output
    assert "leaf  2" not in result.output
    assert session.attached == []


def test_a_not_on_disk_error_arising_mid_leaf_is_the_same_hold(
    tmp_path: Path, drive: Any, monkeypatch: pytest.MonkeyPatch, world: Any
) -> None:
    """The pre-flight is switched off here, so the render itself meets the missing clip half way
    through the Leaf. It is the same hold: that Leaf's clips are discarded and never attached,
    the run carries on, and the exit code is 1."""
    docs, heard = world
    edit_payoff(docs[1])
    monkeypatch.setattr(narration_nodes, "missing_first_attempts", lambda **_kwargs: [])
    session = Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard))

    result = drive(session, "--no-synthesis")

    assert result.exit_code == 1, result.output
    assert (
        "HELD — NOT ON DISK: Leaf 2 Payoff in Achernar (attempt 1) is not on disk" in result.output
    )
    assert "HALTED" not in result.output
    assert session.attached == [301, 303]
    assert "1 Leaf HELD — NOT ON DISK" in result.output
    # Honest about what it cost: this hold was found after two clips of the Leaf were listened to.
    assert "found while rendering: its earlier clips were already listened to" in result.output


def test_a_run_that_may_synthesise_holds_nothing_and_says_what_it_will_buy(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """A synthesising run buys the missing clips, so there is nothing to hold - but it says which
    ones, by slide and narrator and never by words, **before the first call**."""
    docs, heard = world
    edit_payoff(docs[1])
    # What the new payoff will sound like, from a store of its own so the real one lacks it.
    heard.update(prime(tmp_path / "elsewhere", [docs[1]]))
    backend = ContentBackend()
    session = Session(tmp_path, backend, docs, listener=EchoListener(heard))

    result = drive(session)
    out = result.output

    assert result.exit_code == 0, out
    assert (
        "will buy   : 2 clips — leaf 2 payoff (female, Achernar), leaf 2 payoff (male, "
        "Sadaltager); and a retry for any clip the guard fails"
    ) in out
    assert out.index("will buy") < out.index("leaf  1"), "said before the first call"
    assert len(backend.requests) == 2, "exactly the two it said"
    assert session.attached == [301, 302, 303], "and nothing was held for it"
    assert "NOT ON DISK" not in out
    for doc in docs:
        for text in texts_of(doc):
            assert leaked_window(text, out) is None


def test_a_run_with_everything_on_disk_says_it_will_buy_nothing(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    docs, heard = world
    backend = ContentBackend()
    session = Session(tmp_path, backend, docs, listener=EchoListener(heard))

    result = drive(session)

    assert "will buy   : no clip — every first attempt is already on disk" in result.output
    assert backend.requests == []


# ======================================================= the pre-flight asks the render's question


def test_the_pre_flight_agrees_with_the_render_about_what_is_on_disk(tmp_path: Path) -> None:
    """**It asks the cache's own key**, so after the render has stored a Leaf's clips the
    pre-flight finds nothing missing. A pre-flight with a key of its own is the VO-4 handoff's
    mistake: it would agree exactly when the text had not drifted and say nothing when it had."""
    doc = distinct_leaf(4)
    prime(tmp_path, [doc])
    session = Session(tmp_path, ExplodingBackend(), [doc])

    absent = missing_first_attempts(
        lines=narration_script(doc),
        narrators=NARRATOR_VOICES,
        speech=session.speech,
        store=session.store,
    )

    assert absent == []


def test_the_pre_flight_names_exactly_the_edited_slide_in_render_order(tmp_path: Path) -> None:
    doc = distinct_leaf(4)
    prime(tmp_path, [doc])
    edit_payoff(doc)
    session = Session(tmp_path, ExplodingBackend(), [doc])

    absent = missing_first_attempts(
        lines=narration_script(doc),
        narrators=NARRATOR_VOICES,
        speech=session.speech,
        store=session.store,
    )

    assert [(clip.slide, clip.narrator, clip.voice) for clip in absent] == [
        (NarratedSlide.PAYOFF, NarratorId.FEMALE, "Achernar"),
        (NarratedSlide.PAYOFF, NarratorId.MALE, "Sadaltager"),
    ]
    assert [clip.describe() for clip in absent] == [
        "payoff (female, Achernar)",
        "payoff (male, Sadaltager)",
    ]


def test_the_pre_flight_is_keyed_by_the_direction_too(tmp_path: Path) -> None:
    """The direction file is part of every raw clip's key: a different direction is every clip
    missing, not a cache hit on audio made under another one."""
    doc = distinct_leaf(4)
    prime(tmp_path, [doc])
    session = Session(tmp_path, ExplodingBackend(), [doc])

    absent = missing_first_attempts(
        lines=narration_script(doc),
        narrators=NARRATOR_VOICES,
        speech=session.speech,
        store=session.store,
        direction=lambda _slide: "A different direction entirely.",
    )

    assert len(absent) == 2 * len(NARRATED_FIELDS)


def test_the_render_stores_its_clips_under_the_key_the_pre_flight_uses(tmp_path: Path) -> None:
    doc = distinct_leaf(4)
    prime(tmp_path, [doc])
    session = Session(tmp_path, ExplodingBackend(), [doc])

    for voice in NARRATOR_VOICES.values():
        for line in narration_script(doc):
            key = clip_key(
                speech=session.speech,
                voice=voice,
                prompt=direction_for(line.slide),
                line=line,
                attempt=1,
            )
            assert session.store.raw_path(key).exists()


# ======================================================================= A2 — `narrate --leaf N`


def test_leaf_does_just_the_named_leaves_in_order_whatever_order_they_are_named(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    docs, heard = world
    listener = EchoListener(heard)
    session = Session(tmp_path, ExplodingBackend(), docs, listener=listener)

    result = drive(session, "--no-synthesis", "--leaf", "3", "--leaf", "1")
    out = result.output

    assert result.exit_code == 0, out
    assert "leaves     : 1, 3 of 3" in out
    assert session.attached == [301, 303], "in order, and not Leaf 2"
    assert out.index("leaf  1") < out.index("leaf  3") and "leaf  2" not in out
    assert len(listener.calls) == 16


def test_a_repeated_leaf_is_one_leaf(tmp_path: Path, drive: Any, world: Any) -> None:
    docs, heard = world
    session = Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard))

    result = drive(session, "--no-synthesis", "--leaf", "2", "--leaf", "2")

    assert "leaves     : 2 of 3" in result.output and session.attached == [302]


def test_an_unknown_leaf_is_refused_before_anything_runs(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    docs, heard = world
    listener, backend = EchoListener(heard), ExplodingBackend()
    session = Session(tmp_path, backend, docs, listener=listener)
    raw_before = tree(tmp_path / "raw")

    result = drive(session, "--no-synthesis", "--leaf", "1", "--leaf", "9")

    assert result.exit_code == 2
    assert "no Leaf at orderIndex 9" in result.output and "Leaves 1, 2, 3" in result.output
    assert "Nothing was done" in result.output
    assert listener.calls == [] and backend.calls == 0 and session.spends == []
    assert session.attached == [] and session.client.calls == []
    assert "leaf  1" not in result.output, "not even the valid one was started"
    assert tree(tmp_path / "raw") == raw_before


def test_leaf_with_limit_is_refused_before_the_session_is_even_built(
    drive: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    def never(*_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("the session was built for a command that should have been refused")

    @contextmanager
    def fake_run_context() -> Iterator[tuple[None, None]]:
        yield None, None

    monkeypatch.setattr(cli, "run_context", fake_run_context)
    monkeypatch.setattr(cli, "_Narration", never)

    result = CliRunner().invoke(
        cli.app, ["narrate", "--run-id", "ikigai", "--leaf", "1", "--limit", "2"]
    )

    assert result.exit_code == 2
    assert "--leaf and --limit cannot be combined" in result.output


def test_the_header_says_which_leaves_without_leaf(tmp_path: Path, drive: Any, world: Any) -> None:
    docs, heard = world

    everything = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), "--no-synthesis"
    )
    first_two = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)),
        "--no-synthesis",
        "--limit",
        "2",
    )

    assert "leaves     : all 3" in everything.output
    assert "leaves     : the first 2 of 3" in first_two.output


# ====================================================== A4 — a partial run cannot shrink a review


def _md(folder: Path, voice: str) -> str:
    return (folder / f"ikigai-narration-{voice}.md").read_text(encoding="utf-8")


def test_a_partial_run_writes_beside_a_fuller_review_and_leaves_it_alone(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """**VO-4's own accident, in both directions' first half.** A full run writes the review; a
    run over one Leaf must not replace it. The original is byte-identical afterwards."""
    docs, heard = world
    full = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), "--no-synthesis"
    )
    assert full.exit_code == 0, full.output
    review = tmp_path / "review"
    assert "12 clips" in _md(review, "achernar"), "three Leaves, four slides: the fuller review"
    before = tree(review)

    partial = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)),
        "--no-synthesis",
        "--leaf",
        "1",
    )
    after = tree(review)

    assert partial.exit_code == 0, partial.output
    assert {name: digest for name, digest in after.items() if name in before} == before, (
        "the existing review is byte-identical"
    )
    beside = sorted(set(after) - set(before))
    assert beside == [
        f"ikigai-narration-{voice}-leaves-1.{ext}"
        for voice in ("achernar", "sadaltager")
        for ext in ("html", "md", "mp3")
    ]
    assert "BESIDE the existing review (12 clips), which was left as it was" in partial.output
    assert "Partial: Leaves 1 only" in _md(review, "achernar-leaves-1")
    assert "4 clips" in _md(review, "achernar-leaves-1")


def test_a_run_that_covers_every_leaf_it_was_asked_for_and_enough_clips_overwrites(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """The second half: a run that covers everything it was asked and at least as many clips as
    the review it replaces overwrites it, as it always did, and writes nothing beside it."""
    docs, heard = world
    drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)),
        "--no-synthesis",
        "--leaf",
        "1",
        "--leaf",
        "2",
    )
    review = tmp_path / "review"
    assert "8 clips" in _md(review, "achernar") and not list(review.glob("*-leaves-*"))
    before = tree(review)

    full = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), "--no-synthesis"
    )

    assert full.exit_code == 0, full.output
    assert "12 clips" in _md(review, "achernar"), "overwritten with the larger review"
    assert tree(review) != before
    assert not list(review.glob("*-leaves-*")) and "BESIDE" not in full.output


def test_a_run_asked_for_more_than_it_covered_never_overwrites_even_with_enough_clips(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """The clause that clips alone do not catch. Leaf 1 is held, so the run covers Leaves 2 and 3
    - eight clips, as many as the review it would replace - but it was asked for three Leaves and
    covered two. That is a partial run, and it writes beside."""
    docs, heard = world
    drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)),
        "--no-synthesis",
        "--leaf",
        "2",
        "--leaf",
        "3",
    )
    review = tmp_path / "review"
    assert "8 clips" in _md(review, "achernar")
    before = tree(review)
    edit_payoff(docs[0])

    result = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), "--no-synthesis"
    )

    assert result.exit_code == 1, "Leaf 1 is held"
    after = tree(review)
    assert {name: digest for name, digest in after.items() if name in before} == before
    assert (review / "ikigai-narration-achernar-leaves-2-3.md").exists()
    assert "BESIDE the existing review (8 clips)" in result.output


def test_the_first_review_of_a_run_takes_the_standard_name_even_when_partial(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """With nothing to shrink there is no reason to be shy about the name."""
    docs, heard = world

    result = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)),
        "--no-synthesis",
        "--leaf",
        "2",
    )

    review = tmp_path / "review"
    assert result.exit_code == 0
    assert (review / "ikigai-narration-achernar.md").exists()
    assert not list(review.glob("*-leaves-*"))


def test_a_run_over_other_leaves_with_as_many_clips_does_not_take_a_reviews_name(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """**The defect by Leaf, through the command.** Leaves 1-2 are reviewed (eight clips a voice);
    a run over Leaves 2-3 has the same count and covers everything it was asked for, which the count
    rule overwrote with, and it would have lost Leaf 1's review. It writes beside instead."""
    docs, heard = world
    drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)),
        "--no-synthesis",
        "--leaf",
        "1",
        "--leaf",
        "2",
    )
    review = tmp_path / "review"
    assert "8 clips" in _md(review, "achernar")
    before = tree(review)

    other = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)),
        "--no-synthesis",
        "--leaf",
        "2",
        "--leaf",
        "3",
    )

    assert other.exit_code == 0, other.output
    after = tree(review)
    assert {name: digest for name, digest in after.items() if name in before} == before, (
        "the review of Leaves 1-2 is byte-identical"
    )
    assert (review / "ikigai-narration-achernar-leaves-2-3.md").exists()
    assert "BESIDE the existing review (8 clips)" in other.output


def test_a_second_partial_run_never_overwrites_the_first_ones_beside_files(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """Beside is where a partial run goes so that nothing is lost. The same partial run twice must
    not take the first one's files either: the second goes beside under a name that is free."""
    docs, heard = world
    drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), "--no-synthesis"
    )
    review = tmp_path / "review"
    partial = ("--no-synthesis", "--leaf", "1")
    drive(Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), *partial)
    first = tree(review)
    assert (review / "ikigai-narration-achernar-leaves-1.md").exists()

    again = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), *partial
    )

    after = tree(review)
    assert again.exit_code == 0, again.output
    assert {name: digest for name, digest in after.items() if name in first} == first, (
        "nothing that was already there changed: not the review, not the first beside"
    )
    assert (review / "ikigai-narration-achernar-leaves-1-2.md").exists()
    assert "ikigai-narration-achernar-leaves-1-2" in again.output


# ----------------------------------------------------------------- the rule, without the command


def _write_review(
    folder: Path, name: str, *, clips: int | None, leaves: Sequence[int] = ()
) -> None:
    """A review as `write_review` leaves it: the count, and a row in the table for each clip of
    each of `leaves` (four slides a Leaf). With no `leaves` it has a count and no rows: a sheet that
    says how many clips it has and not which Leaves they are."""
    folder.mkdir(parents=True, exist_ok=True)
    header = f"**{clips} clips, 10:00 in total.**" if clips is not None else "no count here"
    rows = "".join(
        f"| 00:{at:02d} | Leaf {leaf} {slide} | 10.0s | 150 wpm | 1.0 st |  |\n"
        for leaf in leaves
        for at, slide in enumerate(("Summary", "Scenario", "Payoff", "Takeaway"))
    )
    table = (
        "\n## Every clip\n\n| At | Clip | Length | Pace | Pitch moves | Notes |\n"
        f"|---|---|---|---|---|---|\n{rows}"
        if rows
        else ""
    )
    (folder / f"{name}.md").write_text(f"# Review\n\n{header}\n{table}", encoding="utf-8")
    (folder / f"{name}.mp3").write_bytes(b"audio")
    (folder / f"{name}.html").write_text("<html></html>", encoding="utf-8")


@pytest.mark.parametrize(
    ("asked", "covered", "clips", "existing", "beside"),
    [
        ([0, 1, 2], [0, 1, 2], 12, 12, False),  # as many, and everything asked: over it
        ([0, 1, 2], [0, 1, 2], 14, 12, False),  # more: over it
        ([0, 1, 2], [0, 1, 2], 11, 12, True),  # fewer clips: beside
        ([0, 1, 2], [0, 2], 12, 12, True),  # as many clips, but a Leaf asked for was not covered
        ([1], [1], 4, 12, True),  # asked for one, covered it, but it is smaller than the review
        ([0, 1, 2], [0, 1, 2], 12, 0, False),  # nothing there: nothing to shrink
    ],
)
def test_review_target_overwrites_only_a_review_it_does_not_shrink(
    tmp_path: Path, asked: list[int], covered: list[int], clips: int, existing: int, beside: bool
) -> None:
    if existing:
        _write_review(
            tmp_path, "book-narration-achernar", clips=existing, leaves=list(range(existing // 4))
        )

    target = review_target(
        folder=tmp_path, name="book-narration-achernar", asked=asked, covered=covered, clips=clips
    )

    assert target.beside is beside
    if beside:
        assert target.destination.name == f"book-narration-achernar-leaves-{leaves_label(covered)}"
    else:
        assert target.destination == tmp_path / "book-narration-achernar"
    assert target.existing_clips == existing


@pytest.mark.parametrize(
    ("covered", "beside"),
    [
        ([0, 1, 2], False),  # the review's own Leaves: over it
        ([0, 1, 2, 3], False),  # and one more: over it
        ([3, 4, 5], True),  # as many clips, **other Leaves**: it would lose Leaves 0-2
        ([3, 4, 5, 6], True),  # more clips, other Leaves: the same
        ([1, 2, 3], True),  # as many clips, one Leaf of the review's missing
    ],
)
def test_a_review_is_overwritten_only_by_a_run_that_covers_its_leaves(
    tmp_path: Path, covered: list[int], beside: bool
) -> None:
    """**By Leaf, not by count** (VO-4.1's A4 compared clips, which was the spec's wording): a run
    over Leaves 3-5 has as many clips as a review of Leaves 0-2, and by that measure shrinks
    nothing, yet it would take the review's name and lose Leaves 0-2."""
    _write_review(tmp_path, "book-narration-achernar", clips=12, leaves=[0, 1, 2])

    target = review_target(
        folder=tmp_path,
        name="book-narration-achernar",
        asked=covered,
        covered=covered,
        clips=4 * len(covered),
    )

    assert target.beside is beside


def test_a_review_whose_leaves_cannot_be_read_is_never_overwritten(tmp_path: Path) -> None:
    """A sheet that counts its clips and does not say which Leaves they are cannot be shown to be
    covered by anything, for the same reason as one whose count cannot be read."""
    _write_review(tmp_path, "book-narration-achernar", clips=12)

    target = review_target(
        folder=tmp_path,
        name="book-narration-achernar",
        asked=[0, 1, 2],
        covered=[0, 1, 2],
        clips=12,
    )

    assert target.beside and target.existing_clips == 12
    assert existing_review_leaves(tmp_path / "book-narration-achernar") is None


def test_existing_review_leaves_reads_the_table_and_nothing_else(tmp_path: Path) -> None:
    _write_review(tmp_path, "book-narration-achernar", clips=8, leaves=[2, 7])
    sheet = tmp_path / "book-narration-achernar.md"
    # The "Listen here first" bullets and prose name Leaves too, and are not coverage.
    sheet.write_text(
        sheet.read_text(encoding="utf-8")
        + "\n- **03:10** Leaf 9 Payoff — a note\nSee Leaf 11 for the other one.\n",
        encoding="utf-8",
    )

    assert existing_review_leaves(tmp_path / "book-narration-achernar") == frozenset({2, 7})
    assert existing_review_leaves(tmp_path / "nothing-here") == frozenset()


def test_a_review_with_only_an_mp3_has_no_readable_leaves_either(tmp_path: Path) -> None:
    (tmp_path / "book-narration-achernar.mp3").write_bytes(b"audio")

    assert existing_review_leaves(tmp_path / "book-narration-achernar") is None


def test_a_beside_name_that_is_taken_is_never_reused(tmp_path: Path) -> None:
    """Beside is where a partial run goes so that nothing is lost; a second partial run of the same
    Leaves must not take the first one's files."""
    _write_review(tmp_path, "book-narration-achernar", clips=12, leaves=[0, 1, 2])
    name = "book-narration-achernar"

    first = review_target(folder=tmp_path, name=name, asked=[1], covered=[1], clips=4)
    assert first.destination.name == f"{name}-leaves-1"
    _write_review(tmp_path, first.destination.name, clips=4, leaves=[1])

    second = review_target(folder=tmp_path, name=name, asked=[1], covered=[1], clips=4)
    assert second.destination.name == f"{name}-leaves-1-2"
    _write_review(tmp_path, second.destination.name, clips=4, leaves=[1])

    third = review_target(folder=tmp_path, name=name, asked=[1], covered=[1], clips=4)
    assert third.destination.name == f"{name}-leaves-1-3"
    assert second.beside and third.beside


def test_a_review_whose_size_cannot_be_read_is_never_overwritten(tmp_path: Path) -> None:
    """A review nobody can read the size of cannot be shown to be smaller than anything."""
    _write_review(tmp_path, "book-narration-achernar", clips=None)

    target = review_target(
        folder=tmp_path, name="book-narration-achernar", asked=[0], covered=[0], clips=999
    )

    assert target.beside and target.existing_clips is None
    assert existing_review_clips(tmp_path / "book-narration-achernar") is None


def test_a_review_with_only_an_mp3_is_unreadable_not_absent(tmp_path: Path) -> None:
    (tmp_path / "book-narration-achernar.mp3").write_bytes(b"audio")

    assert existing_review_clips(tmp_path / "book-narration-achernar") is None
    assert existing_review_clips(tmp_path / "nothing-here") == 0


@pytest.mark.parametrize(
    ("orders", "label"),
    [
        ([0, 1, 2, 3, 4, 5, 6, 7, 8], "0-8"),
        ([9], "9"),
        ([8, 0, 1, 3, 2, 10, 11], "0-3+8+10-11"),
        ([0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17], "0-8+10-17"),
        ([2, 2, 3], "2-3"),
    ],
)
def test_leaves_label_carries_the_coverage(orders: list[int], label: str) -> None:
    assert leaves_label(orders) == label


# ================================================================== A6 — the words are true again


def test_no_text_says_a_missing_clip_stops_the_run() -> None:
    """VO-4's README and `--no-synthesis` help both said a clip not on disk "stops the run"; since
    VO-4.1 it holds its Leaf and the run carries on. A grep for the old claim finds none.

    The claim is about a *missing clip*, and a budget or a speech failure still does stop the whole
    run - so the pattern is "stops the run" within a sentence of "not on disk" or "missing", in
    either order, after string-literal joins and line wraps are undone."""
    root = Path(__file__).resolve().parent.parent
    scanned = [root / "README.md", *sorted((root / "src").rglob("*.py"))]
    stop = r"stops?\s+the\s+(?:whole\s+)?run"
    absent = r"(?:not\s+on\s+disk|missing\s+(?:clip|raw|first))"
    claim = re.compile(rf"(?:{absent}[^.]{{0,80}}{stop})|(?:{stop}[^.]{{0,80}}{absent})", re.I)

    found = []
    for path in scanned:
        text = re.sub(r'"\s*\n\s*"', "", path.read_text(encoding="utf-8"))  # "a" "b" -> "ab"
        text = re.sub(r"\s+", " ", text)
        found += [f"{path.relative_to(root)}: ...{m.group(0)}..." for m in claim.finditer(text)]

    assert found == [], found


def test_the_claim_scan_can_see_the_old_wording() -> None:
    """The scan above is only worth anything if it goes red on the sentence it is hunting."""
    claim = re.compile(
        r"(?:(?:not\s+on\s+disk|missing\s+(?:clip|raw|first))[^.]{0,80}stops?\s+the\s+(?:whole\s+)?run)"
        r"|(?:stops?\s+the\s+(?:whole\s+)?run[^.]{0,80}(?:not\s+on\s+disk|missing\s+(?:clip|raw|first)))",
        re.I,
    )

    assert claim.search("A clip whose audio is not on disk stops the run, naming it;")
    assert claim.search("it stops the whole run when a clip is missing clip by clip")
    assert not claim.search("Only a budget or a speech failure stops the whole run.")


def test_the_help_and_the_readme_describe_the_hold_and_the_options() -> None:
    """Read from the parsed option objects, not the rendered help: Typer draws it in a box that
    wraps and pads the text."""
    group: Any = typer.main.get_command(cli.app)
    params = {param.name: param for param in group.commands["narrate"].params}
    readme = (Path(__file__).resolve().parent.parent / "README.md").read_text(encoding="utf-8")

    assert params["only_leaves"].opts == ["--leaf"] and params["only_leaves"].multiple
    assert "held on its own" in " ".join(params["no_synthesis"].help.split())
    for needed in (
        "held on its own",
        "narrate --leaf N",
        "narration-stale",
        "cannot shrink a review",
        "Only a budget or a speech failure stops the whole run",
    ):
        assert needed in readme, needed


# ================================================== A7 — the VO-4.1 leftovers (LEDGER-1, Part 2)
#
# Wording that was untrue, said true, and each one pinned: the sentence is read from the command's
# own output, so a later edit that brings the old claim back goes red.


class _Log:
    """`cli._log`, recording instead of printing: a structured event is a name and its fields."""

    def __init__(self) -> None:
        self.events: list[tuple[str, str, dict[str, Any]]] = []

    def _record(self, level: str, event: str, **fields: Any) -> None:
        self.events.append((level, event, fields))

    def info(self, event: str, **fields: Any) -> None:
        self._record("info", event, **fields)

    def warning(self, event: str, **fields: Any) -> None:
        self._record("warning", event, **fields)

    def error(self, event: str, **fields: Any) -> None:
        self._record("error", event, **fields)

    def named(self, event: str) -> list[tuple[str, dict[str, Any]]]:
        return [(level, fields) for level, name, fields in self.events if name == event]


def test_the_unknown_leaf_refusal_says_what_it_did_not_do_and_not_that_nothing_was_written(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """(d) The checkpoint is written twice before `--leaf 9` is found to be nothing (which door the
    run used), so "nothing was written" was untrue. What is true: nothing was rendered, listened
    to, spent or written to the CMS."""
    docs, heard = world
    session = Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard))

    result = drive(session, "--no-synthesis", "--leaf", "9")

    assert result.exit_code == 2
    out = " ".join(result.output.split())
    assert "nothing was rendered, listened to, spent or written to the CMS" in out
    assert "Nothing was done beyond recording the run's transport" in out
    assert "Nothing was done." not in out
    assert "nothing written" not in out.lower()


def test_the_help_and_the_readme_say_the_same_about_an_unknown_leaf() -> None:
    group: Any = typer.main.get_command(cli.app)
    params = {param.name: param for param in group.commands["narrate"].params}
    readme = " ".join(
        (Path(__file__).resolve().parent.parent / "README.md").read_text(encoding="utf-8").split()
    )
    said = "refused before anything is rendered, listened to, spent or written to the CMS"

    assert said in " ".join(params["only_leaves"].help.split())
    assert said in readme
    assert "refused before anything runs" not in readme
    assert "refused before anything runs" not in " ".join(params["only_leaves"].help.split())


@pytest.mark.parametrize(
    ("options", "with_listener", "carried"),
    [
        ((), True, "--leaf 2 --tempo 1.3 --max-attempts 3"),
        (
            ("--tempo", "1.2", "--max-attempts", "2", "--no-guard"),
            False,
            "--leaf 2 --tempo 1.2 --max-attempts 2 --no-guard",
        ),
        (("--tempo", "1.5", "--max-attempts", "1"), False, "--leaf 2 --tempo 1.5 --max-attempts 1"),
    ],
)
def test_the_way_out_carries_the_options_the_run_was_given(
    tmp_path: Path,
    drive: Any,
    world: Any,
    options: tuple[str, ...],
    with_listener: bool,
    carried: str,
) -> None:
    """(g) A bare `--leaf 2` would narrate again at the defaults, and with the guard back on if this
    run had switched it off. The suggestion says what this run was run with. (A listener is only
    registered for the tempo the module was primed at, so a run at another tempo has none.)"""
    docs, heard = world
    edit_payoff(docs[1])
    session = Session(
        tmp_path,
        ExplodingBackend(),
        docs,
        listener=EchoListener(heard) if with_listener else None,
    )

    result = drive(session, "--no-synthesis", "--leaf", "2", *options)

    assert result.exit_code == 1, result.output
    out = " ".join(result.output.split())
    suggestion = out.split("Two ways out: narrate it — ")[1].split(" without --no-synthesis")[0]
    assert suggestion == f"`narrate --run-id ikigai {carried}`"


def test_the_tail_says_a_leafs_audio_waits_in_a_draft_only_when_some_does(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """(h) The last line used to say each Leaf's audio waits in a pending draft under a heading that
    said nothing was attached."""
    docs, heard = world

    # Every Leaf attached: the old sentence, as it was.
    everything = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), "--no-synthesis"
    )
    assert everything.exit_code == 0, everything.output
    out = " ".join(everything.output.split())
    assert "Each Leaf's audio waits in a pending draft until a human publishes it." in out

    # Leaf 2 held and 1 and 3 attached: it says which, and that the others were not.
    edit_payoff(docs[1])
    mixed = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), "--no-synthesis"
    )
    out = " ".join(mixed.output.split())
    assert "publishes it (Leaves 1, 3; the others were not attached)." in out

    # Every Leaf held: nothing waits in a draft, and it does not say so.
    nothing = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)),
        "--no-synthesis",
        "--leaf",
        "2",
    )
    out = " ".join(nothing.output.split())
    assert nothing.exit_code == 1
    assert "Nothing was published, and nothing was attached" in out
    assert "waits in a pending draft" not in out


def test_the_will_buy_line_promises_only_the_retry_the_run_can_make(
    tmp_path: Path, drive: Any, world: Any
) -> None:
    """(i) With the guard off nothing listens, so "a retry for any clip the guard fails" is untrue;
    what can still be bought again is a clip whose measured pace is unnatural."""
    docs, _heard = world
    edit_payoff(docs[1])
    session = Session(tmp_path, ContentBackend(), docs, listener=None)

    result = drive(session, "--no-guard")
    out = " ".join(result.output.split())

    assert result.exit_code == 0, result.output
    assert (
        "will buy : 2 clips — leaf 2 payoff (female, Achernar), leaf 2 payoff (male, "
        "Sadaltager); and a retry for any clip whose pace is not natural (the guard is off)"
    ) in out
    assert "the guard fails" not in out


def test_a_hold_found_midway_does_not_claim_to_have_listened_when_the_guard_is_off(
    tmp_path: Path, drive: Any, monkeypatch: pytest.MonkeyPatch, world: Any
) -> None:
    """(i) "Its earlier clips were already listened to, and that is on the ledger" is true with the
    guard on and untrue with it off."""
    docs, _heard = world
    edit_payoff(docs[1])
    monkeypatch.setattr(narration_nodes, "missing_first_attempts", lambda **_kwargs: [])
    session = Session(tmp_path, ExplodingBackend(), docs, listener=None)

    result = drive(session, "--no-synthesis", "--no-guard")
    out = " ".join(result.output.split())

    assert result.exit_code == 1, result.output
    assert (
        "found while rendering: its earlier clips were rendered, and nothing was listened to" in out
    )
    assert "already listened to" not in out and "on the ledger" not in out


def test_a_hold_found_by_the_pre_flight_leaves_a_structured_event(
    tmp_path: Path, drive: Any, monkeypatch: pytest.MonkeyPatch, world: Any
) -> None:
    """(k) A hold was a line of output and nothing else: no event for whoever reads the logs. One
    per hold, naming the Leaf and why, and never a word of the Leaf's text."""
    docs, heard = world
    narrated = {int(doc["orderIndex"]): texts_of(doc) for doc in docs}
    log = _Log()
    monkeypatch.setattr(cli, "_log", log)
    edit_payoff(docs[1])

    drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), "--no-synthesis"
    )

    ((level, fields),) = log.named("narration.leaf_held")
    assert level == "info"
    assert fields == {
        "run_id": "ikigai",
        "leaf": 2,
        "reason": "not_on_disk",
        "found": "pre_flight",
        "clips": ["payoff (female, Achernar)", "payoff (male, Sadaltager)"],
    }
    for _level, _event, logged in log.events:
        for texts in narrated.values():
            for text in texts:
                assert leaked_window(text, repr(logged)) is None, "names, never words"


def test_a_hold_found_midway_leaves_a_structured_event_too(
    tmp_path: Path, drive: Any, monkeypatch: pytest.MonkeyPatch, world: Any
) -> None:
    docs, heard = world
    log = _Log()
    monkeypatch.setattr(cli, "_log", log)
    monkeypatch.setattr(narration_nodes, "missing_first_attempts", lambda **_kwargs: [])
    edit_payoff(docs[1])

    drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard)), "--no-synthesis"
    )

    ((level, fields),) = log.named("narration.leaf_held")
    assert (level, fields["leaf"], fields["reason"], fields["found"]) == (
        "info",
        2,
        "not_on_disk",
        "while_rendering",
    )


def test_a_hold_by_the_guard_leaves_a_structured_event_too(
    tmp_path: Path, drive: Any, monkeypatch: pytest.MonkeyPatch, world: Any
) -> None:
    """A clip that still does not say its text after its attempts holds its Leaf, and says so as a
    warning: it is the hold that wants a person to listen."""
    docs, heard = world
    log = _Log()
    monkeypatch.setattr(cli, "_log", log)
    wrong = {digest for digest, text in heard.items() if text == texts_of(docs[0])[2]}

    result = drive(
        Session(tmp_path, ExplodingBackend(), docs, listener=EchoListener(heard, wrong=wrong)),
        "--no-synthesis",
        "--max-attempts",
        "1",
    )

    assert result.exit_code == 1, result.output
    ((level, fields),) = log.named("narration.leaf_held")
    assert (level, fields) == ("warning", {"run_id": "ikigai", "leaf": 1, "reason": "guard"})
