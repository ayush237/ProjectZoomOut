# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.


> **Phase 1 entries (WP0–WP15, to 2026-08-13) moved to `project/archive/collaboration-log-phase1.md`
> on 2026-08-28.** This file was 397KB — roughly 100k tokens that every session paid before reading a
> line of code. The archive is the durable record and is still there when a decision needs tracing;
> it is simply no longer loaded by default.

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

### Handoff: 2026-08-30 — WP15.4: Gate 2's three fields on Leaves

*Manager. **Do this together with WP15.3**, immediately below — same file, same access control, one restart.*

### Task: WP15.4 — add `imageCandidates`, `editorialFindings` and `gateTwoStatus` to Leaves

**Context:** WP19 built the editorial reviewer, the revise loop and the answer-length check, and stopped at 8 of 11 criteria for one reason: **gate 2 has nowhere to render.** The human review screen is three fields on the existing Leaf, and `apps/admin` is not the Pipeline Manager's to touch. It stopped and specified rather than reaching across, which was right.

**This is the last thing between the pipeline and a reviewable Leaf.** Three criteria unblock the moment it lands.

**Objective:** A human opens a generated Leaf in Payload and sees the three image candidates, the editorial reviewer's advisory findings, and a control to approve, request changes, or reject.

**Scope:** `apps/admin/collections/Leaves.ts`, and the same access control WP15.2 and WP15.3 touch.

**The spec is already written** — full TypeScript in `collaboration-log.md` under WP19's completion report, three field definitions using types already present in that file. **No custom React components and no new collections.** Read it there rather than inventing an equivalent.

**Requirements**
- `imageCandidates` — array of `{url, alt}`, pipeline-populated, so a human can compare candidates without leaving the Leaf to hunt through Media.
- `editorialFindings` — array of `{slideKey, category, note, suggestion}`, pipeline-populated. **Advisory. It must not gate publishing** — R3's separation applies here exactly as it does to `ground_check`, and a findings list that blocks is a second legal gate nobody designed.
- `gateTwoStatus` — select, defaulting to `pending`, sidebar. The human's decision.
- **The machine account writes the first two and never `gateTwoStatus`.** Field-level access is the better answer; the Pipeline Manager notes a documented convention is acceptable if that proves disproportionate, since `update_leaf_draft` already refuses non-draft-safe writes. **Prefer the enforced version** — WP15.2 is the standing lesson that a constraint believed applied and a constraint actually applied are different things.
- Existing Leaves must stay valid. All three are additive and optional; there is no backfill.

**Out of scope:** the pipeline's write path (WP19 finishes that), publishing rules, a custom review UI, human roles.

**Device gate:** *open a generated Leaf from Track 42 in the admin UI and see all three fields render* — candidates listed, findings readable, the status control in the sidebar. Then set `gateTwoStatus` to Approved and confirm it saves as a **draft** without publishing anything.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] All three fields exist, render in the admin UI, and are readable over REST
- [ ] **`editorialFindings` does not block publishing** — a Leaf with findings outstanding still publishes
- [ ] The machine key can write `imageCandidates` and `editorialFindings`
- [ ] **The machine key cannot set `gateTwoStatus`** — verified by calling the API and being refused, or, if the documented-convention route is taken, the convention is written down and the reason recorded
- [ ] All 21 existing Leaves still validate and still serve — verified by query
- [ ] Migration applies cleanly to an empty database
- [ ] Payload caches config at server start: **restart before verifying**, or the probe tests the old config

**Testing expectations:** Tier B. The one that matters is behavioural and has two halves that belong in one test — the machine key is **accepted** on the two pipeline fields and **refused** on `gateTwoStatus`. A key that fails both passes half the check and is useless.

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

**Out of scope:** human role-based permissions (ruled not needed until a second person touches the CMS), **and the pipeline-side switch to the new key** — see the seam note below.

