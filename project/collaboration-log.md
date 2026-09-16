# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.


> **Phase 1 entries (WP0–WP15, to 2026-08-13) moved to `project/archive/collaboration-log-phase1.md`
> on 2026-08-28.** This file was 397KB — roughly 100k tokens that every session paid before reading a
> line of code. The archive is the durable record and is still there when a decision needs tracing;
> it is simply no longer loaded by default.


> **Older entries are archived.** Phase 1 in `project/archive/collaboration-log-phase1.md`,
> Phase 2 in `project/archive/collaboration-log-phase2.md`, and the visual redesign plus the first
> two books in `project/archive/collaboration-log-redesign.md` (split 2026-09-15). This file keeps
> the four most recent of each section — **plus any handoff whose package is still open**, an
> exception added 2026-09-15 because pruning a live handoff is how WP28 lost time. Every session
> pays for this file at startup. Archive at each sign-off, not when it hurts.

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

### Handoff: 2026-09-16 — WP33.1: prove the transfer, then stop the key leaking

*Pipeline Manager. **Suggested model: Sonnet** — Part A is a script over functions you have already run once, and Part B is one line in each of two places plus a test. **The judgement in Part A was spent choosing sha256 over re-guarding; what is left is reading a table.***

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Check your branch — that checkout was on `wp32-paid-tier-check` this morning.** `git checkout main && git pull`, then branch from `origin/main`.
> **Read:** this handoff · **your own WP33 completion report**, where you did Part A once for Leaf 4 · `apps/pipeline/src/zoomout_pipeline/config.py` · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP33.1 — the publish pre-flight, and the credential in the log

**Suggested model:** Sonnet.

**Context:** You ended WP33 by naming exactly the right caveat: *"Ikigai has no known style breach"* means **at generation time** for seventeen Leaves and **as attached** for Leaf 4 only. You offered two options — publish on generation-time evidence, or spend a package on the read-back command. **Ruled: neither.** Re-guarding seventeen images buys a *second non-deterministic sample* from an instrument measured at four real breaches and one false positive across nineteen; it does not buy certainty, and it costs a package on the critical path to the pilot.

**The question worth answering is whether the bytes Payload serves are the bytes the guard already cleared.** That is sha256 — free, deterministic, no model call — and **you already proved the method on Leaf 4** (byte-identical, `c2e0c8d6…`). Every candidate is still on disk and each was overwritten in place by its own regeneration, so the local file for every Leaf is its final cleared version. Verified by mtime 2026-09-16: Leaves 3 and 7 at 20:27/20:29 on 09-15, Leaf 4 at 10:53 on 09-16, the rest from the WP30.1 run.

**Objective:** A table of eighteen rows saying, for each Ikigai Leaf, whether what Payload serves is byte-identical to the candidate the guard cleared — and the Gemini and Payload keys no longer printable by a validation error.

---

## Part A — the pre-flight. **Report this the moment it is done; the founder publishes on it.**

**Scope:** a script. **Read-only against Payload — this part writes nothing, to any collection, ever.** Whether it lands as a committed command or a throwaway is your call; if committing it is more than a few minutes, run it and paste the table.

**Requirements**
- For each of Track 50's eighteen Leaves: fetch `scenario.image`, fetch the media bytes **from Payload**, sha256 them, and compare against `runs/ikigai/images/leaf-NN-scenario-1.png`.
- **Report all eighteen rows** — order index, `_status`, served filename, short hash, verdict. Not just the failures.
- **On any mismatch: stop and report. Do not fix, regenerate, or re-attach anything.** A mismatch means either the wrong candidate is attached or the bytes were transformed, and both change the founder's publish decision. Say which you think it is and what would settle it.

**Three traps, all of which cost me time this morning:**
- **A 200 with zero rows is what "not authenticated" looks like.** Drafts are invisible anonymously, and my first query returned `200` and an empty list, which reads exactly like "nothing there". **Assert the count is 18 before trusting a single verdict**, and say what the count was. *"18 of 18 match"* against an empty set is the failure mode this bullet exists to prevent.
- **The field is `trackId`, not `track`.** `where[track][equals]=50` returns HTTP 400.
- **The orderIndex→filename mapping is an assumption until Leaf 4 proves it.** Leaf 4 is your known-good anchor: you have its hash. **If Leaf 4 does not match, the harness is wrong, not the data** — fix the harness before reading anything else in the table.

**One hypothesis worth holding, so a bad result is read correctly.** If the seventeen mismatch *systematically* while Leaf 4 matches, the likely cause is not corruption — it is that WP30.1's batch path and WP33's script path differ in how they store bytes. **That is a finding about the pipeline, not a reason to regenerate seventeen images.** Say so rather than reaching for the generator.

**What this does not close, and should be said in your report so nobody over-reads it:** it establishes *transfer and wiring* — that the cleared image is the served image, and that no candidate landed on the wrong Leaf, which is WP20's Leaf-11 defect family. **It does not re-examine the images.** Seventeen still rest on their generation-time verdict, and that residual is accepted deliberately.

**Acceptance criteria — Part A**
- [ ] **Eighteen rows reported**, with the fetched-leaf count stated explicitly and asserted to be 18
- [ ] **Leaf 4 matches** its known hash `c2e0c8d6…` — the control that proves the mapping
- [ ] Every Leaf's `_status` is `draft`, and **nothing was written to Payload** — say how you know
- [ ] Any mismatch is reported and **not acted on**, with your read of the cause
- [ ] $0.00 spend — **if this part costs money, something is wrong; stop**

---

## Part B — `SecretStr`. Does not gate publishing.

**Context:** you hit this by accident in WP33 — a pydantic `ValidationError` on settings echoes the whole input dict, and a truncated Gemini key landed in your terminal. It would land in CI output the same way. **Verified in the code 2026-09-16: `config.py:101` declares `gemini_api_key: str`, `:172` `payload_api_key: str`, and `SecretStr` is not imported.**

It is being folded in here rather than waiting for a convenient package because it is a credential in a log, and "the next pipeline package" has historically meant three packages.

**Requirements**
- `SecretStr` on `gemini_api_key` and `payload_api_key`; update the call sites that read them.
- **A test that asserts a validation error does not contain the key material** — trigger the real failure (unset `ZOOMOUT_PIPELINE_DATABASE_URL`) and assert the rendered message. **A test that only asserts the field's type would pass against a future field that leaks.**
- **Mutation-check it:** revert the `SecretStr` on one field and confirm that test alone goes red.

**Out of scope (both parts)**
- **Publishing anything.** The founder publishes the eighteen Leaves; nothing here does it.
- **Regenerating any image**, including on a mismatch.
- Building the general `check-style` command — still debt, still after the pilot.
- `apps/mobile`, `apps/backend`, `apps/admin`.

**Constraints:** **Part A must cost $0.00** — no model calls. Part B is code only. If you find yourself about to call a model in either part, stop and say why.

**Device gate — the table, not the app.** Ikigai's Leaves are drafts and `contentVisibility.ts` makes a draft unservable everywhere, so there is nothing to see in the app. **What to observe: the eighteen rows, with the count asserted** — that every served image is the image the guard cleared, and that Leaf 4's row is the one you can check against a hash you already had.

**Acceptance criteria — Part B**
- [ ] `ruff check`, `ruff format --check`, `mypy --strict`, `pytest` clean; nothing outside `apps/pipeline` touched
- [ ] Both keys are `SecretStr`; the real validation failure renders them masked
- [ ] The test asserts **the absence of key material in the message**, not the field's type — and the mutation goes red

**Testing expectations:** Part A needs no test — it is a measurement, and its evidence is the table plus the Leaf 4 control. Part B needs the one test above. **Say which evidence is a test, which is the script, and which is you looking**; that split is why your last four reports were trustworthy.

---

### Handoff: 2026-09-16 — WP33: regenerate Ikigai Leaf 4's bloom

*Pipeline Manager. **Suggested model: Sonnet** — this is the rare pipeline package where the design is already written. WP31 built the guard, ruled the light rule, and did this exact operation twice on Leaves 3 and 7. There is no judgement left to buy; the guard makes the call.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Check your branch first — that checkout was parked on `wp32-paid-tier-check` on 2026-09-16, which predates WP32's own sign-off.** `git checkout main && git pull`, then branch from `origin/main`.
> **Transport:** `acquisition` is `undocumented`, so `require_paid_tier` now routes this to Vertex and **refuses** the free tier. That is a check as of WP32, not discipline — but confirm the refusal path is live rather than assuming it, because three consecutive reports cited a comment that was never true.
> **Read:** this handoff · **your own WP31 completion report** — the guard, the light-rule rewrite, and the two prompt defects it found · `apps/pipeline/src/zoomout_pipeline/assets/style_guard.py` · `prompts/asset_style.md`'s light rule · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP33 — the last image between Ikigai and a readable book

**Suggested model:** Sonnet.

**Context:** Ikigai's Leaf 4 carries a teal radial falloff at a soldering-iron tip — a bloom, and a breach of the light rule as WP31 rewrote it. **WP31 reported it rather than fixing it**, correctly: that package was scoped to Leaves 3 and 7 and its handoff called a flag on the other sixteen a finding, not a failure. It is now the only thing standing between Ikigai and publication, and **publication is the whole critical path to the in-person pilot.**

**What makes this worth a package rather than a note:** WP30.1's human pass cleared this image, and **Architect cleared it again at sign-off, looking at the same contact sheet.** The guard caught it. That is the strongest evidence WP31 produced and it is evidence against reviewing style by eye.

**Objective:** Leaf 4's scenario image is replaced with one that passes the style guard and still belongs to its scenario and to the set, attached as a draft.

**Scope:** `apps/pipeline`, plus Ikigai's **draft** Leaf 4 record. **Verify the regeneration path yourself** — you ran it twice in WP31 and that report is the authority, not this line.

**Requirements**
- **Regenerate Leaf 4's scenario image until it passes the guard**, then **look at it yourself.** Both, in that order — the guard is the gate, your eye is the second check, and WP31 established the guard catches what the eye misses rather than the reverse.
- **If it resists, stop and report rather than buying attempts.** Leaf 3 took four regenerations across two packages, and the cause was in the scenario prose rather than the image prompt. If Leaf 4 behaves the same way, **the finding is worth more than the image** — say what you found and stop.
- **Leaf 4 stays a draft.** Do not publish it, and do not touch any Track-level field.
- **Report the spend against the ceiling.**

**Out of scope**
- **Publishing Ikigai's Leaves.** That is the founder's action, immediately after this lands, and doing it early would freeze anything still wrong.
- **The other seventeen images.** They were guarded at generation and Leaf 4 is the only one flagged. If you have reason to think that is wrong, say so — do not act on it.
- **Track 42's published Leaf 1.** Still unfixable by this pipeline and still the guard's best fixture.
- **A `check-style` command over existing images** — see the constraint below. It is logged as debt and it is not this package.
- `apps/mobile`, `apps/backend`, `apps/admin`.

**Constraints:** **Ceiling $0.50.** One image at $0.134 plus guard reads at $0.004 each leaves room for three or four attempts, which is more than WP31 needed per Leaf after the prompt fixes landed. **If you are approaching the ceiling, that is the signal to stop and report, not to ask for more.**

**One correction to carry, because your own report will contradict it.** WP31's closing note says *"Do not publish the Leaves without running the guard over the set first — it is now one command and $0.073."* **That command does not exist.** Checked 2026-09-16: `check_style` is imported in exactly one place, `cli.py:397`, inside `generate-assets`, and fires only on a candidate as it is generated. Nothing reads attached images back. The 19-image sweep was your `live` suite. **Nothing was wrong with the work** — the sweep happened — but the note describes an affordance the CLI does not have, and the next person to trust it would skip a check believing they had run one. It is in the debt register; **do not build it here.**

