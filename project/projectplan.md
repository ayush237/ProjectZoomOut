# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Feature
**WP1 — Payload 3.x CMS setup (`apps/admin`)**

Second work package of the approved Phase 1 milestone. Full milestone plan: `project/proposals/phase-1-implementation-plan.md`.

Previous package: **WP0 — monorepo scaffolding. Signed off 2026-08-06** (PR #1, 9/10 criteria verified by execution; the Expo simulator check is carried forward as a tracked item gating WP6).

## Status
`Approved — awaiting handoff` → **`Handed off`** (2026-08-06)

## Problem
Phase 1 has no AI pipeline, so every Leaf is hand-authored. There is currently nowhere to author one. Until a CMS exists with the Track and Leaf collections modelled, the schema-freeze gate cannot run, and nothing downstream of it — the content API, the learning loop, the mobile surfaces — can start against a stable content contract.

## Proposed approach
Stand up Payload 3.x as `apps/admin`, modelling the Track and Leaf collections from the PROVISIONAL types in `packages/shared/src/content.ts`. The five slides become Payload `group` fields with exactly the shared field names; scenario options become an array pinned to 3 rows; source references become a nested array **on the Leaf document**.

The product's invariants are enforced at publish time by hooks written as pure, unit-testable functions: exactly one correct option, Dinner Table Knowledge requires a takeaway source reference, all five slides populated, Track carries a disclaimer and at least one purchase link. These duplicate `leafSchema`/`trackSchema` deliberately — see the 2026-08-06 decision on two independent gates.

Payload gets its own database on the shared Postgres instance. The backend does not touch it in this package; `ContentRepository` and the REST integration are WP3.

## Alternatives considered
Directus — lost on modelling (field groups are presentational and don't nest data) and on v12's MSCL relicensing putting RBAC behind a $499/mo tier. Settled by the `researcher` subagent, 2026-08-06; full reasoning in the plan §3.2.1. Payload's `schemaName` for table isolation inside one database — flagged experimental upstream, so a separate database is the lower-risk equivalent.

## Architectural impact
Introduces Next.js to the repository, confined to `apps/admin` and pinned. Adds a second database. Establishes the CMS field names as the de facto content contract, which is why the schema-freeze gate follows immediately.

## Risks
- **Next.js leaking into `apps/backend` or `apps/mobile`** — pinned versions and workspace isolation; root `lint`/`typecheck`/`test`/`build` must still pass.
- **Payload's generated types overwriting the hand-written domain contract** — generated output goes to its own file; `content.ts` stays authored by us.
- **Field-name drift between Payload and `packages/shared`** — the acceptance criteria pin the names explicitly.

## Open questions
None — cleared before handoff.

Still open for *later* packages: visual design direction (blocks WP6), achievement list (blocks WP5).

## Next after this
**The schema-freeze gate** — ~45 minutes of founder time authoring one structurally complete Leaf through the real editor. Nothing downstream starts until the schema is signed off.

## Handoff prompt
See `project/collaboration-log.md` — Handoffs, 2026-08-06 (WP1).
