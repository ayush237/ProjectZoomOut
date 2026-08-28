# The Road to Launch — sequenced

**Phase 1 closed 2026-08-13.** Every Phase 1 feature is built and works end to end on a device. This file is now the active plan.

Sequenced 2026-08-13. Five stages, ordered by what blocks what and by lead time — not by size.

---

## Part 1 — Product status

### What a reader can do today

| | |
|---|---|
| **Account** | Sign up with email and password, pass the age gate, sign in and out |
| **Explore** | Browse published books, paginated |
| **Library** | Add and remove books, see per-book progress |
| **Journey** | See active books, resume at the next incomplete Leaf |
| **Learn** | Play a Leaf through all five slides: summary, scenario, payoff, sticky notes, takeaway |
| **The gate** | Answer a 3-option scenario; wrong answers retry without limit; the payoff unlocks only on a correct answer |
| **Earn** | 80 XP per Leaf plus 20 for a first-try answer; a daily streak in the reader's own timezone |
| **Stop** | A 15-minute / 500 XP cap that reads as an ending rather than a refusal |
| **Share** | Wrap up the day and share a summary card; unlock and share achievements (19 of them) |
| **Trust** | Non-endorsement disclaimer and purchase link on every book; report an error on any Leaf |
| **Look** | Dark and light themes |

**The core thesis is real and enforced server-side.** Grading, the payoff gate, XP, the cap and streaks are all decided by the server — none of it is client-trusted, so the active-recall mechanic is a genuine gate rather than a UI convention.

### What is missing, in order of how much it matters

| Gap | What it means for a reader |
|---|---|
| **No real content** | 28 placeholder books. **The product currently has nothing to teach.** This is the whole game |
| **No password reset** | Email/password is the only way in. Forget it and the account, streak and library are gone permanently |
| **Not deployed** | Runs against a laptop. Cannot be used on a real phone by anyone |
| **Streaks break after ~4 days** | One 20-Leaf book cannot sustain a daily streak. It fails for exactly the readers who engage most |
| **No sound effects** | The sound layer exists with no audio. Gamification lands flatter than designed |
| **No re-reading** | Finishing a book is a dead end — there is no way back into it |
| **No push notifications** | A streak mechanic with no reminder |
| **Large text clips** | The app honours the OS text setting and then cuts the glyphs. Worse than not honouring it |
| **Android unverified** | Every check has been iOS |
| **No voiceover** | Phase 2 by design, not a defect |

---

## Part 2 — The five stages

### Stage 1 · Make it real
**Manager: WP12 — deployment. Architect: design the content pipeline, in parallel.**

| Item | Note |
|---|---|
| Deploy backend, CMS and Postgres to GCP | The app becomes usable on a real phone |
| **Payload must not be publicly reachable** | **The one genuine security hole.** Payload's REST API serves the payoff and the answer key anonymously — that is how the backend reads published-only content. Exposed, the entire unlock gate is bypassable. Today "private networking" is a comment in one file |
| `create-admin` stays out-of-band | A privilege-escalation path; never a route or a startup hook |
| `GET /health` becomes a schema probe | It currently reports the database up while every table it needs is missing — a deploy verified with it shows green against an empty database |
| Migrations survive a half-cleaned database | One surviving object aborts the whole transaction |

*Why first:* everything external depends on it, it carries the only security hole, and it is the longest engineering package. The pipeline design runs alongside because it is planning work that costs Manager nothing and has the longest lead time of anything on this list.

### Stage 2 · Make it safe to use
**Manager: WP13 — password reset.**

Needs a transactional email provider, which needs the domain Stage 1 sets up. Every day this waits, more real accounts exist that can be permanently lost.

### Stage 3 · Make it worth using
**The content pipeline, then real content.**

