# Phase 1 — Implementation Plan

**Status:** Proposed — awaiting founder approval
**Author:** Architect
**Date:** 2026-08-06

Phase 1 is a milestone, not a single feature. This document is the plan for the whole milestone; each work package below becomes the active `project/projectplan.md` in turn, and each gets its own handoff prompt to Manager. Nothing here is handed off until approved.

---

## 1. Problem statement

ZoomOut has a complete product specification and zero code. Phase 1 must produce a launchable app that proves the core thesis — **active recall beats passive summary** — with one book, one solo builder, and no AI pipeline.

"Done" for Phase 1 means a real user can: sign up, find *The Mountain Is You* in Explore, add it to their Library, work through its Leaves one at a time, earn XP and a streak, hit the daily cap gracefully, share a session wrap-up screen, and report an error on any Leaf. All content is hand-authored through a CMS. No monetization, no AI generation, no social features.

## 2. Scope

**In scope**
- Monorepo, shared types, Postgres, migrations, CI
- Headless CMS for authoring Tracks and Leaves, with legal-required fields enforced
- Backend: auth, profile, content delivery, learning loop, XP, streaks, achievements, server-authoritative session cap
- Mobile: all four surfaces (Profile, Explore, Library, Journey), the 5-slide Leaf player, SFX, shareable screens
- Legal layer: non-endorsement disclaimer, purchase-forward link, per-claim source references, report-an-error → fix queue, instant takedown, age gate
- **Seeded placeholder content** — one full-length mock Track (~20 Leaves) so every surface renders against realistic data volume

**Deferred out of Phase 1 (2026-08-06):** authoring the real *The Mountain Is You* content. The app is built and verified against placeholder text; real writing happens afterwards, against a frozen schema. This removes 10–15 hours of solo writing from the critical path and lets the entire structure be exercised end to end without it.

