# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Feature
**WP2.1 — Schema-freeze alignment and backend gaps**

Fourth package of the approved Phase 1 milestone. Full milestone plan: `project/proposals/phase-1-implementation-plan.md`.

Previous: WP0 ✅ (10/10), WP1 ✅ (14/14), WP2 ✅ (11/11), **schema-freeze gate ✅ closed 2026-08-08**.

## Status
`Approved — awaiting handoff` → **`Handed off`** (2026-08-08)

## Problem
The gate did its job: authoring one real Leaf surfaced four schema defects that no amount of reading the spec would have found. All four are ruled (roadmap decisions log, 2026-08-08) but none are applied. Until they are, `packages/shared` and the CMS disagree about what valid content is — the CMS is weaker, and can emit a Track that `trackSchema` would reject at serve time.

Three small backend gaps from WP2 — no logout endpoint, an overloaded provider error, unbounded refresh-token growth — are folded in because they are small, unblocked, and two of them are hard prerequisites for WP6.

## Why this runs before WP3
WP3 maps CMS documents into the domain types and validates them against `leafSchema` / `trackSchema`. Two rulings change those schemas. Building WP3 first means building against a contract mid-change — the exact churn the gate existed to prevent. WP2.1 is small; the delay to WP3 is short and the alternative is rework.

## Proposed approach
Apply the four rulings in both gates so `packages/shared` and the CMS agree: trim text on save, require a locator alongside every source reference `note`, bound sticky notes at 2–6, and require `publisher` and `coverUrl` to publish. Then drop the PROVISIONAL header from the content types — the schema is frozen.

Backend: expose logout over the existing revocation machinery, split `ProviderEmailMissingError` into two codes, and reap expired refresh tokens.

## Architectural impact
Freezes the content contract. After this, a change to `content.ts` is an Architect ruling rather than an expected revision — which is what lets WP3, WP4 and WP7 build against it with confidence.

## Risks
Low. The one real question is whether the Track and Leaf authored at the gate still validate under the tightened rules; if not, the completion report must state the migration needed. That is an acceptance criterion rather than a risk left to chance.

## Open questions
One, and it does not block: **whether the exactly-one-correct rule should move from save-time to publish-time.** Deferred from WP1 to be decided with real authoring evidence, and the founder has now authored but not yet reported how it felt. Explicitly out of scope for this package; Architect will amend if the ruling lands in time.

## Next after this
**WP3 — Content API.** Written and waiting in `collaboration-log.md`, held on this package, with its amendments already listed.

## Handoff prompt
See `project/collaboration-log.md` — Handoffs, 2026-08-08 (WP2.1).

---

## Previous: WP2 — Backend foundation: auth, age gate, profile — ✅ signed off 2026-08-07 (11/11)

Third work package of the approved Phase 1 milestone. Full milestone plan: `project/proposals/phase-1-implementation-plan.md`.

Previous packages: **WP0 signed off 2026-08-06** (10/10). **WP1 signed off 2026-08-07** (14/14).

## Status
`Handed off` → **`Signed off`** (2026-08-07). Next: WP3, held on the gate.

## Problem
The backend has structure but no users. Nothing can be personalised, no progress can be attributed, and the age gate — a pre-launch legal requirement — has nowhere to live. WP4 (learning loop), WP5 (streaks, session cap) and WP6 (mobile shell) all need an authenticated user before they can start.

## Why now, in parallel with the gate
WP2 depends only on WP0. It does not touch content, the CMS, or the provisional content types, so the schema-freeze gate cannot invalidate it. Handing it off now is what keeps Manager working while the founder authors the first Leaf — otherwise the gate stalls the whole project for its duration.

## Proposed approach
Email/password plus Sign in with Apple and Google, issuing a short-lived access JWT and a rotating refresh token whose hash is stored server-side so sessions are revocable. Social identities are verified against the provider's JWKS on the server — a client-supplied identity claim is never trusted.

Auth providers get their own table rather than a column on `users`, so one reader can hold several identities without a schema change. This also closes the `Omit<User, 'authProviders'>` gap WP0 deliberately left visible in `user.mapper.ts`.

The age gate is enforced server-side at signup against a **configurable** threshold defaulting to 13, so the still-undecided legal answer becomes an environment change rather than a code change.

## Alternatives considered
Session cookies instead of JWTs — simpler to revoke, but a poor fit for a React Native client with no cookie jar and background refresh. A third-party auth provider (Auth0, Clerk, Firebase Auth) — genuinely faster to ship and worth revisiting if auth becomes a time sink, but it adds a vendor, a per-MAU cost before monetization exists, and another DPA to the pre-launch legal list.

## Architectural impact
Adds the auth boundary the whole API will sit behind, the token lifecycle, and two tables (`user_auth_providers`, `refresh_tokens`). Establishes how every later route declares whether it is authenticated. Reserves `email_verified_at` so verification can be added later without a backfill.

## Risks
- **Account-linking ambiguity** — the same email arriving via Google and via password. Ruled: one user per email, link a provider only when the provider asserts the email is verified, otherwise reject with an actionable error.
- **Age-gate retry** — a rejected minor can re-enter a different date of birth. Standard limitation; no account is created, and nothing about the rejected attempt is stored. Noted rather than solved.
- **Token handling on the client** is WP6's problem, but WP2's token lifetimes constrain it.

## Open questions
None — cleared before handoff.

Still open for later packages: visual design direction (blocks WP6), achievement list (blocks WP5).

## In parallel
**The schema-freeze gate is ready now** and is founder-owned. WP3 stays blocked until it closes.

## Handoff prompt
See `project/collaboration-log.md` — Handoffs, 2026-08-07 (WP2).