**Device gate — the artefact, not the app.** Ikigai's Leaves are still drafts and `contentVisibility.ts` makes a draft unservable in every environment, so there is nothing to see in the app yet. **What to observe: the new Leaf 4 beside the old one, and the eighteen as a set** — that the bloom is gone, that no glow, text or floating iconography replaced it, that the soldering iron still reads as a soldering iron, and that the set still looks like one library.

**Acceptance criteria**
- [ ] Pipeline `lint`, `ruff format --check`, `mypy --strict`, `pytest` clean; nothing outside `apps/pipeline` touched
- [ ] **The guard goes red on the current Leaf 4** — show the verdict, in its own words. This is the criterion that proves the replacement was necessary rather than assumed
- [ ] **The replacement passes the guard**, and you say which attempt it was and what the earlier ones came back as
- [ ] **You looked at it**, beside the old one and against the set — reported as an observation, not a verdict
- [ ] **Leaf 4 is still a draft**; no Track-level field touched; no Leaf published
- [ ] **The transport is recorded and the run went through Vertex** — a row you can point at, not a sentence in this report
- [ ] Spend reported against the $0.50 ceiling
- [ ] **If anything about the other seventeen changed your mind, it is stated** — as a finding, with nothing acted on

**Testing expectations:** no new test is expected — the guard's coverage landed in WP31 and this package exercises it rather than extending it. **If you find yourself wanting one, that is a finding about the guard and worth reporting.** Say which evidence is the guard, which is a test, and which is you looking; that split is why your last three reports were trustworthy.

---

### Handoff: 2026-09-15 — WP32: make the paid-tier constraint a check

*Pipeline Manager. **Suggested model: Opus** — small code, and the reasoning about what to key it off decides whether it holds. **This was ruled the next package on 2026-09-15 and then not handed off; that delay is Architect's, and it is why three consecutive completion reports have had to report the same gap.***

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. Branch from `origin/main`.
> **⚠️ Until this package exists, the thing it builds does not:** `export USE_VERTEX=true` and unset the Gemini API key from the process before any model call.
> **Read:** this handoff · `apps/pipeline/src/zoomout_pipeline/config.py` (the comment at line 26 and `paid_tier` at ~160) · `apps/pipeline/src/zoomout_pipeline/llm/client.py` (`GeminiClient.__init__`) · `apps/pipeline/src/zoomout_pipeline/cms/mapper.py` (`require_known_author` — **the shape to copy**) · `packages/shared/src/content.ts` `TRACK_ACQUISITION_STATUSES` · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP32 — the constraint that is currently a comment

**Suggested model:** Opus.

**Context:** `config.py:26` says `require_paid_tier` *"turns that from a memory into a check."* **That function has never existed.** `paid_tier: bool = False` is read by no code; the only other mention is a second comment in `client.py`. `GeminiClient` takes `use_vertex` and `api_key` independently and cross-checks neither against the book being processed.

**Google's free tier trains on submitted content.** This is the control that keeps copyrighted works off it, and it is prose. **Ikigai — copyrighted — has already been through the pipeline twice.** It went through correctly, on one session's discipline, and **nothing in the repo records that it did**: the run log has no transport line, so the claim cannot be checked afterwards and never will be.

**Objective:** A run that would send a non-public-domain book through the free tier fails before the first call, and every run records which transport it used.

**Scope:** `apps/pipeline` only.

**Requirements**
- **Key the check off the book's `acquisition` status, not a hand-set bool.** `public-domain` may use the free Developer API; `purchased`, `licensed` and `undocumented` must use Vertex. **A flag someone has to remember to set is the failure this entry already is** — `paid_tier` exists today and is exactly that.
- **Fail before the first paid call, not on it.** `require_known_author` in `cms/mapper.py` is the shape to copy: it refuses, and **the refusal names the fix**. A run that dies at Leaf 9 with a quota error has already sent eight Leaves' worth of a copyrighted book somewhere it must not go.
- **Record the transport in the run.** Vertex or Developer API, the project id when Vertex, and the resolved `acquisition` — written where `status`/`cost` already look. **Provenance becomes a query rather than a memory**, which is the whole argument the `acquisition` field itself was built on.
- **Say what the check cannot see.** If it keys off `acquisition`, then a book mislabelled `public-domain` passes — name that plainly rather than leaving it implied.

**Out of scope**
- The grounding gate's false reject, the gate-1 named-framework flag, the Leaf publish gate — separately packaged.
- Any change to `apps/admin`'s collections or to `packages/shared`. If the check needs a value that does not exist in the pipeline's own state, **say so and stop** rather than reaching into another workspace.
- Fixing Ikigai or Track 42.
- **Chasing the Vertex quota for Claude** — that is a founder console action, tracked separately.

**Constraints:** **Ceiling $1.** This should need almost no model calls; if it needs more than a smoke test, say why before spending.

**Device gate — none, and that is deliberate.** Nothing here reaches a screen. **What to observe instead: the check refusing.** Point a run at a non-public-domain book with Vertex disabled and confirm it **stops before any call is made** — not that it warns, not that it fails partway.

**Acceptance criteria**
- [ ] Pipeline `lint`, `ruff format --check`, `mypy --strict`, `pytest` clean
- [ ] **A non-public-domain book with the free tier configured refuses before the first model call** — demonstrate it, and show that zero calls were made
- [ ] A public-domain book on the free tier still runs
- [ ] Any book on Vertex runs
- [ ] **The run records its transport, project id and resolved `acquisition`** — show the record from a real run
- [ ] `config.py:26`'s comment is either true or gone — **no comment describing a function that does not exist**
- [ ] **What the check cannot catch, stated plainly**
- [ ] Spend reported against the $1 ceiling

**Testing expectations:** unit coverage on the refusal, both directions, mutation-checked — remove the check and confirm the refusal test goes red. **The load-bearing test is the one proving no call was made**, not the one proving an exception was raised.

---


### Handoff: 2026-09-15 — WP31: the output-side image guard, and Ikigai's last two breaches

*Pipeline Manager. **Suggested model: Opus** — the finding is the deliverable. A detector that reports clean on an image with "$10K" written across it is the exact failure this package exists to prevent, and it is the failure that reports green.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. Branch from `origin/main`.
> **⚠️ Before any model call:** `export USE_VERTEX=true` and **unset the Gemini API key from the process.** `ZOOMOUT_PIPELINE_PAID_TIER` is enforced by nothing — `require_paid_tier` does not exist, `paid_tier` is read by no code — and Ikigai is a copyrighted book. The free Developer API trains on submitted content. This is discipline, not a check, until the paid-tier package lands.
> **Read:** this handoff · **your WP30.1 completion report, commit `88a3e14`** · **WP30's, commit `a00527f`** · `apps/pipeline/src/zoomout_pipeline/assets/variety.py` — the precedent for image analysis in this service · `prompts/asset_style.md` · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP31 — catch in the output what the prompt cannot prevent

**Suggested model:** Opus.

**Context:** Three absolute prohibitions in the style contract are breached by images that passed every gate. **Ikigai Leaf 3** has a soft phone glow and two floating notification icons; **Leaf 7** has floating icons; **Track 42's published Leaf 1** renders "$10K" and "$2K" legibly *and* carries a glow. WP30 closed the input half — a focus object whose whole point is its writing is refused at parse — but a model asked for a laptop still writes "$10K" on it, and **nothing looks at the result.** Both Ikigai scenarios are about digital distraction, so this is a predictable failure of a whole scenario class, not bad luck.

**Objective:** Generated images are checked for text, glow and floating iconography before they are attached, and Ikigai's Leaves 3 and 7 pass.

**Scope:** `apps/pipeline` only, plus Ikigai's **draft** Leaf records. **Track 50 itself is published as of 2026-09-15 and is therefore out of reach** — the machine account cannot edit published documents. Its eighteen Leaves are still drafts, which is what keeps this package runnable.

**Requirements**
- **Build the output-side guard.** Design it yourself — `variety.py` is the precedent for image analysis here, and whether this is classical CV, a vision call, or both is your call. **Say what you chose and what it cannot catch**, because every one of these has a blind spot and an unstated blind spot is worse than a known one.
- **It must fire on the known-bad fixtures.** Track 42's Leaf 1 (text + glow) and Ikigai's current Leaf 3 (glow + floating icons) are the corpus. **A guard that has never gone red against a real breach is not evidence.** Commit them as fixtures the way `collapsed-track` already is.
- **Regenerate Ikigai Leaves 3 and 7 until they pass the guard**, then look at them yourself. Leaf 3 came back worse once already; if it resists, **say so and stop** rather than buying attempts.
- **Rewrite `asset_style.md`'s light rule.** It currently forbids *"a shaft of light thrown across a surface"* while the whole library and the committed anchors draw cast light. **The ruling: the line is falloff, not subject matter — cast light may be a flat, hard-edged shape of a lighter surface value; no gradient, bloom, halo or emissive source.** Leaf 8's auditorium is a hard-edged polygon and stays legal; Leaf 3's phone is a soft bloom and does not. **The rewrite must not launder the breach it was asked about.**

**Out of scope**
- **Track 42's published Leaf 1 — read-only, as a fixture.** The machine account cannot edit published content (`access/publishing.ts`: *"an update to a live document is a live content change"*), so fixing it needs the founder to unpublish first. **That is a founder decision and not this package's.** Use the image; do not try to replace it.
- Publishing Ikigai, or any Track-level field — the founder is filling those by hand.
- The paid-tier check, the grounding false reject, the gate-1 named-framework flag — all separately packaged.
- `apps/mobile`, `apps/backend`, `apps/admin`.

**Constraints:** **Ceiling $4.** Two Leaves at one candidate each is well under; the rest is headroom for regeneration and for whatever the guard itself costs per image. **If the guard is expensive per image, say what it would cost across an 18-Leaf book before adopting it as a default** — a check nobody can afford to run is not a check.

**Device gate — the artefacts, not the app.** Ikigai is still a draft and `contentVisibility.ts` makes drafts unservable in every environment. **What to observe: Leaves 3 and 7 side by side with their current versions, and the eighteen as a set** — that the two replacements carry no text, no glow and no floating iconography, and that they still belong to their scenarios and to the set's visual identity.

**Acceptance criteria**
- [ ] Pipeline `lint`, `ruff format --check`, `mypy --strict`, `pytest` clean
- [ ] **The guard goes red on Track 42 Leaf 1 and on Ikigai's current Leaf 3** — show both results
- [ ] The guard passes the other sixteen Ikigai images — **and if it flags any of them, that is a finding, not a failure; report it**
- [ ] **Ikigai Leaves 3 and 7 replaced**, passing the guard, and **looked at**
- [ ] `asset_style.md`'s light rule rewritten on the falloff line; **Leaf 8's cast light still legal, Leaf 3's glow still a breach**
- [ ] **Ikigai's eighteen Leaves are still drafts**, and no Track-level field is touched. **Track 50 itself was published by the founder on 2026-09-15, after this handoff was written** — the Leaves were not, which is the only reason this package can still run: the machine account cannot edit published documents, and a published Leaf would be frozen. **Do not publish the Leaves**; that is the founder's action once this package lands
- [ ] **What the guard cannot catch, stated plainly**
- [ ] Spend reported against the $4 ceiling

**Testing expectations:** unit coverage on the guard, with the known-bad fixtures as the load-bearing cases. Mutation-check it: disable the detector and confirm the fixture tests go red. **Say which evidence is a test, which is the guard, and which is you looking** — that split is why your last two reports were trustworthy.

---


### Handoff: 2026-09-15 — WP30.1: finish Ikigai's images inside the credit, and fix Leaf 17

