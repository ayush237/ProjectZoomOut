"""Hearing what a clip actually says, before a person has to.

**The audio sibling of `style_guard`, and honest about what it is.** It is a model listening,
not a person, and it answers two different kinds of question with very different reliability:

- **Did the clip say the approved words?** A *blind* transcript, compared word by word
  here. Trust it: a transcript is checkable.
- **Was a tag, a direction or a "dash" spoken aloud?** The model's own list. Trust it: that
  is a listening task.
- **Was a word mispronounced; how did the clip end?** The model's own list. A pointer to
  where a person should listen, no more.
- **Does it sound like a person?** One sentence of the model's opinion. **Not a verdict** —
  a person listening is.

**Blind on purpose.** The model is never shown the expected text. A transcriber told what a
clip should say hears it saying that, which would turn the one mechanical check here into an
agreement with itself.

**Why it exists at all.** Zero fabrication does not stop at the page: a clip that drops a
clause or turns "60 percent" into "16 percent" puts words in an author's mouth as surely as a
bad Leaf does, and nothing else in this pipeline can hear. It is also how a Gemini-TTS failure
the vendor documents — a bracketed tag or a style instruction read aloud — is caught in clip
41 rather than in the founder's ears.
"""

from __future__ import annotations

import difflib
import hashlib
import re
from dataclasses import dataclass
from enum import StrEnum

from pydantic import BaseModel, Field

from zoomout_pipeline.cost import TokenSpend, rates_for
from zoomout_pipeline.llm.client import StructuredClient
from zoomout_pipeline.prompts import load_prompt

GUARD_NODE = "narration_guard"

# A run of this many wrong words in a row is a dropped or invented phrase, not a transcriber
# disagreeing about how to spell a Japanese word.
MAJOR_RUN_WORDS = 3
# Past this share of wrong words the clip is not the text, whatever the runs look like.
MAJOR_ERROR_RATE = 0.10

# Words per minute **of speech** — pauses excluded — for the text a clip is meant to say.
#
# **This is the check that does not depend on the listening model.** VO-2's first audition put
# the style direction into twelve clips before the text, and the transcriber left it out of
# its transcript nine times in thirteen. The articulation rate gave every one away: 30-42 words
# a minute of speech, where the same lines read undirected at 173-182 and directed, with the
# fixed direction, at 130-161. Something that is not the text fills speech time, so the rate
# falls; a slow, deliberate read fills *pause* time, which this measure leaves out — which is
# why it is speech time and not clip length. A first version used clip length, and failed a
# slow takeaway that was word for word.
MIN_NATURAL_WPM = 100.0
MAX_NATURAL_WPM = 330.0

# Budget arithmetic for one check. Audio is counted at the higher of the published per-second
# token rates for Gemini models, and output at a generous ceiling, because a thinking model
# bills its reasoning as output and the length of that is not ours to set.
AUDIO_INPUT_TOKENS_PER_SECOND = 32
PROMPT_TOKENS_CEILING = 1_000
OUTPUT_TOKENS_CEILING = 8_192
# The dearest text-model rate this pipeline uses, for a guard model with no rate on file.
_FALLBACK_RATES = (2.00, 12.00)


class NarrationEnding(StrEnum):
    CLEAN = "clean"
    CLIPPED = "clipped"
    BREATH = "breath"
    OTHER = "other"


class NarrationReading(BaseModel):
    """What the listening model heard. The typed output of the guard call."""

    transcript: str = Field(min_length=1)
    spoken_non_text: list[str] = Field(default_factory=list)
    unclear_words: list[str] = Field(default_factory=list)
    ending: NarrationEnding
    delivery: str = ""


class GuardSeverity(StrEnum):
    EXACT = "exact"
    MINOR = "minor"
    MAJOR = "major"


# ------------------------------------------------------------------------- the words

