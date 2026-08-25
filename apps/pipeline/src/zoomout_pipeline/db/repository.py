"""Reads and writes against the pipeline's own database."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

import psycopg
from pgvector.psycopg import register_vector

from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import Acquisition, BookProvenance, Chunk, SourceFormat

_log = get_logger(__name__)


@dataclass(frozen=True)
class StoredBook:
    """A book row, with enough context for `ingest` to decide whether to do any work."""

    id: UUID
    provenance: BookProvenance
    chunk_count: int
    has_raw_text: bool


@dataclass(frozen=True)
class PurgeResult:
    """What a purge actually did. Returned so the caller can assert on effect."""

    raw_text_rows_deleted: int
    chunk_texts_cleared: int
    embeddings_retained: int
    cited_passages_retained: int


class BookRepository:
    """Provenance, chunks and retention."""

    def __init__(self, conn: psycopg.Connection[dict[str, object]]) -> None:
        self._conn = conn
        register_vector(conn)

    # ---------------------------------------------------------------- provenance

    def find_by_hash(self, file_hash: str) -> StoredBook | None:
        """The already-ingested book for this file, if there is one.

        This is what makes `ingest` idempotent: a re-entered run finds its own earlier
        work by content hash and does not re-embed. Re-embedding is the single most
        expensive accidental repeat in this pipeline.
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT b.*,
                       (SELECT count(*) FROM book_chunks c WHERE c.book_id = b.id) AS chunk_count,
                       EXISTS (SELECT 1 FROM book_raw_text r WHERE r.book_id = b.id) AS has_raw
                FROM books b
                WHERE b.file_hash = %s
                """,
                (file_hash,),
            )
            row = cur.fetchone()

        if row is None:
            return None
        return self._to_stored_book(row)

    def record_provenance(self, *, run_id: str, provenance: BookProvenance, raw_text: str) -> UUID:
        """Write the book row and stash its raw text.

        `acquisition` has no default anywhere in this path. R6 calls provenance
        retroactively impossible to reconstruct, which is the entire reason it is written
        at ingest rather than when somebody eventually asks.
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO books (
                    first_run_id, title, author, edition, source,
                    file_hash, source_format, acquisition, ingested_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    run_id,
                    provenance.title,
                    provenance.author,
                    provenance.edition,
                    provenance.source,
                    provenance.file_hash,
                    provenance.source_format.value,
                    provenance.acquisition.value,
                    provenance.ingested_at,
                ),
            )
            row = cur.fetchone()
            if row is None:  # pragma: no cover - RETURNING always yields a row
                raise RuntimeError("INSERT ... RETURNING id produced no row")
            book_id = UUID(str(row["id"]))

            cur.execute(
                "INSERT INTO book_raw_text (book_id, content) VALUES (%s, %s)",
                (book_id, raw_text),
            )
        self._conn.commit()

        _log.info(
            "provenance.recorded",
            book_id=str(book_id),
            run_id=run_id,
            acquisition=provenance.acquisition.value,
            source_format=provenance.source_format.value,
            file_hash=provenance.file_hash[:12],
        )
        return book_id

    # -------------------------------------------------------------------- chunks

    def store_chunks(
        self, *, book_id: UUID, chunks: list[Chunk], embeddings: list[list[float]]
    ) -> int:
        """Persist chunks and their vectors.

        `ON CONFLICT DO NOTHING` on (book, chapter, position) so a partially-completed
        ingest can be re-entered without duplicating rows.
        """
        if len(chunks) != len(embeddings):
            raise ValueError(
                f"{len(chunks)} chunks against {len(embeddings)} embeddings — refusing to "
                "store a misaligned pair"
            )

        with self._conn.cursor() as cur:
            for chunk, embedding in zip(chunks, embeddings, strict=True):
                cur.execute(
                    """
                    INSERT INTO book_chunks (
                        book_id, chapter_index, chapter_title,
                        position_in_chapter, text, embedding
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (book_id, chapter_index, position_in_chapter) DO NOTHING
                    """,
                    (
                        book_id,
                        chunk.chapter_index,
                        chunk.chapter_title,
                        chunk.position_in_chapter,
                        chunk.text,
                        embedding,
                    ),
                )
        self._conn.commit()

        count = self.count_chunks(book_id)
        _log.info("chunks.stored", book_id=str(book_id), chunk_count=count)
        return count

    def count_chunks(self, book_id: UUID) -> int:
        with self._conn.cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM book_chunks WHERE book_id = %s", (book_id,))
            row = cur.fetchone()
        return int(str(row["n"])) if row else 0

    def get_raw_text(self, book_id: UUID) -> str | None:
        with self._conn.cursor() as cur:
            cur.execute("SELECT content FROM book_raw_text WHERE book_id = %s", (book_id,))
            row = cur.fetchone()
        return str(row["content"]) if row else None

    # ----------------------------------------------------------------- retention

    def purge_raw_text(self, book_id: UUID) -> PurgeResult:
        """Delete the raw full text; keep embeddings, provenance and cited passages.

        R6, stated plainly: an audit trail that proves grounding without holding a copy of
        the book. The vectors and the chapter/position metadata stay, so WP17's citations
        still resolve to a location; the prose that would let anyone reconstitute the work
        does not.

        Built and tested in WP16 even though a WP16 run stops at gate 1 and WP17 still
        needs the text — deferring the mechanism is how it never gets built.
        """
        with self._conn.cursor() as cur:
            cur.execute("DELETE FROM book_raw_text WHERE book_id = %s", (book_id,))
            raw_deleted = cur.rowcount

            cur.execute(
                """
                UPDATE book_chunks
                SET text = NULL
                WHERE book_id = %s AND is_cited = FALSE AND text IS NOT NULL
                """,
                (book_id,),
            )
            texts_cleared = cur.rowcount

            cur.execute(
                "UPDATE books SET raw_text_purged_at = now() WHERE id = %s",
                (book_id,),
            )

            cur.execute(
                """
                SELECT count(*) AS embeddings,
                       count(*) FILTER (WHERE is_cited) AS cited
                FROM book_chunks WHERE book_id = %s
                """,
                (book_id,),
            )
            row = cur.fetchone()
        self._conn.commit()

        result = PurgeResult(
            raw_text_rows_deleted=raw_deleted,
            chunk_texts_cleared=texts_cleared,
            embeddings_retained=int(str(row["embeddings"])) if row else 0,
            cited_passages_retained=int(str(row["cited"])) if row else 0,
        )
        _log.info(
            "raw_text.purged",
            book_id=str(book_id),
            raw_text_rows_deleted=result.raw_text_rows_deleted,
            chunk_texts_cleared=result.chunk_texts_cleared,
            embeddings_retained=result.embeddings_retained,
            cited_passages_retained=result.cited_passages_retained,
        )
        return result

    # -------------------------------------------------------------------- helper

    @staticmethod
    def _to_stored_book(row: dict[str, object]) -> StoredBook:
        ingested = row["ingested_at"]
        purged = row["raw_text_purged_at"]
        return StoredBook(
            id=UUID(str(row["id"])),
            provenance=BookProvenance(
                title=str(row["title"]),
                author=str(row["author"]),
                edition=str(row["edition"]) if row["edition"] is not None else None,
                source=str(row["source"]),
                file_hash=str(row["file_hash"]),
                source_format=SourceFormat(str(row["source_format"])),
                acquisition=Acquisition(str(row["acquisition"])),
                ingested_at=ingested if isinstance(ingested, datetime) else datetime.now(),
                raw_text_purged_at=purged if isinstance(purged, datetime) else None,
            ),
            chunk_count=int(str(row["chunk_count"])),
            has_raw_text=bool(row["has_raw"]),
        )