> **Corrected 2026-08-28, before dispatch.** The first draft of this handoff carried the criterion *"the pipeline authenticates with an API key, not a password"* while scoping the work to `apps/admin`. **That criterion is not satisfiable inside that scope** — the client that authenticates lives in `apps/pipeline`, which Manager does not own. It is the same mistake that sent WP4 into WP3's module and WP6 into the backend, so it is corrected here rather than discovered by whoever picks this up.
>
> **The seam:** Manager provisions a publish-incapable key and proves it *is* publish-incapable. **Pipeline Manager switches the client to use it**, as a small follow-on once this lands. Until then the pipeline keeps working on its existing login — nothing breaks, and the two halves land in the right sessions.

**Device gate:** *load the admin UI at `http://127.0.0.1:3001/admin` and see it render.* Then, using the new key directly (curl is fine — the pipeline is not switched over yet), confirm it **can create a draft and cannot publish one**.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] A publish-incapable API key can be provisioned on `Admins`, and its creation is documented for the founder
- [ ] **The key cannot publish** — verified by calling the API with it and being refused, not by reading config
- [ ] The key **can** create and update a draft — otherwise it is scoped too tightly to be useful
- [ ] The key is revocable independently of any human account
- [ ] The admin UI renders at `127.0.0.1:3001` as well as `localhost:3001`
- [ ] No credential is committed
- [ ] The follow-on for `apps/pipeline` is written into `collaboration-log.md` so it is not lost at the seam

**Testing expectations:** Tier B. The two that matter are behavioural and belong together: **the key is refused on publish and accepted on draft.** A key that cannot publish because it cannot do anything passes half of that and is useless. Verify the effect, not the config.

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

## Completions (Manager → Architect)

### Completed: WP15.3 — `delete` removed from the machine account — 2026-08-29

**All 4 acceptance criteria met.** Root `lint`, `typecheck`, `test` (964 across four
workspaces) and `build` pass.

`machinesNeverDelete` in `access/publishing.ts`, wired to `delete` on Tracks, Leaves and
Media. Unconditional for a machine account, with no inspection of the document or the
request — no state to resolve, no query semantics to depend on, no flag a caller can
send. **That plainness is the design, not laziness about it.** WP15.2's publish rule
failed precisely because it asked a question whose answer turned out to be ambiguous;
there is nothing here for the same class of mistake to attach to.

Media gets `delete` only. It has no draft/publish distinction to scope against, but an
image a Leaf points at is content, and a machine deleting one breaks that Leaf as surely
as deleting the Leaf would.

**Verified against the running API after a restart** — Payload caches config at server
start, per WP15.2's own note:

| Attempt with the machine key | Result |
|---|---|
| `DELETE` its own draft Track | **403** |
| `DELETE` a published Track | **403** |
| `DELETE` a published Leaf | **403** |
| `DELETE` a media item | **403** |
| **Bulk `DELETE` by query** — a separate Payload operation | **403** |
| `POST` create a draft Track | **201** |
| `PATCH ?draft=true` an existing draft | **200** |
| `PATCH` publish — WP15.2's rule, re-checked | **403** |
| A human deleting, `overrideAccess: false` | **deleted** |

**Refusals confirmed by data, not by status code.** Every document the key attempted to
delete was still present afterwards, and the collection counts were unchanged — 37
Tracks, 151 Leaves, 70 media. A 403 that had nonetheless deleted something would look
identical in the response.

**The two halves are asserted in one test**, per the handoff: `the machine key is scoped,
not disabled` checks the delete refusal alongside create and update still succeeding.
Split across files, a credential that can do nothing at all passes one and fails the
other somewhere nobody is looking. Mutation-checked both ways — letting machines through
reddens the refusal tests, refusing everyone reddens the human test.

**The founder's API key was rotated** during verification and the old one no longer
works. The new key was handed over directly; it is not in the repo.

#### Not done, and deliberately

**WP15.4 was handed off as "do this together with WP15.3 — same file, same access
control, one restart."** This session was asked for WP15.3 alone, so I did not widen into
it. It is still one restart's worth of work and unblocks three of WP19's criteria; it
just needs dispatching.
### Completed: WP19 — gate 2, editorial review, and the answer-length check — 2026-08-29