| Item | Note |
|---|---|
| Build the pipeline | Book → Leaves via Gemini/Vertex. Designed in Stage 1, built here |
| Generate and review content | Critic-in-the-Loop: ~15–25 min of founder review per Leaf |
| Replace all placeholder content | Enforced mechanically — `isPlaceholder` records cannot reach production |
| Unpublish "The mountain is you" | One minute; carries placeholder prose under a real author's name |
| **Book source acquisition — resolve, then regenerate** | The MVP generates from **downloaded** EPUB/PDF files, ruled acceptable for building on 2026-08-13. Before launch this needs resolving one of three ways: **buy** lawful copies and record it, **license** from indie/self-published authors (the parallel track `LEGAL.md` already names — slower, but it removes the question entirely and yields an "officially licensed" claim Blinkist and Headway lack), or **restrict** the launch library to public-domain and free-to-distribute titles. Ingesting a full copyrighted work is a reproduction, and `LEGAL.md` argues about *output* only. **Every Track records an `acquisition` status, so "which content must be regenerated" is a query rather than a reconstruction.** Do not assume MVP-phase content ships | Founder + counsel |
| ~~Book source acquisition policy~~ — superseded by the row above | The MVP ingests PDFs for ~5 books, ruled acceptable for building on 2026-08-13. **Launch needs a written policy per book** — a purchased copy, a licensed text, or a publisher agreement — because ingesting a full copyrighted work is a reproduction and `LEGAL.md` argues about *output* only. Provenance and retention are built into the pipeline from the start; what is missing is the policy it honours |
| **Vendor DPAs** | Gemini/Vertex, ElevenLabs. Cannot start before the pipeline exists |
| **IP counsel review of generated output** | `LEGAL.md` requires review of *actual output*, not the strategy document |
| **Decide the streak/library-size question** | Let re-completion count, ship more books, or accept that streaks only matter as the library grows |

*Why here:* this is the longest stretch and where the real product appears. It also drags the legal work with it — counsel cannot review output that does not exist.

### Stage 4 · Make it hold up
**Manager: WP14 — test hardening, plus the polish tier.**

Deferred Tier C from every package · rate limit on answer submission · the N+1 progress rollup · extra-large text clipping · Android verification · the achievement share screen (needs a deliberate fixture — three deferrals now) · a real session-activity signal · push notifications · re-reading a finished Track.

*Why here:* hardening code you are still changing is wasted. Push notifications only matter once streaks can survive, which needs content.

### Stage 5 · Ship
App Store: privacy nutrition labels, age rating, review submission. Sign in with Apple is **not** required while email/password is the only method — it returns the moment Google sign-in ships.

*Gated on decisions that must start in Stage 1, not here.*

---

## Part 3 — Blocked on the founder

*Reviewed 2026-08-27. Ordered by when it bites, not by size.*

| # | Item | Cost | Blocks | Open since |
|---|---|---|---|---|
| 1 | **Content Curation Policy** — approve, amend or reject the draft | a decision | **Which books can be ingested at all.** Draft at `proposals/content-curation-policy.md` (2026-08-29) | the original brief |
| 2 | **Streak vs library size** — a product call | a decision | Stage 3. Recommendation on the table, see below | 2026-08-09 |
| 3 | **A domain** | ~15 min, ~$12/yr | **Downgraded 2026-08-29 — it is not blocking anything today.** Cloud Run serves a free `*.run.app` URL, so deployment does not need it; the real driver is the email provider for password reset, which needs a verified sending domain. WP12 and WP13 are both parked, so buy it when WP12 starts. Buying earlier only banks the DNS propagation wait | 2026-08-13 |
| ~~4~~ | ~~**Trial credit expiry ~17 Sept**~~ | — | — | ✅ **Answered 2026-08-29** — founder will move to another account for the MVP phase. See the note below |
| 3 | **Content Curation Policy owner** — the criteria excluding authors with companion apps and publishers in AI litigation | a decision | Which books can launch at all | the original brief |
| ~~4~~ | ~~**Age-gate threshold**~~ | — | — | ✅ **Ruled 13+ on 2026-08-28.** Two riders below |
| 5 | **Streak vs library size** — a product call | a decision | Stage 3 | 2026-08-09 |
| 6 | **Unpublish "The mountain is you"** | 1 min | Nothing, but it is placeholder prose under a real author's name | 2026-08-12 |
| 7 | **SFX assets** — sourcing and licensing | unknown | Stage 4 polish | 2026-08-06 |
| ~~—~~ | ~~GCP account and billing~~ | — | — | ✅ **closed** — ₹28,710 credit active, pipeline running on Vertex |

**Nothing here blocks the work currently in flight.** WP17's remaining half needs none of it.

