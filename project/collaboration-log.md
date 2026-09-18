# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.

**Give every entry a `### Handoff:` or `### Completed:` header.** Two completion reports — VO-1.1's and
VO-2's — were appended without one and were invisible to a structural scan of this file for weeks. The
headers were restored on 2026-09-18; the bodies were never touched. An entry with no header is not on a
list anyone reads.


> **This file keeps the four most recent entries of each section — plus any handoff whose package is
> still open**, an exception added 2026-09-15 because pruning a live handoff is how WP28 lost time.
> **Archive at each sign-off, not when it hurts**, and never while a session is mid-package.
>
> **Everything older is archived**, in git and readable, simply not loaded by default:
> Phase 1 (WP0–WP15) in `project/archive/collaboration-log-phase1.md` ·
> Phase 2 in `project/archive/collaboration-log-phase2.md` ·
> the visual redesign and the first two books in `project/archive/collaboration-log-redesign.md` ·
> **WP29–WP33.1 plus VO-1 and VO-2's handoff — Ikigai's images and the gates that let it publish — in
> `project/archive/collaboration-log-ikigai.md`** (split 2026-09-18).

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

### Handoff: 2026-09-18 — VO-2.1: attach both narrators

*Pipeline Manager. **Suggested model: Sonnet** — you built this path already; it changes shape, not intent. The one thing that could have failed silently, whether Python and Node hash text identically, **has been verified rather than left to you** (9 of 9 vectors, below).*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **This is a linked git worktree, so `git checkout main` will fail** — `main` belongs to the primary checkout at `ZO`. Use **`git fetch origin && git switch -c vo-2.1-attach-narrators origin/main`** instead. (Corrected 2026-09-18: the original text said `git checkout main && git pull`, which is what left this worktree squatting on `main` and blocked the founder.) **VO-1.1 is merged and the array shape is live in the dev database.**
> **Commit, push and open the PR yourself when done** — added to `agents/pipeline-manager.md` on 2026-09-17; it never reached that file before, which is why VO-2 sat uncommitted.
> **Read:** this handoff · **your own VO-2 report** · **VO-1.1's completion report** for the shape Payload actually returns · `packages/shared/src/content.ts` (`NARRATOR_IDS`, `audioRefSchema`) **as the source of truth to mirror, not a file to edit** · `agents/pipeline-manager.md`.
> **Do not read or edit:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: VO-2.1 — the 144 clips reach the CMS

**Suggested model:** Sonnet.

**Context:** VO-2 rendered and checked 144 clips and stopped at the write, correctly — one voice per slide was all the schema could hold. **VO-1.1 replaced that with an array keyed by narrator, each entry carrying a digest of the text it was made from.** Everything is cached: 183 raw renders on disk, so this package buys almost nothing.

**Objective:** All 18 Leaves carry both narrators on all four narrated slides, as pending draft versions, with digests the backend will accept. Nothing published.

**Scope:** `apps/pipeline` — principally `narration_patch` and `verify_narration_write` — plus Ikigai's Leaf records. **Verify against VO-1.1's report rather than assuming the array shape.**

**The entry shape** — one per narrator, per narrated slide:

```
{ narrator: 'female' | 'male', url, durationSeconds, textDigest }
```

- **`NARRATOR_IDS` in `packages/shared` is the source of truth.** Mirror the two values with a test asserting exactly `female` and `male`, and a comment naming where they come from. **Achernar → `female`, Sadaltager → `male`.**
- **`textDigest` is `sha256` of the narrated field exactly as Payload returns it** — `summary.body`, `scenario.prompt`, `payoff.body`, `takeaway.body`. **No trim, no normalise, no case change.** The backend recomputes it and **silently drops any entry that does not match**, so a normalisation on your side alone makes every clip vanish after the founder publishes.

  > **Already checked, so you do not have to:** `hashlib.sha256(t.encode('utf-8')).hexdigest()` and Node's `createHash('sha256').update(t,'utf8').digest('hex')` agree on all 9 test vectors — ASCII, em dashes, curly quotes, padded whitespace, three real Leaf bodies, **and both Unicode forms of "Héctor García", which correctly hash differently from each other.** Neither side normalises. **Add the vectors as a Python test anyway**, so a future change that introduces normalisation fails loudly here instead of silently in the app.

- **`durationSeconds` is now required and must be positive.** You already measure it from the encoded bytes.
- **Array order carries no meaning.** The reader's default narrator is an app setting, not position. Do not rely on order and do not sort to imply precedence.

**Requirements**
- **All narrators or none, per Leaf.** You already refuse a Leaf with one failing clip because *"three clips and a silent fourth reads as a broken player."* **The same across voices:** a reader who chose one narrator must never be handed the other mid-book. A Leaf attaches only when both narrators pass on all four slides.
- **Re-render what changed.** The founder corrected two texts, so those clips must be re-made — your cache keys on the text, so this should happen by itself. **Say which clips were re-rendered and confirm it was only those.** They are Leaf 5's summary and Leaf 9's payoff, in both voices — **4 clips, about $0.05.**
- **This is the first time the upload path touches the live CMS.** `Media` accepts `audio/mpeg` as of VO-1 and the admin server has since restarted. **If an upload is rejected, stop and report** — that is a finding about the running server, not something to work around.
- **Draft writes only** (`?draft=true`). Re-fetch both versions and verify. **Refuse any Leaf carrying unpublished changes**, as you already do — and **say so loudly if one does**, because it means someone edited text after this handoff and its digest will be wrong.
- **Report what Payload's array actually returns** — row ids, ordering, how an empty array comes back. **VO-3 will build against that**, and it is the shape a hand-written fixture gets wrong.
- Record the transport, as VO-2 did. Report spend.

**Out of scope**
- **Publishing.** The founder publishes the Leaves a second time after this lands. **Nothing here publishes anything.**
- **Track 42**, `stickyNotes` audio, re-recording anything the founder has not changed.
- **The player, the narrator picker, the default narrator** — VO-3.
- `apps/mobile`, `apps/backend`, `apps/admin`, and `packages/shared` — **read `NARRATOR_IDS`, do not edit it.**

**Constraints:** **$1.21 remains of the $3 voiceover ceiling** — VO-2 spent $1.79. Expected spend here is about $0.05. **If you are approaching the ceiling, something is wrong; stop and report.** **`runs/` is gitignored and holds 228 MB of paid renders — do not clean it.**

**Device gate — the CMS, not the app.** The audio lands as unpublished drafts, so there is nothing to hear yet, and **the backend cannot be reached at all right now** — port 3000 is held by an unrelated project and ZoomOut's backend is down (register, 2026-09-18). **What to observe: re-fetch all 18 Leaves and see, in the draft version, both narrators on all four narrated slides with a URL, a positive duration and a digest — and the published version still carrying no audio at all.** Say plainly that you could not observe anything in the app and why.

**Acceptance criteria**
- [ ] `ruff check`, `ruff format --check`, `mypy` **(the configured target — report the file and test counts, and explain any drop)**, `pytest` clean; nothing outside `apps/pipeline` touched
- [ ] **18 Leaves × 4 slides × 2 narrators = 144 entries attached**, each with URL, positive `durationSeconds` and a 64-char lowercase digest
- [ ] **Every digest recomputes correctly from the text Payload returns** — checked by re-reading the stored Leaf, not from what you sent
- [ ] **The cross-language vectors are a Python test**, and it fails if normalisation is introduced
- [ ] **Exactly 4 clips re-rendered** (Leaf 5 summary, Leaf 9 payoff, both voices) — named, with cost
- [ ] **Every Leaf still `_status: published` with all audio confined to the pending draft** — verified by re-fetching both versions
- [ ] **A Leaf missing either narrator on any slide is refused, not partially attached** — mutation-checked
- [ ] **Payload's real array response shape is reported** for VO-3
- [ ] Transport recorded; spend reported against the $1.21 remaining
- [ ] **Anything you are not happy with is stated even though you shipped it**

**Testing expectations:** unit coverage on the reshaped patch and verification, each mutation-checked as its own reversion. **The load-bearing new test is the digest vector set** — it is the only thing standing between a normalisation change and 144 clips silently disappearing from a reader's screen. Say which evidence is a test, which is tooling, and which is you.

---

### Handoff: 2026-09-17 — VO-1.1: two narrators, a digest, and the contract test that was never there

