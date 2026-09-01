"""Rebalancing scenario distractors so the correct option is not identifiable by length.

WP20 regenerated Track 42 with WP19's substantive-distractor prompt in place and measured
the correct option as strictly the longest in **11 of 18 Leaves** — down from 15 of 18, but
still above `MAX_LONGEST_CORRECT_RATIO`. The instruction is already in `draft_leaf.md`
("The correct option should not be the longest"); the model complies about a third of the
time it matters.

That is not a missing instruction, so repeating it louder is not the fix. The cause is
structural: the correct answer expresses the Leaf's actual concept, which is usually more
nuanced than "do the obvious conventional thing", and nuance costs words. A general
instruction is fighting the semantics of the task on every Leaf, including the ones where
it does not matter.

**So this repairs, rather than regenerates.** For a Leaf that shows the tell it rewrites
only the two wrong options, at a measured length target, leaving everything else exactly as
it was. Three reasons that is the right shape:

- **It cannot touch grounded text.** Distractors carry no citations — they are the options a
  reader must rule out, not claims about the book. Rewriting them cannot invalidate a
  `ground_check` verdict, which regenerating the Leaf would.
- **It preserves the editorial review already done.** A full re-run throws away the review
  and revision spend on all eighteen Leaves to fix eleven.
- **It leaves passing Leaves alone.** Re-rolling a Leaf that already balances is a chance to
  break it.

The correct option's text is never sent back as something to change, and is asserted
unchanged on return — see `rebalance_options`.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.llm.client import StructuredClient
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import GeneratedLeaf, ScenarioOptionDraft
from zoomout_pipeline.prompts import render_prompt

_log = get_logger(__name__)

# How close a rewritten distractor has to be to the correct option, in characters.
#
# Not zero: three options of identical length is itself a pattern, and forcing it would
# make the model pad. The measured problem was a median winning margin of 20 characters
# with outliers past 50, so a tolerance comfortably under that removes the signal without
# demanding the model count to an exact figure it cannot see.
LENGTH_TOLERANCE_CHARS = 15


class RebalancedDistractors(BaseModel):
    """The two replacement wrong options."""

    first: str = Field(min_length=1)
    second: str = Field(min_length=1)


def correct_is_longest(leaf: GeneratedLeaf) -> bool:
    """Whether this Leaf shows the tell. Mirrors `answer_length_check`'s own rule.

    Deliberately a separate, tiny function rather than an import: that module measures a
    Track to decide whether to warn, and this one picks Leaves to repair. Sharing the
    private helper would couple a diagnostic to a mutation, and the day the check's
    threshold logic changes is the day this would silently start repairing the wrong set.
    """
    options = leaf.scenario_options
    correct = [index for index, option in enumerate(options) if option.is_correct]
    if not correct:
        return False
    index = correct[0]
    others = [len(option.text) for position, option in enumerate(options) if position != index]
    return bool(others) and len(options[index].text) > max(others)


def rebalance_options(
    *, llm: StructuredClient, leaf: GeneratedLeaf, concept: str, model: str
) -> tuple[GeneratedLeaf | None, TokenSpend]:
    """Rewrite the two wrong options at comparable length. Returns None if it did not help.

    **Returns the Leaf unchanged rather than a worse one.** The model is asked for a length
    it cannot measure precisely, so it sometimes misses; accepting a result that still shows
    the tell would spend money to move the problem rather than fix it, and — worse — would
    report success. The caller sees `None` and the Leaf keeps its original options.

    The correct option is passed for register only and is reassembled from the original
    object, not from anything the model returned, so there is no path by which a rewrite can
    edit the answer it was shown.
    """
    options = leaf.scenario_options
    correct_index = next((index for index, option in enumerate(options) if option.is_correct), None)
    if correct_index is None:
        return None, TokenSpend(node="balance_distractors", model=model)

    correct = options[correct_index]
    wrong = [option for index, option in enumerate(options) if index != correct_index]
    if len(wrong) != 2:
        return None, TokenSpend(node="balance_distractors", model=model)

    target = len(correct.text)
    result = llm.generate_structured(
        prompt=render_prompt(
            "balance_distractors",
            concept=concept,
            scenario_prompt=leaf.scenario_prompt,
            correct_option=correct.text,
            wrong_option_one=wrong[0].text,
            wrong_option_two=wrong[1].text,
            tolerance=LENGTH_TOLERANCE_CHARS,
            correct_length=target,
            target_low=max(1, target - LENGTH_TOLERANCE_CHARS),
            target_high=target + LENGTH_TOLERANCE_CHARS,
        ),
        schema=RebalancedDistractors,
        model=model,
        node="balance_distractors",
    )

    replacements = [result.value.first.strip(), result.value.second.strip()]

    # Rebuilt in the original positions, so the shuffle WP17 applied is preserved. Putting
    # the correct option back at a fixed index would undo it and reintroduce a position
    # tell while fixing a length one.
    rebuilt: list[ScenarioOptionDraft] = []
    spare = iter(replacements)
    for index, option in enumerate(options):
        if index == correct_index:
            rebuilt.append(option)
        else:
            rebuilt.append(ScenarioOptionDraft(text=next(spare), is_correct=False))

    candidate = leaf.model_copy(update={"scenario_options": rebuilt})

    if correct_is_longest(candidate):
        _log.info(
            "balance_distractors.rejected",
            reason="the correct option is still the longest",
            correct=target,
            rewritten=[len(text) for text in replacements],
        )
        return None, result.spend

    return candidate, result.spend


__all__ = [
    "LENGTH_TOLERANCE_CHARS",
    "RebalancedDistractors",
    "correct_is_longest",
    "rebalance_options",
]
