"""The output-side style guard.

**Three kinds of evidence live in this file and they are not interchangeable.**

*Tests* (the normal gate) use a scripted client. They prove the wiring: that an image is
actually sent, that a breach fails the verdict, that the amber check is folded in, that the
retry is bounded. They prove nothing about whether a vision model can see a bloom.

*The guard's own evidence* is the `live` suite at the bottom, which runs the real model
against committed fixtures of real breaches — Track 42's published Leaf 1, which renders
"$10K", and Ikigai's Leaf 3, which blooms. **A guard that has never gone red against a real
breach is not evidence**, and a scripted client asserting that a scripted finding fails is a
test of `if`. Excluded from the gate by the `live` marker because it costs money and is not
deterministic.

*A person looking* is the third, and it is in the completion report rather than here. Of the
nineteen images measured in WP31 the guard found four real breaches, one of which the human
eye had already passed by mistake, and produced one false positive on flat hard-edged ground
shapes it read as a soft beam. No test in this file says that; only the looking does.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from zoomout_pipeline.assets.style_guard import (
    GuardResult,
    StyleBreach,
    StyleFinding,
    StyleReport,
    check_style,
)
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph.asset_nodes import MAX_GUARD_ATTEMPTS, generate_candidates

from .conftest import ScriptedLLM

FIXTURES = Path(__file__).parent / "fixtures" / "style-breaches"

# The two committed breaches, and the two that must stay clean. `leaf-08` is the
# load-bearing negative: its auditorium is cast light drawn as a hard-edged polygon, which
# the ruling makes legal, so a guard that flags it has misread the rule as "no bright areas".
TEXT_AND_GLOW = FIXTURES / "track42-leaf-01-text-glow.png"
GLOW_AND_ICONS = FIXTURES / "ikigai-leaf-03-glow-icons.png"
HARD_CAST_LIGHT = FIXTURES / "ikigai-leaf-08-hard-cast-light.png"
CLEAN = FIXTURES / "ikigai-leaf-16-clean.png"


def _report(*findings: StyleFinding) -> StyleReport:
    return StyleReport(findings=list(findings))


def _finding(breach: StyleBreach = StyleBreach.GLOW, quote: str | None = None) -> StyleFinding:
    return StyleFinding(breach=breach, what="a bloom around the phone screen", quote=quote)


# ------------------------------------------------------------------ the corpus is committed


def test_every_fixture_the_guard_is_judged_on_is_committed() -> None:
    """These are the package's evidence, and evidence that lives in a temp directory is gone.

    WP30's before/after comparison was its single most important artefact and no longer
    exists. `collapsed-track` is the precedent: the images a check is calibrated against are
    part of the repository, not part of somebody's afternoon.
    """
    for path in (TEXT_AND_GLOW, GLOW_AND_ICONS, HARD_CAST_LIGHT, CLEAN):
        assert path.exists(), path
        assert path.stat().st_size > 10_000


# ----------------------------------------------------------------------------- the wiring


def test_the_image_is_actually_sent_to_the_model() -> None:
    """A guard that reads no pixels would pass everything, silently and forever."""
    data = CLEAN.read_bytes()
    llm = ScriptedLLM([_report()])

    check_style(llm=llm, data=data, model="m")

    call = llm.calls[0]
    assert call["node"] == "style_guard"
    assert call["images"] == [data]


def test_a_finding_fails_the_verdict() -> None:
    result = check_style(llm=ScriptedLLM([_report(_finding())]), data=CLEAN.read_bytes(), model="m")

    assert result.passed is False
    assert result.findings[0].breach is StyleBreach.GLOW


def test_no_findings_passes() -> None:
    result = check_style(llm=ScriptedLLM([_report()]), data=CLEAN.read_bytes(), model="m")

    assert result.passed is True
    assert "clean" in result.summary()


def test_the_text_a_breach_reads_survives_into_the_summary() -> None:
    """The quote is how a person checks the guard rather than believing it."""
    result = check_style(
        llm=ScriptedLLM([_report(_finding(StyleBreach.TEXT, quote="$10K"))]),
        data=CLEAN.read_bytes(),
        model="m",
    )

    assert '"$10K"' in result.summary()


def test_reserved_amber_is_folded_into_the_same_verdict() -> None:
    """Mechanical, free, already written — and a caller that had to remember to run it
    separately is a caller that will forget."""
    result = check_style(llm=ScriptedLLM([_report()]), data=CLEAN.read_bytes(), model="m")

    assert result.amber.passed is True
    assert result.passed is True


# ------------------------------------------------------- the guard gates what gets kept


class _StubImage:
    def __init__(self, data: bytes) -> None:
        self.data = data


class _CountingImageClient:
    """Returns a different PNG each call, so "did it redraw" is answerable."""

    def __init__(self, source: Path) -> None:
        self._data = source.read_bytes()
        self.calls = 0

    def generate(self, **_: object) -> tuple[_StubImage, TokenSpend]:
        self.calls += 1
        return (
            _StubImage(self._data + bytes([self.calls])),
            TokenSpend(node="assets", model="m", input_tokens=1, output_tokens=1),
        )


def _passing(_data: bytes) -> GuardResult:
    from zoomout_pipeline.assets.guardrails import check_reward_amber

    return GuardResult(
        report=_report(),
        amber=check_reward_amber(CLEAN.read_bytes()),
        spend=TokenSpend(node="style_guard", model="m"),
    )


def _refusing(_data: bytes) -> GuardResult:
    from zoomout_pipeline.assets.guardrails import check_reward_amber

    return GuardResult(
        report=_report(_finding()),
        amber=check_reward_amber(CLEAN.read_bytes()),
        spend=TokenSpend(node="style_guard", model="m"),
    )


def _candidates(guard: object, budget_images: int = 10) -> tuple[list[tuple[bytes, str]], int]:
    from zoomout_pipeline.assets.budget import ImageBudget
    from zoomout_pipeline.assets.images import AnchorSet
    from zoomout_pipeline.models import SceneSetting

    from .test_scene_settings import a_record

    client = _CountingImageClient(CLEAN)
    setting = SceneSetting.model_validate(
        {
            "order": 0,
            "place": "a tatami room opening onto a bamboo garden",
            "vantage": "interior",
            "light": "dawn",
            "shot": "wide",
            "figures": 0,
            "focus": "a folded cloth on the mat",
        }
    )
    result = generate_candidates(
        client=client,  # type: ignore[arg-type]
        record=a_record(0, "Anything."),
        setting=setting,
        anchors=AnchorSet(images=[b"anchor"], instruction="x"),
        model="m",
        count=1,
        budget=ImageBudget(max_images=budget_images, model="m"),
        guard=guard,  # type: ignore[arg-type]
    )
    return result, client.calls


def test_a_passing_candidate_is_not_redrawn() -> None:
    candidates, calls = _candidates(_passing)

    assert len(candidates) == 1
    assert calls == 1, "a clean image must not cost a second generation"


def test_a_refused_candidate_is_redrawn_up_to_the_cap() -> None:
    """Bounded like every cycle here (R7), and small because each attempt is a fresh $0.134."""
    candidates, calls = _candidates(_refusing)

    assert calls == MAX_GUARD_ATTEMPTS
    assert len(candidates) == 1, "a Leaf with no picture is worse than a Leaf with a flawed one"


def test_the_guard_can_be_switched_off_and_then_nothing_is_rechecked() -> None:
    """The mutation check. With the detector removed the refusal path cannot fire, so a
    suite that still passed here would be testing nothing."""
    candidates, calls = _candidates(None)

    assert calls == 1 and len(candidates) == 1


# ---------------------------------------------------------------------------------- live


@pytest.mark.live
@pytest.mark.parametrize(
    ("fixture", "expect_clean", "expect"),
    [
        (TEXT_AND_GLOW, False, {StyleBreach.TEXT, StyleBreach.GLOW}),
        (GLOW_AND_ICONS, False, {StyleBreach.GLOW, StyleBreach.FLOATING_ICON}),
        (HARD_CAST_LIGHT, True, set()),
        (CLEAN, True, set()),
    ],
    ids=["track42-leaf-01", "ikigai-leaf-03", "hard-cast-light", "clean"],
)
def test_the_real_model_against_the_real_breaches(
    fixture: Path, expect_clean: bool, expect: set[StyleBreach]
) -> None:
    """The only evidence that the guard works. Costs about $0.004 per image.

    `hard-cast-light` is the case that makes the others mean something: it is a bright,
    obviously-lit auditorium whose light is a hard-edged polygon, and the ruling makes it
    legal. A guard that flags it has learned "no bright areas" rather than "no falloff".
    """
    from zoomout_pipeline.config import get_settings
    from zoomout_pipeline.llm.client import GeminiClient

    settings = get_settings()
    result = check_style(
        llm=GeminiClient.from_settings(settings),
        data=fixture.read_bytes(),
        model=settings.analyze_model,
    )

    assert result.passed is expect_clean, result.summary()
    assert expect <= {finding.breach for finding in result.findings}, result.summary()
