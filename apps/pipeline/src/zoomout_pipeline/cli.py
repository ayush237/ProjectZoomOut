"""Command line entry points.

`doctor` exists because of WP5b: the failure there was not that a migration errored, it was
that it succeeded against the wrong database. A command that prints which database it is
connected to and what is in it makes that visible in one second rather than a day later.
"""

from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path
from typing import Annotated, Any
from uuid import UUID

import typer
from langgraph.types import Command

from zoomout_pipeline.config import get_settings
from zoomout_pipeline.db.engine import ForeignDatabaseError, connect, describe_database
from zoomout_pipeline.db.repository import BookRepository
from zoomout_pipeline.db.schema import apply_schema
from zoomout_pipeline.graph.state import PipelineState
from zoomout_pipeline.logging import configure_logging, get_logger
from zoomout_pipeline.measure import run_samples, summarise
from zoomout_pipeline.models import Acquisition
from zoomout_pipeline.runner import run_context

app = typer.Typer(
    add_completion=False,
    help="ZoomOut content pipeline — book to an approved Leaf plan.",
    no_args_is_help=True,
)
_log = get_logger(__name__)


@app.callback()
def _configure(json_logs: bool = typer.Option(False, "--json-logs")) -> None:
    configure_logging(json_output=json_logs)


@app.command()
def doctor() -> None:
    """Show which database the pipeline is pointed at, and what is in it."""
    settings = get_settings()
    typer.echo(f"database url : {_redact(settings.database_url)}")

    try:
        with connect(verify=False) as conn:
            name, tables = describe_database(conn)
    except Exception as error:
        typer.secho(f"could not connect: {error}", fg=typer.colors.RED)
        raise typer.Exit(1) from error

    typer.echo(f"database     : {name}")
    typer.echo(f"tables ({len(tables)}) : {', '.join(sorted(tables)) or '(none)'}")

    try:
        with connect(verify=True):
            pass
    except ForeignDatabaseError as error:
        typer.secho(f"\nREFUSING TO USE THIS DATABASE\n{error}", fg=typer.colors.RED)
        raise typer.Exit(1) from error

    typer.secho("\nthis is the pipeline's own database", fg=typer.colors.GREEN)


@app.command("init-db")
def init_db() -> None:
    """Create the pipeline's tables. Idempotent."""
    with connect() as conn:
        apply_schema(conn)
        name, tables = describe_database(conn)
    typer.secho(f"schema applied to {name} ({len(tables)} tables)", fg=typer.colors.GREEN)


@app.command()
def run(
    source: Annotated[Path, typer.Option(help="Path to the EPUB (or PDF) to ingest.")],
    acquisition: Annotated[
        Acquisition,
        typer.Option(help="How this file was obtained. Required — see R6."),
    ],
    run_id: Annotated[str | None, typer.Option(help="Defaults to a generated id.")] = None,
    cms_track_id: Annotated[
        int | None,
        typer.Option(help="Write into an existing Track instead of creating a new one."),
    ] = None,
) -> None:
    """Ingest, analyze, break down, and stop at the human gate.

    `--cms-track-id` regenerates a Track that already exists, which is a different thing
    from resuming one. A resumed run reuses the Track it created itself; this seeds the
    same field from outside so a *new* run's Leaves land under the *old* Track's id.
    WP20 needed it: Track 42's text was regenerated from scratch, and letting the run
    create Track 45 would have left two Tracks of one book in the CMS with the founder
    reviewing whichever they happened to open.

    **It does not empty the Track first.** `write_drafts_to_cms` skips any `orderIndex`
    Payload already holds, so pointing a run at a populated Track writes nothing — delete
    the old Leaves first, deliberately, with a credential that is allowed to.
    """
    resolved_run_id = run_id or f"run-{uuid.uuid4().hex[:12]}"
    state = PipelineState(
        run_id=resolved_run_id,
        source_path=str(source),
        acquisition=acquisition,
        cms_track_id=cms_track_id,
    )

    with run_context() as (graph, _deps):
        config = {"configurable": {"thread_id": resolved_run_id}}
        result: dict[str, Any] = graph.invoke(state, config)  # type: ignore[attr-defined]

    _report(result, run_id=resolved_run_id)


