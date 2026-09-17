"""Hearing a book's narration as one thing: the review track, its cue sheet, and the outliers.

**This is the audio equivalent of the contact sheet and the variety measure, and it is a
requirement rather than a convenience.** Each clip is synthesised independently, so prosody and
energy can drift — clip 3 warm, clip 41 brisk — while no single clip is wrong. Nothing that
looks at one clip at a time can see that; Track 42's eighteen identical pictures are the proof.

So the set is rendered as one file in reading order, and every clip is compared with its own
slide type's siblings. The comparison does not decide anything. It writes down where a person
listening end to end should listen hardest, with a timestamp, because "spot-check eight clips"
is what clearing Leaf 4's bloom by eye looked like.
"""

from __future__ import annotations

import base64
import html
import math
import re
import statistics
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from pathlib import Path

from zoomout_pipeline.assets.audio import (
    HEAD_PAD_SECONDS,
    TAIL_SILENCE_SECONDS,
    ClipMetrics,
    EdgeReport,
    Pcm,
    concatenate,
    encode_mp3,
)
from zoomout_pipeline.assets.narration import NarratedSlide, NarrationLine
from zoomout_pipeline.assets.narration_guard import (
    MAX_NATURAL_WPM,
    MIN_NATURAL_WPM,
    NarrationCheck,
    pace_is_natural,
    speaking_rate,
    spoken_words,
)

SLIDE_GAP_SECONDS = 0.9
LEAF_GAP_SECONDS = 2.2

# How far from its slide type's median a clip may sit before it is named. Relative, and in
# words a listener can use, rather than a z-score nobody can hear.
PACE_TOLERANCE = 0.20
FLATNESS_RATIO = 0.60
REGISTER_TOLERANCE_SEMITONES = 2.0
# A register note is for a clip unlike *its own voice's* other clips. Some voices range wider
# than others — Sadaltager's clips sit anywhere from -3.5 to +4.4 semitones of his median, and a
# flat 2-semitone limit put fifteen routine clips at the top of the "listen first" list. So the
# limit is this many robust standard deviations of the voice's own spread, never below the floor.
REGISTER_OUTLIER_SIGMAS = 3.0
GAIN_TOLERANCE_DB = 4.0

_DIGIT = re.compile(r"\d")


@dataclass(frozen=True)
class HeardClip:
    """What the review needs to know about one clip — decoded audio included."""

    line: NarrationLine
    title: str
    voice: str
    pcm: Pcm
    metrics: ClipMetrics
    edges: EdgeReport
    gain_db: float
    check: NarrationCheck | None
    guard_failed: bool = False

    @property
    def words(self) -> int:
        return len(spoken_words(self.line.text))

    @property
    def words_per_minute(self) -> float:
        """The pace a listener hears, pauses included."""
        return speaking_rate(
            self.line.text, self.metrics.seconds - HEAD_PAD_SECONDS - TAIL_SILENCE_SECONDS
        )

    @property
    def articulation_wpm(self) -> float:
        """Words over speech time only — the measure the absolute check reads."""
        return speaking_rate(self.line.text, self.metrics.speech_seconds)


@dataclass(frozen=True)
class SlideNorms:
    """What a typical clip of one slide type is like, in this set."""

    count: int
    pace_wpm: float
    pitch_spread: float | None
    gain_db: float


@dataclass
class SetReport:
    total_seconds: float
    norms: dict[NarratedSlide, SlideNorms]
    voice_pitch_hz: float | None
    # Keyed by voice as well: an audition reads the same line in six voices, and a key of
    # (Leaf, slide) alone let the last voice's notes stand for all six.
    notes: dict[tuple[str, int, NarratedSlide], list[str]] = field(default_factory=dict)
    voice_pitch_by_voice: dict[str, float] = field(default_factory=dict)

    def notes_for(self, clip: HeardClip) -> list[str]:
        return self.notes.get(_key(clip), [])


