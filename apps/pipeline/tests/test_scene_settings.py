"""Tier A — the scene plan refuses the collapse, and refuses it at parse rather than later.

All evidence here is a test. None of it shows that the *pictures* vary: that is not testable
and the proof is a human looking at a before/after, recorded in WP30's completion report. What
these pin is that a plan which would reproduce Track 42 cannot get out of the derivation, and
that the derivation fails loudly instead of quietly falling back to no setting at all — which
is the state that produced Track 42 in the first place.
"""

from __future__ import annotations

import re
from typing import Any, TypeVar

import pytest
from pydantic import BaseModel, ValidationError

from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph.asset_nodes import scenario_alt_text, scenario_image_prompt
from zoomout_pipeline.graph.scene_settings import (
    MAX_SCENE_ATTEMPTS,
    SceneDerivationError,
    derive_scene_plan,
    scenario_block,
)
from zoomout_pipeline.llm.client import GenerationResult, LLMError, LLMSchemaError
from zoomout_pipeline.models import (
    GeneratedExtras,
    GeneratedLeafRecord,
    SceneLight,
    ScenePlan,
    SceneSetting,
    SceneShot,
    SceneVantage,
)
from zoomout_pipeline.prompts import load_prompt

from .conftest import make_generated_leaf

T = TypeVar("T", bound=BaseModel)

_LIGHTS = list(SceneLight)
_SHOTS = list(SceneShot)


def a_setting(order: int, place: str, **overrides: Any) -> SceneSetting:
    """One valid setting, with the axes spread so a plan built from these passes."""
    fields: dict[str, Any] = {
        "order": order,
        "place": place,
        "vantage": SceneVantage.INTERIOR,
        "light": _LIGHTS[order % len(_LIGHTS)],
        "shot": _SHOTS[order % len(_SHOTS)],
        "figures": order % 3,
        "focus": f"the thing at {place}",
    }
    fields.update(overrides)
    return SceneSetting(**fields)


PLACES = [
    "the roasting room behind a small coffee shop",
    "a loading bay at the back of a print works",
    "the top deck of a night bus",
    "an allotment shed with the door open",
    "a hospital corridor outside a ward",
    "the stockroom of a hardware shop",
    "a stairwell between two floors",
    "a market stall before the shutters go up",
    "a launderette with one machine running",
    "the cab of a delivery van at a junction",
]


def a_plan(count: int = 10) -> ScenePlan:
    return ScenePlan(settings=[a_setting(i, PLACES[i]) for i in range(count)])


def a_record(order: int, scenario: str) -> GeneratedLeafRecord:
    leaf = make_generated_leaf()
    leaf.scenario_prompt = scenario
    return GeneratedLeafRecord(
        order=order, title=f"Leaf {order}", leaf=leaf, extras=GeneratedExtras()
    )


class FakeSceneLLM:
    """Fails the way the real client fails, then answers.

    `generate_structured` raises `LLMError` when a response does not satisfy the schema, and a
    plan that repeats a place does not satisfy it — so a rejection reaching `derive_scene_plan`
    is an exception carrying the Pydantic message, not a value it has to inspect. Modelling
    that exactly is what makes this fake worth having.
    """

    def __init__(self, failures: int, plan: ScenePlan | None = None) -> None:
        self.failures = failures
        self.plan = plan
        self.prompts: list[str] = []

    def generate_structured(
        self,
        *,
        prompt: str,
        schema: type[T],
        model: str,
        node: str,
        system_instruction: str | None = None,
    ) -> GenerationResult[T]:
        self.prompts.append(prompt)
        if self.failures > 0:
            self.failures -= 1
            raise LLMSchemaError(
                f"{node}: {model} returned JSON that is not a valid {schema.__name__}: "
                "Value error, These places are used more than once: ['desk dim room']"
            )
        assert self.plan is not None
        return GenerationResult(
            value=self.plan,  # type: ignore[arg-type]
            spend=TokenSpend(node=node, model=model, input_tokens=900, output_tokens=400),
        )


