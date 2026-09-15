"""Tier A — the Track-level variety check, and the mutation that must turn it red.

**Which evidence is which.** Everything here is a test. Whether the *generator* produces varied
pictures is not testable and is not tested here — that took a human looking at eighteen images,
and the before/after in WP30's completion report is the real proof of it. What these tests pin
is narrower and still worth having: that the check itself distinguishes a collapsed set from a
varied one, that it still fails on the real set it was built from, and that breaking the
setting derivation is caught by it rather than sailing through green.
"""

from __future__ import annotations

import io
import zlib
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from zoomout_pipeline.assets.variety import (
    NEAR_DUPLICATE_DISTANCE,
    check_variety,
    composition_signature,
    signature_distance,
)
from zoomout_pipeline.models import (
    SceneLight,
    ScenePlan,
    SceneSetting,
    SceneShot,
    SceneVantage,
)

FIXTURES = Path(__file__).parent / "fixtures"

# The app's deepest surface and the lighter shapes drawn on it, so the synthetic pictures sit
# in the same tonal range as real ones. The check ignores colour, but a fixture that looked
# nothing like the thing it stands in for would be a worse fixture.
_GROUND = (0x0B, 0x0F, 0x12)
_SHAPES = ((0x1C, 0x24, 0x2A), (0x26, 0x31, 0x3A), (0x3A, 0x48, 0x54))


