# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

### Handoff: 2026-08-29 — WP19: Gate 2, the editorial reviewer, and the answer-length check

*Pipeline Manager. The last package before WP20 runs a book end to end.*

### Task: WP19 — per-Leaf human approval, advisory editorial review, and one more mechanical gate

**Context:** Everything a Leaf needs now exists — grounded text, a diagram, three image candidates — and none of it has been reviewed. This package builds the review. **It is also the package that decides whether the library can grow**, and not for the reason the roadmap assumed: generation costs ~$4 a Track, while Critic-in-the-Loop review costs **4.5 to 7.5 hours per book** and lands entirely on one person. Money was never the ceiling. **Every design choice here should be read as "does this reduce the founder's minutes per Leaf".**

**Objective:** A human opens a generated Leaf in Payload, sees everything about it on one screen — five slides, both assets, all source references, the editorial reviewer's findings — picks an image candidate, and approves, requests changes, or rejects. Plus one more mechanical check that runs before any of that.

**Scope:** `apps/pipeline/`. Gate 2's surface lives in Payload — see the note on that below before building anything.

---

**Requirements**

*1 — the answer-length check. Mechanical, and not part of `ground_check`*
- WP17 measured the correct option as the **longest** in 15 of 18 Leaves, against a chance of ~6. Combined with the position bias it already fixed, a reader scored 83% without reading. `PRODUCT.md` calls active recall the product thesis; a gate answerable from formatting makes it decorative.
- **Ruled 2026-08-27: this is its own mechanical, deterministic check — not `ground_check`, and not the advisory reviewer.** Keeping it out of the legal gate is right, because style findings are exactly what would make that gate arguable. But an advisory finding is too weak a guard for a defect that empties the product's core claim. **Your 1:1 structure check is the precedent**: mechanical, measured, not the legal gate.
- **Measure per Track, not per Leaf.** One Leaf whose correct answer is longest is chance; a Track where it always is is a tell.
- **The generation-side fix is substantive distractors, not a shortened correct answer.** That also addresses the strawmanned wrong options you found reading Leaf 6 — one fix, two problems.

*2 — `editorial_review`. Advisory, and deliberately so*
- Quality, pedagogy, scenario plausibility, prose. WP17's read-through named the standing complaint: **the prose is stiff.**
- **Advisory means advisory.** It feeds `revise`; it does not block. R3 exists so the legal gate cannot be argued down on quality grounds, and the converse holds — an editorial reviewer that can veto becomes a second legal gate nobody designed.
- Cross-family review costs money by construction (§4a: Claude has no free tier anywhere). **Price it before running it across a Track**, and say what you chose.

*3 — `revise`, bounded*
- Hard cap, then escalate to the human. R7's original figure was 2; WP16.1 raised the breakdown cap to 5 on the grounds that the cost assumption behind it had changed. **Pick a cap for this loop deliberately and say why** — do not inherit either number by default.

*4 — attributive framing. Ruled 2026-08-27, and this is where it lands*
- Claims about **how the world works** are framed as the author's — "Wattles argues that…" — rather than asserted as operative fact. Ordinary practical advice needs no hedge, or every sentence acquires a stammer.
- **Apply-in-life is the sharpest case**, because it tells a reader to *do* something. Where the book's mechanism is metaphysical, take the behavioural residue — "write a specific, vivid description of what you want and read it daily" — not the metaphysical claim.
- This is a prompt change plus something the editorial reviewer looks for. **It is not modernising the author**, which remains fabrication; it is the difference between reporting a belief and asserting it. The Track-level disclaimer already says we teach rather than endorse; the slide prose currently contradicts it, and the layer that reaches the reader wins.

*5 — gate 2's surface*
- **In Payload, not a file.** WP16's file-based gate 1 was ruled correct *for gate 1* — 20 titles review fine as text. Gate 2 is five slides, two assets and a set of source references per Leaf, eighteen times. That is a screen.
- **The drafts are already there**, which is why WP17 opened the boundary early. Gate 2 is a review of what is in Payload, not a new transport.
- **If building the admin view requires `apps/admin` changes, stop and say so** rather than reaching across — that is Manager's, and a small handoff is cheaper than a scope breach. Architect ruled 2026-08-27 that human RBAC is **not** required for this: one person is writer, reviewer and admin, and the pipeline's inability to publish is now a permission rather than a promise.

*6 — the graph-shape problem, third occurrence*
- Adding nodes cannot reach threads that already reached `END`. WP17 hit it and solved it with an explicit `write-drafts --run-id`; WP18 hit it again. **Track 42 is finished and this package adds three nodes behind it.** Design for it rather than rediscovering it.

---

**Out of scope:** WP20's end-to-end run, publishing, deployment, a semantic entailment check (named in the debt register, needs an LLM judge and is deliberately not folded into the mechanical gate), OCR for the no-text guardrail.

**Also queued for you, small, and best done first:** the **sixth style anchor** — a lit interior with no glow, teaching the exception rather than only forbidding it. ~$0.04, approved 2026-08-29. **Do not regenerate Track 42's images for it** — that Track's text is regenerating after this package anyway and images follow text.

**And the WP15.2 follow-on:** switch `cms/client.py` from the login to `Authorization: admins API-Key`. Creates need no change; **any update method must send `?draft=true`** — WP15.2 found that a `_status` constraint reads against the latest version, so a published document with a pending draft evaluates as a draft and slips through. `draft=true` changes where the write lands rather than what it claims.

**Constraints**
- Public-domain books only, unchanged.
- The trial credit expires ~17 September. Editorial review is the one node here that spends.

**Read-it-yourself gate:** *Take one Leaf through gate 2 as the founder will, and time it.* The number of minutes is the deliverable — it is the constraint on the whole library, and nobody has measured it. Then read a revised Leaf against its original: **did the editorial pass make the prose less stiff, or just different?** An advisory reviewer that changes text without improving it costs money and review minutes for nothing.

**Acceptance criteria**
- [ ] `apps/pipeline` lint, `mypy --strict`, `pytest` pass; root `lint`/`test`/`build` unaffected
- [ ] **The answer-length check measures per Track and fires** on a deliberately-tell-ridden fixture — mutation-checked, and it must go red for the right rule
- [ ] The length check is **separate from `ground_check`** — breaking one does not turn the other's tests red
- [ ] `editorial_review` produces structured, actionable findings and **cannot block** — proven by a Leaf that passes with findings outstanding
- [ ] `revise` terminates at its cap and escalates; the cap is a named constant with its reasoning
- [ ] Attributive framing is applied, and a metaphysical apply-in-life is rendered as behavioural residue — shown by example, not asserted
- [ ] A human can review a Leaf, pick one of three image candidates, and approve / request changes / reject
- [ ] An approved Leaf carries its chosen image; the other two candidates are not attached
- [ ] Nothing this package writes is ever in a published state
- [ ] The three new nodes reach Track 42, which already finished
- [ ] Editorial spend logged and reported per Leaf
- [ ] **One Leaf has been taken through gate 2 and the minutes reported**

**Testing expectations:** Tier A on the length check firing, the revision cap terminating, and never-publishes. Tier B one happy path each for review, selection and approval. Test the editorial node on its **contract** — findings parse, required fields present — never on its prose. Live-model runs stay in the explicit suite outside the normal gate. List what you deferred.

---

### Handoff: 2026-08-29 — WP15.3: Remove `delete` from the machine account

*Manager. Two lines, per your own WP15.2 report.*

### Task: WP15.3 — scope `delete` away from the pipeline's API key

**Context:** WP15.2 scoped the machine account away from publishing and correctly left `delete` alone rather than widening scope without a ruling. **Ruled 2026-08-29: close it.**

**Objective:** The pipeline's API key cannot delete Tracks, Leaves, or media.

**Scope:** `apps/admin/` — the same access control WP15.2 touched.

**Why, because it is worth more than two lines suggests:** the pipeline has no use for deletion — its idempotency is find-then-update, and WP17's junk-Track cleanup was manual housekeeping done by a human with a login. **The argument is WP15.2's own finding.** Publishing was believed scoped, thirteen unit tests agreed, and the key could still unpublish a live Track. The same class of mistake on `delete` does not expose content, it destroys it — and **takedown is a legal obligation**, so a machine account able to delete a Track is able to break a compliance mechanism.

**Out of scope:** human roles, anything in `apps/pipeline`, revisiting WP15.2's publish scoping.

**Device gate:** *using the key directly, attempt to delete a Leaf and be refused; then create and update a draft and succeed.* Both halves — a key that cannot delete because it cannot do anything is not the result.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] **The key is refused on delete** for Tracks, Leaves and media — verified by calling the API, not by reading config
- [ ] The key can still create and update drafts, and still cannot publish
- [ ] Payload's config cache means access-control changes need a server restart — **restart before verifying**, per WP15.2's own note, or the probe tests the old config

**Testing expectations:** Tier B, but the refusal and the still-works checks belong together in one test so neither can pass alone.

---

### Handoff: 2026-08-28 — WP18: Assets — scenario images and sticky-note diagrams

*Pipeline Manager.*

### Task: WP18 — the assets node: image candidates, diagram specs, and one visual identity

**Context:** The last generation package. WP17 produces five slides of grounded text; this makes them look like a product rather than a document. **Founder ruled that scenario images ship** — overriding the recommendation to defer — because the launch experience needs to be as real as possible.

**This is the only node that costs money per Leaf, and the GCP trial credit expires ~17 September.** Sequence accordingly: see the anchor-set note below.

**Objective:** Every Leaf can carry a scenario illustration chosen from N candidates and a sticky-notes diagram rendered from a spec, both uploaded to Payload, both carrying `alt` text, and all of them looking like they came from the same product.

**Scope:** `apps/pipeline/`. WP15 already added `scenario.image` and `stickyNotes.diagram` to the schema and the player — read them rather than assuming their shape, and do not change `content.ts`.

---

**Requirements**

*Do this first, before the rest of the package*
- **Generate and commit the style anchor set.** It needs no Payload contact, no WP17 output, and nothing else in this package — so it can land inside the credit window regardless of how the rest goes. It is also the input everything else depends on, so building it first is the natural order anyway.
- The anchor set is a small committed collection of reference images defining the house style, with a written **style contract** derived from `proposals/design-direction.md` — palette, rendering style, composition, subject treatment.
- **Bring the anchor set to the founder before generating 18 Leaves against it.** It is the one artefact where a wrong call is expensive to discover late: every image in the product inherits it.

*Scenario images*
- N candidates per Leaf. The human picks at gate 2 (WP19) — do not pick for them, and do not generate one and call it done.
- **Reference-image conditioning against the anchor set**, so the library shares one visual identity rather than looking like eighteen unrelated stock illustrations. This is the founder's explicit requirement and the difference between "illustrated" and "AI slop".
- **Content guardrails, ruled and non-negotiable:** no author likeness, no real or identifiable people, no book cover or publisher branding, **no rendered text in images**. The first three are legal exposure; the fourth is because image models cannot spell.
- **`#FFB020` is excluded from illustrations.** `design-direction.md` §3 reserves amber for reward moments, and an illustration using it steals the signal from the unlock.
- **`alt` is required.** WP15 made an asset without `alt` unpublishable, so an image with no `alt` is not a degraded asset — it is a Leaf that cannot ship. Generate it, do not leave it to the human.

*Sticky-notes diagrams*
- **A Mermaid or constrained-JSON spec, rendered server-side — not an image model** (R4). Editable by correcting text, re-themeable when the design changes, legible at any size, and a text call rather than a priced image.
- Store the **spec alongside the rendered asset**. WP15 added `spec` and `specFormat` precisely so a writer can fix a diagram by editing text; an asset with no spec silently removes that.
- Validate the spec parses and renders **before** upload. A spec that fails to render is a broken slide, and WP11 already found a cover URL pointing at a web page.

*Payload*
- Upload through Payload's upload collection, which WP15 set up for this.
- Same boundary rules as WP17: REST only, drafts only, never Payload's tables.

*The graph-shape problem — WP17 named this and it lands here*
- **Adding a node cannot reach threads that already finished.** WP17 hit exactly this and solved it with an explicit `write-drafts --run-id` invocation. Track 42's run has already reached `END`; WP18 adds a node behind it. Do the same thing deliberately rather than rediscovering it.

*Cost — this is the package where it is real*
- Log **per image, per Leaf, per run**, separately from token spend.
- **A hard per-Track image budget that stops the run rather than a warning that annotates it.** N candidates × 18 Leaves × retries is where a pipeline quietly spends a credit.
- **Report the cost of a full illustrated Track.** That number decides whether the library can grow, and nothing else in the project can tell us.

---

**Out of scope:** gate 2 and the per-Leaf approval UI (WP19), the editorial reviewer (WP19), the answer-length check (WP19), publishing, regenerating Track 42's text.

**Constraints**
- Public-domain books only — unchanged, and now on R6's ingestion ground rather than the training-corpus one.
- Vertex, location `global`.
- Images have no free tier and no free fallback. If the credit lapses before this lands, the package becomes diagrams-only — which is why the anchor set goes first.

**Read-it-yourself gate:** *Put the candidates for three different Leaves side by side and ask whether they look like one product.* Not whether each is individually good — whether a reader moving between Leaves would notice they came from the same place. That is the founder's actual requirement and no assertion can measure it. Then look at one diagram at the size it renders on a phone: **legibility beats fidelity**, which WP9 learned the hard way at thumbnail size.

**Acceptance criteria**
- [ ] `apps/pipeline` lint, `mypy --strict`, `pytest` pass; root `lint`/`test`/`build` unaffected
- [ ] The anchor set and style contract are committed, and the founder has seen them
- [ ] N scenario candidates generate per Leaf and upload to Payload with `alt` populated
- [ ] A diagram spec renders, validates, and uploads **with its spec stored alongside**
- [ ] A spec that fails to render is rejected before upload, not after
- [ ] **No image contains rendered text, an identifiable person, or `#FFB020`** — checked, and say how
- [ ] Assets attach to Leaves that already exist from a finished run — the graph-shape problem handled deliberately
- [ ] The per-Track image budget **halts** a run that exceeds it — tested by setting it low
- [ ] Image spend logged per image and per Leaf; **the cost of one fully illustrated Track reported**
- [ ] Three Leaves' candidates have been looked at side by side and judged

**Testing expectations:** Tier A on the budget halt and on never-publishes. Tier B one happy path for generation, render and upload. Image generation itself is live-model — keep it in the explicit suite outside the normal gate, and use recorded fixtures for the deterministic tests. List what you deferred.

---

### Handoff: 2026-08-28 — WP15.2: Pipeline API key, and the admin UI blank-page bug

*Manager. Two small items, unrelated to each other, both from WP17's findings.*

### Task: WP15.2 — a revocable API key for the pipeline; fix `allowedDevOrigins`

**Context:** Both found by the Pipeline Manager while building WP17. Neither is pipeline work.

**Objective:** The pipeline authenticates with a scoped, revocable key instead of an admin login, and the admin UI stops rendering blank at `127.0.0.1`.

**Scope:** `apps/admin/` — the `Admins` collection and `next.config`.

**Requirements**

*1 — an API key for the pipeline*
- `Admins` has `auth: true` and no `useAPIKey`, so the pipeline currently holds a **login** — a password in an environment variable, with a human's full rights.
- Enable Payload's API key support and provision a key the pipeline uses instead.
- **Scope it so it cannot publish.** This is the point of the change, and it is larger than housekeeping: *"the pipeline never publishes"* is currently a promise the pipeline's own code makes about itself. A credential that cannot publish converts it into a permission the pipeline cannot exceed regardless of what its code does. Architect ruled 2026-08-27 that human RBAC is not needed at a team of one; **this is the machine half, and it is the half that matters.**
- Revocable without rotating a human's password.

*2 — the blank admin UI*
- Next 16 rejects `/_next/*` requests whose `Origin` is not allowlisted. `allowedDevOrigins` covers `localhost` but not `127.0.0.1`, and Payload loads chunks `crossorigin` — so at the IP address the admin UI 403s **one of its own JavaScript chunks** and renders blank.
- Reproduced precisely by the Pipeline Manager: same request with `Referer` → 200, with `Origin` → 403.
- One line. Worth doing because the failure is undiagnosable from the browser — a blank page with nothing in the console that points at the cause.

**Out of scope:** human role-based permissions (ruled not needed until a second person touches the CMS), anything in `apps/pipeline`.

**Device gate:** *load the admin UI at `http://127.0.0.1:3001/admin` and see it render*, then confirm the pipeline's key can create a draft and **cannot** publish one.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] The pipeline authenticates with an API key, not a password
- [ ] **The key cannot publish** — verified by trying it and getting refused, not by reading config
- [ ] The key is revocable independently of any human account
- [ ] The admin UI renders at `127.0.0.1:3001` as well as `localhost:3001`
- [ ] No credential is committed

**Testing expectations:** Tier B. The "cannot publish" check is the one that matters — verify the effect, not the config.

---

### Handoff: 2026-08-26 — WP15.1: Track `acquisition` field, and the red typecheck

*Manager, not Pipeline Manager. Small — two items — but the first one blocks WP17.*

### Task: WP15.1 — Add `acquisition` to Track; fix `npm run typecheck` on `main`

**Context:** The content pipeline starts writing Tracks into Payload in WP17. Every Track must record where its source text came from, because the book-acquisition question is unresolved and "which Tracks must be regenerated once it resolves" has to stay a **query**, not an act of memory. It is retroactively impossible to reconstruct. Separately, `main` has not typechecked since WP15.

**Objective:** A Track carries an acquisition status, and `npm run typecheck` is green from the repo root.

**Scope:** `apps/admin/` collections and validation, `packages/shared/src/content.ts` if the Track shape lives there, `apps/backend/src/content/content.mapper.test.ts`.

**Requirements**

*1 — `acquisition` on Track*
- Values: `public-domain` · `licensed` · `purchased` · `undocumented`. Exactly these four.
- **Required**, defaulting to `undocumented`. A Track with no status is the record we specifically said we would never create — but defaulting rather than failing keeps the 28 existing Tracks valid without a backfill, and `undocumented` is an honest description of every one of them.
- Authorable in the CMS and readable over the REST API, because the pipeline sets it on write.
- **It does not gate publishing.** Not yet — the acquisition policy is a launch decision that has not been made, and wiring an enforcement rule to a policy that does not exist yet would block content on a rule nobody has written. Record it now; enforce it when there is something to enforce.
- `content.ts` is frozen. If the Track shape lives there, this is the ruling that unfreezes it — re-freeze with the date updated and WP15.1 named.

*2 — the red typecheck*
- `apps/backend/src/content/content.mapper.test.ts:285` — `Type '"dot"' is not assignable to type '"json" | "mermaid" | null | undefined'`, from WP15's `cf3e286`.
- **Read the test before you fix it.** Line 279 is a deliberate negative test — *"rejects a diagram whose spec format is not one the renderer knows"* — so `'dot'` is invalid **on purpose**; that invalid value *is* the assertion. Changing it to a valid format makes the file typecheck and the test assert nothing.
- Fix it at the fixture: let it hold a deliberately-invalid value via a cast through `unknown`, with a comment saying why. **Confirm the test still fails when the mapper's validation is removed** — if it passes either way, the fix was wrong.

**Out of scope:** enforcing acquisition at publish time, the pipeline, backfilling the 28 Tracks to anything other than the default, WP12/WP13/WP14.

**Device gate:** *open a Track in the Payload admin UI and see the acquisition field, set it, save, and see it come back over the REST API.* Both halves — the CMS write and the API read — because the pipeline uses the second and only a human uses the first.

