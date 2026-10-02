"""VO-4 Part 2 — where the stretch goes in the render, and the three traps the placement must keep.

Tier A. The stretch is DSP on audio already on disk, so the risks are not in the DSP but in what
it is wired to: the clip's edges, the report the founder's ear is pointed by, and the cache that
holds what was paid for. Each test below is one of the handoff's three traps, or the money that
rests on them, and each was watched red against the breakage it names (see the completion report).

Two of these build their own "voice", because the standard fake returns steady tone bursts, which
a waveform-similarity stretch reproduces almost exactly - a test that only used it would go green
if the level and edge handling after the stretch were deleted.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from zoomout_pipeline.assets.audio import (
    HEAD_PAD_SECONDS,
    MAX_DECAY_SECONDS,
    PEAK_CEILING_DB,
    SPEECH_DB,
    TAIL_SILENCE_SECONDS,
    TARGET_SPEECH_DB,
    AudioError,
    Pcm,
    decode_wav,
    encode_wav,
    frame_levels_db,
    level,
    shape_edges,
    speech_level_db,
)
from zoomout_pipeline.assets.audio import encode_mp3 as real_encode_mp3
from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.narration import (
    NARRATED_FIELDS,
    NARRATOR_VOICES,
    NarratedSlide,
    NarrationLine,
    clip_digest,
    clip_filename,
    direction_for,
    narration_script,
)
from zoomout_pipeline.assets.narration_guard import (
    GUARD_NODE,
    NarrationEnding,
    NarrationReading,
)
from zoomout_pipeline.graph.narration_nodes import (
    ClipStore,
    Guard,
    RenderedClip,
    attach_leaf_narration,
    render_line,
)

from .conftest import ScriptedLLM
from .narration_fakes import (
    RATE,
    FakePayload,
    FakeSpeechBackend,
    leaf_doc,
    speech_client,
    speech_like_wav,
)

MODEL = "gemini-3.6-flash"
BOOK = "Ikigai: The Japanese Secret to a Long and Happy Life"


# ------------------------------------------------------------------------------- the voices


class _NoiseBackend(FakeSpeechBackend):
    """A voice that only ever fricates: bursts of noise at speech level, with pauses.

    **Because a stretch is not level-neutral on noise.** Two unrelated stretches of noise, blended
    across an overlap, sum to less power than either: about a dB and a bit at 1.3x. Steady tones
    line up under a waveform-similarity search and come through at the same level, which is why
    the standard fake cannot show that the render levels *after* the stretch.
    """

    def synthesize_speech(self, *, request: Any, retry: Any, timeout: float) -> Any:
        super().synthesize_speech(request=request, retry=retry, timeout=timeout)
        seconds = max(0.5, len(request.input.text) * 0.052)
        wav = _noise_wav(seconds)

        class _Response:
            audio_content = wav

        return _Response()


def _noise_wav(seconds: float, *, spike: bool = False) -> bytes:
    rng = np.random.default_rng(11)
    pieces = [np.zeros(int(0.3 * RATE), dtype=np.float32)]
    remaining = seconds
    while remaining > 0:
        burst = min(0.5, remaining)
        n = int(burst * RATE)
        noise = np.convolve(rng.standard_normal(n), np.ones(3) / 3, mode="same")
        edge = np.minimum(np.arange(n), n - np.arange(n)) / (0.02 * RATE)
        pieces.append((0.2 * noise * np.minimum(1.0, edge)).astype(np.float32))
        pieces.append(np.zeros(int(0.2 * RATE), dtype=np.float32))
        remaining -= burst
    pieces.append(np.zeros(int(0.5 * RATE), dtype=np.float32))
    samples = np.concatenate(pieces)
    if spike:
        # One loud 6 ms click near the middle: the peak, not the speech level, sets the gain.
        middle = len(samples) // 2
        samples[middle : middle + int(0.006 * RATE)] = 0.95
    return encode_wav(Pcm(samples=samples, rate=RATE))


class _SpikyBackend(_NoiseBackend):
    def synthesize_speech(self, *, request: Any, retry: Any, timeout: float) -> Any:
        FakeSpeechBackend.synthesize_speech(self, request=request, retry=retry, timeout=timeout)
        wav = _noise_wav(max(0.5, len(request.input.text) * 0.052), spike=True)

        class _Response:
            audio_content = wav

        return _Response()


class _MidSoundBackend(FakeSpeechBackend):
    """A voice whose audio stops in the middle of a vowel: the model cut off, not finished."""

    def synthesize_speech(self, *, request: Any, retry: Any, timeout: float) -> Any:
        super().synthesize_speech(request=request, retry=retry, timeout=timeout)
        seconds = max(0.5, len(request.input.text) * 0.052)
        whole = decode_wav(speech_like_wav(seconds, pause_seconds=self._pause))
        # 0.3 s lead-in, a 0.7 s burst, a pause, then 0.35 s into the next burst: full level.
        cut = int((0.3 + 0.7 + self._pause + 0.35) * RATE)
        wav = encode_wav(Pcm(samples=whole.samples[:cut], rate=RATE))

        class _Response:
            audio_content = wav

        return _Response()


# ---------------------------------------------------------------------------------- helpers


def _breath_backend() -> FakeSpeechBackend:
    """A voice that leaves 0.30 s of low-level noise **straight after its last word**.

    `pause_seconds=0` matters: the fake puts its tail noise after its last pause, so with the
    default 0.2 s of digital silence between them `shape_edges` sees a silent gap and then some
    noise, which is not a breath and is not cut. The first draft of these tests made exactly that
    mistake, and one of them passed on it - which is why each test below asserts, first, that
    the breath it is about is really there.
    """
    return FakeSpeechBackend(tail_noise_seconds=0.30, pause_seconds=0.0)


def _payoff() -> NarrationLine:
    return next(line for line in narration_script(leaf_doc()) if line.slide is NarratedSlide.PAYOFF)


def _render(
    tmp_path: Path,
    backend: FakeSpeechBackend,
    *,
    tempo: float,
    guard: Guard | None = None,
    line: NarrationLine | None = None,
    voice: str = "Sulafat",
) -> RenderedClip:
    line = line or _payoff()
    return render_line(
        line=line,
        speech=speech_client(backend),
        voice=voice,
        prompt=direction_for(line.slide),
        store=ClipStore(tmp_path),
        budget=NarrationBudget(ceiling_usd=3.00),
        record=lambda _spend: None,
        guard=guard,
        max_attempts=1,
        tempo=tempo,
    )


@pytest.fixture
def encoded(monkeypatch: pytest.MonkeyPatch) -> list[Pcm]:
    """Every clip handed to the mp3 encoder, as the audio the encoder saw."""
    seen: list[Pcm] = []

    def spy(pcm: Pcm, **kwargs: Any) -> bytes:
        seen.append(pcm)
        return real_encode_mp3(pcm, **kwargs)

    # By path, because the module does not re-export the name: patching it is exactly patching the
    # `encode_mp3` that `_render_attempt` calls.
    monkeypatch.setattr("zoomout_pipeline.graph.narration_nodes.encode_mp3", spy)
    return seen


def _leading_silence_seconds(pcm: Pcm) -> float:
    return int(np.flatnonzero(frame_levels_db(pcm) > SPEECH_DB)[0]) * 0.010


def _trailing_zero_seconds(pcm: Pcm) -> float:
    return (len(pcm.samples) - int(np.flatnonzero(pcm.samples)[-1]) - 1) / pcm.rate


def _tree(folder: Path) -> dict[str, str]:
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.iterdir())}


def _passing_guard(line: NarrationLine) -> tuple[Guard, ScriptedLLM]:
    llm = ScriptedLLM(
        [],
        defaults={GUARD_NODE: NarrationReading(transcript=line.text, ending=NarrationEnding.CLEAN)},
    )
    return Guard(llm=llm, model=MODEL), llm


# ================================================= trap 1: what reaches the encoder is the same


@pytest.mark.parametrize("tempo", [1.0, 1.3, 1.5])
def test_the_clip_that_reaches_the_encoder_has_the_same_pads_loudness_and_peak(
    tmp_path: Path, encoded: list[Pcm], tempo: float
) -> None:
    """`RenderedClip.words_per_minute` subtracts a 60 ms head and a 350 ms tail *as constants*, and
    levelling fixes the loudness and the peak. A stretch laid on after the edges were made would
    scale the pads (60 -> 46 ms, 350 -> 269 ms at 1.3x) and the pace figure would be quietly wrong
    for every clip in the book."""
    _render(tmp_path, FakeSpeechBackend(), tempo=tempo)

    (heard,) = encoded
    assert _leading_silence_seconds(heard) == pytest.approx(HEAD_PAD_SECONDS, abs=0.011)
    assert _trailing_zero_seconds(heard) == pytest.approx(TAIL_SILENCE_SECONDS, abs=0.002)
    assert speech_level_db(heard) == pytest.approx(TARGET_SPEECH_DB, abs=0.2)
    assert 20 * np.log10(np.max(np.abs(heard.samples))) <= PEAK_CEILING_DB + 1e-3


@pytest.mark.parametrize("tempo", [1.3, 1.5])
def test_a_stretch_that_comes_out_quieter_is_levelled_again_before_it_is_encoded(
    tmp_path: Path, encoded: list[Pcm], tempo: float
) -> None:
    """The loudness belongs to what reaches the encoder, so `level` runs after the stretch."""
    _render(tmp_path, _NoiseBackend(), tempo=tempo)

    # The precondition, computed on the very audio that was rendered: without the second `level`
    # this clip would miss the target by far more than the assertion below allows, or the test
    # proves nothing. Measured on this voice: 0.42 dB quiet at 1.3x, 0.57 dB at 1.5x, against a
    # tolerance of 0.05 - a mutant that drops the second `level` is 8x outside it. (Steady tones
    # lose 0.00 dB, which is why the standard fake cannot pin this.)
    (raw_file,) = (tmp_path / "raw").glob("*.wav")
    levelled, _gain = level(decode_wav(raw_file.read_bytes()))
    unlevelled, _edges = shape_edges(levelled, tempo=tempo)
    assert speech_level_db(unlevelled) < TARGET_SPEECH_DB - 0.3, "the stretch is not level-neutral"

    (heard,) = encoded
    assert speech_level_db(heard) == pytest.approx(TARGET_SPEECH_DB, abs=0.05)


def test_the_peak_ceiling_holds_at_every_tempo_when_a_click_sets_the_gain(
    tmp_path: Path, encoded: list[Pcm]
) -> None:
    """With one loud click in the audio the *peak*, not the speech, limits the gain. The ceiling
    must hold on what the encoder gets, and the stretch (which blurs a click) must not leave the
    clip quieter than the ceiling allows."""
    _render(tmp_path / "plain", _SpikyBackend(), tempo=1.0)
    _render(tmp_path / "fast", _SpikyBackend(), tempo=1.3)

    plain, fast = encoded
    for heard in (plain, fast):
        assert 20 * np.log10(np.max(np.abs(heard.samples))) <= PEAK_CEILING_DB + 1e-3
    assert 20 * np.log10(np.max(np.abs(plain.samples))) == pytest.approx(PEAK_CEILING_DB, abs=0.05)
    assert 20 * np.log10(np.max(np.abs(fast.samples))) == pytest.approx(PEAK_CEILING_DB, abs=0.05)


# ================================================ trap 2: the report describes the model's ending


def test_the_edge_report_is_the_same_raw_at_tempo_1_0_and_1_3(tmp_path: Path) -> None:
    """The cue sheet flags "a low sound followed the last word and was cut". At 1.3x a 0.30 s
    breath is 0.23 s, under `MAX_DECAY_SECONDS`: a report computed on stretched audio would say it
    was not cut, and the clip would keep it."""
    backend = _breath_backend()
    plain = _render(tmp_path, backend, tempo=1.0)
    stretched = _render(tmp_path, backend, tempo=1.3)

    assert plain.edges.breath_cut and plain.edges.low_tail_seconds > MAX_DECAY_SECONDS
    assert plain.edges.low_tail_seconds / 1.3 < MAX_DECAY_SECONDS, "1.3x would have hidden it"
    assert stretched.edges == plain.edges
    assert stretched.gain_db == plain.gain_db, "how far the model's own level was from the set's"
    assert len(backend.requests) == 1, "the second render drew on the first's audio"


def test_a_clip_the_model_cut_off_mid_sound_is_still_reported_as_cut_off(tmp_path: Path) -> None:
    """The stretch's own tapering of the clip's last 20 ms must not hide it."""
    backend = _MidSoundBackend()
    plain = _render(tmp_path, backend, tempo=1.0)
    stretched = _render(tmp_path, backend, tempo=1.3)

    assert plain.edges.ends_mid_sound, "the precondition: the model really stopped mid-sound"
    assert stretched.edges.ends_mid_sound
    assert stretched.edges == plain.edges


def test_a_breath_the_model_left_is_cut_from_the_stretched_clip_too(tmp_path: Path) -> None:
    """Not only reported as cut: gone from the audio. Both clips end at the last word."""
    backend = _breath_backend()
    plain = _render(tmp_path, backend, tempo=1.0)
    stretched = _render(tmp_path, backend, tempo=1.3)

    assert plain.edges.breath_cut, "the precondition: there is a breath to cut"
    assert stretched.edges.breath_cut
    spoken_plain = plain.duration_seconds - HEAD_PAD_SECONDS - TAIL_SILENCE_SECONDS
    spoken_fast = stretched.duration_seconds - HEAD_PAD_SECONDS - TAIL_SILENCE_SECONDS
    # A kept 0.30 s breath would leave the stretched clip 0.30/1.3 - 0.08/1.3 = 0.17 s longer.
    assert spoken_fast == pytest.approx(spoken_plain / 1.3, abs=0.04)


# ================================================== trap 3: raw/ is the model's, and once is once


def test_a_stretched_render_leaves_every_raw_file_byte_identical_and_adds_none(
    tmp_path: Path,
) -> None:
    """`raw/` is keyed by what was *asked*. A stretched file there would be served to the next run
    as raw and stretched again, and it would have cost nothing to notice."""
    backend = FakeSpeechBackend()
    _render(tmp_path, backend, tempo=1.0)
    before = _tree(tmp_path / "raw")
    assert len(before) == 2, "one clip and its sidecar: the precondition"

    _render(tmp_path, backend, tempo=1.3)
    _render(tmp_path, backend, tempo=1.5)

    assert _tree(tmp_path / "raw") == before
    assert len(backend.requests) == 1, "and nothing was bought again"


def test_a_clip_synthesised_at_a_tempo_is_stored_raw_as_the_model_returned_it(
    tmp_path: Path,
) -> None:
    """The other way a stretched file could reach `raw/`: a fresh clip, rendered at a tempo."""
    backend = FakeSpeechBackend()
    fast = _render(tmp_path, backend, tempo=1.3)

    (stored,) = (tmp_path / "raw").glob("*.wav")
    seconds = max(0.5, len(backend.requests[0].input.text) * 0.052)
    assert stored.read_bytes() == speech_like_wav(seconds), "the model's own bytes"
    assert fast.tempo == 1.3 and not fast.from_cache


def test_the_stretch_is_applied_once_not_twice(tmp_path: Path, encoded: list[Pcm]) -> None:
    """A duration ratio of 1/tempo, not 1/tempo squared. Measured on the audio handed to the
    encoder with the head and tail taken off, so the mp3's own delay and padding (a constant
    0.05 s or so, a full half-percent of a 4.5 s clip) are not in the ratio."""
    backend = FakeSpeechBackend()
    _render(tmp_path, backend, tempo=1.0)
    _render(tmp_path, backend, tempo=1.3)
    _render(tmp_path, backend, tempo=1.5)

    def spoken(heard: Pcm) -> float:
        return len(heard.samples) / heard.rate - HEAD_PAD_SECONDS - TAIL_SILENCE_SECONDS

    plain, at_1_3, at_1_5 = encoded
    assert spoken(plain) / spoken(at_1_3) == pytest.approx(1.3, rel=0.005)
    assert spoken(plain) / spoken(at_1_5) == pytest.approx(1.5, rel=0.005)


# ================================================= the money: a new file, listened to once


def test_a_stretched_clip_is_a_new_file_that_is_listened_to_again_and_only_once(
    tmp_path: Path,
) -> None:
    """The guard's cache is keyed by the bytes it heard, so the stretched clip is a new listen
    (the only money in VO-4) and the same stretch a second time is not: the determinism that lets
    a second run cost $0."""
    line = _payoff()
    guard, llm = _passing_guard(line)
    backend = FakeSpeechBackend()

    plain = _render(tmp_path, backend, tempo=1.0, guard=guard)
    assert len(llm.calls) == 1
    fast = _render(tmp_path, backend, tempo=1.3, guard=guard)
    assert len(llm.calls) == 2, "different bytes: heard again"
    again = _render(tmp_path, backend, tempo=1.3, guard=guard)
    assert len(llm.calls) == 2, "the same bytes: read back from the checks, not re-bought"

    assert plain.digest == fast.digest, "the raw's cache key did not move: same clip asked for"
    assert fast.sha256 != plain.sha256 and again.sha256 == fast.sha256
    assert [call["audio"][0] for call in llm.calls] == [plain.mp3, fast.mp3]
    assert clip_filename(
        book_title=BOOK, line=line, voice="Sulafat", content_hash=fast.sha256
    ) != clip_filename(book_title=BOOK, line=line, voice="Sulafat", content_hash=plain.sha256)
    assert fast.duration_seconds < plain.duration_seconds


# ======================================================================== the option, the state


def test_render_line_keeps_the_models_pace_unless_it_is_asked_not_to(tmp_path: Path) -> None:
    line = _payoff()
    kwargs: dict[str, Any] = {
        "line": line,
        "speech": speech_client(FakeSpeechBackend()),
        "voice": "Sulafat",
        "prompt": direction_for(line.slide),
        "store": ClipStore(tmp_path),
        "budget": NarrationBudget(ceiling_usd=3.00),
        "record": lambda _spend: None,
        "guard": None,
        "max_attempts": 1,
    }

    default = render_line(**kwargs)
    explicit = render_line(**{**kwargs, "tempo": 1.0})

    assert default.tempo == 1.0
    assert default.mp3 == explicit.mp3


@pytest.mark.parametrize("tempo", [0.9, 1.6, 2.0, 0.0, float("nan")])
def test_a_bad_tempo_is_refused_before_anything_is_bought(tmp_path: Path, tempo: float) -> None:
    """A mistyped option found after the synthesis is a clip paid for and never used."""
    backend = FakeSpeechBackend()

    with pytest.raises(AudioError, match="tempo"):
        _render(tmp_path, backend, tempo=tempo)

    assert backend.requests == [], "no call was made"
    assert not (tmp_path / "raw").exists(), "and nothing was stored"


def _eight_clips(tmp_path: Path, doc: dict[str, Any], *, tempo: float) -> list[RenderedClip]:
    return [
        render_line(
            line=line,
            speech=speech_client(FakeSpeechBackend()),
            voice=voice,
            prompt=direction_for(line.slide),
            store=ClipStore(tmp_path),
            budget=NarrationBudget(ceiling_usd=3.00),
            record=lambda _spend: None,
            guard=None,
            max_attempts=1,
            tempo=tempo,
        )
        for voice in NARRATOR_VOICES.values()
        for line in narration_script(doc)
    ]


def test_the_tempo_is_recorded_on_every_clip_and_in_the_runs_state(tmp_path: Path) -> None:
    """`cms_narration` is what a later session reads to know what is attached. Nothing in the CMS
    says a clip is stretched, so the run's state has to."""
    doc = leaf_doc()
    cms = FakePayload(doc)
    clips = _eight_clips(tmp_path, doc, tempo=1.3)
    assert len(clips) == len(NARRATED_FIELDS) * len(NARRATOR_VOICES)

    attached = attach_leaf_narration(
        client=cms, leaf_id=266, clips=clips, book_title=BOOK, store=ClipStore(tmp_path)
    )

    assert attached.passed and {clip.tempo for clip in clips} == {1.3}
    for group, narrators in attached.media.items():
        for narrator, entry in narrators.items():
            assert entry["tempo"] == 1.3, (group, narrator)


def test_the_state_says_when_a_clip_is_not_stretched_too(tmp_path: Path) -> None:
    doc = leaf_doc()
    clips = _eight_clips(tmp_path, doc, tempo=1.0)

    attached = attach_leaf_narration(
        client=FakePayload(doc),
        leaf_id=266,
        clips=clips,
        book_title=BOOK,
        store=ClipStore(tmp_path),
    )

    assert all(
        entry["tempo"] == 1.0 for group in attached.media.values() for entry in group.values()
    )


def test_the_digest_a_stretched_clip_is_cached_under_is_the_one_it_always_was(
    tmp_path: Path,
) -> None:
    """Tempo is not part of what was asked of the voice, so it is not part of the key: adding it
    would re-buy the whole book."""
    line = _payoff()
    speech = speech_client(FakeSpeechBackend())
    prompt = direction_for(line.slide)

    fast = _render(tmp_path, FakeSpeechBackend(), tempo=1.3, line=line)

    assert fast.digest == clip_digest(
        model=speech.model,
        voice="Sulafat",
        language=speech.language_code,
        prompt=prompt,
        text=line.spoken,
        attempt=1,
    )
