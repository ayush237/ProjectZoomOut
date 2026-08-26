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
) -> None:
    """Ingest, analyze, break down, and stop at the human gate."""
    resolved_run_id = run_id or f"run-{uuid.uuid4().hex[:12]}"
    state = PipelineState(run_id=resolved_run_id, source_path=str(source), acquisition=acquisition)

    with run_context() as (graph, _deps):
        config = {"configurable": {"thread_id": resolved_run_id}}
        result: dict[str, Any] = graph.invoke(state, config)  # type: ignore[attr-defined]

    _report(result, run_id=resolved_run_id)


@app.command()
def resume(
    run_id: Annotated[str, typer.Option(help="The run to continue.")],
) -> None:
    """Continue a run after the plan file has been edited and approved."""
    with run_context() as (graph, _deps):
        config = {"configurable": {"thread_id": run_id}}
        result: dict[str, Any] = graph.invoke(Command(resume=True), config)  # type: ignore[attr-defined]

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
