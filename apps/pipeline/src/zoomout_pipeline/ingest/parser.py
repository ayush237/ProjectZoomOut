"""Format dispatch for the two source paths."""

from __future__ import annotations

import hashlib
from pathlib import Path

from zoomout_pipeline.ingest.epub import parse_epub
from zoomout_pipeline.ingest.pdf import parse_pdf
from zoomout_pipeline.models import ParsedBook, SourceFormat


class ParserError(RuntimeError):
    """The source file could not be parsed into anything usable."""


def detect_format(path: Path) -> SourceFormat:
    suffix = path.suffix.lower()
    if suffix == ".epub":
        return SourceFormat.EPUB
    if suffix == ".pdf":
        return SourceFormat.PDF
    raise ParserError(
        f"{path.name}: unsupported format {suffix!r}. EPUB is the primary path, PDF the "
        "fallback (ruled 2026-08-13)."
    )


def parse_book(path: Path) -> tuple[ParsedBook, SourceFormat]:
    """Parse a source file into ordered chapters."""
    if not path.exists():
        raise ParserError(f"{path} does not exist")

    source_format = detect_format(path)
    parsed = parse_epub(path) if source_format is SourceFormat.EPUB else parse_pdf(path)

    if not parsed.chapters:
        raise ParserError(
            f"{path.name}: no chapters were recovered. Analysis and the structure check "
            "both need the book's own sections, so this cannot proceed."
        )
    return parsed, source_format


def file_hash(path: Path) -> str:
    """SHA-256 of the source file — the provenance record's identity for it."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(65536), b""):
            digest.update(block)
    return digest.hexdigest()