@app.command()
def resume(
    run_id: Annotated[str, typer.Option(help="The run to continue.")],
) -> None:
    """Continue a run — from a human gate, or from wherever it was killed.

    Those are two different continuations and the difference matters. A run paused at
    `interrupt` is waiting for an answer and resumes with one; a run killed mid-node has no
    question outstanding and simply picks up from its last checkpoint. Sending a resume
    value to the second does nothing, which looks exactly like a run that will not restart.
    """
    with run_context() as (graph, _deps):
        config = {"configurable": {"thread_id": run_id}}
        snapshot = graph.get_state(config)  # type: ignore[attr-defined]

        if not snapshot.values:
            typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
            raise typer.Exit(1)

        waiting = any(getattr(task, "interrupts", None) for task in snapshot.tasks)
        if waiting:
            typer.echo("resuming from a human gate")
            result: dict[str, Any] = graph.invoke(Command(resume=True), config)  # type: ignore[attr-defined]
        else:
            typer.echo(f"continuing from the last checkpoint (next: {snapshot.next or 'end'})")
            result = graph.invoke(None, config)  # type: ignore[attr-defined]

    _report(result, run_id=run_id)


@app.command()
def status(run_id: Annotated[str, typer.Option()]) -> None:
    """Where a run is, read from the checkpoint rather than from memory."""
    with run_context() as (graph, _deps):
        config = {"configurable": {"thread_id": run_id}}
        snapshot = graph.get_state(config)  # type: ignore[attr-defined]

    if not snapshot.values:
        typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
        raise typer.Exit(1)

    state = PipelineState.model_validate(snapshot.values)
    typer.echo(f"run        : {state.run_id}")
    typer.echo(f"next       : {snapshot.next or '(complete)'}")
    typer.echo(f"book       : {state.provenance.title if state.provenance else '(not ingested)'}")
    typer.echo(f"chapters   : {state.chapter_count}")
    typer.echo(f"chunks     : {state.chunk_count}")
    typer.echo(f"analysis   : {'yes' if state.analysis else 'no'}")
    typer.echo(f"leaves     : {len(state.plan.leaves) if state.plan else 0}")
    typer.echo(f"attempts   : {state.breakdown_attempts}")
    if state.structure_check:
        typer.echo(f"structure  : {'PASS' if state.structure_check.passed else 'FAIL'}")
    typer.echo(f"approved   : {state.approved}")
    if state.approved and state.plan is not None:
        typer.echo(
            f"leaves done: {len(state.generated)} of {len(state.plan.leaves)} "
            f"(cursor {state.leaf_cursor})"
        )
        if state.leaf_escalations:
            typer.echo(f"escalated  : {sorted(state.leaf_escalations)}")
    typer.echo(f"plan file  : {state.plan_file or '(not written)'}")
    _echo_cost(state)


@app.command()
def cost(run_id: Annotated[str, typer.Option()]) -> None:
    """Token spend for a run, per node."""
    with run_context() as (graph, _deps):
        snapshot = graph.get_state({"configurable": {"thread_id": run_id}})  # type: ignore[attr-defined]
    if not snapshot.values:
        typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
        raise typer.Exit(1)
    _echo_cost(PipelineState.model_validate(snapshot.values), verbose=True)