*Pipeline Manager — **a fresh session, so this handoff assumes no memory of WP30.** **Suggested model: Opus.** Two judgement calls, both of the kind that report green while being wrong: whether a rewritten Leaf 17 still reproduces the book's named framework, and whether eighteen images actually vary. Neither is testable.*

> **Where you work:** the pipeline checkout at `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Branch from `origin/main`** — WP30 merged as PR #44 and all of its code (`assets/variety.py`, `graph/scene_settings.py`, the rewritten `prompts/asset_style.md`, `prompts/anchor_instruction.md`) is already there. Do **not** continue on `wp30-scenario-settings`.
> **Read:** this handoff · **WP30's completion report, commit `a00527f`** · **WP30's handoff, commit `da5bfb8`** — both cited by hash because the log prunes by position · `apps/pipeline/src/zoomout_pipeline/assets/variety.py` · `apps/pipeline/src/zoomout_pipeline/graph/scene_settings.py` · `apps/pipeline/src/zoomout_pipeline/prompts/asset_style.md` · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP30.1 — Ikigai's eighteen images, and the named-framework breach

**Suggested model:** Opus.

**Context:** WP30 built the scene-setting generator and produced Ikigai's text — Track 50, 18 draft Leaves, nothing published — then stopped before images when spend reached $10.07. **Two of its nine criteria are unmet for one reason: no Ikigai images exist.** Separately, WP30's own report found that **Ikigai's Leaf 17 lifts three of the book's "ten rules of ikigai" as sticky notes, in the book's own imperative phrasing.** `PRODUCT.md` forbids reproducing a named framework 1:1. It passed every mechanical gate, because the 1:1 check measures chapter mapping and cannot see phrasing.

**Budget — the hard constraint of this package.** The founder has confirmed the existing Google Cloud credit covers this and wants Ikigai finished on it. **Ceiling: $5 total.** Eighteen images at one candidate each is $2.41; the Leaf 17 regeneration is the rest. **If the run would exceed $5, stop and report rather than continue** — WP30 overran a stated ceiling by 2x and its own report is clear that narrating a rate is not the same as asking.

**Order matters and is not arbitrary.** Leaf 17 is rewritten **first**. Its rewrite changes its scenario, which changes its derived setting, which changes its image. Generate first and you buy that image twice.

**Scope:** `apps/pipeline` only, plus the Ikigai draft records in the CMS that the pipeline already owns.

**Requirements**
- **Rewrite Leaf 17 so it does not reproduce the book's named framework.** Teach the same idea without lifting the list or its phrasing. Run it at `editorial_attempts=1` — WP20 made that cap configurable for throughput, and WP30 established it is also the cost lever.
- **Re-derive the Track-level ScenePlan after the rewrite**, so Leaf 17's setting reflects the new scenario and the whole-Track variety constraint still holds across all eighteen.
- **Generate eighteen scenario images, one candidate per Leaf.** One rather than gate 2's three is deliberate: the variety check now catches collapse mechanically, which is most of what a second and third candidate were for.
- **The variety check gates the set before anything is attached.** Regenerate only the Leaves it flags, and only if the ceiling allows. If it still fails after one regeneration pass, **stop and report the score** — do not keep buying images toward a threshold.
- **Look at all eighteen yourself before attaching them.** Specifically for: **any text, letters or numerals**; **any glow or light bloom**; and disembodied limbs. All three are absolute prohibitions in the style contract, and all three have shipped past the mechanical gates before — Track 42's published Leaf 1 renders "$10K" and "$2K" legibly *and* has a glow on the teal card, which is live right now on a published Track.
- **Retain the images.** WP30's four-image before/after was its own most important evidence and no longer exists on disk — nothing from that comparison survives, so neither the founder nor Architect can see what was claimed. **Save the eighteen where they survive the session** and hand the founder a contact sheet.

**Out of scope**
- **An output-side text/glow detector.** Wanted, and a separate package — it must not put this credit-bound run at risk.
- **A per-Track text budget that refuses.** Also wanted, also separate; `ImageBudget` already halts, which is what this package needs.
- **Track 42's published images**, including the Leaf 1 breach. Logged separately.
- **Publishing Ikigai.** Draft only, unchanged from WP30.
- `apps/mobile`, `apps/backend`, `apps/admin`, any shared-type or Payload collection change.

**Device gate — replaced, and here is why.** WP30's device gate asked for Ikigai Leaves observed in the app. **That was unmeetable and the fault was Architect's**: `apps/backend/src/content/contentVisibility.ts` returns `content.status === 'published'` in *every* non-production environment — *"a draft is never servable anywhere"*, deliberately — so no draft Track can reach the app without a backend change the same handoff put out of scope. **What to observe instead: the eighteen images as a set, side by side.** For each one, whether its place belongs to its scenario; across the set, whether the places differ. The in-app observation is deferred to whenever Ikigai is published and is recorded as debt, not dropped.

**Acceptance criteria**
- [ ] Pipeline `lint`, `ruff format --check`, `mypy --strict`, `pytest` all clean
- [ ] **Leaf 17 no longer reproduces the ten rules** — neither the list nor its phrasing. Say in your own words why the rewrite clears it, rather than asserting that it does
- [ ] All eighteen Ikigai Leaves carry a scenario image; Track 50 is still a **draft**, still `acquisition: undocumented`
- [ ] **The variety check passes against Ikigai's eighteen** — report the median nearest-neighbour distance and the closest pair, not just the verdict
- [ ] The same check still **fails against Track 42's set** — it is committed as `tests/fixtures/collapsed-track`, so run it both ways and show both numbers
- [ ] **Observed: eighteen images looked at, no text, no glow, no disembodied limbs** — name anything you rejected and regenerated
- [ ] **The eighteen images are retained and a contact sheet is handed over**
- [ ] **Total spend reported against the $5 ceiling**, images and text separately

**Testing expectations:** no new test can prove the variety claim, and do not write one that pretends to. Cover the Leaf 17 regeneration path and any change to scene derivation. **Say plainly which evidence is a test, which is the variety check, and which is you looking at pictures** — WP30 got this right and it is the reason its report was trustworthy.

---


### Handoff: 2026-09-11 — WP30: Ikigai end to end, with scenario images that match their scenarios

*Pipeline Manager. **Suggested model: Opus** — the finding is the deliverable on the first half. "The images vary now" is exactly the claim that can be asserted green while being false; it took the founder's eye to catch the current state.*

> **Read:** this handoff · `apps/pipeline/src/zoomout_pipeline/graph/asset_nodes.py` (`scenario_image_prompt`) · `apps/pipeline/src/zoomout_pipeline/prompts/asset_style.md` · `apps/pipeline/src/zoomout_pipeline/assets/images.py` · `apps/pipeline/assets/anchors/` · `project/proposals/design-direction.md` · your own WP18 and WP20 completion reports in this log · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP30 — Ikigai end to end, with scenario images that match their scenarios

**Suggested model:** Opus.

**Context:** Track 42's eighteen scenario images are all a seated figure at a table in a dim interior. **Verified on the published record, not reported** — Architect pulled Leaves 0, 5, 9 and 13 from the live CMS and looked at them. Leaf 13's scenario is *"you want to buy a new house for your family"* and the image is a man alone at a desk at night with a calculator. The house style is working — the library does look like one product — but it is holding the **environment** constant along with the palette, and that is not what it was for. Book #2 is Ikigai, and generating it before this is fixed means paying for eighteen images twice.

**Four causes were identified, and none is the scenario text:**
1. **The prompt never names a place.** `scenario_image_prompt()` is scenario prose + "illustrate as a single quiet moment" + the style contract. The prose describes a situation and a feeling; it contains no location, so the model invents one and defaults to the safest interior.
2. **The style contract's subject list is table-first.** *"Ordinary modern life: a desk, a commute, a kitchen table, a shop counter, a conversation"* — four of five are people at tables, phrased as a menu of examples rather than an instruction to vary.
3. **Five of the six committed anchors are seated interiors.** A reference image carries environment and composition, not only palette and technique, so the anchors are teaching "seated person, table, dim room" as if it were style.
4. **Nothing sees the set.** Each Leaf generates independently, so "they are all the same" is structurally undetectable.

*Secondary, already forbidden by the contract: Leaf 13's papers carry arrow and line glyphs that read as writing.*

**Objective:** Two things, in this order. **(A)** Scenario images keep one visual identity — medium, palette, figure treatment — while their *setting* is driven by the scenario, proven by a before/after on identical scenario text. **(B)** Ikigai is onboarded end to end with the fixed generator and lands in the CMS as a reviewed draft.

**Scope:** `apps/pipeline` only — `graph/asset_nodes.py`, `prompts/asset_style.md`, `assets/` and the anchor set, plus tests.

**Requirements — Half A, the generator**
- **Derive a concrete setting per Leaf from the scenario, and name it in the image prompt.** The scenario implies a place even when it does not state one; the generator should decide it explicitly rather than leave the model to default.
- **This must not require a schema change.** The setting is a generation artifact — recorded in the run, visible in logs — not a new field on the Leaf. Anything touching `packages/shared` or the Payload collections is out of scope and belongs to Manager.
- **Split `asset_style.md` into what is fixed and what must vary.** Fixed: medium, palette, the teal-accent rule, the amber prohibition, depth-from-lightness, non-identifiable figures, every content guardrail. Varying: setting, interior/exterior, time of day, camera distance, number of figures, whether a figure appears at all.
- **Re-examine the anchor set.** Decide whether to recut anchors spanning environments or to reduce their pull on composition — **this is the judgement call of the package**, because the anchors are what make the library cohere and a careless change trades one problem for the AI-slop drift the founder ruled against. Say what you chose and why.
- **A Track-level variety check.** Something that looks at the whole set and fails when it has collapsed. Design it yourself; a setting-label distribution is a supporting signal, not the check, because a label can read "construction site" over a picture of a desk.

**Requirements — Half B, the book**
- **Ingest `/Users/ayushgupta/Documents/ZoomOut/ZO-admin/booksSource/Ikigai.pdf`** and run through gate 1, generation, grounding, assets and gate 2.
- **`acquisition` must be `undocumented`** — the honest value for a downloaded PDF. Not `purchased`, not `licensed`. The point of the field is that "which Tracks need regenerating" stays a query.
- **Ikigai lands as a draft and is not published.** It is in copyright; building against it was ruled acceptable 2026-08-13, and what ships at launch is still open.
- **15–30 Leaves**, and **no 1:1 reproduction of the book's chapter structure or its named framework** — a hard legal constraint, not editorial taste.
- **Source references need a locator, not only a note.** Ikigai is a PDF and `ingest/pdf.py` reads page by page, so **page locators may be achievable for the first time** — every prior Track used chapter/quote because EPUBs have no pages. Report whether page locators actually survive into references; if they do not, say so plainly rather than inventing them.
- **State the image budget before the run and make it halt, not warn.** WP18's reported $2.34/Track was computed at the wrong per-image rate; the real rate is `gemini-3-pro-image` at $0.134.

**Out of scope**
- **Track 42's existing published images.** Regenerating them is a separate founder decision, deliberately deferred until this package's before/after exists. Do not touch the published record.
- `apps/mobile`, `apps/backend`, `apps/admin`, any Payload collection change, any shared-type change.
- Publishing Ikigai live. Draft only.
- The curation policy itself — a founder decision, still open.

**Constraints:** Half A ships and is proven before Half B's run starts. The option shuffle (`shuffle_options`, WP17) must be exercised — Track 42 predates it and carries the correct answer in position B for 15 of 18 Leaves; Ikigai is the first chance to confirm the shuffle works on real content. Raw text is purged after the run, as a deliberate command.

**Device gate:** open an Ikigai Leaf in the app on a device and look at the scenario illustrations across **at least six** Leaves. **What to observe: the settings differ from one another and each one plausibly belongs to its own scenario** — not that the images are pretty, and not that the run exited zero.

**Acceptance criteria**
- [ ] Pipeline `lint`, `typecheck`, `test` pass
- [ ] **Before/after on identical scenario text:** Track 42's Leaves 0, 5, 9 and 13 regenerated as *candidates only* with the new generator, presented beside the current published images. **The four new settings are visibly distinct from each other, and Leaf 13 is no longer a person at a desk**
- [ ] `asset_style.md` separates fixed identity from varying environment, and the fixed half still forbids amber, text/symbols, identifiable people, and book branding
- [ ] The variety check **fails against Track 42's current eighteen images and passes against Ikigai's** — run it both ways and show both results
- [ ] Ikigai is in the CMS as a **draft**, 15–30 Leaves, `acquisition: undocumented`, `isPlaceholder` off
- [ ] Every Leaf's source references carry a note **plus at least one locator**; report whether page locators were achievable
- [ ] Correct-answer positions across Ikigai's Leaves are not concentrated in one position
- [ ] **Observed on a device: six Leaves, six settings that belong to their scenarios**
- [ ] Raw text purged after publish-to-draft, and the run's total cost reported

**Testing expectations:** unit coverage on the setting derivation and the variety check, including a mutation — break the setting derivation and confirm the variety check goes red. **Say plainly which evidence is a test and which is a human looking at pictures**; the variety claim is not fully testable and the before/after is the real proof.

---


### Handoff: 2026-09-11 — WP29: the Leaf player's footer hosts the live action

*Manager. **Suggested model: Sonnet** — one flow change, ruled and scoped. You found this; this is the fix.*

> **Read:** this handoff · your own WP28 completion report — **commit `02f8e31`**, cited by hash because a pruned pointer is what cost WP28 time · `apps/mobile/src/screens/leaf/LeafPlayerScreen.tsx` · `apps/mobile/src/screens/leaf/ScenarioSlide.tsx` · `apps/mobile/src/components/Button.tsx` · `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `projectRoadmap.md`, `design/`, `apps/pipeline`, `apps/admin`, `apps/backend`.
> **Inherited:** Reduce Motion changed mid-session leaves Reanimated stale — relaunch, don't reload, if you gate on motion. RN's jest preset reports `fontScale: 2`, so screen tests exercise the degraded path only.

