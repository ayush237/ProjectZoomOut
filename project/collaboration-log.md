# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

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
