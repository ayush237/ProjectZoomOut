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

| # | Item | Cost | Blocks | Open since |
|---|---|---|---|---|
| 1 | **Age-gate threshold** — the legal answer, not the code | a decision | Stage 5, and COPPA/GDPR-K compliance | the original brief |
| 2 | **Content Curation Policy owner** — the criteria excluding authors with companion apps and publishers in AI litigation | a decision | Which books can launch at all | the original brief |
| 3 | **GCP account and billing** | ~30 min | **Stage 1 cannot start without it** | now |
| 4 | **A domain** | ~15 min | Deployment and the email provider both need it | now |
| 5 | **Streak vs library size** — a product call | a decision | Stage 3 | 2026-08-09 |
| 6 | **SFX assets** — sourcing and licensing | unknown | Stage 4 polish | 2026-08-06 |
| 7 | **Unpublish "The mountain is you"** | 1 min | Nothing, but it is placeholder prose under a real author's name | 2026-08-12 |

**Items 3 and 4 are the only ones blocking work right now.** Items 1 and 2 have been open since the beginning and are the ones most likely to surprise you late — a curation policy discovered in Stage 5 can invalidate content produced in Stage 3.
