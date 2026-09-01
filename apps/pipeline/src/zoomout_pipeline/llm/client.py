"""Model access.

Two rules from the persona shape this file.

**Every LLM call has a typed output schema and a validation step.** The model is asked for
JSON matching a Pydantic schema and the response is parsed into it. An unparseable response
raises; it is never passed along as a shrug for a later node to trip over.

**Nodes do not reach the network themselves.** They take a client through a protocol, so the
normal test gate runs against recorded fixtures and the live suite is small, explicit and
outside the gate.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol, TypeVar, cast

from pydantic import BaseModel, ValidationError

from zoomout_pipeline.config import PipelineSettings
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.db.schema import EMBEDDING_DIMENSIONS
from zoomout_pipeline.llm.ratelimit import (
    MAX_RETRIES,
    RateLimiter,
    is_retryable,
    retry_delay_seconds,
)
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    """A model call failed, or returned something that is not the requested shape."""


class LLMTransportError(LLMError):
    """The call never produced an answer — rate limit, timeout, network.

    Distinct from a response that came back in the wrong shape, because the two mean
    different things. A malformed response says something about the prompt; a 429 says
    only that we asked too quickly, and counting it against the prompt would be measuring
    our own quota.
    """


@dataclass(frozen=True)
class GenerationResult[ModelT: BaseModel]:
    """A parsed response and what it cost."""

    value: ModelT
    spend: TokenSpend


class StructuredClient(Protocol):
    """Generates JSON conforming to a Pydantic schema."""

    def generate_structured(
        self,
        *,
        prompt: str,
        schema: type[T],
        model: str,
        node: str,
        system_instruction: str | None = None,
    ) -> GenerationResult[T]: ...


class EmbeddingClient(Protocol):
    """Embeds text for retrieval."""

    def embed(
        self, *, texts: list[str], model: str, node: str
    ) -> tuple[list[list[float]], TokenSpend]: ...


class GeminiClient:
    """Gemini, via the google-genai SDK.

    Free tier for public-domain books only (proposal §4a): Google's free tier uses
    submitted content to improve its products, so a copyrighted work must never go through
    it. `config.paid_tier` records which side of that line a run is on.
    """

    def __init__(
        self,
        api_key: str = "",
        *,
        use_vertex: bool = False,
        project: str = "",
        location: str = "us-central1",
        limiter: RateLimiter | None = None,
        request_timeout_seconds: float = 180.0,
    ) -> None:
        from google import genai
        from google.genai import types

        # Without this the SDK waits forever. A batch pipeline whose runs span days cannot
        # distinguish a hung request from a slow one, so a call that will never answer looks
        # exactly like progress — it did, for 83 minutes, before this was added.
        #
        # **`attempts=1` turns the SDK's own retrying off, and that is the point.** The
        # timeout above bounds one HTTP attempt; it does not bound a call, because the SDK
        # retries 429s internally with its own exponential backoff (max_delay 60s) before
        # this package ever sees an error. Two retry layers then stack — the SDK's, silent
        # and unbounded from here, underneath `_call_with_retry`'s five attempts and the
        # rate limiter's own 60-second `penalise()`.
        #
        # WP20 measured what that costs. Every long gap in the run ended in `llm.retrying`,
        # meaning the whole delay happened inside a single call before our code was told
        # anything: gaps of 43, 17, 12, 10, 9 and 6 minutes, **109 minutes of a two-hour
        # run**, against a configured per-request timeout of three minutes.
        #
        # One retry layer, and it is this package's: it logs, it paces against the limiter,
        # and it charges the local window on rejection. The SDK's does none of those and
        # cannot be observed from the outside.
        http_options = types.HttpOptions(
            timeout=int(request_timeout_seconds * 1000),
            retry_options=types.HttpRetryOptions(attempts=1),
        )

        if use_vertex:
            if not project:
                raise LLMError("Vertex AI needs a project id; set ZOOMOUT_PIPELINE_VERTEX_PROJECT.")
            # Credentials come from Application Default Credentials, so nothing secret is
            # passed here or stored on disk by this package.
            self._client = genai.Client(
                vertexai=True, project=project, location=location, http_options=http_options
            )
        else:
            if not api_key:
                raise LLMError(
                    "No Gemini API key. Set ZOOMOUT_PIPELINE_GEMINI_API_KEY, or use Vertex."
                )
            self._client = genai.Client(api_key=api_key, http_options=http_options)

        self._limiter = limiter or RateLimiter()

    @classmethod
    def from_settings(cls, settings: PipelineSettings) -> GeminiClient:
        """Build the client the configuration asks for — Vertex or the Developer API."""
        return cls(
            settings.gemini_api_key,
            use_vertex=settings.use_vertex,
            project=settings.vertex_project,
            location=settings.vertex_location,
            limiter=RateLimiter(max_per_minute=settings.embed_requests_per_minute),
            request_timeout_seconds=settings.request_timeout_seconds,
        )

    def _call_with_retry[R](
        self, *, node: str, model: str, units: int, what: str, call: Callable[[], R]
    ) -> R:
        """Pace, call, and retry a rate limit — bounded, like every other cycle here.

        Written once and shared by both call sites on purpose. It existed twice before, and
        a refactor deleted one copy without any test noticing, which is exactly the failure
        mode duplicated logic has.

        `units` is what the endpoint counts: one request for generation, one *per text* for
        embeddings.
        """
        for attempt in range(MAX_RETRIES):
            self._limiter.acquire(units)
            try:
                return call()
            except Exception as error:
                if not is_retryable(error):
                    raise LLMError(f"{node}: {what} to {model} failed: {error}") from error
                if attempt == MAX_RETRIES - 1:
                    raise LLMTransportError(
                        f"{node}: {what} to {model} never answered after {MAX_RETRIES} "
                        f"attempts: {error}"
                    ) from error
                delay = retry_delay_seconds(error, attempt=attempt)
                _log.warning(
                    "llm.retrying",
                    node=node,
                    model=model,
                    what=what,
                    attempt=attempt + 1,
                    retry_in=round(delay, 1),
                )
                # The server says the window is full; our own bookkeeping is optimistic.
                self._limiter.penalise()
                self._limiter.sleep(delay)

        raise LLMError(f"{node}: {what} to {model} produced no response")  # pragma: no cover

    def generate_structured(
        self,
        *,
        prompt: str,
        schema: type[T],
        model: str,
        node: str,
        system_instruction: str | None = None,
    ) -> GenerationResult[T]:
        from google.genai import types

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            system_instruction=system_instruction,
        )

        response = self._call_with_retry(
            node=node,
            model=model,
            units=1,
            what="model call",
            call=lambda: self._client.models.generate_content(
                model=model, contents=prompt, config=config
            ),
        )

        spend = _spend_from(response, node=node, model=model)
        _log.info(
            "llm.call",
            node=node,
            model=model,
            input_tokens=spend.input_tokens,
            output_tokens=spend.output_tokens,
            usd=round(spend.usd, 4),
        )

        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, schema):
            return GenerationResult(value=parsed, spend=spend)

        # The SDK parses for us when it can; when it cannot, parse the text ourselves so the
        # error names what came back rather than surfacing as an attribute error later.
        text = getattr(response, "text", None)
        if not text:
            raise LLMError(f"{node}: {model} returned no content")
        try:
            return GenerationResult(value=schema.model_validate_json(text), spend=spend)
        except ValidationError as error:
            raise LLMError(
                f"{node}: {model} returned JSON that is not a valid {schema.__name__}: {error}"
            ) from error

    def embed(
        self, *, texts: list[str], model: str, node: str
    ) -> tuple[list[list[float]], TokenSpend]:
        from google.genai import types

        if not texts:
            return [], TokenSpend(node=node, model=model)

        config = types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=EMBEDDING_DIMENSIONS,
        )

        response = self._call_with_retry(
            node=node,
            model=model,
            units=len(texts),
            what="embedding call",
            # `list` is invariant, so `list[str]` does not satisfy the SDK's declared union
            # even though it accepts exactly this. Cast at the boundary rather than widening
            # our own signature to match a stub.
            call=lambda: self._client.models.embed_content(
                model=model, contents=cast("Any", texts), config=config
            ),
        )

        embeddings = list(response.embeddings or [])
        # Truncating a Matryoshka embedding below its native width leaves it un-normalised,
        # and cosine distance in pgvector assumes unit length. Google documents
        # re-normalising after truncation; skipping it degrades retrieval quietly, which is
        # the worst way for a grounding pipeline to be wrong.
        vectors = [_normalise(list(item.values or [])) for item in embeddings]
        if len(vectors) != len(texts):
            raise LLMError(
                f"{node}: asked {model} for {len(texts)} embeddings and got {len(vectors)}"
            )

        # Embedding responses do not carry usage metadata; tokens are approximated from
        # words so the ledger is not silently blank. text-embedding-004 is free either way.
        approx_tokens = sum(len(text.split()) for text in texts)
        spend = TokenSpend(node=node, model=model, input_tokens=approx_tokens)
        _log.info("llm.embed", node=node, model=model, count=len(vectors), tokens=approx_tokens)
        return vectors, spend


def _normalise(vector: list[float]) -> list[float]:
    """Scale to unit length. A zero vector is returned unchanged rather than dividing by 0."""
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0.0:
        return vector
    return [value / magnitude for value in vector]


def _spend_from(response: object, *, node: str, model: str) -> TokenSpend:
    usage = getattr(response, "usage_metadata", None)
    if usage is None:
        return TokenSpend(node=node, model=model)

    # Thinking models bill their reasoning tokens as output. Counting them keeps the
    # reported per-Track cost honest rather than flattering.
    output = int(getattr(usage, "candidates_token_count", 0) or 0)
    output += int(getattr(usage, "thoughts_token_count", 0) or 0)

    return TokenSpend(
        node=node,
        model=model,
        input_tokens=int(getattr(usage, "prompt_token_count", 0) or 0),
        output_tokens=output,
    )
