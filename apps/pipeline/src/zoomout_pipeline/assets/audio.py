"""Audio: what the voice returned, made to behave like one set, encoded once, and measured.

Everything here is local and deterministic. No model is called and nothing is priced, which
is why the measurements can be re-run over a whole book for free.

## Why every clip is levelled and edged the same way

Each synthesis call is independent, so two clips can come back at different loudness and with
different amounts of silence either side. **Neither is wrong in one clip; both are wrong in a
set** — a reader moving from Summary to Scenario hears a jump in level, and a player advancing
between slides inherits whatever tail the model happened to leave. So every clip is levelled to
the same speech loudness and given the same head and tail, which also makes "how a clip ends"
a property the player (VO-3) can rely on rather than discover.

## What the measurements are for

Nothing in this pipeline can hear, and 72 clips is more than a person listens to carefully. The
numbers here — loudness, pace, pause structure, pitch movement — are not a verdict on whether
a clip sounds human. They are how a clip that is *unlike its siblings* gets found, so the
person listening knows where to listen hardest.
"""

from __future__ import annotations

import io
import math
import wave
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import numpy as np
import numpy.typing as npt

Samples = npt.NDArray[np.float32]

# Analysis frame. 10 ms resolves a pause or a clipped syllable without drowning in frames.
FRAME_SECONDS = 0.010

# Levels are dBFS over a 10 ms frame, after levelling. A frame above `SPEECH_DB` is speech;
# between `FLOOR_DB` and it is a decaying consonant or a breath; below `FLOOR_DB` is silence.
SPEECH_DB = -40.0
FLOOR_DB = -55.0

# The loudness every clip is levelled to, measured over its speech frames only (so a pause
# does not pull the figure down), and the sample-peak ceiling the gain may not push past. The
# ceiling leaves room for the mp3 encoder's own overshoot.
TARGET_SPEECH_DB = -20.0
PEAK_CEILING_DB = -2.0

# The edges every clip is given.
HEAD_PAD_SECONDS = 0.06
TAIL_SILENCE_SECONDS = 0.35
FADE_IN_SECONDS = 0.005
FADE_OUT_SECONDS = 0.030

# Low-level sound after the last speech frame. Up to this long it is the tail of a word — a
# soft "s", a decaying vowel — and is kept whole. Longer than this it is a breath or noise,
# and the clip is ended shortly after the word instead.
MAX_DECAY_SECONDS = 0.25
BREATH_CUT_KEEP_SECONDS = 0.08

# A silence inside speech at least this long counts as a pause.
MIN_PAUSE_SECONDS = 0.15

MP3_BITRATE_KBPS = 64


class AudioError(RuntimeError):
    """Audio that cannot be read, or that contains no speech."""


@dataclass(frozen=True)
class Pcm:
    """Mono samples in [-1, 1] and their rate."""

    samples: Samples
    rate: int

    @property
    def seconds(self) -> float:
        return len(self.samples) / self.rate


# ------------------------------------------------------------------------- containers


def decode_wav(data: bytes) -> Pcm:
    """A 16-bit WAV — what Cloud TTS returns for LINEAR16 — as mono samples."""
    try:
        with wave.open(io.BytesIO(data)) as reader:
            channels = reader.getnchannels()
            width = reader.getsampwidth()
            rate = reader.getframerate()
            raw = reader.readframes(reader.getnframes())
    except (wave.Error, EOFError) as error:
        raise AudioError(f"not a readable WAV: {error}") from error
    if width != 2:
        raise AudioError(f"expected 16-bit samples, got {8 * width}-bit")

    ints = np.frombuffer(raw, dtype="<i2")
    if channels > 1:
        ints = ints[: len(ints) - len(ints) % channels].reshape(-1, channels).mean(axis=1)
    samples = (ints.astype(np.float32) / 32768.0).astype(np.float32)
    if samples.size == 0:
        raise AudioError("the WAV holds no samples")
    return Pcm(samples=samples, rate=rate)


def _int16(samples: Samples) -> bytes:
    return bytes(np.clip(np.round(samples * 32767.0), -32768, 32767).astype("<i2").tobytes())


def encode_wav(pcm: Pcm) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(pcm.rate)
        writer.writeframes(_int16(pcm.samples))
    return buffer.getvalue()


