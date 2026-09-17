"""The typed shapes the pipeline moves around.

Everything crossing a node boundary or a model boundary is a Pydantic model. An
unparseable model response is an error, not a shrug — that is what makes an LLM node
testable on its contract instead of its prose.
"""

from __future__ import annotations

import re
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator, model_validator

# PRODUCT.md: a Track has 15–30 Leaves.
MIN_LEAVES = 15
MAX_LEAVES = 30


class Acquisition(StrEnum):
    """How the source file was obtained.

    R6: recording this honestly costs nothing now and is retroactively impossible to
    reconstruct. When the written acquisition policy lands at launch, the Tracks needing
    regeneration become a query rather than an act of memory.

    `UNDOCUMENTED` is a legitimate value — it is the honest answer for an MVP-phase file
    whose provenance nobody wrote down. What is *not* allowed is omitting the field.
    """

    PUBLIC_DOMAIN = "public-domain"
    LICENSED = "licensed"
    PURCHASED = "purchased"
    UNDOCUMENTED = "undocumented"


class Transport(StrEnum):
    """Which door a run's model calls go through.

    Recorded on the run rather than inferred later, for the reason `acquisition` itself
    exists (R6): which books went through which door has to be a query, not somebody's
    recollection of which environment variables were exported that afternoon.
    """

    VERTEX = "vertex"
    DEVELOPER_API = "developer-api"
    # VO-2. Cloud Text-to-Speech, which voiceover reaches through its own client and its own
    # endpoint. **A second egress path for Leaf content**, so it is recorded like the first
    # rather than arriving unlisted. It is not the Developer API `require_paid_tier` refuses:
    # Cloud TTS is Customer Data under the GCP DPA's training restriction, billed to the
    # project, and it never sees an API key from this package.
    CLOUD_TTS = "cloud-tts"


class TransportRecord(BaseModel):
    """What a run decided about its transport, and on what grounds.

    Written into the run's own state so `status` can answer "which door did this book go
    through" months later, when the shell that exported the variables is long gone.
    """

    transport: Transport
    project: str | None = Field(
        default=None, description="The GCP project billed, when the transport is Vertex."
    )
    acquisition: Acquisition
    # VO-2. Both optional, so every record written before them still validates.
    #
    # `endpoint` is **read off the constructed client**, not copied from a constant: the
    # claim this record exists to make is "the calls went to Cloud TTS", and the SDK that was
    # imported is not evidence of where it connected.
    model: str | None = Field(default=None, description="The model the calls named.")
    endpoint: str | None = Field(
        default=None, description="The host the client connected to, as the client reports it."
    )


class SourceFormat(StrEnum):
    EPUB = "epub"
    PDF = "pdf"


# What a book's author is called when the file did not say and nobody told us.
#
# **A sentinel, not a value.** It exists so the gap is visible and checkable; it must never
# reach a Track. `LEGAL.md` names fabricated content attributed to a real author as the
# highest-severity risk in the product, and a real book published under "Unknown" is the same
# wound from the other side — it breaks the attribution the fair-use position rests on, and it
# reaches the draft prompts, where the model is asked to write attributive framing about an
# author whose name is the word Unknown.
UNKNOWN_AUTHOR = "Unknown"


class BookProvenance(BaseModel):
    """Where this book came from. Written once at ingest, never mutated."""

    title: str = Field(min_length=1)
    author: str = Field(min_length=1)
    edition: str | None = None
    source: str = Field(min_length=1, description="Where the file came from, e.g. a URL.")
    file_hash: str = Field(min_length=1, description="SHA-256 of the source file.")
    source_format: SourceFormat
    acquisition: Acquisition
    ingested_at: datetime
    raw_text_purged_at: datetime | None = None


class Chapter(BaseModel):
    """One chapter of the source, as the parser found it."""

    index: int = Field(ge=0, description="0-based position in reading order.")
    title: str
    text: str

    @property
    def word_count(self) -> int:
        return len(self.text.split())


