"""Assembling a run: settings, clients, connections, graph."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from zoomout_pipeline.config import PipelineSettings, get_settings
from zoomout_pipeline.db.engine import connect
from zoomout_pipeline.graph.build import durable_graph
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.llm.client import GeminiClient
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)


def build_dependencies(settings: PipelineSettings | None = None) -> NodeDependencies:
    """Real dependencies: Gemini (Vertex or Developer API), and the pipeline's own database."""
    resolved = settings or get_settings()
    client = GeminiClient.from_settings(resolved)
    return NodeDependencies(
        settings=resolved,
        llm=client,
        embedder=client,
        connect=lambda: connect(verify=True),
    )


@contextmanager
def run_context(
    settings: PipelineSettings | None = None,
) -> Iterator[tuple[object, NodeDependencies]]:
    """A compiled, checkpointed graph and the dependencies behind it."""
    deps = build_dependencies(settings)
    with durable_graph(deps) as graph:
        yield graph, deps
