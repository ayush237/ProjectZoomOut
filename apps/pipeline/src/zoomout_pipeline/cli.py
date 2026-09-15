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
    title: Annotated[
        str | None, typer.Option(help="The book's title, when the file does not carry one.")
    ] = None,
    author: Annotated[
        str | None,
        typer.Option(help="The book's author. Required in practice for PDFs — see below."),
    ] = None,
    cms_track_id: Annotated[
        int | None,
        typer.Option(help="Write into an existing Track instead of creating a new one."),
    ] = None,
) -> None:
    """Ingest, analyze, break down, and stop at the human gate.

    **Pass `--author` for a PDF.** EPUBs carry metadata; PDFs routinely do not, and the
    parser's fallback is the filename and the literal string "Unknown". That string does not
    stay in the database: it reaches the draft prompts, where the model is asked to attribute
    the book's claims to an author called Unknown, and it reaches the Track's `author` field,
    where it breaks the attribution the fair-use position depends on. The CMS write refuses
    it, so a book ingested without one has to be re-ingested rather than patched.

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
        book_title=title,
        book_author=author,
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
    save_dir: Annotated[
        str, typer.Option(help="Also write every candidate here, as it is generated.")
    ] = "",
) -> None:
    """Generate and attach assets for a run whose Leaves are already in Payload.

    A deliberate invocation rather than a graph node, for the reason WP17 established: adding
    a node cannot reach a thread that already reached `END`, and Track 42's run has. Doing it
    this way on purpose beats rediscovering it.

    Re-running is safe: a Leaf that already carries a diagram is skipped.
    """
    from zoomout_pipeline.assets.budget import BudgetExceededError, ImageBudget
    from zoomout_pipeline.assets.images import AnchorSet, ImageClient, save_candidates
    from zoomout_pipeline.cms.client import PayloadClient
    from zoomout_pipeline.graph.asset_nodes import (
        attach_assets,
        build_diagram,
        generate_candidates,
    )
    from zoomout_pipeline.graph.scene_settings import derive_scene_plan

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

        # Where every Leaf's picture happens, decided once for the whole Track before a single
        # image is bought — **over every Leaf, not only the ones this invocation will draw.**
        # A `--limit` run that planned only its own slice would hand the rest of the Track a
        # second, independently-derived set of places, and two half-plans that never saw each
        # other are how a Track collapses in the first place.
        records = [state.generated[key] for key in sorted(state.generated, key=lambda k: int(k))]
        scene_plan = state.scene_plan
        if scene_plan is not None and {s.order for s in scene_plan.settings} >= {
            state.generated[key].order for key in keys
        }:
            typer.echo(f"scene plan: reusing {len(scene_plan.settings)} settings from this run")
        else:
            scene_plan, scene_spends = derive_scene_plan(
                llm=deps.llm, records=records, model=settings.draft_model
            )
            for spend in scene_spends:
                state.cost.record(spend)
            graph.update_state(  # type: ignore[attr-defined]
                config, {"scene_plan": scene_plan, "cost": state.cost}
            )
            typer.echo(f"scene plan: derived {len(scene_plan.settings)} settings")
        by_order = scene_plan.by_order()

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
                    setting=by_order[record.order],
                    anchors=anchors,
                    model=settings.image_model,
                    count=settings.scenario_candidates,
                    budget=budget,
                )
            except BudgetExceededError as error:
                typer.secho(f"\nHALTED: {error}", fg=typer.colors.RED, bold=True)
                break

            # On disk before Payload, and before the diagram call that could raise. An image
            # that exists only inside a run that then fails is an image that was paid for
            # and lost — which is what happened to WP30's before/after set.
            if save_dir:
                save_candidates(Path(save_dir), order=record.order, candidates=candidates)

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
                f"  [{by_order[record.order].place}]"
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


@app.command("rewrite-leaf")
def rewrite_leaf_command(
    run_id: Annotated[str, typer.Option(help="The run the Leaf belongs to.")],
    order: Annotated[int, typer.Option(help="Which Leaf, by its order in the Track.")],
    brief: Annotated[str, typer.Option(help="YAML brief: findings, forbidden phrases.")],
    keep_extras: Annotated[
        bool, typer.Option(help="Leave the Dinner Table fact and apply-in-life alone.")
    ] = False,
    dry_run: Annotated[
        bool, typer.Option(help="Rewrite and print, writing to neither the CMS nor the run.")
    ] = False,
) -> None:
    """Rewrite one finished Leaf against findings a human wrote down.

    For the defect no gate in this pipeline can see. Ikigai's Leaf 17 listed five of the
    book's ten rules of ikigai in the book's own imperative phrasing, and passed the
    structure check (which measures chapter mapping), grounding (every rule was cited) and
    editorial review (whose four categories have no member for it). The findings therefore
    come from a person; everything after that is the machinery `review.py` already has,
    including discarding a rewrite that does not still pass grounding.

    **Re-running is safe and costs money.** Unlike the other deliberate invocations there is
    no skip-if-done check, because "already rewritten" is not a state this can read — the
    brief is what decides whether the Leaf needs it. `--dry-run` spends the model calls and
    writes nothing, which is the cheap way to look before committing.
    """
    from zoomout_pipeline.cms.client import PayloadClient
    from zoomout_pipeline.cms.mapper import rewritten_leaf_patch
    from zoomout_pipeline.graph.leaf_nodes import reload_passages
    from zoomout_pipeline.graph.rewrite import brief_summary, load_brief, rewrite_leaf

    brief_path = Path(brief)
    loaded = load_brief(brief_path)
    typer.echo(f"brief: {brief_path} — {json.dumps(brief_summary(loaded))}\n")

    with run_context() as (graph, deps):
        config = {"configurable": {"thread_id": run_id}}
        snapshot = graph.get_state(config)  # type: ignore[attr-defined]
        if not snapshot.values:
            typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
            raise typer.Exit(1)

        state = PipelineState.model_validate(snapshot.values)
        key = str(order)
        record = state.generated.get(key)
        if record is None:
            typer.secho(f"run {run_id} has no generated Leaf {order}", fg=typer.colors.RED)
            raise typer.Exit(1)

        # The concept from the approved plan, not from the Leaf's own prose. `extra_content`
        # is told what the Leaf teaches, and after a rewrite the Leaf's text is the thing
        # under repair — reading the concept back out of it would feed the defect forward.
        planned = next(
            (leaf for leaf in (state.plan.leaves if state.plan else []) if leaf.order == order),
            None,
        )
        concept = planned.concept if planned is not None else record.title

        passages = reload_passages(deps, record.passage_refs)
        if not passages:
            typer.secho(
                f"Leaf {order} has no retrievable passages — its cited chunks may have been "
                "purged. A rewrite cannot be grounded without them.",
                fg=typer.colors.RED,
            )
            raise typer.Exit(1)
        typer.echo(f"passages: {', '.join(p.ref + ' -> ' + str(p.chunk_id) for p in passages)}")

        settings = deps.settings
        outcome = rewrite_leaf(
            llm=deps.llm,
            record=record,
            passages=passages,
            brief=loaded,
            revise_model=settings.revise_model,
            extras_model=settings.extras_model,
            concept=concept,
            with_extras=not keep_extras,
        )

        typer.echo(
            f"revised: {outcome.revised} | extras replaced: {outcome.extras_replaced} | "
            f"${outcome.total_cost.total_usd:.4f}"
        )
        _echo_leaf(outcome.record)

        if outcome.survivors:
            typer.secho("\nFORBIDDEN PHRASING SURVIVED:", fg=typer.colors.RED, bold=True)
            for where, phrase in outcome.survivors:
                typer.secho(f"  {where}: {phrase!r}", fg=typer.colors.RED)
        elif loaded.forbidden_phrases:
            typer.secho(
                f"\nnone of the {len(loaded.forbidden_phrases)} forbidden phrasings survive "
                "— which is not the same as the rewrite being right. Read it.",
                fg=typer.colors.YELLOW,
            )

        if outcome.grounding_failures:
            typer.secho(
                f"\ngrounding rejected {outcome.attempts} attempt(s):",
                fg=typer.colors.RED,
                bold=True,
            )
            for failure in outcome.grounding_failures:
                typer.secho(f"  - {failure}", fg=typer.colors.RED)

        if not outcome.revised:
            # The calls were still made and still cost money. Recording that before exiting
            # is the difference between a run ledger and a guess: the first version of this
            # command exited here without writing the spend, so the money it had just spent
            # existed only in a terminal scrollback.
            _record_rewrite_cost(graph, config, state, outcome)
            typer.secho(
                "\nthe rewrite was discarded for failing grounding; the original Leaf "
                "stands and nothing was written",
                fg=typer.colors.RED,
                bold=True,
            )
            raise typer.Exit(1)

        if dry_run:
            typer.secho(
                "\ndry run — neither the CMS nor the run was written", fg=typer.colors.YELLOW
            )
            return

        leaf_id = state.cms_leaf_ids.get(key)
        if leaf_id is not None:
            client = deps.payload_client or PayloadClient(
                base_url=settings.payload_url, api_key=settings.payload_api_key
            )
            # Fetched immediately before the patch, never from memory: the patch carries
            # each group whole, so what it carries forward has to be what Payload holds now.
            existing = client.get_leaf(leaf_id, draft=True)
            client.update_leaf_draft(
                leaf_id=leaf_id,
                patch=rewritten_leaf_patch(
                    record=outcome.record,
                    existing=existing,
                    passages={p.chunk_id: p for p in passages},
                ),
            )
            typer.echo(f"\nLeaf {order} (CMS id {leaf_id}) updated as a draft")

        generated = dict(state.generated)
        generated[key] = outcome.record
        # The editorial verdict recorded against this Leaf described the text that has just
        # been replaced. Dropping it says "not reviewed since" rather than leaving a stale
        # pass attached to prose no reviewer has read.
        reviews = {k: v for k, v in state.cms_reviews.items() if k != key}
        for spend in outcome.spend:
            state.cost.record(spend)
        graph.update_state(  # type: ignore[attr-defined]
            config,
            {"generated": generated, "cms_reviews": reviews, "cost": state.cost},
        )

    typer.secho(
        f"\nLeaf {order} rewritten. Its editorial review was cleared — re-run review-track "
        "to review the new text.",
        fg=typer.colors.GREEN,
        bold=True,
    )


def _record_rewrite_cost(graph: Any, config: Any, state: Any, outcome: Any) -> None:
    """Write a rewrite's spend into the run ledger, whether or not it produced anything.

    A rejected attempt is not a free attempt. Cost is recorded per node, per Leaf, per run
    precisely so that the answer to "what did this Track cost" does not depend on which
    invocations happened to succeed.
    """
    for spend in outcome.spend:
        state.cost.record(spend)
    graph.update_state(config, {"cost": state.cost})


def _echo_leaf(record: Any) -> None:
    """The rewritten Leaf, in full, because reading it is the actual gate."""
    leaf = record.leaf
    typer.echo("\n" + "=" * 78)
    typer.echo(f"Leaf {record.order} — {record.title}\n")
    typer.echo(f"SUMMARY\n  {leaf.summary_body}\n")
    typer.echo(f"SCENARIO\n  {leaf.scenario_prompt}")
    for option in leaf.scenario_options:
        typer.echo(f"  [{'x' if option.is_correct else ' '}] {option.text}")
    typer.echo(f"\nPAYOFF\n  {leaf.payoff_body}\n")
    typer.echo("STICKY NOTES")
    for note in leaf.sticky_notes:
        typer.echo(f"  - {note}")
    typer.echo(f"\nTAKEAWAY\n  {leaf.takeaway_body}")
    typer.echo(f"\n  dinner table: {record.extras.dinner_table_knowledge or '(none)'}")
    typer.echo(f"  apply in life: {record.extras.apply_in_life or '(none)'}")
    typer.echo("\nCLAIMS")
    for claim in [*leaf.claims, *record.extras.claims]:
        for citation in claim.citations:
            quote = f' | "{citation.quote[:60]}…"' if citation.quote else ""
            typer.echo(
                f"  [{claim.slide_key.value}] {claim.text[:70]}\n"
                f"      {citation.passage_ref} — {citation.note[:80]}{quote}"
            )
    typer.echo("=" * 78)


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

        after = check_answer_length(list(generated.values()))

        # The re-measurement is checkpointed alongside the repaired Leaves, not just
        # printed. `answer_length_check` ran before this command existed and recorded the
        # Track as failing; leaving that in state would have `status` report a Track that
        # now passes as one that does not — and the stale number is the one a later reader
        # would trust, because it is the one the *run* produced.
        #
        # This is a fresh measurement of the current Leaves, not an edit of the old verdict.
        # The run did fail at that point, and the commit history says so.
        graph.update_state(  # type: ignore[attr-defined]
            config, {"generated": generated, "answer_length": after}
        )

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


@app.command("attach-scenario-images")
def attach_scenario_images(
    track_id: Annotated[int, typer.Option(help="The Track whose Leaves should be illustrated.")],
    dry_run: Annotated[
        bool, typer.Option(help="Choose and report without writing anything.")
    ] = False,
) -> None:
    """Attach one scenario candidate per Leaf, as drafts, for the founder to review.

    WP20 published Track 42 with diagrams and no scenario illustrations, because choosing
    was WP15.7's affordance and it had not landed. The founder has delegated selection **for
    this Track only** — later books they choose themselves — so this produces a list to
    override rather than a set of decisions already made.

    Takes the Track directly rather than a run id: this is a correction to what is in the
    CMS, and tying it to a checkpoint would make it useless for any Track whose run has been
    archived.

    **Writes drafts.** The Leaves are published; the machine key cannot edit a live document
    and does not gain the ability here. Each write lands as a pending draft version and the
    published Leaf still shows no image until a human publishes it.
    """
    from zoomout_pipeline.assets.selection import (
        choose_candidate,
        scenario_patch,
        verify_siblings,
    )
    from zoomout_pipeline.cms.client import PayloadClient

    settings = get_settings()
    client = PayloadClient(base_url=settings.payload_url, api_key=settings.payload_api_key)

    leaves = client.list_leaves(track_id=track_id)
    if not leaves:
        typer.secho(f"Track {track_id} has no Leaves", fg=typer.colors.RED)
        raise typer.Exit(1)

    typer.echo(f"Track {track_id}: {len(leaves)} Leaves\n")

    choices = [
        choose_candidate(
            client=client,
            leaf=leaf,
            order=int(leaf.get("orderIndex", 0)),
            title=str(leaf.get("title", "")),
            leaf_id=int(leaf["id"]),
        )
        for leaf in leaves
    ]

    if dry_run:
        _echo_choices(choices)
        typer.secho("\ndry run — nothing written", fg=typer.colors.YELLOW)
        return

    by_id = {int(leaf["id"]): leaf for leaf in leaves}
    failures: list[int] = []

    for choice in choices:
        if not choice.chosen:
            continue

        before = by_id[choice.leaf_id]
        assert choice.url is not None and choice.alt is not None
        client.update_leaf_draft(
            leaf_id=choice.leaf_id,
            patch=scenario_patch(leaf=before, url=choice.url, alt=choice.alt),
        )

        # Re-fetched, not read from the PATCH response. WP19 nulled this group's siblings
        # by hand and the response looked fine; what Payload stored is the only evidence.
        after = client.get_leaf(choice.leaf_id, draft=True)
        check = verify_siblings(before=before, after=after, order=choice.order)
        if not check.passed:
            failures.append(choice.order)
            typer.secho(
                f"  Leaf {choice.order}: SIBLINGS DAMAGED — "
                f"prompt {'ok' if check.prompt_intact else 'LOST'}, "
                f"options {'ok' if check.options_intact else 'LOST'}",
                fg=typer.colors.RED,
                bold=True,
            )

    _echo_choices(choices)

    if failures:
        typer.secho(
            f"\nSTOP: the scenario group was damaged on Leaves {failures}. "
            "Restore them before anyone publishes.",
            fg=typer.colors.RED,
            bold=True,
        )
        raise typer.Exit(1)

    written = sum(1 for c in choices if c.chosen)
    typer.secho(
        f"\n{written} Leaves illustrated as drafts; prompt and options verified intact on "
        "every one. Nothing published.",
        fg=typer.colors.GREEN,
        bold=True,
    )


def _echo_choices(choices: list[Any]) -> None:
    """The founder's review list — this is the deliverable, not a progress log."""
    typer.echo("\n  leaf  cand  title / alt")
    typer.echo("  " + "-" * 92)
    for choice in choices:
        index = str(choice.index) if choice.index is not None else "-"
        typer.echo(f"  {choice.order:>4}  {index:>4}  {choice.title[:70]}")
        detail = choice.alt if choice.alt else f"({choice.reason})"
        typer.echo(f"              {detail[:86]}")


