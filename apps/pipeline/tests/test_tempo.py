"""VO-4 Part 1 — `change_tempo`, and what `shape_edges` does with a tempo. Tier A.

Tested on synthetic signals whose properties are known — a tone of a known pitch, a silence of a
known length, a sweep — and **none of it reads `runs/`**. What these can prove is the *shape* of a
stretch: the pitch it keeps, the length it makes, the clicks it does not add. What they cannot
prove is that speech survives it, which is the real-clip table's job (Part 5.2 of the handoff),
and whether it sounds natural, which is the founder's.
"""

from __future__ import annotations

from itertools import pairwise

import numpy as np
import numpy.typing as npt
import pytest

from zoomout_pipeline.assets import audio
from zoomout_pipeline.assets.audio import (
    FADE_IN_SECONDS,
    FADE_OUT_SECONDS,
    FLOOR_DB,
    FRAME_SECONDS,
    HEAD_PAD_SECONDS,
    MAX_DECAY_SECONDS,
    MAX_TEMPO,
    MIN_TEMPO,
    SPEECH_DB,
    TAIL_SILENCE_SECONDS,
    AudioError,
    EdgeReport,
    Pcm,
    change_tempo,
    frame_levels_db,
    level,
    require_tempo,
    shape_edges,
)

RATE = 24_000


def sine(seconds: float, hz: float, *, amplitude: float = 0.25, rate: int = RATE) -> Pcm:
    t = np.arange(round(seconds * rate)) / rate
    return Pcm(samples=(amplitude * np.sin(2 * np.pi * hz * t)).astype(np.float32), rate=rate)


def tone(seconds: float, *, hz: float = 150.0, amplitude: float = 0.25) -> npt.NDArray[np.float32]:
    return sine(seconds, hz, amplitude=amplitude).samples


def silence(seconds: float) -> npt.NDArray[np.float32]:
    return np.zeros(int(seconds * RATE), dtype=np.float32)


def noise(seconds: float, db: float) -> npt.NDArray[np.float32]:
    values = np.random.default_rng(3).standard_normal(int(seconds * RATE))
    return (values * 10 ** (db / 20)).astype(np.float32)


def pcm(*pieces: npt.NDArray[np.float32]) -> Pcm:
    return Pcm(samples=np.concatenate(pieces).astype(np.float32), rate=RATE)


def rms(samples: npt.NDArray[np.float32]) -> float:
    return float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))


def frequency_hz(clip: Pcm) -> float:
    """A sine's frequency from its upward zero crossings, interpolated to a fraction of a sample."""
    s = clip.samples.astype(np.float64)
    up = np.flatnonzero((s[:-1] < 0) & (s[1:] >= 0))
    position = up + (-s[up] / (s[up + 1] - s[up]))
    return float((len(position) - 1) / ((position[-1] - position[0]) / clip.rate))


# ================================================================ (i) a sine keeps what it was


@pytest.mark.parametrize("hz", [60.0, 150.0, 440.0, 3000.0])
@pytest.mark.parametrize("tempo", [1.1, 1.3, 1.5])
def test_a_sine_keeps_its_pitch_and_its_level_and_gains_no_clicks(hz: float, tempo: float) -> None:
    source = sine(2.0, hz)
    stretched = change_tempo(source, tempo)

    assert stretched.rate == source.rate and stretched.samples.dtype == np.float32
    assert len(stretched.samples) == round(len(source.samples) / tempo), "length is n / tempo"
    assert frequency_hz(stretched) == pytest.approx(hz, rel=0.01), "pitch kept, within 1%"
    assert 20 * np.log10(rms(stretched.samples) / rms(source.samples)) == pytest.approx(0, abs=1.0)
    # A click is a step no sine of this frequency and amplitude can make. The stretch is only
    # ever a weighted average of samples the sine itself contains, so it must not exceed them.
    step_in, step_out = np.diff(source.samples), np.diff(stretched.samples)
    assert np.max(np.abs(step_out)) <= 1.05 * np.max(np.abs(step_in))


