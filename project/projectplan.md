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
| 3 | **ONBOARD-3.1** | Manager | Sonnet | The narrator beat's failure handling and stored-preference overwrite, pick-book's choose/skip races, **Profile plays the narrator's hello**, and the copy pass | 🔵 **Approved and handed off 2026-09-25** (top of `collaboration-log.md`) |
| 4 | **ONBOARD-2.1** | Pipeline Manager | Sonnet | The legal fence pinned, the three money lines pinned, an upload pre-flight, `narrate` at three attempts. **$0, no model calls** | ✅ **Signed off 2026-09-25 (14/14)**; merged as PR #62 (`6c5d8fd`). The cost-ledger lock is out of it and still open |
| 5 | **VO-4** | Pipeline Manager | Sonnet | The book narration re-paced: a proportional **1.3× time-stretch of the 144 clips already on disk**, no synthesis, no audition; the guard re-listens to the new bytes | 🔵 **Approved and handed off 2026-09-25** (top of `collaboration-log.md`). Google Cloud ≈ $0.41 expected, under a $2.75 ledger ceiling the founder confirms before the paid step |

**Sequenced deliberately** — same lesson as COVER-1/ONBOARD-1: ONBOARD-3's narrator beat cannot be
device-gated meaningfully until ONBOARD-2's clips exist. **They now do** (swap verified 2026-09-24). Full
handoffs: ONBOARD-3's is in `collaboration-log.md`, and ONBOARD-2's is in `archive/collaboration-log-activation.md`.

### Scope note for ONBOARD-3

ONBOARD-1 shipped several things differently than the original handoff assumed — three screens
registered directly on `AppStack` via `initialRouteName` rather than a separate navigator, beat 4 as an
action rather than a screen, a four-state gate. ONBOARD-3 builds on what actually shipped, and its own
handoff says so explicitly rather than re-assuming the original design.

### Out of scope, this round

- Any change to `NarrationControl`/`useNarration` inside the Leaf player — the founder's own device gate
  confirmed that path works. **The 144 existing per-Leaf narration clips were out of scope when this plan was
  approved; VO-4 (2026-09-25) brings them in, by the founder's ruling after the gate: the book clips are too
  slow.**
- A real-time or per-user text-to-speech capability.
- Redesigning `WrapUpScreen`'s core purpose or its opt-in, end-of-day framing.

### ONBOARD-3.1 — approved 2026-09-25; handed to Manager

**The founder: "go with onboard 3.1"**, after walking the device gate. The full handoff is at the top of
`collaboration-log.md`; this is what an Architect clear needs to hold.

- **Seven items, all in `apps/mobile`:** (1) the narrator beat fails open — a failed samples fetch shows
  select-only cards, a notice, *Try again* and Continue, and an old backend's 404 no longer strands anyone;
  (2) a stored narrator is not overwritten on a repeat pass (`picked ?? narrator`); (3) a playing clip stops
  when the beat is left; (4) pick-book gets one in-flight guard; (5) **Profile plays the hello — the founder's own
  gate feedback**: tap = choose and hear it, one voice at a time, stops on leaving, one preview hook shared with
  the beat so items 1 and 3 are done once for both, and Profile must not break if the samples fetch fails;
  (6) the copy pass — **my four candidate sentences stand unless the founder sends different words before the
  Manager starts**; (7) the three test soft spots.
- **Not in it:** the cost-ledger lock; `apps/pipeline`; the register row "Three pre-existing gaps ONBOARD-3 found
  and deliberately left"; the environment traps (the pre-flight now checks the shared build and detached
  watchers).
- **Gate items not yet reported by the founder, and in the handoff's gate:** one-voice-at-a-time at real tap
  speed, replay of a finished clip, hardware back.
- **What review should look at:** every fix is a hypothesis; the two state tables (a failure row, and what a
  repeat pass starts from) are the point; each new guard must be shown red before it is trusted; the preview
  must be one definition, by grep, not two copies.

### VO-4 — re-pace the book narration — approved 2026-09-25; handed to Pipeline Manager

**Design ruled by the founder: no audition and no direction re-render — "just increase words per minute
proportionately for the book clips … as long as the pace is increasing."** The handoff is at the top of
`collaboration-log.md`.

- **The finding, measured 2026-09-25 from the 144 accepted clips (speech time only):** the lessons run at a
  median **160 words a minute** (Lara 157, Druv 163; takeaway 135, summary 159, payoff 160, scenario 176; range
  108–215). The two hellos run **243 (Lara) and 260 (Druv)** — 14 words each, a noisy measure at that length — and
  the overall pace with pauses is ≈ 180 against the lessons' ≈ 120. **So the hellos are about 1.5× the lessons,
  on either measure. An earlier draft of this section said "121 vs ~230, nearly twice"; that set the cue sheet's
  overall Pace column against a speech-only figure, and was wrong.**
- **The approach:** a constant time-stretch of the raw audio already on disk, pitch preserved, in the render path
  only — **`NARRATION_TEMPO` = 1.3**, `narrate --tempo`, `render_line`'s own default left at 1.0. Proportional,
  so the slide-to-slide differences the direction file sets are kept. **No synthesis:** `narrate --no-synthesis`
  makes buying a clip impossible, so a stretched clip that fails the guard holds its Leaf instead of triggering a
  paid regeneration. The guard listens again to the new bytes; the clips attach as **drafts** (VO-2.1's flow);
  **the founder publishes the 18 Leaves in admin** after listening to ten before/after pairs. The direction file,
  the greetings and the fence do not change (the greetings' two sha256 values are pinned before and after).
- **Why 1.3×, and what it cannot do.** +30%: median 160 → ≈ 208 wpm of speech and ≈ 120 → ≈ 156 overall; the
  fastest clip ≈ 280, inside the pace check's 330. Matching the hellos would take ≈ 1.5×, which puts the fastest
  clip at ≈ 323 and is where a stretch starts to sound processed. **A stretch scales the pauses too**, so it
  lifts the overall pace but does not thin out long pauses as ONBOARD-2's re-render did. If it is still slow
  after listening: a larger factor (one constant; one more paid pass) or a direction re-render (≈ $1.5, not in
  this package).
- **Spend — Google Cloud, not Anthropic.** Only the guard's re-listening: a full cached walk is **153 listens**;
  the 191 cached listens cost $0.5104 in all (mean $0.0027), so **≈ $0.41 expected**. **Ceiling $2.75
  cumulative** on the Ikigai narration ledger ($1.8230 today; the budget reserves a listen's $0.032 worst case
  first, so **real headroom ≈ $0.90**): one full pass and one redo fit, a third does not. **The founder confirms
  the number before the paid step** (the Pipeline Manager asks, and Leaf 0 runs alone first). **One `narrate`
  process at a time** — the ledger lock is still open.
- **Free checks before any spend:** tempo 1.0 with no synthesis must reproduce today's bytes for all 144 clips
  ($0 — every one already has a cached listen under the current guard, verified 2026-09-25); a table of the
  stretch against the accepted clips (duration, pitch, speech rate, loudness, pauses; the fastest clip under the
  band); the greetings untouched.
- **Kept for later, not rejected:** an in-app speed control (1× / 1.25× / 1.5× in the Leaf player) — free,
  reader-controlled, works on every book at once; a separate small Manager change if the founder wants it.
- **Not in it:** the cost-ledger lock, a second book's narration, any mobile change, publishing, deleting Media.