class ParsedBook(BaseModel):
    """A parsed source file, before chunking."""

    chapters: list[Chapter]
    detected_title: str | None = None
    detected_author: str | None = None
    parser_warnings: list[str] = Field(default_factory=list)

    @property
    def full_text(self) -> str:
        return "\n\n".join(f"{c.title}\n\n{c.text}" for c in self.chapters)

    @property
    def word_count(self) -> int:
        return sum(c.word_count for c in self.chapters)


class Chunk(BaseModel):
    """One embedded passage.

    `chapter_index`, `chapter_title` and `position_in_chapter` are not optional metadata.
    WP17's grounding has to cite a location, and a chunk that has lost where it came from
    is useless then and unrecoverable now.
    """

    chapter_index: int = Field(ge=0)
    chapter_title: str
    position_in_chapter: int = Field(ge=0, description="0-based ordinal within the chapter.")
    text: str = Field(min_length=1)


class BookAnalysis(BaseModel):
    """Whole-book understanding. Long context, not retrieval — themes are a whole-book
    judgement and RAG fragments them (proposal §3.2)."""

    central_argument: str = Field(min_length=1)
    themes: list[str] = Field(min_length=1)
    key_concepts: list[str] = Field(min_length=1)
    intended_reader: str = Field(min_length=1)
    structure_notes: str = Field(
        min_length=1,
        description="How the book organises itself, and where its own order is weakest "
        "as teaching order. This is what breakdown departs from.",
    )


class PlannedLeaf(BaseModel):
    """One proposed Leaf. Not a Leaf — no slides exist until WP17."""

    order: int = Field(ge=0)
    title: str = Field(min_length=1)
    concept: str = Field(min_length=1, description="The single thing this Leaf teaches.")
    source_chapters: list[int] = Field(
        min_length=1,
        description="0-based chapter indices this Leaf draws on. Required: the 1:1 "
        "structure check is computed from it, so a Leaf that does not declare its "
        "sources cannot be checked.",
    )

    @field_validator("source_chapters")
    @classmethod
    def _dedupe_and_sort(cls, value: list[int]) -> list[int]:
        return sorted(set(value))


class LeafPlan(BaseModel):
    """The ordered list of Leaves for a Track. Breakdown's entire output.

    No branches. Ruled twice — 2026-08-06 and again 2026-08-13. Breakdown may group
    thematically while reasoning; that grouping appears nowhere in this shape.
    """

    leaves: list[PlannedLeaf]

    @field_validator("leaves")
    @classmethod
    def _check_count_and_order(cls, value: list[PlannedLeaf]) -> list[PlannedLeaf]:
        if not MIN_LEAVES <= len(value) <= MAX_LEAVES:
            raise ValueError(
                f"A Track has {MIN_LEAVES}–{MAX_LEAVES} Leaves (PRODUCT.md); got {len(value)}"
            )
        orders = [leaf.order for leaf in value]
        if orders != list(range(len(value))):
            raise ValueError(f"Leaf order must be contiguous from 0; got {orders}")
        return value


# ---------------------------------------------------------------------------- WP17
# Generated Leaf content.
#
# These mirror `packages/shared/src/content.ts`, which is frozen. They are not a second
# definition of the content model — they are what the pipeline must produce so that Payload
# and the backend, which enforce the same shapes independently, accept it. Where the two
# could drift, the TypeScript is right.


class SlideKey(StrEnum):
    """The five slides, matching SLIDE_KEYS in content.ts exactly."""

    SUMMARY = "summary"
    SCENARIO = "scenario"
    PAYOFF = "payoff"
    STICKY_NOTES = "stickyNotes"
    TAKEAWAY = "takeaway"


class NarratorId(StrEnum):
    """The two narrators a reader can choose between, matching NARRATOR_IDS in content.ts
    exactly (VO-1.1). Keys are ZoomOut's, not Google's — see `assets.narration.NARRATOR_VOICES`
    for which provider voice speaks for which of these."""

    FEMALE = "female"
    MALE = "male"


class Citation(BaseModel):
    """A claim's link to the passage that supports it.

    `passage_ref` is the handle the model was shown (`P1`, `P2` …). It can only cite what it
    was given, so a ref that does not resolve is an invention rather than a mistake — which
    is what makes the grounding check mechanical rather than a judgement.
    """

    passage_ref: str = Field(min_length=1)
    note: str = Field(
        min_length=1, description="What in the passage supports the claim, in your own words."
    )
    quote: str | None = Field(
        default=None,
        description="An exact span from the passage, or omitted. Never a paraphrase.",
    )


