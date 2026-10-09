# Status board — LEDGER-1 and LEDGER-1.1, closed 2026-10-09

**Moved out of `project/projectRoadmap.md`'s status board on 2026-10-09**, at GUARD-1's sign-off, with no session mid-package and every PR merged. GUARD-1's own row stays on the board until the founder's device gate has passed.

Legend: ✅ done · 🔵 in progress · ⬜ not started · 🔒 blocked

| # | Delivers | Owner | Status | Waiting on |
|---|---|---|---|---|
| LEDGER-1 | A per-run Postgres advisory lock on the cost ledger (a second spender is refused, a killed one never leaves it held); the VO-4.1 review leftovers; the `clip_key` pin | Pipeline Manager (`ZO-pipeline`) | ✅ **Signed off 2026-10-04** — PR #66 (`abee4bb`), 11/11 (L6 with one named exclusion), verified by me live | Nothing |
| LEDGER-1.1 | `run` refuses a run id already in use (a second `run` on one thread **rewrites 15 of 37 fields of its checkpoint, the cost ledger and `approved` among them**); six test closures: the lock's `pid` filter and key, the review guard past Leaf 9, the structural pins, the hermetic fixture | Pipeline Manager (`ZO-pipeline`) | ✅ **Signed off 2026-10-05** — PR #67 (`4a29d3f`), 12/12, verified by me; one correction to my handoff | Nothing |
