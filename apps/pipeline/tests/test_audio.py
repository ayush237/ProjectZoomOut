"""Audio handling: every clip levelled and edged the same way, measured from the uploaded file.

Tested on synthetic signals whose properties are known — a tone of a known pitch, a pause of a
known length, a breath of a known level — never on how a voice sounds, which no test can hear.
"""

from __future__ import annotations

import io
import wave

import numpy as np
import pytest

from zoomout_pipeline.assets import audio
from zoomout_pipeline.assets.audio import (
    FLOOR_DB,
    HEAD_PAD_SECONDS,
    PEAK_CEILING_DB,
    TAIL_SILENCE_SECONDS,
    TARGET_SPEECH_DB,
    AudioError,
    Pcm,
    concatenate,
    decode_mp3,
    decode_wav,
    encode_mp3,
    encode_wav,
    level,
    measure,
    pitch_track,
    shape_edges,
    speech_level_db,
)

RATE = 24_000


def tone(seconds: float, *, hz: float = 150.0, amplitude: float = 0.25) -> np.ndarray:
    t = np.arange(int(seconds * RATE)) / RATE
    return (amplitude * np.sin(2 * np.pi * hz * t)).astype(np.float32)


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(seconds * RATE), dtype=np.float32)


def noise(seconds: float, db: float) -> np.ndarray:
    values = np.random.default_rng(3).standard_normal(int(seconds * RATE))
    return (values * 10 ** (db / 20)).astype(np.float32)


def pcm(*pieces: np.ndarray) -> Pcm:
    return Pcm(samples=np.concatenate(pieces).astype(np.float32), rate=RATE)


# ------------------------------------------------------------------------ containers


def test_wav_round_trips() -> None:
    original = pcm(silence(0.1), tone(0.5), silence(0.1))
    back = decode_wav(encode_wav(original))

    assert back.rate == RATE
    assert len(back.samples) == len(original.samples)
    assert np.max(np.abs(back.samples - original.samples)) < 1e-4


