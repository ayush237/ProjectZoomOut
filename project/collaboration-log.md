# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.

**Give every entry a `### Handoff:` or `### Completed:` header.** Two completion reports — VO-1.1's and
VO-2's — were appended without one and were invisible to a structural scan of this file for weeks. The
headers were restored on 2026-09-18; the bodies were never touched. An entry with no header is not on a
list anyone reads.


> **What stays here: the closing package of the current milestone, plus anything the next package builds
> directly on, plus any handoff whose package is still open.** Never fewer than two entries per section.
>
> **This replaced a "four most recent" rule on 2026-09-22**, which had become a bad proxy. Packages in
> this project run 200–700 lines each, so "four" meant carrying two closed milestones' worth of detail —
> ~20k tokens of reports nobody was reading — while the thing that actually matters is whether the next
> package needs it. The open-handoff exception is unchanged and still absolute: pruning a live handoff is
> how WP28 lost time.
>
> **Archive at each sign-off, not when it hurts**, and never while a session is mid-package.
>
> **Everything older is archived**, in git and readable, simply not loaded by default:
> Phase 1 (WP0–WP15) in `project/archive/collaboration-log-phase1.md` ·
> Phase 2 in `project/archive/collaboration-log-phase2.md` ·
> the visual redesign and the first two books in `project/archive/collaboration-log-redesign.md` ·
> WP29–WP33.1 plus VO-1 and VO-2's handoff in `project/archive/collaboration-log-ikigai.md` ·
> **VO-1.1, VO-2 and VO-2.1 — voiceover's schema, generation and attachment — in
> `project/archive/collaboration-log-voiceover.md`** (split 2026-09-22, at VO-3's merge) ·
> **INTRO-1, VO-3, PILOT-1, COVER-1, ONBOARD-1 and ONBOARD-2 — the intro, the player, the pilot build, the covers and the first-run flow — in
> `project/archive/collaboration-log-activation.md`** (split 2026-09-25, at ONBOARD-2.1's sign-off).

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

### Handoff: 2026-09-25 — ONBOARD-3.1: the narrator beat fails open, Profile plays the hello, pick-book stops racing itself, and the copy pass

*Manager. Approved by the founder 2026-09-25 ("go with onboard 3.1"). `apps/mobile` only: no backend, shared-package or pipeline change.*

> **Where you work:** reuse `/Users/ayushgupta/Documents/ZoomOut/ZO-vo3`. Check your branch first (it may still be on `onboard-3-flow-refinement`, merged). `git fetch origin && git checkout -b onboard-3-1-narrator-hardening origin/main`. **Never `git checkout main` in a linked worktree.** **Before any device work run `npm run build --workspace=packages/shared`:** the app resolves `@zoomout/shared` from `packages/shared/dist`, which is gitignored and which a pull does not rebuild (the founder's phone crashed on exactly this on 2026-09-25). **Commit, push and open the PR yourself when done.**
> **Read:** this handoff · ONBOARD-3's completion entry, `### Completed: ONBOARD-3 — pre-intro, intro repositioning, beat reorder, and the closing screen` in `project/collaboration-log.md` (it is also at `git show b32191a:project/collaboration-log.md`) — its sections "The `markSeen()` table, as built" and "Decisions the handoff left to me, and why" · the five register rows named below, in `project/projectRoadmap.md` (find them by title; **do not read the register end to end**) · `project/LEGAL.md`, the "Narration" section · `apps/mobile/src/screens/onboarding/` (`OnboardingNarratorScreen.tsx`, `OnboardingPickBookScreen.tsx`, `OnboardingPromiseScreen.tsx`, and `useOnboardingGate.ts` for its "Fails open, deliberately" comment) · `apps/mobile/src/screens/ProfileScreen.tsx` (`NarratorCard`) · `apps/mobile/src/screens/ExploreScreen.tsx` · `apps/mobile/src/audio/useNarration.ts` (read `safely`'s comment — it was found on a real Android device, not in a test — and the docstring on why the hook takes a required `entry`) · `apps/mobile/src/screens/useAsyncResource.ts` · `apps/mobile/src/testing/fakeExpoAudio.ts` · `agents/manager.md`.

### Task: ONBOARD-3.1 — the narrator beat fails open, Profile plays the hello, pick-book stops racing itself, and the copy pass
**Suggested model:** Sonnet — every fix is named and its reasoning is in the register rows; what is left is implementing against contracts you verify. The risk (a guard that passes for the wrong reason) is covered by a written procedure: each new guard is shown failing before it is trusted.
**Context:** The founder walked ONBOARD-3's device gate on Android on 2026-09-25. The flow works. Review of ONBOARD-3 had already found five gaps outside its criteria, and the founder added one request: *"the narrator sounds are not being played in the profile section."* That is not a defect — ONBOARD-3's handoff said Profile has no sample to play — it is a feature the founder now wants. (The gate also hit two environment traps, a stale `packages/shared/dist` and orphaned backend watchers; both are now in `GETTING_STARTED.md`'s pre-flight and are outside this package.) Register rows, by title: "The narrator beat has no graceful failure", "The narrator beat's choice and audio handling", "Pick-book: `choose` and `skip` race", "ONBOARD-3's tests: three soft spots", "First-run copy: two "fifteen minutes" lines and two factual slips".
**Objective:** (1) the narrator beat never strands a reader; (2) it stops overwriting a stored narrator; (3) a playing clip stops when the beat is left; (4) pick-book cannot race itself; (5) Profile plays each narrator's hello; (6) the copy pass; (7) the three test soft spots closed. Each new guard is shown failing before it is trusted.
**Scope:** `apps/mobile` only — `screens/onboarding/OnboardingNarratorScreen.tsx` and `OnboardingPickBookScreen.tsx` (behaviour), `OnboardingPromiseScreen.tsx` (one sentence), `screens/ProfileScreen.tsx` (`NarratorCard`), `screens/ExploreScreen.tsx` (two strings), a new shared hook or component for the preview (place it where it fits, `audio/` or `screens/onboarding/`), `testing/firstLeaf.ts`, and the tests beside each. **Verify, don't trust:** find every site by symbol.
**Requirements:**

*Part 1 — the beat fails open.* **The onboarding gate fails open on purpose** (`useOnboardingGate.ts`: "Fails open, deliberately" — a failed Library read is treated as *seen*, so the flow can never lock a reader out of the app); the narrator beat must behave the same way. State table — **pin every row with a test**:

| Situation | The beat shows | Continue does |
|---|---|---|
| samples loading | the spinner, as today | — |
| samples ready | two playable cards | `narratorOnly`: marks seen, lands on Tabs. `full`: goes to pick-book, marks nothing |
| **samples fetch fails** (network error, 4xx, 5xx, an old backend's 404) | **the beat anyway:** both cards, **select-only** — a tap chooses that narrator, nothing plays, no play icon — one line saying the hellos could not load, a *Try again* control, and **Continue** | exactly as in the row above, with the current choice kept |
| Try again succeeds | the cards become playable | unchanged |
| a greeting will not play (missing file, decode error) | that card shows a visible "couldn't play" state after the tap (`useNarration` already reports `playbackFailed`; the beat never surfaced it) | unchanged |

*The fix I believe in — a hypothesis to verify:* keep the picker's hooks in a child mounted only when samples exist (hooks cannot be conditional, and `useAudioPlayer` creates its player once from its first source — `useNarration`'s docstring says why), and render a plain select-only branch otherwise (the same cards with no player behind them — Profile's tiles are that today).

*Part 2 — a stored narrator is not overwritten.* `selected` is seeded from `DEFAULT_NARRATOR` and Continue writes it back, so a repeat pass silently reverts the reader's choice. **What the repeat pass starts from, stated:**

| Repeat pass | Pre-selected | Continue writes |
|---|---|---|
| a narrator is stored (chosen on the beat before quitting mid-first-Leaf, or in Profile) | the stored one | nothing, unless the reader tapped a card |
| nothing stored | the default (Druv) | nothing needs writing — the default is what `useNarrator` reads |

*Hypothesis:* `const selected = picked ?? narrator` (where `picked` is `null` until a tap and `narrator` is `useNarrator`'s value, which restores asynchronously), and write only when `picked !== null`.

*Part 3 — audio stops when the beat is left.* In `full`, Continue *pushes* pick-book over the beat, so the beat stays mounted and a clip still playing finishes over the next screen. A clip that is playing when Continue is tapped, or when the beat loses focus for any reason, must stop. *Hypothesis:* pause on blur (`useFocusEffect` or a `blur` listener), using the hook's existing `toggle` for a player that reports `playing` — **do not change how `useNarration` behaves**, it also drives the Leaf player. Name in your report the limit you inherit: `playing` turns true only once audio is flowing, so a clip still buffering is not stopped.

*Part 4 — pick-book cannot race itself.* `busy` disables only the pressed card, so Skip and the other card stay live across `addToLibrary` and `listLibrary`: Choose then Skip lands on Explore with the flag set and then a late `reset` puts the reader into `[Tabs, LeafPlayer]` anyway; two Choose taps add both books. **One in-flight guard for the whole screen:** while a choose is pending every card and Skip is inert; and a completion that arrives after the screen has been left (hardware back) does nothing.

*Part 5 — Profile plays the hello.* The founder's request. **Tap a tile = choose that narrator and hear its hello**, exactly as on the beat, one voice at a time.
- Reuse, do not copy: extract the beat's preview logic — `getNarratorSamples`, the two `useNarration` players, the one-voice rule, stop-on-blur — into **one hook or component both screens use**, so Parts 1 and 3 are done once for both.
- **Profile must not break if the samples fetch fails:** the tiles behave exactly as they do today (select only). No error screen, no blocking notice.
- The tiles show the beat's play/pause icon (the beat's card is an `Icon` over the bare name) so the hello is discoverable; with no samples they show none, exactly as today. `testID`s (`narrator-option-<id>`) and accessibility labels ("Lara, female voice") do not change; an `accessibilityHint` ("plays a short hello") is welcome, since the beat's label already says "Tap to hear a hello". Leaving Profile (a tab switch) and unmounting stop any clip.
- Update `NarratorCard`'s docstring — it says Profile has nothing to play.
- The samples endpoint is authenticated and Profile is only reachable when signed in; fetch once per mount, not on every focus.

*Part 6 — the copy pass.* Exact strings, matching each file's existing escaping (JSX text uses `&rsquo;`):
- `OnboardingPromiseScreen.tsx`, `onboarding-promise-leaves`: *"Each one ends with a question only you can answer, so you're thinking rather than skimming."* → **"Each one asks you a question only you can answer, so you're thinking rather than skimming."** A Leaf does not end on the question; it is slide 2 of 5.
- `OnboardingNarratorScreen.tsx`, the first line under the title: *"Every Leaf can be read aloud, if you'd like. Tap a card to hear each narrator say hello."* → **"Leaves can be read aloud, if you'd like. Tap a card to hear each narrator say hello."** Only Ikigai has narration today, and slide 4 has no voice button.
- `ExploreScreen.tsx`, `explore-first-run`: *"Add one below to get started — about fifteen minutes, one book at a time."* → **"Add a book below to get started — you'll read it in short lessons, over many sessions."**
- `ExploreScreen.tsx`, the empty-catalogue `body`: *"…Each one turns a non-fiction book into about fifteen minutes of active recall."* → **"Tracks arrive here once there are books to read. Each one turns a non-fiction book into short lessons built around active recall."**
- **Everything else drafted in ONBOARD-3 stays as it is** (the pre-intro line, the promise's second paragraph, the narrator beat's second line, the closing). The founder raised nothing about them. **If the founder sends different words before you start, theirs supersede these.** Update any test that pinned an old string; no test pinned either Explore string.

*Part 7 — the three test soft spots.* (a) `navigation.test.tsx`'s "Explore not mounted" assertion cannot tell that from "still loading": wait for the load to resolve, or assert the positive alternative. (b) `testing/firstLeaf.ts` casts its fixtures through `unknown`, so a change in the Leaf's shape will not surface: type them so it does. (c) A test that audio stops on Continue (Part 3).

**Out of scope:**
- Any backend, `packages/shared` or `apps/pipeline` change; the environment traps.
- **How `useNarration` and `NarrationControl` behave inside the Leaf player.** The founder's own gate confirmed that path.
- The one-voice rule's buffering-window limit and replay of a *finished* clip: not reported at the gate. If you see either, report it; do not fix it here.
- The pre-existing gaps in the register row "Three pre-existing gaps ONBOARD-3 found and deliberately left" ("Back to Journey", the per-install onboarding flag, `AppStack`'s five other routes ignoring Reduce Motion).
- INTRO-1, the pre-intro, the closing screen, the `markSeen()` table (unchanged: keep every row pinned), and anything that changes what an existing account sees beyond the narrator beat and Profile.
- **No new persisted state of any kind**, and no new route params.

**Constraints:**
- **The boundary (`LEGAL.md`, "Narration"):** the app plays two fixed clips ONBOARD-2 produced, served by `/content/narrator-samples` (authenticated). Nothing in the app can synthesise speech, and the TTS provider's voice ids (Achernar, Sadaltager) never appear on a screen or in an accessibility label; the reader-facing names come from `NARRATOR_LABELS` (`packages/shared/src/content.test.ts` already pins that they do not leak).
- **The fixes named here are hypotheses:** Part 1's structure, Part 2's `picked ?? narrator`, Part 3's blur mechanism, Part 5's extraction. Verify each against the code first, and say so if the code disagrees.
- Reduce Motion: no new animation. Theme tokens only; check both themes.
- **Mutation discipline, as you have been doing it:** every new guard is broken on purpose, watched red, and restored byte for byte; wherever two changes could each explain a green test, revert them separately.
- Counts against the baseline — **mobile 770, backend 533, shared 80, admin 204** (ONBOARD-3, confirmed from CI's own logs) — and reconcile any drop. Root `build` needs `PAYLOAD_SECRET` and `PAYLOAD_DATABASE_URL` in a fresh worktree; CI sets both.

**Device gate:** *(Android, Expo Go, the founder's Mac. Run the pre-flight in `GETTING_STARTED.md` first — it now also checks the shared build and detached watchers — and clear Expo Go's storage. You verify rendering and state on the iOS simulator and cannot hear; timing and sound go to the founder.)*
- **Fails open.** Sign up with the backend up, then **stop the backend (Ctrl+C in its terminal) on the promise screen** and tap Continue: the narrator beat still appears, with the notice, select-only cards and Continue, a tap on a card still chooses it, and Continue takes you on. Restart the backend and tap *Try again*: the cards become playable.
- **A stored choice survives.** Pick Lara on the beat, quit the app mid-first-Leaf, relaunch: the repeat beat has Lara pre-selected, Continue keeps her, and Profile shows Lara.
- **Audio stops.** Tap a card and then Continue at once: the clip does not carry on over pick-book.
- **Pick-book.** Tap a book: while it resolves, Skip and the other book do nothing.
- **Profile.** Tap Lara: you hear her hello and she becomes the selected tile; tap Druv: Lara stops and Druv plays; switch tab: it stops. With the backend stopped the tiles still select.
- **The copy.** The four strings read as above.
- **Hardware back.** Press it on pick-book, and on the narrator beat while a clip plays: no clip carries on, and nothing lands in the wrong place.
- **Two things I could not check, so please look:** tap a card again *after* its clip has finished (does it replay?), and tap the second card while the first is still starting up.

**Acceptance criteria:**
- [ ] Each row of Part 1's table is pinned by a test through the real screen; a samples failure of every kind (network error, 404, 500) shows the select-only beat with its notice, *Try again* and Continue, a card tap still chooses, and Continue works for **both** variants through `RootNavigator`'s real gate (`narratorOnly` marks seen and lands on Tabs; `full` goes to pick-book and does **not** mark seen)
- [ ] *Try again* after a failure re-fetches and makes the cards playable; a greeting that fails to play shows a visible failed state on that card while Continue still works
- [ ] Stored narrator `female` + Continue without a tap leaves the store at `female`; tapping Druv then Continue stores `male`; both **read from the store afterwards**, not inferred
- [ ] Continue while a clip is playing stops it (the fake player's `playing` is false afterwards); the buffering-window limit is named in the report
- [ ] Pick-book: while a choose is in flight Skip and every card are inert; two rapid taps add exactly one book; a completion after the screen is left performs no `reset` — each pinned through the real screen
- [ ] Profile: a tile press selects **and** plays that narrator's sample; the other stops; a tab switch and unmount stop it; with the samples fetch failing the tiles still select, nothing throws and no error screen appears; `testID`s and accessibility labels are unchanged
- [ ] The beat and Profile share **one** implementation of the preview — a grep shows a single definition of the one-voice rule and a single consumer of `getNarratorSamples` logic, not two copies
- [ ] The four copy strings match exactly; a grep of `apps/` and `packages/` for "fifteen minutes" finds no reader-facing "a book in fifteen minutes" (the promise's "A session lasts up to fifteen minutes" is the cap and stays); tests that pinned an old string are updated
- [ ] The three test soft spots are closed, and the new audio-stops test is red when the stop is removed
- [ ] Every new guard is in a mutation table in the report (breakage → the tests that went red), each restored byte for byte
- [ ] No backend, `packages/shared` or `apps/pipeline` file changed and no persisted state was added: `git diff --stat origin/main` shows only `apps/mobile` and your completion entry
- [ ] `npm run lint`, `typecheck`, `test` and `build` pass, with counts against 770 / 533 / 80 / 204 and any drop reconciled
- [ ] The report says which device-gate items you verified on the simulator and which wait for the founder's ear and Android

**Testing expectations:** **Tier A** for Part 1's table, Part 2's stored-narrator rule, Part 4's guard and Part 5's audio — these are the shape of bug that ships quietly (a reader stranded, a preference silently reverted, a Skip that lands in a Leaf). Go through `RootNavigator`'s real gate wherever a flag or route is involved, and use `fakeExpoAudio` for the players. Tier B for the copy and rendering. Say which evidence is a unit test, which is a mutation, and which is you looking at the simulator.

---

### Handoff: 2026-09-25 — VO-4: speed up the book narration with a proportional time-stretch of the clips already on disk

*Pipeline Manager. Approved by the founder 2026-09-25 ("let's not take any audition, just increase words per minute proportionately for the book clips"). **The only money in it is Google Cloud** — the guard listening to the new clips, **expected ≈ $0.41** — under a ceiling **the founder confirms to you in your session before that step**. **No speech is synthesised.***

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Check your branch first** — the worktree is on `onboard-2-1-fence-and-cap` (PR #62, merged as `6c5d8fd`); leave that branch alone. `git fetch origin && git checkout -b vo-4-narration-tempo origin/main`. **Never `git checkout main` in a linked worktree.** **`runs/` is git-ignored and holds everything already paid for: never clean, prune, move or overwrite a file under `runs/ikigai/audio/raw/`, `final/` or `checks/`.** Commit, push and open the PR yourself when done.
> **Read:** this handoff · `project/LEGAL.md`, the whole "Narration" section (the fence does not change) · `apps/pipeline/src/zoomout_pipeline/graph/narration_nodes.py`, the whole file · `assets/audio.py` (`level`, `shape_edges`, `EdgeReport`, `measure`, `ClipMetrics`) · `assets/narration_guard.py` (`speaking_rate`, `pace_is_natural`, the 100–330 band) · `assets/review_track.py` (what reads the edge report) · `cli.py`'s `narrate` command and `_Narration` · `tests/test_attempt_defaults.py` (how a default is pinned everywhere it is stated), `tests/test_narration_write.py`, `tests/narration_fakes.py` · `graph/greeting_nodes.py`'s module note (why its render is a *sibling* of `_render_attempt`; you will not touch it) · `apps/pipeline/README.md`, `narrate`'s section · ONBOARD-2.1's completion entry (merge `6c5d8fd`; in `project/collaboration-log.md`) for the fence and the `$0` discipline · VO-2.1's completion in `project/archive/collaboration-log-voiceover.md` (the first live attach: 144 = 18 Leaves × 4 slides × 2 narrators, ledger closed at $1.8230) · `agents/pipeline-manager.md`.

### Task: VO-4 — speed up the book narration with a proportional time-stretch of the clips already on disk
**Suggested model:** Sonnet — the design is here and the bar is objective: every measure below is compared against the clips already accepted. The risk is a stretch that passes its numbers and sounds processed, and that is answered by a table against real clips and the founder's ear on before/after pairs, **not by tuning until the numbers pass**. If a sound implementation fails the real-clip table, that is a finding: stop and report it.
**Context:** At the device gate on 2026-09-25 the founder said the book narration is "too slow and boring" next to the narrator hellos, which ONBOARD-2 re-paced, and asked for the same faster pace on every book clip. They then ruled out an audition and a re-render: *"just increase words per minute proportionately … it should be fine as long as the pace is increasing."* So this is DSP on audio we already own, not new synthesis.
- **What the numbers say** (read-only, 2026-09-25: the 144 accepted clips decoded from `runs/ikigai/audio/final/`, words over **speech time only**, joined by content hash to the guard's cached transcripts): **median 160 words a minute** — Lara 157, Druv 163; by slide, takeaway 135, summary 159, payoff 160, scenario 176; range 108–215; median clip 21.8 s, longest 43.7 s, longest pause median 0.77 s. **The cue sheet's Pace column reads about 120 for the same clips: that is a different measure, pauses included.** The two hellos, measured the same way: **243 (Lara) and 260 (Druv)** speech-only — 14 words each, which ONBOARD-2 itself called a poor measure at that length — and ≈ 180 overall with pauses. **So the hellos run about 1.5× the lessons, on either measure.**
- **Why the lessons are slow:** `narration_direction.md` says "natural and unhurried" and, for two slide types, "a little slowly" and "a little more slowly"; ONBOARD-2 measured that such wording buys long pauses as well as a slower voice.
- **Why a stretch, and what it cannot do.** A constant time-stretch of the model's audio, pitch preserved, raises every clip's words a minute in proportion, so the differences the direction file sets between slides (takeaways slowest) are kept — which is what "proportionately" asks. **It scales the pauses too:** a 0.8 s dwell becomes 0.6 s at 1.3×. That lifts the *overall* pace as much as the speech rate, but it does not thin out long pauses the way ONBOARD-2's re-render did. If the founder still finds it slow after listening, the next levers are a larger factor (it is one constant) or a direction re-render (≈ $1.5, **not** in this package).
- **Why 1.3×.** It is +30%: the median goes from 160 to about 208 words a minute of speech and from about 120 to about 156 overall — audiobook pace — and the fastest clip goes from 215 to about 280, inside the pace band's 330. Matching the hellos would take about 1.5×, which puts the fastest clip at about 323 against that band and is where a stretch starts to sound processed. **It is a constant and a founder's-ear decision:** ONBOARD-2's lesson stands, that the numbers were a poor guide to what "slightly faster" meant and the founder's ear settled it.

**Objective:** The Ikigai narration — all 144 clips — attached as **drafts** at **`NARRATION_TEMPO = 1.3`**, made by stretching the raw audio already on disk **without synthesising a single clip**, every clip listened to by the guard again on its new bytes; and the same default pace applies to every book narrated from now on.
**Scope:** `apps/pipeline` — `assets/audio.py` (the stretch), `graph/narration_nodes.py` (the constant, the render stage, the no-synthesis rule), `cli.py` (`narrate`'s options and header), `README.md`, and tests. **Not touched:** `assets/speech.py`, `graph/greeting_nodes.py`, `assets/greeting.py`, `prompts/`.
**Requirements:**

*Part 1 — the stretch (`assets/audio.py`).* `change_tempo(pcm, tempo) -> Pcm`, pure NumPy.
- **Pitch and timbre preserved; duration ÷ tempo.** Not resampling (that shifts pitch) and, I would expect, not a phase vocoder (it smears consonants). The standard answer for speech at this size of change is **WSOLA** — Hann-windowed frames of about 25–30 ms, a half-frame output hop, an input hop of tempo × that, each frame taken within about ±10 ms of nominal at the best normalised cross-correlation against the natural continuation of the last. **That is a hypothesis about the algorithm, not a specification of it.**
- **Deterministic:** a pure function of its input, so a re-run produces byte-identical clips, hence the same filenames, the same cached listens, and no second upload.
- **`tempo == 1.0` returns the input itself**, not a copy that went through the algorithm. The accepted range is 1.0 ≤ tempo ≤ 1.5; anything else raises `AudioError`.
- **No external binary and no new dependency.** `ffmpeg`, `sox` and `rubberband` are not installed and must not become requirements. If your own version cannot meet Part 5's table, **stop and report the numbers**: `audiotsm` (NumPy-only, MIT) is the candidate library, and adding a dependency is the founder's call.
- Speed: minutes for the whole set, not hours (144 clips of about 22 s at 24 kHz) — vectorise the search; do not loop per sample.
- **Tests on synthetic signals, none reading `runs/`:** (i) a sine keeps its frequency within 1% and its level within 1 dB, its length is `round(n / tempo)` within one hop, and it has no jump larger than its own slope allows (no clicks); (ii) tone–silence–tone: the silence shrinks by the tempo; (iii) a two-tone or chirp signal has no comb-filter dips (level per band within 3 dB); (iv) identity at 1.0, and the same bytes twice; (v) out-of-range refused.

*Part 2 — where it goes in the render, and three traps.* In `_render_attempt`, after the raw audio is read from cache (or, in a future run, just synthesised) and before it becomes an mp3. `tempo` is an explicit parameter of `_render_attempt`; **`render_line`'s own default stays 1.0**, so every existing caller and test behaves exactly as before; `narrate` passes its option. Three things the placement must keep true — **pin each with a test, and say in the report where you put the stage and why:**
1. **The clip that reaches `encode_mp3` has the same head pad (60 ms), tail silence (350 ms), speech loudness and peak ceiling as today, whatever the tempo.** `RenderedClip.words_per_minute` subtracts `HEAD_PAD_SECONDS` and `TAIL_SILENCE_SECONDS` as constants, and `level` sets a fixed loudness and keeps peaks under −2 dB. *A stretch after `shape_edges` scales the pads (60 → 46 ms, 350 → 269 ms) and breaks the first; a stretch that comes out a little louder or quieter needs `level` after it, not before.*
2. **The edge report keeps describing the model's own ending.** `EdgeReport` (`breath_cut`, `low_tail_seconds`, `ends_mid_sound`) is what the cue sheet flags for the founder's ear. Computed on stretched audio it would scale the timings — a 0.30 s breath becomes 0.23 s, slips under `MAX_DECAY_SECONDS`, and is no longer cut — and the stretch's own window taper on the last 20 ms could hide a clip the model cut off mid-sound. **The same raw gives the same `EdgeReport` at tempo 1.0 and at 1.3**, pinned.
3. **Nothing stretched is ever written to `raw/`.** `raw/` is what the model returned, keyed by what was asked; a stretched file there would be served to the next run as raw and stretched again. A test: a stretched render leaves every `raw/` file byte-identical and adds none. **And the stretch is applied once** — a duration ratio of 1/tempo, not 1/tempo².

*Part 3 — no synthesis.* A run over cached audio must be **unable** to buy a clip. `narrate --no-synthesis`, and the same keyword on `render_line` and `_render_attempt`: Cloud TTS is never called and `budget.reserve` is never reached for speech. **A first attempt that is not on disk** stops the run with a typed error naming the line. **A later attempt that is not on disk** ends that line's retries and keeps the best attempt so far, named — the same outcome as attempts exhausted, so a stretched clip the guard still fails **holds its Leaf** instead of causing a paid regeneration. **Tests through `render_line`, with a speech fake that raises if called:** a cached first attempt (works, no call); a missing first attempt (typed error, no call); a failing first attempt with a missing second (returns the first, flagged, no call); and the speech line of the ledger is $0 after a full pass. `--no-synthesis` forbids speech only — the guard's listens still happen, and cost.

*Part 4 — the option, and the default that stays put.* `narrate --tempo` (default `NARRATION_TEMPO = 1.3`, `min=1.0`, `max=1.5`), printed in `narrate`'s header beside the narrators (with `--no-synthesis` when it is on) and in each review's preamble ("time-stretched ×1.3"). **The default is stated in five places and pinned in each, the way `tests/test_attempt_defaults.py` pins the attempts:** the constant, the option's literal (the module imports lazily, so a literal, pinned to the constant), `narrate`'s docstring, the README, and the value `narrate` passes down. `render_line`'s own default of 1.0 is pinned too, **deliberately different**. `audition-voices` keeps its current behaviour (1.0) — say so in the report. Carry `tempo` on `RenderedClip` and into `AttachedLeaf.media[...]`, so the run's state records which clips are stretched.

*Part 5 — free checks before any spend.* Everything here runs at $0 on the clips already on disk:
1. **The regression: tempo 1.0 reproduces today's clips.** `narrate --run-id ikigai --render-only --no-synthesis --tempo 1.0` spends **$0** — no speech and **no listen**. All 144 accepted clips have a cached listen under the current guard (`gemini-3.6-flash`, prompt digest `8f3e1d29`, verified 2026-09-25), and a listen is cached by the hash of the bytes heard, so a hit is only possible if the bytes are the same. **Evidence: the ledger's spend line is unchanged to the cent, and every clip prints `(cached)`** (that word means its raw audio was on disk; the listen is what the ledger proves). **If the ledger moves, your stage changed the bytes at 1.0: stop, and do not spend.** Copy `runs/ikigai/audio/review/` to `review-before-vo4/` first: this command rewrites it (with the same content, if you are right). *Any `narrate` needs Payload on `:3001` up — it reads the Leaves through REST even with `--render-only` — and the environment variables `apps/pipeline/README.md` lists (`ZOOMOUT_PIPELINE_DATABASE_URL`, `ZOOMOUT_PIPELINE_USE_VERTEX=true`, `ZOOMOUT_PIPELINE_VERTEX_PROJECT=zoomout-vertex`); the founder's pre-flight in `project/GETTING_STARTED.md` checks the port. If Payload is down, say so.*
2. **The stretch itself, on the real clips, against the accepted ones** — all 144, through the same render path, from a throwaway script that calls `_render_attempt` with `guard=None` (the CLI would listen; these numbers need no listen): duration ratio = 1/tempo ± 0.5% · `pitch_median_hz` within ±2% and `pitch_spread_semitones` within ±0.3 · `articulation_wpm` ratio = tempo ± 3% · `speech_db` and `peak_db` equal to the old clip's · `voiced_fraction` within ±0.03 · `longest_pause_seconds` scaled by 1/tempo ± 0.1 s · **the fastest clip's `articulation_wpm` under the 330 band** (about 280 expected). **A clip outside a tolerance: stop and report the table; do not tune to pass it, and do not widen the band.** Give min / median / max per measure in the report.
3. **The greetings are untouched:** `sha256` of `runs/greetings/audio/final/narrator-greeting-female.mp3` is `c79a872587806a367a6f0513fc6cfd84d53a9fc999c7aaa9dd6f9642bacd3eb7` and of `narrator-greeting-male.mp3` is `e598939f6854e8667bdf44c97750db51f73216c2ff8fb8401ec9141ecb16e6a7` — **before and after your work** — and `git diff origin/main -- apps/pipeline/src/zoomout_pipeline/graph/greeting_nodes.py apps/pipeline/src/zoomout_pipeline/assets/greeting.py apps/pipeline/src/zoomout_pipeline/assets/speech.py apps/pipeline/src/zoomout_pipeline/prompts` is empty. **`prompts/narration_direction.md` is part of every raw clip's cache key: any edit re-buys the whole book.**

*Part 6 — the one paid step: the guard listens to the new clips.*
- **What is bought:** guard listens on the stretched bytes (`gemini-3.6-flash`) and **nothing else**. A full cached walk of the 144 accepted lines is **153 listens** (144, plus 9 earlier attempts on the 7 lines that needed a second or third try). The 191 listens cached on disk cost **$0.5104** at the ledger's own rates, a mean of **$0.0027**, so **expected ≈ $0.41** (a shorter clip is not dearer to listen to, so this is if anything high).
- **Ceiling: $2.75 cumulative, on the Ikigai narration ledger. Google Cloud, not Anthropic.** The ledger stands at **$1.8230** of a default $3.00. `NarrationBudget` refuses a call whose worst case would cross the ceiling — **$0.032 for a listen, reserved before the call** — so **the real headroom is about $0.90**, about twice the expected spend. **One full pass fits and a second pass at another tempo fits; a third does not.** Set it inline, never in `.env` (`narrate` has no ceiling flag; the variable is `ZOOMOUT_PIPELINE_MAX_NARRATION_USD`): `ZOOMOUT_PIPELINE_MAX_NARRATION_USD=2.75 .venv/bin/zoomout-pipeline narrate …`, and check that the `budget` line in the command's header shows $2.75. **The founder's `.env` is permission-blocked — ask them to paste a line if you need one; do not add a duplicate key.**
- **Before the paid step, tell the founder in chat the ledger's spend, the ceiling, the expected cost and the real headroom, and wait for a yes. This handoff is not that yes.** A rate mentioned while the run is going is a status update, not a question. **If the run halts on the ceiling, stop and report: raising it is the founder's decision.** **One `narrate` process at a time** — the ledger has no lock (a register row), and two processes on one run race on it.
- **Leaf 0 first:** `narrate --run-id ikigai --no-synthesis --tempo 1.3 --limit 1` (8 clips, about $0.02, and it attaches that Leaf's draft). Check its listens, its severities, and its REST state; then the rest: the same command without `--limit` (Leaf 0 reports "draft already held this audio").

*Part 7 — attach as drafts, verify from outside, report.* `narrate`'s existing flow: both narrators × four slides, all passing, then one draft write per Leaf, then its own re-fetch. **It never publishes** — the founder does, in admin. Beyond that:
- A Leaf `attach_leaf_narration` refuses (unpublished changes) or holds (a clip still fails) is **named with its reason**, and nothing is written to it. A held Leaf keeps its current audio; say which Leaves would then be at the old pace.
- **Your own REST re-fetch of every attached Leaf**, not the command's verdict: the draft's audio URLs serve bytes whose sha256 equals the clip's, and the live version's audio URLs and durations are exactly as before the run. **Record each Leaf's live audio (URLs and durations) by REST before the paid step** and compare after; do not lean on the numbered files in `runs/ikigai/audio/snapshots/`, which every run adds to, the idempotence run included.
- **A second run at the same tempo spends $0, uploads 0, and prints "draft already held this audio" for all 18** — the proof of determinism and idempotence.
- The old Media stays as orphans (the machine key cannot delete Media): count them and say so.

**Out of scope:**
- Any re-render, any audition, any direction change. **`prompts/narration_direction.md` stays byte-identical.**
- The greetings, the fence (`assets/speech.py`), the guard prompt, and the pace band (`MIN_NATURAL_WPM`, `MAX_NATURAL_WPM`).
- The cost-ledger lock (register row, still open); a second book's narration; any mobile change (an in-app speed control is a separate, later idea); publishing; deleting Media.

**Constraints:**
- **The legal fence stands.** The stretch touches audio only; no text reaches any voice by a new path, and `SpeechClient` is not modified.
- **Spend:** Part 6, exactly. No other paid call — no synthesis of any kind, no `audition-voices`, no `generate-greetings`.
- **The fixes named here are hypotheses** — the algorithm, the stage's placement, the shape of `--no-synthesis`, the tolerances. Verify each against the code and the real clips first; if the code says otherwise, say so and why rather than implementing silently.
- **Explicit, typed errors** — `AudioError` for a bad tempo; a typed error for the missing-cache case; nothing fails silently. Structured logging where the render already logs.
- **Mutation discipline:** each new pin is broken on purpose, watched red, and restored byte for byte — a stretch after `shape_edges`; a stretch applied twice; a stretched file written to `raw/`; a path under `--no-synthesis` that reaches `synthesize`; a default changed in one of the five places.
- **Gates run the configured target, not a subset.** From `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline`: `.venv/bin/ruff format --check . && .venv/bin/ruff check . && .venv/bin/mypy && .venv/bin/pytest` (`uv` is not on PATH; the `.venv` tools run directly; `pytest` needs the `zoomout-pipeline-postgres` container on `127.0.0.1:5433`). Baseline from ONBOARD-2.1's report: **`ruff format` 125 files, `mypy` 107 files, `pytest` 573 passed** (6 `live` deselected) — reconcile any drop.
- Stage specific paths (`git diff --cached --name-only`); never `git add .`; never commit to `main`.

**Device gate:** *(The founder's ear, at the Mac. No phone: nothing reaches a reader until the founder publishes. **Give every path absolute and in `ZO-pipeline`, not `ZO`** — the founder browses `ZO`, where these runs are not.)*
- **You produce** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/vo4-before-after/`: **one Leaf's eight clips** (both narrators, four slides) **and the set's single slowest and single fastest clip**, each as a `before` and an `after` named so a pair sorts together, plus a README table of the measured numbers per pair (speech wpm, overall wpm, longest pause; before → after). **Choose the Leaf by the numbers, not by taste, and say why:** the one whose scenario clip has the longest pause — the clearest test of "pauses shrink too". Copy, do not move. Also point at the regenerated review tracks and pages, by absolute path: `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/ikigai-narration-achernar.html` and `…-sadaltager.html` (each with its `.mp3` beside it — about 28 minutes a narrator, so this is for reference, not for the founder to sit through).
- **The founder listens for, and tells you:**
  - **Faster, and by how much it feels** — "clearly faster, not rushed" is the target. Do the pauses feel shorter?
  - **An artefact:** a warble or "underwater" sound, a doubled or stuttered syllable, a clipped consonant, a word that sounds different. Name the clip.
  - **The takeaways:** do they still come to rest?
- The founder's answer decides: publish the 18 drafts in admin; or ask for another factor (one more paid pass, and a new yes); or stop. **Nothing can prove the sound; do not claim it.**

**Acceptance criteria:**
- [ ] `change_tempo`: pitch preserved (±1% on a sine), length ÷ tempo, deterministic, identity at 1.0, refuses outside 1.0–1.5, no clicks, no comb dips — on synthetic signals, none reading `runs/`
- [ ] Part 2's three traps each pinned by a test: pads, loudness and peak at any tempo; the same `EdgeReport` at 1.0 and 1.3; `raw/` never written by a stretched render, and the stretch applied once
- [ ] `--no-synthesis`: the speech fake is never called in any of Part 3's cases, and a full pass's ledger shows $0 of speech
- [ ] `NARRATION_TEMPO` = 1.3 pinned in all five places; `render_line`'s default 1.0 pinned; `audition-voices` unchanged; `tempo` recorded on the clip and in the run's `cms_narration`
- [ ] **The regression:** tempo 1.0, no synthesis, `--render-only` spends **$0** and every one of the 144 clips prints `(cached)`
- [ ] The real-clip table: all 144 within Part 5.2's tolerances, min / median / max per measure reported and the fastest clip under 330 — **or the work stopped there and the table is the report**
- [ ] The greetings' two sha256 values identical before and after; `git diff origin/main` of `graph/greeting_nodes.py`, `assets/greeting.py`, `assets/speech.py` and `prompts/` empty
- [ ] Before the paid step the founder was told the ledger, the ceiling, the expected cost and the real headroom, and said yes; the header showed $2.75; **spend reported as this run's delta and the ledger's total**, against the ≈ $0.41 expected; the run was Leaf 0 first
- [ ] All 18 Leaves: 144 clips passed the guard on the stretched bytes and were attached as drafts — **or** each held or refused Leaf is named with its clip, its words a minute, its findings, and nothing was written to it
- [ ] Your own REST re-fetch: every attached draft's audio serves the clip's bytes (sha256), and the live Leaves' audio is exactly as before the run
- [ ] A second run at the same tempo: $0, 0 uploads, "draft already held this audio" for every attached Leaf
- [ ] The before/after folder exists at the absolute path above, and the report says what the founder should listen for
- [ ] The gate passes with counts against 125 / 107 / 573; existing tests modified only by additions (each exception named); `git diff --stat origin/main` limited to `assets/audio.py`, `graph/narration_nodes.py`, `cli.py`, `README.md`, tests and your completion entry
- [ ] Every new guard is in a mutation table in the report (breakage → the tests that went red), each restored byte for byte

**Testing expectations:** **Tier A** for the stretch's properties, the three traps, the no-synthesis rule and the five pinned defaults — these are the shape of bug that ships quietly (a stretch that is right on a sine and wrong on speech is caught by the real-clip table, not by the sine). Tier B for the option plumbing. **Say which evidence is a unit test, which is the real-clip table, which is a mutation, and which is the founder's ear.** No live-model test and no test that reaches a paid endpoint; the guard is the existing fake everywhere but the one paid step.

---

### Handoff: 2026-09-25 — ONBOARD-2.1: pin the legal fence and the spending cap, make "both or neither" true, and move `narrate` to three attempts

*Pipeline Manager. Approved by the founder 2026-09-25. **No model calls and no spend: $0** — see Constraints.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Check your branch first** — the worktree may still be on `onboard-2-close-out` (PR #60, the ONBOARD-2 close-out, log only); leave that branch alone. `git fetch origin && git checkout -b onboard-2-1-fence-and-cap origin/main`. **Never `git checkout main` in a linked worktree.** Run the gate from `apps/pipeline` in **this** worktree (`ZO`'s `.venv` is stale). `apps/pipeline/runs/` is gitignored and on disk only. **Commit, push and open the PR yourself when done.**
> **Read:** this handoff · `project/LEGAL.md`, the whole "Narration" section · ONBOARD-2's completion entry, `git show 3fac350:project/collaboration-log.md` — its sections "The handoff's premise was wrong in one place", "Decisions the handoff left to me, and why", "For ONBOARD-3: the references" and "Follow-ups for Architect" · the register rows named below, `git show feaed70:project/projectRoadmap.md` (find them by title; **do not read the register end to end**) · in `apps/pipeline`: `assets/speech.py`, `assets/greeting.py`, `assets/budget.py`, `graph/narration_nodes.py` (`render_line`, `_render_attempt`, `_listen`), `graph/greeting_nodes.py` (the twin, and `upload_greetings`), `cli.py` (`narrate`, `generate_greetings`), the `narrate` section of `README.md`, and the tests `test_narration_selection.py`, `test_greetings.py`, `test_narration_budget.py` and `narration_fakes.py` · `agents/pipeline-manager.md`.

### Task: ONBOARD-2.1 — pin the legal fence and the spending cap, make "both or neither" true, and move `narrate` to three attempts
**Suggested model:** Sonnet — the design is in this handoff, and the real danger (a fence test that passes for the wrong reason) is answered by a written procedure, red against a scratch bypass before any pin is trusted, which protects whichever model runs it.
**Context:** The next narration run will be a whole book in one invocation, and three things it leans on are held by less than they look. The legal fence — what the voice may say — has two blind spots. The lines that enforce the spending ceiling are pinned by no test. And "both or neither" upload is a docstring, not behaviour. A fourth item, ruled twice and never implemented, moves `narrate` to three attempts. Register rows, by title: "The narration fence gained a raw-text entry point and has two blind spots", "`upload_greetings` says "both or neither"…", "The greeting render is a ~250-line twin… three money lines are unpinned in both copies", "`narrate --max-attempts` still defaults to 2…".
**Objective:** Four things, each shown to fail *before* it is fixed and to pass after, at **$0**: (A) the fence pinned; (B) the three money lines pinned in both copies; (C) `upload_greetings` refusing a stale narrator before it uploads anything; (D) `narrate` at three attempts with nothing else moving underneath it.
**Scope:** `apps/pipeline` only — `assets/speech.py` (the door's refusal), `graph/greeting_nodes.py` (the pre-flight; its own attempts default; it must stop importing `MAX_NARRATION_ATTEMPTS`), `graph/narration_nodes.py` (the constant and the comment above it; the money lines are **pinned, not changed**), `assets/greeting.py` (a home for `MAX_GREETING_ATTEMPTS` if it fits better there), `cli.py` (two defaults), `README.md` (the `narrate` attempts sentence), and tests under `apps/pipeline/tests/`. **Verify, don't trust:** the register's line numbers had moved by the time this was read, so find every site by symbol. Nothing outside `apps/pipeline` except your own completion entry.
**Requirements:**

*The boundary, restated — carry it into your report.* `LEGAL.md`, "Narration": the voice narrates ZoomOut's own prose and nothing else. Exactly two things can reach it: the four Leaf fields (`summary.body`, `scenario.prompt`, `payoff.body`, `takeaway.body`) as a `NarrationLine` built from a Leaf by `narration_script`, and the two fixed narrator greetings as a `NarratorGreeting` built by `greeting_for`. **`sourceReferences[].quote` is never narrated.** The tests that fence these two doors are the mechanism: they may be **strengthened and never loosened**, and any further line the voice may say needs a `LEGAL.md` entry first.

*Part A — pin the fence.* New tests go **beside** the existing ones; no existing test is modified.
- **A1.** `SpeechClient._call` takes raw text and is private by underscore alone. Its only callers today are `synthesize` and `synthesize_greeting` (verified at `b32191a`), and nothing pins that. Add a structural test over all of `src/` — any receiver, any nesting — that fails when `_call` is invoked from anywhere else. (`_call_with_retry` in `llm/client.py` is a different function.)
- **A2.** `test_a_narration_line_is_built_in_one_place` and `test_a_greeting_is_built_in_one_place` see only bare-name calls inside function bodies. Add pins for both types that also see: a module-qualified constructor call (`narration.NarrationLine(...)`), construction at module level, and `replace(x, text=…)` / `dataclasses.replace(x, text=…)`. **Flag the `text` keyword, not `replace` itself** — `replace` is legitimate on other dataclasses (`cli.py` uses `replace(clip, voice=label)`); if a legitimate `text=` use appears, allowlist it by name and say so.
- **A3.** *The fix I believe in — a hypothesis to verify, not a specification:* `SpeechClient.synthesize_greeting` refuses, before it builds any request, a greeting whose `text` is not `NARRATOR_GREETINGS[greeting.narrator]`. **The refusal goes at the door, not in `NarratorGreeting`'s constructor**, because `test_a_name_that_is_not_in_the_sentence_is_an_error` builds an off-list greeting on purpose (grep before you decide; if you find a better place, say so and why). `test_the_request_is_the_greeting_in_its_own_voice_with_the_direction` must pass unmodified.
- **A4. The procedure is the point.** Before trusting each new pin, commit the bypass it exists to catch in a **scratch** module under `src/zoomout_pipeline/`: a `_call` from a third function with a source quote; each of the three construction shapes for each type; a `replace(greeting, text=quote)` handed to `synthesize_greeting`. Run the pin: it must go **red and name the scratch site**. Delete the scratch and watch it go green. Record each red in your report, and leave nothing behind.
- **A5.** Name in the report, and do not try to fix, what a static test cannot see: dynamic access (`getattr(client, "_call")`, `object.__setattr__` on a frozen greeting) and a `replace` on a `NarrationLine`, where there is no closed list to compare against.

*Part B — pin the three money lines, in both copies.*
- `NarrationBudget.reserve` is a **stateless** check (`spent_usd + worst_case_usd > ceiling_usd`); `settle` is the **only** thing that adds to `spent_usd`. So without the speech settle the ceiling never trips within an invocation. The register says three lines are pinned by no test in either copy — the guard's reservation, the guard's settle and the speech settle, in `_render_attempt` / `_listen` of `narration_nodes.py` and in their twin in `greeting_nodes.py`. **Re-derive the set by mutation rather than trusting this list:** delete each candidate `reserve` / `settle` line in each copy in turn, and keep the ones whose deletion leaves the suite green. Report the full table (line × copy: survived before, red after). If it is not three, say so.
- Every one of these lines runs only on the **uncached** branch (`from_cache` false in `_render_attempt`; no saved check file in `_listen`). **A test that hits the cache pins nothing** — name the uncached path in each test.
- Pin the *effect*, not the call: (i) after an uncached clip, `budget.spent_usd` has grown by exactly what was recorded for it — speech, and guard where it listened; (ii) with a ceiling sized from `worst_case_usd` / `guard_worst_case_usd` (not hardcoded) so that a second uncached call is admitted only if the first was **not** settled, assert the second is refused; (iii) a guard listen whose worst case would cross the ceiling raises `BudgetExceededError` **before** the model is called — assert the fake LLM saw zero calls.
- The same tests must cover **both** copies (parametrise or share a helper), so a fix to one cannot be missing from the other. Do not extract the twin — that stays deferred until a third caller needs it. The money lines themselves are pinned, not changed.

*Part C — make "both or neither" true.*
- Today `upload_greetings` checks the set and the quality of both clips, then uploads sequentially, and a stale document is discovered only when its narrator's turn arrives. A stale male with no female uploads the female, refuses the male, **and says "Nothing was uploaded."** — false.
- *The fix I believe in — verify it:* before any `upload_media`, look up both narrators (`find_media`), fetch and hash any existing document's served bytes, and raise `GreetingUploadError` naming the document if any differs from its clip — **before** uploading either. Identical bytes stay accepted (idempotent, as today). Keep `upload_greeting`'s own compare and post-upload check as defence in depth.
- Make the words true: the `upload_greetings` docstring ("Both greetings, or neither.") and the "Nothing was uploaded" message must claim exactly what is now delivered — including the residual that a *transport* failure between the two uploads still leaves one behind (resumable: the re-run accepts the identical clip). Quote both before and after in the report. Do not claim atomicity.
- New tests, naming the path: male stale + female absent → **zero** `upload_media` calls and the error names the male document (the order the reviewer found unpinned — confirm that by reading `test_a_document_that_holds_different_bytes_is_refused_and_named`); female stale + male absent; both absent → both uploaded; both present and identical → nothing uploaded (the existing test, unmodified). The pre-flight adds CMS reads: if an existing test pins the exact call sequence, adjust it **minimally and name it** in the report.

*Part D — `narrate --max-attempts` 2 → 3, and nothing moving under it.*
- **Ruled 2026-09-18, re-ruled 2026-09-22, never implemented.** `MAX_NARRATION_ATTEMPTS` becomes 3 in `narration_nodes.py`, and the `narrate` option's default (`min=1, max=3` unchanged) moves with it. **The comment above the constant currently argues against a third attempt** ("a third is the same bet again") — rewrite it with the ruling's reasoning: one difficult line holds a whole Leaf and costs founder attention plus a re-run; still bounded (R7).
- **`graph/greeting_nodes.py` imports `MAX_NARRATION_ATTEMPTS` as its own default** for `render_greeting` and `run_greetings`. Raising the constant would silently move the greeting library to 3 while `generate-greetings --max-attempts` stays a literal 2. **Decision made: greetings stay at 2**, on their own constant, `MAX_GREETING_ATTEMPTS = 2`, which `render_greeting`, `run_greetings` and the `generate-greetings` option all use; `greeting_nodes.py` stops importing `MAX_NARRATION_ATTEMPTS`. A comment says why: an ear-driven job on a small cap — a third paid attempt is the founder's decision, not a default.
- **`cli.py` imports the narration and greeting modules lazily, inside the commands, on purpose** — so a typer default cannot reference a constant without a module-level import that may make `--help` heavy. Your call, by whichever keeps `zoomout-pipeline --help` light: a constant both sides import from a light module, or the literals kept and **pinned equal to the constants by a test**. The requirement is that they cannot diverge unnoticed. (A hypothesis — check the import weight.)
- `README.md`: the sentence on `--max-attempts` says "default 2" and becomes false — change it to 3. The example command that passes `3` explicitly may stay. Grep the README for any other stated default.
- New tests: the `narrate` and `generate-greetings` command defaults each equal their constant (3 and 2); the `render_line`, `render_greeting` and `run_greetings` library defaults equal theirs; and by default a clip that never passes is attempted exactly three times (narration) / twice (greeting) — set a constant back and each goes red. The tests I grepped (`test_greetings.py`, `test_narration_budget.py`, `test_narration_write.py`) pass `max_attempts` explicitly, so **nothing pins the default today** — which is why the ruling went unimplemented. If any other test goes red because it encoded 2 implicitly, make it explicit and name it. Never weaken or delete.
- Report the money effect plainly: a failing line can now cost one more render and one more listen; the ceiling still bounds it.

**Out of scope:**
- **The cost-ledger race between two `narrate` processes** (register: "Two `narrate` processes on one run race on the cost ledger"). Ruled out of this package on 2026-09-25: it needs a design (lock file vs `flock`, stale locks after a crash). It is a precondition of the next book's narration package. Do not touch the ledger's write path.
- `NarrationBudget`'s worst-case reservation shape and its `report()` wording; extracting the twin render; the Python CI job (a separate Manager bundle).
- **Anything that changes a clip:** `NARRATOR_GREETINGS`, `NARRATOR_NAMES`, the voices, the direction and guard prompts, the pace bands. Clips are cached by a digest of what was asked; changing any of these is a cache miss, and a cache miss is money.
- Loosening, or modifying, any existing fence test (A2's pins go beside the old ones).
- Any write to Payload: no Media is created, edited or deleted.
- `LEGAL.md`, `PRODUCT.md`, the plan and the roadmap (Architect's); the app, backend, admin and `packages/shared`.

**Constraints:**
- **No model calls, no spend.** Do not run `narrate` or `audition-voices` at all — the tests use the existing fakes. Prefer the rehearsal harness below to `generate-greetings`; if you do run `generate-greetings`, pass `--ceiling-usd 0` (verified at `b32191a`: 0 is honoured — the check is `is None`, not truthiness), so anything that would need a paid call is refused. `narrate` has no such flag. **`runs/greetings/` holds the paid-for takes and its ledger, `spend.json`; do not clean, move or write to it.** Hash `spend.json` (`shasum`) before and after.
- The rehearsal (Device gate) is built so that **any paid call or any write raises**: a `SpeechClient` over a backend that raises, a guard whose model raises, a `MediaCms` whose `upload_media` raises, and a `NarrationBudget` with ceiling 0.
- **The fixes named here are hypotheses** — A3's refusal at the door, A1/A2's shapes, C's pre-flight, D's constant and where it lives. Verify each against the code and tests first; if the code says otherwise, say so and why rather than implementing silently.
- **Gates run the configured target, not a subset.** From `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline`: `.venv/bin/ruff format --check . && .venv/bin/ruff check . && .venv/bin/mypy && .venv/bin/pytest` (`uv` is not on PATH; the `.venv` tools run directly). `pytest` needs the `zoomout-pipeline-postgres` container on `127.0.0.1:5433`. Report file and test counts against the baseline — **mypy 102 files, pytest 495, ruff format 120 files** (ONBOARD-2's report, confirmed by its reviewer; `apps/pipeline` is unchanged since PR #59's merge, `7369536`) — and reconcile any drop.
- Stage specific paths (`git diff --cached --name-only`); never `git add .`; never commit to `main`.

**Device gate:** *(No phone: nothing here changes the app, the backend or what any reader hears. What crosses the whole path is the live CMS, so this gate is a read-only rehearsal against it. Payload on `:3001` must be up — it was down when this was written; the founder's pre-flight in `GETTING_STARTED.md` starts it. If it is not up, say so: the gate cannot be claimed without it.)*
- Against the running Payload, with the machine key and the rehearsal harness above, run the new `upload_greetings` pre-flight over the two cached clips in `runs/greetings/audio/final/`. **Observe:** both documents found (Media 350 and 351); the sha256 of each served file equals the local clip's (ONBOARD-2's "references" table gives them, so check against it too); **zero uploads attempted**; `spend.json` byte-identical.
- **A negative control:** hand it a copy of one clip with a byte changed. **Observe** it refuse before any upload attempt — a pre-flight that passes both is proven only if it can also fail.
- Report the hashes and the exact commands run.

**Acceptance criteria:**
- [ ] A1: a new structural test fails when a scratch module under `src/` calls `SpeechClient._call` from anywhere but `synthesize` / `synthesize_greeting` — **observed red by running it against the scratch bypass**, then green after removal, nothing left behind
- [ ] A2: the new construction pins each go red against **module-qualified**, **module-level** and **`replace(…, text=…)`** scratch bypasses, for both `NarrationLine` and `NarratorGreeting` (six observations; say so for any shape that cannot be expressed), and are green on the real tree
- [ ] A3: `synthesize_greeting`, given a greeting whose text is not the closed constant (built with `replace`), raises **before any request is built** — the fake backend records zero requests; the real greetings speak exactly as before, and `test_the_request_is_the_greeting_in_its_own_voice_with_the_direction` passes **unmodified**
- [ ] **No existing test is modified**, except any named in the report as encoding the old attempts default implicitly or pinning the CMS call sequence — shown by `git diff origin/main --stat -- apps/pipeline/tests` (additions only, plus the named exceptions)
- [ ] B: the mutation table is in the report (each candidate `reserve` / `settle` line × each copy: survived before the new tests, red after); with the new tests in place, deleting each line turns the new test(s) red, and the restored file is byte-identical
- [ ] B: each money test exercises the **uncached** branch — demonstrated (a fake backend/LLM call count of at least one, or a mutation that forces the cached branch), not asserted by reading — and (iii), the guard reservation, is shown refusing before the fake model is called
- [ ] C: with only the male filename occupied by different bytes and the female absent, `upload_greetings` raises **before any `upload_media` call** (the fake records zero) and names the male document; the docstring and the message are quoted before and after, and claim no more than this delivers
- [ ] C: both absent → both uploaded; both present and identical → nothing uploaded; female stale + male absent → refused before any upload
- [ ] D: the `narrate` default, `MAX_NARRATION_ATTEMPTS` and `render_line`'s default are 3, and a clip that never passes is attempted exactly three times by default; the `generate-greetings` default, `render_greeting` and `run_greetings` all default to `MAX_GREETING_ATTEMPTS` = 2, and `greeting_nodes.py` no longer imports `MAX_NARRATION_ATTEMPTS` (a grep shows it); setting either constant back turns its tests red
- [ ] D: the `README.md` sentence says default 3, and a grep of the README finds no stale "default 2"
- [ ] **No spend:** `runs/greetings/spend.json` is byte-identical before and after (hashes in the report), and the report lists every pipeline CLI command run — none of which rendered, listened or wrote
- [ ] **Device gate observed:** both Media documents found, hashes equal, zero uploads, and the negative control refused — with the hashes and the commands
- [ ] The gate — `ruff format --check`, `ruff check`, `mypy` and `pytest` — passes on the configured targets, with file and test counts against the baseline (102 / 495 / 120), rising rather than falling
- [ ] The report names the residuals: dynamic access to `_call` and to frozen fields, the Leaf-door `replace`, a transport failure between the two uploads, and the ledger race (out of scope, **still open**)

**Testing expectations:** Unit tests with the existing fakes; the fence pins are structural (AST) and deterministic. Every new pin is **mutation-checked** — broken on purpose, watched red, restored byte-for-byte — and the report says which evidence is a unit test, which is a scratch bypass, and which is the live rehearsal. No live-model test and no test that reaches a paid endpoint. Roughly twenty new tests, no new dependency.

---

### Handoff: 2026-09-24 — ONBOARD-3: pre-intro, intro repositioning, beat reorder, and the closing screen

*Manager. **Suggested model: Sonnet** — every product fork is resolved, and this handoff names the code paths, including the ones that change *because of* the reorder. What is left is implementing a fully-specified design against contracts you verify, not invent.*

> **Revised 2026-09-24, before pickup — this is the only ONBOARD-3 text; there is no addendum to reconcile it with.** The first version had two errors, found by reading `WrapUpScreen` and the player's completion panel: it detected the first-timer off the `first-wrap` achievement (which unlocks when the reader **taps** wrap, *after* the screen has opened), and it said a reader who quits mid-Leaf would replay the beats (their book is already in the Library, so the gate gives them `narratorOnly`). Both are corrected below, and what ONBOARD-2 changed is folded in.
>
> **Where you work:** reuse `/Users/ayushgupta/Documents/ZoomOut/ZO-vo3`. Check your branch first. `git fetch origin && git checkout -b onboard-3-flow-refinement origin/main`. **Commit, push and open the PR yourself when done.**
> **Read:** this handoff · ONBOARD-2's completion entry, section "For ONBOARD-3: the references" (its "Not finished" banner is superseded — **the clip swap is done**, see Part 3) · `apps/mobile/src/navigation/` (`RootNavigator.tsx`, `AppStack.tsx`, `types.ts`) · `apps/mobile/src/screens/intro/` · `apps/mobile/src/screens/onboarding/` in full, **as ONBOARD-1 shipped it, not as its handoff assumed** · `apps/mobile/src/screens/leaf/LeafPlayerScreen.tsx` (the completion panel, roughly lines 300–450, and how the route param reaches it) · `apps/mobile/src/screens/share/WrapUpScreen.tsx` · `apps/mobile/src/audio/` · `packages/shared`'s `audioRefSchema` and `NARRATOR_IDS` · `content.mapper.ts`'s `resolveMediaUrl` · `agents/manager.md`.

### Task: ONBOARD-3 — pre-intro, intro repositioning, beat reorder, and the closing screen

**Context:** The founder walked the real device gate for the first time (2026-09-23/24) and found the intro plays at the wrong moment, the narrator beat demos a book instead of introducing itself, narration's optionality is never stated, beat 1's copy misleads, and nothing marks onboarding complete until the reader has actually read something. The reasoning and the decisions already made are in `projectplan.md`.

**Objective:** the two flows below, and nothing else changed for anyone else.

- **New account (`full`):** pre-intro (before sign-up, once per install) → sign-in/sign-up → age gate → account → **INTRO-1** → **promise** → **narrator** → **pick a book** → Leaf 1 (with the existing scenario-slide coach-mark) → finish the Leaf → **Done** or **Wrap up today** → **WrapUp, onboarding variant** (the closing message) → Tabs.
- **Existing account (`narratorOnly`):** narrator beat → Continue → Tabs. Unchanged in shape.

**What ONBOARD-1 shipped, which this package changes** (read from the code, PR #58 — verify, do not trust):
- *Promise:* Continue → `navigate('OnboardingPickBook')`; Skip → `markSeen()` then `reset → Tabs`.
- *PickBook:* choose → `addToLibrary` → `navigate('OnboardingNarrator', { pickedTrack })`; Skip → `markSeen()` then `reset → Tabs`.
- *Narrator:* `finish()` calls `setNarrator`, then **`markSeen()` first**, then either `reset → Tabs` (when `pickedTrack` is undefined — **this is how it knows it is the `narratorOnly` variant**) or `listLibrary()` → `nextLeafId` → `reset({ index: 1, routes: [Tabs, LeafPlayer] })`.
- *Leaf player completion panel:* "Wrap up today" (`onWrapUp`, when under the cap), "See your day" (at the cap), "Done" (`onDone` → `goBack()`).
- *WrapUp:* `session_wrap` is recorded when the reader **taps** wrap, and that is what unlocks `first-wrap`; opening the screen records nothing. Its own Done is `goBack()`.

**What the reorder forces — none of this is optional, and none of it was in the first version:**
1. **Beat 4 moves.** The `listLibrary → nextLeafId → reset into [Tabs, LeafPlayer]` in the narrator's `finish()` moves to the **pick-book** beat, and `pickedTrack` stops flowing to the narrator screen.
2. **The narrator screen can no longer infer its variant from `pickedTrack`** — both variants now arrive without it. Pass the variant explicitly, from the gate's status via `AppStack`. Getting this wrong is the most likely way to ship a bug here: an existing account that is never marked seen would meet the narrator beat on every launch.
3. **`markSeen()` semantics, stated as a table** — pin every row with a test:

| Path | `markSeen()` fires |
|---|---|
| Skip on the promise, or on pick-book | **Immediately** — an explicit skip is a decision, unchanged |
| `narratorOnly`: narrator → Continue | **At Continue** — there is no first Leaf to wait for |
| `full`: narrator → Continue, then pick-book → into Leaf 1 | **Not at either** — this is the change |
| `full`: the WrapUp onboarding variant appears | **On mount** — the reader has finished their first Leaf and been shown the close |
| Quits mid-first-Leaf | **Never.** Their book is already in the Library, so next launch the gate resolves `narratorOnly`: they meet the narrator beat once more, are marked seen at its Continue, and **the closing is never shown to them.** Acceptable and simple — no new persisted state — but state it in your report |

**Scope:**
- `apps/mobile/src/navigation/` — `RootNavigator.tsx` (pre-intro's render target; INTRO-1 leaves the pre-auth branch), `AppStack.tsx` (INTRO-1 becomes the `full` variant's first route; the narrator variant is passed explicitly; `onboardingMarkSeen` also reaches `WrapUp`), `types.ts` (route params)
- `apps/mobile/src/screens/intro/` — INTRO-1 stays here or moves under `screens/onboarding/`; your call, but it must be reachable from the onboarding gate, not the pre-auth branch. **Content unchanged.**
- New: a lightweight pre-intro screen, gated by the **existing** `useIntroSeen` / `introSeenStore` — a component swap in the pre-auth branch, not a new gate
- `apps/mobile/src/screens/onboarding/` — `useOnboardingGate.ts`, `OnboardingPromiseScreen.tsx` (copy), `OnboardingNarratorScreen.tsx`, `OnboardingPickBookScreen.tsx`, `fetchNarratorSample.ts`
- `apps/mobile/src/screens/leaf/LeafPlayerScreen.tsx` — an optional `onboarding` route param, and the completion panel's exits carrying it
- `apps/mobile/src/screens/share/WrapUpScreen.tsx` — the onboarding variant (copy only)
- **Names, widened scope:** `packages/shared` (one constant) and the label map in `ProfileScreen.tsx` and `NarrationControl.tsx` — **labels only**; how `NarrationControl` works stays out of scope
- `apps/backend` — a small path serving ONBOARD-2's two fixed clips, resolved through the existing `resolveMediaUrl` / `MEDIA_BASE_URL`

**Requirements:**

*Part 1 — pre-intro and INTRO-1*
- **Pre-intro:** a static branded moment (wordmark, one line, tap to continue), not a second INTRO-1-scale piece. Draft the line; the founder reads it at the device gate. Gated by `useIntroSeen`/`introSeenStore` — same SecureStore key, same once-per-install semantics. *Known consequence, not a bug:* an install that already saw the old intro will not see the pre-intro, because the key is the same; clearing app storage resets it.
- **INTRO-1:** unchanged content, now the first thing a **new** account sees, folded into the `full` variant. **Both its exits (finish and skip) advance to the promise; neither marks onboarding seen** — skipping an animation is not skipping onboarding. Check what changes when it renders inside a navigator rather than standalone (its own gestures, full-bleed layout) and say what you did.
- No new persistence flag for "has this reader seen INTRO-1 post-auth".

*Part 2 — the flow, the narrator beat, and the copy*
- **Order for `full`:** INTRO-1 → promise → narrator → pick book → Leaf 1. *The promise stays ahead of the choices as "the contract"; that placement is my default — say so if you disagree, don't silently reorder.* **Skip** stays on the promise and on pick-book, and each still lands on Explore's first-run state; the narrator beat has none (Continue keeps the default).
- **Narrator beat:** plays ONBOARD-2's two clips, one per narrator, fetched through the new backend path — always available, whichever Tracks exist or have narration. Each card is **Lara** or **Druv**. State in on-screen **text** that narration is optional — not only implied by the narrator's spoken line, so a reader who can't hear it still gets the message.
- **Beat 1 copy:** rewrite away from "15 minutes, one book" toward what the mechanic is: a session is capped at 15 minutes, a book is read in bite-sized Leaves over many sessions, XP tracks progress across them. Draft it and flag it for the founder's own read — copy is a taste call.
- **Pick-book:** adds to the Library as today, resolves `nextLeafId` **the way the narrator's `finish()` does today** (`listLibrary()` → `progress.nextLeafId`, never `listLeaves()[0]`), and resets into `[Tabs, LeafPlayer]` carrying a new optional route param `onboarding: true` (a serialisable flag, not content — the existing rule that route params carry references only still holds). The flag is **still unset** at this point.

*Part 3 — ONBOARD-2's clips, and the names*
- **The clips:** build against the **stable URLs** `/api/media/file/narrator-greeting-female.mp3` and `…-male.mp3` — public, no auth, `audio/mpeg`, `Range`/`206`, the route VO-3 plays from. **Never key on Media ids** (they changed on the swap and may again), and **no test or fixture may assert on the audio's bytes or duration.** **The swap is done and verified 2026-09-24:** Media 350 (female) and 351 (male), served bytes sha256-identical to the files the founder approved by ear. **Do not wait for Pipeline Manager's follow-up entry** before observing the narrator beat on the device.
- **The names: Lara (female) and Druv (male)**, ruled by the founder 2026-09-24. **Achernar and Sadaltager are the TTS provider's voice ids and never appear on screen or in an accessibility label.** Three separate reader-facing maps exist today, all "Female"/"Male": `ProfileScreen.tsx:268`, `OnboardingNarratorScreen.tsx:23`, `NarrationControl.tsx:13`. **Consolidate to one** exported map in `packages/shared` beside `NARRATOR_IDS`. **Profile has no sample to play**, so a bare "Lara"/"Druv" would be a blind choice there — keep a descriptor ("Female voice"/"Male voice") wherever a reader chooses without hearing one, and say what you did.
- **Don't fabricate values the clips can outgrow.** `AudioRef` asks for `durationSeconds` and `textDigest`. Before deciding the backend path's shape, check what the sample preview actually reads — `selectNarration`'s digest logic exists to match audio to a *slide's* text, which a greeting doesn't have. If the preview needs only a URL, a narrower return type is more honest than a fabricated `AudioRef`. If it truly needs the fields: the measured durations (5.04 s / 5.11 s) may change on a re-take, so don't hardcode them as constants, and `textDigest` is `sha256(script)` as `assets/narration.py:text_digest` computes it, recomputed for the Lara/Druv sentences. State which you chose.

*Part 4 — the closing moment*
- **The mechanism is a route param, not an achievement.** The player carries `onboarding: true` (Part 2). Its completion panel's **"Done" and "Wrap up today" both route to `WrapUp` carrying it**, using the existing pop-then-navigate shape; a `WrapUp` reached any other way — Journey, the cap's "See your day" for an ordinary reader — is **unchanged**. `first-wrap` plays no part in detection. State which completion exits do and don't carry the closing (an achievement-share or track-complete exit, say) rather than leave it implicit.
- **`WrapUp`'s onboarding variant is a copy-only diff on one layout** — the principle WP25 already set for this screen (its header comment says so). A warm closing message — this was your first Leaf, welcome, here's to a great learning journey — in place of the ordinary "Session complete" framing; ShareCard, stats, the wrap ceremony and its own Done (`goBack()` → Tabs) behave as today. **`markSeen()` fires on mount.** Draft the copy; the founder reads it at the device gate.
- **The coach-mark (beat 5) is unchanged** and keeps its own per-reader flag.

*Part 5 — two ONBOARD-1 test gaps, closed here because you are reopening the same files*
- **Beat-2 skip was never tested** (a handler identical to beat 1's tested one). After the reorder, the promise's skip and pick-book's skip each get a test through `RootNavigator`'s real gate.
- **`AppStack`'s onboarding-route transitions never joined the Reduce Motion guard.** `reduceMotionCallSites.test.tsx` cannot see a native-stack `animation` string — it spies on Reanimated factory calls — so an equivalent test must assert the transition swaps to a fade under reduced motion, for the onboarding routes including any you add.

**Out of scope:**
- The 144 existing per-Leaf narration clips, and how `NarrationControl` / `useNarration` work inside the Leaf player — the founder's own device gate confirmed that path works. **Only `NarrationControl`'s label map changes.**
- Any change to existing accounts' experience beyond the narrator-only variant and its new sample content and names.
- A real-time or per-user text-to-speech capability — ruled out; the greeting is generic.
- Redesigning `WrapUpScreen`'s purpose or its opt-in, end-of-day framing.
- New persisted state of any kind for "onboarding in progress" — the quit-mid-Leaf behaviour above is the accepted, simple one.

**Constraints:** SecureStore for anything gated per-install, matching every existing preference. **No new persistence mechanism anywhere in this package:** every gate is either the existing `useIntroSeen` pattern reused, the existing onboarding-seen flag, or a serialisable route param.

**Device gate:** *(Android, Expo Go, backend reachable on the LAN. **Clear Expo Go's storage first** — the pre-intro, INTRO-1's replacement gate and the onboarding flag are all per-install, so a used phone shows none of it. Manager verifies rendering and state; timing and feel go to the founder.)*
- A brand-new install shows the pre-intro before sign-up — a single branded moment. **The founder reads its line.**
- Signing up shows INTRO-1 right after account creation, then the promise, then the narrator beat, then pick-book, then Leaf 1.
- **The founder reads the promise's copy:** it explains Leaves, sessions and XP and does not imply one sitting finishes a book.
- On the narrator beat, **Lara and Druv each introduce themselves** — audible, distinct, and the name spoken matches the label on the card — and the text says narration is optional.
- Finishing that first Leaf and tapping **Done** lands on `WrapUp` with the closing message, not the ordinary framing; its Done lands on Tabs. **The founder reads the closing copy.**
- Force-quit and reopen after that: none of it shows again.
- A **second, fresh account** that quits mid-first-Leaf, then relaunches: the narrator beat only, then Tabs, and no closing (the behaviour in the table). Do this if practical.
- An existing account with a book already in its Library: the narrator beat only, then Tabs, unchanged.
- **Profile** shows Lara and Druv with a descriptor. (`NarrationControl`'s accessibility label is pinned by a test, since it cannot be observed on a screen.)
- Skipping on the promise, and on pick-book, each land on Explore's first-run state.

**Acceptance criteria:**
- [ ] The pre-intro renders before `AuthStack`, gated by the existing `introSeenStore` SecureStore key — verified by reading the same key `useIntroSeen` reads, not a new one
- [ ] INTRO-1's content is unchanged (no visual or behavioural diff beyond position), compared against `main`; **both its exits advance to the promise and neither marks onboarding seen**
- [ ] INTRO-1 renders for a new account (`full`) and never for `narratorOnly` or `seen` — all three pinned by a test through `RootNavigator`'s real gate
- [ ] The whole `full` order — INTRO-1 → promise → narrator → pick-book → Leaf 1 — is pinned by one test through `RootNavigator`, not by screens in isolation
- [ ] **The narrator screen receives its variant explicitly, not from `pickedTrack`**; `narratorOnly` Continue marks seen and lands on Tabs; `full` Continue does **not** mark seen and goes to pick-book — both pinned, and mutation-checked as separate reversions
- [ ] Pick-book (`full`) adds to the Library, resolves `nextLeafId` via `listLibrary()`, resets into `[Tabs, LeafPlayer]` with `onboarding: true`, and **the seen flag is still unset at that point** — verified by reading the store after the reset, not by inference
- [ ] The narrator beat plays ONBOARD-2's two clips, sourced from the new backend path and **not** from any Track's Leaf audio, and requires no Track to have narration
- [ ] "Narration is optional" is stated in on-screen text on the narrator beat, not only implied by the audio
- [ ] Beat 1's copy no longer states or implies that one book is finished in one session — reviewed against the actual text, not the intent
- [ ] **The closing moment, via the route param:** with `onboarding: true`, the player's "Done" and "Wrap up today" reach `WrapUp` showing the closing copy and firing `markSeen()` on mount; **without it, `WrapUp` is unchanged and marks nothing** — both directions pinned through the real player and navigator, and neither reads `first-wrap`
- [ ] **A reader who quits mid-first-Leaf** is resolved `narratorOnly` on the next launch (flag unset, Library non-empty), is marked seen at its Continue, and never sees the closing — pinned by a test through the gate
- [ ] Skip on the promise and on pick-book each mark seen immediately and land on Explore's first-run state — **both pinned by a test** (closes ONBOARD-1's untested beat-2 skip)
- [ ] `AppStack`'s onboarding-route transitions swap to a fade under Reduce Motion, pinned by a test that can actually see the native-stack option (closes ONBOARD-1's Reduce Motion debt row)
- [ ] Reader-facing narrator names come from **one** shared map consumed by Profile, the onboarding narrator beat and `NarrationControl` — verified by a grep showing no remaining local `NARRATOR_LABELS` map, not by the screens rendering names
- [ ] Wherever a narrator is named to a reader it reads Lara or Druv — never "Female"/"Male" alone, never a provider voice id — observed on the device in Profile and on the narrator beat, and pinned by a test for `NarrationControl`'s accessibility label
- [ ] No test or fixture keys on a Payload Media id, or asserts on the audio's bytes or duration
- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass — the report states the mobile test count against ONBOARD-1's 735 and reconciles any drop

**Testing expectations:** **Tier A** for the `markSeen()` table and the variant plumbing (new / existing / already-seen / quit-mid-Leaf landing on the right screen with the flag in the right state) and for the closing-moment routing in both directions — these are exactly the shape of bug that ships quietly and shows up as a reader stuck in the wrong state, or an existing account shown the narrator beat on every launch. Tier B for copy, the pre-intro's rendering and the backend path's wiring. Say which evidence is a unit test, which is a query, and which is you looking on the device.

---

## Completions (Manager → Architect)

### Completed: ONBOARD-2.1 — the fence pinned, the ceiling pinned, "both or neither" made true where it can be, and `narrate` at three attempts — 2026-09-25

*Pipeline Manager. Branch `onboard-2-1-fence-and-cap`, worked in `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`, off `origin/main` at `2f52e47`. PR: [#62](https://github.com/ayush237/ProjectZoomOut/pull/62) — the founder merges.*

**All 14 acceptance criteria verified, including the device gate.** The live leg ran **after** the founder started Payload (it was down when the package was first finished, and an earlier commit of this entry recorded it as open; a dry run against a stand-in preceded it and is *not* what is claimed here). **Result, live, against `http://localhost:3001` as `pipeline-bot@zoomout.local` (machine — not the anonymous trap):** Media **350** (female) and **351** (male) found; the sha256 of each *served* file, hashed independently of the code under test, equals the local clip **and** ONBOARD-2's table (`c79a8725…`, `e598939f…`); **0 upload attempts**; the negative control (one byte changed in the male clip) **refused before any upload**; the reviewer's case (male stale, female absent — absence simulated, nothing deleted) **refused with neither uploaded**; `runs/greetings/` (spend.json included) hashes identically before and after. Command, from `apps/pipeline`: `.venv/bin/python tests/_greeting_preflight_rehearsal.py` (read-only; it cannot spend or write).

| | |
|---|---|
| Gate | `ruff format --check` **125** files (baseline 120) · `ruff check` clean · `mypy` strict **107** files (baseline 102) · `pytest` **573 passed** (baseline 495; **+78**, 6 deselected as `live`). Every count rose; none dropped. The five new files: four test files and one rehearsal script (`tests/_greeting_preflight_rehearsal.py`, not collected) |
| Spend | **$0. No model call, no write to Payload.** `runs/greetings/spend.json` sha256 `b932c6da35f0bbf3ec3cfc511e1cd7c9e699f8203bd9f46ecc97057eaaf1a384` **before and after, identical**; the whole `runs/greetings/` tree (spend.json included) hashes the same before and after the rehearsal too |
| Existing tests | **Two modified, additions only, both named below** (`git diff origin/main --stat -- apps/pipeline/tests`: +2 and +3 lines). 493 other existing tests untouched |
| Mutation-checked | **12 money lines × their tests (below), the A3 refusal's two halves, 7 scratch bypasses on the real tree, 7 Part C and 8 Part D breakages: every one caught, none survived, every file restored byte for byte** (verified by hash) |

**The one thing worth knowing before the rest: the register said three unpinned money lines. It is five, in each copy — ten in all.** Only the speech reserve was pinned. See Part B.

---

## What the founder would notice

- **`narrate` now tries a failing clip three times, not two.** A line that never passes costs one more speech call and one more listen: about **$0.005 + $0.002** for a 20-second clip at the ledger's own rates (a real listen on ONBOARD-2's cached checks averaged **$0.0022**; the speech figure is `speech_spend` at 20 s and is an estimate for a Leaf clip, since no Leaf clip was rendered here). Each attempt *reserves* up to **$0.164 + $0.032** against the ceiling, which is unchanged and still stops the spend. **A re-run over a run that already has held clips will buy those clips' third attempt**: that is what the ruling is for. `generate-greetings` stays at **two** on its own constant.
- **`generate-greetings` refuses a stale document before uploading either clip**, and its help text and error messages now say what it delivers. Nothing about any clip changed, so no cache key moved.
- Nothing else. No app, backend, admin or shared-package change.

## Needs a ruling

Nothing blocks. Two scope calls I made, so they can be overruled:

1. **`assets/narration_guard.py` got a one-word docstring edit** ("MAJOR is worth one regeneration" → "another attempt"). It is outside the file list, but it is a comment that contradicted the ruling I was implementing. No prompt, threshold or behaviour changed, and the guard's cache key hashes the prompt *file*, not this source.
2. **I kept the rehearsal script in the repo** (`tests/_greeting_preflight_rehearsal.py`) rather than only in scratch, so the next session can re-run the gate. It is type-checked by `mypy` and never collected.

---

## Part A — the fence

**The boundary, restated for whoever reads this next.** `LEGAL.md`, "Narration": the voice narrates ZoomOut's own prose and nothing else. Two things reach it: the four Leaf fields (`summary.body`, `scenario.prompt`, `payoff.body`, `takeaway.body`) as a `NarrationLine` built by `narration_script`, and the two fixed greetings as a `NarratorGreeting` built by `greeting_for`. **`sourceReferences[].quote` is never narrated.** The tests that fence these doors may be strengthened and never loosened; a further line the voice may say needs a `LEGAL.md` entry first.

**What was added** (`tests/test_narration_fence.py`, 36 cases; none of the existing fence tests touched):

- **A1.** An AST scan over all of `src/` for *any reference* to `_call` (any receiver, any nesting, aliasing included), which must equal exactly `synthesize` and `synthesize_greeting`. It flags a *reference*, not only a call, so `f = client._call; f(...)` is seen too. `_call_with_retry` is a different name and is not matched (a test says so).
- **A2.** Construction of `NarrationLine` and of `NarratorGreeting` in **any shape** — bare, module-qualified, module-level, class-level — must equal the one builder each; and no `replace(x, text=...)` / `dataclasses.replace(x, text=...)` exists anywhere. **The `text` keyword is flagged, not `replace`** (`cli.py`'s `replace(clip, voice=label)` and `str.replace` are negative controls). **No allowlist**: nothing in `src/` sets `text` through `replace`, so none is kept.
- **A3.** `SpeechClient.synthesize_greeting` refuses, before it builds any request, a greeting whose words are not `NARRATOR_GREETINGS[greeting.narrator]`. **At the door, not in `NarratorGreeting`'s constructor**, as the handoff hypothesised, and I checked why: `test_a_name_that_is_not_in_the_sentence_is_an_error` builds an off-list greeting on purpose (`test_greetings.py:434`) and hands it only to `compare_greeting`, never to the door, so a constructor refusal would have broken it and the door refusal does not. **Beyond the handoff:** the check is on both `text` (stored) *and* `spoken` (what is sent), so a subclass that overrides `spoken` is refused too, and the error is a new `SpeechFenceError(SpeechError)` that **names the narrator and never repeats the words** (a source quote in an error message is a source quote in a log). Being a `SpeechError` with no billed attempts, every caller already stops on it and the ledger is not charged. `test_the_request_is_the_greeting_in_its_own_voice_with_the_direction` passes **unmodified**.

**Each pin's red, observed (A4).** For every bypass I committed it in a scratch module `src/zoomout_pipeline/_scratch_bypass.py`, ran the new pin **and the two old single-construction tests**, then deleted the scratch (and its `.pyc`) and re-ran. Nothing left behind (`ls`/`git status` clean; 36 passed after).

| Scratch bypass | New pin | Named the site | Old pins on the same bypass |
|---|---|---|---|
| A1 `client._call(text=quote, ...)` from a third function | **red** (`…reached_only_from_the_two_doors`) | `_scratch_bypass.py:read_the_quote_aloud` | green |
| A2 `narration.NarrationLine(...)`, module-qualified | **red** (`…constructed_in_one_place_in_whatever_shape[NarrationLine]`) | `:build` | green |
| A2 `NarrationLine(...)` at module level | **red** | `:<module>` | green |
| A2 `replace(line, text=quote)` | **red** (`…has_its_text_replaced_anywhere`) | `:relabel` | green |
| A2 `greeting.NarratorGreeting(...)`, module-qualified | **red** (`[NarratorGreeting]`) | `:build` | green |
| A2 `NarratorGreeting(...)` at module level | **red** | `:<module>` | green |
| A2 `dataclasses.replace(greeting, text=quote)` | **red** | `:relabel` | green |

**The right-hand column is the point:** the old tests stay green on every one of these, which is the blind spot the register described, now shown rather than asserted. All six A2 observations were expressible. **The same shapes also live permanently** as `test_the_scanner_sees_…` cases over synthetic source, so the evidence is not only a one-off run.

**A3, red before and after the fix.** Against the unfixed door: 7 red, 28 green — and the log line proved it, because the unfixed door *spoke the quote* (`speech.synthesized … greeting=female`). The tests booby-trap `texttospeech.SynthesizeSpeechRequest`, so they fail if a request is **built**, not only if one is sent; the fake backend also records zero. After the fix: green. Mutation: refusal deleted → **8 red**; only the `text` half dropped → red on exactly the whitespace-only case (`text + "  "` speaks identically, so only the stored text can tell it from the constant); only the `spoken` half dropped → red on exactly the subclass case. Each half has a test that only it can satisfy.

**A5 — what a static test cannot see, and this does not claim to** (not fixed, as instructed):

- **Dynamic access to `_call`** — `getattr(client, "_call")(...)`, or any string-built attribute. **Still open**; nothing here sees it and A3 does not cover it (`_call` speaks anything).
- **`object.__setattr__` on a frozen greeting** — invisible to every static pin, **but the A3 door refusal catches it at runtime** (tested: `set-on-a-frozen-instance`). So for greetings this residual is closed at the door; it is *not* closed for a `NarrationLine`.
- **A `replace` on a `NarrationLine`, at runtime.** The static pin sees the literal `text=` keyword. But a `NarrationLine` has **no closed list to compare against** (a greeting has `NARRATOR_GREETINGS`; a Leaf's line is whatever the Leaf says), so at the Leaf door there is no runtime refusal to add. `replace(line, **fields)`, an alias (`NL = NarrationLine`, `import … as`) called afterwards, and `copy` plus `setattr` are all unseen. I judged aliasing and `**fields` adversarial rather than the "reasonable instruction" the boundary exists to stop, and left them named rather than adding shapes that would each need their own red.

## Part B — the ceiling

`NarrationBudget.reserve` is stateless and `settle` is the only thing that adds to `spent_usd`: without a settle the ceiling never trips within an invocation; without a reserve nothing refuses a call before it is made. **Derived by mutation, as instructed** — each `budget.reserve` / `budget.settle` statement in `_render_attempt` and `_listen`, in each copy, replaced with `pass`, the whole suite run:

| Line | `narration_nodes` before | after | `greeting_nodes` before | after |
|---|---|---|---|---|
| speech reserve | **red** (`test_the_ceiling_is_checked_before_the_call_not_after`) | red | **red** (`…refused_before_it_is_made`, `…for_the_package_not_the_invocation`) | red |
| timeout settle (`settle(estimate.usd)`) | **survived** | red | **survived** | red |
| unreadable-audio settle (`settle(unreadable.usd)`) | **survived** | red | **survived** | red |
| speech settle (`settle(spend.usd)`) | **survived** | red | **survived** | red |
| guard reserve (`_listen`) | **survived** | red | **survived** | red |
| guard settle (`_listen`) | **survived** | red | **survived** | red |

**Five survive per copy, not the register's three.** The register listed the guard's reserve, the guard's settle and the speech settle; the **timeout settle and the unreadable-audio settle** were the two it missed. **The `record(...)` twin of every one of those is pinned by an existing test** (I deleted all 8 `record` lines too: all 8 red), so the gap is precisely that **the ledger was tested and the ceiling was not** — two separate books, one pinned. "After" is on the final code, each mutant killed by the test for **its own copy** (`[leaf]` for `narration_nodes`, `[greeting]` for `greeting_nodes`).

`tests/test_money_lines.py` — 7 tests × both copies, one adapter per copy so a fix to one cannot be missing from the other (the twin is **not** extracted; the money lines are **pinned, not changed**):

- **(i) the effect.** After an uncached clip `budget.spent_usd` grew by exactly what the ledger was told: speech alone (listener down), guard alone (speech already on disk).
- **(ii) reserve and settle together.** The ceiling is `worst_case_usd` + half of what the first call actually cost, so the first fits and the second fits **only if the first cost nothing**: it is refused if and only if the first was settled *and* a reserve exists to refuse it. Sized from `worst_case_usd` / `guard_worst_case_usd`, never hardcoded, and **the arithmetic each test relies on is asserted first** (`worst_first <= ceiling`, `settled + worst_second > ceiling`), so a test cannot go green because its numbers stopped meaning what it thinks. Same shape for the speech call and for the listen.
- **(iii) the guard's reservation.** Ceiling = half the listening's worst case: `BudgetExceededError` before the model is called, `llm.calls == []`, nothing spent.
- **The two failure charges the register missed**: unreadable audio and a timed-out call both charged **to the budget**, not only the ledger.

**Every test runs the uncached branch and says so**: each asserts `len(backend.requests) >= 1` (speech) or `len(llm.calls) >= 1` (guard), and the cached-speech tests assert `clip.from_cache and backend.requests == []`. A cache hit would fail the test rather than pass it silently.

## Part C — "both or neither"

**Before** (`upload_greetings` docstring): *"Both greetings, or neither. Checked as a full set before anything is sent: both narrators present exactly once, and every clip passed **and** heard. A partial *transport* failure afterwards is resumable — `upload_greeting` finds what already landed — but a *quality* failure in one holds both."* **Before** (the refusal in `upload_greeting`): *"…delete that Media document in the admin UI, then run this again. Nothing was uploaded."* — false when the female had just been.

**After** (docstring): *"Both greetings — **checked as a pair before anything is sent, not atomic across the two requests.** Verified first, as a full set: both narrators present exactly once, every clip passed **and** heard, and every document Payload already holds under a greeting's stable filename carrying exactly that clip's bytes. If any check fails, **nothing is uploaded** and the error says which document. Identical bytes are accepted, so a re-run is free. **What this cannot promise is atomicity.** Two uploads are two requests, and a *transport* failure between them still leaves the first one stored (a document that changes in that window is refused by `upload_greeting`, and says only what is true of its own clip). That case is resumable — the re-run finds what landed and accepts the identical clip — but it is not "neither"."* **After** (the pre-flight refusal): *"…delete those Media documents in the admin UI, then run this again. Checked before anything was sent: nothing was uploaded."* — true, and tested against the fake. **After** (`upload_greeting`'s own refusal, reachable only if the document changes after the pre-flight, or when called alone): *"This clip was not uploaded; the other narrator's greeting may already have been (a re-run finds it and accepts it, if it holds that clip's bytes)."*

**The fix.** `_refuse_a_stale_document` runs after the set and quality checks and before the loop: `find_media` both narrators, fetch and hash any existing document, refuse if any differs from its clip — **naming every stale document, so one visit to the admin fixes both**. Absent passes; identical passes. `upload_greeting`'s own compare stays as defence in depth, and the two share one clause. A document with no `url` is refused up front too (it used to fail when that narrator's turn came).

**Sibling found and fixed:** `generate-greetings`'s own `--help` text (`cli.py`) said it "uploads **both or neither**" — the same overclaim, and the one the founder actually reads. Corrected to say what is delivered.

**Tests** (`tests/test_greeting_upload_preflight.py`, 11): male stale + female absent → **zero** `upload_media`, names Media 7 (this is the order `test_a_document_that_holds_different_bytes_is_refused_and_named` never reached: I confirmed by reading that it only occupies the female filename, which fails before any upload whatever the loop does); female stale + male absent; both stale (both named); both absent (both uploaded, female first); both present and identical (nothing uploaded, the existing idempotency test untouched); one identical + one absent (the resumed run); a document with no url; the exact call sequence (`find, find, fetch`, no write); the message's claim checked against the fake; and a `_RacingPayload` where the male document *appears* between the pre-flight and its upload — the female **was** uploaded there, so the test asserts the message does **not** say nothing was. **Red before:** 7 red, 4 green (the 4 are characterisation: they hold before and after). The clearest red: `AssertionError: the female was not uploaded either: neither` — the old code uploaded the female. **No existing test pinned the CMS call sequence**, so none needed adjusting.

**Mutation** (7): pre-flight removed · compares nothing · looks at the first narrator only · names only the first stale document · drops "nothing was uploaded" · `upload_greeting` claims it again · pre-flight moved before the held check (which the **existing** `test_both_greetings_are_held_when_either_fails_and_the_cms_is_never_called` catches, so the ordering was already pinned). All red.

**The residual, stated and not fixed:** a *transport* failure between the two uploads still leaves one behind. Resumable, not atomic.

## Part D — three attempts

- **Where each number now lives.** `MAX_NARRATION_ATTEMPTS = 3` in `narration_nodes.py`; **its comment rewritten** (it argued *against* a third attempt — "the same bet again" — and now gives the ruling's reasoning: one difficult line holds a whole Leaf, which costs founder attention and a re-run; still bounded, R7, and the ceiling stops the spend regardless). `MAX_GREETING_ATTEMPTS = 2` in `greeting_nodes.py`, beside `GREETING_CEILING_USD`; `render_greeting`, `run_greetings` and the `generate-greetings` option all use it; **`greeting_nodes.py` no longer imports `MAX_NARRATION_ATTEMPTS`** (grep: the only mentions left are two comments). The comment says why: an ear-driven job on a small cap; a third paid attempt is the founder's decision, not a default.
- **`cli.py`: literals, pinned equal by tests.** Import weight, measured: `zoomout_pipeline.cli` alone loads in ~0.79 s; `graph.narration_nodes` on top adds `numpy` and `wave` for ~0.05 s. So the cost of a module-level import is small, and I did not lean on that; I kept the lazy imports because they are the file's stated invariant, and the literals need no new module and no edit to `assets/narration.py` (the Leaf door's file). **They cannot diverge unnoticed:** the tests read the *real* option object from `typer.main.get_command(cli.app)` and compare its `default` to the constant (3 and 2), check `min=1, max=3` still admits it, and check `--help` shows it. Typer 0.27 vendors its own click (`typer._click`), so the test does not import click.
- **README:** "default 2" → "default 3". A test parses the README for every stated default and finds exactly `3`; the example that passes `3` explicitly is untouched.
- **Tests** (`tests/test_attempt_defaults.py`, 17): the ruled numbers asserted exactly; option defaults; library defaults for `render_line`, `render_greeting`, `run_greetings`; **behaviour by default** — a clip that never passes is attempted **3** times (3 speech calls, 3 listens), a greeting **2**, and `run_greetings` 2 per narrator; the command actually **passes the option through** to the render (AST); and the legal-fence sentinel run through **every** default attempt of every line (12 requests, none carrying the sentinel), so the extra attempt is not an extra way to reach a wrong field. **Mutation** (8): constant back to 2 · greeting constant to 3 · each CLI literal · `render_line`'s default hard-coded · `run_greetings`'s default · README · the option no longer passed through. All red.
- **Two existing tests encoded 2 implicitly** and went red at 3 (`3 == 2`, `12 == 8`): **`test_narration_budget.py::test_the_pace_check_holds_without_the_guard`** and **`test_narration_selection.py::test_no_quote_or_extra_ever_reaches_cloud_tts`**. Each counts attempts. I added `max_attempts=2` to each (with a comment) and nothing else; the assertions are unchanged. **These are the only edits to any existing test.**

## Decisions the handoff left to me, and why

1. **New test files, not edits.** Four new files (`test_narration_fence`, `test_money_lines`, `test_greeting_upload_preflight`, `test_attempt_defaults`) rather than growing the existing ones, so "no existing test modified" is checkable by diff.
2. **`SpeechFenceError` as a subclass of `SpeechError`** (as `SpeechTransportError` already is), so every existing handler stops on it and the test can be exact.
3. **The door checks `text` and `spoken`, and never echoes the words.** Above.
4. **The scanner is tested on synthetic source as well as the real tree**, because a pin that is green on the real tree proves nothing until it has been seen red, and a one-off scratch run leaves no permanent evidence.
5. **The pre-flight collects every stale document instead of raising on the first.** Costs nothing and saves the founder a second trip.
6. **`max_attempts=1` in every money test**, so they are independent of Part D.

## What surprised me

- **Five, not three, in both copies** — and the pattern behind it: `record` (the ledger) was pinned, `settle` (the ceiling) was not. The register's list came from reading; the table came from deleting.
- **The unfixed greeting door spoke the quote.** The A3 tests' first red run printed `speech.synthesized … greeting=female` for a source quote. It is one thing to be told a raw-text door exists and another to watch it use it.
- **`replace(greeting, text=quote)` is exactly the "reasonable" shape**, which is why the static pin flags the *keyword* — and why the runtime check at the door matters more than any of the static ones for greetings.
- Typer 0.27 vendors click, so a test that imports `click` fails to collect on this environment while `pyproject` still allows `typer>=0.15`.

## What I got wrong

- **I thought a mutant had been left in the tree.** A background mutation run reported "completed" when only its wrapper shell had exited; `git status` then showed `narration_nodes.py` modified, and for a moment I read it as damage. It was the harness's in-flight mutation on the sixth candidate, which it restored itself (all 20 restores verified by hash). I left it alone, which was right, but I should have checked the process list before drawing a conclusion.
- **I wrote a test comment claiming "the mutation run … found these two unpinned" before the table existed.** It happened to be true. It should not have been written first.

## What I could not verify

- **Nothing in the device gate is left unverified.** The one caveat that travelled with the stand-in run — that nothing re-checked that the live Payload serves the bytes ONBOARD-2 recorded — is closed: it does (same sha256, Media 350/351).
- **The cost of a Leaf clip's extra attempt** is an estimate from the ledger's rates, not a measured one; no Leaf clip was rendered.
- **`narrate` end to end with the new default.** Tier C: there is still no test that runs the command with fakes beyond its help and option defaults; the render it calls is tested.

## The device gate, as run

`.venv/bin/python tests/_greeting_preflight_rehearsal.py` from `apps/pipeline`, **live**, 2026-09-25, after the founder started Payload (`npm run dev --workspace=apps/admin`). Before it, `curl` to both files answered `HTTP 200` with 40,320 and 40,896 bytes, the sizes ONBOARD-2 recorded. Output, abridged:

```
mode: LIVE Payload
local  final/narrator-greeting-female.mp3  sha256 c79a872587806a367a6f0513fc6cfd84d53a9fc999c7aaa9dd6f9642bacd3eb7  (= ONBOARD-2 table)
local  final/narrator-greeting-male.mp3    sha256 e598939f6854e8667bdf44c97750db51f73216c2ff8fb8401ec9141ecb16e6a7  (= ONBOARD-2 table)
cms identity: pipeline-bot@zoomout.local (machine)
cache  female  re-derived sha256 c79a8725…  paid calls: 0        cache  male  re-derived sha256 e598939f…  paid calls: 0
[1] the pre-flight over the real clips
    female  Media 350  /api/media/file/narrator-greeting-female.mp3   served sha256 c79a872587806a367a6f0513fc6cfd84d53a9fc999c7aaa9dd6f9642bacd3eb7
    male    Media 351  /api/media/file/narrator-greeting-male.mp3     served sha256 e598939f6854e8667bdf44c97750db51f73216c2ff8fb8401ec9141ecb16e6a7
    calls: find, fetch (female); find, fetch (male); then the same again inside upload_greeting     upload attempts: 0  -> accepted, nothing written
[2] negative control: the male clip with one byte changed
    REFUSED: Media 351 (narrator-greeting-male.mp3) already exists and holds different bytes (e598939f6854…) from the clip just rendered (7a838f4c44bf…). … Checked before anything was sent: nothing was uploaded.
    calls: find, fetch (female); find, fetch (male)     upload attempts: 0  -> refused before any upload
[3] the reviewer's case: male stale, female absent (absence simulated, nothing deleted)
    REFUSED (same message)     calls: find(female), find(male), fetch(male)     upload attempts: 0  -> neither uploaded
REHEARSAL OK: 0 paid calls, 0 writes                                            exit 0
```

`runs/greetings/spend.json` sha256 `b932c6da…1a384` and the whole `runs/greetings/` tree hash (`5b1df99a863e5a2e`) are identical before and after. **Case [3] is the bug's own shape**, and the calls line is the proof of the fix: the pre-flight looked at both narrators and fetched only the document that exists, where the old loop's first act would have been `upload_media` for the female. The wrapper's `upload_media` raises, so an upload could not have gone unnoticed. **The file hashed in [1] is the one Payload serves**, computed by the script itself rather than by the code under test.

Two earlier runs, for the record: the same script with `--stand-in` (a CMS that serves the local clips as 350/351) passed identically and proved the harness; and without `--stand-in` against the then-down Payload it failed loudly (`PayloadError … Connection refused`, exit 1), so it cannot pass when there is nothing to check.

**Pipeline CLI commands run: none.** Not `narrate`, not `audition-voices`, not `generate-greetings` — they were exercised only as `--help` through `CliRunner` inside the test suite, which renders, listens and writes nothing. The rehearsal is a Python script, not a CLI command.

## Residuals — named, and not fixed

1. **Dynamic access to `_call`** and any string-built attribute — open; no static test sees it.
2. **The Leaf door's `replace`, aliasing and `**fields`** — a `NarrationLine` has no closed list, so nothing at runtime can refuse it. The static pin sees the literal `text=` keyword only.
3. **`object.__setattr__` on a frozen greeting** — invisible statically; **closed at runtime by the A3 refusal** for greetings (tested), not for a `NarrationLine`.
4. **A transport failure between the two uploads** leaves one behind. Resumable, not atomic.
5. **Two `narrate` processes on one run race on the cost ledger — out of scope, and still open.** It is a precondition of the next book's narration package: a lock, before anyone runs narration for a second book. Its write path was not touched. With the default at three, a second process could now over-spend by more per clip than before, which makes it slightly more urgent, not less.

## Follow-ups for Architect

- **Register rows to update.** *"The narration fence gained a raw-text entry point and has two blind spots"* → closed by A1–A3, with residuals 1–3 above. *"`upload_greetings` says 'both or neither'…"* → closed as far as it can be, with residual 4. *"The greeting render is a ~250-line twin… three money lines are unpinned"* → **five** were, now pinned in both copies; the extraction stays deferred until a third caller needs it. *"`narrate --max-attempts` still defaults to 2"* → done, and the row's trigger should be cleared.
- **`LEGAL.md`'s "Narration" section** could record that the greeting door now refuses off-list text at runtime, not only by test — it currently describes the door as "closed" and "asserted exactly by a test".
- **The budget's reservation shape** still makes a small cap allow little iteration (ONBOARD-2's note); still no ruling, and not touched here.
- **Tier C, deferred:** a `narrate` end-to-end test with fakes; extracting the twin render.
- **`runs/greetings/`** is on disk only and was neither cleaned nor written to (tree hash identical before and after the rehearsal).

## Files touched

All under `apps/pipeline`; **the one path outside it is this entry.**

- **Source:** `assets/speech.py` (`SpeechFenceError`, the door refusal) · `graph/greeting_nodes.py` (`MAX_GREETING_ATTEMPTS`, the pre-flight, honest messages and docstring) · `graph/narration_nodes.py` (the constant, its comment, the module docstring) · `cli.py` (two option defaults, two comments, `generate-greetings`'s help text) · `assets/narration_guard.py` (one docstring word) · `README.md` (one sentence).
- **New tests:** `tests/test_narration_fence.py` · `tests/test_money_lines.py` · `tests/test_greeting_upload_preflight.py` · `tests/test_attempt_defaults.py` · `tests/_greeting_preflight_rehearsal.py` (a script, not collected).
- **Existing tests modified (two, additions only):** `tests/test_narration_budget.py` · `tests/test_narration_selection.py`.

---

### Completed: ONBOARD-3 — pre-intro, intro repositioning, beat reorder, and the closing screen — 2026-09-24

*Manager. Branch `onboard-3-flow-refinement`, worked in `/Users/ayushgupta/Documents/ZoomOut/ZO-vo3`, off `origin/main` at `c4ce891`. PR: [#61](https://github.com/ayush237/ProjectZoomOut/pull/61) — the founder merges.*

**Code complete, automated gate green, every guard mutation-checked, the backend path verified live against real Payload, and the flow walked on a device in both themes** — an iOS simulator, not the founder's Android, and I cannot hear audio, so what is *not* verified is the sound itself (see "What I could not verify"). **All 17 acceptance criteria are verified, with two stated caveats:** criterion 17's `build` passes only once `apps/admin`'s two environment variables are supplied (see the gate row), and the parts of criteria 7 and 15 that need an ear (are the clips audible, and does each say its own name) or an Android phone are not verified. CI on PR #61: 2 passing, 0 failing, mergeable and clean.

| | |
|---|---|
| Automated gate | On a tree with `packages/shared/dist`, `apps/backend/dist`, `apps/mobile/dist` and `apps/admin/.next` deleted first: `lint` (21 s), `typecheck` (12 s) and `test` (92 s) **exit 0**. **`build` exits 1 as run** — the backend compiles and the mobile export succeeds, but `apps/admin`'s `next build` needs `PAYLOAD_SECRET` and `PAYLOAD_DATABASE_URL` in the environment and a fresh worktree has neither. I re-ran that one build with throwaway values against a disposable database and it passes (8 s), so the honest state is *build green given those two variables*, not build green as run. I touched nothing in `apps/admin`, but it will bite the next Manager in a fresh worktree. After the live test file was added, lint, typecheck and the backend build were re-run on the final tree (all exit 0). No reinstall: no dependency changed |
| Tests | shared **80** (was 77, +3) · backend **533** (was 527 per PILOT-1, +6) · admin **204** (unchanged) · mobile **770**, 52 suites (was **735**, 49; +35, reconciled below) |
| Mutation-checked | **41 deliberate breakages; each caught by the test that claims the guard, none survived.** Wherever two changes could each explain a green test they were reverted as separate reversions (below) |
| Live verification | Real Payload, real backend from this branch on port 3100, real Postgres (a disposable container): 401 without a token; the body is exactly a URL per narrator on the media host; both URLs serve **the bytes the founder approved by ear** (sha256 identical, checked from the URL the backend hands out); `audio/mpeg`, `accept-ranges: bytes`, `206` on `Range` |
| Device | **Walked, both themes, on an iOS simulator** (iPhone 17 Pro, iOS 26.3, Expo Go 57.0.9, a dedicated device so nobody's session was touched), against this branch's backend on a disposable Postgres and the real Payload. Every flow the handoff's device gate lists was exercised except the two that need an ear or a phone. Torn down afterwards. The founder's `:3000`, `:3001` and `:8081` were left running and unmodified, and so were their two simulators (I took a screenshot of each to see whether it was in use, and copied Expo Go's app bundle out of one; nothing was changed on either) |

---

## What the founder will see, in the order the device gate walks it

1. **A brand-new install, before sign-up:** a still frame — the word **ZoomOut**, one line, "Tap to continue". Draft line, **the founder's call**: *"The big picture, one small idea at a time."* (Alternative, more literal: *"Non-fiction books, in lessons you'll actually remember."*) It is one constant, `PRE_INTRO_LINE`, and the test follows it.
2. **Right after account creation: INTRO-1**, the neuron-network animation, unchanged, then **the promise**. Its copy is rewritten and is **the founder's call**:
   > *Every book here is broken into small lessons called Leaves. Each one ends with a question only you can answer, so you're thinking rather than skimming.*
   > *A session lasts up to fifteen minutes, and a book takes many of them. Every Leaf you finish earns XP, and it adds up across sessions so you can see how far you've come. Stopping on purpose is part of how this works — spacing it out is what makes it stick.*
3. **The narrator beat — "Meet your narrators"**: two cards, **Lara** and **Druv**, each plays that narrator saying hello. Two lines of text, **the founder's call**: *"Every Leaf can be read aloud, if you'd like. Tap a card to hear each narrator say hello."* and *"Narration is optional — it only plays when you tap play, and you can change your pick anytime from your profile."* Tapping the second card **stops the first** (unrequested; see decision 10).
4. **Pick a book → Leaf 1** (with ONBOARD-1's scenario coach-mark, untouched).
5. **Finish the Leaf, tap Done (or Wrap up today) → the closing**, **the founder's call**: eyebrow *"Welcome to ZoomOut"*, headline *"That was your first Leaf"*, and *"Here's to a great learning journey. Take your time — every Leaf you finish adds to it."* Its exit button reads **Done**. Same layout as the ordinary WrapUp; only the words differ. Then Tabs.
6. **Profile** shows **Lara / Female voice** and **Druv / Male voice**. An existing account sees the narrator beat alone, then Tabs.

**To run the device gate on the founder's own setup:** their backend on `:3000` is the `ZO` checkout and **does not have the new endpoint** — it must be restarted from this branch (I did not touch it), and its `MEDIA_BASE_URL` must be an address the phone can reach, because the greeting URLs are built from it (PILOT-1's semantics). Clear Expo Go's storage first, as the handoff says.

---

## The `markSeen()` table, as built — every row pinned by a test

| Path | Fires | Pinned by |
|---|---|---|
| Skip on the promise | immediately | `navigation.test.tsx` through the real gate (was already tested once; reworked for INTRO-1) |
| Skip on pick-book | immediately | `navigation.test.tsx` through the real gate — **new, closes ONBOARD-1's untested skip** |
| `narratorOnly`: narrator → Continue | at Continue | screen test + through the real gate + "not shown again after reopening" |
| `full`: narrator → Continue, pick-book → Leaf 1 | **at neither** — flag read from the store after the reset into the player | screen tests + full-order test |
| **`full`: pick-book cannot reach Leaf 1** (the Library lookup failed, or the book has no next Leaf) | **at pick-book** — *a row the handoff's table did not have* | two `it.each` rows in `OnboardingPickBookScreen.test.tsx` (decision 4) |
| `full`: the closing appears | **on `WrapUp`'s mount**, not when the message renders | closing tests, including "even when the summary fails to load" |
| Quits mid-first-Leaf | never — next launch resolves `narratorOnly`, marked seen at that Continue, the closing is never shown | through the real gate: quit, reopen, narrator beat, Continue, Tabs, no `wrap-up-screen` |

The table is also a comment on `useOnboardingGate.markSeen`, where the next person will look for it.

## Which completion exits carry the closing (the handoff asked for this to be stated)

**Carry it:** *Done*, *Wrap up today*, and the cap's *See your day* — every exit that reaches `WrapUp` passes the flag when the player has it. *Share this badge* pushes over the player and returns to it, so the reader still ends on one of those. **Do not carry it, by design:** *See your finished book* (`TrackComplete`) — reachable only if the first Leaf finished a whole book, and no pilot Track is one Leaf long; and **Android's hardware back**, which pops the player like a quit. Neither marks seen, so the reader meets the narrator beat once more next launch and never sees the closing — the same accepted outcome as quitting mid-Leaf. Documented at the call site in `LeafPlayerScreen.tsx`. Nothing reads `first-wrap`: the closing tests never tap wrap and assert the app never asked `/events` or `/achievements`.

## Decisions the handoff left to me, and why

1. **The promise stays ahead of the choices.** I agree with the default (the contract before the choices); no reorder.
2. **INTRO-1 is a new route, `OnboardingIntro`, and its exit is `replace('OnboardingPromise')`,** not a push. A push would let Android's back button on the promise replay the animation. Both its exits (Get started, Skip) call the one `onExit` and land on the promise; neither marks seen. Both pinned through the real gate.
3. **The variant reaches the narrator beat as a prop from `AppStack`, read once at mount** (`useState(onboardingVariant)`), with `?? 'narratorOnly'` for a state that cannot occur. A route param would put a second copy of the decision into navigation state; a live prop would go `undefined` for one render when `markSeen` flips the gate to `seen` under a still-mounted beat. **That freeze cannot be mutation-checked** — nothing observable goes wrong without it today; it guards a later edit, and says so in a comment.
4. **The added `markSeen` row** (table above): when pick-book cannot carry the reader into Leaf 1, it marks seen. Nothing later will close their onboarding, and leaving the flag unset would send them back to the narrator beat next launch (their Library is no longer empty). **If the Architect prefers otherwise the cost is one repeat of the narrator beat.**
5. **`markSeen` on `WrapUp`'s outer mount, not when the message renders.** A slow or failing summary must not leave a reader who has finished their first Leaf un-marked.
6. **Don't fabricate values — what I chose.** `useNarration` reads **only `entry.url`** (checked: `useAudioPlayer(entry.url)`, nothing else), so the endpoint returns a **narrower type, not an `AudioRef`**: `NarratorSample = Pick<AudioRef, 'url'>` and `NarratorSamples = Readonly<Record<NarratorId, NarratorSample>>` — a total map, so a narrator with no clip is a compile error on the server. No `durationSeconds`, no `textDigest`, so nothing to recompute and nothing a re-take can invalidate; I did not need `text_digest`. To let the preview pass one, **`useNarration`'s parameter narrowed from `AudioRef` to `Pick<AudioRef, 'url'>` — a type-only change**; an `AudioRef` still satisfies it and no caller changed.
7. **The endpoint:** `GET /content/narrator-samples`, authenticated like every content route, answered by `ContentService.getNarratorSamples()` **without touching the repository** (a unit test spies on all four repository methods). `resolveMediaUrl` is now `export`ed from `content.mapper.ts` — one word, behaviour unchanged. The two stored paths are filenames, not Media ids.
8. **The names live in one map:** `NARRATOR_LABELS` in `packages/shared/src/content.ts`, beside `NARRATOR_IDS`, as `{ name, descriptor }` — `Lara / Female voice`, `Druv / Male voice`. It is presentation only and **not a thaw of the frozen content model** (its comment says so). Consumers: Profile, the narrator beat, `NarrationControl`. `NarrationControl`'s accessibility label is now `"Play Summary narration, Lara's voice"` — the template gained a possessive (it read `"…, Female voice"`); labels only.
9. **Where the descriptor shows.** Profile shows name **and** descriptor on the tile, because a reader picks there without hearing anyone. The narrator beat shows the bare name (a reader hears before choosing, and the name must match the one spoken) with the descriptor in the accessibility label.
10. **One voice at a time on the narrator beat — unrequested.** The two `useNarration` players moved into one component so a tap on one card stops the other; two five-second hellos overlapping is not an introduction. Small, tested, mutation-checked; revert it if it is unwanted.
11. **`fetchNarratorSample.ts` and its 5 tests are deleted** (the Ikigai lookup is dead), and so is the "static card, no sample" branch: both clips always exist now. A failed samples fetch shows `ErrorState` with Retry, as a failed fetch did before.
12. **The closing's exit reads "Done"**, not "Back to Journey": it goes to Tabs, which opens on Explore, so the old label would name a place a first-run reader is not going. The ordinary label is untouched.
13. **Step counters follow the new order:** narrator is "Step 2 of 3", pick-book "Step 3 of 3".
14. **A small live test was added** (`narratorSamples.live.test.ts`, run with `npm run test:live --workspace=apps/backend`): public reads only, no credentials, asserts 200 / `audio/mpeg` / `accept-ranges` / `206`, and **deliberately nothing about bytes or duration**. The backend↔Payload media seam had no contract test; this is the cheap one. Mutation-checked with a wrong filename: only that narrator's case goes red.

## What changes when INTRO-1 renders inside a navigator (the handoff asked me to say what I did)

By reading, not by looking: `IntroScreen` is **byte-for-byte unchanged** (`git diff origin/main` on `IntroScreen.tsx`, `introBeats.ts`, `introCamera.ts`, `introFixture.ts`, `introLayers.ts` is empty). Its insets come from the root `SafeAreaProvider` and its geometry from `useWindowDimensions`, neither of which a native-stack screen changes; the route has no header, so it is still full-bleed; its own controls are plain `Pressable`s. What I set on the route: `gestureEnabled: false` (as every onboarding route has), the Reduce Motion transition, and `replace` on exit. Expected visible change: none. **Observed on the device:** it renders full-bleed under the status bar in both themes, the four lines crossfade and the amber pulse travels the spine, Skip is there from the first frame and *Get started* replaces it once the last line lands, and both hand off to the promise. I did not put it beside `main` frame for frame, so "no visual difference" rests on the diff being empty plus what I saw, not on a side-by-side.

## Evidence, by kind

- **Unit / component tests (Jest, Vitest):** everything in the acceptance list except the greps (queries) and the device observation.
- **Through `RootNavigator`'s real gate and the real flag stores:** INTRO-1 for `full` / never for `narratorOnly` or `seen`; both INTRO-1 exits; the whole order in **one** test; both variants' Continue; skip on the promise and on pick-book; quit-mid-Leaf and force-quit-and-reopen; the closing and its flag. **Through the real player and `AppStack` with `markSeen` as a spy** (so "marks nothing" is observable — against the real gate the flag is already set): the closing in both directions, all three exits.
- **A query:** the live checks above (401, exact body, sha256 against the approved files, `206`), and the greps — `NARRATOR_LABELS` has **one** definition and three consumers, no local map remains; provider ids appear only in comments in `packages/shared/src/content.ts`; no test I added or changed asserts on greeting bytes, durations or a Media id (the `durationSeconds`/`textDigest` hits are pre-existing slide-narration fixtures).
- **Looked at on a device (iOS simulator, dark and light):** see "What I saw on the device" below.

## What I saw on the device

A dedicated simulator (`ZO-vo3-verify`, created for this and deleted afterwards), my own Metro on `:8090`, this branch's backend on `:3100` over a disposable Postgres, and the real Payload read-only. Four readers created through the API and a simulator keychain reset between runs stood in for "clear Expo Go's storage".

| Handoff device-gate step | Seen |
|---|---|
| Brand-new install shows the pre-intro before sign-up | **Yes, both themes.** The wordmark, the line, "Tap to continue". A tap goes to sign-in; a reload does not show it again |
| Sign-up shows INTRO-1, then the promise, narrator, pick-book, Leaf 1 | **Yes**, in that order, walked in both themes (INTRO-1 and the promise in light and dark; the narrator beat and pick-book in both) |
| The promise explains Leaves, sessions and XP and does not imply one sitting finishes a book | **Yes** — read on screen. The founder still reads it |
| The narrator beat: Lara and Druv, optionality in text | **Yes, both themes.** Two cards, "Step 2 of 3", both optional lines visible. *(Audibility not tested — below)* |
| Finish the Leaf, tap **Done**: the closing, then Tabs | **Yes, both themes.** Real Ikigai Leaf, answered, completed, Done → the welcome. Exit reads **Done**; the layout is the ordinary WrapUp's with different words |
| Force-quit and reopen: none of it shows again | **Yes** — reopened straight onto Explore, no onboarding, no intro |
| A second, fresh account quits mid-first-Leaf, then relaunches: narrator beat only, then Tabs, no closing | **Yes** — "One more thing" (the `narratorOnly` variant), Continue, Explore, no `WrapUp` |
| An existing account with a book: narrator beat only, then Tabs | Covered by the previous row's mechanism (a non-empty Library and an unset flag); I did not run a separate pre-seeded account through it on the device |
| Profile shows Lara and Druv with a descriptor | **Yes, both themes.** "Lara / Female voice", "Druv / Male voice", Druv selected by default |
| Skip on pick-book lands on Explore's first-run state | **Yes** — and after a force-quit it *stayed* there: the skip's flag persisted. The promise's skip is covered by the automated gate and was not tapped on the device |

## What I could not verify

- **Whether the greetings are audible, distinct, and say the right name.** I cannot hear the simulator. I saw the cards' play/pause state respond to taps and Payload serve the right bytes, and that is all. The founder's ear is still the test; ONBOARD-2's transcript already noted "Druv" transcribed as "Drew".
- **One-voice-at-a-time is only partly confirmed, and has a real limit.** A clean run — fresh screen, Lara then Druv in quick succession — ended with Lara back on *play* and Druv on *pause*, as designed. One earlier run was ambiguous: two cards on *pause* after a Lara, Lara, Druv sequence, and I could not tell a lagging status event from a real overlap. **The mechanism keys on the player's reported `playing`, which only becomes true once audio is actually flowing, so a tap on the second card *during the first card's buffering window* would not stop the first.** `useNarration` deliberately exposes nothing but `playing` and `toggle`, so the parent cannot know a play was *requested*. At human tap speeds this should not be reachable, but it is untested by ear, and it is why decision 10 is worth the founder's attention.
- **Android and Expo Go on Android** — what the handoff's device gate actually names. The hardware back button (the reason for `replace` over a push) has no equivalent on the simulator or in Jest.
- **A side-by-side of INTRO-1 against `main`** (above).
- **Two guards cannot be mutation-checked:** the frozen variant (decision 3) and `replace`-versus-push. Both guard a future edit and say so.
- **Tier C, deferred to WP14, for a worklist:** the narrator beat's loading and error states; light-theme rendering of the narrator beat, promise and closing at *unit* level (only the pre-intro has both themes in a test — the others were looked at on the device in both); the closing on a summary with zero Leaves; the `TrackComplete` exit not carrying the flag (documented, untested).

## What surprised me

- **A native-stack `animation` option *is* observable in Jest** — as `stackAnimation` and `transitionDuration` on the `RNSScreen` host element. ONBOARD-1 reasonably concluded it could not be seen, because its guard spies on Reanimated. `appStackReduceMotion.test.tsx` reads what the native layer is told, and **discovers the onboarding routes from the navigator's own route names**, so a route added later is walked automatically and fails if it forgets the transition. Reusable for any other stack.
- **A correct answer moves the player to the payoff by itself** (`useLeafSession.answer` sets the slide). My first `finishTheLeaf` helper pressed Next once too often. A helper bug, not an app bug; it is in `src/testing/firstLeaf.ts` now, shared by two test files.
- **Payload's file route is GET-only** (`HEAD` returns 404 for the greetings *and* for an existing cover), and **a file that does not exist answers 500, not 404.** Anyone writing a health check with `HEAD` will be surprised, and a missing greeting will reach the app as a failed play.
- **`Stack.Screen`'s render-prop form types `navigation` as `any`**, which the repo's `no-unsafe-*` lint rejects; the INTRO route annotates it.
- **Everything in the new `navigation.test.tsx` blocks passed first time.** That is why I mutation-checked as hard as I did: none was vacuous, and the one test that is the *sole* guard for something is worth naming — the literal-key test for `zoomout.introSeen` is the only thing that notices a renamed key, because every other test writes the flag through the store's own functions.

## Mutation checks (41; each row: the breakage → the tests that went red)

| Breakage | Went red |
|---|---|
| **`narratorOnly` Continue stops marking seen** | 4 — the `narratorOnly` screen test and three through the gate. **The `full` tests stayed green** |
| **`full` Continue starts marking seen** (ONBOARD-1's behaviour) | 5 — the `full` screen test, the full-order tests, quit-mid-Leaf, pick-book skip. **The `narratorOnly` tests stayed green** |
| AppStack passes `full` always / `narratorOnly` always | 3 / 5, each only its own direction |
| Pick-book marks seen on the way into Leaf 1 | 4 |
| Pick-book resumes from `listLeaves()[0]` | 3 |
| Pick-book drops `onboarding: true` | 3 |
| Pick-book's no-first-Leaf fallback stops marking seen | 2 |
| Skip on pick-book / on the promise stops marking seen | 1 each |
| **Player: *Done* ignores the flag** | 4 — the *Done* tests only |
| **Player: *Wrap up today* / *See your day* drop the flag** | 2 — those two only. *Done* stayed green |
| **WrapUp never marks seen / marks seen for every arrival** | 7 / 2, separately |
| WrapUp marks seen only after the summary renders | 1 — the "even when the summary fails to load" test, exactly |
| WrapUp closing forks the layout (hides the stats) | 1 — the one-layout test, exactly |
| A new account opens on the promise, not INTRO-1 | 9 |
| INTRO-1's exits mark onboarding seen | 6 |
| Pre-intro gated on a new SecureStore key | 1 — the literal-key test, exactly |
| Pre-intro shown to a signed-in reader | 1 |
| A route forgets the Reduce Motion transition / the swap to fade is removed | 2 / 1 |
| `NarrationControl` says the descriptor / Profile hardcodes `Female` / the beat card shows the descriptor | 4 / 1 / 1 |
| Tapping the other card no longer stops the first / the beat also asks the catalogue / the optional line is reworded | 1 / 1 / 1 |
| Promise copy implies a book fits in a sitting / brings back "One book." | 1 / 1 |
| Client asks the wrong samples path | 15 |
| Promise Continue skips the narrator / WrapUp ignores the flag | 6 / 3 |
| **Backend: service builds URLs on `CONTENT_API_URL` / service reads the CMS** | 1 / 1, **separate reversions** |
| Backend: route left unauthenticated / a fabricated `durationSeconds` / a wrong filename | 1 / 2 / 4 |
| Shared: `Druv` respelled / a provider id leaks into a string | 1 / 2 |
| Live test: wrong filename for one narrator | 1 — that narrator only |

## Test count against ONBOARD-1's 735 — **770, +35**

Removed: `fetchNarratorSample.test.ts` (**−5**, the Ikigai lookup it tested is deleted). Added or grown: `PreIntroScreen.test.tsx` +4 · `OnboardingPromiseScreen.test.tsx` +3 · `appStackReduceMotion.test.tsx` +3 · `onboardingClosing.test.tsx` +6 · `OnboardingNarratorScreen.test.tsx` 4→8 (+4) · `OnboardingPickBookScreen.test.tsx` 3→6 (+3) · `WrapUpScreen.test.tsx` 5→10 (+5) · `NarrationControl.test.tsx` +2 · `surfaces.test.tsx` +1 · `navigation.test.tsx` 20→29 (+9). **−5 +4 +3 +3 +6 +4 +3 +5 +2 +1 +9 = +35.** No test was weakened to reach the number. The existing tests that changed did so because the handoff changed the behaviour they asserted — `navigation.test.tsx`'s Intro and Onboarding blocks, the narrator and pick-book screen tests, and two label assertions in `NarrationControl.test.tsx` — and each now asserts the new behaviour at least as tightly.

## Where the time went

Rough — I have no clock on it. Reading the flow and its ONBOARD-1 tests ~25%; implementation ~20%; tests ~25% (the `finishTheLeaf` helper and the harnesses were most of it); mutation checks ~10%; live verification ~5%; the device pass ~15% (most of it *getting* to the device — a dedicated simulator, my own Metro, backend and database, four readers — and then a lot of screenshot round-trips, not the looking itself); the gate and this write-up ~10%. **The cost worth knowing about: the simulator tool asks for a per-device grant, my first requests went unanswered, and access only came through later in the session — by which time I had already written the report as "not done". Ask for the grant *before* building a device around it.**

## Follow-ups for Architect

1. **The founder's own device gate is still the test for sound and for Android.** Everything visual and every state transition was walked on an iOS simulator; what a person has to check is that Lara and Druv are *audible and distinct and say their own names*, that the narrator beat's one-voice rule holds at real tap speed (see "What I could not verify"), and that nothing differs on Android.
1a. **Explore's first-run copy repeats the framing the founder objected to, and is out of this handoff's scope.** `ExploreScreen.tsx:255`, shown to anyone who skips: *"Add one below to get started — about fifteen minutes, one book at a time."* And `ExploreScreen.tsx:178`, the empty-catalogue line: *"Each one turns a non-fiction book into about fifteen minutes of active recall."* Both read as "a book in fifteen minutes" — the same impression beat 1's rewrite was for. I saw the first one on the device after a pick-book skip. **I did not change either**: the handoff was explicit that nothing else changes for anyone else, and they are the founder's words to choose. A reader who skips is exactly the reader who never sees the corrected promise.
2. **Four pieces of copy for the founder's read** — the pre-intro line, the promise, the narrator beat's two lines, the closing (all above; each is one string in one place).
3. **A missing or unreachable greeting is a dead button on the narrator beat.** `useNarration` reports `playbackFailed` and the beat's cards do not surface it — PILOT-1's shape, on a screen PILOT-1 did not cover. Payload answers a missing file with a 500. Worth a line of UI if a re-take upload can ever leave a gap.
4. **A failed samples fetch blocks an existing account behind `ErrorState` with only Retry** — no Continue, so no way to Tabs. The gate fails open, so this needs the gate to succeed and the next request to fail; same exposure as before this package, but on a screen an existing account must pass.
5. **`apps/admin`'s build needs `PAYLOAD_SECRET` and `PAYLOAD_DATABASE_URL`**, so a fresh worktree's root `npm run build` fails at admin. Someone should decide whether the gate documents the two variables or the build stops needing them.
6. **Scope, flagged:** the handoff said `packages/shared` gets "one constant"; it also gained two delivery *types* (`NarratorSample`, `NarratorSamples`), because CLAUDE.md forbids the same shape being defined in both apps. `content.ts` is the frozen model: `NARRATOR_LABELS` is a presentation constant beside `NARRATOR_IDS`, as instructed, and is not a thaw.
7. **Pre-existing, not touched:** `AppStack`'s non-onboarding routes still ignore Reduce Motion; `WrapUp`'s ordinary exit says "Back to Journey" even when the reader came from Library; the onboarding flag is per install, not per account, so a second account on the same install skips onboarding; and the promise's "fifteen minutes" is hand-synced to `SESSION_CAP_SECONDS`.
8. **`LEGAL.md`** — ONBOARD-2 asked that it be told about the greeting as a fifth thing the voice can say. Not mine to edit; still open.

## Files touched

**`packages/shared`:** `content.ts` (`NARRATOR_LABELS`, `NarratorLabel`), `delivery.ts` (`NarratorSample`, `NarratorSamples`), `content.test.ts`.
**`apps/backend`:** `content/content.mapper.ts` (`export`), `content/narratorSamples.ts` **(new)**, `content/content.service.ts`, `content/content.routes.ts`, tests `narratorSamples.test.ts` **(new)**, `narratorSamples.live.test.ts` **(new)**, `content.service.test.ts`, `test/content.integration.test.ts`.
**`apps/mobile`:** `api/client.ts`; `navigation/` — `types.ts`, `RootNavigator.tsx`, `AppStack.tsx`, and tests `navigation.test.tsx`, `appStackReduceMotion.test.tsx` **(new)**, `onboardingClosing.test.tsx` **(new)**; `screens/intro/` — `PreIntroScreen.tsx` + test **(new)**, comment-only edits to `introSeenStore.ts` and `useIntroSeen.ts`; `screens/onboarding/` — `OnboardingPromiseScreen.tsx` + test **(new)**, `OnboardingNarratorScreen.tsx` (rewritten) + test, `OnboardingPickBookScreen.tsx` + test, `useOnboardingGate.ts`, **`fetchNarratorSample.ts` and its test deleted**; `screens/leaf/LeafPlayerScreen.tsx`; `screens/share/WrapUpScreen.tsx` + test; `screens/ProfileScreen.tsx`, `screens/surfaces.test.tsx`; `audio/NarrationControl.tsx` + test, `audio/useNarration.ts` (type-only); `testing/firstLeaf.ts` **(new, shared fixtures and the `finishTheLeaf` helper)**.
**Deliberately untouched:** `IntroScreen.tsx` and its four siblings, the 144 per-Leaf clips, how `NarrationControl` and `useNarration` behave, `apps/admin`, `apps/pipeline`, `projectplan.md`, `projectRoadmap.md`.

---
