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

from zoomout_pipeline.config import (
    FreeTierForbiddenError,
    NarrationTransportError,
    get_settings,
    require_cloud_tts,
    require_paid_tier,
)
from zoomout_pipeline.db.engine import ForeignDatabaseError, connect, describe_database
from zoomout_pipeline.db.repository import BookRepository
from zoomout_pipeline.db.schema import apply_schema
from zoomout_pipeline.graph.state import PipelineState
from zoomout_pipeline.logging import configure_logging, get_logger
from zoomout_pipeline.measure import run_samples, summarise
from zoomout_pipeline.models import Acquisition, TransportRecord
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


def read_run_state(graph: Any, run_id: str) -> PipelineState:
    """A run's checkpoint, for a command that will not call a model.

    **Deliberately does not enforce the paid-tier constraint**, so `status` and `cost` stay
    usable for diagnosing a run whose environment is currently misconfigured. Nothing here
    reaches a model, so there is nothing to refuse.
    """
    snapshot = graph.get_state({"configurable": {"thread_id": run_id}})
    if not snapshot.values:
        typer.secho(f"no checkpoint for run {run_id}", fg=typer.colors.RED)
        raise typer.Exit(1)
    return PipelineState.model_validate(snapshot.values)


def open_run_for_models(graph: Any, run_id: str) -> PipelineState:
    """A run's checkpoint, for a command that *will* call a model.

    **The one place the paid-tier constraint is enforced on an existing run**, and the reason
    it is a named helper rather than four lines copied into each command: this project's
    recurring defect is a guard that exists in one place and was never carried to its twin,
    and seven commands load a checkpoint before calling a model. A test asserts that no
    command validates a checkpoint outside these two helpers.

    The refusal happens here — before the first node runs, before the first image is bought —
    because a run that dies at Leaf 9 with a quota error has already sent eight Leaves' worth
    of somebody else's book somewhere it must not go.

    The decision is written back onto the run, so "which tier did this book go through" is a
    query rather than a memory.
    """
    state = read_run_state(graph, run_id)
    try:
        record = require_paid_tier(state.acquisition, get_settings())
    except FreeTierForbiddenError as refusal:
        typer.secho(f"\n{refusal}\n", fg=typer.colors.RED, bold=True)
        raise typer.Exit(2) from None

    if state.transport is not None and state.transport.transport != record.transport:
        # Not an error: a run legitimately moves between tiers if its book is public domain.
        # It is worth saying out loud, because a run whose transport changed halfway is a run
        # whose single recorded value no longer describes all of it.
        typer.secho(
            f"note: this run previously used {state.transport.transport.value}, now "
            f"{record.transport.value}",
            fg=typer.colors.YELLOW,
        )

    graph.update_state({"configurable": {"thread_id": run_id}}, {"transport": record})
    state.transport = record
    _log.info(
        "run.transport",
        run_id=run_id,
        transport=record.transport.value,
        project=record.project or None,
        acquisition=record.acquisition.value,
    )
    return state


def open_run_for_narration(graph: Any, run_id: str) -> tuple[PipelineState, TransportRecord]:
    """A run's checkpoint, for a command that will speak its Leaves — and the second door.

    **`open_run_for_models` first, not instead.** Narration also calls Gemini, to listen to
    what it made, so the paid-tier constraint applies exactly as it does anywhere else. Then
    the Cloud TTS transport is decided by its own check, because the paid-tier check has
    never heard of it. Both happen before a client exists.

    Returns the state and the narration `TransportRecord`, still without its `endpoint`: that
    is read off the constructed client by the caller, and only then written to the run.
    """
    state = open_run_for_models(graph, run_id)
    try:
        record = require_cloud_tts(state.acquisition, get_settings())
    except NarrationTransportError as refusal:
        typer.secho(f"\n{refusal}\n", fg=typer.colors.RED, bold=True)
        raise typer.Exit(2) from None
    return state, record


