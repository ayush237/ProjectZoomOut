"""Tier B — COVER-1's generation wiring: one candidate per brief, a retry only where the
guard refused it, never a free second candidate for one that already passed.

The guard's own coverage already exists in `test_style_guard.py`; this exercises it rather
than extending it, with a scripted guard standing in for `check_style`.
"""

from __future__ import annotations

from zoomout_pipeline.assets.budget import ImageBudget
from zoomout_pipeline.assets.guardrails import AmberCheck
from zoomout_pipeline.assets.images import AnchorSet
from zoomout_pipeline.assets.style_guard import GuardResult, StyleBreach, StyleFinding, StyleReport
from zoomout_pipeline.cost import TokenSpend
from zoomout_pipeline.graph.cover_nodes import COVER_BRIEFS, generate_cover_candidates

_PASS = GuardResult(
    report=StyleReport(findings=[]),
    amber=AmberCheck(fraction=0.0, passed=True),
    spend=TokenSpend(node="style_guard", model="m"),
)
_REFUSE = GuardResult(
    report=StyleReport(findings=[StyleFinding(breach=StyleBreach.TEXT, what="a label on a jar")]),
    amber=AmberCheck(fraction=0.0, passed=True),
    spend=TokenSpend(node="style_guard", model="m"),
)


class _StubImage:
    def __init__(self, data: bytes) -> None:
        self.data = data


class _FakeImageClient:
    """One PNG-shaped stand-in per call, marked with which brief's prompt asked for it —
    `track42`'s prompt is the only one built from `cover_track42.md`'s general-store scene."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    def generate(self, *, prompt: str, **_: object) -> tuple[_StubImage, TokenSpend]:
        marker = "track42" if "general store" in prompt else "ikigai"
        self.calls.append(marker)
        return _StubImage(marker.encode()), TokenSpend(node="covers", model="m")


def _budget(max_images: int) -> ImageBudget:
    return ImageBudget(max_images=max_images, model="m")


def test_both_briefs_get_one_clean_candidate_and_nothing_more() -> None:
    """The common case: both pass first try, so nothing is spent on a second candidate for
    either — the ceiling is for the package, not a target to spend up to."""
    client = _FakeImageClient()
    budget = _budget(10)

    candidates = generate_cover_candidates(
        client=client,  # type: ignore[arg-type]
        briefs=COVER_BRIEFS,
        anchors=AnchorSet(images=[b"anchor"], instruction="x"),
        model="m",
        guard=lambda _data: _PASS,
        budget=budget,
    )

    assert [c.brief.track_id for c in candidates] == [b.track_id for b in COVER_BRIEFS]
    assert all(c.index == 1 for c in candidates)
    assert all(c.verdict.passed for c in candidates)
    assert budget.spent == len(COVER_BRIEFS), "a passing first candidate must not be redrawn"


def test_a_refused_candidate_is_retried_and_a_passing_one_is_not() -> None:
    """The targeted-retry path: the brief the guard refused gets a second attempt; the brief
    that already passed does not, even though budget remains."""
    client = _FakeImageClient()
    budget = _budget(10)
    seen_ikigai = False

    def guard(data: bytes) -> GuardResult:
        nonlocal seen_ikigai
        if data == b"ikigai" and not seen_ikigai:
            seen_ikigai = True
            return _REFUSE
        return _PASS

    candidates = generate_cover_candidates(
        client=client,  # type: ignore[arg-type]
        briefs=COVER_BRIEFS,
        anchors=AnchorSet(images=[b"anchor"], instruction="x"),
        model="m",
        guard=guard,
        budget=budget,
    )

    by_track: dict[int, list[int]] = {}
    for candidate in candidates:
        by_track.setdefault(candidate.brief.track_id, []).append(candidate.index)

    track42_id = next(b.track_id for b in COVER_BRIEFS if b.title == "The Science of Getting Rich")
    ikigai_id = next(b.track_id for b in COVER_BRIEFS if b.title != "The Science of Getting Rich")

    assert by_track[track42_id] == [1], "a clean first candidate must not get a bonus second one"
    assert by_track[ikigai_id] == [1, 2], "a refused candidate must be retried once"
    assert budget.spent == 3

    ikigai_candidates = [c for c in candidates if c.brief.track_id == ikigai_id]
    assert ikigai_candidates[0].verdict.passed is False
    assert ikigai_candidates[1].verdict.passed is True


def test_a_second_refusal_halts_rather_than_exceeding_the_budget() -> None:
    """A brief that fails both attempts is returned with no clean candidate, and the shared
    budget's ceiling — not an unbounded retry — is what stops it."""
    client = _FakeImageClient()
    budget = _budget(3)

    def guard(_data: bytes) -> GuardResult:
        return _REFUSE

    candidates = generate_cover_candidates(
        client=client,  # type: ignore[arg-type]
        briefs=COVER_BRIEFS,
        anchors=AnchorSet(images=[b"anchor"], instruction="x"),
        model="m",
        guard=guard,
        budget=budget,
    )

    assert all(not c.verdict.passed for c in candidates)
    assert budget.spent == 3, "the third image (one retry) exhausts a budget of 3"