# ------------------------------------------------------------------ what a plan refuses


def test_a_bare_generic_place_is_refused() -> None:
    """Tier A. 'an office' is the answer a model gives when it has not read the scenario, and
    it is the answer that produced eighteen identical pictures."""
    for generic in ("an office", "a desk", "the room", "home", "a workspace"):
        with pytest.raises(ValidationError, match=r"no particular place|one word"):
            a_setting(0, generic)


def test_cosmetic_variety_is_refused() -> None:
    """**The rule that matters most**, because a distinctness rule alone invites exactly this:
    eight unique strings that are all a desk."""
    with pytest.raises(ValidationError, match="more than half"):
        ScenePlan(
            settings=[
                a_setting(index, f"a {adjective} desk by a window")
                for index, adjective in enumerate(
                    ["cluttered", "tidy", "standing", "wide", "narrow", "oak", "steel", "glass"]
                )
            ]
        )


def test_the_same_place_twice_is_refused() -> None:
    with pytest.raises(ValidationError, match="used more than once"):
        ScenePlan(
            settings=[
                a_setting(0, "a stairwell between two floors"),
                a_setting(1, "the stairwell between two floors"),
            ]
        )


def test_one_camera_distance_for_a_whole_track_is_refused() -> None:
    with pytest.raises(ValidationError, match="same camera distance"):
        ScenePlan(
            settings=[a_setting(index, PLACES[index], shot=SceneShot.MEDIUM) for index in range(8)]
        )


def test_one_time_of_day_for_a_whole_track_is_refused() -> None:
    with pytest.raises(ValidationError, match="one time of day"):
        ScenePlan(
            settings=[a_setting(index, PLACES[index], light=SceneLight.NIGHT) for index in range(8)]
        )


def test_a_short_track_is_not_held_to_the_axis_rules() -> None:
    """Below eight Leaves a handful may legitimately share a register, and a rule there is
    noise rather than a guard."""
    plan = ScenePlan(
        settings=[
            a_setting(index, PLACES[index], shot=SceneShot.MEDIUM, light=SceneLight.NIGHT)
            for index in range(3)
        ]
    )

    assert len(plan.settings) == 3


def test_a_plan_comes_back_in_leaf_order() -> None:
    plan = ScenePlan(settings=[a_setting(2, PLACES[2]), a_setting(0, PLACES[0])])

    assert [setting.order for setting in plan.settings] == [0, 2]
    assert plan.by_order()[2].place == PLACES[2]


# --------------------------------------------------------------------- the derivation


def test_a_rejected_plan_is_retried_with_the_reason_quoted_back() -> None:
    """A model handed the same prompt again returns the same answer. `breakdown_retry` already
    learned this; the scene plan gets the same treatment."""
    llm = FakeSceneLLM(failures=1, plan=a_plan())
    records = [a_record(index, f"Scenario {index}") for index in range(10)]

    plan, spends = derive_scene_plan(llm=llm, records=records, model="test-model")

    assert len(plan.settings) == 10
    assert len(llm.prompts) == 2, "it must have asked twice"
    assert "used more than once" in llm.prompts[1], "the second ask must carry the failure"
    assert "rejected" in llm.prompts[1]
    assert len(spends) == 1, "a failed call returns no spend to record"


def test_the_run_stops_rather_than_generating_with_no_setting() -> None:
    """**Tier A, and the whole point of the package.**

    Falling back to "no setting" when derivation fails would reproduce Track 42 exactly —
    silently, and after the images were paid for. The bound is R7's: cycles terminate, and this
    one terminates by stopping rather than by giving up on the constraint.
    """
    llm = FakeSceneLLM(failures=MAX_SCENE_ATTEMPTS)
    records = [a_record(index, f"Scenario {index}") for index in range(10)]

    with pytest.raises(SceneDerivationError, match="Track 42"):
        derive_scene_plan(llm=llm, records=records, model="test-model")

    assert len(llm.prompts) == MAX_SCENE_ATTEMPTS, "bounded, not unbounded"