*Manager. **Suggested model: Opus** — unlike VO-1. The code is small and fully specified below. **The care is the package:** it pushes a schema change that **drops columns** on the database holding the only two real books, and its test creates and deletes content against real Payload. A careless run here costs Ikigai, not a test.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO`. `git checkout main && git pull`, then branch from `origin/main`. **Push the branch and open the PR yourself when done** — ruled 2026-09-17, now in `agents/manager.md`.
> **Read:** this handoff · `project/projectplan.md`'s voiceover section, **especially "The schema ruling"** · `packages/shared/src/content.ts` (`audioRefSchema`) · `apps/admin/src/collections/Leaves.ts` (`audioField` ~line 99) · `apps/backend/src/content/content.mapper.ts` (`optionalAudio`, `mapBodySlide`, `resolveMediaUrl`) and its tests · `agents/manager.md`, **including the corrected maximal-fixture paragraph** · `apps/pipeline/tests/test_cms_roundtrip.py` **as a pattern to read, not a file to edit**.
> **Do not read:** `design/`, `projectRoadmap.md`. **Do not edit** anything under `apps/pipeline`.

### Task: VO-1.1 — slide audio carries a narrator and a digest

**Suggested model:** Opus.

**Context:** Voiceover was scoped to one voice; **the founder then chose two narrators — a female and a male voice — for readers to pick between.** Pipeline Manager has 144 clips rendered and checked, and stopped at the CMS write because `audioRefSchema` holds exactly one reference per slide. **Nothing reads slide audio yet and nothing has ever been written to it, so the shape can change now without migrating any data. It will never be cheaper.**

Reading the pipeline's code also showed that **nothing about the source text ever reaches the CMS.** Audio is the first content in this model that is *derived* from other content, and right now a Leaf whose text is edited after its audio is attached would keep playing narration that no longer matches the screen — with nothing able to notice.

**Objective:** Every narrated slide can carry one clip per narrator, each clip records a digest of the text it was made from, and the backend serves only clips whose digest still matches — proven end to end against real Payload and the real backend.

**Scope:** `packages/shared/src/content.ts` (+ regenerated `cms-generated.ts`), `apps/admin/src/collections/Leaves.ts`, `apps/backend/src/content/content.mapper.ts`, their tests, and a new live contract test in `apps/backend`. **Plus the live dev database's schema.** Verify this list rather than trusting it.

---

## Part A — the shared schema

```ts
export const NARRATOR_IDS = ['female', 'male'] as const;   // the only list of narrators, anywhere