def test_a_stretch_is_never_louder_than_what_it_was_made_from() -> None:
    """Every output sample is a weighted average of input samples whose weights add to one, so
    the peak cannot rise. `_render_attempt` levels again afterwards because the *speech level* can
    fall, never because a peak could have risen past the ceiling."""
    source = pcm(noise(1.0, -20.0), tone(0.5), noise(0.5, -30.0))
    stretched = change_tempo(source, 1.4)

    assert float(np.max(np.abs(stretched.samples))) <= float(np.max(np.abs(source.samples))) + 1e-6
    assert np.all(np.isfinite(stretched.samples))


# ==================================================== (ii) silence shrinks by the tempo, too


def _runs(clip: Pcm) -> tuple[float, float, float]:
    """(first tone, the silence between, second tone) in seconds, from 10 ms frame levels."""
    loud = np.flatnonzero(frame_levels_db(clip) > SPEECH_DB)
    gaps = np.diff(loud) - 1
    split = int(np.argmax(gaps))
    return (
        (split + 1) * FRAME_SECONDS,
        float(gaps[split]) * FRAME_SECONDS,
        (len(loud) - split - 1) * FRAME_SECONDS,
    )


def test_tone_silence_tone_every_part_shrinks_by_the_tempo() -> None:
    """**What a constant stretch cannot do**, said as a test: the pause is scaled with the speech,
    not thinned out. 0.6 s of silence at 1.3x is 0.46 s, exactly as the tones are 0.38 s."""
    source = pcm(tone(0.5), silence(0.6), tone(0.5))

    first, gap, second = _runs(source)
    assert (first, gap, second) == pytest.approx((0.5, 0.6, 0.5), abs=0.02), "the ruler works"

    first, gap, second = _runs(change_tempo(source, 1.3))
    assert first == pytest.approx(0.5 / 1.3, abs=0.03)
    assert gap == pytest.approx(0.6 / 1.3, abs=0.03)
    assert second == pytest.approx(0.5 / 1.3, abs=0.03)


# ============================================================ (iii) no comb-filter dips


def _band_levels_db(clip: Pcm, edges_hz: list[float]) -> npt.NDArray[np.float64]:
    """Time-averaged power in each band, in dB: 1024-point Hann frames, half-frame hop."""
    size, hop = 1024, 512
    frames = np.lib.stride_tricks.sliding_window_view(clip.samples.astype(np.float64), size)[::hop]
    power = np.mean(np.abs(np.fft.rfft(frames * np.hanning(size), axis=1)) ** 2, axis=0)
    freqs = np.fft.rfftfreq(size, 1 / clip.rate)
    return np.array(
        [
            10 * np.log10(power[(freqs >= low) & (freqs < high)].sum() + 1e-12)
            for low, high in pairwise(edges_hz)
        ]
    )


def test_a_sweep_has_no_comb_filter_dips() -> None:
    """A stretch that laid frames down out of phase with one another would notch the bands it is
    worst at. An exponential sweep spends the same time in every octave, so each octave's average
    power must survive the stretch: within 3 dB, band by band."""
    seconds = 3.0
    t = np.arange(round(seconds * RATE)) / RATE
    # 200 Hz to 6 kHz, exponentially: phase is the integral of the frequency.
    ratio = 6000.0 / 200.0
    phase = 2 * np.pi * 200.0 * seconds / np.log(ratio) * (np.exp(t / seconds * np.log(ratio)) - 1)
    sweep = Pcm(samples=(0.25 * np.sin(phase)).astype(np.float32), rate=RATE)
    edges = [200.0, 400.0, 800.0, 1600.0, 3200.0, 6000.0]

    before = _band_levels_db(sweep, edges)
    for tempo in (1.3, 1.5):
        after = _band_levels_db(change_tempo(sweep, tempo), edges)
        assert np.max(np.abs(after - before)) < 3.0, (tempo, before.round(1), after.round(1))