@app.command("measure-breakdown")
def measure_breakdown(
    run_id: Annotated[str, typer.Option(help="Existing run whose analysis is reused.")],
    model: Annotated[list[str], typer.Option(help="Model to sample. Repeat for several.")],
    repeat: Annotated[int, typer.Option(help="Samples per model.")] = 3,
) -> None:
    """Sample the first breakdown attempt N times per model and report mean and spread.

    Live-model, deliberately outside the normal test gate. One analysis is reused across
    every sample so `analyze` cannot confound the comparison.
    """
    with run_context() as (graph, deps):
        snapshot = graph.get_state({"configurable": {"thread_id": run_id}})  # type: ignore[attr-defined]

    if not snapshot.values:
        typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
        raise typer.Exit(1)

    state = PipelineState.model_validate(snapshot.values)
    if state.analysis is None or state.provenance is None:
        typer.secho(f"run {run_id} has no analysis to reuse", fg=typer.colors.RED)
        raise typer.Exit(1)

    typer.echo(f"book      : {state.provenance.title} ({state.chapter_count} chapters)")
    typer.echo(f"analysis  : reused from {run_id}, held constant across every sample")
    typer.echo("sampling  : first breakdown attempt only, no revision loop")
    typer.echo("")

    summaries = []
    for name in model:
        samples = run_samples(
            llm=deps.llm,
            model=name,
            repeat=repeat,
            title=state.provenance.title,
            author=state.provenance.author,
            chapter_titles=state.chapter_titles,
            analysis=state.analysis,
        )
        summaries.append(summarise(name, samples))

    header = (
        f"{'model':26s} {'n':>3s} {'429':>4s} {'bad':>4s} {'pass':>5s} "
        f"{'single (mean/min-max/sd)':>30s} {'sequential (mean/min-max/sd)':>32s} {'leaves':>7s}"
    )
    typer.echo(header)
    typer.echo("-" * len(header))
    for s in summaries:
        typer.echo(
            f"{s.model:26s} {s.samples:3d} {s.transport_failures:4d} "
            f"{s.parse_failures:4d} {s.pass_rate:5.0%} "
            f"{s.single_mean:8.2f} {s.single_min:.2f}-{s.single_max:.2f} sd{s.single_stdev:5.3f}   "
            f"{s.sequential_mean:8.2f} {s.sequential_min:.2f}-{s.sequential_max:.2f} "
            f"sd{s.sequential_stdev:5.3f}   {s.leaves_mean:6.1f}"
        )
    typer.echo("")
    for s in summaries:
        typer.echo(f"{s.model:26s} tokens {s.total_tokens:8,d}   usd {s.total_usd:.4f}")


@app.command("write-drafts")
def write_drafts(
    run_id: Annotated[str, typer.Option(help="The run whose Leaves should be written.")],
) -> None:
    """Write a finished run's Leaves into Payload as drafts.

    The same node the graph runs, invoked deliberately. It exists because a graph whose
    shape changes cannot reach threads that already terminated: a run that reached `END`
    before this node was added stays complete, and resuming it does nothing. Re-running is
    safe — the Track and Leaf ids are recorded in state, so a second invocation writes only
    what is missing.
    """
    from zoomout_pipeline.graph.cms_node import make_write_drafts_node

    with run_context() as (graph, deps):
        config = {"configurable": {"thread_id": run_id}}
        snapshot = graph.get_state(config)  # type: ignore[attr-defined]

        if not snapshot.values:
            typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
            raise typer.Exit(1)

        state = PipelineState.model_validate(snapshot.values)
        if not state.generated:
            typer.secho(f"run {run_id} has no generated Leaves to write", fg=typer.colors.RED)
            raise typer.Exit(1)

        result = make_write_drafts_node(deps)(state)
        graph.update_state(config, result)  # type: ignore[attr-defined]

    typer.secho(
        f"wrote Track {result['cms_track_id']} with {len(result['cms_leaf_ids'])} draft Leaves",
        fg=typer.colors.GREEN,
    )


