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

> **Reissued 2026-09-02 after the first attempt exhausted the daily limit.** Two things changed and
> both are above the fold deliberately.
>
> **1. Most of this is already written and it is sitting in the working tree.** The previous session
> got cut off mid-package, uncommitted, on branch `wp20.1-attach-scenario-images`. `git diff
> apps/backend/src/content/` shows `resolveMediaUrl` + `isAbsoluteUrl`, `baseUrl` threaded through
> `mapTrack`/`mapLeaf`/`optionalImage`/`optionalDiagram`/`mapImageParts`, all three siblings covered,
> and ~390 lines of new tests. **Read that diff before writing anything.** A copy is at
> `scratchpad/wp15.8-wip.patch` in case the tree is disturbed. **What is left is the gates and the
> commit, not the design.**
>
> **2. Read only what is listed below.** `token-budget.md` Lever 3 says a handoff names its reading
> list and this one did not, so the first attempt loaded every planning document — ~55k tokens before
> touching a line of code. That is the likeliest reason the limit went in minutes.
>
> **Read:** this handoff · `apps/backend/src/content/content.mapper.ts` ·
> `apps/backend/src/content/content.repository.ts` · `imageAssetSchema` and `trackSchema` in
> `packages/shared/src/content.ts` · `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `launch-blockers.md`, the rest of
> this log, `apps/pipeline`, `apps/admin`, `apps/mobile`. Nothing in this package needs them.
>
> **Do not run `git add -A` or `git add .`** — `apps/mobile/ios/` is an untracked 1.2 GB Expo
> prebuild with no `.gitignore` rule, and it would go straight into the commit. Stage the three
> backend files by path. Adding that ignore rule is a requirement below.

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
- **Add `apps/mobile/ios/` to the root `.gitignore`.** It is an untracked 1.2 GB Expo prebuild today, and `git add -A` sweeps 18 entries of it. Same shape as the `.venv` hazard already in the debt register, and the fix belongs with whoever is next in the tree rather than waiting for a package that owns it.

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

