"""The graph's nodes.

Every node is idempotent and resumable. Runs span days because gate 1 is human, and
re-entering a node must not duplicate work or re-spend money — `ingest` in particular finds
its own earlier embeddings by file hash rather than paying for them twice.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol
from uuid import UUID

from langgraph.types import interrupt

from zoomout_pipeline.cost import RunCost, TokenSpend
from zoomout_pipeline.db.repository import BookRepository
from zoomout_pipeline.graph.dependencies import NodeDependencies
from zoomout_pipeline.graph.gate import read_plan_file, write_plan_file
from zoomout_pipeline.graph.state import MAX_BREAKDOWN_ATTEMPTS, PipelineState
from zoomout_pipeline.graph.structure_check import (
    MAX_SEQUENTIAL_PAIR_RATIO,
    MAX_SINGLE_CHAPTER_LEAF_RATIO,
    check_structure,
)
from zoomout_pipeline.ingest.chunking import chunk_book
from zoomout_pipeline.ingest.parser import file_hash, parse_book
from zoomout_pipeline.llm.client import LLMError
from zoomout_pipeline.logging import get_logger
from zoomout_pipeline.models import (
    MAX_LEAVES,
    MIN_LEAVES,
    Acquisition,
    BookAnalysis,
    BookProvenance,
    LeafPlan,
)
from zoomout_pipeline.prompts import render_prompt

_log = get_logger(__name__)


class Node(Protocol):
    """A LangGraph node: reads the state, returns only the fields it changed.

    Spelled as a protocol rather than a `Callable` alias because LangGraph's own node type
    is a protocol whose parameter is named `state`, and a positional-only `Callable` does
    not satisfy it.
    """

    def __call__(self, state: PipelineState) -> dict[str, Any]: ...


# The embedding endpoint counts each *text* as a request against a 100/minute free-tier
# quota, not each batch. Keeping a batch well under the per-minute budget means one call can
# never exceed the window on its own, which is what turns a rate limit into a pause rather
# than a failure.
EMBED_BATCH_SIZE = 25


class ProvenanceError(RuntimeError):
    """Ingest was asked to run without an acquisition status."""


class StructureRejectedError(RuntimeError):
    """A human-edited plan still mirrors the book's chapter structure."""


@dataclass(frozen=True)
class IngestResult:
    """What ingest produced, or found already done."""

    book_id: UUID
    provenance: BookProvenance
    chapter_titles: list[str]
    chunk_count: int
    parser_warnings: list[str]
    spend: TokenSpend
    reused: bool


def _with_cost(state: PipelineState, *spends: TokenSpend) -> RunCost:
    """Fold new spend into the run's ledger without mutating the old one."""
    ledger = RunCost(entries=list(state.cost.entries))
    for spend in spends:
        ledger.record(spend)
    return ledger


# --------------------------------------------------------------------------- ingest