class Claim(BaseModel):
    """One factual assertion made on a slide, with its support."""

    slide_key: SlideKey
    text: str = Field(min_length=1, description="The assertion, as it appears on the slide.")
    citations: list[Citation] = Field(min_length=1)


class ScenarioOptionDraft(BaseModel):
    text: str = Field(min_length=1)
    is_correct: bool


class GeneratedLeaf(BaseModel):
    """The five slides for one Leaf, before they become a Payload draft.

    Slides are five named fields rather than a list, exactly as `content.ts` has them: the
    structure is fixed for the life of the product, so a missing slide should be a type
    error rather than a runtime surprise.
    """

    summary_body: str = Field(min_length=1)

    scenario_prompt: str = Field(min_length=1)
    scenario_options: list[ScenarioOptionDraft] = Field(min_length=3, max_length=3)

    payoff_body: str = Field(min_length=1)

    sticky_notes: list[str] = Field(min_length=2, max_length=6)

    takeaway_body: str = Field(min_length=1)

    claims: list[Claim] = Field(
        default_factory=list,
        description="Every factual assertion on any slide, with the passages supporting it.",
    )

    @field_validator("scenario_options")
    @classmethod
    def _exactly_one_correct(cls, value: list[ScenarioOptionDraft]) -> list[ScenarioOptionDraft]:
        correct = sum(1 for option in value if option.is_correct)
        if correct != 1:
            raise ValueError(f"A scenario must have exactly one correct option; got {correct}")
        return value


class GeneratedExtras(BaseModel):
    """Dinner Table Knowledge and apply-in-life, generated separately from the slides."""

    dinner_table_knowledge: str | None = Field(default=None, min_length=1)
    apply_in_life: str | None = Field(default=None, min_length=1)
    claims: list[Claim] = Field(default_factory=list)


class GeneratedLeafRecord(BaseModel):
    """A finished, grounded Leaf, ready to be written to the CMS as a draft.

    Holds the generated content and the source references derived from its citations — not
    the passage text those citations point at. The audit trail lives in the database, where
    the purge can reason about it; duplicating it into checkpointed state would put book text
    somewhere retention cannot reach.
    """

    order: int = Field(ge=0)
    title: str = Field(min_length=1)
    leaf: GeneratedLeaf
    extras: GeneratedExtras
    cited_chunk_ids: list[int] = Field(default_factory=list)

    # Which passage handle meant which chunk, as the model saw them.
    #
    # **Not reconstructible from `cited_chunk_ids`, and assuming otherwise corrupts the audit
    # trail.** Handles are positional over the *retrieved* list (P1..P12); the cited ids are a
    # sorted subset. Rebuilding handles from that subset renumbers them, so a Leaf citing P7
    # and P9 came back with P1..P6: two references silently dropped, and the ones that
    # survived pointed at different chapters than the model cited. Payload caught the drop
    # because a Dinner Table fact lost its takeaway reference; nothing would have caught the
    # mis-attribution.
    passage_refs: dict[str, int] = Field(default_factory=dict)

    attempts: int = 1


# ---------------------------------------------------------------------------- WP19
# Editorial review — advisory, never blocking (R3).


class EditorialFindingCategory(StrEnum):
    """What kind of thing the reviewer is flagging.

    Not a severity scale — there is no "this blocks" tier, because nothing here blocks.
    The category is what lets a human skim findings by kind rather than reading every note.
    """

    PEDAGOGY = "pedagogy"
    SCENARIO_PLAUSIBILITY = "scenario_plausibility"
    PROSE = "prose"
    ATTRIBUTION = "attribution"


class EditorialFinding(BaseModel):
    """One advisory note. Feeds `revise`; never rejects a Leaf on its own."""

    slide_key: SlideKey
    category: EditorialFindingCategory
    note: str = Field(min_length=1, description="What the problem is, specifically.")
    suggestion: str = Field(
        min_length=1, description="A concrete fix — not 'improve this', an actual rewrite."
    )