def test_two_steady_tones_both_survive_at_their_own_frequency_and_level() -> None:
    low, high = 300.0, 2300.0
    t = np.arange(2 * RATE) / RATE
    both = Pcm(
        samples=(0.15 * np.sin(2 * np.pi * low * t) + 0.15 * np.sin(2 * np.pi * high * t)).astype(
            np.float32
        ),
        rate=RATE,
    )
    stretched = change_tempo(both, 1.3)

    def tone_at(clip: Pcm, around: float) -> tuple[float, float]:
        """(frequency of the strongest bin, power in the band around it in dB per second).

        **Power over the whole main lobe, not the height of the peak bin.** A first version read the
        peak bin, and reported 1.2 dB less for a 300 Hz tone that the stretch had left exactly as it
        was: a Hann window's scalloping loss is up to 1.4 dB and differs with the length of the
        signal, which the stretch changes. Band power has no such dependence.
        """
        window = np.hanning(len(clip.samples))
        power = np.abs(np.fft.rfft(clip.samples.astype(np.float64) * window)) ** 2
        freqs = np.fft.rfftfreq(len(clip.samples), 1 / clip.rate)
        band = (freqs > around * 0.97) & (freqs < around * 1.03)
        found = int(np.argmax(power * band))
        per_second = float(np.sum(window**2)) * len(clip.samples)
        return float(freqs[found]), float(10 * np.log10(power[band].sum() / per_second))

    for hz in (low, high):
        f_in, db_in = tone_at(both, hz)
        f_out, db_out = tone_at(stretched, hz)
        assert f_out == pytest.approx(f_in, rel=0.01)
        assert db_out - db_in == pytest.approx(0, abs=1.0)


# ====================================================== (iv) identity, and the same bytes twice


def test_a_tempo_of_one_returns_the_input_itself_not_a_copy() -> None:
    source = pcm(silence(0.1), tone(0.5))

    assert change_tempo(source, 1.0) is source
    assert change_tempo(source, 1) is source


def test_the_same_audio_gives_the_same_bytes_every_time() -> None:
    """The clip's filename is the hash of its mp3, and its listening is cached under that hash: a
    stretch that varied would upload again and pay to listen again on every re-run."""
    source = pcm(silence(0.1), noise(0.4, -25.0), tone(0.7), noise(0.3, -30.0), silence(0.2))

    first, second = change_tempo(source, 1.3), change_tempo(source, 1.3)

    assert first.samples.tobytes() == second.samples.tobytes()


def test_the_input_is_left_alone() -> None:
    source = pcm(noise(0.5, -25.0), tone(0.5))
    before = source.samples.copy()

    change_tempo(source, 1.5)

    assert np.array_equal(source.samples, before)


# ================================================================= (v) out of range is refused


@pytest.mark.parametrize(
    "tempo", [0.99, 0.0, -1.3, 1.5000001, 2.0, float("nan"), float("inf"), float("-inf")]
)
def test_a_tempo_outside_one_to_one_and_a_half_is_an_error(tempo: float) -> None:
    with pytest.raises(AudioError, match="tempo"):
        change_tempo(sine(0.5, 150.0), tempo)
    with pytest.raises(AudioError, match="tempo"):
        require_tempo(tempo)


@pytest.mark.parametrize("tempo", [MIN_TEMPO, 1.3, MAX_TEMPO])
def test_the_ends_of_the_range_are_accepted(tempo: float) -> None:
    assert (MIN_TEMPO, MAX_TEMPO) == (1.0, 1.5)
    assert require_tempo(tempo) == tempo
    assert len(change_tempo(sine(0.5, 150.0), tempo).samples) == round(0.5 * RATE / tempo)


# ==================================================================== small and odd inputs


def test_a_clip_shorter_than_one_frame_is_stretched_without_error() -> None:
    tiny = Pcm(samples=tone(0.004), rate=RATE)  # 96 samples, a frame is 720

    stretched = change_tempo(tiny, 1.3)

    assert len(stretched.samples) == round(len(tiny.samples) / 1.3)
    assert np.all(np.isfinite(stretched.samples))


def test_an_empty_clip_comes_back_as_it_was() -> None:
    empty = Pcm(samples=np.zeros(0, dtype=np.float32), rate=RATE)

    assert change_tempo(empty, 1.3) is empty


def test_it_works_at_another_sample_rate() -> None:
    """Frame and search are seconds, not samples, so a clip at 16 kHz is stretched the same way."""
    source = sine(2.0, 200.0, rate=16_000)
    stretched = change_tempo(source, 1.3)

    assert stretched.rate == 16_000 and len(stretched.samples) == round(32_000 / 1.3)
    assert frequency_hz(stretched) == pytest.approx(200.0, rel=0.01)


# ================================================================ shape_edges, with a tempo
#
# The stretch lives inside `shape_edges` so that the edges are decided on the audio the model
# returned and only the speech between them is scaled. These pin what that means.


