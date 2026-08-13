# Content Pipeline — Architecture & Implementation Plan

**Status:** Proposed — awaiting founder approval
**Author:** Architect, from the founder's plan of 2026-08-13
**Owner once approved:** a dedicated Pipeline Manager session (`agents/pipeline-manager.md`)

Phase 2. This is the service that turns a book into a Track of Leaves, with a content writer in the loop throughout.

---

## 1. What the founder proposed

A LangGraph of five nodes — **Analyzer** (read the book, build RAG), **Breakdown** (book → branches and Leaves), **Asset generator** (images), **ExtraContent generator** (Dinner Table facts, apply-in-life), **Reviewer** (a strong LLM reviewing the finished Leaf and feeding back to the other nodes). A human reviews after each node and can give feedback; multiple assets are generated and the human picks.

Two additions to a Leaf: **assets** (a scenario image, and an illustrative diagram for the sticky-notes slide) and an **apply-in-life** fact.

**The shape is right.** Separating analysis from breakdown from generation is correct, human-in-the-loop matches the Critic-in-the-Loop that `LEGAL.md` requires, and grounding generation in retrieval over the source is the only honest way to produce the per-claim source references the legal position depends on.

What follows is what I would change, then how to build it.

---

## 2. The seven recommendations

### R1 — This changes the product schema, and that schema is frozen

The plan reads as an additive service. It is not: assets and apply-in-life are **new fields on `Leaf`**, and `packages/shared/src/content.ts` was frozen on 2026-08-08. Changing it means a coordinated change across four places — the shared schema, the Payload collections that enforce the same invariants independently, the mobile renderer, and a migration for the 28 seeded Tracks.

**This is the largest omission in the plan** and it is app work, not pipeline work. It must land *before* the pipeline generates anything, or the pipeline will produce content the app cannot store or display.

**Recommendation:** a small app-side package (call it **WP15 — Leaf v2 schema**) that adds:
- `scenario.image` — an asset reference, optional
- `stickyNotes.diagram` — an asset reference, optional
- `takeaway.applyInLife` — a string, optional

**Apply-in-life belongs on the takeaway slide, not as a sixth slide.** The fixed five-slide structure is load-bearing: it is a compile-time guarantee in the shared types, a `group` field per slide in Payload, and the spine of the player. A sixth slide is a redesign; a field is a migration.

### R2 — Branches: dropped ✅ *(ruled 2026-08-13)*

**Resolved: branches are omitted entirely.** The Breakdown node emits an ordered list of Leaves and nothing else. It may group thematically while reasoning, but that grouping is not represented in its output, in the schema, or in the product. This confirms the 2026-08-06 ruling rather than reopening it.

<details><summary>Original recommendation, kept for the record</summary>


The plan says "breakdown the book into branches and leaves." Branch was ruled **not modeled** on 2026-08-06 — the original brief's Tree/Branch/Leaf was legal framing, and Track → Leaf is the real structure.

Two honest options:

- **Pipeline-internal only.** The Breakdown node groups thematically for coherence, then flattens to ordered Leaves. Zero product change. *Recommended for the first book.*
- **A real layer.** Journey renders themed sections. At 20–30 Leaves a flat list genuinely is hard to navigate, so this has become a better idea than it was in August — but it is schema, CMS and UI work on top of R1.

**Do not let the pipeline emit branches into a product that has no concept of them.** Pick one.
</details>

### R3 — Split the Reviewer in two. This is the most important recommendation here

The plan describes one Reviewer giving "3rd person perspective" feedback. That conflates two jobs with different stakes:

**Grounding verification — mechanical, pass/fail, legally load-bearing.** Every factual claim, every quote, and every Dinner Table fact must be traceable to a retrieved passage from the source. `LEGAL.md` names fabricated content attributed to a real author as the **highest-severity risk in the product**, above the copyright question. This check is not advisory and must not be a judgement call: a claim without a supporting passage does not proceed.

**Editorial review — advisory, subjective.** Is the scenario relatable, are the three options plausibly wrong, does the payoff earn the unlock, is the tone right.

Keeping them separate means the legal gate cannot be talked out of a rejection by an editorial argument, and the editorial reviewer can be tuned freely without touching the thing the legal position rests on.

### R4 — The sticky-notes diagram should not come from an image model

A scenario illustration is a good fit for image generation. A flowchart or Venn diagram is not: image models produce unreliable text, inconsistent styling, and artwork that cannot be edited or re-themed.

**Recommendation: the LLM emits a constrained structured spec — Mermaid, or a small JSON diagram schema — and we render it server-side.** That gives diagrams that inherit the app's palette, stay legible at any size, re-render if the design changes, and can be corrected by editing text rather than regenerating an image.

WP9 taught this the hard way at thumbnail size: legibility beats fidelity.

### R5 — Human gates belong at stage boundaries, not after every node