**Acceptance criteria**
- [ ] Root `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass
- [ ] Track carries `acquisition`, restricted to the four values
- [ ] **All 28 existing Tracks still validate and still serve**, defaulted to `undocumented` — verified by query
- [ ] The value set in the CMS is readable over the REST API
- [ ] Publishing is **not** blocked by the field's value
- [ ] The `'dot'` test still fails when the mapper's `specFormat` validation is removed — mutation-checked
- [ ] Migration applies cleanly to an empty database

**Testing expectations:** Tier B for the field — one happy path through CMS write and API read. The mutation check on the `'dot'` test is mandatory, not optional; it is the entire point of touching that file.

---

### Handoff: 2026-08-26 — WP17: Leaf generation, grounding, and the Payload boundary

*Pipeline Manager. Run **WP16.1 first** — it is small, it is free, and everything here inherits the plan it fixes.*

### Task: WP17 — draft_leaf, extra_content, ground_check, and writing drafts to Payload

**Context:** WP16 produces an approved Leaf plan. This package turns each planned Leaf into five real slides with a retrieved passage behind every claim, and lands them in the CMS as drafts. It is where `LEGAL.md` stops being a document and becomes a mechanism: **zero fabrication is enforced here or it is not enforced anywhere.**

**Objective:** For each Leaf in an approved plan, generate the five slides plus Dinner Table Knowledge and apply-in-life, attach a retrieved source passage to every factual claim, reject anything unsupported, and write the result into Payload as a **draft**. Done means a human can open a generated Leaf in the CMS and read it.

**Scope:** `apps/pipeline/`. **Blocked on** the `acquisition` field existing on Payload's Track collection — see the debt register; that is Manager's, not yours. Say so and stop if it is not there when you reach the CMS writer.

**Requirements**

*`draft_leaf`*
- The five slides, matching `packages/shared/src/content.ts` exactly. It is frozen — read it, do not assume its shape, do not change it.
- **Exactly one correct scenario option**, and the two wrong ones plausible. A scenario whose wrong answers are obviously wrong is a gate that does not gate.
- Every factual claim carries the retrieved chunk that supports it. The 136 chunks already hold chapter index, title and position — the locator is available, use it.

*`extra_content`*
- Dinner Table Knowledge and apply-in-life.
- **DTK cannot be emitted without a takeaway-slide source reference.** The schema enforces this in two places already; make it three. Tier A.

*`ground_check` — the legal gate*
- Every claim, quote and DTK fact maps to a retrieved passage, or it does not proceed. **Pass/fail, not advisory, not a score with a threshold you can nudge.**
- Keep it mechanically separate from anything editorial. R3's whole point is that this verdict cannot be argued down on quality grounds — and per WP16's ruling on the structure check, the same principle holds: **the thresholds are negotiable, the verdict is not.**
- A quote must match the source text, not paraphrase it. Verbatim or it is not a quote.

*The Payload boundary — opens here*
- Write **drafts** via the REST API with an authoring token. Never publish. Never touch Payload's tables — WP16 already built the database guard that refuses this; keep it.
- **A maximal-fixture round-trip test is mandatory, against real Payload rather than a stand-in.** Author a Leaf with *every* optional field populated, read it back, assert every field survives. WP15 shipped a mapper that silently dropped all three new fields with 932 tests green, because a dropped optional field is indistinguishable from an absent one. Your source references are optional fields. This is the reason this test exists.
- Record the Track's `acquisition` status on write.

*Why the CMS write lives here rather than in WP19:* the package that produces a field should be the package that proves the field survives the boundary. Splitting them is how WP15's defect happened. It also makes gate 2 in WP19 a review of drafts already in Payload — which is where §3.5 always wanted the human to work — rather than a custom view built from nothing.

**Out of scope:** images and diagrams (WP18), editorial review and the revision loop (WP19), publishing, gate 2's UI, anything that is not a public-domain book.

**Read-it-yourself gate:** *Play a generated Leaf as a reader would.* Does the scenario present a real dilemma, or a right answer with two obviously wrong ones beside it? Does the payoff feel earned? Does the DTK fact sound like something a person would actually repeat? Report honestly — a Leaf that passes every assertion and reads like nonsense is a failed package, and no test here will tell you.

**Acceptance criteria**
- [ ] `apps/pipeline` lint, `mypy --strict`, `pytest` pass; root `npm test`/`build` unaffected
- [ ] Every Leaf in an approved plan generates five schema-valid slides
- [ ] **A claim with no supporting passage is rejected** — mutation-checked
- [ ] **DTK without a takeaway source reference is rejected** — mutation-checked
- [ ] A quote that paraphrases rather than matches the source is rejected
- [ ] Drafts appear in Payload and are readable in the admin UI
- [ ] **The maximal-fixture round-trip passes against real Payload** — every optional field survives
- [ ] Nothing the pipeline writes is ever in a published state
- [ ] Token spend logged per node and per Leaf; **the cost of one full Track reported**
- [ ] A generated Leaf has been read, as a reader, and judged

**Testing expectations:** Tier A on grounding rejection, DTK sourcing, quote fidelity, and never-publishes. Tier B one happy path per node. Contract-test the CMS boundary against real Payload, not the stand-in — the stand-in inherits the same blind spot as the code under test. List what you deferred.

---

### Handoff: 2026-08-26 — WP16.1: The breakdown prompt, and the model question answered properly

*Pipeline Manager. Small, free, and it comes before WP17.*

### Task: WP16.1 — Fix the breakdown prompt; measure the model choice with enough runs to mean something

**Context:** WP16's own finding is that the prompt, not the model, is the bottleneck — three runs scored 24%, 78% and 89% on the structure check. That is the most useful thing the package produced and it deserves its own package rather than being absorbed into WP17's first hour.

**It also means the model comparison cannot yet support its conclusion.** The two `gemini-3.6-flash` runs differ by 54 points on the single-chapter ratio; the gap between Flash and Pro is 11. **The spread within one model is five times the gap between models**, and every cell is n=1. "Capability isn't the lever" may well be true — Pro reusing 10 of 18 chapter titles verbatim is a striking observation — but this data cannot distinguish it from noise. Settle it.

**Objective:** A breakdown prompt that passes the structure check reliably rather than occasionally, and a model recommendation backed by enough runs to separate signal from variance.

**Scope:** `apps/pipeline/src/zoomout_pipeline/prompts/`, the attempt cap, and a measurement harness. No new nodes.

**Requirements**
- **Move the original-structure requirement from a bullet into the framing of the task.** A constraint buried in a list reads as one consideration among many; this one is the task. Add a worked example — a good plan and a mirroring plan for a *different* book, so nothing leaks into the run you are measuring.
- **Raise `MAX_BREAKDOWN_ATTEMPTS` from 3 to 5.** R7 chose its cap on cost grounds that assumed a Pro-tier call; on Flash against credit a round is effectively free, and losing a plan to a cap guarding money we no longer spend is pure waste. The loop stays bounded, which was the actual requirement.
- **Measure ≥3 runs per config**, same book, same prompt: Flash on Vertex, Pro on Vertex. AI Studio drops out — we are on Vertex now. Report **mean and spread** for all three ratios, not a single number per cell.
- Report per-run cost.

**Constraints — one that matters more than the rest**
- **Do not tune the thresholds to make runs pass.** The prompt is the variable under test; the check is the instrument. Moving both at once measures nothing, and adjusting the instrument until the result is acceptable is marking your own homework on the one check `LEGAL.md` rests on. If your honest conclusion is that a threshold is wrong, **bring the numbers to Architect** — tuning it is a legitimate design change with a record, and it is mine to rule on.

**Acceptance criteria**
- [ ] The structure requirement is in the task framing, with a worked example from a different book
- [ ] `MAX_BREAKDOWN_ATTEMPTS` is 5; the cap still terminates, still escalates, still tested
- [ ] **≥3 runs per config recorded, with mean and spread** — a single number per cell does not close this
- [ ] A model recommendation stated **with its variance attached**, or an explicit "still indistinguishable" if that is what the data says
- [ ] `MAX_SINGLE_CHAPTER_LEAF_RATIO`, `MAX_SEQUENTIAL_PAIR_RATIO` and `CHAPTER_COUNT_PARITY_BAND` are **unchanged**
- [ ] Existing tests pass

**Testing expectations:** the cap and escalation tests from WP16 still pass. The measurement runs are live-model and belong in the explicit suite outside the normal gate.

---

### Handoff: 2026-08-25 — WP16: Pipeline skeleton — ingest, analyze, breakdown, gate 1

*Goes to the **Pipeline Manager** session, not Manager. First package of `apps/pipeline`.*

### Task: WP16 — Pipeline skeleton: ingest → analyze → breakdown → human gate 1

**Context:** This is the first package of the content pipeline — the Python service that turns a book into a Track of Leaves. Phase 1 is complete and the app renders everything a Leaf can hold (WP15 landed the v2 fields), but **the product has nothing to teach**: 28 placeholder books. This package does not generate a single slide. It builds the spine — the graph, its durable state, and the one review that determines everything downstream.

Your specification is `project/proposals/content-pipeline.md`. Read it in full, plus `project/LEGAL.md`. The seven recommendations there are ruled, not proposed.

**Objective:** A LangGraph run takes a public-domain EPUB, understands it whole, proposes an ordered list of 15–30 Leaves, and stops at a human gate. The founder approves or edits the plan; the run resumes from durable state, possibly days later, in a different process. **Done means: an approved Leaf plan for one real book, and a run that survives being killed.**

**Scope:** `apps/pipeline/` — new, and nothing else. Python 3.12+.

---

**Requirements**

*The package*
- `apps/pipeline` is a **standalone Python project** — `pyproject.toml`, its own virtualenv, its own test/lint/type gate. **Do not add it to the npm workspaces array.** It is not a Node package and root `npm run build` must not try to build it. Say in its README how to run its gate, because the root gate does not cover it.
- `ruff` for lint and format, `mypy --strict`, `pytest`. Fully type-annotated.
- **Prompts live in version-controlled files**, not inline strings. They are the logic of this service and they need diffs.
- **Which model each node uses comes from config**, not from a literal at the call site. Nodes will move between models as we tune, and §4a already forces a split (grounding can stay free-tier, editorial cannot).

*Its database — read this twice*
- pgvector lives in the **pipeline's own Postgres database**. Not Payload's (`zoomout_cms`), not the backend's. Create it, and put its URL in its own environment variable with a name that cannot be confused with the other two.
- **WP5b lost real time to exactly this**: `apps/backend/.env` pointed at Payload's database, migrations ran against the wrong one, and the CMS broke. Before you run any migration, connect and confirm which database you are in by listing its tables. Verify the effect, not the exit code.
- The LangGraph checkpointer tables live here too.

*`ingest`*
- **EPUB primary, PDF fallback** (ruled 2026-08-13). EPUB is structured HTML with chapters and paragraphs marked up; PDF is a layout format whose reading order has to be reconstructed. Build the EPUB path properly and the PDF path as a fallback that is honest about its limits.
- Chunk and embed into pgvector. Preserve **chapter and position metadata on every chunk** — grounding in WP17 needs to cite a location, and a chunk that has lost where it came from is useless then and unrecoverable now.
- **Record provenance**: title, author, edition/source, file hash, ingested-at, and an explicit **`acquisition` status** — `public-domain` · `licensed` · `purchased` · `undocumented`. Never ingest without one. This is retroactively impossible to reconstruct, which is the whole reason it is built now rather than when it matters.

*Retention — note the deliberate wrinkle*
- The rule is: **retain embeddings and cited passages, delete the raw full text when a Track completes.** A WP16 run stops at gate 1, and WP17 still needs the text — so the natural end-of-run has not arrived yet.
- **Build the mechanism anyway and test it now**: an explicit `purge_raw_text(run_id)` that deletes the raw text and leaves embeddings and provenance intact, invocable on demand, wired to the terminal node WP20 will eventually reach. Deferring the mechanism is how it never gets built.

*`analyze`*
- Whole-book understanding — themes, arguments, structure. **Long context, not RAG.** Thematic structure is a whole-book judgement and retrieval fragments it. Retrieval is for grounding in WP17.

*`breakdown`*
- Propose 15–30 Leaves: title, order, and the concept each one teaches. **No branches** — ruled twice. It may group thematically while reasoning; that grouping does not appear in the output, the schema, or the product.
- **Leaves must not mirror the book's chapter structure 1:1, and this must be a check that fires — not a line in a prompt.** It is load-bearing for the fair-use position in `LEGAL.md`. Define the check explicitly: some combination of how many Leaves draw from a single chapter, whether Leaf order is monotonic in chapter order, and how close the Leaf count sits to the chapter count. **Pick the thresholds yourself, make them named constants with a comment explaining the reasoning, and state in your report what you chose.** I am deliberately not specifying numbers you will have better information about than I do.
- On failure: back to `breakdown` with the finding as feedback, **capped**, then escalate to the human. Never loop unbounded.

*Gate 1 — a ruling that changes the proposal*
- §5 of the proposal says "gate 1 in Payload". **Overruled for WP16.** Two reasons: a Payload custom admin view is `apps/admin`, which you do not own, and building CMS review UI before the pipeline has produced anything worth reviewing is backwards.
- **Gate 1 is file-based.** The pipeline writes the Leaf plan to a human-readable, human-editable file, interrupts via LangGraph's `interrupt`, and resumes from that file when the founder approves. Edits made in the file are the approved plan — the human is editing, not just accepting.
- The Payload review surface arrives with gate 2 in WP19, built once for both.

*Durability*
- LangGraph `interrupt` + `langgraph-checkpoint-postgres`. Runs span days because the gate is human.
- **Every node idempotent and resumable.** Re-entering a node must not re-embed the book or re-spend money.

*Cost*
- Log token spend per node, per run, structured, from the first commit. Report the cost of one full ingest+analyze+breakdown in your completion report.

---

**Out of scope — all of it deliberately**

- Any Payload contact whatsoever. No REST client, no token, no writes. WP17 opens that boundary.
- `draft_leaf`, `extra_content`, `ground_check`, `editorial_review`, `revise` — WP17 and WP19.
- Assets, images, diagram rendering — WP18.
- Deployment, CI, Docker.
- Any book that is not public domain.

---

**Constraints**

- **Public-domain books only in this package, and this is not a preference.** §4a verified that Gemini's free tier *uses submitted content to improve Google's products* while the paid tier does not. Putting a real copyrighted book through the free tier feeds it into a corpus that may be used for training — a worse version of the ingestion problem R6 already names, and one no disclaimer undoes. Free tier for public-domain books; paid tier the moment a real book goes through.
- **Suggested first book: *The Science of Getting Rich*, Wallace Wattles (1910).** Public domain, unambiguously; genuinely the self-help genre we are building for; 17 real chapters, so the 1:1 check has something to bite on; short enough that a full run is cheap. Gutenberg serves EPUB, which exercises the primary path. Pick a different one if you have a better reason — say which and why.
- Secrets from the environment only. **You cannot read `.env` files — a deny rule blocks it, deliberately.** Do not work around it. Tell the founder which variables to set and let them do it.
- `packages/shared/src/content.ts` is frozen. WP16 does not touch it, but read it — it is the shape everything downstream must fit.

---

**Read-it-yourself gate:** *Read the Leaf plan the pipeline produced, as a person, and say whether it is any good.* Does it read like a **course** — concepts building on each other, each Leaf teaching one thing — or like a **table of contents with the chapter numbers filed off**? No assertion in this repo can tell the difference, and if the answer is the second one, the package is not done regardless of what the tests say. Say so plainly if it is bad; an optimistic report about output nobody read is worse than no report.

**Acceptance criteria**
- [ ] `apps/pipeline`'s own lint, `mypy --strict` and `pytest` pass; the **root** `npm run build` and `npm test` are unaffected
- [ ] A full run against the chosen public-domain EPUB reaches gate 1 and produces a plan of 15–30 Leaves
- [ ] **The run resumes after the process is killed** — start it, reach gate 1, kill it, restart, approve, and watch it continue from checkpointed state. This is the checkpointer's entire purpose and the only criterion that proves it
- [ ] **Founder edits to the plan file are what the run resumes with** — change a title in the file, confirm the changed title is in the resumed state
- [ ] **The 1:1 check fires** — a deliberately chapter-mirroring plan is rejected, and mutation-check it: break the check and confirm that test, and only that test, goes red
- [ ] The revision cap terminates — a `breakdown` that never satisfies the check escalates rather than looping
- [ ] Provenance is recorded with an `acquisition` status, and ingest **refuses to run without one**
- [ ] `purge_raw_text` deletes raw text while embeddings and provenance survive — **verified by querying the database**, not by observing the call
- [ ] pgvector and the checkpointer are in the pipeline's own database — verified by connecting and listing tables in all three
- [ ] Token spend is logged per node
- [ ] **No Payload credential, client, or import exists anywhere in `apps/pipeline`**
- [ ] The Leaf plan has been read by a human being and judged

**Testing expectations:** Tier A on the pipeline list in your persona — the 1:1 check firing, raw-text deletion, the revision cap terminating, and refusing to ingest without provenance. Tier B one happy path for ingest, analyze and breakdown wiring. Test LLM nodes on their **contract** — output parses, required fields present — never on their prose. Use recorded fixtures for the normal gate; keep live-model runs to a small explicit suite outside it. List what you deferred.

---

### Handoff: 2026-08-13 — WP15: Leaf v2 — assets and apply-in-life

### Task: WP15 — Leaf v2: assets and apply-in-life

**Context:** Phase 2's content pipeline will generate two things a Leaf cannot currently hold — an illustration for the scenario slide, a diagram for the sticky-notes slide — plus an "apply in life" prompt on the takeaway. **The pipeline cannot start until the app can store and render them**, so this package comes first. Full context: `project/proposals/content-pipeline.md`, R1.

**This is a deliberate, ruled change to a frozen schema.** `packages/shared/src/content.ts` was frozen 2026-08-08, and its header says a change needs an Architect ruling plus a migration plan. This is that ruling. Re-freeze it when you are done, with the date updated and this package named.

**Objective:** A Leaf can carry a scenario image, a sticky-notes diagram and an apply-in-life prompt; all three render in the player; all three are authorable in the CMS; and the 28 existing Tracks remain valid without a backfill.

**Scope:** `packages/shared/src/content.ts`, `apps/admin/` collections and validation, `apps/mobile/` player slides, `apps/backend/` only if the mapper needs it.

**Note for WP16 (pipeline), recorded here so it is not lost:** input is **EPUB primary, PDF fallback**, and every Track records an `acquisition` status — `public-domain` / `licensed` / `purchased` / `undocumented`. Build the pipeline against public-domain titles.

**Requirements:**

*Schema — all three fields optional*
- `scenario.image?` — an image asset: `url`, `alt`, and optional `width`/`height`.
- `stickyNotes.diagram?` — a diagram asset: `url`, `alt`, plus an optional **`spec`** and `specFormat`. The spec is the source the diagram was rendered from (Mermaid or a constrained JSON) and exists so a writer can correct a diagram by editing text rather than regenerating an image (R4).
- `takeaway.applyInLife?` — a string.
- **Optional is the point.** The 28 seeded Tracks stay valid, and there is no backfill. Do not make any of them required.
- **`alt` is required whenever an asset is present.** These are the first images in the product and the app honours OS accessibility settings.
- Follow `audioRefSchema`'s existing shape for consistency — it is the precedent for a reserved asset reference.

*CMS*
- Author both assets and the apply-in-life text. Images go through **Payload's upload collection** — set that up here, because the pipeline will write into it later.
- Publish-time rules unchanged except: **an asset present without `alt` cannot be published.**

*Player*
- Scenario slide renders the image when present; sticky-notes slide renders the diagram when present. **Both slides must look right with the field absent** — that is the current state of every existing Leaf.
- Loading and failure states. A broken image URL must not break the slide; WP11 found a cover pointing at a web page rather than an image, so assume this will happen.
- Apply-in-life renders on the takeaway slide. Decide and state whether it is always visible or opens like Dinner Table Knowledge — the founder has not ruled, and either is defensible.

**Out of scope:** the pipeline itself, generating any asset, the diagram renderer, deployment, Android.

**Constraints:**
- `delivery.ts` is a cross-workspace contract — additive proceeds with a note; changing or removing needs a ruling.
- Do not check extra-large text sizes. Known, ruled, logged.
- **"Verified locally" means `dist` and `.next` deleted.**

**Acceptance criteria:**
- [ ] Root `install`, `lint`, `typecheck`, `test`, `build` pass
- [ ] **All 28 existing Tracks and 22 Leaves still validate and still serve** — the change is additive, verified by query rather than by reasoning
- [ ] A Leaf with all three new fields authors, publishes and renders
- [ ] **A Leaf with none of them renders exactly as before** on both affected slides
- [ ] Publishing an asset without `alt` is rejected
- [ ] A broken image URL degrades gracefully rather than breaking the slide
- [ ] Migration applies cleanly to an empty database
- [ ] `content.ts` is re-frozen with the date updated and WP15 named
- [ ] **Verified on a device** in both themes
- [ ] CI green

**Testing expectations — tiered bar:** **Tier A** — existing content still validates and serves, and an asset without `alt` cannot be published. **Tier B, one happy path.** Tier C deferred and named. Full cold gate once, at the end; report roughly where your time went.

### Handoff: 2026-08-13 — WP10: Report an error, the fix queue, and the legal surfaces

### Task: WP10 — Report an error, the fix queue, and the legal surfaces

**Context:** The last package before the app is complete end to end. It is a **legal requirement, not a feature**: `LEGAL.md` and `PRODUCT.md` both require a user-facing "report an error" action on every Leaf, routed to a fix queue with a defined SLA. That obligation is part of what makes the fair-use position defensible, alongside the takedown path that already works.

Deliberately small. Do not expand it.

**Objective:** A reader can report an error on any Leaf; reports land somewhere the founder can actually see them; and the legal surfaces that are currently only *enforced at the API* are confirmed to be *visible in the app*.

**Scope:** `apps/backend/` (report endpoint, operator read), `apps/mobile/src/screens/` (the report action and its sheet), and whatever the §3 verification turns up.

---

**1. Report an error**

- An action on **every Leaf**, reachable from the player. Not buried.
- A short form: a reason from a small enum (factual error, wrong answer marked correct, offensive content, other) plus optional free text.
- Persist to the backend. `ErrorReport` already exists in `packages/shared` from WP0 — **read it before designing the table; it may need adjusting rather than replacing.**
- Capture enough to act on: reader id, Leaf id, its Track, the reason, the text, and when.
- Rate-limit it. It is an unauthenticated-shaped write path in spirit — a reader can submit repeatedly.
- Confirm to the reader that it was received. This is a trust surface; silence reads as being ignored.

**2. The fix queue**

- Reports must be **readable by the founder**, or the queue is a table nobody looks at and the legal commitment is not met.
- **Keep this minimal.** An authenticated operator read endpoint gated by a token from validated config is enough for Phase 1 — not a UI, not a dashboard, not Payload integration (which would cross a database boundary for no gain).
- Include a status field (`open` / `resolved`) so the queue can be worked. Nothing needs to set it automatically.
- **The SLA is a documented process, not software.** Write it into `project/LEGAL.md` under the content-integrity section: who reviews, how often, and what "within hours" means operationally for a takedown versus a factual correction. That documentation is part of this package's deliverable.

**3. Verify the legal surfaces are actually displayed — this is the part most likely to have fallen through**

WP3 made a Track **unservable** without a non-endorsement disclaimer and at least one purchase-forward link. Nothing has ever checked that the app **shows** them. Servable is not the same as visible, and the legal requirement is the second one.

- Confirm the **non-endorsement disclaimer** is visible on the Track detail screen.
- Confirm the **purchase-forward link** is visible and tappable, and opens the retailer.
- `PRODUCT.md` requires the purchase link on **Track completion** specifically — check whether completing a Track surfaces it, and if not, add it.
- If any of these are missing, adding them is in scope.

---

**Out of scope:** deployment, password reset, test hardening, the AI pipeline, Android verification, extra-large text — all parked in `launch-blockers.md`. A moderation or admin UI. Email notification of reports (needs the transactional provider WP13 introduces).

**Constraints:**
- `content.ts` is frozen. `delivery.ts` is a cross-workspace contract — additive proceeds with a note; changing or removing needs a ruling.
- **Do not check extra-large text sizes.** Known, ruled, logged.
- Composition services sit above domain services — if reports need content, follow `SessionSummaryService`'s shape rather than reaching sideways from a domain service.
- **"Verified locally" means `dist` and `.next` deleted.**

**Acceptance criteria:**
- [ ] Root `install`, `lint`, `typecheck`, `test`, `build` pass
- [ ] A report can be filed from **any Leaf** and is persisted with reader, Leaf, Track, reason, text and timestamp
- [ ] The reader gets confirmation that it was received
- [ ] The operator endpoint lists reports and is **refused without the token** — assert the refusal, not just the success
- [ ] Report submission is rate-limited
- [ ] **The non-endorsement disclaimer is visible on Track detail** — verified by looking at the screen, not by confirming the field is in the API response
- [ ] **The purchase-forward link is visible and opens the retailer**, and is present on Track completion
- [ ] The SLA process is written into `project/LEGAL.md`
- [ ] **Verified on a device:** file a report, see the confirmation, then read it back through the operator endpoint. Also walk the **achievement share screen** end to end — WP9 verified it by construction only, and by now the test account may have an unlocked badge to trigger it
- [ ] CI green

**Testing expectations — tiered bar:** **Tier A** — a report is persisted and the operator endpoint refuses an untokened request. **Tier B, one happy path only.** Tier C deferred and named.

Run the full cold gate **once**, at the end, and report roughly where your time went. **Note which of your tests assert the absence of a mechanism** and therefore cannot be mutation-checked.

### Handoff: 2026-08-12 — WP9: Session wrap-up and achievement screens

### Task: WP9 — Session wrap-up and achievement screens

**Context:** These two screens are a **growth mechanic, not decoration**. `PRODUCT.md` is explicit: they exist to be screenshotted and shared, and that is the loop by which ZoomOut is meant to spread. They are the only screens in the product whose job is to be seen by someone who is not a user.

WP5b landed the cap screen, achievements and `POST /events` (which already accepts `session_wrap`, so `first-wrap` becomes reachable the moment this package calls it). WP8 landed the Leaf player.

**Objective:** A reader can end their day deliberately, see an attractive summary of what they learnt, and share it — and an achievement unlock is a moment worth capturing rather than a toast.

**Scope:**
- `apps/backend/` — a session summary endpoint (see below; this backend work is in scope)
- `apps/mobile/src/screens/` — the wrap-up screen, the achievement unlock screen
- `apps/mobile/src/` — screen capture and the OS share sheet

---

**Backend — the gap this package must close**

`SessionStatus` carries `xpEarned`, `secondsActive`, `capReached` and the thresholds. **It carries nothing about *which* Leaves were completed today**, so "here is what you learnt" cannot be built from what exists. Verify that before building — do not trust this handoff over the code.

Add a **session summary** for the reader's current local day: Leaves completed today with their titles and their Track, XP earned, current streak, and achievements unlocked today. One call — the wrap-up screen should not assemble itself from four requests.

Reuse `localDateIn()`. This is a local-day query and must not be reinterpreted from a UTC instant.

**Two product decisions, made here rather than by implication** (the WP8 lesson):

1. **Wrapping up is a ceremony, not a lock.** It shows the summary, records the `session_wrap` event, and returns the reader to Journey. **It does not prevent further learning.** The daily cap is the hard stop; "wrap up" is the ritual ending. Locking someone out because they tapped a celebratory button would be punitive and surprising, and a reader who wraps up and then wants one more Leaf should get one. Wrapping twice in a day is fine — the summary reflects the day so far.
2. **The cap screen leads into the wrap-up screen.** When the cap fires, offer the same summary rather than showing a second, differently-styled ending. Two different endings to one day is worse than one good one. WP5b's cap screen already unlocks `daily-cap` above the notice; keep that ordering — being congratulated for stopping in the same breath as being told you are finished is what makes it read as an ending rather than a refusal.

**Entry points:** offered after completing a Leaf, and available from Journey.

---

**The screens**

- **Both break the app's dark theme deliberately** — `design-direction.md` §8. A dark screenshot in a bright social feed reads as moody rather than triumphant. Use the light or high-contrast variant, and **design them against a mockup of a feed, not against the app.**
- **Legible as a small thumbnail.** If the streak number and the book are not readable at thumbnail size, the screen has failed at its only job.
- Carry the streak or XP, the book, and the ZoomOut wordmark.
- **Compose both around the reserved mascot slot** (§9), filled for now by an illustrative motion element or oversized type. Adding a mascot later should be an asset swap.
- Achievement icons come through WP7's `Icon` map — `iconUrl` was deliberately removed from `packages/shared` in WP5b and stays gone.
- Amber owns celebration, not primary teal.

**Sharing**

- Capture the screen to an image and hand it to the OS share sheet.
- **The captured image must not depend on the device's theme** — it is the light variant regardless of what the reader is using.
- Handle the reader cancelling the share sheet without leaving the screen in a broken state.

**Out of scope:** report-an-error (WP10); deep links back into the app from a shared image (worth doing, needs a URL scheme and probably a web target — not now); real SFX files; the AI pipeline.

**Constraints:**
- `content.ts` is frozen. `delivery.ts` is a cross-workspace contract — **additive changes proceed with a note; changing or removing a field needs a ruling.**
- **Do not check extra-large text sizes.** Known app-wide clipping, ruled 2026-08-12 as out of scope and logged in `launch-blockers.md`. Do not re-raise it.
- `process.env` only in the config module. Handler → service → repository.
- **"Verified locally" means `dist` and `.next` deleted.**

**Acceptance criteria:**
- [ ] Root `install`, `lint`, `typecheck`, `test`, `build` pass
- [ ] The summary endpoint returns today's completed Leaves, XP, streak and achievements **in one call**, keyed on the reader's local date
- [ ] **A reader in a non-UTC timezone gets their own day**, not the server's — tested across a rollover
- [ ] Wrapping up records `session_wrap` and unlocks `first-wrap`
- [ ] **Wrapping up does not prevent completing another Leaf afterwards** — assert the next completion still awards XP
- [ ] Hitting the cap offers the same summary screen rather than a separate ending
- [ ] Both screens render in the light/high-contrast variant **regardless of the device theme**, and the captured image does too
- [ ] The share sheet opens with an image attached; cancelling leaves the screen usable
- [ ] **Verified on a device:** complete a Leaf, wrap up, share to yourself, and look at the result **as a thumbnail**. Report whether it reads at that size — that is the criterion, not that the flow completes
- [ ] CI green

**Testing expectations — tiered bar** (`agents/manager.md`): **Tier A** is the local-date query and that wrapping up does not lock a reader out. **Tier B, one happy path only.** Tier C deferred and listed by name.

**The manual check is the deliverable.** These screens exist to be looked at by strangers, so "the flow completes" proves nothing. Share one to yourself, look at it small, and say whether you would post it. Run the full cold gate **once**, at the end, and report roughly where your time went.

### Handoff: 2026-08-12 — WP5b: Environment fix, achievements, total XP

### Task: WP5b — Environment fix, achievements, total XP

**Context:** Last of the gamification packages. It opens with a small environment fix that has now blocked two packages, then builds the achievement system from `project/proposals/achievements.md`.

**Objective:** The backend runs from a fresh clone without shell setup; nineteen achievements unlock, persist and surface; a reader's total XP is available for the profile.

---

**Part A — the environment fix. Do this first; it unblocks your own device verification.**

- A **gitignored `apps/backend/.env`**, plus `--env-file` on the `dev` and `db:migrate` scripts so both read it. Approved 2026-08-12 — the password lives only in the untracked file, and the root `.env.example` already documents every variable.
- Confirm the backend's migrations land in the **backend's** database, not Payload's. WP5a's device check failed because one did not.
- A fresh clone should reach a running backend by copying `.env.example` and running migrate. Verify that, don't assume it.

**Part B — achievements**

- All **nineteen** from `project/proposals/achievements.md`, exactly as specified there.
- **A registry, not branches** — id, name, description, tier, predicate — evaluated by one engine. Adding a twentieth should be a row and a predicate.
- **Awarding is idempotent**: unique on `(user_id, achievement_id)`. Replay is the ordinary failure mode here, not an exotic one.
- **Unlocks return in the response of the action that triggered them**, so the client animates immediately rather than polling.
- Evaluation points: Leaf completion, answer submission, library add, session wrap-up, cap reached, and Dinner Table Knowledge open.
- **One new piece of instrumentation:** a DTK open must be recorded — nothing tracks it today. A small authenticated event endpoint. It is also the only signal we would ever have that the deep-cut content is read at all.
- Four achievements are **unreachable at launch** with one 20-Leaf Track. Ship them anyway; a visible locked tile is a reason to return. See §3 of the proposal.

**Part C — total XP**

- Expose a reader's total XP, **derived on read** (`SUM(xp_awarded)` over `leaf_progress`, indexed on `user_id`) — ruled 2026-08-09. Do not add `users.total_xp`; a denormalised counter drifts from its source and the idempotent-completion path is exactly where a double increment would land.

**Mobile:** achievements on Profile, unlock animation on award, total XP displayed. Reward amber owns celebration, not primary teal.

**Out of scope:** share and wrap-up screens (WP9), report-an-error (WP10), push notifications, a real activity signal for session time.

**Constraints:** `content.ts` frozen. `delivery.ts` is a cross-workspace contract — **additive changes proceed with a note; changing or removing a field needs a ruling.** Handler → service → repository.

**Acceptance criteria:**
- [ ] Root `install`, `lint`, `typecheck`, `test`, `build` pass
- [ ] **A fresh clone reaches a running backend via `.env.example` alone**, and migrations land in the backend's database
- [ ] All nineteen achievements exist and match the proposal
- [ ] **Awarding twice awards once** — replay and concurrency
- [ ] An unlock arrives in the triggering action's response, not on a later poll
- [ ] A DTK open is recorded and unlocks `dinner-party`
- [ ] Total XP matches `SUM(xp_awarded)` and no `users.total_xp` column exists
- [ ] **Device check, one session, closing four deferred items:** WP5a's cap screen ("That is today done" — does it read as an ending or a refusal?), an achievement unlock, **iOS Reduce Motion on the WP8 unlock animation** (WP8's open 11th criterion), and both themes at XXXL
- [ ] CI green

**Testing expectations — tiered bar:** **Tier A** is award idempotency, replay and concurrent. **Tier B, one happy path only.** Tier C deferred and listed. Run the full cold gate **once**, at the end, and report roughly where your time went.

### Handoff: 2026-08-12 — WP5a: Session cap and streaks

### Task: WP5a — Session cap and streaks

**Context:** The loop works. This adds the two mechanics that shape how a reader uses it over days rather than minutes: the positive-friction session cap, and the daily streak.

**Deliberately scoped small.** Achievements are WP5b and are not in this package. Package size is being reduced to shorten the feedback loop — do not pull WP5b work forward.

**Objective:** A session ends gracefully at 15 minutes or 500 XP, whichever comes first, and a reader who completes at least one Leaf on a given local day keeps their streak.

**Scope:** `apps/backend/src/progress/` or a sibling module, a migration for `daily_session` and `streak`, and the mobile surfaces that display them.

**Requirements:**

*Session cap*
- **15 minutes or 500 XP, whichever comes first**, evaluated **server-side**. The client never decides.
- Resets at the reader's **local midnight**, using `localDateIn()` — the reader's timezone, not UTC and not the server's.
- **An in-progress Leaf finishes rather than being cut off** mid-Leaf.
- When the cap is hit, the API says so clearly enough that the client can show a graceful "today's limit reached" screen — **not an error state**. This is a wellbeing feature; the app must not treat it as a failure.
- XP earned past the cap is not awarded. `calculateLeafXp` returns the *earned* amount and knows nothing about capping — keep that separation.

*Streaks*
- Maintained by completing **≥1 Leaf in a local day**. No freezes or repairs in Phase 1.
- Track current and longest, and the last active local date.
- A day with no completion breaks it. Evaluate against the reader's local date, never a UTC instant.

*Mobile*
- Show the streak on Profile, and the "today's limit reached" screen when the cap fires.
- Both themes, and check XXXL on any new screen.

**Out of scope:**
- **Achievements — WP5b.** Not even the registry.
- Share and wrap-up screens — WP9
- Push notifications — unscoped, and streaks will eventually want them
- Total XP endpoint — carried, and it belongs with WP5b's gamification surface

**Constraints:**
- `packages/shared/src/content.ts` is frozen. `delivery.ts` is a **cross-workspace contract** — changing it breaks two apps, so treat it with the same care.
- Handler → service → repository. `process.env` only in the config module.
- Cap thresholds and the streak rule come from validated config, not literals.

**Acceptance criteria:**
- [ ] Root `install`, `lint`, `typecheck`, `test`, `build` pass
- [ ] Migrations apply cleanly to an empty database
- [ ] **The cap fires at 15 minutes and at 500 XP independently** — test each as the binding constraint, not just one
- [ ] **A Leaf in progress when the cap fires can still be completed**
- [ ] **The cap and the streak both reset at the reader's local midnight, not UTC** — tested with a reader in a non-UTC timezone across a rollover, and across a DST shift
- [ ] **`daily_session` and `streak` are upsert-shaped: test the first write of a day AND the second.** Name the path in the test, not just the outcome — a criterion like "the streak increments" passes against the INSERT branch while `ON CONFLICT` ships unproven. **This exact split hid the WP4 first-try bonus bug.** Mutation-check both: break each branch and confirm only its own test goes red
- [ ] A day with no completion breaks the streak; the day of a completion does not
- [ ] Hitting the cap renders a graceful screen on device, not an error
- [ ] CI green

**Testing expectations — tiered bar** (`agents/manager.md`, tightened 2026-08-12):
- **Tier A:** everything local-date, both upsert branches, and cap enforcement. Non-negotiable — corrupted streaks cannot be reconstructed after the fact.
- **Tier B: one happy path only.** No failure paths; they go to WP14.
- **Tier C:** defer and list.
- **Manual:** hit the cap on a device and look at the screen. It should feel like a good place to stop, not like being locked out.

Run the full cold gate **once**, at the end. Report roughly where your time went.

### Handoff: 2026-08-12 — WP8: The Leaf player

### Task: WP8 — The Leaf player: five slides, the unlock gate, sound

**Context:** This is the product. Everything built so far — auth, content delivery, grading, XP, the shell, the surfaces, the seed — exists to make this one screen possible. **After WP8 the founder can judge whether the thesis holds**, which is the highest-value information available and has been unavailable for eleven packages.

The mechanic: a reader reads a summary, answers a three-option scenario, and the payoff unlocks **only** on a correct answer. That gate is the product's entire differentiator. Everything in this handoff serves it.

**Objective:** A reader opens a Leaf from Journey or Library, moves through all five slides, answers the scenario, unlocks the payoff, completes the Leaf, and sees XP awarded — server-decided throughout, on a real device, in both themes.

**Scope:** (verify, don't trust blindly)
- `apps/mobile/src/screens/` — the Leaf player and its slide components
- `apps/mobile/src/api/` — progress client methods
- `apps/mobile/src/design/` — motion for the unlock; a sound layer
- Explore pagination (see below)

**Requirements:**

*The five slides, in fixed order*
1. **Summary** — short text.
2. **Scenario** — the prompt and exactly three options. The client submits an **option id** and is told the result. It never receives, infers or submits `isCorrect`.
3. **Payoff** — **locked until a correct answer.** The server already enforces this; the client must not render a locked payoff even briefly, and must not hold it in memory before it is earned.
4. **Sticky notes** — 2–6, on a board.
5. **Takeaway** — plus an optional Dinner Table Knowledge fact, opened deliberately by the reader.

*The unlock — the signature moment*
- **This is the most crafted animation in the app** (`design-direction.md` §6). It is where the active-recall thesis stops being a claim and becomes something a reader feels. Spend disproportionate time here.
- Spring-based. Reward-coloured, not primary — amber owns celebration.
- **Reduced motion gets its first real exercise here.** `useReducedMotion` and `motionPlan` exist and have never driven a real animation. Swap to a fade; never remove the feedback.

*Answering*
- **Wrong answers retry without limit.** The payoff stays locked; the stakes are XP, not access. A wrong answer must not feel like a rebuke — it is the mechanic working.
- Correct-on-first-try earns more XP. Show what was earned.
- **Never signal right or wrong by colour alone** — icon and motion too. `correct` green and `primary` teal are adjacent in hue.
- An option id rejected as unknown is a client error, not a wrong answer; do not conflate them.

*Completion*
- Completing is idempotent server-side. The client must not double-submit on a retry or a fast double-tap.
- After completion, return the reader to the Track roadmap with progress updated.

*Sound*
- **Build the sound layer with a swappable asset map and ship no assets** (ruled 2026-08-12). Trigger points: correct, incorrect, Leaf completion. Respect the hardware silent switch and provide a setting.
- **Incorrect must not be punishing** — unlimited retries mean a harsh tone turns a normal intermediate state into a scolding.
- Retrofitting trigger points across a finished player is far worse than stubbing them now, which is why the layer is in scope while the files are not.

*Explore pagination — folded in deliberately*
- Explore shows twenty of twenty-eight Tracks and stops with no affordance. Add one — infinite scroll or an explicit control, your call.
- Small, and it belongs here: WP8 is the package where the app gets judged on a device.

**Out of scope:**
- Session cap, streaks, achievements — WP5
- Share and wrap-up screens — WP9
- Report-an-error — WP10
- Voiceover — Phase 2; the schema reserves the field
- Real SFX files

**Constraints:**
- **`ContentService.getLeaf` returns `DeliveredLeaf`; the payoff arrives only when earned.** Do not widen it, and do not add a client-side path around it.
- **Never parse untrusted input with `publicLeafSchema`** — it predates the Dinner Table Knowledge refinement.
- A withdrawn Track withdraws its Leaves via `resolveVisibleLeaf`. **The player must handle a Leaf disappearing mid-session** — a takedown can land while a reader is on slide 3. Fail to a readable message, not a crash.
- Follow `CLAUDE.md` in full. **"Verified locally" means `dist` and `.next` deleted.**

**Acceptance criteria:**
- [ ] Root `npm install`, `lint`, `typecheck`, `test`, `build` all pass
- [ ] A reader opens a Leaf from Journey and from Library, and completes all five slides
- [ ] **The payoff body is absent from every response and from client memory until a correct answer** — asserted on the payload, not on what renders
- [ ] `isCorrect` appears in no response body, asserted at the route level
- [ ] Twelve wrong answers in a row never lock a reader out; the thirteenth, correct, unlocks
- [ ] First-try correct awards more than a later correct answer, and the reader is shown what they earned
- [ ] Completing twice — replay and fast double-tap — awards XP once
- [ ] A Leaf withdrawn mid-session fails to a readable message, not a crash
- [ ] **Reduced motion swaps the unlock animation for a fade**, verified with the OS setting on
- [ ] Explore pages past twenty Tracks
- [ ] **Verified on a device, from a cold start, in both themes and at `accessibilityExtraExtraExtraLarge`** — all five slides, plus the partial-rollup render deferred from WP11
- [ ] CI green

**Testing expectations — tiered bar** (`agents/manager.md`):
- **Tier A:** the payoff gate, `isCorrect` containment, completion idempotency including double-tap, and withdrawn-content handling. All four are the product's or the project's load-bearing guarantees.
- **Tier B:** slide navigation, the answer round trip, XP display, pagination.
- **Tier C, defer to WP14:** slide-component render permutations and theme matrices. **List what you defer.**
- **Manual verification is the deliverable here, not a check on it.** WP11 proved the point: 792 passing tests against a fixture whose flagship Track was invisible on device. Play the Leaf. Get answers wrong on purpose. **Report how the unlock feels** — that is a product finding and worth more than any assertion in this package.

### Handoff: 2026-08-11 — WP11: Seed fixture, a full-length placeholder Track

### Task: WP11 — Seed fixture: a full-length placeholder Track

**Context:** Every surface built so far renders against one hand-authored Leaf. WP8 builds the Leaf player, and judging whether the product works needs a Track of realistic length — a Journey with one Leaf tells you nothing about pacing, progress or whether the roadmap reads as a journey at all.

This is generated content, not authored content. Real writing happens later, after the AI pipeline. **Everything here is placeholder and must be unmistakably so.**

**Objective:** A repeatable seed producing one Track of ~20 structurally complete Leaves in the CMS, flagged as placeholder, plus the fixtures the test suite has been missing. Explore, Library, Journey and the progress rollup all exercised against realistic volume.

**Scope:** (verify, don't trust blindly)
- A seed script — location and invocation your call, but it must be **idempotent and re-runnable**
- `apps/admin/` — a CMS-side rule for cover images (see below)
- Test fixtures, if the seed shares code with them

**Requirements:**

*The content itself*
- One Track, **~20 Leaves**, every Leaf structurally complete: all five slides, exactly three scenario options with exactly one correct, 2–6 sticky notes, and every source reference carrying a `note` plus at least one locator.
- **`isPlaceholder: true` on the Track and every Leaf.** Non-negotiable.
- **Prose must be unmistakably placeholder.** Never plausible-sounding invented advice, quotes or claims attributed to Brianna Wiest or any real author. This is the §3.4 hazard and the Bookey failure in miniature — the realistic bad outcome is not a public launch, it is a demo build shown to five people carrying fabricated advice under a real author's name.
- Enough variation across Leaves that the surfaces are meaningfully exercised — varying title lengths, sticky-note counts, and at least one Leaf with Dinner Table Knowledge and one without.

*Fixtures the test suite is missing* (both are WP14 items this package unblocks)
- **A draft Track and a draft Leaf.** The draft filter is definitive at config — `read: publishedOrAuthenticated`, and `PayloadClient` calls anonymously — but the corpus has never contained a draft, so nothing has ever proven a draft cannot leak. Seed one so WP14 can.
- **Enough Tracks to cross a pagination boundary.** `fakePayload` ignores `page` and `limit`, so `listTracks` totals are verified for a single page only. A few extra placeholder Tracks (they need not be full-length) make real paging exercisable.

*Cover images — the debt item assigned here*
- The existing Track's `coverUrl` points at an Amazon **product page**, not an image, so every Explore card silently renders the fallback. `trackSchema` requires a URL, not an image.
- **Add a CMS-side rule** so a `coverUrl` that is not an image cannot be published. Validate what you can cheaply and honestly — extension or content-type — and make the author-facing message say what is wrong.
- Seeded Tracks must carry cover URLs that actually render.

**Out of scope:**
- The Leaf player — WP8
- Real authored content — post-pipeline
- Any change to `packages/shared/src/content.ts`, which is frozen
- Deployment

**Constraints:**
- **If the seed uses Payload's Local API it inherits two upstream defects** found in WP1: `payload.destroy()` does not close its database pool (and `pool.end()` hangs, because Payload keeps a client checked out), and Payload attaches no `error` listener to its pool, so an idle-client error becomes an uncaught exception. Seeding over the REST API with an admin token avoids both — prefer it. If you must boot Payload, put the workaround in one place.
- **Placeholder content must never be publishable to production.** The guard exists in `ContentService`; do not add a second path around it.
- Follow `CLAUDE.md` in full. **"Verified locally" means `dist` and `.next` deleted.**

**Acceptance criteria:**
- [ ] Root `npm install`, `lint`, `typecheck`, `test`, `build` all pass
- [ ] The seed runs against an empty CMS and produces one Track with ~20 complete Leaves
- [ ] **The seed is idempotent** — running it twice does not duplicate content or fail
- [ ] Every seeded record has `isPlaceholder: true`
- [ ] Every seeded Leaf publishes cleanly through the CMS's own validation — no rule is bypassed to make the seed work
- [ ] A draft Track and a draft Leaf exist, and are **absent** from every backend content response
- [ ] Enough Tracks exist to cross a pagination boundary
- [ ] Publishing a Track whose `coverUrl` is not an image is rejected, with an actionable message
- [ ] Seeded cover images render in Explore rather than falling back
- [ ] **Verified on device:** Explore, Library and Journey against the seeded Track, including the progress rollup at partial completion, in both themes
- [ ] CI green

**Testing expectations — tiered bar** (`agents/manager.md`):
- **Tier A:** placeholder content is not servable in production; the draft records are absent from every content response. Both matter more here than usual, because this package is the first time the corpus contains content that *must not* escape.
- **Tier B:** seed idempotency, and the cover-image rule accepting a valid image and rejecting a page URL.
- **Tier C, defer:** exhaustive validation permutations on the cover rule.
- **Manual verification is the real test here.** Twenty Leaves is the first time Journey, the rollup and Explore see realistic volume — look at them, in both themes, and report what the surfaces actually look like. If the Journey screen reads badly at twenty Leaves, that is a WP8 input and worth more than any assertion.

### Handoff: 2026-08-11 — WP7: Mobile surfaces — Explore, Library, Journey

### Task: WP7 — Mobile surfaces: Explore, Library, Journey

**Context:** WP6 shipped the shell with three empty tabs. This fills them. After WP7 the app is navigable and real — the only thing missing before the founder can judge the product is the Leaf player (WP8).

WP3's content and library endpoints and WP4's progress endpoints are live and merged. WP6's design system, API client and `AuthContext` (including `refreshProfile()`) are the foundation — read `project/proposals/design-direction.md` before styling anything.

**Objective:** Explore lists published Tracks and adds them to a Library; Library shows added books with per-book progress; Journey shows active Tracks with a resume affordance. All three work in both themes, at extra-large text, and degrade gracefully when the CMS is unreachable.

**Scope:** (verify, don't trust blindly)
- `apps/mobile/src/screens/` — Explore, Library, Journey, and their components
- `apps/mobile/src/api/` — content and progress client methods
- `apps/backend/src/` — **a per-Track progress rollup; see below. This backend work is in scope.**
- `apps/mobile/src/components/` — icon set, cards, loading and error states

**Requirements:**

*Backend — the gap this package must close*
- **No endpoint returns per-Track progress.** `GET /library` returns membership only ("progress fields are WP4's"), and WP4 exposes progress per *Leaf*. Library and Journey both need "7 of 20 Leaves complete", and computing it client-side means fetching every Leaf and every progress row per Track.
- Add a **per-Track progress summary** to the library response or a dedicated endpoint: completed Leaf count, total Leaf count, and the next incomplete Leaf's id for the resume affordance.
- **This also closes `user_tracks.status`**, which has been `active` since WP3 because nothing owned the Leaf-count rollup needed to mark a Track complete. It does now.
- Apply the ruled fix for `listTracks` totals: **filter placeholder content in the Payload query with a `where` clause in production**, so pagination totals are accurate at source. **Keep `ContentService`'s `isProductionPublishable` guard as the authoritative control** — the query filter is an optimisation, never the control.

*Explore*
- List published Tracks with cover, title, author. Paginated.
- Add and remove from Library. Adding is idempotent — adding twice is not an error.
- Placeholder content is visible in development and invisible in production; that is `ContentService`'s existing behaviour and must not be re-implemented client-side.

*Library and Journey*
- Library: added books with per-book progress from the new rollup.
- Journey: active Tracks with resume — deep-link to the next incomplete Leaf. **The Leaf player does not exist until WP8**, so resume navigates to a placeholder destination; wire the route and the target Leaf id, not the screen.
- Empty states for both, composed around the reserved mascot slot (`design-direction.md` §9).

*Cross-cutting*
- **Pick an icon set** and replace WP6's text glyphs. WP6 used `↗` and `☺` with a U+FE0E variation selector because two glyphs took emoji presentation and ignored the tint colour — that fix is a workaround, not an icon strategy.
- Loading and error states on every screen. **A CMS-unreachable 503 must render as a readable message with a retry, never a blank screen or a raw error.**
- Pull-to-refresh where a list can go stale.

**Out of scope:**
- The Leaf player — WP8
- Streaks, XP display, session cap, achievements UI — WP5 owns the server side
- Share and achievement screens — WP9
- Report-an-error — WP10
- Social sign-in — deferred post-Phase-1

**Constraints:**
- `packages/shared/src/content.ts` is frozen. `progress.ts` may change only with a stated reason.
- **Never read Payload's Postgres tables**; `PayloadClient` is the only door.
- **Never parse untrusted input with `publicLeafSchema`** — it predates the Dinner Table Knowledge refinement.
- **React Native Testing Library v14 made `render`, `renderHook`, `fireEvent` and `unmount` async.** Un-awaited they fail as `undefined.current`, pointing nowhere near the cause. WP6 lost cycles to this.
- Follow `CLAUDE.md` in full. **"Verified locally" means `dist` and `.next` deleted.**

**Acceptance criteria:**
- [ ] Root `npm install`, `lint`, `typecheck`, `test`, `build` all pass
- [ ] Explore lists Tracks from the real backend; adding to Library persists and is idempotent
- [ ] Library shows per-Track progress from the **new backend rollup**, not client-side aggregation over per-Leaf calls
- [ ] Journey's resume affordance targets the correct next incomplete Leaf id — asserted on the id, not on navigation succeeding
- [ ] `user_tracks.status` transitions to complete when every Leaf in a Track is complete
- [ ] `listTracks` totals match the number of rows actually returned in production mode, **and** `ContentService`'s guard still independently blocks placeholder content — test both, since the query filter must not become the only control
- [ ] **Every new screen verified at `accessibilityExtraExtraExtraLarge` on a device, in both themes** — by switching the setting and looking, not by reading a stylesheet. This falsified a WP6 criterion; do not generalise from one screen to the others
- [ ] A CMS-unreachable 503 renders a readable message with a retry on every screen that fetches
- [ ] Empty states render for an empty Library and an empty Journey
- [ ] Icon set replaces every text glyph, and active-tab tint applies to all of them
- [ ] CI green; `.env.example` current

**Testing expectations — revised 2026-08-11 under the tiered bar** (`agents/manager.md`; development velocity is the priority until the app is functional end to end):

- **Tier A, required:** the `listTracks` query filter must not become the only control — test that `ContentService`'s `isProductionPublishable` guard independently blocks placeholder content. Migration for any schema change applies to an empty database.
- **Tier B, one happy path and one failure path:** the progress-rollup calculation (a partially complete Track, and next-incomplete-Leaf selection when Leaves are out of order) and the `user_tracks.status` transition, against real Postgres.
- **Tier C, defer to WP14:** component render tests across both themes and every loading/empty/error permutation, and the WP6 coverage gaps (`ProfileScreen`, `TabShell`, `RootNavigator`, the three shells). **List what you defer in the completion report** so WP14 has a worklist.
- **Manual verification is mandatory, not a substitute for the above:** run all three screens on a device in both themes and at `accessibilityExtraExtraExtraLarge`, and exercise browse → add → progress → resume against the real backend. This is where WP6's real defects were found.

**Any test written to close a review finding must be mutation-checked**: break the behaviour and confirm that test — and only that test — goes red. WP6's first pass shipped a failed-refresh test that passed with the handler deleted entirely.

### Handoff: 2026-08-09 — WP6: Mobile shell, auth screens, design system

### Task: WP6 — Mobile shell: design system, navigation, auth, age gate

**Context:** Everything so far is backend. `apps/mobile` is still the boot screen from WP0. This package is the first real app — and the first time the founder can install ZoomOut and use it.

Its design inputs are settled: **`project/proposals/design-direction.md` is approved** and is the specification for the token system. Read it in full before writing any styling. WP7 (surfaces) and WP8 (Leaf player) both build on what you establish here, so the token system matters more than any individual screen.

**Objective:** A reader can install the app, sign up with email, Apple or Google, pass the age gate, land in a four-tab shell, see their profile, and sign out. All screens are themed from a token system supporting dark (default) and light. No content yet — the four tabs are shells.

**Scope:** (verify, don't trust blindly)
- `apps/mobile/src/design/` — tokens, typography, spacing, motion
- `apps/mobile/src/api/` — typed client, token storage, refresh
- `apps/mobile/src/auth/` — sign-up, sign-in, age gate, session state
- `apps/mobile/src/navigation/` — tab shell and auth stack
- `apps/mobile/src/screens/` — auth screens, Profile, and placeholder shells for Explore, Library, Journey

**Requirements:**

*Design system — this is the durable part*
- Tokens per `design-direction.md` §3–§5: surfaces, primary teal, reward amber, semantic colours, type scale, spacing, radius. **Both dark and light values from day one**, even though dark is the default — retrofitting a theme means auditing every screen.
- **Depth comes from surface lightness, never shadow.** `elevation/1` means "render on `surface/1`". Shadows are invisible on dark and will silently do nothing.
- Tokens live in `apps/mobile/src/design/` — **not** `packages/shared`, which the backend consumes and which has no business carrying UI concerns.
- Nunito (display/UI) and Nunito Sans (body) via `expo-font`. Support OS font scaling.
- Motion constants per §6: spring-based, micro 120–180ms, standard 240–320ms. **Respect reduced-motion** by swapping to opacity fades, never by removing feedback.
- **Never signal state by colour alone** — every correct/incorrect/error state carries an icon or shape as well. `correct` green and `primary` teal are adjacent in hue and a reader must never have to tell them apart.

*API client and session*
- Access token in memory; **refresh token in `expo-secure-store`**, never `AsyncStorage`.
- On a 401, refresh once and retry the original request. **Concurrent requests with an expired token must trigger exactly one refresh, not one per request** — single-flight the refresh.
- A failed refresh clears the session and returns to sign-in. It must not loop.
- Errors are typed off the backend's error codes, not matched on message strings.

*Auth screens*
- Email sign-up and sign-in; Sign in with Apple; Google. **Apple is mandatory on iOS because Google is offered** — this is an App Store review requirement, not a preference.
- **The age gate is a screen on the social path too, not just the email path.** Apple and Google supply neither date of birth nor timezone, and the backend rejects a first-time social signup without them (ruled 2026-08-07). A social sign-up that sends only the provider token will fail.
- **Timezone is read from the device and sent silently** — `Intl.DateTimeFormat().resolvedOptions().timeZone`. Never ask the reader for it.
- Handle `SIGNUP_DETAILS_REQUIRED` by jumping to the date-of-birth input using its `missingFields` list. Handle `PROVIDER_EMAIL_MISSING` as a distinct, unrecoverable state with different copy — they need opposite recoveries.
- A signup refused by the age gate gets a clear, non-punitive screen. It is a compliance boundary, not a failure.
- **The client-side age check is UX only.** The server decides; never treat a client check as the control.

*Shell*
- Four tabs — Profile, Explore, Library, Journey. Only Profile is real: display name, timezone, and sign-out.
- Explore, Library and Journey are empty-state shells. **Compose their empty states with the reserved mascot slot accounted for** (`design-direction.md` §9), filled for now by an illustrative motion element or oversized type. Adding a mascot later should be an asset swap, not a redesign.
- Sign-out calls the logout endpoint and clears secure storage. Note logout revokes the **whole token family**, so it signs out this device only.

**Out of scope:**
- Explore, Library, Journey content — WP7
- The Leaf player — WP8
- Share and achievement screens — WP9
- SFX — WP8
- Streaks, XP display, session cap UI — WP5 owns the server side, WP9 the surfaces
- Offline support, guest mode — ruled out of Phase 1

**Constraints:**
- Do not modify `packages/shared/src/content.ts` — frozen 2026-08-08.
- Do not let Next.js or any `apps/admin` dependency into `apps/mobile`.
- Component-testing stack for React Native is an open decision (debt register, WP0). Pick one, state why, and keep it out of the way of Expo's own config.
- Follow the engineering standards in `CLAUDE.md` in full.
- **"Verified locally" means `dist` and `.next` deleted, not just `npm ci`.**

**Acceptance criteria:**
- [ ] `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass from the root
- [ ] The app builds and runs in the iOS simulator
- [ ] **Every screen renders correctly in both dark and light** — verified by switching theme, not by reading the token file
- [ ] Body text meets WCAG AA **against the surface it actually sits on**, checked per elevation level rather than once against `surface/0`
- [ ] Email sign-up → age gate → shell works end to end against the real backend
- [ ] **A social sign-up sends `dateOfBirth` and `timezone`** and succeeds; one sending only the provider token is rejected by the server, and the app recovers by routing to the date-of-birth screen via `missingFields`
- [ ] Timezone is never presented as an input and matches the device's IANA zone
- [ ] A signup below the age threshold is refused with a non-punitive screen and no account created
- [ ] **A request with an expired access token refreshes once and retries** — and **two concurrent requests with an expired token trigger exactly one refresh**, not two. Assert the refresh call count, not just that the requests succeed
- [ ] A failed refresh clears the session and lands on sign-in without looping
- [ ] The refresh token is in `expo-secure-store`; nothing sensitive is in `AsyncStorage`
- [ ] Sign-out revokes server-side and clears local storage; the app returns to sign-in
- [ ] Text scales with the OS font-size setting without clipping
- [ ] Reduced-motion swaps animation for fades rather than removing feedback
- [ ] CI green

