"""Tier A — the image budget halts, and diagrams are validated before upload."""

from __future__ import annotations

import pytest

from zoomout_pipeline.assets.budget import BudgetExceededError, ImageBudget
from zoomout_pipeline.assets.diagrams import (
    MAX_LABEL_CHARS,
    MAX_NODES,
    DiagramKind,
    DiagramNode,
    DiagramSpec,
    render,
)


def test_the_budget_halts_the_run_rather_than_warning() -> None:
    """Tier A. N candidates times eighteen Leaves times retries is how a credit disappears.

    A warning attached to a run nobody is watching is indistinguishable from no budget.
    """
    budget = ImageBudget(max_images=2)

    budget.charge(leaf_order=0)
    budget.charge(leaf_order=0)

    with pytest.raises(BudgetExceededError) as error:
        budget.charge(leaf_order=1)

    assert "budget" in str(error.value)
    assert budget.spent == 2, "a refused charge must not be counted"


def test_the_budget_refuses_a_batch_that_would_cross_the_cap() -> None:
    """Charged before the call, so the cap is a limit rather than a report."""
    budget = ImageBudget(max_images=5)
    budget.charge(leaf_order=0, count=4)

    with pytest.raises(BudgetExceededError):
        budget.charge(leaf_order=1, count=3)

    assert budget.spent == 4


def test_the_budget_tracks_spend_per_leaf() -> None:
    budget = ImageBudget(max_images=10)
    budget.charge(leaf_order=0, count=3)
    budget.charge(leaf_order=1, count=2)

    assert budget.per_leaf == {0: 3, 1: 2}
    assert budget.spent == 5
    assert budget.usd == pytest.approx(5 * 0.039)


def test_a_spec_with_too_many_nodes_cannot_be_described() -> None:
    """Legibility is enforced by the schema, so an unreadable diagram is unrepresentable
    rather than merely discouraged. WP9 learned this at thumbnail size."""
    with pytest.raises(ValueError, match="at most"):
        DiagramSpec(
            kind=DiagramKind.FLOW,
            nodes=[DiagramNode(label=f"Step {i}") for i in range(MAX_NODES + 1)],
        )


def test_a_label_too_long_to_read_is_rejected() -> None:
    with pytest.raises(ValueError, match="at most"):
        DiagramSpec(
            kind=DiagramKind.FLOW,
            nodes=[DiagramNode(label="x" * (MAX_LABEL_CHARS + 1)), DiagramNode(label="ok")],
        )


@pytest.mark.parametrize("kind", list(DiagramKind))
def test_every_kind_renders_to_a_real_png(kind: DiagramKind) -> None:
    """Validated before upload: a spec that fails to render is a broken slide, and WP11
    already found a cover URL pointing at a web page."""
    spec = DiagramSpec(
        kind=kind,
        left_heading="One",
        right_heading="Other",
        nodes=[DiagramNode(label=f"Node {i}") for i in range(3)],
    )

    data = render(spec)

    assert data[:8] == b"\x89PNG\r\n\x1a\n", "must be a real PNG, not bytes that merely exist"
    assert len(data) > 5_000


def test_alt_text_is_derived_from_the_spec_not_from_the_picture() -> None:
    """We drew it, so we know what is in it. A structural description cannot hallucinate,
    which is strictly better than asking a model to describe its own output."""
    spec = DiagramSpec(
        kind=DiagramKind.FLOW,
        nodes=[DiagramNode(label="Notice it"), DiagramNode(label="Choose otherwise")],
    )

    alt = spec.alt_text()

    assert "Notice it" in alt and "Choose otherwise" in alt
    assert alt.startswith("A flow diagram")


# ------------------------------------------------------------------- guardrails


def _solid_png(colour: tuple[int, int, int], size: int = 64) -> bytes:
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (size, size), colour).save(buffer, format="PNG")
    return buffer.getvalue()


def test_an_image_full_of_reward_amber_is_flagged() -> None:
    """§3 reserves amber for XP, streaks and achievements. An illustration using it steals
    the signal from the unlock — a product consequence, not a matter of taste."""
    from zoomout_pipeline.assets.guardrails import REWARD_AMBER, check_reward_amber

    result = check_reward_amber(_solid_png(REWARD_AMBER))

    assert result.passed is False
    assert result.fraction > 0.9


def test_an_on_palette_image_passes() -> None:
    from zoomout_pipeline.assets.guardrails import check_reward_amber

    result = check_reward_amber(_solid_png((0x0B, 0x0F, 0x12)))  # surface/0

    assert result.passed is True
    assert result.fraction == 0.0


def test_warm_neutrals_are_not_mistaken_for_reward_amber() -> None:
    """The contract allows muted warm neutrals for skin and wood. A tolerance wide enough to
    catch those would flag most of the anchor set."""
    from zoomout_pipeline.assets.guardrails import check_reward_amber

    for warm in ((0xC8, 0xA0, 0x78), (0x8B, 0x6B, 0x4A), (0xD9, 0xB8, 0x8C)):
        assert check_reward_amber(_solid_png(warm)).passed is True, warm


def test_the_committed_anchor_set_is_free_of_reward_amber() -> None:
    """Run against the real anchors, because they are what every image inherits.

    If amber ever enters the anchor set it propagates to the whole library, so this is the
    one place the check earns its keep most.
    """
    from pathlib import Path

    from zoomout_pipeline.assets.guardrails import check_reward_amber

    anchors = sorted(Path("assets/anchors").glob("*.png"))
    assert anchors, "the anchor set is missing — every image would be unconditioned"

    for path in anchors:
        result = check_reward_amber(path.read_bytes())
        assert result.passed, f"{path.name} contains reserved amber: {result.summary}"
