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

import hashlib
import random
from typing import Any
from uuid import UUID

from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.db.retrieval import (
    DEFAULT_TOP_K,
    Passage,
    PassageRepository,
    format_passages,
)
from zoomout_pipeline.graph.answer_length_check import (
    MAX_LONGEST_CORRECT_RATIO,
    check_answer_length,
)
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.grounding import GroundingVerdict, check_grounding
from zoomout_pipeline.graph.nodes import Node
from zoomout_pipeline.graph.review import review_and_revise
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


def reload_passages(deps: NodeDependencies, passage_refs: dict[str, int]) -> list[Passage]:
    """Reload a finished record's passages, under the handles the model actually used.

    Driven by the stored `ref -> chunk_id` mapping rather than by position. Renumbering
    handles from a sorted id list drops the high ones and re-points the rest at the wrong
    chapters — see the note on `GeneratedLeafRecord.passage_refs`, and WP17's completion
    report for how that bug actually shipped once already. Written once, here, so
    `cms_node.py` and `review.py` share it rather than each keeping their own copy.
    """
    chunk_ids = sorted(set(passage_refs.values()))
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
    for ref, chunk_id in sorted(passage_refs.items()):
        row = rows.get(chunk_id)
        if row is None:
            continue
        passages.append(
            Passage(
                ref=ref,
                chunk_id=chunk_id,
                chapter_index=int(str(row["chapter_index"])),
                chapter_title=str(row["chapter_title"]),
                position_in_chapter=int(str(row["position_in_chapter"])),
                text=str(row["text"] or ""),
                distance=0.0,
            )
        )
    return passages


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