@app.command("generate-assets")
def generate_assets(
    run_id: Annotated[str, typer.Option(help="The run whose Leaves should be illustrated.")],
    limit: Annotated[int, typer.Option(help="Stop after N Leaves. 0 means all.")] = 0,
) -> None:
    """Generate and attach assets for a run whose Leaves are already in Payload.

    A deliberate invocation rather than a graph node, for the reason WP17 established: adding
    a node cannot reach a thread that already reached `END`, and Track 42's run has. Doing it
    this way on purpose beats rediscovering it.

    Re-running is safe: a Leaf that already carries a diagram is skipped.
    """
    from zoomout_pipeline.assets.budget import BudgetExceededError, ImageBudget
    from zoomout_pipeline.assets.images import AnchorSet, ImageClient
    from zoomout_pipeline.cms.client import PayloadClient
    from zoomout_pipeline.graph.asset_nodes import (
        attach_assets,
        build_diagram,
        generate_candidates,
    )

    settings = get_settings()
    anchors = AnchorSet.load(settings.anchors_dir)
    if len(anchors) == 0:
        typer.secho(
            f"no anchor set at {settings.anchors_dir} — every image would be unconditioned "
            "and the library would not share a visual identity",
            fg=typer.colors.RED,
        )
        raise typer.Exit(1)

    with run_context() as (graph, deps):
        config = {"configurable": {"thread_id": run_id}}
        snapshot = graph.get_state(config)  # type: ignore[attr-defined]
        if not snapshot.values:
            typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
            raise typer.Exit(1)

        state = PipelineState.model_validate(snapshot.values)
        if not state.cms_leaf_ids:
            typer.secho(
                f"run {run_id} has no Leaves in Payload — run write-drafts first",
                fg=typer.colors.RED,
            )
            raise typer.Exit(1)

        client = deps.payload_client or PayloadClient(
            base_url=settings.payload_url,
            api_key=settings.payload_api_key,
        )
        images = ImageClient(project=settings.vertex_project, location=settings.vertex_location)
        budget = ImageBudget(max_images=settings.max_images_per_track, model=settings.image_model)
        assets = dict(state.cms_assets)

        keys = sorted(state.cms_leaf_ids, key=lambda k: int(k))
        if limit:
            keys = keys[:limit]

        typer.echo(f"{len(keys)} Leaves, {settings.scenario_candidates} candidates each")
        typer.echo(f"anchors: {len(anchors)} | budget: {budget.max_images} images\n")

        for key in keys:
            if key in assets:
                typer.echo(f"  leaf {key}: already has assets, skipped")
                continue

            # Ask Payload, not just local bookkeeping — the same reasoning `find_leaf`
            # already carries for the CMS write, and for the same reason.
            #
            # `cms_assets` used to be persisted once, after this whole loop. So a run killed
            # partway wrote every asset to Payload and recorded none of them, and the retry
            # regenerated all of it: WP20's first asset run hung at Leaf 11 of 18, and the
            # resume started again at Leaf 0, paying for images that already existed.
            #
            # That is the identical failure `write_drafts_to_cms` documents — interrupted at
            # Leaf 11 of 18, local state disagreeing with the CMS — in the one code path that
            # never got the fix. The incremental checkpoint below stops it recurring; this
            # check is what recovers a run whose bookkeeping is *already* lost, which no
            # amount of future checkpointing can help with.
            existing = client.get_leaf(state.cms_leaf_ids[key], draft=True)
            if ((existing.get("stickyNotes") or {}).get("diagram") or {}).get("url"):
                typer.echo(f"  leaf {key}: already illustrated in the CMS, skipped")
                assets[key] = {"recovered": True}
                graph.update_state(config, {"cms_assets": assets})  # type: ignore[attr-defined]
                continue

            record = state.generated[key]
            try:
                candidates = generate_candidates(
                    client=images,
                    record=record,
                    anchors=anchors,
                    model=settings.image_model,
                    count=settings.scenario_candidates,
                    budget=budget,
                )
            except BudgetExceededError as error:
                typer.secho(f"\nHALTED: {error}", fg=typer.colors.RED, bold=True)
                break

            diagram = build_diagram(llm=deps.llm, record=record, model=settings.diagram_model)
            assets[key] = attach_assets(
                client=client,
                leaf_id=state.cms_leaf_ids[key],
                diagram=diagram,
                candidates=candidates,
                order=record.order,
            )
            typer.echo(
                f"  leaf {key}: {len(candidates)} candidates"
                f"{', diagram' if diagram else ', no diagram'}"
            )

            # Checkpointed per Leaf, not once at the end. Images are the most expensive
            # thing this pipeline buys, and bookkeeping written only on a clean exit is
            # bookkeeping that is missing exactly when a retry needs it most.
            graph.update_state(config, {"cms_assets": assets})  # type: ignore[attr-defined]

    typer.secho(f"\n{budget.report()}", fg=typer.colors.GREEN, bold=True)