"Review after each node" times 5 nodes times 20 Leaves is 100 approval gates per book. Nobody finishes a book that way, and the review that matters gets skimmed because of the 80 that do not.

**Recommendation — three gates:**

1. **After Breakdown, once per Track.** The highest-leverage review by far: the Leaf list determines everything downstream, and fixing it here is free.
2. **Per Leaf, on the assembled result** — all five slides, assets, sources, and both reviewers' output on one screen. Approve, request changes with a note, or reject.
3. **Asset selection**, folded into gate 2 rather than standing alone. N candidates, the writer picks.

The founder's instinct — that the human must see each node's *output* — is preserved: the per-Leaf gate shows every node's contribution. What changes is that they are reviewed together rather than serially.

### R6 — Source acquisition and retention is the highest-risk unaddressed item

"The Analyzer reads the whole book" skips the question the entire legal strategy turns on: **where does the book text come from, and what happens to it afterwards?**

Ingesting a full copyrighted work into a vector store is a reproduction. `LEGAL.md`'s fair-use position is argued about *output* — it does not address ingestion, which is precisely what the live AI-copyright litigation is about.

**Ruled 2026-08-13:** the MVP ingests **PDFs, for about five books**. The written acquisition policy is **deferred to launch** and is now tracked in `launch-blockers.md`.

**Two things are architectural, not policy, and are built from the start:**
- **Provenance per Track** — which book, which edition, which file, ingested when, deleted when. It costs nothing to record and is retroactively impossible to reconstruct.
- **Retention behaviour** — retain embeddings and the short passages cited as source references; **delete the raw full text when a run completes.** An audit trail that proves grounding without holding a copy of the book. Building the pipeline to retain everything is building the thing counsel will later ask to be undone.

**Worth stating plainly:** if the promotional launch ships content generated during this MVP phase, that content reaches real users — so the acquisition *question* is not fully deferred, only the written policy is.

### R7 — Bound the cycles, and price the thing

LangGraph supports cycles, and reviewer→generator feedback is the classic place they run away: cost explosion, non-termination, two nodes oscillating between defensible positions.

- **A hard iteration cap per Leaf** (recommend 2 revision rounds), then escalate to the human. Never loop unbounded.
- **Idempotency and caching.** Re-running a Track must not regenerate accepted Leaves or re-embed the book.
- **A cost model before the first full book.** Whole-book analysis + 20 Leaves × (content + N image candidates + up to 2 revisions) is not trivial, and the per-Track number determines whether the library can grow.

---

## 3. Architecture

### 3.1 Where it lives

A separate **Python service at `apps/pipeline`** — decided 2026-08-06, and still right: the Gemini/Vertex and LangGraph ecosystems are strongest in Python, and this is a batch workload that has no business sharing a process with the request-serving backend.

It is **not** part of the Node backend and does not talk to it. Its sink is Payload, over the same REST boundary the backend already uses.

```
book file ──> apps/pipeline (LangGraph) ──REST──> Payload CMS ──> backend ──> app
                     │
                     └── pgvector in the existing Postgres (own database)
```

### 3.2 Long context *and* retrieval — not one or the other

Gemini's context window makes "read the whole book" viable without chunking, which is the right tool for **analysis and breakdown** — thematic structure is a whole-book judgement and RAG fragments it.

But **grounding still needs retrieval**: to attach a source reference to a claim you must retrieve the specific passage that supports it. Long context tells you the book says something; retrieval tells you *where*.

**Use both: long context for analysis and breakdown, retrieval for citation grounding and for the verification gate.**

### 3.3 The graph

```
ingest ─> analyze ─> breakdown ─> [HUMAN GATE 1: approve Leaf list]
                                          │
                                   ┌──────┴──────┐  per Leaf, parallel
                                   ▼             ▼
                              draft_leaf    extra_content
                                   └──────┬──────┘
                                          ▼
                                     assets (N candidates)
                                          ▼
                                 ground_check  ──fail──> revise ──┐
                                          │                       │ max 2
                                          ▼                       │
                                  editorial_review <──────────────┘
                                          ▼
                              [HUMAN GATE 2: per-Leaf approve + pick asset]
                                          ▼
                                    publish_to_cms
```

**Node responsibilities**