**Testing expectations:** Unit tests for the API client's refresh logic — expiry detection, single-flight under concurrency (assert exactly one refresh for N parallel 401s), failed-refresh teardown — and for the age-gate boundary and the error-code routing. Component tests for the auth screens covering the two provider error codes and the age-refusal state.

**Note on criteria written to name a path, not just an outcome** (a WP4 lesson): the refresh criteria above specify *how many refreshes occur*, because "the request succeeds" passes just as well against a client that refreshes once per in-flight request and hammers the backend. Assert the count.

Verify in the simulator by running the flows, not by reasoning about them.

### Handoff: 2026-08-08 — WP4: Learning loop API

### Task: WP4 — Learning loop API: answer, unlock, complete, award XP

**Context:** This is the product. Everything so far has been scaffolding around one mechanic — a reader answers a scenario, and the payoff unlocks only when they get it right. WP4 makes that mechanic real on the server.

WP3's completion report carries a **"Handover to WP4"** section written for a session with no memory of building it. Read that first; it lists the endpoints, the auth helpers, and the four invariants you must not undo.

**Objective:** An authenticated reader can start a Leaf, submit an answer and be told whether it was correct, unlock the payoff only after a correct answer, complete a Leaf, and earn XP — all decided server-side, all persisted, all resumable.

