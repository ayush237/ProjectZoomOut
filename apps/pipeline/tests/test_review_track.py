"""The review track and its cue sheet: the set heard as one thing, and where to listen hardest."""

from __future__ import annotations

from pathlib import Path

from zoomout_pipeline.assets.budget import NarrationBudget
from zoomout_pipeline.assets.narration import direction_for, narration_script
from zoomout_pipeline.assets.review_track import (
    LEAF_GAP_SECONDS,
    SLIDE_GAP_SECONDS,
    consistency,
    join_in_order,
    write_review,
)
from zoomout_pipeline.graph.narration_nodes import ClipStore, RenderedClip, render_line

from .narration_fakes import FakeSpeechBackend, leaf_doc, speech_client


def clips(tmp_path: Path, *, order: int, seconds_per_char: float = 0.052) -> list[RenderedClip]:
    backend = FakeSpeechBackend(seconds_per_char=seconds_per_char)
    return [
        render_line(
            line=line,
            speech=speech_client(backend),
            voice="Sulafat",
            prompt=direction_for(line.slide),
            store=ClipStore(tmp_path / f"s{seconds_per_char}"),
            budget=NarrationBudget(ceiling_usd=3.00),
            record=lambda _spend: None,
            guard=None,
            max_attempts=1,
        )
        for line in narration_script(leaf_doc(order=order, leaf_id=260 + order))
    ]


def test_the_track_is_every_clip_in_reading_order_with_its_gaps(tmp_path: Path) -> None:
    rendered = clips(tmp_path, order=0) + clips(tmp_path, order=1)
    heard = [clip.heard("A book") for clip in rendered]

    track, cues = join_in_order(heard)

    assert [(cue.clip.line.order, cue.clip.line.slide.value) for cue in cues] == [
        (order, slide)
        for order in (0, 1)
        for slide in ("summary", "scenario", "payoff", "takeaway")
    ]
    expected = (
        sum(clip.pcm.seconds for clip in heard) + 6 * SLIDE_GAP_SECONDS + 2 * LEAF_GAP_SECONDS
    )
    assert abs(track.seconds - expected) < 0.01
    assert cues[4].start_seconds > cues[3].start_seconds + heard[3].pcm.seconds + SLIDE_GAP_SECONDS


def test_a_clip_at_an_unnatural_pace_is_named_even_if_every_clip_is_slow(tmp_path: Path) -> None:
    """Absolute, not relative: a whole set that spoke something extra has a median that is
    just as wrong, and nothing in it would stand out from its siblings."""
    slow = [clip.heard("A book") for clip in clips(tmp_path, order=0, seconds_per_char=0.26)]

    report = consistency(slow)

    for clip in slow:
        assert any("outside natural speech" in note for note in report.notes_for(clip))


def test_the_cue_sheet_puts_the_serious_notes_first(tmp_path: Path) -> None:
    fine = [clip.heard("A book") for clip in clips(tmp_path, order=0)]
    slow = [clip.heard("A book") for clip in clips(tmp_path, order=1, seconds_per_char=0.26)]
    heard = fine + slow
    track, cues = join_in_order(heard)

    files = write_review(
        destination=tmp_path / "review" / "book-narration",
        heading="A book — narration review",
        preamble=["test"],
        track=track,
        cues=cues,
        report=consistency(heard),
    )
    audio, sheet = files.audio, files.sheet

    text = sheet.read_text(encoding="utf-8")
    first, rest = text.split("## Every clip", 1)
    assert "Leaf 1 Summary" in first and "outside natural speech" in first
    assert "Leaf 0 Payoff" not in first, "a clip with only routine notes is not a first listen"
    assert "Leaf 0 Payoff" in rest
    assert audio.suffix == ".mp3" and audio.stat().st_size > 1000


def test_an_audition_keeps_every_voice_s_notes_and_register(tmp_path: Path) -> None:
    """The first audition's sheet gave all six readings of a line the last voice's notes, and
    measured one register across a soprano and a baritone."""
    from dataclasses import replace

    base = [clip.heard("A book") for clip in clips(tmp_path, order=0)]
    low = [
        replace(
            clip,
            voice="Low",
            metrics=replace(
                clip.metrics, pitch_median_hz=(clip.metrics.pitch_median_hz or 150) / 2
            ),
        )
        for clip in base
    ]
    odd = replace(base[0], voice="Odd", edges=replace(base[0].edges, breath_cut=True))

    report = consistency([*base, *low, odd])

    assert not any("register" in note for clip in low for note in report.notes_for(clip))
    assert any("low sound followed" in note for note in report.notes_for(odd))
    assert not any("low sound followed" in note for note in report.notes_for(base[0]))


def test_the_listening_page_carries_the_track_and_seeks_to_every_cue(tmp_path: Path) -> None:
    import base64
    import re

    from zoomout_pipeline.assets.audio import decode_mp3

    heard = [clip.heard("A <book>") for clip in clips(tmp_path, order=0)]
    track, cues = join_in_order(heard)

    files = write_review(
        destination=tmp_path / "review" / "book-narration-voice",
        heading="A <book> — narration review",
        preamble=["Narrator **Voice**, `model`."],
        track=track,
        cues=cues,
        report=consistency(heard),
    )

    page = files.page.read_text(encoding="utf-8")
    (embedded,) = re.findall(r'src="data:audio/mpeg;base64,([^"]+)"', page)
    assert base64.b64decode(embedded) == files.audio.read_bytes()
    assert abs(decode_mp3(base64.b64decode(embedded)).seconds - track.seconds) < 0.1
    stamps = {float(t) for t in re.findall(r'data-t="([0-9.]+)"', page)}
    assert stamps == {round(cue.start_seconds, 2) for cue in cues}
    assert "<b>Voice</b>" in page and "<code>model</code>" in page
    assert "A <book>" not in page and "A &lt;book&gt;" in page, "escaped, every time"
    for clip in heard:
        assert clip.line.text.split()[0] in page, "the words it should say, beside each clip"


def test_a_voice_with_a_wide_range_is_not_flagged_for_using_it(tmp_path: Path) -> None:
    """Sadaltager's clips range across about eight semitones; that is how he reads, not a set
    that drifted. One clip an octave away from the rest still is."""
    from dataclasses import replace

    base = [clip.heard("A book") for clip in clips(tmp_path, order=0)]
    base += [clip.heard("A book") for clip in clips(tmp_path, order=1)]
    wide = [
        replace(clip, metrics=replace(clip.metrics, pitch_median_hz=110.0 * 2 ** (shift / 12)))
        for clip, shift in zip(base, [-3.5, -2.0, -1.0, 0.0, 0.5, 1.5, 3.0, 4.4], strict=True)
    ]
    octave = replace(wide[3], metrics=replace(wide[3].metrics, pitch_median_hz=220.0 * 2))
    wide[3] = octave

    report = consistency(wide)

    flagged = [clip for clip in wide if any("register" in n for n in report.notes_for(clip))]
    assert flagged == [octave]
