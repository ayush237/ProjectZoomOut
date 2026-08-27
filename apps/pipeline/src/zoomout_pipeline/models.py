"""The typed shapes the pipeline moves around.

Everything crossing a node boundary or a model boundary is a Pydantic model. An
unparseable model response is an error, not a shrug — that is what makes an LLM node
testable on its contract instead of its prose.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

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


class SourceFormat(StrEnum):
    EPUB = "epub"
    PDF = "pdf"


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
    attempts: int = 1
