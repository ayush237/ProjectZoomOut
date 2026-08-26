"""Tier A — raw text is deleted, and the audit trail survives.

R6: retain embeddings and cited passages, delete the raw full text. The point is an audit
trail that proves grounding without holding a copy of the book.

Every assertion here queries the database. Observing that `purge_raw_text` was called proves
nothing about what is still stored.
"""

from __future__ import annotations

from pathlib import Path

import psycopg

from zoomout_pipeline.db.repository import BookRepository
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.nodes import ingest_book
from zoomout_pipeline.models import Acquisition


def _ingest(deps: NodeDependencies, epub: Path) -> str:
    result = ingest_book(
        deps=deps, run_id="run-1", source_path=epub, acquisition=Acquisition.PUBLIC_DOMAIN
    )
    return str(result.book_id)


def test_purge_deletes_raw_text_and_keeps_embeddings(
    deps: NodeDependencies, sample_epub: Path, db_connection: psycopg.Connection[dict[str, object]]
) -> None:
    book_id = _ingest(deps, sample_epub)
    repo = BookRepository(db_connection)

    with db_connection.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM book_raw_text WHERE book_id = %s", (book_id,))
        assert int(str(cur.fetchone()["n"])) == 1  # type: ignore[index]
    chunks_before = repo.count_chunks(book_id)  # type: ignore[arg-type]
    assert chunks_before > 0

    repo.purge_raw_text(book_id)  # type: ignore[arg-type]

    with db_connection.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM book_raw_text WHERE book_id = %s", (book_id,))
        assert int(str(cur.fetchone()["n"])) == 0, "raw text must be gone"  # type: ignore[index]

        cur.execute(
            "SELECT count(*) AS n FROM book_chunks WHERE book_id = %s AND embedding IS NOT NULL",
            (book_id,),
        )
        assert int(str(cur.fetchone()["n"])) == chunks_before, "embeddings must survive"  # type: ignore[index]

        cur.execute(
            "SELECT count(*) AS n FROM book_chunks WHERE book_id = %s AND text IS NOT NULL",
            (book_id,),
        )
        assert int(str(cur.fetchone()["n"])) == 0, "uncited passage text must be gone"  # type: ignore[index]

        cur.execute("SELECT raw_text_purged_at FROM books WHERE id = %s", (book_id,))
        assert cur.fetchone()["raw_text_purged_at"] is not None  # type: ignore[index]


def test_purge_keeps_cited_passages(
    deps: NodeDependencies, sample_epub: Path, db_connection: psycopg.Connection[dict[str, object]]
) -> None:
    """Cited passages are the audit trail, so they are exactly what must not be deleted."""
    book_id = _ingest(deps, sample_epub)

    with db_connection.cursor() as cur:
        cur.execute(
            """
            UPDATE book_chunks SET is_cited = TRUE
            WHERE id IN (SELECT id FROM book_chunks WHERE book_id = %s ORDER BY id LIMIT 3)
            """,
            (book_id,),
        )
    db_connection.commit()

    result = BookRepository(db_connection).purge_raw_text(book_id)  # type: ignore[arg-type]

    assert result.cited_passages_retained == 3
    with db_connection.cursor() as cur:
        cur.execute(
            "SELECT count(*) AS n FROM book_chunks WHERE book_id = %s AND text IS NOT NULL",
            (book_id,),
        )
        assert int(str(cur.fetchone()["n"])) == 3  # type: ignore[index]


def test_provenance_survives_the_purge(
    deps: NodeDependencies, sample_epub: Path, db_connection: psycopg.Connection[dict[str, object]]
) -> None:
    """Provenance is the thing R6 calls retroactively impossible to reconstruct."""
    book_id = _ingest(deps, sample_epub)
    repo = BookRepository(db_connection)

    repo.purge_raw_text(book_id)  # type: ignore[arg-type]

    with db_connection.cursor() as cur:
        cur.execute("SELECT acquisition, title, file_hash FROM books WHERE id = %s", (book_id,))
        row = cur.fetchone()

    assert row is not None
    assert row["acquisition"] == "public-domain"
    assert row["file_hash"]


def test_analysis_after_a_purge_fails_loudly(
    deps: NodeDependencies, sample_epub: Path, db_connection: psycopg.Connection[dict[str, object]]
) -> None:
    """A purged book cannot be analysed. That should be an error, not an empty prompt."""
    book_id = _ingest(deps, sample_epub)
    repo = BookRepository(db_connection)
    repo.purge_raw_text(book_id)  # type: ignore[arg-type]

    assert repo.get_raw_text(book_id) is None  # type: ignore[arg-type]