def _shape_edges_as_it_was(clip: Pcm) -> tuple[Pcm, EdgeReport]:
    """`shape_edges` **verbatim from origin/main at 265fa99**, before it had a tempo.

    The oracle for "at 1.0 the result is the one this function has always returned". It is a copy
    on purpose: a test that called the function under test to build its own expectation would
    agree with any change made to it. The real-clip regression (all 144 accepted clips re-derived
    byte for byte) is the proof on speech; this is the same claim, permanent, on signals.
    """
    levels = frame_levels_db(clip)
    frame = max(1, round(FRAME_SECONDS * clip.rate))
    speech = np.flatnonzero(levels > SPEECH_DB)
    if speech.size == 0:
        raise AudioError("no frame is loud enough to be speech")
    first, last = int(speech[0]), int(speech[-1])

    decay = 0
    while last + 1 + decay < len(levels) and levels[last + 1 + decay] > FLOOR_DB:
        decay += 1
    decay_seconds = decay * FRAME_SECONDS
    breath = decay_seconds > MAX_DECAY_SECONDS
    kept = round(audio.BREATH_CUT_KEEP_SECONDS / FRAME_SECONDS) if breath else decay

    start = max(0, (first - round(HEAD_PAD_SECONDS / FRAME_SECONDS)) * frame)
    end = min(len(clip.samples), (last + 1 + kept) * frame)
    body = clip.samples[start:end].copy()

    fade_in = min(len(body), round(FADE_IN_SECONDS * clip.rate))
    if fade_in:
        body[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)
    fade_out = min(len(body), round(FADE_OUT_SECONDS * clip.rate))
    if fade_out:
        body[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)

    shaped = np.concatenate(
        [body, np.zeros(round(TAIL_SILENCE_SECONDS * clip.rate), dtype=np.float32)]
    ).astype(np.float32)

    last_sound = last + 1 + decay
    end_window = clip.samples[-max(1, round(0.02 * clip.rate)) :].astype(np.float64)
    report = EdgeReport(
        head_silence_seconds=round(first * FRAME_SECONDS, 3),
        tail_silence_seconds=round(max(0, len(levels) - last_sound) * FRAME_SECONDS, 3),
        low_tail_seconds=round(decay_seconds, 3),
        breath_cut=breath,
        raw_end_db=round(audio._db(float(np.sqrt(np.mean(end_window * end_window)))), 1),
    )
    return Pcm(samples=shaped, rate=clip.rate), report


def _clip_shapes() -> dict[str, Pcm]:
    """Every ending and beginning a real clip has had: a long lead-in, none, a short one, a decay
    kept whole, a breath that is cut, and a clip the model stopped mid-sound."""
    return {
        "long lead-in, clean end": pcm(silence(0.3), tone(1.0), silence(0.5)),
        "no lead-in": pcm(tone(1.0), silence(0.5)),
        "20 ms lead-in": pcm(silence(0.02), tone(1.0), silence(0.5)),
        "decay kept": pcm(silence(0.2), tone(1.0), noise(0.12, -48.0), silence(0.5)),
        "breath cut": pcm(silence(0.2), tone(1.0), noise(0.6, -46.0), silence(0.5)),
        "stops mid-sound": pcm(silence(0.2), tone(1.0)),
        "two words": pcm(silence(0.25), tone(0.4), silence(0.5), tone(0.6), silence(0.4)),
    }


@pytest.mark.parametrize("name", list(_clip_shapes()))
def test_at_a_tempo_of_one_shape_edges_is_the_function_it_always_was(name: str) -> None:
    levelled, _gain = level(_clip_shapes()[name])

    was, was_report = _shape_edges_as_it_was(levelled)
    now, now_report = shape_edges(levelled)
    also, also_report = shape_edges(levelled, tempo=1.0)

    for shaped, report in ((now, now_report), (also, also_report)):
        assert shaped.samples.tobytes() == was.samples.tobytes()
        assert shaped.rate == was.rate and report == was_report


