# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Feature
**WP2 — Backend foundation: auth, age gate, profile**

Third work package of the approved Phase 1 milestone. Full milestone plan: `project/proposals/phase-1-implementation-plan.md`.

Previous packages: **WP0 signed off 2026-08-06** (10/10). **WP1 signed off 2026-08-07** (14/14).

## Status
`Approved — awaiting handoff` → **`Handed off`** (2026-08-07)

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