def render_scene(setting: SceneSetting, size: tuple[int, int] = (320, 240)) -> bytes:
    """A stand-in for an image model that actually draws what it is told.

    Deterministic in the setting and **only** in the setting: same setting, same bytes;
    different place, different composition. That is the one property the mutation test below
    needs, and it is what lets the derivation and the check be wired together in a unit test
    without a network call or a cent of spend.
    """
    width, height = size
    rng = zlib.crc32(setting.place.encode())

    def roll(limit: int, salt: int) -> int:
        return (rng >> (salt * 3) ^ (rng * (salt + 7))) % max(1, limit)

    image = Image.new("RGB", size, _GROUND)
    draw = ImageDraw.Draw(image)

    # The horizon: where the ground plane sits. A wide shot of a yard and a close view of a
    # worktop put it in very different places.
    horizon = height // 4 + roll(height // 2, 1)
    draw.rectangle([0, horizon, width, height], fill=_SHAPES[roll(len(_SHAPES), 2)])

    # Camera distance decides how many things are in frame and how big they are.
    blocks = {SceneShot.CLOSE: 1, SceneShot.MEDIUM: 3, SceneShot.WIDE: 8}[setting.shot]
    scale = {SceneShot.CLOSE: 0.7, SceneShot.MEDIUM: 0.3, SceneShot.WIDE: 0.12}[setting.shot]
    for index in range(blocks):
        box_w = int(width * scale)
        box_h = int(height * scale)
        left = roll(max(1, width - box_w), index + 3)
        top = roll(max(1, height - box_h), index + 11)
        draw.rectangle(
            [left, top, left + box_w, top + box_h], fill=_SHAPES[roll(len(_SHAPES), index + 5)]
        )

    # Figures, as uprights. Zero really means zero — an empty place is a different picture.
    for figure in range(setting.figures):
        column = roll(max(1, width - 24), figure + 17)
        draw.rectangle([column, horizon - height // 3, column + 20, horizon], fill=_SHAPES[2])

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def setting(
    order: int, place: str, *, shot: SceneShot = SceneShot.MEDIUM, figures: int = 1
) -> SceneSetting:
    return SceneSetting(
        order=order,
        place=place,
        vantage=SceneVantage.INTERIOR,
        light=SceneLight.EVENING,
        shot=shot,
        figures=figures,
        focus="the thing in the middle",
    )


# Eight places, eight framings — **built as a real `ScenePlan` rather than by hand.**
#
# That matters: `ScenePlan` refuses a Track that uses one camera distance or fewer than three
# times of day, so a hand-built list of eight medium shots is not a plan this pipeline can
# emit, and a test calibrated on one would be measuring something the generator never produces.
# Constructing it through the validator means the varied end of this scale is exactly as varied
# as the weakest plan the derivation is allowed to return.
VARIED_PLAN = ScenePlan(
    settings=[
        SceneSetting(
            order=order,
            place=place,
            vantage=vantage,
            light=light,
            shot=shot,
            figures=figures,
            focus=focus,
        )
        for order, (place, vantage, light, shot, figures, focus) in enumerate(
            [
                (
                    "the roasting room behind a small coffee shop",
                    SceneVantage.INTERIOR,
                    SceneLight.MORNING,
                    SceneShot.MEDIUM,
                    1,
                    "a scoop resting in a bin of beans",
                ),
                (
                    "a loading bay at the back of a print works",
                    SceneVantage.EXTERIOR,
                    SceneLight.DAWN,
                    SceneShot.WIDE,
                    0,
                    "a stack of pallets under the shutter",
                ),
                (
                    "the top deck of a night bus",
                    SceneVantage.INTERIOR,
                    SceneLight.NIGHT,
                    SceneShot.MEDIUM,
                    2,
                    "a hand steadying against the rail",
                ),
                (
                    "an allotment shed with the door open",
                    SceneVantage.EXTERIOR,
                    SceneLight.AFTERNOON,
                    SceneShot.WIDE,
                    1,
                    "tools hung in a row",
                ),
                (
                    "a hospital corridor outside a ward",
                    SceneVantage.INTERIOR,
                    SceneLight.MIDDAY,
                    SceneShot.CLOSE,
                    0,
                    "two empty chairs against the wall",
                ),
                (
                    "the stockroom of a hardware shop",
                    SceneVantage.INTERIOR,
                    SceneLight.EVENING,
                    SceneShot.CLOSE,
                    1,
                    "a box half unpacked",
                ),
                (
                    "a stairwell between two floors",
                    SceneVantage.INTERIOR,
                    SceneLight.NIGHT,
                    SceneShot.WIDE,
                    1,
                    "a coat over the bannister",
                ),
                (
                    "a market stall before the shutters go up",
                    SceneVantage.EXTERIOR,
                    SceneLight.DAWN,
                    SceneShot.MEDIUM,
                    3,
                    "crates waiting on the pavement",
                ),
            ]
        )
    ]
)

VARIED_PLACES = [item.place for item in VARIED_PLAN.settings]


# --------------------------------------------------------------- the two ends of the scale


def test_the_same_picture_repeated_is_collapsed() -> None:
    """Tier A. The floor case: if this passes, the check measures nothing."""
    one = render_scene(setting(0, "a stairwell between two floors"))

    report = check_variety([one] * 8)

    assert report.collapsed is True
    assert report.median_nearest == pytest.approx(0.0, abs=1e-9)
    assert len(report.near_duplicate_pairs) == 28, "every pair of eight identical images"


def test_different_places_spread_out_and_identical_ones_do_not() -> None:
    """The other end of the scale — as an *ordering*, deliberately, not as a threshold.

    **A synthetic renderer cannot tell you where the floor goes.** These pictures are
    rectangles; real illustrations of a hospital corridor and the top deck of a night bus
    differ far more than rectangle arrangements do, and a floor calibrated to make this
    fixture pass would be a floor fitted to a toy. So the absolute threshold is pinned by the
    two *real* sets below — Track 42 must fail it, the anchor set must clear it — and what is
    asserted here is only that the check orders the two cases correctly and separates them by
    a wide margin.
    """
    varied = check_variety(
        [render_scene(item) for item in VARIED_PLAN.settings], places=VARIED_PLACES
    )
    identical = check_variety([render_scene(VARIED_PLAN.settings[0])] * len(VARIED_PLACES))

    assert varied.median_nearest > identical.median_nearest + 0.4
    assert varied.near_duplicate_pairs == (), "distinct places must not read as near-duplicates"
    assert varied.distinct_places == len(VARIED_PLACES)


# ------------------------------------------------------------------------ the mutation


def test_breaking_the_setting_derivation_turns_the_check_red() -> None:
    """**The mutation the handoff asked for.**

    The two halves of WP30 are a generator that varies the setting and a check that notices
    when it stops. This wires them together: same renderer, same check, and the only thing
    that changes is whether the derivation gives each Leaf its own place or hands every Leaf
    the same one — which is exactly what the generator did before this package, and exactly
    what it would do again if the scene plan were dropped from the image prompt.

    A check that cannot tell those two apart is decoration.
    """

    # Broken deliberately *outside* `ScenePlan`, because the validator would refuse this — and
    # refusing it is the first line of defence, not this check. What is simulated here is the
    # state the pipeline was in before WP30: no plan at all, every Leaf drawn from the same
    # unstated default.
    broken = [
        setting(order, "a desk in a dim room at night") for order in range(len(VARIED_PLACES))
    ]

    healthy = check_variety([render_scene(item) for item in VARIED_PLAN.settings])
    mutated = check_variety([render_scene(item) for item in broken])

    assert mutated.collapsed is True, "breaking the derivation must be caught"
    assert len(mutated.near_duplicate_pairs) == 28, "every pair is the same picture"
    # Ordering, not a threshold — see the note in the test above on why a synthetic fixture
    # cannot be asked where the floor goes.
    assert healthy.median_nearest > mutated.median_nearest + 0.4
    assert healthy.near_duplicate_pairs == ()


# ---------------------------------------------------------------------- against real sets


def test_the_check_still_fails_on_the_set_it_was_built_from() -> None:
    """Tier A, and a guard on the threshold rather than on the code.

    Track 42's eighteen published illustrations are all a seated figure at a table, confirmed
    by a human looking at them. A floor nudged upward until some future Track passes would
    quietly start passing this set too, and nothing else in the suite would notice.
    """
    paths = sorted((FIXTURES / "collapsed-track").glob("*.png"))
    assert len(paths) == 18, "the fixture is missing"

    report = check_variety([path.read_bytes() for path in paths])

    assert report.collapsed is True, report.summary()
    assert report.median_nearest < 0.55, (
        f"Track 42 measured 0.502 when this was written and now measures "
        f"{report.median_nearest:.3f}. Either the signature changed or the fixture did."
    )


def test_the_committed_anchor_set_is_not_called_collapsed() -> None:
    """The other side of the same threshold.

    Six pictures a human chose as six different pictures — and five of them are seated
    interiors, so this is the *hardest* varied set to get right. A floor dragged downward to
    make something pass would eventually swallow the distinction this check exists to make.
    """
    paths = sorted(Path("assets/anchors").glob("*.png"))
    assert paths, "the anchor set is missing"

    report = check_variety([path.read_bytes() for path in paths])

    assert report.passed is True, report.summary()


# ------------------------------------------------------------------------ the mechanics


def test_a_signature_ignores_overall_brightness() -> None:
    """The z-score earns its place: every image in this library is dark by contract, and a
    check that scored darkness would call the house style a failure."""
    base = render_scene(setting(0, "the stockroom of a hardware shop"))
    with Image.open(io.BytesIO(base)) as image:
        darker = image.point(lambda value: int(value * 0.55))
    buffer = io.BytesIO()
    darker.save(buffer, format="PNG")

    distance = signature_distance(
        composition_signature(base), composition_signature(buffer.getvalue())
    )

    assert distance < NEAR_DUPLICATE_DISTANCE, "the same room dimmed is the same composition"


def test_a_flat_image_has_no_composition_to_compare() -> None:
    """A blank render is a failure upstream, and it must not read as maximally varied."""
    buffer = io.BytesIO()
    Image.new("RGB", (320, 240), _GROUND).save(buffer, format="PNG")
    blank = buffer.getvalue()

    assert check_variety([blank] * 4).collapsed is True


def test_fewer_than_two_images_is_not_a_failure() -> None:
    """There is nothing for a single image to have collapsed into."""
    one = render_scene(setting(0, "a stairwell between two floors"))

    assert check_variety([one]).passed is True
    assert check_variety([]).passed is True