@app.command("check-variety")
def check_variety_command(
    track_id: Annotated[int, typer.Option(help="A Payload Track to measure.")] = 0,
    directory: Annotated[
        str, typer.Option("--dir", help="A directory of PNGs to measure instead of a Track.")
    ] = "",
) -> None:
    """Whether a Track's scenario illustrations are actually different pictures.

    **Measures the pictures, not the settings the run wrote down.** A place label can say
    "construction site" over a rendering of a desk, so the labels are printed as a supporting
    signal and the verdict comes from composition — see `assets/variety.py` for why that is
    edge density and nearest-neighbour distance rather than the two more obvious choices.

    Exits non-zero on a collapsed set, so it can gate something. It cannot un-spend the images
    it is looking at; what it can do is stop a collapsed Track reaching a human as though
    nothing were wrong, which is what happened to Track 42.

    `--dir` takes the same measurement over a folder of PNGs, which is what makes a
    before/after comparable without going through the CMS.
    """
    from zoomout_pipeline.assets.variety import NEAR_DUPLICATE_DISTANCE, check_variety

    if bool(track_id) == bool(directory):
        typer.secho("give exactly one of --track-id or --dir", fg=typer.colors.RED)
        raise typer.Exit(2)

    labels: list[str]

    if directory:
        paths = sorted(Path(directory).glob("*.png"))
        if not paths:
            typer.secho(f"no PNGs in {directory}", fg=typer.colors.RED)
            raise typer.Exit(1)
        images = [path.read_bytes() for path in paths]
        labels = [path.stem for path in paths]
    else:
        from zoomout_pipeline.cms.client import PayloadClient

        settings = get_settings()
        client = PayloadClient(base_url=settings.payload_url, api_key=settings.payload_api_key)
        leaves = client.list_leaves(track_id=track_id)
        images, labels = [], []
        for leaf in leaves:
            scenario = leaf.get("scenario") or {}
            url = ((scenario.get("image") or {}).get("url")) or ""
            source = "chosen"
            if not url:
                candidates = leaf.get("imageCandidates") or []
                url = (candidates[0] or {}).get("url", "") if candidates else ""
                source = "candidate 0"
            if not url:
                typer.echo(f"  leaf {leaf.get('orderIndex')}: no image, skipped")
                continue
            images.append(client.fetch_media(url))
            labels.append(f"{leaf.get('orderIndex')} ({source})")

    if len(images) < 2:
        typer.secho(f"only {len(images)} images — nothing to compare", fg=typer.colors.YELLOW)
        raise typer.Exit(1)

    report = check_variety(images)
    typer.echo("")
    typer.secho(
        report.summary(),
        fg=typer.colors.RED if report.collapsed else typer.colors.GREEN,
        bold=True,
    )

    typer.echo("\n  image                          nearest neighbour   distance")
    typer.echo("  " + "-" * 64)
    for index, partner, distance in report.nearest_by_index:
        flag = "  <-- same picture" if distance < NEAR_DUPLICATE_DISTANCE else ""
        typer.echo(f"  {labels[index][:28]:<30} {labels[partner][:18]:<18} {distance:>7.3f}{flag}")

    if report.collapsed:
        typer.secho(
            "\nThis set has collapsed: most of these images have a near twin. Regenerate "
            "rather than choosing between them.",
            fg=typer.colors.RED,
            bold=True,
        )
        raise typer.Exit(1)


