"""Schema creation for the pipeline's own database.

Plain SQL applied idempotently rather than a migration framework. This database has one
writer, no other consumers and no deployed history to preserve; a framework here would be
ceremony. It changes the moment anything else reads these tables.

The embedding dimension is fixed by the model in `config.DEFAULT_EMBEDDING_MODEL`
(`text-embedding-004`, 768). Changing embedding model means re-embedding, which is a
deliberate and expensive act — so the column is not silently flexible.
"""

from __future__ import annotations

import psycopg

from zoomout_pipeline.db.engine import assert_pipeline_database
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

EMBEDDING_DIMENSIONS = 768

_STATEMENTS: tuple[str, ...] = (
    "CREATE EXTENSION IF NOT EXISTS vector",
    "CREATE EXTENSION IF NOT EXISTS pgcrypto",
    """
    CREATE TABLE IF NOT EXISTS books (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_run_id    TEXT NOT NULL,
        title           TEXT NOT NULL,
        author          TEXT NOT NULL,
        edition         TEXT,
        source          TEXT NOT NULL,
        file_hash       TEXT NOT NULL UNIQUE,
        source_format   TEXT NOT NULL CHECK (source_format IN ('epub', 'pdf')),
        -- R6: never ingest without one. NOT NULL is the half of that the database can
        -- enforce; `ingest` refuses to be called without it for the other half.
        acquisition     TEXT NOT NULL CHECK (
                            acquisition IN ('public-domain','licensed','purchased','undocumented')
                        ),
        ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        raw_text_purged_at TIMESTAMPTZ
    )
    """,
    """
    -- The full text, kept apart from everything else precisely so that deleting it is a
    -- single unambiguous statement rather than a careful surgery across tables.
    CREATE TABLE IF NOT EXISTS book_raw_text (
        book_id  UUID PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
        content  TEXT NOT NULL
    )
    """,
    f"""
    CREATE TABLE IF NOT EXISTS book_chunks (
        id                  BIGSERIAL PRIMARY KEY,
        book_id             UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        chapter_index       INTEGER NOT NULL,
        chapter_title       TEXT NOT NULL,
        position_in_chapter INTEGER NOT NULL,
        -- Nullable on purpose. The purge nulls the text of uncited chunks and leaves the
        -- vector and the location behind: enough to prove grounding, not enough to
        -- reconstitute the book.
        text                TEXT,
        embedding           vector({EMBEDDING_DIMENSIONS}) NOT NULL,
        -- WP17 sets this when a chunk is cited as a source reference. Cited passages
        -- survive the purge because they are the audit trail; the rest do not.
        is_cited            BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE (book_id, chapter_index, position_in_chapter)
    )
    """,
    "CREATE INDEX IF NOT EXISTS book_chunks_book_idx ON book_chunks (book_id)",
    """
    CREATE INDEX IF NOT EXISTS book_chunks_embedding_idx
        ON book_chunks USING hnsw (embedding vector_cosine_ops)
    """,
)


def apply_schema(conn: psycopg.Connection[dict[str, object]]) -> None:
    """Create the pipeline's tables. Idempotent, and guarded."""
    assert_pipeline_database(conn)

    with conn.cursor() as cur:
        for statement in _STATEMENTS:
            # Static SQL from the tuple above; nothing is interpolated from input.
            cur.execute(statement)
    conn.commit()

    _log.info("schema.applied", statements=len(_STATEMENTS))
