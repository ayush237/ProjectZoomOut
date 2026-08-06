# Project Roadmap

Owned by Architect.

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
| WP0 — Monorepo scaffolding (npm workspaces, TS strict, shared types, Postgres + migrations, CI) | P0 | **Handed off** 2026-08-06 | Prerequisite for every item below |
| Content admin tool (manual Leaf authoring) | P0 | Not started | Blocks all content — see `PRODUCT.md` Phased scope. Decided 2026-08-06: self-hosted headless CMS (Payload vs Directus not yet chosen). Approval workflow deferred — CMS makes it a config change later |
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
