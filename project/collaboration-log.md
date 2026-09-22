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
> `project/archive/collaboration-log-voiceover.md`** (split 2026-09-22, at VO-3's merge).

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

### Handoff: 2026-09-18 — VO-3: the player, and the narrator preference

*Manager. **Suggested model: Sonnet** — every risk in this package is procedural and the procedures are written below, including the silent-switch trap that is the classic way audio ships broken. There is no judgement to buy; the founder observes the two things that need ears. **Runs in parallel with INTRO-1**, which is live in `ZO-admin` — see the conflict note.*

> **Where you work:** a **new** worktree. From `/Users/ayushgupta/Documents/ZoomOut/ZO`, the founder creates it with `git worktree add /Users/ayushgupta/Documents/ZoomOut/ZO-vo3 -b vo-3-player origin/main`, then `npm install` inside it. **`main` lives in `ZO` and nowhere else** — never run `git checkout main` in a linked worktree.
> **Commit, push and open the PR yourself when done.**
> **Read:** this handoff · `apps/backend/src/content/content.mapper.ts` (**the audio contract — read the per-entry filtering before writing anything**) · `packages/shared/src/content.ts` (`NARRATOR_IDS`, `audioRefSchema`, `slideAudioSchema` — **mirror, never edit**) · `apps/mobile/src/sound/SoundProvider.tsx` (the SecureStore preference pattern) · `apps/mobile/src/screens/leaf/` (the four narrated slides) · `apps/mobile/src/design/motion.ts` · `agents/manager.md`.
> **Do not read or edit:** `apps/pipeline`, `apps/admin`, `projectRoadmap.md`, `projectplan.md`.

### Task: VO-3 — the four narrated slides play, in the reader's narrator

**Context:** Ikigai's 18 Leaves are published and carry 144 audio clips — both narrators, on all four narrated slides. **Verified against the live CMS on 2026-09-18: 18 Leaves, 144 rows, 8 per Leaf, all `published`, narrators `female` and `male`.** Nothing in the app plays any of it. This package is the last one between the reader and the feature.

**Objective:** On Summary, Scenario, Payoff and Takeaway, a reader can play the slide's narration in their chosen narrator. The choice is a stored preference with a default, changeable from Profile. Audio is audible with the phone's silent switch on, stops when the reader leaves the slide, and behaves when something interrupts it.

**Scope:**
- **New** `apps/mobile/src/audio/` — the player, the audio-session setup, and the narrator preference store
- `apps/mobile/src/screens/leaf/` — the control on the four narrated slides
- `apps/mobile/src/screens/ProfileScreen.tsx` — the narrator control
- `package.json` — one audio dependency, installed with `npx expo install`, never hand-edited
- Tests alongside each

Verify this against the repository rather than trusting it.

**The audio contract — read `content.mapper.ts` before designing around it.** It filters **per entry, fail-closed**, and drops a row for an unknown narrator, an empty URL, a non-positive `durationSeconds`, a **stale `textDigest`**, or a narrator collision. `resolveMediaUrl` has already made the URL absolute. **Three consequences you must handle:**

1. **A slide can arrive with `audio: []`.** Normal, not an error — the server has legitimately suppressed it.
2. **A slide can arrive with only *one* narrator**, because the filtering is per row. VO-2.1's both-or-none rule is enforced at *attach* time and cannot be enforced at *serve* time.
3. **Order carries no meaning.** Match on `narrator`, never on position or on `id`.

**Requirements:**

- **The narrator preference is device-local**, on `SoundProvider`'s SecureStore pattern, keyed `zoomout.narrator`. **The default is `male` (Sadaltager)** — the founder's ruling 2026-09-18, made after listening to both tracks in full.
- **VO-3 owns the preference, its default, and the Profile control. It does not own first-run choosing.** The onboarding flow — a separate, later package — writes this same key. **Do not build an onboarding prompt, a first-play chooser, or any second way to set this.** The 2026-09-18 ruling rejected asking on first play by name.
- **If the reader's narrator is missing for a slide but the other is present, play nothing.** Show the same state as no audio. **Never substitute the other voice** — "a reader who picks one narrator must never be handed the other mid-book" is the founder's rule, and this is the only place it can be honoured at serve time.
- **Audio must be audible when the phone's silent switch is on.** This is the single most common way a feature like this ships broken: it works on the simulator and on a desk, and is silent on a real phone in a pocket. Configure the audio session explicitly; do not rely on a default.
- **Audio stops when the reader leaves the slide**, and when the Leaf player unmounts. A narrator still talking over the next slide is the obvious failure.
- **Audio stops when the app backgrounds.** Do not request a background-audio capability — this is a 15-minute foreground learning session, and the entitlement is a store-review surface for no gain.
- **An interruption (a call, another app) pauses rather than corrupts state.** On return the control is in a sane state, playing or paused, never stuck mid-spinner.
- **One control, identical on all four slides.** Verify whether `SlideFrame` is the right seam or whether the four slides need it passed individually — do not assume.
- The control carries an **accessibility label** that names the action and the narrator. Do not suppress or fight VoiceOver; a screen-reader user may never use this button and must still be able to move through the slide.
- Use the Expo SDK 57 audio package (`expo-audio`; `expo-av` is the deprecated predecessor). **Confirm which one this SDK ships and install with `npx expo install`** so the version is SDK-matched.
- Colour, spacing, duration from `src/design/`. Any animation routes through `motionTimingConfig` / `motionSpringConfig`; **`ReduceMotion` is imported nowhere outside `motion.ts`.**

**Out of scope:**
- **Onboarding's narrator choice** — a later package, as above.
- **The Sticky Notes slide.** Four narrated slides only; `PRODUCT.md` excludes it deliberately.
- **Download, caching, or offline playback.** The app is online-only by decision.
- **Background audio, lock-screen controls, playback speed, scrubbing.** A play/pause control is the package.
- **Sound effects.** A different layer with no assets yet.
- `apps/backend`, `apps/admin`, `apps/pipeline`, `packages/shared` — the contract is already correct; if you believe it is not, **report it rather than changing it.**

**Conflict note — INTRO-1 is live in `ZO-admin` on `intro-1-first-run`, also in `apps/mobile`.** Three predictable collisions; whoever merges second rebases:
1. **A preferences module.** INTRO-1 adds `zoomout.introSeen`. **Keep your narrator preference in `src/audio/`, not in a shared preferences module**, so neither package has to invent the same abstraction.
2. **`reduceMotionCallSites.test.tsx`** — INTRO-1 registers a surface there. If you add an animated one, you will both touch adjacent lines.
3. **`package.json`** — you add an audio dependency; INTRO-1 adds none.

**Inherited environment knowledge — read this before you try to build anything. INTRO-1 lost its single largest block of time here on 2026-09-18.**

- **A native iOS build fails on this Mac and it is not your code.** `expo-modules-jsi` will not compile under Xcode 26.3 / Swift 6 (`JavaScriptCodable+Date.swift:53:50: type of expression is ambiguous`). It is a transitive Expo dependency pinned long before this package. **Do not spend the afternoon on it.** One Xcode is installed; there is no older one to fall back on.
- **Use Expo Go for the visual gate. This is confirmed working, not a proposal** — the founder ran INTRO-1 on a real phone through Expo Go on 2026-09-18 and verified it by eye. `npx expo start` from `apps/mobile`, scan with Expo Go. Every plugin in `app.json` is in the Expo Go runtime, as are `react-native-svg` and `react-native-reanimated`.
- **Your first task, before you build anything: confirm `expo-audio` actually loads under Expo Go.** Install it, import it, render a throwaway screen that constructs a player, and look. **If it is not in the Expo Go runtime, stop and report** — a dev build is the only other route and it is blocked by the wall above. **Do not build a player you have no way of seeing or hearing.** This check costs minutes; discovering it at the device gate costs the package.
- **But be honest about one limit: Expo Go is itself an app with its own audio session.** Its configuration may mask or override yours, so **a silent-switch result in Expo Go is evidence, not proof** — in either direction. If audio is inaudible on silent there, do not conclude your code is wrong; if it is audible, do not claim the criterion outright. **Report what you observed and under which runtime**, and leave the standalone-build confirmation as a named open item.
- If you do attempt `pod install`, this host's shell has **no `LANG` set** and CocoaPods crashes without it — prefix with `LANG=en_US.UTF-8`.
- **SecureStore survives uninstall and reinstall on the iOS Simulator.** Your narrator preference will persist across a reinstall, so testing an unset default that way will mislead you. Clear the key or use a fresh simulator.
- A fresh worktree needs its own `npm install` before anything typechecks — `ZO-admin`'s was stale and missing `react-native-svg` entirely.

**Device gate** — what to observe, before any criterion is claimed:

*Yours, on Expo Go (the simulator's native build is broken — see above):*
- A narrated slide shows the control; a slide the server sent no audio for shows the **no-audio state, not a broken button**
- Switching the narrator in Profile changes which voice plays on the next play
- Leaving the slide mid-playback **stops the audio**
- The control is reachable and labelled at the largest OS text size, in both themes

*Flagged for the founder, on a physical iPhone — do not claim these yourself:*
- **Audio is audible with the ringer switch set to silent.** The reason this gate exists — and, per the environment note above, **the one observation Expo Go may not be able to settle.** If it cannot, say so; it becomes a named open item rather than a claimed criterion
- A real interruption — take a call mid-clip — leaves the control in a sane state

**Acceptance criteria:**
- [ ] All four narrated slides play their clip, and a test pins that **Sticky Notes has no control**
- [ ] **The default is `male` with the key unset**, asserted directly — not inferred from a UI that happens to show it
- [ ] **A slide carrying only the non-preferred narrator plays nothing** and renders the no-audio state — a test constructs exactly that payload, since the server can produce it and the attach-time guard cannot prevent it
- [ ] A slide with `audio: []` renders the no-audio state without error
- [ ] Clips are selected by matching `narrator`, **never by array position or `id`** — pinned by a test whose fixture lists male first, so a positional implementation fails
- [ ] **Audio stops on unmount and on leaving the slide** — both pinned, since they are different code paths and only one of them is the obvious one
- [ ] The audio session is configured explicitly for silent-switch playback, and a test asserts the configuration call happens — the audible check itself is the founder's, on device
- [ ] Changing the narrator in Profile writes `zoomout.narrator` and a subsequent read returns it
- [ ] `ReduceMotion` is imported nowhere outside `motion.ts`
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass — **and your report states the test count and compares it to the previous mobile package's**

**Testing expectations:** Unit tests for the preference store (unset default, set, read) and for narrator selection against the three server shapes — both narrators, one narrator, none. Component tests for the four slides and Sticky Notes' absence, in both themes. Mock the audio package at its boundary; do not assert on real playback. No e2e.

**One thing to flag rather than fix:** `content.mapper.ts` builds a `warnings` channel when it drops a row, and as far as I can tell **nothing surfaces those warnings anywhere.** If you confirm that, report it — it means a suppressed clip is invisible in production, and that is a finding about the contract rather than about your package.

---

### Handoff: 2026-09-18 — INTRO-1: the first-run intro

*Manager. **Suggested model: Sonnet** — the design is written out in full below, including which modules to reuse and the technique to use; what is left is wiring and care, not judgement. **The one aesthetic call — which seed looks best — is the founder's at the device gate**, per the 2026-09-09 ruling. Parallel to the voiceover stream: mobile only, no backend, no content, no audio.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-admin`. **This is a linked git worktree, so `git checkout main` will fail** — `main` belongs to the primary checkout at `ZO`. Use **`git fetch origin && git switch -c intro-1-first-run origin/main`**.
> **Commit, push and open the PR yourself when done.**
> **Read:** this handoff · `apps/mobile/src/screens/track/roadmapGeometry.ts` (the geometry you consume — **read it, never edit it**) · `apps/mobile/src/screens/share/constellationLayers.ts` (how that geometry gets painted and batched) · `apps/mobile/src/screens/track/TrackRoadmap.tsx` (the Reanimated-over-SVG technique, already working) · `apps/mobile/src/design/motion.ts` · `apps/mobile/src/design/reduceMotionCallSites.test.tsx` · `apps/mobile/src/sound/SoundProvider.tsx` (the SecureStore preference pattern) · `agents/manager.md`.
> **Do not read or edit:** `apps/backend`, `apps/admin`, `apps/pipeline`, `projectRoadmap.md`, `projectplan.md`.

### Task: INTRO-1 — the first-run intro, a zoom out through a neuron network

**Context:** This is the first thing anyone sees after installing ZoomOut — a ~14-second poetic cold open that plays once, before sign-in. It is not a feature tour. It dramatises the product's name by pulling the camera back from a single neuron to a connected network, and it doubles as a preview of the Track roadmap screen readers will live in.

**Objective:** On first launch the app plays a four-beat, continuously zooming animation over a neuron graph, with four lines of display type, then hands off to sign-in. It never plays again on that install — whether the reader watched it or skipped it. It is correct in both themes, at every OS text size, and under Reduce Motion.

**Scope:**
- **New** `apps/mobile/src/screens/intro/` — the screen, the beat timing, the synthetic graph fixture, and an intro-local painter if the shared one does not fit
- **New** a seen-flag store — follow `src/sound/SoundProvider.tsx`'s SecureStore pattern and key it `zoomout.introSeen`
- `apps/mobile/src/navigation/RootNavigator.tsx` — the insertion point, ahead of `AuthStack`
- `apps/mobile/src/design/reduceMotionCallSites.test.tsx` — register the new animated surface
- Tests alongside each of the above

Verify this list against the repository rather than trusting it.

**Requirements:**

- **The four lines, verbatim.** Any difference is a defect, including punctuation:
  1. `Your mind is a vast landscape.`
  2. `Nothing grows here in a single leap.`
  3. `What changes you is how small things connect.`
  4. `Let's zoom out.`
- **One continuous camera move across all four beats**, not four slides cutting between scales. Beat 1 sits at high magnification on a single node and its dendritic arbors; by beat 4 the whole graph is in frame. The zoom does not stop and restart at beat boundaries — **the text cross-fades over a camera that never stops moving.**
- **Consume `layoutRoadmap` from `roadmapGeometry.ts`.** Pass a fixed synthetic `LeafNodeState[]` and a **hardcoded seed**, so the intro draws an identical graph on every install, every launch and every device.
- **Choose the seed by looking.** Render several, screenshot them, pick the one that reads best, and **say in your report which seeds you compared.** Do not take the first one that runs.
- **Total duration 12–16 seconds**, with beat 4 holding long enough to read before the control is reachable.
- **Beat 4 carries the only control** — the hand-off to sign-in. Beats 1–3 carry no affordance but the skip.
- **A skip control, live from the very first frame**, not only once a beat completes.
- **Beat 4's travelling signal**: an animated `strokeDashoffset` pulse along the spine curves, in the **amber reward accent** against the **teal** network. This is the only new visual in the package.
- **Both exit paths set the flag** — finishing and skipping. See the acceptance criteria; this is the failure this package is most likely to ship.
- **Every animation routes through `motionTimingConfig` / `motionSpringConfig`** so `REDUCE_MOTION_OVERRIDE` is spliced in. Never reach for `ReduceMotion` directly — `motion.ts` is the only place it is imported in `apps/mobile`, and it stays that way.
- **Under Reduce Motion the animation is swapped, never removed:** the four lines cross-fade over a still frame of the finished network. All four lines still appear; the network is still drawn.
- **Text is real `<Text>` on the app's `typography`** — `display` variant, centred. **Not Caveat**, which is the sticky-note voice.
- Colour, spacing and duration come from `src/design/`. **No new tokens and no literals.**

**Out of scope:**
- **`roadmapGeometry.ts`, `roadmapModel.ts`, `TrackRoadmap.tsx`** — read and reuse, never edit. They are tested across 15–30 Leaves and this package must not disturb that.
- **`screens/share/constellationLayers.ts`** — reuse `buildDoneConstellationLayers` if it fits your needs. **If it does not, write an intro-local painter; do not modify the share one.**
- **Onboarding's five beats** — a separate, later package. This one ends at sign-in.
- **Sound.** The intro is silent; the sound layer has no assets yet.
- `apps/backend`, `apps/admin`, `packages/shared`.
- Any new dependency. `react-native-svg` and Reanimated 4 are already present and are all this needs.

**Constraints:**
- **Batch curves into one `<Path>` per (colour, width, opacity)**, the way `constellationLayers.ts` does. Thousands of individual `<Path>` elements will not render; dozens will.
- Animate a wrapping `Animated.View`'s transform, the way `TrackRoadmap.tsx` already does. Do not animate the SVG `viewBox` attribute.
- The flag read must not flash the auth stack before the intro appears. `RootNavigator` already has a `restoring` state for exactly this shape of problem — follow it.

**Inherited knowledge, so a `/clear` does not lose it:**
- **Reduce Motion ON makes the iOS Simulator swallow every touch in the bottom ~15% of the screen** behind an invisible debugger banner. Turn it off with `xcrun simctl spawn <udid> defaults write com.apple.Accessibility ReduceMotionEnabled -bool NO`. **You will be toggling Reduce Motion deliberately in this package, so you will meet this.**
- Screenshot pixel space is not the tool's tap-point space — that was the real cause of WP21–23's tap trouble.
- `simctl` switches theme and text size with zero taps; the route is in WP24's and WP26's log entries.

**Device gate** — what to observe, before any criterion below is claimed:

*Yours, on the simulator:*
- The four lines are **legible in dark and in light**, with the theme switched during playback rather than between runs
- Every line is **fully on screen at the largest OS text size** — no clipped glyph, no truncation, no line pushed off the bottom
- With **Reduce Motion on, all four lines still arrive and the finished network is still drawn** — nothing is missing, only the movement
- The **skip control responds on the very first frame**
- **After finishing, relaunching goes straight to sign-in. After skipping, relaunching also goes straight to sign-in.** Both, separately

*Flagged for the founder, on a physical iPhone — do not claim these yourself:*
- Whether it reads as **one continuous camera move** rather than four slides
- Whether the zoom **runs smoothly at the densest frame**, which is where the web and webDots resolve

**Acceptance criteria:**
- [ ] The four lines render in order and a test asserts the **exact strings**, so a transcription slip cannot reach published copy
- [ ] **Shown exactly once, both exit paths pinned separately:** one test drives the intro to completion and asserts the flag is set; a **second test skips it and asserts the flag is set**; a third asserts that with the flag already set, `RootNavigator` renders `AuthStack` and the intro never mounts. *A test that only exercises the completed path passes while skip silently leaves the flag unset — name and exercise both.*
- [ ] The intro is registered in `reduceMotionCallSites.test.tsx` and **rendered twice there, accommodation on and off**, matching the three surfaces already covered
- [ ] Under Reduce Motion, a test asserts all four lines still render and the network is still drawn — the swap, not a removal
- [ ] The graph is generated from a **fixed seed and fixed synthetic states**, with a test asserting identical geometry across repeated calls
- [ ] Every animated call site in the intro passes a config built by `motionTimingConfig` / `motionSpringConfig`; `ReduceMotion` is imported nowhere outside `motion.ts`
- [ ] **No file under `src/screens/track/` or `src/screens/share/` is modified** — confirm from the diff, not from memory
- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass — **and your report states the test count and the typechecked file count**, so they can be compared against the previous package's

**Testing expectations:** Unit tests for the seen-flag store (set, read, and the unset default) and for the beat sequencing. Component tests for the intro screen covering both themes, the four strings, and the Reduce Motion branch. The `reduceMotionCallSites` registration is a guard, not a substitute for the component tests. No e2e — this package has no backend surface.

**One thing to flag rather than fix:** if `buildDoneConstellationLayers` turns out not to fit, say so in your report with the reason. That is a finding about a shared primitive, and it is worth more than a silent fork.


---

## Completions (Manager → Architect)

### Completed: VO-3 — the player, and the narrator preference — 2026-09-18

**Code complete, fully tested, not device-verified.** Every test-shaped acceptance criterion is met and green; the device gate is not, for a reason outside this package's control — detailed below, not passed over quietly. Branch `vo-3-player` in the `ZO-vo3` worktree, off `origin/main` at `c675fac`. Not yet rebased onto the two `project/`-only commits origin/main gained while this ran (`b378258`, `3c7e2c3` — log archiving and a roadmap rewrite; confirmed via `git diff --name-only vo-3-player..origin/main` before this report, no overlap with anything below) — will rebase immediately before push.

| | |
|---|---|
| Automated gate | `npm run lint`, `npm run typecheck`, `npm test` — all green, root level, all four workspaces. `npm run build` — **backend and mobile green; admin fails**, pre-existing and unrelated (see below) |
| Mobile tests | **690** (657 baseline + **33 new**: 32 across 8 new suites, plus 1 added to `surfaces.test.tsx`'s existing Profile block) |
| Typecheck | Root `tsc` clean across `packages/shared`, `apps/admin`, `apps/backend`, `apps/mobile` |
| Device verification | **None obtained.** Expo Go itself never finished installing on the simulator — see "What I could not do." Every "Yours, on Expo Go" bullet in the handoff's device gate is therefore unverified, not just the silent-switch one, which was always the founder's alone |

---

## What changed

**New `apps/mobile/src/audio/`:**
- `narratorPreference.ts` / `useNarrator.ts` — the SecureStore-backed preference (`zoomout.narrator`, default `male`), following `introSeenStore.ts`'s pattern exactly rather than `SoundProvider`'s Context: nothing on screen needs the value from two places at once, so there is no shared state to keep in sync, and the handoff's own conflict note asked for no new shared-preferences abstraction.
- `selectNarration.ts` — pure `(audio, narrator) → AudioRef | undefined`, matching on the `narrator` field only.
- `audioSession.ts` — `configureNarrationAudioSession()`, one explicit `setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false })` call. Both flags happen to match the library's documented defaults today; both are asserted explicitly anyway; that mismatch-with-nothing is the point — a future SDK default change cannot silently take this out from under a reader.
- `useNarration.ts` — the player: wraps `expo-audio`'s `useAudioPlayer`/`useAudioPlayerStatus`, exposes `{ playing, toggle }`. No local "is playing" flag — the control's state is a direct read of the player's own status, so an OS interruption can only ever leave it showing "paused" or "playing," never a state of its own invention.
- `NarrationControl.tsx` — the one control, used identically on Summary, Scenario, Payoff and Takeaway. Renders nothing when there is no clip for the current narrator (the same rule `optionalImage`/`SlideImage` already apply to every other optional asset — see "Assumptions" below).

**`apps/mobile/src/components/Icon.tsx`:** two entries, `play`/`pause` (`play-circle`/`pause-circle`).

**The four slides** (`SummarySlide.tsx`, `ScenarioSlide.tsx`, `PayoffSlide.tsx`, `TakeawaySlide.tsx`): each places `<NarrationControl audio={...} label="..." />` directly, next to its narrated text. **Not through `SlideFrame`** — verified rather than assumed, per the handoff's instruction: `PayoffSlide` does not use `SlideFrame` at all (WP23.1's deliberate exception), so a `SlideFrame`-based seam would have missed a quarter of the slides. Payoff's placement is a plain sibling below the reward panel, not inside its animated `Animated.View` — a utility control has no business springing open with the unlock.

**`apps/mobile/src/screens/ProfileScreen.tsx`:** a new `NarratorCard`, two Pressables ("Female"/"Male", `accessibilityRole="radio"`), between the achievement grid and the account-details card. Reader-facing labels only — never the pipeline's provider voice names (Achernar/Sadaltager), matching `content.ts`'s own stated reason for keeping `narrator` and `voice` apart.

**`apps/mobile/package.json` / `app.json`:** `expo-audio@~57.0.5` via `npx expo install` (SDK-matched); the installer added itself to `app.json`'s `plugins` array automatically — not hand-edited. `expo-av` was not installed; SDK 57 ships `expo-audio` as the current package, confirmed from the installed package's own `.d.ts` rather than assumed from memory.

**`apps/mobile/jest.setup.js`:** `expo-audio` mocked globally, alongside `expo-secure-store` and the others already there — see "A real bug this caught," below, for why this had to move here rather than stay per-test-file.

**Tests:** `narratorPreference.test.ts` (default/set/read/unrecognised-value-falls-back), `selectNarration.test.ts` (the three server shapes, plus the positional fixture the acceptance criteria asked for), `audioSession.test.ts` (the exact config call), `NarrationControl.test.tsx` (eleven cases: the three render shapes, the accessibility label and its update, play→pause toggle, session config, background-stops, unmount-stops, and the leave-the-slide harness described below), one new test each in `SummarySlide.test.tsx` / `PayoffSlide.test.tsx` / `TakeawaySlide.test.tsx` (new files; neither slide had one before) confirming the control is wired to the right data, two added to `ScenarioSlide`'s existing block in `leafPlayer.test.tsx`, one new `StickyNotesSlide.test.tsx` pinning no control renders **even given a fixture with `audio` populated** — the mapper can never actually produce that, so this guards the component itself, not just today's data — and one added to `surfaces.test.tsx`'s Profile block, pressing the real rendered card and asserting the SecureStore write. New shared test helper `apps/mobile/src/testing/fakeExpoAudio.ts` — a small reactive fake (`play`/`pause` mutate a `playing` flag and notify a listener a component's `useAudioPlayerStatus` subscribes to), used by both the global mock and any test that needs to assert on it directly.

---

## A real bug this caught, not just a test-writing issue

Two, actually, both found by writing the tests the acceptance criteria asked for rather than by inspection — worth recording because neither would have shown up in a lighter test pass.

**1. `useNarrator`'s async preference read can outlive the first render, and nothing was switching the player's source when it did.** `useNarrator` starts synchronous state at the hard-coded default (`male`) and corrects it once a SecureStore read resolves — same shape as `useIntroSeen`. But `useAudioPlayer` creates its native player once, from a `useState` lazy initializer, and (as far as I can tell from its `.d.ts` — there is no JS source in this package, only types) does not react to its `source` argument changing on a later render. Put together: **every reader whose narrator preference is not the hard-coded default would, on every single visit to a narrated slide, briefly construct a player bound to the wrong clip on the first render, then never actually switch it** when the real preference arrived a moment later — the UI would relabel itself correctly while the underlying player kept pointing at the other narrator's audio. Caught by the "matches by narrator... second" test failing with the right clip's URL simply never appearing among created players. Fixed by splitting `NarrationControl` into an outer component (decides whether to render anything, no player created yet) and an inner `NarrationButton` **keyed on `entry.url`** — a changed narrator now unmounts the stale player (through the same cleanup already written for the unmount/leave-slide requirement) and mounts a fresh one bound to the right source from the start, rather than trying to reach into an existing one.

**2. `unmount()` is async in this RTL version, same as `render`/`rerender`.** Missed it the same way the existing top-of-file comment in `leafPlayer.test.tsx` warns about for `render` — an un-awaited call returns before the tree (and its cleanup effects) has actually committed. The unmount test passed 0 calls where it expected 1 until I checked the type (`() => Promise<void>`, confirmed from the installed package's own `.d.ts`) and added the `await`. Unrelated to this package's own code, but worth a line here since it is exactly the kind of thing that reads as a real bug on a first failure.

## A regression this almost shipped, caught before the report rather than in it

`ProfileScreen.tsx` importing `useNarrator` from the `src/audio` barrel transitively pulled in `NarrationControl.tsx` → `useNarration.ts` → `expo-audio`'s real module — which has no JS implementation under Node — into **every** test that renders `ProfileScreen`, including `surfaces.test.tsx`, which existed before this package and asserts nothing about audio. Running the full suite (not just the new files) is what caught it: `surfaces.test.tsx` failed with a native-module `TypeError` at import time. Fixed by mocking `expo-audio` once, globally, in `jest.setup.js` — the same shape `expo-secure-store` already gets there, and for the identical reason the file's own docstring gives: a native module with no JS implementation belongs in one place, not scattered as a per-test-file `jest.mock`. The five per-file mocks I had written before finding this were all removed as redundant once the global one existed.

## A finding that corrects the handoff itself, not something I did

**"`content.mapper.ts` builds a warnings channel when it drops a row, and as far as I can tell nothing surfaces those warnings anywhere"** — checked, because the handoff asked me to. **This is not true as written.** `apps/backend/src/content/content.repository.ts`'s `keepValid` and `requireValid` both already call a private `logWarnings`, which does `this.logger.warn({ warnings, kind }, 'Content served with some entries withheld')` whenever a mapped document's `warnings` array is non-empty (`content.repository.ts:169`, `:190`, `:208-214`). A suppressed clip is not invisible — it reaches structured logs at `warn` level, tagged with the Leaf id, slide, narrator and digest prefixes `mapAudioEntries` already builds into the message. What it does **not** have is any admin-UI-facing surface — nothing in Payload shows "3 audio entries withheld on this Leaf" — so the finding is real in a narrower form than stated: this is a log line an operator has to be watching for, not a blank space in the app. Whether that is enough is a product question, not a code one, and not mine to rule on — reporting the corrected fact.

---

## What I could not do

**No device or Expo Go verification, at all.** The handoff's own first instruction was to confirm `expo-audio` loads under Expo Go before building anything else. I could not get that far.

1. **The port-8081 Metro server already running belongs to another session** (`ZO`'s primary checkout, confirmed via `ps`) — left untouched. Started my own on `8083` instead: `npx expo start --ios --go --port 8083` from `ZO-vo3/apps/mobile`.
2. **Expo Go itself never finished downloading onto the simulator.** `nettop` on the Expo CLI's process showed an established connection to `cdn-185-199-108-133.github.com:443` sitting at a fixed **57,599,029 bytes received**, unchanged across two samples taken **~29 seconds apart**, after **12+ minutes** of elapsed time and near-zero CPU — a stalled transfer, not a slow one. Not a rejection and not evidence about `expo-audio`'s Expo Go compatibility either way; I simply never got a running Expo Go to test anything in. Killed the process and confirmed port 8083 free again once it was clear waiting further would not help.
3. **My own reasoned, unverified guess, stated as exactly that:** `expo-audio` is Expo's own first-party playback SDK (the direct successor to `expo-av`, which had Expo Go playback support for years), and nothing this package calls (`useAudioPlayer`, `useAudioPlayerStatus`, `setAudioModeAsync`) touches the recording-permission surface that typically needs a project-specific native config Expo Go's prebuilt binary cannot apply. That is a prior, not an observation — treat it as such.
4. **`react-native-web` is still not installed** (confirmed still absent, as INTRO-1's report found) — did not add it unilaterally, for the same reason INTRO-1 gave: a new dependency purely to route around a device-gate gap is a bigger, murkier change than the gap itself.
5. **Consequence, stated against the handoff's own device-gate list:** every "Yours, on Expo Go" bullet — narrated slide shows the control, switching narrator changes the voice, leaving the slide stops audio, largest text size in both themes — is **unverified by me**, on top of the two already flagged for the founder on a physical iPhone (silent-switch audibility, a real interruption). The founder's own attempt, at a moment when the network path to Expo's simulator CDN is not stuck, is genuinely the fastest way to get a real answer here — mine was not a close call, `nettop` showed zero forward progress.

**`apps/admin`'s build fails in this worktree, unrelated to anything above.** `next build` cannot collect `/api/graphql-playground`'s config: `PAYLOAD_SECRET` and `PAYLOAD_DATABASE_URL` are both undefined. `apps/admin/.env` is gitignored and this worktree never had one — `git worktree add` does not carry untracked files, and nothing in this package's scope ever touched `apps/admin` to notice. Confirmed pre-existing rather than caused by this diff: the primary `ZO` checkout has its own `apps/admin/.env`; this worktree does not, and never did. I attempted to copy it across — **the copy was blocked by a deny rule on reading that file**, which is the correct outcome and I did not try to route around it. `apps/backend` and `apps/mobile` — the two workspaces this package actually touches — both build clean. The founder can close this gap in seconds by copying their own `apps/admin/.env` into `ZO-vo3` if a fully green root `npm run build` is wanted; I cannot.

---

## Assumptions, stated so the next session does not have to reconstruct them

- **The "no-audio state" renders nothing, not a placeholder.** The handoff says a slide missing a clip shows "the same state as no audio... not a broken button" without specifying what that state looks like. I followed this codebase's own precedent for every other optional asset (`optionalImage`/`SlideImage`: "renders nothing at all when there is no image, rather than reserving an empty box" — WP23.1's explicit ruling) rather than inventing a visible "narration unavailable" indicator. Reasoning: voiceover is Ikigai-only today (VO-2's scope), so every other Track's narrated slides would otherwise carry a permanent, meaningless "unavailable" label. If the founder wants a visible indicator instead, that is a one-file change (`NarrationControl`'s early return) and worth a look on a device before deciding, not from this write-up.
- **`NarrationControl` is two components, not one** (`NarrationControl` deciding, `NarrationButton` owning the player, keyed on `entry.url`) — not asked for explicitly, but load-bearing for the bug in "A real bug this caught" above. Flagging the shape change in case a future package reaches for `NarrationControl` expecting a single flat component.
- **Reader-facing narrator labels are "Female"/"Male"**, invented for this package — the handoff and the schema both stop at the `female`/`male` ids and say nothing about display copy. Plain and literal seemed safer than guessing at product voice for two words; easy to change in one place (`NARRATOR_LABELS`, defined identically in `NarrationControl.tsx` and `ProfileScreen.tsx`) if the founder wants something else.
- **`NarratorCard`'s placement on Profile** — between the achievement grid and the account-details card — is my call, not specified. Reasoning: it is a preference, not identity (email/timezone) or a stat (streak/achievements), so it sits between the two groups rather than inside either.
- **The audio session is configured on every `NarrationButton` mount, not once globally** — no "already configured" guard. Simpler, avoids module-level mutable state that would need resetting between tests, and `setAudioModeAsync` is cheap and idempotent; the cost is a handful of redundant native calls per Leaf session, which seemed like the right trade against a stateful guard nothing asked for.

## Test count, against the last mobile package

**690 / 42 suites, up from 657 / 34** (INTRO-1, this same file, verified by re-reading its own report rather than assumed). +33 tests in +8 new suite files, plus one test each added to two existing suites (`leafPlayer.test.tsx` for Scenario, `surfaces.test.tsx` for Profile) — suite count only moves for genuinely new files, which is why it is +8 rather than +10.

## Where the time went

Rough, not measured, in descending order: **reading** (the mapper's audio contract, the shared schema, every existing slide component, `expo-audio`'s actual `.d.ts` rather than assumed API, the SoundProvider/introSeenStore precedents) — this was large, and deliberate, given how much of the handoff's risk was procedural-but-precise; **tests**, including the two real bugs above and the debugging to find them, a close second; **the Expo Go attempt**, thirteen-plus minutes of it dead weight once the stall is accounted for; **implementation** itself, genuinely the smallest slice — the design was mostly settled by the time of writing; the gate and this report, the rest.

## Follow-ups / tech debt for Architect

1. **The device gate is entirely open**, not partially — every "Yours, on Expo Go" item plus the two always-founder items. Worth deciding whether VO-3 should be considered mergeable on code+tests alone (as INTRO-1 effectively was) or should wait on someone reaching a working Expo Go session, given this is now the *second* package in a row to lose real time to this machine's device-verification path (INTRO-1: native build/Xcode; VO-3: Expo Go itself failing to download). If this is becoming a pattern rather than two unlucky packages, it may be worth its own investigation rather than being re-discovered a third time.
2. **`content.mapper.ts`'s warnings-are-invisible concern, as tracked, overstates the gap** — see "A finding that corrects the handoff itself" above. They reach structured logs; they do not reach the admin UI. Worth updating wherever this was tracked as an open item, since "nothing surfaces them" and "they reach logs but not the admin panel" call for different fixes if either is ever prioritised.
3. **`apps/admin`'s build is not runnable in this worktree** without the founder copying their own `.env` across — a `ZO-vo3`-specific gap, cost me nothing beyond the discovery since admin was never in scope, but the same wall would stop anyone else's `npm run build` here too.
4. **The no-audio-state design ("renders nothing") is a judgement call, not a ruling** — see "Assumptions" above. Worth a real look once someone can see the app.

**Anything I am not happy with, stated even though I shipped it:** the whole package rests on `expo-audio`'s hooks behaving the way their `.d.ts` and doc comments describe, since I have never once seen them run. The two bugs I did catch were both about exactly this kind of gap between documented and actual behaviour, and I have no way to rule out a third.

---

### Completed: INTRO-1 — the first-run intro — 2026-09-18

**Code complete, fully tested, not visually verified. That second half is not a footnote — three explicit requirements (the seed-by-eye comparison, the five simulator device-gate checks, "do not take the first one that runs") are unmet, not passed quietly.** Two independent, pre-existing environment problems on this machine blocked every avenue to a running build, detailed below. Branch `intro-1-first-run` in the `ZO-admin` worktree, off `origin/main` at `fa905c1` (fast-forwarded once more before push to pick up VO-3's handoff — unrelated, `project/` only, confirmed by `git diff --name-only` before merging).

| | |
|---|---|
| Automated gate | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — all green, root level, all four workspaces |
| Mobile tests | **657** (616 baseline + **41 new**: 35 across 6 new suites, plus 4 added to `navigation.test.tsx` and 2 to `reduceMotionCallSites.test.tsx`) |
| Typecheck | **966** files across the four-workspace `tsc` run; **117** under `apps/mobile/src` |
| Visual verification | **None.** Every "on the simulator" claim in this report is a test assertion, not an observation — see "What I could not do," which is the most important section here |

---

## What changed

**New `apps/mobile/src/screens/intro/`:**
- `IntroScreen.tsx` — the screen. One continuous camera move (`scale`/`focusX`/`focusY`, three `withTiming`s sharing one span that ends as beat 4 begins) from a tight frame on the fixture's `next` cell to the whole graph fitted to the viewport. Four lines crossfade on their own timeline, identical in both Reduce Motion branches — a fade is already the accommodation, so nothing there needs to swap. The camera and the beat-4 amber pulse do swap: under Reduce Motion they jump straight to their resting values with **no Reanimated animation object created at all**, rather than an animated-then-suppressed one.
- `introBeats.ts` — the four lines verbatim, their timestamps, and `INTRO_HANDOFF_MS`, derived once so the camera's span and the sign-in control's timer cannot disagree about when beat 4 starts.
- `introCamera.ts` — pure `{scale, focus}` math: `fitScale` (contain-fit, centred) and `introCameraFrames` (beat 1's tight frame, beat 4's fitted one).
- `introFixture.ts` — the fixed synthetic graph: 22 states (5 `done`, 1 `next`, 16 `locked`), a literal seed. **22, not a number in `PRODUCT.md`'s 15–30 range chosen for realism** — at 18 the fixture's graph fits inside most current iPhones at scale 1, making "zoom out" a no-op on the devices this ships to; 22 is taller than a Pro Max, so the fit-scale is genuinely below 1 on real hardware. Reasoning is in the file; the seed itself (`8_675_309`) was **not** chosen by the comparison the handoff asked for — see below.
- `introLayers.ts` — an intro-local painter, teal (`palette.primary`) for reached tissue and `palette.border` for unreached, no core buds. **`buildDoneConstellationLayers` does not fit, which is the finding the handoff asked me to report rather than silently work around**: it paints every soma's ring and core bud in `palette.reward`, the earned-progress colour, and nobody has read anything before sign-in. Reusing it would put reward amber on every node in the fixture; the handoff is explicit that amber belongs only to beat 4's pulse. Also exposes the spine as one joined subpath (`chainedPath`) rather than one `M` per gap — the batched static layers use `curvePath` per curve same as the reference files, but the animated pulse needs a single continuous dash phase, and concatenating per-curve `M...` output would reset that phase at every gap, reading as several signals firing at once instead of one travelling the line.
- `introSeenStore.ts` / `useIntroSeen.ts` — the SecureStore flag (`zoomout.introSeen`, `SoundProvider.tsx`'s pattern) and the `restoring`/`unseen`/`seen` hook `RootNavigator` gates on.

**`apps/mobile/src/navigation/RootNavigator.tsx`:** intro gate inserted ahead of `AuthStack`, inside the `status !== 'signedIn'` branch only — checking it unconditionally would show the intro to an *existing signed-in reader* on their next cold start after this update ships, since `introSeen` is a new flag nobody has ever set. `status === 'restoring'` still gates first; `intro.status === 'restoring'` gates second, same blank-frame shape, so a slow SecureStore read cannot flash `AuthStack` before the intro appears.

**Tests:** `IntroScreen.test.tsx` (both themes, the four verbatim strings, skip-from-frame-one, the skip→hand-off swap timed against `INTRO_HANDOFF_MS`, both Reduce Motion branches) · `introBeats.test.ts` / `introCamera.test.ts` / `introFixture.test.ts` / `introLayers.test.ts` (pure-logic coverage, including the "no reward colour anywhere" and "geometry is identical across repeated calls" acceptance criteria) · `navigation.test.tsx` gained an `Intro` block — shows-before-auth-stack, flag-set-on-skip, flag-set-on-completion (fake timers, see below), flag-already-set-skips-straight-to-auth-stack · `reduceMotionCallSites.test.tsx` gained `IntroScreen` as a fourth surface, both branches, with the exact call counts derived by hand (17 reduced-motion, 22 full-motion) and confirmed against the real spy rather than assumed.

**A fake-timers finding worth keeping**, since nothing in this repo's tests used them before: `jest.advanceTimersByTime` fires a `setTimeout` callback's `setState` synchronously, but the resulting React commit needs a microtask tick to flush through `act` even so — a bare `act(() => jest.advanceTimersByTime(ms))` leaves the pre-update tree on screen with no error. `await act(async () => { jest.advanceTimersByTime(ms); await Promise.resolve(); await Promise.resolve(); })` — two empty microtask turns, one was not enough — is the smallest fix I found by hand, isolated as `advanceTimersAndFlush` in `IntroScreen.test.tsx`.

---

## What I could not do

**Nothing in this app rendered on a screen this session.** Two separate, pre-existing environment problems, neither caused by this package:

1. **A native rebuild fails on this machine, unrelated to anything in this diff.** `expo run:ios` (after fixing an unrelated CocoaPods/Ruby locale crash — this host's shell has no `LANG` set, and `pod install` needs `LANG=en_US.UTF-8`) fails compiling `expo-modules-jsi`, a transitive Expo SDK dependency already pinned in the lockfile before this package touched anything: `JavaScriptCodable+Date.swift:53:50: error: type of expression is ambiguous without a type annotation`. This machine has exactly one Xcode installed, 26.3, building against the iOS 26.2 simulator SDK with `-swift-version 6` — a newer Swift compiler than whatever `expo-modules-jsi`'s pinned version was written against. **This will block anyone else's native rebuild on this same machine too**, including VO-3's, if that package's Manager tries one here for the audio-session device gate. Worth a decision — pin an older Xcode, or bump the dependency — before it costs a second package the same afternoon.
2. **The one pre-built `.app` already on the simulators (2026-09-10, predates this package) would not pick up a fresh Metro server.** I lost real time here chasing what turned out to be my own mistake — I killed my own standalone Metro process assuming `expo run:ios` would start its own, then it failed before reaching that step, so port 8082 had nothing listening for a while and every reconnect attempt was silently doomed. Once I caught that and restarted Metro, the dev-client's `com.zoomout.app://expo-development-client/?url=...` deep link (confirmed correct against `@expo/cli`'s own `UrlCreator.ts`) still never produced a single request in Metro's log, tried against two different simulators including a brand-new one created for exactly this (to rule out stale Keychain — SecureStore/Keychain data **does** survive uninstall+reinstall on this simulator, a finding in itself if anyone else assumes otherwise). Since even a successful reconnect would only have shown the **2026-09-10 binary's old code**, not this package's, item 1 is the one that actually matters — fixing item 2 without item 1 would not have gotten me a picture of `IntroScreen` either.
3. **Web is not an option without adding a dependency.** `expo start --web` refuses: `react-native-web` is not installed. I did not install it — a new dependency purely to work around a device-gate gap is a bigger, murkier change than the gap itself, and not mine to add unilaterally.

**Consequence, stated plainly against the handoff's own list:**
- [ ] "Choose the seed by looking... say which seeds you compared" — **not done.** `INTRO_SEED = 8_675_309` is a literal I picked with no rendering at all, justified in `introFixture.ts`'s comments by the reasoning I could do without eyes (node count, camera fit-scale arithmetic) but never looked at.
- [ ] `INTRO_FOCUS_SCALE = 6` (beat 1's magnification) — same: reasoned from the dendrite-reach constants in `roadmapGeometry.ts`, never seen.
- [ ] All five "yours, on the simulator" device-gate bullets — legible in both themes with a live switch, largest OS text size, Reduce Motion's still frame, skip-from-frame-one, both relaunch-after-finish and relaunch-after-skip — **none observed.** Everything under these headings above is a test passing, not a screen I looked at, and I have tried to say so everywhere rather than let a passing test read as a device check.
- [x] Everything else on the handoff's acceptance list — the eight items that are genuinely test-shaped (exact strings, both exit paths, the `reduceMotionCallSites` registration, the Reduce Motion swap, deterministic geometry, the motion-config routing, the `screens/track`/`screens/share` no-touch guarantee, the four root commands) — is met and independently re-checked; see "What changed" for which test covers which.

**I am not confident the intro looks right.** The camera math, the paint, and the pulse are all real, wired, and covered by unit tests down to "is the scale actually below 1 on real hardware" — but "does it read as one continuous move," "is the seed's graph shape pleasant," and "is the text legible over a busy beat-1 close-up" are exactly the three questions no test in this package can answer, and I have not answered them by looking either. Treat the seed and the scale constant as placeholders a first device pass should revisit, not as settled.

---

## Assumptions, stated so the next session does not have to reconstruct them

- **The camera uses `withTiming` with an explicit ease, not a `spring` preset**, despite `motion.ts`'s spring-over-linear default. Reasoned in `IntroScreen.tsx`'s own comment: the spring presets are tuned for short discrete feedback, and a spring stretched to ~10s either idles near zero velocity for most of its length or overshoots the "whole graph in frame" target and settles back into it, which reads as a bump rather than a pull-back. Flagging because it is a departure from a named convention, not because I think it is wrong.
- **The seen-flag gate sits inside `status !== 'signedIn'`, not ahead of the whole navigator.** Explained in `RootNavigator.tsx`'s docstring: gating unconditionally would show the intro to an already-signed-in reader on the first cold start after this ships, since the flag is new and nobody has ever set it for existing installs.
- **`buildDoneConstellationLayers` is not reused** — the handoff invited this finding explicitly ("if it does not fit, say so... that is a finding about a shared primitive"); see "What changed" above for the reward-amber reason.
- **No dedicated test file for `useIntroSeen.ts` itself** — its `restoring`/`unseen`/`seen` transitions are exercised through `navigation.test.tsx`'s `Intro` block against the real store rather than in isolation, which seemed like better coverage than the same three states asserted twice.

## Test count, against nothing

The handoff asks for a comparison to "the previous package's" count. The last several completions in this file are pipeline packages (VO-2.1, VO-1.1, VO-2, VO-1, WP33.1, WP33) — Python, a different test runner, a different app. I do not have a same-app mobile baseline close enough in this file to compare against honestly, so I am reporting **657 mobile tests / 34 suites, up from 616 / 28** (verified via `git diff HEAD~1 HEAD` on the two modified test files rather than assumed) rather than inventing a comparison that would look precise and would not be.

## Where the time went

Rough, not measured: **implementation** (the screen, the camera/paint/beat modules) a little under half; **tests** (including the fake-timers debugging) a quarter; **the device-verification attempt** — native build, deep-link reconnection, the fresh-simulator and Keychain detour, web as a last option — genuinely the single largest block, run through in "What I could not do" above rather than repeated here; the write-up, the rest.

## Follow-ups / tech debt for Architect

1. **The Xcode/`expo-modules-jsi` incompatibility (above) is environment, not code, but it is repo-relevant**: any Manager package needing an on-device check on *this* machine hits the same wall until someone either pins an older Xcode or moves the dependency version. Worth surfacing before VO-3 spends a package finding it independently.
2. **The seed and `INTRO_FOCUS_SCALE` need a real look** — the single most consequential unresolved item in this package. Whoever picks this up next should treat "does the intro look right" as unanswered, not assume the code passing tests means it does.
3. **`ZO-admin`'s `node_modules` was stale relative to the lockfile** (missing `react-native-svg` entirely — an existing dependency, not one this package added) and needed a plain `npm install` before anything using it would even typecheck. Fixed as part of this session; noting it in case another fresh worktree hits the same thing and wastes time wondering why an existing screen won't import.