def shuffle_options(leaf: GeneratedLeaf, *, seed: str) -> GeneratedLeaf:
    """Reorder the scenario options deterministically.

    Measured across a real 18-Leaf Track: the model placed the correct option second in
    **15 of 18** Leaves and never third. "Always pick B" scored 83% without reading anything,
    which makes the unlock gate decorative — and `PRODUCT.md` calls active recall the entire
    product thesis.

    Position bias is not worth arguing with a prompt about when we control the ordering. The
    seed is derived from the run and the Leaf so a regenerated Leaf shuffles identically,
    which keeps runs reproducible and diffs meaningful.
    """
    options = list(leaf.scenario_options)
    random.Random(hashlib.sha256(seed.encode()).hexdigest()).shuffle(options)
    return leaf.model_copy(update={"scenario_options": options})


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

        drafted = shuffle_options(result.value, seed=f"{state.run_id}:{planned.order}")

        log.info(
            "draft_leaf.complete",
            claims=len(result.value.claims),
            passages=len(passages),
            tokens=result.spend.total_tokens,
        )
        return {
            "current_passage_ids": [p.chunk_id for p in passages],
            "current_draft": drafted,
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
                # Recorded here, where the handles are still the ones the model was shown.
                passage_refs={p.ref: p.chunk_id for p in passages},
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
    """Redraft the same Leaf, or send it to editorial review. Never emit an ungrounded Leaf.

    Note what this no longer decides: whether the Track is finished. A Leaf that clears the
    legal gate always goes to `review_leaf` next, and it is *that* node's router that moves
    on to the next Leaf or ends the Track — so the "am I done" question is asked in exactly
    one place rather than in two that must be kept in agreement.
    """
    if state.grounding_feedback is not None:
        return "draft_leaf"
    return "review_leaf"


def make_review_leaf_node(deps: NodeDependencies) -> Node:
    """Editorial review for the Leaf `ground_check` just filed.

    **A separate node from `ground_check`, deliberately.** R3's whole point is that the legal
    gate cannot be argued down on quality grounds, and the cleanest guarantee of that is that
    the two never run in the same function — `ground_check` has already returned its verdict
    and filed the record before this node is reached, so nothing here is in a position to
    revisit it.

    Reviews `leaf_cursor - 1`, not `leaf_cursor`: `ground_check` advances the cursor as part
    of filing the record, so by the time this runs the "current" Leaf is the next one, which
    has not been drafted yet.
    """

    def review_leaf(state: PipelineState) -> dict[str, Any]:
        # The Leaf ground_check just finished with. On the escalation path it filed nothing
        # into `generated`, so there is genuinely nothing to review — that Leaf reaches the
        # human through `leaf_escalations` instead, which is its own escalation channel.
        key = str(state.leaf_cursor - 1)
        record = state.generated.get(key)
        if record is None:
            return {}

        log = _log.bind(run_id=state.run_id, node="review_leaf", leaf=record.order)
        passages = reload_passages(deps, record.passage_refs)

        outcome = review_and_revise(
            llm=deps.llm,
            record=record,
            passages=passages,
            review_model=deps.settings.editorial_model,
            revise_model=deps.settings.revise_model,
            max_attempts=deps.settings.editorial_attempts,
        )

        log.info(
            "review_leaf.complete",
            findings=len(outcome.review.findings),
            categories=sorted({f.category.value for f in outcome.review.findings}),
            revised=outcome.revised,
            usd=round(outcome.total_cost.total_usd, 4),
        )

        return {
            "generated": {**state.generated, key: outcome.record},
            "leaf_reviews": {**state.leaf_reviews, key: outcome.review},
            "cms_reviews": {
                **state.cms_reviews,
                key: {
                    "findings": len(outcome.review.findings),
                    "categories": sorted({f.category.value for f in outcome.review.findings}),
                    "overall_note": outcome.review.overall_note,
                    "revised": outcome.revised,
                    "usd": round(outcome.total_cost.total_usd, 4),
                },
            },
            "cost": _with_cost(state, *outcome.spend),
        }

    return review_leaf


def route_after_review(state: PipelineState) -> str:
    """Move to the next Leaf, or write the Track to the CMS.

    The single place the Track's "am I finished" question is answered — see the note on
    `route_after_ground_check`.
    """
    if state.plan is not None and state.leaf_cursor < len(state.plan.leaves):
        return "draft_leaf"
    return "done"


def make_answer_length_node(deps: NodeDependencies) -> Node:
    """Measure the correct-option-is-longest tell, once, across the finished Track.

    **Why it is a node at all.** WP19 built this check and wired it into `review-track`,
    the retrofit command — so it ran on Track 42 only because someone invoked that command
    by hand, and a *fresh* run reached the CMS having never measured itself. That is the
    graph-shape problem wearing different clothes: not a node that cannot be reached, but a
    check that lives outside the graph and so is only ever reached deliberately. The check
    that guards the product's central claim is the last one that should depend on someone
    remembering.

    **It does not block, and that is a decision rather than an omission.** Three reasons,
    in order of weight:

    - The remedy is generation-side — substantive distractors — so the loop a block would
      have to take is "re-draft all eighteen Leaves", with no per-Track attempt counter to
      terminate it. A cap that does not exist is not a cap.
    - Everything it writes is a draft that a human must approve. Gate 2 is where content
      defects are meant to be caught, and a reviewer can rewrite an option in seconds.
    - Halting before the CMS write leaves the founder with no Leaves to look at and no way
      forward except another run, which is the more expensive failure of the two.

    The counter-argument is real and belongs on the record: WP19 ruled that "an advisory
    finding is too weak a guard for a defect that empties the product's core claim." What
    makes this weaker than that ruling wants is that a warning does not stop the Track. If
    that is the wrong trade, the fix is a per-Track regeneration budget, not moving this
    check into `ground_check` — the legal gate must stay unarguable on style grounds (R3).
    """

    def answer_length_check(state: PipelineState) -> dict[str, Any]:
        log = _log.bind(run_id=state.run_id, node="answer_length_check")
        result = check_answer_length(list(state.generated.values()))

        # `warning`, not `info`, on a failure. A run this long is read by skimming for the
        # lines that are not routine, and a Track that is answerable without reading is
        # exactly what must not scroll past.
        (log.info if result.passed else log.warning)(
            "answer_length.complete",
            passed=result.passed,
            ratio=round(result.longest_correct_ratio, 3),
            leaves_with_longest_correct=result.leaves_with_longest_correct,
            leaves_checked=result.leaves_checked,
            limit=MAX_LONGEST_CORRECT_RATIO,
        )
        return {"answer_length": result}

    return answer_length_check
