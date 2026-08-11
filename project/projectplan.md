# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

> **Current state (2026-08-09):** WP4 signed off 12/12 and merged. **WP6 is the active package** — handoff in `collaboration-log.md`, dated 2026-08-09. WP5 is also unblocked (achievement list written) and runs after WP6.

## Feature
**WP6 — Mobile shell: design system, navigation, auth, age gate** — handed off 2026-08-09.

Design input: `project/proposals/design-direction.md`, approved 2026-08-08. Achievement list for WP5: `project/proposals/achievements.md`.

## Previous
**WP4 — Learning loop API: answer, unlock, complete, award XP** — ✅ signed off 12/12, reviewed by `code-reviewer`, merged.

Sixth package of the approved Phase 1 milestone. Full milestone plan: `project/proposals/phase-1-implementation-plan.md`.

Previous: WP0 ✅ · WP1 ✅ · WP2 ✅ · schema-freeze gate ✅ · WP2.1 ✅ · WP3 ✅ (11/11, signed off 2026-08-08).

## Status
**`Handed off`** (2026-08-08)

## Problem
Everything built so far is scaffolding around one mechanic: a reader answers a scenario, and the payoff unlocks only when they get it right. That mechanic does not exist yet. WP4 is where the product's thesis — active recall beats passive summary — becomes something the server actually enforces.

## Proposed approach
Grading is server-side. The client submits a scenario option id and is told the result; it never receives or submits the answer key. Grading needs `isCorrect`, so it fetches the full `Leaf` through `ContentRepository.findLeaf` — the single deliberate exception to routing content reads through `ContentService`, commented as such at the call site.

`LeafProgress` per (reader, Leaf) tracks attempts, first-try correctness, completion and XP. Wrong answers retry without limit; the payoff stays locked until correct. Completion is idempotent, because replaying it is the obvious way to farm XP.

## Alternatives considered
Grading on the client with server verification afterwards — lower latency and simpler offline story, but it means shipping the answer key, which makes the unlock gate decorative and the product thesis with it. Never seriously on the table; recorded because it is the obvious shortcut someone will suggest later.

## Architectural impact
Adds the progress domain and the first table whose rows represent user achievement rather than user identity. Establishes how XP is calculated and awarded, which WP5's session cap and streaks then constrain.

## Risks
- **XP double-award on replay** — the exploit a client triggers by retrying a failed request. Covered by an explicit acceptance criterion.
- **Payoff leaking before a correct answer**, via some route other than the obvious one. Tested rather than assumed.
- **Local-date drift** — WP4 does not build `DailySession` or `Streak`, but any date it persists that WP5 will group by day must use `localDateIn()` rather than leaving WP5 a UTC timestamp to reinterpret.

## Open questions
None.

## Next after this
**WP6 — mobile shell.** Unblocked: design direction approved 2026-08-08, Xcode installed, simulator check closed in WP2.1. WP5 needs the achievement list first, which is still outstanding from the founder.

## Handoff prompt
See `project/collaboration-log.md` — Handoffs, 2026-08-08 (WP4).