@pytest.mark.parametrize("name", list(_clip_shapes()))
@pytest.mark.parametrize("tempo", [1.1, 1.3, 1.5])
def test_the_edge_report_is_the_models_own_at_every_tempo(name: str, tempo: float) -> None:
    """**Trap 2, at the function.** The report is what the review flags for the founder's ear —
    a breath that was cut, a clip that ended mid-sound — so it must describe the model's audio,
    not a stretched copy of it in which every duration is divided by the tempo."""
    levelled, _gain = level(_clip_shapes()[name])

    _plain, at_one = shape_edges(levelled)
    _stretched, at_tempo = shape_edges(levelled, tempo=tempo)

    assert at_tempo == at_one


def test_a_breath_is_still_cut_when_the_stretch_would_have_hidden_it() -> None:
    """The example the handoff gives: a 0.30 s breath is over `MAX_DECAY_SECONDS` and is cut; at
    1.3x it would be 0.23 s, under it, and would be kept whole if the edges were decided *after*
    the stretch. Decided before, it is cut at every tempo, and the clip shows it."""
    clip = pcm(silence(0.2), tone(1.0), noise(0.30, -46.0), silence(0.5))
    levelled, _gain = level(clip)

    _shaped, report = shape_edges(levelled)
    assert report.breath_cut and report.low_tail_seconds > MAX_DECAY_SECONDS, "the precondition"
    assert report.low_tail_seconds / 1.3 < MAX_DECAY_SECONDS, "and 1.3x would have hidden it"

    stretched, at_1_3 = shape_edges(levelled, tempo=1.3)

    assert at_1_3.breath_cut
    pads = HEAD_PAD_SECONDS + TAIL_SILENCE_SECONDS
    cut_duration = pads + (1.0 + audio.BREATH_CUT_KEEP_SECONDS) / 1.3
    kept_duration = pads + (1.0 + 0.30) / 1.3
    assert stretched.seconds == pytest.approx(cut_duration, abs=0.03)
    assert abs(stretched.seconds - kept_duration) > 0.1, "not the clip a kept breath would make"


@pytest.mark.parametrize("tempo", [1.0, 1.3, 1.5])
def test_the_head_and_the_tail_are_constants_at_every_tempo(tempo: float) -> None:
    """**Trap 1, at the function.** `RenderedClip.words_per_minute` subtracts 60 ms and 350 ms as
    constants. A stretch after the edges were laid down would make them 46 ms and 269 ms at 1.3x."""
    levelled, _gain = level(pcm(silence(0.3), tone(1.0), silence(0.5)))

    shaped, _report = shape_edges(levelled, tempo=tempo)

    first_loud = int(np.flatnonzero(frame_levels_db(shaped) > SPEECH_DB)[0])
    assert first_loud * FRAME_SECONDS == pytest.approx(HEAD_PAD_SECONDS, abs=0.011)
    nonzero = np.flatnonzero(shaped.samples)
    trailing_zeros = len(shaped.samples) - int(nonzero[-1]) - 1
    assert trailing_zeros == pytest.approx(TAIL_SILENCE_SECONDS * RATE, abs=RATE * 0.002)
    speech = shaped.seconds - HEAD_PAD_SECONDS - TAIL_SILENCE_SECONDS
    assert speech == pytest.approx(1.0 / tempo, abs=0.03)


def test_a_lead_in_shorter_than_the_pad_is_kept_as_the_model_made_it() -> None:
    """Two of the 187 raw clips on disk have under 60 ms of lead-in. It is a maximum, not a floor,
    today; it stays one, and is not scaled."""
    levelled, _gain = level(pcm(silence(0.03), tone(1.0), silence(0.5)))

    at_one, _ = shape_edges(levelled)
    at_1_3, _ = shape_edges(levelled, tempo=1.3)

    lead_one = int(np.flatnonzero(frame_levels_db(at_one) > SPEECH_DB)[0])
    lead_1_3 = int(np.flatnonzero(frame_levels_db(at_1_3) > SPEECH_DB)[0])
    assert lead_one == lead_1_3 == 3


def test_shape_edges_refuses_a_bad_tempo() -> None:
    levelled, _gain = level(pcm(silence(0.2), tone(1.0), silence(0.5)))

    with pytest.raises(AudioError, match="tempo"):
        shape_edges(levelled, tempo=1.6)
    with pytest.raises(AudioError, match="tempo"):
        shape_edges(levelled, tempo=0.9)