class EditorialReviewResult(BaseModel):
    """The reviewer's whole verdict on one Leaf. There is no pass/fail field on purpose —
    this is advisory input to `revise`, not a gate with a verdict to check."""

    findings: list[EditorialFinding] = Field(default_factory=list)
    overall_note: str = Field(
        min_length=1, description="One or two sentences: does this Leaf read well overall?"
    )


# ---------------------------------------------------------------------------- WP30
# Where a scenario illustration takes place.
#
# **This is a generation artifact, not part of the content model.** Nothing here reaches
# `packages/shared/src/content.ts` or a Payload collection: a Leaf stores the picture, not
# the reasoning that produced it. It is checkpointed into the run and logged at the node
# boundary so the decision is inspectable afterwards, and that is the whole of its life.
#
# It exists because Track 42 came back as eighteen variations of one picture — a seated
# figure at a table in a dim interior, eighteen times out of eighteen, including a scenario
# about buying a family home. The house style was holding the *environment* constant along
# with the palette, which is not what it was for. Leaving the setting unstated left the model
# to default, and its default is whatever the anchors show.


class SceneVantage(StrEnum):
    """Inside or outside. The single cheapest axis of variety, and Track 42 used one value."""

    INTERIOR = "interior"
    EXTERIOR = "exterior"


class SceneLight(StrEnum):
    """Time of day, as light rather than as a clock.

    Named for what the illustrator draws. The palette stays dark at every value — these
    change where the light comes from and how much of it there is, never the surfaces.
    """

    DAWN = "dawn"
    MORNING = "morning"
    MIDDAY = "midday"
    AFTERNOON = "afternoon"
    EVENING = "evening"
    NIGHT = "night"


class SceneShot(StrEnum):
    """Camera distance. Track 42 is eighteen medium shots."""

    CLOSE = "close"
    MEDIUM = "medium"
    WIDE = "wide"


# Bare nouns that name no particular place. A `place` that normalises to one of these is the
# default this whole mechanism exists to refuse, so it is rejected at parse rather than
# flagged later — by then three images have been bought.
GENERIC_PLACES = frozenset(
    {
        "desk",
        "office",
        "home office",
        "workspace",
        "workplace",
        "room",
        "interior",
        "indoors",
        "outdoors",
        "home",
        "house",
        "table",
        "work",
        "somewhere",
    }
)

_ARTICLES = frozenset({"a", "an", "the", "at", "in", "on", "of", "his", "her", "their", "its"})

# Words too common to distinguish one place from another. Two places that differ only in
# these are the same place with a coat of paint.
_PLACE_STOPWORDS = _ARTICLES | frozenset({"small", "large", "old", "new", "quiet", "busy"})


def normalise_place(value: str) -> str:
    """A place reduced to its content words, for comparison.

    Lowercased, stripped of punctuation and of the articles and filler adjectives that let a
    model return the same place eighteen times and call it variety.
    """
    words = re.findall(r"[a-z]+", value.lower())
    kept = [word for word in words if word not in _PLACE_STOPWORDS]
    return " ".join(kept or words)


def place_words(value: str) -> set[str]:
    """The content words of a place, as a set."""
    return set(normalise_place(value).split())


# Body parts are people. A frame with "the palm of an open hand" in it has a person in it,
# whatever the figure count says, and a model handed both resolves the contradiction by
# drawing a disembodied one — which it did, filling the lower third of an otherwise good
# picture of a house with a giant floating hand.
# Words that name a lighting *effect* rather than a thing in the room.
#
# **The sibling of `_BODY_PARTS`, and it was missing.** WP30 learned that a contradiction in
# the plan is cheap to catch in text and expensive to catch in an image, and built the check
# for exactly one contradiction: `figures: 0` with a focus on somebody's hands. This is the
# other one. `asset_style.md` forbids glow, light cones, beams, bloom and volumetric light
# absolutely — "a lamp is a shape, and the room around it is a darker shape" — so a focus
# naming a beam asks the illustrator for a picture the contract says cannot be drawn.
#
# Measured, not assumed: of Ikigai's eighteen derived settings exactly one named a light
# effect — Leaf 8's "an unlit wooden lectern standing under a spotlight beam" — and it
# produced the only prohibition breach in the set, two volumetric cones converging on the
# lectern. One for one.
#
# A lamp, a window or a candle as an *object* is fine and is not listed here; what is listed
# is the light such a thing throws.
_LIGHT_EFFECTS = frozenset(
    {
        "backlight",
        "backlit",
        "beam",
        "beams",
        "bloom",
        "flare",
        "glare",
        "glow",
        "glowing",
        "halo",
        "illuminated",
        "lamplight",
        "moonbeam",
        "ray",
        "rays",
        "shaft",
        "shafts",
        "spotlight",
        "spotlit",
        "sunbeam",
        "sunbeams",
        "underlit",
    }
)

