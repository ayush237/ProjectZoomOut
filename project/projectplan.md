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
| 4 | **ONBOARD-2.1** | Pipeline Manager | Sonnet | The legal fence pinned, the three money lines pinned, an upload pre-flight, `narrate` at three attempts. **$0, no model calls** | ✅ **Signed off 2026-09-25 (14/14)**; merged as PR #62 (`6c5d8fd`). The cost-ledger lock is out of it and still open |

**Sequenced deliberately** — same lesson as COVER-1/ONBOARD-1: ONBOARD-3's narrator beat cannot be
device-gated meaningfully until ONBOARD-2's clips exist. **They now do** (swap verified 2026-09-24). Full
handoffs: ONBOARD-3's is in `collaboration-log.md`, and ONBOARD-2's is in `archive/collaboration-log-activation.md`.

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

### ONBOARD-3.1 — proposed 2026-09-25, awaiting the founder's go (after the device gate)

**Not approved.** Manager, Sonnet. Written down so that an Architect clear loses nothing: the analysis lives in
the register rows named below and in ONBOARD-3's review. **Every fix here is a hypothesis to verify, not a
specification.**

1. **The narrator beat fails open.** A failed samples fetch shows `ErrorState` with only *Try again*, and an old
   backend answers 404, so backend-before-mobile is a hard deploy order. The fix I believe in: on a fetch
   error still show the beat (cards inert, or descriptor-only as Profile does) with **Continue** —
   `narratorOnly` marks seen and lands on Tabs, `full` goes to pick-book — as the onboarding gate itself fails
   open. A missing or unplayable greeting must not be a dead card either (`playbackFailed` is not surfaced
   there). *Register: "The narrator beat has no graceful failure".*
2. **A stored narrator is not overwritten.** `selected` is seeded from `DEFAULT_NARRATOR` and Continue writes it
   back, so a repeat pass — reachable through the accepted quit-mid-first-Leaf design — silently reverts the
   reader's choice. Fix: seed from the stored narrator and write only if the reader tapped a card. *Register:
   "The narrator beat's choice and audio handling", (a).*
3. **Audio stops on Continue.** In `full`, Continue *pushes* pick-book over the beat, so a clip still playing
   finishes over the next screen. *(b).* The one-voice rule keying on `playing` (c) and replay of a *finished*
   clip (d) are in only if the founder hears them at the gate.
4. **Pick-book races.** `busy` disables only the pressed card: Skip and the other card stay live across
   `addToLibrary` and `listLibrary`, a late `reset` can put a reader who skipped into `[Tabs, LeafPlayer]`, and
   two Choose taps add both books. Fix: one in-flight guard, and ignore a completion once the screen has been
   left. *Register: "Pick-book: `choose` and `skip` race".*
5. **Three soft spots in ONBOARD-3's tests:** an absence assertion that cannot tell "not mounted" from "still
   loading", fixtures cast through `unknown`, and no test of audio stopping on Continue.
6. **The copy pass**, in one commit, with whatever the founder edits at the gate. Candidates, as whole
   sentences:
   - *Promise* (a Leaf does not end on the question — it is slide 2 of 5): **Each one asks you a question only
     you can answer, so you're thinking rather than skimming.**
   - *Narrator beat* (only Ikigai has narration today, and slide 4 has no voice button): **Leaves can be read
     aloud, if you'd like. Tap a card to hear each narrator say hello.**
   - *Explore, first-run* (`ExploreScreen.tsx`, the line beginning "Add one below"): **Add a book below to get
     started — you'll read it in short lessons, over many sessions.**
   - *Explore, empty catalogue* (the line beginning "Tracks arrive here"): **Tracks arrive here once there are
     books to read. Each one turns a non-fiction book into short lessons built around active recall.**

   Grepped 2026-09-25: the two Explore strings are the only reader-facing "a book in fifteen minutes" claims in
   `apps/` and `packages/`, and no test pins either. The share card's footer, "15 minutes a day", is a habit
   claim consistent with the session cap, not this framing.

7. **Profile plays the narrator's hello** — the founder's gate feedback, 2026-09-25: *"the narrator sounds are
   not being played in the profile section."* **Not a defect:** ONBOARD-3's handoff said Profile has no sample to
   play and gave it a descriptor instead; the founder now wants the sound. Design I would propose: **tap a tile
   = choose it and hear its hello**, exactly as on the beat, so the reader hears who they just picked; one voice
   at a time; leaving Profile stops it. **Reuse:** extract the beat's preview logic (`getNarratorSamples`, two
   `useNarration` players, the one-voice rule) into one hook both screens use, so items 1 and 3 (fail open, stop
   audio) are fixed once for both. **Profile must not break if the samples fetch fails:** the tiles behave as they
   do today (select only), no error screen. Alternative for the founder: a separate play button per tile, so
   choosing stays deliberate; the default is consistency with the beat. Tests through the real screen: a tile
   press selects *and* plays, the other stops, and with no samples it still selects.