def test_a_stereo_wav_is_mixed_down() -> None:
    frames = np.round(np.stack([tone(0.2), tone(0.2)], axis=1) * 32767).astype("<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(2)
        writer.setsampwidth(2)
        writer.setframerate(RATE)
        writer.writeframes(frames.tobytes())

    assert len(decode_wav(buffer.getvalue()).samples) == int(0.2 * RATE)


@pytest.mark.parametrize("data", [b"", b"not audio at all", b"RIFF\x00\x00"])
def test_unreadable_audio_is_an_error(data: bytes) -> None:
    with pytest.raises(AudioError):
        decode_wav(data)
    with pytest.raises(AudioError):
        decode_mp3(data)


def test_an_eight_bit_wav_is_refused() -> None:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(1)
        writer.setframerate(RATE)
        writer.writeframes(bytes(100))

    with pytest.raises(AudioError, match="16-bit"):
        decode_wav(buffer.getvalue())


def test_the_mp3_keeps_the_rate_and_the_length() -> None:
    """Duration is measured by decoding what is uploaded. The encoder adds its own delay and
    padding — under a tenth of a second — and that is part of what the player plays."""
    original = pcm(silence(0.2), tone(3.0), silence(0.3))
    data = encode_mp3(original)
    decoded = decode_mp3(data)

    assert data[:2] in (b"\xff\xf3", b"\xff\xf2", b"ID"), "an mp3 frame or tag"
    assert decoded.rate == RATE, "decoded at the file's own rate, not resampled to 44.1 kHz"
    assert original.seconds <= decoded.seconds < original.seconds + 0.1


def test_encoding_is_deterministic() -> None:
    """Upload filenames carry the hash of the bytes, so the same clip must encode the same."""
    clip = pcm(silence(0.1), tone(1.0), silence(0.1))
    assert encode_mp3(clip) == encode_mp3(clip)


def test_concatenation_adds_the_gaps() -> None:
    joined = concatenate([(pcm(tone(1.0)), 0.5), (pcm(tone(2.0)), 1.0)])
    assert joined.seconds == pytest.approx(4.5, abs=1e-3)


def test_clips_at_different_rates_are_not_joined() -> None:
    other = Pcm(samples=tone(1.0), rate=16_000)
    with pytest.raises(AudioError, match="Hz"):
        concatenate([(pcm(tone(1.0)), 0.5), (other, 0.5)])


# ------------------------------------------------------------------------------ level


@pytest.mark.parametrize("amplitude", [0.02, 0.1, 0.4])
def test_every_clip_is_levelled_to_the_same_speech_loudness(amplitude: float) -> None:
    quiet_or_loud = pcm(silence(0.3), tone(1.0, amplitude=amplitude), silence(1.0))
    levelled, _gain = level(quiet_or_loud)

    assert speech_level_db(levelled) == pytest.approx(TARGET_SPEECH_DB, abs=0.2)


def test_levelling_never_pushes_a_peak_past_the_ceiling() -> None:
    """A clip with one loud moment comes out quieter rather than clipped."""
    # Speech at a modest level with one 10 ms spike: reaching the target would need about
    # +5 dB, and the spike leaves room for only about +2.
    spiky = pcm(tone(1.0, amplitude=0.05), tone(0.01, amplitude=0.6), tone(0.2, amplitude=0.05))
    levelled, gain = level(spiky)

    peak = 20 * np.log10(np.max(np.abs(levelled.samples)))
    assert peak <= PEAK_CEILING_DB + 1e-3
    assert speech_level_db(levelled) < TARGET_SPEECH_DB
    assert gain < TARGET_SPEECH_DB - speech_level_db(spiky)


def test_silence_has_no_speech_level() -> None:
    with pytest.raises(AudioError, match="speech"):
        speech_level_db(pcm(silence(1.0)))


# ------------------------------------------------------------------------------ edges


def test_every_clip_gets_the_same_head_and_tail() -> None:
    for head, tail in [(0.05, 0.1), (0.8, 1.5)]:
        levelled, _ = level(pcm(silence(head), tone(1.0), silence(tail)))
        shaped, report = shape_edges(levelled)

        assert report.head_silence_seconds == pytest.approx(head, abs=0.011)
        assert shaped.seconds == pytest.approx(
            min(head, HEAD_PAD_SECONDS) + 1.0 + TAIL_SILENCE_SECONDS, abs=0.03
        )
        assert np.all(shaped.samples[-int(TAIL_SILENCE_SECONDS * RATE) :] == 0.0)
        assert not report.breath_cut


def test_a_short_decay_after_the_last_word_is_kept() -> None:
    """A soft final consonant is quiet and brief, and it is part of the word."""
    levelled, _ = level(pcm(silence(0.2), tone(1.0), noise(0.12, -48.0), silence(0.5)))
    shaped, report = shape_edges(levelled)

    assert not report.breath_cut
    assert report.low_tail_seconds == pytest.approx(0.12, abs=0.02)
    assert shaped.seconds == pytest.approx(
        HEAD_PAD_SECONDS + 1.0 + 0.12 + TAIL_SILENCE_SECONDS, abs=0.03
    )


def test_a_breath_after_the_last_word_is_cut() -> None:
    levelled, _ = level(pcm(silence(0.2), tone(1.0), noise(0.6, -46.0), silence(0.5)))
    shaped, report = shape_edges(levelled)

    assert report.breath_cut
    assert report.low_tail_seconds > 0.25
    assert shaped.seconds < HEAD_PAD_SECONDS + 1.0 + 0.2 + TAIL_SILENCE_SECONDS


def test_audio_that_stops_mid_sound_is_reported() -> None:
    levelled, _ = level(pcm(silence(0.2), tone(1.0)))
    _shaped, report = shape_edges(levelled)

    assert report.ends_mid_sound


def test_a_clip_ending_in_silence_is_not_reported_as_clipped() -> None:
    levelled, _ = level(pcm(silence(0.2), tone(1.0), silence(0.4)))
    _shaped, report = shape_edges(levelled)

    assert not report.ends_mid_sound
    assert report.raw_end_db < FLOOR_DB


# ---------------------------------------------------------------------------- measure


def test_pitch_is_measured_on_a_known_tone() -> None:
    for hz in (110.0, 180.0, 260.0):
        pitches = pitch_track(pcm(tone(1.0, hz=hz)))
        assert pitches.size > 50
        assert float(np.median(pitches)) == pytest.approx(hz, rel=0.02)


def test_a_steady_tone_does_not_move_and_a_glide_does() -> None:
    steady = measure(pcm(tone(2.0, hz=150.0)))
    t = np.arange(int(2.0 * RATE)) / RATE
    glide_hz = 120.0 * 2 ** (t / 2.0)
    phase = 2 * np.pi * np.cumsum(glide_hz) / RATE
    glide = measure(Pcm(samples=(0.25 * np.sin(phase)).astype(np.float32), rate=RATE))

    assert steady.pitch_spread_semitones is not None and steady.pitch_spread_semitones < 0.2
    assert glide.pitch_spread_semitones is not None and glide.pitch_spread_semitones > 4.0


def test_pauses_inside_speech_are_counted() -> None:
    metrics = measure(
        pcm(silence(0.2), tone(0.5), silence(0.3), tone(0.5), silence(0.05), tone(0.5))
    )

    assert metrics.pause_count == 1, "a 50 ms gap is not a pause"
    assert metrics.longest_pause_seconds == pytest.approx(0.3, abs=0.02)
    assert metrics.speech_seconds == pytest.approx(1.5, abs=0.05)


def test_too_little_voicing_reports_no_pitch() -> None:
    metrics = measure(pcm(silence(0.5), tone(0.1)))
    assert metrics.pitch_median_hz is None
    assert metrics.pitch_spread_semitones is None


def test_the_module_calls_nothing_remote() -> None:
    """Local and deterministic: no client, no network, nothing priced."""
    source = audio.__file__
    assert source is not None
    text = open(source, encoding="utf-8").read()  # noqa: SIM115
    for forbidden in ("google", "httpx", "urllib", "requests", "TokenSpend"):
        assert f"import {forbidden}" not in text and f"from {forbidden}" not in text