def ingest_book(
    *,
    deps: NodeDependencies,
    run_id: str,
    source_path: Path,
    acquisition: Acquisition | None,
) -> IngestResult:
    """Parse, record provenance, chunk and embed.

    **Refuses to run without an acquisition status.** R6 calls provenance retroactively
    impossible to reconstruct — which is exactly why it cannot be something a caller
    forgets and fills in later. `undocumented` is a legitimate answer; silence is not.
    """
    if acquisition is None:
        raise ProvenanceError(
            "Refusing to ingest without an acquisition status. Pass one of: "
            f"{', '.join(a.value for a in Acquisition)}. If nobody recorded where this file "
            "came from, 'undocumented' is the honest answer — but it has to be said."
        )

    parsed, source_format = parse_book(source_path)
    digest = file_hash(source_path)
    chapter_titles = [chapter.title for chapter in parsed.chapters]
    chunks = chunk_book(parsed)

    with deps.connect() as conn:
        repo = BookRepository(conn)
        existing = repo.find_by_hash(digest)

        # Reuse only a book that is *fully* embedded. Comparing against the parser's own
        # chunk count rather than "more than zero" is the difference between resuming an
        # interrupted ingest and silently accepting a half-embedded book — which would
        # leave WP17 grounding against a fraction of the text with nothing to signal it.
        if existing is not None and existing.chunk_count >= len(chunks):
            # Idempotent re-entry: this file is already embedded. Re-embedding a whole book
            # is the most expensive accidental repeat available to this pipeline.
            _log.info(
                "ingest.reused",
                book_id=str(existing.id),
                chunk_count=existing.chunk_count,
                file_hash=digest[:12],
            )
            return IngestResult(
                book_id=existing.id,
                provenance=existing.provenance,
                chapter_titles=chapter_titles,
                chunk_count=existing.chunk_count,
                parser_warnings=parsed.parser_warnings,
                spend=TokenSpend(node="ingest", model=deps.settings.embedding_model),
                reused=True,
            )

        provenance = BookProvenance(
            title=parsed.detected_title or source_path.stem,
            author=parsed.detected_author or "Unknown",
            source=str(source_path),
            file_hash=digest,
            source_format=source_format,
            acquisition=acquisition,
            ingested_at=deps.now(),
        )
        book_id = (
            existing.id
            if existing is not None
            else repo.record_provenance(
                run_id=run_id, provenance=provenance, raw_text=parsed.full_text
            )
        )

        # Skip anything a previous attempt already embedded. An ingest that dies partway —
        # a rate limit, a dropped connection — resumes from where it stopped rather than
        # paying for the whole book again.
        already = repo.existing_chunk_keys(book_id)
        pending = [
            chunk
            for chunk in chunks
            if (chunk.chapter_index, chunk.position_in_chapter) not in already
        ]
        if already:
            _log.info(
                "ingest.resuming", book_id=str(book_id), done=len(already), pending=len(pending)
            )

        input_tokens = 0
        for start in range(0, len(pending), EMBED_BATCH_SIZE):
            batch = pending[start : start + EMBED_BATCH_SIZE]
            batch_vectors, spend = deps.embedder.embed(
                texts=[chunk.text for chunk in batch],
                model=deps.settings.embedding_model,
                node="ingest",
            )
            input_tokens += spend.input_tokens
            # Stored per batch, so a failure in a later batch does not discard the
            # embeddings this one already paid for.
            repo.store_chunks(book_id=book_id, chunks=batch, embeddings=batch_vectors)

        chunk_count = repo.count_chunks(book_id)

    return IngestResult(
        book_id=book_id,
        provenance=provenance,
        chapter_titles=chapter_titles,
        chunk_count=chunk_count,
        parser_warnings=parsed.parser_warnings,
        spend=TokenSpend(
            node="ingest", model=deps.settings.embedding_model, input_tokens=input_tokens
        ),
        reused=False,
    )


def make_ingest_node(deps: NodeDependencies) -> Node:
    def ingest(state: PipelineState) -> dict[str, Any]:
        log = _log.bind(run_id=state.run_id, node="ingest")

        # No shortcut on `state.chunk_count`. A checkpoint can hold the count from an ingest
        # that died partway, and trusting it would skip the work still outstanding.
        # `ingest_book` decides by comparing the database against the parsed file, which is
        # the only answer that cannot go stale. Parsing again is local and costs nothing.
        result = ingest_book(
            deps=deps,
            run_id=state.run_id,
            source_path=Path(state.source_path),
            acquisition=state.acquisition,
        )

        log.info(
            "ingest.complete",
            book_id=str(result.book_id),
            chapters=len(result.chapter_titles),
            chunks=result.chunk_count,
            reused=result.reused,
            tokens=result.spend.total_tokens,
        )

        return {
            "book_id": str(result.book_id),
            "provenance": result.provenance,
            "chapter_titles": result.chapter_titles,
            "chunk_count": result.chunk_count,
            "parser_warnings": result.parser_warnings,
            "cost": _with_cost(state, result.spend),
        }

    return ingest


# -------------------------------------------------------------------------- analyze


def make_analyze_node(deps: NodeDependencies) -> Node:
    def analyze(state: PipelineState) -> dict[str, Any]:
        log = _log.bind(run_id=state.run_id, node="analyze")

        if state.analysis is not None:
            log.info("analyze.skipped", reason="already in state")
            return {}

        if state.book_id is None:
            raise RuntimeError("analyze reached without a book_id; ingest did not complete")

        # Long context, not retrieval (proposal §3.2): thematic structure is a whole-book
        # judgement and RAG fragments it. The text is read here and deliberately not kept
        # in state, where the checkpointer would put it beyond the purge's reach.
        with deps.connect() as conn:
            raw_text = BookRepository(conn).get_raw_text(UUID(state.book_id))

        if raw_text is None:
            raise RuntimeError(
                f"No raw text for book {state.book_id}. It has been purged, so analysis "
                "cannot run — re-ingest the source file."
            )

        result = deps.llm.generate_structured(
            prompt=render_prompt("analyze") + "\n\n---\n\n# The book\n\n" + raw_text,
            schema=BookAnalysis,
            model=deps.settings.analyze_model,
            node="analyze",
        )

        log.info(
            "analyze.complete",
            themes=len(result.value.themes),
            concepts=len(result.value.key_concepts),
            tokens=result.spend.total_tokens,
            usd=round(result.spend.usd, 4),
        )
        return {"analysis": result.value, "cost": _with_cost(state, result.spend)}

    return analyze


# ------------------------------------------------------------------------ breakdown