def _key(clip: HeardClip) -> tuple[str, int, NarratedSlide]:
    return (clip.voice, clip.line.order, clip.line.slide)


def _median(values: Sequence[float]) -> float | None:
    return statistics.median(values) if values else None


def consistency(clips: Sequence[HeardClip], *, listen_terms: Sequence[str] = ()) -> SetReport:
    """Every clip against its own slide type's siblings, and everything worth a listen.

    **What is typical is measured on the clips that are plausibly the text alone.** A clip at
    an unnatural pace has something else in it, and letting it into the median drags the norm
    toward itself — which then makes its healthy siblings look like the outliers.
    """
    natural = [clip for clip in clips if pace_is_natural(clip.articulation_wpm)] or list(clips)
    norms: dict[NarratedSlide, SlideNorms] = {}
    for slide in NarratedSlide:
        everyone = [clip for clip in clips if clip.line.slide is slide]
        if not everyone:
            continue
        mine = [clip for clip in natural if clip.line.slide is slide] or everyone
        spreads = [
            c.metrics.pitch_spread_semitones
            for c in mine
            if c.metrics.pitch_spread_semitones is not None
        ]
        norms[slide] = SlideNorms(
            count=len(everyone),
            pace_wpm=statistics.median(c.words_per_minute for c in mine),
            pitch_spread=_median(spreads),
            gain_db=statistics.median(c.gain_db for c in mine),
        )

    # A register is a property of one voice. Measured per voice, so an audition of six does
    # not compare a baritone with a soprano.
    by_voice: dict[str, float] = {}
    register_limit: dict[str, float] = {}
    for voice in {clip.voice for clip in clips}:
        heard = [
            c.metrics.pitch_median_hz
            for c in natural
            if c.voice == voice and c.metrics.pitch_median_hz is not None
        ]
        middle = _median(heard)
        if middle is None:
            continue
        by_voice[voice] = middle
        shifts = [12.0 * math.log2(pitch / middle) for pitch in heard]
        centre = statistics.median(shifts)
        voice_spread = 1.4826 * statistics.median(abs(shift - centre) for shift in shifts)
        register_limit[voice] = max(
            REGISTER_TOLERANCE_SEMITONES, REGISTER_OUTLIER_SIGMAS * voice_spread
        )
    pitches = [c.metrics.pitch_median_hz for c in natural if c.metrics.pitch_median_hz is not None]
    report = SetReport(
        total_seconds=sum(c.pcm.seconds for c in clips),
        norms=norms,
        voice_pitch_hz=_median(pitches),
        voice_pitch_by_voice=by_voice,
    )

    terms = [term.casefold() for term in listen_terms if term.strip()]
    for clip in clips:
        notes: list[str] = []
        norm = norms[clip.line.slide]
        label = clip.line.slide.value

        if clip.check is not None:
            notes.extend(f"guard — {finding}" for finding in clip.check.findings())
        elif clip.guard_failed:
            notes.append("NOT CHECKED — the transcript guard did not run on this clip")

        pace = clip.words_per_minute
        articulation = clip.articulation_wpm
        if not pace_is_natural(articulation):
            # Absolute, not relative: if every clip in a set spoke something extra, the set's
            # own median would be just as wrong and nothing would stand out from it.
            notes.append(
                f"{articulation:.0f} words a minute of speech is outside natural speech "
                f"({MIN_NATURAL_WPM:.0f}-{MAX_NATURAL_WPM:.0f}) — something other than the text "
                "may have been spoken"
            )
        elif norm.pace_wpm and abs(pace - norm.pace_wpm) > PACE_TOLERANCE * norm.pace_wpm:
            direction = "faster" if pace > norm.pace_wpm else "slower"
            notes.append(
                f"pace {pace:.0f} wpm, {direction} than a typical {label} ({norm.pace_wpm:.0f})"
            )
        spread = clip.metrics.pitch_spread_semitones
        if spread is not None and norm.pitch_spread and spread < FLATNESS_RATIO * norm.pitch_spread:
            notes.append(
                f"flatter than its siblings: pitch moves {spread:.1f} semitones against "
                f"{norm.pitch_spread:.1f} for a typical {label}"
            )
        own_pitch = clip.metrics.pitch_median_hz
        voice_pitch = report.voice_pitch_by_voice.get(clip.voice)
        if own_pitch and voice_pitch:
            shift = 12.0 * math.log2(own_pitch / voice_pitch)
            if abs(shift) > register_limit.get(clip.voice, REGISTER_TOLERANCE_SEMITONES):
                notes.append(f"register {shift:+.1f} semitones from the voice's usual pitch")
        if abs(clip.gain_db - norm.gain_db) > GAIN_TOLERANCE_DB:
            notes.append(
                f"came back {clip.gain_db - norm.gain_db:+.1f} dB off its siblings' level "
                "before levelling"
            )
        if clip.edges.breath_cut:
            notes.append(
                f"a {clip.edges.low_tail_seconds:.2f}s low sound followed the last word and "
                "was cut — check the ending"
            )
        if clip.edges.ends_mid_sound:
            notes.append("the model's audio ended mid-sound — the last syllable may be clipped")
        if "—" in clip.line.text:
            notes.append("em dash — should be a pause, not a word")
        if _DIGIT.search(clip.line.text):
            notes.append("numbers")
        lowered = clip.line.text.casefold()
        named = [term for term in terms if term in lowered]
        if named:
            notes.append(f"pronunciation: {', '.join(named)}")
        report.notes[_key(clip)] = notes
    return report


