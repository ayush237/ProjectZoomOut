# Project Roadmap

Owned by Architect.

## Vision
ZoomOut turns non-fiction books into gamified, interactive micro-lessons that build lasting retention — reclaiming screen time from algorithmic feeds with focused, ~15-minute sessions that require active engagement instead of passive consumption.

## Milestones
| Milestone | Target | Status |
|---|---|---|
| Phase 1 — core learning loop, gamification, all app surfaces, manual content admin tool | MVP / promotional launch | Not started |
| Phase 2 — AI content pipeline (Gemini/Vertex AI, ElevenLabs) | Post-MVP | Not started |
| Phase 3 — social ("Reading Circles") | Post-MVP | Not started |

## Backlog
| Feature | Priority | Status | Notes |
|---|---|---|---|
| Content admin tool (manual Leaf authoring) | P0 | Not started | Blocks all content — see `PRODUCT.md` Phased scope |
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
| Monetization / subscription | Unscoped | Not started | Model not yet decided — see Open items in `PRODUCT.md` |

## Decisions log
| Date | Decision | Why | Alternatives rejected |
|---|---|---|---|
| 2026-08-06 | Mobile: React Native + Expo, TypeScript | Cross-platform velocity for a small team; strong animation/gamification ecosystem (Reanimated, Lottie); shares TypeScript with backend | Flutter — legitimate alternative, smaller hiring pool; native Swift/Kotlin — 2x build/maintain cost for an early-stage team |
| 2026-08-06 | Backend: Node.js + TypeScript | Unified language with mobile; fast to build CRUD, gamification logic, and the Phase 1 admin tool | Python for everything — better AI/ML tooling, but weaker fit for general app backend work |
| 2026-08-06 | Phase 1 content: manual authoring via an internal admin tool | AI pipeline is explicitly Phase 2; the app needs content to launch with | Waiting for the AI pipeline (delays launch indefinitely); semi-automated generation (premature — no pipeline to assist yet) |
| 2026-08-06 | AI pipeline (Phase 2) will likely be a separate Python service, not part of the Node backend | Best tooling fit for Gemini/Vertex AI/ElevenLabs orchestration; isolates a batch/pipeline workload from the request-serving app | Building it in Node/TypeScript — workable but weaker ecosystem for this specific workload |

## Technical debt register
| Item | Impact | Flagged by | Status |
|---|---|---|---|