def encode_mp3(pcm: Pcm, *, bitrate_kbps: int = MP3_BITRATE_KBPS) -> bytes:
    """Mono CBR mp3 — the one format `Media` accepts for audio (VO-1: `audio/mpeg` only)."""
    import lameenc  # type: ignore[import-not-found]

    encoder = lameenc.Encoder()
    encoder.set_bit_rate(bitrate_kbps)
    encoder.set_in_sample_rate(pcm.rate)
    encoder.set_channels(1)
    encoder.set_quality(2)
    data = bytes(encoder.encode(_int16(pcm.samples))) + bytes(encoder.flush())
    if not data:
        raise AudioError("the mp3 encoder produced nothing")
    return data


def decode_mp3(data: bytes) -> Pcm:
    """An mp3, fully decoded. **This is how a clip's duration is measured**: from the file
    that is uploaded, sample by sample, rather than estimated from its length or its text."""
    import miniaudio  # type: ignore[import-untyped]

    try:
        # At the file's own rate. `decode` resamples to 44.1 kHz unless told otherwise, which
        # keeps the duration and quietly changes every other measurement.
        info: Any = miniaudio.mp3_get_info(data)
        decoded: Any = miniaudio.decode(
            data,
            output_format=miniaudio.SampleFormat.SIGNED16,
            nchannels=1,
            sample_rate=int(info.sample_rate),
        )
    except miniaudio.DecodeError as error:
        raise AudioError(f"not a decodable mp3: {error}") from error
    ints = np.frombuffer(bytes(decoded.samples), dtype="<i2")
    if ints.size == 0:
        raise AudioError("the mp3 decodes to no samples")
    return Pcm(samples=(ints.astype(np.float32) / 32768.0), rate=int(decoded.sample_rate))


def concatenate(parts: Sequence[tuple[Pcm, float]]) -> Pcm:
    """Clips in order, each followed by its gap in seconds of silence."""
    if not parts:
        raise AudioError("nothing to concatenate")
    rate = parts[0][0].rate
    pieces: list[Samples] = []
    for pcm, gap in parts:
        if pcm.rate != rate:
            raise AudioError(f"cannot join a {pcm.rate} Hz clip to a {rate} Hz set")
        pieces.append(pcm.samples)
        pieces.append(np.zeros(round(gap * rate), dtype=np.float32))
    return Pcm(samples=np.concatenate(pieces).astype(np.float32), rate=rate)


# ----------------------------------------------------------------------------- levels


def _db(value: float) -> float:
    return 20.0 * math.log10(max(value, 1e-9))


def frame_levels_db(pcm: Pcm) -> npt.NDArray[np.float64]:
    """The RMS level of each 10 ms frame, in dBFS. A trailing partial frame is dropped."""
    size = max(1, round(FRAME_SECONDS * pcm.rate))
    count = len(pcm.samples) // size
    if count == 0:
        return np.zeros(0, dtype=np.float64)
    frames = pcm.samples[: count * size].astype(np.float64).reshape(count, size)
    rms = np.sqrt(np.mean(frames * frames, axis=1))
    levels: npt.NDArray[np.float64] = 20.0 * np.log10(np.maximum(rms, 1e-9))
    return levels


def speech_level_db(pcm: Pcm) -> float:
    """Loudness over speech frames only, in dBFS — pauses do not count against a clip."""
    levels = frame_levels_db(pcm)
    speech = levels[levels > SPEECH_DB]
    if speech.size == 0:
        raise AudioError("no frame is loud enough to be speech")
    return float(10.0 * np.log10(np.mean(np.power(10.0, speech / 10.0))))


def level(pcm: Pcm, *, target_db: float = TARGET_SPEECH_DB) -> tuple[Pcm, float]:
    """The clip at the set's speech loudness, and the gain applied to get it there.

    The gain is reduced rather than letting a peak pass `PEAK_CEILING_DB`, so a clip with an
    unusually loud moment comes out a little quieter instead of clipped. The gain is returned
    so a clip that needed an unusual one can be named.
    """
    gain_db = target_db - speech_level_db(pcm)
    peak_db = _db(float(np.max(np.abs(pcm.samples))))
    gain_db = min(gain_db, PEAK_CEILING_DB - peak_db)
    factor = np.float32(10.0 ** (gain_db / 20.0))
    return Pcm(samples=(pcm.samples * factor).astype(np.float32), rate=pcm.rate), gain_db


