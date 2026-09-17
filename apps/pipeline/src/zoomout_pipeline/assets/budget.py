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


@dataclass
class NarrationBudget:
    """The voiceover ceiling, in dollars, and a refusal before any call that could cross it.

    **The sibling of `ImageBudget`, and deliberately not the same unit.** An image has a
    published price, so counting images is counting money. A clip does not: it is billed per
    second of audio, and the length is the model's decision, made after the request is sent.
    So each call reserves **the most it could possibly cost** — Cloud TTS's longest response —
    before it is made, and the actual figure is settled afterwards. A run can therefore stop
    a little short of its ceiling; it cannot pass it.

    `spent_usd` starts from what the run's ledger already holds for voiceover, because the
    ceiling is the founder's for the package: an audition, a render and a regeneration are
    three invocations drawing on one number. A budget that restarted at zero each time would
    let three $2.90 invocations through a $3 ceiling.
    """

    ceiling_usd: float
    spent_usd: float = 0.0
    calls: int = 0

    def reserve(self, *, worst_case_usd: float, what: str) -> None:
        """Refuse the call unless its worst case fits. Called **before** the call."""
        if self.spent_usd + worst_case_usd > self.ceiling_usd:
            raise BudgetExceededError(
                f"voiceover has spent ${self.spent_usd:.4f} of its ${self.ceiling_usd:.2f} "
                f"ceiling, and {what} could cost up to ${worst_case_usd:.4f}. Stopping here — "
                "the ceiling is the signal to report, not a figure to raise."
            )

    def settle(self, usd: float) -> None:
        """Record what a call actually cost, once it has answered."""
        self.spent_usd += usd
        self.calls += 1
        _log.info(
            "narration.budget.settled",
            usd=round(usd, 5),
            spent=round(self.spent_usd, 4),
            remaining=round(self.ceiling_usd - self.spent_usd, 4),
        )

    @property
    def remaining_usd(self) -> float:
        return self.ceiling_usd - self.spent_usd

    def report(self) -> str:
        return f"${self.spent_usd:.4f} of the ${self.ceiling_usd:.2f} voiceover ceiling"