**Partial. 8 of 11 acceptance criteria met and verified; 3 blocked on the same root cause —
gate 2 has nowhere to render in Payload, and that is `apps/admin` work I do not own.** Full
spec for it is below, precisely scoped per the handoff's own instruction to stop and say so
rather than reach across.

Everything that does not depend on that surface is built, tested, and — for the two pieces
that matter most — verified against **real Track 42 content**, not just fixtures. That live
verification found and fixed a real bug in the revision mechanism before it could ship.

#### 1 — the answer-length check: confirmed against the real defect

Mechanical, per-Track, separate from `ground_check` (ruled 2026-08-27). Threshold 0.5,
comfortably above the roughly-1-in-3 chance rate, same reasoning as the structure check's
thresholds: lean toward catching the real tell over never firing on noise.

Run against Track 42's actual 18 Leaves: **15 of 18 (83%) have the longest option correct —
fails, exactly reproducing WP17's manual finding.** Mutation-checked: neutering the threshold
and disabling the fire both turn exactly the two tests named for the tell red, nothing in
`ground_check`'s suite moves.

One real bug surfaced building this: the first implementation filtered option lengths by
*value* rather than by *position*, which crashes on an empty comparison whenever every option
happens to be the same length — which the shared test fixture's three default options
actually are (all 21 characters). Fixed by comparing the correct option against the other two
by index.

#### 2 — `editorial_review`: advisory in the code, not only the prompt

`EditorialReviewResult` has no `passed` or `verdict` field at all — there is structurally
nothing for a caller to gate on, which is R3's principle enforced as a type rather than as a
convention. Findings are contract-tested (structure, categories, required fields), never
tested on prose.

**Cross-family review was investigated properly before defaulting away from it, not assumed
too expensive to try.** Claude is reachable through this project's existing Vertex/ADC setup
with no new credential — but every Anthropic base model on this project returns `429
RESOURCE_EXHAUSTED`, a default-zero Vertex Model Garden quota. That is a console action for
whoever holds the project (submit a quota increase), not a code problem, and the moment it
lands the swap is one config value. Default until then: `gemini-3.1-pro-preview` — a
different, stronger model than generation, even if not a different family. Its rate
($2.00/$12.00 per Mtok) was verified against `ai.google.dev/gemini-api/docs/pricing` **and** a
second independent source before being pinned into `cost.py` — this project has shipped a
wrong, guessed price before, and that is the whole reason the `unpriced_models` mechanism
exists.

#### 3 — `revise`: bounded, and the mutation test caught two of my own mistakes before it was honest

Cap is **2** — R7's original figure, kept rather than inherited from WP16.1's raised
breakdown cap of 5. That raise was justified by generation moving to a free Flash call;
editorial review may run cross-family per R3 and Claude has no free tier anywhere (§4a), so
R7's original cost reasoning is the one that actually applies here.

**The first mutation check passed cleanly with nothing mutated.** Two compounding reasons,
both worth recording because both will recur elsewhere: the loop had two independent places
enforcing the same cap (a `for`-loop bound and a separate inner "last attempt" check), so
mutating either alone proved nothing — and separately, the test's own expected count was
*read back from the same module constant it was supposed to be checking*, so the test and the
system could never disagree regardless of what the constant said. Fixed both: the loop now
has exactly one enforcement point (`while revise_attempts < max_attempts and ...`), and the
test asserts a hard-coded call count with `max_attempts` passed explicitly, decoupled from
the constant. Re-run: removing the bound and an off-by-one (`<=` for `<`) each fail exactly
the one test named for the cap, nothing else moves.

**Escalation is what reaching gate 2 with findings still attached means** — there is no
separate escalation channel like `ground_check`'s, because gate 2 *is* the surface a human
sees editorial findings on. The loop always re-reviews after its last revision (a few extra
tokens) rather than reporting stale pre-revision findings, so what reaches gate 2 is the
truth about the actual final state, not a guess.