@app.command("review-track")
def review_track(
    run_id: Annotated[str, typer.Option(help="The run whose Leaves should be reviewed.")],
    limit: Annotated[int, typer.Option(help="Stop after N Leaves. 0 means all.")] = 0,
) -> None:
    """Run the answer-length check and editorial review over a run already in Payload.

    The third package in a row to hit the graph-shape problem: a run that already reached
    `END` cannot be reached by adding a node behind it, so — like `write-drafts` and
    `generate-assets` before it — this is a deliberate invocation over checkpointed state
    rather than a graph edge.

    The answer-length check runs once, over every generated Leaf, before anything else —
    it is a Track-level measurement and does not care which Leaf is reviewed first. Editorial
    review then runs per Leaf, and **one combined PATCH per Leaf** carries whatever this pass
    produced: a revised-text update when `revise` accepted a rewrite, the reviewer's advisory
    findings (WP15.4's `editorialFindings`), and — the first time this Leaf is reached, from
    WP18's own upload — its unattached image candidates (WP15.4's `imageCandidates`). One
    request rather than three separate draft-version writes for the same Leaf in the same
    pass. Never `gateTwoStatus`: that field is the human's alone, and nothing here can
    produce it — see `gate2_review_patch`.

    Re-running is safe: a Leaf already in `cms_reviews` is skipped.
    """
    from zoomout_pipeline.cms.client import PayloadClient
    from zoomout_pipeline.cms.mapper import gate2_review_patch, revised_leaf_patch
    from zoomout_pipeline.graph.answer_length_check import (
        MAX_LONGEST_CORRECT_RATIO,
        check_answer_length,
    )
    from zoomout_pipeline.graph.leaf_nodes import reload_passages
    from zoomout_pipeline.graph.review import review_and_revise

    with run_context() as (graph, deps):
        config = {"configurable": {"thread_id": run_id}}
        snapshot = graph.get_state(config)  # type: ignore[attr-defined]
        if not snapshot.values:
            typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
            raise typer.Exit(1)

        state = PipelineState.model_validate(snapshot.values)
        if not state.generated:
            typer.secho(f"run {run_id} has no generated Leaves to review", fg=typer.colors.RED)
            raise typer.Exit(1)

        settings = deps.settings
        client = deps.payload_client or PayloadClient(
            base_url=settings.payload_url, api_key=settings.payload_api_key
        )

        length_result = check_answer_length(list(state.generated.values()))
        typer.echo(
            f"answer-length check: {'PASS' if length_result.passed else 'FAIL'} — "
            f"{length_result.leaves_with_longest_correct} of {length_result.leaves_checked} "
            "Leaves have the longest option correct "
            f"({length_result.longest_correct_ratio:.0%}, limit {MAX_LONGEST_CORRECT_RATIO:.0%})"
        )
        if length_result.findings:
            typer.secho(length_result.feedback, fg=typer.colors.YELLOW)
        typer.echo("")

        reviews = dict(state.cms_reviews)
        generated = dict(state.generated)
        keys = sorted(state.generated, key=lambda k: int(k))
        if limit:
            keys = keys[:limit]

        for key in keys:
            if key in reviews:
                typer.echo(f"  leaf {key}: already reviewed, skipped")
                continue

            record = generated[key]
            passages = reload_passages(deps, record.passage_refs)
            outcome = review_and_revise(
                llm=deps.llm,
                record=record,
                passages=passages,
                review_model=settings.editorial_model,
                revise_model=settings.revise_model,
                max_attempts=settings.editorial_attempts,
            )
            generated[key] = outcome.record
            reviews[key] = {
                "findings": len(outcome.review.findings),
                "categories": sorted({f.category.value for f in outcome.review.findings}),
                "overall_note": outcome.review.overall_note,
                "revised": outcome.revised,
                "usd": round(outcome.total_cost.total_usd, 4),
            }

            leaf_id = state.cms_leaf_ids.get(key)
            wrote: list[str] = []
            if leaf_id is not None:
                patch: dict[str, Any] = {}
                if outcome.revised:
                    existing = client.get_leaf(leaf_id, draft=True)
                    patch.update(revised_leaf_patch(leaf=outcome.record.leaf, existing=existing))
                    wrote.append("revised text")

                candidates = (state.cms_assets.get(key) or {}).get("candidates")
                patch.update(
                    gate2_review_patch(findings=outcome.review.findings, candidates=candidates)
                )
                if "editorialFindings" in patch:
                    wrote.append("findings")
                if "imageCandidates" in patch:
                    wrote.append("candidates")

                if patch:
                    client.update_leaf_draft(leaf_id=leaf_id, patch=patch)

            typer.echo(
                f"  leaf {key}: {len(outcome.review.findings)} findings"
                f"{', ' + ', '.join(wrote) + ' written to CMS' if wrote else ''}"
            )

        graph.update_state(  # type: ignore[attr-defined]
            config, {"generated": generated, "cms_reviews": reviews}
        )

    total_usd = sum(r["usd"] for r in reviews.values())
    typer.secho(
        f"\n{len(reviews)} Leaves reviewed, ${total_usd:.4f}", fg=typer.colors.GREEN, bold=True
    )


