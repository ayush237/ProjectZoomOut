"""Chunking, on paragraph boundaries, carrying location with every piece.

Two constraints shape this. Chunks are what WP17 cites, so a chunk has to be small enough
that "this passage supports this claim" is a checkable statement rather than a gesture at
half a chapter. And every chunk keeps its chapter index, chapter title and ordinal within
the chapter — a chunk that has lost where it came from is useless to grounding then and
unrecoverable now.
"""

from __future__ import annotations

from zoomout_pipeline.models import Chunk, ParsedBook

# Roughly a long paragraph or two. Small enough to cite precisely, large enough to carry an
# argument rather than a fragment of one.
TARGET_CHUNK_WORDS = 250

# One paragraph of overlap so a claim spanning a paragraph break is still wholly inside at
# least one chunk. Overlap is measured in paragraphs rather than words to avoid cutting
# sentences in half.
OVERLAP_PARAGRAPHS = 1


def chunk_book(book: ParsedBook) -> list[Chunk]:
    """Split every chapter into embedded-sized passages."""
    chunks: list[Chunk] = []
    for chapter in book.chapters:
        for position, text in enumerate(_chunk_text(chapter.text)):
            chunks.append(
                Chunk(
                    chapter_index=chapter.index,
                    chapter_title=chapter.title,
                    position_in_chapter=position,
                    text=text,
                )
            )
    return chunks


def _chunk_text(text: str) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current: list[str] = []
    current_words = 0

    for paragraph in paragraphs:
        words = len(paragraph.split())

        if current and current_words + words > TARGET_CHUNK_WORDS:
            chunks.append("\n\n".join(current))
            current = current[-OVERLAP_PARAGRAPHS:] if OVERLAP_PARAGRAPHS else []
            current_words = sum(len(p.split()) for p in current)

        current.append(paragraph)
        current_words += words

    if current:
        chunks.append("\n\n".join(current))

    return chunks
