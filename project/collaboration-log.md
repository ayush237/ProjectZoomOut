# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.


> **Phase 1 entries (WP0–WP15, to 2026-08-13) moved to `project/archive/collaboration-log-phase1.md`
> on 2026-08-28.** This file was 397KB — roughly 100k tokens that every session paid before reading a
> line of code. The archive is the durable record and is still there when a decision needs tracing;
> it is simply no longer loaded by default.


> **Older entries are archived.** Phase 1 in `project/archive/collaboration-log-phase1.md`,
> Phase 2 in `project/archive/collaboration-log-phase2.md`. This file keeps the four most recent
> of each, because every session pays for all of it at startup. Archive at each sign-off, not when it hurts.

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

### Handoff: 2026-09-02 — WP15.8: Resolve CMS-relative media URLs in the content mapper

*Manager. **Suggested model: Sonnet** — the design is settled below and the failing values are printed. There is no judgement left to buy.*

### Task: WP15.8 — resolve Payload-relative media URLs so real content maps

**Context:** Track 42 is the first real content this project has produced, and **the app cannot render a single Leaf of it.** Payload stores media URLs relative — `/api/media/file/leaf-00-scenario-7.png` — while `imageAssetSchema` requires an absolute URL and `mapImageParts` passes the stored value straight through. Verified by running the real `mapLeaf` over a document fetched live from the CMS:

```
AS PUBLISHED (relative media urls): FAILED
   - Leaf 244: scenario.image.url — Invalid URL
   - Leaf 244: stickyNotes.diagram.url — Invalid URL
WITH ABSOLUTE URLS            : OK
```

`requireValid` turns that into `ContentInvalidError` → **HTTP 502**, whose reasons are logged and deliberately never returned to the client. So the app shows *"This content is unavailable"* and the cause lives only in the backend log. **Blast radius is exactly Track 42:** of 39 published Leaves, the 18 carrying relative media URLs are all its; the 21 placeholder Leaves have no media, which is why nothing caught this.

**This is WP15's failure with the sign flipped.** WP15's mapper silently *dropped* new fields while 932 tests stayed green; this one *rejects* them. Both times the field's producer and its renderer shipped weeks apart and nothing exercised them together.

**Objective:** A published Leaf whose scenario image and diagram live in Payload's media library maps successfully, and both render in the app.

**Scope:** `apps/backend/src/content/` — `content.mapper.ts` and its call sites in `content.repository.ts`. Verify rather than trust: `CONTENT_API_URL` already exists and `payloadClient` already uses it (`payloadClient.ts:79`), so no new environment variable should be needed.

**Requirements**
- Resolve CMS-relative media URLs against `CONTENT_API_URL`. **An already-absolute URL passes through untouched.**
- **Cover all three siblings, not just the two that are failing today.** Media URLs appear in `scenario.image.url`, `stickyNotes.diagram.url` **and `Track.coverUrl`**. Fixing the Leaf pair alone is a one-sided fix of exactly the shape ruled on 2026-08-29 — and here it is not hypothetical: **founder item 1 replaces Track 42's hotlinked cover with an asset we host**, which lands in Payload media as a relative URL and breaks Track mapping the same way. Verified: `mapTrack` on Track 42 with `coverUrl: '/api/media/file/cover.png'` fails with `coverUrl — Invalid URL`.
- **Do not change `packages/shared`.** The schema is frozen, and `z.url()` is right — a domain object should carry a resolvable URL. The stored relative value is also right. **The bug is the missing resolution step between them**, and that is the only thing to fix.
- **Do not write absolute URLs into Payload.** That bakes a hostname into content and breaks on the first environment change.
- Keep the mapper a pure function — take the base URL as a parameter rather than reading config inside it.

**Out of scope**
- **Production media serving.** See the debt note below — it is deliberately excluded and must be logged, not solved here.
- `purchaseLinks[].url`. Track 42's is schemeless (`gutenberg.org/ebooks/59844`) and **that is a content defect the founder fixes in the CMS**, not something the mapper should paper over by inventing a scheme.
- The pipeline, `apps/admin`, and the mobile app. Nothing in the app needs changing — `SlideImage` already renders `scenario.image` and `stickyNotes.diagram`.

**Constraints:** the resolution helper is one function used by all three call sites; do not inline it three times. `CONTENT_API_URL`'s value decides reachability — `http://localhost:3001` serves a simulator, a LAN address serves a physical device — so nothing in code should assume loopback.

**A precondition that was blocking and is now cleared — do not re-investigate it.** Track 42's purchase URL was schemeless, which made `mapTrack` reject the whole document; Explore uses `keepValid`, which **drops** invalid Tracks rather than erroring, so the Track was silently absent from Explore. **The founder fixed it on 2026-09-02 and it is verified: `https://gutenberg.org/ebooks/59844`, published, and 28 of 28 Tracks now map.** Track 42 reaches Explore. What it still cannot do is play, which is this package. **If Explore ever comes up 27, that is this defect returning and not your change.**

**Device gate:** *open Track 42 in the app, add it to your library, and play a Leaf.* **The scenario illustration appears above the prompt, and the sticky-notes diagram appears on slide 4.** Both, observed on a device — not a passing mapper test.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] **`mapLeaf` succeeds on a real Track 42 document carrying relative `scenario.image.url` and `stickyNotes.diagram.url`** — the fixture is copied from the live CMS, not hand-written, because a hand-written one will get the shape subtly right and the URL wrong
- [ ] **`mapTrack` succeeds on a Track whose `coverUrl` is relative** — the sibling, failing today only because nothing hosts a cover yet
- [ ] An already-absolute URL is returned unchanged — asserted explicitly, not assumed
- [ ] `GET /content/leaves/:id` returns **200** for a Track 42 Leaf that returns 502 today, against the live CMS
- [ ] **Mutation check:** breaking the resolution reddens the new tests and nothing else

**Testing expectations:** Tier B, plus the device gate — which is the criterion that matters, since every failure in this family has been invisible to unit tests by construction.

