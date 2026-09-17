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
| `ZOOMOUT_PIPELINE_VERTEX_PROJECT` | with Vertex | GCP project id. Required when `USE_VERTEX` is set — it is what calls bill to. **Use `zoomout-vertex`** — see below. |
| `ZOOMOUT_PIPELINE_VERTEX_LOCATION` | no | Default `global`. Gemini 3.x is **only** served there — regional endpoints 404. |
| `ZOOMOUT_PIPELINE_EMBED_REQUESTS_PER_MINUTE` | no | Default 60, sized for the AI Studio free tier. Raise it on Vertex. |
| `ZOOMOUT_PIPELINE_ANALYZE_MODEL` | no | Default `gemini-3.6-flash`. |
| `ZOOMOUT_PIPELINE_BREAKDOWN_MODEL` | no | Default `gemini-3.6-flash`. |
| `ZOOMOUT_PIPELINE_EMBEDDING_MODEL` | no | Default `gemini-embedding-001`, truncated to 768 dimensions. |
| `ZOOMOUT_PIPELINE_DRAFT_MODEL` | no | Default `gemini-3.6-flash`. The five slides. |
| `ZOOMOUT_PIPELINE_EXTRAS_MODEL` | no | Default `gemini-3.6-flash`. Dinner Table Knowledge and apply-in-life. |
| `ZOOMOUT_PIPELINE_RUNS_DIR` | no | Where plan files are written. Default `runs/`. |
| `ZOOMOUT_PIPELINE_PAYLOAD_URL` | no | Default `http://localhost:3001`. `localhost`, not `127.0.0.1` — see the note below. |
| `ZOOMOUT_PIPELINE_PAYLOAD_API_KEY` | for CMS writes | The machine account's key (WP15.2). Provisioned by `npm run create-pipeline-key --workspace=apps/admin`, printed once, never in the repo. |
| `ZOOMOUT_PIPELINE_IMAGE_MODEL` | no | Default `gemini-3-pro-image`. Matches the anchor set's family — conditioning is strongest within one. |
| `ZOOMOUT_PIPELINE_DIAGRAM_MODEL` | no | Default `gemini-3.6-flash`. Only emits a JSON spec. |
| `ZOOMOUT_PIPELINE_SCENARIO_CANDIDATES` | no | Default 3. How many illustrations the human chooses between at gate 2. |
| `ZOOMOUT_PIPELINE_DRAFT_MODEL` | no | Also derives the scene plan — one text call per Track. |
| `ZOOMOUT_PIPELINE_MAX_IMAGES_PER_TRACK` | no | Default 70. **Halts** a run rather than warning — see `assets/budget.py`. |
| `ZOOMOUT_PIPELINE_NARRATION_MODEL` | no | Default `gemini-2.5-flash-tts`, over Cloud Text-to-Speech. |
| `ZOOMOUT_PIPELINE_NARRATION_LANGUAGE` | no | Default `en-US`. |
| `ZOOMOUT_PIPELINE_MAX_NARRATION_USD` | no | Default 3.0. Counted across every voiceover invocation on a run; **halts** before any call whose worst case would cross it. |

```bash
export ZOOMOUT_PIPELINE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/zoomout_pipeline"

# Either the Developer API...
export ZOOMOUT_PIPELINE_GEMINI_API_KEY="..."

# ...or Vertex AI, with no key on disk:
export ZOOMOUT_PIPELINE_USE_VERTEX=true
export ZOOMOUT_PIPELINE_VERTEX_PROJECT=zoomout-vertex
export ZOOMOUT_PIPELINE_EMBED_REQUESTS_PER_MINUTE=600

# For anything that writes to Payload:
export ZOOMOUT_PIPELINE_PAYLOAD_API_KEY="..."
```

**`localhost`, deliberately not `127.0.0.1`, for `ZOOMOUT_PIPELINE_PAYLOAD_URL`.** Next's dev
server rejects `/_next/*` requests whose `Origin` it does not allowlist, which covers
`localhost` but not the IP form — the admin UI 403s its own JavaScript and renders blank with
nothing on screen to explain why. `allowedDevOrigins` in `apps/admin/next.config.ts` (WP15.2)
fixes the admin UI itself; the pipeline's default just avoids walking into the same trap.

