# Launch Blockers — parked until the app works end to end

**Purpose:** everything that stands between a *working app* and a *shippable product*, kept out of `projectRoadmap.md` so it stops competing for attention with the build.

**Nothing in this file blocks the current work.** Split out 2026-08-12 at the founder's direction: finish the end-to-end app first, then work this list.

**Definition in use:** an *end-to-end working app* means every Phase 1 feature works against seeded content on a device. That is **WP5b → WP9 → WP10**. Everything below is after that.

---

## 1. Engineering

| Item | Why it blocks launch | Owner |
|---|---|---|
| **WP12 — deployment** | Backend, CMS and Postgres on GCP with a device-reachable API. Nothing is deployed; the DB is a local container. The simulator reaches `localhost`, a real phone cannot | Manager |
| **Payload must not be publicly reachable** | Payload's REST API serves `payoff` and `isCorrect` anonymously by design — that is how the backend reads published-only content. If it is reachable from the internet, **the payoff gate and the answer key are both bypassable.** "Private networking" currently exists as a comment in one file and nowhere else. **The single highest-consequence item in this file** | WP12 |
| **`create-admin` must not be invocable from the deployed app** | It is a privilege-escalation path. Operator command, run out-of-band — never a route or a startup hook | WP12 |
| **WP13 — password reset** | Email/password is the only sign-in method, so a forgotten password means a permanently lost account, streak and library. Needs a transactional email provider | Manager |
| **WP14 — test hardening** | Everything deferred as Tier C during the velocity phase, plus each package's deferral list | Manager |
| **Rate limit on answer submission** | Unbounded authenticated write path. `attempt_count` is an unbounded `integer`, so sustained abuse eventually overflows into a permanent 500 on that Leaf | Manager |
| **A real session-activity signal** | Session time is currently elapsed-time-per-Leaf clamped to five minutes. Under-counts a slow reader, erring toward letting them continue — acceptable, but an approximation | Manager |
| **N+1 progress rollup** | One Track fetch and one Leaf list per library entry. Fine at a few books; thirty is thirty requests per Library open. Ruled approach: batch with `where[id][in]`, cache the ordered Leaf-id list on a longer TTL | Manager |
| **Push notifications** | Not scoped anywhere. A streak mechanic without reminders is much weaker — a reader who forgets loses it with no prompt | Unscoped |
| **Extra-large text clips, app-wide** | `design/typography.ts` sets an absolute `lineHeight`; React Native scales `fontSize` but not `lineHeight`, so glyphs are cut by their own line box at the top accessibility steps. Pre-existing in WP6's design system. **The honest framing is "XXXL renders broken", not "XXXL unsupported"** — the app still honours the OS setting and then clips, which is the worse of the two states to ship, because a reader who needs large text gets a broken screen rather than a plain one. Founder ruled 2026-08-12 not to fix it now and to drop it as a per-package check; that ruling is about *sequencing*, and it does not make the defect go away. Likely a one-line fix (relative line heights or `allowFontScaling` strategy), but app-wide to verify | Manager |

## 2. Content

| Item | Why it blocks launch | Owner |
|---|---|---|
| **Real content** | Everything is placeholder. Launch content comes from the **AI pipeline**, which is deliberately deferred until all app and admin work is done and needs its own planning cycle | Founder → Architect |
| **Replace all placeholder content** | `isPlaceholder` records are blocked from production in code, so this is enforced mechanically — but the replacement work is real | Founder |
| **Unpublish "The mountain is you"** | Carries placeholder prose under a real author's name and fails the cover rule. One minute in the admin UI | Founder |
| **Streaks are structurally capped by library size** | A streak needs one Leaf per day; twenty Leaves supports at most twenty days, and a reader at the intended pace exhausts the library in four. **The streak breaks for exactly the readers who engage most.** Options: let re-completion count, ship more books, or accept streaks only matter as the library grows | Founder decision |

## 3. Legal and compliance

All from `LEGAL.md`, all still without an assigned owner.

| Item | Why it blocks launch |
|---|---|
| **Age-gate threshold** | Implemented as configurable with a default of 13, so the code is not blocked — but the legal answer is undecided and COPPA/GDPR-K compliance depends on it |
| **Content Curation Policy** | The criteria excluding authors with official companion apps and publishers in active AI litigation. Owner TBD since the original brief |
| **Vendor DPAs** | Gemini/Vertex and ElevenLabs, once the pipeline exists |
| **IP counsel review of generated content** | Higher stakes now that launch content is AI-generated rather than hand-written. `LEGAL.md` requires review of *actual output*, not just the strategy document |
| **IP counsel review of the launch book list** | Required before launch |
| **Content moderation** | Required before Reading Circles (Phase 3), not after |
| **Subscription compliance** | FTC negative-option rules. Moot until Phase 4 monetization |

## 4. App Store

| Item | Note |
|---|---|
| **Sign in with Apple** | Currently **not required** — the requirement only applies when another third-party social login is offered, and Phase 1 ships email/password only. It returns the moment Google sign-in ships |
| **Privacy nutrition labels, age rating, review submission** | Not yet started |

---

## How this list is worked

After WP10 closes, this becomes the active plan and gets sequenced properly. Until then it is a parking lot — new launch-only items get appended here rather than into the roadmap's debt register.

The three genuinely urgent ones, when the time comes: **Payload's public reachability** (a security hole, not a task), **password reset** (a support catastrophe waiting), and the **content pipeline** (the longest lead time by far, and it hasn't been designed yet).
