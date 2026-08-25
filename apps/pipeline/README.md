# `apps/pipeline` — the ZoomOut content pipeline

Turns a book into an ordered plan of Leaves, with a human deciding what that plan is.

WP16 builds the spine: `ingest → analyze → breakdown → human gate 1`. It does not generate
a single slide. Slide generation, grounding, assets and the editorial loop are WP17–WP19.

**This is a standalone Python project.** It is deliberately *not* in the npm workspaces
array, and the root `npm run build` / `npm test` do not touch it. Its gate is below.

---

## Prerequisites

- **Python 3.12+.** Managed with [uv](https://docs.astral.sh/uv/); `uv` installs the
  interpreter itself, so nothing needs to be on your system Python.
- **Docker**, for the pipeline's Postgres.

```bash
pip3 install --user uv && uv python install 3.12
```

## The pipeline's own database

pgvector and the LangGraph checkpointer live in **the pipeline's own Postgres**, in its own
container on **port 5433** — not the backend's `zoomout` and not Payload's `zoomout_cms`,
which share the `zoomout-postgres` container on 5432.

That separation is not fastidiousness. WP5b lost a day to `apps/backend/.env` naming the
CMS database: migrations ran against Payload and broke it. A different container on a
different port makes the mistake hard to make, and `zoomout-pipeline doctor` makes it
visible in one second if it happens anyway.

```bash
docker run -d --name zoomout-pipeline-postgres \
  -e POSTGRES_DB=zoomout_pipeline -e POSTGRES_PASSWORD=postgres \
  -p 5433:5432 pgvector/pgvector:pg16
```

## Environment

Set these yourself — this package never reads a `.env` file, and secrets come from the
environment only. Every variable is prefixed `ZOOMOUT_PIPELINE_` so none of them can be
confused with `DATABASE_URL` or `PAYLOAD_DATABASE_URL`.

| Variable | Required | What it is |
|---|---|---|
| `ZOOMOUT_PIPELINE_DATABASE_URL` | yes | The pipeline's own Postgres. Refuses a URL ending in `/zoomout` or `/zoomout_cms`. |
| `ZOOMOUT_PIPELINE_GEMINI_API_KEY` | yes, for a real run | Gemini API key. |
| `ZOOMOUT_PIPELINE_ANALYZE_MODEL` | no | Default `gemini-2.5-pro`. |
| `ZOOMOUT_PIPELINE_BREAKDOWN_MODEL` | no | Default `gemini-2.5-pro`. |
| `ZOOMOUT_PIPELINE_EMBEDDING_MODEL` | no | Default `text-embedding-004`. |
| `ZOOMOUT_PIPELINE_PAID_TIER` | no | Set `true` before any book that is not public domain. See below. |
| `ZOOMOUT_PIPELINE_RUNS_DIR` | no | Where plan files are written. Default `runs/`. |

```bash
export ZOOMOUT_PIPELINE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/zoomout_pipeline"
export ZOOMOUT_PIPELINE_GEMINI_API_KEY="..."
```

### Free tier is for public-domain books only

Google's free tier **uses submitted content to improve its products**; the paid tier does
not (proposal §4a). Putting a copyrighted book through the free tier feeds it into a corpus
that may be used for training — a worse version of the ingestion problem R6 already names,
and one no disclaimer undoes.

> Free tier for building and tuning against public-domain books. Paid tier the moment a
> real book goes through.

## Running

```bash
uv sync --all-groups            # install
uv run zoomout-pipeline doctor  # which database am I actually in?
uv run zoomout-pipeline init-db # create the schema

uv run zoomout-pipeline run --source .data/books/pg59844.epub --acquisition public-domain
# ... edit runs/<run-id>/leaf-plan.yaml, set `approved: true` ...
uv run zoomout-pipeline resume --run-id <run-id>

uv run zoomout-pipeline status --run-id <run-id>
uv run zoomout-pipeline cost   --run-id <run-id>
uv run zoomout-pipeline purge-raw-text --run-id <run-id>
```

`--acquisition` is **required** and has no default: `public-domain`, `licensed`,
`purchased`, or `undocumented`. R6 calls provenance retroactively impossible to
reconstruct, so it is recorded at ingest or not at all. `undocumented` is an honest answer;
silence is not.

## Gate 1

The run stops and writes `runs/<run-id>/leaf-plan.yaml`. **That file is the plan** — edit
titles, rewrite concepts, reorder, merge, split, delete. Whatever you leave is what the run
continues with. Set `approved: true` and resume.

The 1:1 chapter-structure check runs again on what you approved. That check is a `LEGAL.md`
requirement rather than a style note, so it is not waived by approval: a plan that still
mirrors the book's chapters is refused with the measurements attached.

## Retention

`purge-raw-text` deletes the book's raw full text and keeps the embeddings, the provenance
and any cited passages — the audit trail that proves grounding without holding a copy of
the book (R6). WP16's runs stop at gate 1 and WP17 still needs the text, so the command is
manual for now; WP20 wires it to the terminal node.

## The gate

The root gate does not cover this package. Run its own:

```bash
uv run ruff format --check . && uv run ruff check . && uv run mypy && uv run pytest
```

`pytest` needs the pipeline's Postgres running: the retention, provenance and
foreign-database tests are Tier A and each creates and drops a scratch database
(`zoomout_pipeline_test`). They **skip loudly** if Postgres is unreachable rather than
passing quietly — a green run that silently skipped them would be worse than a red one.

Live-model tests are marked `live` and are excluded by default. Run them explicitly:

```bash
uv run pytest -m live
```

## What is deliberately absent

No Payload client, no Payload credential, no HTTP client at all — asserted in
`tests/test_boundaries.py` against the parsed source, not by review. WP17 opens that
boundary, and when it does the door is the REST API. Payload's tables are never touched:
direct access bypasses draft/publish resolution, which silently breaks takedown.