def test_a_plan_that_skips_a_leaf_is_rejected() -> None:
    """Coverage is checked here rather than in the schema because the schema cannot know how
    many Leaves were asked about. A Leaf with no setting would otherwise reach the image model
    as a `KeyError` mid-run, after money had been spent on its neighbours."""
    llm = FakeSceneLLM(failures=0, plan=a_plan(count=9))
    records = [a_record(index, f"Scenario {index}") for index in range(10)]

    with pytest.raises(SceneDerivationError):
        derive_scene_plan(llm=llm, records=records, model="test-model", max_attempts=1)


def test_every_scenario_reaches_the_model_together() -> None:
    """The mechanism: a model that cannot see the other seventeen scenarios has nothing to
    vary from, which is why this is one call for the Track rather than one per Leaf."""
    records = [a_record(index, f"Scenario number {index}") for index in range(4)]

    block = scenario_block(records)

    for index in range(4):
        assert f"Scenario number {index}" in block
        assert f"Leaf {index}" in block


# ------------------------------------------------------------------------ the prompt


def test_the_image_prompt_names_the_place_and_keeps_the_style_contract() -> None:
    record = a_record(0, "You are deciding whether to take the promotion.")
    setting = a_setting(0, "an airport gate before the first flight of the day")

    prompt = scenario_image_prompt(record, setting)

    assert "an airport gate before the first flight of the day" in prompt
    assert "You are deciding whether to take the promotion." in prompt
    assert "#FFB020" in prompt, "the fixed half must still forbid reward amber"
    assert "No text, letters, numerals" in prompt
    assert "No identifiable person" in prompt
    assert "No book cover" in prompt


def test_the_fixed_half_names_no_setting_of_its_own() -> None:
    """**Two failures in one guard, and the second was found by this test.**

    The style contract used to end its subject section with a menu of five places headed by a
    desk, appended to every prompt in the run — that is the line WP30 removed.

    The subtler one: the first rewrite *explained* the removal by quoting the menu, which put
    the same five words back into every prompt inside an apology for them. **Telling an image
    model not to draw a desk mentions a desk**, and a model that has been primed four times in
    an aside draws one. So the history lives in `asset_nodes.py`'s docstring, which is never
    sent anywhere, and the model-facing files name no setting at all.

    Word boundaries, because "untranslatable" contains "table" and a substring check here
    would be a guard that fails for the wrong reason.
    """
    contract = load_prompt("asset_style") + load_prompt("anchor_instruction")

    assert "a desk, a commute, a kitchen table" not in contract
    for primed in ("desk", "desks", "table", "tables", "laptop", "office"):
        assert not re.search(rf"\b{primed}\b", contract, re.IGNORECASE), (
            f"the fixed half mentions {primed!r}, which is the thing it is trying to stop "
            "the model drawing"
        )


def test_an_unpeopled_scene_says_so_rather_than_asking_for_zero_people() -> None:
    prompt = scenario_image_prompt(
        a_record(0, "Anything."), a_setting(0, "an empty workshop", figures=0)
    )

    assert "Nobody is in frame" in prompt


def test_alt_text_describes_the_scene_rather_than_the_medium() -> None:
    """Both halves of the rule this project set for itself in WP18 and then broke: describe the
    scene not the medium, and do not restate the scenario a screen reader has just read out."""
    scenario = "You are deciding whether to take the promotion that costs your evenings."
    setting = a_setting(0, "an airport gate before the first flight of the day", figures=1)

    alt = scenario_alt_text(setting)

    assert not alt.startswith("An illustration")
    assert scenario not in alt
    assert "airport gate" in alt
    assert "One person is present" in alt


def test_alt_text_does_not_claim_a_person_who_is_not_there() -> None:
    alt = scenario_alt_text(a_setting(0, "an empty loading bay", figures=0))

    assert "No one is present" in alt