**Out of it:** the cost-ledger lock, and anything in `apps/pipeline`; and the pre-existing gaps in the register
row "Three pre-existing gaps ONBOARD-3 found and deliberately left" ("Back to Journey", the per-install
onboarding flag, `AppStack`'s five other routes ignoring Reduce Motion).

**When the handoff is written:** cite ONBOARD-3 by commit (`b32191a`, its merge; the completion report is in
`collaboration-log.md` or `git show b32191a:project/collaboration-log.md`), not by location. The persona rules
that apply: a state table draws its failure rows and says what a repeat pass starts from (the omission behind
items 1 and 2), and the device gate names observations, not commands.

### VO-4 — re-pace the book narration — proposed 2026-09-25, awaiting the founder's go

**Not approved, and nothing is spent until the founder gives a ceiling.** Pipeline Manager, Sonnet (procedural;
the founder's ear is the judge). *Google Cloud spend, not Anthropic.*

**The finding, measured 2026-09-25 from the Ikigai review cue sheets** (`runs/ikigai/audio/review/`, 72 clips
per narrator): the book clips speak at a median of **121 words a minute of speech (Lara) and 119 (Druv)**,
pauses excluded. By slide: takeaway ~97, summary ~116, payoff ~122, scenario ~132. **The accepted intro speaks at
~226–232** (take 3, the one the founder called too slow, was 182–187; the accepted take is +24% on it). **So "like
the intro" is nearly twice as fast as the lessons.** That is probably faster than teaching should go; "slightly
faster" is a target to pick **by ear**, and my expectation is ~150–170. ONBOARD-2's lesson stands: the numbers
were a poor guide to what "slightly" meant, and the founder's ear settled it.

**Why the lessons are slow:** `narration_direction.md` says *"natural and unhurried"* (shared), *"a little
slowly"* (scenario) and *"a little more slowly"* (takeaway). ONBOARD-2 measured that removing "a little slowly"
moved articulation **+24%** and removed the long pauses ("a little slowly buys pauses, not just a slower voice"),
and that the direction is *nearer a switch than a dial*.

**Stage 1 — audition (about $0.10).** Render one representative Leaf's four fields, both narrators, under three
directions: the current one (control), A = the slow wording removed everywhere, B = A plus an explicit
brisk-but-warm phrase. B must obey the direction file's rules (describe delivery, no colons, no lists, no quoted
words, no conversational framing). `audition-voices` has no way to take another direction today (`--undirected`
only), so this adds a small `--direction-file` option. Output: a review page with measured wpm, overall speed and
longest pause per clip. **Ceiling: $2.25 cumulative.** The Ikigai narration ledger closed at **$1.8230** of $3.00
(VO-2.1), and `NarrationBudget` reserves a call's worst case ($0.164) before every call, so **$2.25 buys about
$0.26 of real spend, 30-odd clips**, of which the audition needs ~16. The founder listens and picks, or asks for
another round.

**Stage 2 — only after the founder picks by ear.** Apply the chosen direction to `narration_direction.md`
(**coupling:** a test asserts the greeting file's first paragraph equals the `## shared` block, so if `shared`
changes the greeting file follows; the uploaded greetings are NOT re-rendered), then re-render all 144 clips with
`narrate --render-only --max-attempts 3`. **Estimate ~$1.5, at most ~$2** (VO-2 spent $1.79 on 183 renders; this is
144 plus retries; no Leaf clip has been rendered since, so it is an estimate). **Ceiling ~$4.25 cumulative**, about
$2.1 of real headroom after the audition. The founder spot-checks the review track, then the clips are attached as
drafts (VO-2.1's flow) and **the founder publishes 18 Leaves in admin**. The old Media stays orphaned (the machine
key cannot delete it; harmless). Book #3 and every later book inherit the pace, so this belongs **before** book #3's
narration.

**Alternatives.** (i) *Time-stretch the cached raw audio* — no synthesis, a true dial (x1.25 turns 121 into ~151
wpm), but less natural (pauses shrink with the speech) and it still needs a guard re-listen (~$0.3) and the same
attach and publish. (ii) *An in-app speed control* (1x / 1.25x / 1.5x in the Leaf player) — free, reader-controlled,
works on every book at once, and pairs well with a direction change because the direction is a switch and a speed
control is the dial. It is a separate small Manager change; the founder's call whether to want it.

**Decisions for the founder:** go on stage 1 with a **$2.25** ceiling; whether to also want the speed control;
the target pace, by ear, at stage 1. **Not in it:** the cost-ledger lock (one `narrate` process at a time until it
exists), the greetings, and any mobile change.

