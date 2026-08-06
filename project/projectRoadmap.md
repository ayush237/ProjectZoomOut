# Project Roadmap

Owned by Architect.

## Phase 1 status board

**Single source of truth for "what's done, what's next."** Architect updates this at every sign-off and every handoff. Everything below it in this file is longer-lived context — milestones, backlog, decisions, debt.

Legend: ✅ done · 🔵 in progress · ⬜ not started · 🔒 blocked

### Work packages

| # | Delivers | Owner | Status | Waiting on |
|---|---|---|---|---|
| WP0 | Monorepo, shared types, Postgres, CI | Manager | ✅ Signed off 2026-08-06 (PR #1) | — |
| WP1 | Payload 3.x CMS — Track + Leaf collections, publish-time validation | Manager | 🔵 Handed off 2026-08-06 | — |
| **GATE** | **Schema freeze — one structurally complete Leaf authored** | **Founder** | ⬜ ~45 min | WP1 |
| WP2 | Backend foundation — auth (email/Apple/Google), age gate, profile | Manager | ⬜ | WP0 ✅ — can start any time |
| WP3 | Content API — Explore, Library, Track/Leaf delivery | Manager | 🔒 | WP1, GATE |
| WP4 | Learning loop API — answer, unlock payoff, complete Leaf, award XP | Manager | 🔒 | WP2, WP3 |
| WP5 | Session cap, streaks, achievements — server-authoritative | Manager | 🔒 | WP4, achievement list |
| WP6 | Mobile shell — navigation, auth screens, age gate, design system | Manager | 🔒 | WP2, design direction, Xcode |
| WP7 | Mobile surfaces — Explore, Library, Journey, Profile | Manager | 🔒 | WP3, WP6 |
| WP8 | Mobile Leaf player — 5 slides, unlock gate, SFX | Manager | 🔒 | WP4, WP6, SFX assets |
| WP9 | Shareable session wrap-up + achievement screens | Manager | 🔒 | WP5, WP8 |
| WP10 | Report-an-error flow, fix queue, takedown path | Manager | 🔒 | WP3 |
| WP11 | Seed fixture — full-length placeholder Track (~20 Leaves) | Manager | 🔒 | GATE |

### Blocked on the founder

Nothing on this list can be handed to Manager. Four of the five items above marked 🔒 are waiting on something here.

| Item | Cost | Blocks | Status |
|---|---|---|---|
| Merge PR #1 to `main` | minutes | WP1 branching cleanly | ⬜ |
| **Schema-freeze gate** — author one complete Leaf, placeholder prose | ~45 min | WP3, WP11, everything downstream | ⬜ after WP1 |
| **Visual design direction** — nothing in any doc defines ZoomOut's look | a working session | WP6 → WP7, WP8, WP9 | ⬜ |
| **Achievement list** — which badges, unlocked by what | ~30 min | WP5 | ⬜ |
| Install Xcode (~10GB) | a download | WP6, and closes the last WP0 criterion | ⬜ |
| SFX assets — sourcing and licensing | unknown | WP8 | ⬜ |
| Author the real Track (~20 Leaves) | 10–15 hrs | Public launch, not the build | ⬜ pre-launch |
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
| **Verify Expo app boots in the iOS simulator** | P0 — **gates WP6** | Carried over from WP0 | Blocked on Xcode (~10GB), not on code. iOS bundle builds and shared resolves through Metro; the native shell launch is unverified. Must close before WP6 starts |
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
| AI content pipeline | Phase 2 | Not started | Likely a separate Python service |
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
| `publicLeafSchema` derives from the Leaf shape *before* the Dinner Table Knowledge refinement | Safe today — `toPublicLeaf` only accepts an already-validated `Leaf`. Becomes a hole the moment anything parses a public Leaf from untrusted input | Manager, WP0 | Open — WP3 handoff must forbid parsing untrusted input with `publicLeafSchema` |
| 14 moderate dev-only npm advisories (drizzle-kit's bundled esbuild-kit and vite transitives) | Dev-only, no runtime exposure | Manager, WP0 | Accepted — revisit when upstream updates. Not worth forcing breaking upgrades |
| Mobile component-testing stack undecided (RN preset vs Expo's Jest setup) | Mobile tests currently cover pure logic only | Manager, WP0 | Open — decide with the first real screens in WP6 |
| `isProductionPublishable` exists but nothing calls it yet | The placeholder-to-production block is written but not wired | Architect, WP0 review | Open — WP3 must enforce it on the content read path |
| `stickyNotesSlideSchema` has no upper bound on note count | Authoring could produce a board that doesn't fit the design | Manager, WP0 | Open — set the bound at the schema-freeze gate, once one authored Leaf shows what fits |
