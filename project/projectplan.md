# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Active: onboarding refinement — approved 2026-09-24

**ONBOARD-1 shipped and the founder walked the real device gate for the first time** (2026-09-23/24, after
a long infrastructure detour — stale `node_modules`, a duplicated env line, `MEDIA_BASE_URL`/
`HIDE_PLACEHOLDER_CONTENT` never set for the session, both fully resolved and logged in
`collaboration-log.md`). Five findings came back. One (`Leaf narration audible`) confirmed a fix. The
other four are real product gaps, not bugs, and are the subject of this plan.

### The five findings, and what's approved for each

1. **Intro plays at the wrong moment.** Today: intro → sign-up. Approved: a new, lightweight **pre-intro**
   before sign-up (all logged-out visitors, once per install), and the **existing INTRO-1 animation,
   unchanged, moved to right after account creation** — new accounts only, first time only.
2. **The narrator beat demos a book instead of introducing itself.** Approved: each narrator gets a short,
   generic self-introduction clip instead of reading a line from whichever book was picked. This also
   resolves the reorder below, since the sample no longer needs a book chosen first.
3. **Narration's optionality is never stated.** Approved: on-screen text on the narrator beat, not only
   implied by the audio — a reader who can't or doesn't want to hear the sample still needs to see this.
4. **Beat 1's "15 minutes, one book" misleads.** Approved: rewrite toward what the mechanic actually is —
   a capped session, a book read in Leaves over many sessions, XP tracking progress across them.
5. **Nothing marks onboarding as actually complete until after the reader has read something.** Approved:
   a closing moment folded into the existing `WrapUpScreen`, reached from the Leaf player's completion panel
   (Done, or Wrap up today) the first time a reader inside the onboarding flow finishes their first Leaf. `onboarding.markSeen()` moves to fire at
   this point instead of when the reader is sent into Leaf 1, today's behaviour.

### Five decisions made explicitly, not left to guesswork

| Question | Decision | Why |
|---|---|---|
| How literal is "greet with their name"? | **Generic self-intro, no spoken name** | A live per-user TTS call is a new capability this app doesn't have anywhere else — every clip that exists was generated offline, once. Two new pre-recorded clips reuse VO-2's existing mechanism entirely |
| What is the pre-intro's content? | **INTRO-1 stays the "main" intro, unchanged; a new, lighter pre-intro gets designed** | Reuses the expensive, already-tuned, already-device-verified piece rather than redesigning it. The new pre-intro is a single static branded screen — wordmark, one line, tap to continue — not a second procedural animation |
| Does the pre-intro repeat? | **Once per install**, same as today's intro | Matches the existing pattern everywhere else in this app; avoids repeat-fatigue for a reader who signs out often |
| Where does the closing screen live? | **First-timer copy inside the existing `WrapUpScreen`**, not a new screen | `WrapUpScreen` is already the app's one "a reading moment just ended" screen. **Selected by a route param the Leaf player sets for a first Leaf reached through onboarding** — not by the `first-wrap` achievement, which unlocks when the reader *taps* wrap, after the screen has opened, and would also fire for any reader who simply hasn't wrapped yet. *Corrected 2026-09-24, before handoff, after reading `WrapUpScreen`; the first version of this plan said `first-wrap`.* No new persisted state |
| What are the narrators called? *(added 2026-09-24, during ONBOARD-2)* | **Lara (female) and Druv (male)**; the provider's voice ids — Achernar, Sadaltager — are never spoken or shown | The founder heard the first greetings say the provider's ids aloud, which the handoff had scripted, and ruled the names. The code already kept `narrator` (ZoomOut's word) apart from `voice` (the provider's); the handoff hadn't read that. **The founder's ear confirmed the final take:** pace right, "Druv" has its *v* |

### The new flow

```
Install → pre-intro (new, once/install) → sign-in/sign-up → age gate → account
  → [new accounts]      INTRO-1 (unchanged, repositioned) → promise → narrator beat → pick-book beat → Leaf 1
                         → finish first Leaf → Done / Wrap up today → WrapUp, onboarding variant → onboarding marked seen
  → [existing accounts]  narrator beat only → tab shell
```

### Two packages, sequenced

| | Package | Owner | Model | Delivers | Status |
|---|---|---|---|---|---|
| 1 | **ONBOARD-2** | Pipeline Manager | Sonnet | Two narrator self-introduction clips — **Lara and Druv** | ✅ Signed off 2026-09-24 (6/6); Media 350/351, verified |
| 2 | **ONBOARD-3** | Manager | Sonnet | Pre-intro, intro repositioning, beat reorder, the closing screen, a small backend addition to serve ONBOARD-2's clips, and one shared narrator-name map | ✅ **Signed off 2026-09-25 (17/17)** — merged as PR #61 (`b32191a`); the device gate is the founder's |
| 3 | **ONBOARD-3.1** | Manager | Sonnet | The narrator beat's failure handling and stored-preference overwrite, pick-book's choose/skip races, and the copy pass | ⬜ **Proposed 2026-09-25 — needs the founder's go, after the device gate** |
| 4 | **ONBOARD-2.1** | Pipeline Manager | Sonnet | The legal fence pinned, the three money lines pinned, an upload pre-flight, `narrate` at three attempts. **$0, no model calls** | 📤 **Handed off 2026-09-25** — approved by the founder. The cost-ledger lock is out of it |

**Sequenced deliberately** — same lesson as COVER-1/ONBOARD-1: ONBOARD-3's narrator beat cannot be
device-gated meaningfully until ONBOARD-2's clips exist. **They now do** (swap verified 2026-09-24). Full
handoffs for both are in `collaboration-log.md`.

### Scope note for ONBOARD-3

ONBOARD-1 shipped several things differently than the original handoff assumed — three screens
registered directly on `AppStack` via `initialRouteName` rather than a separate navigator, beat 4 as an
action rather than a screen, a four-state gate. ONBOARD-3 builds on what actually shipped, and its own
handoff says so explicitly rather than re-assuming the original design.

### Out of scope, this round

- Any change to the 144 existing per-Leaf narration clips, or to `NarrationControl`/`useNarration` inside
  the Leaf player — the founder's own device gate confirmed that path works.
- A real-time or per-user text-to-speech capability.
- Redesigning `WrapUpScreen`'s core purpose or its opt-in, end-of-day framing.