def chapter_list_block(titles: list[str]) -> str:
    return "\n".join(f"{index}. {title}" for index, title in enumerate(titles))


def analysis_block(analysis: BookAnalysis) -> str:
    return (
        f"Central argument: {analysis.central_argument}\n\n"
        f"Themes:\n" + "\n".join(f"- {theme}" for theme in analysis.themes) + "\n\n"
        "Key concepts:\n" + "\n".join(f"- {c}" for c in analysis.key_concepts) + "\n\n"
        f"Intended reader: {analysis.intended_reader}\n\n"
        f"Structure notes: {analysis.structure_notes}"
    )


def previous_plan_block(plan: LeafPlan) -> str:
    return "\n".join(
        f"{leaf.order}. {leaf.title} — {leaf.concept} (chapters {leaf.source_chapters})"
        for leaf in sorted(plan.leaves, key=lambda item: item.order)
    )


def build_breakdown_prompt(
    *, title: str, author: str, chapter_titles: list[str], analysis: BookAnalysis
) -> str:
    """The first-attempt breakdown prompt.

    Factored out so the measurement harness renders exactly what the node renders. A harness
    that built its own prompt would be measuring a different prompt, and the whole point of
    WP16.1 is to measure this one.
    """
    return render_prompt(
        "breakdown",
        min_leaves=MIN_LEAVES,
        max_leaves=MAX_LEAVES,
        title=title,
        author=author,
        chapter_list=chapter_list_block(chapter_titles),
        analysis=analysis_block(analysis),
    )


def make_breakdown_node(deps: NodeDependencies) -> Node:
    def breakdown(state: PipelineState) -> dict[str, Any]:
        log = _log.bind(run_id=state.run_id, node="breakdown")

        if state.analysis is None:
            raise RuntimeError("breakdown reached without an analysis")
        if state.provenance is None:
            raise RuntimeError("breakdown reached without provenance")

        attempt = state.breakdown_attempts + 1
        is_revision = state.plan is not None and state.structure_check is not None
        is_retry = state.last_error is not None

        common = {
            "title": state.provenance.title,
            "author": state.provenance.author,
            "chapter_list": chapter_list_block(state.chapter_titles),
            "analysis": analysis_block(state.analysis),
        }

        if is_retry:
            prompt = render_prompt(
                "breakdown_retry",
                error=state.last_error,
                min_leaves=MIN_LEAVES,
                max_leaves=MAX_LEAVES,
                **common,
            )
        elif is_revision:
            assert state.structure_check is not None  # narrowed by is_revision
            assert state.plan is not None
            prompt = render_prompt(
                "breakdown_revision",
                findings=state.structure_check.feedback,
                single_chapter_ratio=state.structure_check.single_chapter_leaf_ratio,
                max_single_chapter_ratio=MAX_SINGLE_CHAPTER_LEAF_RATIO,
                sequential_ratio=state.structure_check.sequential_pair_ratio,
                max_sequential_ratio=MAX_SEQUENTIAL_PAIR_RATIO,
                leaf_count=state.structure_check.leaf_count,
                chapter_count=state.structure_check.chapter_count,
                previous_plan=previous_plan_block(state.plan),
                **common,
            )
        else:
            prompt = build_breakdown_prompt(
                title=state.provenance.title,
                author=state.provenance.author,
                chapter_titles=state.chapter_titles,
                analysis=state.analysis,
            )

        try:
            result = deps.llm.generate_structured(
                prompt=prompt,
                schema=LeafPlan,
                model=deps.settings.breakdown_model,
                node="breakdown",
            )
        except LLMError as error:
            # Output that is not a valid plan is a revision case, not a crash. It is bounded
            # by the same cap as a failed structure check, and the failure text is fed back
            # so the next attempt is told what was wrong rather than simply asked again.
            if attempt >= MAX_BREAKDOWN_ATTEMPTS:
                if state.plan is None:
                    # Nothing was ever produced, so there is nothing for a human to edit.
                    raise LLMError(
                        f"breakdown produced no valid plan in {attempt} attempts "
                        f"(cap {MAX_BREAKDOWN_ATTEMPTS}). Last failure: {error}"
                    ) from error

                # An earlier attempt did produce a plan; only the last one failed to parse.
                # Escalating with that plan is strictly better than discarding it — a plan
                # that fails the structure check is still a plan a human can edit until it
                # passes, and throwing it away costs the whole run's work for nothing.
                log.warning(
                    "breakdown.escalating_earlier_plan", attempt=attempt, error=str(error)[:200]
                )
                return {
                    "breakdown_attempts": attempt,
                    "last_error": None,
                    "escalation": (
                        f"Breakdown failed to produce valid output on its final attempt "
                        f"({attempt} of {MAX_BREAKDOWN_ATTEMPTS}). The plan below is the last "
                        f"valid one, and it did not pass the structure check. It has to be "
                        f"edited until it does. Last failure: {error}"
                    ),
                }

            log.warning("breakdown.invalid_output", attempt=attempt, error=str(error)[:200])
            return {"breakdown_attempts": attempt, "last_error": str(error)}

        check = check_structure(result.value, chapter_count=state.chapter_count)

        escalation: str | None = None
        if not check.passed and attempt >= MAX_BREAKDOWN_ATTEMPTS:
            escalation = (
                f"The structure check still fails after {attempt} attempts "
                f"(cap {MAX_BREAKDOWN_ATTEMPTS}). Escalating to the human gate with the "
                "findings attached — the plan cannot be approved until it is edited to pass."
            )

        log.info(
            "breakdown.complete",
            attempt=attempt,
            leaves=len(result.value.leaves),
            structure_passed=check.passed,
            single_chapter_ratio=round(check.single_chapter_leaf_ratio, 3),
            sequential_ratio=round(check.sequential_pair_ratio, 3),
            escalated=escalation is not None,
            tokens=result.spend.total_tokens,
            usd=round(result.spend.usd, 4),
        )

        return {
            "plan": result.value,
            "structure_check": check,
            "breakdown_attempts": attempt,
            "escalation": escalation,
            "last_error": None,
            "cost": _with_cost(state, result.spend),
        }

    return breakdown