@app.command("contact-sheet")
def contact_sheet_command(
    directory: Annotated[str, typer.Option("--dir", help="A directory of PNGs, in Leaf order.")],
    out: Annotated[str, typer.Option(help="Where to write the sheet.")] = "",
    columns: Annotated[int, typer.Option(help="Images per row.")] = 3,
) -> None:
    """One image of a whole Track's illustrations, to look at.

    The companion to `check-variety` and not a substitute for it: that measures whether every
    picture has a near twin, this shows a person what the pictures actually are. Text in a
    frame, a light bloom and a hand attached to nobody are all absolute prohibitions that no
    mechanical gate in this service catches, and all three have shipped.
    """
    from zoomout_pipeline.assets.contact_sheet import write_contact_sheet

    paths = sorted(Path(directory).glob("*.png"))
    if not paths:
        typer.secho(f"no PNGs in {directory}", fg=typer.colors.RED)
        raise typer.Exit(1)

    destination = Path(out) if out else Path(directory) / "contact-sheet.png"
    # A sheet written into the directory it is built from would be picked up as an input the
    # next time this runs, so a rebuild would tile the previous sheet into the new one.
    paths = [path for path in paths if path.resolve() != destination.resolve()]
    if not paths:
        typer.secho(f"no PNGs in {directory} other than {destination.name}", fg=typer.colors.RED)
        raise typer.Exit(1)

    written = write_contact_sheet(paths, destination, columns=columns)
    typer.secho(f"{len(paths)} images -> {written}", fg=typer.colors.GREEN, bold=True)


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