# ------------------------------------------------------------------------------ track


@dataclass(frozen=True)
class Cue:
    start_seconds: float
    clip: HeardClip


def join_in_order(
    clips: Sequence[HeardClip],
    *,
    same_group: Callable[[HeardClip, HeardClip], bool] | None = None,
    inner_gap: float = SLIDE_GAP_SECONDS,
    outer_gap: float = LEAF_GAP_SECONDS,
) -> tuple[Pcm, list[Cue]]:
    """One file, clips in the order given, a short gap within a group and a longer one
    between groups (by default, a group is a Leaf)."""
    grouped = same_group or (lambda a, b: a.line.order == b.line.order)
    parts: list[tuple[Pcm, float]] = []
    cues: list[Cue] = []
    elapsed = 0.0
    for index, clip in enumerate(clips):
        following = clips[index + 1] if index + 1 < len(clips) else None
        gap = inner_gap if following is not None and grouped(clip, following) else outer_gap
        cues.append(Cue(start_seconds=elapsed, clip=clip))
        parts.append((clip.pcm, gap))
        elapsed += clip.pcm.seconds + gap
    return concatenate(parts), cues


def timestamp(seconds: float) -> str:
    whole = int(seconds)
    return f"{whole // 60:02d}:{whole % 60:02d}"


@dataclass(frozen=True)
class ReviewFiles:
    """The track, its cue sheet, and a page that plays the track from any cue."""

    audio: Path
    sheet: Path
    page: Path


