"""What voiceover reads aloud, how it is directed, and what each clip is called.

## The legal boundary lives here

**Narration reads four fields and nothing else:** `summary.body`, `scenario.prompt`,
`payoff.body` and `takeaway.body`. Those are ZoomOut's own prose. `sourceReferences[].quote`
holds the book's verbatim words, and reading it aloud would produce an audio reproduction of
copyrighted text — a different act from quoting in support of commentary, and one the
fair-use position does not reach (`LEGAL.md`, "Narration"). `takeaway.dinnerTableKnowledge`
and `applyInLife` are outside the product scope rather than outside the law, and they are
excluded the same way.

The failure this guards against is a reasonable instruction — "narrate the slide" — so the
boundary is a structure rather than a promise:

- `NARRATED_FIELDS` is the whole list of places narration may read. It is a frozen mapping of
  exact `(group, field)` pairs, and `tests/test_narration_selection.py` asserts it exactly, so
  widening it is a deliberate act with a failing test attached.
- `narration_script` is the only function that reads a Leaf for narration, and it reads
  through that mapping and nothing else. A test asserts it is the only place a
  `NarrationLine` is built.
- `SpeechClient.synthesize` accepts a `NarrationLine` and nothing else. A bare string —
  a quote someone pulled out of the document by hand — has no way in.

## Direction is per slide type

`prompts/narration_direction.md` holds one shared block and one block per slide type, and a
clip's direction is always the shared block plus its type's block. Per-clip tuning would not
survive a second book.
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from functools import lru_cache
from types import MappingProxyType
from typing import Any

from zoomout_pipeline.prompts import load_prompt


class NarratedSlide(StrEnum):
    """The four slides that are read aloud, in reading order.

    `stickyNotes` is absent by construction, not by filter: the product scope narrates four
    slides, and a slide that is not a member of this enum cannot be asked for.
    """

    SUMMARY = "summary"
    SCENARIO = "scenario"
    PAYOFF = "payoff"
    TAKEAWAY = "takeaway"


# The only places narration may read. `(Payload group, field inside it)`, in reading order.
NARRATED_FIELDS: Mapping[NarratedSlide, tuple[str, str]] = MappingProxyType(
    {
        NarratedSlide.SUMMARY: ("summary", "body"),
        NarratedSlide.SCENARIO: ("scenario", "prompt"),
        NarratedSlide.PAYOFF: ("payoff", "body"),
        NarratedSlide.TAKEAWAY: ("takeaway", "body"),
    }
)

# The Payload groups a narration write touches — derived, so the write and the read cannot
# name different groups.
NARRATED_GROUPS: tuple[str, ...] = tuple(group for group, _field in NARRATED_FIELDS.values())

# Cloud TTS refuses a `text` or `prompt` field over this many bytes (Gemini-TTS docs).
MAX_FIELD_BYTES = 4000

_SLIDE_LABELS: Mapping[NarratedSlide, str] = MappingProxyType(
    {
        NarratedSlide.SUMMARY: "Summary",
        NarratedSlide.SCENARIO: "Scenario",
        NarratedSlide.PAYOFF: "Payoff",
        NarratedSlide.TAKEAWAY: "Takeaway",
    }
)


class NarrationSourceError(RuntimeError):
    """A Leaf is missing text a narrated slide needs. Refused rather than skipped: a Leaf
    with three clips and a silent fourth reads as a player bug, not as missing content."""


class NarrationDirectionError(RuntimeError):
    """The direction file does not have the shape the four slide types need."""


# ---------------------------------------------------------------------------- the text


@dataclass(frozen=True)
class NarrationLine:
    """One narrated field of one Leaf.

    **Built by `narration_script` and nowhere else.** `text` is the field exactly as the CMS
    holds it — what a reader sees on screen — and `spoken` is the same words as they are sent
    to the voice.
    """

    order: int
    slide: NarratedSlide
    text: str

    @property
    def spoken(self) -> str:
        return speakable(self.text)

    @property
    def label(self) -> str:
        return f"Leaf {self.order} {_SLIDE_LABELS[self.slide]}"


def narration_script(leaf: Mapping[str, Any]) -> list[NarrationLine]:
    """The four lines to read for one Leaf, in reading order.

    `leaf` is the document as Payload returns it. Only `orderIndex` and the four
    `NARRATED_FIELDS` are read; nothing else in the document can reach a `NarrationLine`.
    """
    order = int(leaf["orderIndex"])
    lines: list[NarrationLine] = []
    for slide, (group, field) in NARRATED_FIELDS.items():
        container = leaf.get(group)
        value = container.get(field) if isinstance(container, Mapping) else None
        if not isinstance(value, str) or not value.strip():
            raise NarrationSourceError(
                f"Leaf {order} has no {group}.{field}, so its {slide.value} slide has nothing "
                "to narrate. Fix the Leaf rather than narrating three of four slides."
            )
        lines.append(NarrationLine(order=order, slide=slide, text=value))
    return lines


# An em dash, with whatever spacing the prose used around it. Only the em dash: an en dash
# joins ranges ("2–6"), and spacing one out would turn "two to six" into "two, six".
_EM_DASH = re.compile(r"\s*—\s*")
_WHITESPACE = re.compile(r"\s+")


def speakable(text: str) -> str:
    """The text as the voice receives it: **the same words in the same order.**

    Two changes, both to spacing. Runs of whitespace collapse to one space, and an em dash is
    spaced out. Ikigai writes em dashes closed up — "team—a routine task" — which a speech
    model can read as one run-on token rather than a pause; spaced, it is the conventional
    written form of the pause the direction asks for.

    Nothing else is normalised. Numbers, symbols and names go through as written, because
    a rewrite here would be the pipeline editing prose the human already approved.
    """
    return _WHITESPACE.sub(" ", _EM_DASH.sub(" — ", text.strip()))


# ----------------------------------------------------------------------- the direction


_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
_SECTION = re.compile(r"^## +(\w+)[ \t]*$", re.MULTILINE)
_SHARED = "shared"


@lru_cache(maxsize=1)
def load_direction() -> Mapping[NarratedSlide, str]:
    """The rendered style prompt for each slide type: shared block, blank line, own block.

    Parsed strictly. A missing section, an extra one or an empty one is an error: a direction
    file that silently lost its `takeaway` section would narrate every closing thought with
    only the shared block, and nobody listening to one clip would notice.
    """
    source = _COMMENT.sub("", load_prompt("narration_direction"))
    pieces = _SECTION.split(source)
    # `split` with one group yields [preamble, name, body, name, body, ...].
    preamble, pairs = pieces[0], pieces[1:]
    if preamble.strip():
        raise NarrationDirectionError(
            "narration_direction.md has text outside any section, which would never be sent"
        )

    sections: dict[str, str] = {}
    for name, body in zip(pairs[::2], pairs[1::2], strict=True):
        if name in sections:
            raise NarrationDirectionError(f"narration_direction.md repeats section {name!r}")
        sections[name] = body.strip()

    expected = {_SHARED, *(slide.value for slide in NarratedSlide)}
    if set(sections) != expected:
        raise NarrationDirectionError(
            f"narration_direction.md has sections {sorted(sections)}; it needs exactly "
            f"{sorted(expected)}"
        )
    empty = sorted(name for name, body in sections.items() if not body)
    if empty:
        raise NarrationDirectionError(f"narration_direction.md has empty sections: {empty}")

    rendered: dict[NarratedSlide, str] = {}
    for slide in NarratedSlide:
        prompt = f"{sections[_SHARED]}\n\n{sections[slide.value]}"
        if len(prompt.encode("utf-8")) > MAX_FIELD_BYTES:
            raise NarrationDirectionError(
                f"the {slide.value} direction is {len(prompt.encode('utf-8'))} bytes; Cloud "
                f"TTS refuses a prompt over {MAX_FIELD_BYTES}"
            )
        rendered[slide] = prompt
    return MappingProxyType(rendered)


def direction_for(slide: NarratedSlide) -> str:
    return load_direction()[slide]


# -------------------------------------------------------------- identity and labelling


def clip_digest(
    *, model: str, voice: str, language: str, prompt: str, text: str, attempt: int
) -> str:
    """What one synthesis request is, as a hash — the key its audio is cached under.

    Everything that changes what the model is asked for is in it, so a new voice or a new
    direction is a new clip rather than a stale file served under the old name. `attempt`
    is in it so a deliberate regeneration is a new request too, not the same file again.
    """
    canonical = json.dumps(
        {
            "model": model,
            "voice": voice,
            "language": language,
            "prompt": prompt,
            "text": text,
            "attempt": attempt,
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def short_title(book_title: str) -> str:
    """ "Ikigai: The Japanese Secret to…" -> "Ikigai". The name a person would use."""
    head = book_title.split(":", 1)[0].strip()
    return head or book_title.strip()


def title_slug(book_title: str) -> str:
    """A filename-safe form of the short title: "Ikigai" -> "ikigai"."""
    ascii_only = (
        unicodedata.normalize("NFKD", short_title(book_title))
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")
    return slug or "book"


def voice_slug(voice: str) -> str:
    """ "Sadaltager" -> "sadaltager"."""
    return re.sub(r"[^a-z0-9]+", "-", voice.lower()).strip("-") or "voice"


def clip_filename(*, book_title: str, line: NarrationLine, voice: str, content_hash: str) -> str:
    """`ikigai-leaf-04-payoff-achernar-3fa2c1d09b.mp3`.

    **The suffix is the hash of the uploaded bytes**, so a filename names exactly one file.
    That is what makes "is this clip already in the CMS" a filename lookup, and it keeps a
    regenerated clip from arriving as Payload's `-1` copy of an older one.

    **The voice is in the name** because a Leaf has two narrators (ruled by the founder after
    the audition): two files per slide that differ only in a hash would be two rows nobody can
    tell apart.
    """
    return (
        f"{title_slug(book_title)}-leaf-{line.order:02d}-{line.slide.value}-"
        f"{voice_slug(voice)}-{content_hash[:10]}.mp3"
    )


def clip_alt(*, book_title: str, line: NarrationLine, voice: str) -> str:
    """ "Narration of the Payoff slide, Leaf 4 of Ikigai, read by Achernar".

    `Media.alt` is required for every upload and the founder ruled it stays required
    (projectplan, 2026-09-17). For audio it is a label rather than a text alternative — the
    clip *is* the alternative to the text on screen — and its job is to make the rows in the
    admin list legible. The book is named because the Media collection is shared across every
    Track; the voice, because every slide has two.
    """
    return (
        f"Narration of the {_SLIDE_LABELS[line.slide]} slide, Leaf {line.order} of "
        f"{short_title(book_title)}, read by {voice}"
    )


__all__ = [
    "MAX_FIELD_BYTES",
    "NARRATED_FIELDS",
    "NARRATED_GROUPS",
    "NarratedSlide",
    "NarrationDirectionError",
    "NarrationLine",
    "NarrationSourceError",
    "clip_alt",
    "clip_digest",
    "clip_filename",
    "direction_for",
    "load_direction",
    "narration_script",
    "short_title",
    "speakable",
    "title_slug",
    "voice_slug",
]