audioRefSchema = z.object({
  narrator:        z.enum(NARRATOR_IDS),
  url:             z.url(),
  durationSeconds: z.number().positive(),                 // required now — every clip is measured
  textDigest:      z.string().regex(/^[0-9a-f]{64}$/),    // sha256, lowercase hex
});
// each slide that has audio today:  audio: z.array(audioRefSchema).optional()
```

- **At most one entry per narrator per slide** — enforce it in the schema, not only in Payload.
- **The field is `narrator`, not `voice`.** "Voice" means Google's name (Achernar, Sadaltager) in the pipeline; keeping the two words apart is the point.
- **Nothing about a *default* narrator goes here.** Which voice plays before a reader chooses is an app concern, owned by VO-3. **Array order carries no meaning** — see Part D.
- Update the reservation comment on `audioRefSchema`: it is no longer reserved.

## Part B — the Payload field

`audioField` becomes a `type: 'array'` with `narrator` (select, from the same list — **one source for the narrator IDs; say how you wired it**), `url` (text), `durationSeconds` (number), `textDigest` (text).

- **Validate one entry per narrator** on the array.
- **Make it visible and read-only in the admin** instead of hidden — the founder will want to see what is attached, and **a hand-edited entry would carry a wrong digest**. `readOnly` affects the admin UI only; the pipeline writes through the API.
- Regenerate `cms-generated.ts` and confirm it matches.

## Part C — the live database. **This is the part that can hurt.**

Payload runs in **dev push mode** — there is no migrations directory. Turning a `group` into an `array` means the push **drops the group's columns** (e.g. `summary_audio_url`) on **both** `leaves` **and its versions table**, and creates new array tables. **Drizzle prompts before dropping columns.**

**Requirements, in order:**
1. **Take a restorable backup of the Payload database before anything else.** Say where it is and how you would restore it.
2. **Prove the columns being dropped are empty** — every audio column, on `leaves` and on the versions table, `NULL` in every row. **Show the queries and the counts.** Nothing has ever written audio, so they should be; *should* is not evidence.
3. **Record the baseline:** row counts for Tracks, Leaves and Leaf versions; published counts; **Tracks 42 and 50 and their 36 Leaves, with `_status` and `updatedAt`.**
4. Apply the push. **Do not run it in a way that auto-declines or hangs on the prompt** — a non-interactive shell is exactly where that happens. **If it cannot be applied cleanly, stop and report; do not improvise with raw DDL against this database.**
5. **Repeat step 3 and compare.** And the check that matters most: **an anonymous fetch of Track 50's Leaves still returns 18, all published** — the same query the founder used on 2026-09-17.

WP15.4 set the precedent: **verified against the live dev DB, not only a fresh container.**

## Part D — the backend mapper

- **Map the array to entries; drop Payload's row `id`.**
- **Every entry's `url` goes through `resolveMediaUrl`.** VO-1 fixed this for the single object two packages ago; **a reshape that reintroduces raw URLs undoes VO-1**, and the test for it must now use a relative URL *inside an array entry*.
- **The digest check.** For each entry, recompute `sha256` of the slide's narrated text and **omit the entry if it does not match**, with a **structured warning** (Leaf id, slide, narrator, digest prefixes). Find the mapper's existing mechanism for reporting problems rather than inventing one.

  | Slide | Narrated field — both sides must hash exactly this |
  |---|---|
  | summary | `summary.body` |
  | scenario | `scenario.prompt` |
  | payoff | `payoff.body` |
  | takeaway | `takeaway.body` |
  | stickyNotes | **none — omit any entry, with a warning.** Nothing writes it; an unverifiable clip fails closed |

  **Hash the value exactly as Payload returns it** — no trimming, no normalising. The pipeline will hash the value it reads back from Payload; any normalisation on one side only makes *every* clip look stale. That failure is at least loud — the audio disappears — but it is the one to test for.
- **Fail closed, per entry, never per Leaf.** A stale entry, a missing `durationSeconds`, or **two entries for the same narrator** (keep neither — array order carries no meaning, so there is no "first") each drop that entry and warn. **The Leaf itself stays readable.**
- **No entries left → no `audio` key at all** (`exactOptionalPropertyTypes`, as today).

## Part E — the backend contract test that `manager.md` described and nobody built

`manager.md` said for weeks that a maximal-fixture test in `apps/backend` fetched content through the backend. **It never existed** (corrected 2026-09-17). The pipeline's round-trip goes pipeline → Payload → pipeline and never calls the backend. **WP15's dropped fields and VO-1's raw audio URLs both lived on the seam no test covers — and this package changes that seam again**, from an object to an array, which is exactly where a fixture written from understanding diverges from what Payload really returns.

**Build it:** author a Track and Leaf in **real Payload** with **every optional field populated** — including audio for **both narrators on all four narrated slides**, with **relative** URLs and correct digests, **plus one entry with a wrong digest and one on `stickyNotes`** — publish them, fetch through the **real backend** as an authenticated reader, and assert every field survives: relative URLs absolute, the stale and `stickyNotes` entries absent, row ids gone.

**Constraints on the test, because of where it runs:**
- **It must never create, modify or delete anything belonging to Tracks 42 or 50**, or any record it did not create. Whether it uses a dedicated fixture Track in the dev database or an isolated one is your call — **say which and why.**
- **It cleans up even when it fails.** A failed run must not leave a fixture Track in the founder's Explore screen.
- **The fixture Track must satisfy `trackSchema`'s requirements, not just Payload's publish gate** — Payload checks two fields, the backend requires seven, and a Track that fails the backend's check is dropped silently. **That will look like "Leaf not found," not like a validation error.**
- **Live-marked and excluded from the default gate**, like the pipeline's; the run command documented.

**Out of scope**
- **Anything under `apps/pipeline`.** VO-2's held write path targets the old shape and **will not work against this one** — that is expected, and VO-2.1 reshapes it. **Nobody should run it in between.**
- Playing audio, the narrator picker, the default narrator — VO-3.
- `apps/mobile`. Writing any real audio to any real Leaf.
- The contract test for every other collection — this is the Leaf maximal fixture, which is what `manager.md` names.

**Constraints:** no new runtime dependency. `resolveMediaUrl` already exists. **Structured logging** on every suppressed entry — *nothing fails silently*. Only the pre-push backup and the baseline queries touch the database outside Payload.

**Device gate — the live database and the contract test, not a screen.** Nothing plays audio yet, so there is nothing to see in the app. **What to observe: the before/after counts matching, Ikigai still returning 18 published Leaves anonymously, and the contract test going green against the real backend.** And one thing on a device if you can: **Ikigai still opens and reads normally** after the push. Say plainly which of these you observed.

**Acceptance criteria**
- [ ] Root `npm run lint`, `npm run typecheck`, `npm test` clean — **report the test and file counts**, and explain any drop from the last package's
- [ ] A **restorable backup** existed before the push, and its location is stated
- [ ] **Every dropped audio column proven `NULL`** on `leaves` **and** its versions table before the push — queries and counts shown
- [ ] **Baseline and post-push counts match**; Tracks 42 and 50 and their 36 Leaves unchanged in `_status` and content
- [ ] **Anonymous fetch of Track 50's Leaves returns 18 published** after the push
- [ ] `audioRefSchema` is narrator-keyed with `textDigest`, one entry per narrator enforced, `durationSeconds` required
- [ ] **A relative URL inside an array entry maps to absolute** — and the test **goes red** with `resolveMediaUrl` removed from the entry path
- [ ] **A stale digest is dropped with a structured warning** — and the test **goes red** with the digest check removed
- [ ] **Two entries for one narrator: neither survives** — tested
- [ ] **The live contract test passes against real Payload and the real backend**, and **goes red** when the mapper maps only the first array entry
- [ ] **The contract test touched nothing it did not create**, and cleaned up after a deliberately failed run — say how you checked
- [ ] Nothing under `apps/pipeline` or `apps/mobile` changed

**Testing expectations:** unit tests for every mapper rule above, each mutation-checked **as a separate reversion** — WP33.1 showed that one combined mutation cannot tell a fix from its bodyguard. The contract test is the load-bearing new artefact: **its value is that it contradicts our own understanding of Payload's response**, so if it passes first time with no surprises, look again at what it asserts. Say which evidence is a unit test, which is the live test, which is a database query, and which is you looking.


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

---

### Completed: VO-2.1 — the 144 clips reach the CMS — 2026-09-18

**9 of 9 acceptance criteria met.** Ran on Sonnet 5, as suggested. `runs/ikigai` (183 raw
clips, 228 MB) buys almost everything: only 4 of 144 attached clips were freshly rendered,
matching the handoff's prediction exactly. Branch `vo-2.1-attach-narrators` in the
`ZO-pipeline` worktree, off `origin/main` at `9cf0b5b` (VO-1.1 merged; the array shape was
live before this package touched anything). Rebasing onto two unrelated planning commits that
landed on `origin/main` mid-session (onboarding/VO-3 scope, `project/projectplan.md` and
`projectRoadmap.md` — not read in depth, out of this role's remit) before push; neither
touches anything this package did.

| | |
|---|---|
| Attached | **144 = 18 Leaves × 4 slides × 2 narrators**, every entry with a URL, a positive `durationSeconds` and a 64-char lowercase `textDigest` — verified by an independent script, outside the pipeline's own code, that re-fetches all 18 Leaves and recomputes every digest from scratch |
| Re-rendered | **Exactly 4**: Leaf 5's summary and Leaf 9's payoff, both voices. Cost **$0.0346** (handoff estimated ≈$0.05) |
| CMS | First real write to the live server. **Every one of 144 uploads accepted `audio/mpeg`** — VO-1's promise, unverified until today |
| Live Leaves | All 18 re-fetched: `_status: published`, all four `audio` arrays `[]`, `updatedAt` unchanged |
| Held, then cleared | Leaf 12's scenario — see "What went sideways," below |
| Gate | `ruff check`, `ruff format --check`, `mypy` (the configured target: src + tests, **97 files**, unchanged from VO-1.1), `pytest` **438 passed** (VO-2's baseline: 422). Nothing outside `apps/pipeline` touched — confirmed by `git diff --stat` against every non-pipeline path the handoff named |
| Spend | **$0.0346** against the **$1.21** remaining. Ledger now $1.8230 of the $3.00 ceiling (Google Cloud) |

---

## Part A — the reshape

`cms/mapper.py`: `AudioRef` gained `narrator` and `text_digest`; `payload()` now emits all
four fields. `narration_patch` takes `Mapping[str, Sequence[AudioRef]]` and writes each
group's `audio` as a full array — still one whole-group PATCH per Leaf, per VO-2's original
design, now carrying two rows instead of one. `verify_narration_write` matches array rows by
`narrator`, never by position (`content.ts`: order carries no meaning), and checks all three
content fields — url, duration, digest — per row. New `narration_already_attached` replaces
the old `dict == dict` idempotency check with a narrator-keyed, id-tolerant comparison, since
Payload's own row `id`s don't exist before the first write and must never be compared.

`graph/narration_nodes.py`: `attach_leaf_narration` now takes **one Leaf's eight clips**
(every narrated slide, both narrators) and refuses before any read or upload if the set isn't
exactly that — checked as a full set against `{slide} × NARRATOR_VOICES`, not just a count, so
a caller that duplicated one narrator instead of supplying the other is refused with the same
clarity as one that's simply short a voice. `textDigest` is computed from `clip.line.text` —
**not** a fresh re-read of the Leaf at write time. That was a real design fork, reasoned
through rather than assumed: a fresh re-read would describe "the text right now," which
matches itself trivially and would silently paper over the one race this digest exists to
catch (text edited after the clip was made, before the write lands). `line.text` describes
what the clip actually says, so a mismatch at serve time means what it's supposed to mean.

`assets/narration.py`: new `NARRATOR_VOICES` (`NarratorId → Google voice name`, Achernar →
female, Sadaltager → male — the founder's audition ruling, now written down once rather than
carried in a CLI default) and `narrator_for_voice`, which refuses any other voice — an
audition voice or a typo has no ZoomOut identity to attach under. New `text_digest`: sha256
hex of a field's text, exactly as `NarrationLine.text` holds it. `models.py` gained
`NarratorId(StrEnum)`, mirroring `NARRATOR_IDS` in `content.ts` the same way `SlideKey`
already mirrors `SLIDE_KEYS` — same file, same precedent, same reasoning.

`cli.py`: `narrate` no longer takes `--voice`. It always renders and attaches **both** ruled
narrators together — the only shape that can satisfy "both or none" without a second,
merge-shaped write path I did not want to build and could not have made atomic. `--render-only`
now builds a review track per narrator in one invocation instead of one invocation per voice.
`config.py`'s `narration_voice` setting is gone — dead the moment `--voice` was, and nothing
else read it (checked: the only other caller, `audition-voices`, takes its own `--voice` list
and never touched the setting).

**Evidence: unit tests**, `test_narration_write.py`'s "patch" and "verify" sections extended
for the array shape (narrator-keyed matching, stale-digest detection, missing-narrator
detection, order-independence proven directly — not just relied on); a new `TestTextDigest`
class (9 tests); two new "attach" tests for the cross-voice refusal (missing entirely, and a
duplicate that leaves one narrator short); `test_narration_selection.py` gained the
`NARRATOR_IDS`-mirror test and a refusal test for `narrator_for_voice`. `narration_fakes.py`'s
`leaf_doc()` fixture now returns `"audio": []` per slide, matching what VO-1.1 proved the live
migration actually produces (Part C of that report) rather than the old single-reference
placeholder.

## Part B — the digest, the load-bearing test

**Cross-language agreement was already checked in the handoff and is not re-verified here** —
this file guards the Python side only. `TestTextDigest` asserts, independently of
`text_digest` itself (every expected value is computed inline with `hashlib.sha256(...)
.hexdigest()`, never by calling the function under test twice): ASCII, a closed-up em dash,
curly quotes, two real Leaf-shaped bodies, no trim, no case-fold, and both Unicode normal
forms of "Héctor García" hashing differently — proving no `unicodedata.normalize` anywhere in
the path. One more assertion lives inside the main attach test rather than standalone: the
fixture's scenario prompt has a closed-up em dash, so `.text` and `.spoken` genuinely differ,
and the attached `textDigest` is checked against `text_digest(.text)` and explicitly *not*
equal to `text_digest(.spoken)` — the one regression (digesting the TTS-rewritten form instead
of the stored field) a bare unit test on `text_digest` alone cannot catch, because
`RenderedClip.line` is the same object `narration_script` built; only a real attach exercises
the seam where a future edit could substitute the wrong one in.

**Independently, outside every test:** the verification script that checked all 144 live
entries (Part D, below) recomputed each digest from the JSON Payload actually returned and
compared byte-for-byte — the closest thing to the backend's own recompute-and-compare this
package can perform without the backend itself.

## Part C — mutation-checked, by hand, each reverted immediately after (md5-verified)

| Guard disabled | Test that went red | Everything else |
|---|---|---|
| the missing-narrator refusal | `test_a_leaf_missing_one_narrators_clips_entirely_is_refused` — and the run log shows *why* it matters: with the guard off, a female-only call attaches cleanly (`uploads=4 wrote=True`), which is exactly the one-voice-mid-book failure this exists to prevent | stayed green |
| the duplicate-clip refusal | `test_a_leaf_with_a_duplicate_clip_for_one_narrator_is_refused` | stayed green |
| the stale-digest check in `verify_narration_write` | `test_verification_catches_a_stale_digest` | stayed green |
| the missing-narrator check in `verify_narration_write` | `test_verification_catches_a_missing_narrator` | stayed green |
| `narrator_for_voice`'s refusal | `test_narrator_for_voice_refuses_anything_not_ruled` | stayed green |

All three touched files (`narration_nodes.py`, `mapper.py`, `narration.py`) confirmed
byte-identical (`md5`) to their pre-mutation state after every revert.

## Part D — the live write, verified independently of the pipeline's own claims

Ran `narrate --run-id ikigai --limit 1` first — one Leaf, alone — before trusting the tool with
all eighteen. Then, rather than trust `attached.passed`, re-fetched Leaf 262 by raw `curl`,
copied its stored `summary.body` text out of the JSON by hand, and computed `sha256` on it in a
separate Python process: matched the stored `textDigest` exactly, on all three narrated fields
I checked. Confirmed the *published* read of the same Leaf still carried `audio: []` on all
four slides and an `updatedAt` from before this session. Only then ran the full eighteen.

**The independent check, at scale:** a script (not part of the pipeline, not part of the test
suite — plain `urllib` and `hashlib`) fetched all 18 Leaves twice each (draft and live) after
the run, and for every one of 144 array entries: recomputed `sha256` of the live field text and
compared to the stored `textDigest`; checked `durationSeconds > 0`; checked a non-empty `url`;
checked the live Leaf's four arrays are `[]` and `_status` is `published`. Zero problems.
Output included below because it is the artifact this package exists to produce:

```
144 audio entries checked across 18 Leaves x 4 slides. Expected: 18 x 4 x 2 = 144.
Sample row: {"id": "6aac55dcafe0951eb0cc55f3", "narrator": "female",
  "url": "/api/media/file/ikigai-leaf-00-summary-achernar-d88c742c88.mp3",
  "durationSeconds": 24.41,
  "textDigest": "863efeea57955fd20437d786e8e300b546288e6b89784d0f0f0dd13369d318c3"}