def test_a_permission_failure_is_not_retried_as_a_bad_answer() -> None:
    """**Found by meeting one.** A 403 is not a plan the model got wrong.

    Retrying it spends the whole attempt budget on a request that cannot succeed and then
    reports "no usable scene plan", which sends whoever reads it looking at prompts when the
    problem is credentials. The client already separates the two — this asserts the node
    respects the separation.
    """

    class Forbidden:
        def __init__(self) -> None:
            self.calls = 0

        def generate_structured(self, **kwargs: Any) -> GenerationResult[Any]:
            self.calls += 1
            raise LLMError("scene_settings: model call to m failed: 403 PERMISSION_DENIED")

    llm = Forbidden()
    records = [a_record(index, f"Scenario {index}") for index in range(10)]

    with pytest.raises(LLMError, match="403"):
        derive_scene_plan(llm=llm, records=records, model="test-model")

    assert llm.calls == 1, "a permission error must be raised on the first attempt, not retried"


def test_an_empty_frame_cannot_have_hands_in_it() -> None:
    """**Found by looking at the picture, not by a test.**

    The WP30 before/after asked for a wide, unpeopled shot of a house with the focus on "a
    brass key lying in the palm of an open hand". The model satisfied both instructions
    literally and drew an enormous disembodied hand across the foreground of an otherwise good
    illustration. The plan was contradictory; the image model was not wrong.
    """
    with pytest.raises(ValidationError, match="a person in the frame"):
        a_setting(
            0,
            "a gravel driveway in front of a Victorian house",
            figures=0,
            focus="a brass key lying in the palm of an open hand",
        )


def test_hands_are_fine_when_somebody_is_in_the_frame() -> None:
    """The rule is about the contradiction, not about hands."""
    setting = a_setting(
        0,
        "a carpentry workshop counter covered in sawdust",
        figures=1,
        focus="a hand measuring an oak plank with a brass square",
    )

    assert setting.figures == 1


# --- the sibling of the two tests above, which did not exist until it had already shipped


def test_a_focus_cannot_name_a_lighting_effect() -> None:
    """**Also found by looking at the picture, and the pair above is why it should not have
    had to be.**

    WP30 established that a contradiction in the plan is cheap to catch in text and expensive
    to catch in an image, then built the check for exactly one contradiction. This is the
    other one: `asset_style.md` forbids glow, light cones, beams, bloom and volumetric light
    absolutely, so a focus naming a beam asks for a picture the contract says cannot be drawn.

    Ikigai's Leaf 8 asked for "an unlit wooden lectern standing under a spotlight beam" and
    got two volumetric cones converging on a lectern. One of eighteen settings named a light
    effect, and it produced the only prohibition breach in the set.
    """
    with pytest.raises(ValidationError, match="lighting effect"):
        a_setting(
            0,
            "an empty theater auditorium facing a timber stage",
            figures=0,
            focus="an unlit wooden lectern standing under a spotlight beam",
        )


@pytest.mark.parametrize(
    "focus",
    [
        "a paper lantern hanging over the doorway",
        "a desk lamp switched off beside a closed notebook",
        "a candle burnt down to a stub on a saucer",
    ],
)
def test_a_lamp_is_a_thing_and_stays_allowed(focus: str) -> None:
    """The rule is about the light a thing throws, never about the thing.

    Getting this wrong in the other direction would forbid half the objects in an ordinary
    room, and the style contract's own sentence is "a lamp is a shape, and the room around it
    is a darker shape" — the lamp was never the problem.
    """
    setting = a_setting(0, "a tatami room opening onto a bamboo garden", figures=0, focus=focus)

    assert setting.focus == focus


def test_the_prompt_tells_the_model_both_rules_before_it_answers() -> None:
    """A validator the prompt never mentions is a retry loop with extra steps.

    Each rejected plan is a whole extra model call, and `derive_scene_plan` caps at three
    before it kills the asset run. Both contradictions are cheap to state and expensive to
    discover.
    """
    prompt = load_prompt("scene_setting")

    assert "spotlight" in prompt and "beam" in prompt
    assert "lighting effect" in prompt
    assert "nobody's hands are in the picture" in prompt
