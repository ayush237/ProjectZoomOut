"""What the nodes need from the outside world, injected rather than reached for.

A node that opens its own database connection, reads the clock or calls a model from inside
its own body cannot be tested or replayed. All four of those arrive through here, which is
what lets the normal test gate run the real node functions against recorded fixtures.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import UTC, datetime

import psycopg

from zoomout_pipeline.config import PipelineSettings
from zoomout_pipeline.llm.client import EmbeddingClient, StructuredClient

ConnectionFactory = Callable[[], AbstractContextManager[psycopg.Connection[dict[str, object]]]]


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class NodeDependencies:
    """Everything the nodes reach outside themselves for."""

    settings: PipelineSettings
    llm: StructuredClient
    embedder: EmbeddingClient
    connect: ConnectionFactory
    now: Callable[[], datetime] = utc_now


__all__ = ["ConnectionFactory", "Iterator", "NodeDependencies", "utc_now"]
