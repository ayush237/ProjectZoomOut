"""Which backend the client talks to is configuration, and configuration that is wrong
should fail at construction rather than on the first billed call."""

from __future__ import annotations

import pytest

from zoomout_pipeline.config import PipelineSettings
from zoomout_pipeline.llm.client import GeminiClient, LLMError
from zoomout_pipeline.llm.ratelimit import DEFAULT_EMBED_REQUESTS_PER_MINUTE

_DB = "postgresql://postgres:postgres@127.0.0.1:5433/zoomout_pipeline"


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


def test_settings_refuse_neither_backend_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    """Silence is not a default. One of the two has to be chosen explicitly.

    The ambient environment is cleared first: settings read `ZOOMOUT_PIPELINE_*` from the
    environment by design, so on a machine that has a key exported this test would otherwise
    pass for the wrong reason.
    """
    monkeypatch.delenv("ZOOMOUT_PIPELINE_GEMINI_API_KEY", raising=False)

    with pytest.raises(ValueError, match="GEMINI_API_KEY"):
        PipelineSettings(database_url=_DB)


def test_the_embed_pace_is_configurable_because_vertex_quotas_differ(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pacing a Vertex run at AI Studio free-tier speed would waste minutes per book."""
    monkeypatch.delenv("ZOOMOUT_PIPELINE_EMBED_REQUESTS_PER_MINUTE", raising=False)
    settings = PipelineSettings(
        database_url=_DB, use_vertex=True, vertex_project="p", embed_requests_per_minute=600
    )

    assert settings.embed_requests_per_minute == 600
    assert (
        PipelineSettings(database_url=_DB, gemini_api_key="k").embed_requests_per_minute
        == DEFAULT_EMBED_REQUESTS_PER_MINUTE
    )