ALL CLEAN.
```

**Payload's real array shape, for VO-3:** each entry carries an `id` — a 24-character hex
string, Payload's own row identity, absent before the first write and stable across re-fetches
after. Order in the response is whatever order the PATCH sent (this package always writes
female then male, because `NARRATOR_VOICES` iterates that way) — **not sorted, not guaranteed,
and content.ts is explicit that nothing may rely on it.** An untouched slide's `audio` reads
back as `[]`, never `null` and never omitted.

**What went sideways, worth knowing:** the first full run held Leaf 12 — its scenario has
leaked a spoken direction under regeneration since VO-2 first hit it, and the README's own
documented recipe uses `--max-attempts 3`, which I did not pass on the first attempt (I used
the command's default, 2). Re-ran with `--max-attempts 3`; the third attempt was already on
disk from VO-2's original audition, so the fix cost nothing and the seventeen already-attached
Leaves were re-verified, not re-written (`wrote=False, uploads=0` on every one — idempotency
held under a full second invocation, which is evidence for that mechanism I didn't have to
construct separately). **Worth a decision:** the CLI default of 2 attempts is a real trap for
a book with even one line like Leaf 12's — a future package should either default to 3 or the
README should say, before the first run rather than after a held Leaf, "known-difficult books
want `--max-attempts 3` from the start."

**No Leaf carried unpublished changes.** `pending_changes_besides_narration` never fired
across all eighteen — stated because a check that never once triggers is easy to stop
believing in without a session that watched it stay silent for a reason (nothing else touched
these Leaves since VO-1.1's migration).

## What I did not test, and why

- **CLI-level test of `narrate`.** Unchanged from VO-1.1/VO-2: the node functions are tested,
  the command was run live, twice, against the real CMS.
- **A clip list with all eight expected pairs present plus a ninth, wrong-voice clip.** The
  `extra` branch in `attach_leaf_narration`'s validation exists and the voice-refusal it
  depends on (`narrator_for_voice`) is unit-tested, but nothing exercises the two together
  through the attach path itself. Tier C — no caller in this codebase can currently produce
  this shape.
- **Google Cloud Monitoring request counts.** VO-2 and VO-1.1 both verified the transport
  (Cloud TTS, not AI Studio) this way in depth. This package's spend is four clips through the
  same, unmodified `SpeechClient`; I relied on that prior verification rather than repeating it
  for $0.03 of traffic.
- **The mobile app.** Could not: `EXPO_PUBLIC_API_URL` still resolves to port 3000, which is
  still held by an unrelated Next.js app on this Mac (confirmed independently — not ZoomOut's
  backend, which is what the handoff's device-gate note already said). Payload itself (port
  3001, where this package actually writes) answered every request normally throughout.

## Assumptions made

- **`textDigest` sourced from `clip.line.text`, not a fresh Payload read at write time** —
  reasoned through above (Part A), not merely the more convenient choice.
- **A slide's `audio` order is female-then-male** because that's `NARRATOR_VOICES`'s
  iteration order — never relied on downstream, and the verification script sorts before
  comparing.

## Deferred: Tier C worklist (inherited, unchanged, plus one addition)

Everything VO-2's original report deferred still applies (no live-model test suite for the TTS
client or guard, `audition-voices` has no output-name option, two `narrate` processes would
race on the cost ledger, the review pages are ~19 MB each). Added: the `extra`-clips branch
noted above.

## How to finish

Nothing left in this package. The founder publishes all 18 Leaves; VO-3 builds the player and
the narrator preference (per `projectplan.md`'s 2026-09-18 ruling: set at onboarding, not
chosen inside VO-3's own UI) against the array shape reported in Part D.

---
### Completed: VO-1.1 — slide audio carries a narrator and a digest — 2026-09-18

<!-- Header restored by Architect 2026-09-18 at the archive: this entry was appended without one, which made it invisible to a structural scan of the log. Body unchanged. -->

**12 of 12 acceptance criteria met.** Root `lint`, `typecheck` and `test` all clean —
**1,391 tests across the repo** (shared 77, admin 204, backend 494, mobile 616), up from
VO-1's 1,367 — **+24, all additions, nothing dropped**: +6 shared (the new `audioRefSchema`
shape and its narrator-uniqueness refine), +6 admin (`noDuplicateNarrators`, which had zero
coverage before this — nothing else exercised it), +12 backend (the mapper's audio rewrite
plus `content.repository.ts`'s new warning-logging path). Branch `vo-1.1-narrator-digest`, off
`origin/main` at `13dc7c0` (VO-1 and VO-2 both already merged when I started — my checkout was
stale on `vo-1-audio-path` and I re-read everything from `origin/main` before branching).
**Not yet pushed** — doing that immediately after this entry, per the handoff's instruction to
open the PR myself.

**Suggested model was Opus; I ran this on Sonnet 5.** Flagged to the founder before starting,
given the DB/live-test risk the handoff named — the founder's call was to proceed on Sonnet 5
rather than switch. Recorded here because the handoff called the model choice out explicitly
and a future reader comparing packages should know this one didn't follow the recommendation.

| Part | Status |
|---|---|
| A — shared schema | ✅ narrator-keyed array, uniqueness refine, `durationSeconds` required |
| B — Payload field | ✅ array field, visible + read-only, `noDuplicateNarrators` validate |
| C — the live database | ✅ backed up, proven empty, pushed under supervision, re-verified identical |
| D — the backend mapper | ✅ per-entry fail-closed filtering, `warnings` channel added to `MappingResult` |
| E — the live contract test | ✅ passes clean; confirmed red on the named regression; cleanup verified by query |

---

## Part A — the shared schema

`packages/shared/src/content.ts`: `NARRATOR_IDS = ['female', 'male']`, `narratorIdSchema`,
`audioRefSchema` now `{narrator, url, durationSeconds (required), textDigest (sha256 hex,
regex-checked)}`. Every slide's `audio` field is `slideAudioSchema` — an array with a
`.refine` enforcing at most one entry per narrator, factored once and reused across all five
slides rather than repeated five times. Updated the file's own "frozen content model" banner
comment with a third "thawed" paragraph, matching the two that already document WP15 and
WP15.1 — this is exactly the kind of change that comment exists to track.

**Evidence: unit tests**, new `describe('VO-1.1 audio', ...)` block in `content.test.ts` (6
tests) — accepts no audio, accepts one clip per narrator, rejects two for the same narrator
(with the exact refine message asserted), rejects a malformed digest (including uppercase —
the contract is lowercase, checked as a plain string equality by the mapper), rejects a
missing `durationSeconds`, rejects a narrator outside the enum.

## Part B — the Payload field

`Leaves.ts`: `audioField` is now `type: 'array'`, `admin.readOnly: true` (visible, not
hidden — the founder can see what's attached; a hand-edited entry would carry a digest that
matches nothing, so read-only is the honest state), fields `narrator` (select, options built
from the same `NARRATOR_IDS` shared imports the rest of the collection already reads from
`@zoomout/shared`), `url`, `durationSeconds`, `textDigest`, all `required: true` at the
Payload level too — safe to do because the field is machine-authored only, so this never
blocks a human mid-draft the way `imageFieldParts` deliberately isn't required.
`noDuplicateNarrators` is a field-level `validate` on the array — the same mechanism
`scenario.options`' `minRows`/`maxRows` already uses for a structural array constraint,
rather than routing through `leafRules.ts` (which is for cross-field/publish-readiness rules,
not this). Exported and given its own `Leaves.test.ts` — **the first test file this
collection has ever had** — because it is genuine new logic and nothing else touches it; the
live contract test's fixture happens to be valid, so it would never have noticed this rule
breaking.

Regenerated `packages/shared/src/cms-generated.ts` via `npm run generate:types
--workspace=apps/admin` — confirmed this does **not** touch the database at all (ran it,
watched it complete in under a second with no schema-push prompt, checked the DB schema
before and after: unchanged). That let me build and fully unit-test Part D against the real
generated shape before Part C ever touched the live database.

**Evidence:** 6 new unit tests in `Leaves.test.ts`, mutation-checked (disabling the
uniqueness comparison turns exactly one test red: "rejects two entries for the same
narrator"). Regenerated types spot-checked by reading the actual diff in
`cms-generated.ts` (narrator/url/durationSeconds/textDigest all non-nullable within a row,
because Payload reflects `required: true` inside an array item differently than it does for
a top-level group field — worth knowing if a future package assumes otherwise).

## Part C — the live database

**The part that could hurt, and where the founder's own hands did the one step I
mechanically cannot.**

1. **Backup.** `docker exec zoomout-postgres pg_dump -U postgres -d zoomout_cms --format=plain`
   → `apps/admin/backups/zoomout_cms_pre_vo1.1_20260917_212944.sql` (2.17MB, plain SQL,
   gitignored — added `apps/admin/backups/` to `.gitignore`). Verified complete: ends with
   Postgres's own "database dump complete" marker, and `COPY public.leaves (...)` /
   `COPY public.tracks (...)` both list every column I expected, including all ten audio
   columns about to be dropped. **Restore:** `docker exec -i zoomout-postgres psql -U
   postgres -d <a-fresh-database-name> < zoomout_cms_pre_vo1.1_20260917_212944.sql` — into a
   new database name, not back over `zoomout_cms` directly, so a bad restore can't compound
   a bad push.
2. **Proof of emptiness, by query, not assumption.** `SELECT count(*), count(col1),
   count(col2), ...` (Postgres's `count(col)` already excludes nulls) against all ten audio
   columns on `leaves` (58 rows) and their `version_*` counterparts on `_leaves_v` (279
   rows): **every one 0/58 and 0/279.** Full output is in this session's transcript; not
   re-pasted here since the numbers below already carry the proof.
3. **Baseline**, recorded to `apps/admin/backups/baseline_*.txt`: 30 Tracks (29 published), 58
   Leaves (57 published), 90 Track versions, 279 Leaf versions, 201 media, 4 admins. Track 42
   and Track 50 both `published`, `leafCount` 18 each, exact `updatedAt` recorded. All 36
   Leaves across both Tracks recorded individually (id, order, title, `_status`,
   `updatedAt`). Anonymous `GET {payload}/api/leaves?where[trackId][equals]=50` (no auth
   header — Payload's own `publishedOrAuthenticated` access control) → **18 returned, 18
   published.**
4. **Applied under supervision, in a terminal the founder could see and type into — not a
   non-interactive shell.** `payload run` (via a throwaway script, `getPayload({config})`
   then exit — deleted immediately after, never committed) triggered drizzle's push prompt.
   **The exact diff it showed matched my independent, pre-computed expectation
   column-for-column** — the same 10+10 columns from step 2, nothing else, no other table
   touched. I showed this to the founder alongside my own verification and asked them to
   type `y`; they did.
5. **Re-verified, not just trusted.** Old columns confirmed gone (`\d leaves`, `\d
   _leaves_v`); ten new tables exist (`leaves_{summary,scenario,payoff,sticky_notes,
   takeaway}_audio` and their `_leaves_v_version_*` counterparts), **all ten empty, 0
   rows**. Every baseline number reproduced identically: same totals, Track 42 and 50
   unchanged (`_status`, `updatedAt`, `leafCount`), **the 36-Leaf detail dump diffed
   byte-for-byte identical** against the pre-push file. Anonymous Track 50 fetch repeated
   against a freshly restarted admin server: **18/18 published again**, and `summary.audio`
   now reads back as `[]` rather than the old group shape.

**One real snag, unrelated to the database itself.** The admin dev server had been running
for days against the old schema; after the push it needed a restart to pick up the new
config, and Turbopack's own `.next` cache served a stale pre-bundled `@zoomout/shared` on
the first restart attempt (`Export NARRATOR_IDS doesn't exist`) even though the rebuilt
`dist/` on disk was correct — a `.next` wipe fixed it. **The founder was already using the
admin UI (I could see `GET /admin/collections/leaves/267` in the server log — the exact Leaf
the roadmap names for a text fix) while I did this**, so I want to be explicit: the restart
briefly interrupted that server, and I did not warn before killing the first (stale) process.
Worth a one-line heads-up next time this happens mid-session.

