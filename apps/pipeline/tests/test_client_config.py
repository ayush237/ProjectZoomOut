"""Which backend the client talks to is configuration, and configuration that is wrong
should fail at construction rather than on the first billed call."""

from __future__ import annotations

import os

import pytest

from zoomout_pipeline.config import PipelineSettings
from zoomout_pipeline.llm.client import GeminiClient, LLMError
from zoomout_pipeline.llm.ratelimit import DEFAULT_EMBED_REQUESTS_PER_MINUTE

_DB = "postgresql://postgres:postgres@127.0.0.1:5433/zoomout_pipeline"


@pytest.fixture(autouse=True)
def _no_ambient_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """Clear every `ZOOMOUT_PIPELINE_*` variable before each test in this module.

    `PipelineSettings` reads the environment by design, so every test here that asserts a
    *missing* setting is refused can be satisfied by the operator's own shell instead of by
    the code. That is not hypothetical: WP20 exported `USE_VERTEX` and `VERTEX_PROJECT` to
    do a real run and two of these tests went red — not because anything had broken, but
    because the environment now supplied what they were asserting was absent. Red for the
    wrong reason is the visible half; the same leak turns a genuinely broken guard green.

    Blanket rather than a list of `delenv` calls. The list was already here, one variable
    long, and it is what let a second variable through.
    """
    for name in [key for key in os.environ if key.startswith("ZOOMOUT_PIPELINE_")]:
        monkeypatch.delenv(name, raising=False)


def test_vertex_without_a_project_is_refused() -> None:
    """The project id is what a Vertex call is billed to. Guessing one is not an option."""
    with pytest.raises(LLMError, match="project id"):
        GeminiClient(use_vertex=True)


def test_developer_api_without_a_key_is_refused() -> None:
    with pytest.raises(LLMError, match="No Gemini API key"):
        GeminiClient()


def test_settings_refuse_vertex_without_a_project() -> None:
    with pytest.raises(ValueError, match="VERTEX_PROJECT"):
        PipelineSettings(database_url=_DB, use_vertex=True)


def test_settings_refuse_neither_backend_configured() -> None:
    """Silence is not a default. One of the two has to be chosen explicitly."""
    with pytest.raises(ValueError, match="GEMINI_API_KEY"):
        PipelineSettings(database_url=_DB)


def test_the_embed_pace_is_configurable_because_vertex_quotas_differ() -> None:
    """Pacing a Vertex run at AI Studio free-tier speed would waste minutes per book."""
    settings = PipelineSettings(
        database_url=_DB, use_vertex=True, vertex_project="p", embed_requests_per_minute=600
    )

    assert settings.embed_requests_per_minute == 600
    assert (
        PipelineSettings(database_url=_DB, gemini_api_key="k").embed_requests_per_minute
        == DEFAULT_EMBED_REQUESTS_PER_MINUTE
    )