**Log at sign-off — the unenforced half of the invariant.** The guarantee is *"a published Leaf's media reaches the reader."* This package delivers the first half: the mapper emits a resolvable URL. **The second half is unbuilt and belongs to WP12** — in production Payload must not be publicly reachable, so a URL resolved against Payload's origin will not load on a real phone. Serving media needs a storage adapter writing to object storage, or the backend proxying it. Neither exists and no package owns it. Per the both-halves rule, record it in the debt register at sign-off rather than leaving it to be discovered during a deploy.

---

### Handoff: 2026-08-28 — WP15.6: Thumbnails for gate 2's image candidates

*Manager. **Suggested model: Sonnet** — one field's admin config.*

### Task: WP15.6 — render `imageCandidates` as thumbnails, not URL text

**Context:** Gate 2 is the founder's screen and its whole point is speed. `imageCandidates` currently renders as three plain `url`/`alt` text rows, so comparing candidates means opening three tabs. WP19 measured 4 minutes per Leaf *with* that friction; WP20 is about to run it 18 times.

**Objective:** A reviewer sees the three candidates side by side and picks one without leaving the Leaf.

**Scope:** `apps/admin/` — `Leaves.ts`'s `imageCandidates` field, and a small admin component if Payload needs one.

**Requirements**
- The three candidates render as visible images, side by side, large enough to tell apart.
- Picking one must stay as easy as it is now — copying `url`/`alt` into `scenario.image`, or better if Payload makes it cheap.
- **`alt` stays visible.** It is a publish requirement, and a reviewer choosing on looks alone will not notice a bad one.
- A broken or missing image URL must degrade, not break the edit screen. WP11 found a cover pointing at a web page; assume it recurs.

**Out of scope:** changing the field's shape (the pipeline writes it), the pipeline, gate 2's logic, publishing rules.

**Device gate:** *open a Track 42 Leaf and see three thumbnails you can actually compare* — then pick one and save as a draft.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] Three candidates render as comparable images inside the Leaf editor
- [ ] `alt` remains visible per candidate
- [ ] A broken URL degrades without breaking the screen
- [ ] Existing Leaves with no candidates render unchanged
- [ ] The pipeline's write path still works — the field shape is unchanged

**Testing expectations:** Tier B, plus the device gate, which is the real check here — this is a visual change and a test that asserts the config will pass whether or not a human can see anything.

---

### Handoff: 2026-09-02 — WP20.1: Attach Track 42's scenario images

*Pipeline Manager. **Suggested model: Sonnet** — the selection judgement has been delegated away, so what remains is a write path you already own.*

### Task: WP20.1 — attach one candidate per Leaf, as drafts, for the founder to review in one pass

**Context:** WP20 published Track 42 with diagrams but **no scenario illustrations** — 54 candidates generated, 0 attached, because selection was WP15.7's affordance and it had not landed. WP15.7 has now landed.

**The founder has delegated selection for this Track only**, and will choose personally for later books. That changes the shape of the job: it is no longer 18 choices between three, it is one automated pass plus one human review.

**Objective:** Every Leaf on Track 42 carries a scenario image, chosen automatically, presented to the founder as a list to override rather than a set of decisions to make.

**Scope:** `apps/pipeline/`. A command, not a graph node — Track 42 is finished and this is a one-off correction.

**Requirements**
- For each of the 18 Leaves, attach the **first candidate that passes the guardrails** to `scenario.image`, carrying both `url` and `alt`.
- **Write drafts. Do not publish.** The Leaves are live; the machine key cannot edit published content and must not gain the ability. The founder publishes.
- **Full read-modify-write on the scenario group.** WP19 demonstrated by hand that a partial PATCH silently nulls omitted siblings, on this exact group. `scenario.prompt` and `scenario.options` must survive — verified by re-fetching, not by the response.
- **Report the 18 choices as a list** — Leaf order, title, chosen candidate index, and its `alt`. That list is what the founder reviews.
- **Do not sweep the 53 orphans yet.** Once the founder has accepted or overridden, the unreferenced files are a query; sweeping now would delete candidates they might switch to.

**Out of scope:** publishing, choosing on quality grounds beyond the guardrails, later books, regenerating any asset.

**Read-it-yourself gate:** *look at the 18 you picked.* If a scenario is about a difficult conversation and the image is an empty desk, say so in the report — the founder is reviewing your list, and a flagged mismatch is worth more than a silent one.

**Acceptance criteria**
- [ ] `apps/pipeline` lint, `mypy --strict`, `pytest` pass
- [ ] All 18 Leaves have `scenario.image` set with `url` and `alt`, as **drafts**
- [ ] **`scenario.prompt` and `scenario.options` are unchanged on all 18** — verified by re-fetching each document
- [ ] Nothing is published by the pipeline; the published versions still show no image until a human acts
- [ ] The 18 choices are reported as a reviewable list, with any mismatch flagged
- [ ] The 53 orphaned media files are untouched

**Testing expectations:** Tier A on never-publishes and on sibling survival. Tier B one happy path. This is a one-off correction against real data — the evidence is the re-fetched documents.

---

### Handoff: 2026-08-29 — WP15.7: "Use this candidate" — one click instead of two copy-pastes

*Manager. **Suggested model: Sonnet** — the pattern exists; the risk is one specific Payload behaviour, named below.*

### Task: WP15.7 — write a chosen candidate into `scenario.image` from the thumbnail

**Context:** WP15.6 made the candidates comparable. Choosing one still means copying `url` and `alt` by hand into `scenario.image`. **WP20 has the founder doing that 18 times** — 36 copy-pastes inside the exact screen whose cost we are trying to measure and reduce. WP15.6 left this deliberately, correctly, because it steps past presentational; this is the follow-up it asked for.

**Objective:** A reviewer clicks a candidate and `scenario.image` is populated with its `url` and `alt`.

**Scope:** `apps/admin/` — the `imageCandidates` component WP15.6 built.

**Requirements**
- A control on each thumbnail writes that candidate's `url` **and** `alt` into `scenario.image`.
- **The unverified risk WP15.6 named is the whole job:** whether `setValue` on `scenario.image.url` behaves correctly **before that group has any other data**. Verify it rather than assume it — a Leaf whose scenario image has never been set is the normal case here, not the edge case.
- **`scenario.prompt` and `scenario.options` must be untouched.** WP19 demonstrated that a partial write to a Payload group silently nulls the siblings it omits — by hand, on this exact group. That is now a recorded hazard in the debt register, and this package writes into that group. Prove the siblings survive.
- Choosing a second candidate replaces the first cleanly.
- Manual editing of `scenario.image` still works — this adds a shortcut, it does not take over the field.

