# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Feature
**WP3 — Content API: ContentRepository, Explore, Library, Leaf delivery**

Fifth package of the approved Phase 1 milestone. Full milestone plan: `project/proposals/phase-1-implementation-plan.md`.

Previous: WP0 ✅ (10/10) · WP1 ✅ (14/14) · WP2 ✅ (11/11) · **schema-freeze gate ✅** · WP2.1 ✅ (12/12).

## Status
**`Released`** (2026-08-08) — handoff live in `collaboration-log.md` with four amendments from WP2.1.

## Problem
WP1 put content in Payload and WP2 put readers behind auth, but nothing connects them — the mobile app has no way to see a Track or a Leaf. WP3 is that bridge, and it is where two guarantees stop being intentions and start being enforced: the answer key never reaching a client, and placeholder content never reaching production.

## Proposed approach
`ContentRepository` calls Payload's REST API over HTTP — never its Postgres tables. Payload's read access already returns published-only to anonymous callers, so the backend receives published content by construction. Mapped documents are validated against `leafSchema` / `trackSchema` before being served, which is the second gate finally doing work at runtime.

`isProductionPublishable` gets wired to the read path, and `toPublicLeaf` becomes the only route by which a Leaf reaches a client.

## Prerequisite — founder, ~2 minutes
**The Track and Leaf authored at the gate no longer satisfy the frozen schema.** They are still published and serving, because the new CMS rules are publish-gated — but the Track has `publisher: null` and `coverUrl: null`, and the Leaf's source reference has no locator. `trackSchema` and `leafSourceReferenceSchema` both reject them, so WP3's mapper hits this on its first real document.

Fix in the admin UI: add a publisher and cover URL to the Track, add a chapter/page/quote to the Leaf's source reference, and re-save both. Re-saving also clears the trailing whitespace still sitting on `"concept 1 "`. No migration — it is placeholder content and there is one of each.

## Architectural impact
Establishes the CMS boundary and the caching/takedown-latency relationship. Adds the library table. Every content-reading feature after this — WP4, WP7, WP8 — consumes these endpoints.

## Risks
- **Mapper drift** — Payload marks nearly every field optional and nullable, so the domain model is strictly stronger. The mapper is the only place a published document is proven to satisfy it; a weak mapper silently moves that guarantee nowhere.
- **Cache TTL is takedown latency.** Bounded, config-driven, documented at the call site.
- **Testcontainers flakiness** (WP2.1 finding) may produce a red CI run that is green on re-run.

## Open questions
None.

## Next after this
**WP4 — learning loop API.** Then WP6 (mobile shell), now unblocked: design direction approved 2026-08-08, Xcode installed.

## Handoff prompt
See `project/collaboration-log.md` — Handoffs, 2026-08-07 (WP3), released 2026-08-08 with amendments.
