"""PDF parsing — the fallback, and honest about being one.

A PDF is a layout format. Reading order has to be reconstructed from where glyphs sit on a
page, which interleaves columns, splices running headers into sentences and drops footnotes
mid-paragraph. Every downstream node degrades, and grounding degrades worst, because a
mangled passage makes a source reference that points at nonsense.

So this path exists, works, and says what it could not do. It never claims EPUB's fidelity.
"""

from __future__ import annotations

import re
from pathlib import Path

import pymupdf

from zoomout_pipeline.models import Chapter, ParsedBook

MIN_SECTION_WORDS = 200

# A chapter heading on its own line: "CHAPTER 4", "Chapter IV.", "4. Efficient Action".
_HEADING_PATTERN = re.compile(
    r"^\s*(chapter\s+[0-9ivxlc]+|[0-9]{1,2}\s*[.)])\s*[.:]?\s*(.{0,80})$",
    re.IGNORECASE,
)


def parse_pdf(path: Path) -> ParsedBook:
    """Parse a PDF into chapters, reconstructing structure as best the format allows."""
    warnings_out: list[str] = [
        "Parsed from PDF. Reading order is reconstructed from page layout, so chapter "
        "boundaries, footnotes and multi-column text may be wrong. EPUB is the primary "
        "path (ruled 2026-08-13) and should be preferred whenever it exists."
    ]

    # pymupdf ships partial type information and `Document` is untyped in it.
    with pymupdf.open(str(path)) as document:  # type: ignore[no-untyped-call]
        pages = [str(page.get_text("text")) for page in document]
        toc = document.get_toc()

    chapters = _split_by_toc(pages, toc) if toc else _split_by_heading_pattern(pages, warnings_out)

    if not chapters:
        warnings_out.append(
            "No chapter structure was recoverable; the document is treated as one section."
        )
        whole = _normalise("\n".join(pages))
        if whole:
            chapters = [Chapter(index=0, title="(whole document)", text=whole)]

    return ParsedBook(chapters=chapters, parser_warnings=warnings_out)


def _split_by_toc(pages: list[str], toc: list[list[object]]) -> list[Chapter]:
    """Use the PDF's own outline when it has one — far better than guessing from text."""
    entries = [(str(item[1]), int(str(item[2]))) for item in toc if len(item) >= 3]
    entries = [(title, page) for title, page in entries if 1 <= page <= len(pages)]
    if not entries:
        return []

    chapters: list[Chapter] = []
    for position, (title, start_page) in enumerate(entries):
        end_page = entries[position + 1][1] - 1 if position + 1 < len(entries) else len(pages)
        text = _normalise("\n".join(pages[start_page - 1 : end_page]))
        if len(text.split()) < MIN_SECTION_WORDS:
            continue
        chapters.append(Chapter(index=len(chapters), title=_normalise(title), text=text))
    return chapters


def _split_by_heading_pattern(pages: list[str], warnings_out: list[str]) -> list[Chapter]:
    warnings_out.append("The PDF has no outline; chapters were guessed from heading-shaped lines.")

    current_title: str | None = None
    current_lines: list[str] = []
    chapters: list[Chapter] = []

    def flush() -> None:
        if current_title is None:
            return
        text = _normalise("\n".join(current_lines))
        if len(text.split()) >= MIN_SECTION_WORDS:
            chapters.append(Chapter(index=len(chapters), title=current_title, text=text))

    for line in "\n".join(pages).splitlines():
        match = _HEADING_PATTERN.match(line)
        if match and len(line.split()) <= 12:
            flush()
            current_title = _normalise(line)
            current_lines = []
        else:
            current_lines.append(line)
    flush()

    return chapters


def _normalise(value: str) -> str:
    collapsed = re.sub(r"[ \t]+", " ", value)
    return "\n".join(line.strip() for line in collapsed.splitlines() if line.strip())
