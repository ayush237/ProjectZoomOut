# `apps/pipeline` — the ZoomOut content pipeline

Turns a book into an ordered plan of Leaves, with a human deciding what that plan is.

The graph, as it stands:

```
ingest → analyze → breakdown → [HUMAN GATE 1] → draft_leaf → extra_content → ground_check
              ▲        │                             ▲                            │
              └────────┘                             └────────────────────────────┘
        MAX_BREAKDOWN_ATTEMPTS                            MAX_LEAF_ATTEMPTS
                                                                              │
                                                                              ▼
                                                                    write_drafts_to_cms → END
```

WP16 built the spine through gate 1; WP17 added per-Leaf generation, the grounding gate and
the Payload boundary. **Three deliberate invocations sit downstream of the graph itself**,
for the reason recorded under "The graph-shape problem" below — `write-drafts`,
`generate-assets` (WP18: image candidates and rendered diagrams), and gate 2's review
artefacts (WP19), each addressed at a run that already reached `END`.

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
| `ZOOMOUT_PIPELINE_GEMINI_API_KEY` | one of the two | AI Studio Developer API key. Unused when `USE_VERTEX` is set. |
| `ZOOMOUT_PIPELINE_USE_VERTEX` | one of the two | `true` to use Vertex AI with Application Default Credentials instead of an API key. |
| `ZOOMOUT_PIPELINE_VERTEX_PROJECT` | with Vertex | GCP project id. Required when `USE_VERTEX` is set — it is what calls bill to. |
| `ZOOMOUT_PIPELINE_VERTEX_LOCATION` | no | Default `global`. Gemini 3.x is **only** served there — regional endpoints 404. |
| `ZOOMOUT_PIPELINE_EMBED_REQUESTS_PER_MINUTE` | no | Default 60, sized for the AI Studio free tier. Raise it on Vertex. |
| `ZOOMOUT_PIPELINE_ANALYZE_MODEL` | no | Default `gemini-3.6-flash`. |
| `ZOOMOUT_PIPELINE_BREAKDOWN_MODEL` | no | Default `gemini-3.6-flash`. |
| `ZOOMOUT_PIPELINE_EMBEDDING_MODEL` | no | Default `gemini-embedding-001`, truncated to 768 dimensions. |
| `ZOOMOUT_PIPELINE_DRAFT_MODEL` | no | Default `gemini-3.6-flash`. The five slides. |
| `ZOOMOUT_PIPELINE_EXTRAS_MODEL` | no | Default `gemini-3.6-flash`. Dinner Table Knowledge and apply-in-life. |
| `ZOOMOUT_PIPELINE_PAID_TIER` | no | Set `true` before any book that is not public domain. See below. |
| `ZOOMOUT_PIPELINE_RUNS_DIR` | no | Where plan files are written. Default `runs/`. |
| `ZOOMOUT_PIPELINE_PAYLOAD_URL` | no | Default `http://localhost:3001`. `localhost`, not `127.0.0.1` — see the note below. |
| `ZOOMOUT_PIPELINE_PAYLOAD_API_KEY` | for CMS writes | The machine account's key (WP15.2). Provisioned by `npm run create-pipeline-key --workspace=apps/admin`, printed once, never in the repo. |
| `ZOOMOUT_PIPELINE_IMAGE_MODEL` | no | Default `gemini-3-pro-image`. Matches the anchor set's family — conditioning is strongest within one. |
| `ZOOMOUT_PIPELINE_DIAGRAM_MODEL` | no | Default `gemini-3.6-flash`. Only emits a JSON spec. |
| `ZOOMOUT_PIPELINE_SCENARIO_CANDIDATES` | no | Default 3. How many illustrations the human chooses between at gate 2. |
| `ZOOMOUT_PIPELINE_MAX_IMAGES_PER_TRACK` | no | Default 70. **Halts** a run rather than warning — see `assets/budget.py`. |

```bash
export ZOOMOUT_PIPELINE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/zoomout_pipeline"

# Either the Developer API...
export ZOOMOUT_PIPELINE_GEMINI_API_KEY="..."

# ...or Vertex AI, with no key on disk:
export ZOOMOUT_PIPELINE_USE_VERTEX=true
export ZOOMOUT_PIPELINE_VERTEX_PROJECT="your-project-id"
export ZOOMOUT_PIPELINE_EMBED_REQUESTS_PER_MINUTE=600

# For anything that writes to Payload:
export ZOOMOUT_PIPELINE_PAYLOAD_API_KEY="..."
```