**Revision cannot spend grounding to buy prose, structurally.** A rewrite is accepted only if
it still passes `check_grounding` against the same passages the original cited; a revision
that cannot stay grounded is discarded and the original stands. Verified against **two real
Track 42 Leaves before the fix below landed: both revisions were rejected**, 1 and 7 broken
citations respectively.

#### The bug those two real rejections exposed, and the fix

Investigated rather than shrugged off as "the safety net worked, ship it." The prompt told
the model *"if you did not change a claim's wording, keep its citation as it was"* — but
never showed the model what its citations **were**. It had no way to comply except
reconstructing every quote from memory for the whole Leaf, including slides it was not asked
to touch — and re-typing a quote from memory is exactly how an exact span stops being exact.

Fixed by rendering the Leaf's own existing claims (slide, text, ref, note, quote) into the
revise prompt, so an untouched claim can be **copied verbatim** instead of reconstructed. Also
tightened the rule for claims that *do* change: an attribution fix is exactly the case where
wording changes, so its citation gets reconsidered, not carried over on the assumption it
still fits.

**Verified on the same Leaf that failed before the fix: both revision rounds now pass
grounding** (`revise.accepted` where it was `revise.rejected`). Read against the original,
word for word:

| Slide | Original | Revised |
|---|---|---|
| Summary | "Looking at current appearances…" | "**According to Wattles**, looking at current appearances…" — rest unchanged, character for character |
| Payoff | "…fails to impress your purpose upon **the formless substance**." | "…**Wattles argues that**… fails to impress your purpose upon **what he calls** the formless substance." |
| Takeaway | "…refuse to let current physical appearances shake your **faith**." | "…refuse to let current physical appearances shake your **focus**." |

**The read-it-yourself question the handoff asked directly: did the editorial pass make the
prose less stiff, or just different?** Honestly: **more honest, not less stiff.** The
attribution fix is precise and targeted — exactly the flagged sentences change, nothing else
does. But a third review pass on this same Leaf still surfaced a `prose` finding at the cap,
and that finding reaches gate 2 **unresolved** rather than being silently dropped or assumed
fixed. Two bounded rounds fixed what they were built to fix; the standing stiffness complaint
from WP17 is a harder problem than attribution and was correctly left open rather than
declared solved.

#### 4 — attributive framing: the ruling, as prompt text and as a checked behaviour

