# Project Roadmap

Owned by Architect.

## Phase 1 status board

**Single source of truth for "what's done, what's next."** Architect updates this at every sign-off and every handoff. Everything below it in this file is longer-lived context — milestones, backlog, decisions, debt.

Legend: ✅ done · 🔵 in progress · ⬜ not started · 🔒 blocked

### Work packages

| # | Delivers | Owner | Status | Waiting on |
|---|---|---|---|---|
| WP0 | Monorepo, shared types, Postgres, CI | Manager | ✅ Signed off 2026-08-06 (PR #1) | — |
| WP1 | Payload 3.x CMS — Track + Leaf collections, publish-time validation | Manager | ✅ Signed off 2026-08-07 | — |
| **GATE** | **Schema freeze — one structurally complete Leaf authored** | **Founder** | ✅ **Closed 2026-08-08** — 4 findings, all ruled | — |
| WP2 | Backend foundation — auth (email/Apple/Google), age gate, profile | Manager | ✅ Signed off 2026-08-07 | — |
| WP2.1 | Schema-freeze alignment (4 gate rulings) + small backend gaps (logout, error split, token reaping) | Manager | ✅ Signed off 2026-08-08 (12/12) | — |
| WP3 | Content API — Explore, Library, Track/Leaf delivery | Manager | ✅ Signed off 2026-08-08 (11/11) | — |
| WP4 | Learning loop API — answer, unlock payoff, complete Leaf, award XP | Manager | 🔵 Handed off 2026-08-08 | — |
| WP5 | Session cap, streaks, achievements — server-authoritative | Manager | 🔒 | WP4, achievement list |
| WP6 | Mobile shell — navigation, auth screens, age gate, design system | Manager | ⬜ **unblocked** — next after WP4 | — design approved, Xcode done, simulator verified |
| WP7 | Mobile surfaces — Explore, Library, Journey, Profile | Manager | 🔒 | WP3, WP6 |
| WP8 | Mobile Leaf player — 5 slides, unlock gate, SFX | Manager | 🔒 | WP4, WP6, SFX assets |
| WP9 | Shareable session wrap-up + achievement screens | Manager | 🔒 | WP5, WP8 |
| WP10 | Report-an-error flow, fix queue, takedown path | Manager | 🔒 | WP3 |
| WP11 | Seed fixture — full-length placeholder Track (~20 Leaves) | Manager | 🔒 | GATE |

### Blocked on the founder

Nothing on this list can be handed to Manager. Four of the five items above marked 🔒 are waiting on something here.

| Item | Cost | Blocks | Status |
|---|---|---|---|
| ~~Merge WP1 and WP2 to `main`~~ | — | — | ✅ PRs #2 and #3 merged |
| ~~Schema-freeze gate~~ | — | — | ✅ **closed 2026-08-08** |
| ~~Report gate timing~~ | — | — | ✅ 5 min mock / 15–25 min real. Estimate revised down |
| ~~Rule on save-vs-publish authoring UX~~ | — | — | ✅ Helped — stays on save |
| **Confirm how Phase 1 content gets drafted** — ad-hoc AI assistance vs pulling the Phase 2 pipeline forward | minutes | The Phase 1/Phase 2 boundary, and the Critic-in-the-Loop review standard | ⬜ |
| ~~Visual design direction~~ | — | — | ✅ **Approved 2026-08-08** — `proposals/design-direction.md` |
| **Fix the gate content in the admin UI** — add `publisher` + `coverUrl` to the Track, add a locator to the Leaf's source reference, re-save both | ~2 min | **WP3** — the mapper rejects both records as they stand | ⬜ **do this now** |
| **Achievement list** — which badges, unlocked by what | ~30 min | WP5 | ⬜ |
| ~~Install Xcode~~ | — | — | ✅ **Installed 2026-08-08.** Simulator verification appended to WP2.1 |
| SFX assets — sourcing and licensing | unknown | WP8 | ⬜ |
| Review pipeline-generated Leaves (~20) — Critic-in-the-Loop | ~15–25 min each | Public launch, not the build | ⬜ pre-launch, after the pipeline |
| **IP counsel review of generated content + vendor DPAs** | legal | Public launch — now higher stakes, since launch content is AI-generated | ⬜ pre-launch |
| Age-gate threshold + Content Curation Policy owner | legal | Public launch | ⬜ pre-launch |

### When the founder can try it

Four distinct moments. Sequence, not dates — there is no velocity data and no target launch date yet.

| Moment | After | What you can actually do | Still missing |
|---|---|---|---|
| **Author content** | WP1 | Log into the CMS and build a Leaf. Real software you use, and it *is* the schema-freeze gate | Everything user-facing |
| **Exercise the loop headless** | WP4 | Hit the API from the terminal: fetch a Leaf, submit a wrong answer, submit the right one, watch the payoff unlock and XP land. Validates the core mechanic before any UI exists | All UI |
| **Hold the app** | WP6 | Install on your own phone, sign up, pass the age gate, navigate the four surfaces | Content, the Leaf player — the surfaces are empty shells |
| **Test the product** | WP8 | The real thing: read a summary, answer a scenario, unlock the payoff, complete a Leaf, feel whether the thesis works | Session cap, streaks, share screens (WP5, WP9) |

**WP8 is the answer to "when can I judge whether this works."** Chain to reach it: WP1 → GATE → WP2 → WP3 → WP4 → WP6 → WP11 → WP8. WP6 is the pinch point, and it is blocked on founder items (design direction, Xcode), not on Manager.

### Where to look for what
- **This board** — current state, at a glance
- `projectplan.md` — the one work package in flight, in detail
- `collaboration-log.md` — every handoff and completion report, newest first
- `proposals/phase-1-implementation-plan.md` — the full milestone plan and its reasoning

## Vision
ZoomOut turns non-fiction books into gamified, interactive micro-lessons that build lasting retention — reclaiming screen time from algorithmic feeds with focused, ~15-minute sessions that require active engagement instead of passive consumption.

## Milestones
| Milestone | Target | Status |
|---|---|---|
| Phase 1 — core learning loop, gamification, all app surfaces, manual content admin tool | MVP / promotional launch | **In progress** — plan approved 2026-08-06, see `proposals/phase-1-implementation-plan.md` |
| Phase 2 — AI content pipeline (Gemini/Vertex AI, ElevenLabs) | Post-MVP | Not started |
| Phase 3 — social ("Reading Circles") | Post-MVP | Not started |
| Phase 4 — monetization | Last | Not started — deliberately deferred to the final phase |

## Backlog
| Feature | Priority | Status | Notes |
|---|---|---|---|
| WP0 — Monorepo scaffolding (npm workspaces, TS strict, shared types, Postgres + migrations, CI) | P0 | ✅ **Done** — signed off 2026-08-06, PR #1 | 9/10 criteria verified by execution, CI green. 10th carried forward, see below |
| Verify Expo app boots in the iOS simulator | P0 — gates WP6 | 🔵 Appended to WP2.1 (2026-08-08) | Xcode now installed. Was the last open WP0 criterion |
| WP1 — Content admin tool: Payload 3.x CMS setup | P0 | **Handed off** 2026-08-06 | Blocks all content — see `PRODUCT.md` Phased scope. Approval workflow deferred; Payload makes it a config change later |
| **GATE — schema freeze** | P0 — **blocks everything downstream of WP1** | Not started | ~45 min of **founder** time: author one structurally complete Leaf through the real Payload editor, placeholder prose, no research. Nothing downstream starts until the schema is signed off. See plan §5 |
| User auth & profile management | P0 | Not started | |
| Core learning loop (5-slide Leaf UI, unlock-on-correct-answer logic) | P0 | Not started | |
| Gamification (streaks, XP, badges, SFX) | P0 | Not started | |
| Session cap / positive friction (15 min or 500 XP) | P0 | Not started | Intentional constraint, not a bug |
| Explore / Library / Journey screens | P0 | Not started | |
| Shareable session-wrap-up & achievement screens | P1 | Not started | Growth-loop mechanic |
| "Report an error" flow + fix queue | P1 | Not started | Legal requirement — see `PRODUCT.md` Content integrity |
| Purchase-forward / affiliate links | P1 | Not started | |
| Age-gating / minor protection | P0, pre-launch blocker | Not started | Threshold owner: TBD (legal) |
| AI content pipeline (book → Leaves via Gemini/Vertex) | Phase 2 | Not started | Source of launch content, but built **after all app and admin work completes** (decided 2026-08-08). Needs its own brainstorming cycle. Separate Python service. **No Architect proposal until Phase 1 app work is done** |
| Social / Reading Circles | Phase 3 | Not started | |
| Monetization / subscription | Phase 4 | Not started | Deliberately last. Model still undecided — see Open items in `PRODUCT.md` |
| Launch library authoring — "The Mountain Is You" (~20 Leaves) | P0, pre-launch gate | Not started | Deferred off the build critical path 2026-08-06; app is built against placeholder content. ~10–15 hours of solo writing still required before launch |
| Replace all placeholder content | P0, pre-launch blocker | Not started | `isPlaceholder` records must never reach production — see proposal §3.4 |

## Decisions log
| Date | Decision | Why | Alternatives rejected |
|---|---|---|---|
| 2026-08-06 | Mobile: React Native + Expo, TypeScript | Cross-platform velocity for a small team; strong animation/gamification ecosystem (Reanimated, Lottie); shares TypeScript with backend | Flutter — legitimate alternative, smaller hiring pool; native Swift/Kotlin — 2x build/maintain cost for an early-stage team |
| 2026-08-06 | Backend: Node.js + TypeScript | Unified language with mobile; fast to build CRUD, gamification logic, and the Phase 1 admin tool | Python for everything — better AI/ML tooling, but weaker fit for general app backend work |
| 2026-08-06 | Phase 1 content: manual authoring via an internal admin tool | AI pipeline is explicitly Phase 2; the app needs content to launch with | Waiting for the AI pipeline (delays launch indefinitely); semi-automated generation (premature — no pipeline to assist yet) |
| 2026-08-06 | AI pipeline (Phase 2) will likely be a separate Python service, not part of the Node backend | Best tooling fit for Gemini/Vertex AI/ElevenLabs orchestration; isolates a batch/pipeline workload from the request-serving app | Building it in Node/TypeScript — workable but weaker ecosystem for this specific workload |
| 2026-08-06 | Wrong answer on slide 2 → unlimited retry, slide 3 stays locked until correct | Simplest state machine; with only 3 options no user is permanently blocked, so retention risk is low. Stakes move to XP, not access | Limited attempts then reveal (needs attempt-tracking + penalty rules); wrong-still-advances (guts the active-recall differentiator); Duolingo-hearts (churn risk) |
| 2026-08-06 | No Branch layer — Track → Leaf is the real structure | The brief's "Tree/Branch/Leaf" was legal framing, not a functional spec. Originality argument rests on Leaves not mapping 1:1 to chapters, which Track → Leaf already satisfies | Building Branch now (schema + admin + Journey UI cost for no functional gain); nullable `branch_id` reserved for later (half-built taxonomies stay half-built) |
| 2026-08-06 | Voiceover deferred to Phase 2 | ElevenLabs already lives in Phase 2; pulling it forward adds a vendor, per-minute cost, audio storage/CDN and a DPA to the MVP. Schema reserves a per-slide audio reference so it's a later migration, not a redesign | Ship ElevenLabs in Phase 1; on-device TTS stopgap (robotic voice undercuts a product selling polish) |
| 2026-08-08 | **Phase 1 launch content will be produced by the AI pipeline**, not hand-written | Founder's call. Changes the Phase 1/Phase 2 boundary: the pipeline is no longer strictly post-MVP, it becomes the source of launch content. **Consequence:** DPAs with Gemini/Vertex and `LEGAL.md`'s "IP counsel review of actual generated content" move from post-launch to pre-launch, and Critic-in-the-Loop stops being a process description and becomes the control standing between generated text and a fabricated-quote incident | Ad-hoc AI drafting with human fact-check (no pipeline built); fully manual authoring (cleanest legally, ~10–15 hrs/Track) |
| 2026-08-08 | A scenario option **without a Payload row id is rejected**, never given an index-derived id | An index changes meaning the moment an author reorders options, silently turning a correct answer wrong with no error anywhere. Being over-strict costs a withheld Leaf plus a logged error — visible and fixable. The alternative costs silent mis-grading. Verified the live CMS issues hex row ids, so this rejects only genuinely broken documents | Deriving an id from array position; accepting the option unidentified |
| 2026-08-08 | Integration tests run against a **controllable Payload stand-in**, not the real CMS | The behaviour under test is ours — cache TTL, placeholder filter, mapper, 503 path — and each needs content to mutate mid-test. Booting Payload also inherits WP1's two upstream defects. Payload's own half of takedown was proven against the real thing in WP1 | Booting real Payload per suite (slow, inherits upstream defects, uncontrollable) |
| 2026-08-08 | **`listTracks` pagination: filter in the Payload query, keep the service guard** (for WP7) | Returning Payload's unfiltered totals under-reports; recomputing per page is worse, because a page-local total looks correct while being wrong. A `where` clause excluding placeholder content in production makes totals accurate *at the source*. `ContentService`'s guard stays the authoritative control so nothing depends on the query being right — the filter is an optimisation, not the control | Payload's raw totals (WP3's state, acceptable at one book); recomputing per page |
| 2026-08-08 | Invalid content: **listing drops and logs it, direct fetch throws** | One malformed Track should degrade Explore, not empty it — but a reader who asked for *that* Track must not get a success response for something we refused to serve | Failing the whole list; serving the invalid document |
| 2026-08-08 | `ContentInvalidError` is a **502**, and hidden content is a **404** not a 403 | The backend is working correctly and refusing what an upstream system produced — that is a gateway failure, not an internal one. And whether an unpublished or placeholder Track exists is not something a reader is entitled to learn | 500 for invalid content; 403 for hidden content |
| 2026-08-08 | Logout revokes the **whole token family**, not the single presented token | A family is one device's login chain, so family revocation is what a sign-out button promises. Other devices are unaffected because each holds its own family | Revoking only the presented token (leaves the device still signed in via rotation) |
| 2026-08-08 | Refresh-token reaping deletes on **expiry, not revocation** | A revoked-but-unexpired row is exactly what lets a replayed token be recognised as *reuse* rather than as an unknown token. Reaping those would silently downgrade theft detection | A retention window after revocation (extra config, no added safety) |
| 2026-08-08 | The CMS locator rule is implemented **independently** of `hasSourceLocator` in shared, not imported | A shared predicate means one bug defeats both gates — the exact failure the two-gate design exists to prevent. The mapper may reuse it; the CMS may not | Importing the shared predicate into the CMS (DRY, but collapses the two gates into one) |
| 2026-08-08 | **Design direction approved** — playful/gamified, dark default (light supported), teal primary + warm amber reward accent, no mascot in Phase 1** | Founder's calls. Playful-on-dark loses its usual toolkit — shadows are invisible and saturated colour glares — so depth comes from surface lightness and energy comes from motion. The second warm accent exists because teal-on-dark is the least distinctive option available and reward moments must not compete with the interface. Full brief: `proposals/design-direction.md` | Bold editorial (Architect's recommendation); calm premium; dark-first focus. Light-default was recommended for share screenshots — mitigated instead by making share screens a light-surface exception |
| 2026-08-08 | **Refined: the AI pipeline comes after *all* app and admin work**, not just after WP8 | Founder's call — the pipeline needs its own brainstorming and design cycle, and interleaving it with app work would fragment both. The entire Phase 1 build (WP3–WP11) runs on placeholder content, which WP11 already provides at realistic volume. No Architect proposal for the pipeline until app work completes | Pipeline after WP8 (earlier ruling, superseded); pipeline first |
| 2026-08-08 | **Build order: app through WP8 first, pipeline after** — *superseded same day by the row above, which extends it to all of Phase 1* | One Manager session works serially, so this is a resource decision, not a technical one — the pipeline is orthogonal to WP3–WP9 and blocks nothing architecturally. Decided this way because **a generated Leaf cannot be judged without the player**: whether a scenario lands or an unlock feels earned is invisible in a CMS record and only observable at WP8. Building the generator first means tuning prompts against JSON nobody can evaluate. Architect writes the pipeline architecture proposal in parallel — planning time, not Manager time | Pipeline first (app stalls, generated output unjudgeable); a thin generator slice first (half-built pipelines stay half-built) |
| 2026-08-08 | **Exactly-one-correct-option stays enforced on save**, not moved behind publish | Settled by the founder authoring a real Leaf — the refusal read as helpful, not obstructive. This is why the question was deferred from WP1 rather than guessed at: Architect's prior was to move it behind publish, and the evidence went the other way | Publish-gating it (Architect's prior, not supported by the evidence) |
| 2026-08-08 | **Authoring estimate revised down**: ~5 min mechanical per Leaf, 15–25 min with real content and review | Measured at the gate. The editor is not the bottleneck — thinking, writing and sourcing are. A 20-Leaf Track is ~5–8 hours rather than the 10–15 originally planned | The original 30–45 min/Leaf estimate, which was ~9x pessimistic on the mechanical portion |
| 2026-08-08 | **Schema frozen** after the gate, with four corrections | One authored Leaf surfaced exactly the class of gap the gate existed to find. Content types in `packages/shared/src/content.ts` lose their PROVISIONAL status once WP2.1 lands | Freezing unchanged (would have shipped four known defects); another authoring round before freezing (diminishing returns from a second data point) |
| 2026-08-08 | All CMS text fields trimmed on save — leading/trailing only, **never** collapsing internal whitespace | Trailing whitespace reached rendered output and made otherwise-identical values distinct, which poisons any later dedup or comparison. Internal whitespace is intentional in multi-line payoff bodies | Trimming at render (too late, data is already dirty); collapsing all whitespace (destroys authored formatting) |
| 2026-08-08 | `SourceReference` requires `note` **plus at least one of** `chapter` / `page` / `quote`, publish-gated | `note` alone is a description of where a claim came from, not a citation anyone can check — weaker than `LEGAL.md` intends for an audit trail. Requiring `chapter` outright produces junk for a Leaf synthesising across a book, and `page` is edition-dependent false precision. Letting the author pick the honest locator gets specificity without junk | Requiring `chapter` always; leaving all three optional (status quo, weak audit trail); dropping `page` entirely |
| 2026-08-08 | Sticky notes bounded at **min 2, max 6** | Chosen by failure direction, not by the single data point: too tight blocks an author immediately (cheap, visible), too loose ships content that breaks the board layout at WP8 (expensive, late). Loosening later is safe; tightening invalidates existing content | A wider bound informed by n=1; no bound (the WP0 debt item, unresolved) |
| 2026-08-08 | `publisher` and `coverUrl` required to publish a Track | `coverUrl` is load-bearing for Explore in WP7. `publisher` is a compliance field — `LEGAL.md`'s curation policy excludes publishers in active AI litigation. **Note:** `trackSchema` already declared both non-optional, so the CMS was weaker than the domain model and WP3 would have thrown at serve time. The two-gate design caught it, just expensively | Leaving them optional and defaulting at render (hides missing compliance data) |
| 2026-08-07 | Social signup carries `dateOfBirth` and `timezone` in the request body alongside the provider ID token | Apple and Google supply neither, and the age gate cannot be skipped. Collecting them *after* account creation would mean creating an account for a possible minor. **WP6 consequence:** only date of birth needs a screen — timezone is read silently from the device via `Intl.DateTimeFormat().resolvedOptions().timeZone` and never asked for | Post-signup collection (defeats the gate); deriving age from the provider (neither supplies it) |
| 2026-08-07 | Password hash stored on `user_auth_providers`, not `users` | A social-only reader has no password, so the hash belongs to the *identity* rather than the person | A nullable column on `users` |
| 2026-08-07 | Minimum password length 12, no composition rules | NIST 800-63B advises against forced composition; length is what adds entropy | Complexity requirements |
| 2026-08-07 | Unconfigured social providers fail closed | An unregistered provider gets an audience no token can match, so it fails the audience check rather than skipping verification. Neither app is registered yet and requiring the IDs would block local development | Requiring client IDs at boot; skipping verification when unconfigured |
| 2026-08-07 | Cross-user profile access returns 403, not 404 | Ids are unguessable UUIDs, so the enumeration risk a 404 would hide is not live — and a 404 makes a genuine bug look like a missing row | 404 to avoid confirming existence |
| 2026-08-07 | Payload `typescript.declare: false` — generated types emitted into `packages/shared` **without** the `declare module 'payload'` augmentation | `packages/shared` must never acquire a `payload` dependency, because **mobile consumes that package** — pulling a CMS framework's module augmentation into the mobile dependency graph is the same class of problem as the Next.js leak WP1 guarded against. Cost is loose slug typing inside `apps/admin` alone, bounded at three collections | Emitting twice (local copy with the augmentation, shared copy without) — a second artifact and a drift risk for a local, minor typing gain |
| 2026-08-07 | Payload's auth collection is `admins`, not `users` | `User` in `packages/shared` means an app *reader*. Two things named `User` would collide the moment codegen emits into that package | Naming it `users` and disambiguating later |
| 2026-08-07 | Generated CMS types exposed on a `./cms` subpath, not from the shared index | Nothing picks up CMS shapes by accident; WP3 imports `@zoomout/shared/cms` deliberately | Re-exporting from the index |
| 2026-08-06 | Backend framework = **Fastify 5**, not Express | First-class pino integration (structured logging was a WP0 requirement) and materially stronger typing under strict mode. A "how" call inside Manager's remit; flagged and ruled on rather than left implicit | Express 5 — weaker type story, logging bolted on |
| 2026-08-06 | `toPublicLeaf` / `publicScenarioSlideSchema` live in `packages/shared`, not the backend | `PublicLeaf` is the type **mobile** renders, so keeping the projection in shared means the client's type system cannot represent a Leaf carrying an answer key. In the backend's content layer, mobile would need a parallel type — violating the "never redefine the same shape" rule in `CLAUDE.md` and putting the product's core invariant back on discipline | Hand-rolled stripping in WP3/WP4; a backend-only mapper |
| 2026-08-06 | Dinner Table Knowledge requires a takeaway `SourceReference`, enforced in `leafSchema` **as well as** the CMS; `sourceReferences` co-located on `Leaf` | The CMS is third-party software whose validation is configuration; `leafSchema` is ours, version-controlled and tested. Two independent gates on the highest-severity risk in `LEGAL.md`, failing in the correct direction — if they disagree, content doesn't ship. Consequence: Payload must model source references as a nested array on the Leaf document, since a `beforeChange` hook cannot validate the invariant across documents | CMS-only enforcement (single point of misconfiguration); separate `SourceReference` collection with a relationship (breaks atomic validation) |
| 2026-08-06 | "Verified locally" on this repo means **`dist` deleted, not just `npm ci`** | `npm ci` clears `node_modules` but leaves `packages/shared/dist`, which masked a real lint-ordering bug through a supposedly clean run. Caught by Manager; adopted as the standard for all future completion reports | Trusting `npm ci` as a clean room |
| 2026-08-06 | CMS = **Payload 3.x**, read by the backend via its REST API (not its Postgres tables) | Only Payload models the fixed 5-slide Leaf as real nested typed groups — Directus field groups are presentational and don't nest data. Validation lives in testable TypeScript hooks rather than GUI Flows. MIT with RBAC in core, vs Directus v12's MSCL relicensing that puts RBAC at $499/mo and blocks the API without a registration key — unacceptable coupling for an hours-to-takedown obligation. Settled by `researcher` | Directus (loses criterion 1 structurally, licensing hazard); custom admin build; files in git |
| 2026-08-06 | Monetization deferred to a final Phase 4 | Founder's call. Removes billing, IAP, and FTC negative-option compliance from every earlier phase | Monetizing at MVP (compliance burden before product-market fit) |
| 2026-08-06 | Voiceover = AI-generated audio in a natural human voice (ElevenLabs), not human narration | Confirms the reading in `PRODUCT.md`; human recording doesn't scale past a handful of books and blocks the Phase 2 pipeline entirely | Literal human voice actors |
| 2026-08-06 | Phase 1 launch library narrowed to 1 book — "The Mountain Is You" | Only title clear on both curation criteria (indie publisher, no official companion app), and it cuts authoring from ~45 hours to ~12. Adding books later needs zero code, which is the point of the CMS | 3 books (2 flagged on curation, triple the writing load) |
| 2026-08-06 | Build Phase 1 against placeholder content; real authoring deferred to a pre-launch gate | Decouples the app from the content entirely so the full structure is testable end to end without any writing. Schema risk is retained via a 45-min structural gate | Authoring in parallel with the build (writing becomes the critical path) |
| 2026-08-06 | A Leaf is ~3 minutes to consume — ~5 per capped session | Keeps "micro-learning" honest and keeps the 500 XP cap a meaningful second constraint; at 10–15 min/Leaf the XP cap never fires and a 20-Leaf Track becomes a 20-day commitment | ~7 min (2/session); 10–15 min (1/session) |
| 2026-08-06 | ~~Phase 1 launch library = 3 books~~ **superseded same day, see row above** | No AI pipeline means every Leaf is hand-written by a solo founder | More books at launch (unachievable solo) |
| 2026-08-06 | Phase 1 defaults: streak = ≥1 Leaf/day local tz, no freezes; session cap server-authoritative, resets local midnight, finishes in-progress Leaf; XP flat + first-try bonus; auth email/Apple/Google, no guest; online-only; iOS first | Each is the lowest-complexity option that doesn't compromise the product thesis. Offline sync and guest mode were the two big architecture costs removed | Offline-first sync; anonymous guest start (better activation, worse data model) |
| 2026-08-06 | Phase 1 content authoring = self-hosted headless CMS, not a custom `apps/admin` build | ~500 structured slides for a 5-book launch needs a real editing UI. A CMS gives schema modelling, media handling, draft/publish, versioning and roles in days rather than weeks — and makes the still-undecided approval workflow a config change instead of a migration | Custom web app (weeks spent on a tool no customer sees); YAML/JSON in git + seed script (free, but unworkable past a few books and hostile to non-technical authors) |

