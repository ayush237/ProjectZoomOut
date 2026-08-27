"""Per-Leaf generation: draft, extras, and the grounding gate.

The loop is `draft_leaf → extra_content → ground_check`, repeated for each Leaf in the
approved plan, with a bounded revision cycle when grounding fails.

Two things shape every function here.

**Passage text never enters graph state.** State carries chunk ids; text is reloaded from the
database when a node needs it. State is checkpointed, and text placed there would survive
`purge_raw_text` — the retention rule R6 requires would silently not apply.

**The grounding verdict is not negotiable.** A Leaf that fails does not proceed. It is
revised, and at the cap it escalates to a human. It is never emitted with a warning.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.db.retrieval import DEFAULT_TOP_K, Passage, PassageRepository
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.grounding import GroundingVerdict, check_grounding
from zoomout_pipeline.graph.nodes import Node
from zoomout_pipeline.graph.state import MAX_LEAF_ATTEMPTS, PipelineState
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import (
    GeneratedExtras,
    GeneratedLeaf,
    GeneratedLeafRecord,
    PlannedLeaf,
)
from zoomout_pipeline.prompts import render_prompt

_log = get_logger(__name__)


class PlanExhaustedError(RuntimeError):
    """Asked for a Leaf beyond the end of the plan."""


def current_leaf(state: PipelineState) -> PlannedLeaf:
    if state.plan is None:
        raise RuntimeError("leaf generation reached without an approved plan")
    ordered = sorted(state.plan.leaves, key=lambda leaf: leaf.order)
    if state.leaf_cursor >= len(ordered):
        raise PlanExhaustedError(f"cursor {state.leaf_cursor} is past the end of the plan")
    return ordered[state.leaf_cursor]


def _load_passages(deps: NodeDependencies, chunk_ids: list[int]) -> list[Passage]:
    """Rehydrate passages from ids, preserving P1..Pn order.

    Order matters: the handles the model was shown are positional, so reloading them in a
    different order would silently re-point every citation.
    """
    if not chunk_ids:
        return []

    with deps.connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
                SELECT id, chapter_index, chapter_title, position_in_chapter, text
                FROM book_chunks WHERE id = ANY(%s)
                """,
            (chunk_ids,),
        )
        rows = {int(str(r["id"])): r for r in cur.fetchall()}

    passages: list[Passage] = []
    for index, chunk_id in enumerate(chunk_ids):
        row = rows.get(chunk_id)
        if row is None or row["text"] is None:
            continue
        passages.append(
            Passage(
                ref=f"P{index + 1}",
                chunk_id=chunk_id,
                chapter_index=int(str(row["chapter_index"])),
                chapter_title=str(row["chapter_title"]),
                position_in_chapter=int(str(row["position_in_chapter"])),
                text=str(row["text"]),
                distance=0.0,
            )
        )
    return passages


def format_passages(passages: list[Passage]) -> str:
    """The passage block the model sees. Handles are positional and explicit."""
    return "\n\n".join(
        f"### {p.ref} — {p.chapter_title} (passage {p.position_in_chapter + 1})\n\n{p.text}"
        for p in passages
    )


def retrieve_for_leaf(
    deps: NodeDependencies, *, book_id: UUID, planned: PlannedLeaf
) -> tuple[list[Passage], TokenSpend]:
    """Passages for one Leaf, confined to the chapters its plan declared.

    Confining rather than merely ranking means a Leaf cannot cite a chapter its own plan
    never claimed to draw on — which keeps the approved plan meaningful rather than
    decorative.
    """
    query = f"{planned.title}. {planned.concept}"
    vectors, spend = deps.embedder.embed(
        texts=[query], model=deps.settings.embedding_model, node="draft_leaf"
    )

    with deps.connect() as conn:
        passages = PassageRepository(conn).search(
            book_id=book_id,
            embedding=vectors[0],
            top_k=DEFAULT_TOP_K,
            chapter_indices=planned.source_chapters,
        )
    return passages, spend


def _with_cost(state: PipelineState, *spends: TokenSpend) -> RunCost:
    ledger = RunCost(entries=list(state.cost.entries))
    for spend in spends:
        ledger.record(spend)
    return ledger


# ------------------------------------------------------------------------ draft_leaf


