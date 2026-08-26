"""Token spend, per node and per run.

The per-Track number decides whether the library can grow, and it cannot be reconstructed
after the fact from unstructured logs.
"""

from __future__ import annotations

from zoomout_pipeline.cost import RunCost, TokenSpend


def test_cost_is_summed_per_node() -> None:
    ledger = RunCost()
    ledger.record(TokenSpend(node="analyze", model="gemini-2.5-pro", input_tokens=30_000))
    ledger.record(TokenSpend(node="breakdown", model="gemini-2.5-pro", output_tokens=4_000))

    per_node = ledger.by_node()

    assert set(per_node) == {"analyze", "breakdown"}
    assert per_node["analyze"] == 30_000 * 1.25 / 1_000_000
    assert per_node["breakdown"] == 4_000 * 10.00 / 1_000_000
    assert ledger.total_tokens == 34_000


def test_an_unpriced_model_is_named_rather_than_reported_as_free() -> None:
    """A silent zero is indistinguishable from a free call, which is how a bill surprises."""
    ledger = RunCost()
    ledger.record(TokenSpend(node="analyze", model="gemini-9-unreleased", input_tokens=1_000))

    assert ledger.total_usd == 0.0
    assert ledger.unpriced_models == {"gemini-9-unreleased"}