### Which project, and why this is written down

**`zoomout-vertex`.** There are three ZoomOut projects on this account and the names do not
tell you which is which: `zoomout-b1358`, `zoomout-free-test` and `zoomout-vertex`.
**`zoomout-free-test` is the free tier and no book in copyright may go through it** — Google's
free tier uses submitted content to improve its products, which is the whole reason
development was confined to public-domain books.

It is recorded here because it was not recorded anywhere. WP30 exported it per-session, and
when a later session picked the work up it was not in the environment, not in `gcloud config`
and not in the repo — every command was blocked on a value nobody could reconstruct. A
project id is not a credential; it appears in the URL of every Vertex call. The credential is
ADC, which stays on the machine.

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

### Free tier is for public-domain books only — and this is now a check

**Keyed off the book's own `acquisition`, not off a flag.** `public-domain` may use the AI
Studio Developer API; `licensed`, `purchased` and `undocumented` must use Vertex. A run that
would send one of the latter through the free tier **refuses before the first call**, exits 2,
and names the fix. See `require_paid_tier` in `config.py`.

`ZOOMOUT_PIPELINE_PAID_TIER` is gone. It was a bool, defaulted to the unsafe value, and was
read by no code for four packages while a comment claimed it was enforced.

**What the check cannot see:** it checks the label, not the book. A work ingested as
`public-domain` that is not public domain passes, and nothing downstream notices. The label is
a human's claim made at ingest; this makes that claim load-bearing and visible, and does not
verify it.

Every run records which door it used — `zoomout-pipeline status --run-id <id>` prints the
transport, the project when it is Vertex, and the resolved `acquisition`.

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

## Scenario illustrations: one identity, many places

Two files, and the split is the point.

| | |
|---|---|
| `prompts/asset_style.md` | **What every image shares** — medium, the dark palette, the teal accent, how figures are drawn, and the absolute prohibitions. Appended to every image prompt. |
| `prompts/scene_setting.md` | **What must differ** — the place, interior or exterior, time of day, camera distance, and how many people are in frame. Read by a text model that decides them per Leaf. |

They were one file until WP30, and holding them together is what produced Track 42:
**eighteen seated figures at a table in a dim interior, eighteen out of eighteen**, including
a scenario about buying a family home. The style contract was holding the *environment*
constant along with the palette, and its subject section ended with a menu of five places
headed by a desk.

**The plan is derived for the whole Track in one call, before any image is bought.** That is
the mechanism rather than an optimisation: a model that cannot see the other seventeen
scenarios has nothing to vary from, so "vary the setting" in a per-Leaf prompt is a wish. Shown
all of them together and required to return distinct places, it cannot collapse them without
failing to parse.

`ScenePlan` refuses a bare generic (`an office`), a place used twice, and **any word appearing
in more than half the places** — which is what stops eighteen unique strings that are all a
desk. It also refuses a frame with `figures: 0` whose focus names somebody's hands, because a
model given both draws a disembodied one. Derivation failing is **fatal to the asset run**:
falling back to "no setting" reproduces Track 42 silently, after paying for it.

The plan is checkpointed into the run, so a resumed or `--limit`ed asset run draws the rest of
the Track from the same places rather than deriving a second, independent set.

```bash
uv run zoomout-pipeline check-variety --track-id 42     # measure a Track in the CMS
uv run zoomout-pipeline check-variety --dir some/pngs   # or a folder, for a before/after
```

**Keep the images.** `generate-assets --save-dir runs/<id>/images` writes every candidate to
disk with its alt text as it is generated, before the upload and before the diagram call that
could raise. WP30's before/after comparison was that package's most important evidence, lived
in a temporary directory, and no longer exists.

```bash
uv run zoomout-pipeline generate-assets --run-id ikigai --save-dir runs/ikigai/images
uv run zoomout-pipeline contact-sheet --dir runs/ikigai/images
```

