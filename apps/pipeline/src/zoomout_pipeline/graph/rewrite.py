"""Rewriting one finished Leaf against findings a human wrote down.

**The editorial reviewer cannot find what this fixes, and that is why this exists.**
`EditorialFindingCategory` has four members — pedagogy, scenario plausibility, prose,
attribution — and none of them is "this reproduces the book's named framework". Ikigai's
Leaf 17 passed the structure check (which measures chapter mapping), passed grounding
(every rule it lifted was cited), and passed editorial review, while listing five of the
book's ten rules of ikigai in the book's own imperative phrasing. The gap is not that a
gate was wrong; it is that no gate was looking.

So the findings come from a person, in a file, and the rest of the path is the one
`review.py` already built: a targeted rewrite that is **discarded unless it still passes
grounding against the same passages the original cited**. A human deciding *what* is wrong
does not get to also decide that the fix may be ungrounded.

## What the mechanical half can and cannot tell you

`surviving_phrases` checks that specific strings a human named are gone from everything the
Leaf will show a reader. **That is a check on this rewrite, not a check for named
frameworks.** It cannot tell you the rewrite stopped reproducing the framework — only that
the phrasings someone listed are no longer present, which a model can satisfy by
paraphrasing the same list. Whether the idea was taught instead of the list reproduced is a
reading, and it stays a reading. A detector for this is a separate package and an open
question for Architect.

## Extras are rewritten here and are not in `review.py`

`revise` deliberately never touches `GeneratedExtras` — its prompt scopes changes to the
five slides. That is right for an editorial pass and wrong here: Leaf 17's Dinner Table
fact *was* one of the ten rules, so a rewrite that left extras alone would move the breach
out of the slides and leave it in the field `LEGAL.md` singles out as the one most likely
to be repeated aloud as fact. Regenerating them is opt-in per rewrite, and the combined
Leaf-plus-extras is re-grounded before either is accepted.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.db.retrieval import Passage, format_passages
from zoomout_pipeline.graph.grounding import check_grounding, normalise_for_quote_match
from zoomout_pipeline.graph.review import revise_leaf
from zoomout_pipeline.llm.client import StructuredClient
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import (
    EditorialFinding,
    EditorialReviewResult,
    GeneratedExtras,
    GeneratedLeafRecord,
)
from zoomout_pipeline.prompts import render_prompt

_log = get_logger(__name__)


class RewriteBriefError(ValueError):
    """The brief could not be read. Fatal — a rewrite with no findings is a coin toss."""


@dataclass(frozen=True)
class RewriteBrief:
    """What a human decided is wrong with one Leaf, and how the fix will be checked.

    Three parts, deliberately separate. `findings` drive the model. `forbidden_phrases` are
    checked afterwards by looking, with no model involved. `extras_instruction` is the one
    thing the `extra_content` prompt cannot know: what this particular Leaf must stop
    saying.
    """

    findings: tuple[EditorialFinding, ...]
    overall_note: str
    forbidden_phrases: tuple[str, ...] = ()
    extras_instruction: str = ""

    @property
    def review(self) -> EditorialReviewResult:
        """The brief in the shape `revise_leaf` already takes."""
        return EditorialReviewResult(findings=list(self.findings), overall_note=self.overall_note)


def load_brief(path: Path) -> RewriteBrief:
    """Read a brief from YAML, or fail loudly enough to fix the file.

    Pydantic validates the findings themselves — a bad `slide_key` or a missing
    `suggestion` is a parse error here rather than a silently weaker instruction later.
    """
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise RewriteBriefError(f"could not read {path}: {error}") from error

    if not isinstance(raw, dict):
        raise RewriteBriefError(f"{path} is not a mapping")

    findings_raw = raw.get("findings")
    if not isinstance(findings_raw, list) or not findings_raw:
        raise RewriteBriefError(
            f"{path} has no `findings`. A rewrite with nothing named is a regeneration, "
            "and `revise` will not know what to change."
        )

    try:
        findings = tuple(EditorialFinding.model_validate(item) for item in findings_raw)
    except Exception as error:  # pydantic's own message names the offending field
        raise RewriteBriefError(f"{path}: {error}") from error

    phrases = raw.get("forbidden_phrases") or []
    if not isinstance(phrases, list) or any(not isinstance(item, str) for item in phrases):
        raise RewriteBriefError(f"{path}: `forbidden_phrases` must be a list of strings")

    return RewriteBrief(
        findings=findings,
        overall_note=str(raw.get("overall_note") or "Rewritten from a human brief."),
        forbidden_phrases=tuple(phrase for phrase in phrases if phrase.strip()),
        extras_instruction=str(raw.get("extras_instruction") or "").strip(),
    )


def reader_facing_text(record: GeneratedLeafRecord) -> Iterator[tuple[str, str]]:
    """Every string this Leaf puts in front of a reader, with the field it sits in.

    **Citation notes and quotes are included**, because `cms/mapper.source_references`
    turns them into `sourceReferences` rows and those are part of the Leaf, not internal
    bookkeeping. A rewrite that cleans the five slides and leaves the framework restated in
    a reference note has moved the problem, not fixed it — which is exactly the shape of
    defect this package was handed.
    """
    leaf = record.leaf
    yield "summary", leaf.summary_body
    yield "scenario.prompt", leaf.scenario_prompt
    for index, option in enumerate(leaf.scenario_options):
        yield f"scenario.options[{index}]", option.text
    yield "payoff", leaf.payoff_body
    for index, note in enumerate(leaf.sticky_notes):
        yield f"stickyNotes[{index}]", note
    yield "takeaway", leaf.takeaway_body

    if record.extras.dinner_table_knowledge:
        yield "takeaway.dinnerTableKnowledge", record.extras.dinner_table_knowledge
    if record.extras.apply_in_life:
        yield "takeaway.applyInLife", record.extras.apply_in_life

    for claim in [*leaf.claims, *record.extras.claims]:
        for citation in claim.citations:
            yield f"sourceReferences[{claim.slide_key.value}].note", citation.note
            if citation.quote:
                yield f"sourceReferences[{claim.slide_key.value}].quote", citation.quote


def surviving_phrases(
    record: GeneratedLeafRecord, phrases: tuple[str, ...]
) -> tuple[tuple[str, str], ...]:
    """Which forbidden phrasings are still somewhere in this Leaf, and where.

    Matched under the same folding the grounding gate uses for quotes, so a curly
    apostrophe or a rewrapped line is not mistaken for a different sentence. Substring
    rather than whole-field: the failure being looked for is a phrase lifted *into* a
    sentence, not a field that equals one.
    """
    found: list[tuple[str, str]] = []
    for field_name, text in reader_facing_text(record):
        haystack = normalise_for_quote_match(text)
        for phrase in phrases:
            needle = normalise_for_quote_match(phrase)
            if needle and needle in haystack:
                found.append((field_name, phrase))
    return tuple(found)


def regenerate_extras(
    *,
    llm: StructuredClient,
    record: GeneratedLeafRecord,
    passages: list[Passage],
    model: str,
    instruction: str,
    concept: str,
) -> tuple[GeneratedExtras | None, TokenSpend]:
    """New Dinner Table Knowledge and apply-in-life for a Leaf whose takeaway just changed.

    Returns `None` — keeping what the Leaf already had — if the combined Leaf and new
    extras do not pass grounding. Same rule as `revise_leaf`, for the same reason: the
    worst case of a rewrite must be that nothing changes, never that something ungrounded
    takes the place of something grounded.

    The constraint is prepended rather than added to `extra_content.md`, following
    `draft_leaf`'s handling of grounding feedback. The prompt file describes what these two
    fields *are*, for every Leaf in the library; what one Leaf must stop saying is not that.
    """
    prompt = render_prompt(
        "extra_content",
        title=record.title,
        concept=concept,
        takeaway=record.leaf.takeaway_body,
        passages=format_passages(passages),
    )
    if instruction:
        prompt = (
            "# This Leaf is being rewritten, and these two fields with it\n\n"
            f"{instruction}\n\n"
            "Everything below still applies, including returning nothing for a field you "
            "cannot support.\n\n---\n\n" + prompt
        )

    result = llm.generate_structured(
        prompt=prompt, schema=GeneratedExtras, model=model, node="extra_content"
    )

    verdict = check_grounding(leaf=record.leaf, extras=result.value, passages=passages)
    if not verdict.passed:
        _log.warning(
            "rewrite.extras_rejected",
            leaf=record.order,
            reason="regenerated extras failed grounding; keeping the originals",
            failures=len(verdict.failures),
        )
        return None, result.spend

    _log.info(
        "rewrite.extras_accepted",
        leaf=record.order,
        has_dtk=result.value.dinner_table_knowledge is not None,
        has_apply=result.value.apply_in_life is not None,
    )
    return result.value, result.spend


@dataclass(frozen=True)
class RewriteOutcome:
    """What one rewrite produced, and what is still wrong with it."""

    record: GeneratedLeafRecord
    revised: bool
    extras_replaced: bool
    survivors: tuple[tuple[str, str], ...]
    spend: list[TokenSpend] = field(default_factory=list)

    @property
    def cleared(self) -> bool:
        """Whether every phrase the brief forbade is gone.

        **Not "the rewrite is good".** See this module's docstring: a paraphrase of the
        same list clears this and fails the actual requirement, and only a reader can tell
        the difference.
        """
        return not self.survivors

    @property
    def total_cost(self) -> RunCost:
        ledger = RunCost()
        for spend in self.spend:
            ledger.record(spend)
        return ledger


def rewrite_leaf(
    *,
    llm: StructuredClient,
    record: GeneratedLeafRecord,
    passages: list[Passage],
    brief: RewriteBrief,
    revise_model: str,
    extras_model: str,
    concept: str,
    with_extras: bool = True,
) -> RewriteOutcome:
    """One targeted rewrite of one Leaf, grounding-gated at every step.

    Bounded by construction: exactly one revise call and at most one extras call. There is
    no loop here on purpose — the escalation path for a rewrite that did not work is the
    human who wrote the brief, reading the result.
    """
    spends: list[TokenSpend] = []

    candidate, revise_spend = revise_leaf(
        llm=llm,
        record=record,
        review=brief.review,
        passages=passages,
        model=revise_model,
    )
    spends.append(revise_spend)

    current = record
    revised = candidate is not None
    if candidate is not None:
        current = current.model_copy(update={"leaf": candidate, "attempts": current.attempts + 1})

    extras_replaced = False
    if with_extras:
        extras, extras_spend = regenerate_extras(
            llm=llm,
            record=current,
            passages=passages,
            model=extras_model,
            instruction=brief.extras_instruction,
            concept=concept,
        )
        spends.append(extras_spend)
        if extras is not None:
            current = current.model_copy(update={"extras": extras})
            extras_replaced = True

    survivors = surviving_phrases(current, brief.forbidden_phrases)
    _log.info(
        "rewrite.complete",
        leaf=record.order,
        revised=revised,
        extras_replaced=extras_replaced,
        survivors=[f"{where}: {phrase}" for where, phrase in survivors],
    )
    return RewriteOutcome(
        record=current,
        revised=revised,
        extras_replaced=extras_replaced,
        survivors=survivors,
        spend=spends,
    )


def brief_summary(brief: RewriteBrief) -> dict[str, Any]:
    """What was asked for, for the run log and the completion report."""
    return {
        "findings": len(brief.findings),
        "slides": sorted({finding.slide_key.value for finding in brief.findings}),
        "forbidden_phrases": len(brief.forbidden_phrases),
        "regenerates_extras": bool(brief.extras_instruction),
    }


__all__ = [
    "RewriteBrief",
    "RewriteBriefError",
    "RewriteOutcome",
    "brief_summary",
    "load_brief",
    "reader_facing_text",
    "regenerate_extras",
    "rewrite_leaf",
    "surviving_phrases",
]