@app.command("balance-distractors")
def balance_distractors(
    run_id: Annotated[str, typer.Option(help="The run whose Leaves should be rebalanced.")],
    dry_run: Annotated[
        bool, typer.Option(help="Measure and report without calling a model or writing.")
    ] = False,
) -> None:
    """Rewrite the wrong options of any Leaf whose correct answer is the longest.

    WP20 regenerated Track 42 and still measured the tell in 11 of 18 Leaves — better than
    the 15 of 18 that motivated the check, and still over the limit. `draft_leaf.md`
    already forbids it; the model complies about a third of the time it matters, because
    the correct option carries the Leaf's actual concept and nuance costs words.

    So this repairs the Leaves that show it rather than regenerating the Track: only the two
    wrong options change, they carry no citations, and the seven Leaves that already balance
    are left alone. See `graph/distractors.py`.

    Re-running is safe, and `--dry-run` measures without spending anything.
    """
    from zoomout_pipeline.cms.client import PayloadClient
    from zoomout_pipeline.graph.answer_length_check import (
        MAX_LONGEST_CORRECT_RATIO,
        check_answer_length,
    )
    from zoomout_pipeline.graph.distractors import correct_is_longest, rebalance_options

    with run_context() as (graph, deps):
        config = {"configurable": {"thread_id": run_id}}
        snapshot = graph.get_state(config)  # type: ignore[attr-defined]
        if not snapshot.values:
            typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
            raise typer.Exit(1)

        state = PipelineState.model_validate(snapshot.values)
        if not state.generated:
            typer.secho(f"run {run_id} has no generated Leaves", fg=typer.colors.RED)
            raise typer.Exit(1)

        settings = deps.settings
        before = check_answer_length(list(state.generated.values()))
        typer.echo(
            f"before: {before.leaves_with_longest_correct} of {before.leaves_checked} "
            f"({before.longest_correct_ratio:.0%}, limit {MAX_LONGEST_CORRECT_RATIO:.0%}) "
            f"— {'PASS' if before.passed else 'FAIL'}"
        )

        targets = sorted(
            (key for key, record in state.generated.items() if correct_is_longest(record.leaf)),
            key=int,
        )
        typer.echo(f"Leaves showing the tell: {[state.generated[k].order for k in targets]}\n")

        if dry_run:
            typer.secho("dry run — nothing called, nothing written", fg=typer.colors.YELLOW)
            return

        plan = {leaf.order: leaf.concept for leaf in state.plan.leaves} if state.plan else {}
        client = deps.payload_client or PayloadClient(
            base_url=settings.payload_url, api_key=settings.payload_api_key
        )

        generated = dict(state.generated)
        repaired: list[int] = []
        refused: list[int] = []

        for key in targets:
            record = generated[key]
            candidate, spend = rebalance_options(
                llm=deps.llm,
                leaf=record.leaf,
                concept=plan.get(record.order, record.title),
                model=settings.draft_model,
            )
            if candidate is None:
                refused.append(record.order)
                typer.secho(
                    f"  Leaf {record.order}: unchanged (rewrite did not help)",
                    fg=typer.colors.YELLOW,
                )
                continue

            generated[key] = record.model_copy(update={"leaf": candidate})
            repaired.append(record.order)

            leaf_id = state.cms_leaf_ids.get(key)
            if leaf_id is not None:
                # Only the options. Everything else on this Leaf — grounded prose, source
                # references, a human's gate-2 image pick — is untouched by construction
                # rather than by a read-modify-write that has to remember not to.
                client.update_leaf_draft(
                    leaf_id=leaf_id,
                    patch={
                        "scenario": {
                            "prompt": candidate.scenario_prompt,
                            "options": [
                                {"text": option.text, "isCorrect": option.is_correct}
                                for option in candidate.scenario_options
                            ],
                        }
                    },
                )
            typer.secho(f"  Leaf {record.order}: rebalanced", fg=typer.colors.GREEN)
            _echo_cost_line(spend)

        graph.update_state(config, {"generated": generated})  # type: ignore[attr-defined]

        after = check_answer_length(list(generated.values()))
        typer.echo(
            f"\nafter : {after.leaves_with_longest_correct} of {after.leaves_checked} "
            f"({after.longest_correct_ratio:.0%}, limit {MAX_LONGEST_CORRECT_RATIO:.0%}) "
            f"— {'PASS' if after.passed else 'FAIL'}"
        )
        typer.echo(f"repaired: {repaired}")
        if refused:
            typer.secho(f"still showing the tell: {refused}", fg=typer.colors.YELLOW)