| Node | Does | Notes |
|---|---|---|
| `ingest` | Parse the book, chunk, embed into pgvector, record provenance | Deletes raw text at the end of the run per R6 |
| `analyze` | Whole-book understanding: themes, arguments, structure | Long context, not RAG |
| `breakdown` | Propose 15–30 Leaves with titles, order, and the concept each teaches | **Must not mirror the book's chapter structure 1:1** — a hard `LEGAL.md` requirement, and worth an explicit check rather than a prompt instruction |
| `draft_leaf` | The five slides for one Leaf, with retrieved passages attached to every claim | Emits candidate source references, not prose citations |
| `extra_content` | Dinner Table fact, apply-in-life | DTK **cannot** be emitted without a takeaway-slide source reference — the schema already enforces this in two places |
| `assets` | N scenario images; a diagram *spec* for sticky notes | R4 |
| `ground_check` | Every claim → a retrieved passage. Pass/fail | The legal gate. Not advisory |
| `editorial_review` | Quality, pedagogy, scenario plausibility | Advisory; feeds `revise` |
| `revise` | Apply feedback | Capped at 2 rounds, then escalate |
| `publish_to_cms` | Write a **draft** Track/Leaf into Payload | Never publishes directly — the CMS's own publish-time rules still apply |

**The pipeline writes drafts, never published content.** Payload's existing publish-time validation — exactly one correct option, DTK sourced, all five slides, disclaimer and purchase link, cover image — remains the last gate, and it is independent of anything the pipeline believes.

### 3.4 State and human-in-the-loop

LangGraph's `interrupt` plus a **Postgres checkpointer**. Runs must survive days, because gate 1 and gate 2 are human and asynchronous.

State carries: book provenance, the Leaf plan, per-Leaf drafts and their retrieved passages, asset candidates, both reviewers' output, revision counts, and gate decisions.

### 3.5 Where the human works

**In Payload**, via custom admin views. The content writer already lives there, the output lands there, and the alternative is a second tool with a second auth system for one person.

This finally requires the **role-based permissions** deferred since WP1 — writer versus reviewer versus admin. Payload has this in core.

---

## 4. External tools and services

| Need | Choice | Why |
|---|---|---|
| Orchestration | **LangGraph** (Python) + `langgraph-checkpoint-postgres` | Cycles, interrupts and durable state are exactly this problem |
| LLM | **Gemini via Vertex AI** | Decided 2026-08-06. Long context suits whole-book analysis |
| Embeddings | **Vertex AI text embeddings** | Same vendor, same DPA |
| Vector store | **pgvector in the existing Postgres**, own database | We already run Postgres. A managed vector DB is a vendor and a cost for no capability we need at this scale |
| Images | **Imagen via Vertex AI** | Vendor consolidation: one GCP DPA rather than a second provider's |
| Diagrams | **Mermaid or a constrained JSON spec, rendered server-side** | R4 — editable, themeable, legible |
| Book parsing | **PyMuPDF** for PDF, plus an EPUB reader | Mature, no service dependency |
| Tracing / eval | **LangSmith** | Multi-node graphs with cycles are near-undebuggable from logs. Also where reviewer agreement gets measured |
| CMS write | **Payload REST API** with an authoring token | The same boundary the backend uses. **Never write Payload's tables directly** |

**MCP:** not needed. The pipeline talks to Payload over REST and to Vertex over its SDK; wrapping either in MCP would add a hop and a failure mode for no gain. Revisit only if a human-facing agent needs interactive access to the CMS.

---

## 5. Suggested sequencing

| # | Package | Scope |
|---|---|---|
| **WP15** | **Leaf v2 schema** — app-side | `scenario.image`, `stickyNotes.diagram`, `takeaway.applyInLife` across shared types, Payload, the player, and a migration. **Must precede any generation** |
| **WP16** | Pipeline skeleton | `apps/pipeline`, LangGraph with Postgres checkpointer, ingest + analyze + breakdown, gate 1 in Payload. **Ends with a human-approved Leaf plan for one real book** |
| **WP17** | Leaf generation | `draft_leaf`, `extra_content`, `ground_check`, retrieval-backed source references |
| **WP18** | Assets | Image candidates, diagram specs and their renderer |
| **WP19** | Review loop and gate 2 | `editorial_review`, `revise` with the iteration cap, the per-Leaf approval view |
| **WP20** | Run one book end to end | The real deliverable. A published Track produced by the pipeline and approved by a human |

---

## 6. Founder decisions — 2026-08-13

| Question | Ruling |
|---|---|
| Branches | **Dropped entirely.** Breakdown emits ordered Leaves and nothing else |
| Source | **PDF, ~5 books for the MVP.** Written acquisition policy deferred to launch; provenance and retention built from the start |
| Sequencing | **App-side schema first (WP15)**, then the pipeline |
| R1, R3, R4, R5, R7 | All accepted as recommended |

### Still open, answerable as we go

1. **Who is the content writer?** The plan implies a role that does not exist yet, and it drives Payload permissions.
2. **Is `apply-in-life` a takeaway field or something the reader opens separately**, like Dinner Table Knowledge? WP15 assumes a field; say so if you want a disclosure.
3. **Budget ceiling per Track** — determines revision caps and how many asset candidates are generated.
4. **Does the pipeline run against the same Payload as the app**, or its own instance until trusted? Recommend the same one, writing drafts only.