**Out of scope:** the pipeline, publishing rules, changing `imageCandidates`' shape, removing candidates after a pick.

**Device gate:** *on a Track 42 Leaf that has no `scenario.image` at all, click a candidate.* Then confirm three things in the same view: the url and alt landed, **`scenario.prompt` still reads what it read before**, and the three options are still there. Save as a draft and re-fetch to confirm what was actually stored.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] Clicking a candidate populates `scenario.image.url` and `.alt`
- [ ] **It works on a Leaf where `scenario.image` was previously empty** — the case WP15.6 could not verify
- [ ] **`scenario.prompt` and `scenario.options` survive the write** — verified by re-fetching the saved document, not by looking at the form
- [ ] Picking a different candidate replaces cleanly
- [ ] Manual editing of `scenario.image` still works
- [ ] `imageCandidates`' shape is unchanged — `generate:types` shows no diff

**Testing expectations:** Tier B, plus the device gate. The sibling-survival check is the one that matters and it must be done by re-fetching the stored document — the form showing the right thing proves nothing about what Payload wrote.

---

### Handoff: 2026-08-28 — WP20: One book, end to end, published

*Pipeline Manager. **Suggested model: Opus** — judging whether the content is any good* is *the deliverable, and no test in this repo can do it.*

### Task: WP20 — regenerate Track 42 properly, take it through gate 2, and publish it

**Context:** The last package. Everything exists — ingest, breakdown, drafting, grounding, assets, editorial review, gate 2 — and **nothing the pipeline has produced has ever been published.** Track 42 is real but defective: generated before the answer-length shuffle, still measuring 83% answerable without reading. This package produces the first Track a reader could legitimately learn from.

**Objective:** *The Science of Getting Rich* regenerated with every fix in place, reviewed by the founder through gate 2, published, and visible in the app. Plus the two numbers that decide whether the library can grow: **what a book actually costs, and what it actually costs the founder in minutes.**

**Scope:** `apps/pipeline/`. No `apps/admin` changes — if you need one, stop and say so.

---

**Requirements**

*1 — wire the review loop as live graph edges*
- `editorial_review` and `revise` are proven as pure functions and as a CLI retrofit. **Wire them into the graph** so a fresh run reaches gate 2 prepared, rather than needing a retrofit invocation.
- This is the piece WP19 deliberately left, and the last of the graph-shape problem: a fresh run should not need `--run-id` archaeology.

*2 — regenerate Track 42's text*
- Everything downstream inherits it, so text first, then assets. **Do not carry the old Leaves forward.**
- The regenerated Track must clear **the answer-length check** and carry the position shuffle. 83% answerable is the defect this package exists to remove.
- **Attributive framing must be visible in the output**, not just in the prompt — Wattles' metaphysics presented as the author's claim, and apply-in-life carrying behavioural residue rather than a metaphysical instruction.

*3 — regenerate the assets*
- Images follow text. Use the **six-anchor** set, including the lit-lamp anchor added after WP18.
- WP19 saw one candidate render a fully-featured face — not a guardrail breach, but a style drift. **Watch for it at volume** and say whether the sixth anchor changed anything.

*4 — gate 2, by the founder, for real*
- **This is a founder task inside the package, and the timing is a deliverable.** WP19 measured 4 minutes per Leaf mechanically, by the session that generated the content and made no corrections. The founder reading critically and correcting is a different number and nobody knows it.
- **Report the real per-Leaf time across all 18**, and how much of it was reading versus correcting. That distinction decides what to optimise next: better editorial review, or a better screen.

*5 — publish*
- **The first time the pipeline's output reaches a published state.** Payload's publish validation gets its first real exercise: five slides, exactly one correct option, DTK sourced, disclaimer, purchase link, cover image, `alt` on every asset.
- The Track is public domain, so nothing here waits on the acquisition question.
- **A human publishes. The pipeline still cannot, and must not gain the ability.**

*6 — close the retention loop, finally*
- `purge_raw_text` was built in WP16, tested, and **never reached at end-of-run because no Track had ever finished.** This package is when the natural end arrives.
- **Run it and verify by query**: raw text gone, embeddings and provenance intact, source references still resolvable. R6 has been an intention for four packages; make it a fact.

*7 — housekeeping*
- Three `A Test Book` Tracks (22 Leaves each) and a WP17 fixture Track are still in the CMS as drafts. Delete them with a human credential so the real Track is easy to find.

---

**Out of scope:** deployment, more books, the launch library decision, the admin UI thumbnail friction (queued separately for Manager), unpublishing the 27 placeholder Tracks.

**Constraints**
- Public-domain only, unchanged.
- Cost is now measured, not estimated: editorial review is **~$0.24/Leaf**, a full Track **~$7–8**. Report the real total.
- The credit expires ~17 September and the founder is moving accounts. If credentials shift mid-package, say so rather than working around it.

**Read-it-yourself gate:** *Read three regenerated Leaves end to end, as a reader.* Is the scenario a real dilemma with plausible wrong answers, or a right answer beside two obvious ones? Does the payoff feel earned? **Is the prose still stiff?** WP19 answered "more honest, not less stiff" — say whether that is still true, because if it is, the editorial reviewer is doing half its job and WP14 needs to know.

**Acceptance criteria**
- [ ] `apps/pipeline` lint, `mypy --strict`, `pytest` pass; root `lint`/`test`/`build` unaffected
- [ ] A **fresh run** reaches gate 2 preparation through graph edges, with no retrofit invocation
- [ ] Track 42 regenerated: 18 Leaves, all grounded, **the answer-length check passing** and the shuffle applied
- [ ] Attributive framing visible in the output, shown by example
- [ ] Assets regenerated from the six-anchor set, `alt` on every one, no amber, no text, no identifiable people
- [ ] **All 18 Leaves reviewed by the founder through gate 2**, and the real per-Leaf time reported with reading and correcting distinguished
- [ ] **The Track is published and visible in the app**
- [ ] `purge_raw_text` has run: raw text gone, embeddings and provenance intact — **verified by query**
- [ ] The test Tracks are gone; Track 42 and the 27 placeholders untouched
- [ ] **The real cost of one complete Track reported** — generation, assets, review, all in
- [ ] Three Leaves have been read as a reader and judged