`contact-sheet` is the companion to `check-variety` and not a substitute for it. That measures
whether every picture has a near twin; this produces the thing a person looks at. **The checks
that actually decide whether a Track ships cannot be measured** — does this place belong to
this scenario, is there text in the frame, is there a light bloom, is there a hand attached to
nobody. All of those are absolute prohibitions or hard requirements with no mechanical gate,
and Track 42's published Leaf 1 breaches two of them right now.

## Voiceover: `audition-voices` and `narrate` (VO-2, reshaped VO-2.1)

Four slides per Leaf are read aloud — `summary.body`, `scenario.prompt`, `payoff.body`,
`takeaway.body` — through **Cloud Text-to-Speech** (`gemini-2.5-flash-tts`), billed to the Vertex
project. The founder chose **two** narrators after the 2026-09-17 audition, for readers to pick
between: **Achernar** (female) and **Sadaltager** (male) — `assets/narration.py:NARRATOR_VOICES`
is the mapping from `NarratorId` to the provider voice, mirroring `NARRATOR_IDS` in the frozen
`content.ts`. A slide's `audio` is an array (VO-1.1), one entry per narrator, and `narrate`
always renders and attaches **both together**: a Leaf attaches only once every narrated slide
passes in both voices, never one narrator alone.

**Never `sourceReferences[].quote`.** Those are the book's verbatim words, and reading them
aloud would be an audio reproduction of copyrighted text (`LEGAL.md`, "Narration"). The list of
readable fields is `assets/narration.py:NARRATED_FIELDS`, asserted exactly by
`tests/test_narration_selection.py`; the TTS client takes a `NarrationLine` and nothing else.

```bash
export ZOOMOUT_PIPELINE_MAX_NARRATION_USD=3.0   # the ruled ceiling, counted across invocations

# Choose the narrator by ear. Nothing is written to the CMS.
uv run zoomout-pipeline audition-voices --run-id ikigai \
  --voice Sulafat --voice Achird --line 4:scenario --line 10:takeaway --undirected

# Render (free for anything already rendered), check, and build a review track per narrator —
# writes runs/<run>/audio/review/<book>-narration-<voice>.{mp3,md,html}:
uv run zoomout-pipeline narrate --run-id ikigai --render-only --max-attempts 3 --listen-for moai

# Then attach, as drafts — both narrators, one PATCH per Leaf:
uv run zoomout-pipeline narrate --run-id ikigai --listen-for moai
```

| Step | What happens | Why |
|---|---|---|
| Direction | `prompts/narration_direction.md`, shared block + one per slide type | Per type, never per clip — it has to survive a second book |
| Synthesis | LINEAR16, cached under a hash of everything asked | Nothing paid for is bought twice; a new voice or direction is a new clip |
| Budget | Reserves the **longest response Cloud TTS can return** before each call | A clip's length is the model's choice; the ceiling is a stop, not a report |
| Levelling | Every clip to the same speech loudness, 60 ms head, 350 ms tail, breath cut | A set, not 72 files; VO-3's player can rely on how a clip ends |
| Encoding | 64 kbps mono mp3, measured by decoding the uploaded bytes | `Media` accepts `audio/mpeg` only; `durationSeconds` is measured, not estimated |
| Guard | A **blind** transcript (Gemini on Vertex), compared word by word | A clip that says other words is a fabrication in an author's name |
| Pace | Words per minute **of speech**, pauses excluded, must be 100–330 | Catches a spoken direction even when the transcriber leaves it out |
| Attach | Both narrators' clips together; find-then-upload by content hash; one whole-group draft PATCH per Leaf, each `audio` a two-row array; both versions re-fetched | Partial group PATCHes null siblings (WP19); a reader must never get one narrator mid-book; the live Leaf must not move |
| Review | One mp3 per narrator, in reading order, with a cue sheet of where to listen | Nothing else hears the 72 (per voice) as a set |

