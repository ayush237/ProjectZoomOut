"""Track covers: the same illustrator and guard as a Leaf's scenario image, for a Track
instead.

**Not a general N-track mechanism.** `COVER_BRIEFS` holds exactly the two Tracks COVER-1 was
scoped to — both published, both still hotlinking someone else's image. A cover for one of the
27 placeholder Tracks is out of scope; they use `placehold.co`, which is what it is for.

**A deliberate invocation, like `generate-assets` itself (WP17).** There is no Leaf and no run
behind a cover, so this does not touch `PipelineState` or the graph at all — it only borrows
the pieces of the asset pipeline that do not assume one: `scene_block` for prompt shape,
`ImageClient`/`AnchorSet` for generation, `check_style` for the gate.

**Subject comes from the book, not from its title — and not from its own modernised Leaves.**
Both Tracks' scenario prompts were rewritten into present-day situations (a web agency, a
software team's sprint) for a reader deciding what to do *today*; a cover illustrating one of
those would show 2026, not the book. `cover_track42.md` and `cover_ikigai.md` were written
after reading all eighteen of each Track's published Leaves and looking at their existing
scenario art — Ikigai's takumi and moai Leaves in particular — for what "this book's world"
has actually meant here, then deliberately aimed at the book itself: Track 42's own 1910, and
the Okinawan daily life Ikigai keeps naming by name and the modernised scenarios mostly do not
show.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from zoomout_pipeline.assets.budget import BudgetExceededError, ImageBudget
from zoomout_pipeline.assets.images import AnchorSet, GeneratedImage, ImageClient
from zoomout_pipeline.assets.style_guard import GuardResult
from zoomout_pipeline.graph.asset_nodes import scene_block
from zoomout_pipeline.models import (
    Acquisition,
    SceneLight,
    SceneSetting,
    SceneShot,
    SceneVantage,
)
from zoomout_pipeline.prompts import load_prompt

# Every generation in this module requests this ratio. `TrackCard.tsx` crops a cover to
# `COVER_ASPECT = 2 / 3`, `resizeMode="cover"` — anything else is cropped through its subject.
COVER_ASPECT_RATIO = "2:3"

# A second attempt is spent as a retry for whichever brief the guard refused, never as a
# bonus candidate for one that already passed — see `generate_cover_candidates`. Bounded like
# every cycle here (R7): one retry is where the value is, for the same reason
# `asset_nodes.MAX_GUARD_ATTEMPTS` is 2 rather than more — the guard's own findings are not
# fed back, so a third attempt would be a fresh sample from the same distribution at the same
# price.
MAX_COVER_ATTEMPTS = 2


@dataclass(frozen=True)
class CoverBrief:
    """Everything needed to generate and identify one Track's cover."""

    track_id: int
    title: str
    acquisition: Acquisition
    prompt_name: str
    setting: SceneSetting


COVER_BRIEFS: list[CoverBrief] = [
    CoverBrief(
        track_id=42,
        title="The Science of Getting Rich",
        acquisition=Acquisition.PUBLIC_DOMAIN,
        prompt_name="cover_track42",
        setting=SceneSetting(
            order=0,  # unused for a cover — kept only because SceneSetting requires it
            place="the counter of an early twentieth-century general store",
            vantage=SceneVantage.INTERIOR,
            light=SceneLight.MORNING,
            shot=SceneShot.MEDIUM,
            figures=1,
            focus="the brass scale weighing goods on the counter",
        ),
    ),
    CoverBrief(
        track_id=50,
        title="Ikigai: The Japanese Secret to a Long and Happy Life",
        acquisition=Acquisition.UNDOCUMENTED,
        prompt_name="cover_ikigai",
        setting=SceneSetting(
            order=0,
            place="a vegetable garden beside a small home on Okinawa",
            vantage=SceneVantage.EXTERIOR,
            light=SceneLight.DAWN,
            shot=SceneShot.MEDIUM,
            figures=1,
            focus="the basket of harvested greens beside the rows of vegetables",
        ),
    ),
]


