"""One image of a whole Track's illustrations, for the only check that matters.

**The variety check and this are answering different questions.** `variety.py` measures
whether each picture has a near twin, which is a statistic about the set. This produces the
thing a person looks at — eighteen pictures side by side, in Leaf order, labelled — because
the questions that decide whether a Track ships cannot be measured: does *this* place belong
to *this* scenario, is there text in the frame, is there a glow, is there a hand attached to
nobody. Track 42's published Leaf 1 renders "$10K" and "$2K" legibly and has a bloom on a
teal card, past every mechanical gate this service has.

It exists as a command rather than as a script somebody writes each time because WP30's
before/after comparison — that package's single most important piece of evidence — lived in
a temporary directory and is gone. Evidence that has to be rebuilt by hand is evidence that
stops being produced.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

# Big enough that text in a frame and a bloom around a lamp are both visible without
# opening the original — the two breaches that have shipped past the mechanical gates.
CELL_WIDTH = 420
LABEL_HEIGHT = 22
COLUMNS = 3
GUTTER = 8

# The app's deepest surface, so the sheet does not show every illustration against a white
# field it will never be seen on.
SHEET_BACKGROUND = (11, 15, 18)
LABEL_COLOUR = (200, 210, 214)


def build_contact_sheet(
    paths: list[Path], *, columns: int = COLUMNS, cell_width: int = CELL_WIDTH
) -> Image.Image:
    """Every image in `paths`, in the order given, labelled with its filename stem.

    Ordered by the caller rather than sorted here: the order that matters is Leaf order, and
    only the caller knows it.
    """
    if not paths:
        raise ValueError("a contact sheet needs at least one image")

    tiles: list[tuple[str, Image.Image]] = []
    for path in paths:
        with Image.open(path) as source:
            image = source.convert("RGB")
            height = max(1, round(image.height * cell_width / image.width))
            tiles.append((path.stem, image.resize((cell_width, height), Image.Resampling.LANCZOS)))

    cell_height = max(tile.height for _, tile in tiles) + LABEL_HEIGHT
    rows = (len(tiles) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (
            columns * cell_width + (columns + 1) * GUTTER,
            rows * cell_height + (rows + 1) * GUTTER,
        ),
        SHEET_BACKGROUND,
    )
    draw = ImageDraw.Draw(sheet)

    for index, (label, tile) in enumerate(tiles):
        column, row = index % columns, index // columns
        x = GUTTER + column * (cell_width + GUTTER)
        y = GUTTER + row * (cell_height + GUTTER)
        sheet.paste(tile, (x, y))
        draw.text((x + 2, y + tile.height + 4), label, fill=LABEL_COLOUR)

    _log.info("contact_sheet.built", images=len(tiles), columns=columns, rows=rows)
    return sheet


def write_contact_sheet(paths: list[Path], destination: Path, *, columns: int = COLUMNS) -> Path:
    """Build the sheet and write it, creating the directory if it is not there."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    build_contact_sheet(paths, columns=columns).save(destination)
    return destination


__all__ = ["CELL_WIDTH", "COLUMNS", "build_contact_sheet", "write_contact_sheet"]
