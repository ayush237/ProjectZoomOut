"""Which backend the client talks to is configuration, and configuration that is wrong
should fail at construction rather than on the first billed call."""

from __future__ import annotations

import os

import pytest
from pydantic import ValidationError

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


def test_a_validation_error_does_not_render_the_keys_it_was_given() -> None:
    """WP33 hit this by accident: a run missing only `DATABASE_URL` printed a truncated
    Gemini key to the terminal, because pydantic's "field required" error renders the
    whole pre-validation kwargs dict, and it would land in CI output the same way.

    **This asserts the actual rendered message is clean, not that the fields are
    `SecretStr`.** `SecretStr` alone does not close this specific hole — this error's
    `input_value` is the raw dict pydantic-core builds before either field is coerced, so
    a field-type change never touches it. What closes it is `hide_input_in_errors` on the
    model, verified against this exact failure before being adopted rather than assumed
    from the option's name. A test that only checked the field's annotation would pass
    against a config that still leaked.
    """
    gemini_secret = "AQ.Ab8-not-a-real-key-but-shaped-like-one-999"
    payload_secret = "payload-live-lookalike-secret-abc123xyz"

    with pytest.raises(ValidationError) as error:
        # `database_url` omitted deliberately — the exact trigger from WP33's report.
        PipelineSettings(gemini_api_key=gemini_secret, payload_api_key=payload_secret)

    rendered = str(error.value)
    assert gemini_secret not in rendered
    assert payload_secret not in rendered
    # Not just the whole secret — any usable fragment of it, in case the dict repr is ever
    # truncated mid-string rather than omitted outright (which is what it did before this
    # fix: `{'gemini_api_key': 'AQ.Ab...pk_live_supersecret789'}`, head and tail both real).
    assert "AQ.Ab8" not in rendered
    assert "abc123xyz" not in rendered
    # Still tells a human what to fix — the point is the secret, not the usefulness.
    assert "database_url" in rendered
    assert "Field required" in rendered


def test_the_credential_fields_do_not_repr_their_value() -> None:
    """The other half of the same fix, covering the other half of the risk.

    `hide_input_in_errors` (checked above) closes the one leak WP33 actually hit. It says
    nothing about `SecretStr` on the two fields, and a settings object gets printed,
    logged or `repr()`'d in places a validation error never reaches — a future debug
    `typer.echo(settings)`, a structured log line that dumps the model. Checked directly
    and separately, because the mutation of reverting `hide_input_in_errors` alone (see the
    test above) does not touch this path, and a mutation reverting `SecretStr` alone does
    not touch that one — they are independent, and each needs its own assertion or one of
    them can regress silently behind the other passing.
    """
    settings = PipelineSettings(
        database_url=_DB, gemini_api_key="gemini-secret-42", payload_api_key="payload-secret-42"
    )

    assert "gemini-secret-42" not in repr(settings.gemini_api_key)
    assert "payload-secret-42" not in repr(settings.payload_api_key)
    assert "gemini-secret-42" not in repr(settings)
    assert "payload-secret-42" not in repr(settings)
    # The value is still there for the two call sites that need it — `.get_secret_value()`.
    assert settings.gemini_api_key.get_secret_value() == "gemini-secret-42"
    assert settings.payload_api_key.get_secret_value() == "payload-secret-42"


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