**Item 1 is the one to do first** — not because it is urgent today, but because everything downstream of it is waiting rather than working, and it is fifteen minutes.

**Items 3 and 4 have been open since the brief and are the ones most likely to surprise you late.** A curation policy discovered in Stage 5 can invalidate content produced in Stage 3. Item 3 now has a concrete case to reason from rather than being abstract — see the 2026-08-27 attributive-framing ruling, where a public-domain book turned out to teach 1910 metaphysics sincerely.

### Cloud account after the trial — founder decision 2026-08-29

**Moving to a different account for the MVP phase; purchase decisions after MVP.** Operationally this is low-friction and nothing is lost: the pipeline's Postgres and pgvector are local Docker, Payload's media store is local, and generated content lives in the CMS — **none of it is in GCP.** What changes is the project id, ADC credentials, and re-enabling the Vertex API. Budget an hour, not a day.

**Two things to know rather than discover:**

- **Google's welcome credit is once per billing account**, and their terms treat repeat trials as one customer, not several. A separate account under a genuinely different entity — a company rather than a person — is a different situation from a second personal account. Worth being deliberate about which one this is, because the failure mode is an account suspended mid-run rather than a bill.
- **`location: global` and the Gemini 3.x endpoint behaviour carry over.** Regional endpoints 404 on the whole 3.x line — that trap is per-project and will recur on the new account.

### Streak vs library size — recommendation on the table 2026-08-29

**The problem:** a streak needs ≥1 Leaf a day, so a 20-Leaf library supports at most a 20-day streak, and a reader working at the intended 5/day exhausts it in four. It fails for exactly the readers who engage most, and `streak-30` is unreachable at launch.

**Recommendation: let re-completing a Leaf count toward the streak, but not toward XP.**

A streak answers *"did you show up today"*, not *"did you consume new material"* — those were only ever the same question because the library is small. Decoupling them removes the structural cap entirely and costs one condition in the streak service. **XP stays gated on first completion**, so there is no farming: replaying a Leaf keeps the habit alive and earns nothing.

Rejected: *ship more books first* (makes a retention mechanic wait on the slowest thing in the project); *accept that streaks only matter as the library grows* (ships a mechanic knowing it breaks for the best readers).

### Riders on the 13+ ruling — flagged, not blocking

**13+ puts the product outside COPPA rather than inside it with obligations.** Under-13 would require verifiable parental consent plus restrictions on exactly the mechanics this product is built on — streaks, XP and push notifications are what COPPA scrutinises. Two things the ruling does *not* settle:

1. **GDPR-K is not a single number.** The EU digital-consent age is set per member state between 13 and 16 — Ireland and the Netherlands at 16, France at 15. A flat 13 is sufficient for a US-first launch and **is not automatically sufficient in the EU.** A counsel question when EU distribution is real, logged so it is not discovered during App Store review.
2. **This is not the App Store age rating**, which comes from Apple's content questionnaire and describes what the app *contains*, not who may sign up. Both are required at Stage 5, independently.

**Verified 2026-08-28 — the code already agrees, no change needed.** `AUTH_MINIMUM_AGE_YEARS` defaults to **13** in `apps/backend/src/config/env.ts:69`, and the check runs server-side in `auth.service.ts:282` — in the service layer, not the handler. WP2 chose 13 as its default and the founder's ruling ratifies it rather than changing it.

**One deployment consequence:** the threshold is an environment variable, not a constant. That is the right design — the GDPR-K rider above means a future EU deployment may genuinely need a different number — but it also means **the production value is whatever the deployed environment says.** Pin it explicitly at deploy time rather than relying on the default, and treat it as a deployment-verified setting alongside the Payload private-networking requirement.

### Newly possible, not yet blocking

**IP counsel review of generated output** — `LEGAL.md` requires review of *actual output*, and until WP17 there was none. There are now 18 grounded Leaves. **Be clear about what they can and cannot settle:** the source is public domain, so they say nothing about the copyright posture. What they *can* settle is the **fabrication and attribution** posture — whether per-claim grounding, verbatim quoting and non-endorsement framing add up to what counsel would want to see. That is the higher-severity risk of the two per `LEGAL.md`, so the review is worth having early even though it is partial.
