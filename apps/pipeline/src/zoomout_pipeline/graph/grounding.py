"""The grounding gate.

`LEGAL.md` names fabricated content attributed to a real author as **the highest-severity
risk in the product**, above the copyright question. It is what damaged Bookey. This module
is where that policy stops being a document.

**Pass/fail, and mechanical.** Not a score with a threshold somebody can nudge, and not a
judgement that an editorial argument can talk down (R3). A claim without a supporting
passage does not proceed — not with a warning, not with a flag.

What makes it mechanical rather than a matter of opinion: the model is shown a numbered set
of retrieved passages and may cite only those handles. So three things can be checked by
looking, with no model in the loop:

1. **Does the citation resolve?** A handle that was never shown is an invention.
2. **Is a quote actually a quote?** Verbatim in the cited passage, or it is not a quote.
3. **Is every claim cited at all, and is Dinner Table Knowledge sourced to the takeaway?**

This deliberately does not judge whether the passage *argues* for the claim — that needs a
reader. What it guarantees is that every assertion is anchored to a real span of the real
book, which is the thing that was missing when authors found words they never wrote.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from zoomout_pipeline.db.retrieval import Passage
from zoomout_pipeline.models import Claim, GeneratedExtras, GeneratedLeaf, SlideKey

# A quote shorter than this is a fragment ("the certain way") that appears in many places
# and proves nothing about attribution.
MIN_QUOTE_CHARS = 12


@dataclass(frozen=True)
class GroundingFailure:
    """One reason the Leaf does not proceed."""

    slide_key: str
    claim: str
    reason: str

    def __str__(self) -> str:
        return f"[{self.slide_key}] {self.reason} — claim: {self.claim[:110]}"


@dataclass(frozen=True)
class GroundingVerdict:
    """Pass or fail, and why. There is no score."""

    passed: bool
    failures: list[GroundingFailure]
    cited_chunk_ids: list[int]

    @property
    def feedback(self) -> str:
        return "\n".join(f"- {failure}" for failure in self.failures)


def normalise_for_quote_match(text: str) -> str:
    """Fold the differences that are not differences.

    Curly quotes, non-breaking spaces and line wrapping are artefacts of the EPUB and of the
    model's own formatting. Treating them as mismatches would reject honest quotes, so they
    are normalised — while the words themselves are compared exactly.
    """
    folded = unicodedata.normalize("NFKC", text)
    folded = folded.replace("’", "'").replace("‘", "'")
    folded = folded.replace("“", '"').replace("”", '"')
    folded = folded.replace("—", "-").replace("–", "-")
    return re.sub(r"\s+", " ", folded).strip().lower()


def _check_claim(claim: Claim, passages: dict[str, Passage]) -> list[GroundingFailure]:
    failures: list[GroundingFailure] = []

    if not claim.citations:
        # Unreachable through the schema, which requires one — kept because this is the
        # sentence the whole module exists to enforce, and it should not depend on a
        # validator staying where it is.
        return [GroundingFailure(claim.slide_key, claim.text, "no citation at all")]

    for citation in claim.citations:
        passage = passages.get(citation.passage_ref)
        if passage is None:
            failures.append(
                GroundingFailure(
                    claim.slide_key,
                    claim.text,
                    f"cites {citation.passage_ref!r}, which was never retrieved — invented",
                )
            )
            continue

        if citation.quote is None:
            continue

        quote = citation.quote.strip()
        if len(quote) < MIN_QUOTE_CHARS:
            failures.append(
                GroundingFailure(
                    claim.slide_key,
                    claim.text,
                    f"quote is {len(quote)} characters, too short to attribute",
                )
            )
            continue

        if normalise_for_quote_match(quote) not in normalise_for_quote_match(passage.text):
            failures.append(
                GroundingFailure(
                    claim.slide_key,
                    claim.text,
                    f"quote does not appear in {citation.passage_ref}: {quote[:80]!r}. "
                    "A quote is verbatim or it is not a quote",
                )
            )

    return failures


def check_grounding(
    *,
    leaf: GeneratedLeaf,
    extras: GeneratedExtras,
    passages: list[Passage],
) -> GroundingVerdict:
    """Verify every claim against the passages the model was actually shown."""
    by_ref = {passage.ref: passage for passage in passages}
    failures: list[GroundingFailure] = []
    all_claims = [*leaf.claims, *extras.claims]

    for claim in all_claims:
        failures.extend(_check_claim(claim, by_ref))

    # Dinner Table Knowledge is singled out by LEGAL.md and enforced by the shared schema and
    # by Payload. Enforcing it here too makes three independent places, which is the point:
    # an unsourced deep-cut fact should be unrepresentable rather than merely discouraged.
    if extras.dinner_table_knowledge is not None:
        takeaway_claims = [
            claim
            for claim in all_claims
            if claim.slide_key == SlideKey.TAKEAWAY and claim.citations
        ]
        if not takeaway_claims:
            failures.append(
                GroundingFailure(
                    SlideKey.TAKEAWAY.value,
                    extras.dinner_table_knowledge,
                    "Dinner Table Knowledge with no sourced claim on the takeaway slide",
                )
            )

    cited = sorted(
        {
            by_ref[citation.passage_ref].chunk_id
            for claim in all_claims
            for citation in claim.citations
            if citation.passage_ref in by_ref
        }
    )

    return GroundingVerdict(passed=not failures, failures=failures, cited_chunk_ids=cited)
