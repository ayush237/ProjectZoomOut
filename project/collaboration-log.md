# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

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

<!-- ### Completed: <title> — YYYY-MM-DD
(paste the full completion report here) -->

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

**The fix is contained but app-wide in effect:** scale the line height with `PixelRatio.getFontScale()` in `Text.tsx`, or express leading as a multiplier of `fontSize` rather than an absolute. Either changes the rendered look of every screen, which is why I have not taken it unilaterally. **Recommend it as its own small package before WP9**, since three packages have now claimed an XXXL check against a design system that cannot pass one.

#### The cap screen — WP5a's open question, answered

Reached honestly, by completing five Leaves on the device until the session hit 500 XP (637 seconds elapsed, so **XP was the binding constraint**, which is the calibration WP5a intended). `cap_reached_at` is set in `daily_session`.

**It reads as an ending, not a refusal**, and one thing does more work than the copy: `daily-cap` — "Enough for Today · Reach the daily limit — and stop" — unlocks *on the same screen*, above the notice. So the moment a reader is told they are finished, they are also congratulated for it. That is §2 of the achievements proposal doing exactly what it argued for: an app that treats hitting the cap as a failure state teaches readers to resent it, and this one hands them a badge instead.

The order on screen is XP → three unlocks → "That is today done" → Done. The notice sits last, so the session closes on the sentence about coming back tomorrow rather than on a reward. No warning tone, no "limit", no lock iconography — the word "limit" appears only inside the achievement's own description, where it is being celebrated.

**Recommend the founder look at one screenshot of this before WP9** rather than take my reading of it; tone is the one thing a Manager should not sign off alone.

#### The Reduce Motion caveat

Reduce Motion was enabled at the OS level and the payoff unlock was earned again on a fresh Leaf. The unlock renders correctly: the amber "UNLOCKED" label, the open padlock and the payoff panel are all present, so **the accommodation does not remove the feedback** — which is the rule §6 actually states. What a still screenshot cannot prove is that the transition *faded* rather than *sprang*; that claim rests on reading `PayoffSlide`'s reduced-motion branch, which swaps `withSpring` on scale for `withTiming` on opacity. Recorded as verified-by-inspection for the transition itself and verified-by-execution for the end state.

#### Environment facts the next session will need

- The founder's local Postgres runs in container `zoomout-postgres`; `zoomout` is the backend's database and `zoomout_cms` is Payload's. They are **not** interchangeable and the backend pointing at the wrong one is what cost WP5a and most of WP5b's verification time.
- **`zoomout_cms` still holds seven empty backend tables and the `drizzle` schema** from the mistaken migrate runs, plus three orphan enum types. Dropping them needs founder approval; the CMS boots with them present but **migration `0005` cannot run against that database** while `reader_event_type` survives, because its first statement creates that type.
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