_BODY_PARTS = frozenset(
    {
        "hand",
        "hands",
        "palm",
        "palms",
        "finger",
        "fingers",
        "fist",
        "arm",
        "arms",
        "elbow",
        "shoulder",
        "shoulders",
        "face",
        "faces",
        "eye",
        "eyes",
        "foot",
        "feet",
        "leg",
        "legs",
        "knee",
        "knees",
        "lap",
        "wrist",
        "thumb",
    }
)


class SceneSetting(BaseModel):
    """Where one Leaf's illustration happens, decided before the image model is asked.

    Every field is an axis the house style must *not* hold constant. The style contract owns
    medium, palette and figure treatment; this owns everything else about the frame.
    """

    order: int = Field(ge=0)

    place: str = Field(
        min_length=1,
        description="A specific, concrete location — 'the roasting room behind a small "
        "coffee shop', not 'an office'. Name what is physically there.",
    )
    vantage: SceneVantage
    light: SceneLight
    shot: SceneShot
    figures: int = Field(
        ge=0,
        le=3,
        description="How many people are in frame. 0 is allowed and is sometimes the "
        "strongest choice — an empty place carries a situation too.",
    )
    focus: str = Field(
        min_length=1,
        description="The one object or action the eye lands on. Not a person's face.",
    )

    @model_validator(mode="after")
    def _an_empty_frame_has_no_hands_in_it(self) -> SceneSetting:
        """`figures: 0` and a focus on somebody's hands are not both true.

        Found by looking at the picture. Leaf 13 of the WP30 before/after asked for a wide,
        unpeopled shot of a house and a focus on "a brass key lying in the palm of an open
        hand"; what came back was the house with an enormous disembodied hand across the
        foreground. The model was not wrong — it was given two incompatible instructions and
        satisfied both.

        Caught here rather than left to the image model, because this is a contradiction in
        the *plan* and it is cheap to see in text and expensive to see in an image.
        """
        if self.figures > 0:
            return self
        found = sorted(_BODY_PARTS & place_words(self.focus))
        if found:
            raise ValueError(
                f"focus names {found} but `figures` is 0. A hand in the frame is a person in "
                "the frame — either raise `figures`, or choose a focus with nobody attached "
                "to it (keys on a doorstep rather than keys in a palm)."
            )
        return self

    @model_validator(mode="after")
    def _a_light_effect_is_not_a_thing_in_the_room(self) -> SceneSetting:
        """A focus may name a lamp. It may not name the beam coming out of it.

        The sibling of `_an_empty_frame_has_no_hands_in_it`, found the same way — by looking
        at the picture. Leaf 8 of Ikigai asked for "an unlit wooden lectern standing under a
        spotlight beam" and got two volumetric cones converging on a lectern, which is four
        separate prohibitions in `asset_style.md` at once: no glow, no light cones or beams,
        no bloom, no volumetric light.

        **The model was not wrong.** It was handed a plan that named a beam and a contract
        that forbids beams, and it satisfied the more specific instruction — exactly as the
        `figures: 0` case did when it was given an empty frame and a focus on a hand.

        Caught here because the plan is text, and text is where this costs nothing. In an
        image it costs $0.134 and a human's eye to find, and the eye is the only thing that
        was catching it.
        """
        found = sorted(_LIGHT_EFFECTS & place_words(self.focus))
        if found:
            raise ValueError(
                f"focus names {found}, which is a lighting effect rather than something in "
                "the room. The style contract forbids glow, beams, cones and bloom at every "
                "time of day — a lamp is a shape and the room around it is a darker shape. "
                "Choose a focus that is an object or an action ('an unlit lectern on the "
                "bare stage', not 'a lectern under a spotlight beam'); `light` already says "
                "what time of day it is."
            )
        return self

    @field_validator("place")
    @classmethod
    def _must_name_somewhere_in_particular(cls, value: str) -> str:
        """Reject the default rather than detect it afterwards.

        A bare 'a desk' is the answer the model gives when it has not thought about the
        scenario, and it is the answer that produced eighteen identical pictures.
        """
        normalised = normalise_place(value)
        if normalised in GENERIC_PLACES:
            raise ValueError(
                f"{value!r} names no particular place. Say what is physically there — "
                "'the loading bay behind a print shop', not 'an office'."
            )
        if len(normalised.split()) < 2:
            raise ValueError(
                f"{value!r} is one word. A place needs enough detail to be drawn: "
                "what kind of place, and what is in it."
            )
        return value.strip()


