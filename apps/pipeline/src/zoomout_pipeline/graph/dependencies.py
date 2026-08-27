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

from zoomout_pipeline.cms.client import PayloadClient
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

    # The CMS client, injected rather than constructed inside the node.
    #
    # Left None in production and built lazily on first use, so graph construction needs no
    # credentials. **Tests must always supply one.** They previously did not, and the moment
    # the CMS node joined the graph a unit test ran to completion and wrote a 22-Leaf Track
    # into the real CMS — a test reaching a live system because nothing stopped it.
    payload_client: PayloadClient | None = None


__all__ = ["ConnectionFactory", "Iterator", "NodeDependencies", "utc_now"]
