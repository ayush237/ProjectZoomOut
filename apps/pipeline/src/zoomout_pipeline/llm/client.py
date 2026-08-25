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

from dataclasses import dataclass
from typing import Protocol, TypeVar

from pydantic import BaseModel, ValidationError

from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    """A model call failed, or returned something that is not the requested shape."""


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

    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise LLMError(
                "No Gemini API key. Set ZOOMOUT_PIPELINE_GEMINI_API_KEY in the environment."
            )
        from google import genai

        self._client = genai.Client(api_key=api_key)

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

        try:
            response = self._client.models.generate_content(
                model=model, contents=prompt, config=config
            )
        except Exception as error:
            raise LLMError(f"{node}: model call to {model} failed: {error}") from error

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
        if not texts:
            return [], TokenSpend(node=node, model=model)

        try:
            response = self._client.models.embed_content(model=model, contents=texts)
        except Exception as error:
            raise LLMError(f"{node}: embedding call to {model} failed: {error}") from error

        embeddings = list(response.embeddings or [])
        vectors = [list(item.values or []) for item in embeddings]
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
