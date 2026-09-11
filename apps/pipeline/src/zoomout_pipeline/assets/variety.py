"""Whether a Track's illustrations are actually different pictures.

**This measures the pictures, not the labels.** A setting label can read "construction site"
over a rendering of a desk, so the places a run decided are reported here as a supporting
signal and are never the verdict. The verdict comes from the pixels.

**It measures composition and deliberately ignores colour.** That is the design, not an
omission. The palette is the identity: every illustration in this library sits in the same four
dark surfaces with one teal accent, so a check that scored colour variety would mark the house
style *working* as a failure. What must vary is where the shapes are.

## Two things that were tried and did not work, recorded because they look reasonable

**Luminance layout does not see the failure.** Track 42 — eighteen seated figures at a table,
a collapse obvious to anyone who looks at the set — scores a *higher* median pairwise distance
on a downsampled brightness grid than the six-image anchor set does. The reason is that these
pictures differ enormously in where the light is (a window left, a wedge from the top right)
and not at all in what is in them, and a brightness grid measures exactly the part that varies.
So the signature below is built from **edge density**: contours are the subject, and a soft
background gradient has almost none.

**The median distance over all pairs does not see it either** — 0.80 for Track 42 against 0.79
for the anchors. A collapsed set still contains distant pairs, because even eighteen desks are
framed differently. What "collapsed" actually means is that **every picture has a near twin**,
and the statistic for that is the distance from each image to its *nearest neighbour*. On that
measure the same two sets read 0.50 and 0.67, which is the separation a human eye makes.
"""

from __future__ import annotations

import io
import math
from collections.abc import Sequence
from dataclasses import dataclass
from statistics import median

from PIL import Image, ImageFilter

from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

# The grid the edge map is pooled into. Coarse enough that a chair moved twenty pixels is not
# "variety"; fine enough to tell a wide room from a close pair of hands.
GRID_WIDTH = 24
GRID_HEIGHT = 18

# Edges are found at this multiple of the grid and then mean-pooled down. Finding edges
# directly on a 24x18 thumbnail measures nothing — there are no contours left at that size.
EDGE_DETAIL_FACTOR = 4

# The floor on the median nearest-neighbour distance, below which a set has collapsed.
#
# **Calibrated against measured sets, and the calibration is thin — two real Tracks and the
# anchor set.** Revisit it on the third Track rather than trusting it. The measurements behind
# this number are in WP30's completion report; the synthetic ends of the scale are pinned in
# `tests/test_variety.py` so a change here fails a test rather than passing silently.
MIN_MEDIAN_NEAREST_DISTANCE = 0.60

# Two images closer than this are the same composition wearing different furniture. Reported
# per pair so a human can look at the two Leaves named rather than at a statistic.
NEAR_DUPLICATE_DISTANCE = 0.35


@dataclass(frozen=True)
class VarietyReport:
    """What a Track's illustrations look like taken as a set."""

    count: int
    median_nearest: float
    min_nearest: float
    nearest_by_index: tuple[tuple[int, int, float], ...]
    near_duplicate_pairs: tuple[tuple[int, int, float], ...]
    distinct_places: int | None
    place_labels: tuple[str, ...]

    @property
    def collapsed(self) -> bool:
        """Whether this has stopped being a set of different pictures."""
        return self.median_nearest < MIN_MEDIAN_NEAREST_DISTANCE

    @property
    def passed(self) -> bool:
        return not self.collapsed

    def summary(self) -> str:
        verdict = "COLLAPSED" if self.collapsed else "varied"
        lines = [
            f"{verdict}: {self.count} images, median nearest-neighbour distance "
            f"{self.median_nearest:.3f} (floor {MIN_MEDIAN_NEAREST_DISTANCE:.2f}), "
            f"closest pair {self.min_nearest:.3f}"
        ]
        if self.near_duplicate_pairs:
            pairs = ", ".join(f"{a}~{b} ({d:.2f})" for a, b, d in self.near_duplicate_pairs[:8])
            lines.append(f"  {len(self.near_duplicate_pairs)} near-duplicate pairs: {pairs}")
        if self.distinct_places is not None:
            lines.append(
                f"  settings named: {self.distinct_places} distinct places for {self.count} Leaves"
            )
        return "\n".join(lines)

    def crowded(self) -> list[tuple[int, int, float]]:
        """The images whose nearest neighbour is inside the near-duplicate radius."""
        return [item for item in self.nearest_by_index if item[2] < NEAR_DUPLICATE_DISTANCE]