`draft_leaf.md` carries the rule the ruling asked for: a claim about **how the world works**
gets attributed ("Wattles argues that…"); an instruction about **what to do** does not, or
every sentence acquires a stammer. `extra_content.md` carries the sharper case for
`apply_in_life` — the behavioural residue ("write a specific, vivid description of what you
want and read it daily"), not the metaphysical step itself — using the exact contrast pair
from the ruling rather than inventing new language for it. `editorial_review.md` checks for
violations of the same rule under its `attribution` category, and the live run above shows it
firing correctly on real content.

#### 5 — gate 2's surface: blocked, and here is the precise, small spec

**Three field additions to `Leaves.ts`. No custom React components, no new collections —
every field type is one already used elsewhere in the same file.**

```ts
// 1. Populated by the pipeline. Lets a human see the three candidates without leaving
//    the Leaf to hunt through Media.
{
  name: 'imageCandidates',
  type: 'array',
  admin: { description: 'Pick one, then copy its url/alt into scenario.image below.' },
  fields: [{ name: 'url', type: 'text' }, { name: 'alt', type: 'text' }],
},

// 2. Populated by editorial_review. Advisory only — R3's principle applies here too.
{
  name: 'editorialFindings',
  type: 'array',
  admin: { description: 'Advisory notes from the editorial reviewer. Does not block publishing.' },
  fields: [
    { name: 'slideKey', type: 'select', options: SLIDE_KEYS.map((k) => ({ label: k, value: k })) },
    { name: 'category', type: 'text' },
    { name: 'note', type: 'text' },
    { name: 'suggestion', type: 'text' },
  ],
},

// 3. Set by the human. The tri-state outcome of gate 2.
{
  name: 'gateTwoStatus',
  type: 'select',
  defaultValue: 'pending',
  options: [
    { label: 'Pending review', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Changes requested', value: 'changes_requested' },
    { label: 'Rejected', value: 'rejected' },
  ],
  admin: { position: 'sidebar' },
},
```

Access: the machine account should be able to write `imageCandidates` and
`editorialFindings` (both pipeline-populated) but not `gateTwoStatus` — that field is the
human's decision alone. If field-level `access` is not worth the complexity, a documented
convention (the machine's writes never include `gateTwoStatus`) is an acceptable substitute
— `update_leaf_draft` already refuses anything that is not a draft-safe write, so this is
defence in depth rather than the only guard.

**The three criteria this blocks, precisely:**
- A human reviewing a Leaf, picking a candidate, and approving / requesting changes / rejecting
- An approved Leaf carrying its chosen image with the other two candidates unattached
- One Leaf timed through gate 2 — there is nothing to time until there is a screen

#### 6 — the graph-shape problem, third occurrence, handled the way it was asked to be

`review-track --run-id`, matching `write-drafts` and `generate-assets` exactly: a deliberate
CLI invocation over checkpointed state, not a graph edge, because a run that already reached
`END` cannot be reached by adding a node behind it.

**Its Payload-write step is unverified live** — `ZOOMOUT_PIPELINE_PAYLOAD_API_KEY` was never
set this session despite two requests. What *is* verified live is the mechanism the write
depends on: `review_and_revise` itself, called directly against real Track 42 records and
real Vertex calls (§2–3 above). The write path (`get_leaf` → `revised_leaf_patch` →
`update_leaf_draft`) is contract-tested including the safety property — a revision must
never clobber a human's existing image pick or diagram, verified by explicit read-modify-write
tests rather than trusting Payload's PATCH merge semantics for a field pairing WP18 never
actually tested (`scenario.image` alongside a revised `scenario.prompt` is not the same
pairing as `stickyNotes.diagram` alongside `notes`, which is the only case confirmed safe).

#### WP15.2 follow-on and the queued sixth anchor — both done

`cms/client.py` now sends `Authorization: admins API-Key <key>` on every request; the login
round trip is gone. Every existing write already sent `?draft=true` where WP15.2's finding
requires it — checked by reading each call site, not assumed. **Also unverified live**, same
blocker as above.

The sixth style anchor (a lit lamp with no glow) is generated, conditioned on the surviving
five, and committed — solid flat shapes, hard-edged light, no gradient or bloom.

#### Cost

| | |
|---|---|
| Editorial review + revise, live verification (4 full cycles on real Leaves) | **~$0.55** |
| Sixth anchor | $0.039 |
| **Total this package** | **~$0.59**, entirely against the trial credit |

Per-Leaf cost on the model actually used: roughly **$0.03–0.12** depending on how many
revision rounds fire. At 18 Leaves and up to 2 rounds each, a fully-reviewed Track is
**roughly $1–2** on top of the ~$4 WP18 already established — call it **$5–6 for a Track
that is drafted, illustrated, and editorially reviewed.**

#### Deferred, named

- **Everything in §5** — blocked on the three fields, not deferred by choice.
- **The Payload-write half of `review-track`**, unverified live — blocked on the API key.
- **Claude-via-Vertex for `editorial_review`**, blocked on a Vertex Model Garden quota
  increase — a console action, precise remedy known, not mine to submit.
- **Track 42 itself was not bulk-revised.** It predates the answer-length shuffle fix and is
  already slated for regeneration once this reviewer exists (WP17's own report). Spending
  review budget polishing 18 Leaves already due for replacement was not a good use of the
  remaining credit window; the mechanism was verified on a sample instead. A fresh WP20 run
  should go through `editorial_review`/`revise` from the start rather than retrofitting.
- **Wiring `editorial_review`/`revise` as live graph edges** for a fresh WP20 run, rather
  than only as a retrofit CLI. The pure functions (`review_and_revise` et al.) are shaped to
  support this without change — only the graph wiring itself is not yet done.


### Completed: WP18 — assets: image candidates, rendered diagrams, one visual identity — 2026-08-28

**Anchor set approved by the founder and committed. Generation, rendering, guardrails, budget
and upload all built and green.** The full 18-Leaf illustration run was still in flight when
this was written — see *Status of the illustrated Track* below, which is the one thing not yet
finished rather than not yet built.

#### The anchor set went first, and it earned that ordering

Five committed reference images plus a style contract derived from `design-direction.md`. It
needed no Payload contact and no WP17 output, so it could land inside the credit window
regardless of how the rest went — and it is the input everything else depends on.

**Bringing it to the founder before generating at scale was the right call, because two of the
first five were wrong** in ways no assertion would have caught. One came back as outlined line
art; another rendered a lamp as a volumetric light cone. Neither is a bad picture. Both read
as *a different illustrator*, which is precisely the failure the founder's requirement is
about.

Founder ruled: keep three, drop two, tighten the contract, regenerate. The contract gained two
prohibitions **from evidence rather than anticipation** — no outlines or line art, no lighting
effects — and a cap on teal after a third candidate used it as a background field rather than
an accent.

**The regenerated pair was conditioned on the three survivors, which is the mechanism the rest
of the package rests on, and it worked**: the glow disappeared and the line art collapsed to
faint residual contours. That is the first direct evidence that reference-image conditioning
does what the founder asked for.

#### An alignment worth recording

**Requiring stylised, non-identifiable figures satisfies the legal guardrail and the
consistency requirement with one rule.** Faces turned away or reduced to minimal marks make an
identifiable person off-*style* before it is off-policy, and simultaneously remove the single
biggest source of visual drift between images. The guardrail is enforced by construction
rather than by hoping the model behaves.

#### Diagrams: the constrained-JSON path, and a benefit R4 did not anticipate

Rendered by us, from a spec, per R4. Four things follow, and the fourth was a surprise:

1. Palette control — diagrams inherit `design-direction.md` and re-theme rather than needing
   regeneration.
2. **Legibility enforced by the schema**: 2–5 nodes, labels capped at 42 characters. An
   unreadable diagram is unrepresentable rather than merely discouraged. WP9 learned this at
   thumbnail size.
3. Correctly spelled text. The no-text rule exists because *image models* cannot spell; it does
   not apply when we draw the glyphs.
4. **`alt` accurate by construction.** We know what is in the picture because we put it there.
   A description derived from structure cannot hallucinate — strictly better than asking a
   model to describe its own output, and a concrete argument for JSON over Mermaid that R4 did
   not make.

The spec is stored beside the render (`specFormat: json`), which is what WP15 added those
fields for.

#### The budget halts

Charged **before** each call, not after — charging afterwards means the run has already spent
what it was not allowed to spend, which makes a cap a report. Counted in images rather than
currency, because the price is a published rate we do not control and the count is what the
pipeline decides. Tier A tested by setting the cap low and asserting the refusal is not
counted.

#### Guardrails: be precise about which are actually checked

| Guardrail | Enforcement |
|---|---|
| No reward amber `#FFB020` | **Mechanically, in code** — including against the committed anchors, since every image inherits them |
| No rendered text | Style contract, plus a human looking |
| No identifiable person | **By construction** — the contract requires figures with no distinguishing features |

**Only amber is asserted in code, and the module says so.** Claiming the other two are
"checked" because a prompt forbids them would be the same mistake as calling the 1:1 structure
requirement enforced because `breakdown.md` asks for it.

#### Two things the first live run taught

**Payload wants a multipart upload's document fields as one JSON `_payload` part.** Sending
them as separate form fields is silently ignored, and the upload then fails on `alt` being
required — which reads as a bug in the alt text rather than in the encoding.

**A draft patch lands in `_leaves_v`, not `leaves`.** Exactly the property WP15.1 recorded. My
first verification query checked the published table, found empty fields, and looked like a
dropped write. It was the versioning working as designed: what the pipeline writes stays
invisible until a human publishes.

#### A defect in my own process, not the code

I reported adding a rate-limit retry to the image client, and **the patch had not applied** —
the anchor run succeeded only because the quota had cleared. Caught later by inspection, not by
the report. The lesson is the one this project keeps relearning: a patch that reports success
is not a change that happened. I now grep for the thing I claim to have added.

#### Read it yourself

Three Leaves' candidates side by side. **They do look like one product** — same medium,
palette, figure treatment and compositional language. A reader moving between Leaves would
recognise them as coming from the same place, which is the founder's actual requirement and it
is met.

**But the no-lighting-effects rule is not holding under pressure.** Where a subject implies a
light source — a shop at night, a laptop in a dark room — the model reaches for a glow anyway:
mild on Leaf 1, pronounced on Leaf 2. The written prohibition is weaker than the anchor
conditioning, and the anchors contain no lit-lamp example to contradict it.

**This is style drift, not a guardrail breach** — no amber, no text, no identifiable people.
Worth fixing by adding a sixth anchor that deliberately depicts a lit lamp *without* a glow,
which teaches the exception rather than merely forbidding it. Recommended, not urgent.

#### Cost — final, measured against the finished run

| | |
|---|---|
| Per image (verified) | **$0.039** |
| Track 42, actual | 52 images (51 charged + 1 from the earlier probe) = **$2.03** |
| Diagrams | **$0** — a text call and a local render, all 18 |
| Anchor set (one-off, not repeated per Track) | $0.31, 8 images including the two discarded |
| **Total image spend, this package** | 60 images = **$2.34** |

**Drawn entirely from the trial credit — confirmed against the console, not assumed.** Billing
remains enabled against the same account with no upgrade to a paid account, so nothing here
touched a card.

**The number that matters for the roadmap:** a Track costs roughly **$2 of text plus $2 of
images**, so about **$4 fully illustrated**. Images are the only per-Leaf recurring cost, but
they are not the dominant one — text is level with them.

#### The illustrated Track — finished

All 18 Leaves carry a diagram and three scenario candidates: **70 media rows, zero missing
`alt`.** Two of 54 attempted candidates were refused by the model (the guardrails forbidding
identifiable people apply to it as well as to us) and the run continued past them rather than
failing the Leaf — 17 Leaves show 3 candidates each, confirming nothing silently short-changed
a Leaf. Zero diagram renders failed. Nothing published: `tracks._status` and every
`leaves._status` are still `draft`.

**The amber guardrail was run against all 70 generated images, not only the anchors — 70 of 70
clean.** That closes the loop the acceptance criterion asked for: checked, and said how, on
the actual output rather than only on the reference set.

#### A shared-checkout collision, and how it was handled

After this report was first drafted, the shared working directory moved to
`wp15.2-pipeline-key` — another session's branch, forked from before WP18 existed — which
correctly removed WP18's tracked files from the working tree (they are only ever committed to
`wp18-assets`, never merged). The stray `__pycache__` looked, for a moment, like lost work.

**Nothing was lost.** Confirmed by reading the commits directly (`git show wp18-assets:...`)
before touching anything. The rest of this verification — the full gate, the amber check
against all 70 images, this edit — ran from a `git worktree` on `wp18-assets`, deliberately
chosen over switching the shared checkout back: doing that would have discarded another
session's uncommitted `apps/admin` work, which was mid-flight on WP15.2 at the time (and
includes, incidentally, the `next.config.ts` fix this package's predecessor asked for).

#### Deferred, named

- **A sixth anchor for lit interiors**, to teach the no-glow exception rather than assert it.
- **OCR for the no-text guardrail.** Rejected for now: a dependency and its own false positives
  to catch what the style contract already prevents, and a human sees every image at gate 2.
- **Candidate selection is WP19's.** Candidates are uploaded and none is attached — picking one
  here would present a decision as though it had been taken.
- **`scenario.image` stays empty** until a human picks. That is the intended state, not a gap.
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

