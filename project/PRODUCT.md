# ZoomOut — Product Specification

Agent-facing reference. Read this in full before planning or implementing any feature. Rewritten from the founder's original brief for consistent terminology and engineering clarity — the full legal reasoning lives in `project/LEGAL.md`, not here; this file states the resulting constraints as requirements.

## What this is
ZoomOut converts non-fiction books into short, gamified, interactive lessons — positioned against passive "micro-learning" apps (Blinkist, Headway) by requiring active engagement (choices, unlocks) instead of passive summary consumption. Target user: people who already know they're spending 2+ hours/day on algorithmic social feeds and want a higher-signal alternative that fits in about 15 minutes.

## Core taxonomy — use these terms exactly and consistently
| Term | Meaning |
|---|---|
| **Track** | One book's full learning path — the complete sequence of Leaves for that book |
| **Leaf** (source brief also says "Node" — prefer "Leaf") | One atomic learning unit within a Track. A Track has 15–30 Leaves, not necessarily 1:1 with the book's own chapters |
| **Branch** | Not yet modeled. The original brief names a "Tree/Branch/Leaf" taxonomy for legal/structural-transformation purposes, but no functional spec exists for a real grouping layer between Track and Leaf. Treat Track → Leaf as the real two-level structure until a Branch requirement is confirmed |
| **Critic-in-the-Loop** | The fact-checking step (human review for Phase 1; automated for Phase 2) that verifies content against source material before it ships |
| **Dinner Table Knowledge** | The optional deep-cut fact on a Leaf's final slide — requires a stored source reference like any other generated claim |

## The Leaf structure (fixed 5-slide pattern)
1. **Summary** — short textual summary of the concept (fast/easy processing)
2. **Scenario** — a relatable real-life scenario with 3 answer options (fast/easy processing)
3. **Payoff** — unlocks only after a correct answer on slide 2; explains the concept in more depth (slow/effortful processing)
4. **Sticky notes** — key points recap, styled as sticky notes on a board
5. **Takeaway** — key takeaway plus an optional Dinner Table Knowledge fact

Slides 2 and 3 include a voiceover button. The original brief calls this "human voice over"; since ElevenLabs is named as a vendor elsewhere in the brief, this is read as natural-sounding AI-generated voice, not literally human-recorded audio — flag if that's wrong.

## Session mechanics
- Completing a Leaf advances the user along the Track.
- "Wrap up today's session" ends the day's learning and shows a shareable, aesthetic summary screen.
- A **positive-friction session cap** limits sessions to 15 minutes or 500 XP, whichever comes first. This is an intentional retention/wellbeing design constraint, not something to optimize away. When hit, show a graceful "today's limit reached" screen, not an error state.
- Achievement and session-wrap-up screens must be visually polished and built to be screenshotted and shared — this is a growth-loop mechanic, not a nice-to-have.

## Gamification
Streaks, XP per Leaf, unlockable achievements/badges, and SFX on key actions (correct/incorrect answers, Leaf completion, achievements, session wrap-up).

## App surfaces
- **Profile** — name, details, achievements, streak count
- **Explore** — search/browse books, add to library
- **Library** — added books plus per-book progress
- **Journey** — active Tracks, resume-where-you-left-off

## Content integrity & legal constraints (engineering-relevant)
These are hard requirements, not suggestions — they're the operational layer behind ZoomOut's fair-use legal position (full legal reasoning: `project/LEGAL.md`).
- Every generated fact or quote — especially Dinner Table Knowledge — needs a **stored source reference** for traceability and audit.
- Leaf/Track content must **never reproduce a book's own chapter structure or named framework 1:1**. This constrains the admin tool's data model now and any future AI pipeline output later.
- Every Track needs a **non-endorsement disclaimer** and a **purchase-forward link** to the source book (affiliate where available) on completion.
- Every Leaf needs a **"report an error" action**, routed to a fix queue with a defined SLA.
- The system must be able to **pull a Track within hours** of a verified takedown request, not weeks.
- **Age-gating** is required at signup. Exact threshold is TBD (legal owner not yet assigned) — flag if this reaches implementation before it's resolved.

## Phased scope
| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Core learning loop, gamification, all app surfaces, manual content authoring via an internal admin tool | Current focus |
| **Phase 2** | AI content pipeline — book → Leaf generation via Gemini (Vertex AI) and ElevenLabs for voice | Not started |
| **Phase 3** | Social — groups, journey/streak sharing (working name "Reading Circles") | Not started |

Phase 1 deliberately does not require the AI pipeline or social features. Content for launch comes from manual authoring through the admin tool.

## Tech stack (decided)
- **Mobile:** React Native + Expo, TypeScript
- **Backend:** Node.js + TypeScript
- **Database:** PostgreSQL
- **AI vendors (Phase 2):** Gemini via Vertex AI, ElevenLabs
- **Hosting:** Google Cloud Platform (co-locates with Vertex AI)

Reasoning is in `project/projectRoadmap.md`'s decisions log.

## Open items — not yet decided
- **Monetization model** — subscription, one-time, or platform in-app purchase. Not described in the original brief; needed before any billing work starts.
- **Branch grouping layer** — confirm whether this is a real data-model requirement or legal-framing language only.
- **Content Curation Policy** and **minor-protection age threshold** — both explicitly owner-TBD in the legal brief; pre-launch blockers.
- **Subscription/trial compliance, data privacy (GDPR/CCPA and vendor DPAs), content moderation** — all flagged as pre-launch legal blockers in the original brief. Not engineering-started, but the app should not ship without these resolved.