def route_after_breakdown(state: PipelineState) -> str:
    """Pass to the gate, or revise — never unbounded.

    R7: reviewer→generator cycles are the classic place a graph runs away. The cap is hard
    and the escape hatch is a human, not another round.
    """
    if state.last_error is not None:
        # No plan at all this time. The node itself raises once the cap is reached, so
        # reaching here means there are attempts left.
        return "breakdown"
    if state.structure_check is not None and state.structure_check.passed:
        return "human_gate"
    if state.breakdown_attempts >= MAX_BREAKDOWN_ATTEMPTS:
        return "human_gate"
    return "breakdown"


# --------------------------------------------------------------------------- gate 1


def make_human_gate_node(deps: NodeDependencies) -> Node:
    def human_gate(state: PipelineState) -> dict[str, Any]:
        log = _log.bind(run_id=state.run_id, node="human_gate")

        if state.plan is None:
            raise RuntimeError("the gate was reached without a plan")
        if state.provenance is None:
            raise RuntimeError("the gate was reached without provenance")

        path = Path(deps.settings.runs_dir) / state.run_id / "leaf-plan.yaml"

        # Written only if absent. On resume LangGraph re-executes this node from the top,
        # so writing unconditionally would overwrite the founder's edits with the model's
        # original plan moments before reading them back — the edits would vanish and the
        # run would look like it worked.
        if not path.exists():
            write_plan_file(
                path=path,
                run_id=state.run_id,
                title=state.provenance.title,
                author=state.provenance.author,
                chapter_count=state.chapter_count,
                chapter_titles=state.chapter_titles,
                plan=state.plan,
                check=state.structure_check,
                escalation=state.escalation,
                min_leaves=MIN_LEAVES,
                max_leaves=MAX_LEAVES,
            )
            log.info("gate.plan_written", path=str(path))

        interrupt(
            {
                "gate": "leaf_plan_approval",
                "plan_file": str(path),
                "leaf_count": len(state.plan.leaves),
                "structure_passed": (
                    state.structure_check.passed if state.structure_check else None
                ),
                "escalation": state.escalation,
                "instructions": (
                    f"Edit {path}, set `approved: true`, then run "
                    f"`zoomout-pipeline resume --run-id {state.run_id}`."
                ),
            }
        )

        # Reached only on resume. The file is the plan: whatever the founder left in it is
        # what the run continues with.
        edited_plan, approved = read_plan_file(path)
        if not approved:
            raise StructureRejectedError(
                f"{path} still has `approved: false`. Set it to true and resume again."
            )

        recheck = check_structure(edited_plan, chapter_count=state.chapter_count)
        if not recheck.passed:
            # The legal gate is pass/fail and is not argued out of a rejection — including
            # by the human at the gate. Gate 1 exists to improve the plan, not to waive
            # the original-structure requirement (LEGAL.md).
            raise StructureRejectedError(
                f"The approved plan in {path} still mirrors the book's chapter structure:\n"
                f"{recheck.feedback}\n"
                "Edit the plan so the check passes, then resume again."
            )

        log.info(
            "gate.approved",
            leaves=len(edited_plan.leaves),
            edited=edited_plan != state.plan,
        )
        return {
            "plan": edited_plan,
            "structure_check": recheck,
            "plan_file": str(path),
            "approved": True,
            "escalation": None,
        }

    return human_gate
