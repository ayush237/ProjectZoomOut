"""A child process that drives one phase of a real, checkpointed run.

Lives in its own module because the point of the durability test is that the second phase
happens in a **different process** — same Postgres, no shared memory, nothing inherited but
the checkpoint. Importing the graph fresh here is the whole experiment.

Usage: `python _durability_child.py <phase> <database-url> <run-id> <epub> <runs-dir>`
"""

from __future__ import annotations

import sys
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

import psycopg
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.types import Command
from psycopg.rows import dict_row

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tests.conftest import (
    FakeEmbedder,
    RefusingPayloadClient,
    ScriptedLLM,
    leaf_generation_defaults,
    make_plan,
)
from zoomout_pipeline.cms.client import PayloadClient
from zoomout_pipeline.config import PipelineSettings
from zoomout_pipeline.graph.build import compile_graph, pipeline_serializer
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.state import PipelineState
from zoomout_pipeline.models import Acquisition, BookAnalysis

ANALYSIS = BookAnalysis(
    central_argument="A test argument.",
    themes=["one", "two"],
    key_concepts=["a", "b"],
    intended_reader="A test reader.",
    structure_notes="Test structure notes.",
)


def _dependencies(database_url: str, runs_dir: str) -> NodeDependencies:
    settings = PipelineSettings(
        database_url=database_url, gemini_api_key="unused", runs_dir=Path(runs_dir)
    )

    @contextmanager
    def connect() -> Iterator[psycopg.Connection[dict[str, object]]]:
        with psycopg.connect(database_url, row_factory=dict_row) as conn:
            yield conn

    return NodeDependencies(
        settings=settings,
        llm=ScriptedLLM(
            [ANALYSIS, make_plan(leaves=22, chapters_per_leaf=3, chapter_count=17)],
            defaults=leaf_generation_defaults(),
        ),
        embedder=FakeEmbedder(),
        connect=connect,
        now=lambda: datetime(2026, 8, 25, 12, 0, tzinfo=UTC),
        # This runs in a *subprocess*, so the conftest fixture does not reach it. That is
        # exactly how it wrote two "A Test Book" Tracks into the real CMS before anyone
        # noticed: the guard has to be repeated wherever dependencies are built by hand.
        payload_client=cast("PayloadClient", RefusingPayloadClient()),
    )


def main() -> int:
    phase, database_url, run_id, epub, runs_dir = sys.argv[1:6]
    deps = _dependencies(database_url, runs_dir)

    with PostgresSaver.from_conn_string(database_url) as checkpointer:
        checkpointer.serde = pipeline_serializer()
        checkpointer.setup()
        graph = compile_graph(deps, checkpointer)
        config: RunnableConfig = {"configurable": {"thread_id": run_id}}

        if phase == "to-gate":
            state = PipelineState(
                run_id=run_id, source_path=epub, acquisition=Acquisition.PUBLIC_DOMAIN
            )
            graph.invoke(state, config)
            print("AT_GATE", flush=True)
            # Hang here so the parent can kill this process outright. Reaching the gate and
            # exiting cleanly would prove nothing about surviving a kill.
            while True:
                pass

        if phase == "resume":
            graph.invoke(Command(resume=True), config)
            snapshot = graph.get_state(config)
            resumed = PipelineState.model_validate(snapshot.values)
            print(f"APPROVED={resumed.approved}", flush=True)
            print(f"LEAVES={len(resumed.plan.leaves) if resumed.plan else 0}", flush=True)
            print(f"FIRST_TITLE={resumed.plan.leaves[0].title if resumed.plan else ''}", flush=True)
            print(f"CHUNKS={resumed.chunk_count}", flush=True)
            return 0

    raise SystemExit(f"unknown phase {phase!r}")


if __name__ == "__main__":
    raise SystemExit(main())