# A Track this size or larger is expected to move the camera and the clock. Below it, a
# handful of Leaves may legitimately share a register, and a rule would be noise.
MIN_LEAVES_FOR_AXIS_VARIETY = 8

# No single content word may appear in more than this share of a Track's places. Without it
# "a cluttered desk", "a tidy desk" and "a standing desk" are three distinct strings and one
# room — which is exactly the shape Track 42's cosmetic variety took.
MAX_SHARED_WORD_FRACTION = 0.5


class ScenePlan(BaseModel):
    """One setting per Leaf, for a whole Track, decided in a single pass.

    **Derived for the Track at once rather than per Leaf, and that is the mechanism.** Track
    42's images were generated one Leaf at a time from a prompt that never mentioned setting,
    so every call defaulted independently to the same place; a prompt asking each call to
    "vary the setting" would have done no better, because no call could see the others. A
    model shown all eighteen scenarios together and required to return eighteen distinct
    places cannot collapse them without failing to parse.
    """

    settings: list[SceneSetting]

    @field_validator("settings")
    @classmethod
    def _places_must_differ(cls, value: list[SceneSetting]) -> list[SceneSetting]:
        if not value:
            raise ValueError("A scene plan needs at least one setting.")

        orders = [setting.order for setting in value]
        if len(set(orders)) != len(orders):
            raise ValueError(f"Two settings claim the same Leaf: {sorted(orders)}")

        normalised = [normalise_place(setting.place) for setting in value]
        duplicates = {place for place in normalised if normalised.count(place) > 1}
        if duplicates:
            raise ValueError(
                f"These places are used more than once: {sorted(duplicates)}. Every Leaf "
                "needs its own place."
            )

        # Cosmetic variety is the failure mode a distinctness rule alone invites: eighteen
        # unique strings that are all a desk. Counted over content words, that shows up.
        counts: dict[str, int] = {}
        for setting in value:
            for word in place_words(setting.place):
                counts[word] = counts.get(word, 0) + 1
        ceiling = max(1, int(len(value) * MAX_SHARED_WORD_FRACTION))
        overused = sorted(word for word, count in counts.items() if count > ceiling)
        if overused:
            raise ValueError(
                f"{overused} appear in more than half the places. Distinct strings that "
                "are all the same room are not variety — change the places, not the adjectives."
            )

        if len(value) >= MIN_LEAVES_FOR_AXIS_VARIETY:
            if len({setting.shot for setting in value}) < 2:
                raise ValueError(
                    "Every Leaf uses the same camera distance. Vary `shot` — a close view "
                    "of hands and a wide view of a room are different pictures."
                )
            if len({setting.light for setting in value}) < 3:
                raise ValueError(
                    "A Track this long should not happen entirely at one time of day. Vary `light`."
                )

        return sorted(value, key=lambda setting: setting.order)

    def by_order(self) -> dict[int, SceneSetting]:
        return {setting.order: setting for setting in self.settings}
