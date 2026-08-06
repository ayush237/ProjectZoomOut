# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Feature
**WP0 — Monorepo scaffolding and shared domain types**

First work package of the approved Phase 1 milestone. The full milestone plan lives in `project/proposals/phase-1-implementation-plan.md` (approved 2026-08-06); this file tracks only the package currently in flight.

## Status
`Approved — awaiting handoff` → **`Handed off`** (2026-08-06)

## Problem
ZoomOut has a complete product specification, an approved Phase 1 plan, and zero code. Every downstream work package — CMS, backend, mobile — depends on a monorepo that doesn't exist yet: npm workspaces, TypeScript strict configs, shared domain types, a Postgres connection with migrations, and CI.

There is a second reason to start here. WP0 is deliberately small and low-risk, which makes it the right task to validate that the two-session Architect/Manager workflow actually works before betting a large feature on it.

## Proposed approach
Scaffold the three workspaces defined in the plan (`packages/shared`, `apps/backend`, `apps/mobile` — `apps/admin` waits on the CMS decision), wire Postgres with Drizzle migrations, and prove the whole thing end to end: root-level lint/typecheck/test/build all pass, the backend serves a `/health` endpoint backed by a real database connection, and the Expo app renders a value whose type is imported from `packages/shared`.

`packages/shared` carries the domain types from the plan's §3.3–3.5. Content types (Track, Leaf, slides, SourceReference) are marked **provisional** — they are the reference WP1 models the CMS from, and they are expected to change at the schema-freeze gate.

## Alternatives considered
Scaffolding each app separately and unifying later — avoids upfront monorepo config, but shared types are the whole reason for the structure and retrofitting workspaces after three apps have their own toolchains is worse. Starting with the CMS instead — blocked on the Payload vs Directus research, and the CMS needs somewhere to live anyway.

## Architectural impact
Establishes the entire repository structure, the layering convention (handler → service → repository), the validated-config pattern for environment variables, the migration tool, and the CI pipeline. Everything after this inherits these choices, which is why the package is worth doing carefully despite being small.

**Drizzle for migrations:** it governs *our* tables (users, progress, gamification), not the CMS's — so the pending CMS decision barely constrains the choice. TypeScript-first, strict-mode friendly, no codegen daemon, and it aligns cleanly if the research picks Payload.

## Risks
Low. The realistic failure modes are a Postgres integration test that only passes locally, and strict-mode config that looks enabled but isn't enforced across workspaces. Both are covered by acceptance criteria.

## Open questions
None — cleared before handoff.

The three open items that block *later* packages (Payload vs Directus for WP1, visual design direction for WP6, achievement list for WP5) do not block WP0. Payload vs Directus is with the `researcher` subagent as of 2026-08-06.

## Handoff prompt
See `project/collaboration-log.md` — Handoffs, 2026-08-06.
