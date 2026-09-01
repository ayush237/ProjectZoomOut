"""A per-Track image budget that stops a run.

**It halts rather than warns**, and that is the whole point. N candidates times eighteen
Leaves times retries is exactly the shape that quietly drains a credit, and a warning
attached to a run nobody is watching is indistinguishable from no budget at all.

Counted in images rather than currency. The price per image is a published rate we do not
control and it changes; the number of images is the thing the pipeline actually decides.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from zoomout_pipeline.assets.images import usd_per_image
from zoomout_pipeline.logging import get_logger

_log = get_logger(__name__)

# Three candidates across a 20-Leaf Track, plus headroom for a failed render or a refusal.
DEFAULT_MAX_IMAGES_PER_TRACK = 70


class BudgetExceededError(RuntimeError):
    """The run asked for more images than the Track is allowed. It stops here."""


@dataclass
class ImageBudget:
    """Tracks image spend for one Track and refuses to go past its cap.

    `model` is carried only so the dollar figure in the log and the report is the rate for
    the model actually being called. The *cap* is still counted in images and does not
    consult it — an image budget that moved when a price did would stop being a limit the
    run can reason about.
    """

    max_images: int = DEFAULT_MAX_IMAGES_PER_TRACK
    spent: int = 0
    per_leaf: dict[int, int] = field(default_factory=dict)
    model: str = ""

    def charge(self, *, leaf_order: int, count: int = 1) -> None:
        """Record images about to be generated, or refuse.

        Charged *before* the call rather than after. Charging afterwards means the run has
        already spent the money it was not allowed to spend, which makes the cap a report
        rather than a limit.
        """
        if self.spent + count > self.max_images:
            raise BudgetExceededError(
                f"this Track's image budget is {self.max_images} images and it has used "
                f"{self.spent}; generating {count} more would exceed it. Raise "
                "ZOOMOUT_PIPELINE_MAX_IMAGES_PER_TRACK deliberately, or find out why the "
                "run wants this many."
            )

        self.spent += count
        self.per_leaf[leaf_order] = self.per_leaf.get(leaf_order, 0) + count
        _log.info(
            "image.budget.charged",
            leaf=leaf_order,
            images=count,
            spent=self.spent,
            remaining=self.max_images - self.spent,
            usd=round(self.usd, 4),
        )

    @property
    def usd(self) -> float:
        return self.spent * usd_per_image(self.model)

    def report(self) -> str:
        return (
            f"{self.spent} images across {len(self.per_leaf)} Leaves, "
            f"${self.usd:.2f} at ${usd_per_image(self.model)}/image"
        )
