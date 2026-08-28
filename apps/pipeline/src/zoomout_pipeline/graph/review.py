"""Editorial review and bounded revision.

**Advisory means advisory.** R3 exists so the legal gate cannot be argued down on quality
grounds; the converse holds too — an editorial reviewer that can veto becomes a second legal
gate nobody designed. Nothing here rejects a Leaf. `editorial_review` produces findings that
feed one bounded revision, and a Leaf proceeds to gate 2 with or without them addressed.

**Revision cannot spend down grounding to buy prose.** A rewrite is only accepted if it still
passes the grounding gate against the *same* passages the original cited — see
`revise_leaf`. If it does not, the revision is discarded and the original, already-grounded
Leaf stands. This is what makes the loop bounded *and* safe: the worst case of an editorial
pass is that nothing changes, never that something ungrounded ships in its place.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.db.retrieval import Passage, format_passages
from zoomout_pipeline.graph.grounding import check_grounding
from zoomout_pipeline.llm.client import StructuredClient
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import (
    EditorialReviewResult,
    GeneratedLeaf,
    GeneratedLeafRecord,
)
from zoomout_pipeline.prompts import render_prompt

_log = get_logger(__name__)

# R7's original figure, kept rather than WP16.1's raised one. WP16.1 raised the breakdown
# cap because the cost assumption behind R7's 2 no longer held on a Flash text call; that
# reasoning does not transfer here. Editorial review may run cross-family per R3, and Claude
# has no free tier anywhere (§4a) — so this loop can cost real money by construction, and R7's
# original bound on cost is the one that actually applies to it.
MAX_EDITORIAL_ATTEMPTS = 2


@dataclass(frozen=True)
class ReviewOutcome:
    """What one round of review-and-maybe-revise produced."""

    record: GeneratedLeafRecord
    review: EditorialReviewResult
    revised: bool
    spend: list[TokenSpend] = field(default_factory=list)

    @property
    def total_cost(self) -> RunCost:
        ledger = RunCost()
        for spend in self.spend:
            ledger.record(spend)
        return ledger


def _options_block(leaf: GeneratedLeaf) -> str:
    return "\n".join(
        f"{'[correct] ' if option.is_correct else '[wrong] '}{option.text}"
        for option in leaf.scenario_options
    )


def _existing_claims_block(leaf: GeneratedLeaf) -> str:
    """The Leaf's own claims, in a form the revise prompt can copy verbatim.

    This is what makes "keep the citation if the wording is unchanged" an instruction the
    model can actually follow, rather than one it can only approximate from memory. Without
    this, revision has to reconstruct every claim's quote from scratch even for slides it
    was not asked to touch — and re-typing a quote from memory is exactly how an exact span
    stops being exact. Found by running revision against two real Track 42 Leaves before
    this existed: their revisions failed grounding with 1 and 7 broken citations
    respectively, on slides the findings never even asked to change.
    """
    if not leaf.claims:
        return "(none)"
    lines = []
    for claim in leaf.claims:
        for citation in claim.citations:
            quoted_claim = f'"{claim.text}"'
            quote_part = f' quote="{citation.quote}"' if citation.quote else ""
            lines.append(
                f"- [{claim.slide_key.value}] {quoted_claim} "
                f"— cites {citation.passage_ref}, note: {citation.note}{quote_part}"
            )
    return "\n".join(lines)


def _findings_block(review: EditorialReviewResult) -> str:
    if not review.findings:
        return "(none)"
    return "\n\n".join(
        f"- **{finding.slide_key.value} / {finding.category.value}**: {finding.note}\n"
        f"  Suggested: {finding.suggestion}"
        for finding in review.findings
    )


def run_editorial_review(
    *, llm: StructuredClient, record: GeneratedLeafRecord, model: str
) -> tuple[EditorialReviewResult, TokenSpend]:
    """One editorial pass over a finished Leaf. Read-only — never mutates the record."""
    leaf = record.leaf
    prompt = render_prompt(
        "editorial_review",
        title=record.title,
        summary=leaf.summary_body,
        scenario_prompt=leaf.scenario_prompt,
        options=_options_block(leaf),
        payoff=leaf.payoff_body,
        sticky_notes="; ".join(leaf.sticky_notes),
        takeaway=leaf.takeaway_body,
        dinner_table_knowledge=record.extras.dinner_table_knowledge or "(none)",
        apply_in_life=record.extras.apply_in_life or "(none)",
    )
    result = llm.generate_structured(
        prompt=prompt, schema=EditorialReviewResult, model=model, node="editorial_review"
    )
    _log.info(
        "editorial_review.complete",
        leaf=record.order,
        findings=len(result.value.findings),
        categories=sorted({f.category.value for f in result.value.findings}),
        tokens=result.spend.total_tokens,
        usd=round(result.spend.usd, 4),
    )
    return result.value, result.spend


def revise_leaf(
    *,
    llm: StructuredClient,
    record: GeneratedLeafRecord,
    review: EditorialReviewResult,
    passages: list[Passage],
    model: str,
) -> tuple[GeneratedLeaf | None, TokenSpend]:
    """Attempt a targeted rewrite from editorial findings.

    Returns the revised Leaf **only if it still passes grounding** against the same
    passages the original cited. A revision that fails grounding is discarded — returns
    `None` — rather than replacing an already-safe Leaf with a risk.
    """
    prompt = render_prompt(
        "revise",
        title=record.title,
        summary=record.leaf.summary_body,
        scenario_prompt=record.leaf.scenario_prompt,
        options=_options_block(record.leaf),
        payoff=record.leaf.payoff_body,
        sticky_notes="; ".join(record.leaf.sticky_notes),
        takeaway=record.leaf.takeaway_body,
        findings=_findings_block(review),
        existing_claims=_existing_claims_block(record.leaf),
        passages=format_passages(passages),
    )
    result = llm.generate_structured(
        prompt=prompt, schema=GeneratedLeaf, model=model, node="revise"
    )

    # The revision must still be grounded. `extras` is untouched by revision (the prompt
    # scopes changes to the five slides), so its claims are re-checked unchanged alongside
    # the revised slide claims — a revision must not accidentally invalidate what extras
    # already established.
    verdict = check_grounding(leaf=result.value, extras=record.extras, passages=passages)
    if not verdict.passed:
        _log.warning(
            "revise.rejected",
            leaf=record.order,
            reason="revision failed grounding; keeping the original",
            failures=len(verdict.failures),
        )
        return None, result.spend

    _log.info("revise.accepted", leaf=record.order, tokens=result.spend.total_tokens)
    return result.value, result.spend


def review_and_revise(
    *,
    llm: StructuredClient,
    record: GeneratedLeafRecord,
    passages: list[Passage],
    review_model: str,
    revise_model: str,
    max_attempts: int = MAX_EDITORIAL_ATTEMPTS,
) -> ReviewOutcome:
    """Review, and revise up to the cap. Bounded, and never blocks.

    Every attempt, including the last, ends with a fresh review of whatever it produced —
    so a fix for one finding is checked rather than assumed to have worked, and what the
    outcome carries to gate 2 is always the actual state of the actual Leaf, never a guess
    about whether the last edit helped. The loop stops when a pass finds nothing, when a
    revision is rejected for failing grounding, or when the cap is reached — whichever
    comes first — and the Leaf proceeds either way.
    """
    current = record
    spends: list[TokenSpend] = []
    review, review_spend = run_editorial_review(llm=llm, record=current, model=review_model)
    spends.append(review_spend)
    revised_at_all = False
    revise_attempts = 0

    # One number decides when this loop stops, checked in exactly one place: the condition
    # below. Nothing inside the body re-derives or re-checks it — the cap that reaches gate
    # 2 is the cap this line enforces, and nothing else is in a position to disagree with it.
    while revise_attempts < max_attempts and review.findings:
        candidate, revise_spend = revise_leaf(
            llm=llm, record=current, review=review, passages=passages, model=revise_model
        )
        spends.append(revise_spend)
        revise_attempts += 1

        if candidate is None:
            # Revision failed grounding. Stop here rather than retrying blindly — a second
            # attempt at the same rewrite is unlikely to fix a grounding problem the first
            # one caused, and every further attempt is spend against the cap for no gain.
            break

        current = current.model_copy(update={"leaf": candidate, "attempts": current.attempts + 1})
        revised_at_all = True

        # Re-reviewed even on the attempt that exhausts the cap. The alternative saves one
        # call but means the outcome reports findings from *before* the last edit, which
        # would misrepresent to gate 2 whether that edit actually worked. If the findings
        # this returns are still non-empty, that unresolved review reaching a human is the
        # escalation this loop owes when it runs out of attempts.
        review, next_spend = run_editorial_review(llm=llm, record=current, model=review_model)
        spends.append(next_spend)

    return ReviewOutcome(record=current, review=review, revised=revised_at_all, spend=spends)