@dataclass(frozen=True)
class EdgeReport:
    """How a clip began and ended as the model returned it, and what was done about it."""

    head_silence_seconds: float
    tail_silence_seconds: float
    # Low-level sound after the last speech frame: a word's decay when short, a breath or
    # noise when long.
    low_tail_seconds: float
    breath_cut: bool
    # The level of the model's final 20 ms. Speech-level here means the model stopped
    # mid-sound — a clipped last syllable that no amount of trimming can repair.
    raw_end_db: float

    @property
    def ends_mid_sound(self) -> bool:
        return self.raw_end_db > SPEECH_DB


def shape_edges(pcm: Pcm) -> tuple[Pcm, EdgeReport]:
    """The same head, the same tail, and no breath at the cut, on every clip."""
    levels = frame_levels_db(pcm)
    frame = max(1, round(FRAME_SECONDS * pcm.rate))
    speech = np.flatnonzero(levels > SPEECH_DB)
    if speech.size == 0:
        raise AudioError("no frame is loud enough to be speech")
    first, last = int(speech[0]), int(speech[-1])

    decay = 0
    while last + 1 + decay < len(levels) and levels[last + 1 + decay] > FLOOR_DB:
        decay += 1
    decay_seconds = decay * FRAME_SECONDS
    breath = decay_seconds > MAX_DECAY_SECONDS
    kept = round(BREATH_CUT_KEEP_SECONDS / FRAME_SECONDS) if breath else decay

    start = max(0, (first - round(HEAD_PAD_SECONDS / FRAME_SECONDS)) * frame)
    end = min(len(pcm.samples), (last + 1 + kept) * frame)
    body = pcm.samples[start:end].copy()

    fade_in = min(len(body), round(FADE_IN_SECONDS * pcm.rate))
    if fade_in:
        body[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)
    fade_out = min(len(body), round(FADE_OUT_SECONDS * pcm.rate))
    if fade_out:
        body[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)

    shaped = np.concatenate(
        [body, np.zeros(round(TAIL_SILENCE_SECONDS * pcm.rate), dtype=np.float32)]
    ).astype(np.float32)

    last_sound = last + 1 + decay
    end_window = pcm.samples[-max(1, round(0.02 * pcm.rate)) :].astype(np.float64)
    report = EdgeReport(
        head_silence_seconds=round(first * FRAME_SECONDS, 3),
        tail_silence_seconds=round(max(0, len(levels) - last_sound) * FRAME_SECONDS, 3),
        low_tail_seconds=round(decay_seconds, 3),
        breath_cut=breath,
        raw_end_db=round(_db(float(np.sqrt(np.mean(end_window * end_window)))), 1),
    )
    return Pcm(samples=shaped, rate=pcm.rate), report


# ------------------------------------------------------------------------------ pitch

PITCH_MIN_HZ = 65.0
PITCH_MAX_HZ = 400.0
_PITCH_WINDOW_SECONDS = 0.040
_PITCH_HOP_SECONDS = 0.010
# How periodic a frame must be to count as voiced (normalised autocorrelation at the lag).
_VOICING_THRESHOLD = 0.5
# Among lags nearly as periodic as the best one, take the shortest — the usual guard against
# reporting half the true pitch.
_OCTAVE_TOLERANCE = 0.9


