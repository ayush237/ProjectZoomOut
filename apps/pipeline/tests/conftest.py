"""Shared fixtures.

LLM nodes are tested on their **contract** — that output parses, that required fields are
present, that a bad plan is rejected — never on their prose. So the model is a scripted
fake and the normal gate never touches the network.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, TypeVar

import psycopg
import pytest
from psycopg.rows import dict_row
from pydantic import BaseModel

from zoomout_pipeline.config import PipelineSettings
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.db.schema import EMBEDDING_DIMENSIONS, apply_schema
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.llm.client import GenerationResult
from zoomout_pipeline.models import BookAnalysis, LeafPlan, PlannedLeaf

T = TypeVar("T", bound=BaseModel)

# The pipeline's own container, a database apart from the one real runs use. Overridable so
# the same suite can point somewhere else.
TEST_DATABASE_URL = os.environ.get(
    "ZOOMOUT_PIPELINE_TEST_DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:5433/zoomout_pipeline_test",
)
_ADMIN_URL = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
_TEST_DB_NAME = TEST_DATABASE_URL.rsplit("/", 1)[1]


class ScriptedLLM:
    """Returns pre-built objects in order, and records what it was asked."""

    def __init__(self, responses: list[BaseModel]) -> None:
        self._responses = list(responses)
        self.calls: list[dict[str, Any]] = []

    def generate_structured(
        self,
        *,
        prompt: str,
        schema: type[T],
        model: str,
        node: str,
        system_instruction: str | None = None,
    ) -> GenerationResult[T]:
        self.calls.append({"node": node, "model": model, "prompt": prompt})
        if not self._responses:
            raise AssertionError(f"{node} asked for a response but the script is exhausted")

        value = self._responses.pop(0)
        if not isinstance(value, schema):
            raise AssertionError(f"{node} expected {schema.__name__}, script had {type(value)}")

        return GenerationResult(
            value=value,
            spend=TokenSpend(node=node, model=model, input_tokens=1000, output_tokens=500),
        )


class FakeEmbedder:
    """Deterministic vectors — the values are irrelevant, the count and shape are not."""

    def __init__(self) -> None:
        self.batches: list[int] = []

    def embed(
        self, *, texts: list[str], model: str, node: str
    ) -> tuple[list[list[float]], TokenSpend]:
        self.batches.append(len(texts))
        vectors = [
            [float((len(text) + i) % 7) / 7.0] * EMBEDDING_DIMENSIONS
            for i, text in enumerate(texts)
        ]
        return vectors, TokenSpend(node=node, model=model, input_tokens=len(texts) * 10)


def make_plan(
    *, leaves: int, chapters_per_leaf: int = 2, mirror: bool = False, chapter_count: int = 17
) -> LeafPlan:
    """Build a plan for the structure check to measure.

    `mirror=True` produces the failure case: one chapter per Leaf, in the book's own order.
    """
    planned: list[PlannedLeaf] = []
    for index in range(leaves):
        if mirror:
            sources = [index % chapter_count]
        else:
            sources = sorted(
                {(index * 5 + offset * 7) % chapter_count for offset in range(chapters_per_leaf)}
            )
        planned.append(
            PlannedLeaf(
                order=index,
                title=f"Leaf {index}",
                concept=f"Concept {index}",
                source_chapters=sources,
            )
        )
    return LeafPlan(leaves=planned)


@pytest.fixture
def analysis() -> BookAnalysis:
    return BookAnalysis(
        central_argument="Thinking in a certain way produces wealth.",
        themes=["gratitude", "creative rather than competitive thought"],
        key_concepts=["the certain way", "the impression of increase"],
        intended_reader="Someone who wants money before philosophy.",
        structure_notes="The book states its thesis early and repeats it.",
    )


@pytest.fixture
def settings(tmp_path: Path) -> PipelineSettings:
    return PipelineSettings(
        database_url=TEST_DATABASE_URL,
        gemini_api_key="test-key-not-used",
        runs_dir=tmp_path / "runs",
    )


@pytest.fixture
def db_connection() -> Iterator[psycopg.Connection[dict[str, object]]]:
    """A connection to a scratch database, created and dropped around the test.

    Skips — loudly — when Postgres is not reachable, rather than passing silently. The
    retention and provenance tests are Tier A and a green gate that quietly skipped them
    would be worse than a red one.
    """
    try:
        with psycopg.connect(_ADMIN_URL, autocommit=True) as admin:
            admin.execute(f'DROP DATABASE IF EXISTS "{_TEST_DB_NAME}"')
            admin.execute(f'CREATE DATABASE "{_TEST_DB_NAME}"')
    except psycopg.OperationalError as error:
        pytest.skip(
            f"Postgres not reachable at {_ADMIN_URL}: {error}. "
            "Start the pipeline's container — see apps/pipeline/README.md."
        )

    conn = psycopg.connect(TEST_DATABASE_URL, row_factory=dict_row)
    try:
        apply_schema(conn)
        yield conn
    finally:
        conn.close()
        with psycopg.connect(_ADMIN_URL, autocommit=True) as admin:
            admin.execute(f'DROP DATABASE IF EXISTS "{_TEST_DB_NAME}" WITH (FORCE)')


@pytest.fixture
def deps(
    settings: PipelineSettings,
    db_connection: psycopg.Connection[dict[str, object]],
) -> NodeDependencies:
    @contextmanager
    def connect() -> Iterator[psycopg.Connection[dict[str, object]]]:
        yield db_connection

    return NodeDependencies(
        settings=settings,
        llm=ScriptedLLM([]),
        embedder=FakeEmbedder(),
        connect=connect,
        now=lambda: datetime(2026, 8, 25, 12, 0, tzinfo=UTC),
    )


def build_epub(path: Path, *, chapters: int = 17, words_per_chapter: int = 300) -> Path:
    """A small, synthetic EPUB.

    Generated rather than committed: the fixture has to exercise the real parser, and a
    real book cannot be checked into the repository (LEGAL.md, and the .gitignore that
    keeps `.data/` out).
    """
    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        from ebooklib import epub as ebooklib_epub

    book = ebooklib_epub.EpubBook()
    book.set_identifier("test-book")
    book.set_title("A Test Book")
    book.set_language("en")
    book.add_author("A Test Author")

    documents = []
    for index in range(chapters):
        body = " ".join(f"sentence{index}word{n}" for n in range(words_per_chapter))
        item = ebooklib_epub.EpubHtml(
            title=f"CHAPTER {index + 1}",
            file_name=f"chap_{index}.xhtml",
            lang="en",
        )
        item.content = f"<h2>CHAPTER {index + 1}. Topic {index}</h2><p>{body}</p>"
        book.add_item(item)
        documents.append(item)

    book.toc = tuple(documents)
    book.add_item(ebooklib_epub.EpubNcx())
    book.add_item(ebooklib_epub.EpubNav())
    book.spine = list(documents)

    ebooklib_epub.write_epub(str(path), book)
    return path


@pytest.fixture
def sample_epub(tmp_path: Path) -> Path:
    return build_epub(tmp_path / "sample.epub")