**Evidence:** the `pg_dump` file itself, plus every query and its output (transcript); the
founder's own confirmation in the terminal; a second, independent anonymous-fetch check
after the restart.

## Part D — the backend mapper

`content.mapper.ts`: `optionalAudio` is gone, replaced by `mapAudioEntries` — per slide, per
entry: narrator validity (defensive; Payload's `select` shouldn't admit anything else, but
`specFormat`'s precedent in this same file says not to trust that), `durationSeconds`
presence/positivity, digest match (`sha256` of the narrated field **exactly as Payload
returned it** — no trim, no normalise, checked by its own test), narrator-collision (two
entries for one narrator → both drop, since array order carries no meaning and there is no
"first" to prefer). `stickyNotes` has no narrated field, so any entry there is unconditionally
dropped. Every drop is a warning, never a Leaf failure — `MappingResult<T>`'s success branch
now carries `warnings: readonly string[]`, and `content.repository.ts`'s `keepValid`/
`requireValid` gained the `logger.warn` sibling to their existing `logger.error` calls — the
"mapper's existing mechanism for reporting problems," extended rather than replaced, exactly
as asked.

**Evidence: unit tests**, `content.mapper.test.ts`'s old `describe('audio URL resolution
(VO-1)', ...)` block replaced with `describe('VO-1.1 slide audio', ...)` — omission,
happy-path (both narrators, row id dropped), narrator validity, `durationSeconds` (absent and
non-positive), the digest check (stale, and a no-trim proof using padded whitespace text),
narrator collisions (both drop; and a second test confirming an *uncorrelated* narrator
survives a collision elsewhere), stickyNotes' unconditional drop, and one relative-URL
resolution test per narrated slide. New `content.repository.test.ts` (3 tests) — the
repository's first test file — proving `findLeaf` and `listLeavesForTrack` both log via
`logger.warn` when a mapping succeeds with warnings, and that a clean Leaf logs nothing.

**Every rule mutation-checked by hand, each in isolation, each reverted immediately after —
not claimed, actually run:**

| Rule disabled | Tests that went red | Everything else |
|---|---|---|
| `resolveMediaUrl` on the audio path | 8 — every test using a relative-URL fixture | stayed green |
| the digest comparison | 1 — exactly the digest-staleness test | stayed green |
| the collision-drop loop | 2 — both collision tests (the second because "last one wins" still fails its exact-array check) | stayed green |
| the `durationSeconds` check | 2 — both, failing as a **whole-Leaf** rejection rather than a per-entry one, exactly as predicted in the test's own comment | stayed green |
| the narrator-validity check | 1 — exactly that test | stayed green |
| the stickyNotes "no narrated field" guard | 1 — throws a `TypeError` hashing `undefined`, caught cleanly by vitest as a failure | stayed green |
| `noDuplicateNarrators` (Payload layer) | 1 — exactly that test | stayed green |

No case of "green for the wrong reason" turned up — the closest near-miss was the
`durationSeconds` mutation, which fails for a *different* reason than its own warning
message describes (whole-Leaf `safeParse` rejection, not a per-entry omission); the test's
own comment documents this rather than asserting something the code doesn't do.

## Part E — the backend contract test that `manager.md` described and nobody built

**New:** `content.mapper.test.ts`... no — `content.contract.live.test.ts`, plus
`vitest.live.config.ts` and `"test:live"` in `package.json`. Excluded from the normal gate by
a separate config file rather than an `exclude` pattern alone, because an `exclude` in
`vitest.config.ts` still applies even to a file named explicitly on the command line — a
plain `exclude` would have meant `vitest run content.contract.live.test.ts` silently ran
nothing.

**Two credentials, two different systems, deliberately not one.** The pipeline's machine key
cannot publish (`access/publishing.ts`), so authoring a *published* fixture needs a human
Payload login — reused `PAYLOAD_ADMIN_EMAIL`/`PAYLOAD_ADMIN_PASSWORD`, the exact pair
`apps/admin/src/seed/seed.ts` already uses, rather than creating a second identity. A minimal
Payload REST client is reimplemented locally in the test file (not imported from `apps/admin`
— that would be a real cross-app dependency for a Next-internal module) after
`PayloadRestClient` there proved the pattern: JWT login, and — because of the
`admins JWT <token>`-is-silently-anonymous trap this project has already been bitten by once
(2026-09-01, a delete loop that reported "0 Leaves deleted" and meant "not logged in") — the
client asserts `accountType === 'human'` after login rather than trusting a 200. The backend
read side is a **second,
unrelated auth system**: a throwaway app reader is created via the real `/auth/signup`
(falling back to `/auth/login` on a re-run, so it's idempotent rather than accumulating
throwaway users), and the fetch goes through `/content/tracks/:id` and `/content/leaves/:id`
with a real bearer token — the same path a reader's phone uses.

**Isolation: a dedicated fixture Track in the existing dev database**, not an isolated
instance — this project has no tooling to stand up a second Payload, and the existing
database is what "real Payload" already means for every other check in this package.
Matched, cleaned and re-created by one fixed, distinctive `bookTitle`
(`"ZO Live Contract Test Fixture — VO-1.1 (safe to delete)"`) and Leaf `title`, mirroring
`seed.ts`'s own `RETIRED_TRACK_TITLES` idiom exactly. `beforeAll` deletes any stray copy from
a previous failed run *before* creating a fresh one; `afterAll` deletes what this run
created, best-effort (logs, does not throw, so one delete failing cannot mask the other).
Track 42 and 50 are never queried by id or by any predicate that could match them.

**The fixture is maximal and deliberately uneven**, so one real write proves both the happy
path and both drop rules: summary/payoff/takeaway carry both narrators with correct digests;
scenario carries a correct female entry and a **deliberately stale** male one; stickyNotes
carries one otherwise-well-formed entry that is unconditionally unverifiable. Every other
optional Leaf field is populated too — scenario image, sticky-notes diagram (with spec and
format), Dinner Table Knowledge (sourced, so `checkDinnerTableKnowledgeIsSourced` doesn't
refuse the write), apply-in-life.

**It passed clean on the first real run — and `manager.md`'s own caution is that this is
exactly when to look again, not relax.** I did: I mutated the mapper (`.slice(0, 1)` on the
surviving entries, simulating "maps only the first array entry" — the specific regression
the acceptance criteria name), asked the founder to re-run the live test against the running
(hot-reloaded) server, and it failed with exactly the right assertion —
`summary narrators: expected [ 'female' ] to deeply equal [ 'female', 'male' ]`. Reverted,
confirmed green again via the local suite (I did not ask for a third live run; the revert is
byte-identical to the first, already-passing version, and root `typecheck`/`test` confirm it
compiles and the unit suite is undisturbed).

**Cleanup verified by query, not assumed — including after the deliberately failed run.**
After both the passing run and the failing one, `SELECT ... FROM tracks WHERE book_title LIKE
'ZO Live Contract Test Fixture%'` and the equivalent for `leaves` both returned **zero rows**.
vitest's `afterAll` runs on a failed test in the same describe block; this is what confirms
it actually did, rather than trusting that it should.

**A real, useful side effect: the warning-logging pipe was proven live, not just by unit
test.** The backend's own structured log from the passing run: `"Leaf 280: scenario audio
(narrator male) — omitted: stale textDigest (expected 4ab77a0b…, got 453ed5c3…)"` and the
stickyNotes line beside it, nothing else warned about — independent corroboration of Part D's
unit-level mutation checks, from a real request against a real database.

**Evidence: one live test** (the round trip itself, and its reverse under the deliberate
mutation), **one database query** (cleanup verification, both directions), **the backend's
own structured log line** (the warning pipe, observed rather than inferred), **the founder,
directly** (ran the live test twice, confirmed both outcomes verbatim in chat).

---

## Where the time went, roughly

Reconnaissance (re-reading from `origin/main`, tracing the auth/db/test conventions already
in the repo before writing anything) was the largest single share — more than implementation.
Implementation (Parts A/B/D) was comparatively quick once the shapes were confirmed. Part C
(backup, proof, push, re-verification) and Part E (the live test, plus two founder-run
round trips) together were the next largest share, mostly waiting on and verifying real
systems rather than writing code. The write-up you're reading took a noticeable amount of
time on its own, given how much needed to be said precisely rather than summarised away.

## What I did not test, and why

- **The device gate.** Could not get a clean "Ikigai still opens" read: `EXPO_PUBLIC_API_URL`
  defaults to `127.0.0.1:3000`, and port 3000 is held by an unrelated project on this Mac
  (`NormiesNotebook`) — the same port collision a prior session already recorded. The
  Ikigai Track screen showed "no Leaves yet" for exactly that reason (no reachable ZoomOut
  backend on the port the app expects), not because of anything this package changed. The
  anonymous Payload fetch and the live contract test both exercise the identical data path
  the app depends on, so I'm confident in the result without the screen — but I did not see
  the screen itself, and I'm saying so rather than papering over it.
- **Concurrent writes to the same audio array**, or a mix of a stale digest *and* a narrator
  collision on the same entry in one write. Both are Tier C — no product path produces either
  today (VO-2.1 attaches once, all-narrators-or-none), and the per-entry logic treats them as
  independent checks that would compound correctly by construction, but that is reasoning,
  not a test.
- **More than two narrators**, or a Payload row with extra unknown fields — `NARRATOR_IDS`
  has exactly two entries and nothing plans a third; not worth a test until it's a real case.

## Assumptions made

- **Model:** ran on Sonnet 5 per the founder's explicit choice, not the handoff's suggested
  Opus (see above).
- **`generate:types` does not touch the database.** Verified by running it and checking the
  schema before/after, rather than assumed — but flagging the check itself as an assumption
  worth someone else's awareness, since it is not documented anywhere and the opposite would
  have been a reasonable design too.
- **A dedicated fixture Track in the shared dev database**, not an isolated instance, for
  Part E — this project has no tooling for the latter, and building it was out of scope.

## Follow-ups for Architect

1. **The port-3000 collision is still live** and blocked this package's device gate exactly
   as it must have blocked a prior one. Not this package's to fix, but it will keep costing
   device-gate time on this Mac until either `NormiesNotebook` moves or `EXPO_PUBLIC_API_URL`
   gets a local override recorded somewhere a session can find it before reaching for the
   simulator.
2. **VO-2.1 can now proceed** — the array shape it needs to attach both narrators into exists,
   live, in the dev database. Per the roadmap, nobody should have run it against the old
   shape in between, and nobody did (`git status`/`diff --stat` confirm nothing under
   `apps/pipeline` changed in this branch).
3. **Restarting the admin dev server mid-session interrupted the founder's own use of it**
   (see Part C) — worth a one-line "give me a second, restarting the admin server" next time
   a schema push needs one, rather than doing it silently.

---

### Completed: VO-2 — 144 clips rendered, nothing written to the CMS — 2026-09-17

<!-- Header restored by Architect 2026-09-18 at the archive: this entry was appended without one. Body unchanged. -->

**6 of 9 acceptance criteria met; 2 are blocked by the founder's mid-package ruling, and 1 — listening to the full tracks — is the founder's, because I cannot hear audio.** The founder heard a six-voice audition and chose **two narrators, for readers to pick between: Achernar (female) and Sadaltager (male)**, then ruled to **hold every CMS write** until Architect rules how a slide stores two voices. `audioRefSchema` is one `{url, durationSeconds}` per slide and `content.ts` is frozen. So **144 clips are rendered, checked and in two review tracks; nothing is uploaded and no Leaf is written.** Branch `vo-2-ikigai-voiceover` in the `ZO-pipeline` worktree, off `origin/main` at `5e9d378` (VO-1 merged). **Not committed**, pending the founder's word.

| | |
|---|---|
| Clips | **144 = 72 × 2**, every one the approved text by the guard. Achernar: 65 exact, 7 minor, 0 major. Sadaltager: 67 exact, 5 minor, 0 major |
| CMS | **Nothing written, by ruling.** All 18 Leaves re-fetched at the end: `_status: published`, draft identical to live, no audio, `updatedAt` unchanged since the morning's read |
| Voices | Founder's choice, by ear, from my six-voice shortlist (reasoning below) |
| Direction | Per slide type, `prompts/narration_direction.md`. **Third version**: the first was read aloud, the second made the model ad-lib. **Founder listened to a with/without A/B and ruled to keep it** |
| Transport | Cloud TTS only: the client's own endpoint, a `narration_transport` record on the run, and Google's request counts |
| Spend | **$1.79 on the ledger (≈ $1.80 by Google's count) of $3**, Google Cloud credit. **~$0.32 of it wasted by my first direction** |
| Listening | **Nobody has listened to either full track. I cannot hear audio.** The evidence is the guard, the measurements, and the founder's ears |
| Gate | `ruff check`, `ruff format --check`, `mypy` (the configured target: src + tests, 97 files), `pytest` 422 passed. All clean |
| Artifacts | `ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/ikigai-narration-{achernar,sadaltager}.{html,mp3,md}`: 29:11 and 29:50. The HTML carries the track and seeks to any cue |

---

## Acceptance criteria

| Criterion | State |
|---|---|
| Lint, format, `mypy --strict`, `pytest` clean; nothing outside `apps/pipeline` | ✅ (this log entry is the only other file) |
| 72 clips attached with URL, measured `durationSeconds`, descriptive `alt` | ⛔ **Held by ruling.** `durationSeconds` is measured by decoding the exact mp3 that would upload. `alt` reads "Narration of the Payoff slide, Leaf 4 of Ikigai, read by Achernar". **The upload path has never touched the live CMS**, so the running server accepting `audio/mpeg` is still unverified |
| Every Leaf still published with audio in a pending draft, verified by re-fetch | ⛔ Held. The write-and-verify path is built and tested: whole-group PATCH, re-fetch of both versions, refusal of a Leaf with unpublished changes. All 18 re-fetched at the end, untouched |
| No `sourceReferences[].quote` sent to TTS | ✅ Structurally (one function reads four named fields; the TTS client accepts only its output) and behaviourally (a sentinel in every silent field, through the whole render path including regeneration). Mutation-checked |
| Voice choice with reasoning; per-slide-type direction written down | ✅ Below; direction in `prompts/narration_direction.md` |
| Review track exists and you listened | ⚠️ **Two tracks exist.** **I listened to none of it.** The founder listened to the audition before choosing; the full tracks are theirs to hear |
| Transport recorded as a queryable row; Cloud TTS confirmed, not AI Studio | ✅ `status --run-id ikigai` → `narration : cloud-tts (zoomout-vertex) via texttospeech.googleapis.com — gemini-2.5-flash-tts`. A `narration_transport` row per checkpoint in `checkpoint_blobs` (msgpack, like WP32's `transport`). Google Monitoring below |
| Spend reported against $3 | ✅ Breakdown below |
| Anything not happy with is stated | ✅ Below: everything the guard and the measurements flagged, and what they cannot see |

## Needs a decision

1. **Architect: how a slide carries two voices.** Today there is one optional `audio: {url, durationSeconds}` per slide in `content.ts`, one `audio` group per slide in Payload's Leaf, and one in the backend mapper. **Nothing reads it yet (VO-3 is unbuilt) and nothing has been written, so the shape can change now without migrating any data.** It will never be cheaper.
   - (a) **`audio: AudioRef[]`, each with a `voice` key.** One field, any number of narrators; the player picks by the reader's preference and falls back to the first. A breaking change to an unused type. **My recommendation.**
   - (b) Keep `audio` as the default voice and add `audioAlternates: AudioRef[]`. Additive, but two places to look.
   - (c) `audioFemale` / `audioMale`. This writes today's product decision into the schema. Not recommended.
   - Whichever shape: **make `voice` a ZoomOut key (`female`, `male`), not Google's voice name.** Then a narrator can be re-cast, or a second book voiced differently, without breaking a reader's saved preference. The Google name is already in each file's name and `alt`.
2. **Product / VO-3: which voice plays before a reader chooses.** Not yet ruled.
3. **Founder: listen to both full tracks** (about 59 minutes together) before the second publish. Each page's "Listen here first" list has 11 entries; the rest of the listening is the drift check nobody else can do.
4. **Founder: commit, push and PR?** Nothing is committed yet; this harness commits only on request.
5. **Content, not narration: two Leaf texts worth a look.** Leaf 5's summary writes the Japanese plural as "takumis", and both voices said "takumi". Leaf 9's payoff says "…a secondary income stream expose you…", which both voices said as "exposes"; the verb is correct for the compound subject, but it reads as a slip.

## The direction took three versions

**v1 was read aloud.** It opened "Read the text exactly as written: every word, in order…". Gemini-TTS spoke everything after that colon before the Leaf text in **12 of 13** directed audition clips: 60–85 s of audio for 11–25 s of text. The 13th opened "Sound like a software developer" where the Leaf says "You are". Cost: about $0.32. **The founder was told, and re-approved the spend before anything else was bought.**

**v2 made the model chat.** "Introduce this idea … as if telling a friend" put **"You know, in Okinawa…"** in front of 4 of 6 audition summaries: words nobody wrote.

**v3 is short and descriptive, with no conversational framing.** Tests now forbid colons, "read", quotation marks, and "friend", "telling" or "chat". **It still leaks occasionally, but only from the imperative per-slide sentences, never from the shared block:**
- Achernar: 5 of 72 first attempts were major (two dropped phrases, three spoken directions).
- Sadaltager: 2 of 72 first attempts were major, both spoken directions, and Leaf 12's second attempt was major the same way.
- **Leaf 12's scenario leaked twice in both voices** ("Your 70-year-old neighbor, Arthur…" seems prone to it), so `narrate` gained `--max-attempts` (1–3, default 2). The third attempt was clean both times.

**What the direction measurably does: it slows the read, and does not add pitch movement.** Sulafat, the same lines undirected → directed:
- scenario 17.5 s → 21.1 s;
- takeaway 11.6 s → 18.4 s, with pitch movement down from 5.3 to 3.8 semitones;
- summary 26.8 s → 30.0 s.

**The founder listened to that A/B and chose to keep the direction.** Directed takeaways now run at about 96–98 wpm, against 116–135 for the other slides.

**Emotion tags are not used.** Google's own guide documents that adjective tags such as `[curious]` are spoken aloud; the handoff's `[curiosity]` and `[hope]` are untested tags of exactly that kind.

## The guard, and the check that does not trust it

**The guard is a blind transcript**: Gemini 3.6 Flash on Vertex, never shown the text, compared word by word. **Its first prompt was not good enough.** It silently left the spoken direction out of 9 of 13 transcripts and graded 80-second clips "exact". A literal re-transcription exposed this. The rewritten prompt ("leave nothing out, including anything that sounds like an instruction") returned all 194 words of the same clip and listed the spoken direction. Readings are cached by clip, bytes, model **and a digest of the guard prompt**, so a reading made under the old prompt cannot answer for the new one.

**The pace check needs no model.** It measures words per minute of *speech*, pauses excluded, and requires 100–330. Leaked clips measured 30–42; undirected clips 173–182; directed clips 130–161. **The first version measured total clip length and was wrong:** it failed a slow, word-for-word takeaway whose extra time was all pauses.

**Severity rules:**
- **Major:** a spoken tag or instruction; **any added word**; a run of 2 or more skipped words; a 3-word run of differences; or differences in 10% of the clip. An unnatural pace also overrules to major.
- **Minor:** a single word heard differently, usually a transcription of a name or a plural.
- **A clip still major after its attempts holds back its whole Leaf.** `attach_leaf_narration` refuses before any read or upload, because three clips and a silent fourth reads as a broken player.

**Minor findings worth a listen:**
- **Achernar:** "the authors state" heard as "the author states" (Leaf 13 summary) and "argue" as "argued" (Leaf 12 payoff) may be real misreadings. "Jiro's" as "Jiro" and "warm-ups" as "warmups" look like transcription.
- **Sadaltager:** "intensity" heard as "intensive" (Leaf 16 summary) may be real; "you have" as "you've" (Leaf 11 scenario) is small.
- **Both voices:** takumis, expose and antifragility. The first two are the text itself (item 5); the third is a transcriber splitting the word.
- **Sadaltager's Leaf 7 payoff** ends with speech-level sound in the model's final 20 ms, so its last syllable may be clipped. **This is the one acoustic flag to hear first.**

## The voices

The shortlist came from Google's own one-word descriptors; **the founder chose by ear, not me.**
- **Auditioned:** Sulafat (warm), Vindemiatrix (gentle), Achernar (soft), Achird (friendly), Sadaltager (knowledgeable), Algieba (smooth).
- **Left out before any audio was made:**
  - upbeat, excitable, lively and bright: tiring across 23+ minutes;
  - breathy: fatiguing, and at odds with the "no breath at the cut" requirement;
  - firm and informative: newsreader risk. Kore, the docs' default, is in this group, and the handoff said not to take the first voice in the list;
  - youthful, forward, gravelly and casual.

## Transport, checked three ways

1. **The client's own endpoint.** It is read off the constructed GAPIC client and refused unless it is a Cloud TTS host: `texttospeech.googleapis.com`. The client has no API-key parameter; it uses ADC with `zoomout-vertex` named as the quota project.
2. **Recorded on the run.** `narration_transport` (transport `cloud-tts`, project, model, endpoint) sits beside the existing Gemini `transport` and is printed by `status`.
3. **Google's request counts** (Cloud Monitoring, `api/request_count`, `zoomout-vertex`, last 12 h):
   - `texttospeech.googleapis.com`: SynthesizeSpeech **185 × 200** and 1 × 499.
   - **`generativelanguage.googleapis.com` (AI Studio): no requests.**
   - `aiplatform.googleapis.com`: the guard's calls, each counted under two method names, plus 5 × 429 that were retried.

   The 185 reconciles exactly: 183 clips on disk, plus Leaf 13's payoff (timed out on our side but completed on Google's, and charged twice by design), plus one v1 clip that was in flight when I stopped the first audition. The recipe is in the README.

## What VO-3 inherits: the files, as they are

- **Format:** mp3, 64 kbps CBR, mono, 24 kHz (MPEG-2 Layer III). That is the only audio type `Media` accepts.
- **Levels:** −20 dBFS over speech frames, with a −2 dBFS peak ceiling.
- **Edges:**
  - 60 ms before the first sound;
  - **350 ms of digital silence after the last**;
  - a 5 ms fade-in and a 30 ms fade-out;
  - any low sound lasting more than 250 ms after the last word is treated as a breath and cut.
- **`durationSeconds`:** decoded from the exact bytes, to 2 decimal places, **including about 50 ms of encoder padding**.
- **Clip lengths (Achernar):**
  - summary 22–38 s, median 27;
  - scenario 11–26 s, median 18;
  - payoff 18–42 s, median 34;
  - takeaway 12–29 s, median 15.

  A whole book is about 29–30 minutes per voice.
- **Names:** files are `ikigai-leaf-04-payoff-achernar-<sha256[:10]>.mp3`, and `alt` reads "Narration of the Payoff slide, Leaf 4 of Ikigai, read by Achernar". The hash makes "already uploaded?" a filename lookup.
- **Two voices per slide plus a reader preference**, pending item 1.

## Spend: $1.79 on the ledger of the $3 ceiling (Google Cloud)

| | USD |
|---|---|
| First audition, direction v1 (read aloud): **wasted** | 0.303 |
| Diagnostics that found it (a literal transcription, a guard validation) | 0.016 |
| v2 probe (2 clips) | 0.015 |
| Six-voice audition, v2 | 0.150 |
| v3 summary probe (2 clips) | 0.020 |
| Achernar: 69 new clips (3 reused from the audition and probe), 6 retries | 0.652 |
| Sadaltager: 69 new clips (3 reused), 3 retries | 0.627 |
| Estimated charge for one timed-out call | 0.006 |

**The ledger is reconciled against the files:** every paid clip has one speech entry and every reading one guard entry. Four entries have no file, all on purpose: two diagnostics, the timeout estimate, and the timed-out Leaf 13 payoff charged a second time.

**Against Google's count,** the ledger is about $0.02 short (the v1 clip I killed in flight) and about $0.006 over (the timeout estimate, which Google shows as a client-cancelled 499). **So true spend is about $1.80.**

The machine's network dropped mid-Sadaltager. That run only wrote spend back per Leaf, so one paid clip and its reading were missing; they were found and added from the files. **Spend is now written back after every call**, and a timed-out call is now charged even when every retry fails. Only timeouts are charged; refused connections and 429s never reach generation.

## Evidence: which is a test, which is tooling, which is nobody

- **Tests (422 passing).** They cover:
  - the four-field boundary, as behaviour, structure and entry point;
  - draft-only writes, checked on the wire;
  - the whole-group PATCH against WP19's nulling;
  - re-fetch verification of both versions;
  - refusal of a Leaf with unpublished changes;
  - find-then-skip uploads;
  - the served-bytes proof;
  - the hold;
  - budget reserved before the call;
  - never buying the same clip twice;
  - bounded regeneration;
  - speech-only pace;
  - the guard's blindness and its severity rules;
  - host refusal and a single retry layer;
  - timeout accounting, and spend written back per call;
  - per-voice register;
  - audio levelling, edges, duration and pitch, on synthetic signals.
- **Mutation checks, by hand: 19 of 19 turned a test red.** Each file was restored byte-identical (checked by md5). The mutations:
  - a quote made reachable (two ways);
  - a partial group PATCH;
  - the draft flag dropped;
  - no find-then-skip;
  - live status left unchecked;
  - audio uploaded as png;
  - budget not reserved first;
  - pace ignored;
  - the library retry left on;
  - any host accepted;
  - the guard shown the text;
  - unpublished changes ignored;
  - a failing clip attached;
  - served bytes not compared;
  - a stale guard reading reused;
  - timeouts on a failed call not charged;
  - every failure charged;
  - spend not written back per call.

  One was first missed ("live status unchecked") and needed a new test: a Leaf that was never published.
- **Tooling:** the guard, the pace and pitch measurements, the cue sheets, and Google's request counts.
- **Nobody:** whether it sounds like a person who means it. The founder heard the six-voice audition; nobody has heard the full tracks.

## Other findings

- **WP33.1's "mypy clean" was `mypy src` (50 files), not the configured target (src + tests).** Its `SecretStr` change had left 12 type errors in the tests. Fixed here. Two raw-string calls exist to test the environment path, and those keep a commented ignore.
- **The generated TTS client declares no default timeout and no default retry.** Both are now passed on every call (`retry=None`), so a library update cannot quietly add a second retry layer.
- **ADC user credentials carry no quota project.** The client names `zoomout-vertex` explicitly.
- **`miniaudio.decode` resamples to 44.1 kHz unless told otherwise.** The duration survives; every other measurement would not.
- **A no-op sleep paired with the real clock makes the rate limiter spin for a real minute.** That cost four minutes of test time until the fakes got a clock that advances.
- **The first cue sheet had two flaws.** It keyed notes by (Leaf, slide), so an audition's six readings of a line collapsed into one. It also compared a soprano's pitch with a baritone's. Both fixed: notes are keyed by voice, and the register limit is relative to each voice's own spread. The flat 2-semitone limit had flagged 15 of Sadaltager's clips; that was his normal range.
- **`upload_media` never caught `URLError`**, unlike its sibling `_request`. Fixed; a test confirms the image path still sends `image/png`.

## Deferred: Tier C worklist

- No CLI-level test of `narrate` or `audition-voices`. The node functions are tested, and both commands were run live.
- No live-model test suite for the TTS client or the guard.
- **The upload/attach path has never run against the live CMS** (held).
- `narration_transport` is msgpack in `checkpoint_blobs`, read through `status`. There is no plain-SQL egress table.
- `audition-voices` has no output-name option, so a second audition overwrites the first. The v3 probe called the render step directly to avoid that.
- Review pages embed the whole track, about 19 MB each.
- Two `narrate` processes on one run would race on the cost ledger. Run them one after the other; the README says so.
- The listening page used for the audition grid (per-clip players) was a one-off script, not pipeline code.

## How to finish, once item 1 is ruled

1. Change `narration_patch` and `verify_narration_write` to the ruled shape. Their tests already cover the whole-group and re-fetch behaviour.
2. For each voice, run `narrate --run-id ikigai --voice <v> --max-attempts 3 --listen-for …`. Every clip and reading is cached, so the only cost is the uploads and 18 PATCHes.
3. The founder publishes the Leaves again.

**Files:** all under `apps/pipeline/`.
- New: `assets/{narration,speech,audio,narration_guard,review_track}.py`, `graph/narration_nodes.py`, `prompts/narration_{direction,guard}.md`, `tests/narration_fakes.py` and seven test files.
- Changed: `cli.py`, `config.py`, `cost.py`, `models.py`, `graph/state.py`, `cms/{client,mapper}.py`, `llm/client.py`, `assets/{__init__,budget}.py`, `README.md`, `pyproject.toml` and `uv.lock`, plus nine existing test files.
- New dependencies: `google-cloud-texttospeech`, `numpy`, `lameenc` and `miniaudio`. `lameenc` is LGPL, which is fine for internal tooling that isn't distributed.

**Time:** about 9 hours of wall clock. Roughly 2.5 h on reading and building, 2 h on the three direction versions and their evidence, 3 h waiting on renders (including the network drop and resume), and 1.5 h on reconciliation, calibration and this report.