def write_review(
    *,
    destination: Path,
    heading: str,
    preamble: Sequence[str],
    track: Pcm,
    cues: Sequence[Cue],
    report: SetReport,
    show_voice: bool = False,
) -> ReviewFiles:
    """The track as mp3, its cue sheet as markdown, and a listening page, side by side.

    **The page exists because a timestamp is a chore.** "Listen here first" is only useful if
    listening there is one click; the page carries the track itself and seeks to any cue, so
    it works opened straight from disk with nothing else beside it.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    audio_path = destination.with_suffix(".mp3")
    encoded = encode_mp3(track)
    audio_path.write_bytes(encoded)

    lines = [f"# {heading}", "", *preamble, ""]
    lines.append(
        f"**{len(cues)} clips, {timestamp(track.seconds)} in total.** Timestamps are positions "
        f"in `{audio_path.name}`."
    )
    lines += ["", "## Listen here first", ""]
    flagged = [cue for cue in cues if _serious(report.notes_for(cue.clip))]
    if not flagged:
        lines.append("Nothing was flagged beyond the routine notes in the table below.")
    for cue in flagged:
        clip = cue.clip
        who = f" ({clip.voice})" if show_voice else ""
        lines.append(
            f"- **{timestamp(cue.start_seconds)}** {clip.line.label}{who} — "
            + "; ".join(report.notes_for(clip))
        )

    lines += ["", "## Every clip", ""]
    lines.append("| At | Clip | Length | Pace | Pitch moves | Notes |")
    lines.append("|---|---|---|---|---|---|")
    for cue in cues:
        clip = cue.clip
        who = f" · {clip.voice}" if show_voice else ""
        spread = clip.metrics.pitch_spread_semitones
        lines.append(
            f"| {timestamp(cue.start_seconds)} | {clip.line.label}{who} | "
            f"{clip.metrics.seconds:.1f}s | {clip.words_per_minute:.0f} wpm | "
            f"{f'{spread:.1f} st' if spread is not None else '—'} | "
            f"{'; '.join(report.notes_for(clip)) or ''} |"
        )

    lines += ["", "## What the listening model said", ""]
    lines.append(
        "A model's opinion, recorded so a person can disagree with it — **not** evidence that "
        "anything sounds human."
    )
    lines.append("")
    for cue in cues:
        clip = cue.clip
        if clip.check is None:
            continue
        who = f" ({clip.voice})" if show_voice else ""
        lines.append(f"- {clip.line.label}{who}: {clip.check.reading.delivery}")

    lines += ["", "## By slide type", ""]
    for slide, norm in report.norms.items():
        movement = f"{norm.pitch_spread:.1f} st" if norm.pitch_spread is not None else "—"
        lines.append(
            f"- **{slide.value}** — {norm.count} clips, typical pace {norm.pace_wpm:.0f} wpm, "
            f"typical pitch movement {movement}"
        )
    sheet_path = destination.with_suffix(".md")
    sheet_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    page_path = destination.with_suffix(".html")
    page_path.write_text(
        _page(
            heading=heading,
            preamble=preamble,
            encoded=encoded,
            seconds=track.seconds,
            cues=cues,
            report=report,
            show_voice=show_voice,
        ),
        encoding="utf-8",
    )
    return ReviewFiles(audio=audio_path, sheet=sheet_path, page=page_path)


_BOLD = re.compile(r"\*\*(.+?)\*\*")
_CODE = re.compile(r"`(.+?)`")


def _inline(text: str) -> str:
    """Escaped text with the two pieces of markdown the preambles use."""
    escaped = html.escape(text)
    return _CODE.sub(r"<code>\1</code>", _BOLD.sub(r"<b>\1</b>", escaped))


def _page(
    *,
    heading: str,
    preamble: Sequence[str],
    encoded: bytes,
    seconds: float,
    cues: Sequence[Cue],
    report: SetReport,
    show_voice: bool,
) -> str:
    def seek(cue: Cue) -> str:
        return (
            f'<button type="button" data-t="{cue.start_seconds:.2f}">'
            f"{timestamp(cue.start_seconds)}</button>"
        )

    def label(clip: HeardClip) -> str:
        who = f" · {html.escape(clip.voice)}" if show_voice else ""
        return f"{html.escape(clip.line.label)}{who}"

    flagged = [cue for cue in cues if _serious(report.notes_for(cue.clip))]
    first = (
        "".join(
            f"<li>{seek(cue)} <b>{label(cue.clip)}</b> — "
            f"{html.escape('; '.join(report.notes_for(cue.clip)))}</li>"
            for cue in flagged
        )
        or "<li>Nothing was flagged beyond the routine notes below.</li>"
    )

    rows = []
    for cue in cues:
        clip = cue.clip
        heard = ""
        if clip.check is not None and clip.check.diff.errors:
            heard = f'<div class="heard">heard: {html.escape(clip.check.reading.transcript)}</div>'
        spread = clip.metrics.pitch_spread_semitones
        rows.append(
            f"<tr><td>{seek(cue)}</td><td><b>{label(clip)}</b>"
            f'<div class="text">{html.escape(clip.line.text)}</div>{heard}</td>'
            f"<td>{clip.metrics.seconds:.1f}s</td><td>{clip.words_per_minute:.0f}</td>"
            f"<td>{f'{spread:.1f}' if spread is not None else '—'}</td>"
            f"<td>{html.escape('; '.join(report.notes_for(clip)))}</td></tr>"
        )

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(heading)}</title>
<style>
:root {{ --bg:#fbfaf7; --fg:#1d1c1a; --mute:#6b675f; --line:#e4e0d8; --accent:#1f6f6a; }}
@media (prefers-color-scheme: dark) {{
  :root {{ --bg:#141412; --fg:#ecebe6; --mute:#a19c92; --line:#34322e; --accent:#6cc4bd; }}
}}
body {{ background:var(--bg); color:var(--fg); margin:24px 16px; max-width:1100px;
  font:15px/1.45 -apple-system, system-ui, sans-serif; }}
h1 {{ font-size:22px; margin:0 0 8px }} h2 {{ font-size:16px; margin:28px 0 8px }}
p {{ color:var(--mute); margin:4px 0 }}
audio {{ width:100%; margin:16px 0; position:sticky; top:0 }}
button {{ font:inherit; font-variant-numeric:tabular-nums; color:var(--accent);
  background:none; border:1px solid var(--line); border-radius:6px; padding:2px 8px;
  cursor:pointer }}
ul {{ padding-left:18px }} li {{ margin:6px 0 }}
.wrap {{ overflow-x:auto }} table {{ border-collapse:collapse; width:100% }}
th, td {{ border-top:1px solid var(--line); padding:8px 6px; text-align:left;
  vertical-align:top }}
td:nth-child(3), td:nth-child(4), td:nth-child(5) {{ font-variant-numeric:tabular-nums;
  white-space:nowrap }}
.text, .heard {{ color:var(--mute); font-size:13px; margin-top:4px }}
.heard {{ font-style:italic }}
</style></head><body>
<h1>{html.escape(heading)}</h1>
{"".join(f"<p>{_inline(line)}</p>" for line in preamble)}
<p><b>{len(cues)} clips, {timestamp(seconds)}.</b> Any timestamp plays from there.</p>
<audio id="track" controls preload="metadata"
  src="data:audio/mpeg;base64,{base64.b64encode(encoded).decode("ascii")}"></audio>
<h2>Listen here first</h2>
<ul>{first}</ul>
<h2>Every clip</h2>
<div class="wrap"><table>
<tr><th>At</th><th>Clip, and the words it should say</th><th>Length</th><th>wpm</th>
<th>Pitch moves</th><th>Notes</th></tr>
{"".join(rows)}
</table></div>
<script>
document.addEventListener("click", (event) => {{
  const cue = event.target.closest("[data-t]");
  if (!cue) return;
  const track = document.getElementById("track");
  track.currentTime = parseFloat(cue.dataset.t);
  track.play();
}});
</script>
</body></html>
"""


_ROUTINE = ("em dash", "numbers", "pronunciation")


def _serious(notes: Sequence[str]) -> bool:
    """Anything beyond the routine listen-fors every book will have."""
    return any(not note.startswith(_ROUTINE) for note in notes)


__all__ = [
    "LEAF_GAP_SECONDS",
    "SLIDE_GAP_SECONDS",
    "Cue",
    "HeardClip",
    "ReviewFiles",
    "SetReport",
    "SlideNorms",
    "consistency",
    "join_in_order",
    "timestamp",
    "write_review",
]
