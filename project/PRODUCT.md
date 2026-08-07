# ZoomOut — Product Specification

Agent-facing reference. Read this in full before planning or implementing any feature. Rewritten from the founder's original brief for consistent terminology and engineering clarity — the full legal reasoning lives in `project/LEGAL.md`, not here; this file states the resulting constraints as requirements.

## What this is
ZoomOut converts non-fiction books into short, gamified, interactive lessons — positioned against passive "micro-learning" apps (Blinkist, Headway) by requiring active engagement (choices, unlocks) instead of passive summary consumption. Target user: people who already know they're spending 2+ hours/day on algorithmic social feeds and want a higher-signal alternative that fits in about 15 minutes.

## Core taxonomy — use these terms exactly and consistently
| Term | Meaning |
|---|---|
| **Track** | One book's full learning path — the complete sequence of Leaves for that book |
| **Leaf** (source brief also says "Node" — prefer "Leaf") | One atomic learning unit within a Track. A Track has 15–30 Leaves, not necessarily 1:1 with the book's own chapters |
| **Branch** | Not modeled — resolved 2026-08-06. The original brief's "Tree/Branch/Leaf" wording was legal framing, not a functional requirement. **Track → Leaf is the real two-level structure**, and the original-structure argument rests on Leaves not mapping 1:1 to the book's chapters. Do not add a grouping layer without a new decision |
| **Critic-in-the-Loop** | The fact-checking step (human review for Phase 1; automated for Phase 2) that verifies content against source material before it ships |
| **Dinner Table Knowledge** | The optional deep-cut fact on a Leaf's final slide — requires a stored source reference like any other generated claim |

## The Leaf structure (fixed 5-slide pattern)
1. **Summary** — short textual summary of the concept (fast/easy processing)
2. **Scenario** — a relatable real-life scenario with 3 answer options (fast/easy processing)
3. **Payoff** — unlocks only after a correct answer on slide 2; explains the concept in more depth (slow/effortful processing). **Wrong answers retry without limit** (decided 2026-08-06) — with only 3 options nobody is permanently blocked, so the stakes live in XP rather than access
4. **Sticky notes** — key points recap, styled as sticky notes on a board. **2–6 notes** (ruled at the schema-freeze gate, 2026-08-08); revisit when the visual design direction lands
5. **Takeaway** — key takeaway plus an optional Dinner Table Knowledge fact

Slides 2 and 3 include a voiceover button. **Confirmed 2026-08-06:** "human voice over" in the original brief means AI-generated audio in a natural human-sounding voice (ElevenLabs), not literally human-recorded narration.

**Voiceover is deferred to Phase 2** (decided 2026-08-06). Phase 1 ships without audio; the Leaf schema still reserves a per-slide audio reference so enabling it later is a data migration, not a redesign.

## Session mechanics
- Completing a Leaf advances the user along the Track.
- "Wrap up today's session" ends the day's learning and shows a shareable, aesthetic summary screen.
- A **positive-friction session cap** limits sessions to 15 minutes or 500 XP, whichever comes first. This is an intentional retention/wellbeing design constraint, not something to optimize away. When hit, show a graceful "today's limit reached" screen, not an error state. Decided 2026-08-06: the cap is **server-authoritative** (never client-trusted), resets at the user's **local midnight**, and lets an in-progress Leaf finish rather than cutting mid-Leaf.
- Achievement and session-wrap-up screens must be visually polished and built to be screenshotted and shared — this is a growth-loop mechanic, not a nice-to-have.

## Gamification
Streaks, XP per Leaf, unlockable achievements/badges, and SFX on key actions (correct/incorrect answers, Leaf completion, achievements, session wrap-up).

Decided 2026-08-06:
- **Streak** — maintained by completing ≥1 Leaf in a day, evaluated in the user's local timezone. No streak freezes/repairs in Phase 1.
- **XP** — flat award per Leaf plus a first-try-correct bonus. Calibrate so the 500 XP cap lands at roughly 5 Leaves/day, making a 20-Leaf Track about a 4-day journey.
- **Leaf pacing** — a Leaf is **~3 minutes to consume**, so a capped session is about 5 Leaves. This sets the length budget for slide copy, and is what keeps the 500 XP cap a real second constraint instead of dead weight behind the 15-minute limit.

## App surfaces
- **Profile** — name, details, achievements, streak count
- **Explore** — search/browse books, add to library
- **Library** — added books plus per-book progress
- **Journey** — active Tracks, resume-where-you-left-off

## Content integrity & legal constraints (engineering-relevant)
These are hard requirements, not suggestions — they're the operational layer behind ZoomOut's fair-use legal position (full legal reasoning: `project/LEGAL.md`).
- Every generated fact or quote — especially Dinner Table Knowledge — needs a **stored source reference** for traceability and audit. A reference carries a required `note` **plus at least one locator** (chapter, page, or quote) — a note alone describes where a claim came from without letting anyone check it (ruled 2026-08-08).
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
| **Phase 4** | Monetization | Not started — deliberately last (decided 2026-08-06) |

Phase 1 deliberately does not require the AI pipeline or social features. Content for launch comes from manual authoring through the admin tool.

**Phase 1 launch library — 3 books** (decided 2026-08-06). Kept small because every Leaf is hand-authored by a solo founder with no AI pipeline. See Open items for the curation status of individual titles.

**Phase 1 platform & account decisions** (2026-08-06): iOS first with Android close behind (Expo makes both cheap; polish effort concentrates on iOS). Auth via email, Sign in with Apple, and Google — Apple is mandatory once Google is offered. No guest mode. **Online-only** — offline sync is deferred as too large an architecture cost for the MVP.

## Tech stack (decided)
- **Mobile:** React Native + Expo, TypeScript
- **Backend:** Node.js + TypeScript
- **Database:** PostgreSQL
- **AI vendors (Phase 2):** Gemini via Vertex AI, ElevenLabs
- **Content CMS (Phase 1 authoring):** Payload 3.x, self-hosted. Note: Payload 3 requires Next.js, so `apps/admin` deploys as its own container with pinned versions — Next.js must not leak into `apps/backend` or `apps/mobile`
- **Hosting:** Google Cloud Platform (co-locates with Vertex AI)

Reasoning is in `project/projectRoadmap.md`'s decisions log.

## Open items — not yet decided
- **Monetization model** — subscription, one-time, or platform in-app purchase. Deferred to Phase 4 (decided 2026-08-06), so it blocks nothing in Phase 1. Still undecided when that phase starts.
- **Launch library curation** — "The Mountain Is You" is clear. "Atomic Habits" and "Thinking, Fast and Slow" are both flagged against the `LEGAL.md` curation criteria and need verification or replacement before authoring starts.
- **Content Curation Policy** and **minor-protection age threshold** — both explicitly owner-TBD in the legal brief; pre-launch blockers.
- **Subscription/trial compliance, data privacy (GDPR/CCPA and vendor DPAs), content moderation** — all flagged as pre-launch legal blockers in the original brief. Not engineering-started, but the app should not ship without these resolved.