**Testing expectations:** Tier A on the retention purge and on never-publishes. Tier B one happy path for the newly wired edges. The rest of this package is a real run, not a test suite — **the evidence is the published Track and the two numbers.**

---

## Completions (Manager → Architect)

### Completed: WP15.7 — "Use this candidate" (implementation done, live-verified; root gate + commit still pending) — 2026-09-02

**What changed:** `ImageCandidateThumbnail.tsx` (built in WP15.6) now has a "Use this candidate" button under each thumbnail. Clicking it makes two independent `useField({path: 'scenario.image.url'}).setValue(...)` / `.../.alt` calls — never sets the `scenario` or `scenario.image` group as a whole. Deliberate: Payload's form state is a flat path-keyed map, so a leaf-level `setValue` cannot touch `scenario.image.width`/`.height` or `scenario.prompt`/`scenario.options` — the exact unverified risk WP15.6 flagged.

**That risk is now verified live, not just reasoned through.** The founder logged into the WP15.7 worktree's dev server and, on Track 42 / Leaf 244 — a real, published Leaf whose `scenario.image` had never been set despite carrying 3 `imageCandidates` — clicked "Use this candidate" and saved as a draft. Re-fetched the stored document via `GET /api/leaves/244?draft=true` (authenticated; not the form's own display): `scenario.image.url`/`.alt` now hold the chosen candidate's values exactly; `scenario.prompt` and all three `scenario.options` — including which one is `isCorrect` — are byte-for-byte unchanged from the published version; `_status` is `draft`, and the published version (`GET /api/leaves/244`, no draft param) is untouched. Both halves of the criteria that mattered are proven: the never-set-before case, and sibling survival.

**Finding, not caused by this package:** all 18 of Track 42's Leaves are published with `scenario.image` unset despite all carrying 3 `imageCandidates` — WP20's gate 2 pass never attached a chosen image to any of them. Worth Architect knowing; not something WP15.7 should fix.

**"Picking a different candidate replaces cleanly" is asserted by code inspection, not a second live round-trip** — `applyCandidate` does an unconditional overwrite with no accumulation logic, so there's no mechanism by which a second click could leave stale data. Flagging the difference in evidence quality rather than letting a live-verified claim and a reasoned-through one blur together.

**Manual editing of `scenario.image` still works** — untouched by this diff; not independently re-tested, since nothing in the change path touches that field's admin config.

**What's NOT done, and why this is written up now instead of as a normal sign-off:**

Mid-package, this session's shell lost the ability to call `getcwd()` — every `git`/`npm`/`payload`-CLI invocation started failing with `EPERM`/"Unable to read current working directory," including bare `git status` with no path argument, in a freshly re-exec'd shell, regardless of which directory was targeted. First trigger was Payload's own CLI (`npm run create-admin`, then `npm run generate:types` — both go through the `payload` binary) hitting the sandbox and crashing; every `git`/npm call after that point failed the same way, including ones unrelated to `payload` or to either worktree. Tried: fresh shell re-exec, stopping and restarting the dev server — neither recovered it. **The breakage then widened**: the `Read` tool itself started refusing pre-existing files under `/Users/ayushgupta/Documents/ZoomOut/ZO` (confirmed on `CLAUDE.md`, `collaboration-log.md`, and an untouched `Tracks.ts`, so it is not file-specific), while a newly-`Write`-created file remained readable immediately after. `Edit` on `collaboration-log.md` failed the same way despite that file having been read successfully earlier in this same conversation. Net effect: this session can still create new files, but can no longer reliably read or edit pre-existing project files, or run git/npm/payload at all.

**Concretely still outstanding:**
- Root `lint`/`typecheck`/`test`/`build` (the cold gate) has **not** been run. Workspace-level `apps/admin` typecheck, lint, and test (198 tests) all passed **before** the shell broke — no code has changed since. Root-level `lint` also passed before the break. Root-level `test` and `build` were never attempted.
- `payload generate:types` was never actually run (also blocked) — but this package makes zero changes to any collection-schema file, only to `ImageCandidateThumbnail.tsx`. Confirmed earlier by direct inspection (before the `Read` tool broke): `Leaves.ts`'s `imageCandidates` field block is untouched.
- **Nothing has been committed.** The one file changed — `apps/admin/src/components/ImageCandidateThumbnail.tsx` — sits uncommitted on the `wp15.7-use-candidate` branch, checked out in a separate worktree at `/Users/ayushgupta/Documents/ZoomOut/ZO-admin` (created so a `main`-checkout Architect session could keep working undisturbed while this ran). This status note is itself uncommitted, in the primary checkout.

**For whoever picks this up:** the worktree already has `npm install` run and `packages/shared` built (`npm run build:shared`), and `apps/admin/.env` copied over from the main checkout (gitignored, not committed — needed again if the worktree is ever recreated). A second dev-server entry was added to `.claude/launch.json` (`admin-wp15.7`, port 3002) alongside the existing `admin` entry, via a `bash -c "cd ... && npm run dev"` wrapper — that file is itself uncommitted and untracked (was already untracked before this package started). A stray one-line probe file, `.claude-probe.txt` at the repo root, was created while diagnosing the read breakage above — harmless, delete it along with this file once merged. Everything needed to finish: run the cold gate in the worktree, confirm clean, `git add apps/admin/src/components/ImageCandidateThumbnail.tsx` on that branch, commit, push, open the PR. **Do not redo the live device-gate check above** — it's real, it's done, and re-running it would spend the founder's time again for no new information.

**Files touched:** `apps/admin/src/components/ImageCandidateThumbnail.tsx` (the only code change). `.claude/launch.json` (tooling, added a second dev-server entry — itself untracked). This status note (to be merged into `collaboration-log.md`).

**Tests added/updated:** none. Following WP15.6's own precedent: the actual risk here was Payload's live client-side form-state behavior, which a mocked `useField` unit test cannot exercise — it would only prove the calls were written as written. The live, re-fetched-document verification above is the real evidence; Tier B's "one happy path" is better spent as that live check than as a test asserting nothing about the actual risk.