_ONES = (
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
    "nineteen",
)  # fmt: skip
_TENS = ("", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety")
_SCALES = ((1_000_000_000, "billion"), (1_000_000, "million"), (1_000, "thousand"))


def number_words(value: int) -> list[str]:
    """`20000` -> ["twenty", "thousand"]. Enough to compare "80 percent" with "eighty percent"."""
    if value < 20:
        return [_ONES[value]]
    if value < 100:
        tens, rest = divmod(value, 10)
        return [_TENS[tens], *([_ONES[rest]] if rest else [])]
    if value < 1_000:
        hundreds, rest = divmod(value, 100)
        return [_ONES[hundreds], "hundred", *(number_words(rest) if rest else [])]
    for size, name in _SCALES:
        if value >= size:
            head, rest = divmod(value, size)
            return [*number_words(head), name, *(number_words(rest) if rest else [])]
    raise AssertionError("unreachable")  # pragma: no cover


_MONEY = re.compile(r"\$\s?(\d[\d,]*(?:\.\d+)?)")
_THOUSANDS = re.compile(r"(?<=\d),(?=\d{3}\b)")
_SEPARATORS = re.compile(r"[—–\-/]")
_TOKENS = re.compile(r"[a-z]+|\d+(?:\.\d+)?")


def spoken_words(text: str) -> list[str]:
    """Words as they would be said: lower case, numbers spelled out, punctuation gone.

    Applied to both sides of the comparison, so "$20,000" and "twenty thousand dollars" and
    "70-year-old" and "seventy year old" meet in the middle rather than counting as errors.
    """
    lowered = text.lower().replace("’", "'").replace("‘", "'")
    lowered = _MONEY.sub(r"\1 dollars", lowered)
    lowered = lowered.replace("%", " percent")
    lowered = _THOUSANDS.sub("", lowered)
    lowered = _SEPARATORS.sub(" ", lowered).replace("'", "")

    words: list[str] = []
    for token in _TOKENS.findall(lowered):
        if token.isdigit():
            words.extend(number_words(int(token)))
        elif token[0].isdigit():
            whole, fraction = token.split(".", 1)
            words.extend([*number_words(int(whole)), "point", *(_ONES[int(d)] for d in fraction)])
        else:
            words.append(token)
    return words


def speaking_rate(text: str, spoken_seconds: float) -> float:
    """Words of `text` per minute of `spoken_seconds`."""
    return 60.0 * len(spoken_words(text)) / spoken_seconds if spoken_seconds > 0 else 0.0


def pace_is_natural(words_per_minute: float) -> bool:
    return MIN_NATURAL_WPM <= words_per_minute <= MAX_NATURAL_WPM


@dataclass(frozen=True)
class WordDiff:
    """How a transcript differs from the text it should be.

    `added` is kept apart from `extra` on purpose. A word heard *in place of* another may be a
    transcriber spelling "moai" as "mo eye"; a word heard *where the text has none* is the voice
    saying something the Leaf does not. The first audition's summaries opened "You know, in
    Okinawa…" in four clips of six — words nobody wrote, attributed to a book.
    """

    expected_count: int
    missing: tuple[str, ...]
    extra: tuple[str, ...]
    errors: int
    longest_run: int
    added: tuple[str, ...] = ()
    longest_gap: int = 0

    @property
    def rate(self) -> float:
        return self.errors / max(1, self.expected_count)

    def summary(self) -> str:
        if not self.errors:
            return "word for word"
        parts = [f"{self.errors} word(s) differ"]
        if self.added:
            parts.append(f"added, not in the text: {' '.join(self.added)[:80]}")
        if self.missing:
            parts.append(f"not heard: {' '.join(self.missing)[:80]}")
        replaced = [word for word in self.extra if word not in self.added]
        if replaced:
            parts.append(f"heard instead: {' '.join(replaced)[:80]}")
        return "; ".join(parts)


def compare_words(expected: str, heard: str) -> WordDiff:
    want, got = spoken_words(expected), spoken_words(heard)
    matcher = difflib.SequenceMatcher(None, want, got, autojunk=False)
    missing: list[str] = []
    extra: list[str] = []
    added: list[str] = []
    errors = 0
    longest = 0
    longest_gap = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        span = max(i2 - i1, j2 - j1)
        errors += span
        longest = max(longest, span)
        missing.extend(want[i1:i2])
        extra.extend(got[j1:j2])
        if tag == "insert":
            added.extend(got[j1:j2])
        if tag == "delete":
            longest_gap = max(longest_gap, i2 - i1)
    return WordDiff(
        expected_count=len(want),
        missing=tuple(missing),
        extra=tuple(extra),
        errors=errors,
        longest_run=longest,
        added=tuple(added),
        longest_gap=longest_gap,
    )


# ------------------------------------------------------------------------- the verdict


@dataclass(frozen=True)
class NarrationCheck:
    reading: NarrationReading
    diff: WordDiff
    spend: TokenSpend

    @property
    def severity(self) -> GuardSeverity:
        """MAJOR is worth another attempt; MINOR is worth a person listening; EXACT is neither.

        A spoken tag or instruction is major on its own — it is the documented failure, and
        a listener cannot miss it. So is **any word added where the text has none**, and any
        run of two or more words skipped: the voice saying something the Leaf does not, or not
        saying what it does. A phrase-length run of wrong words, or a tenth of the clip, means
        the clip is not the approved text. A single word heard *differently* stays minor —
        that is where a transcriber and a Japanese word disagree.
        """
        reading, diff = self.reading, self.diff
        if reading.spoken_non_text or diff.added or diff.longest_gap >= 2:
            return GuardSeverity.MAJOR
        if diff.longest_run >= MAJOR_RUN_WORDS or diff.rate >= MAJOR_ERROR_RATE:
            return GuardSeverity.MAJOR
        if diff.errors or reading.unclear_words or reading.ending is not NarrationEnding.CLEAN:
            return GuardSeverity.MINOR
        return GuardSeverity.EXACT

    @property
    def passed(self) -> bool:
        return self.severity is not GuardSeverity.MAJOR

    def findings(self) -> list[str]:
        """What a person should listen for, in plain words. Empty when the clip is exact."""
        found: list[str] = []
        reading = self.reading
        if reading.spoken_non_text:
            found.append(f"spoken aloud: {', '.join(reading.spoken_non_text)}")
        if self.diff.errors:
            found.append(self.diff.summary())
        if reading.unclear_words:
            found.append(f"unclear: {', '.join(reading.unclear_words)}")
        if reading.ending is not NarrationEnding.CLEAN:
            found.append(f"ending: {reading.ending.value}")
        return found


def guard_worst_case_usd(*, model: str, audio_seconds: float) -> float:
    input_rate, output_rate = rates_for(model) or _FALLBACK_RATES
    input_tokens = audio_seconds * AUDIO_INPUT_TOKENS_PER_SECOND + PROMPT_TOKENS_CEILING
    return (input_tokens * input_rate + OUTPUT_TOKENS_CEILING * output_rate) / 1_000_000


def guard_prompt_digest() -> str:
    """Which version of the guard's instructions a reading answered."""
    return hashlib.sha256(load_prompt("narration_guard").encode("utf-8")).hexdigest()


def check_narration(
    *, llm: StructuredClient, mp3: bytes, expected: str, model: str
) -> NarrationCheck:
    """Listen to one clip — the uploaded bytes — and compare what was said with `expected`."""
    result = llm.generate_structured(
        prompt=load_prompt("narration_guard"),
        schema=NarrationReading,
        model=model,
        node=GUARD_NODE,
        audio=[mp3],
    )
    return NarrationCheck(
        reading=result.value,
        diff=compare_words(expected, result.value.transcript),
        spend=result.spend,
    )


__all__ = [
    "GUARD_NODE",
    "GuardSeverity",
    "NarrationCheck",
    "NarrationEnding",
    "NarrationReading",
    "WordDiff",
    "check_narration",
    "compare_words",
    "guard_prompt_digest",
    "guard_worst_case_usd",
    "number_words",
    "pace_is_natural",
    "speaking_rate",
    "spoken_words",
]