def cover_image_prompt(brief: CoverBrief) -> str:
    """The subject, then where it happens, then the house style.

    The cover's sibling of `asset_nodes.scenario_image_prompt`, without a Leaf record behind
    it — `scene_block` and the style contract are reused exactly, only the subject's source
    differs.
    """
    return (
        f"{load_prompt(brief.prompt_name)}\n\n"
        "This is the cover for the whole book, not a scene from any one chapter or moment in "
        "it. Illustrate it as a single representative image — one clear subject with room "
        "around it, not a specific decision or outcome.\n\n"
        f"{scene_block(brief.setting)}\n"
        f"{load_prompt('asset_style')}"
    )


def cover_alt_text(brief: CoverBrief) -> str:
    """What the cover shows, for a reader who cannot see it. Derived from the setting rather
    than asked of a vision model, for the same reason `asset_nodes.scenario_alt_text` is."""
    setting = brief.setting
    where = setting.place.rstrip(".")
    focus = setting.focus.rstrip(".")
    return (
        f"Cover art for {brief.title}. {setting.light.value.capitalize()} at {where}, the "
        f"view settling on {focus}. Flat stylised artwork in the app's dark palette; figures "
        "are not identifiable."
    )


@dataclass(frozen=True)
class CoverCandidate:
    """One generated candidate, guard-checked. Not yet written anywhere — same division as
    `asset_nodes.generate_candidates`: generating and choosing are different jobs."""

    brief: CoverBrief
    index: int
    image: GeneratedImage
    verdict: GuardResult


def generate_cover_candidates(
    *,
    client: ImageClient,
    briefs: list[CoverBrief],
    anchors: AnchorSet,
    model: str,
    guard: Callable[[bytes], GuardResult],
    budget: ImageBudget,
) -> list[CoverCandidate]:
    """One candidate per brief, then a second attempt spent only where the first was refused.

    **The budget is charged before each call**, exactly as `asset_nodes.generate_candidates`
    charges it — a run must not spend what it was refused permission to spend.

    **The second attempt is a targeted retry, never an automatic second option.** With a
    $0.50 ceiling and $0.134 a image, two briefs each getting a free second candidate is
    already over it (4 images, $0.536); spending the second attempt only on a brief the guard
    has not yet cleared keeps the common case (both pass first try) at 2 images and reserves
    the third for where it is actually needed. A caller that wants a further attempt after
    this halts can see exactly why in the returned verdicts and the budget's own report.

    **A candidate that never passes is still returned**, for the same reason
    `generate_candidates` returns one: a cover with nothing generated for it is worse than one
    with a flawed candidate on record, and indistinguishable from one nobody has tried yet.
    """
    results: list[CoverCandidate] = []

    def attempt(brief: CoverBrief, index: int) -> CoverCandidate | None:
        try:
            budget.charge(leaf_order=brief.track_id)
        except BudgetExceededError:
            return None
        image, _spend = client.generate(
            prompt=cover_image_prompt(brief),
            model=model,
            node="covers",
            anchors=anchors,
            aspect_ratio=COVER_ASPECT_RATIO,
        )
        verdict = guard(image.data)
        candidate = CoverCandidate(brief=brief, index=index, image=image, verdict=verdict)
        results.append(candidate)
        return candidate

    for brief in briefs:
        attempt(brief, 1)

    passed = {c.brief.track_id for c in results if c.verdict.passed}
    needs_retry = [b for b in briefs if b.track_id not in passed]
    for brief in needs_retry:
        if attempt(brief, MAX_COVER_ATTEMPTS) is None:
            break

    return results


__all__ = [
    "COVER_ASPECT_RATIO",
    "COVER_BRIEFS",
    "CoverBrief",
    "CoverCandidate",
    "cover_alt_text",
    "cover_image_prompt",
    "generate_cover_candidates",
]