## Technical debt register
| Item | Impact | Flagged by | Status |
|---|---|---|---|
| **Payload `destroy()` does not close its database pool** — it only resets in-memory schema state, and `pool.end()` hangs because Payload keeps a client checked out | Affects anything booting Payload **outside a request lifecycle**: WP3's integration tests if they seed via the Local API, and the WP11 seed script. **Not** the `ContentRepository` runtime path, which calls REST over HTTP and never boots Payload | Manager, WP1 | Open — mitigate once in a shared test/seed harness, not per caller |
| **Payload attaches no `error` listener to its pool** — an idle-client error becomes an uncaught exception | Same blast radius as above: test harnesses and the seed script | Manager, WP1 | Open — same shared harness |
| Payload's stock template tracks their unreleased `main` and disagreed with 3.87.0 in three places (`generatePayloadViewport`, `importMap`, `turbopack.root`) | All fixed and commented at the site. A future Payload upgrade must re-run `payload generate:importmap` and re-check `(payload)/layout.tsx` | Manager, WP1 | Fixed — recorded as an upgrade checklist item |
| **No input trimming in the CMS** — four authored fields carried trailing whitespace, including `" ; \n"` on `dinnerTableKnowledge` | Reaches rendered output; makes identical values distinct | Manager, gate 2026-08-08 | Assigned to WP2.1 |
| **`listTracks` returns Payload's unfiltered totals** — in production a page of placeholder Tracks yields fewer rows than `totalTracks` claims | UI pagination will under-report. Ruled approach: `where` filter in the Payload query, service guard retained | Manager, WP3 | Assigned to **WP7** — must be stated in that handoff, not discovered in the UI |
| **`listLeavesForTrack` caps at 100 Leaves with no paging** | A Track is specified at 15–30 so this is comfortable, but it is a silent ceiling rather than an error | Manager, WP3 | Open — revisit if Track length ever changes |
| **Content cache is per-process and unbounded in entry count** | With multiple instances the TTL becomes the *worst-case* takedown latency across them — a legal-obligation concern, not just performance | Manager, WP3 | Open — must be revisited before horizontal scaling |
| **No ETag / `If-None-Match` on content responses** | Mobile refetches full Track lists on every Explore visit | Manager, WP3 | Open — consider in WP7 once payload size is real |
| `user_tracks.status` exists and is always `active` | Nothing sets it yet | Manager, WP3 | Open — WP4/WP5 own the transitions |
| **Integration tests use a Payload stand-in — a real response shape could go unseen** | Mitigated by a manual end-to-end run against the live CMS at WP3 | Architect, WP3 review | Open — **re-run the manual end-to-end check after any Payload upgrade**; added to the upgrade checklist |
| **Testcontainers intermittently skips whole integration suites** when they run back to back (`inspectContainerUntilPortsExposed`); an immediate re-run passes | An occasional red CI build that is green on re-run is this, not a regression | Manager, WP2.1 | Open — add a retry step to the workflow if it recurs |
| **Payload emits `id: number`, domain uses `cmsIdSchema` string** — serial integer keys | The WP3 mapper must stringify ids and handle relationships arriving populated or bare depending on `depth` | Manager, WP2.1 | Assigned to WP3 |
| CMS↔domain divergences documented in `payload.config.ts`: `trackId` is `string \| Track`; `stickyNotes.notes` is `{ note }[]` not `string[]`; `scenario.options` is a plain array not a 3-tuple; Payload adds `_status`, timestamps, row ids | `ContentRepository` must map across these. Left unreconciled, WP3 hand-rolls the mapping and WP4 inherits it | Manager, WP1 | Open — reconcile at the schema-freeze gate |
| `apps/admin/CLAUDE.md` + `AGENTS.md` are generated by `next dev` and committed | Third-party tooling injecting agent instructions into a repo where `CLAUDE.md` is a controlled artifact. Content is benign; the mechanism is unreviewed | Architect, WP1 review | Open — recommend a header noting it's tool-generated and that root `CLAUDE.md` wins |
| `typescript.declare: false` costs loose slug typing inside `apps/admin` | Bounded to one workspace with three collections; integration tests use bracket access for `_status` / `isPlaceholder` | Manager, WP1 | **Accepted** — ruled 2026-08-07, revisit only if `apps/admin` grows |
| `publicLeafSchema` derives from the Leaf shape *before* the Dinner Table Knowledge refinement | Safe today — `toPublicLeaf` only accepts an already-validated `Leaf`. Becomes a hole the moment anything parses a public Leaf from untrusted input | Manager, WP0 | Open — WP3 handoff must forbid parsing untrusted input with `publicLeafSchema` |
| 14 moderate dev-only npm advisories (drizzle-kit's bundled esbuild-kit and vite transitives) | Dev-only, no runtime exposure | Manager, WP0 | Accepted — revisit when upstream updates. Not worth forcing breaking upgrades |
| Mobile component-testing stack undecided (RN preset vs Expo's Jest setup) | Mobile tests currently cover pure logic only | Manager, WP0 | Open — decide with the first real screens in WP6 |
| `isProductionPublishable` exists but nothing calls it yet | The placeholder-to-production block is written but not wired | Architect, WP0 review | Open — WP3 must enforce it on the content read path |
| ~~`stickyNotesSlideSchema` has no upper bound~~ | — | Manager, WP0 | ✅ **Closed** — min 2, max 6, ruled at the gate 2026-08-08 |
| ~~"Exactly one correct option" fires on every save~~ | — | Manager, WP1 | ✅ **Closed 2026-08-08** — founder authored a Leaf and reported it helped. Stays on save |
| **`ProviderEmailMissingError` covers two distinct failures** — "the provider returned no email" and "a first-time social signup arrived without date of birth" | A client cannot branch on them, so WP6 will show the wrong screen for one. They need opposite recoveries | Manager, WP2 | Open — **must land before WP6 builds against it**. Candidate for WP2.1 |
| **No logout endpoint** | Refresh tokens are revocable and the machinery exists, but nothing exposes it. WP6 needs it the moment there is a sign-out button | Manager, WP2 | Open — unblocked now. Candidate for WP2.1 |
| Expired refresh tokens are never reaped — the table grows unbounded | Slow-burn storage growth, no correctness impact | Manager, WP2 | Open — pre-launch. Candidate for WP2.1 |
| Timing equalisation covers the missing-account path only — a wrong password on a real account still differs from a correct one by argon2 time | A narrow account-enumeration oracle. Closing it fully needs a constant-time envelope around the whole handler | Manager, WP2 | Open — accepted for now, revisit pre-launch |
| `eslint --fix` strips type assertions on Fastify `inject().json()` (typed `any`), silently un-typechecking tests | Replaced with a `bodyOf<T>` helper routing through `unknown`. Do not trust `--fix` on backend test files | Manager, WP2 | Fixed — recorded as a working note |
| No password reset / email verification flow | A locked-out user has no recovery path. Survivable at promotional-launch scale, not at public launch. `email_verified_at` reserved in WP2 so adding it is not a backfill | Architect, WP2 planning | Open — pre-launch |
