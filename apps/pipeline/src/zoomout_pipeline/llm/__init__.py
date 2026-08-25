"""Model access, behind protocols so nodes can be tested without the network."""

from zoomout_pipeline.llm.client import (
    EmbeddingClient,
    GeminiClient,
    GenerationResult,
    LLMError,
    StructuredClient,
)

__all__ = [
    "EmbeddingClient",
    "GeminiClient",
    "GenerationResult",
    "LLMError",
    "StructuredClient",
]
