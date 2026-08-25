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

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Free tier only for public-domain books (proposal §4a): Google's free tier uses
# submitted content to improve its products, so a copyrighted work must never go
# through it. `require_paid_tier` below turns that from a memory into a check.
DEFAULT_ANALYZE_MODEL = "gemini-2.5-pro"
DEFAULT_BREAKDOWN_MODEL = "gemini-2.5-pro"
DEFAULT_EMBEDDING_MODEL = "text-embedding-004"


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
    gemini_api_key: str = Field(default="", description="Gemini API key.")

    analyze_model: str = DEFAULT_ANALYZE_MODEL
    breakdown_model: str = DEFAULT_BREAKDOWN_MODEL
    embedding_model: str = DEFAULT_EMBEDDING_MODEL

    # Set true once a book that is not public domain goes through. §4a: paid tier only,
    # because the free tier trains on submitted content.
    paid_tier: bool = False

    runs_dir: Path = Path("runs")

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


@lru_cache(maxsize=1)
def get_settings() -> PipelineSettings:
    """Process-wide settings. Cached so the environment is read once."""
    return PipelineSettings()  # type: ignore[call-arg]  # values come from env