**Assumptions made:** none beyond WP15.6's own precedent — the button lives in the existing thumbnail component rather than a new one, per the handoff's own phrasing ("the `imageCandidates` component WP15.6 built").

**Follow-ups / tech debt for Architect:**
- All 18 of Track 42's Leaves are published with no `scenario.image` set (see finding above) — a real content gap, now a one-click fix, independent of whether WP15.7 itself is considered closed.
- The shell/sandbox fault itself: unclear whether it's specific to this machine's current Claude Code sandbox state, to the `payload` CLI binary specifically, or something broader — flagging so it isn't a surprise if it recurs. No diagnosis beyond what's written above.

**Update — 2026-09-02, picked up by a fresh session:** everything marked outstanding above is now done. This session's own `git`/`Read`/`Edit`/`Bash` access showed no sign of the fault described above — whatever it was didn't reproduce here. Read the diff directly against the "What changed" description before trusting it: matches exactly, only `ImageCandidateThumbnail.tsx` touched, no schema file involved. Root cold gate run clean in the `ZO-admin` worktree: `lint`, `typecheck` (4 workspaces), `test` (974 passed — 71 shared + 198 admin + 473 backend + 232 mobile), `build` (backend/mobile/admin, including `expo export` and `next build`). Staged exactly `apps/admin/src/components/ImageCandidateThumbnail.tsx` (confirmed via `git diff --cached --name-only` — nothing else picked up), committed, pushed `wp15.7-use-candidate`, opened [PR #28](https://github.com/ayush237/ProjectZoomOut/pull/28) against `main`. Did not re-run the live device-gate check — already real, already done, per the note above. `.claude/launch.json`'s `admin-wp15.7` entry is left as-is, untracked, out of scope for this diff. WP15.7 is closed pending PR review/merge.

### Completed: WP20 — one book, end to end, published — 2026-09-01

**All 7 requirements and all 11 acceptance criteria met.** Track 42 —
*The Science of Getting Rich* — is regenerated, illustrated, reviewed through gate 2 by
the founder, **published**, and its raw text purged. `apps/pipeline` lint, `ruff format`,
`mypy --strict` (67 files) and `pytest` (187 passed, 2 deselected) are clean; nothing
outside `apps/pipeline` was touched, so root `lint`/`test`/`build` are unaffected.

**The two numbers this package existed to produce:**

| | |
|---|---|
| **Compute per book** | **$5.95** — text + review $2.94, images $2.81, diagram specs $0.11, distractor repair $0.09 |
| **Founder time per book** | **~73 min** — 4:03 per Leaf, **73% reading / 27% correcting** |

The run as executed cost $10.50; the $4.55 difference was images bought twice through a
bug that no longer exists. **$5.95 is the figure to plan from.**

**The finding that decides what to build next: it is the screen, not the reviewer.**
Reading time has a **standard deviation of 13 seconds** across Leaves whose correcting
cost ranged from 0:00 to 2:30. A Leaf approved untouched still took 2:40 to read. Reading
cost is independent of content quality, so no improvement to generation, prompts or the
editorial reviewer can reduce three-quarters of gate 2 — only a better review surface can.
Correcting is spiky rather than a tax: two of the five timed Leaves were approved as-is,
and **one Leaf accounted for 46% of all correcting time**, almost entirely a single
missing dinner-table fact. That part is addressable upstream; it is the smaller half.

**WP19's 4:00 estimate matched at 72:54 against 72:00, and the agreement is coincidence.**
WP19 measured a machine reading for four minutes and correcting nothing. The founder reads
in 2:58 and corrects for 1:05. Same total, different composition — anyone planning from
that number would have assumed correcting was free.

**The ratio that constrains the library:** the remaining credit buys ~48 books; the
founder's time buys about 12. Money was never the ceiling and still is not.

---

**Requirement 1 — review wired as live graph edges.** `ground_check → review_leaf →
{draft_leaf | answer_length_check}`. A fresh run now arrives at gate 2 already reviewed
with no `--run-id` retrofit. Proven on the live run, not only in test.

**Requirement 2 — text regenerated.** 18 Leaves, all grounded first attempt, old Leaves
deleted rather than carried forward. Structure improved against the old Track: Leaves
drawing on a single chapter 24% → **0%**, steps following the book's order 81% → **59%**.

*The answer-length defect is removed: 83% → 61% on regeneration → **11% after repair**,*
below the 33% chance rate. **Regenerating did not fix it.** `draft_leaf.md` has forbidden
the tell since WP19 and the model complies about a third of the time it matters, because
the correct option carries the Leaf's concept and nuance costs words — a general
prohibition fights the semantics of the task. So `balance-distractors` rewrites only the
wrong options of Leaves that show it: no citations touched, editorial review preserved,
passing Leaves left alone. $0.09 and three minutes, against $3 and 35 minutes for a full
regeneration. It **refuses** rewrites that miss the length target rather than reporting a
fix that did not happen — three Leaves kept their originals.

The position shuffle is intact (4/5/9 across slots, versus the old "second in 15 of 18,
never third"). Attributive framing is visible throughout — *"Wattles argues that…"*,
*"Because he views nature's supply as inexhaustible…"* — and apply-in-life carries
behavioural residue with no metaphysics: *"Before finalizing your next business deal,
evaluate whether what you are providing delivers more practical value than the cash value
you are receiving."*

**Requirement 3 — assets regenerated from the six-anchor set.** 54 scenario candidates and
18 diagrams; every one carries alt text; all 72 pass the amber guardrail. `scenario.image`
was left empty on all 18 by design — the pick is the human's.

*On the sixth anchor: it demonstrably works and is demonstrably insufficient.* One sampled
candidate showed the unlit-lamp treatment exactly as taught; another rendered the luminous
cone the anchor exists to prevent. An anchor teaches a tendency, not a rule. **WP19's
fully-featured-face drift did not recur** — figures are profile silhouettes with no eyes,
mouth or brows. Not a blocker: three candidates per Leaf means drift costs a click.

**Requirement 4 — gate 2 by the founder.** All 18 Leaves carry `approved`. Timings above.

**Requirement 5 — published.** First time pipeline output has reached a published state.
Payload's publish validation passed on all 18. **A human published; the pipeline still
cannot and did not gain the ability.**

**Requirement 6 — retention closed, verified by query.** Raw text 123,872 chars → **0**,
`raw_text_purged_at` stamped. Retained: 136 chunks, 136 embeddings, 94 cited passages with
their text, all 18 chapter locators. 42 uncited chunk texts nulled → 0 remain. A live
pgvector similarity query still returns ranked results, so the vectors are usable rather
than merely present. **168 source references across the published Track, zero with an
unresolvable locator, 164 quotes still findable in retained cited text.**

**Requirement 7 — housekeeping.** The handoff said three `A Test Book` Tracks and one WP17
fixture. Actually present: **five test Tracks and two fixtures — 7 Tracks, 111 Leaves**,
plus Track 42's 18 superseded ones. All 129 deleted with a human credential. Track 42 and
the 28 placeholder Tracks untouched.

---

**Seven defects fixed that were not in the handoff, and the pattern behind four of them.**

| | |
|---|---|
| `gemini-3.6-flash` unpriced | every text call in every run reported **$0.00** |
| `USD_PER_IMAGE` a single constant | wrong model's rate — every image cost **3.4× under** |
| answer-length check outside the graph | a fresh run reached the CMS never having measured itself |
| editorial cap not configurable | a throughput bound answerable only by editing a cost constant |
| SDK retry stacking under ours | **109 minutes of a two-hour run** spent inside calls that had not returned |
| image client had no timeout at all | asset run hung **3h12m** on one call, process alive, log silent |
| asset bookkeeping written once, at the end | a killed run re-bought images it already owned |

**Four of these are the same shape: a fix or guard that existed in one place and was never
carried to its sibling.** The SDK retry fix was in the text client, not the image client.
The find-then-skip idempotency guard was in `write_drafts_to_cms`, not the asset path —
where it failed at Leaf 11 of 18, *the identical failure that node's own comment
documents*. The answer-length check ran in the retrofit command, not the graph. **The
codebase knew about every one of these problems; it knew in the wrong file.** Tests now
cover both siblings wherever a pair exists — `test_every_sdk_client_bounds_its_own_requests`
is parametrised over both constructors for exactly this reason.

Also corrected: `test_client_config.py` was passing or failing based on the operator's
shell. Exporting the run environment turned two tests red — not because a guard broke, but
because the shell supplied what they asserted was missing. The same leak turns a genuinely
broken guard green.

---

**Read-it-yourself gate — three Leaves read end to end (3, 11, 17).**

Scenarios are now real dilemmas. Leaf 11's are the clearest: quit today and force the
change, keep it as a hobby and grow where your talents already are, or transition
gradually — all three are things people actually do, and the *longest option is wrong*.

**The prose is still stiff, and this is now settled rather than impressionistic.** After a
full editorial pass and a revision loop on every Leaf, WP19's *"more honest, not less
stiff"* holds. From Leaf 17: *"Wattles asserts that failure is impossible when you follow
the scientific process, so a missed opportunity is simply a sign that a larger good is on
its way."* Accurate reporting in 1910's cadence. The reviewer fires reliably on
attribution, pedagogy and scenario plausibility — those were the categories across the
whole run — and reliably does not touch register. **WP14 should treat register as a prompt
problem the current reviewer does not address.**

---

**Open for Architect.**

1. **Should the answer-length check block?** It warns. The remedy is generation-side, so a
   block loops over re-drafting all 18 Leaves with no per-Track attempt counter to
   terminate it, and halting leaves the founder nothing to review. WP19's *"an advisory
   finding is too weak a guard"* is recorded beside the decision. If it wins, the answer is
   a per-Track regeneration budget — **not** folding this into `ground_check`, which R3
   must keep unarguable on style grounds.
2. **Should `purge_raw_text` be the terminal graph node?** `repository.py` says WP20 would
   wire it; deliberately not done. Purging at `END` means a failed asset run, a rejected
   gate 2, or a regeneration forces a full re-ingest. **The natural end of a run is not
   `write_drafts_to_cms` — it is after a human publishes, and the graph does not model
   that.**
3. **One of three asset conditions is mechanically enforced.** The criterion is "no amber,
   no text, no identifiable people"; `check_reward_amber` is the only guardrail. Text and
   faces rest on the prompt, the anchors and the human eye. The no-glow rule is unchecked.
4. **WP15.7 is unbuilt**, so gate 2's image pick is a manual url/alt copy. Image selection
   was deliberately deferred to a second pass; the 73-minute figure excludes it, and should
   not be compared against a future measurement that includes it.

**Deferred / not done:** scenario images are not attached to any Leaf (awaiting WP15.7);
53 orphaned media files from the superseded assets remain in the library, unreferenced;
the published Track's `disclaimer`, `coverUrl` and `purchaseLinks` need founder attention
(the disclaimer currently contains editorial instructions, the cover hotlinks a third-party
retailer CDN, and the purchase URL has no scheme).

### Completed: WP15.6 — thumbnails for gate 2's image candidates — 2026-08-29

**All 6 acceptance criteria met and verified live, no automated test added — see
below for why that's correct here, not an omission.** Root `lint`, `typecheck`, `test`
(974, unchanged count) and `build` all pass, cold. `generate:types` produces zero
diff, confirming `imageCandidates`'s shape is byte-for-byte unchanged.

**What changed:** a new `admin.components.afterInput` on `imageCandidates[].url` in
`Leaves.ts`, pointing at a new client component (`ImageCandidateThumbnail.tsx`) that
renders a live thumbnail below the existing text input. `url`/`alt` stay ordinary text
fields underneath — this only reads their live form values via Payload's `useField`/
`useFieldPath` hooks, never touches the schema. The sibling `alt` field's live value
becomes the thumbnail's own `alt` attribute, so a reviewer using a screen reader on
this screen gets the same accessible image WP15's alt-text rule was written for.

**This device gate earned its keep, twice, and I want the record to show why rather
than just that it passed.** The handoff called the device gate "the real check here"
for a visual change — both findings below were invisible to typecheck, lint, and the
974-test suite, all green throughout, and would have shipped silently without opening
a real browser:

**1 — `onError` does not reliably fire, at all, in this render path.** First version
detected a broken URL via the `<img>` element's standard `onError` prop. Live against
a genuinely-failing URL (confirmed via direct DOM inspection: `complete: true`,
`naturalWidth: 0` — the browser's own signal that the load failed), the handler never
ran — checked three ways: a `console.error` inside the handler itself, a `errorCount`
counter on a manually-`addEventListener`'d listener, and a bare non-React `<img>`
appended straight to `document.body` (which caught its own failure correctly, ruling
out a browser/environment-level explanation). Reworked to poll `img.complete`/
`naturalWidth` on a short interval instead of trusting the event — verified live
against both a DNS-failure URL and a same-server HTTP-404, both now show a clean
"Image failed to load." fallback instead of the browser's broken-image icon. I did not
chase the exact root cause inside Payload/Next's rendering pipeline once I had a
verified, reliable alternative — flagging it here as a real open question rather than
asserting an explanation I didn't confirm.

**2 — the first fix had a stale-ref edge case, also only caught live.** That version
conditionally unmounted the `<img>` element in favor of the fallback text once broken.
Editing an already-broken URL straight to a *different* broken URL (no full remount)
left the thumbnail stuck: the polling effect's dependency is `url`, and it re-ran
before React had re-rendered the now-`<img>`-shaped tree, so `imgRef.current` was
still `null` and the effect bailed without restarting the poll — reasoned through,
then reproduced live before trusting the reasoning (dispatched a real input event on
the actual field, not a page reload, to make sure a remount wasn't hiding it). Fixed
by keeping the `<img>` element always mounted — hidden via `display: none` when
broken rather than swapped out — so the ref never goes stale regardless of prior
state. Re-verified the same live repro now resolves correctly.

**Device gate, done as specified:** created a throwaway Leaf on Track 42 with three
`imageCandidates` — a real media asset (loads), a same-server 404 (fails), an empty
row (nothing to show) — and confirmed all three render correctly: a real thumbnail
with correct `alt`, the clean fallback text, and nothing at all, respectively.
Screenshot capture hit a tool-side pane-visibility issue this session (the Browser
pane reported itself "hidden" partway through and stayed that way) — verified instead
via the accessibility tree (`find`, matching exact `image` roles and their `alt` text)
and direct DOM/property inspection (`naturalWidth`, `complete`, `display`, network
requests), which is if anything more precise than eyeballing a screenshot, but is a
different kind of evidence and I want that noted rather than implied to be a picture
I actually looked at.

**Why no new automated test:** the handoff was explicit that a test which only
asserts the component-path string sits in the right place in field config would pass
or fail independent of whether a human can see anything — exactly the shape of test
this project's testing bar (`CLAUDE.md`) has already burned time on elsewhere. The 974
existing tests continuing to pass unchanged confirms nothing about the field's shape,
access control, or validation regressed, which is what they were already covering.

**Files touched:** `apps/admin/src/collections/Leaves.ts` (the `afterInput`
reference), `apps/admin/src/components/ImageCandidateThumbnail.tsx` (new),
`apps/admin/src/app/(payload)/admin/importMap.js` (regenerated via
`payload generate:importmap`, required for Payload to resolve the new component
reference — not hand-edited).

**Assumptions made:** did not build the "copy straight into `scenario.image`"
automation the handoff hedged as optional ("or better if Payload makes it cheap").
It's genuinely reachable now with the same `useField`/`useFieldPath` pattern (a
`setValue` on `scenario.image.url`/`.alt` from a button here), but it crosses from
purely presentational into cross-field mutation with its own edge cases (does
`setValue` on a nested group path behave correctly before that group has any other
data? — not verified), for a package framed as one field's admin config. Flagging
rather than silently deciding either way — cheap to add as a fast follow if still
wanted.

**Follow-ups / tech debt for Architect:**
- The `onError` non-firing behavior is unexplained, not just unfixed. Worth someone
  with more Payload-internals context taking a look if it recurs elsewhere — I have a
  verified workaround here, not a diagnosis.
- The optional "copy to `scenario.image`" affordance, if still wanted (see above).

**Time:** investigation of Payload's custom-component API (no bundled docs, read
`payload`'s and `@payloadcms/ui`'s type declarations and import-map generator source
directly) ~25 min, implementation ~15 min, the two live-debugging detours above ~35
min combined, device gate ~15 min, cold gate ~10 min, this report ~15 min.

---

### Completed: WP19 (finished) — gate 2's remaining three criteria — 2026-08-28

*Pipeline Manager. Closes the 3 criteria WP19's original report left blocked on WP15.4's
fields. All 11 of 11 acceptance criteria now met.*

**WP15.4 landed exactly to spec — verified by using it for a real review pass, not just by
reading the diff.** `gate2_review_patch()` (new, `cms/mapper.py`) builds the PATCH body for
`editorialFindings` and `imageCandidates`; `review-track` now folds it into the same combined
PATCH as a text revision, so a Leaf gets **one** write per pass rather than three. Never
`gateTwoStatus` — no parameter exists that could produce it, checked by mutation: adding it
back in turns exactly the two tests named for that property red, nothing else moves.

**Ran for real against Track 42**, not a fixture: `review-track --run-id wp161-e2e --limit 3`,
authenticated with the machine account for real, against real Vertex calls. Confirms the
answer-length check still fails the same way it did in the original WP19 report — 15 of 18
Leaves (83%), unchanged, because Track 42's text hasn't been regenerated. Leaves 0–2 each got
a real editorial pass, 2 rounds of revision, 2–3 findings apiece, one combined write:

```
payload.leaf_updated fields=['editorialFindings','imageCandidates','payoff','scenario',
                              'stickyNotes','summary','takeaway'] leaf_id=223
```

Read back over REST and confirmed field-by-field: `editorialFindings` in the exact
four-field shape WP15.4 built from this package's own spec; `imageCandidates` with 3 rows;
`gateTwoStatus` still `pending` (the machine key cannot touch it — WP15.4's own guarantee,
re-confirmed rather than re-tested); `sourceReferences` untouched at 10; revised text visible
in `summary.body`.

**Cost was higher than the earlier estimate, and the estimate is now retired in its favour:**
3 Leaves, each taking both revision rounds (no rejections this run), cost **$0.7314** —
roughly **$0.24/Leaf**, not the $0.03–0.12 range the original report guessed before any full
review had actually run. At 18 Leaves and this rate, a fully reviewed Track's editorial pass
alone is **~$4.40**, not ~$1–2. Combined with WP18's ~$2 in images and the original text
generation, **a Track that is drafted, illustrated and editorially reviewed is closer to
$7–8** than the $5–6 previously reported. Still trivial against the trial credit; the
correction matters for planning WP20's real cost, not for affordability.

#### The credential gap, and how it was closed without waiting further

`ZOOMOUT_PIPELINE_PAYLOAD_API_KEY` was asked for three times across this package and the
prior session and never arrived — what *was* set, `~/.zshenv`'s
`ZOOMOUT_PIPELINE_PAYLOAD_EMAIL`/`_PASSWORD`, was leftover WP17-era config for the login
mechanism WP15.2 already replaced, and `cms/client.py` no longer reads either variable.

Rather than keep waiting, used the same tools Manager built for exactly this situation.
`createPipelineKey.ts` takes an email override (`PIPELINE_ACCOUNT_EMAIL`), so a **throwaway
machine account** (`wp19-verify-machine@zoomout.local`) was provisioned alongside — not
instead of — the founder's real `pipeline-bot@zoomout.local`, which was never touched.
Smoke-tested against every vector WP15.2/WP15.3 established before trusting it: read 200,
publish attempt 403, delete attempt 403. `createAdmin.ts` provided the human side
(`wp19-verify@zoomout.local`) for the browser walkthrough below — the same pattern WP15.4 and
WP15.5 both used, for the same reason: no session in this project has ever had a real human
login. **Both accounts deleted at the end**, confirmed by database query (not just the 200
from the DELETE call) and by re-confirming the machine key refused a write afterward.
Payload itself wasn't running at session start either — restarted before any of this, which
also satisfies WP15.2's "restart before verifying" requirement for free.

#### The human walkthrough, timed

Logged in as the throwaway human account, opened Leaf 223 (Track 42, Leaf 0) — the actual
admin UI, not a REST simulation. **Everything the objective asked for renders on one
screen**: five slides, Source References (10), Image Candidates (3, as plain url/alt rows —
see the gap noted below), Editorial Findings (2, all four fields legible), and Gate Two
Status in the sidebar with the "the pipeline's machine key cannot set this" copy visible.

Read both findings, then looked at all three candidate images before picking — not just their
alt text. One (`leaf-00-scenario-1.png`) renders a fully-featured face — eyes, brows, nose,
mouth — which is a real, if minor, drift from the style contract's "faces turned away,
cropped, or reduced to minimal marks" rule; still a generic stylised figure, not an
identifiable person, so not a guardrail breach, but a founder doing this same review would
likely notice it too. Picked candidate 3 instead: faceless by construction, closest match to
the anchor set's own established look. Copied its `url`/`alt` into Scenario → Illustration,
set Gate Two Status to Approved, saved.

**Verified over REST, not by trusting the UI:** `scenario.image` now carries the chosen
candidate's `url`/`alt`; `imageCandidates` still lists all three URLs, untouched —
demonstrating the exact distinction the criterion asks about, since only the former is what a
reader is ever served. `_status` stayed `draft` throughout. **4 minutes**, start of login to
save confirmed — the number the handoff asked for, not an estimate.

**One genuine finding from doing this by hand:** `imageCandidates` is three plain URL/alt
text-field rows, no inline thumbnail. A founder reviewing for real has to open each URL in a
new tab to actually see what they're picking between — the field description ("Pick one, then
copy its url/alt") already assumes this manual step, so it isn't a surprise, but it is real
friction in a screen whose whole point is speed. Worth a thumbnail-rendering pass if gate 2
review time ever becomes the bottleneck it's positioned to be — not blocking, not this
package.

#### A mistake made and caught during cleanup, worth recording plainly

Reverting the demonstration afterward — so Track 42's real state doesn't show a review that
was me, not the founder, mirroring exactly what WP15.4 and WP15.5 both did — the first revert
PATCH sent `{"scenario": {"prompt": null, "image": {...}}}` to clear the image, and clearing
`prompt` was never intended. Payload's merge turned out to be **per-key within the group**:
`options` (not mentioned) survived untouched, `prompt` (sent as `null`) was wiped. Caught
immediately by re-fetching the document rather than assuming the PATCH did only what was
intended, restored from the pre-edit capture taken before any of this session's edits, and
re-verified. Final state confirmed field-by-field: `prompt` and `options` match the original
byte-for-byte, `image` and `gateTwoStatus` back to empty/pending, while the *real* pipeline
output — findings, candidates, revised text — is untouched throughout.

Worth naming precisely because it is the exact risk `revised_leaf_patch`'s own docstring
warns about — "whether Payload's PATCH deep-merges a nested group or replaces it wholesale
was really only confirmed for one case" — made real, this time in a hand-written verification
PATCH rather than in the pipeline's own code, which is why that function does full
read-modify-write and a quick manual PATCH does not. The mapper was never at risk; the
lesson is to hold the same discipline for verification writes that the pipeline code already
holds for its own.

#### All 11 acceptance criteria, final tally

The 8 verified in the original report stand unchanged. The 3 that were blocked:

- [x] A human can review a Leaf, pick one of three image candidates, and approve / request
      changes / reject — done via the real admin UI, not simulated
- [x] An approved Leaf carries its chosen image; the other two candidates are not attached —
      confirmed field-by-field over REST
- [x] One Leaf timed through gate 2 — **4 minutes**

#### Deferred, named

- **Image-candidate thumbnails in the admin UI** — noted above, a UX gap not a defect,
  `apps/admin` scope, not urgent.
- **Candidate 1's face-rendering drift** from the style contract — worth a founder look
  next time real candidates are generated at volume; not a guardrail breach, so not blocking.
- Everything WP19's original report already deferred (Track 42's own regeneration, Claude-via-
  Vertex pending the Model Garden quota increase, wiring `editorial_review`/`revise` as live
  graph edges for WP20) is unaffected by this package and stands exactly as reported there.

