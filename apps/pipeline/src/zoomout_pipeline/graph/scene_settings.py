"""Deciding where each Leaf's illustration happens, before any image is bought.

**The whole Track at once, in one call, and that is the mechanism rather than an optimisation.**

Track 42's eighteen scenario images are eighteen seated figures at a table in a dim interior —
including a scenario about buying a family home, drawn as a man alone at a desk with a
calculator. Each image was generated from a prompt that named no setting, so each call
defaulted independently, and an image model's default is the room its style anchors show.

A prompt asking each call to "vary the setting" would not have helped: no single call can see
the other seventeen, so "vary" has nothing to vary from. **A model shown every scenario
together and required to return distinct places cannot collapse them without failing to
parse** — which is the difference between an instruction and a check.

What comes out is a generation artifact. It is checkpointed into the run and logged, and it
reaches neither `packages/shared/src/content.ts` nor Payload: a Leaf stores the picture, not
the reasoning behind it.
"""

from __future__ import annotations

from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.llm.client import LLMSchemaError, StructuredClient
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import GeneratedLeafRecord, ScenePlan
from zoomout_pipeline.prompts import render_prompt

_log = get_logger(__name__)

# Bounded, like every other cycle in this service (R7). Three attempts is enough for a model
# to recover from "these places are all a desk" told plainly; a fourth has never been the
# difference, and this loop sits in front of the only node that spends money per Leaf.
MAX_SCENE_ATTEMPTS = 3


class SceneDerivationError(RuntimeError):
    """The model could not produce a usable scene plan within the attempt cap.

    Deliberately fatal to the asset run rather than a warning. Falling back to "no setting"
    is exactly the state that produced eighteen identical pictures, and it would do it
    silently, after the images were paid for.
    """


def scenario_block(records: list[GeneratedLeafRecord]) -> str:
    """Every scenario in the Track, in order, as the model sees them.

    The concept is included alongside the scenario prose because a setting should serve what
    the Leaf teaches, not only where its story happens to open.
    """
    parts: list[str] = []
    for record in sorted(records, key=lambda item: item.order):
        parts.append(
            f"## Leaf {record.order} — {record.title}\n\n{record.leaf.scenario_prompt.strip()}"
        )
    return "\n\n".join(parts)


def _coverage_error(plan: ScenePlan, expected: set[int]) -> str | None:
    """Whether the plan answers exactly the Leaves it was asked about."""
    got = {setting.order for setting in plan.settings}
    missing, extra = sorted(expected - got), sorted(got - expected)
    if not missing and not extra:
        return None
    problems = []
    if missing:
        problems.append(f"no setting for Leaves {missing}")
    if extra:
        problems.append(f"settings for Leaves that do not exist: {extra}")
    return "; ".join(problems) + ". Return exactly one setting per Leaf, using the given orders."


def derive_scene_plan(
    *,
    llm: StructuredClient,
    records: list[GeneratedLeafRecord],
    model: str,
    max_attempts: int = MAX_SCENE_ATTEMPTS,
) -> tuple[ScenePlan, list[TokenSpend]]:
    """One setting per Leaf, or an error. Never a partial plan and never a default.

    Retries with the validation failure quoted back, because a model handed the same prompt
    again usually returns the same answer — the same reasoning `breakdown_retry` already uses.
    """
    if not records:
        raise SceneDerivationError("a scene plan needs at least one Leaf")

    expected = {record.order for record in records}
    scenarios = scenario_block(records)
    spends: list[TokenSpend] = []
    feedback = ""

    for attempt in range(1, max_attempts + 1):
        prompt = render_prompt("scene_setting", scenarios=scenarios, feedback=feedback)
        try:
            result = llm.generate_structured(
                prompt=prompt, schema=ScenePlan, model=model, node="scene_settings"
            )
        except LLMSchemaError as error:
            # **Only a shape failure is retried here.** It carries the Pydantic message naming
            # which places repeated, which is precisely what the next attempt needs to be told.
            #
            # Everything else — a 403, an exhausted quota, a model that does not exist —
            # propagates untouched. Retrying those spends the attempt budget on a request that
            # cannot succeed and then blames the model's output for a credentials problem,
            # which is exactly what this loop did the first time it met a permission error.
            reason = str(error)
            _log.warning(
                "scene.rejected", attempt=attempt, leaves=len(records), reason=reason[:300]
            )
            feedback = _feedback_block(reason)
            continue

        spends.append(result.spend)
        gap = _coverage_error(result.value, expected)
        if gap is not None:
            _log.warning("scene.incomplete", attempt=attempt, reason=gap)
            feedback = _feedback_block(gap)
            continue

        plan = result.value
        _log.info(
            "scene.derived",
            attempt=attempt,
            leaves=len(plan.settings),
            places=[setting.place for setting in plan.settings],
            exteriors=sum(1 for s in plan.settings if s.vantage == "exterior"),
            shots=sorted({s.shot.value for s in plan.settings}),
            lights=sorted({s.light.value for s in plan.settings}),
            unpeopled=sum(1 for s in plan.settings if s.figures == 0),
        )
        return plan, spends

    raise SceneDerivationError(
        f"no usable scene plan after {max_attempts} attempts. The run stops here rather than "
        "generating images with no setting — that is what produced Track 42."
    )


def _feedback_block(reason: str) -> str:
    return (
        "## Your previous answer was rejected\n\n"
        f"{reason}\n\n"
        "Fix exactly that and return the whole plan again."
    )


__all__ = [
    "MAX_SCENE_ATTEMPTS",
    "SceneDerivationError",
    "derive_scene_plan",
    "scenario_block",
]