A clip that still fails the guard or the pace check after its attempts (`--max-attempts`, 1–3,
default 2; attempts already on disk are reused) holds its **whole Leaf**: not attached, named,
and left in the review track for a person — and now that holds across both narrators, not just
across a Leaf's four slides. Spend is written back to the run after every call, and a timed-out
call is charged even when no clip came back.

**`textDigest`** is `sha256` hex of the narrated field exactly as the clip was made from it —
`assets/narration.py:text_digest`, never `speakable()`'s TTS-rewritten form. The backend
recomputes the same hash from whatever Payload serves and silently drops any entry that no
longer matches, so this is the one place a stray `.strip()` would make clips vanish with no
error anywhere; `tests/test_narration_write.py::TestTextDigest` is the guard.

**Run one `narrate` at a time per run.** Two processes on one run would race on its cost ledger.

**The first direction was read aloud.** It began "Read the text exactly as written: every word,
in order…", and Gemini-TTS spoke everything after the colon before the Leaf text in 12 of 13
audition clips. The transcriber left it out of nine of those transcripts. A style prompt
describes delivery; it never tells the model to read anything.

**Checking which door was used** — Google's own request counts, per service, for the project:

```bash
TOKEN=$(gcloud auth print-access-token)
curl -s -G -H "Authorization: Bearer $TOKEN" \
  "https://monitoring.googleapis.com/v3/projects/zoomout-vertex/timeSeries" \
  --data-urlencode 'filter=metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.labels.service="texttospeech.googleapis.com"' \
  --data-urlencode "interval.startTime=$(date -u -v-3H +%Y-%m-%dT%H:%M:%SZ)" \
  --data-urlencode "interval.endTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Swap the service for `generativelanguage.googleapis.com` to confirm the Developer API saw
nothing. `status --run-id <id>` prints the narration transport the run recorded, with the
endpoint read off the client that made the calls.

## Rewriting one Leaf: `rewrite-leaf`

For the defect no gate here can produce. Ikigai's Leaf 17 listed five of the book's *ten rules
of ikigai* in the book's own imperative phrasing, and restated them in the Dinner Table fact
and in seven source-reference notes. It passed the structure check (which measures chapter
mapping), passed grounding (every rule was cited), and passed editorial review, whose four
categories — pedagogy, scenario plausibility, prose, attribution — have no member for it.

So the findings come from a person, in a YAML brief, and everything downstream is the
machinery `review.py` already has:

```bash
uv run zoomout-pipeline rewrite-leaf --run-id ikigai --order 17 \
  --brief runs/ikigai/leaf-17-brief.yaml
```

| | |
|---|---|
| `findings` | Fed to `revise` as an `EditorialReviewResult`. Required — a rewrite with nothing named is a regeneration. |
| `forbidden_phrases` | Checked mechanically afterwards against **everything a reader sees**, citation notes and quotes included. |
| `extras_instruction` | Prepended to the `extra_content` prompt. Only reached when the slides were actually rewritten. |

**A rewrite that fails grounding is discarded and the original stands.** A human deciding
*what* is wrong does not also get to decide the fix may be ungrounded. Retried once with the
grounding failures quoted back — the mechanism `draft_leaf` uses for the same gate — then it
stops and hands the failures to the person who wrote the brief.

**`forbidden_phrases` passing is not the Leaf being right.** A paraphrase of the same list
clears it. Whether the idea was taught instead of the list reproduced is a reading, and the
command says so in its own output.

**It measures the pictures, not the labels** — a place label can say "construction site" over a
rendering of a desk. Two obvious designs do not work and `assets/variety.py` records why: a
brightness grid scores Track 42 *above* the anchor set, because these images differ in where
the light is rather than in what is in them; and the median over all pairs cannot separate them
either (0.80 against 0.79). What "collapsed" means is that every picture has a near twin, so
the statistic is the **median nearest-neighbour distance** over an edge-density signature.
Track 42 measures 0.50 on it and the anchor set 0.67.

The floor is calibrated on real images only, and on few of them. **Revisit it on the third
Track rather than trusting it.**

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