**`localhost`, deliberately not `127.0.0.1`, for `ZOOMOUT_PIPELINE_PAYLOAD_URL`.** Next's dev
server rejects `/_next/*` requests whose `Origin` it does not allowlist, which covers
`localhost` but not the IP form — the admin UI 403s its own JavaScript and renders blank with
nothing on screen to explain why. `allowedDevOrigins` in `apps/admin/next.config.ts` (WP15.2)
fixes the admin UI itself; the pipeline's default just avoids walking into the same trap.

### Vertex AI, and why it is the better target

The proposal's §4 specified Vertex from the start ("one GCP DPA rather than a second
provider's"). WP16 was built against the AI Studio Developer API because §4a's free-tier
analysis pointed there. Two things have since changed that argument:

- **Google excluded the Developer API from the $300 Cloud credit in March 2026.** Credit can
  pay for Vertex; it cannot pay for Gemini API in AI Studio.
- **Vertex does not use submitted prompts to improve Google's models.** That is the entire
  reason development is confined to public-domain books, so Vertex is what makes real books
  possible.

Vertex authenticates with Application Default Credentials — `gcloud auth
application-default login` — so there is no key file for this package to read or leak. Same
SDK, same model names; only the transport and the billing change.

### Free tier is for public-domain books only

Google's free tier **uses submitted content to improve its products**; the paid tier does
not (proposal §4a). Putting a copyrighted book through the free tier feeds it into a corpus
that may be used for training — a worse version of the ingestion problem R6 already names,
and one no disclaimer undoes.

> Free tier for building and tuning against public-domain books. Paid tier the moment a
> real book goes through.

**What the free tier actually gives you** (verified against a live key, 2026-08-26 — §4a of
the proposal is out of date on this):

| | |
|---|---|
| Pro models | **No free quota at all** — `limit: 0`. Paid only. |
| `gemini-2.5-pro` / `gemini-2.5-flash` | Closed to new API keys; both 404. |
| 3.x Flash line | Works. `gemini-3.6-flash` is the default. |
| `text-embedding-004` | Retired; 404s. Use `gemini-embedding-001`. |
| Embeddings | 100 requests/minute, and **each text counts as a request** — one book is ~140. The client paces and retries; a first ingest takes a couple of minutes. |

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

## The grounding gate

`LEGAL.md` names fabricated content attributed to a real author as the highest-severity risk
in the product — above the copyright question. `ground_check` is where that stops being a
document.

It is **pass/fail and mechanical**, not a score with a threshold anyone can nudge, and it is
kept separate from anything editorial so the verdict cannot be argued down on quality
grounds (R3). It works because the model is shown a numbered set of retrieved passages and
may cite **only** those handles, which makes three things checkable by looking:

- a citation naming a handle that was never retrieved is an invention;
- a `quote` must appear **verbatim** in the passage it cites — typographic noise is
  normalised, words are not;
- every claim must carry a citation, and Dinner Table Knowledge must have a sourced claim on
  the takeaway slide.

A Leaf that fails is redrafted with the findings attached, up to `MAX_LEAF_ATTEMPTS`, then
escalated to a human. **It is never emitted with a warning.**

Passages a Leaf cites are marked `is_cited`, which is what makes `purge-raw-text` safe to
run: cited passages survive as the audit trail proving the claim after the book itself is
deleted.

## The CMS boundary

Open since WP17. `cms/client.py` writes **drafts only** — every payload is checked for
`_status: "draft"` before it is sent, and the client has no publish method at all. Authenticates
with the machine account's API key (WP15.2), not a login: `Authorization: admins API-Key
<key>`, which Payload refuses for anything that would publish, unpublish, or edit a document
that is already live — verified there against every vector, not just documented.

**Any update must send `?draft=true`.** Without it Payload resolves the *published* row, and
— WP15.2's finding — with drafts enabled, `_status` on its own resolves against a document's
*latest version*: a Track that is published but carries a pending draft edit reads as a draft
and gets written as one. Requiring the flag changes where a write lands rather than trusting
what the document claims to be.

The maximal-fixture round-trip runs against real Payload, not a stand-in — WP15 shipped a
backend mapper that silently dropped three optional fields with 932 tests green, and this
package's source references are optional fields too.

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

**HTTP is confined to `cms/client.py` and asserted to live nowhere else** —
`tests/test_boundaries.py` checks the parsed source, not by review. Payload's tables are
never touched regardless of caller: direct access bypasses draft/publish resolution, which
silently breaks takedown.

**The graph-shape problem.** A running graph cannot reach a thread that already reached
`END` when a node is added behind it — every package since WP17 has hit this once. Rather
than rediscovering it a fourth time, the pattern is now standard: a deliberate CLI
invocation (`write-drafts`, `generate-assets`, and WP19's gate-2 equivalent) that loads a
finished run's checkpointed state, does the work, and folds the result back in with
`graph.update_state`. All three are idempotent — re-running skips whatever a Leaf already
has.