def pitch_track(pcm: Pcm) -> npt.NDArray[np.float64]:
    """Fundamental frequency, in Hz, of every voiced 40 ms frame (10 ms hop).

    Autocorrelation with parabolic interpolation: crude beside a research pitch tracker, and
    adequate for the only question asked of it here — how much one clip's pitch moves compared
    with its siblings from the same voice.
    """
    window = round(_PITCH_WINDOW_SECONDS * pcm.rate)
    hop = round(_PITCH_HOP_SECONDS * pcm.rate)
    if len(pcm.samples) < window:
        return np.zeros(0, dtype=np.float64)

    frames = np.lib.stride_tricks.sliding_window_view(pcm.samples.astype(np.float64), window)[::hop]
    rms = np.sqrt(np.mean(frames * frames, axis=1))
    loud = 20.0 * np.log10(np.maximum(rms, 1e-9)) > SPEECH_DB + 5.0
    frames = frames[loud]
    if frames.shape[0] == 0:
        return np.zeros(0, dtype=np.float64)

    frames = (frames - frames.mean(axis=1, keepdims=True)) * np.hanning(window)
    spectrum = np.fft.rfft(frames, n=2 * window, axis=1)
    autocorr = np.fft.irfft(np.abs(spectrum) ** 2, axis=1)[:, :window]
    energy = autocorr[:, :1]
    autocorr = autocorr / np.where(energy > 0, energy, 1.0)

    low = max(2, int(pcm.rate / PITCH_MAX_HZ))
    high = min(window - 2, int(pcm.rate / PITCH_MIN_HZ))
    found: list[float] = []
    for row in autocorr:
        segment = row[low:high]
        best = float(segment.max())
        if best < _VOICING_THRESHOLD:
            continue
        interior = (segment[1:-1] >= segment[:-2]) & (segment[1:-1] >= segment[2:])
        peaks = np.flatnonzero(interior & (segment[1:-1] >= _OCTAVE_TOLERANCE * best)) + 1
        index = int(peaks[0]) if peaks.size else int(segment.argmax())
        lag = low + index
        left, centre, right = row[lag - 1], row[lag], row[lag + 1]
        curvature = left - 2.0 * centre + right
        offset = 0.5 * (left - right) / curvature if curvature != 0 else 0.0
        found.append(pcm.rate / (lag + float(np.clip(offset, -1.0, 1.0))))
    return np.asarray(found, dtype=np.float64)


# ------------------------------------------------------------------------ measurement


@dataclass(frozen=True)
class ClipMetrics:
    """What a clip is like, in numbers that can be compared across a set."""

    seconds: float
    speech_db: float
    peak_db: float
    speech_seconds: float
    pause_count: int
    longest_pause_seconds: float
    pitch_median_hz: float | None
    # Interquartile range of pitch, in semitones. A monotone read sits near 1-2; a read that
    # moves with its meaning sits well above that. Compared within one voice only.
    pitch_spread_semitones: float | None
    voiced_fraction: float


def measure(pcm: Pcm) -> ClipMetrics:
    levels = frame_levels_db(pcm)
    speech = levels > SPEECH_DB
    indices = np.flatnonzero(speech)

    pauses: list[float] = []
    if indices.size:
        gaps = np.diff(indices) - 1
        pauses = [
            float(gap) * FRAME_SECONDS for gap in gaps if gap * FRAME_SECONDS >= MIN_PAUSE_SECONDS
        ]

    pitches = pitch_track(pcm)
    loud_frames = int(np.sum(levels > SPEECH_DB + 5.0))
    median: float | None = None
    spread: float | None = None
    if pitches.size >= 20:
        median = float(np.median(pitches))
        semitones = 12.0 * np.log2(pitches / median)
        q75, q25 = np.percentile(semitones, [75, 25])
        spread = float(q75 - q25)

    return ClipMetrics(
        seconds=round(pcm.seconds, 3),
        speech_db=round(speech_level_db(pcm), 2),
        peak_db=round(_db(float(np.max(np.abs(pcm.samples)))), 2),
        speech_seconds=round(float(np.sum(speech)) * FRAME_SECONDS, 2),
        pause_count=len(pauses),
        longest_pause_seconds=round(max(pauses, default=0.0), 2),
        pitch_median_hz=round(median, 1) if median is not None else None,
        pitch_spread_semitones=round(spread, 2) if spread is not None else None,
        voiced_fraction=round(pitches.size / loud_frames, 3) if loud_frames else 0.0,
    )


__all__ = [
    "AudioError",
    "ClipMetrics",
    "EdgeReport",
    "Pcm",
    "concatenate",
    "decode_mp3",
    "decode_wav",
    "encode_mp3",
    "encode_wav",
    "frame_levels_db",
    "level",
    "measure",
    "pitch_track",
    "shape_edges",
    "speech_level_db",
]
