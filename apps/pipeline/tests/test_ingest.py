"""Ingest — provenance, parsing, chunk metadata, and not paying twice."""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import psycopg
import pytest

from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.nodes import ProvenanceError, ingest_book
from zoomout_pipeline.ingest.chunking import chunk_book
from zoomout_pipeline.ingest.parser import ParserError, parse_book
from zoomout_pipeline.models import Acquisition

from .conftest import FakeEmbedder


def test_refuses_to_ingest_without_an_acquisition_status(
    deps: NodeDependencies, sample_epub: Path
) -> None:
    """Tier A. R6 calls provenance retroactively impossible to reconstruct.

    `undocumented` is a legitimate answer. Saying nothing is not.
    """
    with pytest.raises(ProvenanceError) as error:
        ingest_book(deps=deps, run_id="run-1", source_path=sample_epub, acquisition=None)

    assert "undocumented" in str(error.value), "the message should name the honest fallback"


def test_records_provenance_with_the_acquisition_status(
    deps: NodeDependencies, sample_epub: Path, db_connection: psycopg.Connection[dict[str, object]]
) -> None:
    result = ingest_book(
        deps=deps,
        run_id="run-1",
        source_path=sample_epub,
        acquisition=Acquisition.PUBLIC_DOMAIN,
    )

    with db_connection.cursor() as cur:
        cur.execute("SELECT * FROM books WHERE id = %s", (result.book_id,))
        row = cur.fetchone()

    assert row is not None
    assert row["acquisition"] == "public-domain"
    assert row["source_format"] == "epub"
    assert row["file_hash"] == result.provenance.file_hash
    assert row["first_run_id"] == "run-1"


def test_every_chunk_keeps_its_location(sample_epub: Path) -> None:
    """WP17 has to cite a location. A chunk that lost its chapter is useless then."""
    parsed, _ = parse_book(sample_epub)
    chunks = chunk_book(parsed)

    assert chunks
    for chunk in chunks:
        assert 0 <= chunk.chapter_index < len(parsed.chapters)
        assert chunk.chapter_title == parsed.chapters[chunk.chapter_index].title
        assert chunk.position_in_chapter >= 0

    first_chapter = [c for c in chunks if c.chapter_index == 0]
    assert [c.position_in_chapter for c in first_chapter] == list(range(len(first_chapter)))


def test_re_ingesting_the_same_file_does_not_re_embed(
    deps: NodeDependencies, sample_epub: Path
) -> None:
    """Idempotency, and the most expensive accidental repeat available to this pipeline."""
    first = ingest_book(
        deps=deps, run_id="run-1", source_path=sample_epub, acquisition=Acquisition.PUBLIC_DOMAIN
    )

    fresh_embedder = FakeEmbedder()
    second = ingest_book(
        deps=replace(deps, embedder=fresh_embedder),
        run_id="run-2",
        source_path=sample_epub,
        acquisition=Acquisition.PUBLIC_DOMAIN,
    )

    assert second.book_id == first.book_id
    assert second.reused is True
    assert second.chunk_count == first.chunk_count
    assert fresh_embedder.batches == [], "a re-entered ingest must not call the embedder"


def test_an_unsupported_format_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "book.txt"
    path.write_text("not a book")

    with pytest.raises(ParserError):
        parse_book(path)
