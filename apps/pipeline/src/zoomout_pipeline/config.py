"""Configuration, read from the environment and nowhere else.

Two things here are deliberate rather than stylistic.

**Every variable is prefixed `ZOOMOUT_PIPELINE_`.** This repo already has two Postgres
databases in play — `DATABASE_URL` (the backend's `zoomout`) and `PAYLOAD_DATABASE_URL`
(the CMS's `zoomout_cms`). WP5b lost a day to `apps/backend/.env` pointing at the wrong
one: migrations ran against the CMS and broke it. A name that cannot be mistaken for
either of the other two is the cheapest possible guard against repeating that.

**Which model each node uses is configuration, not a literal at the call site.** Nodes
will move between models as they are tuned, and the proposal's §4a already forces a
split: grounding verification can stay on the free tier, editorial review cannot.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Free tier only for public-domain books (proposal §4a): Google's free tier uses
# submitted content to improve its products, so a copyrighted work must never go
# through it. `require_paid_tier` below turns that from a memory into a check.
# Verified against a live key on 2026-08-26, and it contradicts the proposal's §4a.
#
# §4a says "Gemini's free tier includes Pro-tier models". It no longer does: every Pro model
# reports `limit: 0` for free-tier requests, and the 2.5 line (which §4a costed) is closed
# to new API keys entirely — both 2.5-pro and 2.5-flash 404. What answers on the free tier
# is the 3.x Flash line.
#
# So the free-tier default is Flash. That is enough for analysis and breakdown on a 22,000
# word book, and model choice is configuration precisely so a paid Pro model is an env var
# away when output quality justifies it.
DEFAULT_ANALYZE_MODEL = "gemini-3.6-flash"
DEFAULT_BREAKDOWN_MODEL = "gemini-3.6-flash"
# `text-embedding-004` (named in the proposal's §4a) is retired and returns 404. The
# current family is `gemini-embedding-001`, whose native width is 3072; we ask for 768 via
# Matryoshka truncation to match `schema.EMBEDDING_DIMENSIONS`. 768 is ample at this scale
# — one book is ~140 chunks — and a wider vector would cost storage and index time for
# recall nobody would notice.
DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"

# WP17 nodes. Separate settings rather than one shared "text model" because §4a already
# forces a split — grounding can stay on a cheap model while editorial review (WP19) cannot
# — and nodes move between models as they are tuned.
DEFAULT_DRAFT_MODEL = "gemini-3.6-flash"
DEFAULT_EXTRAS_MODEL = "gemini-3.6-flash"

# WP18. The image model matches the one the anchor set was generated with — conditioning is
# strongest when the reference images and the new one come from the same family. The diagram
# model only emits a small JSON spec, so it stays on Flash.
DEFAULT_IMAGE_MODEL = "gemini-3-pro-image"
DEFAULT_DIAGRAM_MODEL = "gemini-3.6-flash"


class PipelineSettings(BaseSettings):
    """Everything the pipeline needs from its environment."""

    model_config = SettingsConfigDict(
        env_prefix="ZOOMOUT_PIPELINE_",
        extra="ignore",
    )

    database_url: str = Field(
        description="Postgres URL for the pipeline's OWN database. Not the backend's, "
        "not Payload's. Holds pgvector chunks, provenance and LangGraph checkpoints.",
    )
    gemini_api_key: str = Field(
        default="", description="AI Studio Developer API key. Unused when `use_vertex`."
    )

    # Vertex AI, which is what the proposal's §4 specified all along ("Gemini via Vertex
    # AI… one GCP DPA rather than a second provider's"). WP16 was built against the AI
    # Studio Developer API because §4a's free-tier analysis pointed there; the economics
    # since changed — Google excluded the Developer API from the $300 Cloud credit in March
    # 2026, and Vertex does not use submitted prompts to improve its models, which is the
    # constraint that confines development to public-domain books.
    #
    # Same SDK, same model names, different transport and different auth: Vertex uses
    # Application Default Credentials, so there is no key on disk.
    use_vertex: bool = False
    vertex_project: str = Field(default="", description="GCP project id. Required for Vertex.")
    # `global`, not a region. Verified 2026-08-26: the Gemini 3.x models are listed by
    # `models.list()` everywhere but only *served* on the global endpoint — us-central1,
    # us-east5 and europe-west4 all 404 on both gemini-3.6-flash and gemini-3.1-pro-preview.
    # A regional endpoint is a data-residency decision to make deliberately, not a default
    # to inherit, and it currently costs you the 3.x line entirely.
    vertex_location: str = "global"

    # The AI Studio free tier allows 100 embed requests per minute and counts each *text* as
    # a request. Vertex's quotas are far higher, so this is configuration rather than a
    # constant — pacing a Vertex run at free-tier speed would waste minutes per book.
    embed_requests_per_minute: int = 60

    # Per-request ceiling. The SDK's default is no timeout at all, which turns one wedged
    # HTTP call into a run that never finishes and never says why.
    request_timeout_seconds: float = 180.0

    analyze_model: str = DEFAULT_ANALYZE_MODEL
    breakdown_model: str = DEFAULT_BREAKDOWN_MODEL
    embedding_model: str = DEFAULT_EMBEDDING_MODEL
    draft_model: str = DEFAULT_DRAFT_MODEL
    extras_model: str = DEFAULT_EXTRAS_MODEL
    image_model: str = DEFAULT_IMAGE_MODEL
    diagram_model: str = DEFAULT_DIAGRAM_MODEL

    # How many illustrations to offer the human per Leaf. Three is enough to choose between
    # without turning gate 2 into a gallery.
    scenario_candidates: int = 3

    # The cap that halts a run. See assets/budget.py — it stops rather than warns.
    max_images_per_track: int = 70

    anchors_dir: Path = Path("assets/anchors")

    # Set true once a book that is not public domain goes through. §4a: paid tier only,
    # because the free tier trains on submitted content.
    paid_tier: bool = False

    runs_dir: Path = Path("runs")

    # --- Payload, the CMS. The REST API is the only door (never its tables).
    # `localhost`, deliberately not `127.0.0.1`. Next's dev server rejects requests to
    # `/_next/*` carrying an `Origin` it does not allow, and its allowlist covers `localhost`
    # but not the IP form — so the admin UI served from `127.0.0.1` 403s its own JavaScript
    # and renders blank with nothing on screen to say why. The REST API is unaffected, but
    # defaulting to the form that works everywhere avoids handing anyone that puzzle.
    payload_url: str = "http://localhost:3001"
    payload_email: str = ""
    payload_password: str = ""

    @field_validator("database_url")
    @classmethod
    def _reject_known_foreign_databases(cls, value: str) -> str:
        """Fail loudly if pointed at the backend's or Payload's database.

        A string check is not a guarantee — `db.engine.assert_pipeline_database` does the
        real verification against the live connection. This catches the common typo at
        the point where the message can still name the mistake.
        """
        for foreign in ("/zoomout_cms", "/zoomout?", "/zoomout"):
            if value.rstrip("/").endswith(foreign.rstrip("?")):
                raise ValueError(
                    f"ZOOMOUT_PIPELINE_DATABASE_URL points at {foreign!r}, which belongs "
                    "to the backend or the CMS. The pipeline needs its own database."
                )
        return value

    @model_validator(mode="after")
    def _require_vertex_project(self) -> PipelineSettings:
        if self.use_vertex and not self.vertex_project:
            raise ValueError(
                "ZOOMOUT_PIPELINE_USE_VERTEX is set but ZOOMOUT_PIPELINE_VERTEX_PROJECT is "
                "empty. Vertex needs a project id — it is what the call is billed to."
            )
        if not self.use_vertex and not self.gemini_api_key:
            raise ValueError(
                "Set ZOOMOUT_PIPELINE_GEMINI_API_KEY, or set ZOOMOUT_PIPELINE_USE_VERTEX=true "
                "with ZOOMOUT_PIPELINE_VERTEX_PROJECT to use Vertex AI and ADC instead."
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> PipelineSettings:
    """Process-wide settings. Cached so the environment is read once."""
    return PipelineSettings()  # type: ignore[call-arg]  # values come from env