**Out of scope (explicitly)**
- Real authored content (see above) — placeholder only in Phase 1
- Voiceover / audio (Phase 2) — schema reserves the field only
- AI content pipeline (Phase 2)
- Reading Circles / social (Phase 3)
- Monetization, billing, IAP (Phase 4)
- Offline support, guest mode, streak freezes
- Android polish (build it, don't perfect it)

## 3. Architecture

### 3.1 Repository layout

```
apps/
  mobile/     Expo + React Native + TypeScript
  backend/    Node.js + TypeScript API (handler → service → repository)
  admin/      Self-hosted headless CMS
packages/
  shared/     TypeScript types + validation schemas, consumed by all three
```

Single Postgres instance. The CMS owns the content tables; the backend owns user, progress, and gamification tables.

### 3.2 The CMS ↔ backend boundary — the key decision

The backend **reads** content, never writes it. All content reads go through a `ContentRepository` in the backend that maps CMS responses into the shared `Track`/`Leaf` types. Mobile never talks to the CMS directly — everything flows through the backend API so auth, caching, and progress stay in one place.

**CMS: Payload 3.x** (decided 2026-08-06 — see §3.2.1). `ContentRepository` calls **Payload's REST API over private networking, not its Postgres tables.** Payload flattens `group` fields into `summary_body`-style columns and arrays into join tables like `leaves_scenario_options`, with versions in `_leaves_v` — an undocumented internal Drizzle schema. Reading it directly would also bypass draft/publish resolution, which would silently break takedown. The repository abstraction stands; what sits behind it is the API.

Publish-to-snapshot (webhook materializes an immutable versioned copy into our own tables on publish) remains the stronger long-term design for audit trail and CMS independence, but is meaningful extra machinery for one author and one book. Revisit when the Phase 2 pipeline starts writing content automatically.

Takedown: unpublishing sets `_status: 'draft'`, and a read access-control constraint of `{_status: {equals: 'published'}}` drops the Track from every response immediately.

### 3.2.1 Why Payload over Directus

Settled by the `researcher` subagent, 2026-08-06:

1. **Directus structurally cannot model the Leaf as specified.** In Directus, fields are database columns and field groups are presentational only — they do not nest data. The five slides would become five related collections with drawer-in-drawer authoring, or untyped JSON. Payload's `group` field produces a real nested object in the database, the API, and the generated TypeScript interface; `array` supports `minRows`/`maxRows`, making "exactly 3 options" schema rather than a runtime check. Our top criterion, lost by design.
2. **Directus v12 (May 2026) relicensed BUSL-1.1 → MSCL with enforced registration keys.** Granular RBAC sits in a $499/mo tier, turning the deferred approval workflow into a purchase rather than a config change. An unlicensed v12 instance blocks the API after a 30-day grace period — unacceptable coupling for an hours-to-takedown legal obligation. Payload is MIT with RBAC in core.
3. **Validation lives in reviewable, testable TypeScript.** Payload field `validate` and `beforeChange` hooks can throw to block a save, gated on `_status === 'published'`. Directus equivalents are GUI-configured Flows stored in the CMS database — not in git, not unit-testable, and capped at 5 on the free tier.

Bonus: `payload generate:types` can emit CMS-derived types directly into `packages/shared`.

**Biggest risk — Next.js coupling.** Payload 3 requires Next.js and pins narrow version ranges. Mitigation: deploy `apps/admin` as its own Cloud Run container with its own lockfile, pin Payload and Next exactly, never let Next leak into `apps/backend` or `apps/mobile`, and stay on 3.x until 4.x settles.

**What would reverse this:** the backend ever needing to *write* content, or wanting the Postgres schema itself to be the swap-proof contract.

### 3.3 Modelling the Leaf

The 5-slide structure is fixed, so it is modelled as **five explicitly typed fields, not a generic slide array**. A `slides: Slide[]` array would push "exactly five slides, in this order, of these five kinds" into runtime validation. Explicit fields make it a compile-time guarantee, which is the whole point of TypeScript strict mode.

```
Track     id, bookTitle, author, publisher, coverUrl, description,
          disclaimer, purchaseLinks[], status, leafCount
Leaf      id, trackId, orderIndex, title, status,
          summary     { body }
          scenario    { prompt, options[3] — exactly one isCorrect }
          payoff      { body }
          stickyNotes { notes[] }
          takeaway    { body, dinnerTableKnowledge? }
          audioRefs?  — reserved for Phase 2, unused in Phase 1
SourceReference   leafId, slideKey, chapter?, page?, quote?, note
```

Every factual claim carries a `SourceReference`. Dinner Table Knowledge cannot be saved without one — enforced in the CMS, not left to author discipline.

**Leaf pacing (decided 2026-08-06):** a Leaf is ~3 minutes to consume, so a capped session is about 5 Leaves and a 20-Leaf Track runs ~4 days. This is what keeps the 500 XP cap a meaningful second constraint rather than dead weight behind the 15-minute limit, and it sets the length budget for slide copy.

### 3.4 Placeholder content — mandatory guardrails

Phase 1 ships with mock text. That creates a specific hazard the legal strategy already names: **placeholder text that reads as a real claim attributed to a real author is exactly the fabrication risk that damaged Bookey.** Requirements, not suggestions:

- Mock copy must be **obviously placeholder** — never plausible-sounding invented claims, quotes, or advice attributed to Brianna Wiest or any real author
- Every mock Track and Leaf carries an `isPlaceholder` flag on the record itself
- Content flagged `isPlaceholder` **cannot be published to production** — enforced in code, not by memory
- Replacing all placeholder content is an explicit pre-launch gate

The cheapest failure mode here is shipping a demo build to a few real users with fabricated advice under a real author's name. The flag exists to make that impossible rather than unlikely.

### 3.5 User and progress model

```
User            id, email, authProviders[], displayName, dateOfBirth,
                timezone, createdAt
UserTrack       userId, trackId, addedAt, status          (the Library)
LeafProgress    userId, leafId, attemptCount, firstTryCorrect,
                completedAt, xpAwarded
DailySession    userId, localDate, secondsActive, xpEarned, capReachedAt
Streak          userId, current, longest, lastActiveLocalDate
Achievement / UserAchievement
ErrorReport     userId, leafId, reason, status, createdAt, resolvedAt
```

`DailySession` is keyed on the user's **local** date, not UTC. This is the single most common source of streak and cap bugs and needs deliberate test coverage.

### 3.6 Server authority

XP awards, cap enforcement, streak evaluation, and answer correctness are all decided **server-side**. The client submits an answer and is told the result; it never computes XP or decides whether the cap is reached. The `isCorrect` flag is never shipped to the client with the scenario options — otherwise the unlock gate is trivially bypassed and the entire active-recall mechanic is decorative.

## 4. Work packages and sequencing

| # | Package | Depends on | Notes |
|---|---|---|---|
| **WP0** | Monorepo scaffolding — workspaces, TS strict, `packages/shared`, Postgres, migrations, CI | — | Small and boring on purpose |
| **WP1** | CMS setup — Track/Leaf schema, validation rules, publish states, source-reference enforcement | WP0 | |
| **GATE** | **Draft one structurally complete Leaf in the CMS, then freeze the schema** | WP1 | ~45 min of founder time, placeholder prose. See §5 |
| **WP2** | Backend foundation — auth (email/Apple/Google), age gate, profile, error handling, structured logging | WP0 | |
| **WP3** | Content API — Explore, Library, Track/Leaf delivery | WP1, GATE | |
| **WP4** | Learning loop API — start Leaf, submit answer, unlock payoff, complete Leaf, award XP | WP2, WP3 | |
| **WP5** | Session cap, streaks, achievements — all server-authoritative | WP4 | Timezone tests mandatory |
| **WP6** | Mobile shell — navigation, auth screens, age gate, design system foundations | WP2 | Blocked on §7 design direction |
| **WP7** | Mobile surfaces — Explore, Library, Journey, Profile | WP3, WP6 | |
| **WP8** | Mobile Leaf player — 5 slides, unlock gate, SFX | WP4, WP6 | The product's core; deserves the most polish |
| **WP9** | Shareable session wrap-up + achievement screens | WP5, WP8 | Growth mechanic, not decoration |
| **WP10** | Report-an-error flow, fix queue, takedown/unpublish path | WP3 | Legal requirement |
| **WP11** | Seed fixture — one full-length placeholder Track (~20 Leaves) | GATE | Generated, not written. Gives every surface realistic data volume |

**Deferred past Phase 1:** authoring the real *The Mountain Is You* Track (~20 Leaves, 10–15 hours of founder writing). Runs against a frozen schema once the app is built, and is a pre-launch gate rather than a build dependency.

Critical path: **WP0 → WP1 → GATE → WP2–WP5 → WP6–WP9**. With content removed from the path, the long pole is now WP8 (the Leaf player) rather than writing.

## 5. The schema-freeze gate

Between WP1 and everything downstream, **the founder fills in one structurally complete Leaf** in the CMS — every field populated, placeholder prose throughout. No research, no sourcing, no polish. Roughly 45 minutes.

Deferring the real writing removes the *content* risk but not the *schema* risk. Moving through the actual editor once — three options where exactly one is marked correct, sticky notes, a Dinner Table fact and its source reference — surfaces fields the spec didn't anticipate and fields it specified that turn out useless. Discovering that after the backend and the mobile player are built means a migration plus rework in three places.

This is the cheap version of the gate: it costs an afternoon instead of ten hours, and still catches the expensive class of mistake. Downstream work does not start until one Leaf exists and the schema is signed off.

## 6. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Placeholder content escapes to real users** — fabricated-sounding advice under a real author's name is the Bookey failure in miniature | High | `isPlaceholder` flag on every mock record; publishing flagged content to production blocked in code; obviously-placeholder prose only (§3.4) |
| **Solo authoring, deferred not eliminated** — ~10–15 hours of writing still stands between a working app and a launchable one | High | Off the build critical path as of 2026-08-06; tracked as an explicit pre-launch gate so it cannot be quietly forgotten |
| **Critic-in-the-Loop is one person self-reviewing** — the entire fact-checking layer the legal posture rests on | High | CMS enforces a publish checklist: every claim sourced, exactly one correct option, all five slides present, disclaimer and purchase link set |
| **CMS lock-in** — content model owned by a third-party framework | Medium | `ContentRepository` abstraction in the backend; shared types are ours, not the CMS's |
| **Timezone bugs in cap and streak logic** | Medium | Local-date keying decided up front; explicit test matrix across timezones and DST |
| **Age-gate threshold still legally undecided** | Medium | Implement DOB collection with a **configurable** threshold (default 13+); the legal decision becomes a config change, not a code change, and stops blocking WP2 |
| **One book makes Explore look empty** | Low | "Coming soon" cards for future titles; doubles as demand signal |

## 7. Open questions

1. ~~Payload vs Directus~~ — **resolved 2026-08-06: Payload 3.x.** See §3.2.1.
2. **Visual design direction** — nothing in any project document defines ZoomOut's look. The product sells polish and its growth loop depends on screens people *want* to screenshot. This blocks WP6 and needs founder input before mobile work starts.
3. **Achievement list** — which badges, unlocked by what? Not specified anywhere. Needed for WP5.
4. **SFX assets** — sourcing and licensing. Needed for WP8.
5. **Target Leaf count** for *The Mountain Is You* — spec says 15–30. Recommend ~20 as a first target.
6. **Age-gate threshold** — legal owner still TBD. Not blocking under the mitigation above, but a pre-launch blocker.

## 8. Alternatives considered

**Build the mobile app first against mocked content.** Faster-feeling early progress and a demo sooner, but it lets the app's assumptions define the content schema instead of the other way around — exactly backwards when the schema carries legal requirements. Rejected.

**Skip the CMS, seed content from files.** Cheapest possible WP1, and defensible at one book. Rejected because the moment book two arrives it becomes the wrong answer, and migrating authored content between systems is worse than picking correctly now.

**Publish-to-snapshot content pipeline from day one.** Architecturally stronger and better for the legal audit trail, but significant machinery for one author and one book. Deferred to Phase 2, with the repository abstraction preserving the option.
