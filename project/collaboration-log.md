# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

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

### Completed: WP6 — Mobile shell: design system, navigation, auth, age gate — 2026-08-11

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