def _echo_cost_line(spend: Any) -> None:
    typer.echo(f"      {spend.total_tokens} tokens, ${spend.usd:.4f}")


@app.command("purge-raw-text")
def purge_raw_text(
    run_id: Annotated[str, typer.Option(help="The run whose book should be purged.")],
) -> None:
    """Delete the book's raw text, keeping embeddings, provenance and cited passages.

    R6's retention rule. Wired to a command now and to the terminal node in WP20 — the
    natural end of a run has not arrived while the graph stops at gate 1, and deferring the
    mechanism until it does is how it never gets built.
    """
    with run_context() as (graph, _deps):
        snapshot = graph.get_state({"configurable": {"thread_id": run_id}})  # type: ignore[attr-defined]

    if not snapshot.values:
        typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
        raise typer.Exit(1)

    state = PipelineState.model_validate(snapshot.values)
    if state.book_id is None:
        typer.secho(f"run {run_id} never ingested a book", fg=typer.colors.RED)
        raise typer.Exit(1)

    with connect() as conn:
        result = BookRepository(conn).purge_raw_text(UUID(state.book_id))

    typer.echo(f"raw text rows deleted : {result.raw_text_rows_deleted}")
    typer.echo(f"chunk texts cleared   : {result.chunk_texts_cleared}")
    typer.echo(f"embeddings retained   : {result.embeddings_retained}")
    typer.echo(f"cited passages kept   : {result.cited_passages_retained}")


def _report(result: dict[str, Any], *, run_id: str) -> None:
    interrupts = result.get("__interrupt__")
    if interrupts:
        payload = interrupts[0].value if hasattr(interrupts[0], "value") else interrupts[0]
        typer.secho("\nPAUSED AT HUMAN GATE 1", fg=typer.colors.YELLOW, bold=True)
        typer.echo(json.dumps(payload, indent=2, default=str))
        return

    state = PipelineState.model_validate(result)
    typer.secho(
        f"\nrun {run_id} complete — {len(state.plan.leaves) if state.plan else 0} Leaves approved",
        fg=typer.colors.GREEN,
        bold=True,
    )
    _echo_cost(state)


def _echo_cost(state: PipelineState, *, verbose: bool = False) -> None:
    typer.echo(f"tokens     : {state.cost.total_tokens:,}")
    typer.echo(f"cost (USD) : {state.cost.total_usd:.4f}")
    if state.cost.unpriced_models:
        typer.echo(f"unpriced   : {', '.join(sorted(state.cost.unpriced_models))}")
    if verbose:
        for node, usd in state.cost.by_node().items():
            typer.echo(f"  {node:12s} ${usd:.4f}")


def _redact(url: str) -> str:
    if "@" not in url:
        return url
    scheme, _, rest = url.partition("://")
    _credentials, _, host = rest.partition("@")
    return f"{scheme}://***@{host}"


if __name__ == "__main__":  # pragma: no cover
    sys.exit(app())