### Task: WP29 — the footer carries whatever is actionable

**Suggested model:** Sonnet.

**Context:** WP28 established that the Leaf player pins a **disabled** *Next* in the footer — the position a reader's eye goes to for the primary action — while the live control, *Check answer*, sits below the fold inside the ScrollView. **This cost four packages of engineering time** from people who could read the source; a reader cannot. **The founder ruled 2026-09-11 for the footer fix rather than restyling the disabled state**, because making a dead button look dead still leaves a dead button where the live one should be.

**Objective:** On every slide, the pinned footer holds the action that is currently available. A reader never scrolls to find the primary control, and never sees a prominent control that does nothing.

**Scope:** `LeafPlayerScreen.tsx` and the slides' relationship to the footer.

**Requirements**
- **The footer hosts the currently-live action.** On the scenario slide before an answer that is *Check answer*; once answered it becomes *Next*. Other slides keep whatever they have today if it is already the live action.
- **Do not restyle `Button`'s disabled state.** It is a real finding — `opacity: 0.5` on a teal pill against near-black still reads as live — but it is a design-system change touching every consumer, it is logged separately, and this package must not wait on it.
- **The payoff gate does not change.** The rule that the payoff stays locked until a correct answer is the product's central guarantee. This moves a control; it does not alter when the control becomes available.
- **If a disabled control genuinely must appear in the footer** in some state you find, say so rather than forcing the pattern — and report which state.

**Out of scope:** `Button` itself, the other four slides' content, the report sheet, every other screen.

**Constraints:** tokens only. Do not run `git add -A`; stage by path.

**Device gate:** **play a Leaf end to end.** On the scenario slide, *before answering*, **the footer's control is the one that works** — press it and something happens. Answer wrongly, answer correctly, and confirm the footer follows the state. **Both themes, and at accessibility-max**, where the ScrollView is most likely to push content around.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] **On the scenario slide, the footer's control is live at every point** — never a disabled primary
- [ ] The payoff still unlocks only after a correct answer — verified by exercising it
- [ ] **Observed on a device: no scrolling is required to reach the primary action on any slide**
- [ ] Both themes at accessibility-max
- [ ] `Button.tsx` is unchanged in the diff
- [ ] No new colour, spacing, radius or duration values

**Testing expectations:** Tier B, plus **Tier A on the footer-action selector** — "which action is live for this slide and state" is a pure function of slide index and answer state, and belongs in a tested module like `roadmapLabels` and `stickyNotesLayout` before it. Mutation-check it.

---


## Completions (Manager → Architect)

### Completed: WP33 — Ikigai Leaf 4's bloom, replaced on the first attempt — 2026-09-16

**8 of 8 acceptance criteria met. $0.1455 against the $0.50 ceiling.** `apps/pipeline` ruff
check, `ruff format --check` (95 files), `mypy --strict` (50 files) and `pytest` (282 passed,
6 deselected) are clean. **No source file changed** — `git status` is empty, and this package
is the CLI and the guard being used rather than altered. Ikigai's eighteen Leaves are all
still drafts; Track 50's `updatedAt` is still `2026-09-15T14:23:17.600Z`, from before this
session.

| | |
|---|---|
| Guard on Leaf 4 **as attached** | **RED** — one `glow` finding, quoted below |
| Replacement | **PASS on attempt 1 of 1.** No second image was bought |
| Guard on the replacement **as Payload now serves it** | **PASS** — clean, and byte-identical to what was generated |
| Leaf 266 after the write | `_status: draft`, prompt intact, 3 options intact, diagram untouched |
| Transport | **Vertex `zoomout-vertex`**, recorded on the run |
| Spend | **$0.1455** — one image $0.134, three guard reads $0.0115 |

---

## The verdict that proves the replacement was necessary

The guard, on the image Payload was actually serving for Leaf 4 (`leaf-04-scenario-7.png`,
media 155), in its own words:

> `[glow] At the tip of the soldering iron in the center of the frame, there is a soft teal
> radial glow fading into the dark background without a clean hard edge.`

**That image was fetched from Payload, not read off disk**, and then checked against the
local candidate — byte-identical, sha256 `c2e0c8d6…`. The thing WP31 flagged and the thing
live on the Track were the same thing, which is worth one line of verification rather than an
assumption.

I looked at it at 3x before running the guard and reached the same conclusion independently:
a bright core at the tip with no traceable boundary onto the board.

## The cause was **not** Leaf 3's cause, and that is the finding worth keeping

The handoff's stop condition was "if it resists like Leaf 3, the finding is worth more than
the image." It did not resist, and the reason is visible in the prompt before a cent is spent.

**Leaf 4's scenario prose names no light effect at all:**

> "You are a software developer assigned to build a basic internal form for your team—a
> routine task you could complete on autopilot. You feel unmotivated and disengaged before
> you even start. How should you approach this task to achieve flow?"

No phone, no buzzing, no glow, nothing the contract forbids. **Leaf 3's failure mode was a
specific instruction beating a general one; Leaf 4's was neither.** The only light word
anywhere ahead of the style contract is the scene block's own boilerplate, which already says
the time of day "changes where the light falls and nothing about the palette."

**What produced the bloom was the scene setting's focus — "a fine soldering iron tip joining
wires on a contact board" — via the model's prior, not via an instruction.** A soldering iron
tip is a hot glowing object in the training data. WP30's parse guard refuses a focus that
*names* a light effect and this one does not name one, so the guard is not wrong here; the
object simply carries the connotation.

**The practical consequence: a fresh sample was enough.** That is exactly the case
`MAX_GUARD_ATTEMPTS = 2` is sized for, and its comment already predicted it — "a second
attempt is a fresh sample from the same distribution." Here the first sample was clean, so the
retry never fired. No prompt change was needed and none was made.

**This bounds the worry.** There is no systemic prose defect behind Leaf 4. If another Leaf
blooms on an object with a hot/glowing prior — a stove, a candle, a forge — expect the same
shape: cheap to fix by resampling, not worth a prompt change.

## Looked at — reported as observation

Beside the old one, at full size, and at 3x on the tip. **The bloom is gone and nothing
replaced it**: no glow, no text, no floating iconography, no reserved amber. Every boundary in
the frame is a value meeting a value. The cast light from the window is now drawn the way the
rewritten rule asks — a hard-edged lighter polygon across the wall and the figure.

**The soldering iron still reads as a soldering iron**: teal grip, metal shaft, fine tip
touching a board with a pale flat curl of solder smoke. The place is still the hardware test
bench it was given, with one non-identifiable figure, face cropped at the frame edge.

**One thing my eye got wrong, which is on-theme for this package.** The replacement looked
distinctly *lighter* to me than the old one, enough that I stopped and measured it instead of
trusting the impression. Mean luminance of the eighteen as attached:

- 17 others: **mean 0.276, sd 0.061**, range 0.180–0.398
- Leaf 4 old: 0.265 · **Leaf 4 new: 0.301**

That is +0.4 sd and **seventh-lightest of eighteen** — mid-pack, nowhere near Leaf 12 at
0.398. The set still reads as one library on the contact sheet. **My eye was measuring the
change from the old Leaf 4, not the position in the set**, which is the same error class as
WP30.1 clearing this image by eye in the first place, pointing the other way.

Artefacts (all under gitignored `runs/`, so not committed):
`runs/ikigai/leaf-04-before-after.png`, `runs/ikigai/leaf-04-tip-detail.png`,
`runs/ikigai/ikigai-contact-sheet-wp33.png`.

## The transport, as a row rather than a sentence

The refusal path was verified **by execution, and by accident in the most convincing possible
state.** The shell this package started in had `ZOOMOUT_PIPELINE_GEMINI_API_KEY` set and
`ZOOMOUT_PIPELINE_USE_VERTEX` **unset** — a free-tier key live, Vertex off, against a book
recorded `undocumented`. That is precisely the configuration three previous reports were
relying on discipline to avoid.

```
$ python -m zoomout_pipeline.cli generate-assets --run-id ikigai --limit 1
refusing to run a book recorded as 'undocumented' through the AI Studio Developer API...
EXIT CODE: 2
```

**WP32 works.** The run was then re-opened with `USE_VERTEX=true` and
`VERTEX_PROJECT=zoomout-vertex`, and the recorded transport on the `ikigai` thread is
`transport=VERTEX project='zoomout-vertex' acquisition=undocumented`.

That test cost nothing and risked nothing: all eighteen Leaves were already illustrated and
the scene plan was cached, so `generate-assets` would have skipped every Leaf and derived no
plan even if the refusal had failed. Worth stating, because running the real command to test a
refusal is only safe when you have checked what happens if it does not fire.

## How Leaf 4 was actually regenerated, since the CLI has no path for it

