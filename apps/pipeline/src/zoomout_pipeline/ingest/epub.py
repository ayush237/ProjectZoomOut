"""EPUB parsing — the primary path.

Ruled 2026-08-13: EPUB primary, PDF fallback. EPUB is structured HTML with chapters and
paragraphs marked up, so reading order is given rather than reconstructed. That matters
downstream more than it looks: a mangled passage makes a bad source reference, and
grounding is the thing the legal position rests on.

Section selection
-----------------
A spine document becomes a chapter when it has a heading, carries real prose, and is not
distribution boilerplate. Anything substantial that is dropped is reported in
`parser_warnings` rather than discarded silently — a book whose chapters vanish because
they lacked an `<h2>` should be visible, not mysterious.
"""

from __future__ import annotations

import warnings
from pathlib import Path

from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

from zoomout_pipeline.models import Chapter, ParsedBook

# Below this, a document is front matter, a title page or a table of contents rather than
# a chapter. The shortest real chapter in the first book run through this (Wattles ch. XVII,
# a summary) is 515 words, and its table of contents is 114.
MIN_SECTION_WORDS = 200

# EPUB documents are XHTML, and bs4 warns whenever an HTML parser is pointed at XML. The
# HTML parser is the right choice here: real EPUBs in the wild are frequently not
# well-formed XML, and lxml's XML mode fails on them outright rather than recovering.
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

# Distribution boilerplate. Project Gutenberg wraps every book in a header, a licence and
# transcriber's notes; none of it is the author's writing and all of it would otherwise be
# analysed and cited as though it were.
_BOILERPLATE_MARKERS = (
    "project gutenberg",
    "transcriber",
    "end of the project",
    "start of the project",
    "creative commons",
    "all rights reserved",
)

_NAV_HEADINGS = ("contents", "table of contents", "index")


def parse_epub(path: Path) -> ParsedBook:
    """Parse an EPUB into ordered chapters."""
    # ebooklib warns about future defaults on every read; it is not actionable here.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        from ebooklib import epub as ebooklib_epub

        book = ebooklib_epub.read_epub(str(path))

    chapters: list[Chapter] = []
    warnings_out: list[str] = []

    for spine_id, _linear in book.spine:
        item = book.get_item_with_id(spine_id)
        if item is None:
            warnings_out.append(f"spine entry {spine_id!r} has no matching document")
            continue

        soup = BeautifulSoup(item.get_content(), "lxml")
        heading_tag = soup.find(["h1", "h2", "h3"])
        heading = _normalise(heading_tag.get_text(" ", strip=True)) if heading_tag else None
        text = _extract_text(soup)
        word_count = len(text.split())

        if _is_boilerplate(heading, text):
            continue
        if heading and heading.lower().strip(" .:") in _NAV_HEADINGS:
            continue
        if heading is None:
            if word_count >= MIN_SECTION_WORDS:
                warnings_out.append(
                    f"skipped a {word_count}-word document ({spine_id}) with no heading"
                )
            continue
        if word_count < MIN_SECTION_WORDS:
            continue

        chapters.append(Chapter(index=len(chapters), title=heading, text=text))

    return ParsedBook(
        chapters=chapters,
        detected_title=_first_metadata(book, "title"),
        detected_author=_first_metadata(book, "creator"),
        parser_warnings=warnings_out,
    )


def _extract_text(soup: BeautifulSoup) -> str:
    """Paragraph text, with the heading left out of the body.

    Paragraph structure is preserved because chunking splits on it — an EPUB's marked-up
    paragraphs are exactly the advantage it has over a PDF, and flattening them here would
    throw that away before it is used.
    """
    for tag in soup(["script", "style"]):
        tag.decompose()

    blocks = soup.find_all(["p", "blockquote", "li"])
    if blocks:
        parts = [_normalise(b.get_text(" ", strip=True)) for b in blocks]
        return "\n\n".join(part for part in parts if part)

    return _normalise(soup.get_text(" ", strip=True))


def _is_boilerplate(heading: str | None, text: str) -> bool:
    haystack = f"{heading or ''} {text[:400]}".lower()
    return any(marker in haystack for marker in _BOILERPLATE_MARKERS)


def _normalise(value: str) -> str:
    return " ".join(value.split())


def _first_metadata(book: object, field: str) -> str | None:
    entries = book.get_metadata("DC", field)  # type: ignore[attr-defined]
    if not entries:
        return None
    return str(entries[0][0])