def composition_signature(data: bytes) -> tuple[float, ...]:
    """One image reduced to where its edges are.

    Greyscale, edges found at a size where there are edges to find, mean-pooled into a coarse
    grid, then z-scored. The z-score is what makes this a composition measure rather than a
    contrast measure: the same room drawn darker scores as the same room, which is correct,
    and two different rooms do not collapse onto each other merely for both being dark — which
    matters here, because every image in this library is dark by contract.
    """
    detail = (GRID_WIDTH * EDGE_DETAIL_FACTOR, GRID_HEIGHT * EDGE_DETAIL_FACTOR)
    with Image.open(io.BytesIO(data)) as image:
        large = image.convert("L").resize(detail, Image.Resampling.BILINEAR)
        edges = large.filter(ImageFilter.FIND_EDGES)
        grid = edges.resize((GRID_WIDTH, GRID_HEIGHT), Image.Resampling.BOX)
        cells = [float(value) for value in grid.tobytes()]

    mean = sum(cells) / len(cells)
    variance = sum((value - mean) ** 2 for value in cells) / len(cells)
    spread = math.sqrt(variance)
    if spread == 0:
        # A flat image has no composition. Zeros are the honest answer: `signature_distance`
        # reports 0 against anything, so a run of blank images reads as collapsed, which it is.
        return tuple(0.0 for _ in cells)
    return tuple((value - mean) / spread for value in cells)


def signature_distance(left: Sequence[float], right: Sequence[float]) -> float:
    """Cosine distance between two signatures, in [0, 2].

    0 is the same layout, 1 is unrelated. Cosine rather than RMS so the number does not move
    with the grid size, which keeps the threshold above meaningful if the grid is retuned.
    """
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return 1.0 - dot / (left_norm * right_norm)


def check_variety(images: Sequence[bytes], *, places: Sequence[str] | None = None) -> VarietyReport:
    """Whether these are different pictures, and which ones are not.

    One image per Leaf, in Leaf order — the indices in the report are positions in this
    sequence, so the caller can name the Leaves. A set of fewer than two is reported as varied
    rather than as a failure: there is nothing for it to have collapsed into.
    """
    distinct = len({place.strip().lower() for place in places}) if places else None

    if len(images) < 2:
        return VarietyReport(
            count=len(images),
            median_nearest=math.inf,
            min_nearest=math.inf,
            nearest_by_index=(),
            near_duplicate_pairs=(),
            distinct_places=distinct,
            place_labels=tuple(places or ()),
        )

    signatures = [composition_signature(data) for data in images]
    size = len(signatures)

    pairwise = [[0.0] * size for _ in range(size)]
    near: list[tuple[int, int, float]] = []
    for i in range(size):
        for j in range(i + 1, size):
            value = signature_distance(signatures[i], signatures[j])
            pairwise[i][j] = pairwise[j][i] = value
            if value < NEAR_DUPLICATE_DISTANCE:
                near.append((i, j, value))

    nearest: list[tuple[int, int, float]] = []
    for i in range(size):
        partner = min((j for j in range(size) if j != i), key=lambda j: pairwise[i][j])
        nearest.append((i, partner, pairwise[i][partner]))

    near.sort(key=lambda item: item[2])
    distances = [item[2] for item in nearest]
    report = VarietyReport(
        count=size,
        median_nearest=median(distances),
        min_nearest=min(distances),
        nearest_by_index=tuple(nearest),
        near_duplicate_pairs=tuple(near),
        distinct_places=distinct,
        place_labels=tuple(places or ()),
    )
    _log.info(
        "variety.checked",
        images=report.count,
        median_nearest=round(report.median_nearest, 4),
        min_nearest=round(report.min_nearest, 4),
        near_duplicates=len(report.near_duplicate_pairs),
        distinct_places=distinct,
        collapsed=report.collapsed,
    )
    return report


__all__ = [
    "EDGE_DETAIL_FACTOR",
    "GRID_HEIGHT",
    "GRID_WIDTH",
    "MIN_MEDIAN_NEAREST_DISTANCE",
    "NEAR_DUPLICATE_DISTANCE",
    "VarietyReport",
    "check_variety",
    "composition_signature",
    "signature_distance",
]