def make_draft_leaf_node(deps: NodeDependencies) -> Node:
    def draft_leaf(state: PipelineState) -> dict[str, Any]:
        planned = current_leaf(state)
        log = _log.bind(run_id=state.run_id, node="draft_leaf", leaf=planned.order)

        if state.book_id is None:
            raise RuntimeError("draft_leaf reached without a book_id")

        passages, embed_spend = retrieve_for_leaf(
            deps, book_id=UUID(state.book_id), planned=planned
        )
        if not passages:
            raise RuntimeError(
                f"no passages retrieved for Leaf {planned.order} "
                f"(chapters {planned.source_chapters}). The book may have been purged."
            )

        prompt = render_prompt(
            "draft_leaf",
            title=planned.title,
            concept=planned.concept,
            passages=format_passages(passages),
        )
        if state.grounding_feedback:
            # A retry that is not told what failed is just a second roll of the dice.
            prompt = (
                "# This Leaf was rejected by the grounding check\n\n"
                "Every one of these has to be fixed. A claim you cannot support with the "
                "passages below is a claim to delete, not to reword.\n\n"
                f"{state.grounding_feedback}\n\n---\n\n" + prompt
            )

        result = deps.llm.generate_structured(
            prompt=prompt,
            schema=GeneratedLeaf,
            model=deps.settings.draft_model,
            node="draft_leaf",
        )

        log.info(
            "draft_leaf.complete",
            claims=len(result.value.claims),
            passages=len(passages),
            tokens=result.spend.total_tokens,
        )
        return {
            "current_passage_ids": [p.chunk_id for p in passages],
            "current_draft": result.value,
            "cost": _with_cost(state, embed_spend, result.spend),
        }

    return draft_leaf


# --------------------------------------------------------------------- extra_content


def make_extra_content_node(deps: NodeDependencies) -> Node:
    def extra_content(state: PipelineState) -> dict[str, Any]:
        planned = current_leaf(state)
        log = _log.bind(run_id=state.run_id, node="extra_content", leaf=planned.order)

        if state.current_draft is None:
            raise RuntimeError("extra_content reached without a draft")

        passages = _load_passages(deps, state.current_passage_ids)
        result = deps.llm.generate_structured(
            prompt=render_prompt(
                "extra_content",
                title=planned.title,
                concept=planned.concept,
                takeaway=state.current_draft.takeaway_body,
                passages=format_passages(passages),
            ),
            schema=GeneratedExtras,
            model=deps.settings.extras_model,
            node="extra_content",
        )

        log.info(
            "extra_content.complete",
            has_dtk=result.value.dinner_table_knowledge is not None,
            has_apply=result.value.apply_in_life is not None,
            tokens=result.spend.total_tokens,
        )
        return {"current_extras": result.value, "cost": _with_cost(state, result.spend)}

    return extra_content


# ---------------------------------------------------------------------- ground_check


def make_ground_check_node(deps: NodeDependencies) -> Node:
    def ground_check(state: PipelineState) -> dict[str, Any]:
        planned = current_leaf(state)
        log = _log.bind(run_id=state.run_id, node="ground_check", leaf=planned.order)

        if state.current_draft is None or state.current_extras is None:
            raise RuntimeError("ground_check reached without a draft and extras")

        passages = _load_passages(deps, state.current_passage_ids)
        verdict: GroundingVerdict = check_grounding(
            leaf=state.current_draft, extras=state.current_extras, passages=passages
        )
        attempt = state.leaf_attempts + 1

        log.info(
            "ground_check.complete",
            passed=verdict.passed,
            failures=len(verdict.failures),
            attempt=attempt,
            cited=len(verdict.cited_chunk_ids),
        )

        if verdict.passed:
            # Marking cited passages is what makes the retention rule safe: these survive
            # `purge_raw_text` because they are the audit trail proving the claim.
            with deps.connect() as conn:
                PassageRepository(conn).mark_cited(verdict.cited_chunk_ids)

            record = GeneratedLeafRecord(
                order=planned.order,
                title=planned.title,
                leaf=state.current_draft,
                extras=state.current_extras,
                cited_chunk_ids=verdict.cited_chunk_ids,
                attempts=attempt,
            )
            return {
                "generated": {**state.generated, str(planned.order): record},
                "leaf_cursor": state.leaf_cursor + 1,
                "leaf_attempts": 0,
                "current_draft": None,
                "current_extras": None,
                "current_passage_ids": [],
                "grounding_feedback": None,
            }

        if attempt >= MAX_LEAF_ATTEMPTS:
            # Escalate rather than emit. The verdict is not negotiable, so the only way past
            # a persistent failure is a human deciding what to do about it.
            log.warning("ground_check.escalated", attempt=attempt)
            return {
                "leaf_escalations": {
                    **state.leaf_escalations,
                    str(planned.order): (
                        f"Grounding failed after {attempt} attempts:\n{verdict.feedback}"
                    ),
                },
                "leaf_cursor": state.leaf_cursor + 1,
                "leaf_attempts": 0,
                "current_draft": None,
                "current_extras": None,
                "current_passage_ids": [],
                "grounding_feedback": None,
            }

        return {"leaf_attempts": attempt, "grounding_feedback": verdict.feedback}

    return ground_check


def route_after_ground_check(state: PipelineState) -> str:
    """Redraft, move to the next Leaf, or finish. Never emit an ungrounded Leaf."""
    if state.grounding_feedback is not None:
        return "draft_leaf"
    if state.plan is not None and state.leaf_cursor < len(state.plan.leaves):
        return "draft_leaf"
    return "done"
