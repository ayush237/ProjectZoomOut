"""A narrator introducing themselves: what is said, how it is directed, and what the clip is called.

## A second door, on purpose

`assets/narration.py` holds voiceover to four Leaf fields, and makes `NarrationLine` buildable in
exactly one place, so the book's own words cannot reach the voice (`LEGAL.md`, "Narration"). A
greeting is the opposite case: **one sentence of ZoomOut's own, fixed in this file, that no book
supplied and no Leaf contains.**

It cannot go through `NarrationLine`. That type exists to prove a line came from a Leaf, and
widening it to admit a greeting would weaken the tests that guard it. So the greeting has a door
of its own, built the same way:

- `NARRATOR_GREETINGS` is the whole list of what may be said here, one sentence per narrator.
  `tests/test_greetings.py` asserts it exactly, so changing a word is a deliberate act with a
  failing test attached.
- `NarratorGreeting` is built in one place, `greeting_for`, and a test asserts it.
- `SpeechClient.synthesize_greeting` accepts a `NarratorGreeting` and nothing else, and takes
  its voice **from the greeting**, so a narrator cannot introduce themselves in the other
  narrator's voice.

Nothing here reads a Leaf, a Track or a book, and nothing the voice says is derived from one.

## The name a narrator gives is not the name of the voice

`NARRATOR_VOICES` maps a narrator to a **Cloud TTS voice id**: Achernar and Sadaltager, the
provider's own names for two voices, chosen after the audition. **A reader never hears those.**
`NARRATOR_NAMES` maps a narrator to **the name they introduce themselves by**: Lara and Druv,
ruled by the founder on 2026-09-24 after hearing the first greetings, which had said the voice
ids. The two are kept apart on purpose. The greeting says the name; the voice is what says it;
and a test asserts that no greeting ever says a voice id.

## Direction

`prompts/narrator_greeting.md`, one prompt for both narrators. Its first paragraph is the shared
narrator block every Leaf clip is directed with, so the greeting sounds like the narrator who
then reads the lesson.
"""

from __future__ import annotations

import difflib
import re
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from types import MappingProxyType

from zoomout_pipeline.assets.narration import MAX_FIELD_BYTES, NARRATOR_VOICES, speakable
from zoomout_pipeline.assets.narration_guard import WordDiff, compare_words, spoken_words
from zoomout_pipeline.models import NarratorId
from zoomout_pipeline.prompts import load_prompt

# The founder's ruling, 2026-09-24, on hearing the first greetings: the narrators are called Lara
# and Druv. Not the provider's voice ids (`NARRATOR_VOICES`), which are what the first greetings
# said. Spelled as ruled: "Druv", not "Dhruv".
NARRATOR_NAMES: Mapping[NarratorId, str] = MappingProxyType(
    {
        NarratorId.FEMALE: "Lara",
        NarratorId.MALE: "Druv",
    }
)

# Ruled 2026-09-24 (ONBOARD-2): each narrator introduces themselves, so the onboarding beat no
# longer needs a book to have been picked. **Each says its own narrator's name**, and a test
# asserts that against `NARRATOR_NAMES`: "I'm Lara", in Druv's voice, is the one error a reader
# could not miss and nothing else here would catch. None says a voice id.
NARRATOR_GREETINGS: Mapping[NarratorId, str] = MappingProxyType(
    {
        NarratorId.FEMALE: (
            "Hi, I'm Lara. I'll be reading to you here, whenever you'd like the company."
        ),
        NarratorId.MALE: (
            "Hey, I'm Druv. I'll be reading to you here, whenever you'd like the company."
        ),
    }
)

_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)


class GreetingDirectionError(RuntimeError):
    """The direction file is empty, or larger than Cloud TTS will accept."""


@dataclass(frozen=True)
class NarratorGreeting:
    """One narrator's self-introduction.

    **Built by `greeting_for` and nowhere else.** `text` is the sentence as written above, and
    `spoken` is the same words as they are sent to the voice.
    """

    narrator: NarratorId
    text: str

    @property
    def name(self) -> str:
        """What the narrator calls themselves: Lara, Druv."""
        return NARRATOR_NAMES[self.narrator]

    @property
    def voice(self) -> str:
        """The Cloud TTS voice that says it: Achernar, Sadaltager. Never spoken."""
        return NARRATOR_VOICES[self.narrator]

    @property
    def spoken(self) -> str:
        return speakable(self.text)

    @property
    def label(self) -> str:
        return f"{self.narrator.value} greeting"


def greeting_for(narrator: NarratorId) -> NarratorGreeting:
    """The greeting for one narrator. The only place a `NarratorGreeting` is made."""
    return NarratorGreeting(narrator=narrator, text=NARRATOR_GREETINGS[narrator])


def greeting_script() -> list[NarratorGreeting]:
    """Both greetings, in `NarratorId`'s order."""
    return [greeting_for(narrator) for narrator in NarratorId]


