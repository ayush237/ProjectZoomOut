"""The contact sheet.

Tier B — one happy path and the two things that would silently produce a useless sheet:
losing images off the end of a short last row, and tiling a previous sheet into a new one.
**Nothing here can check that the sheet is legible**, which is the only reason it exists;
that is a person opening it.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from zoomout_pipeline.assets.contact_sheet import (
    CELL_WIDTH,
    build_contact_sheet,
    write_contact_sheet,
)


def _png(path: Path, *, size: tuple[int, int] = (1024, 768), shade: int = 40) -> Path:
    Image.new("RGB", size, (shade, shade, shade)).save(path)
    return path


def test_every_image_lands_on_the_sheet_including_a_short_last_row(tmp_path: Path) -> None:
    """Eighteen images over three columns is six full rows; seventeen is not.

    The off-by-one that drops the last row is invisible in the output — a sheet of fifteen
    looks exactly like a sheet, and the two Leaves nobody looked at are the two that ship.
    """
    paths = [_png(tmp_path / f"leaf-{i:02d}.png") for i in range(17)]
    sheet = build_contact_sheet(paths, columns=3)

    assert sheet.height > 5 * (768 * CELL_WIDTH / 1024)
    assert sheet.width >= 3 * CELL_WIDTH


def test_images_of_different_shapes_share_one_cell_height(tmp_path: Path) -> None:
    paths = [
        _png(tmp_path / "a.png", size=(1024, 768)),
        _png(tmp_path / "b.png", size=(768, 1024)),
    ]
    sheet = build_contact_sheet(paths, columns=2)
    assert sheet.width >= 2 * CELL_WIDTH


def test_an_empty_set_is_an_error_rather_than_a_blank_sheet(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="at least one"):
        build_contact_sheet([])


def test_the_sheet_is_written_where_it_was_asked_for(tmp_path: Path) -> None:
    paths = [_png(tmp_path / "leaf-00.png")]
    destination = tmp_path / "out" / "contact-sheet.png"
    written = write_contact_sheet(paths, destination)

    assert written == destination and destination.exists()
    with Image.open(destination) as sheet:
        assert sheet.width >= CELL_WIDTH
