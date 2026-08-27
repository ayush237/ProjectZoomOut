"""Retrieval over the embedded book.

Long context tells you the book says something; retrieval tells you **where** (proposal
§3.2). That distinction is the whole reason this exists: a source reference has to name a
location a person can check, and only retrieval produces one.

Every passage returned carries the chapter index, the chapter title and its position — the
locator `content.ts` requires alongside the note. A passage without that is useless to
grounding, which is why `ingest` was built to preserve it.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import psycopg
from pgvector.psycopg import register_vector

from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

# Enough context for a claim to be checkable without handing the model a whole chapter.
DEFAULT_TOP_K = 12


@dataclass(frozen=True)
class Passage:
    """One retrieved chunk, with everything needed to cite it.

    `ref` is the short handle the model is told to cite. It is deliberately not the database
    id: the model sees only the handles it was given, so a citation that does not resolve is
    self-evidently invented rather than merely wrong.
    """

    ref: str
    chunk_id: int
    chapter_index: int
    chapter_title: str
    position_in_chapter: int
    text: str
    distance: float

    @property
    def locator(self) -> str:
        """The human-facing location, used as the `chapter` locator on a source reference."""
        return self.chapter_title


class PassageRepository:
    """Vector search over one book's chunks."""

    def __init__(self, conn: psycopg.Connection[dict[str, object]]) -> None:
        self._conn = conn
        register_vector(conn)

    def search(
        self,
        *,
        book_id: UUID,
        embedding: list[float],
        top_k: int = DEFAULT_TOP_K,
        chapter_indices: list[int] | None = None,
    ) -> list[Passage]:
        """Nearest passages by cosine distance, optionally confined to given chapters.

        `chapter_indices` comes from the approved plan: a Leaf declares which chapters it
        draws on, so retrieval for that Leaf should look there first. Confining rather than
        merely ranking keeps a Leaf from citing a passage its own plan never claimed.
        """
        sql = """
            SELECT id, chapter_index, chapter_title, position_in_chapter, text,
                   embedding <=> %s::vector AS distance
            FROM book_chunks
            WHERE book_id = %s AND text IS NOT NULL
        """
        params: list[object] = [embedding, book_id]

        if chapter_indices:
            sql += " AND chapter_index = ANY(%s)"
            params.append(list(chapter_indices))

        sql += " ORDER BY distance ASC LIMIT %s"
        params.append(top_k)

        with self._conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

        passages = [
            Passage(
                ref=f"P{index + 1}",
                chunk_id=int(str(row["id"])),
                chapter_index=int(str(row["chapter_index"])),
                chapter_title=str(row["chapter_title"]),
                position_in_chapter=int(str(row["position_in_chapter"])),
                text=str(row["text"]),
                distance=float(str(row["distance"])),
            )
            for index, row in enumerate(rows)
        ]

        _log.debug(
            "retrieval.search",
            book_id=str(book_id),
            returned=len(passages),
            chapters=chapter_indices or "all",
        )
        return passages

    def mark_cited(self, chunk_ids: list[int]) -> int:
        """Flag passages that a Leaf cites.

        Cited passages survive `purge_raw_text` — they are the audit trail that proves
        grounding after the book itself is deleted (R6). Marking them is therefore not
        bookkeeping; it is what makes the retention rule safe to apply.
        """
        if not chunk_ids:
            return 0

        with self._conn.cursor() as cur:
            cur.execute(
                "UPDATE book_chunks SET is_cited = TRUE WHERE id = ANY(%s) AND NOT is_cited",
                (chunk_ids,),
            )
            marked = cur.rowcount
        self._conn.commit()

        _log.info("retrieval.marked_cited", count=marked)
        return marked