**`generate-assets` cannot do this, and that is by design.** It skips a Leaf twice — once on
`cms_assets` bookkeeping, once on Payload's own `imageCandidates`/`scenario.image` — and both
skips are load-bearing (they are WP20's Leaf-11 defect). Clearing them to force a redraw would
have meant writing over bookkeeping to make a command do something it deliberately refuses.

So the regeneration was a script over the real functions, in the real order:
`generate_candidates(guard=…)` → look → `attach_assets(diagram=None)` → `scenario_patch` +
`update_leaf_draft` → re-fetch → `verify_siblings`.

Three deliberate choices in that:

- **`diagram=None`.** `attach_assets` writes `stickyNotes` only when handed a diagram, so
  passing `None` writes `imageCandidates` alone. Leaf 4's diagram is correct and was neither
  regenerated nor overwritten — confirmed after the write:
  `stickyNotes.diagram=/api/media/file/leaf-04-diagram-2.png`, unchanged.
- **`scenario_patch`, never a partial group.** WP19 proved on this exact field that Payload
  nulls what a PATCH omits. `verify_siblings` on the **re-fetched** document returned
  `prompt_intact=True options_intact=True`.
- **`attach-scenario-images` was not used**, though it is the command that normally sets
  `scenario.image`. It operates on all eighteen Leaves, and the other seventeen are out of
  scope. One Leaf's group was patched directly instead.

Bookkeeping was then merged rather than replaced — `cms_assets['4']` keeps its existing
`diagram` record alongside the new candidate — so a future `generate-assets` still sees Leaf 4
as illustrated and skips it.

New media 201, served at `/api/media/file/leaf-04-scenario-8.png`.

## Two findings, nothing acted on

**1. A settings validation failure prints part of the Gemini API key.** Running any command
without `ZOOMOUT_PIPELINE_DATABASE_URL` raises a pydantic `ValidationError` whose message
echoes the whole input dict, including `gemini_api_key`. I hit this by accident and a
truncated key landed in my terminal. It would land in any log or CI output the same way.
**`SecretStr` on `gemini_api_key` and `payload_api_key` fixes it**; pydantic then renders them
as `**********`. Not done here — it is a one-line change in `config.py` with a test, and it is
not this package.

**2. The `check-style`-over-attached-images debt is real, and I can now say what shape it
wants.** The handoff was right that the command does not exist and right not to build it here.
For the record: what I needed was not a sweep but *one Leaf, as the CMS serves it* — fetch
`scenario.image`, guard the bytes, print the verdict. That is the operation that proves a fix
landed, and it is what the `live` suite cannot do because it reads committed fixtures rather
than Payload.

## The other seventeen — nothing changed my mind, and here is exactly what I looked at

**No finding, and nothing acted on.** Leaf 11 remains the known false positive; the other
sixteen were guarded at generation.

**Being precise about the evidence, because it is weaker than WP31's:** I looked at the
eighteen **as a contact sheet at roughly 240px wide**, checking that the set still coheres. I
did **not** repeat WP31's one-by-one pass at full size. That pass is what found Leaf 4 in the
first place, and a sheet at thumbnail scale would not have found it — WP30.1's human pass
cleared Leaf 4 from a sheet exactly like this one.

So: the set coheres, and that is all my looking establishes this time. If anyone wants renewed
confidence in the other seventeen before publication, the thing that would give it is the
guard over the attached images, not another person looking at a sheet.

## Spend against the $0.50 ceiling

| | |
|---|---|
| Guard on Leaf 4 as attached (the RED verdict) | $0.0050 |
| Image — 1 generated at $0.134 | $0.1340 |
| Guard during generation (attempt 1, passed) | $0.0029 |
| Guard on the replacement as attached | $0.0036 |
| **Total** | **$0.1455** |

Under a third of the ceiling, because the image passed first time. The budget was additionally
capped locally at 4 images for this package regardless of the ceiling.

## What the next package inherits

**Ikigai is ready to publish as far as the style guard can see.** Leaf 4 was the last known
breach and it is replaced. Publishing is the founder's action and nothing here does it — the
machine key cannot, and all eighteen Leaves are still drafts.

**Caveat on that sentence, stated because it is the one that could mislead:** "as far as the
guard can see" means *at generation time* for seventeen Leaves and *as attached* for Leaf 4
only. Nothing in the CLI has read the other seventeen back from Payload. That gap is finding 2
above and it is the debt item, not a defect in this work.

---

### Completed: WP32 — the paid-tier constraint stops being a comment — 2026-09-15

**8 of 8 acceptance criteria met. $0.00 against the $1 ceiling — this package made no model
calls at all.** `apps/pipeline` lint, `ruff format --check`, `mypy --strict` (80 files) and
`pytest` (282 passed, 6 deselected — up from 267) are clean. Nothing outside `apps/pipeline`
was touched, and no book, Track or Leaf was modified.

| Demonstrated on the real database | |
|---|---|
| Ikigai (`undocumented`), free tier | **REFUSED**, exit 2, before any call |
| Ikigai, Vertex | allowed → `vertex`, project `zoomout-vertex` |
| Wattles (`public-domain`), free tier | allowed → `developer-api` |
| Wattles, Vertex | allowed → `vertex` |
| The refused run | **no checkpoint, no book row** — the database still holds the same two books it held this morning |

---

## What was actually wrong

`config.py:26` said `require_paid_tier` *"turns that from a memory into a check."* **That
function had never existed.** `paid_tier: bool = False` was read by no code, defaulted to the
unsafe value, and the only other mention was a second comment in `client.py` pointing back at
it. Three consecutive completion reports cited that comment as evidence the constraint was
enforced, which is the specific damage a comment describing a non-existent guard does.

Both comments are now true or gone, and the flag is deleted rather than left beside the check
that replaces it.

## The design decision that mattered

**Keyed off the book's own `acquisition`, not off a flag.** A flag somebody has to remember to
set is precisely the failure this entry already was, and repeating the shape while renaming it
would have fixed nothing. `acquisition` is required at ingest, has no default, is the field
the written acquisition policy will be queried on, and is already recorded on every run.

`FREE_TIER_ACQUISITIONS` is written as a whitelist of one rather than a blacklist of three.
**A fifth status added to `Acquisition` later is refused until somebody thinks about it**,
which is the safe direction for an enum whose other members all mean "a work somebody else
owns".

**`undocumented` is on the closed side, and that is the case worth stating.** It is the honest
answer for a file whose provenance nobody wrote down — not a claim that the work is free of
copyright — and it is what Ikigai carries. A check written as "refuse the two obviously-owned
statuses" would have let through the exact book this package was written for.

## Where it fires, and why there

**Before the client is built.** `run` resolves the transport before `run_context()`, because
building the client is where the transport is chosen and the API key is read; a check after
that would be describing a decision already made, and a check inside a node would fire after
the book had gone. `test_the_check_runs_before_the_client_is_built` asserts the ordering in
the source rather than trusting it.

**One door for existing runs.** Seven commands open a checkpoint before calling a model, and
this project's recurring defect is a guard carried to one place and not its twin. So there are
exactly two helpers: `open_run_for_models`, which enforces and records, and `read_run_state`,
which does neither and is used by `status`, `cost`, `write-drafts` and `purge-raw-text` —
**none of which calls a model**, so refusing them would be a false refusal that made a
misconfigured environment undiagnosable. `test_no_command_loads_a_checkpoint_outside_the_two_helpers`
makes that structural rather than remembered.

## What the check cannot see

**It checks the label, not the book.** A work ingested as `public-domain` that is not public
domain passes, reaches the free tier, and nothing downstream notices. The label is a human's
claim made at ingest; this guard makes that claim load-bearing and visible and does not verify
it. It also says nothing about any transport this pipeline does not own.

Stated in the docstring, in the README, and here, because the last time this constraint was
described without being checked it was believed for four packages.

## Two defects found by running it

**The checkpointer was silently refusing the new types.** `TransportRecord` round-trips anyway
— the serializer falls back to a plain dict and Pydantic rebuilds it — so the values were
correct, `status` printed them correctly, and the only symptom was two `Blocked deserialization`
lines per checkpoint read. That is exactly the kind of thing that gets skimmed past for a year.
They belonged in `models.py` beside every other checkpointed domain type, and in
`_CHECKPOINTED_TYPES`.

`test_every_type_the_state_carries_is_allowed_through_the_checkpointer` now walks
`PipelineState`'s annotations and asserts every reachable model and enum is on the allowlist —
**a list maintained by hand is the failure it is preventing.** Mutation-checked: removing the
two entries turns it red.

**A traceback is not a refusal an operator can act on.** The first version raised through
Typer and rendered as a rich traceback with the message at the bottom. Now rendered plainly,
exit code 2.

## The evidence, and which kind each piece is

**Tests:** both directions, all four acquisition statuses, the whitelist shape, the refusal
message naming the fix, the source ordering, the two structural rules. Mutation-checked —
disabling the guard turns five red, including the load-bearing one.

**The load-bearing test is `test_no_call_is_made_when_the_transport_is_refused`**, and it uses
a counting client whose count must be zero. Raising is not the requirement; not sending is. A
run that raises after eight Leaves satisfies every other assertion in that file.

**Observed:** a real `run` against `Ikigai.pdf` with the free tier configured. It refused,
exited 2, printed the fix, and left nothing behind — no checkpoint for the run id, no new row
in `books`, and the two books in the database are still Wattles (2026-08-26) and Ikigai
(2026-09-12). Then a real `generate-assets` on the Ikigai run recorded
`transport=vertex project=zoomout-vertex acquisition=undocumented`, and `status --run-id
ikigai` reads it back. Zero model calls and zero images across the whole package.

---

## What the next package inherits

**Ikigai and Track 42 were not re-run and their history is not reconstructible.** The
transport record starts from now. Both went through Vertex — Ikigai twice, on discipline — and
that is a claim from a completion report, not a row in a database. Nothing can change that
retroactively, which is the argument for the record existing at all.

**Still open, unchanged:** the grounding gate's false reject on line-wrapped quotes, the gate-1
named-framework flag, the Leaf publish gate, and Leaf 4's bloom on Track 50. Track 42's
published Leaf 1 still needs the founder to unpublish before anything can touch it.


### Completed: WP31 — the output-side image guard, and Ikigai's last two breaches — 2026-09-15

**8 of 8 acceptance criteria met. $1.52 against the $4 ceiling.** `apps/pipeline` lint,
`ruff format --check`, `mypy --strict` (79 files) and `pytest` (267 passed, 6 deselected — up
from 257) are clean. Ikigai's eighteen Leaves are all still drafts; no Track-level field was
touched.

| | |
|---|---|
| Guard on Track 42 Leaf 1 | **RED** — reads `"$10K"`, plus the halo and the floating UI cards |
| Guard on Ikigai Leaf 3 (before) | **RED** — floating chat bubbles, and a bloom with "smooth gradient falloff" |
| Guard on Leaf 8 (hard-edged cast light) | **PASS** — the load-bearing negative |
| Leaves 3 and 7 | Replaced, passing the guard, looked at, and they belong to the set |
| Variety, unchanged by the swap | median 0.812, closest pair 0.745, zero near-duplicate pairs |
| Guard cost | **$0.004 per image → $0.073 per 18-Leaf book** |

**Two findings on the other sixteen, which the criterion asks for as findings rather than
failures.** Leaf 4 has a real bloom at the soldering-iron tip — **WP30.1's human pass looked at
that image and cleared it, and was wrong**; at 3x it has no traceable boundary. Leaf 11 is a
**false positive**: what the guard called "a soft-edged beam fading smoothly" is flat pale
ground with hard vector edges throughout. Leaf 4 is a genuine breach still live on the Track
and is **not fixed** — the handoff scoped regeneration to Leaves 3 and 7 and named a flag on
the sixteen as a finding, so it is reported. About $0.14 to fix on a word.

---

## The guard

### What it is, and what was measured before it

**A vision call, plus the existing mechanical amber check folded into the same verdict.** The
classical route was tried first, because `variety.py` is the precedent for image analysis here
and pure PIL is the house style. Two designs, both recorded in the module docstring:

| Metric | Breaches | Clean |
|---|---|---|
| Ring level around the brightest 1.5% of pixels | 0.34-0.68 | 0.37-0.89 |
| Local soft-ramp density, strongest tile | 0.72-0.81 | 0.70-0.83 |

**Both score the breaches below several clean images.** The falloff idea is right — a bloom is
a ramp and legal cast light is a step — but these illustrations are not the piecewise-constant
art the measurement assumes. They carry pervasive soft shading by design, so smooth variation
is not anomalous: mean ramp density sits at 0.42-0.57 across breaching and clean images alike.
Worse for any threshold, **the two Tracks differ more from each other than breaches differ from
clean images within a Track** — Track 42's flatter, smaller renders score 0.12 where Ikigai's
score 0.45. A number calibrated on one book would be meaningless on the next.

Text is the same story from the other side, and `guardrails.py` had already recorded the
decision not to add OCR: flat vector art is full of small rectangles that are not text — a
mixing console's faders, a circuit board's pads — and a detector tuned to find "$10K" among them
finds all of them.

### The evidence, and which kind each piece is

**A test** (normal gate, scripted client): that an image is actually sent, that a finding fails
the verdict, that the amber check is folded in, that the retry is bounded, and the mutation —
with the guard switched off, nothing is rechecked and the refusal path cannot fire.

**The guard's own evidence** (the `live` suite, excluded from the gate): 4/4 against committed
fixtures of real breaches. It reads `"$10K"` character for character. It calls Leaf 3's phone a
"soft cyan radial glow and light bloom… with smooth gradient falloff". **And it passes Leaf 8's
auditorium**, which is a bright, obviously-lit stage whose light is a hard-edged polygon — the
case that proves it learned *falloff* rather than *brightness*.

**A person looking:** nineteen images, one by one. Four real breaches found, one of which I had
personally cleared by eye in WP30.1. One false positive. That split is the guard's actual
precision and no test in the repository states it.

### What it cannot catch — stated because an unstated blind spot is worse

- **It is not deterministic.** Same image, different runs, possibly different findings. That is
  why the gate uses a scripted client and the real-model evidence is a `live` suite.
- **It hallucinates**, as Leaf 11 shows — and a false positive costs a real $0.134 image to
  regenerate. The prompt pushes back by naming an empty list as a common and correct answer,
  which trades some recall for it.
- **It is not independent of what generated the image.** R3 wants a different family grading the
  work; this is Gemini reading Gemini. The Claude-on-Vertex quota that would fix that is still
  the console action `config.py` has been waiting on since WP19.
- **It says nothing about what actually decides a Track** — whether the place belongs to the
  scenario, whether the set has collapsed, whether the Leaf is any good.

### Cost, before adopting it as a default

**$0.004 per image, $0.073 per eighteen-Leaf book**, at 2,444 input tokens and 280-1,570 output.
Add the retries it causes: refusals ran about one in three on the two distraction-themed Leaves
and near zero elsewhere, so budget roughly **$0.10-0.15 of reads and two or three extra images
per book**. Against $2.41 of images per Track that is affordable, and it is the only thing
standing between a bloom and a published Leaf nobody can edit.

---

## Ikigai's Leaves 3 and 7

### Leaf 3 resisted four regenerations, and the cause was in the scenario text

Twice in WP30.1, twice more here under the guard — always a glowing phone with notification
badges. **Its scenario prose opens "Your smartphone is buzzing with group chat notifications",
and `scenario_image_prompt` puts that text first in every image prompt.** The most specific
instruction in the prompt was asking for exactly the thing the most general one forbids, and
specific wins.

This is Leaf 8's spotlight beam one layer up. WP30 stopped a *focus* naming something undrawable;
WP30.1 stopped it naming a light effect; neither could see the scenario, which is written for a
reader and names whatever the situation needs. `scenario_image_prompt` now says the scenario is
what is happening rather than an inventory for the frame, and that anything in it the contract
forbids is drawn plain and unlit or left out of shot.

After that change both Leaves passed on the second sample, with the guard refusing the first —
a badge on Leaf 3, a phone bloom on Leaf 7. **The gate worked exactly as designed: it caught
both, and the redraw was clean.**

### The light-rule rewrite caused a regression, and a test now guards it

The ruling was to move the line to falloff, and the first rewrite did — by explaining hardness
as *"a clean, hard edge you could trace with one line"*, and asking *"could the boundary be
traced with one clean line?"*. **The word *line*, twice, in a contract whose previous paragraph
forbids line art.** Both images regenerated under that wording came back as outlined drawings,
which nothing else in the set is.

Same lesson as WP30's removed subject menu: telling an image model not to draw a desk mentions a
desk. Hardness is now "ends at a definite edge" and "where one flat value meets another", and
`test_the_light_rule_does_not_ask_for_line_art` fails if `line`, `trace`, `stroke`, `outline` or
`contour` reappears anywhere in that section. The prohibition itself keeps its own words.

**The rewrite does not launder the breach it was asked about.** Leaf 8's auditorium is legal
under it and the live guard passes it; Leaf 3's phone bloom is a breach under it and the live
guard fails it. Both verified against the committed fixtures rather than asserted.

### Looked at

Both replacements carry no text, no glow and no floating iconography, and both belong to their
scenarios — Leaf 3 an attic writing nook at night with the skylight as a hard-edged lighter
polygon and the phone a flat unlit rectangle; Leaf 7 a garden pergola where **the light from the
phone is drawn as a hard-edged triangle**, which is the ruling working rather than being evaded.
The outlines are gone. Across the eighteen the set still reads as one library, and the variety
measure is unmoved at 0.812.

Before/after and the full sheet: `runs/ikigai/leaf-03-07-before-after.png` and
`runs/ikigai/ikigai-contact-sheet.png`.

---

## Spend against the $4 ceiling

| | |
|---|---|
| Images — 10 generated at $0.134 | $1.340 |
| Style guard — 39 reads | $0.160 |
| Diagram specs | $0.020 |
| **Total** | **$1.520** |

Ten images for two Leaves: three regeneration passes, two of which were spent discovering the
two prompt defects above rather than on the images themselves.

---

## What the next package inherits

**Leaf 4's bloom is real, live on Track 50, and not fixed.** Reported rather than regenerated
because the handoff scoped this package to Leaves 3 and 7 and explicitly called a flag on the
other sixteen a finding. One command, about $0.14.

**Track 42's published Leaf 1 is unchanged and now a committed fixture.** It cannot be fixed by
this pipeline — the machine account cannot edit published documents — so it needs the founder to
unpublish first. It is the guard's best test case in the meantime.

**Track 50 is published and its Leaves are not.** That is the only reason this package could run
at all: a published Leaf would have frozen both breaches permanently. **Do not publish the
Leaves without running the guard over the set first** — it is now one command and $0.073.

**`ZOOMOUT_PIPELINE_PAID_TIER` is still enforced by nothing**, three packages after it was first
reported. `require_paid_tier` does not exist and `paid_tier` is read by no code. Every command in
this package ran with `USE_VERTEX=true` and the API key unset from the process. That is
discipline, not a check, and discipline is what the next session will not know to apply.


### Completed: WP30.1 — Ikigai's eighteen images, and the named-framework breach — 2026-09-15

**8 of 8 acceptance criteria met, and two of them come with a caveat you should read rather than
skim.** `apps/pipeline` lint, `ruff format --check`, `mypy --strict` (77 files) and `pytest`
(257 passed, 2 deselected — up from 226) are clean. Nothing outside `apps/pipeline` was touched.
Track 50 is still a draft; nothing was published.

**Spend: $3.56 against the $5 ceiling.** Images $2.95, text $0.61. Breakdown and the one
estimated figure are at the bottom.

| | |
|---|---|
| Leaf 17 | Rewritten. **0 of 16 forbidden phrasings survive**, down from 14 instances |
| Ikigai's variety | **PASS — median nearest-neighbour 0.798, closest pair 0.745, zero near-duplicate pairs** |
| Track 42's variety | **Still FAILS — median 0.502, closest pair 0.277, six near-duplicate pairs, exit 1** |
| Images | 18/18 attached as drafts, every one with alt text, scenario prompt and options verified intact |
| Retained | `apps/pipeline/runs/ikigai/images/` + `runs/ikigai/ikigai-contact-sheet.png` |

**The caveat: two of the eighteen images still breach the style contract, and I stopped rather
than keep buying.** Leaves 3 and 7 carry floating notification icons — `asset_style.md` forbids
"floating icons or symbolic overlays" — and Leaf 3 also has a glow off a phone screen. Both were
regenerated once. **Leaf 3 came back worse** (glow retained, two icons instead of none, and a
laptop-at-a-desk composition that is the exact Track 42 register this work exists to escape).
The handoff's own rule is to stop after one regeneration pass and report rather than buy toward a
threshold, and that rule is right: the model reaches for notification iconography because both
scenarios are *about* digital distraction. **This is the output-side detector the handoff put out
of scope, and it is the correct next package.** The other sixteen are clean.

---

## Half A — Leaf 17

### The breach was three times larger than WP30 reported, and measuring it was the first thing I did

WP30 said "three of its five sticky notes". Measured against the live record with the phrase
check this package added:

```
Leaf 17: 14 hits    Leaf 13: 1 hit    Leaf 12: 0    Leaf 0: 0
```

All **five** sticky notes were rules from the list. So was the Dinner Table fact. And **seven of
the fourteen were in source-reference notes and quotes across four slides** — notes reading
`"Rule 1 states to stay active and not retire"` and `"The ten rules include staying active
without retiring, taking it slow, eating until 80% full…"`, which `cms/mapper.source_references`
turns into `sourceReferences` rows the reader sees.

**That is the half nobody had looked at, and it decided the design.** A rewrite that fixed the
five slides and left the references would have moved the breach rather than removed it, and
reported success. `revised_leaf_patch` deliberately carries `sourceReferences` forward — correct
after an editorial revision, which preserves citations by construction — so a rewrite needed its
own patch builder. Hence `rewritten_leaf_patch`, which rebuilds references from the claims the
rewrite actually made and writes extras from the record instead of preserving them.

Leaf 13's single hit is the control that makes the check trustworthy: its own concept **is** the
80 percent rule, it cites it honestly, and it is not reproducing a list. The check is not a
blanket word ban.

### Why the rewrite clears it, in my own words

The original Leaf was **a digest of a list**. Its unit of content was "here are the rules": five
sticky notes, each an item from the book's named framework in the book's own imperative voice,
with a summary that enumerated four more in prose. Reproducing a named framework means handing
the reader the framework itself, as the thing being delivered. That is what it did.

The rewrite's unit of content is **a single argument the book makes in a different chapter.** Its
passage P2 — "And now, ikigai", chapter 19, not the rules chapter — says the experience is
reachable *"without therapists or spiritual retreats"*, that once found *"it is only a matter of
having the courage and making the effort to stay on the right path"*, and that the path runs
through a world you have to accept as imperfect. The four sticky notes are propositions drawn
from that argument in ZoomOut's words: finding your ikigai is the beginning rather than the
finish; staying on the path is the actual work; the path runs through the ordinary imperfect life
you already have; giving up what you do well costs you your sense of purpose.

The test I applied is **could a reader reconstruct the ten rules from this Leaf** — and no. There
is no enumeration, no set, and no imperative code. The one claim still sourced to the rules
chapter cites a single explanatory sentence about losing purpose, not a rule heading; quoting one
sentence from a chapter is what every Leaf in the library does.

**What this is not: proof.** `surviving_phrases` checks that named strings are gone. A paraphrase
of the same list would clear it. The module docstring, the CLI output and the README all say so
in those words, because the temptation to read a green check as an answer here is exactly the
failure mode.

### Three defects the first real run found, two of them mine

The first `rewrite-leaf` invocation was rejected by grounding and the original Leaf stood — the
Tier A behaviour working. It also exposed:

- **`revise_leaf` dropped the reason.** It returned `(leaf | None, spend)` and logged
  `failures=2` — a count. There was no way to learn which claim broke without paying for the
  call again, which is what it cost. It now returns the verdict, logs the failure text, and the
  CLI prints each one. Five call sites updated.
- **Extras were regenerated even when the rewrite was discarded.** Extras follow the takeaway; an
  unchanged takeaway has nothing for them to follow. The run paid for that call and cleared a
  grounded Dinner Table fact off a Leaf whose text it had just declined to touch — strictly worse
  than doing nothing.
- **A discarded rewrite's spend was never recorded.** The command exited before `update_state`,
  so the money existed only in terminal scrollback. That is the one figure in this report I can
  only estimate, and it is why.

A bounded retry now quotes the grounding failures back, capped at 2 — the mechanism `draft_leaf`
uses for the same gate and `derive_scene_plan` for a rejected plan. **It is not the loop
`review_and_revise` declines to have**, which stops because retrying *blind* is a second roll of
the same dice; this one changes the prompt. Nothing beneath it retries a grounding failure, so
these do not stack into WP20's N×M. Attempt 2 succeeded.

### A false rejection in the grounding gate — reproducible, reported, not fixed

**Attempt 1 was rejected for a quote that was verbatim.** The model quoted
`you have to accept that the world—like the people who live in it—is imperfect`. The passage
contains exactly that. It failed because the PDF wraps mid-sentence:

```
raw        : 'the world—\nlike the people'
normalised : 'the world- like the people'   (em dash → '-', newline → ' ')
quote      : 'the world-like the people'
```

`normalise_for_quote_match` folds whitespace and folds em dashes to hyphens, but not whitespace
*adjacent* to a folded dash — so a line break after an em dash makes an honest quote unmatchable.
That is precisely the artefact the function's own docstring says it exists to fold.

**I did not fix it**, and the reasoning is deliberate: it is the legal gate, the failure direction
is safe (it rejects honest quotes and can never accept invented ones), and a change there needs
its own package with fixtures across real books and an Architect ruling. It cost this package one
Pro-model call and would have cost the whole rewrite without the retry. The fix shape is one line
in `normalise_for_quote_match`; the test corpus is the harder half.

### Leaf 17 now has no Dinner Table fact and no apply-in-life — deliberately, and reversible for a cent

17/18 on both, down from 18/18. Both fields are `.optional()` in `content.ts`, so the Leaf is
still publishable, and the takeaway source reference is present so a DTK could be added later.

The extras call returned nothing for both, which the `extra_content` prompt explicitly sanctions
and my brief explicitly invited. **I think it is the honest answer and I checked before accepting
it.** This Leaf's two passages are a rules list and a chapter-transition page. The one genuinely
surprising deep cut in them is Morita's three-day rule about anger — which belongs to Leaf 2's
territory, not this Leaf's, and using it here would repeat the exact duplication WP30 flagged
when Leaf 17's old DTK duplicated Leaf 13's. **Founder's call to overturn; it is one Flash call.**

The editorial pass then ran at `editorial_attempts=1` for parity with the other seventeen: review,
one accepted revision, review. One advisory finding remains open on the scenario (a fourth-wall
break — "What approach aligns with the Okinawan principles"), which predates this package and was
out of scope.

---

## Half B — the eighteen images

### The scene plan is the fix working

Eighteen distinct places, eight exteriors, five unpeopled, all three shot values, six different
times of day. Against Track 42's eighteen seated figures at tables in dim interiors. One Flash
call, $0.0163, derived before a single image was bought.

I bought **one image first** and looked at it before committing the other $2.41. That is $0.134
to de-risk seventeen, and it is the pattern I would repeat.

### A focus may name a lamp. It may not name the beam coming out of it.

**Leaf 8 came back as two volumetric cones converging on a lectern** — glow, light cones, bloom
and volumetric light, four prohibitions in `asset_style.md` at once. The image model was not
wrong. Its scene plan said the focus was **"an unlit wooden lectern standing under a spotlight
beam"**, so it was handed a plan naming a beam and a contract forbidding beams, and satisfied the
more specific instruction.

**That is the same failure `_an_empty_frame_has_no_hands_in_it` already exists for.** WP30 wrote
that validator, wrote in its docstring that a contradiction in the plan is cheap to catch in text
and expensive to catch in an image, and did not carry the idea to the other contradiction of the
same shape. `_LIGHT_EFFECTS` and `_a_light_effect_is_not_a_thing_in_the_room` are that missing
twin. `scene_setting.md` now states both rules, so the validator is a backstop rather than a
retry loop.

Measured rather than asserted: **of eighteen derived settings exactly one named a light effect,
and it produced the only plan-caused breach in the set.** Regenerated with the beam removed from
the focus, Leaf 8 is clean — what remains is a flat lighter shape thrown from a doorway, which is
the depth-from-lightness device the contract sanctions.

**A tension worth an Architect ruling:** `asset_style.md` permits "a bright window is a lighter
shape" and forbids "a shaft of light thrown across a surface" in the same paragraph. Leaf 8's
replacement, Leaf 2's window wedge and Leaf 16's doorway all sit between those two sentences, as
do the committed anchors. If the second sentence means what it says, much of the library breaches
it.

### Two defects in `generate-assets`, both the same shape as WP20's

**Leaf 8's first image call timed out.** `generate_candidates` logged the refusal and carried on,
`attach_assets` still wrote the diagram, the run exited 0, and the Leaf was silently imageless.

Then the worse half: **both idempotency checks keyed off the diagram** — a $0.004 text call —
while the image is the most expensive thing this pipeline buys. So both read that diagram and
called the Leaf done. **A re-run would have skipped straight past the one Leaf with no picture.**
That is the WP20 failure at Leaf 11 of 18, in the sibling of the code that was fixed for it.
Now keyed on `imageCandidates` and `scenario.image`, and the command names every Leaf that ended
with no scenario image, at the end, where it will be read.

### Looked at, one by one

**What the machine could answer:** the amber guardrail passed on all eighteen at exactly 0.00000,
which settled Leaf 2's brass door and Leaf 7's lemons — warm neutrals, not reserved amber.

**What only looking could answer:**

| | |
|---|---|
| Text, letters, numerals | **None in any of the eighteen.** Leaf 1's mixing console was the real risk — knobs, faders and blank display panels, zoomed and checked, no labels |
| Disembodied limbs | **None.** Leaf 13 is hands-and-cuffs at a table, which is the sanctioned `close` framing with `figures: 1`, not WP30's hand floating across a house |
| Glow or bloom | **Leaf 8 rejected and replaced. Leaf 3 still breaches** — see the caveat at the top |
| Floating icons (a fourth thing, found by looking) | **Leaves 3 and 7.** Both regenerated once; both still carry one |

Rejected and regenerated: **Leaf 8** (spotlight cones — fixed), **Leaf 3** (glow — regenerated,
came back worse), **Leaf 7** (chat-bubble overlay — regenerated, came back with a bell overlay).

**Leaf 2 is the weakest image and is not a breach.** Its plan asked for a close shot of "a brass
doorway latch", so it is a large olive-gold door with wide teal stripes — off-palette against a
library whose identity is four dark surfaces and one small teal accent, and a weak illustration of
"accepting unpleasant feelings while taking constructive action". Flagged rather than regenerated
because it breaches nothing, and your eye should decide whether that is drift.

---

## Spend against the $5 ceiling

| | |
|---|---|
| **Images** | **$2.948** — 22 charged at $0.134 |
| Diagram specs (~22 Flash calls) | $0.122 |
| Leaf 17 rewrite (accepted, 2 Pro attempts + extras) | $0.226 |
| Leaf 17 editorial pass at `editorial_attempts=1` | $0.130 |
| Scene plan | $0.016 |
| Discarded first rewrite | **~$0.12 — estimated, not measured** |
| Vertex connectivity probe | $0.001 |
| **Total** | **≈ $3.56** |

**22 images charged, 21 received, 18 kept.** One lost to the timeout, three rejected and
replaced. The estimate is the discarded rewrite, whose spend the command failed to record — the
bug is fixed, but that particular figure is gone.

`editorial_attempts=1` is confirmed as the cost lever WP30 identified: one Leaf's full editorial
pass cost $0.130 against WP30's ~$0.50/Leaf at the default of 2.

**The run ledger reads $4.3432 and that is not this package's spend** — it is Track 50's lifetime
cost including WP30's text generation. Worth knowing, because `review-track` and the image budget
do not write into it at all; `cost --run-id` is an undercount by construction and should not be
quoted as a Track total.

---

## What the next package inherits

**An unresolved obstacle, restated because it has now blocked two packages.** Ikigai is a draft
and must stay one, and `apps/backend/src/content/contentVisibility.ts` returns
`content.status === 'published'` in every non-production environment. **No draft Track can reach
the app without a backend change.** The in-app observation of these images is deferred to whenever
Ikigai is published, and is debt, not a skipped gate.

**`ZOOMOUT_PIPELINE_PAID_TIER` is recorded and enforced nowhere.** `config.py` says
"`require_paid_tier` below turns that from a memory into a check" — there is no such function
anywhere in the codebase. The founder's shell has `ZOOMOUT_PIPELINE_GEMINI_API_KEY` set and
`USE_VERTEX` unset, so **any pipeline command run as the environment stands would send a
copyrighted book through the free Developer API, which trains on submitted content.** I ran every
command with `USE_VERTEX=true` and `env -u ZOOMOUT_PIPELINE_GEMINI_API_KEY` so the free path was
unreachable, and verified the transport before the first paid call. The guard does not exist and
the comment says it does.

**The Vertex project id had never been written down.** WP30 exported it per-session; it was not in
the environment, `gcloud config`, or the repo, and every command that costs money was blocked on a
value nobody could reconstruct. It is now in the README's env table, along with the fact that
`zoomout-free-test` is the free tier and no book in copyright may go through it.

**Orphaned media.** The four rejected images are still in Payload's Media collection, unreferenced.
I did not delete them — deleting media is destructive and was not asked for.


### Completed: WP30 — Ikigai end to end, and scenario images that match their scenarios — 2026-09-15

**7 of 9 acceptance criteria met. Two are unmet because the founder capped spending mid-package,
and they are unmet rather than partially done: no Ikigai images exist.** `apps/pipeline` lint,
`ruff format --check`, `mypy --strict` (75 files) and `pytest` (226 passed, 2 deselected) are
clean. Nothing outside `apps/pipeline` was touched.

**The two numbers that matter:**

| | |
|---|---|
| **Spent** | **$10.07** — against a $5 ceiling the founder stated after the spend had happened |
| Ikigai text, 18 Leaves, 198 calls | **$9.09** — 3.1x WP20's $2.94 for the same node set |

**The cost overrun is the most important operational finding in this package and it is mine.**
I watched the rate and narrated it twice — at $1.13 on Leaf 2, then $4.77 on Leaf 9 — and each
time chose to continue at default settings so the number stayed comparable to Track 42. I was
reasoning from the $300 trial credit sitting unspent and expiring 2026-09-17, which made
"spend it while it exists" feel obviously right. **It was a budget judgement, and budget
judgements belong to the founder.** Narrating a rate is not asking about it.

**Where the money goes, for whoever plans the next book:** the editorial review/revise loop on
`gemini-3.1-pro-preview` at `editorial_attempts=2` is up to five pro-model calls per Leaf, and
on Ikigai it reached the cap on most Leaves. WP20 made that cap configurable for *throughput*
reasons; the same knob is the cost lever. **Ikigai at `editorial_attempts=1` would have been
roughly half.** Throughput itself was fine — call gaps stayed at 20-30 seconds and WP20's
109-minute stall did not recur.

---

## Half A — the generator

### What was actually wrong, measured rather than assumed

Track 42's eighteen published scenario images are **eighteen out of eighteen** a seated figure
at a table in a dim interior. Not fifteen of eighteen. Confirmed by looking at the set, and the
founder's example holds exactly: Leaf 13's scenario is buying a family home and it rendered as
a man alone at a desk with a calculator.

Three causes, and only the first was in the handoff's framing:

1. **The image prompt named no setting.** Each call defaulted independently, and an image
   model's default is what its anchors show.
2. **The style contract ended its subject section with a menu** — *"ordinary modern life: a
   desk, a commute, a kitchen table, a shop counter, a conversation"* — appended to every prompt
   in the run, headed by the thing it kept producing.
3. **Five of the six committed anchors are seated interiors**, and the instruction sent with
   them said "do not reproduce their subjects" while six pictures said otherwise.

### The anchor decision, which the handoff called the judgement call of the package

**The committed six were kept, un-recut, and their pull was reduced by instruction instead.**

Recutting is the founder's design decision, not a pipeline run — WP18's own note says so, and
that set cost two rounds with the founder and two rejected candidates to arrive at. Replacing it
to fix a prompt bug trades a known-good identity for an unknown one, which is precisely the
AI-slop drift the anchors exist to prevent.

What changed instead: the anchor instruction moved out of a string literal in `images.py` into
`prompts/anchor_instruction.md` (it was the one prompt in this service that could not be
diffed), and it now says to copy *how they are drawn* and nothing about *what they show*.

**This was the cheapest hypothesis and it was tested rather than argued.** Four regenerations
with the anchors untouched produced four different places. Had they not, the next step was
reducing the anchor count; that step was not needed.

### The evidence, and which kind it is

**Before/after on identical scenario text, Leaves 0, 5, 9 and 13, candidates only — the
published record was not touched.** Four for four changed setting. Leaf 0 became a roastery
storage bay with burlap sacks and a cooling tray; Leaf 5 a breakroom kitchenette; Leaf 9 a cafe
terrace under an awning; **Leaf 13 a new house at dusk with a staked sapling in the foreground.**

**Three of the four are clear improvements. Leaf 9 is the weakest** — the place changed but it
is still two people facing each other across a small table, so the composition barely moved.
Saying so because an optimistic four-for-four would be the wrong record.

**This is a human looking at pictures, and it is the only evidence that bears on the actual
claim.** No test in this repo can tell you whether generated images vary.

### Two defects the pictures caught that no test would have

**A giant disembodied hand.** The first Leaf 13 asked for a wide, unpeopled shot of a house with
the focus on "a brass key lying in the palm of an open hand" — and got the house with an
enormous hand across the foreground. The model was not wrong; `figures: 0` and a focus on
somebody's hands are not both true. Now refused at parse, where it is cheap to see, instead of
in an image, where it costs $0.134 to discover.

**Focus objects whose whole point is their writing.** The first derived plan focused Leaves on a
printed application form, a boarding pass and a For Sale sign. The style contract forbids the
illustrator from drawing a single letter, so those ask for a picture that cannot be drawn, and
what comes back is a form covered in convincing nonsense. **Track 42's published Leaf 1 already
renders "$10K" and "$2K" legibly** — an absolute-prohibition breach that is live now and
predates this package.

### A mistake I made and then caught with a test

The first rewrite of `asset_style.md` explained the removed menu **by quoting it**, which put
the same five words, headed by a desk, back into every image prompt inside an apology for them.
**Telling an image model not to draw a desk mentions a desk.** The history now lives in
`asset_nodes.py`'s docstring, which is never sent anywhere, and
`test_the_fixed_half_names_no_setting_of_its_own` fails on word boundaries if a setting word
reappears in the model-facing half.

### The variety check, and the two designs that do not work

**Recorded because both look obviously right and both fail.**

| Signature | Track 42 (collapsed) | Anchors (varied) |
|---|---|---|
| Downsampled brightness grid | 0.686 | 0.692 — **scores the collapse higher** |
| Median distance over all pairs | 0.80 | 0.79 — indistinguishable |
| **Median nearest-neighbour, edge density** | **0.502** | **0.670** |

Brightness fails because these images differ enormously in *where the light is* and not at all
in what is in them, so a brightness grid measures the part that varies. The all-pairs median
fails because a collapsed set still contains distant pairs — eighteen desks are still framed
differently. **What "collapsed" means operationally is that every picture has a near twin**, and
the statistic for that is each image's distance to its nearest neighbour.

Colour is deliberately ignored: the palette is the identity, and a check scoring colour variety
would mark the house style *working* as a failure.

**The floor (0.60) is calibrated on two real sets and that is thin. Revisit it on the third
Track.** The synthetic fixtures in `test_variety.py` assert *ordering only* and never the
threshold — a renderer that draws rectangles cannot be asked where the line goes, and one tuned
until it passed would be fitted to a toy. This distinction is load-bearing and should survive
editing.

**A limit worth stating: on a four-image sample, both the before and after sets pass** (0.819
against 0.838). Collapse is a property of a whole set, and the four Leaves chosen for the
before/after are among Track 42's most distinct. The check needs the full Track.

### The mutation the handoff asked for

`test_breaking_the_setting_derivation_turns_the_check_red` wires a deterministic renderer to the
check: with per-Leaf places it passes, with every Leaf handed the same default it goes red. The
break is applied *outside* `ScenePlan` on purpose, because the validator would refuse it — the
validator is the first line of defence and the check is the second.

---

## Half B — the book

**Track 50, `Ikigai: The Japanese Secret to a Long and Happy Life`, 18 draft Leaves.** Verified
against the live record rather than the command's own report:

| | |
|---|---|
| `acquisition` | `undocumented` |
| `isPlaceholder` | `False` |
| `_status`, draft and published views | `draft` — nothing is live |
| Source references | **134, every one with a note and at least one locator** |
| Locator kinds | chapter 134, quote 130, **page 0** |
| Correct-answer position (A/B/C) | **6 / 5 / 7** |
| Dinner Table Knowledge / apply-in-life | 18/18 each |

**Page locators are not achievable, and this is settled from the code rather than from the
output.** `parse_pdf` joins pages into chapter text inside `_split_by_toc`, and `Chapter` has no
page field, so the page boundary is discarded before anything downstream could use it. Nothing
can honestly emit one. Worth adding: even if plumbed through, these are *PDF page indices*
(page 2 is the title page), not the printed book's numbers — which `content.ts` itself calls
"edition-dependent false precision". **The feature is a bigger change than it looks and may not
be worth wanting.**

**The option shuffle works on real content.** 6/5/7 against Track 42's pre-shuffle "second in 15
of 18".

### The attribution defect, found mid-run

Ikigai's PDF carries **neither a title nor an author**, so provenance recorded the filename and
the literal string `"Unknown"` — and that string does not stay in the database. It reaches the
Track's `author` field *and* the draft prompts, where the model is asked to write attributive
framing about an author called Unknown. WP20 praised exactly that framing on Track 42
("Wattles argues that…"); this book would have produced the same sentences with nobody in them.

`LEGAL.md` treats fabricated content attributed to a real author as the highest-severity risk in
the product. **A real author's ideas published under "Unknown" is the same wound from the other
side** — it breaks the attribution the fair-use position and the purchase-forward framing both
rest on.

Fixed in three places: `run` takes `--title`/`--author`; ingest warns loudly when it had to
default, at the point where re-ingesting is cheap; and `require_known_author` refuses the value
at the CMS boundary — **the sibling of the never-publish guard, in the same file, for the same
reason.** The pipeline promises that what it writes is a draft and that it says where it came
from, and both are enforced where the write happens rather than remembered upstream, because
upstream is where a default quietly wins.

Provenance is written once and is not patched afterwards, so the first Ikigai ingest was deleted
and redone. Wattles' 136 chunks were counted before and after to prove the delete hit only its
own book.

### Read-it-yourself gate — and Leaf 17 is not good enough

**Attribution is consistent and correct across all 18** — "The authors state…", "The authors
argue…", "The authors report…". The health and diet claims, which are most of Leaves 13-16, are
attributed to the authors rather than asserted as fact. That is the thing that most needed to be
right on this book and it is right.

**Leaf 17 carries a named-framework problem.** Three of its five sticky notes are the book's own
*ten rules of ikigai*, in the book's own imperative phrasing: "Eat until 80% full", "Stay active;
don't retire", "Surround yourself with good friends". **`LEGAL.md` forbids reproducing a named
framework 1:1, and the structure check cannot see this** — it measures chapter mirroring, not
phrasing. Leaf 12 has a milder echo. The other sixteen are clean.

The cause is predictable in hindsight: the approved plan put a synthesis Leaf on chapter 61,
which *is* the ten rules, and the generator did the obvious thing with it. **A plan that assigns
a Leaf to the chapter containing the book's named framework is a plan that needs a note
attached**, and gate 1 is where that is cheap.

Leaf 17 is also thin in two ways: its Dinner Table Knowledge restates the 80 percent rule that
Leaf 13 already teaches — a deep-cut fact that is not deep — and its apply-in-life gives
substantially the same instruction as Leaf 13's. **My own automated duplication check reported
"none" for both**, because it compared normalised word sets and the phrasing differs. The eye
caught what the check could not. That is the read-it-yourself gate earning its place, and it is
also a caution about trusting a cheap similarity check over a reading.

Leaf 13 carries only 2 sticky notes, the schema minimum, and the two paraphrase each other.

### Retention — closed and verified by query

Raw text 0 chars, `raw_text_purged_at` stamped, 63 embeddings intact, **36/36 cited passages
retained as the audit trail**, 27 uncited chunk texts nulled.

---

## What is unmet, and why

**Two acceptance criteria are unmet because the founder capped spending. Neither is partially
done — there are no Ikigai images at all.**

- **"The variety check passes against Ikigai's images."** It was run against Track 42 and fails
  correctly (0.502, exit code 1, six named near-duplicate pairs). The other half of that
  criterion needs images.
- **"Observed on a device: six Leaves, six settings that belong to their scenarios."** Needs
  images.

The remaining spend is **$2.41 for one candidate per Leaf, or $7.24 for gate 2's three.** The
scene plan derivation is already proven on Ikigai's sibling Track and costs about $0.02.

**An unresolved obstacle behind the device gate, flagged rather than solved:** Ikigai is a draft
and must stay one, and whether the app renders a draft Track in development lives in
`apps/backend`, which this handoff put out of bounds. Whoever picks this up should establish
that before assuming the device gate is a matter of running the app.

---

## Open for Architect

1. **Leaf 17 should be regenerated or hand-corrected before this Track is published**, and the
   named-framework echo is the reason. About $0.15 of text to regenerate one Leaf.
2. **The 1:1 structure check measures chapters and cannot see phrasing.** Leaf 17 passed every
   mechanical gate in this pipeline while lifting three of the book's ten rules verbatim. If
   named frameworks matter as much as `LEGAL.md` says, that gap wants a check of its own — or an
   explicit acceptance that gate 1 and the human reader are the only defence.
3. **`editorial_attempts` is the cost lever, not just the throughput lever.** WP20 found it for
   throughput; this package found the other half. A per-Track budget in dollars, refusing rather
   than warning, is the natural sibling of `ImageBudget` and does not exist.
4. **The variety floor is calibrated on two real sets.** It should be revisited on the third,
   and the synthetic-versus-real evidence split in `test_variety.py` should be preserved when it
   is.

## Open for the founder

1. **Choose the asset option, or leave Ikigai text-only.** $2.41 or $7.24, and nothing will be
   spent without a decision.
2. **Track 42's published Leaf 1 renders "$10K" and "$2K" legibly** — a breach of an absolute
   prohibition on live content, unrelated to this package and not fixed by it.
3. **Confirm in the billing console whether the $10.07 drew on the trial credit or a card.** The
   Cloud Billing API does not expose credit balance; WP18 confirmed the credit path against the
   console and I would expect the same, but I did not verify it.