@lru_cache(maxsize=1)
def greeting_direction() -> str:
    """The style prompt sent with both greetings, comments stripped.

    Checked because of what a mistake here would sound like: a comment left in would be spoken
    aloud, and Cloud TTS refuses a prompt over `MAX_FIELD_BYTES` only at call time, after the
    request has been built and the budget reserved.
    """
    prompt = _COMMENT.sub("", load_prompt("narrator_greeting")).strip()
    if not prompt:
        raise GreetingDirectionError("narrator_greeting.md has no text outside its comment")
    size = len(prompt.encode("utf-8"))
    if size > MAX_FIELD_BYTES:
        raise GreetingDirectionError(
            f"the greeting direction is {size} bytes; Cloud TTS refuses a prompt over "
            f"{MAX_FIELD_BYTES}"
        )
    return prompt


# ------------------------------------------------------------------------- the name

# The most words a transcriber may spend on the name and still be taken to have heard one.
NAME_SLOT_MAX_WORDS = 3


def compare_greeting(greeting: NarratorGreeting, heard: str) -> tuple[WordDiff, str | None]:
    """`compare_words`, with the narrator's own name **set aside and reported, not ignored.**

    The one word a transcriber cannot be held to. It is asked what it heard, and a proper name
    comes back however it happens to be spelled. The greetings' first names, Sadaltager, came
    back as "Sedat Auger", "Sebal tager", "Saul DeTagger" and "Saul Talgor" (2026-09-24): two
    words for one, on a name in no dictionary. Lara and Druv are far easier, and "Laura" and
    "Dhruv" are equally good transcriptions of them. Compared like the rest, either fails a
    clip on a spelling choice, which is a false alarm and not a finding. **Whether the name is
    pronounced right is the one thing here only a person can decide**, and the caller reports
    what was heard in its place so the person knows to listen for it.

    Set aside only when something was heard *in the name's own slot*: one to
    `NAME_SLOT_MAX_WORDS` words, between the same words on either side. Everything else in the
    sentence is compared exactly as `compare_words` compares it, and the name is **not** set
    aside when it was dropped, run into its neighbours, or stretched over a longer run — the
    second element is `None` then, and the caller treats a greeting that never said the name
    as failed. When the name was transcribed as itself nothing is set aside and it is returned
    as heard.
    """
    want = spoken_words(greeting.text)
    got = spoken_words(heard)
    name = spoken_words(greeting.name)
    slot = next(
        (i for i in range(len(want) - len(name) + 1) if want[i : i + len(name)] == name), None
    )
    if slot is None:
        raise ValueError(f"{greeting.name!r} is not in {greeting.text!r}")
    end = slot + len(name)

    matcher = difflib.SequenceMatcher(None, want, got, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal" and i1 <= slot and end <= i2:
            return compare_words(greeting.text, heard), " ".join(name)
        if tag == "replace" and (i1, i2) == (slot, end) and 1 <= j2 - j1 <= NAME_SLOT_MAX_WORDS:
            rest_expected = " ".join(want[:slot] + want[end:])
            rest_heard = " ".join(got[:j1] + got[j2:])
            return compare_words(rest_expected, rest_heard), " ".join(got[j1:j2])
    return compare_words(greeting.text, heard), None


# ------------------------------------------------------------------ identity and labelling


def greeting_filename(narrator: NarratorId) -> str:
    """`narrator-greeting-female.mp3`.

    **Stable, and deliberately not hash-suffixed the way a Leaf's clip is.** A Leaf's clips are
    found again by the hash in their names; these two are *referenced* by name and by Media id
    from the app (ONBOARD-3), so the name is part of the contract. `tests/test_greetings.py`
    pins both, because renaming one breaks a package that already shipped.
    """
    return f"narrator-greeting-{narrator.value}.mp3"


def greeting_alt(greeting: NarratorGreeting) -> str:
    """ "Narrator self-introduction by Lara (the female narrator, voice Achernar): Hi, I'm Lara…".

    `Media.alt` is required and the founder ruled it stays required (VO-1). For audio it is a
    label rather than a text alternative, and its job is to make the row legible in the admin
    list. It carries the words spoken, so the row says what the clip says, and the voice, which
    is the one thing in the row a reader never hears named.
    """
    return (
        f"Narrator self-introduction by {greeting.name} "
        f"(the {greeting.narrator.value} narrator, voice {greeting.voice}): {greeting.text}"
    )


__all__ = [
    "NAME_SLOT_MAX_WORDS",
    "NARRATOR_GREETINGS",
    "NARRATOR_NAMES",
    "GreetingDirectionError",
    "NarratorGreeting",
    "compare_greeting",
    "greeting_alt",
    "greeting_direction",
    "greeting_filename",
    "greeting_for",
    "greeting_script",
]
