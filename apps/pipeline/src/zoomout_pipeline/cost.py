"""Token spend, tracked per node and per run.

Recorded from the first commit rather than added later, because the question this answers
— what does one Track cost — is asked once a whole book has run, and by then the runs that
would have told you are gone.

Costs are computed from a per-model rate table. The rates are the *paid* tier: a run on the
free tier still reports what it would have cost, because the free tier is only for
public-domain books during development (proposal §4a) and the number that matters for
planning is the one a real book will bill.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from pydantic import BaseModel, Field

# USD per million tokens, paid tier, as published mid-2026. A model absent from this table
# reports zero cost rather than guessing — and `unpriced_models` names it so a silent zero
# is never mistaken for a free call.
_RATES_PER_MTOK: dict[str, tuple[float, float]] = {
    # model: (input, output)
    "gemini-2.5-pro": (1.25, 10.00),
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-embedding-001": (0.15, 0.00),
    # Verified against ai.google.dev/gemini-api/docs/pricing, 2026-08-29 — the standard
    # (<=200k token) tier; the >200k tier is 4.00/18.00 and not modelled here, since no
    # prompt in this pipeline approaches that length. Used by editorial_review and revise
    # (WP19), the only nodes deliberately run on a stronger, differently-tuned model than
    # generation so a Leaf is not reviewed by the same judgement that wrote it.
    "gemini-3.1-pro-preview": (2.00, 12.00),
    # Verified against the same page, 2026-09-01. The promotional rate: the page states
    # $0.75/$3.75 "through December 31, 2026" and $1.50/$7.50 from January 1, 2027, so this
    # entry is dated and the number a run reports will silently halve in value on New
    # Year's Day unless someone changes it.
    #
    # Added by WP20, which had to report what one Track actually costs and found the
    # pipeline's own generation model unpriced — every text call in every run to date
    # reported $0.00. `unpriced_models` did name it, correctly; nobody had looked.
    "gemini-3.6-flash": (0.75, 3.75),
    # Any remaining 3.x model is deliberately absent. Their published rates were not
    # verified here, and `unpriced_models` naming a model is more useful than a confident
    # number that is wrong — a silent zero is indistinguishable from a free call.
}


class TokenSpend(BaseModel):
    """What one model call cost."""

    node: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def usd(self) -> float:
        rates = _RATES_PER_MTOK.get(self.model)
        if rates is None:
            return 0.0
        input_rate, output_rate = rates
        return (self.input_tokens * input_rate + self.output_tokens * output_rate) / 1_000_000


class RunCost(BaseModel):
    """Aggregate spend for a run. Carried in graph state so it survives a resume."""

    entries: list[TokenSpend] = Field(default_factory=list)

    def record(self, spend: TokenSpend) -> None:
        self.entries.append(spend)

    @property
    def total_usd(self) -> float:
        return sum(entry.usd for entry in self.entries)

    @property
    def total_tokens(self) -> int:
        return sum(entry.total_tokens for entry in self.entries)

    @property
    def unpriced_models(self) -> set[str]:
        """Models with no rate, so a reported 0.0 is never silently wrong."""
        return {e.model for e in self.entries if e.model not in _RATES_PER_MTOK}

    def by_node(self) -> dict[str, float]:
        totals: dict[str, float] = {}
        for entry in self.entries:
            totals[entry.node] = totals.get(entry.node, 0.0) + entry.usd
        return totals


@dataclass
class CostLedger:
    """Mutable accumulator used inside a node, then folded into state."""

    run_id: str
    entries: list[TokenSpend] = field(default_factory=list)

    def record(self, spend: TokenSpend) -> None:
        self.entries.append(spend)
