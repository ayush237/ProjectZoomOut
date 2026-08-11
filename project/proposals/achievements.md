# Achievements — Phase 1

**Status:** Proposed — Architect-authored at the founder's request, 2026-08-09
**Consumed by:** WP5 (gamification: session cap, streaks, achievements)

Nineteen achievements across six categories. Revisable later; the point of settling it now is that WP5 is blocked without it.

---

## 1. Design rules these follow

**Reward engagement quality, not volume.** ZoomOut is positioned against apps that maximise time-on-device, and the 15-minute cap is a deliberate constraint. So nothing here rewards speed, bingeing, or beating the cap — one achievement explicitly celebrates *stopping*.

**The accuracy category carries the product thesis.** Active recall is the differentiator, so first-try correctness gets its own progression rather than being folded into generic progress.

**Persistence is rewarded alongside accuracy.** PRODUCT.md is explicit that the stakes are XP, not access — wrong answers retry without limit. An achievement for getting there after several wrong attempts keeps struggling from feeling purely penalised.

**Every unlock condition must be computable server-side from data that exists.** One exception is called out in §4.

---

## 2. The list

Tier drives visual weight on the unlock screen: `common` · `rare` · `milestone`.

### Onboarding

| id | Name | Unlocks when | Tier |
|---|---|---|---|
| `first-leaf` | First Light | You complete your first Leaf | common |
| `first-book` | Shelf Space | You add your first book to your Library | common |
| `first-try-first` | Straight Through | You answer a scenario correctly on the first try, for the first time | common |

### Streaks

| id | Name | Unlocks when | Tier |
|---|---|---|---|
| `streak-3` | Three in a Row | 3-day streak | common |
| `streak-7` | Full Week | 7-day streak | rare |
| `streak-14` | Fortnight | 14-day streak | rare |
| `streak-30` | Month of Mornings | 30-day streak | milestone |

### Accuracy — the thesis

| id | Name | Unlocks when | Tier |
|---|---|---|---|
| `sharp-5` | Sharp | 5 consecutive first-try correct answers | common |
| `sharp-10` | Locked In | 10 consecutive first-try correct answers | rare |
| `perfect-track` | Flawless | Every Leaf in a Track answered first-try | milestone |

### Persistence

| id | Name | Unlocks when | Tier |
|---|---|---|---|
| `comeback` | Second Look | You complete a Leaf after three or more wrong attempts | common |
| `comeback-10` | Stubborn | Ten Leaves completed after at least one wrong answer | rare |

### Progress

| id | Name | Unlocks when | Tier |
|---|---|---|---|
| `leaves-5` | Getting Somewhere | 5 Leaves completed | common |
| `leaves-10` | Ten Deep | 10 Leaves completed | common |
| `leaves-20` | Twenty | 20 Leaves completed | rare |
| `track-complete` | Full Circle | Every Leaf in a Track completed | milestone |

### Session — celebrating the constraint

| id | Name | Unlocks when | Tier |
|---|---|---|---|
| `first-wrap` | Called It a Day | You use "Wrap up today's session" for the first time | common |
| `daily-cap` | Enough for Today | You reach the daily limit | rare |

`daily-cap` is deliberate. The cap is a wellbeing feature, and an app that treats hitting it as a failure state teaches users to resent it.

### Curiosity

| id | Name | Unlocks when | Tier |
|---|---|---|---|
| `dinner-party` | Dinner Party | You open your first Dinner Table Knowledge fact | common |

---

## 3. Reachability at launch — read this before building

**With one book of ~20 Leaves, four of these are unreachable.** Not a reason to cut them; a reason to know which ones will sit locked, and to stop anyone treating an unearned achievement as a bug.

| Achievement | Needs | Reachable with one 20-Leaf Track? |
|---|---|---|
| `streak-30` | ≥30 Leaves — one per day for 30 days | **No** |
| `leaves-20` | exactly 20 | Only by completing every Leaf |
| `sharp-10` | 10 consecutive first-try | Yes |
| `perfect-track` | 20 consecutive first-try | Yes, but demanding |
| `comeback-10` | 10 imperfect Leaves | Yes — but mutually exclusive with `perfect-track` |

`streak-14` is reachable only if the reader paces at roughly one Leaf per day; a reader working at the intended five per day exhausts the library in four.

**Ship all nineteen anyway.** A visible locked achievement is a reason to come back when the library grows. The alternative — adding them later — means readers who already qualified never get retroactively awarded unless WP5 backfills, which is more work than showing a locked tile.

## 4. What WP5 needs to build

**A registry, not branches.** Achievements are data — id, name, description, tier, and a predicate — evaluated by a single engine. Adding one later should be a row plus a predicate, not a new branch in a service.

**Evaluation points.** On Leaf completion, on answer submission, on library add, on session wrap-up, on cap reached, and on Dinner Table Knowledge open.

**Awarding is idempotent.** Unique on `(user_id, achievement_id)`. WP4 showed why this matters: replaying a request is the ordinary failure mode, not an exotic one.

**Unlocks return in the response of the action that triggered them**, so the client can animate immediately rather than polling.

**One new piece of instrumentation:** `dinner-party` needs a Dinner Table Knowledge open to be recorded — nothing tracks it today. A small authenticated event endpoint. Worth the cost: it's the only signal we'd have that the deep-cut content is being read at all, which is otherwise invisible.

**Consecutive-first-try counting** is derivable from `leaf_progress` ordered by `completed_at`, but a maintained counter is simpler and cheaper. Either is acceptable; the reset rule is what matters — a non-first-try completion resets it to zero.

## 5. Explicitly not included

- Anything rewarding **speed** — racing through Leaves defeats retention, which is the product's whole claim.
- Anything requiring **more than one session per day** — the cap makes it impossible, and defining it would teach readers to resent the cap.
- Anything requiring **multiple books** until the library supports it.
- **Social or comparative** achievements — Phase 3.
