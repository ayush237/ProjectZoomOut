"""Tier A — the repair must never edit the answer, and never report a fix it did not make.

WP20 regenerated Track 42 and still measured the correct option as strictly longest in 11 of
18 Leaves. This is the repair for that: it rewrites the two wrong options of a Leaf that
shows the tell, and nothing else.

Two properties carry the risk. It must not touch the correct option — a rewrite that edited
the answer would silently change what the Leaf teaches, and grounding has already passed on
that text. And it must refuse a rewrite that did not work, because the model is asked for a
length it cannot count precisely; accepting a still-longest result would spend money to
report a fix that had not happened.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph.distractors import (
    RebalancedDistractors,
    correct_is_longest,
    rebalance_options,
)
from zoomout_pipeline.llm.client import GenerationResult
from zoomout_pipeline.models import GeneratedLeaf, ScenarioOptionDraft

CORRECT = "Develop a unique roast profile and a workshop that teaches customers to brew at home."


@dataclass
class _StubLLM:
    """Returns scripted replacements and records what it was shown."""

    first: str
    second: str
    prompts: list[str]

    def generate_structured(
        self, *, prompt: str, schema: type[Any], model: str, node: str, **_: object
    ) -> GenerationResult[Any]:
        self.prompts.append(prompt)
        return GenerationResult(
            value=RebalancedDistractors(first=self.first, second=self.second),
            spend=TokenSpend(node=node, model=model, input_tokens=400, output_tokens=90),
        )


def _leaf(
    *, correct: str = CORRECT, wrong: tuple[str, str] = ("Cut prices.", "Advertise.")
) -> GeneratedLeaf:
    """A Leaf whose correct option is deliberately the longest of the three."""
    return GeneratedLeaf(
        summary_body="Summary.",
        scenario_prompt="A rival cafe opens across the street.",
        scenario_options=[
            ScenarioOptionDraft(text=wrong[0], is_correct=False),
            ScenarioOptionDraft(text=correct, is_correct=True),
            ScenarioOptionDraft(text=wrong[1], is_correct=False),
        ],
        payoff_body="Payoff.",
        sticky_notes=["One", "Two"],
        takeaway_body="Takeaway.",
    )


def _balanced(text: str) -> str:
    """A replacement that clears the tell: at least as long as `CORRECT`, within tolerance.

    Three characters longer, deliberately. A replacement *shorter* than the correct option
    leaves it strictly longest, which `rebalance_options` refuses — the first draft of this
    helper did exactly that and the refusal path caught it.
    """
    size = len(CORRECT) + 3
    return text.ljust(size, ".")[:size]


def test_the_correct_option_is_never_edited() -> None:
    """The property that carries the most risk.

    Grounding has already passed on the correct option's text, and it is what the Leaf
    actually teaches. A repair that rewrote it would change the lesson while reporting that
    it had only balanced some lengths.
    """
    leaf = _leaf()
    llm = _StubLLM(
        _balanced("Undercut the rival on price every week"),
        _balanced("Buy local advertising to defend your turf"),
        [],
    )

    result, _ = rebalance_options(llm=llm, leaf=leaf, concept="Create value", model="m")

    assert result is not None
    correct = [option for option in result.scenario_options if option.is_correct]
    assert len(correct) == 1, "exactly one correct option must survive"
    assert correct[0].text == CORRECT, "the correct option's text must be byte-identical"


def test_the_correct_option_keeps_its_position() -> None:
    """WP17's shuffle must survive. Rebuilding the list with the answer at a fixed index
    would fix a length tell by reintroducing a position one."""
    leaf = _leaf()
    llm = _StubLLM(
        _balanced("Undercut the rival on price every week"),
        _balanced("Buy local advertising to defend your turf"),
        [],
    )

    result, _ = rebalance_options(llm=llm, leaf=leaf, concept="Create value", model="m")

    assert result is not None
    assert [option.is_correct for option in result.scenario_options] == [False, True, False]


def test_a_rewrite_that_did_not_help_is_refused() -> None:
    """The model is asked for a length it cannot count. When it misses, the Leaf is left
    alone — accepting the result would spend money to report a fix that did not happen."""
    leaf = _leaf()
    llm = _StubLLM("Short.", "Also short.", [])

    result, spend = rebalance_options(llm=llm, leaf=leaf, concept="Create value", model="m")

    assert result is None, "a still-longest result must be refused, not returned"
    assert spend.total_tokens > 0, "the call happened and must still be charged"


def test_the_prompt_never_asks_for_the_correct_option_to_change() -> None:
    """Defence in depth. The reassembly already makes an edited answer impossible; this
    keeps the instruction that stops the model trying from being dropped silently."""
    leaf = _leaf()
    llm = _StubLLM(_balanced("Undercut the rival on price"), _balanced("Advertise harder"), [])

    rebalance_options(llm=llm, leaf=leaf, concept="Create value", model="m")

    prompt = llm.prompts[0]
    assert "DO NOT CHANGE THIS" in prompt
    assert CORRECT in prompt, "the answer is shown for register, so the voice can be matched"
    assert str(len(CORRECT)) in prompt, "the length target must be a measured number"


@pytest.mark.parametrize(
    ("lengths", "expected"),
    [
        ((10, 30, 10), True),  # correct strictly longest
        ((30, 30, 10), False),  # tied for longest is not a tell
        ((40, 30, 10), False),  # a wrong option is longest
    ],
)
def test_the_tell_is_detected_the_same_way_the_track_check_measures_it(
    lengths: tuple[int, int, int], expected: bool
) -> None:
    """Ties count as "not the longest", matching `answer_length_check`. A formatting bias
    makes the correct option unambiguously longest, not tied for it."""
    leaf = GeneratedLeaf(
        summary_body="s",
        scenario_prompt="p",
        scenario_options=[
            ScenarioOptionDraft(text="a" * lengths[0], is_correct=False),
            ScenarioOptionDraft(text="b" * lengths[1], is_correct=True),
            ScenarioOptionDraft(text="c" * lengths[2], is_correct=False),
        ],
        payoff_body="p",
        sticky_notes=["one", "two"],
        takeaway_body="t",
    )

    assert correct_is_longest(leaf) is expected