**Scope:** (verify, don't trust blindly)
- `apps/backend/src/progress/` — repository, service, routes, grading
- `apps/backend/src/db/` — a migration for `leaf_progress`
- `packages/shared` — only if `LeafProgress` in `src/progress.ts` genuinely needs changing. **`src/content.ts` is frozen and off-limits**

**Requirements:**

*Grading — the core*
- The client submits a **scenario option id**. It never submits, and is never told, which option is correct.
- **Grading needs `isCorrect`, so fetch the full `Leaf` via `ContentRepository.findLeaf`.** Do **not** widen what the content endpoints return — `ContentService.getLeaf` returns `PublicLeaf` and that is the only shape a client ever sees. This is the single most important constraint in the package.
- Option ids are Payload row ids (hex strings, e.g. `6a7629ee570031ac25de62bf`), stable across edits. Key on them, never on array position.
- An option id that does not belong to this Leaf is a client error, not a wrong answer. They are different outcomes and must not be conflated.

*Progress state*
- `LeafProgress` per (reader, Leaf): attempt count, whether the first attempt was correct, completion timestamp, XP awarded.
- **Wrong answers retry without limit** (PRODUCT.md). The payoff stays locked until correct; the stakes are XP, not access.
- The payoff unlock is **server-authoritative**: a reader who has not answered correctly cannot obtain payoff content by any route.
- Progress is resumable — a reader returning to a partially-completed Leaf gets their existing state, not a reset.
- Completing a Leaf is **idempotent**. Replaying the completion call must not award XP twice; this is the obvious exploit and needs an explicit test.

*XP*
- Flat award per Leaf plus a **first-try-correct bonus** (decided 2026-08-06). Calibrate so the 500 XP daily cap lands near **5 Leaves**, matching the ~3-minute Leaf.
- XP values come from validated config, not literals — they will be tuned once the loop is playable.
- XP is computed and awarded **server-side only**. The client is told the result.

*Boundaries*
- **Any new content-reading path must go through `ContentService`, not around it via `ContentRepository`** — except the single deliberate grading fetch above, which must be commented as such at the call site. `isProductionPublishable` lives in `ContentService`; bypassing it bypasses the placeholder guard.
- **Never parse untrusted input with `publicLeafSchema`** — it derives from the Leaf shape before the Dinner Table Knowledge refinement and would accept an unsourced fact.
- **Never read Payload's Postgres tables.** `PayloadClient` is the only door.

**Out of scope:**
- **`DailySession`, `Streak`, the 15-min/500 XP session cap, achievements — all WP5.** Do not start them. Award XP without enforcing the cap; WP5 adds enforcement.
- Any mobile UI — WP6 onward
- Report-an-error — WP10
- Changing `packages/shared/src/content.ts`

**Constraints:**
- **`DailySession` and `Streak` (WP5) key on the reader's LOCAL date, not a UTC instant.** Plan §3.5 names this the most common source of streak and cap bugs, and `localDateIn()` in `src/auth/ageGate.ts` already exists for it. WP4 does not build them — but if you persist any date on `LeafProgress` that WP5 will later group by day, use the same local-date approach rather than leaving WP5 a UTC timestamp to reinterpret.
- Handler → service → repository. `process.env` only in the config module.
- Follow the engineering standards in `CLAUDE.md` in full.
- **"Verified locally" means `dist` and `.next` deleted, not just `npm ci`.**

**Acceptance criteria:**
- [ ] `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass from the root
- [ ] Migration applies cleanly to an empty database and creates `leaf_progress`
- [ ] Submitting the correct option id returns correct; a wrong one returns incorrect and does not unlock the payoff
- [ ] The payoff is unobtainable by any route before a correct answer — tested, not assumed
- [ ] `isCorrect` appears in no response body anywhere, asserted at the route level
- [ ] Unlimited retries: repeated wrong answers never lock a reader out
- [ ] First-try-correct earns more XP than a later correct answer
- [ ] Replaying the completion call does not award XP twice
- [ ] An option id from a different Leaf is a client error, distinct from a wrong answer
- [ ] Progress is per-reader: one reader's answers never affect another's state
- [ ] XP values move with configuration alone
- [ ] CI green; `.env.example` current

**Testing expectations:** Unit tests for grading — correct, wrong, unknown option id, an option id belonging to another Leaf — and for XP calculation including the first-try bonus. Integration tests against real Postgres for the full loop: start → wrong → wrong → correct → payoff unlocked → complete → XP awarded → replay completion → XP unchanged. Cross-reader isolation in both directions. The idempotency test is not optional; double-awarding XP is the obvious exploit and the one a client can trigger by retrying a failed request.

### Handoff: 2026-08-08 — WP2.1: Schema-freeze alignment and backend gaps

### Task: WP2.1 — Schema-freeze alignment and backend gaps

**Context:** The schema-freeze gate closed on 2026-08-08. Authoring one real Leaf surfaced four schema defects, all now ruled (roadmap decisions log, 2026-08-08). This package applies those rulings and, while in the area, closes three small backend gaps left open by WP2.

**This runs before WP3 deliberately.** WP3 maps CMS documents into the domain types and validates them against `leafSchema` / `trackSchema`. Two of the rulings below change those schemas, so building WP3 first would mean building against a contract we are mid-way through changing — exactly the churn the gate existed to prevent.

**Objective:** The content schema is frozen and enforced consistently in both gates — `packages/shared` and the CMS agree, and neither is weaker than the other. Logout exists, the overloaded provider error is split, and expired refresh tokens are reaped.

**Scope:** (verify, don't trust blindly)
- `packages/shared/src/content.ts` — schema refinements, PROVISIONAL header removal
- `packages/shared/src/cms-generated.ts` — regenerated
- `apps/admin/src/` — trim hook, validation rules, collection field config
- `apps/backend/src/auth/` — logout, error split, token reaping
- Root `.env.example` if reaping needs configuration

---

**Part A — schema-freeze alignment**

*A1. Trim all CMS text input on save*
- A `beforeChange` hook trimming every text and textarea field across both content collections.
- **Leading and trailing whitespace only. Never collapse internal whitespace** — payoff bodies are multi-line and that formatting is authored deliberately.
- Applies to nested group and array fields too. The gate found `" ; \n"` on `takeaway.dinnerTableKnowledge` and `"concept 1 "` as a Leaf title, so nesting is exactly where it bites.

*A2. Source references need a locator*
- A `SourceReference` requires its existing `note` **plus at least one of** `chapter`, `page`, `quote`.
- Enforce in **both** gates: a refinement in `packages/shared`, and a publish-gated rule in the CMS.
- **Publish-gated, not save-gated** — deliberately asymmetric with the existing Dinner Table Knowledge rule. The *existence* of a source is the same edit as writing the fact, so that stays on save. The *completeness* of the citation is a publish concern.
- Author-facing message must name which locators are acceptable, not just say the reference is incomplete.

*A3. Sticky notes bounded*
- `min 2, max 6`, in `packages/shared` and as `minRows`/`maxRows` in the CMS.
- Note the shape divergence already recorded in `payload.config.ts`: Payload stores `{ note }[]`, the domain type is `string[]`. Both need the bound.

*A4. `publisher` and `coverUrl` required to publish a Track*
- Publish-gated rule in the CMS. `trackSchema` already declares both non-optional, so this is the CMS catching up to the domain model rather than a new constraint.
- The gate published a Track with both null, which means today the CMS can emit a document that `trackSchema` would reject at serve time.

*A5. Freeze the content types*
- Remove the `PROVISIONAL` header from `packages/shared/src/content.ts` and replace it with a short note that the schema was frozen on 2026-08-08 after the gate, and that changes now require an Architect ruling rather than being expected.
- Regenerate `cms-generated.ts` and confirm the divergence list in `payload.config.ts` is still accurate.

---

**Part B — backend gaps from WP2**

*B1. Logout*
- An authenticated endpoint revoking the caller's refresh token. The revocation machinery exists; nothing exposes it.
- Revoking an already-revoked or unknown token is a success, not an error — a client signing out twice is not a failure case.
- Decide and state whether logout revokes the single token or the whole family; either is defensible, but WP6 needs to know which.

*B2. Split `ProviderEmailMissingError`*
- It currently covers two unrelated failures: the provider returned no usable email, and a first-time social signup arrived without `dateOfBirth` / `timezone`.
- Two distinct error codes. They need opposite client recoveries — one is "your Apple account has no email we can use", the other is "we need your date of birth" — and WP6 will show the wrong screen for one of them until they are separable.

*B3. Reap expired refresh tokens*
- A periodic cleanup of expired and revoked rows. The table currently grows unbounded.
- Keep it simple: a scheduled query is sufficient. Do not add a job-queue dependency for this.

---

**Out of scope:**
- The content API, `ContentRepository`, Explore, Library — WP3, released immediately after this
- Moving the exactly-one-correct rule from save-time to publish-time — **the founder's ruling is pending.** If it lands before you reach A2, Architect will amend this handoff. Do not change it on your own judgement
- Authoring any content — the placeholder Track and Leaf from the gate stay as they are
- Any mobile work
- Password reset, email verification

**Constraints:**
- The two-gate duplication between `packages/shared` and the CMS is deliberate and ruled. Do not collapse it.
- `process.env` only in the config module. Handler → service → repository in the backend.
- Follow the engineering standards in `CLAUDE.md` in full.
- **"Verified locally" means `dist` deleted, not just `npm ci`.**

**Acceptance criteria:**
- [ ] `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass from the root
- [ ] Saving a field with leading or trailing whitespace stores it trimmed; a multi-line body keeps its internal formatting intact
- [ ] Publishing a Leaf whose source reference has only a `note` is rejected, with a message naming the acceptable locators
- [ ] The same constraint rejects the same document in `packages/shared` — both gates agree
- [ ] Sticky notes reject 1 and reject 7, in both gates
- [ ] Publishing a Track without `publisher` or without `coverUrl` is rejected
- [ ] The Track and Leaf authored at the gate either still validate, or the migration needed to make them valid is stated in the completion report
- [ ] `content.ts` no longer claims to be provisional
- [ ] Logout revokes the caller's refresh token; a second logout succeeds
- [ ] The two provider failures return distinct, documented error codes
- [ ] Expired refresh tokens are removed by the reaping path
- [ ] CI green; `.env.example` current

**Testing expectations:** Unit tests for the trim hook against nested group and array fields, including a multi-line body proving internal whitespace survives. Unit tests for the locator rule covering each locator alone, all absent, and whitespace-only values — the last one is why trimming and this rule belong in the same package. Sticky-note bounds tested at 1, 2, 6 and 7 in both gates. Integration tests for logout including the double-logout case, and for reaping. Existing WP1 and WP2 suites must stay green; report any test that needed changing and why.

### Handoff: 2026-08-07 — WP3: Content API (▶ RELEASED 2026-08-08, with amendments)

> **Status: live.** Released after WP2.1 was signed off on 2026-08-08. The schema is frozen; `packages/shared` is no longer provisional.
>
> **Amendments from WP2.1 — read these before starting, they change the mapper:**
>
> 1. **Content ids are numbers, not strings.** Payload's Postgres adapter uses serial integer keys, so it emits `id: number` and `trackId: number | Track`, while `cmsIdSchema` is `z.string().min(1)`. **The mapper must stringify ids**, and must handle a relationship arriving either populated as an object or as a bare id, depending on the `depth` used on the request. Pick a `depth` deliberately and state it.
> 2. **Payload marks nearly every generated field optional and nullable**, including fields the collection requires, because a draft may legitimately be incomplete. The domain model is strictly stronger. **The mapper is the only place a published document is proven to satisfy it** — treat that as the point of the layer, not as friction.
> 3. **`hasSourceLocator` and `SOURCE_LOCATOR_REQUIRED_MESSAGE` are exported from `packages/shared`** for the mapper to reuse when reporting *why* a document was rejected. Note the CMS deliberately does not import them — the two gates stay independent — but the mapper is on the shared side of that line and should reuse them.
> 4. **Schema constraints tightened**: source references need a locator alongside `note`, sticky notes are bounded 2–6, and `publisher` / `coverUrl` are required on a publishable Track. Mapping tests must cover documents that violate each.
>
> **Testcontainers is intermittently flaky when suites run back to back** (WP2.1 finding): one full run had all integration tests skipped in `inspectContainerUntilPortsExposed`, and an immediate re-run passed. If CI goes red once and green on re-run, that is this, not a regression. Adding a retry step to the workflow is in scope if it recurs.

### Task: WP3 — Content API: ContentRepository, Explore, Library, Leaf delivery

**Context:** WP1 put content in Payload; WP2 put readers behind auth. Nothing connects them — the mobile app has no way to see a Track or a Leaf. This package is that bridge, and it is where the placeholder guard and the answer-key strip stop being intentions and start being enforced.

WP4 (learning loop) and WP7 (mobile surfaces) both build directly on the endpoints defined here.

**Objective:** An authenticated reader can browse published Tracks, add and remove them from a personal library, list that library, fetch a Track's ordered Leaf list, and fetch a single Leaf — with the answer key stripped server-side and placeholder content blocked in production.

**Scope:** (verify, don't trust blindly)
- `apps/backend/src/content/` — `ContentRepository`, mapping, service, routes
- `apps/backend/src/library/` — library service, repository, routes
- `apps/backend/src/db/` — a migration for the library table
- `apps/backend/src/config/env.ts` — Payload connection settings
- Root `.env.example`

**Requirements:**

*ContentRepository — the CMS boundary*
- Calls **Payload's REST API over HTTP**. **Never read Payload's Postgres tables from anywhere**, for any reason. Groups flatten to `summary_body`-style columns, arrays become join tables, versions live in `_leaves_v` — an undocumented internal schema — and reading it bypasses draft/publish resolution, which silently breaks takedown.
- Payload's read access already returns published-only to unauthenticated callers, so the backend calls anonymously and receives published content by construction. Do not add an admin token to widen that.
- HTTP client has an explicit timeout. Payload being unreachable produces a typed error and a clean 503 — never a hang, never a 500 with a leaked stack.
- Import generated CMS types from `@zoomout/shared/cms` explicitly. Do not re-export them from the shared index.

*Mapping — CMS shape to domain shape*
- Map Payload documents into the `packages/shared` domain types, handling the divergences documented in `payload.config.ts`: `trackId` is `string | Track`, `stickyNotes.notes` is `{ note }[]` not `string[]`, `scenario.options` is a plain array not a 3-tuple, and Payload adds `_status`, timestamps and row ids.
- **Validate the mapped result with `leafSchema` / `trackSchema` before serving it.** This is the point of having two independent gates: content that violates our invariants must not reach a reader even if the CMS accepted it. A validation failure is a logged server error, not a silent pass-through.

*The two guards that must actually fire*
- **`isProductionPublishable` must be enforced on the read path.** It exists in `packages/shared` and nothing calls it — today the placeholder guard is decorative. Placeholder content is legitimately visible in development and staging and must be **invisible in production**, so the check is environment-aware, driven by validated config.
- **`toPublicLeaf` is the only way a Leaf reaches a client.** `isCorrect` must never appear in a response body. Add a test asserting the serialised payload contains no answer key, at the route level, not just the mapper.
- **Never parse untrusted input with `publicLeafSchema`** — it derives from the Leaf shape *before* the Dinner Table Knowledge refinement, so it would accept an unsourced fact.

*Endpoints — all require authentication (there is no guest mode in Phase 1)*
- `GET /content/tracks` — Explore. Published, non-placeholder in production, paginated.
- `GET /content/tracks/:id` — detail, including the non-endorsement disclaimer and purchase links. Both are legally required on every Track; a Track missing either must not be servable.
- `GET /content/tracks/:id/leaves` — ordered Leaf list. Metadata only (id, order, title, completion-relevant fields) — not full slide bodies.
- `GET /content/leaves/:id` — one full Leaf as `PublicLeaf`.
- `POST` / `DELETE /library/tracks/:id` — add and remove. Adding twice is idempotent, not an error.
- `GET /library` — the reader's Tracks. Progress fields are WP4's; return library membership only.

*Caching and takedown latency*
- Content changes rarely and Payload should not be hit per request. A short in-memory TTL cache is fine — but **the TTL is the takedown latency**, so it must be bounded, driven by config, and documented at the call site. `LEGAL.md` requires hours; keep it to minutes and the requirement is met with room to spare.

**Out of scope:**
- Answer submission, unlock logic, XP — WP4
- Progress and completion state — WP4/WP5
- Seed or placeholder content — WP11
- Report-an-error — WP10
- Any mobile UI — WP7
- Draft preview for authors — Payload's admin is the preview

**Constraints:**
- Handler → service → repository. No business logic in handlers. `process.env` only in the config module.
- **If integration tests need seeded content, prefer seeding through Payload's REST API with an admin token over booting Payload in-process.** Booting it inherits two upstream gaps found in WP1: `payload.destroy()` does not close its database pool (and `pool.end()` hangs, because Payload keeps a client checked out), and Payload attaches no `error` listener to its pool, so an idle-client error becomes an uncaught exception. If you must boot it, put the workaround in one shared test harness rather than per suite.
- Follow the engineering standards in `CLAUDE.md` in full.
- **"Verified locally" means `dist` deleted, not just `npm ci`.**

**Acceptance criteria:**
- [ ] `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass from the root
- [ ] Every content endpoint requires authentication; an unauthenticated request is rejected
- [ ] `isCorrect` appears nowhere in any serialised response — asserted at the route level
- [ ] Placeholder content is served in development and **blocked in production**, with the outcome changing by configuration alone
- [ ] A Track lacking a disclaimer or purchase links is not servable
- [ ] Unpublishing a Track in Payload removes it from the API within the configured cache TTL — demonstrated by execution
- [ ] Payload unreachable produces a clean 503, not a hang or a leaked stack
- [ ] A reader sees only their own library; adding the same Track twice is idempotent
- [ ] Mapped content is validated against `leafSchema` / `trackSchema` before being served, and a violation is logged rather than passed through
- [ ] Migration applies cleanly to an empty database
- [ ] CI green; `.env.example` lists every new variable

**Testing expectations:** Unit tests for the CMS→domain mapping against realistic Payload payloads — including every divergence listed above, and a Leaf whose mapped form violates `leafSchema`. Unit tests for `isProductionPublishable` enforcement across environments. Integration tests against real Postgres for the library endpoints and cross-user isolation, and an end-to-end test proving the full takedown cycle: published Track visible → unpublished in Payload → gone from the API. The takedown path is a legal requirement and must be verified by execution, not by reading Payload's documentation.

### Handoff: 2026-08-07 — WP2: Backend foundation — auth, age gate, profile

### Task: WP2 — Backend foundation: auth, age gate, profile

**Context:** The backend has structure but no users, so nothing can be personalised and no progress can be attributed. WP4 (learning loop), WP5 (streaks and session cap) and WP6 (mobile shell) all need an authenticated reader before they can start.

WP2 depends only on WP0 and deliberately touches no content, no CMS, and none of the provisional content types — so the schema-freeze gate running in parallel cannot invalidate it. Do not import from `@zoomout/shared/cms` in this package.

Relevant WP0 state: the `users` table exists with `id`, `email`, `display_name`, `date_of_birth` (a `date`, not a timestamp — a birth date must not move with the server's timezone), `timezone`, `created_at`, `updated_at`. `apps/backend/src/users/user.mapper.ts` returns `Omit<User, 'authProviders'>`, a gap left visible on purpose for this package to close.

**Objective:** A reader can create an account with email/password, Sign in with Apple, or Google; is refused at signup if under a configurable age threshold; receives a short-lived access token and a revocable refresh token; and can read and update their own profile. Every route in the codebase from here on declares whether it is authenticated.

**Scope:** (verify, don't trust blindly)
- `apps/backend/src/auth/` — routes, service, repository, token issuing and verification, provider verification
- `apps/backend/src/users/` — profile routes, service, and the `user.mapper.ts` gap
- `apps/backend/src/db/` — new migrations and schema
- `packages/shared` — only if the `User` type genuinely needs a change; content types are off-limits
- Root `.env.example`

**Requirements:**

*Identity and storage*
- **`user_auth_providers` as its own table**, not a column on `users`: `user_id`, `provider` (`email` | `apple` | `google`), `provider_subject`, `created_at`, unique on (`provider`, `provider_subject`). One reader may hold several identities without a schema change.
- Close the `Omit<User, 'authProviders'>` gap — the mapper returns a complete `User`.
- Add `email_verified_at` (nullable) to `users` now. Email verification is **out of scope**, but reserving the column means adding it later is a feature, not a backfill.
- Passwords hashed with **argon2id**. Never logged, never returned, never included in an error.

*Tokens*
- Short-lived **access JWT** plus a longer-lived **refresh token**. Lifetimes come from validated config, not literals.
- The refresh token is stored **hashed** server-side in a `refresh_tokens` table so sessions are revocable. Rotate on every use; detect and reject reuse of an already-rotated token by revoking the whole family.
- Signing secret comes through the existing config module. The service must refuse to boot on a missing or weak secret, the same way the database URL already behaves.

*Social sign-in*
- Apple and Google ID tokens are **verified server-side against the provider's JWKS** — signature, issuer, audience, and expiry. A client-supplied identity claim is never trusted, under any circumstance.
- **Account linking, ruled:** one user per email address. If a provider returns an email that already exists, link the new provider to the existing user **only when the provider asserts the email is verified**. Otherwise reject with an actionable error. Do not silently create a second account for the same person, and do not silently merge on an unverified claim.

*Age gate*
- Date of birth is collected at signup and the threshold check runs **server-side**. A client-side check is a UX affordance, not the control.
- The threshold is **configurable, defaulting to 13**. It is legally undecided (`LEGAL.md`, owner TBD), so the eventual answer must be an environment change, not a code change.
- Below the threshold: no account is created, and nothing about the attempt is persisted. The message is clear and non-punitive — this is a compliance boundary, not a failure state.

*Profile*
- `GET` own profile and `PATCH` `display_name` / `timezone`. Timezone must go through the existing `timeZoneSchema`, which rejects bare UTC offsets — a frozen offset breaks local-midnight rollover for streaks and the session cap the moment DST shifts.
- A reader can read and modify **only their own** profile. Prove it with a test that tries someone else's.

*Hardening*
- Rate-limit signup, login, and refresh. Brute-forcing a password over an unthrottled endpoint should not be possible.
- Authentication failures must not reveal whether an email exists.
- Extend the existing `AppError` hierarchy rather than introducing a parallel one; pino redaction must cover tokens and passwords.

**Out of scope:**
- Email verification and password reset flows — both need outbound email. Reserved for pre-launch; `email_verified_at` is the only hook added now
- Any mobile UI — WP6 builds the screens; WP2 ships the API they call
- Content, the CMS, `ContentRepository` — WP1 is done and WP3 is blocked on the gate
- Learning loop, XP, streaks, session cap — WP4 and WP5
- Roles, permissions, or admin users — Payload has its own `admins` collection
- Deployment and hosting

**Constraints:**
- Handler → service → repository. No business logic in handlers. `process.env` is read only by the config module; the ESLint rule enforcing that stays.
- The age threshold, token lifetimes, and signing secret are **all** config, never literals.
- Do not add a third-party auth vendor. It was considered and rejected for now — a vendor, a per-MAU cost before monetization exists, and another DPA on the pre-launch legal list.
- Follow the engineering standards in `CLAUDE.md` in full.
- **"Verified locally" on this repo means `dist` deleted, not just `npm ci`.**

**Acceptance criteria:**
- [ ] `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass from the root
- [ ] Migrations apply cleanly to an empty database and create `user_auth_providers` and `refresh_tokens`; `users` gains `email_verified_at`
- [ ] Email signup, login, and refresh work end to end against a real Postgres
- [ ] Apple and Google ID tokens are verified against a JWKS; a token with a bad signature, wrong issuer, wrong audience, or past expiry is rejected in each case
- [ ] A signup below the configured age threshold is refused, no user row is created, and changing the threshold by configuration alone changes the outcome
- [ ] A refresh token is single-use: rotating it invalidates the old one, and replaying a rotated token revokes the family
- [ ] `user.mapper.ts` returns a complete `User` including `authProviders`
- [ ] A reader cannot read or modify another reader's profile
- [ ] `PATCH` profile rejects a bare UTC offset as a timezone
- [ ] Rate limiting is enforced on signup, login, and refresh
- [ ] No password, token, or secret appears in any log line or error response
- [ ] CI green on the pushed branch; `.env.example` lists every new variable

**Testing expectations:** Unit tests for age-threshold logic (boundary cases: exactly the threshold, a day either side, leap-year birthdays), token issuing and verification, and the account-linking decision table — every combination of existing/absent email and verified/unverified provider claim. Integration tests against real Postgres via testcontainers for the full signup → login → refresh → rotate → replay cycle, and for cross-user profile access.

For provider verification, generate a test key pair, sign tokens locally, and serve a fake JWKS — do not call Apple or Google from CI, and do not mock away the verification logic itself. The signature check is the security boundary and must be exercised for real.

### Handoff: 2026-08-06 — WP1: Payload 3.x CMS setup

### Task: WP1 — Payload 3.x CMS setup (`apps/admin`)

**Context:** Phase 1 has no AI pipeline, so every Leaf is hand-authored — and there is currently nowhere to author one. This package stands up the CMS. Immediately after it comes the schema-freeze gate (plan §5): the founder authors one structurally complete Leaf through the real editor, and nothing downstream starts until the schema is signed off. So the field names and validation you build here are the content contract WP3 and WP4 depend on.

WP0 is signed off. `packages/shared` is built, tested, and ready — its content types are marked `PROVISIONAL` and are the reference you model the collections from.

**Objective:** A Payload 3.x admin running at `apps/admin` with Track and Leaf collections that mirror `packages/shared/src/content.ts`, publish-time hooks enforcing the product's content invariants, drafts/versions enabled so unpublishing is instant, and generated types emitted into `packages/shared` without clobbering the hand-written domain contract. The founder can log in and author a complete Leaf.

**Scope:** (verify, don't trust blindly)
- `apps/admin/` — Payload 3.x + Next.js, `payload.config.ts`, collections, hooks, tests
- `packages/shared/` — generated CMS types in their **own new file**; `src/content.ts` is not modified by codegen
- Root `.env.example`, root scripts if a new entry point is needed
- `.github/workflows/ci.yml` if the new workspace needs a step

**Requirements:**

*Setup and isolation*
- Payload **3.x pinned exactly** — do not adopt 4.x. Next.js pinned to a version Payload 3 supports.
- **Next.js must not leak into `apps/backend` or `apps/mobile`.** Confine it to `apps/admin` with its own tsconfig and dependencies.
- Payload uses **its own database on the same Postgres instance** — not `schemaName`, which is flagged experimental upstream. The Drizzle-managed `users` table stays untouched; Payload manages its own migrations independently.
- Any new environment variable goes through `.env.example`. No secrets committed.

*Collections — field names must match `packages/shared/src/content.ts` exactly*
- **Tracks:** `bookTitle`, `author`, `publisher`, `coverUrl`, `description`, `disclaimer`, `purchaseLinks` (array, minimum 1, each with `retailer`/`url`/`isAffiliate`), `leafCount`, `isPlaceholder` (checkbox, **defaults to true**). Publish state comes from Payload drafts, not a hand-rolled `status` field.
- **Leaves:** `trackId` (relationship to Tracks), `orderIndex`, `title`, `isPlaceholder` (**defaults to true**), and the five slides as Payload **`group`** fields named exactly `summary`, `scenario`, `payoff`, `stickyNotes`, `takeaway`. Not a blocks/repeater array — the fixed 5-slide structure is the single most important modelling decision in the content model, same as in WP0.
- `scenario.options` is an array with `minRows: 3` and `maxRows: 3`, each option carrying `text` and `isCorrect`.
- **`sourceReferences` is a nested array field on the Leaf document, NOT a separate collection with a relationship.** A `beforeChange` hook cannot validate the Dinner Table Knowledge invariant across documents, and that invariant is the point. Each entry: `slideKey` (enum of the five slide keys), optional `chapter`/`page`/`quote`, required `note`.
- Reserve the per-slide `audio` field, unused in Phase 1.

*Validation — hooks, gated on publish where noted*
- Exactly one option with `isCorrect: true`. Reject zero, two, three.
- Dinner Table Knowledge present ⇒ a `sourceReferences` entry with `slideKey: 'takeaway'` must exist. Reject otherwise, with a message an author can act on.
- All five slide groups populated before a Leaf can be **published**.
- A Track cannot be **published** without a non-empty `disclaimer` and at least one `purchaseLinks` entry.
- **Write each rule as a pure function that takes the document and returns a result, with the hook as a thin wrapper.** The rules must be unit-testable without booting Payload.

*Drafts, versions, takedown*
- Drafts and versions enabled on both collections.
- Unpublishing must remove the record from published-status reads immediately — this is the hours-to-takedown legal requirement (`LEGAL.md`), so verify it rather than assuming it.

*Type generation*
- `payload generate:types` emits into `packages/shared` — **its own file, e.g. `src/cms-generated.ts`.** `src/content.ts` remains hand-written and authoritative; codegen must never overwrite it.
- Note in a comment where the generated types and the hand-written domain types are expected to diverge, so the schema-freeze gate can reconcile them.

**Out of scope:**
- `ContentRepository`, the backend content API, any backend↔CMS integration — that is WP3
- Authoring real or placeholder Leaf *content* — the gate is founder-owned, and the seed fixture is WP11
- Deployment, Cloud Run, or any hosting configuration
- End-user authentication — WP2. Payload's own admin login is in scope; app user auth is not
- Any mobile work
- Role-based permissions and approval workflow — deferred by decision; do not build it, just don't foreclose it

**Constraints:**
- **Never read Payload's Postgres tables directly, from anywhere.** Groups flatten to `summary_body`-style columns, arrays become join tables, versions live in `_leaves_v` — an undocumented internal schema, and reading it bypasses draft/publish resolution, which would silently break takedown. The backend will call the REST API in WP3.
- The validation rules here intentionally duplicate `leafSchema`/`trackSchema` in `packages/shared`. That is a ruled decision (roadmap, 2026-08-06): two independent gates on the highest-severity risk in `LEGAL.md`. Do not "DRY them up" by removing either side.
- Follow the engineering standards in `CLAUDE.md` in full.
- **"Verified locally" on this repo means `dist` deleted, not just `npm ci`** — your own standard from WP0, now the project's.

**Acceptance criteria:**
- [ ] `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all still pass from the root with `apps/admin` present
- [ ] Payload admin boots locally and the founder can log in
- [ ] Tracks and Leaves collections exist with field names matching `packages/shared/src/content.ts` exactly
- [ ] The five slides are Payload `group` fields named `summary`, `scenario`, `payoff`, `stickyNotes`, `takeaway`
- [ ] `scenario.options` accepts exactly 3 rows; a hook rejects zero, two, and three correct answers
- [ ] Publishing a Leaf carrying Dinner Table Knowledge without a `takeaway` source reference is rejected with an actionable message
- [ ] Publishing a Track with no disclaimer, or with zero purchase links, is rejected
- [ ] `isPlaceholder` defaults to `true` on both collections
- [ ] Unpublishing a Track removes it from published-status API reads — demonstrated, not assumed
- [ ] `payload generate:types` writes to its own file in `packages/shared` and leaves `src/content.ts` byte-identical
- [ ] Payload runs on its own database; the Drizzle `users` table and its migration are untouched
- [ ] Next.js appears in no `apps/backend` or `apps/mobile` dependency tree
- [ ] CI green on the pushed branch
- [ ] No secrets committed; `.env.example` lists every new variable

**Testing expectations:** Unit tests for every validation rule as a pure function — exhaustive on the correct-option count and the Dinner Table Knowledge invariant, matching the depth of the WP0 scenario tests. At least one integration test booting Payload against a testcontainers Postgres that proves publish-time rejection and that unpublishing removes a record from published reads; the takedown path is a legal requirement and must be verified by execution, not by reading the docs. If booting Payload in-process proves disproportionately heavy, say so in the completion report and explain what you verified instead — don't silently drop it.

### Handoff: 2026-08-06 — WP0: Monorepo scaffolding and shared domain types

### Task: WP0 — Monorepo scaffolding and shared domain types

**Context:** ZoomOut has an approved Phase 1 plan (`project/proposals/phase-1-implementation-plan.md`) and no code at all. Every downstream work package depends on a working monorepo with shared types, a database, and CI. This task is deliberately small — it is also the first real exercise of the Architect/Manager workflow, so getting the conventions right matters more than getting it done fast.

**Objective:** A working npm-workspaces monorepo where `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all succeed from the repo root; the backend boots and serves a health endpoint backed by a real Postgres connection; the Expo app boots and renders a value whose type comes from `packages/shared`; CI runs all of it.

**Scope:** (verify, don't trust blindly)
- Root: `package.json` (workspaces), `tsconfig.base.json`, ESLint + Prettier config, `.gitignore`, `.env.example`
- `packages/shared/` — domain types and Zod schemas
- `apps/backend/` — Node.js + TypeScript API
- `apps/mobile/` — Expo + React Native + TypeScript
- `.github/workflows/ci.yml`
- No `apps/admin/` yet — the CMS choice is still under research

**Requirements:**
- npm workspaces, Node 22 LTS. TypeScript **strict** in every workspace, inherited from a shared base config. No `any` without a comment explaining why.
- `packages/shared` exports domain types plus matching Zod schemas for: `Track`, `Leaf`, `ScenarioOption`, `SourceReference`, `User`, `UserTrack`, `LeafProgress`, `DailySession`, `Streak`, `Achievement`, `UserAchievement`, `ErrorReport`. Field lists are in the plan §3.3 and §3.5.
- **`Leaf` is modelled as five explicitly named, individually typed fields — `summary`, `scenario`, `payoff`, `stickyNotes`, `takeaway` — NOT a `slides: Slide[]` array.** The fixed 5-slide structure must be a compile-time guarantee, not a runtime check. This is the single most important modelling decision in the task.
- The `scenario` Zod schema enforces **exactly 3 options with exactly one `isCorrect: true`**. Reject 2 options, 4 options, zero correct, and two correct.
- `Track` and `Leaf` both carry an `isPlaceholder: boolean` field (see plan §3.4 — Phase 1 ships with mock content and flagged records must never reach production).
- `Leaf` reserves an optional per-slide audio reference field, unused in Phase 1 (voiceover is Phase 2).
- Mark the content types (`Track`, `Leaf`, slide types, `SourceReference`) as **provisional** in a comment — they are the reference WP1 models the CMS from and will be revised at the schema-freeze gate.
- Backend uses handler → service → repository layering. No business logic in handlers.
- Backend environment config is parsed and validated at boot through a single config module (Zod), failing fast with a clear error on a missing or malformed variable. `process.env` is never read anywhere else.
- Structured logging (pino or equivalent) at service boundaries and error paths. Typed error handling — nothing fails silently.
- Drizzle configured for migrations, with one initial migration creating the `users` table (`id`, `email`, `display_name`, `date_of_birth`, `timezone`, `created_at`, `updated_at`). Table only — no auth logic in this task.
- `GET /health` returns 200 with confirmed database connectivity, and a non-200 when the database is unreachable.
- Expo app boots and renders a value typed from `packages/shared`, proving the workspace wiring.
- Vitest (or equivalent) configured, with at least one meaningful test per workspace.
- CI runs install → lint → typecheck → test → build on push and pull request.
- No secrets committed. `.env.example` documents every variable the app reads.

**Out of scope:**
- Authentication, login, signup, age gate — that is WP2
- The CMS and `apps/admin` — WP1, pending the Payload vs Directus decision
- Any content tables beyond `users`
- Any mobile screen beyond the boot screen that proves type wiring
- Deployment, hosting, or infrastructure-as-code
- Any learning-loop, XP, streak, or session-cap logic

**Constraints:**
- Drizzle is chosen deliberately: it governs *our* tables (users, progress, gamification), not the CMS's, so the pending CMS decision barely constrains it. TypeScript-first and strict-friendly. If you hit a genuine blocker, flag it rather than silently swapping tools.
- Shared types live in `packages/shared` only — never redefine the same shape in `apps/mobile` and `apps/backend`.
- Follow the engineering standards in `CLAUDE.md`; they apply in full.

**Acceptance criteria:**
- [ ] `npm install` from the repo root succeeds
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass from the root
- [ ] TypeScript strict is genuinely enforced in all three workspaces, not just declared in the base config
- [ ] The initial migration applies cleanly to an empty database and creates `users`
- [ ] Backend boots; `GET /health` returns 200 with database connectivity confirmed, and non-200 when the database is unreachable
- [ ] Expo app boots in the iOS simulator and renders a value whose type is imported from `packages/shared`
- [ ] A shared type imports and typechecks from both `apps/backend` and `apps/mobile`
- [ ] Zod schema tests reject: a scenario with 2 options, with 4 options, with no correct option, and with two correct options
- [ ] `isPlaceholder` is present on both `Track` and `Leaf` and defaults safely
- [ ] CI is green on a pushed branch
- [ ] No secrets anywhere in the repo; `.env.example` lists every variable

**Testing expectations:** Unit tests for the `packages/shared` Zod schemas, with the scenario-option constraints covered exhaustively (they encode the product's core unlock rule). An integration test for `GET /health` against a real Postgres instance — testcontainers or a CI service container, not a mock. A build smoke test for the Expo app. No end-to-end tests in this package.

## Completions (Manager → Architect)

### Completed: WP15.2 — pipeline API key, and the admin UI blank-page bug — 2026-08-28

**Both items done. All 8 acceptance criteria met.** Root `lint`, `typecheck`, `test`
(959 across four workspaces) and `build` all pass.

#### 1 — a publish-incapable API key

`Admins` now has `useAPIKey: true` and an `accountType` of `human` or `machine`,
defaulting to `human`. `npm run create-pipeline-key --workspace=apps/admin` provisions
`pipeline-bot@zoomout.local` as a machine account and prints its key once; Payload keeps
only a hash. Creation, rotation and revocation are documented in the new
`apps/admin/README.md`.

**The key is a separate identity from the login the pipeline uses today.** The script's
first run found the existing `pipeline@zoomout.local` and converted it, which would have
changed the rights of a credential another session is actively using — the one thing this
package was scoped not to do. It was restored to `human` with its key cleared, and the
machine account was provisioned alongside it instead. The pipeline keeps working
untouched; the old login can be deleted once it switches over.

**What "cannot publish" was made to mean.** Three things change what the public is
served, not one: publishing, unpublishing, and editing a document that is already live.
A machine is refused all three. It may create drafts, and may update through Payload's
draft mechanism (`?draft=true`), which writes to the versions table rather than the
published row.

**Verified by calling the API, not by reading config** — every vector, against a Track
that was published *and* carried a pending draft:

| Attempt with the machine key | Result |
|---|---|
| `POST` create with `_status: draft` — the pipeline's real call | **201** |
| `PATCH ?draft=true` — a legitimate draft edit | **200**, published row untouched |
| `POST` create with `_status: published` | **403** |
| `POST` create omitting `_status` | **403** |
| `PATCH` a live row with no flag | **403** |
| `PATCH _status: draft` — unpublish | **403** |
| `PATCH ?draft=false` | **403** |
| `PATCH ?draft=true` with `_status: published` | **403** |
| Same probes against Leaves | **403** |
| A human publishing, `overrideAccess: false` | **published** |
| Any call after revoking through Payload | **403** |

#### The first implementation was wrong, and only the behavioural check caught it

`machinesUpdateDraftsOnly` originally returned a query constraint —
`_status not_equals published` — so a published document would not be in the set the
credential could address. Thirteen unit tests passed. Payload does apply the constraint.
**It still let the machine key unpublish a live Track**, because with drafts enabled
`_status` resolves against the document's *latest version*: a Track that is published but
carries a pending draft edit reads as a draft to the query and is updated as one.

The hole was invisible on a clean fixture and open on real content — the demo Track had a
pending draft from the WP15.1 device gate, so it was the realistic case that failed and
the tidy one that passed. **A published Track was edited and unpublished during the
probe; it was restored from its last published version and the probe's version rows were
deleted.**

What replaced it does not ask what state the document is in. Requiring `draft=true`
changes the write's *destination* rather than its value, so the published row is not what
is being written at all, and a machine that forgets the flag is refused rather than
quietly writing live content.

**Two process notes, because both cost time and both will recur:**

- **Payload caches its config at server start.** The first re-probe still showed the old
  behaviour because the dev server had booted before the rewrite. Access functions,
  collection config and hooks all need a restart, not HMR — a code change that appears
  not to have worked is more likely stale than wrong.
- **Revoking by flipping `enable_a_p_i_key` in the database does not revoke anything.**
  The key kept authenticating. Payload clears the key hash as part of its own update, so
  revocation has to go through Payload — the UI, or the API. This is in the README as a
  warning because the database column looks like the off switch and is not.

#### 2 — the blank admin UI

One line: `allowedDevOrigins: ['127.0.0.1']` in `next.config.ts`. Mutation-checked by
removing it and restarting — the chunk request with `Origin: http://127.0.0.1:3001` goes
403 without it and 200 with it, while a genuinely foreign origin is still refused. The
admin UI renders fully at `127.0.0.1:3001` with no console errors.

#### Follow-on for Pipeline Manager — the other half of the seam

**`apps/pipeline` still authenticates with a login and should switch to the key.**
Nothing is broken until it does; this is the half of the seam the WP15.2 handoff assigned
to the Pipeline session.

- `cms/client.py` `_authenticate()` posts to `/api/admins/login` and sends
  `Authorization: JWT <token>`. The key replaces both: send
  `Authorization: admins API-Key <key>` on every request and delete the login round trip.
- Config moves from `ZOOMOUT_PIPELINE_PAYLOAD_EMAIL` / `_PASSWORD` to a single
  `ZOOMOUT_PIPELINE_PAYLOAD_API_KEY`. The founder has the key; it is not in the repo.
- **Keep `_assert_draft`.** It is no longer the only thing standing between the pipeline
  and a publish, but a clear error at the call site still beats a 403 from the server.
- Creates need no change — `POST /api/tracks` with `_status: "draft"` and no query
  parameter is accepted as-is, which is why create was deliberately not made to require
  the `draft` flag.
- **If an update method is ever added, it must send `?draft=true`** or it will be refused.
- Once the switch lands, `pipeline@zoomout.local` can be deleted.

#### One thing left for Architect to rule on

**A machine account can still delete content.** Scoping covered publishing, as the
handoff specified; `delete` access was left alone rather than widened without a ruling. A
credential that cannot publish but can delete a published Track is a smaller hole than
the one just closed — the previous login could do both — but it is not nothing, and
closing it is two lines in the same file.


### Completed: WP17 (second half) — the Payload boundary — 2026-08-27

**All acceptance criteria met.** A Track of *The Science of Getting Rich* is in Payload as
**18 draft Leaves with 201 source references**, and the mandatory round-trip passes against
real Payload.

**The headline is not the boundary code. It is that Payload rejected content my own
grounding gate had passed** — and it was right to. Detail below; it is the most important
thing in this package.

#### What landed

| | |
|---|---|
| Track 42 | `draft`, `acquisition: public-domain`, `isPlaceholder: false`, 18 Leaves |
| Leaves | orders 0–17, all `draft`, none published |
| Source references | 201, **0 missing a note or a locator** |
| DTK without a takeaway reference | **0** |

`cms/client.py` is a deliberately small REST client — create, find, read. It has **no publish
method at all**, and refuses any payload whose `_status` is not `draft` *before* the request
is made. The boundary test that WP16 wrote as "no HTTP anywhere" was tightened rather than
deleted: HTTP now lives in `cms/client.py` and is asserted to live nowhere else.

**The draft Track deliberately omits `publisher`, `coverUrl`, `purchaseLinks` and
`disclaimer`.** Payload relaxes required fields on drafts precisely so an incomplete record
can exist, and the pipeline cannot know a retailer link or a cover image — inventing them
would be fabrication of a different kind. A human supplies them at the publish gate, which is
where the purchase-forward and non-endorsement requirements are actually enforced.

#### The defect Payload caught, which grounding could not

`POST /api/leaves` failed on Leaf 11 with *"Dinner Table Knowledge must be traceable to the
book. Add a Source Reference with slide 'takeaway'."* But `ground_check` **had** verified a
sourced takeaway claim. Both were correct; the corruption happened between them.

Passage handles (`P1`…`P12`) are positional over the *retrieved* list. `GeneratedLeafRecord`
stored only `cited_chunk_ids` — a **sorted set** of the ids actually cited. Rebuilding handles
from that subset renumbers them. Leaf 11 cited P1, P2, P3, P4, **P7, P9**; the rebuild
produced P1…P6. So:

- **P7 and P9 resolved to nothing** — two references silently dropped, including the takeaway
  one the Dinner Table fact depended on. *This* is what Payload caught.
- **P5 and P6 pointed at different chunks than the model cited** — references carrying the
  wrong chapter. **Nothing was catching this**, and it is precisely the mis-attribution
  `LEGAL.md` exists to prevent: a citation naming the wrong chapter is worse than no citation,
  because it looks checkable.

Fixed by storing `passage_refs: dict[str, int]` on the record at the moment the handles are
still the ones the model saw. Mutation-checked by restoring positional resolution: exactly
the two tests named for it go red, nothing else.

**The lesson worth carrying:** the CMS being an independent gate is not ceremony. Two
enforcements of the same rule, written from different understandings, and the second caught a
bug in the first's downstream. Had the pipeline owned both, this ships.

#### Three more defects, all found by running it rather than by testing it

**1. Unit tests were writing to the real CMS.** The moment `write_drafts_to_cms` joined the
graph, a resume test ran to completion and created a 22-Leaf "A Test Book" Track in Payload —
twice, because `test_durability` builds its dependencies in a **subprocess** where the conftest
fixture does not reach. Nothing was wrong with the node; nothing stopped the test calling it.
The CMS client is now injected through `NodeDependencies` and tests supply a stub that records
instead of writing. Verified by counting CMS rows before and after a full suite run.

**2. A graph whose shape changes cannot reach threads that already finished.** The run had
reached `END` before the CMS node existed, so `resume` did nothing and reported success. Added
`write-drafts --run-id`, a deliberate invocation of the same node, mirroring `purge-raw-text`.
**WP19 will hit this again** when it adds gate 2 and the revise loop to runs that already exist.

**3. An interrupted write duplicated nothing only by luck.** The node returns its record of
what it wrote *on success*, so a write that died at Leaf 11 of 18 left eleven Leaves that state
knew nothing about — a retry would have created eleven more. Idempotency is now asked of the
CMS (`find_leaf` by track and order) rather than of local memory, which cannot go stale the
same way.

#### An environment trap worth recording

The admin UI rendered **blank** at `127.0.0.1:3001` — no error on screen. Next 16's dev server
rejects `/_next/*` requests carrying an `Origin` it does not allow, and its allowlist covers
`localhost` but not the IP form. Payload loads its chunks `crossorigin`, so the app was
**403-ing exactly one of its own JavaScript chunks**, which was enough to stop React mounting.
Reproduced precisely: identical request with `Referer` → 200, with `Origin` → 403.

`localhost:3001` works with no change. The real fix is `allowedDevOrigins` in
`apps/admin/next.config` — **Manager's**, and worth doing because the failure presents as a
blank page with nothing to diagnose from.

The pipeline's `payload_url` now defaults to `localhost` so it never inherits the same trap.

#### Read it yourself

Read Leaf 6 back **through the CMS**, as the admin renders it. It holds up. The scenario is a
real dilemma — two months into consulting, no clients, balance dropping — and the wrong options
are built from the material rather than strawmanned: one is "focus on the shortfall and budget
carefully", which is what a sensible person does and is wrong by the book's logic. The Dinner
Table fact (Wattles dismissing scheduled prayer and "occult stunts") is a genuine deep cut, and
13 references carry real chapter locators.

**But this Track is a demonstration of the boundary, not launch content.** It was generated
before WP17's shuffle fix, and both tells are measurably present in what is now in Payload:
the correct option sits in position 2 in **15 of 18** Leaves and never in position 3, and it is
also the longest option in **15 of 18**. A reader could score 83% without reading. It needs
regenerating once WP19's editorial reviewer exists.

#### Deferred, named

- **Cleanup.** Fixture and mistake Tracks are sitting in the CMS as drafts: 30, 31, 37, 38, 39
  (partial, with the wrong references), 40, 41. All `draft`, so invisible to readers. I did not
  delete them — deletion is irreversible and not mine to decide.
- **API keys instead of a password.** `Admins` has `auth: true` and no `useAPIKey`, so the
  pipeline holds a login. An API key would be revocable per integration with no password in the
  environment. `apps/admin` work.
- **Least privilege still does not exist.** `pipeline@zoomout.local` was created as a dedicated
  account, which buys attribution and revocability — but with no roles in Payload it can publish
  exactly like a human can. The pipeline's never-publish guarantee is enforced entirely on the
  pipeline's side. Same gap WP19 needs closed.
- **`page` locators.** References carry `chapter` and `quote`; EPUBs have no page numbers, so
  `page` is never populated. Honest rather than missing.


### Completed: WP17 — Leaf generation and grounding (CMS half blocked) — 2026-08-27

**Generation and the grounding gate are done and verified against a real book. The Payload
writer is not built — it is blocked exactly as the handoff anticipated.**

A full Track of *The Science of Getting Rich*: **18 of 18 Leaves generated and grounded on
the first attempt, zero escalations, 310,736 tokens.**

#### The grounding gate

Mechanical, pass/fail, and separate from anything editorial. It works because the model is
shown a numbered set of retrieved passages and may cite **only** those handles, which turns
three questions into matters of fact rather than judgement:

- a citation naming a handle that was never retrieved is an **invention**, not a mistake;
- a `quote` must appear **verbatim** in the passage it cites — typographic noise (curly
  quotes, dashes, wrapping) is normalised, words are not;
- every claim carries a citation, and Dinner Table Knowledge requires a sourced claim on the
  takeaway slide — a third independent enforcement alongside the shared schema and Payload.

A failing Leaf is redrafted **with the findings attached**, capped at `MAX_LEAF_ATTEMPTS`,
then escalated. It is never emitted with a warning.

Both Tier A criteria are mutation-checked. Neutering the "citation must resolve" rule turns
**2** tests red, both about invented citations; removing the DTK rule turns exactly **1**
red. Nothing else moves in either case.

**Retrieval is confined to the chapters a Leaf's plan declared**, so a Leaf cannot cite a
chapter its own plan never claimed. That keeps the approved plan load-bearing rather than
decorative — gate 1 decides what a Leaf may draw on, not merely what it is called.

Passages a Leaf cites are marked `is_cited`, which is what makes `purge-raw-text` safe: they
survive as the audit trail proving the claim after the book is deleted (R6). Across the
Track, **79 of 136 chunks** were cited.

#### Two defects the read-it-yourself gate found, which no test would have

**1. The scenario gate was answerable without reading. Fixed.**

Across 18 Leaves the correct option landed in position **B in 15 of them, and in C never**.
"Always pick B" scored 83%. `PRODUCT.md` calls active recall the entire product thesis, and
it was decorative.

Fixed mechanically rather than by argument with a prompt: options are now shuffled with a
seed derived from the run id and Leaf order, so it is deterministic — a regenerated Leaf
shuffles identically and diffs stay meaningful.

**2. The correct option is the longest in 15 of 18. Not fixed — flagged.**

Chance is about 6. A reader who always picks the longest option scores 83% without
understanding anything, which is the same failure by a different route. The prompt already
says not to signal the answer through length and the model ignored it.

I have **not** attempted a mechanical fix. Length is an editorial property, not a legal one,
and rejecting on it would spend grounding revisions on style. **This is the strongest
argument yet for WP19's editorial reviewer**, and I would give it this as its first concrete
job rather than inventing a check here.

**Note:** the measured Track predates the shuffle, so those 18 Leaves still carry the
position bias. The fix is verified by test and applies to every future run; regenerating
this Track is a 25-minute rerun whenever it is wanted.

#### A defect found by running it, not by testing it

**A model call hung for 83 minutes and looked exactly like progress.** The SDK defaults to
no request timeout at all, so one wedged HTTP call held the Track run indefinitely while the
process stayed alive and the log simply stopped.

For a batch pipeline whose runs span days across human gates, that is the difference between
slow and silently dead. There is now a `request_timeout_seconds` setting (default 180), and
timeouts join rate limits as **retryable** — a 404 will still be a 404 in five seconds, a
timeout might not be.

`resume` also gained a distinction it should always have had: **answering a human gate and
continuing a run that was killed mid-node are different continuations.** Sending a resume
value to the second does nothing, which looks exactly like a run that will not restart.
Found when the real Track was killed at Leaf 1.

#### Read it yourself

I read Leaf 6, *"Hold unwavering belief without waiting for visible proof"*, as a reader.

**It is good.** The scenario is concrete and genuinely uncomfortable — two months into
consulting, no clients, balance dropping. The wrong options are the strong part: one is
*focus on the shortfall and budget carefully*, which is what a sensible person would do and
is wrong by the book's logic; the other schedules a prayer hour and then worries the rest of
the day, which the payoff specifically dismantles. That is a distractor built from the
material rather than a strawman.

The Dinner Table fact earns its name: Wattles explicitly dismissing concentration exercises,
scheduled prayer and "occult stunts" is genuinely surprising for a New Thought book, and it
is the kind of thing a person repeats. Apply-in-life is a real action with a time attached.

**The prose is flat in places** — "realizing a vision requires taking a mental attitude of
immediate present ownership" is stiff in a way a human editor would fix. Another job for
WP19.

**One product question that is not mine to settle.** The Leaf teaches Wattles' 1910
metaphysics *sincerely* — "impress your purpose upon the formless substance" is presented as
operative. That is exactly what the prompt instructs, and correctly so: quietly modernising
an author's claims is its own form of putting words in their mouth. But it means ZoomOut will
ship pseudoscience in the author's voice. The non-endorsement disclaimer covers the legal
position; whether it covers the **editorial** one is a founder call, and it will recur with
every book in this genre. Flagging it now rather than at launch.

#### Blocked: the CMS writer

**Payload's Track collection has no `acquisition` field.** WP15.1 was handed to Manager on
2026-08-26 and has not landed. Per the handoff I stopped rather than working around it.

Creating a Track in Payload without an acquisition status is precisely the record R6 says
must never exist — the entire point of recording it is that "which Tracks must be
regenerated when the source question resolves" stays a query rather than an act of memory.

So this remains unbuilt and unverified: the REST client, the draft write, the
`acquisition` write, the never-publishes assertion **against real Payload**, and the
maximal-fixture round-trip. That last one is not optional when it comes: WP15 shipped a
mapper that silently dropped three optional fields with 932 tests green, and source
references are optional fields.

**Payload also was not running** on this machine, so even the round-trip harness could not
have been exercised today.

#### Cost — one full Track

**310,736 tokens.** Reported as $0.0001 with `gemini-3.6-flash` listed unpriced; the 3.x
rates remain unverified and naming the model beats inventing a number. Ingest was reused, so
this excludes the one-off embedding of the book.

Roughly 17,000 tokens per Leaf across `draft_leaf` and `extra_content`, plus one embedding
per Leaf for retrieval. At Flash rates this is small; the number that will matter is WP18's
images, which are per-Leaf and priced per image.

#### Deferred, and named

- **Everything CMS-side** (above).
- **A semantic entailment check.** Grounding proves a claim is *anchored* to a real passage,
  not that the passage *argues* for it. A model could cite a genuine but irrelevant passage
  and pass. Closing that needs an LLM judge, which is a different instrument — and it should
  not be folded into the mechanical gate, because the value of that gate is that it cannot
  be argued with.
- **Sticky notes cluster at 3–4** of an allowed 2–6. Not wrong, just unexplored.
- **One book.** Every measurement is Wattles.
- **The length tell** (above) — WP19.


### Completed: WP16.1 — The breakdown prompt, and the model question answered properly — 2026-08-26

**All acceptance criteria met.** The prompt rewrite worked, decisively. The model question
now has an answer, and **it is not the answer WP16 reported** — see the correction below.

#### The headline

| | Old prompt (WP16) | New prompt (WP16.1) |
|---|---|---|
| Samples | 3, one per config | 8, four per model |
| Structure check pass rate | 1 of 3 | **8 of 8** |
| Single-chapter ratio | 0.24 / 0.78 / 0.89 | **0.00–0.17** (limit 0.75) |
| Leaves drawing on 2+ chapters | ~11–76% | **100%** in the end-to-end run |
| Leaf titles reusing a chapter title | 10 of 18 (Pro) | **0 of 18** |

The measured ratios moved from straddling the legal threshold to sitting four to nineteen
times below it. **Thresholds were not touched** — `MAX_SINGLE_CHAPTER_LEAF_RATIO`,
`MAX_SEQUENTIAL_PAIR_RATIO` and `CHAPTER_COUNT_PARITY_BAND` are byte-for-byte unchanged, as
the handoff required.

#### What changed in the prompt

The old prompt described the task ("design a course") and then listed the structure
requirement as one rule among several. The rewrite makes the requirement **the task**: the
opening line says the job is not to divide the book into lessons, because dividing it
produces its table of contents, and that output is rejected.

Three additions did the work:

- **A procedural method.** List the *ideas*, find every place the book develops each one,
  order by dependency, split and drop, and only then write titles. The old prompt asked for
  an outcome; this one gives a route to it.
- **A worked example from a fictional book** (*The Patient Gardener*), showing a rejected
  plan and an accepted one side by side with the reasoning per Leaf. Fictional so nothing
  leaks into the book under measurement, as the handoff required.
- **A self-check before answering** — count your single-chapter Leaves, check whether your
  chapter numbers ascend. Models comply with an explicit verification step far better than
  with an instruction not to do something.

#### A defect I introduced, and the harness caught

The first measurement run scored **0 of 6** — every sample failed to parse with "Leaf order
must be contiguous from 0". The cause was mine: the worked example's tables numbered rows
from 1, and the model copied that numbering. The old prompt had no numbered example and so
never provoked it.

Worth recording because it is the entire argument for measuring: **a prompt change that
looked like a clear improvement was, for one iteration, a 100% failure rate.** Reading it
would not have revealed that. The fix was to make every index in the example 0-based and say
so explicitly.

#### The model comparison, done properly

**Design.** One analysis, taken from `wattles-05` and reused for every sample of both models
— `analyze` is not the variable and letting each configuration produce its own would
confound the nodes. Sampled the **first breakdown attempt only**, no revision loop: the loop
is a correction mechanism, and measuring after it conflates prompt quality with loop rescue.

| Model | n | 429 | parse fail | pass | single-chapter mean (min–max, sd) | sequential mean (min–max, sd) | Leaves |
|---|---|---|---|---|---|---|---|
| `gemini-3.6-flash` | 4 | 0 | 0 | **100%** | 0.04 (0.00–0.11, sd 0.053) | 0.62 (0.53–0.72, sd 0.082) | 18.2 |
| `gemini-3.1-pro-preview` | 4 | 0 | 0 | **100%** | 0.06 (0.00–0.17, sd 0.079) | 0.72 (0.65–0.82, sd 0.088) | 18.0 |

**Conclusion: on the tuned prompt the two models are indistinguishable.** The single-chapter
difference is 0.02 against standard deviations of 0.05 and 0.08 — comfortably inside the
noise. Pro runs about 0.10 higher on the sequential ratio, which would mean it follows the
book's order slightly more, but the ranges overlap heavily and n=4 cannot establish it.

**Recommendation: Flash.** Not because it is better — because it is indistinguishable while
using roughly 20% fewer tokens and running two to three times faster. There is no measured
quality reason to pay for Pro at this node.

#### Correcting WP16

WP16's addendum concluded that **"Pro is worse, not better"** and that a stronger model
follows the source structure more faithfully. **That conclusion is not supported and should
not be carried forward.** Architect was right in the handoff: the spread within one model
was five times the gap between models, and every cell was n=1.

What actually happened is that the old prompt was so weak that outcomes were close to
random, and three samples from a wide distribution produced an ordering that looked like a
finding. The striking observation underneath it — Pro reusing ten chapter titles verbatim —
was real, but it was one draw, not a property of the model.

**The directional claim survives; the mechanism does not.** The prompt was the lever, which
is why fixing it moved every configuration to a 100% pass rate. "Capability is anti-helpful
here" was a story fitted to noise.

#### A regression found along the way

`generate_structured` had no rate-limit retry at all, and — worse — **the retry loop in
`embed` had been silently deleted** by one of WP16's own Vertex refactors. Every test still
passed, because they exercised `RateLimiter` directly and never checked that the client used
it. Testing a unit and not its wiring is exactly how a regression ships green.

Both call sites now share **one** `_call_with_retry`, and `tests/test_client_retry.py`
asserts the wiring: that a 429 is retried and paced, that a persistent one becomes a typed
`LLMTransportError`, that a 404 is *not* retried, and that embedding is paced per text rather
than per call.

The new `LLMTransportError` also fixed a measurement bug: the harness was counting rate
limits as parse failures, which dragged the reported pass rate down by two samples in the
first valid run. A 429 says nothing about a prompt.

#### The cap

`MAX_BREAKDOWN_ATTEMPTS` is **5**, per the ruling. The cap still terminates, still escalates
to the human gate, and both WP16 tests still assert it. Worth noting the new prompt makes it
largely academic — the end-to-end run passed on **attempt 1**.

#### Read it yourself

**It reads like a course.** Eighteen Leaves, every one drawing on two or more chapters, no
title reusing a chapter heading. The arc is coherent: why wealth matters, then that it is
learnable, then create-don't-compete, then the mental practice, then action, then career,
then consolidation. Titles are teaching statements — "Give every person more in usefulness
than you take in cash", "Starve negative concepts by refusing to study poverty" — rather than
chapter names.

**Two honest reservations.**

The middle sags. Leaves 9, 10 and 15 (*combine action with vision*, *make every action
efficient*, *fulfil your current role beyond its requirements*) are three shades of the same
instruction, and 12 and 13 are both about choosing and changing occupation. Some of that is
Wattles, who repeats heavily — but a good editor would merge at least one pair.

**The opening Leaf is still the book's most abstract claim**, not something a learner can act
on. My own prompt's step 3 warns against exactly this, so the ordering guidance is only
partly landing. The legal problem is solved; the pedagogical ordering is better but not yet
right, and it is the obvious next thing to tune.

#### Cost

Eight samples plus one end-to-end run: 26,150 tokens on Flash and 32,987 on Pro for the
measurement, plus 34,568 for the run. Reported as $0.00 with the models listed unpriced —
the 3.x rates remain unverified and naming the model beats inventing a number. Everything
ran against the trial credit.

#### Deferred

- More samples. n=4 per model meets the bar and settles the practical question; it does not
  establish the small sequential-ratio difference either way.
- Only one book. Every measurement here is *The Science of Getting Rich*, whose heavy
  repetition may flatter a prompt built around synthesising across chapters. A second book
  would test that.


### Note for WP18 — asset generation: founder rulings and the style problem — 2026-08-26

Recorded by the Pipeline Manager during WP16, from a founder conversation about the two
asset fields WP15 added. **Not a completion report** — WP18 has not started. Written here so
the rulings are not lost between sessions, and because two of them constrain the design more
than they look.

#### What the schema already forces

`imageAssetSchema` requires `url` **and** `alt`; `diagramAssetSchema` adds optional `spec` +
`specFormat` (`mermaid` | `json`). Because `url` is required on both, **a diagram cannot be a
spec the app draws at runtime** — WP18 must render it server-side to an image and store the
spec beside it for re-rendering. That is the bulk of the diagram work.

#### Founder rulings, 2026-08-26

| Question | Ruling |
|---|---|
| Ship scenario images, or defer them as §4a suggested? | **Ship them.** "We need to give as real an experience as possible." This overrides the Pipeline Manager's recommendation to defer; recorded as a deliberate choice to carry the only per-Leaf recurring cost in the pipeline |
| Content guardrail on generated illustrations | **Apply it** |
| Where `alt` comes from | Delegated to the Pipeline Manager |
| Visual consistency | **New requirement, founder-initiated** — see below |

#### The guardrail, as it should be implemented

Generated illustrations must never depict **the author, any real person, or anything
resembling the book's cover, title treatment or branding**. A scenario illustration is
fiction and carries no zero-fabrication risk in itself — but an image implying the author
endorses ZoomOut walks directly into the non-endorsement problem `LEGAL.md` is built around,
and does so in the most shareable medium in the product.

Two implementation notes. It belongs **in the asset prompt as a hard constraint and in a
check**, the same reasoning that made the 1:1 structure requirement a measurement rather than
a prompt line. And **no rendered text inside images at all** — image models render text
unreliably, WP9 established that legibility beats fidelity, and any text in an illustration
is untranslatable and unfixable without regenerating.

#### `alt` — decided by the Pipeline Manager

**For diagrams: generated deterministically from the JSON spec.** We own the renderer, so we
know exactly what is in the picture — nodes, edges, labels, order. A description derived from
the structure is accurate by construction, costs nothing, and cannot hallucinate. This is a
concrete argument for the JSON spec format over Mermaid that R4 did not anticipate.

**For scenario images: written by the same LLM call that writes the image prompt, describing
what was asked for — not what came back.** Rationale: an image model cannot reliably report
what it drew, and a second vision call to caption the result costs money and can invent
detail. The prompt is the ground truth of intent, and the human at gate 2 sees the image and
its `alt` side by side and can correct it — which is the real check, in a system that is
human-in-the-loop by design.

Two rules for the text itself: describe **the scene**, not the medium ("a commuter checking
a phone on a crowded train", never "an illustration of…"), and **do not restate the scenario
prompt**, which a screen reader has already read out.

#### Visual consistency — the founder's requirement, and how to actually get it

> "It should not be the case that every next image is very different. An app should have the
> same themed illustrations being followed… instead of AI slop."

This is the hardest part of WP18 and it will not be achieved by asking nicely in a prompt.
Five mechanisms, in descending order of how much they actually buy:

1. **Reference-image conditioning — the strongest lever by far.** The Gemini image models
   accept image input. Keep a small set of committed **style anchors** in the repository and
   pass them with every generation call. Text alone does not hold a look together across
   twenty different subjects; anchors do.
2. **A version-controlled style contract** (`prompts/asset_style.md`), appended to every image
   prompt: medium, palette, lighting, composition, how people are treated. Same reasoning as
   every other prompt in this service — it is the logic and it needs diffs.
3. **A fixed seed per Track.** Buys reproducibility rather than cross-subject consistency, but
   makes regeneration deterministic, which matters when debugging why one Leaf looks wrong.
4. **A mechanical consistency check, advisory rather than blocking.** Compare each candidate's
   dominant-colour histogram against the anchors and **order the candidates by closeness**
   rather than rejecting outliers. This project is already comfortable with mechanical checks;
   this one should inform the human, not overrule them — taste is the one thing gate 2 exists
   for.
5. **The human picks from N candidates at gate 2** (R5). The final gate, and the only one that
   can judge whether a picture is any good.

**The style contract must derive from `design-direction.md`, not be invented.** Surfaces
`#0B0F12`–`#1C242A`, teal `#3DDCC8` as the accent, depth from surface lightness rather than
shadow (§2). **Amber `#FFB020` must not appear in illustrations** — §3 reserves it for reward
moments exclusively, and an illustration using it would compete with the XP and streak
language for the same attention.

**There is a bootstrapping step, and it is a human one.** The first Track has no anchors. The
sequence is: generate a spread of candidates for two or three Leaves, the founder picks the
images that define the look, those become the committed anchor set, and everything afterwards
is conditioned on them. That single act sets the product's visual identity, so it should be
treated as a design decision rather than a pipeline run.

**Keep the anchors versioned and swappable.** §9 reserves a mascot slot for later; if a mascot
ever lands, a swappable anchor set makes that a re-render rather than a redesign — the same
logic §9 already applies to four screens.

#### Available models, verified 2026-08-26

On the Vertex `global` endpoint: `gemini-3-pro-image`, `gemini-3.1-flash-image` (plus preview
and lite variants). **No Imagen models are served at `global`** — Imagen would require a
regional endpoint and therefore a deliberate data-residency decision.

Images are **the only per-Leaf recurring cost in the pipeline**, so this is the number that
decides whether the library can grow. Diagrams, being a text call producing a spec, are
effectively free — R4's cost argument survives intact.

#### Sequencing

WP18 needs Payload's media collection to store what it renders, and **the Payload boundary
does not open until WP17**. Assets cannot land before then regardless.


### Addendum: WP16 — Vertex AI, and the Pro-vs-Flash experiment — 2026-08-26

Run after the WP16 completion report above, at the founder's request. Two questions:
should the pipeline use Vertex rather than the AI Studio Developer API, and should the
reasoning nodes use a Pro model. **The answers are yes and no**, and the second one is the
more useful finding.

#### Vertex is now supported and is the right target

`§4` specified Vertex from the start; WP16 was built against the Developer API because
`§4a`'s free-tier analysis pointed there. Two things have since changed that argument:

- **Google excluded the Developer API from the $300 Cloud credit in March 2026.** Credit
  pays for Vertex; it explicitly cannot pay for "Gemini API in AI Studio". Verified against
  Google's own documentation, not a blog.
- **Vertex does not use submitted prompts to improve Google's models.** That is the single
  constraint confining development to public-domain books, so Vertex is what makes real
  books possible at all.

Implemented as configuration, not a rewrite: `use_vertex` + `vertex_project` select
`genai.Client(vertexai=True, ...)`, credentials come from Application Default Credentials,
and **no key touches disk** — which also closes the credential-handling hole recorded above.
Settings refuse a half-configured backend at construction rather than on the first billed
call.

**One trap worth recording: the Vertex location must be `global`, not a region.**
`models.list()` reports the Gemini 3.x models everywhere, but `us-central1`, `us-east5` and
`europe-west4` all 404 on `gemini-3.6-flash` and `gemini-3.1-pro-preview`. Only the global
endpoint serves them. A regional endpoint is a data-residency decision to take deliberately;
inheriting one as a default silently costs the entire 3.x line.

Credit confirmed before any Vertex call was made: **₹28,710 (~$300), 100% remaining,
expiring ~17 September 2026**. That 22-day window is a real constraint on WP17–WP19.

#### The experiment: Pro is not better here, it is worse

Same book, same prompt, same checkpointed analysis. Three runs:

| Run | Model | Single-chapter Leaves | Follows book order | Structure check |
|---|---|---|---|---|
| AI Studio | `gemini-3.6-flash` | 24% | 81% | **PASS** |
| Vertex | `gemini-3.6-flash` | 78% | 100% | **FAIL** |
| Vertex | `gemini-3.1-pro-preview` | **89%** | 88% | **FAIL** |

**The Pro model produced the most chapter-mirroring plan of the three.** 18 Leaves against
18 chapters, and **10 of its 18 Leaf titles substantially reuse a chapter title** — several
verbatim: "The Right to be Rich", "Thinking in the Certain Way", "Acting in the Certain
Way", "Efficient Action", "The Impression of Increase".

That is exactly what `LEGAL.md` forbids, produced by the strongest model available.

**The interpretation, which is worth more than the numbers.** A stronger model follows the
source's structure *more* faithfully — and this requirement demands departure from it. The
task is adversarial to the instinct a better model has. So model capability is not the lever
here; the prompt is. Two consequences:

1. **Do not spend on Pro for `breakdown`.** It costs more and performs worse at the one
   thing that matters. Revisit only after the prompt is doing its job.
2. **The variance across identical configurations is the real signal.** The same model and
   prompt scored 24% and 78% on consecutive runs. The prompt is not steering the outcome —
   it is influencing a distribution whose spread straddles the legal threshold. The passing
   AI Studio run recorded in the completion report above was, in part, luck.

**`breakdown.md` is now the highest-value file in this package.** It needs the
original-structure requirement moved from a bullet among several into the primary framing of
the task, and probably a worked example of a synthesised Leaf. That is WP17's first job and
it costs nothing to iterate.

#### What this says about the structure check

The check earned its place today. It caught a genuine table-of-contents plan from a
production model on a real book, twice, and refused to pass it — including from the model we
were about to upgrade to on the assumption it would be better.

**Its thresholds are also now better evidenced.** The completion report above flagged
discomfort that the passing run scored 81% sequential against an 85% limit. With three data
points the picture is different: the failures scored 88% and 100%, well clear of the limit,
and the single-chapter signal separated them cleanly (24% pass versus 78% and 89% fail). The
thresholds are discriminating between real plans, not just synthetic ones. **No change
recommended.**

#### One defect the experiment exposed

The first Vertex run died instead of escalating. Attempt 2 produced a valid but
chapter-mirroring plan; attempt 3 returned unparseable JSON; the cap was reached and the node
raised — **discarding the attempt-2 plan a human could have edited into shape**.

Escalation now prefers the last valid plan: if any attempt produced one, the run stops at
gate 1 with that plan and the failure attached, and only raises when nothing valid was ever
produced. A plan that fails the structure check is still a plan a human can work with;
throwing it away costs the whole run for nothing. Regression test named for the incident.

#### Cost

Both full runs reported **$0.00** with the model listed as unpriced — the 3.x rates were
never verified, and naming the model beats inventing a number. The real figures: `wattles-05`
32,419 tokens, `vertex-pro` 35,355 tokens. Ingest was reused in both, so neither re-embedded
the book. Actual spend against the trial credit is immaterial at this volume; the credit's
**expiry date matters far more than its balance**.


### Completed: WP16 — Pipeline skeleton: ingest, analyze, breakdown, human gate 1 — 2026-08-26

First package of `apps/pipeline`, by the Pipeline Manager session. Branch
`wp16-pipeline-skeleton`. **11 of 12 acceptance criteria verified; the twelfth — the
read-it-yourself quality judgement — is done and the answer is qualified. See "Is the plan
any good?" below, which is the part worth reading if you read nothing else.**

A run against *The Science of Getting Rich* (Gutenberg #59844, Wattles 1910, public domain)
goes ingest → analyze → breakdown → gate 1, writes a plan of 17 Leaves, survives being
killed, and resumes from a hand-edited file. Total cost of the successful run: **32,419
tokens, $0.00** on the free tier.

#### The proposal's §4a is out of date, and this is the most transferable finding

§4a was verified against pricing pages on 2026-08-13. Checked against a live API key on
2026-08-26, four of its assumptions are now wrong. None of this was discoverable by reading
documentation — every one of them surfaced as a failed run.

| §4a said | Actually |
|---|---|
| "The free tier includes Pro-tier models" | **Every Pro model reports `limit: 0`** for free-tier requests. Pro is paid-only |
| `gemini-2.5-pro` costed at $1.25/$10.00 | **Closed to new API keys.** 404s with a pointer to the 3.x line. `gemini-2.5-flash` too |
| `text-embedding-004` as the embedding model | **Retired.** 404s. The current family is `gemini-embedding-001` |
| "Rate limits… unlikely to bind" | **They bind at ingest.** The embed endpoint counts each *text* as a request against 100/minute; one 22,000-word book is ~140 |

**What this changes:** the free tier still covers WP16–WP19 as §4a concluded, but only on
the **Flash** line. Anything wanting Pro-tier reasoning costs money from now on, not just
the cross-family editorial reviewer in R3. The defaults are now `gemini-3.6-flash` for
analyze and breakdown; model choice is config, so a paid Pro model is one env var away when
output quality justifies it.

`gemini-embedding-001` is natively 3072-wide and is truncated to 768 to match the schema,
**then re-normalised** — Matryoshka truncation leaves a vector off the unit sphere, and
pgvector's cosine distance assumes unit length. Skipping that degrades retrieval silently,
which is the worst way for a grounding pipeline to be wrong.

#### The 1:1 chapter-structure check — thresholds, and what the real plan scored

Two signals, either one fails the plan. Both are named constants in
`graph/structure_check.py` with the reasoning inline.

| Signal | Threshold | Reasoning |
|---|---|---|
| Leaves drawing on exactly one chapter | **> 75%** | The plan is slicing the book, not teaching across it. Not tighter, because genuinely atomic concepts do live in one chapter |
| Follows the book's order **and** ~one Leaf per chapter | **> 85% of steps**, with leaf count within **±15%** of chapter count | Either alone is defensible — a 30-Leaf sequential plan over 17 chapters is not a 1:1 reproduction. Together they are the table of contents |

**Thresholds lean strict deliberately.** A false positive costs one bounded revision round
and, at the cap, a human decision. A false negative is a legal exposure that reaches
readers. Those are not comparable costs.

Mutation-checked as the handoff asked: neutering the single-chapter threshold turns 2 tests
red, both in `test_structure_check.py`. Making `check_structure` never reject turns **7**
red across 3 files — the check's own tests plus the revision cap, the feedback loop, the
gate refusal and the plan-file header. Nothing outside the structure surface moves.

**The real plan scored 24% single-chapter and 81% sequential, against limits of 75% and
85%.** It passed. The ordering number is uncomfortably close to its limit, and my own
reading of the plan (below) agrees with that discomfort — the plan *is* substantially in the
book's order. **This is worth an Architect eye**: either 85% is slightly loose, or — more
likely — sequential-ratio is the wrong instrument for "did this get ordered by what a
learner needs", and that judgement belongs to gate 1 rather than to a mechanical check.
I did not change the threshold on the strength of one book.

#### Is the plan any good? — the read-it-yourself gate

**Answer: it is a decent scaffold and not yet a course. It is clearly not a table of
contents with the numbers filed off, but it is not what WP20 should ship either.**

What is genuinely good:

- **The concepts are crisp and each Leaf teaches one thing.** "Every business transaction
  must deliver more in practical use value to the buyer than the monetary cash value
  received" is a real, teachable, testable idea — you can write a scenario for it.
- **It is grounded in Wattles**, not in generic modern self-help. Nothing was imported from
  the standard treatment of the topic, which was an explicit prompt instruction and the
  thing most likely to go wrong.
- **The synthesis is real in about two-thirds of it.** "Creation Over Competition" draws on
  chapters 3, 5 and 6; "Leveraging the Law of Universal Growth" connects chapter 5's
  *Increasing Life* with chapter 14's *Impression of Increase*. Those are links the book
  spreads out and a teacher would pull together.

What is wrong with it:

- **The order is the book's order, lightly shuffled — not a dependency order.** The clearest
  symptom: "Formless Substance and Human Thought", the metaphysical claim the whole book
  rests on, lands at position 5, *after* four Leaves that only make sense if you already
  accept it. A course would open there.
- **Two pairs are near-duplicates.** Leaves 10 and 11 both teach acting fully on today's
  work (chapters 11–12 and 12). Leaves 12 and 13 both teach the impression of increase
  (both cite chapter 14).
- **17 Leaves against 18 sections is too close to one-per-chapter** to feel like a
  restructure, even though the sourcing underneath it genuinely is one.

**My read on why:** this is a free-tier Flash model doing a job §4a assumed a Pro model
would do, against a first draft of a prompt nobody has tuned. Both are WP17 problems and
both are cheap to fix — the prompt is a file, the model is an env var. I would not conclude
anything about the architecture from this output.

#### Three defects that only running it could find

All three were found by checking effect rather than exit code, and all three now have
regression tests.

1. **A half-embedded book read as fully ingested.** `ingest` reused any book with "more than
   zero chunks". A run that died partway through embedding left 64 of 136 chunks; the next
   run declared the book ingested and moved on. Nothing failed, nothing logged. **WP17 would
   have grounded against half a book with no signal.** Now reuse requires the stored chunk
   count to match what the parser produces.
2. **The node-level skip trusted a stale checkpoint.** Same shape one layer up: `ingest` also
   short-circuited on `state.chunk_count > 0`, which a checkpoint can hold from a dead run.
   Removed entirely — `ingest_book` compares the database against the parsed file, which is
   the only answer that cannot go stale, and re-parsing locally costs nothing.
3. **A malformed plan killed the run instead of being revised.** Breakdown returned 10 Leaves
   against the 15–30 range; the schema correctly rejected it and the run died. Now a
   validation failure is a bounded retry carrying the failure text as feedback — a model
   asked again with no explanation produces the same output. Same cap as the structure
   check; past it, the run stops with a clear message rather than looping.

#### Decisions taken, with reasoning

- **The book's text is deliberately kept out of graph state.** State is checkpointed to
  Postgres, so text placed there is copied into the checkpoint tables — where
  `purge_raw_text` cannot reach it, and where it would survive exactly the deletion R6
  requires. Nodes read it from the repository by `book_id` and let it go.
- **The gate writes its plan file only when absent.** LangGraph re-executes a node on resume,
  so an unconditional write would overwrite the founder's edits with the model's original
  plan moments before reading them back. The run would have looked like it worked. There is
  a test named for this.
- **An approved plan that still mirrors the book is refused.** Gate 1 exists to improve the
  plan, not to waive a `LEGAL.md` requirement — the same logic that keeps the grounding gate
  separate from editorial review. **This needs a ruling**: it means the founder cannot
  override the structure check from the file, and the escape hatch is editing until it
  passes. Defensible, but it is a policy choice I made, not one the handoff specified.
- **Checkpoint deserialization is restricted to an explicit allowlist** of this package's
  types. LangGraph's default accepts any type and warns it will stop; naming them survives
  that change rather than breaking every in-flight run when it lands.
- **Embeddings are stored per batch**, and a re-entered ingest skips chunks it already has.
  Embedding is the only place in WP16 that spends money per unit of book.
- **The 3.x models are deliberately absent from the cost rate table.** Their rates were not
  verified here, and `unpriced_models` naming a model is more useful than a confident number
  that is wrong. The successful run reports `$0.0000` with `unpriced: gemini-3.6-flash`,
  which is honest; the token counts are the real signal.

#### Infrastructure

The pipeline's Postgres is **its own container on port 5433** (`pgvector/pgvector:pg16`),
not a third database inside `zoomout-postgres`. That container is `postgres:16-alpine` with
no pgvector available, and it is the one Payload and the backend depend on. Verified by
listing tables in all three:

| Database | Contents |
|---|---|
| `zoomout_pipeline` (5433) | `books`, `book_chunks`, `book_raw_text`, 4 checkpoint tables, pgvector 0.8.6 |
| `zoomout` (5432) | 10 backend tables, **0** pipeline or checkpoint tables |
| `zoomout_cms` (5432) | 21 Payload tables, **0** pipeline or checkpoint tables |

Every variable is prefixed `ZOOMOUT_PIPELINE_`, and `db/engine.py` refuses any database
showing the backend's or Payload's tables — a live check, not a naming convention.
`zoomout-pipeline doctor` prints which database it is actually in, which is the WP5b lesson
turned into a command.

**The host had neither prerequisite.** Only Python 3.9.6 (Xcode's) and a stopped Docker
daemon. `uv` was installed from PyPI into the user directory and fetched CPython 3.12.14 —
no admin rights, nothing outside `~`. Recorded because the next session on a fresh machine
will hit the same wall.

#### A credential handling finding, learned the hard way

Setting up the API key, **two Gemini keys were leaked into the session transcript by my own
diagnostic commands** — both times by trying to print a redacted fragment of a line that
contained the secret. Both were rotated and deleted.

Two things follow, and they are worth more than the embarrassment:

- **The deny rule on `.env` files does not protect the environment itself.** It blocks the
  obvious path while a credential in an env var remains one careless `grep` away from a log.
  The only safe diagnostics are `${#VAR}` and match *counts*.
- **`~/.zshrc` is the wrong file for anything a tool needs.** Zsh reads it for interactive
  shells only, so an agent's non-interactive shell never sees it. `~/.zshenv` is read by
  every invocation. This cost two round trips before it was diagnosed.

**Before anything deploys, this key belongs in GCP Secret Manager.** Hosting is already
decided as GCP; a key in a dotfile is a local-development affordance that should not become
the pattern.

#### The root `typecheck` is red on `main`, and it is not WP16

`npm run typecheck` fails at `apps/backend`, on `main`, independently of this package:

```
src/content/content.mapper.test.ts(285,78): error TS2322:
  Type '"dot"' is not assignable to type '"json" | "mermaid" | null | undefined'.
```

The test passes `specFormat: 'dot'` while `DIAGRAM_SPEC_FORMATS` in
`packages/shared/src/content.ts` is `['mermaid', 'json']`. It arrived with `cf3e286`
(*WP15: carry the Leaf v2 fields through the backend mapper*). Confirmed pre-existing by
checking `main` out into a separate worktree and finding the same line against the same
enum; `apps/backend` and `packages/shared` are byte-identical between this branch and
`main`.

**Left unfixed deliberately** — `apps/backend` is Manager's, and a one-character fix in
someone else's package is still a change nobody asked for. It is a one-character fix
(`'dot'` → `'mermaid'`), or the enum is wrong and Graphviz was meant to be supported.

Everything else in the root gate is green, verified by running the phases separately since
the failing `typecheck` aborts the chain: **lint passes, `npm test` passes (706 tests across
four workspaces), `npm run build` passes.** WP16's criterion — that root `build` and `test`
are unaffected — holds.

**How this was nearly missed, which is the part worth keeping.** The gate was run in the
background as `{ npm run lint && ... ; echo "EXIT=$?" ; }`. The harness reported the
*compound command* exiting 0, because the trailing `echo` always succeeds, and the run was
twice reported in chat as green before anyone read the log. The project's own rule —
**verify the effect, not the exit code** — applies to the gate itself, and a background
task's reported status is an exit code like any other.

#### One change outside the package's declared scope

`eslint.config.js` gained one ignore entry for `apps/pipeline/**`. The root gate went red
because eslint was linting `.js` assets shipped inside Python dependencies in
`apps/pipeline/.venv`. Written in the style of the two entries already there. Flagged rather
than buried: the handoff scoped this session to `apps/pipeline/` and nothing else, and
leaving the root gate red was the worse option.

`apps/pipeline` has **no `package.json`**, so npm's `apps/*` workspace glob does not pick it
up and `npm run build` / `npm test` never see it — which is what the handoff asked for, by a
mechanism worth knowing about since the glob looks like it would include it.

#### Testing

48 tests. Tier A: the structure check firing (plus the mutation check), raw-text deletion
verified by querying the database, the revision cap terminating, ingest refusing to run
without an acquisition status, and the foreign-database guard. Tier B: one happy path
through ingest, analyze and breakdown wiring, and the gate file round-trip.

**Durability is tested by actually killing a process.** `test_durability.py` runs a real
checkpointed run to gate 1 in a child process, `SIGKILL`s it, edits the plan file, and
resumes in a *separate* process sharing nothing but Postgres. It comes back with the chunk
count intact and the hand-edited title in state.

The DB-backed tests create and drop a scratch database and **skip loudly** if Postgres is
unreachable, rather than passing quietly. A green gate that silently skipped the Tier A
retention tests would be worse than a red one.

LLM nodes are tested on their contract — output parses, required fields present, a bad plan
is rejected — never on prose, via a scripted fake. The normal gate touches no network.

#### Tier C — deferred, by name

- **No test exercises the PDF fallback against a real PDF.** The code path exists and is
  honest about its limits, but no fixture PDF is committed and no run has used it. EPUB is
  the primary path and the first book was EPUB.
- **The `live` pytest marker exists but no test uses it.** Live-model runs were done by hand
  through the CLI. A small explicit live suite is still owed.
- **`purge_raw_text` is a command, not a terminal node.** Wiring it to the end of a run is
  WP20's, as the handoff anticipated. **The Wattles text was deliberately not purged** —
  WP17 needs it, and re-ingesting costs another ~140 embedding requests.
- **No retry or backoff on the text-generation calls.** Only embeddings are paced. Analyze
  and breakdown are one call each between long human gates, so this has not bitten, but a
  transient 503 currently fails the run.
- **The rate limiter is per-process.** Two concurrent runs would each think they had the
  full quota.
- **LangSmith tracing is not wired**, though §4 lists it. Nothing to trace until WP17 has
  cycles worth debugging.
- **`book_chunks.is_cited` is unused** until WP17 sets it. The purge already honours it.
- Four abandoned run ids (`wattles-01` … `wattles-04`) have checkpoints in the pipeline
  database from the debugging above. Harmless, and left as evidence.

#### What WP17 inherits

- A book in `zoomout_pipeline`: 136 chunks, 768-dimensional, **every chunk carrying its
  chapter index, chapter title and position** — the location a source reference needs.
  Retrieval is unwritten; the data it needs is there.
- An approved 17-Leaf plan under run id `wattles-05`, resumable from its checkpoint.
- `BookRepository.purge_raw_text` already distinguishes cited from uncited chunks, so
  marking `is_cited` when a passage becomes a source reference is the only wiring left for
  retention to be correct.
- **No Payload contact of any kind** — asserted against the parsed source in
  `test_boundaries.py`, which fails on an import rather than on a mention in prose. WP17
  opens that boundary; the door is the REST API.
- The prompt files are where the quality work happens. `breakdown.md` is a first draft that
  produced a mediocre course, and improving it needs no code change.

<!-- ### Completed: <title> — YYYY-MM-DD
(paste the full completion report here) -->

### Completed: WP15.1 — Track `acquisition` field, and the red typecheck — 2026-08-27

**Status:** 6 of 7 acceptance criteria verified by execution. **The seventh — the admin-UI half of the device gate — needs the founder**, because it requires signing into Payload and I do not enter passwords. The REST half of that gate is verified. Branch `wp15.1-track-acquisition`, off `main` at `2560b8f`.

**Gates:** `npm run typecheck` **green from the repo root** — the objective's second half. `npm test` 946 passing (71 shared, 170 admin, 473 backend, 232 mobile). `npm run build` exit 0. Lint exit 0 — see the note on `apps/pipeline` below, which is not mine.

---

#### 1 — `acquisition` on Track

Four values, `undocumented` the default, in three places that check each other: `TRACK_ACQUISITION_STATUSES` in `packages/shared/src/content.ts`, a `select` in the Tracks collection whose options are **built from that same list** rather than retyped, and `mapTrack` defaulting on read.

`content.ts` re-frozen 2026-08-27, WP15.1 named, with the reasoning recorded in the header — the field exists before WP17 writes its first Track precisely because the answer cannot be reconstructed afterwards.

**Verified by query, not by exit code:**

| Check | Result |
|---|---|
| Tracks carrying `undocumented` after the push | **28 of 28**, zero NULLs |
| Published Tracks that still map and validate | **27 of 27** through the real `mapTrack` |
| Leaves still mapping (no collateral damage) | **21 of 21** |
| Round-trip: written via Payload → read anonymously over REST | `public-domain` in, `public-domain` out, DB agrees |
| Unknown status `borrowed` | **rejected** — "The following field is invalid: Acquisition" |
| Publishing blocked by the value? | **No.** 27 Tracks sit published on `undocumented`; the round-trip Track stayed `published` throughout |
| Empty database | 21 tables, `acquisition` present with the right default, enum holding exactly the four values in order |

The 28th Track is a draft, so it is not served — by design, not by failure. Track 29 was restored to `undocumented` afterwards; the database is back to 28/28.

**The column is nullable with a default.** That is Payload's choice, and it makes `mapTrack`'s `?? 'undocumented'` reachable at runtime even though the generated type says the field is always present — the generated type describes documents written *since* the column existed, not rows that predate it.

#### 2 — the red typecheck, and a test that was weaker than it looked

Fixed at the fixture as instructed: `'dot'` stays, reaching the object through a cast against a named alias for the generated union, with a comment explaining that a `select` column will hold whatever a pipeline writes into it regardless of what TypeScript says.

**Then the mandatory mutation check found the test was passing for the wrong reason.** Making the mapper silently drop an unknown format — a fair reading of "remove the validation" — left all 44 tests green. The Leaf was still rejected, but by a *different* rule: `diagramAssetSchema` separately refuses a `spec` with no `specFormat` to re-render it from. The enum was never what the assertion was resting on.

So the test now has a second case: an unknown format with **no spec**, where the enum is the only thing left that can reject the Leaf. Both mutations now redden it —

| Mutation | Before | After |
|---|---|---|
| `diagramSpecFormatSchema` → `z.string()` (the handoff's required check) | 1 red | **2 red** |
| Mapper launders an unknown format away | **0 red — survived** | **1 red** |

`mapLeaf` is unchanged. The gap was in the test, and it would have hidden a real regression: a mapper that dropped unknown formats would serve a diagram with no format at all rather than refusing it.

#### Fixtures

`acquisition` is required on the domain `Track` (a `.default()` makes the *output* type non-optional, same as `isPlaceholder`), so eight Track fixtures needed the field. Four of the errors TypeScript reported as `TS2719 "two different types with this name exist"` were this same missing property wearing a confusing hat.

---

#### Not mine, but it will bite CI: `apps/pipeline/.venv`

`npm run lint` from the repo root **fails on a vendored Python virtualenv** — `apps/pipeline/.venv/.../emscripten_fetch_worker.js`, dozens of `prefer-const` and `no-undef` errors in third-party code.

It is not from this branch. `apps/pipeline` has **zero tracked files on `main`**; the directory is an untracked leftover from the WP16/WP17 work that sits in the working tree across checkouts. `wp16-pipeline-skeleton` already ignores `apps/pipeline/**` in `eslint.config.js`, so this resolves itself when that branch merges. Excluding the untracked directory, lint on this branch is exit 0.

**I did not add the ignore here**, deliberately — duplicating it would conflict with the branch that already has it. But `.venv` is **neither gitignored nor eslint-ignored on `main`**, which is worth a ruling of its own: right now nothing stops a virtualenv being committed.

#### What needs the founder

**The admin-UI half of the device gate.** Payload's dev server is running on `http://localhost:3001` (use `localhost`, not `127.0.0.1` — Next 16 blocks the latter as a cross-origin dev host). Open any Track, confirm **Acquisition** appears in the right-hand sidebar with the four options, change it, save.

Everything that half would prove short of the rendering itself is already verified: the admin app **builds** with the field, the collection route returns 200, the value written through Payload's own hooks round-trips to the REST API, and an invalid value is refused.

### Completed: WP15 — Leaf v2: assets and apply-in-life — 2026-08-13

**Status:** All 10 acceptance criteria verified by execution. Cold gate green with `dist` and `.next` deleted, then `npm ci`: **932 tests** (71 shared, 170 admin, 459 backend, 232 mobile), lint, typecheck and build all exit 0 — plus **6 backend mapper tests added afterwards**, taking backend to 465 and the total to 938.

**Read the device-check section before the rest.** It is not a rubber stamp on this one: it found that the backend mapper carried none of the three new fields, which every other criterion passed straight over.

**Branch:** `wp15-leaf-v2`, from `main` at `bb7abc0`.

#### Where the time went

Roughly: a fifth on the schema and its re-freeze; a fifth on the CMS collection, rules and codegen; a fifth on the player; a fifth on tests including a mutation check; **the last fifth entirely on tooling** — a stale Metro cache after `npm ci`, and the cold gate deleting `.next` under the running CMS. Neither was a code problem and both are recorded below so the next package does not spend that time again.

#### The thaw, and why the migration plan is "there isn't one"

`content.ts` is re-frozen with the date updated and WP15 named, per the criterion. The header now records what was added and — more usefully — **why no backfill exists**: all three fields are optional, so the change is purely additive and content authored before Leaf v2 stays valid untouched. Nothing was removed, narrowed or renamed.

**One thing the schema already had that made this safe:** `toPublicLeaf` is deliberately total and type-checked, with a comment from WP0 saying that adding a field to `scenario` must break compilation until it is handled. It did exactly that. That tripwire is the only reason the illustration is not silently stripped on its way to the client — worth knowing it earned its keep.

Two decisions inside the schema:

- **`alt` lives inside the asset and is required there.** "An asset without alt text" is therefore unrepresentable rather than discouraged; the optionality is on the asset, not on its description.
- **`specFormat` is required whenever `spec` is present.** A spec whose language is unknown cannot be re-rendered, which is the entire reason R4 wants the spec kept.

#### Tier A, proven by query rather than by reasoning

**All 27 published Tracks and 21 published Leaves in the live CMS map and validate under Leaf v2** — run through `mapTrack`/`mapLeaf`, the real mapper the backend serves with, not a hand-rolled approximation.

The count is worth stating precisely because it differs from the handoff's: the database holds **28 Tracks and 22 Leaves**, of which 27 and 21 are published. Payload serves published-only to anonymous callers, so 27/27 and 21/21 is complete coverage of everything servable. The two unpublished are drafts, which are permitted to be incomplete by design — and being optional fields, nothing added here can invalidate them.

**My first attempt at this proof was wrong and worth recording.** I hand-rolled the CMS→domain mapping in a throwaway script and got 0/21 passing, on `summary.audio.url` being `null`. That is not a content problem — it is Payload emitting empty groups as nulls, which the real mapper already handles. **A verification script that reimplements the thing under test proves the reimplementation.** Using the shipped mapper gave the true answer.

The alt rule is mutation-checked: making `assetIsPresent` always return false reddens exactly four tests, all of them the new ones, and moves nothing pre-existing.

#### The CMS

`Media` is a real Payload upload collection, set up now because the pipeline writes into it later. `alt` is required at the collection level — a third gate alongside the shared schema and the publish rule, deliberately not sharing a predicate with either, for the reason WP1 recorded: one bug must not defeat every gate. MIME types are restricted to PNG/JPEG/WebP rather than `image/*`, because SVG can carry script and this collection will be written to by an automated pipeline.

**`alt` is *not* marked required on the Leaf's own asset fields.** Payload enforces field-level `required` even on drafts, which would make a half-authored Leaf unsaveable. It is a publish rule instead, matching the existing asymmetry — and there is a test asserting exactly that: the same Leaf saves as a draft and is refused at publish.

Payload's dev push created the `media` table and eleven new columns on `leaves` cleanly against the existing database.

#### The player, and one decision the handoff left to me

`SlideImage` handles three states — loading, loaded, failed — and **the failed state renders the alt text as visible copy**. That is the substantive reason `alt` is mandatory: a reader who cannot see the image and a reader whose image did not load need the same thing. WP11 found a seeded cover pointing at a web page, and Phase 2 fills these fields from a generation pipeline, so a URL that is not an image is a normal input here.

**Apply-in-life is always visible, not collapsed.** The handoff left this open, so: Dinner Table Knowledge is a *discovery* — optional, on roughly a third of Leaves, and valuable because the reader chooses to open it. Apply-in-life is the opposite kind of thing; it is the step from "I understood that" to "I did something with it", and a call to action behind a tap is one most readers never see. It renders above the DTK control, because two collapsed "Show" affordances on one slide read as a settings screen.

Both slides render nothing at all when the field is absent — no reserved box — which is the state of every existing Leaf.

#### The device check — done, and it found the bug the other nine criteria could not

**Done, 2026-08-14, in both themes.** All three fields render correctly on Leaf 9 of Track 29: the scenario illustration loads and letterboxes above the prompt, the deliberately broken diagram falls back to its alt text as visible copy with the four notes intact below it, and apply-in-life renders as a "Try this" block above the Dinner Table Knowledge control. Dark and light both hold up.

**And it caught a real defect: the backend mapper carried none of the three fields.** The CMS could author them, the shared schema allowed them, the player could render them — and nothing joined the two. `GET /content/leaves/9` returned `image: null`, `diagram: null`, `applyInLife: null` for a Leaf that had all three authored in the database.

Two things are worth taking from that, and neither is "I forgot a file":

1. **Every one of the nine passing criteria was consistent with this bug.** Schema, CMS rules, player components, 932 tests, lint, typecheck, build — all genuinely green, none of them crossing the CMS→backend→app boundary end to end. The mapper is the one seam no unit test in the package spanned, and it was the one that was empty.
2. **All three fields are optional, which is what made it invisible.** A dropped required field is a validation error on the first request. A dropped optional field is indistinguishable from content that simply has none — so the app rendered a fully-authored Leaf exactly as it renders every Leaf authored before Leaf v2, and looked correct doing it.

This is the second time in three packages that the device check is where a package stopped being finished — WP10's legal surfaces were the first. **It is not a formality at the end of the list.** It is the only criterion that exercises the whole path, and the only one that would have caught this.

The fix, on the same branch:

- `mapLeaf` now maps `scenario.image`, `stickyNotes.diagram` (including `spec`/`specFormat`) and `takeaway.applyInLife`, via `optionalImage`/`optionalDiagram` helpers mirroring the existing `optionalAudio` — an absent or empty URL emits no key at all, because Payload writes empty groups rather than omitting them.
- **A URL with no alt text is passed through, not repaired.** Dropping the image would make this gate agree with the CMS by staying quiet, which is what the two-gate design exists to prevent: the CMS refuses to publish an asset without alt, so a published one lacking it means a gate is not running, and the Leaf must not ship.
- **`alt` and `url` are trimmed before the schema sees them.** `min(1)` counts `"  "` as content. The CMS strips whitespace in a `beforeChange` hook, but this mapper also reads rows the Phase 2 pipeline writes directly, which never pass through that hook — untrimmed, a space-only alt satisfies both gates and reaches a screen reader as silence. My own SQL-authored fixture took exactly that path, which is how the case surfaced.
- Six new mapper tests, mutation-checked three ways: dropping the image spread reddens 2 tests, dropping `applyInLife` reddens 1, removing the `alt` trim reddens 1 — each killed by its own test and nothing pre-existing moved. 465 backend tests pass (up from 459).

One tooling note for whoever drives the simulator next: **`control` takes device points, not screenshot pixels.** The screenshot comes back at 920×1992 while the device is 430×932, so pixel coordinates land off-screen and the tap silently does nothing — which reads exactly like a frozen app. Multiply by ~0.467.

#### Two tooling traps, both of which cost real time

1. **`npm ci` invalidates Metro's cache, and Metro does not notice.** After the cold gate the bundler failed with `Unable to resolve module ./plugins/DOMCollection from pretty-format` — a Jest dependency, in an app bundle, which makes no sense until you realise the cache is pointing at paths that no longer exist. `npm run dev:mobile -- --clear` fixes it. **Run the cold gate before the device check, never between reloads.**
2. **The cold gate deletes `.next` out from under a running CMS.** `apps/admin` was serving happily and then 000'd mid-check. Restarting it is enough, but the failure looks like the CMS breaking rather than like a directory being removed underneath it.

#### Deferred — Tier C

1. **No end-to-end test crosses CMS → backend → app for content fields.** This is the gap the mapper bug lived in, and it is now the most valuable missing test in the repo — everything else on this list is smaller. A single test that authors a Leaf with every optional field set and asserts the served payload carries them all would have caught it in seconds, and would catch the next field added to the content model too.
2. No render tests for the scenario or sticky-notes slides *with* an asset — `SlideImage` is tested directly, but its integration into those two slides is not.
3. Nothing tests that a `width`/`height` pair actually influences layout; they are accepted and passed through, unexercised.
4. The `Media` collection has no test — no upload is exercised, and the MIME restriction is unverified.
5. The diagram `spec` is stored and never rendered. That is WP16's job, but it means the field is currently write-only in the product.

### Completed: WP10 — Report an error, the fix queue, and the legal surfaces — 2026-08-13

**Status:** 9 of 10 acceptance criteria verified by execution; the tenth is half-done and named below rather than counted. Cold gate green with `dist` and `.next` deleted, then `npm ci`: **913 tests** (64 shared, 161 admin, 459 backend, 229 mobile), lint, typecheck and build all exit 0.

**Branch:** `wp10-report-error-legal`, from `main` at `bb7abc0`.

#### Where the time went

Roughly: a fifth on the report path end to end; a fifth on the fix queue and its refusal; **two fifths on §3**, which turned out to be a build rather than a check; the rest on the SLA, tests and the device session.

#### §3 was not a verification. It was a missing feature.

**The disclaimer and the purchase links were rendered nowhere in the app.** Not on a Track detail screen — there was no Track detail screen. `TrackCard` rendered a cover, a title and an author, and the only occurrences of `disclaimer` or `purchaseLinks` anywhere under `apps/mobile/src` were **in a test fixture**.

So the position since WP7 has been: `trackSchema` requires both fields, WP3 makes a Track unservable without them, the API returns them on every response — and no reader has ever seen either. **Servable is not visible, and it is the visible one `LEGAL.md` rests on.** The handoff was right to suspect this and understated it.

What that meant for scope: the handoff says "confirm the disclaimer is visible on the Track detail screen", which presupposes a screen that does not exist. Adding one is the smallest thing that satisfies the requirement, so this package includes:

- **`TrackLegal`** — one component carrying the disclaimer *and* the purchase links, deliberately inseparable. A purchase link without the disclaimer beside it is exactly the affiliate-looking surface the disclaimer exists to disown.
- **`TrackDetailScreen`** — author, title, publisher, description, and `TrackLegal`. Deliberately not a contents list; Journey and Library already own "where am I in this".
- **Every Track card in Explore, Library and Journey is now tappable into it**, so the obligation is reachable from every screen that shows a book.
- **`CompletionOutcome.trackCompleted`** (additive to `delivery.ts`, noted below) so the purchase link appears **on Track completion**, which `PRODUCT.md` requires specifically and which the client previously had no way to detect — it knows its own Leaf, not how many remain.

**Verified by looking at the screen**, not at an API response: the disclaimer renders in full under "About this book", and tapping the purchase link opened Safari at the retailer URL. The seed's placeholder URL does not resolve, which is content, not a defect.

#### Report an error

`ErrorReport` existed from WP0 and needed adjusting rather than replacing, as the handoff predicted. Three real gaps: `reason` was a free string (now the four-value enum, so the queue is sortable without reading prose), there was no free-text field, and `trackId` was missing. Status narrowed from four speculative states to `open`/`resolved` — the file was marked PROVISIONAL pending exactly this package.

Two decisions worth recording:

- **`trackId` is denormalised at filing time.** The thing pulled in a takedown is a Track, and resolving Leaf → Track at triage would mean asking the CMS about content that may by then be gone. A report about withdrawn content is the report most worth reading.
- **`user_id` is `on delete set null`, not cascade.** A deleted account must not erase evidence that a factual claim was disputed. `errorReportSchema.userId` is nullable to match, rather than the domain lying about a row it cannot describe.

The action sits in the player on **every slide**, quiet and below the content. Submitting keeps the sheet open and states the SLA, because on a trust surface silence reads as being ignored.

#### The fix queue

`GET /moderation/reports`, gated by `MODERATION_OPERATOR_TOKEN` from validated config, compared with `timingSafeEqual`. **Unset config refuses everyone** — the same fail-closed shape WP2 chose for unconfigured providers, and the one mistake here would publish every reader-submitted report on any deployment that forgot the variable.

The SLA is written into `project/LEGAL.md` under content integrity: who reviews, how often, and a severity table separating a same-day unpublish for suspected fabrication from a one-working-day correction for a factual error. It also states what the commitment does *not* cover — reporters get no follow-up until WP13's email provider exists.

#### Tests, and what cannot be mutation-checked

Tier A is that a report is persisted and that the queue refuses an untokened caller. The refusal has seven cases, including a valid *reader* token and the right token under the wrong scheme.

**Mutation check:** making an unconfigured token return `true` instead of `false` reddens exactly one test — "refuses everyone when no operator token is configured" — and nothing else.

**Two things here assert an absence and therefore cannot be mutation-checked**, which the handoff asked me to name:

1. **"Refuses an untokened caller."** There is no line to break; the guard *is* the mechanism. Deleting it makes the tests fail, but that is deletion, not mutation.
2. **"A report survives its reporter being deleted."** This asserts that no cascade exists. A mutation would mean *adding* `on delete cascade` — writing the bug the test forbids, which is a schema change rather than a behaviour flip.

Both guard future regressions rather than proving present behaviour, same as WP9's "wrapping up does not lock the reader out".

#### The device session

Filed a report from the player against Leaf 9, saw the confirmation, and read it back through the operator endpoint: `wrong_answer`, track 29 resolved server-side, status `open`. The queue's refusal was also exercised against the running server — no token and wrong token both 401, correct token 200.

**Three reloads were wasted on a stale bundle before I noticed Metro had died again.** This is the third package it has cost time in. `open_url` alone does not fix it — the app re-attaches to a dead packager and silently serves its last download. **`xcrun simctl terminate <udid> host.exp.Exponent` then re-opening is what actually forces a fresh bundle**, and that is worth doing before concluding a feature is broken.

#### Not verified

**The achievement share screen still has not been walked end to end** — carried from WP9 and still outstanding. Reaching it needs an unlock on the completion screen, and the test account earned no new badge during this session. It remains verified by construction only: it renders the same `ShareCard` through the same capture path as the wrap-up screen, both of which are proven.

Deferred Tier C, by name: no component render tests for `ReportErrorSheet`, `TrackDetailScreen` or `TrackLegal`; no test that the report action appears on every slide rather than one; the rate limiter is tested at its boundary but not across the window reset; and `Linking.openURL` failure is swallowed by design and unasserted.

#### `delivery.ts` and `moderation.ts`

`delivery.ts`: `trackCompleted` added to `CompletionOutcome`. Additive; both apps compile.

`moderation.ts`: settled from PROVISIONAL, as its own header directed. `reason` narrowed to an enum, `status` narrowed to two values, `trackId` and `detail` added, `userId` made nullable. **The status narrowing is a removal** — `triaged` and `rejected` are gone. Nothing referenced them.

### Completed: WP9 — Session wrap-up and achievement screens — 2026-08-13

**Status:** All 10 acceptance criteria verified by execution, including the thumbnail check — which **failed on first look and was fixed**, and that is the most useful thing in this report. Cold gate green with `dist` and `.next` deleted, then `npm ci`: **898 tests** (64 shared, 161 admin, 444 backend, 229 mobile), lint, typecheck and build all exit 0.

**Branch:** `wp9-wrapup-share`, from `main` at `ab00f9a`.

#### Where the time went

Roughly: a twentieth de-risking screen capture before writing anything; a quarter on the backend summary; a third on the two screens and the share layer; a fifth on tests including two mutation checks; the rest on the device session and the gate. **The device session found two defects and produced the package's only real design decision**, which is the second time running that manual verification has out-earned the test suite.

#### The risk I retired first

Capture needs `react-native-view-shot`, which has iOS native code — and WP0 recorded that this host has no CocoaPods and therefore cannot build a development client. If that module were not in Expo Go, the share criterion would have been unbuildable here and Architect needed to know on day one, not at the device check.

It is in Expo Go: both it and `expo-sharing` are listed in `node_modules/expo/bundledNativeModules.json`, which is also why `expo install` pinned view-shot to an exact `5.1.0`. **Confirmed by execution later** — the share sheet opened with a 71 KB PNG attached, in Expo Go, with no dev build.

#### The backend gap the handoff predicted, verified before building

The handoff said `SessionStatus` carries nothing about *which* Leaves were completed and told me not to trust it. It is correct: `SessionStatus` is six scalars and `ReaderStanding` wraps it with a streak and lifetime XP. Nothing named a Leaf.

`GET /progress/summary` now returns the reader's local day in one call — Leaves completed with their title and book, XP earned, the streak, achievements earned today, and the session state. Notes worth keeping:

- **Its own service, not a method on `ProgressService`.** The summary composes progress, content and achievements, and `ProgressService` *cannot* depend on `ContentService` — content already depends on progress as its `PayoffAccessPolicy`, so that edge would close a cycle. `SessionSummaryService` sits above both, as `LibraryService` does.
- **Content is read through `ContentService`, never the repository.** This names books in an image built to be posted in public, so the placeholder guard and the takedown cascade must apply. A Leaf whose Track has since been withdrawn is dropped from the summary and the rest of the day survives — tested.
- **`xpEarned` comes from the day's row, not `sum(leaves)`.** They legitimately differ: a Leaf completed after the cap fires is worth zero but should still be listed.
- **A new `ContentService.getLeafSummary`** — metadata only. Deliberately not `getLeaf`, which returns slide bodies and takes a reader because the payoff is per-reader; a summary has no business fetching prose it will not render.

#### Two product rulings, implemented as ruled

**Wrapping up is a ceremony, not a lock.** `POST /events` already accepted `session_wrap` from WP5b, so this only had to call it. It records the wrap, unlocks `first-wrap`, and returns the reader to Journey — and the next completion still awards full XP, which is asserted rather than assumed. Wrapping twice is fine and produces two events and one badge.

**Opening the summary records nothing.** The summary is a `GET` and the wrap is a separate `POST`. Arriving from Journey to look at your day must not log an ending you did not declare, which a single combined call would have done every time.

**The cap leads into the wrap-up.** The cap notice now carries a "See your day" button into the same screen instead of a second, differently-styled ending.

#### The device session, and the two things it caught

**1. The wrap-up screen had no visible way out.** With no completions yet, the only exit was the iOS edge-swipe — invisible, and absent on Android. "Back to Journey" now renders unconditionally rather than only after wrapping.

**2. The thumbnail check failed, and this is the criterion the handoff called the deliverable.** I pulled the actual captured PNG off the simulator, scaled it to 130px — feed-thumbnail size — and looked at it. **The streak read; the book did not.** It was `body`-weight, `textMuted` grey, wrapped across two lines: three properties each working against legibility, and at that size it dissolved into texture.

Fixed by making the book `h3`, full contrast, clipped to a single line. **A truncated title a stranger can read beats a complete one they cannot.** Re-captured and re-checked at the same size: both the streak and the book now survive, and my answer to "would you post it" is yes.

That verdict is a judgement, not a measurement — the founder should look at `wrapup-v2-thumb.png` before WP10 if they want to overrule it.

#### Tests, and a mutation that found a hole in my own test

Tier A is the local-date query and that wrapping up does not lock anyone out.

- **An Auckland reader gets their own day.** 10:00 and 12:00 UTC on 2026-02-10 are two different local dates there; the summary reports the second Leaf under the 11th and does not carry the first across.
- **Wrapping up does not prevent the next completion** — the following Leaf still awards 100 XP and appears in the summary.
- **A withdrawn Track drops out of the summary** without taking the day with it.

**Mutation checks.** Removing the `completed_local_date` filter reddens exactly the Auckland test. The second mutation is the useful one: replacing the achievements' `at time zone` conversion with a naive `unlocked_at::date` **passed all nine tests**. My test had picked 10:00 UTC, where the server's date and Auckland's happen to agree, so it could not distinguish the two. Rewritten around 12:00 UTC — where they *must* disagree — it now kills that mutation and nothing else.

**One Tier A guarantee cannot be mutation-checked**, and it is worth saying so plainly: "wrapping up does not lock the reader out" asserts the *absence* of a mechanism. There is no line to break, because there is no lock. That test guards a future regression rather than proving present behaviour.

#### `delivery.ts` — additive, with the note the constraint asks for

`SessionSummary` and `CompletedLeafSummary` added; nothing changed or removed. Both apps compile.

#### Not verified, and deferred

1. **The achievement share screen was not exercised end to end on a device.** It renders the same `ShareCard` through the same capture path as the wrap-up screen, both of which are verified — but its own route, from the completion screen's "Share this badge" button, was never walked, because the test account earned no new badge during the session and manufacturing one would have proved nothing. **This is the one criterion I am reporting as verified by construction rather than by execution.**
2. **No component render tests** for `ShareCard`, `WrapUpScreen` or `AchievementShareScreen` — no theme permutations, no empty/populated matrices. Tier C.
3. **The share layer has no unit tests.** `shareView`'s four outcomes — shared, cancelled, unavailable, failed — are branch logic over two mocked platform modules, and only the happy path and cancel were seen on device.
4. **Android is entirely unverified.** `collapsable={false}` is on the captured view specifically because Android flattens container views out of the native hierarchy and there would be nothing to photograph; that reasoning is untested.
5. **The captured image's theme independence is proven only in dark mode** — the card was forced light while the device was dark, which is the case that matters, but the reverse was not checked.

#### For whoever picks up WP10

- **Metro must be restarted after adding a native module**, and the app reloaded. A stale bundle silently serves the previous JS and looks exactly like a feature that does not work.
- The captured file lands in the simulator's container under `.../tmp/ReactNative/*.png`. Pulling it out and scaling it down is the only honest way to run the thumbnail check — the on-screen preview is far too large to judge.

### Addendum: WP5b — the device check is done, and it found two defects — 2026-08-12

**Supersedes the "Not done: the device check" section of the report below.** The environment blocker is resolved: `apps/backend/.env` now names `zoomout`, migrations 0000–0005 are applied there, and the backend, CMS and app all run together against real seeded content.

**Seven of the eight device items pass. The one that does not is a pre-existing app-wide defect.**

| Item | Result |
|---|---|
| Achievement grid on Profile, locked tiles included | ✅ 19 tiles, "4 of 19" after earning four |
| Total XP on Profile | ✅ 100 XP, matching `SUM(xp_awarded)` |
| Achievement unlock on device | ✅ three banners on the completion screen, reward amber, trophy icon |
| Dinner Table open recorded from the app | ✅ `reader_events` row with `leaf_id = 2`, `dinner-party` awarded |
| Payoff unlock (WP8's signature moment) | ✅ amber, open padlock |
| **iOS Reduce Motion on the unlock — WP8's open 11th criterion** | ✅ **with a caveat, below** |
| Light and dark theme | ✅ both, grid legible in each |
| **Both themes at `accessibilityExtraExtraExtraLarge`** | ❌ **fails — see below** |
| WP5a's cap screen ("That is today done") | ✅ reached on device — see below |

#### Defect 1, fixed: Profile showed stale everything

Finish a Leaf, return to Profile, and it still read "No streak yet", "0 XP" and "1 of 19" while the database held 100 XP and four badges. Both cards fetched once at mount and never again, so every number stayed stale for the session. Library, Journey and Explore already call `useRefreshOnFocus`; Profile — the screen where every value changes as a side effect of reading elsewhere — did not. Fixed in `13c1084` and re-verified on device.

**Only manual verification could have caught this.** The unit tests mount the component once and assert on what it renders, which is exactly the state that was correct.

#### Defect 2, not fixed, needs an Architect ruling: the app is unusable at XXXL

**Every screen clips text mid-glyph at `accessibilityExtraExtraExtraLarge`** — not just WP5b's. Explore's Track titles render as slivers, buttons show fragments of letters, the Profile header is cut in half. Screenshots taken on both Explore and Profile.

**Cause:** `design/typography.ts` gives every variant an **absolute `lineHeight`** (`display: 32/40`, `body: 16/26`, and so on) and `components/Text.tsx` applies it directly. React Native scales `fontSize` by the OS text-size setting — `allowFontScaling` is correctly never disabled — but it does **not** scale `lineHeight`. At XXXL a 32pt display font renders near 99pt inside a 40pt line box, so the glyphs are clipped by the line box itself.

**This is pre-existing and systemic, not introduced by WP5b.** It lives in WP6's design system and affects every screen in the app. It is also why no amount of layout work on the achievement grid would fix it — the grid was the messenger.

**The fix is contained but app-wide in effect:** scale the line height with `PixelRatio.getFontScale()` in `Text.tsx`, or express leading as a multiplier of `fontSize` rather than an absolute. Either changes the rendered look of every screen, which is why I have not taken it unilaterally.

**Founder ruling, 2026-08-12: not fixing it, and XXXL is dropped as a check.** Recorded here because it is a deliberate trade, not an oversight, and because two things now need to follow from it:

1. **`agents/manager.md`'s manual-verification bar still mandates XXXL on every package** ("Run the app once per package in both themes and at `accessibilityExtraExtraExtraLarge`"). That line should come out, or every future package reports the same failure. Architect's file to change.
2. **The cost is worth stating once, plainly.** `design-direction.md` §4 argues that readers who size text up are disproportionately the ones who need to, and `Text.tsx` was deliberately built so `allowFontScaling` can never be switched off. The app still honours that setting — it simply clips above roughly the largest two steps. So this is not "XXXL unsupported", it is "XXXL renders broken", which is the worse of the two to ship and the reason it belongs on the launch-blocker list rather than being forgotten.

Added to `project/launch-blockers.md` territory rather than the roadmap, per that file's convention.

#### The cap screen — WP5a's open question, answered

Reached honestly, by completing five Leaves on the device until the session hit 500 XP (637 seconds elapsed, so **XP was the binding constraint**, which is the calibration WP5a intended). `cap_reached_at` is set in `daily_session`.

**It reads as an ending, not a refusal**, and one thing does more work than the copy: `daily-cap` — "Enough for Today · Reach the daily limit — and stop" — unlocks *on the same screen*, above the notice. So the moment a reader is told they are finished, they are also congratulated for it. That is §2 of the achievements proposal doing exactly what it argued for: an app that treats hitting the cap as a failure state teaches readers to resent it, and this one hands them a badge instead.

The order on screen is XP → three unlocks → "That is today done" → Done. The notice sits last, so the session closes on the sentence about coming back tomorrow rather than on a reward. No warning tone, no "limit", no lock iconography — the word "limit" appears only inside the achievement's own description, where it is being celebrated.

**Recommend the founder look at one screenshot of this before WP9** rather than take my reading of it; tone is the one thing a Manager should not sign off alone.

#### The Reduce Motion caveat

Reduce Motion was enabled at the OS level and the payoff unlock was earned again on a fresh Leaf. The unlock renders correctly: the amber "UNLOCKED" label, the open padlock and the payoff panel are all present, so **the accommodation does not remove the feedback** — which is the rule §6 actually states. What a still screenshot cannot prove is that the transition *faded* rather than *sprang*; that claim rests on reading `PayoffSlide`'s reduced-motion branch, which swaps `withSpring` on scale for `withTiming` on opacity. Recorded as verified-by-inspection for the transition itself and verified-by-execution for the end state.

#### Environment facts the next session will need

- The founder's local Postgres runs in container `zoomout-postgres`; `zoomout` is the backend's database and `zoomout_cms` is Payload's. They are **not** interchangeable and the backend pointing at the wrong one is what cost WP5a and most of WP5b's verification time.
- **`zoomout_cms` is now clean** (2026-08-12, with founder approval): the seven backend tables, the `drizzle` schema and the backend's enum types are gone. Payload's 20 tables, 28 Tracks and 22 Leaves are untouched, and its own six enums remain.

  **Proven by a cold restart, not by assumption.** `apps/admin` was stopped and started again: `/admin` 200, `/api/tracks` 200 with 27 published Tracks, anonymous `/api/admins` still 403, and **zero schema-pull errors in the boot log**. That settles the open question from the first pass — Payload's `there is no parameter $1` failure was caused by the backend's tables and ledger living in its database, not by an upstream drizzle-kit bug.

  Two things worth knowing for next time. The drop must use `drop ... if exists`: a single missing object aborts the whole transaction under `ON_ERROR_STOP`, which is what happened on the first attempt — it rolled back cleanly and changed nothing, but it reads like a failure. And `next dev` refuses to start while it believes a previous dev server is alive; the old process survived `SIGTERM` and needed `SIGKILL` before the restart would proceed.
- Metro must be running for the app to pick up mobile changes. A stale bundle served a version of Explore without the unlock banner and looked exactly like a missing feature.

### Completed: WP5b Parts B and C — achievements and total XP — 2026-08-12

**Status:** 7 of 9 acceptance criteria verified by execution. **The device check is not done, and the reason is a live misconfiguration that Part A was supposed to have closed — it is the first section below, not buried.** Cold gate green with `dist` and `.next` deleted, then `npm ci`: **889 tests** (64 shared, 161 admin, 435 backend, 229 mobile), lint, typecheck and build all exit 0 with real exit codes.

**Branch:** `wp5b-achievements-xp`, from `main` at `02f3cd0`. Part A (`2e99714`) was not touched.

#### Where the time went

Roughly: a tenth on the migration-chain repair below; a fifth on the registry and the facts query; a fifth on wiring the five evaluation points; a fifth on mobile; a quarter on tests including two mutation checks, one of which found a real hole; the rest on the gate and the device attempt. **The device attempt cost more than the mobile work and produced no verification** — see below.

#### The blocker: the backend's `.env` points at Payload's database

**`apps/backend/.env`'s `DATABASE_URL` names `zoomout_cms`, not `zoomout`.** Established by effect, not by reading the file — reading it was denied, which is correct.

The evidence, all from `docker exec psql`:

| Database | Backend tables | Reader data | Drizzle migrations |
|---|---|---|---|
| `zoomout` | 5 (through 0003) | **6 users, 10 leaf_progress, 5 user_tracks** | 0000–0003 |
| `zoomout_cms` | Payload's 20-odd, **plus an empty duplicate set of the backend's** | 0 users, 0 leaf_progress | 0000–0003, then 0004+0005 from my run |

So:

1. **Part A's second bullet is unsatisfied.** "Confirm the backend's migrations land in the backend's database, not Payload's" — they land in Payload's. Part A fixed how the file is *loaded*; nothing checked where it *pointed*. This is precisely the failure mode `02f3cd0` generalised — verification that observes execution rather than effect — reappearing one commit later in the same package.
2. **This is the root cause of WP5a's failed device check, not the missing `--env-file`.** `zoomout` never received migration 0004, so `daily_session` and `streak` do not exist in the database that holds the six real readers. The cap and streak could not have worked on device whatever WP5a did.
3. **`npm run db:migrate` reported "Migrations applied" and wrote 0004 and 0005 into `zoomout_cms`.** Four empty tables and one enum, now sitting among Payload's.

**The two cannot coexist, which is why this needs a ruling rather than a workaround.** `apps/admin`'s dev server now fails to boot at Payload's "Pulling schema from database" step, with drizzle-kit issuing `SELECT conname AS primary_key ... connamespace = $1 ... relname = $2` and `params: []` — hence `error: there is no parameter $1` (Postgres 42P02). **I could not establish whether my four tables triggered it.** The malformed query carries no parameters at all, which looks like a library bug that would fire regardless of what is in the database; but those four tables are also the only known change to that database. Confirming it by dropping them was blocked by the permission classifier, correctly — dropping tables in the founder's database is not a call I should make alone. All four are empty (verified before attempting), so the drop is recoverable in principle.

**What I recommend, in order:**

1. Point `apps/backend/.env`'s `DATABASE_URL` at `zoomout`, then `npm run db:migrate`. One line, and it is the actual fix — the backend has been talking to the wrong database for at least two packages.
2. Then drop `user_achievements`, `reader_events`, `daily_session`, `streak` and the `reader_event_type` enum from `zoomout_cms`, and delete the two rows I added to its `drizzle.__drizzle_migrations` (`created_at` 1786341600000 and 1786540771710). That restores Payload's database to what it was and should let the CMS boot; if it still fails, the introspection error is upstream and independent of this package.
3. Re-run the device check. Everything it needs is built and unit-covered.

**A background backend dev server may still be listening on :3000, pointed at `zoomout_cms`.** I started it for the check and my attempt to stop it was also blocked. Harmless, but worth killing.

#### Migration 0004's drizzle snapshot was missing, and 0005 was wrong until it was rebuilt

**`drizzle/meta/0004_snapshot.json` did not exist.** WP5a hand-wrote `0004_add_daily_session_and_streak.sql` and hand-added its journal entry, so drizzle's last snapshot was 0003. The first `db:generate` for this package therefore diffed against 0003 and emitted a 0005 that **re-created `daily_session` and `streak`** — which would fail on any database that already had 0004, including a fresh one running migrations in order. That is the Tier A "migrations apply cleanly to an empty database" criterion, and it would have broken every integration suite at once.

Repaired rather than worked around: journal pruned to 0003, the new tables temporarily removed from `schema.ts`, `generate` re-run to reconstruct the missing snapshot, and the emitted SQL **diffed against WP5a's hand-written 0004 — identical but for a trailing newline**, which is what proves the reconstructed snapshot describes what 0004 actually did. Then the journal entry was restored with **its original `when` value (1786341600000)**: drizzle applies entries whose timestamp is later than the last one recorded, so bumping it would re-run 0004 against any database that already had it.

`0005_add_achievements_and_events.sql` now contains only the two new tables. **Anyone hand-writing a migration here must also add its snapshot, or they hand the same trap to the next package.**

#### The registry

Nineteen achievements in `apps/backend/src/achievements/registry.ts`, each a row of `{ id, name, description, tier, unlocks }` where `unlocks` is a pure synchronous predicate over one flat `AchievementFacts` snapshot. Adding a twentieth is a row and a predicate. Two invariants are documented at the top and worth keeping: predicates cannot query, and they are monotonic in the reader's favour except for the consecutive-first-try run, which is the one fact that legitimately resets.

**The catalogue is not in `packages/shared` and the client holds no copy.** `GET /achievements` returns all nineteen with `unlockedAt` resolved per reader, locked ones included. Same reasoning as WP5a's cap thresholds travelling with `SessionStatus`: a client-side list goes stale the moment a twentieth ships, and the reader silently stops being shown the tile §3 wants them to come back for. Shared holds the types only.

**Facts are one round trip.** Ten counts as scalar subqueries in a single statement, all scoped to one reader. Ten queries per completion would put the whole registry in the critical path of the product's core interaction.

**`consecutiveFirstTry` is derived, not maintained.** §4 allows either. Derived means no second copy to drift and no reset branch to forget: it is the leading run of first-try completions ordered newest-first — the position of the most recent non-first-try completion, minus one, or all of them when there is none. Ordered by `completed_at desc, leaf_id desc`, because two completions can share a timestamp and an ambiguous order makes the count non-deterministic.

**`hard_won` requires `not first_try_correct`** as well as `attempt_count >= 4`. `attempt_count` counts every answer and a reader may re-answer after unlocking, so the flag is what separates "wrong three times, then right" from "right immediately, then poked at the other options". It can still over-count for a reader who deliberately answers wrongly *after* being paid; that errs toward the reader, so it stands.

#### Evaluation points, and where the unlock travels

Five, all returning unlocks in the triggering action's response: **Leaf completion**, **answer submission**, **library add**, **cap reached** (inside completion, since `daily-cap` reads the row `accumulate` just wrote), and **a new `POST /events`**.

- **Ordering inside `completeLeaf` is load-bearing.** Evaluation runs after `accumulate` and `recordActiveDay`. Earlier would judge the reader against the day they had *before* the Leaf they just finished — a reader would reach a 3-day streak and not get `streak-3` until their next completion.
- **`finishTrackIfDone` now returns the rollup instead of discarding it**, feeding `track-complete` and `perfect-track`. Asking the CMS for the same Leaf list twice would double the cost of every completion. A swallowed failure reports `{ completed: false, perfect: false }`, so the badge is skipped this time and re-decided next time rather than awarded on incomplete information.
- **`perfect-track` is only checked on a complete Track.** Otherwise Flawless fires on the first correct answer of a twenty-Leaf book.
- **`POST /library/tracks/:trackId` is now 200 with `{ unlocked }`, was 204.** `first-book` has to reach the client in the response of the add that earned it. Still not 201 — the add is idempotent. Two integration tests encoded the 204 and were corrected; the mobile client tolerates a body-less response so an older backend degrades to "no achievements" rather than crashing the shelf's main action.
- **`awardQuietly` cannot fail its caller.** A completed Leaf has been paid for; turning an unwritable badge into a 500 would cost the reader the Leaf. Failures are logged and the next evaluation re-decides, because the predicates are monotonic.

#### `first-wrap` — an assumption you should check

The proposal lists `first-wrap` and names session wrap-up as an evaluation point; the handoff puts the **wrap-up screen** in WP9. I built the event, not the screen: `POST /events` accepts `session_wrap` alongside `dinner_table_open`, so all nineteen ship reachable and WP9 only has to call it. Generalising the endpoint the handoff described as "a small authenticated event endpoint" for DTK was the cheapest way to avoid shipping a tile nothing can award. **If you would rather `first-wrap` stayed unreachable until WP9, the change is deleting one enum value.**

#### Tier A, and the mutation check that found a hole

Award idempotency is covered at both layers, and finding out that it needed to be is the most useful thing this package's tests did.

- **Replay**: the completion that earns `first-leaf` announces it; the replay announces nothing and the row count stays 1.
- **Concurrency, through HTTP**: two simultaneous completions, exactly one announcement.
- **Concurrency, at the repository**: two `award` calls for the same badge in flight, one row and one winner.

**The third test exists because the first two did not catch a mutation.** Swapping `onConflictDoNothing` for an upsert left all nineteen endpoint tests green — the service filters already-held achievements before it ever calls `award`, so a replay never reaches the insert, and two concurrent completions usually serialise far enough apart that the loser also sees the winner's row. Both are fine behaviours; together they meant nothing exercised the unique index that the criterion is actually about. The repository-level race test goes red for that mutation and is the only one that does.

**Second mutation:** removing the engine's `alreadyHeld` filter reddens exactly one registry unit test. Both mutations were reverted and the full suite re-run.

Also Tier A: the migration creates both tables, the unique index exists, and **`users.total_xp` does not exist** — asserted, because that is how the ruling stays true.

#### Part C

`SUM(xp_awarded)` over `leaf_progress`, on `GET /progress/today`, which Profile already calls. `coalesce(..., 0)::int` — `sum` over no rows is null, and `sum` over an integer column is `bigint`, which `pg` returns as a **string**; `"180"` would render correctly and then misbehave the moment anything added to it. **No new index: the existing `leaf_progress_user_id_idx` covers it**, which the handoff's "indexed on `user_id`" already asked for.

`DayStatus` was declared in the mobile client and is now `ReaderStanding` in `delivery.ts` — the duplication CLAUDE.md forbids, fixed while adding a field to it rather than doubled.

#### `delivery.ts` and `gamification.ts` — additive, with the note the constraint asks for

- **`delivery.ts`**: `unlocked` added to `AnswerOutcome` and `CompletionOutcome`; new `ReaderStanding`. Additive; both apps compile.
- **`gamification.ts` was rewritten, not extended.** Its WP0 shape keyed an achievement by `uuid` and implied a table of achievement rows; the proposal rules a code registry, so identity is a slug. The file carried a `PROVISIONAL` header naming WP5 as where it would be settled, and nothing imported it. `UserAchievement` and `iconUrl` are gone.

#### Deferred — Tier C, for WP14

1. **The device check**, above, and with it the four items it was carrying: WP5a's cap-screen copy, an achievement unlock seen on a device, **iOS Reduce Motion on the WP8 unlock animation** (still WP8's open 11th criterion), and both themes at XXXL.
2. `AchievementUnlock` and the Profile grid have **no component render tests** — no theme permutations, no XXXL layout assertions, no locked/unlocked visual states. The grid's flow-wrap layout was chosen to survive XXXL by construction and has not been seen at XXXL.
3. Failure paths on `POST /events` and `GET /achievements` beyond the two auth/validation cases.
4. `awardQuietly`'s swallow path is not tested — a broken award is silent by design, and nothing asserts the log line.
5. No test covers a reader crossing `sharp-5`/`sharp-10`, `comeback-10`, `leaves-20` or any streak threshold end to end; those predicates are unit-tested against literals only. Reaching them through HTTP needs 5–20 completions per test.

#### One environment note for the next session

**Node is not on the default `PATH` in a non-interactive shell here** — it lives at `~/.nvm/versions/node/v22.23.2/bin`, and `nvm` is a shell function that does not load. Every command in this package was prefixed with `export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"`. Worth knowing before concluding that `npm` is missing.

### Completed: WP5a — Session cap and streaks — 2026-08-12

**Status:** 7 of 8 acceptance criteria verified by execution. **The device check is not done** — the reason is environmental and is below, not buried. Cold gate green with `dist` and `.next` deleted: lint, typecheck, test and build all exit 0.

**Branch:** `wp5a-session-cap-streaks`, from `main` at `e60e8f4`.

#### Where the time went

Roughly: a fifth on schema, migration and config; a fifth on the two upserts; a fifth on service integration; **two fifths on tests**, split between writing them and two detours worth naming — a Postgres type-inference failure and a token expiry that masqueraded as a date bug. Both are recorded below because both will recur.

#### The cap, and the one design decision inside it

**15 minutes or 500 XP, whichever first, evaluated server-side.** Both thresholds are validated config, never literals.

The decision worth review: **the cap does not interrupt.** A reader under the cap when they open a Leaf is paid in full for it even if finishing crosses the line; the *next* Leaf earns nothing. That is how "an in-progress Leaf finishes rather than being cut off" and "XP past the cap is not awarded" are both true at once. Refusing the completion instead would discard work already done, which is the cruel reading of a wellbeing feature. `calculateLeafXp` is not told about capping — it answers what was earned, the cap decides what is paid.

**Session time is measured as elapsed time per Leaf, clamped.** That is the only signal available without a client heartbeat, and it is wrong in a known way: a reader who opens a Leaf and finishes it the next morning would otherwise spend the whole day's budget on one Leaf. `SESSION_MAX_LEAF_SECONDS` (300) bounds it, which under-counts a genuinely slow reader — erring toward letting them keep reading. **A real activity signal is not this package and should be scheduled.**

#### Tier A, and the mutation checks

Every local-date and upsert criterion is covered against real Postgres, because the guarantees are written in SQL — `ON CONFLICT`, `greatest`, date arithmetic — and a JavaScript re-implementation in a unit test would prove the re-implementation.

- **Cap on XP**, with the time cap set out of reach so nothing else could have fired.
- **Cap on time**, with the XP cap set out of reach, backdating `started_at` so the elapsed subtraction is the real one.
- **A Leaf in progress finishes and is paid.**
- **Local midnight, not UTC**: an Auckland reader at 10:00 and 12:00 UTC — one UTC date, two local dates, two `daily_session` rows, streak 2.
- **A DST day is one day**: London across the 2026-03-29 spring-forward, streak 2. A streak built on subtracting 86,400 seconds breaks here.
- **Both upsert branches, named**: the INSERT on the first completion of a day and the `ON CONFLICT` on the second, for `daily_session` and for `streak` separately.
- A gap breaks the streak and `longest` survives it; two completions in one day do not double-count.

**Three mutations, each killing exactly one test:** replacing the `daily_session` accumulate with an overwrite reddens only the ON CONFLICT test; making the streak's same-day branch increment reddens only the double-count test; removing the cap's XP zeroing reddens only the XP-cap test.

#### Two detours worth recording

**A `CASE … ELSE NULL` beside a bound parameter fails to plan.** Postgres cannot infer a type for an untyped `NULL` opposite a parameter, and the whole upsert failed — surfacing as a 500 on completion, with twelve integration tests reporting `expected undefined to be false` and nothing resembling a type error anywhere. Explicit `::timestamptz` and `::int` casts fix it. Anyone writing a conditional upsert in this codebase will meet this.

**A 24-hour test span expires a 15-minute access token.** The local-midnight tests advance the clock across a day boundary, which also advances it past token expiry, so the second request 401s and the failure reads exactly like a date bug. The day-crossing tests use a tuned app with a week-long TTL — isolating the subject rather than working around it.

#### Not done: the device check

**The handoff asks me to hit the cap on a device and judge whether it reads as a good place to stop. I have not.** The backend is not running and will not start from `npm run dev` — `tsx watch src/index.ts` does not load `.env`, so `DATABASE_URL` and `AUTH_JWT_SECRET` are undefined. It ran earlier today, so the founder starts it some other way; I did not want to guess at their setup or invent a second one.

What that leaves unverified is the only thing that matters about this feature: **whether "That is today done" reads as an ending or as a refusal.** The copy avoids "limit", any warning tone and any lock iconography, and sits on a card below the XP the reader just earned — but that is design intent, not evidence. It needs eyes.

The streak surface on Profile is in the same position: built, typechecked, unit-covered, unseen.

#### Contract change needing sign-off

**`CompletionOutcome` gained a `session` field, and `delivery.ts` gained `SessionStatus` and `StreakStatus`.** The handoff flags `delivery.ts` as a cross-workspace contract to treat with the care of a frozen file. The change is additive and both apps compile, but it is a change to the file you named. The thresholds travel with the state deliberately: the limit screen has to say "500 XP", and a client that knew that number independently would go stale the first time the cap moved.

New endpoint: `GET /progress/today`, returning both. No date parameter — a client that sent its own could reset its cap by changing the device clock.

#### Deferred

1. **The device check**, above.
2. A real activity signal to replace elapsed-time-per-Leaf.
3. Tier C: cap and streak render permutations, theme matrices.
4. Carried from WP8 and WP11 and still open: reduced-motion verification, re-reading a finished Track, the three XXXL layout items.

### Completed: WP8 — The Leaf player: five slides, the unlock gate, sound — 2026-08-12

**Status:** 10 of 11 acceptance criteria verified by execution; one verified by inspection rather than observation, and said so below. Cold gate green with `dist` and `.next` deleted: **816 tests** (64 shared, 161 admin, 366 backend, 225 mobile), lint, typecheck and build all clean with real exit codes.

**Branch:** `wp8-leaf-player`, from `main` at `20e9ef4`.

#### The loop works on a device

Signed in cold, opened the Demo Track from Journey at Leaf 8 — the server's resume target after seven complete — and played it through: summary, scenario, a deliberate wrong answer, a correct one, payoff, sticky notes, takeaway, finish. **"+80 XP", not 100, because the first answer was wrong.** That is the first-try differential demonstrated end to end; the earlier API run paid 100 for a first-try correct answer on the same corpus.

The unlock renders as designed: amber open padlock, "UNLOCKED", the payoff card with an amber edge, prose in the `payoff` type variant WP6 reserved for exactly this slide.

#### What shipped

| Piece | Location |
|---|---|
| Delivery types, moved out of the backend | `packages/shared/src/delivery.ts` |
| `getLeaf`, `startLeaf`, `submitAnswer`, `completeLeaf` | `apps/mobile/src/api/client.ts` |
| Stack above the tabs, so a Leaf opens from either surface | `apps/mobile/src/navigation/AppStack.tsx` |
| The five slides | `apps/mobile/src/screens/leaf/*Slide.tsx` |
| The loop as a state machine | `apps/mobile/src/screens/leaf/useLeafSession.ts` |
| The player chrome | `apps/mobile/src/screens/leaf/LeafPlayerScreen.tsx` |
| Sound: trigger points, no assets | `apps/mobile/src/sound/` |
| Explore pagination | `apps/mobile/src/screens/useMoreTracks.ts` |

**`DeliveredLeaf`, `AnswerOutcome` and `CompletionOutcome` moved to `packages/shared`.** They were defined inside `apps/backend`, and WP8 made the mobile app their second consumer — CLAUDE.md allows one definition of a shape that crosses a workspace boundary. A new module rather than an addition to `content.ts`, which is frozen. The backend re-exports them so no call site changed.

#### Two defects found by playing it, not by testing it

**1. The check button stayed armed with a wrong answer.** After submitting option A and being told it was wrong, A was struck out — but "Check answer" remained enabled with A still selected, so one more tap resubmitted it. That spends an attempt to be told the same thing, which is the precise cost that separating "select" from "check" exists to avoid. The selection is now derived and goes dead the moment its option is graded wrong. Mutation-checked: removing the guard fails exactly that test.

**2. An infinite render loop in the pagination hook.** The tail reset was keyed on the first page's *object identity*. `useAsyncResource` happens to hold a stable object so the screen was fine, but any caller building the page inline re-fires the effect every render — an unbounded update loop and a hard crash, one prop-shape change away. Found because the test did exactly that and killed the jest worker. Now keyed on a content signature, which is also better semantics: a refresh returning the same catalogue keeps the tail and the reader's scroll position.

#### Tier A, and where it lives

The backend's Tier A ground was already covered by WP4 and WP7's second pass — `isCorrect` absent from every route (`progress.integration.test.ts:508`), concurrent and replayed completion (635, 617), twelve wrong answers then a correct one (365), the takedown cascade (1040+). Duplicating it would have added no information.

**WP8's Tier A is therefore on the client**, which is genuinely new ground:

- The payoff is absent from **client state**, asserted on the session object and on a `JSON.stringify` of it — not on what renders. A test that only checked the payoff was off-screen would pass against a client that had fetched the prose and hidden it.
- A locked payoff is a **navigation** gate, not a rendering one: there is no route past the scenario. Mutation-checked.
- A fast double-tap on Finish submits once. The guard is a ref, not state, because both handlers land in one React batch; the bug it prevents is not double XP — the server is idempotent — but the second response arriving with `xpAwarded: 0` and telling a reader who double-tapped that they earned nothing. Mutation-checked.
- A 404 mid-session is fatal and readable, and the message does not name the Track — the backend hides which Track was withdrawn, and the client must not undo that.

#### Reduced motion — verified by inspection, not by observation

`useReducedMotion` gates the branch, and with it on the payoff fades over `duration.standard` instead of springing. **I did not observe the difference on a device.** A static screenshot cannot distinguish a spring from a fade, and I am not going to claim a feel I did not experience. What is verified: the branch exists, the reduced path still animates rather than snapping, and the payoff renders either way. Someone should watch it with the setting on before this is called done.

The same caveat applies to the unlock itself. I saw the end state, which is correct. **How it feels is unverified** — that judgement needs a human watching the transition, and it is the one thing in this package worth your own thirty seconds.

#### One product observation worth a ruling

**A correct answer auto-advances to the payoff slide.** The reader does not tap Next — the gate opens and the screen changes in the same moment. That makes the reward land during a slide transition, so the spring competes with the navigation. It may be exactly right, or the unlock may want to happen *on* the scenario slide before moving. It is a design decision I made by implication and should not have made alone.

#### Deferred — WP14 worklist

1. **Reduced-motion and unlock feel on a device**, per above.
2. **Re-reading a finished Track from Library.** `nextLeafId` is null once a Track is complete, so a finished book has no way back in. Fixing it means a `firstLeafId` on `TrackProgressSummary` — a shared-type change plus backend rollup work the handoff did not ask for.
3. Slide-component render permutations and theme matrices (Tier C, as scoped).
4. The three XXXL layout items carried from WP11 — headers wrapping, Library pushing progress below the fold, cover thumbnails not scaling.

#### Closed from WP11

**The partial rollup now renders on device**: Journey showed "7 OF 20 COMPLETE" with the bar a third filled, then 8 of 20 after finishing a Leaf. WP11 deferred this because it needed a signed-out simulator; the app had signed itself out, so it came free.

### Completed: WP11 — Seed fixture: a full-length placeholder Track — 2026-08-12

**Status:** 10 of 11 acceptance criteria verified by execution. One deferred by founder decision (below). Gate green: **792 tests** (64 shared, 161 admin, 366 backend, 201 mobile), lint, typecheck and build all clean.

**Branch:** `wp11-seed-fixture`, from merged `main` (`9c360fc`).

#### What shipped

| Piece | Location |
|---|---|
| Cover-image publish rule | `apps/admin/src/validation/trackRules.ts` — `checkCoverUrlIsImage` |
| Placeholder corpus generator | `apps/admin/src/seed/placeholderContent.ts` |
| Payload REST client | `apps/admin/src/seed/payloadRestClient.ts` |
| Idempotent seed runner | `apps/admin/src/seed/seed.ts` — `npm run seed --workspace=apps/admin` |
| Operator bootstrap/reset | `apps/admin/src/scripts/createAdmin.ts` — `npm run create-admin --workspace=apps/admin` |
| Draft-exclusion integration tests | `apps/backend/test/content.integration.test.ts` |
| `serveDrafts` on the CMS fake | `apps/backend/test/helpers/fakePayload.ts` |

The corpus: one 20-Leaf Track, 25 filler Tracks, one draft Track and one draft Leaf. Every record carries `isPlaceholder: true`; the Track is attributed to "ZoomOut Sample Content (not a real author)".

#### The draft gap is now closed by observation, not inference

This is the result worth reading first. WP7 could only establish that `read: publishedOrAuthenticated` *should* exclude drafts — the corpus contained none, so the empirical check was consistent but not discriminating. There is now a draft Track and a draft Leaf in the database.

Against the live CMS: **28 Tracks exist, 27 reach an anonymous caller.** The draft Leaf is likewise absent. Five Tier A integration tests cover the same ground against `fakePayload`, mutation-checked — disabling `isVisibleIn` fails six.

#### Three defects the seed exposed

The handoff predicted manual verification would be the real test. It was; the assertions all passed while the device found these.

**1. The flagship Track was unreachable.** Explore sorts by `bookTitle` ascending, 20 per page. Under its original title the 20-Leaf Track sorted 26th of 27 — page two, which the app has no affordance to reach. The seed's entire deliverable was invisible on device while every test passed. Renamed to "Placeholder Demo Track", which sorts ahead of all 25 fillers, with a mutation-checked test pinning that ordering.

**2. The covers were invisible.** I had set the placeholder image background to `#141A1E`, the app's own card colour. The images loaded correctly but had no visible edge, so a working cover and a failed one looked identical — a fixture unable to demonstrate the thing it exists for. Now a mid-tone slate that reads against both themes.

**3. `bookTitle` is the upsert key, so renaming orphans records.** Added `RETIRED_TRACK_TITLES` and a delete step, guarded on both a hardcoded name list and the `isPlaceholder` flag, so the seed stays correct across fixture revisions rather than only on a fresh database.

#### Verified on device (iPhone 16 Pro Max, Expo Go)

- Explore: 27 Tracks, Demo Track first, covers rendering as images rather than the fallback
- Library: **0 OF 20 COMPLETE** — the 20-Leaf Track wired end to end through the rollup
- Library: a zero-Leaf filler Track shows "NO LEAVES YET" rather than "0 of 0"
- Journey: correctly omits the zero-Leaf Track, since there is nothing to resume
- Both themes, and `accessibilityExtraExtraExtraLarge` in both

Rollup at partial completion verified **at the API** — 7 of 20, `status: active`, `nextLeafId: 9`, `isComplete: false`, 700 XP at 100/Leaf. The Leaf player is WP8, so partial progress cannot be produced by tapping; it was driven through the WP4 loop with a synthetic local test user.

#### Deferred — WP14 worklist

1. **On-device render of the partial rollup.** Founder decision, 2026-08-12: showing it requires signing the simulator out of the app account, whose password is not to hand. Verified at the API instead.
2. **Explore has no pagination affordance.** It stops dead at 20 items — no "load more", no infinite scroll, no indication anything follows. The corpus now crosses the boundary (27 vs `DEFAULT_PER_PAGE = 20`), so this is live, not theoretical. The Track rename routes around it; it does not fix it.
3. **Screen headers wrap badly at XXXL.** "Explore" breaks across two lines with a single orphaned "e".
4. **Library pushes progress below the fold at XXXL.** With a realistic-length title the progress bar and completion count need a scroll. No clipping — WP6's fix holds — but the most important information on the screen is off it.
5. **Cover thumbnails do not scale with text**, so at XXXL a five-line title sits beside a small fixed cover.
6. Exhaustive validation permutations on the cover rule (Tier C, as scoped).

#### Needs an Architect ruling

**"The mountain is you" is still published.** WP7's hand-authored Track, plus one Leaf. It carries `isPlaceholder: true` so it cannot reach production, but it is attributed to **Brianna Wiest, a real author**, and `LEGAL.md` names invented content under a real writer's name as the highest-severity risk in the product. Its `coverUrl` is an Amazon product page, so it renders the fallback — and it now *fails* the new cover rule, meaning the CMS will refuse to re-publish it. It is only still live because it predates the rule. My recommendation is to unpublish it; the placeholder corpus supersedes what it was for. Not actioned — it is authored content and not mine to remove.

#### Scope note

`createAdmin.ts` was not in the handoff. The seed authenticates as a CMS operator, and the only way to obtain one was Payload's create-first-user screen — which works exactly once per database and is unrecoverable afterwards, since this instance has no outbound email and so cannot deliver a password reset. We hit that wall during this package. The script runs through `payload run`, which calls `loadEnv()` before dispatching, so `.env` is read by Payload rather than passed in by hand, and which exits via `process.exit(0)` rather than `payload.destroy()` — sidestepping the pool-shutdown defect WP1 recorded against the Local API.

### Completed: WP7 — Mobile surfaces: Explore, Library, Journey — 2026-08-11

**Status:** All 11 acceptance criteria verified by execution. Cold gate green with
`packages/shared/dist`, `apps/*/dist` and `apps/admin/.next` deleted first: install, lint,
typecheck, test, build. **714 tests** (346 backend, 196 mobile, 108 admin, 64 shared), of
which **63 are new** — 50 mobile, 13 backend. CI runs on the branch.

Verified against the **real backend and the real CMS**, not only fixtures: Explore lists
"The mountain is you" from Payload, adding persists, and Library reads back
`0 of 1 complete` from the new rollup.

**What changed:**

- **`apps/backend/src/progress/trackProgress.ts`** — the rollup, as a pure function.
  Plus `listCompletedLeafIds` on the repository and `summariseTrack` on the service.
- **`apps/backend/src/library/`** — `LibraryService` now composes content and progress, so
  every library entry carries its own `TrackProgressSummary`. `setStatus` added to the
  repository.
- **`apps/backend/src/content/content.repository.ts`** — the placeholder filter pushed into
  the Payload query in production, for accurate pagination totals.
- **`packages/shared/src/progress.ts`** — `trackProgressSummarySchema`. Reason stated
  below; `content.ts` untouched.
- **`apps/mobile/src/screens/`** — Explore, Library, Journey, `useAsyncResource`,
  `useRefreshOnFocus`. The three WP6 shells are gone.
- **`apps/mobile/src/components/`** — `Icon` (the icon set), `TrackCard`, `ProgressBar`,
  `ErrorState`.
- **`apps/mobile/src/api/client.ts`** — content and library methods on the existing client.

**Files touched:** 31. 14 new, the rest edits.

**Tests added:** 63.
- **Rollup (12)** — zero, partial and complete; the resume target skipping to the
  *earliest* gap rather than the furthest reached; out-of-order and non-contiguous
  `orderIndex`; and an empty Track, where `completed === total` is true at 0 and must not
  read as finished.
- **Backend integration (13)** — the rollup through `GET /library`, per reader; the
  denominator following a takedown; `user_tracks.status` reaching `completed` and being
  written to the database; a Track finished by a reader who never added it; and the two
  pagination tests below.
- **Mobile (38)** — each surface in both themes across loading, empty, error and
  populated; the 503 path on all three with a retry that actually re-requests; Explore's
  add and its failure; Journey's resume target; and the render tests WP6 skipped for
  `ProfileScreen`, `RootNavigator` and `TabShell`.

**Decisions taken, with reasoning:**

1. **The rollup is derived per request, never stored.** A counter on `user_tracks` would
   be a second source of truth, and it would drift the first moment a Leaf is added to a
   Track or taken down. The cost is one extra query per library entry; the alternative is
   a number that is wrong and looks authoritative.
2. **`LibraryService` composes it, not `ProgressService`.** Progress knows what a reader
   finished; content knows which Leaves they may see. Library sits above both. Putting the
   rollup in progress would have meant it fetching content — and doing that through
   `ContentRepository` would have skipped the placeholder guard, so a production reader
   would see "3 of 20" for a book currently offering three.
3. **`user_tracks.status` flips at completion time, not on read.** Deciding it while
   rendering the library is a write on a read path, and it would leave the status wrong
   for any reader who never opens their Library. Failures are logged and swallowed: the
   reader has finished the Leaf and been paid, and a bookkeeping problem must not undo
   that. The next completion re-evaluates it.
4. **The Payload query filter is an optimisation; the service guard is the control.**
   Both are tested, and the second test is the important one — it makes the CMS ignore the
   filter entirely and asserts no placeholder reaches the reader. **Mutation-checked:**
   removing the query filter fails the totals test and leaves the guard test green.
5. **Ionicons, via `@expo/vector-icons`.** A font, so `color` and `size` behave like text
   properties and every icon takes the tint — which is exactly what WP6's text glyphs
   failed at. Maintained against the SDK, so no `react-native-svg` peer to break on
   upgrade. Names go through a closed map in `Icon.tsx`, so swapping sets is one file.
6. **Journey filters on `nextLeafId !== null`, not `!isComplete`.** They differ for a Track
   with no visible Leaves — not complete, but nothing to resume either — and filtering on
   the resume target means the list can never show a card whose button has nowhere to go.
7. **`resumeAt(leafId)` is a named function, not an inline no-op.** The Leaf id is the part
   with an acceptance criterion on it. WP8 replaces the body rather than hunting through
   JSX. **Mutation-checked:** pointing resume at the Track id instead fails that test and
   only that test.

**Findings — three defects the tests could not have caught, all found in the simulator:**

1. **Switching tabs never refetched.** React Navigation keeps tab screens mounted, so each
   screen fetched once and then never again: add a book in Explore, open Library, and the
   shelf still shows what it read before the book existed. Every component test mounts one
   screen in isolation, where this cannot happen. Fixed with `useRefreshOnFocus`.
2. **My own icon sizing shrank icons as text grew.** I divided `size` by the OS font scale
   to cancel a multiplication that `@expo/vector-icons` never applies — icons rendered at
   about 9pt at `accessibilityExtraExtraExtraLarge`. Nothing asserts on rendered point
   size, so only looking at it caught this.
3. **A `display` heading pinned above the list ate half the viewport at XXXL.** The titles
   now scroll with their lists.

**Environment caveat worth recording:** changing the OS text size while the app is running
leaves Expo Go rendering text with the *old* line height — glyphs clip to thin slices and
it looks like a serious layout bug. It is not: a cold restart with the size already set
renders correctly. I lost time treating it as real, and re-verified everything after a
restart. **Verify accessibility sizes from a cold start, not by toggling live.**

**Assumptions made:**

- **The rollup rides on `GET /library` rather than a dedicated endpoint.** The handoff
  allowed either. Library and Journey both need Track *and* progress together, and a
  separate endpoint would mean two requests to render one list.
- **Journey shows unfinished Tracks only.** A finished book belongs on the shelf; leaving
  it in Journey makes a second Library that only grows.
- **Explore paginates but the UI does not page yet.** `listTracks(page, perPage)` takes
  both and the response carries `totalPages`; with one Track in the CMS there is nothing to
  page through, and infinite scroll against a one-item list would be untested code.

**Follow-ups / tech debt for Architect:**

1. **The rollup is N+1 against the CMS.** Each library entry costs a Track fetch and a Leaf
   list. Cached and concurrent, and fine for a shelf of a few books — but a reader with
   thirty is thirty Leaf-list requests per open. Worth a batch read or a longer cache
   before real content lands.
2. **No pagination UI in Explore.** See the assumption above.
3. **Cover images are unvalidated URLs.** The seeded Track's `coverUrl` points at an Amazon
   *page*, not an image, so every card shows the fallback. `trackSchema` requires a URL,
   not an image — worth a CMS-side rule before WP11 seeds real content.
4. **`GET /library` is unbounded.** No page parameter; a large library returns in one
   response.
5. **Still no reader total XP** — carried from WP4, and WP5 now owns it.

**What WP8 inherits:**

- `progress.nextLeafId` is the resume target, already correct and asserted on the id.
  `resumeAt()` in `JourneyScreen.tsx` is the single call site to replace with navigation.
- `useAsyncResource` gives any new screen loading, error-with-retry and pull-to-refresh in
  four lines, with reader-safe error text already separated from internal messages.
- `Icon` is the only place icons come from; add a name to its map rather than importing
  Ionicons.
- `TrackCard` takes an `action` and `children`, so the Leaf player's entry point is a prop
  rather than a fourth variant of the card.

---

## Addendum: WP7 second pass — takedown cascade and four others — 2026-08-11

Five required fixes and two cheap ones from founder review. All seven done. Cold gate
green: **734 tests** (361 backend, 201 mobile, 108 admin, 64 shared), 39 new here.

**1. Takedown cascade — Tier A, and it was the real one.**

`ContentService.getLeaf` and `ProgressService.requireVisibleLeaf` checked only the Leaf's
own `status` and `isPlaceholder`. Unpublishing a **Track** — which is how a legal
complaint is actually answered, one click on the book rather than twenty on its Leaves —
cleared Explore, the library and resume, while `GET /content/leaves/:id` carried on
serving the full Leaf and the progress endpoints carried on grading it and **paying XP
for it**.

Both call sites now go through `resolveVisibleLeaf`, which resolves the parent and
applies the same predicate. Written once, in `contentVisibility.ts`, because two copies
of a takedown rule is how one of them gets missed — which is precisely what happened
here. Details worth keeping:

- **The 404 names the Leaf, never the Track.** A reader who asked for a Leaf is not
  entitled to learn that its parent is the reason it is gone.
- **A deleted Track is handled as well as an unpublished one.** `findTrack` throwing
  `ContentNotFoundError` is caught and re-thrown as a missing Leaf, so it cannot surface
  as a 500.
- **Cost is one extra CMS read per Leaf**, served by the existing TTL cache. Correct
  trade against serving content somebody has demanded be removed.
- Enforced in the backend, not by a CMS hook cascading the flag onto children: a hook is
  a migration that can half-run, and it would leave the backend trusting a denormalised
  copy of the answer.

**Mutation-checked.** Removing the parent check fails six unit tests. Interestingly it
fails *no* integration tests — the fake CMS makes an unpublished Track vanish entirely,
so those exercise the deleted-Track branch while the unit tests exercise the
draft/placeholder branch. Both branches are real and both are now covered; worth knowing
that neither layer alone would have caught this.

**2. `user_tracks.status` could stick at `active` forever.** `finishTrackIfDone` sat
below the early return for a replayed completion, so the rollup only ever ran on the call
that awarded XP. Two live paths reached the stuck state: a reader who finishes every Leaf
and *then* adds the Track, and a `setStatus` failure on the final Leaf (swallowed by
design). Moved above the return, which makes a replay self-healing. Two integration tests
cover the add-late path and the archived-Track path.

**3. The tautological completion test is gone.** It never answered Leaf 11, so `complete()`
hit `LeafNotUnlockedError` and `expect([200, 409]).toContain(...)` accepted the 409 — the
scenario in the title was never exercised. Now answers first and asserts 200.

**4. A failed pull-to-refresh is no longer silent.** `useAsyncResource` forced `status`
back to `ready` when stale data existed, and no screen read `error` unless
`status === 'error'`, so during an outage the spinner simply retracted. Added a separate
`refreshError` field — separate precisely so a screen cannot render one and forget the
other, which is what sharing `error` caused — and all three screens show it above the
retained list. Mutation-checked; verified on device by killing the backend mid-session.

**5. Explore no longer claims a membership it could not check.** When the library fetch
failed, `inLibrary()` fell through to `false` and every card read "Add to library",
including books already on the shelf. The screen now says the shelf could not be checked
and stops asserting either way. Adding stays available, because it is idempotent
server-side.

**Cheap fixes:**

- `setStatus` guarded with `ne(status, 'completed')`, which matched *every* other status —
  finishing a Leaf would have resurrected an `archived` Track. Now `eq(status, 'active')`.
- **The `EmptyState` comment was wrong, and so was the code it described.** It claimed
  `Icon` "cancels the OS font scale internally". `Icon` cancelled nothing — the vendored
  `create-icon-set.js` already defaults `allowFontScaling: false`, so React Native never
  multiplied the size, and my division by `fontScale` was **shrinking every icon as the
  reader's text grew** — to roughly 40% at XXXL. Visible in the earlier XXXL screenshots,
  where I attributed the small tab icons to a stale render. The division is gone; `size`
  is now a literal point size. The review caught the wrong explanation; the explanation
  was wrong because the code was.

**Confirmed rather than fixed blind:**

**Drafts cannot reach the backend, and no `_status` filter should be added.** Both
`Tracks` and `Leaves` set `read: publishedOrAuthenticated` (`apps/admin/src/access/`),
which returns a `_status: { equals: 'published' }` constraint for any request without
`req.user` — and `PayloadClient` calls anonymously. Verified at the config, which is
definitive. The empirical check against the running CMS is *consistent* but not
discriminating: the corpus has exactly one Track and one Leaf, both published, so there
is no draft to be excluded. A redundant query filter would add a second thing to keep
correct for no gain.

**Manual device verification** (mandatory under the new bar), all from cold starts:

| | dark / default | dark / XXXL | light / default | light / XXXL |
|---|---|---|---|---|
| Explore, Library, Journey | ✅ | ✅ | ✅ | ✅ |
| Refresh-error banner + retained list | — | ✅ | — | — |

Icon sizing re-verified at XXXL after the scaling fix; the earlier pass had run with the
shrinking bug in place.

**Added to WP14's worklist** (on top of the seven already listed):

8. **`fakePayload` ignores `page` and `limit`** and always answers page 1 of 1, so nothing
   covers real pagination — including the `listTracks` totals fix, which is verified only
   for the placeholder filter on a single page.
9. **No draft-visibility test against the real CMS.** The access rule is confirmed by
   reading the config; proving it empirically needs a draft document in the corpus, which
   WP11's seed should create.
10. **The takedown cascade costs an extra CMS read per Leaf.** Fine behind the TTL cache
    today; worth measuring once WP8 puts the Leaf player on that path.

---

## Addendum: WP7 — the app did not launch, and the new testing bar — 2026-08-11

Two things after WP7 was committed at `44ab716`.

**1. A blocking defect the whole gate missed: the app failed to launch.**

`Unhandled JS Exception: [runtime not ready]: Error: Cannot find native module 'ExpoAsset'`,
then `expo-asset could not be found within the project`. Adding `@expo/vector-icons`
pulled `expo-asset` in **transitively**, at a version the SDK did not expect and as
nobody's declared dependency. Fixed by installing it properly (`expo install expo-asset`,
which also registered its config plugin) and reinstalling the workspace so the root copy
matched.

**The important part is what did not catch it.** Lint, typecheck, 714 tests and the build
were all green against an app that could not start. Nothing in the automated gate boots
the bundle — component tests mount React trees under Jest, where native module resolution
never happens. Only opening it on the simulator found this, which is the argument for the
new bar's trade in one paragraph.

A second, self-inflicted lesson: **two Metro processes were bound to port 8081** and the
stale one kept serving a broken bundle through three restarts and a `--clear`. It also
produced a convincing fake defect — a stretched, broken-looking Track card in light mode
that I nearly chased as a layout bug. It was the dead bundle. `lsof -ti:8081` before
trusting any simulator observation.

**2. The testing bar changed mid-package** (founder, 2026-08-11): development velocity is
the priority until the app works end to end. Tier A invariants stay mandatory, Tier B is
one happy path plus one failure path, Tier C defers to WP14, and **manual device
verification in both themes and at `accessibilityExtraExtraExtraLarge` is now mandatory in
exchange**.

Applied from here. WP7's own tests were written under the old bar and are staying — they
are already written, they pass, and deleting them would spend effort to reduce coverage.

**Manual verification actually performed for WP7**, against the real backend and CMS:

| Surface | dark / default | dark / XXXL | light / default | light / XXXL |
|---|---|---|---|---|
| Explore | ✅ | ✅ | ✅ | ✅ |
| Library | ✅ | ✅ | ✅ | ✅ |
| Journey | ✅ | ✅ | ✅ | ✅ |

Every XXXL check was done from a **cold start with the size already set** — changing it
while the app runs leaves Expo Go rendering stale line heights, which looks like a severe
layout bug and is not one.

**Deferred to WP14 — the worklist starts here:**

1. **A launch smoke test.** The gap above: nothing proves the bundle boots. A Detox or
   Maestro check that launches the app and asserts one screen rendered would have caught
   the `ExpoAsset` failure, and will catch the next native-module regression. **Highest
   value item on this list** — it is the only one covering a failure that reached a
   committed state.
2. **`expo install --check` in CI.** It currently reports `expo@57.0.11 → 57.0.12` and
   `jest-expo@57.0.3 → 57.0.4`. Version drift is what produced the defect above; a check
   that fails the build is cheap.
3. **`useAsyncResource` has no direct unit tests.** Covered indirectly through the three
   screens — the generation guard against a slow first response landing on top of a fast
   retry is the part worth testing on its own.
4. **`useRefreshOnFocus` is untested.** It degrades outside a navigator by design, and the
   navigator path is exercised only manually. Tier B would want one test that a focus
   event triggers a refetch.
5. **`ProgressBar` and `TrackCard` have no dedicated tests** — only assertions through the
   screens that use them. The zero-of-zero guard against `NaN%` is the case worth pinning
   directly.
6. **No test for the Explore add/remove optimistic override** beyond the happy path and
   one failure. The remove-then-refresh interaction is manual-only.
7. **Backend `listCompletedLeafIds` with an empty id list** is guarded in code and covered
   only through the rollup. Worth one direct test.

### Completed: WP6 — Mobile shell: design system, navigation, auth, age gate — 2026-08-11

> **Second pass, 2026-08-11 — see the addendum at the end of this entry.** Founder review
> rejected the first pass on six required fixes plus two cheap ones. All eight are done.
> **14 of 15 criteria are now verified**, including two this entry originally claimed
> wrongly: font scaling (criterion 13 was falsified on the tab shells) and reduced motion
> (the "no animation to swap" premise below was simply untrue). The numbers and the "what
> is not verified" section in this entry are superseded by the addendum.

**Status:** 13 of 15 acceptance criteria verified by execution. **Two cannot be closed by
this package and neither is a code defect** — the real Apple/Google round trip (no OAuth
client is registered anywhere) and reduced-motion behaviour (WP6 ships no animation to
swap). Both are detailed under "What is not verified" and neither is a blocker for merge;
they are blockers for *claiming* those two lines.

Cold gate green with `packages/shared/dist`, `apps/*/dist` and `apps/admin/.next` deleted
first: lint, typecheck, test, build. **644 tests** (321 backend, 151 mobile, 108 admin,
64 shared), of which **148 are new here** — 145 mobile, 3 backend. CI runs on the branch.

**What changed:**

- **`apps/mobile/src/design/`** — the durable part. Colour tokens for both themes,
  type scale, spacing/radius, motion constants, `ThemeProvider`, and a WCAG contrast
  function the token values were *tuned against* rather than asserted to.
- **`apps/mobile/src/api/`** — typed client over the backend's error codes, keychain-backed
  token store, single-flight refresh.
- **`apps/mobile/src/auth/`** — session state machine, UX-only age check, device timezone,
  the `SocialAuthProvider` port with an Apple implementation.
- **`apps/mobile/src/components/`, `src/screens/`, `src/navigation/`** — six components,
  nine screens, auth stack and four-tab shell.
- **`apps/backend/`** — a small but necessary change: `AppError.responseFields`, so
  `SIGNUP_DETAILS_REQUIRED` can actually tell the client which fields are missing. See
  finding 1; **this was blocking an acceptance criterion**.
- Removed: WP0's boot screen and `bootSummary`, superseded by the real app. Its
  placeholder-warning logic returns in WP7 against real content.

**Files touched:** 38. 30 new under `apps/mobile/src`, plus `App.tsx`, `app.json`,
`package.json`, `tsconfig.json`, three new config files (`jest.config.js`,
`jest.setup.js`, `babel.config.js`), and four backend files.

**Decisions taken, with reasoning:**

1. **Jest, not Vitest, in `apps/mobile` — resolving WP0's open question.** Every other
   workspace runs Vitest and splitting the tooling is a real cost, so: rendering React
   Native under Vitest means transforming RN's Flow-typed source, stubbing every native
   module a tree touches, and maintaining that across SDK upgrades. `jest-expo` is
   versioned against the SDK and ships exactly that. The constraint was to stay *out of
   the way of Expo's own config*, and the preset Expo maintains is the only option that
   does. **Mitigation: one runner per workspace** — Jest is now the sole runner in
   `apps/mobile`, covering pure logic and components alike; Vitest is untouched elsewhere.
2. **React Navigation, not Expo Router.** The handoff's scope named `src/navigation/` and
   `src/screens/`; Expo Router wants a file-based `app/` tree and would have restructured
   both. No functional advantage here to justify that.
3. **Light-theme values are new, not derived.** §3 specifies a light theme from day one
   with *its own* values. `#3DDCC8` on white is 1.6:1 — invisible. The light teal is
   `#006A5E`, chosen by measurement (see finding 2), and there is deliberately **no shared
   base palette** the two themes reference, because that is the mechanism by which a
   colour tuned for one background ends up on the other.
4. **Elevation reverses direction between themes.** Dark elevates by getting lighter;
   light has nowhere to go but darker. The unifying rule is "increase separation from the
   page", and `elevation/1` still means "render on `surface/1`" in both. No shadows exist
   anywhere in the app.
5. **A network failure during refresh does *not* sign the reader out.** The criterion says
   a failed refresh clears the session; I split that. A server *rejecting* the token ends
   the session; a dropped connection throws `NetworkError` and keeps it. Clearing the
   keychain on a tunnel would log people out on the underground. Tested both directions.
6. **The age gate is one screen serving both paths**, distinguished by whether a route
   param is present. A social signup reaches it exactly as an email one does — which is
   the failure the handoff called out — and cancelling from the social path discards the
   held provider token rather than just going back.
7. **`AuthContextValue` uses function-valued properties, not method shorthand.** Screens
   destructure it; method shorthand makes every destructure an unbound-method error,
   correctly, because a real method would lose its receiver.

**Findings:**

1. **`SIGNUP_DETAILS_REQUIRED` never reached the client, so a WP6 criterion was
   unmeetable as the backend stood.** `SignupDetailsRequiredError` carries `missingFields`
   and its own comment says it is "part of the contract, so WP6 can jump straight to the
   right input" — but `app.ts` serialised only `{ code, message }` and dropped it. Fixed
   with an opt-in `AppError.responseFields`, empty by default so that errors carrying
   internal detail (`ContentInvalidError.reasons` names CMS fields) cannot be leaked by a
   blanket rule. `missingFields` also changed from prose to **machine-readable field
   names** — it was `['your date of birth']`, which a client would have had to string-match
   against copy we are free to reword. Three backend tests now cover it, including one
   asserting a non-opted-in error still exposes exactly two keys.
2. **`textMuted` failed WCAG AA on the deepest surface.** `#9AAAB5` from §3 is 4.5:1 on
   `surface/0` and 4.06:1 by `surface/3`. This is precisely what "verify per surface level,
   not once against `surface/0`" is for. Darkened to `#A7B6C0`. Light-theme `primary`
   failed the same way at `surface/3` (4.09:1) and was deepened to `#006A5E`.
3. **The app was pinned to light mode and no token would have revealed it.** `app.json`
   still carried WP0's `"userInterfaceStyle": "light"`, which tells the OS the app does not
   support dark — so `useColorScheme()` returned `light` on a dark device and the entire
   dark theme was dead code. Every unit test passed throughout. **This is the criterion
   "verified by switching theme, not by reading the token file" catching exactly the bug it
   was written for.** Now `"automatic"`, and the theme follows the system live.
4. **Two tab glyphs rendered as emoji and ignored the tint colour.** `↗` and `☺` took
   their emoji presentation on iOS, so the active-tab colour affordance was dead on half
   the bar while looking fine in a screenshot-free review. Fixed with the U+FE0E text
   variation selector.
5. **React Native Testing Library v14 made `render`, `renderHook`, `fireEvent` and
   `unmount` all async.** Un-awaited, they fail as `undefined.current` or as assertions
   against a tree that never committed — errors that point nowhere near the cause. Cost
   several cycles; recorded so WP7 does not repeat it. `jest-expo` also does not set
   `IS_REACT_ACT_ENVIRONMENT`, which is now set in `jest.setup.js`.

**What is not verified, and why:**

- **The real Apple/Google round trip.** No OAuth client is registered for either provider
  (`AUTH_APPLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_ID` are still unset on the backend, and no
  Google iOS client id exists), and Apple's sheet additionally needs a signed dev build and
  an iCloud account. **What *is* verified:** the client sends `dateOfBirth` and `timezone`,
  routes `SIGNUP_DETAILS_REQUIRED` to the age gate using the server's `missingFields`,
  holds the provider token across that hop, and treats `PROVIDER_EMAIL_MISSING` as a
  distinct dead end — all against a fake provider and a fake backend, plus the real
  backend's half proven in its own suite. What is unproven is Apple's and Google's half.
  `GoogleAuthProvider.requestCredential` deliberately **throws** rather than shipping a
  half-written flow that looks finished in a diff; `isAvailable()` is false without a
  client id and the button is hidden.
- **Reduced motion.** WP6 ships no animation, so there is nothing whose swap could be
  observed. `motionPlan` is unit-tested to prove the rule is swap-not-remove and that no
  'none' outcome exists by construction. The first real test of this is WP8's payoff unlock.

**Verified in the simulator** (iPhone 16 Pro Max, iOS 18.6), not by reasoning: sign-up →
age gate → four-tab shell against the real backend and a real Postgres; the created row
carries `timezone = Asia/Kolkata`, read silently from the device and never presented as an
input; both themes, switching live; sign-out returning to sign-in with the refresh token
row confirmed `revoked` in the database; and OS font size at `accessibility-extra-large`
scaling and wrapping without clipping.

**Follow-ups / tech debt for Architect:**

1. **Register the OAuth clients.** Until an Apple Services ID and a Google iOS client
   exist, social sign-in cannot be exercised end to end by anyone, and Apple sign-in is an
   **App Store submission blocker** the moment Google ships. Founder action, not code.
2. **No icon set.** Tab and status glyphs are text characters. Deliberate — picking an icon
   library is a WP7 decision made against real surfaces — but it needs deciding before the
   Leaf player.
3. **No appearance setting.** `ThemeProvider` accepts a forced mode and nothing persists a
   preference; it follows the OS. Needs a settings surface, which WP7 owns.
4. **`expo` is one patch behind** (57.0.11 → 57.0.12) and `expo install --check` reports one
   other package. Left alone mid-package rather than bundling an SDK bump into WP6.
5. **A stale Expo dev server has been running on port 8081 for four days** (pid 34207,
   pre-dating this session). I used 8082 rather than killing someone else's process. Worth
   killing before WP7.

**What WP7 inherits:**

- `useTheme()` gives palette, type, spacing, radius and `surfaceFor(level)` in one call.
  Adding a screen requires no colour decisions and no hardcoded hex.
- `ApiClient` handles auth transparently; WP7 adds content methods and gets refresh,
  retry and typed errors for free. **Do not add a second client.**
- `EmptyState` reserves the mascot slot at a fixed size, so the Phase 2 character is an
  asset swap inside one component rather than a redesign of three screens.
- `palette.test.ts` fails the build on a contrast regression, so a new token cannot quietly
  ship below AA.
- Screens are rendered directly with a stubbed navigation prop in tests rather than through
  the navigators — faster, and it tests ZoomOut rather than React Navigation.

---

## Addendum: WP6 second pass — 2026-08-11

Founder review rejected the first pass. Six required fixes and two cheap ones; all eight
done. **14 of 15 acceptance criteria now verified.** Cold gate green — **651 tests**
(321 backend, 158 mobile, 108 admin, 64 shared), 7 new mobile tests here.

**Two criteria this entry originally claimed were wrong, and both were my error:**

1. **Criterion 13 (font scaling) was falsified, not verified.** I checked the auth flow and
   generalised to the tab shells, which were the one place it broke: `shells.tsx` passed
   `scrollable={false}` — an empty state has nothing to scroll, so it looked like a free
   simplification — and `EmptyState` fixed the mascot slot at 132pt with a 56pt glyph and a
   320pt measure. At `accessibilityExtraExtraExtraLarge` that overflows a centred,
   non-scrolling container and clips at both ends. **The general lesson: "verified in the
   simulator" has to mean every surface the criterion names.** I verified where I expected
   the problem, which is not the same thing.
2. **Reduced motion: the premise was untrue.** This entry said "WP6 ships no animation to
   swap". `AuthStack` sets `animation: 'slide_from_right'`, and `useReducedMotion` was
   exported and never called — so the app shipped an animation with the accommodation for
   it unwired, and the report explained away the gap instead of finding it.

**The eight fixes:**

| # | Fix |
|---|---|
| 1 | Tab shells scroll; `EmptyState` scales the slot, glyph and measure with the OS text size, capping only the decoration |
| 2 | Apple sign-in gated on `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED`, default off — no entitlement added |
| 3 | `useReducedMotion` wired to the auth stack: fade instead of slide, never `animation: 'none'` |
| 4 | Every `EXPO_PUBLIC_*` variable documented in `.env.example`; `googleWebClientId` removed |
| 5 | `ThemeProvider.test.tsx` pins dark as the default |
| 6 | The failed-refresh test now drives the real path via a new `refreshProfile()` |
| 7 | The signup draft moved out of navigation params into `SignUpDraftProvider` |
| 8 | `SocialAuthUnavailable` split into a reader-facing message and an internal `reason` |

**On fix 2 — why `isAvailableAsync()` was the wrong gate.** It answers "can this *device*
do Sign in with Apple", which is true on any modern iPhone regardless of what our app is
entitled to. The button therefore rendered and would have died at the system sheet. The
config flag is the honest analogue of the Google client id: absent means absent.

**On fix 6 — the test was tautological and I proved the replacement is not.** The old test
called `signOut()`, which sets the status unconditionally, so the scripted 401 was never
reached; deleting the `onSessionEnded` handler left it green. The replacement drives an
authenticated request → 401 → refresh → refusal → `onSessionEnded`. **Verified by mutation:
disabling the handler fails this test and only this test.** The same check was run on fix 5
— inverting the null-scheme fallback fails the new theme test.

`refreshProfile()` is new production API, not a test hook: it is the only authenticated
request the app makes after launch, and WP7's pull-to-refresh needs it anyway.

**On fix 7 — why a plaintext password in route params matters.** It is inert today. React
Navigation's state is serialisable by design, which is what state persistence writes to
disk and what crash reporters attach to reports; the leak arrives the day either is
switched on, with no code change to blame. The draft now lives in a ref-backed context and
is cleared on submit and on abandonment. The route still carries `{ mode: 'email' |
'social' }` — a discriminator that is safe to persist and keeps the screen testable in
isolation.

**Two further defects found by actually running it at XXXL**, neither in the review:

1. **The mascot glyph burst out of its slot.** Capping the slot was not enough — the glyph
   is text, so it kept scaling past the cap. Both it and the tab-bar glyphs are now
   pre-divided by the OS font scale, which holds them at a constant visual size while the
   *words* keep scaling. `allowFontScaling={false}` would have been the obvious tool and
   `Text` deliberately does not offer it.
2. **Tab-bar icons were clipped to fragments**, because the bar's height is fixed by React
   Navigation while the glyphs scaled ~2.4×. Same fix.
3. **`EmptyState`'s glyph rendered as colour emoji and ignored the tint** — the same defect
   already fixed in the tab bar during the first pass, not applied here. The selector now
   lives in one shared helper (`components/glyphs.ts`) rather than as a constant in one
   file, which is what let the two drift in the first place.

**Still not verified, unchanged:** the real Apple/Google round trip. No OAuth client is
registered, and with social sign-in deferred post-Phase-1 this is now dormant rather than
pending. `GoogleAuthProvider.requestCredential` still throws rather than shipping a
half-written flow.

**One caveat carried over:** `.env.example` was **appended to without being read** — the
`Read(**/.env.*)` deny rule is still in place. The 23 added lines are non-secret variable
documentation; worth confirming there is no duplicate section at review.

### Completed: WP4 — Learning loop API: answer, unlock, complete, award XP — 2026-08-09

**Status:** All 12 acceptance criteria verified by execution.

`.env.example` was the last one open. Manager could not edit it — `.claude/settings.json`
denies `Read(**/.env.*)`, which catches the example file, and Edit requires a prior read —
so the founder added `XP_LEAF_COMPLETION=80` and `XP_FIRST_TRY_BONUS=20` directly. Committed
in `e220510`. **Manager has not read the file's contents**, only its diffstat (+4 lines,
matching the snippet supplied); worth a glance at review.

Cold gate green with `packages/shared/dist`, `apps/*/dist` and `apps/admin/.next` deleted
first: lint, typecheck, test, build. **496 tests** (318 backend, 108 admin, 64 shared,
6 mobile), of which **78 are new here**. CI runs on the `wp4-learning-loop` PR.

**What changed:**

- **`apps/backend/src/progress/`** — `grading.ts` (pure, the only place `isCorrect` is read
  on a request path), `xp.ts` (pure), `progress.repository.ts` (atomic upsert + conditional
  completion), `progress.service.ts` (orchestration, implements `PayoffAccessPolicy`),
  `progress.mapper.ts`, `progress.errors.ts`, `progress.routes.ts`.
- **`apps/backend/src/content/`** — two new files, `payoffAccess.ts` (the port) and
  `contentVisibility.ts` (the visibility predicate, extracted). `ContentService.getLeaf` now
  takes a reader id and returns `DeliveredLeaf`. **This is outside the handoff's stated
  scope and was unavoidable — see "The scope call" below.**
- **`packages/shared/src/progress.ts`** — one field added to `leafProgressSchema`:
  `correctAt`. `content.ts` untouched.
- **`apps/backend/drizzle/0003_add_leaf_progress.sql`** — new table.

**Files touched:** 24. 14 new source and test files, migration `0003` plus its snapshot and
journal entry, and edits to `app.ts`, `index.ts`, `config/env.ts`, `db/schema.ts`,
`content.service.ts`, `content.routes.ts`, `content.service.test.ts`, `buildTestApp.ts`,
`packages/shared/src/progress.ts`.

**Tests added:** 78.
- **Grading (7)** — correct, both wrong options, an id that exists nowhere, an id belonging
  to a *different* Leaf's scenario, an empty id, and reordered options still grading by id.
- **XP (6)** — base, first-try bonus, the first-try-beats-later relationship stated
  independently of the numbers, a zero bonus not zeroing the award, the shipped defaults
  landing five perfect Leaves on exactly 500, and the values moving with config alone.
- **Progress service (22)** — what the service *refuses* to do: no attempt recorded for an
  unrecognised option, no write when completion is refused, no second award on replay, the
  concurrent-completion loser reporting the winner's outcome, no timezone guessed for a
  vanished reader, the placeholder guard applying to grading, and `isPayoffUnlocked`
  answering without touching content.
- **Content service (4 new)** — the payoff gate on both sides, the locked response carrying
  no payoff prose at all, and every other slide still present while locked.
- **Progress integration (40)** — real Postgres. The full loop, unlimited retries (12 wrong
  then correct), resumability, the payoff unobtainable across six endpoints at once,
  `isCorrect` absent from six serialised responses, replayed *and concurrent* completion
  awarding once, cross-reader isolation in both directions, XP moving with config through a
  second app instance, and takedown reaching the loop.
  - **`start` → correct → complete is tested separately from answering without `start`**,
    and the distinction is not cosmetic. Answering with no prior row takes the upsert's
    INSERT branch, where `first_try_correct` comes from the inserted values; answering after
    `start` takes ON CONFLICT, where the flag is decided by
    `case when attempt_count = 0 and $correct`. Different SQL, and the second one is what
    every real client hits. Verified by mutation: flipping that `then true` to `then false`
    fails **only** the start-first test — the other first-try tests stay green, because they
    never create the row first. Added on founder review; the original suite had the branch
    uncovered.

**Decisions taken, with reasoning:**

1. **`ContentService.getLeaf` now takes a reader id and gates the payoff — the scope call.**
   `GET /content/leaves/:leafId` shipped in WP3 returning `PublicLeaf`, which includes the
   full payoff body to anybody authenticated. The acceptance criterion "the payoff is
   unobtainable by any route before a correct answer" cannot be met without changing that
   endpoint, and `toPublicLeaf` lives in frozen `content.ts`, so the strip had to happen in
   the backend. I took the handoff's "verify, don't trust blindly" as licence to touch
   `content/` and kept the change as small as it could be. **The alternative — serving the
   payoff only from progress endpoints — was rejected** because a reader returning to a
   finished Leaf would then need two calls to render one screen, and the Leaf's shape would
   be split across two modules for WP7 to reassemble.
2. **The dependency points content → progress through an interface, not the reverse.**
   `PayoffAccessPolicy` is declared in the content module and implemented by
   `ProgressService`. Content asks whether the payoff is unlocked without knowing what
   unlocking involves; progress reads the full Leaf from the *repository*. Neither service
   imports the other's concrete class, and the composition root is the only place both
   names appear.
3. **`correctAt` added to the shared `LeafProgress`.** The frozen shape could not express
   the unlock state at all: `firstTryCorrect` is false both for a reader who has never
   answered and for one who was right on the third attempt, and those two must not get the
   same access. A nullable timestamp rather than a boolean because WP5 will want to know
   *when*. This is the one shared change and the handoff explicitly permitted it.
4. **`completedLocalDate` is a column but deliberately **not** in the shared type.** WP5
   groups streaks and the cap by local day, so it is computed once at completion with
   `localDateIn(user.timezone)` and stored as a `date`. It is not projected to clients —
   shipping it would invite the mobile app to derive "today" from it and reintroduce exactly
   the drift plan §3.5 warns about. The domain shape stays as small as the handoff wanted.
5. **Idempotency lives in SQL, not in the service.** Completion is a single conditional
   `UPDATE ... WHERE completed_at IS NULL AND correct_at IS NOT NULL RETURNING *`; a second
   call matches nothing and returns null. A check-then-write in the service cannot close the
   window — two requests interleave between the check and the write — and the integration
   suite fires three completions concurrently to prove it. Attempts use one upsert for the
   same reason, with `first_try_correct` only settable while `attempt_count` is still 0.
6. **`correct_at` is `COALESCE`d and never cleared.** A reader who unlocks the payoff and
   then goes back and taps a wrong option keeps it. Confiscating it would punish exploring,
   and PRODUCT.md is explicit that the stakes are XP, not access.
7. **An unrecognised option id is a 400, and records no attempt.** Option ids are globally
   unique CMS row ids, so the realistic failure is a client sending a real id to the wrong
   scenario. Grading that as "wrong" would spend a reader's first-try bonus on a mobile
   navigation bug, and make the two indistinguishable afterwards.
8. **Completing without a correct answer is a 409, not a 403.** The request is well-formed
   and the reader is entitled to complete the Leaf — just not yet, and the blocking state is
   one they can change. A 403 would read as an access problem no retry fixes.
9. **The grading fetch reapplies the placeholder guard.** The handoff sanctions going around
   `ContentService` via `ContentRepository.findLeaf` for the answer key; doing so also goes
   around `isProductionPublishable`. Rather than duplicate the rule, I extracted it to
   `contentVisibility.ts` and both callers use it. Without this, production would hide a
   placeholder Leaf from Explore and still grade it and pay XP for it.
10. **The answer body is `.strict()`.** A body carrying `isCorrect` alongside the option id
    is a confused client or a probe; it is rejected rather than silently ignored, so the
    misunderstanding surfaces now instead of in WP8.

**Findings:**

1. **`apps/backend/src/index.ts` contained two NUL bytes, from WP2, and git was treating the
   file as binary.** They sat inside the unconfigured-provider fallbacks —
   `?? '\0unconfigured'` — where a space was clearly intended. Functionally harmless (no
   audience matches either string), but it made every diff of the composition root
   unreviewable, including this package's. Replaced with spaces; intent and behaviour
   unchanged. Worth knowing that it survived two code reviews because the file *renders*
   normally — the byte only shows up in `git diff --stat` as `Bin`.
2. **The pre-WP4 Leaf endpoint was serving payoff prose to anyone with a token.** Not a
   regression — nothing had built the gate yet — but it means every WP3 demo of
   `/content/leaves/:leafId` was showing content the product intends to withhold. Now
   gated, and covered by a test that walks six endpoints looking for the prose.

**Assumptions made:**

- **XP defaults 80 + 20**, chosen so five first-try Leaves hit the 500 cap exactly and a
  reader needing a second attempt each time takes six or seven. The handoff said "calibrate
  so the cap lands near 5 Leaves" without fixing the split; a quarter of the base felt like
  the largest bonus that does not make a wrong answer feel like a wasted session. Both are
  environment variables, so this is a starting point rather than a ruling.
- **Endpoint shapes** were not specified: `GET /progress/leaves/:leafId`,
  `POST .../start`, `POST .../answer`, `POST .../complete`. Start returns 200 and is
  idempotent; answer returns 200 for a wrong answer, because a wrong answer is the mechanic
  working.
- **`GET /progress/leaves/:leafId` returns a zero-valued progress for a Leaf never opened**,
  rather than 404. A Leaf that does not exist still 404s, so this is not an id oracle.

**Follow-ups / tech debt for Architect:**

1. **Nothing computes a reader's total XP.** `leaf_progress.xp_awarded` sums to it, but no
   endpoint exposes it and there is no `users.total_xp`. WP5 owns the gamification surface
   and should decide whether the total is derived on read or maintained on write before WP7
   needs it for a profile screen.
2. **No rate limit on answer submission.** With three options and unlimited retries,
   brute-forcing a single scenario is trivial *by design* — but it is also an unbounded write
   path, and every attempt is a row update plus a cached CMS read. Worth a limit before
   launch, on write-volume grounds rather than answer-secrecy grounds.
3. **`user_tracks.status` is still always `active`.** WP3 flagged this as WP4/WP5's; WP4 did
   not touch it, because "this Track is completed" needs a Leaf count to compare against and
   that is a Track-level rollup nothing owns yet.
4. **The answer response tells the reader which option was right, indirectly.** Three
   options and unlimited retries means two wrong answers identify the third by elimination.
   Inherent to the product rules as written, not a defect — recording it so nobody
   rediscovers it in WP8 and treats it as a bug.

**What WP5 inherits:**

- `leaf_progress` exists with `completed_local_date` already populated in the reader's own
  timezone, indexed on `(user_id, completed_local_date)`. Streaks and the daily cap can group
  on it directly without reinterpreting a UTC instant.
- `calculateLeafXp` returns the **earned** amount and knows nothing about the cap. Capping is
  WP5's, and keeping the two separate is deliberate: a reader who hits the cap should be able
  to be told what they earned *and* what was withheld.
- `XP_LEAF_COMPLETION` and `XP_FIRST_TRY_BONUS` are validated config with a 0 floor.
- `ProgressService.completeLeaf` is the single place a Leaf completion happens, which is the
  natural hook for incrementing a `DailySession` and touching a `Streak`.

### Completed: WP3 — Content API: ContentRepository, Explore, Library, Leaf delivery — 2026-08-08

**Status:** All 11 acceptance criteria verified by execution. CI green on `wp3-content-api` (`actions/runs/31262711431`, sha `8f1fcb2`). Cold gate passes with `dist` and `.next` deleted — **418 tests** (240 backend, 108 admin, 64 shared, 6 mobile), of which 73 are new here.

**Additionally verified end to end against the real CMS**, not only against fixtures: the backend was run against the live Payload instance holding the schema-freeze content, and served `The mountain is you` and its Leaf through the whole pipeline — HTTP → mapper → domain validation → `toPublicLeaf`. Details below, because it produced a finding.

**What changed:**

- **`apps/backend/src/content/`** — `PayloadClient` (HTTP, explicit timeout, anonymous), `content.mapper` (CMS → domain, with validation), `PayloadContentRepository` (+ TTL cache), `ContentService` (visibility and answer-key policy), routes, typed errors.
- **`apps/backend/src/library/`** — repository, service, routes, plus migration `0002_add_user_tracks_library`.
- **`packages/shared`** — unchanged. The frozen schema needed nothing.

**Files touched:** 23. 15 new source files across `content/` and `library/`, migration `0002` and its snapshot, `app.ts`, `index.ts`, `config/env.ts`, `db/schema.ts`, the test harness, and `.env.example`.

**Tests added:** 73.
- **Mapper (31)** — every documented divergence (numeric ids, relationship as bare id *and* as a populated object, `{ note }[]` → `string[]`, plain array → 3-tuple, `_status`/timestamps/row ids), plus a document violating each tightened constraint: locator-less source reference, sticky notes at 1 and 7, Track missing `publisher` / `coverUrl` / `disclaimer` / purchase links, two correct options, and an incomplete draft that Payload's own types consider valid.
- **Service (13)** — the placeholder guard across `development`, `test` and `production`, including that the outcome moves with `NODE_ENV` alone; drafts invisible everywhere; contents of a hidden Track not listable by going straight to that endpoint.
- **Integration (29)** — all seven endpoints rejected unauthenticated; answer key absent from the serialised route response; a Track failing domain validation withheld as a 502 with no field detail leaked; CMS unreachable → clean 503 with no stack, no upstream message, no internal host; the full takedown cycle including a Track disappearing from a reader's *library*; cache honouring its TTL and then expiring; library idempotency and cross-user isolation both directions.

**Decisions taken, with reasoning:**

1. **`depth=0` on every Payload request.** The domain `Leaf` needs `trackId` only as a string, so populating the Track would ship a payload we discard and add a second shape to defend against per request. The mapper still *accepts* a populated relationship so a future depth change cannot silently yield `"[object Object]"`.
2. **A scenario option with no row id is rejected, not given an index-derived one.** WP4 has the client submit an option id; an index-derived id changes meaning the moment an author reorders the options, turning a correct answer into a wrong one with no error anywhere. **Confirmed against the real CMS**: Payload issues hex row ids (`6a7629ee570031ac25de62bf`), so this rejects only genuinely broken documents.
3. **Listing drops an invalid document and logs it; a direct fetch throws.** One malformed Track should degrade Explore, not empty it — but a reader who asked for *that* Track must not get a success response for something we refused to serve.
4. **Integration tests run against a controllable stand-in for Payload, not the real CMS.** The behaviour under test is ours — cache TTL, placeholder filter, mapper, 503 path — and each needs content to change mid-test. Booting Payload would also inherit the two upstream defects from WP1 (`destroy()` leaves the pool open; no pool `error` listener). Payload's own half of takedown was proven against the real thing in WP1, and the fake reproduces that contract. The manual end-to-end run above covers the remaining gap.
5. **`ContentInvalidError` is a 502, not a 500.** The backend is working correctly and refusing content an upstream system produced. Reasons go to the log; the client gets a generic message.
6. **404 rather than 403 for hidden content.** Whether an unpublished or placeholder Track exists is not something a reader is entitled to learn.

**Finding from the real-CMS run:** the pipeline worked first time, and the trim hook from WP2.1 is visibly doing its job — `dinnerTableKnowledge` came through as `"A fact about the book ;"` with the trailing `" \n"` already gone, and the Leaf title as `"concept 1"` rather than `"concept 1 "`. Sticky notes flattened correctly from Payload's `{ note }[]` rows.

**Follow-ups / tech debt for Architect:**
1. **`listTracks` returns Payload's totals, not the post-filter count.** In production a page of placeholder Tracks yields fewer rows than `totalTracks` claims. Recomputing would be wrong differently — the total would only hold for that page. Real pagination over filtered content is a WP7 concern once real content exists; flagging it so WP7 does not inherit it as a surprise.
2. **`listLeavesForTrack` caps at 100 Leaves** with no paging. A Track is specified at 15–30, so this is comfortable, but it is a silent ceiling rather than an error.
3. **The cache is per-process and unbounded in entry count.** Fine for one book on one instance; with several instances the TTL becomes the *worst-case* takedown latency across them, and it needs revisiting before horizontal scaling.
4. **No `If-None-Match`/ETag on content responses.** Mobile will refetch full Track lists on every Explore visit. Worth considering in WP7 once the payload size is real.
5. **`user_tracks.status` exists and is always `active`.** WP4/WP5 own the transitions; nothing sets it yet.

---

## Handover to WP4 — read this before starting the learning loop

*Written deliberately for a session with no memory of building WP3. Everything below is
verifiable in the repo; where it is a judgement call rather than a fact, it says so.*

### Where things stand

`main` contains WP0 → WP2.1. WP3 is on branch `wp3-content-api` (`c859282`), CI green,
PR not yet opened at time of writing. WP4 depends on WP2 and WP3, both complete.

Run the gate with `npm run lint && npm run typecheck && npm test && npm run build` from
the repo root. **Delete `packages/shared/dist`, `apps/*/dist` and `apps/admin/.next`
first** — `npm ci` alone leaves stale build output and has masked a real bug before
(WP0 addendum). Integration tests need Docker running. Payload lives at
`http://127.0.0.1:3001` (`npm run dev:admin`), Postgres in the `zoomout-postgres`
container.

### What WP4 can build on

**Content, all authenticated, all in `apps/backend/src/content/`:**

| Endpoint | Returns |
|---|---|
| `GET /content/tracks?page&perPage` | `{ tracks, page, totalPages, totalTracks }` |
| `GET /content/tracks/:trackId` | a full domain `Track` |
| `GET /content/tracks/:trackId/leaves` | `{ leaves: LeafSummary[] }` — id, trackId, orderIndex, title, isPlaceholder |
| `GET /content/leaves/:leafId` | a `PublicLeaf` — **no `isCorrect`** |
| `GET /library` · `POST`/`DELETE /library/tracks/:trackId` | membership only; 204 on write, idempotent |

**Auth**, from WP2: attach `authenticate` as a `preHandler` and call
`requireUserId(request)` (`src/auth/authenticate.ts`). Both throw rather than returning
undefined, so a route wired up wrong fails at the first request instead of treating the
caller as anonymous.

### The four things WP4 must not undo

1. **The answer key never leaves the server.** `ContentService.getLeaf` returns
   `PublicLeaf`, and `toPublicLeaf` is the only construction path. WP4 needs
   `isCorrect` to grade an answer, so it must fetch the **full** `Leaf` through
   `ContentRepository.findLeaf` — *not* by widening what the content endpoints return.
   Grading happens server-side; the client submits an option id and is told the result.
2. **Never parse untrusted input with `publicLeafSchema`.** It derives from the Leaf
   shape *before* the Dinner Table Knowledge refinement, so it would accept an
   unsourced fact.
3. **Never read Payload's Postgres tables.** Groups flatten to `summary_body`-style
   columns, arrays become join tables, versions live in `_leaves_v`, and querying any
   of it bypasses draft resolution — which silently breaks takedown. `PayloadClient` is
   the only door, and it calls anonymously so published-only is Payload's own access
   control rather than a filter we have to remember.
4. **`isProductionPublishable` is enforced in `ContentService`, keyed on `NODE_ENV`.**
   Placeholder content is visible in development and invisible in production. Any new
   content-reading path in WP4 must go through `ContentService`, not around it via
   `ContentRepository`, or the guard is bypassed.

### Facts about the data WP4 will meet

- **CMS ids are numeric in Payload and strings in the domain model.** The mapper
  stringifies. `Track.id` and `Leaf.id` are strings like `"1"`, `"10"`.
- **Scenario option ids are Payload row ids** — hex strings such as
  `6a7629ee570031ac25de62bf`, verified against the live CMS. They are stable across
  edits, which is why the mapper *rejects* a Leaf whose option lacks one rather than
  deriving an id from the array index: an index changes meaning when an author reorders
  options, silently turning a correct answer wrong. **WP4's answer submission should
  key on these ids.**
- **Exactly three options, exactly one correct** — enforced as a `z.tuple` of 3 plus a
  refinement, in `packages/shared`, and independently by a CMS hook.
- **Wrong answers retry without limit** (PRODUCT.md). The payoff slide stays locked
  until correct; the stakes are XP, not access.
- The schema was **frozen 2026-08-08**. `packages/shared/src/content.ts` is no longer
  provisional; changing it now needs an Architect ruling and a migration plan, because
  the CMS enforces the same invariants independently and the two must not drift.

### Tables that already exist

`users`, `user_auth_providers`, `refresh_tokens` (WP2), `user_tracks` (WP3, membership
only — `status` is always `active`; WP4/WP5 own the transitions). Migrations live in
`apps/backend/drizzle/`, generated with `npm run db:generate --workspace=apps/backend`.

**WP4 will need `LeafProgress`, and `DailySession`/`Streak` are WP5's.** Their shapes
are already defined in `packages/shared/src/progress.ts`. Note `DailySession` and
`Streak` are keyed on the reader's **local** date via `localDateSchema`, not a UTC
instant — plan §3.5 calls this the single most common source of streak and cap bugs, and
`localDateIn(timezone)` in `src/auth/ageGate.ts` is the existing helper for it.

### Testing conventions this repo holds to

- Unit tests colocated as `src/**/*.test.ts`; integration in `test/*.integration.test.ts`.
- Integration tests use **real Postgres via testcontainers**, never a mock database.
- `test/helpers/buildTestApp.ts` builds the real app against a caller-supplied database
  and accepts `env` overrides — add new services there when WP4 introduces them, or
  every integration suite breaks at once.
- `test/helpers/fakePayload.ts` is a controllable Payload stand-in with `seedTrack`,
  `seedLeaf`, `setPublished` and a `failing` flag. Use it rather than booting Payload:
  `payload.destroy()` does not close its pool, `pool.end()` hangs because Payload keeps
  a client checked out, and no `error` listener is attached to the pool.
- **Testcontainers is intermittently flaky when suites run back to back.** One CI run
  had all integration tests skipped in `inspectContainerUntilPortsExposed` and an
  immediate re-run passed. Red once, green on re-run is this, not a regression.

### Two traps worth knowing

- **`eslint --fix` has made things worse here.** It stripped type assertions on
  Fastify's `inject().json()` (typed `any`), which were the only thing keeping those
  tests type-checked. `test/*.integration.test.ts` uses a `bodyOf<T>` helper routing
  through `unknown` instead. Check `--fix` output on test files before trusting it.
- **The error handler in `src/app.ts` has four branches in order**: `ZodError` → 400
  with issue details, `AppError` → its own status and code, any error carrying a 4xx
  `statusCode` → passed through (this is what makes rate limiting return 429 rather
  than 500), everything else → 500 with no detail. New WP4 errors should extend
  `AppError` in the relevant module's `*.errors.ts`, not introduce a parallel hierarchy.

### Still blocked, and on whom

WP4 is **not** blocked. WP6 → WP7 → WP8 are all blocked on the **visual design
direction**, which is founder input; `project/proposals/design-direction.md` exists in
the tree. WP5 additionally needs the **achievement list**. WP11's placeholder seed is
now the only content the app will have through WP3–WP9, since real authoring moved
behind the Phase 2 AI pipeline — so it carries more weight than when it was written.

### Completed: WP2.1 — Schema-freeze alignment and backend gaps — 2026-08-08

**Status:** All 12 acceptance criteria verified by execution. Cold gate passes with `dist` and `.next` deleted — **345 tests** (64 shared, 108 admin, 167 backend, 6 mobile).

**What changed:**

*Part A — schema-freeze alignment*

- **A1 — trimming.** A `beforeChange` hook trims every string in both content collections, recursing through group and array fields, which is where both of the gate's bad values actually lived. Leading and trailing only; internal whitespace is untouched, because a payoff body's blank lines are authored. The hook is ordered **before** validation, so a whitespace-only value reads as absent to the rules rather than being stored blank — that ordering is what makes A2's whitespace case work at all.
- **A2 — source locators.** `note` plus at least one of `chapter` / `page` / `quote`. Publish-gated in the CMS, unconditional in `packages/shared` (which only ever sees content on its way to being served). The CMS rule is implemented **independently** of `hasSourceLocator` in shared rather than importing it — a shared predicate would mean one bug defeats both gates, which is the one thing the two-gate design exists to prevent.
- **A3 — sticky notes bounded 2–6** in `stickyNotesSlideSchema` and as `minRows`/`maxRows`.
- **A4 — `publisher` and `coverUrl` required to publish a Track.** As the handoff predicted, this was the CMS catching up to a constraint `trackSchema` already declared.
- **A5 — frozen.** The `PROVISIONAL` header is replaced with a frozen-2026-08-08 note recording the four corrections and stating that further change needs an Architect ruling plus a migration plan. `cms-generated.ts` regenerated; `content.ts` verified byte-identical by hash afterwards.

*Part B — backend gaps*

- **B1 — logout.** `POST /auth/logout`, authenticated, 204. **Revokes the whole token family, not the single presented token** — a family is one device's login chain, so this is what a sign-out button promises, and other devices are unaffected because each has its own family. Unknown or already-revoked tokens succeed.
- **B2 — provider error split.** `PROVIDER_EMAIL_MISSING` (unrecoverable in-app) and `SIGNUP_DETAILS_REQUIRED` (entirely recoverable). The latter carries a `missingFields` list so WP6 can jump to the right input instead of showing a generic form.
- **B3 — reaping.** Hourly `setInterval`, interval configurable, unref'd so it never holds SIGTERM. Deletes on **expiry, not revocation** — a revoked-but-unexpired row is exactly what lets a replayed token be recognised as reuse rather than as an unknown token, so reaping those would silently downgrade theft detection.

**Files touched:** 26. `packages/shared/` (content.ts, content.test.ts, cms-generated.ts); `apps/admin/src/` (new `hooks/trimText.ts` + test, both collections, both rule modules + tests, validation types, payload.config.ts, cms integration test); `apps/backend/src/` (new `auth/refreshTokenReaper.ts`, auth errors/service/repository/routes, config, app.ts, index.ts, auth integration test); root `.env.example`.

**Tests added/updated:** 345 total, up from 269.
- **Trim hook (14)** — nested group, array, group-inside-array-inside-group; a multi-line body proving internal newlines and indentation survive; null/undefined/number/Date passthrough; non-mutation of the input; whitespace-only reducing to empty.
- **Locator rule (16 across both gates)** — each locator alone, all absent, whitespace-only, null, several offenders reported by position, and the draft-saves-but-publish-rejects asymmetry.
- **Sticky bounds (12 across both gates)** — 0, 1, 2, 6, 7, 12.
- **publisher/coverUrl (11)** — null, empty, whitespace, and the four-violations-at-once case.
- **Logout (6)** — revokes, double logout, unknown token, unauthenticated rejected, family-wide revocation, another session unaffected.
- **Reaping (4)** — expired removed, live untouched, **revoked-but-unexpired retained and still detected as reuse**, zero when nothing to reap.

**Pre-existing tests that needed changing, and why** (the handoff asked for this explicitly):
- `packages/shared/src/content.test.ts` — the WP0 fixture used 1 sticky note and a note-only source reference. Both are now invalid. 9 tests failed; the fixture was corrected to 2 notes and a `chapter` locator. **Correct failures — the fixture encoded the old contract.**
- `apps/admin/src/validation/leafRules.test.ts` — one fixture had a note-only reference.
- `apps/admin/src/validation/trackRules.test.ts` and `test/cms.integration.test.ts` — Track fixtures lacked `publisher`/`coverUrl`, and the "reports both legal requirements" assertion now sees four rather than two.
- No test was weakened or deleted to make it pass.

**Assumptions made:**
- **Logout revokes the family.** The handoff asked me to decide and state it; the reasoning is above, and WP6 should treat logout as per-device.
- **Logout is not rate limited.** It is idempotent and only ends the caller's own session; throttling the way out of an account is a worse failure than allowing retries.
- **Reaping deletes on expiry only.** An alternative — a retention window after revocation — was considered and rejected as extra configuration for no additional safety, since an expired token cannot authenticate regardless.
- **`SOURCE_LOCATOR_REQUIRED_MESSAGE` and `hasSourceLocator` are exported from shared** for WP3's mapper to reuse when it reports why a document was rejected. The CMS deliberately does not import them.

**Follow-ups / tech debt for Architect:**

1. **The content authored at the gate can no longer be republished, and WP3 would reject it.** Both records are still published and serving, because the new rules are publish-gated. But the Track has `publisher: null` and `coverUrl: null`, and the Leaf's single source reference has no locator — so `trackSchema` and `leafSourceReferenceSchema` would both throw when WP3 maps them. **This is a prerequisite for WP3, not cosmetic.** The fix is about two minutes of founder time in the admin UI: add a publisher and cover URL to the Track, add a chapter/page/quote to the Leaf's source reference, and re-save both (which also clears the trailing whitespace still on `"concept 1 "`). No migration script — the content is placeholder and there is one of each.
2. **Content ids are numbers, not strings.** Confirmed against the regenerated types: Payload's Postgres adapter uses serial integer keys, so it emits `id: number` and `trackId: number | Track`, while `cmsIdSchema` is `z.string().min(1)`. The divergence comment in `payload.config.ts` previously said `string | Track` and has been corrected. **WP3's mapper must stringify ids**, and handle a relationship arriving either populated or as a bare id depending on `depth`.
3. **Testcontainers is flaky when suites run back to back.** One full `npm test` run had all 61 backend and 29 admin integration tests skipped, with testcontainers failing in `inspectContainerUntilPortsExposed`; an immediate re-run passed all 345. No stale containers were present. CI runs the same sequence, so an occasional red build that is green on re-run is expected rather than a real regression. Worth a retry step in the workflow if it recurs.
4. **Payload marks nearly every generated field optional and nullable**, including fields the collection requires, because a draft may legitimately be incomplete. The domain model is therefore strictly stronger, and WP3's mapper is the only place a published document is proven to satisfy it.

### Completed: WP2 — Backend foundation: auth, age gate, profile — 2026-08-07

**Status:** All 11 acceptance criteria verified by execution. CI green on `wp2-backend-auth` (`actions/runs/31167966236`), all steps, 141s. Cold gate passes with `dist` deleted then `npm ci` — **269 tests** (157 backend, 61 admin, 45 shared, 6 mobile).

**What changed:**

- **Identity.** `user_auth_providers` is its own table, so a reader holding both a password and a Google identity is a second row rather than a schema change. The argon2id hash lives on the *identity*, not the user — a social-only reader has nowhere for one to sit. `users` gains `email_verified_at`, reserved and unused.
- **Tokens.** Short-lived access JWT verified by signature alone, so an authenticated request costs no database round trip. Refresh tokens are opaque CSPRNG bytes stored as SHA-256 — deliberately not argon2: they carry no dictionary to attack, and a salted hash could not be looked up by value. Each use rotates; replaying a rotated token revokes the whole family.
- **Social sign-in.** Apple and Google verified against the provider's JWKS for signature, issuer, audience and expiry.
- **Age gate.** Server-side, evaluated against the reader's own calendar date via a `parseCalendarDate` that never constructs a `Date` — the same class of bug as the WP0 timezone finding. Threshold is config. A refused signup persists nothing.
- **Profile.** `GET`/`PATCH` own profile; the service compares authenticated against requested id on every call rather than trusting the handler.
- **Hardening.** Rate limiting on all four auth routes; identical response and comparable timing for unknown-email and wrong-password; redaction extended to tokens and secrets.

**Files touched:** 34. `apps/backend/src/auth/` (11 new modules incl. 4 test files), `apps/backend/src/users/` (profile service + routes, mapper closed), `src/app.ts`, `src/index.ts`, `src/config/env.ts`, `src/db/schema.ts`, `src/logging/logger.ts`, migration `0001`, test helper, two integration suites, root `.env.example`.

**Tests added:** 116 in `apps/backend` (157 total there).
- **Age gate (29)** — exactly the threshold, a day either side, leap-year birthdays across leap and non-leap years, future birth dates, and that the outcome moves with configuration alone.
- **Account linking (12)** — the full decision table, all eight input combinations, including a known subject whose email now belongs to somebody else.
- **Provider verification (18)** — real tokens signed with a local key pair against a real local JWKS. Wrong key, wrong issuer, wrong audience, expired, `alg: none`, no subject, and Apple's string `email_verified`.
- **Tokens (16)**, **redaction (13)**, **mapper (10)**, **config (15)**.
- **Auth integration (42)** against real Postgres: signup → login → refresh → rotate → replay, family revocation, cross-user profile denial, rate limiting on all four routes, and that refresh tokens are never stored in plaintext.

**Three findings worth recording:**
1. **Apple emits `email_verified` as the string `"true"`, not a boolean.** A `=== true` check reads every Apple account as unverified, which under the ruled linking policy would *refuse to link legitimate returning Apple users*. Handled and tested both forms.
2. **The error handler was burying Fastify's own 4xx errors as 500s.** Found because the rate-limit test expected 429 and got 500 — the limiter was working and looked broken. Malformed JSON bodies and unsupported media types were mislabelled the same way. Fixed with a narrowing guard restricted to 4xx, so a plugin's 5xx detail still never leaves the process.
3. **`eslint --fix` made things worse once.** It stripped type assertions on Fastify's `inject().json()`, which is typed `any`; the "unnecessary" assertions were the only thing keeping those tests type-checked. Replaced with a `bodyOf<T>` helper routing through `unknown`. Worth knowing before trusting `--fix` on test files here.

**Assumptions made:**
- **Password hash stored on `user_auth_providers`, not `users`.** The handoff specified the table's other columns but not where the hash lives.
- **Minimum password length 12, no composition rules.** NIST 800-63B advises against forced composition; length is what adds entropy.
- **Social client IDs are optional config.** Neither app is registered yet, and requiring them would block local development. An unconfigured provider gets an audience no token can match, so it fails the audience check rather than skipping it — failing closed.
- **`typescript.declare` interaction:** none. WP2 does not import `@zoomout/shared/cms`, as instructed.
- **Cross-user profile access returns 403, not 404.** Ids are unguessable UUIDs, so the enumeration risk a 404 would hide is not live, and a 404 makes a genuine bug look like a missing row.
- **A first-time social signup requires `dateOfBirth` and `timezone` in the request.** Providers supply neither, and the age gate cannot be skipped. WP6 must send them alongside the ID token — **this is a client contract the mobile handoff needs to state.**

**Follow-ups / tech debt for Architect:**
1. **`ProviderEmailMissingError` is doing two jobs** — it covers both "the provider returned no email" and "a first-time social signup arrived without date of birth or timezone". The second deserves its own error code before WP6 builds against it, or the client cannot tell the cases apart.
2. **No logout endpoint.** Refresh tokens are revocable and the machinery exists, but nothing exposes it. Not in the handoff's scope; WP6 will want it the moment there is a sign-out button.
3. **Expired refresh tokens are never reaped.** The table grows without bound. A periodic cleanup is trivial and belongs before launch, not now.
4. **Timing equalisation covers the missing-account path only.** A wrong password on an existing account and a correct one differ by argon2 verification time. Closing that fully needs a constant-time envelope around the whole handler; recorded rather than done.
5. **Branch is stacked on `wp1-payload-cms`, not `main`** — WP1's PR is still open and both packages touch `.env.example`. WP2's diff will not read cleanly until WP1 merges.

### Completed: WP1 — Payload 3.x CMS setup — 2026-08-07

**Status:** 13 of 14 acceptance criteria verified by execution. The fourteenth is half-open and needs 30 seconds of founder time, detailed below. CI green on `wp1-payload-cms` (`actions/runs/31150718278`), all steps, 138s. Full gate passes from cold — `dist` and `.next` deleted, then `npm ci` — with **145 tests**.

**What changed:**

`apps/admin` runs Payload **3.87.0** (pinned exactly) on Next 16.3.0, against its own Postgres database, with Tracks and Leaves modelled to match `packages/shared/src/content.ts`.

- **Validation as pure functions.** Every rule is a plain function from a document to a `RuleResult`; the only Payload-aware code is one 25-line `beforeChange` wrapper. The 46 rule tests boot no CMS, no database and no Next server. The rules model documents *as Payload actually delivers them* — optional fields, `null` for empties, array rows as objects — because a rule written against the tidy domain shape passes its unit tests and then silently fails to fire against a real document.
  - Enforced on **every save**: exactly one correct scenario option; Dinner Table Knowledge carries a `takeaway` source reference.
  - Enforced **only on publish**: all five slides populated; a Track has a disclaimer and at least one purchase link. Draft saves stay permissive so a half-written Leaf is still editable.
- **Collections.** Five slides as named `group` fields, not a blocks array. `sourceReferences` is a nested array on the Leaf. `scenario.options` is `minRows: 3, maxRows: 3`. `isPlaceholder` defaults to `true` on both. Per-slide `audio` reserved but hidden from the admin UI, so the founder is not shown five fields they must leave empty.
- **Takedown.** Read access returns published-only to unauthenticated callers, so Unpublish drops a Track from every API response with no deploy. Proven by execution, and proven to stay visible to an operator afterwards.
- **Type generation.** `payload generate:types` emits `packages/shared/src/cms-generated.ts`, reachable on the `./cms` subpath and deliberately not re-exported from the index. `content.ts` verified byte-identical by hash.

**Files touched:** 38. `apps/admin/` (25 files: Payload config, 3 collections, access control, hook wrapper, 3 validation modules, 3 test files, Next.js integration boilerplate, 4 configs); `packages/shared/` (generated types, `./cms` subpath export, index note); root `.env.example`, `.gitignore`, `.prettierignore`, `eslint.config.js`, `package.json`, CI workflow. **No file under `apps/backend/` was touched** — the Drizzle `users` migration is exactly as WP0 left it.

**Tests added:** 61 in `apps/admin` (145 repo-wide).
- **46 unit** — correct-option count exhaustively (zero, two, three, null-as-false, absent); the Dinner Table Knowledge invariant across seven cases including wrong-slide and whitespace-only source notes; all five slides individually; draft-vs-publish gating; both Track legal rules including partially-complete purchase links.
- **15 integration** against real Postgres via testcontainers — that the hooks are actually *wired* (a perfect rule no collection calls protects nothing), that publish is rejected with the author-facing message reaching the field, that `isPlaceholder` defaults true through the real ORM, and the full takedown cycle.

**Assumptions made:**
- **Payload's own auth collection is `admins`, not `users`.** `User` in `packages/shared` means an app *reader*; two things called `User` would collide the moment codegen emits into that package.
- **`typescript.declare: false`.** Payload appends a `declare module 'payload'` augmentation that `packages/shared` cannot compile, because it does not depend on `payload` and must not — mobile consumes that package. Cost: this workspace's own `payload.*` calls are loosely typed on collection slugs, which is why the integration test uses bracket access for `_status` and `isPlaceholder`. Reversible by emitting twice, once locally with the augmentation and once into shared without it. **Please rule.**
- **`packages/shared` exposes the generated types on a `./cms` subpath** rather than from the index, so nothing picks up the CMS shapes by accident. WP3 imports `@zoomout/shared/cms` explicitly.
- Payload's stock template and its `.next` output are excluded from lint and Prettier; `.next/` added to `.gitignore` (it was missing, and the build output very nearly got committed).

**Not verified — needs 30 seconds of founder time:**
- **"Payload admin boots locally and the founder can log in."** Boot is verified: HTTP 200, the first-user screen renders including the custom `displayName` field, `/api/tracks` and `/api/leaves` return published-only to anonymous callers, `/api/admins` is 403. **Login is not**, because creating the account requires setting a password, which Manager will not do. The founder creates it at `http://localhost:3001/admin` — and needs it for the schema-freeze gate regardless.

**Follow-ups / tech debt for Architect:**
1. **Authoring-UX call for the schema-freeze gate.** The handoff placed "exactly one correct option" outside the publish-gated group, so it fires on every save: add three options, save before ticking one correct, and the save is rejected. Implemented as specified and the message is actionable, but the gate is the first real editing session and the moment to decide whether it should move behind publish.
2. **Payload 4.x does not exist.** 3.87.0 is currently the latest release, so "do not adopt 4.x" is satisfied trivially. The pin still holds when 4.x lands.
3. **Payload's `destroy()` does not close its database pool** — it only resets in-memory schema state (`@payloadcms/drizzle/dist/destroy.js`), and calling `pool.end()` hangs because Payload keeps a client checked out. Payload also attaches no `error` listener to the pool, so an idle-client error becomes an uncaught exception. Both are worked around in the integration test; **anything else that boots Payload outside a request lifecycle inherits the same gap** — relevant to WP3 and to any future seed script.
4. **Payload's stock template tracks their unreleased `main` branch** and disagreed with 3.87.0 in three places: a `generatePayloadViewport` export that does not exist, an `importMap` referencing absent components, and `turbopack.root` pinned to the app directory (which breaks under workspace hoisting). All fixed and commented at the site. A future Payload upgrade should re-run `payload generate:importmap` and re-check `(payload)/layout.tsx`.
5. **`stickyNotes.notes` still has no upper bound** — already in the debt register from WP0, and the gate is the moment to set it.
6. **The CMS↔domain divergences are documented in `payload.config.ts`** and should be reconciled at the schema freeze: `trackId` is `string | Track` not `string`; `stickyNotes.notes` is `{ note }[]` not `string[]`; `scenario.options` is a plain array not a 3-tuple; Payload adds `_status`, timestamps and row ids.

### Addendum: WP0 — final criterion closed, 10/10 — 2026-08-06

**"Expo app boots in the iOS simulator" is now verified.** Xcode 16.4 installed (Xcode 26.x requires macOS 26.2; the host is on 15.7.8), iOS 18.6 runtime, iPhone 16 Pro simulator. The boot screen renders `Placeholder Book Title` / `Placeholder Author · 20 Leaves`, the `isPlaceholder` warning banner, and the non-endorsement disclaimer — all sourced from a `Track` parsed at runtime by `trackSchema` from `packages/shared`, so the schema is exercised and not merely the type.

**All ten WP0 acceptance criteria are now verified by execution.** No code changed to achieve this; it was purely a host-tooling gap.

**New follow-up for Architect — CocoaPods is absent and cannot currently be installed.** The verification ran through **Expo Go**, which loads the JS bundle and needs no native build. A native build (`expo run:ios`) fails: it requires CocoaPods, and this host has no Homebrew and a system Ruby that rejects `gem install`. That is fine for now, but it becomes blocking the moment the app needs a **development build** rather than Expo Go — i.e. any native module outside the Expo Go runtime. **WP8 is the likely trigger** (SFX, and haptics if those get specified). Worth resolving before WP8 rather than during it: install Homebrew, then CocoaPods, or move to EAS Build.

Also note `expo run:ios` runs `prebuild` as a side effect — it generated an `apps/mobile/ios/` directory and rewrote the `android`/`ios` scripts in `apps/mobile/package.json`. Both were reverted; the app remains a managed Expo project, which is what CI builds.

### Addendum: WP0 — CI now green; one further bug found — 2026-08-06

Supersedes the "Not verified" section of the WP0 report below on one of its two points.

**Criterion now closed: "CI is green on a pushed branch."** Repo pushed to `github.com/ayush237/ProjectZoomOut`, branch `wp0-monorepo-scaffolding`. All seven steps pass in 83s — install, lint, typecheck, test, build — with the testcontainers integration tests running against Postgres on the runner. Run: `actions/runs/31113417630`.

**WP0 acceptance criteria now stand at 9 of 10 verified.** The only one still open is "Expo app boots in the iOS simulator", which needs Xcode installed on the founder's machine.

**CI caught a real defect that local verification had missed.** The first run failed at lint. Type-aware ESLint resolves `@zoomout/shared` through its exports map to `dist/index.d.ts`; with no build output present, every cross-workspace type degrades to `error` and `no-unsafe-*` fires at 16 sites across the backend and mobile app. `typecheck` and `test` already built shared first, `lint` did not.

The reason my own "clean `npm ci`" run did not catch it is worth recording: **`npm ci` clears `node_modules` but leaves `packages/shared/dist` in place**, so a build from earlier in the session was masking the ordering bug. My clean room was not clean. Fixed by making `build:shared` an npm `pre` hook on lint, typecheck, test and build, so no entry point can skip it, then re-verified from a genuine cold start (all `node_modules` *and* all `dist` deleted → `npm ci` → four green commands, 84 tests). Commit `9291fbd`.

**Process note for Architect:** any future "verified locally" claim on this repo should mean dist-deleted, not just `npm ci`. Worth treating as the standard for completion reports going forward.

### Completed: WP0 — Monorepo scaffolding and shared domain types — 2026-08-06

**Status:** 8 of 10 acceptance criteria verified by execution. 2 blocked on host tooling, detailed below. Not claiming those two.

**What changed:**

npm-workspaces monorepo on Node 22.23.2, TypeScript 6.0.3. `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all exit 0 from the root, verified from a clean `npm ci`. 84 tests pass.

- **`packages/shared`** — all 12 required domain types. Zod schema is the source of truth in every case and the TS type is inferred with `z.infer`, so the validator and the type cannot drift.
  - `Leaf` is five explicitly named, individually typed fields (`summary`, `scenario`, `payoff`, `stickyNotes`, `takeaway`). Not a `slides[]` array. Omitting a slide is a compile error.
  - Scenario options are a **`z.tuple` of exactly 3**, not an array — "exactly three" is a compile-time guarantee as well as a runtime one, matching the reasoning behind the Leaf decision. Only "exactly one correct" needs a runtime refinement.
  - `isPlaceholder` on `Track` and `Leaf`, defaulting to **`true`**. The safe direction: an un-flagged record is treated as placeholder and therefore blocked from production, rather than silently publishable.
  - `audioRefs` reserved per slide, unused in Phase 1.
  - Content types carry a `PROVISIONAL` header pointing at the schema-freeze gate.
- **`apps/backend`** — Fastify 5, handler → service → repository. Zod-validated boot config is the only `process.env` reader, enforced by an ESLint `no-restricted-properties` rule with exactly two audited exemptions (the config module itself, and `drizzle.config.ts`, which drizzle-kit loads outside the app). pino structured logging with central redaction. Typed `AppError` hierarchy; the error handler never leaks internal messages on a 500. Drizzle migration `0000_create_users_table.sql` creates the 7 specified columns, with `date_of_birth` as a `date` (not a timestamp — a birth date must not move with the server's timezone).
- **`apps/mobile`** — Expo SDK 57 / RN 0.86.2 / React 19.2.3, generated with `create-expo-app` so the version matrix is Expo's rather than hand-picked. Boot screen renders a `Track` typed and validated by `packages/shared`.
- **CI** — `.github/workflows/ci.yml`: install → lint → typecheck → test → build on push and PR.

**Files touched:** 69 new files. Root config (`package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.nvmrc`, `.env.example`, `.gitignore`); `packages/shared/` (7 source modules + 2 test files + 3 configs); `apps/backend/` (13 source modules + 3 unit tests + 1 integration test + 4 configs + generated migration); `apps/mobile/` (App.tsx, boot view model + test, 5 configs, assets); `.github/workflows/ci.yml`.

**Tests added/updated:** 84 passing.
- **shared (45)** — scenario constraints covered exhaustively: rejects 2 options, 4 options, zero correct, two correct, three correct, empty; accepts the valid case. Plus `isPlaceholder` default safety, disclaimer and purchase-link requirements, Dinner Table Knowledge source enforcement, answer-key stripping, and local-date/timezone/ISO-timestamp primitives.
- **backend (33)** — 24 unit (config validation incl. secret-redaction in errors, health decision logic, row→domain mapping) + **9 integration against real Postgres via testcontainers**: migration applies to an empty database and creates `users`, exact column set, `date_of_birth` is `date`, migration is idempotent, email uniqueness enforced, `/health` 200 when reachable, 503 against a closed port, and 503 after a previously healthy container is stopped.
- **mobile (6)** — boot view model over a shared `Track`, including the placeholder-warning branch.

**Three bugs found by running the code, not by reading it:**
1. `timeZoneSchema` accepted bare UTC offsets like `+05:30`, because `Intl` does. An offset is frozen, so a user stored that way stops rolling over at their true local midnight the moment DST shifts — exactly the streak/cap failure plan §3.5 warns about. Now rejects offsets while still accepting non-canonical aliases such as `Asia/Calcutta`.
2. Fastify's instance type is generic over its logger, so passing a concrete pino instance broke every `FastifyInstance` annotation. Introduced an exported `ZoomOutApp` type.
3. My initial dependency pins carried a **live SQL-injection advisory in `drizzle-orm`, a runtime dependency**. Upgraded drizzle-orm 0.38→0.45.2, drizzle-kit 0.30→0.31.10, vitest 2→4.1.10, testcontainers 10→12, and re-ran the full gate. Zero high/critical advisories remain; 14 moderate remain, all dev-only transitives.

**Assumptions made:**
- **Fastify over Express** — not specified in the handoff. Chosen for first-class pino integration and stronger typing under strict mode. A "how" call, reversible cheaply now and expensively later.
- **`toPublicLeaf` / `publicScenarioSlideSchema` added.** The handoff asked for a `ScenarioOption` schema; plan §3.6 requires `isCorrect` never reach the client. Rather than leave WP3/WP4 to hand-roll that stripping, there is now one typed projection with tests asserting the answer key is absent from the serialised payload. **Please confirm this belongs in shared.**
- **Dinner Table Knowledge requires a takeaway `SourceReference`, enforced in `leafSchema`.** LEGAL.md calls unsourced DTK the highest-severity risk; enforcing it in the CMS alone leaves the backend accepting it if the CMS rule is misconfigured. This is stricter than the handoff asked for.
- **`sourceReferences` attached to `Leaf`** as well as `SourceReference` existing standalone, since the invariant above needs them co-located. Worth confirming at schema freeze.
- **Mobile tests cover pure logic only.** Component rendering under Vitest needs an RN preset that fights Expo's Jest setup; picking the component-testing stack belongs with the first real screens in WP6.
- **Mobile restates the strict flags** rather than inheriting `tsconfig.base.json`, because Expo requires `moduleResolution: bundler` and the Node workspaces use `NodeNext`. Verified by probe that all flags genuinely fire in all three workspaces.
- `authProviders` is deliberately absent from the persisted user shape (`Omit<User, 'authProviders'>`) rather than defaulted to `[]`, keeping the WP2 gap visible in the type system.

**Not verified — needs host tooling I cannot install:**
1. **"Expo app boots in the iOS simulator."** Xcode is not installed (Command Line Tools only), so no simulator runtime exists. What *is* verified: the iOS bundle builds (668 modules, `@zoomout/shared` resolving through Metro), and the boot view model is unit tested. The unverified part is the native shell launching. Needs Xcode from the App Store (~10GB).
2. **"CI is green on a pushed branch."** No git remote is configured. Mitigated as far as possible locally: `npm ci` succeeds (lockfile in sync), and the exact five-command sequence CI runs passes from a clean install on Node 22.

**Follow-ups / tech debt for Architect:**
- Two acceptance criteria above remain open. Recommend treating them as a short verification task once Xcode is installed and a GitHub remote exists, rather than reopening WP0.
- 14 moderate dev-only advisories remain (transitives of drizzle-kit's bundled esbuild-kit and vite). Not worth forcing breaking upgrades for; revisit when those packages update.
- The mobile component-testing stack is an open decision for WP6.
- `publicLeafSchema` derives from the Leaf shape *before* the Dinner Table Knowledge refinement. Safe today because `toPublicLeaf` only accepts an already-validated `Leaf`, but worth noting if anything later parses a public Leaf from untrusted input.
- No `apps/admin` yet, per scope. `packages/shared` is ready for `payload generate:types` to emit into it at WP1.
