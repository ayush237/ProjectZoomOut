# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Feature
**WP5b — Environment fix, achievements, total XP**

✅ **Signed off 2026-08-12, 9 of 9.** Part A resolved and verified by query. Branch `wp5b-achievements-xp` — six commits, **not yet pushed**.

Goal for the milestone: **an end-to-end working app** — every Phase 1 feature working against seeded content on a device. Remaining after WP5b: the device gate, WP9, WP10. Launch blockers are parked in `launch-blockers.md`.

## Status
**`Signed off`** (2026-08-12)

## Part A — resolved

Was: `apps/backend/.env` named `zoomout_cms`, so the backend talked to Payload's database and `daily_session`/`streak` never existed where the real readers live. Now fixed and verified **by query, not exit code** — `zoomout` holds all nine tables and records migrations 0000–0005 with six readers intact; `zoomout_cms` is cleared of backend tables, the drizzle schema and enum types, with Payload's 20 tables and all 28 Tracks / 22 Leaves untouched.

Payload's `there is no parameter $1` boot failure is explained: it was our tables in their database, not an upstream drizzle-kit bug.

## Original diagnosis
`apps/backend/.env`'s `DATABASE_URL` points at **`zoomout_cms`**, Payload's database, not `zoomout`.

- `zoomout` holds the real readers — 6 users, 10 `leaf_progress`, 5 `user_tracks` — and only migrations 0000–0003.
- `zoomout_cms` holds Payload's content plus an empty duplicate of the backend's tables.
- So `daily_session` and `streak` never existed in the database holding real data. **That, not the missing `--env-file`, is why WP5a's device check failed.**
- `db:migrate` then reported success while writing 0004 and 0005 into Payload's database, and `apps/admin` now fails to boot at Payload's schema-pull.

Part A fixed how the env file is *loaded* and never checked where it *points* — the exact failure the acceptance commit for that same package had just generalised. Third instance of the shape, which is why it is now an acceptance criterion rather than a written rule.

## Reopened Part A — acceptance criteria, phrased as observable state
- [ ] `zoomout` contains `daily_session` and `streak`, and records migrations 0000–0005
- [ ] `zoomout_cms` contains **no** backend tables and no drizzle migration bookkeeping
- [ ] `apps/backend` boots and `GET /progress/today` returns 200
- [ ] `apps/admin` boots and serves the seeded content
- [ ] Both databases backed up before any destructive step

Not "the command ran". The state, checked.

## Accepted in Parts B and C
Nineteen achievements as a code registry with slug identity; idempotent awarding proven at the repository level; total XP derived on read; `POST /events` carrying `dinner_table_open` and `session_wrap`; `ReaderStanding` and `unlocked` added to `delivery.ts`; `DayStatus` deduplicated into shared.

## Open questions
None. Three rulings closed 2026-08-12 — `first-wrap` keeps its event, the `gamification.ts` rewrite including its removals, and the additive `delivery.ts` changes.

## Next
**WP9 — shareable session wrap-up and achievement screens.** The device gate is closed: seven items verified, including that the cap screen reads as an ending rather than a refusal — `daily-cap` unlocks *above* the notice, so the reader is congratulated for stopping in the same breath they are told they are finished.

Then **WP10**, and the app is complete end to end.

## Handoff prompt
See `project/collaboration-log.md` — Handoffs, 2026-08-12 (WP5b).