def record_narration_transport(
    graph: Any, run_id: str, record: TransportRecord, endpoint: str
) -> TransportRecord:
    """Write the narration door onto the run, with the endpoint the client really reached."""
    completed = record.model_copy(update={"endpoint": endpoint})
    graph.update_state({"configurable": {"thread_id": run_id}}, {"narration_transport": completed})
    _log.info(
        "run.narration_transport",
        run_id=run_id,
        transport=completed.transport.value,
        project=completed.project,
        model=completed.model,
        endpoint=completed.endpoint,
    )
    return completed


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

    # **Before anything is built, let alone called.** `run` ingests, embeds and analyses, so
    # the first model call is minutes away and the first *chunk of the book* leaves this
    # machine inside it. A check that fired after `run_context()` would already have chosen
    # the client; one that fired inside a node would already have sent the book.
    try:
        transport = require_paid_tier(acquisition, get_settings())
    except FreeTierForbiddenError as refusal:
        # Rendered rather than raised, so the operator reads the fix instead of a traceback.
        # The exit code is what a script or a CI step will actually look at.
        typer.secho(f"\n{refusal}\n", fg=typer.colors.RED, bold=True)
        raise typer.Exit(2) from None
    typer.echo(
        f"transport  : {transport.transport.value}"
        + (f" ({transport.project})" if transport.project else "")
        + f" — acquisition {acquisition.value}"
    )

    state = PipelineState(
        run_id=resolved_run_id,
        source_path=str(source),
        acquisition=acquisition,
        book_title=title,
        book_author=author,
        cms_track_id=cms_track_id,
        transport=transport,
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
        open_run_for_models(graph, run_id)
        snapshot = graph.get_state(config)  # type: ignore[attr-defined]

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
        state = read_run_state(graph, run_id)
        snapshot = graph.get_state(config)  # type: ignore[attr-defined]

    typer.echo(f"run        : {state.run_id}")
    typer.echo(f"next       : {snapshot.next or '(complete)'}")
    if state.transport is not None:
        where = state.transport.transport.value
        typer.echo(
            f"transport  : {where}"
            + (f" ({state.transport.project})" if state.transport.project else "")
        )
    else:
        typer.echo("transport  : (not recorded — run predates WP32)")
    if state.narration_transport is not None:
        spoken = state.narration_transport
        typer.echo(
            f"narration  : {spoken.transport.value} ({spoken.project}) via {spoken.endpoint} "
            f"— {spoken.model}"
        )
    typer.echo(f"acquisition: {state.acquisition.value}")
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
        state = read_run_state(graph, run_id)
    _echo_cost(state, verbose=True)


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
        state = open_run_for_models(graph, run_id)

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
        # `read_run_state`, not `open_run_for_models`: this maps already-generated Leaves into
        # Payload and calls no model, so there is no transport to refuse. Writing drafts for a
        # copyrighted book must not require Vertex to be configured.
        state = read_run_state(graph, run_id)
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
    from zoomout_pipeline.assets.style_guard import GuardResult, check_style
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
        state = open_run_for_models(graph, run_id)
        if not state.cms_leaf_ids:
            typer.secho(
                f"run {run_id} has no Leaves in Payload — run write-drafts first",
                fg=typer.colors.RED,
            )
            raise typer.Exit(1)

        client = deps.payload_client or PayloadClient(
            base_url=settings.payload_url,
            api_key=settings.payload_api_key.get_secret_value(),
        )
        images = ImageClient(project=settings.vertex_project, location=settings.vertex_location)
        budget = ImageBudget(max_images=settings.max_images_per_track, model=settings.image_model)
        assets = dict(state.cms_assets)

        # Every candidate is read before it is kept. Three prohibitions in the style contract
        # are invisible to every other gate here, all three have shipped, and this is the
        # cheapest place to see them — the image is paid for either way, but a refusal costs
        # one regeneration instead of a published Leaf the machine account cannot edit.
        guard_spend: list[float] = []
        refused: dict[str, GuardResult] = {}

        def guard(data: bytes) -> GuardResult:
            verdict = check_style(llm=deps.llm, data=data, model=settings.analyze_model)
            guard_spend.append(verdict.spend.usd)
            return verdict

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

        missing_images: list[str] = []

        for key in keys:
            # **Keyed on the image, not on "has assets".** Both of these checks used to ask
            # whether the Leaf had a *diagram*, and a diagram is a four-tenths-of-a-cent text
            # call while the image is the most expensive thing this pipeline buys. WP30.1's
            # run lost Leaf 8's image to a read timeout; `generate_candidates` logged the
            # refusal and carried on, `attach_assets` still wrote the diagram, and both skip
            # checks then read that diagram and called the Leaf done. A re-run would have
            # skipped straight past the one Leaf with no picture.
            #
            # Same failure WP20 hit at Leaf 11 of 18, in the sibling of the code that was
            # fixed for it. Cost of getting this wrong in the other direction is one $0.004
            # diagram regenerated; cost of getting it wrong this way is a Track shipped with
            # a hole in it that nothing reports.
            recorded = assets.get(key) or {}
            if recorded.get("candidates") or recorded.get("recovered"):
                typer.echo(f"  leaf {key}: already illustrated, skipped")
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
            chosen = ((existing.get("scenario") or {}).get("image") or {}).get("url")
            if existing.get("imageCandidates") or chosen:
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
                    guard=guard,
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
            if not candidates:
                missing_images.append(key)
            else:
                # Re-read the kept candidate rather than trusting the loop's bookkeeping:
                # `generate_candidates` returns an image that never passed rather than
                # leaving the Leaf blank, and which of those two happened is exactly what
                # the person reading this output needs to know.
                final = guard(candidates[0][0])
                if not final.passed:
                    refused[key] = final
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
    if guard_spend:
        typer.secho(
            f"style guard: {len(guard_spend)} reads, ${sum(guard_spend):.4f}",
            fg=typer.colors.GREEN,
        )
    if refused:
        typer.secho(
            f"\n{len(refused)} Leaves kept an image the style guard refused:",
            fg=typer.colors.RED,
            bold=True,
        )
        for key, verdict in sorted(refused.items(), key=lambda kv: int(kv[0])):
            typer.secho(f"  leaf {key}:", fg=typer.colors.RED, bold=True)
            for line in verdict.summary().splitlines()[1:]:
                typer.secho(f"  {line}", fg=typer.colors.RED)
    if missing_images:
        # Named at the end rather than left in a warning thirty screens up. A Leaf whose
        # image call failed is charged against the budget, logged once, and otherwise
        # indistinguishable from a Leaf that worked — which is how this run finished green
        # with seventeen pictures for eighteen Leaves.
        typer.secho(
            f"\n{len(missing_images)} Leaves have NO scenario image: "
            f"{', '.join(missing_images)}. Re-run to generate them.",
            fg=typer.colors.RED,
            bold=True,
        )


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
        state = open_run_for_models(graph, run_id)
        if not state.generated:
            typer.secho(f"run {run_id} has no generated Leaves to review", fg=typer.colors.RED)
            raise typer.Exit(1)

        settings = deps.settings
        client = deps.payload_client or PayloadClient(
            base_url=settings.payload_url, api_key=settings.payload_api_key.get_secret_value()
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
        state = open_run_for_models(graph, run_id)
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
                base_url=settings.payload_url, api_key=settings.payload_api_key.get_secret_value()
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
        state = open_run_for_models(graph, run_id)
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
            base_url=settings.payload_url, api_key=settings.payload_api_key.get_secret_value()
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
    client = PayloadClient(
        base_url=settings.payload_url, api_key=settings.payload_api_key.get_secret_value()
    )

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
        client = PayloadClient(
            base_url=settings.payload_url, api_key=settings.payload_api_key.get_secret_value()
        )
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


def _track_snapshot(client: Any, track_id: int) -> tuple[str, str]:
    """A Track's title and `updatedAt`, as published — the same view a reader's app gets.

    Through `PayloadClient`, not a second HTTP caller: `test_boundaries.py` holds `cms/` as
    the one door Payload is reached through, on purpose — one place to audit for "does this
    publish?" and "does this touch the tables?". Reading is all this ever does with it; the
    client this command builds has no more reach than that, whatever key it holds.
    """
    doc = client.get_track(track_id, draft=False)
    return str(doc["bookTitle"]), str(doc["updatedAt"])


@app.command("generate-covers")
def generate_covers(
    out_dir: Annotated[
        str, typer.Option(help="Where every candidate and the contact sheet are written.")
    ] = "runs/covers",
) -> None:
    """Cover art for Track 42 and Ikigai (Track 50) — style-guard-checked, never attached.

    **Ends at a file on disk and a contact sheet.** Both Tracks are published, and
    `apps/admin/src/collections/Tracks.ts` gives the machine account no path to published
    content at all — only to drafts. There is nothing this command could attach to even if
    it tried, so it does not try: it writes candidates and a contact sheet under `out_dir`
    and stops. The founder uploads the chosen file through the admin UI — a minute of their
    time, and the only credential that can do it.

    `graph/cover_nodes.py` holds the two briefs this generates and why they are what they
    are. Not a general command: a cover for one of the 27 placeholder Tracks is out of scope.
    """
    from PIL import Image as PILImage

    from zoomout_pipeline.assets.budget import ImageBudget
    from zoomout_pipeline.assets.contact_sheet import write_contact_sheet
    from zoomout_pipeline.assets.images import AnchorSet, ImageClient, usd_per_image
    from zoomout_pipeline.assets.style_guard import GuardResult, check_style
    from zoomout_pipeline.cms.client import PayloadClient
    from zoomout_pipeline.graph.cover_nodes import (
        COVER_ASPECT_RATIO,
        COVER_BRIEFS,
        cover_alt_text,
        generate_cover_candidates,
    )
    from zoomout_pipeline.runner import build_dependencies

    settings = get_settings()
    payload = PayloadClient(
        base_url=settings.payload_url, api_key=settings.payload_api_key.get_secret_value()
    )
    anchors = AnchorSet.load(settings.anchors_dir)
    if len(anchors) == 0:
        typer.secho(
            f"no anchor set at {settings.anchors_dir} — every image would be unconditioned "
            "and would not share the library's visual identity",
            fg=typer.colors.RED,
        )
        raise typer.Exit(1)

    # Transport per book, before a single image is bought. There is no run behind a cover to
    # carry `open_run_for_models`' check, so it is made directly here — the same guarantee,
    # established the same way `run` establishes it before ingest.
    typer.echo("transport:")
    for brief in COVER_BRIEFS:
        try:
            transport = require_paid_tier(brief.acquisition, settings)
        except FreeTierForbiddenError as refusal:
            typer.secho(f"\n{refusal}\n", fg=typer.colors.RED, bold=True)
            raise typer.Exit(2) from None
        typer.echo(
            f"  track {brief.track_id} ({brief.title}): {transport.transport.value}"
            + (f" ({transport.project})" if transport.project else "")
            + f" — acquisition {brief.acquisition.value}"
        )

    typer.echo("\nbaseline (before generating anything):")
    baseline: dict[int, tuple[str, str]] = {}
    for brief in COVER_BRIEFS:
        title, updated_at = _track_snapshot(payload, brief.track_id)
        baseline[brief.track_id] = (title, updated_at)
        typer.echo(f"  track {brief.track_id}: {title!r}, updatedAt {updated_at}")

    deps = build_dependencies(settings)
    images = ImageClient(project=settings.vertex_project, location=settings.vertex_location)

    rate = usd_per_image(settings.image_model)
    ceiling_usd = 0.50
    max_images = int(ceiling_usd // rate)
    typer.echo(
        f"\nbudget: {settings.image_model} at ${rate}/image; a {COVER_ASPECT_RATIO} request "
        "never sets `image_size`, so it stays in the 1K/2K tier this rate already prices — "
        "4K is the only tier this rate does not cover, and nothing here asks for it "
        f"(images.py:31-48). ${ceiling_usd:.2f} ceiling / ${rate} = {max_images} images max.\n"
    )
    budget = ImageBudget(max_images=max_images, model=settings.image_model)

    guard_spend = 0.0

    def guard(data: bytes) -> GuardResult:
        nonlocal guard_spend
        verdict = check_style(llm=deps.llm, data=data, model=settings.analyze_model)
        guard_spend += verdict.spend.usd
        return verdict

    typer.echo("generating:")
    candidates = generate_cover_candidates(
        client=images,
        briefs=COVER_BRIEFS,
        anchors=anchors,
        model=settings.image_model,
        guard=guard,
        budget=budget,
    )

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    chosen: dict[int, Path] = {}
    for candidate in candidates:
        path = out / f"track-{candidate.brief.track_id}-cover-{candidate.index:02d}.png"
        path.write_bytes(candidate.image.data)
        path.with_suffix(".txt").write_text(cover_alt_text(candidate.brief), encoding="utf-8")
        written.append(path)
        typer.echo(f"  {path.name}: {candidate.verdict.summary()}")
        if candidate.verdict.passed and candidate.brief.track_id not in chosen:
            chosen[candidate.brief.track_id] = path

    typer.echo(
        f"\nimages: {budget.spent} generated across {len(budget.per_leaf)} covers, "
        f"${budget.usd:.4f}"
    )
    typer.echo(f"style guard: {len(candidates)} reads, ${guard_spend:.4f}")
    typer.secho(
        f"total: ${budget.usd + guard_spend:.4f} of the ${ceiling_usd:.2f} ceiling",
        fg=typer.colors.GREEN,
        bold=True,
    )

    typer.echo("\nchosen:")
    for brief in COVER_BRIEFS:
        chosen_path = chosen.get(brief.track_id)
        if chosen_path is None:
            typer.secho(
                f"  track {brief.track_id} ({brief.title}): NO guard-clean candidate — "
                "see the findings above; this Track still needs a follow-up run",
                fg=typer.colors.RED,
                bold=True,
            )
            continue
        with PILImage.open(chosen_path) as img:
            width, height = img.size
        ratio = width / height
        on_target = abs(ratio - 2 / 3) < 0.01
        typer.secho(
            f"  track {brief.track_id} ({brief.title}): {chosen_path.resolve()}\n"
            f"    {width}x{height}, ratio {ratio:.4f} (target {2 / 3:.4f}) — "
            f"{'2:3' if on_target else 'OFF TARGET'}",
            fg=typer.colors.GREEN if on_target else typer.colors.RED,
        )

    # Two briefs, so two columns: at the common width the default three columns leaves a
    # third of the sheet dark and empty. `write_contact_sheet` still copes if a retry ever
    # pushes past two images — a third candidate wraps to its own row rather than overflowing.
    sheet_path = write_contact_sheet(written, out / "contact-sheet.png", columns=2)
    typer.secho(f"\ncontact sheet ({len(written)} images): {sheet_path.resolve()}", bold=True)

    typer.echo("\nfinal (re-fetched, to confirm neither Track was touched):")
    any_changed = False
    for brief in COVER_BRIEFS:
        _, updated_at = _track_snapshot(payload, brief.track_id)
        _, base_updated_at = baseline[brief.track_id]
        changed = updated_at != base_updated_at
        any_changed = any_changed or changed
        typer.secho(
            f"  track {brief.track_id}: updatedAt {updated_at} "
            f"({'CHANGED' if changed else 'unchanged'})",
            fg=typer.colors.RED if changed else typer.colors.GREEN,
        )
    if any_changed:
        typer.secho(
            "\nAT LEAST ONE TRACK'S updatedAt CHANGED — this command must never write to "
            "Payload; treat this as a bug, not a note.",
            fg=typer.colors.RED,
            bold=True,
        )


# ------------------------------------------------------------------------------ VO-2


class RunLedger:
    """A run's spend, written back to its checkpoint on every entry.

    **Per call, not per Leaf.** The first Sadaltager run lost its network mid-Leaf; spend was
    only written back after a whole Leaf, so a clip that was paid for and saved to disk never
    reached the ledger, and had to be found by reconciling the two afterwards.
    """

    def __init__(self, graph: Any, run_id: str, cost: Any) -> None:
        self._graph = graph
        self._config = {"configurable": {"thread_id": run_id}}
        self.cost = cost

    def record(self, spend: Any) -> None:
        self.cost.record(spend)
        self._graph.update_state(self._config, {"cost": self.cost})


class _Narration:
    """What both voiceover commands need, opened and checked once.

    Everything that can refuse — the paid-tier check, the Cloud TTS check, the CMS identity,
    the Leaf count — refuses here, before the first clip is bought.
    """

    def __init__(self, graph: Any, deps: Any, run_id: str, *, guard: bool) -> None:
        from zoomout_pipeline.assets.budget import NarrationBudget
        from zoomout_pipeline.assets.speech import SpeechClient
        from zoomout_pipeline.cms.client import PayloadClient
        from zoomout_pipeline.graph.narration_nodes import (
            ClipStore,
            Guard,
            narration_spent_usd,
        )

        self.graph = graph
        self.run_id = run_id
        self.config = {"configurable": {"thread_id": run_id}}
        self.state, transport = open_run_for_narration(graph, run_id)
        state = self.state
        if state.cms_track_id is None or not state.cms_leaf_ids or state.provenance is None:
            typer.secho(f"run {run_id} has no Leaves in Payload to narrate", fg=typer.colors.RED)
            raise typer.Exit(1)

        settings = deps.settings
        self.client: PayloadClient = deps.payload_client or PayloadClient(
            base_url=settings.payload_url, api_key=settings.payload_api_key.get_secret_value()
        )
        # **Who, before what.** A wrong auth scheme is served as anonymous with a 200, drafts
        # vanish, and an empty Track reads as "nothing to do".
        identity = self.client.whoami()
        if not identity.get("email"):
            typer.secho(
                "Payload served this key as ANONYMOUS — refusing to continue. Check "
                "ZOOMOUT_PIPELINE_PAYLOAD_API_KEY.",
                fg=typer.colors.RED,
                bold=True,
            )
            raise typer.Exit(1)

        leaves = self.client.list_leaves(track_id=state.cms_track_id)
        found = {int(leaf["id"]) for leaf in leaves}
        expected = set(state.cms_leaf_ids.values())
        if found != expected:
            typer.secho(
                f"Track {state.cms_track_id}: Payload returned {len(found)} Leaves and the run "
                f"wrote {len(expected)} ({sorted(found ^ expected)} differ). Refusing to narrate "
                "a Track whose Leaves are not the ones this run knows.",
                fg=typer.colors.RED,
                bold=True,
            )
            raise typer.Exit(1)
        self.leaves: list[dict[str, Any]] = sorted(leaves, key=lambda leaf: int(leaf["orderIndex"]))

        self.speech = SpeechClient(
            project=settings.vertex_project,
            model=settings.narration_model,
            language_code=settings.narration_language,
        )
        self.transport = record_narration_transport(
            graph, run_id, transport, endpoint=self.speech.endpoint
        )
        self.budget = NarrationBudget(
            ceiling_usd=settings.max_narration_usd, spent_usd=narration_spent_usd(state.cost)
        )
        self.store = ClipStore(Path(settings.runs_dir) / run_id / "audio")
        self.guard = Guard(llm=deps.llm, model=settings.analyze_model) if guard else None
        self.book_title = state.provenance.title
        self.ledger = RunLedger(graph, run_id, state.cost)

        typer.echo(
            f"cms        : {identity.get('email')} ({identity.get('accountType', '?')}), "
            f"Track {state.cms_track_id}, {len(self.leaves)} Leaves"
        )
        typer.echo(
            f"narration  : {self.transport.transport.value} via {self.transport.endpoint} "
            f"({self.transport.project}), {self.transport.model}"
        )
        typer.echo(
            f"listening  : {self.guard.model if self.guard else 'OFF — no clip will be checked'}"
        )
        typer.echo(f"budget     : {self.budget.report()}")
        typer.echo(f"audio      : {self.store.root}\n")

    def leaf_at(self, order: int) -> dict[str, Any]:
        for leaf in self.leaves:
            if int(leaf["orderIndex"]) == order:
                return dict(leaf)
        typer.secho(f"no Leaf at orderIndex {order}", fg=typer.colors.RED)
        raise typer.Exit(2)

    def record(self, spend: Any) -> None:
        self.ledger.record(spend)

    def checkpoint(self, **values: Any) -> None:
        """Spend is written back after every Leaf, so an interrupted run keeps its ledger."""
        self.graph.update_state(self.config, {"cost": self.state.cost, **values})


def _clip_line(clip: Any) -> str:
    severity = clip.severity.value if clip.severity is not None else "unchecked"
    cached = " (cached)" if clip.from_cache else ""
    retried = f", {clip.attempts_made} attempts" if clip.attempts_made > 1 else ""
    return (
        f"{clip.line.slide.value:<9}{clip.duration_seconds:>6.1f}s  {severity:<9}{retried}{cached}"
    )


@app.command("audition-voices")
def audition_voices(
    run_id: Annotated[str, typer.Option(help="The run whose Leaves supply the lines.")],
    voice: Annotated[
        list[str], typer.Option(help="A prebuilt Gemini-TTS voice. Repeat for several.")
    ],
    line: Annotated[
        list[str], typer.Option(help="ORDER:SLIDE, e.g. 4:scenario. Repeat for several.")
    ],
    undirected: Annotated[
        bool,
        typer.Option(
            help="Also render every line in the first voice with no direction at all, to "
            "hear what the direction changes."
        ),
    ] = False,
    guard: Annotated[bool, typer.Option(help="Listen to every clip with the guard.")] = True,
) -> None:
    """The same lines in several voices, in one file, for a person to choose between.

    **Nothing is written to the CMS.** The clips are real Leaf text, directed exactly as
    `narrate` would direct them, and cached under the same keys — so the chosen voice's
    audition clips are reused by the real run rather than bought twice.

    No regeneration here: an audition is a measurement of how each voice behaves, and quietly
    retrying the one that misread a word would hide the thing being measured.
    """
    from zoomout_pipeline.assets.budget import BudgetExceededError
    from zoomout_pipeline.assets.narration import (
        NarratedSlide,
        direction_for,
        narration_script,
        title_slug,
    )
    from zoomout_pipeline.assets.review_track import consistency, join_in_order, write_review
    from zoomout_pipeline.assets.speech import SpeechError
    from zoomout_pipeline.graph.narration_nodes import render_line

    voices = list(dict.fromkeys(v.strip() for v in voice if v.strip()))
    if not voices:
        typer.secho("give at least one --voice", fg=typer.colors.RED)
        raise typer.Exit(2)

    wanted: list[tuple[int, Any]] = []
    for spec in line:
        order_text, _, slide_text = spec.partition(":")
        try:
            wanted.append((int(order_text), NarratedSlide(slide_text.strip())))
        except ValueError:
            typer.secho(f"--line {spec!r} is not ORDER:SLIDE", fg=typer.colors.RED)
            raise typer.Exit(2) from None

    with run_context() as (graph, deps):
        session = _Narration(graph, deps, run_id, guard=guard)
        chosen = []
        for order, slide in wanted:
            script = narration_script(session.leaf_at(order))
            chosen.append(next(item for item in script if item.slide is slide))

        directed: list[Any] = []
        plain: list[Any] = []
        try:
            for narrated in chosen:
                for name in voices:
                    clip = render_line(
                        line=narrated,
                        speech=session.speech,
                        voice=name,
                        prompt=direction_for(narrated.slide),
                        store=session.store,
                        budget=session.budget,
                        record=session.record,
                        guard=session.guard,
                        max_attempts=1,
                    )
                    directed.append(clip)
                    typer.echo(f"  {narrated.label:<22} {name:<14} {_clip_line(clip)}")
                    session.checkpoint()
                if undirected:
                    clip = render_line(
                        line=narrated,
                        speech=session.speech,
                        voice=voices[0],
                        prompt="",
                        store=session.store,
                        budget=session.budget,
                        record=session.record,
                        guard=session.guard,
                        max_attempts=1,
                    )
                    plain.append(clip)
                    typer.echo(
                        f"  {narrated.label:<22} {voices[0] + ' (none)':<14} {_clip_line(clip)}"
                    )
                    session.checkpoint()
        except (BudgetExceededError, SpeechError) as error:
            typer.secho(f"\nHALTED: {error}", fg=typer.colors.RED, bold=True)

    if not directed:
        raise typer.Exit(1)

    folder = session.store.root / "audition"
    slug = title_slug(session.book_title)
    heard = [clip.heard(session.book_title) for clip in directed]
    report = consistency(heard)
    preamble = [
        f"Voices: {', '.join(voices)}. Model `{session.speech.model}` via "
        f"`{session.speech.endpoint}`.",
        "Each line is read by every voice in turn, in the order listed; a longer gap separates "
        "one line from the next.",
    ]
    track, cues = join_in_order(
        heard, same_group=lambda a, b: (a.line.order, a.line.slide) == (b.line.order, b.line.slide)
    )
    written = [
        write_review(
            destination=folder / f"{slug}-audition",
            heading=f"{session.book_title} — voice audition",
            preamble=preamble,
            track=track,
            cues=cues,
            report=report,
            show_voice=True,
        )
    ]
    for name in voices:
        own = [clip for clip in heard if clip.voice == name]
        own_track, own_cues = join_in_order(own, same_group=lambda a, b: False)
        written.append(
            write_review(
                destination=folder / f"{slug}-voice-{name.lower()}",
                heading=f"{session.book_title} — {name}",
                preamble=[f"{name} alone, every audition line."],
                track=own_track,
                cues=own_cues,
                report=consistency(own),
                show_voice=True,
            )
        )
    if plain:
        pairs: list[Any] = []
        for clip in plain:
            twin = next(
                c
                for c in directed
                if c.voice == voices[0]
                and c.line.slide is clip.line.slide
                and c.line.order == clip.line.order
            )
            pairs.extend(
                [
                    replace_voice(clip.heard(session.book_title), f"{voices[0]} undirected"),
                    replace_voice(twin.heard(session.book_title), f"{voices[0]} directed"),
                ]
            )
        ab_track, ab_cues = join_in_order(
            pairs,
            same_group=lambda a, b: (a.line.order, a.line.slide) == (b.line.order, b.line.slide),
        )
        written.append(
            write_review(
                destination=folder / f"{slug}-direction-ab",
                heading=f"{session.book_title} — {voices[0]}, without and with direction",
                preamble=[
                    "Each line twice: first with no style prompt at all, then with the "
                    "slide type's direction. If the two sound the same, the direction is not "
                    "doing anything."
                ],
                track=ab_track,
                cues=ab_cues,
                report=consistency(pairs),
                show_voice=True,
            )
        )

    typer.echo("")
    for files in written:
        typer.echo(f"  {files.page}")
    typer.secho(f"\n{session.budget.report()}", fg=typer.colors.GREEN, bold=True)


def replace_voice(clip: Any, label: str) -> Any:
    """The same heard clip under a different voice label, for an A/B sheet."""
    from dataclasses import replace

    return replace(clip, voice=label)


@app.command("narrate")
def narrate(
    run_id: Annotated[str, typer.Option(help="The run whose Leaves should be read aloud.")],
    limit: Annotated[int, typer.Option(help="Stop after N Leaves. 0 means all.")] = 0,
    render_only: Annotated[
        bool, typer.Option(help="Render, check and build the review track; write nothing.")
    ] = False,
    guard: Annotated[bool, typer.Option(help="Listen to every clip with the guard.")] = True,
    listen_for: Annotated[
        list[str] | None,
        typer.Option(help="A word to flag for pronunciation in the cue sheet. Repeatable."),
    ] = None,
    max_attempts: Annotated[
        int,
        typer.Option(
            min=1,
            max=3,
            help="Attempts per clip when the guard or the pace check fails it. Attempts "
            "already on disk are reused, so raising this re-buys only clips that still fail.",
        ),
    ] = 2,
) -> None:
    """Read a run's Leaves aloud, in **both** ruled narrators, and attach them as drafts.

    **Both narrators or none** (VO-2.1). Every Leaf is rendered and checked in both of
    `NARRATOR_VOICES` before either is attached, and a Leaf attaches only once both pass on
    every narrated slide — the founder's rule that a reader who picks one narrator must never
    be handed the other mid-book. **Writes drafts only.** The Leaves are published; each write
    lands as a pending draft version, and the live Leaf has no audio until a human publishes
    it again.

    Re-running is safe and free for anything already done: clips are cached by what was
    asked, uploads are found by the hash of their bytes before being made, and a Leaf whose
    draft already carries exactly this audio is verified rather than written again.
    """
    from zoomout_pipeline.assets.budget import BudgetExceededError
    from zoomout_pipeline.assets.narration import (
        NARRATOR_VOICES,
        direction_for,
        narration_script,
        title_slug,
    )
    from zoomout_pipeline.assets.narration_guard import GuardSeverity
    from zoomout_pipeline.assets.review_track import consistency, join_in_order, write_review
    from zoomout_pipeline.assets.speech import SpeechError
    from zoomout_pipeline.graph.narration_nodes import (
        NarrationHeldError,
        NarrationWriteError,
        attach_leaf_narration,
        render_line,
    )

    rendered: list[Any] = []
    halted = ""
    failed: list[str] = []
    held: list[str] = []
    with run_context() as (graph, deps):
        session = _Narration(graph, deps, run_id, guard=guard)
        narrators = ", ".join(
            f"{narrator.value}={name}" for narrator, name in NARRATOR_VOICES.items()
        )
        typer.echo(f"narrators  : {narrators}{' — render only' if render_only else ''}\n")
        narration = dict(session.state.cms_narration)
        leaves = session.leaves[:limit] if limit else session.leaves

        for leaf in leaves:
            order = int(leaf["orderIndex"])
            key = str(order)
            leaf_id = int(leaf["id"])
            if session.state.cms_leaf_ids.get(key) != leaf_id:
                typer.secho(
                    f"leaf {order}: Payload id {leaf_id} is not the id this run wrote "
                    f"({session.state.cms_leaf_ids.get(key)}). Stopping.",
                    fg=typer.colors.RED,
                    bold=True,
                )
                raise typer.Exit(1)

            try:
                lines = narration_script(leaf)
                clips = [
                    render_line(
                        line=narrated,
                        speech=session.speech,
                        voice=voice_name,
                        prompt=direction_for(narrated.slide),
                        store=session.store,
                        budget=session.budget,
                        record=session.record,
                        guard=session.guard,
                        max_attempts=max_attempts,
                    )
                    for voice_name in NARRATOR_VOICES.values()
                    for narrated in lines
                ]
            except (BudgetExceededError, SpeechError) as error:
                # Both are a stop, not a crash: what was rendered is on disk and on the
                # ledger, and the review is still built from it below.
                halted = str(error)
                session.checkpoint()
                break
            session.checkpoint()
            rendered.extend(clips)
            typer.echo(f"  leaf {order:>2}  {leaf.get('title', '')[:60]}")
            for clip in clips:
                typer.echo(f"           {clip.voice:<12} {_clip_line(clip)}")

            if render_only:
                continue

            try:
                attached = attach_leaf_narration(
                    client=session.client,
                    leaf_id=leaf_id,
                    clips=clips,
                    book_title=session.book_title,
                    store=session.store,
                )
            except NarrationHeldError as held_back:
                # A clip that is not the approved text: this Leaf waits, the rest carry on.
                held.append(key)
                typer.secho(f"           HELD — {held_back}", fg=typer.colors.RED)
                continue
            except NarrationWriteError as error:
                typer.secho(f"\nSTOP at Leaf {order}: {error}", fg=typer.colors.RED, bold=True)
                failed.append(key)
                break

            narration[key] = {
                "leaf_id": leaf_id,
                "narrators": {narrator.value: name for narrator, name in NARRATOR_VOICES.items()},
                "slides": attached.media,
                "wrote": attached.wrote,
                "verified": attached.passed,
            }
            session.checkpoint(cms_narration=narration)
            state_word = "draft written" if attached.wrote else "draft already held this audio"
            typer.echo(
                f"           {state_word}; {attached.uploads} uploaded; "
                f"{'verified' if attached.passed else 'VERIFICATION FAILED'}"
            )
            if not attached.passed:
                for problem in [
                    *attached.draft_check.problems,
                    *attached.live_check.problems,
                    *attached.problems,
                ]:
                    typer.secho(f"             {problem}", fg=typer.colors.RED)
                failed.append(key)
                break

    if rendered:
        heard = [clip.heard(session.book_title) for clip in rendered]
        for voice_name in NARRATOR_VOICES.values():
            own = [clip for clip in heard if clip.voice == voice_name]
            if not own:
                continue
            report = consistency(own, listen_terms=listen_for or [])
            track, cues = join_in_order(own)
            files = write_review(
                destination=session.store.root
                / "review"
                / f"{title_slug(session.book_title)}-narration-{voice_name.lower()}",
                heading=f"{session.book_title} — narration review",
                preamble=[
                    f"Narrator **{voice_name}**, `{session.speech.model}` via "
                    f"`{session.speech.endpoint}` ({session.speech.project}).",
                    "Every clip levelled to the same speech loudness, given the same 60 ms head "
                    "and 350 ms tail, and encoded once as 64 kbps mono mp3 — this track is the "
                    "uploaded files, decoded, in reading order.",
                    "Listening model: "
                    + (session.guard.model if session.guard else "**off — no clip was checked**"),
                ],
                track=track,
                cues=cues,
                report=report,
            )
            typer.echo(f"\nreview     : {files.audio}\nlisten     : {files.page}")
        counts = {level: 0 for level in GuardSeverity}
        for clip in rendered:
            if clip.severity is not None:
                counts[clip.severity] += 1
        typer.echo(
            f"\nguard      : {counts[GuardSeverity.EXACT]} exact, "
            f"{counts[GuardSeverity.MINOR]} minor, {counts[GuardSeverity.MAJOR]} major, "
            f"{sum(1 for c in rendered if c.check is None)} unchecked — of {len(rendered)} clips"
        )

    typer.secho(f"spend      : {session.budget.report()}", fg=typer.colors.GREEN, bold=True)
    if halted:
        typer.secho(f"\nHALTED: {halted}", fg=typer.colors.RED, bold=True)
    if held:
        typer.secho(
            f"\n{len(held)} Leaves HELD, their audio not attached, because a clip still did not "
            f"match its text after regeneration: {', '.join(held)}. Listen to them in the review "
            "track; nothing about them was written.",
            fg=typer.colors.RED,
            bold=True,
        )
    if not render_only:
        typer.secho(
            "\nNothing was published. Each Leaf's audio waits in a pending draft until a human "
            "publishes it.",
            fg=typer.colors.YELLOW,
        )
    if halted or failed or held:
        raise typer.Exit(1)


# ------------------------------------------------------------------------------ ONBOARD-2


@app.command("generate-greetings")
def generate_greetings(
    render_only: Annotated[
        bool,
        typer.Option(help="Render, check and write the two mp3s to disk; upload nothing."),
    ] = False,
    max_attempts: Annotated[
        int,
        typer.Option(
            min=1,
            max=3,
            help="Attempts per greeting when the guard or the pace check fails it. Attempts "
            "already on disk are reused, so raising this re-buys only what still fails.",
        ),
    ] = 2,
    ceiling_usd: Annotated[
        float | None,
        typer.Option(
            min=0.0,
            help="The hard cap, counted across every invocation. Defaults to "
            "`GREETING_CEILING_USD`. The budget refuses any call whose worst case would cross "
            "it, and Cloud TTS's worst case alone is $0.16, so a cap under that runs nothing.",
        ),
    ] = None,
) -> None:
    """Each narrator introduces themselves: two clips, uploaded to Payload's Media (ONBOARD-2).

    **Not a graph node and not tied to a run** — there is no Leaf behind these two clips, the
    same shape as `generate-covers`. The scripts are fixed in `assets/greeting.py`, in the two
    ruled voices, and the request reaches Cloud TTS through its own door
    (`SpeechClient.synthesize_greeting`) because a Leaf's door is fenced to Leaf text.

    Renders both, listens to both (a blind transcript, and a pace check that does not depend
    on the listener), and uploads **both or neither**. Re-running is safe: clips are cached by
    what was asked, an upload is found by its stable filename first, and an existing document
    is compared with the clip rather than trusted. The one thing it cannot do is replace a
    Media document, because the machine key may create Media but never delete it — so a clip
    that must be redone after upload needs the old document deleted in the admin UI first.
    """
    from zoomout_pipeline.assets.budget import BudgetExceededError, NarrationBudget
    from zoomout_pipeline.assets.greeting import greeting_direction, greeting_script
    from zoomout_pipeline.assets.speech import SpeechClient, SpeechError
    from zoomout_pipeline.cms.client import PayloadClient, PayloadError
    from zoomout_pipeline.graph.greeting_nodes import (
        GREETING_CEILING_USD,
        LEDGER_FILENAME,
        GreetingHeldError,
        GreetingLedger,
        GreetingUploadError,
        RenderedGreeting,
        run_greetings,
    )
    from zoomout_pipeline.graph.narration_nodes import ClipStore, Guard
    from zoomout_pipeline.runner import build_dependencies

    settings = get_settings()
    if not settings.use_vertex:
        typer.secho(
            "the greetings are listened to through Vertex AI, and synthesized through Cloud "
            "Text-to-Speech billed to a named project. Set:\n"
            "  export ZOOMOUT_PIPELINE_USE_VERTEX=true\n"
            "  export ZOOMOUT_PIPELINE_VERTEX_PROJECT=zoomout-vertex",
            fg=typer.colors.RED,
            bold=True,
        )
        raise typer.Exit(2)

    payload: PayloadClient | None = None
    if not render_only:
        payload = PayloadClient(
            base_url=settings.payload_url, api_key=settings.payload_api_key.get_secret_value()
        )
        # **Who, before what.** A wrong auth scheme is served as anonymous with a 200.
        try:
            identity = payload.whoami()
        except PayloadError as error:
            typer.secho(f"cannot reach Payload: {error}", fg=typer.colors.RED, bold=True)
            raise typer.Exit(1) from error
        if not identity.get("email"):
            typer.secho(
                "Payload served this key as ANONYMOUS — refusing to continue. Check "
                "ZOOMOUT_PIPELINE_PAYLOAD_API_KEY.",
                fg=typer.colors.RED,
                bold=True,
            )
            raise typer.Exit(1)
        typer.echo(
            f"cms        : {identity.get('email')} ({identity.get('accountType', '?')}) at "
            f"{settings.payload_url}"
        )

    deps = build_dependencies(settings)
    speech = SpeechClient(
        project=settings.vertex_project,
        model=settings.narration_model,
        language_code=settings.narration_language,
    )
    root = Path(settings.runs_dir) / "greetings"
    ledger = GreetingLedger(root / LEDGER_FILENAME)
    cap = GREETING_CEILING_USD if ceiling_usd is None else ceiling_usd
    budget = NarrationBudget(ceiling_usd=cap, spent_usd=ledger.total_usd)
    store = ClipStore(root / "audio")
    guard = Guard(llm=deps.llm, model=settings.analyze_model)

    typer.echo(f"narration  : Cloud TTS via {speech.endpoint} ({speech.project}), {speech.model}")
    typer.echo(f"listening  : {guard.model}")
    typer.echo(f"budget     : {budget.report()} (already spent, across invocations)")
    typer.echo(f"audio      : {store.root.resolve()}")
    typer.echo(f"direction  : {greeting_direction()!r}")
    for greeting in greeting_script():
        typer.echo(f"sending    : {greeting.name:<5} (voice {greeting.voice}) {greeting.spoken!r}")
    typer.echo("")

    def show(clip: RenderedGreeting) -> None:
        severity = clip.severity.value if clip.severity is not None else "unchecked"
        retried = f", {clip.attempts_made} attempts" if clip.attempts_made > 1 else ""
        cached = " (cached)" if clip.from_cache else ""
        typer.echo(
            f"  {clip.greeting.narrator.value:<7}{clip.greeting.name:<6}"
            f"{clip.duration_seconds:>5.2f}s  speech {clip.metrics.speech_seconds:.2f}s = "
            f"{clip.articulation_wpm:.0f} wpm  {severity}{retried}{cached}"
        )
        typer.echo(f"          heard : {clip.transcript!r}")
        typer.echo(
            f"          name  : heard as {clip.name_heard!r} — set aside, not machine-checked; "
            "a person has to hear this one"
            if clip.name_heard is not None
            else "          name  : NOT HEARD — the greeting never said the narrator's name"
        )
        for finding in clip.check.findings() if clip.check is not None else []:
            typer.echo(f"          finding: {finding}")

    problem = ""
    result = None
    try:
        result = run_greetings(
            speech=speech,
            store=store,
            budget=budget,
            record=ledger.record,
            guard=guard,
            client=payload,
            max_attempts=max_attempts,
            on_rendered=show,
        )
    except (BudgetExceededError, SpeechError, GreetingHeldError, GreetingUploadError) as error:
        problem = str(error)
    except PayloadError as error:
        problem = f"Payload: {error}"

    typer.echo("")
    for greeting in greeting_script():
        typer.echo(
            f"spend      : {greeting.narrator.value:<7} ${ledger.usd_for(greeting.narrator):.4f}"
        )
    typer.secho(
        f"spend      : total ${ledger.total_usd:.4f} of the ${cap:.2f} cap, all invocations",
        fg=typer.colors.GREEN,
        bold=True,
    )

    if result is not None:
        for clip in result.rendered:
            state = "final" if clip.uploadable else "HELD"
            typer.echo(f"file       : {state:<5} {result.files[clip.greeting.narrator].resolve()}")
        for stored in result.uploaded:
            typer.echo(
                f"media      : {stored.narrator.value:<7} id {stored.media_id}  {stored.url}  "
                f"{stored.duration_seconds:.2f}s  "
                f"{'uploaded' if stored.uploaded else 'already there, bytes verified'}"
            )
            for issue in stored.problems:
                typer.secho(f"             {issue}", fg=typer.colors.RED)
        if result.uploaded and any(not stored.passed for stored in result.uploaded):
            problem = "an uploaded document does not match what was sent — see above"

    if problem:
        typer.secho(f"\nSTOPPED: {problem}", fg=typer.colors.RED, bold=True)
        raise typer.Exit(1)
    if result is not None and result.uploaded:
        typer.secho(
            "\nTwo Media documents. Nothing else was written: no Leaf, no Track.",
            fg=typer.colors.YELLOW,
        )


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
        state = read_run_state(graph, run_id)

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
