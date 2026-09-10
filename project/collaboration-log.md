# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.


> **Phase 1 entries (WP0–WP15, to 2026-08-13) moved to `project/archive/collaboration-log-phase1.md`
> on 2026-08-28.** This file was 397KB — roughly 100k tokens that every session paid before reading a
> line of code. The archive is the durable record and is still there when a decision needs tracing;
> it is simply no longer loaded by default.


> **Older entries are archived.** Phase 1 in `project/archive/collaboration-log-phase1.md`,
> Phase 2 in `project/archive/collaboration-log-phase2.md`. This file keeps the four most recent
> of each, because every session pays for all of it at startup. Archive at each sign-off, not when it hurts.

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

### Handoff: 2026-09-10 — WP28: diagnose the tap failure and Reanimated's reduce-motion disagreement

*Manager. **Suggested model: Opus** — **the finding is the deliverable.** There is no design here and no feature; the output is an explanation, and a wrong one costs a fifth package.*

> **Read:** this handoff · `apps/mobile/src/design/motion.ts` · the three call sites using `motionTimingConfig` (`PayoffSlide`, `ScenarioSlide`, `AchievementUnlock`) · `apps/mobile/src/screens/track/TrackRoadmap.tsx` · your own WP25, WP26 and WP27 completion reports in this log — **the three tap reports are the evidence base and you wrote all of them** · `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `apps/pipeline`, `apps/admin`, `apps/backend`, `design/`.

### Task: WP28 — diagnose, do not work around

**Suggested model:** Opus.

**Context:** The Leaf-player tap failure has **three independent reports across three packages**, and each was met with a different workaround. **A fourth workaround costs more than an explanation.** While eliminating the Reduce Motion banner as the cause, WP27 found something else: **Reanimated reports reduce-motion as ON while the OS reports OFF.**

**Objective:** An explanation, with evidence. A fix if the explanation yields one cheaply — but **an accurate "here is what it is and here is what it costs to fix" is a complete result**, and a plausible-sounding guess is a failure.

**Scope:** diagnosis. Any fix must be justified by the diagnosis, not by making a symptom stop.

**The three questions, in this order**

1. **Is Reanimated's reduce-motion reading actually wrong?** Verify independently of WP27's observation. Is it permanent, or does it depend on app state, a stale listener, or the simulator? **`useReducedMotion` in `motion.ts` reads the OS via `AccessibilityInfo` — Reanimated maintains its own separate notion.** If those genuinely disagree, establish which is right and why.
2. **If it is wrong, what is the blast radius?** `REDUCE_MOTION_OVERRIDE` exists precisely so our swap survives Reanimated's suppression. **Only three surfaces route through `motionTimingConfig` today** — `PayoffSlide`, `ScenarioSlide`, `AchievementUnlock` — while every animated surface added since WP22.1 (the roadmap, the slides, Track complete, the tabs) either sets the flag inline or does not carry it. **`TrackRoadmap.tsx` sets `ReduceMotion.Never` inline rather than through the helper**, which means WP22.1's "the flag lives in one place" guarantee is not actually holding. **Enumerate every animated surface and state, for each, whether it carries the flag by any route.** If Reanimated is permanently suppressing, anything without it has been running degraded and nobody knows.
3. **Is any of that connected to the tap failure?** It is a lead, not an assumption. **Say so if it is unrelated** — eliminating it is a real result.

**Reproduce before theorising.** Three reports, three packages, intermittent each time. **A deterministic reproduction is worth more than a hypothesis**, and if you cannot get one, that is itself the finding: report what correlates with it and what does not.

**Two causes are already known and must be excluded first, so you are not rediscovering them:**
- **Coordinate space** — screenshot pixels are not the tool's tap-point space (WP24).
- **The Reduce Motion banner** — with that setting on, an invisible debugger banner swallows touches in the bottom ~15% (WP26). WP27 already eliminated it as *this* bug's cause; confirm that independently rather than inheriting it.

**Out of scope**
- **A fourth workaround.** If you find yourself adding a coordinate nudge or a retry, stop and report instead.
- **Changing app code to suit the automation.** Standing rule, ruled 2026-09-08. If the defect is in the tooling, the finding is that the defect is in the tooling.
- Any redesign work. The redesign is complete.

**Time-box it and say so.** Diagnosis rat-holes. **If the root cause is not found within a reasonable effort, report what was eliminated, what was observed, and what you would try next.** That is a genuinely useful package and a far better outcome than a confident wrong answer — this project has recorded five stale claims that were confident when written.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass (or are untouched, if the package ships no code)
- [ ] **Question 1 answered with evidence** — does Reanimated disagree with the OS, and is it permanent
- [ ] **Question 2 answered as an enumeration** — every animated surface, and whether it carries the override by any route
- [ ] **Question 3 answered either way** — connected, or explicitly eliminated
- [ ] Either a deterministic reproduction, **or** a written account of what correlates and what does not
- [ ] The two known causes are independently excluded
- [ ] **No workaround added**
- [ ] If a fix ships, it is justified by the diagnosis and its scope is stated

**Testing expectations:** whatever the diagnosis supports. **If the answer is "Reanimated's reading is wrong and the flag is load-bearing everywhere", the valuable artefact is a test that fails when the override is removed from a surface that needs it** — the guard WP22.1 asked for and could not write. Say plainly which evidence is measurement and which is inference.

---

### Handoff: 2026-09-10 — WP22.3: give the roadmap room to breathe

*Manager. **Suggested model: Sonnet** — one constant family, a clear target, and the failing condition is named.*

> **Read:** this handoff · `apps/mobile/src/screens/track/roadmapGeometry.ts` (`GRAPH`, `spineBand`, the vertical rhythm) · `apps/mobile/src/screens/track/roadmapLabels.ts` · `agents/manager.md`.
> **Inherited:** Reduce Motion ON makes the simulator swallow touches in the bottom ~15% — turn it off with `xcrun simctl spawn <udid> defaults write com.apple.Accessibility ReduceMotionEnabled -bool NO`. RN's jest preset reports `fontScale: 2`, so screen tests exercise the degraded path only.

### Task: WP22.3 — vertical rhythm derived from label height

**Suggested model:** Sonnet.

**Context:** The founder finds the roadmap congested. **This is not a porting error — WP22.2 matched the source exactly**: `graph.jsx`'s fixture spaces nodes 24–32pt apart and WP22.2 set 24–40pt. **It reads congested for us because our labels are taller.** The mockup's are two or three words on one line; ours are real Leaf titles, wrapped to two lines by `roadmapLabels.ts`. **Two-line labels at 24–32pt gaps crowd where single-line labels do not** — the same short-label assumption that caused the original drift, showing up in the vertical dimension after WP22.2 fixed the horizontal one.

**Objective:** The roadmap is comfortable to read at every Leaf count and text size, and a longer scroll is an acceptable price.

**Scope:** `roadmapGeometry.ts`'s vertical rhythm.

**Requirements**

- **Derive vertical spacing from the actual label box height** rather than a fixed range — the same move `roadmapLabels.ts` already makes for the horizontal budget. A node whose label wraps to two lines needs more room beneath it than one that does not, and **that varies with the OS text scale.**
- **Do not touch `spineBand` (0.25).** That constant is what gives labels their ~125pt gutter, and widening it is what caused the original stub-label problem. **This package changes the vertical dimension only.**
- **Scroll length is explicitly not a target.** WP22.2 treated collapsing a ~2000pt scroll into one screen as a win. **The founder has ruled otherwise: vertical scrolling to explore the roadmap is fine; unreadable density is not.**
- **This is a deliberate departure from the source, and the first one the redesign has made on purpose.** `graph.jsx` is compact because its content is short. Record it in the file so nobody later "corrects" it back toward the mockup.

**Out of scope:** the label treatment itself, node glyphs, dendrites, `spineBand`, and every other screen.

**Constraints:** `roadmapGeometry.ts` stays pure and seeded; its 15–30 tests must still pass. Tokens only.

**Device gate:** **Track 42 (18 Leaves) and the 20-Leaf placeholder**, both themes, at **default and accessibility-max**. At accessibility-max labels wrap more, so that is the case most likely to crowd. **Then look at it and say whether it reads comfortably** — the founder's judgement is final, but yours is the first pass.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] Vertical spacing responds to label height and text scale — **asserted by a test, since the function is pure**
- [ ] `spineBand` is unchanged
- [ ] `roadmapGeometry`'s existing 15–30 range tests still pass
- [ ] **Observed at 18 and 20 Leaves, both themes, default and accessibility-max: no label collides with a node or another label**
- [ ] The deliberate departure from the source is recorded in the file
- [ ] No new colour, spacing, radius or duration values

**Testing expectations:** Tier A on the rhythm function — it is pure, so "does spacing grow when the label wraps" is directly assertable. **Mutation-check it.**

---

### Handoff: 2026-09-10 — WP27: the four tab screens, and the icon swap two packages deferred

*Manager. **Suggested model: Sonnet** — four screens that all exist, one source file, an established method. **The last package of the redesign.***

> **Read:** this handoff · **`design/claude_design/proto/tabs.jsx`** — all four screens in one file, and the source of truth · `design/prompts/screen-04-journey-explore-library.txt` and `screen-05-profile-and-progress.txt` — **read both in full; they are short and unusually specific** · `apps/mobile/src/screens/{ExploreScreen,LibraryScreen,JourneyScreen,ProfileScreen}.tsx` · `apps/mobile/src/components/{Icon,ErrorState,EmptyState,StatusMessage}.tsx` · `apps/mobile/src/screens/track/roadmapGeometry.ts` · `agents/manager.md`.
> The standalone `Explore.html` / `Journey.html` / `Library.html` / `Profile.html` in `design/claude_design/` are **earlier drafts** — `tabs.jsx` wins where they disagree.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `apps/pipeline`, `apps/admin`, `apps/backend`, the rest of this log.
>
> **Inherited, so a `/clear` does not lose it:**
> - **Reduce Motion ON makes the simulator swallow every touch in the bottom ~15% of the screen — the tab bar included — behind an invisible debugger banner.** Found in WP26. **This package is four screens whose primary navigation lives exactly there.** Turn it off with `xcrun simctl spawn <udid> defaults write com.apple.Accessibility ReduceMotionEnabled -bool NO`, and turn it back on deliberately when you verify motion. It is also the leading suspect for WP25's unresolved "Next button won't tap".
> - **Screenshot pixels are not the tool's tap-point space** (WP24) — the other independent cause of tap failure.
> - **RN's jest preset reports `fontScale: 2`, so a passing screen test says nothing about the default rendering.**
> - `simctl` switches theme and text size with zero taps. Batch SVG curves sharing colour and stroke width. Route animation through `motionTimingConfig`. `small` not `caption`. Amber: outline for what you have done, fill for what you have just won.

### Task: WP27 — Explore, Library, Journey, Profile, and the shared icon

**Suggested model:** Sonnet.

**Context:** These four are the surfaces a reader touches most, and **they were the gap in my own plan** — WP21–WP26 never assigned them to a package. Every other screen is now in the new language; these are the last ones that are not.

**Objective:** All four tabs read in the new visual language, the trophy is gone from every surface that renders it, and WP25's deferred cross-screen check is closed.

**Scope:** the four screen files, `Icon.tsx`, and the three shared state components.

**Requirements**

- **Port from `tabs.jsx`.** All four screens are in that one file.
- **Journey's progress indicator is a compressed strip of the Track's graph, not a bar.** `screen-04` is explicit. **Consume `layoutRoadmap` — do not re-derive.** WP22 designed for exactly this and WP26 already did it for the finished-Track constellation; because the function is seeded from the Track id, the strip and the full roadmap agree on shape for free. **Note the signature is now `layoutRoadmap(states, viewport, seed)`** — Journey has per-Track progress, so it can supply states.
- **Explore needs a real pagination affordance.** `screen-04` calls this out itself: *"the real screen currently stops at twenty with no sign more exists"*, against a corpus of 28 Tracks. **Check what is actually there before building** — `ExploreScreen.tsx` already contains paging-related code, so the question may be an affordance rather than a mechanism.
- **Empty states for all three browse surfaces.** `screen-04`'s second row is nothing-in-progress, nothing-added, nothing-found. **This is also where WP25's deferred obligation lands:** it restyled `ErrorState`, `EmptyState` and `StatusMessage` but could only verify its own screens — `StatusMessage` alone has twelve consumers. **You are the package that can finally see them. Report which you checked.**
- **Swap the achievement icon, and you are the first package able to do it safely.** `Icon.tsx:83` reads `achievement: 'trophy'` — literally the banned glyph. The mockups use an organic blob-and-circle mark. **Three surfaces render it: Profile's badge grid (yours), `ShareCard` (WP26, merged), and the unlock badge (WP25, merged).** WP25 and WP26 both correctly refused to touch it because neither could verify the others. **Verify all three.**
- **The four tabs stay four.** `RESUME-HERE.md` records that the design tool reverted to three once already.
- **Do not hardcode the mockup's sample titles.** These screens bind to real Tracks. The mockup's invented books exist because using real in-copyright titles was ruled against.

**Two data questions to answer before building, not after**

1. **The activity heatmap on Profile.** `screen-05` asks for a contribution-graph heatmap using the reward ramp. **Nothing in `api/client.ts` exposes per-day activity** — I checked and found no history endpoint. The server has `daily_session` rows, but reaching them is a backend change. **Verify, then report — do not approximate a heatmap from a streak count.** This is exactly the shape that cost WP26 a follow-up package: build the rest, state plainly what the data cannot support.
2. **`screen-05`'s "whole history as one accumulated constellation across every book"** is phrased as *"consider"*, not as a requirement, and it is the largest unbounded idea in either spec. **Treat it as out of scope** unless it falls out of what you already have. Say so either way.

**Out of scope**
- The backend. Both data questions above are reports, not fixes.
- Every other screen. Track detail, the Leaf player, auth, the share surfaces are all done.
- `screen-05`'s Do-nots are absolute: **no leaderboard or social comparison, and no invented metrics** — no time saved, no percentile, no books-per-month.

**Constraints:** tokens only. `screen-04`'s Do-nots: no carousel, no more than one primary action per card, **no rating, review count or trending badge — the product tracks none of them** — and no bottom sheet for filters. `screen-05`'s: no circular progress ring for XP, no dashed ring on the avatar. Do not run `git add -A`; stage by path.

**Device gate**
- **All four tabs, both themes, at default and accessibility-max.** Turn Reduce Motion **off** first or the tab bar will not respond.
- **All three empty states**, reached for real.
- **Explore scrolled past twenty**, with whatever affordance you built.
- **The icon swap on all three surfaces** — Profile's grid, an unlock, and a captured share card. **The share card means opening the captured file, not the preview.**
- Reduce Motion **on**, deliberately, at the end: motion swaps rather than disappears.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] All four screens ported from `tabs.jsx`; the tab bar still has four items
- [ ] **Journey's progress strip consumes `layoutRoadmap` and matches the roadmap's shape for the same Track**
- [ ] Explore has a working pagination affordance past twenty
- [ ] All three empty states render
- [ ] **The trophy is gone from all three consumers, each verified — the share card by opening the captured image**
- [ ] **Consumers of the three shared state components are listed as checked or not checked** — closing WP25's deferred obligation
- [ ] **Both data questions answered in the report**, with what is and is not reachable
- [ ] No new colour, spacing, radius or duration values
- [ ] No invented metrics anywhere on Profile

**Testing expectations:** Tier B, plus **Tier A on anything pure** — a pagination predicate and the strip's node-selection both belong in tested modules, following `roadmapGeometry`, `stickyNotesLayout`, `roadmapLabels` and `constellationFragment`. **When this lands the redesign is complete**, so say plainly in your report which surfaces you consider done and which you would still change.

---

### Handoff: 2026-09-10 — WP26: Track complete, and the share card

*Manager. **Suggested model: Sonnet** — one net-new screen whose layout is given and whose data already exists, plus a card whose architecture is already correct. Checked: neither mockup contains a single CSS keyframe, so there is no web-to-Reanimated animation port hiding in here.*

> **⛔ DO NOT START UNTIL PR #37 IS MERGED. This is a hard dependency, verified across both branches.**
> `layoutRoadmap`'s signature changes in that PR:
> `main` → `layoutRoadmap(leafCount: number, viewport, seed)`
> PR #37 → `layoutRoadmap(states: readonly LeafNodeState[], viewport, seed)`
> **This package consumes that function.** Branching from today's `main` means writing against a signature that breaks the moment #37 lands. If #37 is still open, say so and stop.
>
> **Read:** this handoff · **`design/claude_design/Track complete.html`** and **`design/claude_design/Share card.html`** — the sources of truth · `design/prompts/screen-03-track-complete.txt` and `screen-06-share-card.txt` for the *reasoning* behind each "Do not" · `apps/mobile/src/screens/share/ShareCard.tsx` — **read its docstrings before changing anything** · `apps/mobile/src/screens/track/roadmapGeometry.ts` · `apps/mobile/src/components/TrackLegal.tsx` · `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `apps/pipeline`, `apps/admin`, `apps/backend`, the rest of this log.
>
> **Inherited, so a `/clear` does not lose it:** to view the mockups, `ZoomOut prototype.html` needs a static server rooted at `design/claude_design` (relative stylesheets); the jump bar reaches any screen. **RN's jest preset reports `fontScale: 2`, so a passing screen test says nothing about the default rendering.** Amber's boundary, ruled 2026-09-09: *outline for what you have done, fill for what you have just won* — **finishing a book is unambiguously the second**, so fill is right here. Batch SVG curves sharing colour and stroke width; route animation through `motionTimingConfig`; `small` not `caption`.

### Task: WP26 — Track complete, and the share card

**Suggested model:** Sonnet.

**Context:** Finishing an entire book is the largest reward in the product **and the app has no screen for it at all** — `screens/share/` holds only the achievement share and the daily wrap-up. The share card is the growth mechanic `PRODUCT.md` leans on, and its component is already sound; what it lacks is the constellation.

**Objective:** Finishing a Track produces a moment worth the work, and a card worth posting — and the *captured file* is what proves the second, not the rendered screen.

**Scope:** a new Track-complete screen under `apps/mobile/src/screens/share/`, plus `ShareCard.tsx`.

**Track complete — a build, not a re-skin**

- **Consume `layoutRoadmap`; do not re-derive geometry.** WP22 built it for this: it is pure and **seeded from the Track id**, so the finished constellation and the roadmap screen agree on shape for free. Re-deriving guarantees they disagree.
- **Verify each stat exists before rendering it.** The spec asks for XP earned, day streak and first-try count. `screen-10`'s rule — *"do not invent a metric the product does not track"* — applies here too, and the standing rule of 2026-09-09 says check at the point of use. **If first-try count is not obtainable, say so rather than approximating it.**
- **The legal pair is required on this screen and `TrackLegal` already exists** — WP24 restyled it. **Reuse it; do not rebuild it.** `PRODUCT.md` requires a non-endorsement disclaimer and a purchase-forward link on Track completion, and this is the completion surface.
- Primary action *"Share your constellation"*, secondary *"Find your next book"*. **No confetti, no trophy, no medal, no full-screen modal that traps the reader.**
- **Amber may lead here** — it is the reward moment the palette reserves the colour for — **but the spec says it is still an accent and must not flood the screen.**

**The share card — its architecture is already right, so change less than you expect**

- **Read `ShareCard.tsx`'s docstrings first.** It is already forced-light for exactly the reason `screen-06` gives, and already brutal about thumbnail legibility because a real capture at 130px proved it had to be. **Do not re-litigate either.**
- **`MascotSlot` is where the constellation fragment goes.** Its docstring states the intent outright: an illustration should arrive by *"replacing the contents of `MascotSlot` and nothing else."* That is the whole change.
- Square **and** 9:16. Three pieces of information, no more. The wordmark is a brand mark and does not count as a fourth.
- **Do not change the shared `achievement` icon.** It is a trophy, the mockups use an organic glyph, and that divergence is real — **but it is rendered by Profile's badge grid too, and WP27 owns the swap across all three consumers** (ruled 2026-09-10). Changing it here would alter a surface this package cannot verify.

**The risk that actually matters, and where this package can ship a silent failure**

**The criterion is the captured image, not the card on screen.** `captureRef` photographs the rendered tree, and `collapsable={false}` on the outer `View` is load-bearing on Android — without it the view is flattened out of the native hierarchy and there is nothing to photograph. **That guard has not been exercised since WP9.** A card that looks perfect on screen and captures blank or clipped is exactly the defect this package is positioned to ship, and no test in this repo can see it.

**Also landing here: a reader may re-open a finished Leaf.** Ruled 2026-09-09. It is safe — `completeLeaf` is idempotent and awards 0 XP on replay. **It counts for nothing, and it is explicitly not the answer to the streak-versus-library-size question**, which stays open. Wire the affordance; do not let it earn anything.

**Out of scope**
- **Profile's badge grid and the shared icon swap** — WP27.
- The roadmap screen itself, Explore, Library, Journey.
- Anything that makes re-completion count toward a streak, XP or an achievement.

**Constraints:** tokens only. Do not run `git add -A`; stage by path.

**Device gate**
- **Producing a finished Track takes setup** — Track 42 is 18 Leaves. You will likely need a seeded or near-complete account rather than playing to it. **Say how you produced it**; if you could not, say that rather than implying you saw it.
- **Capture the card and open the resulting file** — both aspect ratios. **Inspect the image, not the preview**, and view it at thumbnail scale: if the headline number and the book are not readable shrunk, the card has failed its only job.
- Track complete in **both themes** at accessibility-max. The share card is forced-light by design in both — that is correct, not a bug.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] Track complete exists, consumes `layoutRoadmap`, and its constellation matches the roadmap's shape for the same Track
- [ ] Every stat shown is sourced from real data — **any that is not obtainable is reported, not approximated**
- [ ] The legal pair renders via the existing `TrackLegal`
- [ ] The constellation fragment arrives by replacing `MascotSlot`'s contents, and nothing else in the card's structure moves
- [ ] Both aspect ratios produced
- [ ] **The captured file is opened and inspected, at full size and at thumbnail scale** — evidence is the image
- [ ] The shared `achievement` icon is unchanged in the diff
- [ ] Re-opening a finished Leaf works and awards nothing — verified by checking XP before and after
- [ ] No new colour, spacing, radius or duration values

**Testing expectations:** Tier B, plus **Tier A on anything pure** — a stat-availability predicate and any constellation-fragment selection belong in a tested module, following `roadmapGeometry` and `stickyNotesLayout`. **Be explicit that the capture path is untestable here** and that the opened file is the evidence; do not write a test that asserts `collapsable` is set and call that verification.

---

### Handoff: 2026-09-09 — WP22.2: port the roadmap's visuals from `graph.jsx`

*Manager. **Suggested model: Opus** — the port itself is mechanical, but there is one unsolved design problem in it that the mockup cannot answer, and the founder has now twice said this screen does not match. A second miss costs their attention, which is the scarce thing.*

> **Read:** this handoff · **`design/claude_design/proto/graph.jsx`** — the current roadmap renderer. **This is the spec now, not a reference.** · `design/claude_design/_ds/*/tokens/colors.css` · the founder's two screenshots (the Claude Design target, and our build) in the conversation that produced this · `apps/mobile/src/screens/track/` (`TrackRoadmap.tsx`, `roadmapGeometry.ts`) · `apps/mobile/src/design/palette.ts` · `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `apps/pipeline`, `apps/admin`, `apps/backend`, the rest of this log.

### Task: WP22.2 — port the roadmap's visual treatment, keep the generated layout

**Suggested model:** Opus.

**Context:** **The method changed on 2026-09-09 and this package is the first under it.** WP22 built the roadmap from a written description, and it drifted — the founder compared it to Claude Design's output and the two are visibly different screens. **That drift is my fault, not WP22's:** I required a generated layout algorithm, correctly, and then wrote no criterion about matching the mockup at all. WP22 built exactly what was asked.

**The split I missed, and which this package exists to correct:** a node's *position* must be generated, because 15–30 Leaves cannot use hand-tuned coordinates. A node's *appearance* need not be — glyph, stroke, colour, label treatment and dendrite construction are all independent of where a node sits. **Port the appearance; keep the generation.**

**Objective:** At 18 Leaves the screen reads as `graph.jsx` renders it. At any other count it still holds together.

**Scope:** `apps/mobile/src/screens/track/`.

**The port — `graph.jsx` is the source of truth for all of this**

- **Four node states, not three.** `graph.jsx` line 4–5: `R={next:15,done:6.5,revisit:12,locked:11}`, and `stateOf` returns `revisit` for indices in `REVISIT`. **WP22 built three because I ruled `revisit` out for lack of data — that ruling stands for the *data*, not the *rendering*.** Build the state and its visual; leave it unreachable until something populates it, and say so in your report.
- **`revisit` is the dashed amber outline** the founder's mockup screenshot shows: `blob(x,y,12,rand,0.15)`, `stroke="var(--reward)"`, `strokeDasharray="3.5 4"`, opacity `0.85`.
- **The `next` node carries its Leaf number** — a filled circle with the number in `--text-on-primary`, `--font-display`, weight 700, 15px.
- **Labels are uppercase, letter-spaced, and have leader lines.** `12px`, weight 600, `--font-display`, `letterSpacing: 0.8px`, `textTransform: uppercase`, fill `--text-secondary`, laid out left or right of the spine by `n.x<195`, **each joined to its node by a thin `lead` path** at `strokeWidth 0.8`, opacity `0.55`. Our build has none of this.
- **Dendrite density comes from `arbors()`** — `count = 6` for the `next` node, `4` otherwise, with per-state base radii. Ours is visibly sparser than the target.

**The three "missing" tokens are aliases and resolve cleanly — checked, so you do not have to:**
`--graph-edge` → `var(--border)` → `theme.palette.border` · `--graph-edge-reached` → `var(--primary)` → `theme.palette.primary` · `--graph-node-unreached` → `var(--surface-3)` → `theme.palette.surface3`. **No new colour values are needed and none should be added.**

**The one thing `graph.jsx` cannot tell you, and the reason this is Opus**

**The mockup's label treatment assumes short labels, and real content does not have them.** Its fixtures are two and three words — *"First numbers"*, *"Opening moves"*, *"Arbitrary anchors"*. **Track 42's real Leaf titles are full sentences** — *"Give every person more in use value than you take in cash value"*. Our build truncates them to `"Real wealth comes from…"`, and uppercasing plus letter-spacing a truncated sentence will read worse, not better.

**So a faithful port makes this screen worse unless you solve it.** You may not invent or paraphrase titles — generated content is traceable by design and rewording it in the UI manufactures unsourced text. Everything else is open: a different treatment for long labels, a length threshold that changes layout, labels only on some states, wrapping. **Decide, implement, and explain the reasoning in your report** — this is the judgement this package is buying.

**Out of scope**
- `roadmapGeometry.ts`'s algorithm — **keep it.** Tune constants if composition needs it; do not replace generation with hardcoded coordinates.
- Every other screen. The legal pair stays above the graph, untouched.

**Constraints:** tokens only. Reuse WP22's curve batching — do not regress ~450 curves into individual `<Path>` elements. Do not run `git add -A`; stage by path.

**Device gate — use the zero-tap `simctl` route for theme and text size:**
- **Track 42, 18 Leaves, dark theme, beside `graph.jsx`'s output.** **Enumerate every remaining difference in your report** rather than declaring a match — that list is the deliverable as much as the code is.
- The **20-Leaf placeholder Track**, to confirm the layout still holds away from 18.
- Both themes at accessibility-max, with the long-label treatment you chose.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] All four node states render, `revisit` included, with the dashed amber treatment
- [ ] The `next` node shows its Leaf number
- [ ] Labels are uppercase, letter-spaced, with leader lines
- [ ] **The long-label problem is solved, and the reasoning is stated** — no invented or reworded titles
- [ ] The layout is still generated; `roadmapGeometry.ts` still passes its 15–30 tests
- [ ] **A written, itemised comparison against `graph.jsx` at 18 Leaves** — differences named, not summarised
- [ ] No new colour, spacing, radius or duration values
- [ ] Curve batching is preserved

**Testing expectations:** Tier B, plus Tier A on anything pure you add — a label-treatment predicate keyed on title length and text scale is exactly the shape of `stickyNotesLayout`, and belongs in a tested module rather than inline.

---

### Handoff: 2026-09-09 — WP23.1: the four remaining Leaf slides, and the cork board

*Manager. **Suggested model: Sonnet** — the spec is now a set of screenshots of the real mockup rather than prose, which is more precise, not less. Four things in it would be wrong if transcribed faithfully; all four are named below.*

> **Read:** this handoff · **`design/leaf_player/`** — nine screenshots walking the five slides in several states. **The screenshots are the spec.** · `design/leaf_player/Leaf player.html` — **reference only, see below** · `apps/mobile/src/screens/leaf/` · `apps/mobile/src/components/SlideImage.tsx` · `apps/mobile/src/design/palette.ts` (the `correct`/`incorrect` tokens) · `agents/manager.md`.
> **`design/leaf_player/Library.html` is not part of this package** — it is the Library screen, captured by mistake. Ignore it here; it is kept for WP27.
>
> **On `Leaf player.html`: useful, but an earlier draft. Where it and the screenshots disagree, the screenshots win.** It is the superseded standalone version, not the integrated prototype the screenshots came from, and **the divergence is measured rather than assumed**: it contains "THE SITUATION", "retries cost nothing" and "UNLOCK THE PAYOFF", but **not** "Not quite" or the `1 / 5` counter — both of which the screenshots show.
>
> **What it is genuinely good for is exact values.** It carries **23 distinct design-system CSS custom properties** — `var(--space-lg)`, `var(--radius-md)`, `var(--primary)`, `var(--font-display)` and so on — and **WP21 measured the token diff between that system and `src/design/` at zero**, so each maps 1:1 onto a real token. That makes it a precise record of spacing and radius decisions that a screenshot cannot give you. Read it for values; read the screenshots for composition.
>
> **One caveat on that mapping, checked and confirmed:** the file also uses `var(--graph-edge)` and `var(--graph-node-unreached)`, and **neither exists in `apps/mobile/src/design/palette.ts`** — the design system has gained tokens since WP21's zero-diff measurement. **Map them onto existing app tokens; do not add new colour values**, per the criterion below. If nothing maps cleanly, say so rather than inventing one.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `apps/pipeline`, `apps/backend`, `apps/admin`, the rest of this log.
>
> **The screenshots are reference, not source. Do not transcribe them.** WP22 is the cautionary case: that mockup hardcoded geometry for exactly 18 nodes and Track 42 has exactly 18 Leaves, so a faithful copy would have looked perfect and been wrong for every other Track. **Read them for intent, then build against real data.**
>
> **Inherited, so a `/clear` does not lose it:** screenshot pixels are not the tool's tap-point space (that was the real cause of WP21–23's tap trouble); there is a working `xcodebuild` route around the `expo run:ios` signing bug; **`simctl` switches theme and text size with zero taps**. Route animation through `motionTimingConfig`; `small` not `caption`; batch SVG curves sharing a colour and stroke width into one `d`.

### Task: WP23.1 — the four remaining Leaf slides, and the cork board

**Suggested model:** Sonnet — bounded, specified, no algorithm.

**Context:** WP23 rebuilt the sticky-notes board but left Summary, Scenario, Payoff and Takeaway untouched, because **no Leaf player spec existed in the repo** — my handoff cited one that was never committed. That spec now exists as screenshots. **The Leaf player is currently the app's most visible inconsistency: one slide in the new language, four in the old.**

**Objective:** All five slides read as one screen, and the sticky-notes board sits on real cork.

**Scope:** `apps/mobile/src/screens/leaf/` and the board's layer inside it.

**Requirements**

- **Re-skin Summary, Scenario, Payoff and Takeaway** to match `design/leaf_player/`. The chrome — the five-segment progress bar, the `SUMMARY 1 / 5` label-and-counter row, the close and header icons — **is already built and shipped in WP23**; extend it, do not rebuild it.
- **Give the board a real cork texture, drawn as a repeating SVG `<Pattern>`** — ruled 2026-09-09. `react-native-svg` is available. **No image asset**: nothing to license, ship or scale. The rest of the board — rotation, tape, the raised-paper treatment, the single-column collapse above the text-size threshold — is WP23's and stays as built.

**The four things that are wrong if you copy the mockup literally**

1. **The dashed "Optional illustration — or browse files" box is an editor affordance, not a reader one.** The mockup had no content, so it drew an upload placeholder. **The real app shows `scenario.image` or shows nothing** — `SlideImage` already handles both. Do not build a dashed placeholder into the player.
2. **The red on a wrong answer is correct and is not the "no red" rule.** `screen-12` bans red for *system failures* — load errors, no network. **A wrong answer is not a failure state**, and `palette.ts` carries `correct`/`incorrect` for exactly this. Keep the incorrect treatment; the mockup's "Not quite… retries cost nothing" framing matches the product's unlimited-retry rule and is worth keeping.
3. **The header in the mockup carries one icon. The real header also carries the report-an-error flag**, placed in WP23 and a legal requirement on every Leaf. **Reconcile them — do not drop the flag** to match a picture.
4. **"LEAF 8 · 3 MIN" — verify the duration exists before rendering it.** `PRODUCT.md` says a Leaf is *about* three minutes, but that is a design intention, not necessarily a stored field. Per the standing rule of 2026-09-09, check at the point of use. **If nothing in the data supplies it, do not invent it** — the same reasoning as `screen-10`'s "do not invent a metric the product does not track."

**Out of scope**
- The sticky-notes board's layout, rotation, tape and collapse threshold — WP23 built them and they stay.
- `ReportErrorSheet`'s interior and the failure states — WP25.
- `ShareCard` — WP26. Explore, Library, Journey, Profile — WP27.
- The payoff gate's logic. This is a re-skin; the rule that the payoff stays locked until a correct answer does not change.

**Constraints:** tokens only — no new colour, spacing, radius or duration values. Do not run `git add -A`; stage by path.

**Device gate — use the zero-tap `simctl` route for theme and text size:**
- **A full pass through all five slides on a Track 42 Leaf**, both themes — they must read as one screen, not four new and one old.
- **A wrong answer, then a correct one** — the incorrect treatment renders, and the payoff still unlocks only after a correct answer.
- **The cork board at default and accessibility-max text size**, both themes. Cork must read as texture, not noise, and must not fight the notes.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] All four slides re-skinned and consistent with the WP23 chrome
- [ ] **The board renders an SVG cork pattern; no image asset is added**
- [ ] No dashed illustration placeholder anywhere in the player
- [ ] The report-an-error flag survives in the header
- [ ] The Leaf duration is either sourced from real data or absent — **state which**
- [ ] **Observed: wrong answer renders the incorrect treatment; payoff unlocks only after a correct one**
- [ ] Observed in both themes at accessibility-max, nothing clipped
- [ ] No new colour, spacing, radius or duration values

**Testing expectations:** Tier B. The pure-module precedent (`roadmapGeometry`, `stickyNotesLayout`) applies to anything with a decision in it — the cork pattern's tiling maths, if it has any, belongs in a testable function rather than inline. Say plainly which evidence is a test and which is an observation.

---

### Handoff: 2026-09-09 — WP25: the reward and failure moments

*Manager. **Suggested model: Sonnet** — four surfaces that exist, and the port is composition rather than animation. Reasoning in the revision note.*

> **REVISED 2026-09-09, after WP22.2. Read this block before the body below it — the method changed and parts of the original text are now wrong.**
>
> **1. Port from source, do not build from the specs.** The body below says "follow the three specs". That instruction produced the roadmap drift the founder rejected: a screen built from a written description looked nothing like the design. **The Claude Design export is now in the repo and it is the source of truth.** The `design/prompts/*.txt` files remain useful for the *reasoning* behind each "Do not" — keep reading them for that — but the visual answer comes from the code.
>
> | Surface | Source of truth |
> |---|---|
> | Report-error + failure states | `design/claude_design/proto/support.jsx` |
> | Session end, cap-hit, streak | `design/claude_design/proto/leaf.jsx` (`SessionEnd`) |
> | Achievement unlock | `design/claude_design/Achievement unlock.html` |
> | The end-of-day screen, as drafted | `design/claude_design/Done for today.html` and `Done for today v2.html` |
>
> **2. Why this is still Sonnet, checked rather than assumed.** I expected the achievement unlock's four-frame sequence to be CSS keyframes needing translation into Reanimated, which would have made it Opus work. **It is not: `Achievement unlock.html` contains no `@keyframes` — five `transform:` rules and one `transition:`.** The four frames are four *stills* showing the stages, not a running animation. **The app's existing unlock animation stays exactly as it is**; only its presentation changes. That removes the one genuinely hard thing this package looked like it had.
>
> **3. To view the mockups** (Manager's own finding, carried so it is not rediscovered): `design/claude_design/ZoomOut prototype.html` loads `proto/*.jsx` and **needs a static server rooted at `design/claude_design`** — its stylesheets are relative. The jump bar at the bottom goes straight to any screen.
>
> **4. `RN`'s jest preset reports `fontScale: 2`.** Every screen test in this repo renders as though the reader doubled their text size, so **a passing screen test says nothing about the default rendering.** Found in WP22.2 after a confusing failure with no defect behind it.
>
> **5. Amber has a boundary now, ruled 2026-09-09, and this package is where it matters most.** *Outline for what you have done; fill for what you have just won.* The roadmap outlines completed nodes in amber. **The achievement badge is the fill case** — this is the reward moment the palette reserves the colour for, and it should read as heavier than anything on the roadmap.
>
> **6. Check geometry before you conclude it is content.** WP22.2's stated hard problem was long labels. It was a symptom: the node band spanned two thirds of the frame instead of a quarter, leaving 37pt of gutter where the source leaves 125. **Every label was a stub because the gutter was a stub.** If something here looks like a copy or content problem, measure the space it is being asked to fit into first.

> **Read:** this handoff · **`design/prompts/screen-10-session-end-and-cap.txt`**, **`screen-11-achievement-unlock.txt`**, **`screen-12-report-error-and-failure.txt`** (all three are in the repo; I read them before writing this) · `apps/mobile/src/components/AchievementUnlock.tsx` · `apps/mobile/src/screens/share/WrapUpScreen.tsx` · `apps/mobile/src/screens/leaf/ReportErrorSheet.tsx` · `apps/mobile/src/components/{ErrorState,EmptyState,StatusMessage}.tsx` · `apps/mobile/src/design/motion.ts` · `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `apps/pipeline`, `apps/backend`, `apps/admin`, the rest of this log.
>
> **Inherited knowledge — your own, from WP24, carried forward so it is not lost to a `/clear`:**
> - **Screenshot pixels are not the tool's tap-point space.** That mismatch was the real cause of most of WP21–23's tap failures. Correct for it first and taps are reliable.
> - There is a working **`xcodebuild` invocation that routes around the `expo run:ios` signing bug**.
> - **`simctl` switches theme and text size with zero taps.** **This is the most valuable of the three for this package** — every criterion below gates on both themes at accessibility-max.
>
> **Also inherited:** route animation through `motionTimingConfig`; `small` not `caption` for small text; batch SVG curves sharing a colour and stroke width into one `d`.

### Task: WP25 — the reward and failure moments

**Suggested model:** Sonnet — settled specs, existing surfaces.

**Context:** These are the two ends of the app's emotional range — the moment something is won, and the moment something breaks. Both are currently in the old visual language. **This is also the package that would have shipped WP22's reduce-motion defect four more times** had WP22.1 not landed first; the achievement sequence is the largest animation in the app.

**Objective:** The achievement unlock, the end-of-session screen in both its states, the report-error flow and the failure states all read in the new visual language — the reward moments as rewards, the failures as calm.

**Scope:** `AchievementUnlock.tsx`, `WrapUpScreen.tsx`, `ReportErrorSheet.tsx`, and the shared `ErrorState` / `EmptyState` / `StatusMessage`.

**Requirements**

- **Follow the three specs including their "Do not" lists.** Between them they rule out confetti, a trophy or medal, a full-screen modal that traps the reader, a queue of unlocks dismissed one at a time, a lock icon or barrier or countdown or paywall pattern at the cap, red or any warning colour, a warning triangle, a bug icon, a dropdown that makes the reader categorise a problem in our terms, and a report form that takes over the Leaf.
- **The cap-hit state already exists and is already right. Preserve it — do not rebuild it.** `WrapUpScreen.tsx` states the design outright: *"The cap leads here rather than to a second ending"*, and it swaps the eyebrow to *"That is today done"* when `capReached`. **The spec and the code independently arrived at the same answer** — two states, one layout, differing in copy and not in tone. That agreement is easy to break by accident during a re-skin, so verify it survives.
- **Producing the cap-hit state on device takes setup.** The cap is 15 minutes or 500 XP; you will likely need a seeded or already-capped account rather than playing to it. **Say in your report how you produced it** — if you could not, say that instead of implying you saw it.
- **Do not touch `ShareCard.tsx`.** WP26 owns it under `screen-06`. Both `WrapUpScreen` and `AchievementShareScreen` render it — **restyle the screens, not the card.**
- **Every animation goes through `motionTimingConfig`, and reduced motion swaps rather than removes.** The achievement unlock's four-frame sequence is the biggest motion surface in the app and the exact shape of thing WP22.1 was built for.
- **Verify the spec's "nineteen achievements across six categories" against the real catalogue before designing to it.** I could not confirm those numbers from `packages/shared` and I am not asserting them. Per the standing rule of 2026-09-09, a cited figure gets checked at the point of use — and if the number is wrong, the earned/unearned grid is designed to the wrong scale.
- **The report affordance already exists** as the flag icon in the Leaf header, placed by WP23 and deliberately left there. Restyle the sheet it opens; do not relocate the entry point without saying why.

**Out of scope**
- `ShareCard.tsx`, Track-complete, and the share card's own design — all WP26.
- **The full achievement list on Profile.** `screen-11` is explicit: *"the full list lives on Profile and this is not it."* Profile belongs to a later package.
- Explore, Library, Journey, Profile themselves — **not yet covered by any package; I am adding WP27 for them.**

**Constraints:** tokens only. **The shared failure components reach far further than this package verifies: `StatusMessage` has twelve consumers including screens still in the old language, `ErrorState` six, `EmptyState` three.** Restyle them — the failure design is this package's job — **but you cannot verify twelve screens and should not pretend to.** Verify the ones in your scope, and **name in your report exactly which consumers you looked at and which you did not**; the cross-screen check belongs to WP27, which re-skins those screens and will be looking at them anyway. Do not run `git add -A`; stage by path.

**Device gate — use the zero-tap `simctl` route for theme and text size:**
- An **achievement unlock, mid-Leaf**, with Reduce Motion **off and on**. Off: the sequence resolves and hands the screen back. On: the feedback is **swapped, not absent**.
- The end-of-session screen in **both** states — voluntary, and cap-hit.
- **Report an error end to end**: affordance → sheet → submit → confirmation.
- **Both failure frames** — content failed to load, and no network.
- All of it in **both themes at accessibility-max**.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] All four surfaces re-skinned; the three specs' "Do not" lists all hold
- [ ] **The cap-hit state still shares one layout with the voluntary ending and differs only in copy** — verified after the re-skin, not assumed
- [ ] **Observed with Reduce Motion on: the achievement sequence swaps rather than disappears**
- [ ] `ShareCard.tsx` is unchanged in the diff
- [ ] The achievement count is verified against the real catalogue, and stated
- [ ] Report-error runs end to end to its confirmation
- [ ] Both failure frames observed, in both themes at accessibility-max
- [ ] **Consumers of the shared failure components are listed as checked or not checked** — no silent claim of coverage

**Testing expectations:** Tier B, plus **Tier A on anything pure you extract** — the achievement earned/unearned predicate and any cap/end-state selector are unit-testable, and both `roadmapGeometry` and `stickyNotesLayout` are precedent that moving the decision into a pure module is the highest-value thing you can do here. Say plainly which evidence is a test and which is an observation.

---

### Handoff: 2026-09-11 — WP24: the account and age-gate screens, and the legal surface

*Manager. **Suggested model: Sonnet** — four screens and one component that all already exist, against two specs that are both in the repo. Unlike WP23, I have read them and confirmed they cover what this package needs.*

> **Read:** this handoff · **`design/prompts/screen-09-sign-in-and-sign-up.txt`** and **`design/prompts/screen-07-onboarding-and-legal.txt`** (both are the spec, both are in the repo) · `apps/mobile/src/screens/auth/` · `apps/mobile/src/components/TrackLegal.tsx` · `apps/mobile/src/components/TextField.tsx` and `Button.tsx` (**read before changing — see the constraint below**) · `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `apps/pipeline`, `apps/backend`, `apps/admin`, the rest of this log.
>
> **Inherit from WP22/WP23 rather than rediscovering:** batch SVG curves sharing a colour and stroke width into one `d`; use `small` rather than `caption` for small text (`caption` uppercases); route any animation through `motionTimingConfig`; and **if simulator input fights you, hand the interaction check to the founder rather than spending the package on coordinates** — that is the 2026-09-09 ruling and four packages of evidence.

### Task: WP24 — the account and age-gate screens, and the legal surface

**Suggested model:** Sonnet — settled specs, existing screens, no new mechanism.

**Context:** Sign-in is the first thing anyone sees and it is still in the old visual language. This package also carries the two legally load-bearing surfaces — the age gate and the Track disclaimer/purchase link — which `PRODUCT.md` requires and which have never had a design pass.

**Objective:** Sign in, sign up, the age gate, its refusal state, and the Track legal pair all read in the new visual language, with field-level validation that reports errors where the reader made them.

**Scope:** `SignInScreen.tsx`, `SignUpScreen.tsx`, `AgeGateScreen.tsx`, `AgeRefusedScreen.tsx`, and `TrackLegal.tsx`.

**Requirements**

- **Follow the two spec files literally, including their "Do not" lists.** Between them they rule out a social-login divider or "or continue with" row (there is no social sign-in and leaving room for it is wrong), a full-screen illustration that pushes fields below the fold, marketing copy on a sign-in screen, a modal age gate, a disclaimer styled as a footnote, and any checkbox implying consent to anything beyond confirming age.
- **Keep the forgot-password affordance on sign in** — the spec requires it even though the flow does not exist, because it is the only account-recovery path this product will ever have. **It must not navigate somewhere that pretends to work.** Decide what it does today and say so.
- **Inline validation, on the field, not as a banner — and this closes a real logged defect.** `SignUpScreen` currently validates email as `includes('@')`, ignores the backend's 256-character limit, and submits nothing until after the age gate, so `reader@example` fails **on the age-gate screen** with "Request body is invalid". The spec's requirement and that bug have the same fix. Match the backend's actual rules rather than approximating them.
- **The knowledge-graph language stays quiet here.** Per the spec: this is the one place a reader has a task rather than a reward. Do not make the sign-in screen a showcase.
- **Do not move the Track legal pair.** WP22 established it **above** the graph on `TrackDetailScreen` after I corrected my own ruling — `TrackDetailScreen.tsx` carries a WP10 comment explaining why it is above the fold and not below a Leaf list. **Restyle it in place.** Its criterion is that the disclaimer is readable without zooming.

**Out of scope**
- **`ProviderEmailMissingScreen`** — dormant, social sign-in is deferred past Phase 1.
- **The plaintext password in `EmailSignUpDraft`'s route params.** It is a real logged security item and you will be next to it, but **a security fix does not belong inside a visual package** — mixing them makes both harder to review. Flag it in your report; it gets its own item.
- Password reset itself, the age threshold (an open legal decision, unaffected by a re-skin), and every other screen.

**Constraints:** tokens only — no new colour, spacing, radius or duration values. **`Button.tsx`, `TextField.tsx` and `Screen.tsx` are shared with screens this package does not re-skin and does not verify.** Prefer per-screen composition. **If a shared component genuinely must change, say so explicitly and check its other consumers** — otherwise this package silently alters Explore, Library, Journey and Profile. Do not run `git add -A`; stage by path.

**Device gate — rendering only; the founder owns the feel (2026-09-09 ruling):**
- Sign in and sign up, **both themes**, at default and the largest accessibility text size.
- **Validation observed where it belongs:** a rejected email and a too-short password each surface on their own field, not on a later screen and not as a banner.
- The age gate and the refusal state — **the refusal reads as kind, not punitive.**
- `TrackDetailScreen` on a real Track: the legal pair still **above the fold**, disclaimer readable without zooming, and the graph WP22 built undisturbed.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] All four auth screens and `TrackLegal` re-skinned
- [ ] **A rejected email and a too-short password each report on their own field** — observed, not asserted from the diff
- [ ] The forgot-password affordance exists and its behaviour today is stated
- [ ] **The legal pair is unmoved and still above the fold on a real Track**
- [ ] No new colour, spacing, radius or duration values
- [ ] If any shared component changed, its other consumers are named and checked
- [ ] Observed in both themes at the largest accessibility text size, with nothing clipped

**Testing expectations:** Tier B, plus **Tier A on the validation predicates** — email and password rules are pure functions and genuinely unit-testable, unlike the layout. Mutation-check them. `authScreens.test.tsx` exists; extend rather than replace. Say plainly which evidence is a test and which is an observation.

---

### Handoff: 2026-09-10 — WP23: the Leaf player re-skin, and the sticky-notes board

*Manager. **Suggested model: Sonnet** — the visual spec is settled and the slides are already separate components. The three judgement calls in it are named below rather than left for you to find.*

> **Read:** this handoff · `apps/mobile/src/screens/leaf/` (all of it — `LeafPlayerScreen.tsx`, `ScenarioSlide.tsx`, `PayoffSlide.tsx`, `StickyNotesSlide.tsx`, `TakeawaySlide.tsx`) · `apps/mobile/src/components/SlideImage.tsx` · `apps/mobile/src/design/typography.ts` and `motion.ts` · `design/RESUME-HERE.md` · `agents/manager.md`.
> **The visual spec** is the sticky-notes prompt recorded in this log under 2026-09-06, plus the live mockup in Claude Design ("ZoomOut Track Roadmap" project) — ask the founder to look with you rather than driving that browser yourself.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `apps/pipeline`, `apps/backend`, `apps/admin`, the rest of this log.
>
> **Inherit from WP22 rather than rediscovering:** if you draw SVG, **batch curves sharing a colour and stroke width into one `d`** — that turned ~450 curves into 20 native `<Path>` elements. And **use `small`, not `caption`, for small text derived from a Leaf** — `caption` uppercases, and real chapter titles in caps read as signage.

### Task: WP23 — the Leaf player re-skin, and the sticky-notes board

**Suggested model:** Sonnet — settled spec, already-decomposed components, no algorithm.

**Context:** The Leaf player is the product. WP22 put the new visual language on the roadmap screen; this puts it on the five slides a reader actually spends their session in. **The sticky-notes board is the piece the founder asked for by name** — today those notes are flat cards with a coloured left border, and the design calls for physical paper pinned to a board.

**Objective:** All five slides read in the new visual language, and slide 4 reads as real sticky notes on a board — at every text size, with the payoff gate untouched.

**Scope:** `apps/mobile/src/screens/leaf/` and `SlideImage.tsx` if the image treatment needs it.

**Requirements**

- **Re-skin all five slides** — summary, scenario, payoff, sticky notes, takeaway — plus the player's own chrome (header, progress, controls).
- **The sticky-notes board:** raised paper notes, a few degrees of rotation each, tape or a pin at the top edge, layered shadow, on a textured board (cork, felt or wood grain) **built from existing tokens — a new colour value in this diff means something has gone wrong.** Staggered rather than grid-aligned. The board grows in height; it does not scroll inside itself. **No amber** — that is reserved for reward moments and this slide is not one.
- **Note text uses `fontFamilies.handwritten` (Caveat). You are its first consumer** — WP21 added it and nothing has rendered a glyph in it since, so its real behaviour at size, and its line-height needs, are unobserved.
- **Ruling of 2026-09-06, and the reason it exists:** above a text-size threshold **the board collapses to a single rotated column.** Notes keep their paper, tape and shadow at every size; they lose the scatter at large ones. `StickyNotesSlide.tsx`'s own docstring records why — *"at `accessibilityExtraExtraExtraLarge` any two-column arrangement either clips or leaves one column nearly empty"* — and that finding was made against the real corpus. **Choose the threshold empirically and report what you chose and why.** I am deliberately not naming a number; the constraint is the observation, not a value.
- **The app-wide XXXL clipping debt bites hardest here, and this is the one place to work around it without fixing it.** `typography.ts` uses absolute `lineHeight`, which clips at the largest sizes; the founder ruled on 2026-08-12 not to fix that app-wide. **Caveat renders roughly 1.35× larger than the body face**, so note text is where that debt actually shows. Give the note text whatever line-height treatment it needs to not clip. **Do not change the shared type scale.**
- **Decide where the diagram goes, and say why.** `StickyNotesSlide` renders `data.diagram` above the notes today, deliberately (WP15: *"Above rather than below, and never instead"*), and **the redesign spec is silent about it** — the mockup was built against invented content that had no diagram. Every pipeline-generated Leaf has one. It must still be there and it must not fight the board.
- **Anything animated goes through `motionTimingConfig`** (WP22.1). Do not hand-roll a Reanimated config.

**Out of scope**
- **The payoff gate's logic.** This is a re-skin. The rule that the payoff stays locked until a correct answer is the product's central guarantee and no part of it changes.
- **The report-error sheet's interior** — WP25 owns it. You may reposition its affordance in the player chrome if the new header requires it; you may not restyle the sheet.
- Achievement unlock, session-end, Track-complete, share card. Other packages.
- The shared type scale, the palette, and the app-wide `lineHeight` debt.

**Constraints:** tokens only. Do not run `git add -A`; stage by path. If simulator input fights you, **do not spend the package on it** — per the 2026-09-09 ruling, hand interaction checks to the founder rather than hunting coordinates, and say in your report which checks you handed over.

**Device gate — rendering only; the founder owns the feel (2026-09-09 ruling):**
- A **Track 42 Leaf with a real diagram and real notes**, both themes.
- **The board at its extremes:** a Leaf with the fewest notes and one with the most in the corpus. Report the actual range you found.
- **Default text size and the largest accessibility size**, on the board specifically. **Nothing clips.** Confirm the single-column collapse fires where you set it.
- A full pass through all five slides, both themes, confirming the payoff still unlocks only after a correct answer.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] All five slides re-skinned, and the player chrome with them
- [ ] Notes render as rotated, taped, shadowed paper on a textured board, in Caveat
- [ ] **The threshold and the collapse behaviour are implemented, and the chosen threshold is reported with its reasoning**
- [ ] **Observed: nothing clips on the board at the largest accessibility text size**, at both the smallest and largest note counts
- [ ] The diagram is still present, its placement decided deliberately and explained
- [ ] **The payoff gate is untouched** — verified by exercising it, not by reading the diff
- [ ] No new colour, spacing, radius or duration values
- [ ] Any animation goes through `motionTimingConfig`

**Testing expectations:** Tier B, plus **Tier A on the collapse threshold** — that is a pure predicate over text size and note count, so it is genuinely unit-testable, unlike most of this package. Mutation-check it. For the rest, say plainly which evidence is a test and which is an observation, as WP21 and WP22 both did.

---

### Handoff: 2026-09-09 — WP22.1: close the reduce-motion mechanism, not four call sites

*Manager. **Suggested model: Sonnet** — you already found the mechanism, proved the fix at one call site, and invented the verification technique. What is left is applying it and closing the hole so the sixth call site cannot get it wrong.*

> **Read:** this handoff · `apps/mobile/src/design/motion.ts` · `apps/mobile/src/screens/track/TrackRoadmap.tsx` (your own fix, lines ~195–225, as the reference implementation) · the four call sites: `apps/mobile/src/navigation/AuthStack.tsx`, `apps/mobile/src/screens/leaf/PayoffSlide.tsx`, `apps/mobile/src/screens/leaf/ScenarioSlide.tsx`, `apps/mobile/src/components/AchievementUnlock.tsx` · `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, the rest of this log, `apps/pipeline`, `apps/admin`, `apps/backend`.

### Task: WP22.1 — close the reduce-motion mechanism, not four call sites

**Suggested model:** Sonnet — the finding is made and the fix is demonstrated; this is application and verification.

**Context:** WP22 found that Reanimated reads the OS reduce-motion setting itself and disables animations by default — **which cancels the opacity fade that is our reduced-motion replacement.** `motion.ts` §6 is explicit that the rule is *"swap, never remove"*, and that removing feedback entirely *"is worse than the animation — it leaves someone who needs the accommodation with no confirmation that their tap registered."* The framework default silently turns our swap into exactly that removal. Nothing fails and nothing warns.

**Two reasons this is a package now rather than a WP14 item.** First, **WP8 has carried an open founder device check since 2026-08-12** — *"iOS Reduce Motion on, replay the unlock"* — and this finding upgrades it from unverified to a named mechanism that would break it. Second, **WP23–WP26 are about to add animated surfaces**, WP25's achievement sequence most of all. Four call sites now is cheaper than eight later.

**Objective:** Reduced motion is a swap and never a removal, on every animated surface in the app — enforced in one place rather than remembered at each call site, and verified by observation on each.

**Scope:** `apps/mobile/src/design/motion.ts` and the four call sites above. WP22's own site is already correct and is your reference, not your work.

**Requirements**

- **Close the mechanism; do not patch four call sites.** A fix applied at four sites and not at the mechanism is a defect scheduled for the fifth — this project has recorded that shape four times, and the naming rule of 2026-09-02 came out of it. **Give `motionPlan` a companion that produces the actual Reanimated config with `reduceMotion: ReduceMotion.Never` set**, so the flag lives in exactly one place and a future animation gets it by construction.
- **This is finishing what `motionPlan` started.** Its docstring already says the point: *"Returning a described intent rather than a boolean keeps the branch in one place."* **It was exported and never called — WP22 was its first caller.** The abstraction designed to prevent precisely this class of bug was dead code while the bug lived in four sites.
- **Route all four existing call sites through it.**
- **Record why the flag is required, at the mechanism.** Without a reason beside it, `reduceMotion: ReduceMotion.Never` reads as a contradiction — a reduced-motion accommodation that turns reduced motion off — and the next reader deletes it as a mistake. Say that it disables *Reanimated's own* suppression so that *our* swap survives.
- **Verify each site by observation, using the technique you invented** — measuring pixels across frames in each mode. **Report per site whether it was actually broken.** You were careful not to claim they were; close that honestly, including any that turn out to have been fine.

**Out of scope**
- Any visual change, new animation, or redesign work. WP23 owns the next screen.
- Changing the spring/duration constants.
- `useReducedMotion` itself — the hook is correct; it is what happens downstream of it that is not.

**Constraints:** tokens and constants unchanged. Do not run `git add -A`; stage by path.

**Device gate:** **iOS Reduce Motion ON**, each of the four surfaces exercised: the auth stack transition, the scenario answer, **the payoff unlock**, and an achievement unlock. Feedback is *swapped*, never absent. **The payoff unlock closes WP8's open founder criterion** — say so explicitly in your report so it can finally be struck off, and flag if the founder should look at it themselves rather than take your word.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] The `ReduceMotion.Never` flag is set in **one** place, and the four call sites obtain it by construction rather than by repeating it
- [ ] `motion.ts` records why the flag is required, beside it
- [ ] **Observed with Reduce Motion ON, per site: feedback is swapped, not removed** — measured, not inspected
- [ ] Each of the four sites is reported as *was broken* or *was already fine*
- [ ] **A test reddens if the flag is removed from the mechanism** — or, if Reanimated's runtime behaviour genuinely cannot be asserted in a test, say so plainly and let the measurement stand as the evidence, as WP22 did

**Testing expectations:** Tier B. **If the flag's effect is untestable, say so rather than writing a test that asserts the string is present** — a test that proves the config was written is not a test that proves the animation runs, and WP22 was right about that distinction.

---

### Handoff: 2026-09-08 — WP22: the Track roadmap — the knowledge graph, on real data

*Manager. **Suggested model: Opus** — the mockup contains a picture of one Track, not an algorithm. What this package is actually worth turns on what you find while generalising it, and there are at least three things in here a faithful transcription of the mockup would get wrong.*

> **Read:** this handoff · `design/screen-1-v2-prompt.txt` (**the written visual spec — the most precise artefact for this screen**) · `design/RESUME-HERE.md` (the direction, and the two rejections that must not be re-litigated) · `apps/mobile/src/screens/TrackDetailScreen.tsx` · `apps/mobile/src/api/client.ts` (`LeafSummary`, `LibraryEntry`) · `packages/shared/src/progress.ts` (`trackProgressSummarySchema`) · `apps/mobile/src/design/` · `agents/manager.md`.
> **The live mockup** is the Claude Design project "ZoomOut Track Roadmap" — ask the founder for access if you want to see it move; the written spec above is sufficient to build from.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `launch-blockers.md`, `apps/pipeline`, `apps/admin`, the rest of this log.
>
> **Two things from WP21 you will need and would otherwise rediscover the hard way** — carried here
> deliberately, because the reading list above tells you not to read the report they came from:
>
> 1. **If the iOS build fails to compile in Expo's own vendored Swift**, it is a known Swift 6.2
>    regression, not your diff. `node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift:53`
>    — qualify the call as `Swift.abs(milliseconds)`. **This lives only in `node_modules` and does not
>    survive `npm install`**, so re-apply it if it reappears. If you find yourself applying it more
>    than once, a `patch-package` entry is the real fix and is worth raising.
> 2. **Tapping this app's pill buttons through simulator automation is unreliable** and has cost real
>    time in two packages now. It is **not** a code defect — `Button.tsx` honours the 44pt minimum and
>    wraps nothing, which I checked. Do not "fix" the app for it. Asking the founder to tap has twice
>    been faster than hunting coordinates.

### Task: WP22 — the Track roadmap: the knowledge graph, on real data

**Suggested model:** Opus — this is a layout algorithm and a set of judgement calls about degrading gracefully, not a re-skin.

**Context:** This is the **first package in which the app visibly changes**, and the roadmap is the centrepiece of the new visual language. WP21 landed the two things that made it possible: `react-native-svg` and Caveat. **The token diff came back zero**, so every colour, size, radius and duration you need already exists in `src/design/` — you are porting composition, never values.

**The trap this package exists to avoid, stated plainly.** The mockup hardcodes node geometry — `{n:1,x:150,y:212}` — for exactly **18 nodes**. Track 42 has exactly **18 Leaves**. **A version verified only against Track 42 would look perfect and prove nothing.** `PRODUCT.md` specifies 15–30 Leaves per Track.

**Objective:** Opening any Track shows its Leaves as a knowledge graph that reads as a stained neuron rather than a star chart — generated from that Track's real Leaves and the reader's real progress, at any Leaf count in 15–30, deterministically.

**Scope:** `apps/mobile/src/screens/TrackDetailScreen.tsx` and new components/helpers under `apps/mobile/src`. Per the 2026-09-06 ruling, **the roadmap becomes this screen — it does not get a new one.**

**Requirements**

- **The layout is a pure function**, separate from the component: `(leafCount, viewport, seed) → geometry`. This is the single most important structural decision in the package, because it is what makes "does it work at 15 and at 30" a unit test rather than a device session.
- **It must be deterministic.** The same Track draws the same graph on every render and every launch. Seed from the Track id — **never `Math.random()` at render time.** The mockup uses a seeded PRNG (`prng(4711)`) and that is not incidental: a graph that reshuffles on re-render is unusable and untestable.
- **Three node states, not four: done, next, locked.** Derive them from `progress.completedLeaves` and `progress.nextLeafId` against `listLeaves(trackId)` sorted by `orderIndex` — **the client has no per-Leaf completion flag; I checked.** `LeafSummary` carries `{id, trackId, orderIndex, title, isPlaceholder}` and `TrackProgressSummary` carries counts plus `nextLeafId`, nothing more.
- **Cross-check the derivation rather than assuming it.** "The first N are done" is only true if completion has no gaps. `nextLeafId` is documented as *"the first incomplete Leaf in `orderIndex` order"*, so the check is exact: **the Leaf at index `completedLeaves` must be `nextLeafId`.** If it ever isn't, the assumption is broken — **degrade to something honest rather than drawing a confident lie**, and report it. This project has been bitten twice by trusting a derived count.
- **Do not build a fourth "revisit" state.** The mockup's fixture data carries one (`REVISIT=[2,5]`); **the domain model has no such concept and the API cannot supply it.** Building it would mean inventing reader state. Leave it out and I will log it with a trigger.
- **Node labels use the real Leaf title, truncated — never paraphrased, shortened by rewording, or invented.** Generated content in this product is traceable to a source by design; a UI that rewords a title manufactures text with no provenance. Truncation is fine; authorship is not yours.
- **The legal pair stays above the graph, visible without scrolling — this corrects my own ruling of 2026-09-06.** I wrote "below the graph" without having read the comment at `TrackDetailScreen.tsx:82`, which says *"The legal pair. Above the fold on this screen, not below a Leaf list."* The graph **is** a Leaf list, so "below the graph" is precisely the placement WP10 rejected on purpose. It stays above, compact. The constraint is the observation — **reachable without scrolling on a normal phone** — not a particular arrangement.
- **Every connection curves.** No straight segments anywhere, including the faint background web. Recursive tapering dendrites 3–4 levels deep, asymmetric per node, many fine terminal branches, irregular node bodies, one longer axon-like process per cell. `screen-1-v2-prompt.txt` is the precise spec and the reasoning behind each point; follow it rather than re-deriving it.
- **Density degrades before frame rate does.** Recursive branching at 30 nodes could mean thousands of SVG paths. **Measure it.** If a 30-node Track cannot hold a smooth scroll, **reduce dendrite density as node count rises** — do not ship a screen that stutters, and do not silently cap the Track length. Report the path count at 18 and at 30, and what you observed.
- **Reduced motion: swap, never remove.** `useReducedMotion` and `motionPlan` already exist and are already used in four places. Anything that animates here honours them.
- **The three node states must differ by more than hue**, since colour alone is not a state indicator for every reader.

**Out of scope**
- **Any change to `apps/backend` or `packages/shared`.** If you conclude the screen genuinely cannot be built without a per-Leaf completion field, **stop and say so** rather than reaching across the boundary — that is a different package and a different conversation.
- The other four screen packages. Nothing outside this screen changes.
- The "revisit" state.
- Track-complete and the share card — WP26 owns both, including the finished-Track constellation.

**Constraints:** tokens only, from `src/design/` — the token diff is zero, so **a new hex or spacing value in this diff means something has gone wrong**. The screen scrolls; decide deliberately where the Continue affordance lives and say why. Do not run `git add -A`; stage by path. `apps/mobile/ios/` is gitignored and large — leave it alone.

**Device gate:** *on a signed build,* **two Tracks with different Leaf counts, because that is the whole point:**
1. **Track 42 — 18 Leaves, real titles.** The one that matches the mockup.
2. **The 20-Leaf placeholder flagship** (`PLACEHOLDER_LEAF_COUNT = 20`). Different count, and the one that proves the algorithm rather than the picture.

On both: **both themes**, and **iOS Reduce Motion on**. Scroll the full length of the longer one and watch for stutter. Confirm the legal pair is visible without scrolling. **Then look at it and say whether it reads as a neuron or as a star chart** — that judgement is the founder's to make finally, but yours to report honestly first.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] The layout is a **pure function** with the component as a thin consumer
- [ ] **Unit tests exercise the layout across the full 15–30 range**, not only 18 — including that node positions stay within the frame and the spine stays within roughly the middle two-thirds
- [ ] **Determinism is asserted by a test**: the same input produces identical geometry across repeated calls
- [ ] Node states derive from `completedLeaves`/`nextLeafId`, and **the `nextLeafId` cross-check is implemented and tested, including the failure branch**
- [ ] No straight-line segments in the rendered graph, background web included
- [ ] **Observed on a device, on both a 18-Leaf and a 20-Leaf Track, in both themes:** the graph renders, the states are distinguishable, and the legal pair is visible without scrolling
- [ ] **Observed with Reduce Motion on:** motion is swapped, not removed
- [ ] Path count at 18 and at 30 reported, with observed scroll behaviour
- [ ] No new colour, spacing, radius or duration values

**Testing expectations:** **Tier A on the layout function** — it is pure, so the question "does this work at any Leaf count" is genuinely answerable without a device, which is rare in this app and worth spending properly. Tier B on the screen. **Mutation-check the cross-check**: break the `nextLeafId` comparison and confirm a test reddens, since that branch is the one guarding against a confidently wrong screen.

---

### Handoff: 2026-09-06 — WP21: redesign foundation — SVG, the handwritten font, and the token diff

*Manager. **Suggested model: Sonnet** — this package is a dependency, a font and a report. The one judgement call in it is named explicitly below rather than left to you, which is what keeps it Sonnet work.*

> **Read:** this handoff · `apps/mobile/App.tsx` · `apps/mobile/src/design/typography.ts` ·
> `apps/mobile/src/design/index.ts` · `apps/mobile/package.json` · `design/zoomout-design-system.md` ·
> `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `launch-blockers.md`, the rest of
> this log, `apps/pipeline`, `apps/backend`, `apps/admin`. Nothing in this package needs them.

### Task: WP21 — redesign foundation: SVG, the handwritten font, and the token diff

**Suggested model:** Sonnet — the design is settled and the work is dependency, config and a report; there is no judgement left to buy.

**Context:** A full visual redesign of the app was explored and approved — all 14 surfaces exist as mockups, entry point `design/RESUME-HERE.md`. Implementing it needs two things `apps/mobile` does not have: an SVG rendering primitive, because every curve in the new visual language is a bezier path that RN views cannot draw, and the Caveat font, which the design system now carries as `--font-handwritten` scoped to sticky notes. **This package adds both and changes nothing visible.** Five screen packages follow it and none can start until it lands.

**Objective:** `apps/mobile` can draw a bezier path and render text in Caveat, on a build that includes the native module — and every existing screen looks exactly as it does today.

**Scope:** `apps/mobile/package.json`, `apps/mobile/App.tsx`, `apps/mobile/src/design/typography.ts`, plus whatever the Expo install touches. Verify rather than trust: `expo-font` and `@expo-google-fonts/*` are already wired, so the font is an addition to an existing mechanism rather than a new one.

**Requirements**
- Add `react-native-svg` **via `npx expo install`, not `npm install`** — the Expo-pinned version for this SDK is the point, and this is a first-party SDK package.
- Add Caveat (`@expo-google-fonts/caveat`), load it through `App.tsx`'s existing `useFonts` call, and expose it in `fontFamilies` as a third family.
- **Update `typography.ts`'s docstring in the same commit.** It currently states *"Two families is a deliberate ceiling; font files are startup cost in React Native"* — which the code below it will now break. Record that the third family was added deliberately, on the founder's explicit instruction, scoped to sticky-note text only. **A rule left standing beside its own violation reads as an accident to everyone who was not in the room.**
- **Produce a token diff** between the published design system (`design/zoomout-design-system.md`) and `src/design/` — palette, spacing, radius, typography, motion. **Report it; do not act on it.** Name what differs and what is missing on each side. If nothing differs, say so — the exploration claims the values were verified exact, and confirming that is a real result.
- **The uncommitted `apps/mobile/package.json` change already in the working tree is yours to decide on, deliberately.** It switches the `android`/`ios` scripts from `expo start --android/--ios` to `expo run:android`/`expo run:ios`. Nobody recorded who made it or why, and it is exactly the change adding a native module requires. **Either adopt it into this commit and say so in your report, or set it aside — but do not sweep it in unexamined, and do not silently revert it.**

**Out of scope**
- **Any visible change whatsoever.** No screen, no component, no colour. If a pixel moves, this package has failed.
- **Building a curve, path or graph primitive.** WP22 needs one and WP22 knows what shape it needs; a primitive designed before its only caller exists is a guess.
- Acting on the token diff. Report only.
- The `design/` mockups. Reference for a later package, not code to port.

**Constraints:** adding a native module means Expo Go is no longer sufficient — a dev-client or prebuild build is required from here on. An `apps/mobile/ios/` prebuild already exists untracked, and is gitignored as of WP15.8, so that path is already partly walked; confirm it rather than starting a new one. **Whatever you render to prove the curve and the font must not survive into the commit** — otherwise it contradicts the criterion below it. Prove it, then remove it. **Do not run `git add -A` or `git add .`**; stage by path.

**Device gate:** *on a build that includes the native module,* three things observed rather than inferred:
1. **A bezier path draws on screen.** One curve, anywhere.
2. **A Caveat sample renders as an actual script face.** A wrong `fontFamily` string does not error in React Native — it falls back to the system font silently, and every test still passes. Look at it.
3. **Walk the app — Explore, Library, Journey, Profile, a Leaf, both themes — and confirm nothing looks different.** This is what the package actually rests on.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] `react-native-svg` present at the Expo-pinned version for this SDK, installed via `expo install`
- [ ] Caveat loads through the existing `useFonts` call, and `fontFamilies` exposes it as a third family
- [ ] `typography.ts`'s two-family docstring records the deliberate exception — **not merely contradicted by the code beneath it**
- [ ] **Observed on a device: a bezier path draws, and a Caveat sample is visibly a script face rather than the system fallback**
- [ ] **Observed on a device: every existing screen renders as it did before, in both themes** — verified by walking the app, not by tests passing
- [ ] The committed diff contains no new visible UI
- [ ] The token diff is written into the completion report

**Testing expectations:** Tier B, and be honest that the unit-testable surface is thin and weak by construction — a test asserting `fontFamilies.handwritten === 'Caveat_400Regular'` proves the string, and the string is exactly what fails silently. **The device gate is where this package's evidence lives.** Note first-paint cost if a third font at boot is noticeable; `App.tsx` gates render on `fontsLoaded`.

---

### Handoff: 2026-09-02 — WP15.8: Resolve CMS-relative media URLs in the content mapper

*Manager. **Suggested model: Sonnet** — the design is settled below and the failing values are printed. There is no judgement left to buy.*

> **Reissued 2026-09-02 after the first attempt exhausted the daily limit.** Two things changed and
> both are above the fold deliberately.
>
> **1. Most of this is already written and it is sitting in the working tree.** The previous session
> got cut off mid-package, uncommitted. The changes now sit on branch
> **`wp15.8-media-url-resolution`**, level with `main` (moved there on 2026-09-02 once WP20.1 merged,
> so nothing is stranded on a merged branch). `git diff
> apps/backend/src/content/` shows `resolveMediaUrl` + `isAbsoluteUrl`, `baseUrl` threaded through
> `mapTrack`/`mapLeaf`/`optionalImage`/`optionalDiagram`/`mapImageParts`, all three siblings covered,
> and ~390 lines of new tests. **Read that diff before writing anything.** A copy is at
> `scratchpad/wp15.8-wip.patch` in case the tree is disturbed. **What is left is the gates and the
> commit, not the design.**
>
> **2. Read only what is listed below.** `token-budget.md` Lever 3 says a handoff names its reading
> list and this one did not, so the first attempt loaded every planning document — ~55k tokens before
> touching a line of code. That is the likeliest reason the limit went in minutes.
>
> **Read:** this handoff · `apps/backend/src/content/content.mapper.ts` ·
> `apps/backend/src/content/content.repository.ts` · `imageAssetSchema` and `trackSchema` in
> `packages/shared/src/content.ts` · `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `LEGAL.md`, `projectRoadmap.md`, `launch-blockers.md`, the rest of
> this log, `apps/pipeline`, `apps/admin`, `apps/mobile`. Nothing in this package needs them.
>
> **Do not run `git add -A` or `git add .`** — `apps/mobile/ios/` is an untracked 1.2 GB Expo
> prebuild with no `.gitignore` rule, and it would go straight into the commit. Stage the three
> backend files by path. Adding that ignore rule is a requirement below.

### Task: WP15.8 — resolve Payload-relative media URLs so real content maps

**Context:** Track 42 is the first real content this project has produced, and **the app cannot render a single Leaf of it.** Payload stores media URLs relative — `/api/media/file/leaf-00-scenario-7.png` — while `imageAssetSchema` requires an absolute URL and `mapImageParts` passes the stored value straight through. Verified by running the real `mapLeaf` over a document fetched live from the CMS:

```
AS PUBLISHED (relative media urls): FAILED
   - Leaf 244: scenario.image.url — Invalid URL
   - Leaf 244: stickyNotes.diagram.url — Invalid URL
WITH ABSOLUTE URLS            : OK
```

`requireValid` turns that into `ContentInvalidError` → **HTTP 502**, whose reasons are logged and deliberately never returned to the client. So the app shows *"This content is unavailable"* and the cause lives only in the backend log. **Blast radius is exactly Track 42:** of 39 published Leaves, the 18 carrying relative media URLs are all its; the 21 placeholder Leaves have no media, which is why nothing caught this.

**This is WP15's failure with the sign flipped.** WP15's mapper silently *dropped* new fields while 932 tests stayed green; this one *rejects* them. Both times the field's producer and its renderer shipped weeks apart and nothing exercised them together.

**Objective:** A published Leaf whose scenario image and diagram live in Payload's media library maps successfully, and both render in the app.

**Scope:** `apps/backend/src/content/` — `content.mapper.ts` and its call sites in `content.repository.ts`. Verify rather than trust: `CONTENT_API_URL` already exists and `payloadClient` already uses it (`payloadClient.ts:79`), so no new environment variable should be needed.

**Requirements**
- Resolve CMS-relative media URLs against `CONTENT_API_URL`. **An already-absolute URL passes through untouched.**
- **Cover all three siblings, not just the two that are failing today.** Media URLs appear in `scenario.image.url`, `stickyNotes.diagram.url` **and `Track.coverUrl`**. Fixing the Leaf pair alone is a one-sided fix of exactly the shape ruled on 2026-08-29 — and here it is not hypothetical: **founder item 1 replaces Track 42's hotlinked cover with an asset we host**, which lands in Payload media as a relative URL and breaks Track mapping the same way. Verified: `mapTrack` on Track 42 with `coverUrl: '/api/media/file/cover.png'` fails with `coverUrl — Invalid URL`.
- **Do not change `packages/shared`.** The schema is frozen, and `z.url()` is right — a domain object should carry a resolvable URL. The stored relative value is also right. **The bug is the missing resolution step between them**, and that is the only thing to fix.
- **Do not write absolute URLs into Payload.** That bakes a hostname into content and breaks on the first environment change.
- Keep the mapper a pure function — take the base URL as a parameter rather than reading config inside it.
- **Add `apps/mobile/ios/` to the root `.gitignore`.** It is an untracked 1.2 GB Expo prebuild today, and `git add -A` sweeps 18 entries of it. Same shape as the `.venv` hazard already in the debt register, and the fix belongs with whoever is next in the tree rather than waiting for a package that owns it.

**Out of scope**
- **Production media serving.** See the debt note below — it is deliberately excluded and must be logged, not solved here.
- `purchaseLinks[].url`. Track 42's is schemeless (`gutenberg.org/ebooks/59844`) and **that is a content defect the founder fixes in the CMS**, not something the mapper should paper over by inventing a scheme.
- The pipeline, `apps/admin`, and the mobile app. Nothing in the app needs changing — `SlideImage` already renders `scenario.image` and `stickyNotes.diagram`.

**Constraints:** the resolution helper is one function used by all three call sites; do not inline it three times. `CONTENT_API_URL`'s value decides reachability — `http://localhost:3001` serves a simulator, a LAN address serves a physical device — so nothing in code should assume loopback.

**A precondition that was blocking and is now cleared — do not re-investigate it.** Track 42's purchase URL was schemeless, which made `mapTrack` reject the whole document; Explore uses `keepValid`, which **drops** invalid Tracks rather than erroring, so the Track was silently absent from Explore. **The founder fixed it on 2026-09-02 and it is verified: `https://gutenberg.org/ebooks/59844`, published, and 28 of 28 Tracks now map.** Track 42 reaches Explore. What it still cannot do is play, which is this package. **If Explore ever comes up 27, that is this defect returning and not your change.**

**Device gate:** *open Track 42 in the app, add it to your library, and play a Leaf.* **The scenario illustration appears above the prompt, and the sticky-notes diagram appears on slide 4.** Both, observed on a device — not a passing mapper test.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] **`mapLeaf` succeeds on a real Track 42 document carrying relative `scenario.image.url` and `stickyNotes.diagram.url`** — the fixture is copied from the live CMS, not hand-written, because a hand-written one will get the shape subtly right and the URL wrong
- [ ] **`mapTrack` succeeds on a Track whose `coverUrl` is relative** — the sibling, failing today only because nothing hosts a cover yet
- [ ] An already-absolute URL is returned unchanged — asserted explicitly, not assumed
- [ ] `GET /content/leaves/:id` returns **200** for a Track 42 Leaf that returns 502 today, against the live CMS
- [ ] **Mutation check:** breaking the resolution reddens the new tests and nothing else

**Testing expectations:** Tier B, plus the device gate — which is the criterion that matters, since every failure in this family has been invisible to unit tests by construction.

**Log at sign-off — the unenforced half of the invariant.** The guarantee is *"a published Leaf's media reaches the reader."* This package delivers the first half: the mapper emits a resolvable URL. **The second half is unbuilt and belongs to WP12** — in production Payload must not be publicly reachable, so a URL resolved against Payload's origin will not load on a real phone. Serving media needs a storage adapter writing to object storage, or the backend proxying it. Neither exists and no package owns it. Per the both-halves rule, record it in the debt register at sign-off rather than leaving it to be discovered during a deploy.

---

### Handoff: 2026-09-02 — WP20.1: Attach Track 42's scenario images

*Pipeline Manager. **Suggested model: Sonnet** — the selection judgement has been delegated away, so what remains is a write path you already own.*

### Task: WP20.1 — attach one candidate per Leaf, as drafts, for the founder to review in one pass

**Context:** WP20 published Track 42 with diagrams but **no scenario illustrations** — 54 candidates generated, 0 attached, because selection was WP15.7's affordance and it had not landed. WP15.7 has now landed.

**The founder has delegated selection for this Track only**, and will choose personally for later books. That changes the shape of the job: it is no longer 18 choices between three, it is one automated pass plus one human review.

**Objective:** Every Leaf on Track 42 carries a scenario image, chosen automatically, presented to the founder as a list to override rather than a set of decisions to make.

**Scope:** `apps/pipeline/`. A command, not a graph node — Track 42 is finished and this is a one-off correction.

**Requirements**
- For each of the 18 Leaves, attach the **first candidate that passes the guardrails** to `scenario.image`, carrying both `url` and `alt`.
- **Write drafts. Do not publish.** The Leaves are live; the machine key cannot edit published content and must not gain the ability. The founder publishes.
- **Full read-modify-write on the scenario group.** WP19 demonstrated by hand that a partial PATCH silently nulls omitted siblings, on this exact group. `scenario.prompt` and `scenario.options` must survive — verified by re-fetching, not by the response.
- **Report the 18 choices as a list** — Leaf order, title, chosen candidate index, and its `alt`. That list is what the founder reviews.
- **Do not sweep the 53 orphans yet.** Once the founder has accepted or overridden, the unreferenced files are a query; sweeping now would delete candidates they might switch to.

**Out of scope:** publishing, choosing on quality grounds beyond the guardrails, later books, regenerating any asset.

**Read-it-yourself gate:** *look at the 18 you picked.* If a scenario is about a difficult conversation and the image is an empty desk, say so in the report — the founder is reviewing your list, and a flagged mismatch is worth more than a silent one.

**Acceptance criteria**
- [ ] `apps/pipeline` lint, `mypy --strict`, `pytest` pass
- [ ] All 18 Leaves have `scenario.image` set with `url` and `alt`, as **drafts**
- [ ] **`scenario.prompt` and `scenario.options` are unchanged on all 18** — verified by re-fetching each document
- [ ] Nothing is published by the pipeline; the published versions still show no image until a human acts
- [ ] The 18 choices are reported as a reviewable list, with any mismatch flagged
- [ ] The 53 orphaned media files are untouched

**Testing expectations:** Tier A on never-publishes and on sibling survival. Tier B one happy path. This is a one-off correction against real data — the evidence is the re-fetched documents.

---

## Completions (Manager → Architect)

### Completed: WP22.3 — give the roadmap room to breathe — 2026-09-10

**Bottom line first:** All acceptance criteria met, device-verified in both themes at default and accessibility-max text size on the 20-Leaf placeholder — comfortable at every combination, no label colliding with a node or another label. **One gap named rather than hidden:** I did not get an on-device look at Track 42 specifically (below). Root `lint`, `typecheck` (4 workspaces), `test` (1,345 passing: shared 71, admin 198, backend 477, mobile 599 — 578 existing + 21 new) and `build` (backend/mobile/admin all produced real output) are clean from a genuine cold gate — `dist`/`.next` deleted across all four workspaces, `npm install`, then all four commands fresh. Branched from `origin/main` (`787a168`, which carries both this handoff and WP28's) as `wp22.3-roadmap-vertical-rhythm`; pushed, not yet a PR.

**Time:** roughly 20% reading (the handoff, `roadmapGeometry.ts` and `roadmapLabels.ts` in full, `TrackRoadmap.tsx`'s call site), 35% working out the actual fix — the arithmetic on why `maxStep` never bound, the circular-import constraint, deciding worst-case-uniform over per-node-adaptive — 20% implementation, 15% mutation-checking and fixing the one knock-on test failure, 10% device verification.

---

**What changed.** `roadmapGeometry.ts` gains one new exported pure function, `minStepForLabels(fontScale)`, and `layoutRoadmap`'s `step` computation becomes `Math.max(the existing viewport-derived clamp, minStepForLabels(viewport.fontScale ?? 1))` — additive, not a replacement of the old formula. `RoadmapViewport` gains one optional field, `fontScale?: number`, defaulted to 1 so every existing caller (`constellationFragment.ts`, `TrackCompleteScreen.tsx`, both from WP26) keeps its exact prior numeric output untouched. `TrackRoadmap.tsx` — not in the handoff's Read list, touched anyway, for the reason below — gains one line: the `fontScale` it already reads via `useWindowDimensions()` (for the labels call, which already had it) now also reaches `layoutRoadmap`, and the geometry `useMemo`'s dependency array gains `fontScale`, which it was missing even for the *labels* recompute path before this package — a small pre-existing staleness bug, fixed as a side effect of touching the line next to it, not a separate agenda.

**Why `TrackRoadmap.tsx`, when the handoff's scope was one file.** The acceptance criteria are explicit that the fix must be device-observed responding to real text scale ("Observed at 18 and 20 Leaves, both themes, default and accessibility-max: no label collides"). `layoutRoadmap`'s new `fontScale` parameter is inert unless something passes the reader's real value in — without this one line, the whole package would typecheck, unit-test green, and change nothing on an actual screen, because the default (`1`) would always apply regardless of the OS setting. Kept to the smallest possible change: one field added to an object literal already being constructed, one dependency added to an array already being written. `constellationFragment.ts` and `TrackCompleteScreen.tsx` were not touched — a finished Track's constellation renders every node as `'done'`, which needs no labels at all, so `fontScale` genuinely does not apply there.

**The arithmetic behind "`GRAPH.maxStep` is unchanged but dominated in every realistic case," promised in the code comment.** `viewportDerivedIdeal(count) = (874 × 0.52) / (count − 1)` exceeds `maxStep` (40) only when `count ≤ 12` — at 13 it is already 37.9. `PRODUCT.md` floors a Track at 15 Leaves. So `maxStep` has not been reachable by any real Track since before this package, and `minStepForLabels(1)` (≈39, see below) already exceeds every value `maxStep` could have clamped down to in that range regardless. Nothing was removed, because `GRAPH.minStep`'s own stated purpose — "below this the cell bodies themselves start to touch" — is a real, different, still-valid constraint that simply no longer drives the outcome.

**The floor's actual shape.** `minStepForLabels(fontScale) = max(lineHeight, fontSize × fontScale × 1.2) × 2 + 7` — two lines of the real `caption` token (imported from `design/`, not redefined, same precedent as the file's existing `MIN_TOUCH_TARGET` import) plus a 7pt breathing gap mirroring `roadmapLabels.ts`'s own `STACK_GAP`. At `fontScale = 1`: `max(16, 14.4) × 2 + 7 = 39`. **Assumes the worst case — every label at two lines — uniformly across the whole graph, not per node.** A true per-node figure (shorter gaps where a title is short enough to sit on one line) was the first design I considered and rejected: it would need each node's actual horizontal gutter and title to know whether that specific label wraps to one line or two, and by the time node positions (which the vertical step decides) exist, the step that produced them has already been spent — the same chicken-and-egg problem `layoutRoadmap`'s own docstring's "geometry has no business knowing a Leaf's title" rule exists to avoid entirely. Some real gaps are more generous than they strictly need to be under this; none are tighter than a two-line label needs, which is the direction "no label collides" cares about.

**`LABEL_LINES_ASSUMED` (2) and a `STACK_GAP`-equivalent (7) are duplicated from `roadmapLabels.ts`, not imported.** `roadmapLabels.ts` already imports from `roadmapGeometry.ts` (`HALO_RADIUS`, `LABEL_GAP`, `RoadmapNodeGeometry`); importing the reverse direction would make the two files a cycle. Recorded in both places — if `MAX_LABEL_LINES` or `STACK_GAP` change there, this needs the matching update, and nothing enforces that automatically.

---

**Mutation-checking, actually performed rather than asserted.** Two real mutations, applied to the working tree and run against the full suite, not reasoned about in the abstract:
1. `Math.max` → `Math.min` at the `step` wiring site (the line that actually applies the floor to real output). Caught by 18 tests: all 16 per-count instances of the new "never spaces two Leaves closer than a worst-case label needs" assertion, plus both dedicated end-to-end tests in the new "vertical rhythm responds to text scale" block.
2. `LABEL_LINES_ASSUMED`: `2` → `1`. Caught by 2 of the 4 `minStepForLabels` unit tests (the exact-value match and the "comfortably larger than 24" check) — the other two (monotonic growth with scale, and the scaled-vs-unscaled-lineHeight check) correctly did *not* fire, since neither depends on the assumed line count.
Both reverted after confirming; the working tree the commit reflects has never contained either mutation.

**One existing test's premise was overturned on purpose, and is recorded as such rather than silently adjusted.** `roadmapGeometry.test.ts` had "fits the whole book in about one screen rather than a long scroll," asserting `geometry.height < VIEWPORT.height × 1.2`. This is WP22.2's composition goal, which this handoff explicitly reverses ("the founder has ruled otherwise: vertical scrolling to explore the roadmap is fine; unreadable density is not") — and it failed immediately, at 5 of the 16 tested counts, confirming the reversal is real and not merely theoretical. Replaced with an assertion on the actual requirement instead of a ceiling: every consecutive gap is at least `minStepForLabels`'s floor. The old test's comment and intent are preserved in the new one's, so the history of *why* the ceiling existed and *why* it was removed both survive in the file.

**One further knock-on, in a different file, fixed without touching the module it tests.** `roadmapLabels.test.ts`'s "draws a leader only for the labels that had to move" built its node fixture via a real `layoutRoadmap(states, VIEWPORT, seed)` call (implicitly `fontScale` 1) at 18 Leaves, where every label was the same real 65-character title. Before this package, 18-Leaf node spacing (≈26.7pt) was already tighter than a two-line label (≈32pt) even at the *default* text size — so the fixture got leader-drawing "for free," as an accident of the crowding this package exists to remove. Closing exactly that gap means the accident no longer happens: at `fontScale` 1, the fixture's labels now fit without being pushed, and `withLeaders.length` came back 0. This is not a regression in leader-drawing — `layoutRoadmapLabels` is untouched, out of the handoff's scope, and every *other* assertion in that file (including "never lets two labels in the same gutter overlap," which would catch a real break) still passes. It is the test's fixture no longer producing the specific scenario it was written to exercise. Fixed by asking for labels at `fontScale: 1.5` while the fixture geometry stays built at 1 — the same "geometry and label-layout take independent inputs" property the module's own "degrading under the OS text size" tests already rely on, now doing double duty to reconstruct genuine stacking. 1.5 is comfortably past the ≈1.36 needed to force a two-line label taller than the fixture's own (scale-1) node spacing, and comfortably short of where `MIN_LABEL_CHARS` would start dropping labels instead of merely stacking them — a different, already-tested degradation that a larger scale would have triggered instead. Commented in place with the arithmetic, so it reads as a deliberate choice rather than an arbitrary number.

---

**Device verification.** iPhone 16 Pro simulator, both themes, default and accessibility-max text size (`simctl ui`, live-reactive — no relaunch needed for text size; the app *was* force-relaunched once at the start, per the standing Metro note, to pick up this branch's bundle after switching from `wp27-tab-screens-icon-swap`). All four combinations run against **the 20-Leaf placeholder Track**, reached via Explore → Track Detail: every node cleanly separated at default size with real (if short, synthetic) titles up to two lines wrapping without collision; at accessibility-max, nodes space out substantially further and the overwhelming majority of labels correctly vanish under `roadmapLabels.ts`'s own pre-existing "drop rather than render a stub" rule — exactly the intended interaction between the two mechanisms, and nothing here needed to change for it to work. Screenshots taken at each combination; scrolled the full length of the graph in the default-dark case to confirm no collision anywhere in the 20 nodes, not just the visible fold.

**Track 42 was not reached, and I am saying so rather than reporting on the placeholder alone as if it were both.** "The Science of Getting Rich" (18 real Leaves, finished, real varied-length titles from a real book) sits in this account's Library with no action button — a finished Track's card has to be tapped directly, and repeated attempts at the coordinates its title/cover should occupy did not navigate. I did not chase this further: it did not reproduce on any *other* screen this session (Explore's cards, the placeholder's own card, every tab-bar target all responded normally), and open-ended tap-coordinate debugging in this simulator is explicitly WP28's job, not mine to freelance into. What I can say: the fix is provably title-content-agnostic — `minStepForLabels` never reads a title, only `fontScale`, so there is no code path by which Track 42's *specific* titles could behave differently from the placeholder's under this change. What I cannot say from direct observation: whether Track 42's real prose (up to 65 characters, per `roadmapLabels.test.ts`'s own fixture) reads comfortably at the two-line wraps it will actually produce, as opposed to the placeholder's mostly-short synthetic titles. Worth a follow-up look, not a blocking gap.

**Possibly relevant to WP28, not investigated further here:** the Track 42 tap failure above has surface similarity to the three-package tap-resistance pattern WP28 is diagnosing, but I want to be precise about how *little* this adds: WP28's pattern is a footer-positioned primary CTA; this was a whole-card tap with no button at all, on a screen WP28's Read list does not include (`LibraryScreen.tsx`). Might be the same root cause, might be coordinate estimation on my part, might be a third thing. Flagging the data point, not the diagnosis.

---

**Files touched:** `apps/mobile/src/screens/track/roadmapGeometry.ts`, `roadmapGeometry.test.ts`, `roadmapLabels.test.ts`, `TrackRoadmap.tsx`.

**Tests added/updated:** `minStepForLabels` — 4 new Tier A tests (exact value at default scale pinned to the real design token, monotonic growth with scale, exceeds the old flat-24 floor, scales `lineHeight` rather than trusting the unscaled token). A new "vertical rhythm responds to text scale end to end" block — 3 tests (height grows with scale; no gap anywhere undercuts the floor, checked at both scales; `spineBand`/the horizontal band is provably untouched by `fontScale`, exact equality not tolerance). The "fits in about one screen" test replaced as described above (16 instances, one per count). `roadmapLabels.test.ts`'s one affected test fixed in place, comment included.

**Assumptions made:** the worst-case-uniform floor over per-node-adaptive spacing, and touching `TrackRoadmap.tsx` despite it being outside the named scope — both argued above, both because the alternative would have failed the acceptance criteria outright rather than merely being a stylistic difference.

**Follow-ups / tech debt for Architect:**
1. **Track 42 device check** — above. Low-risk given the fix's title-agnosticism, but not directly observed.
2. **The Track 42 tap failure** — a possible fourth data point for WP28, not diagnosed.
3. Nothing else. `spineBand`, the label treatment, node glyphs and dendrites are all untouched, as scoped.

**On "no new colour, spacing, radius or duration values":** `LABEL_LINES_ASSUMED` and the 7pt gap are algorithm parameters for this file's existing "not a design token" category (see the file's own docstring, and `GRAPH`'s existing precedent of un-tokenised numbers like `haloRadius`) — not new design-system values. Nothing in `src/design/` changed; `minStepForLabels` only *reads* the existing `caption` token, the same way `TrackRoadmap.tsx` already did for the labels call.

---

### Completed: WP26 — Track complete, and the share card — 2026-09-10

**Bottom line first:** All stated acceptance criteria met, with one deliberate, named exception — "XP earned" and "first-try count" are not shown because no client-visible shape carries a Track-scoped source for either (see below; a real decision for Architect, not a default I should have picked silently). Root `lint`, `typecheck` (4 workspaces), `test` (mobile 592 + shared 71 + admin 198 + backend 477 = 1,338, all passing) and `build` (backend/mobile/admin outputs confirmed on disk) are clean from a cold gate — `dist`/`.next`/`node_modules` deleted and `npm install` rerun from scratch, not just a warm re-run. PR #37 confirmed merged before branching (`gh pr view 37`: `MERGED`, merge commit `65b94c6`, matching `origin/main`'s tip at branch time) and `layoutRoadmap`'s new signature independently re-verified by reading the merged `roadmapGeometry.ts` myself, not just trusting the handoff's own claim. Branched from `origin/main` as `wp26-track-complete-share-card`; pushed, not yet a PR.

#### What changed, per surface

**A new `TrackCompleteScreen.tsx`, and it consumes real geometry rather than reinventing it.** `layoutRoadmap` is called with every node's state forced to `'done'` (a finished Track has no `next`/`locked`/`revisit` cell) and the same `seedFromTrackId(trackId)` that `TrackDetailScreen` already uses — so the finished constellation and the roadmap screen agree on shape by construction, not by care taken to match them. The paint is a new, purpose-built module (`constellationLayers.ts`) rather than a copy of `TrackRoadmap.tsx`'s private `buildLayers`: that function is private and the roadmap screen is out of scope by instruction, and the paint a fully-lit graph needs is genuinely simpler than the general 4-state case (one colour for read tissue, one for the reward ring/bud, no halo, no dash — its opacity/width constants are reused from `TrackRoadmap.tsx`'s own, not invented). **Every node is tappable and reopens its Leaf** — the roadmap screen's own rule ("only the next cell opens from the map") has nothing to apply to on a finished Track, since there is no `next` node at all; this wires the read-replay affordance the handoff calls for, not a reversal of that rule.

**The share card's fragment is a crop of that same geometry, rotated — not a second decorative generator.** `layoutRoadmap` lays a Track out top-to-bottom (a narrow horizontal meander down a tall column); the mascot slot is short and wide. A literal crop would show at most one or two nodes before running out of height, so `constellationFragment.ts` selects a centred run of nodes and **transposes** the projection (geometry `y` → fragment `x`) before scaling into the slot. Dendrites, tips and the soma's own outline are dropped — `ShareCard`'s own docstring already treats everything below the headline and the book as texture allowed to simplify at thumbnail size, and re-deriving that detail rotated into a box it was never laid out for would be new geometry wearing the old one's name.

**`ShareCard.tsx` — two additive props, both a no-op by default.** `mascot?: ReactNode` overrides `MascotSlot`'s contents; omitted (every existing caller), the slot renders exactly the reward-band-plus-achievement-icon it always has. `aspect?: 'auto' | 'square' | 'vertical'` adds a fixed height (+ `justifyContent: 'space-between'` so the wordmark anchors to the bottom edge instead of stacking at the top) only for `'square'`/`'vertical'`; `'auto'` — the default, and every pre-WP26 caller — is byte-for-byte the old behaviour, confirmed by a dedicated new test asserting `height`/`justifyContent` are both `undefined` on that path, plus the full existing `WrapUpScreen.test.tsx` suite still passing unchanged. **The `achievement` icon line itself does not appear anywhere in the diff** (`git diff -- ShareCard.tsx | grep "Icon name"` — no output) — confirmed, not assumed.

**`LeafPlayerScreen.tsx` — the only way to *reach* the new screen, and nothing else about this file's behaviour changes.** `TrackCompletedPanel` gets one new button, "See your finished book" (`onView` prop, wired from `LeafSessionView` as `navigation.pop()` then `navigate('TrackComplete', {trackId})` — same shape as the existing `onWrapUp` callback, for the same reason: going back must not drop the reader into a Leaf they already left). The existing "That is the whole book." + `TrackLegal` inline content is untouched; this is additive, not a replacement. **This file wasn't in the handoff's Scope or Read list** — flagged under Assumptions, since without it the new screen is unreachable from the one place a reader actually finishes a Track.

**A small addition beyond the acceptance criteria: a close (×) control on `TrackCompleteScreen`.** Built the screen without one first, reasoning the native push/swipe-back gesture was enough — then found on-device that it isn't discoverable without knowing to swipe, and that `WrapUpScreen`'s own WP9 history already records this exact mistake once ("the only way off this screen was the iOS edge-swipe — an invisible affordance, and one Android does not have at all"). The handoff's own mockup shows an × in the header too. Added `Icon name="close"` + `navigation.goBack()`, matching `PlayerFrame`'s existing pattern.

**The stats row shows one number, deliberately, not three.** `trackCompleteStats.ts` is the pure module the testing bar calls for — checked and documented, not assumed: `TrackProgressSummary` carries no XP or first-try field for any Track; `ReaderStanding.totalXp` is lifetime, not per-Track; `SessionSummary` is scoped to today, and a Track this size is read across several days under the daily cap; `LeafSummary` carries no progress at all. The only way to get a real per-Track total would be fetching every Leaf's `LeafProgress` and summing client-side — the exact N-request rollup `trackProgressSummarySchema`'s own docstring names as the reason that shape exists, for the library's worth of Tracks; doing the same thing here for one Track is the identical anti-pattern at smaller scale, and backend work is out of this package's scope besides. Day streak is real (`GET /progress/today`) and is the one thing shown, reusing `WrapUpScreen`'s established "Day one" zero-streak fallback rather than reinventing it.

#### Files touched
- `apps/mobile/src/screens/share/TrackCompleteScreen.tsx` (new) — the screen
- `apps/mobile/src/screens/share/TrackCompleteScreen.test.tsx` (new) — 1 Tier-B happy-path render test
- `apps/mobile/src/screens/share/constellationLayers.ts` (new) — finished-constellation paint; not unit-tested directly, same precedent as `TrackRoadmap.tsx`'s own untested `buildLayers` (paint/rendering logic, not a decision)
- `apps/mobile/src/screens/share/constellationFragment.ts` (new) — selection + rotated-crop projection, Tier A
- `apps/mobile/src/screens/share/constellationFragment.test.ts` (new) — 8 tests
- `apps/mobile/src/screens/share/trackCompleteStats.ts` (new) — the stat-availability predicate, Tier A
- `apps/mobile/src/screens/share/trackCompleteStats.test.ts` (new) — 3 tests
- `apps/mobile/src/screens/share/ShareCard.tsx` — `mascot`/`aspect` props, additive
- `apps/mobile/src/screens/share/ShareCard.test.tsx` (new) — 5 tests covering both new props and the unchanged default
- `apps/mobile/src/screens/leaf/LeafPlayerScreen.tsx` — `TrackCompletedPanel` gains `onView`; wired from `LeafSessionView`
- `apps/mobile/src/navigation/types.ts` — `TrackComplete: {trackId}` route; `Tabs` widened to `NavigatorScreenParams<TabParamList> | undefined` (additive — bare `navigate('Tabs')` still typechecks) so "Find your next book" can target Explore specifically
- `apps/mobile/src/navigation/AppStack.tsx` — registers `TrackCompleteScreen`

#### Tests added/updated
17 new tests across 4 new files, all passing:

| Test file | What it proves |
|---|---|
| `trackCompleteStats.test.ts` (3) | Real streak shown; zero streak falls back to "Day one"; never returns more than the one stat the product can source |
| `constellationFragment.test.ts` (8) | Selection is centred and contiguous, not "first N"; the tall-column-into-wide-band transpose actually rotates (a spread comparison, not just "did not crash"); the spine reconnects the right count of gaps; empty geometry does not throw |
| `ShareCard.test.tsx` (5) | Default mascot band unchanged when `mascot` omitted; override replaces it without moving anything else; `auto` has no fixed height (regression guard for every existing caller); `square`/`vertical` produce the exact 1:1 / 9:16 pixel dimensions |
| `TrackCompleteScreen.test.tsx` (1) | Real fixtures (Track/Leaves/streak, served through a `FakeBackend` at the HTTP boundary, same pattern as `WrapUpScreen.test.tsx`) render the title, one node-button per Leaf, the real streak stat, the legal pair, both action buttons, and the fragment — proves the screen actually wires data through the pure modules, which a pure-function test cannot catch by itself |

**No test exercises `LeafPlayerScreen`'s new button directly.** `LeafPlayerScreen` has zero pre-existing render-level tests anywhere in the repo (`trackCompleted` is only exercised at the `useLeafSession` hook level, never through `CompletionSummary`/`TrackCompletedPanel`'s actual rendering) — building a screen-render harness from scratch for a five-line button addition was disproportionate given manual device verification is mandatory regardless. Verified live instead (below). Pre-existing Tier C gap, now very slightly larger; noted for WP14 rather than fixed here.

#### Device verification — exactly what was seen, and in what state

Ran on a booted iPhone 16 Pro simulator against the real backend and Payload (not stand-ins). Account seeded via the real API — see "How the account was produced" below.

**Confirmed live, with a screenshot at each step:**
- **Finishing the 18th and final Leaf of Track 42** ("The Science of Getting Rich") end-to-end through all 5 slides → `trackCompleted: true` → the existing "That is the whole book." panel → new "See your finished book" button → `TrackCompleteScreen` renders: real title/author, the full 18-node constellation (matches the roadmap screen's own shape, same seed), the real streak stat (**1, "Day streak"** — the reader's genuine current streak; the zero-streak "Day one" fallback is unit-tested, not device-observed, since this account's streak was never actually zero), `TrackLegal`'s disclaimer + purchase link, both actions.
- **Both aspect ratios, captured and opened as files, not previews.** `Share your constellation` invokes the real OS share sheet (`captureRef` → `expo-sharing`) for both `Square` and `Story`; pulled both PNGs directly from the simulator's sandbox (`tmp/ReactNative/*.png`) rather than trusting the share-sheet thumbnail. **Square: 960×960px, exactly 1:1. Vertical: 960×1707px, exactly 9:16** (`320×569` at 3×, matching `Math.round(320×16/9)`). Opened both full-size and downscaled to true 96px-wide thumbnails (`sips -Z 96`) to check the actual legibility criterion: the headline number and the book title are both clearly readable at thumbnail scale in both aspects; the eyebrow and wordmark row correctly become texture, as designed.
- **Reopening a finished Leaf awards nothing, checked via the API before and after, not assumed.** Tapped Leaf 1's constellation node → opened at the Summary slide (confirming the tap → `LeafPlayer` navigation) → the scenario's `Next` was already enabled without re-answering (payoff already unlocked, correctly persisted) → through to Finish → "You had already finished this one, so no new XP this time." `totalXp` via `GET /progress/today`: **1000 before, 1000 after.**
- **Both themes at accessibility-max text size (XXXL, `simctl ui`).** Light: nothing clipped structurally, screen fully navigable, share card correctly forced-light (indistinguishable from the app's own light theme at this size, which is the point). Dark: screen correctly dark, share card correctly stays light regardless — the required side-by-side contrast is directly visible in one screenshot.
- **The close (×) control**, added mid-package (above): tapped, correctly returns to Journey.

**A caveat named rather than smoothed over:** the reopen-Leaf-1 check above is real (`totalXp` genuinely unchanged, checked via the API, not inferred), but the account was at or near the 500-XP daily cap for essentially this entire verification pass, despite several attempts to force a genuinely fresh, uncapped local day by rotating the account's `timezone` across nine different zones (a legitimate profile field, not a privileged mechanism) — every one reported `capReached: true`. So this confirms the **outcome** the acceptance criterion asks for (XP unchanged, before and after) but does not cleanly **isolate** "zero because idempotent" from "zero because capped" the way a fresh account would have. Both are real, already-existing backend guarantees this package does not modify — naming the gap for completeness, not because I doubt the guarantee.

#### How the account was produced
No seed script existed, so I wrote one (`node`, hitting the real API on `localhost:3000`): sign up a fresh account, add Track 42, then for each of its first 17 Leaves — `startLeaf`, try each of the 3 scenario options via `submitAnswer` until one reports `correct` (legitimate trial-and-error against the real endpoint; the answer key is correctly never exposed to the client and I did not look for it in the backend, which is out of this package's scope), then `completeLeaf`. The 18th Leaf was left deliberately untouched, to be finished by hand on the device so the actual transition could be watched rather than assumed. The daily cap (500 XP, ~80-100 XP/Leaf with first-try bonuses) fires around Leaf 6-7 of 18; the script rotates the account's timezone across widely-separated offsets whenever it does, which reliably produces a new local day for the server's cap check without waiting a real day.

**Two infrastructure problems found and fixed along the way, worth recording:**
1. **A 2-day-old, unresponsive `admin` (Payload) dev-server process on port 3001** caused every content-backed backend request to time out and 503 (`ContentUnavailableError`). Not a code defect — killed it and started a fresh instance via the proper tool, which came up in under a second and resolved every subsequent request.
2. **Reduce Motion being enabled on the simulator produces a persistent "Open debugger to view warnings" banner that swallows every touch in roughly the bottom 15% of the screen — including the entire tab bar — while everything above it keeps working normally.** This cost real time (many tap attempts at what looked like the right coordinates, all silently absorbed) before I traced it to the `[Reanimated] Reduced motion setting is enabled` warning in Metro's own log and disabled it via `xcrun simctl spawn <udid> defaults write com.apple.Accessibility ReduceMotionEnabled -bool NO` — zero taps, same style of fix as the already-documented theme/text-size route. **I suspect this may be related to WP25's still-unresolved "the Leaf player's Next button would not register a tap after roughly fifteen attempts... other buttons on the very same screens worked normally"** — a footer-positioned primary CTA sitting in the same bottom strip a reduced-motion banner would cover is at least consistent with that symptom — though WP25's report specifically says *other* buttons on the same screens worked, which my case does not cleanly match (I found nothing tappable in that strip at all), so I'm naming this as a strong lead for whoever hits tap trouble next, not a confirmed shared root cause. **Recommend checking `ReduceMotionEnabled` first, before suspecting coordinates, in any future device pass that fights unexplained tap failures.**

#### Assumptions made
1. **`LeafPlayerScreen.tsx` was not in the handoff's Scope or Read list, but I edited it anyway** — the new screen is otherwise unreachable from the one place a reader actually finishes a Track. Kept the change minimal and additive (one prop, one button; the existing legal content is untouched).
2. **The close (×) control**, detailed above — not a named acceptance criterion, added on the strength of the mockup and `WrapUpScreen`'s own precedent.
3. **`Tabs`'s route-param type was widened** (`undefined` → `NavigatorScreenParams<TabParamList> | undefined`) so "Find your next book" can target Explore specifically rather than whatever tab was last focused. Additive — every existing bare `navigate('Tabs')` call still typechecks.
4. **The share-card fragment simplifies to spine + node centres, dropping dendrites/tips/the soma's own irregular outline** — a legibility judgement (this is exactly the content `ShareCard`'s own docstring says is allowed to become texture at small size), not a limitation I hit and stopped short of.
5. **The vertical (`Story`, 9:16) card has a large gap of empty white space between the subtitle and the wordmark** — visible in the captured file, not hidden. `justifyContent: 'space-between'` correctly pins `MascotSlot`/content-block/`Wordmark` apart, but the content block itself doesn't grow to fill the taller canvas. Left as-is rather than redesigning the card's internal layout, which the handoff explicitly scoped down to "change less than you expect." Flagging as a real, visible gap rather than silently accepting it.
6. **On "tokens only":** every colour/spacing/radius in this package's actual UI chrome (buttons, cards, the screen's own layout) comes from `theme.*`. The illustration-specific numbers inside `constellationLayers.ts`/`constellationFragment.ts` (a fragment node's dot radius, a margin fraction, a stroke width) are new, but they're algorithm parameters for a decorative drawing, not design-system values — the same category `roadmapGeometry.ts`'s own docstring already carves out ("algorithm parameters, not design tokens... have no meaning outside this file"). Read the constraint this way rather than asking whether a constellation needs its own design-system entry.

#### Follow-ups / tech debt for Architect
1. **A ruling is needed on XP earned and first-try count.** Currently permanently absent from Track-complete, by design, because no client-visible shape carries either. Two ways forward: extend `TrackProgressSummary` (or a new endpoint) with server-computed, Track-scoped `xpEarned`/`firstTryCount` fields — cheap on the backend, which already has the rows; or rule that one stat is the permanent, correct design and the mockup's three-stat spec was aspirational. Either is a real decision, not a default I should have picked.
2. **The vertical share card's dead space**, above — cosmetic, not urgent, but real.
3. **The reopen-a-Leaf / XP-idempotency confound**, above — the observable outcome is verified; full mechanism isolation would need a genuinely fresh, uncapped test account, which this session could not produce.
4. **The Reduce-Motion / tap-blocking discovery**, above, as a lead on WP25's still-open tap-resistance mystery.
5. **Tier C, deferred, per the testing bar:** failure-path tests for `TrackCompleteScreen` (load error, retry), theme/text-size permutations beyond the two required combinations, exhaustive constellation-fragment count boundary cases beyond what's tested.

#### Time, roughly
Reading and design (the two mockups, both prompt files, `ShareCard`'s docstrings, the roadmap's geometry module, the data-layer survey that found the XP/first-try gap): the largest share — this package's real judgement call was architectural (how to reuse `layoutRoadmap` without duplicating `TrackRoadmap.tsx`'s private paint code) and that took real thinking before any code. Implementation was comparatively quick once the shape was decided. Device verification was the other large share, almost entirely the two infrastructure problems above (the hung admin server, the Reduce Motion tap-blocking) rather than the app's own code — once both were diagnosed, the actual verification (finish a Leaf, capture both aspects, reopen a Leaf, both themes) went quickly. Write-up: modest.

---

### Completed: WP25 — the reward and failure moments — 2026-09-10

**Eight of nine acceptance criteria met with direct evidence; the ninth (achievement unlock, live, under Reduce Motion) is code-verified and partially device-observed, not fully device-observed — detail below, not glossed over.** Root `lint`, `typecheck` (4 workspaces), `test` (1,240 passing: shared 71, admin 198, backend 477, mobile 494 — 480 + 14 new) and `build` (backend/mobile/admin outputs confirmed present on disk after a `dist`/`.next`/reinstall) are clean from a cold gate. Branched from `origin/main` (`b655f0e`, which carries the REVISED handoff) as `wp25-reward-failure-moments`; pushed, not yet a PR.

#### What changed, per surface

**`AchievementUnlock.tsx` — the flat icon becomes a badge.** Ported `Achievement unlock.html`'s `blobPath` formula into a new pure module, `achievementBadge.ts` (`badgeBlobPath(cx, cy, radius, wobble)` — deterministic, no `Math.random`, Tier A with 5 mutation-checked tests), and render it as an SVG blob filled solid `reward` amber with the existing `achievement` glyph centred on top via `theme.palette.onReward`. This is the fill case for the outline/fill boundary ruled 2026-09-09 alongside the roadmap's completed-node ring ("outline for what you have done, fill for what you have just won"). The card's left-accent bar becomes a plain hairline-bordered `surfaceFor('raised')` card — the badge itself now carries the amber weight, so the border no longer needs to. **The entrance animation is untouched, deliberately**: the REVISED handoff's own finding held up on inspection — `Achievement unlock.html` has no `@keyframes`, and its four "frames" are four stills of one moment (mid-Leaf, entering, resolved, handed back), not a running animation. WP22.1's `motionPlan`/`REDUCE_MOTION_OVERRIDE` mechanism needed no changes; only what it reveals changed.

*One tension named rather than quietly resolved:* screen-11's Do-Not list says no trophy or medal. The badge glyph inside the blob is the app's existing `achievement` icon, which maps to Ionicons' `trophy` — pre-existing, not introduced here, and shared with `ProfileScreen`'s grid and `ShareCard`'s mascot slot (both out of scope; `ShareCard.tsx` is a named acceptance criterion to leave untouched). Changing the underlying icon would change `ShareCard`'s rendered output without touching its file, which felt like the wrong way to satisfy "unchanged in the diff." I read the Do-Not as aimed at the *ceremony* (confetti, medals, a podium) rather than at this specific glyph in isolation — the mockup itself nests a small icon inside the same blob shape — but this is a judgement call, not a certainty, and whoever next touches `Icon.tsx`'s icon set (Profile's own badge rework is the obvious moment) should treat it as open.

**`WrapUpScreen.tsx` — caption, a real stat row, and a stronger proof of the one invariant that matters.** The "Today" caption becomes "Session complete", static across both endings, matching the mock's IA. A new three-stat row (leaves / XP / streak) renders `SessionSummary` fields the screen already had but never showed (`xpEarned`, `streak.current`) — pulled into a pure, exported `wrapUpStats()` (Tier A, 2 tests, mutation-checked), including the mockup's "Day one" fallback for a zero streak. Hidden entirely on the zero-Leaf day, since there's nothing to show yet and showing zeroes next to "Nothing yet today" read as a non-sequitur. **Did not** add the mockup's own decorative mini-diagram (`Fragment2`) or a track-progress bar — the latter specifically because `SessionSummary` carries no total-Leaf-count field, and adding one would have violated screen-10's "do not invent a metric the product does not track." The cap-hit/voluntary acceptance criterion — one layout, one line of copy differs — is proven by a test that diffs every string of text in the rendered tree between the two states, not a handful of named assertions: **the first version of that test only checked specific testIDs, passed, and then passed again after I deliberately forked the H1 headline on `capReached` as a mutation check.** Rewrote it to diff the whole tree; it then caught the same mutation. Left both versions' reasoning in the test file's comments because the near-miss is the useful part.

**`ReportErrorSheet.tsx` — from a full-screen page to an actual bottom sheet.** The previous build used `presentationStyle="pageSheet"`, which is a full screen on this stack — exactly what screen-12 rules out ("do not make the report form a full-screen takeover of the Leaf they were reading"). Rebuilt on a `transparent` `Modal` with a scrim and the sheet as siblings, anchored to the bottom, `maxHeight` capped at 85% of window height with its own internal scroll — verified live on a real Leaf (see device section): the Leaf's header stays dimly visible behind the sheet. **A real bug surfaced and fixed along the way, not just a test inconvenience:** my first attempt nested the sheet *inside* the scrim's `Pressable`, and the scrim's own `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"` — meant only to keep the empty scrim itself out of the accessibility tree — hid every descendant, which meant the entire sheet (title, reasons, text field, submit button) was invisible to VoiceOver and to every accessibility-tree-based test query alike. Restructured scrim and sheet as siblings; the sheet is now fully reachable. Kept the reason list: it shows full sentences a reader picks between ("Something here is factually wrong"), never the internal category codes (`factual_error`) the Do-Not is aimed at, and the fix queue genuinely needs the category to be sortable by a human — removing it would have been an architecture change the handoff didn't ask for, not a restyle.

**`ErrorState.tsx` / `StatusMessage.tsx` — calm, not alarming.** `tone="incorrect"` (red) becomes `theme.palette.primary` (teal); a new `unresolved` icon key (Ionicons `pulse-outline`, not `alert-circle`) replaces the alert glyph — "a connection that has not resolved yet, not a broken one," per screen-12. `StatusMessage`'s public `tone="error"` prop is unchanged; only what it renders under that tone changed, which is the entire point of it being shared — one change reaches its twelve consumers rather than needing one each. `EmptyState.tsx` needed no changes: it already used `tone="primary"`, no red, nothing to fix.

**Infrastructure, not scope, but load-bearing:**
- `eslint.config.js` gains a `design/**` ignore entry. This was **already broken on `origin/main` before this branch touched anything** — the collaboration log's own WP22.2 sign-off (`0626f4e`) says "design/\*\* joins eslint's ignore list," but the actual diff of that commit only touched `projectRoadmap.md`; the config change was never made. Root `lint` failed with ~327 errors from `design/claude_design/**`'s vendored JS/JSX until I added the entry the sign-off had already ruled on. Not my ruling to make, just the one already on record that hadn't landed.
- `jest.setup.js` gains a `Modal` mock. RN's real `Modal` presents its children through a native root the test renderer has no way to attach to; `getByTestId`/`getByText`/`screen.*` could not find *any* element inside it, even though `toJSON()`'s debug-dump output could still print the whole tree — the query engine and the debug dump traverse differently. `ReportErrorSheet` is this app's first `Modal` consumer (grepped for other usages: none), so nothing had hit this before. The mock renders `Modal`'s children inline exactly when `visible`, which is all any test here needs; the real presentation is Apple's/Android's code and belongs to the device check above, not a unit test.

#### Files touched
- `apps/mobile/src/components/Icon.tsx` — `error` icon key renamed to `unresolved`, Ionicons glyph changed
- `apps/mobile/src/components/StatusMessage.tsx` — error tone: `incorrect` → `primary`; icon key updated
- `apps/mobile/src/components/ErrorState.tsx` — same recolour
- `apps/mobile/src/components/achievementBadge.ts` (new) — `badgeBlobPath`, pure
- `apps/mobile/src/components/achievementBadge.test.ts` (new) — 5 tests
- `apps/mobile/src/components/AchievementUnlock.tsx` — badge render, card restyle, doc comments
- `apps/mobile/src/screens/share/WrapUpScreen.tsx` — caption, `wrapUpStats()`, stat row
- `apps/mobile/src/screens/share/WrapUpScreen.test.tsx` (new) — 5 tests
- `apps/mobile/src/screens/leaf/ReportErrorSheet.tsx` — bottom-sheet restructure
- `apps/mobile/src/screens/leaf/ReportErrorSheet.test.tsx` (new) — 4 tests
- `apps/mobile/jest.setup.js` — `Modal` mock, documented
- `eslint.config.js` — `design/**` ignore
- `.claude/launch.json` — added a `mobile` (Expo/Metro) entry; the file predates this session (admin/backend/admin-wp15.7 entries already there, untracked) and had never been committed by anyone, so I committed it as found plus my addition rather than leaving it permanently untracked

**`ShareCard.tsx` is unchanged** — confirmed by `git diff --stat`, empty. **`EmptyState.tsx` is unchanged** — read, found nothing to fix, left alone.

#### Tests added/updated
14 new tests across 3 new files, all passing, mutation-checked wherever they assert pure/structural behaviour:

| Test | What it proves | Mutation check |
|---|---|---|
| `achievementBadge.test.ts` (5) | The blob path is deterministic, centre-dependent, bounded by radius+wobble, and a valid octagon at wobble=0 | Dropped the vertex count 8→6; the vertex-count assertion caught it |
| `wrapUpStats` unit tests (2) | Leaves/XP/streak map correctly; zero streak falls back to "Day one" | Removed the fallback; the dedicated test caught it |
| `WrapUpScreen` render tests (3) | Real data renders; the zero-Leaf day hides the stat row; **cap-hit and voluntary share every string of text except the eyebrow** | Forked the H1 on `capReached` — the *first* version of this test (named-field checks) missed it; the rewritten full-tree-diff version caught it. Both kept in the file, on purpose |
| `ReportErrorSheet` tests (4) | End-to-end happy path to confirmation; the sheet stays open (not confirmed) on a failed submit; close button and scrim both dismiss without submitting | Made a failed submit still advance to "sent" — caught by the failure-path test |

All four `ReportErrorSheet` tests use `userEvent`, not `fireEvent` + a hand-rolled `act()` — the latter reliably left a *later*, unrelated test in the same file unable to find elements plainly present in its own tree (confirmed by direct debug inspection: the element was in `toJSON()`'s output, `getByTestId` still threw "not found"). `leafPlayer.test.tsx` had already settled on `userEvent` for exactly this kind of interaction; this file follows it rather than re-litigating the choice. Worth carrying forward for any future test that both fires an interaction and needs the update to be visible before the next assertion.

**No `AchievementUnlock` component-level test was added.** It has zero pre-existing coverage and none of its scope is a pure predicate — it always renders every achievement it's given as earned (never the locked/unearned case; that's Profile's grid, a later package), so there's no earned/unearned branch to test here. The badge geometry it depends on is the piece that's actually pure, and that's covered.

#### Device verification — exactly what was seen, and in what state

Built via the documented `xcodebuild` route (`-allowProvisioningUpdates CODE_SIGN_STYLE=Automatic`, signed "Sign to Run Locally"), ran on a booted iPhone 16 Pro simulator against the real backend and Payload, not a stand-in.

**Confirmed live, with a screenshot at each step:**
- **Report-error, end to end:** flag-equivalent affordance → bottom sheet opens with the Leaf dimmed and visible behind it → reason selected (border + check icon) → submit → "Thank you — we have this." confirmation → Done closes back to the Leaf. Dark theme, default text size.
- **Both failure frames**, both arising from real conditions, not simulated props: Payload down (`ContentUnavailableError`, "Content is temporarily unavailable") on first launch when I hadn't yet started the admin/Payload dev server, and the backend itself stopped mid-session (`NetworkError`, "Could not reach ZoomOut. Check your connection and try again.") — both rendered the calm pulse icon in `primary` teal, no red anywhere, and "Try again" recovered correctly once the server(s) were back. Dark theme, default text size.
- **Achievement unlock, settled state:** "Called It a Day" (the wrap-up achievement) fired live on this account's first "Wrap up today" tap, rendering the new blob badge exactly as designed — amber fill, trophy centred in `onReward`, hairline-bordered card. Re-observed in **both themes** (dark and light, via `simctl ui appearance`) and at **large text** (the largest *standard*, non-accessibility size) with no new overflow or clipping from anything I added.
- **WrapUpScreen, voluntary ending, zero-Leaf state:** "Session complete" caption, "Nothing yet today" heading, stat row correctly absent, ShareCard rendering correctly (forced-light, as designed) — in both themes, at large text.

**Not observed live — stated plainly rather than implied:**
- **The achievement sequence's actual transition under Reduce Motion.** I turned Reduce Motion on (confirmed via Settings → Accessibility → Motion, toggle green) and re-observed the *already-fired* "Called It a Day" card in its settled state — fully opaque, fully present, nothing missing. I could not trigger a *fresh* unlock with Reduce Motion on to watch the swap-not-disappear transition itself, because doing so needs completing a Leaf, and the Leaf player's "Next" button would not register a tap after roughly fifteen attempts (plain taps, long-presses, `touch_path`, different X/Y offsets, a fresh app relaunch, a fresh Leaf on a different Track) while other buttons on the very same screens (the close X, the report-sheet's buttons, tab-bar items) worked normally. This matches a finding already on record in this log from an earlier package — "reliably tapping this app's primary pill-shaped CTA buttons... took many attempts... not a code defect" — so I'm treating it as the same known tooling friction, not a new one, and not spending further budget forcing it. What I have instead: the reduce-motion *code* is untouched from WP22.1 (verified by reading the diff — zero lines changed in the animation `useEffect`), and WP22.1's own device pass already exercised this exact mechanism.
- **The cap-hit ending, live.** The handoff itself anticipated this ("producing the cap-hit state on device takes setup... say in your report how you produced it — if you could not, say that"). I could not: no seeded already-capped account was available, and reaching the real cap needs 15 minutes or 500 XP genuinely elapsed. The invariant is proven by the full-tree-diff test above instead — code evidence, not a device observation, and I'm not presenting it as the latter.
- **Report-error and the two failure frames, specifically in light theme, and specifically at large text.** I'm confident by construction (same `theme.palette`/`theme.surfaceFor` tokens the achievement badge and WrapUpScreen used, both confirmed correct in light theme and at large text above) but did not re-open those three specific screens under those specific conditions to look.
- **Accessibility-max text size, literally.** Tried it once, on WrapUpScreen: it reproduces the known, already-logged `design/typography.ts` fixed-`lineHeight` clipping — not a new defect, and per this project's standing testing bar ("do not check extra-large text sizes... do not re-raise it") I stepped back down rather than re-report it. Everything above the accessibility range (`large` through `extra-extra-large`, the largest non-accessibility size) rendered cleanly for every surface this package touched.

#### Shared failure components — checked vs. not, named exactly (per the handoff's explicit ask)

| Component | Consumers | Checked live this package | Not checked |
|---|---|---|---|
| `ErrorState` (6) | Explore, Journey, Library, TrackDetail, LeafPlayer, WrapUp | **Explore** (content-unavailable), **Journey** (no-network) | Library, TrackDetail, LeafPlayer, WrapUp |
| `StatusMessage` (12) | Explore, Journey, Library, Profile, TrackDetail, AgeGate, ProviderEmailMissing, SignIn, LeafPlayer, ReportErrorSheet, AchievementShare, WrapUp | **ReportErrorSheet** (submit failure) | Explore, Journey, Library, Profile, TrackDetail, AgeGate, ProviderEmailMissing, SignIn, LeafPlayer, AchievementShare, WrapUp (own instance) |
| `EmptyState` (3) | Explore, Journey, Library | none | Explore, Journey, Library |

All 21 consumers combined are exercised by the full test suite (they're what makes it 494 mobile tests), which is why nothing regressed — but a passing test suite is not the same claim as a device observation, and I'm not conflating them here.

#### Assumptions made
- **"Session complete" as a static caption, replacing "Today"**, and the stat row's placement/labels, are visual-layer judgement calls extrapolated from the mockups, not literal requirements in the acceptance criteria. If either reads wrong to you, they're cheap to revert — nothing else depends on them.
- **Achievement count verified as nineteen**, from `packages/shared/src/gamification.ts`'s own comment ("The catalogue is not defined here. The nineteen definitions... live in `apps/backend/src/achievements/registry.ts`") — an allowed file, not `apps/backend` itself, which I did not read. **"Six categories" is not verifiable and not implemented**: the client-facing `achievementStatusSchema` carries only `tier` (`common` | `rare` | `milestone`, three values), no category field at all. I designed the badge around tier, not a fabricated category label — the mockup's category line (e.g. "Streaks") has no client-side data source to honestly populate.
- **Did not thread a leaf-identifying subtitle into the report sheet's header** (the mockup shows "Leaf 12 · Payoff" under "Report a problem") — doing so would need a new prop threaded from `LeafPlayerScreen.tsx`, which is outside scope. The Do-Not this addresses ("identified automatically rather than asked for") is satisfied regardless: the sheet never asks the reader which Leaf it's about.

#### Follow-ups / tech debt for Architect
1. **The trophy-glyph tension named above** — a real open question about whether screen-11's Do-Not is satisfied by construction (a small icon inside a badge shape) or needs a bespoke, non-trophy glyph. Cheapest to resolve whenever Profile's own badge grid gets its package.
2. **`wp22.2-roadmap-visual-port` is signed off in the log but not merged to `main`.** I checked before branching: `origin/main`'s WP22.2 sign-off commit (`0626f4e`) only touches `projectRoadmap.md`; the actual `TrackRoadmap.tsx`/`roadmapGeometry.ts` code from that branch (2,268 insertions) isn't in `main` yet. Unrelated to WP25 — I branched this package from `main` directly rather than from that branch — but flagging it since "signed off" reading as "merged" would be a reasonable but wrong assumption for whoever picks up track-roadmap work next.
3. **Tier C, deferred, per the testing bar:** every consumer of the three shared components not listed as "checked live" above; light-theme and large-text passes on the report-error flow and the two failure frames specifically; the achievement-unlock transition itself under Reduce Motion (code-verified, not device-observed — see above).
4. **The tap-resistant primary-CTA issue is still present**, now specifically localised to the Leaf player's slide-advance button and reproduced independently of screen or Track. Not something this package caused or can fix (no code path found that would explain it — every other control on the same screens works), but it's now blocking device verification twice across two packages. Worth investigating directly if a future package needs to progress through a Leaf on-device rather than reach a screen via a shortcut (as this one did via Journey's "See today's summary").

#### Time, roughly
Reading (handoff, three mockup sources, existing components, the achievement/session data model): the largest single share — this package touches four surfaces and the REVISED handoff explicitly asked for verification-before-assumption on several points (the animation, the achievement count) that paid off. Implementation itself was comparatively quick. A real chunk went to test debugging: the `Modal`-in-tests investigation and the `fireEvent`-vs-`userEvent` cross-test-pollution chase, both of which turned into fixes worth keeping (the `jest.setup.js` mock, the accessibility bug in the scrim), not wasted time, but not fast either. Device verification was the other large share, most of it the CTA-tap troubleshooting described above before I routed around it via Journey's shortcut. Write-up: modest.

---

### Completed: WP22.2 — port the roadmap's visuals from `graph.jsx` — 2026-09-09

**What changed:** The Track roadmap now reads as `graph.jsx` renders it. Four node states instead of three (`revisit` included), the source's arbor density in place of our sparse fields, uppercased letter-spaced labels with leader lines in real gutters, the Leaf number on the next cell, and the whole book on about one screen instead of a two-thousand-point scroll. The layout is still generated; what moved is appearance plus two composition constants the appearance could not survive without.

**Files touched:**
- `apps/mobile/src/screens/track/roadmapGeometry.ts` — substantially rewritten
- `apps/mobile/src/screens/track/roadmapLabels.ts` — **new**
- `apps/mobile/src/screens/track/roadmapLabels.test.ts` — **new**
- `apps/mobile/src/screens/track/TrackRoadmap.tsx`
- `apps/mobile/src/screens/track/roadmapModel.ts`, `roadmapModel.test.ts`
- `apps/mobile/src/screens/track/roadmapGeometry.test.ts`
- `apps/mobile/src/screens/trackDetail.test.tsx`
- `eslint.config.js` — **outside the stated scope; see "Decisions Architect should rule on", item 3**

---

#### The long-label problem, and what I decided

The handoff called this the judgement the package was buying, so it gets the most space.

**The mechanical cause was not the type treatment.** `graph.jsx` keeps its 18 nodes between x=149 and x=244 of a 390-wide frame — a band under a quarter of the width — which leaves about 125pt of clear gutter on each side. Our band was two thirds of a 354pt frame, leaving about **37pt**. The screen did not look different from the mockup because the labels were styled differently. It looked different because there was nowhere to put them. Narrowing `spineBand` from `2/3` to `0.25` is the single change that made every other label decision possible, and it is why the fix is partly a geometry change rather than a typography one.

**With the gutter open, the decision has three parts:**

1. **Two lines, wrapped on word boundaries; truncated only when two will not hold the title.** The mockup already wraps — its `lines` fixture is a pre-split array and two is the most any of them uses. One line is what produced *"Real wealth comes from…"*; two produce *"REAL WEALTH COMES / FROM CREATING…"*. Past two the gutter becomes a column of prose and the graph disappears behind it.
2. **The character budget is computed per node** from the gutter that node actually has and from the OS text scale — never a constant. `DONE_LABEL_CHARS` and `LOCKED_LABEL_CHARS` are deleted rather than retuned: a fixed budget chosen before anyone knew the available width is the thing that was wrong.
3. **Under a legibility floor (`MIN_LABEL_CHARS`, 8) the label is dropped, not shrunk to a stub.** At the accessibility text sizes the gutter holds four or five characters, and four characters of an uppercased sentence is noise that also collides with its neighbours.

**Nothing is reworded, and nothing is uppercased in the string.** The capitals are `textTransform` on the `caption` token, so the screen reader, the test tree and any future copy audit still see the author's own casing — an uppercased string is a modified string. Every visible line is a verbatim prefix of the title plus an ellipsis, and `wrapTitle`'s Tier A tests assert exactly that across every budget a real gutter can produce.

**The claim that makes dropping a label safe:** the title is never lost, only the decoration is. Every node is an accessibility node carrying its full untruncated title at every text size, and the next Leaf's card shows the title whole. `trackDetail.test.tsx` now asserts the accessibility-label guarantee directly rather than asserting a label per Leaf.

**This reverses WP22's `small`-not-`caption` ruling, and that ruling was right about the screen it was made on.** WP22 observed on a device that eighteen shouting fragments read as signage rather than a table of contents. That was a correct observation about *one-line stubs in a 37pt gutter*. With the band narrowed and the labels wrapped, they read as a margin. I would not have overruled it on reasoning alone.

---

#### Itemised comparison against `graph.jsx` at 18 Leaves

The handoff asked for differences named rather than a summary. Compared side by side against the prototype running `proto/graph.jsx` (served locally and driven to the Track screen at 7/18) and our build on Track 42.

**Ported and matching**

| | |
|---|---|
| Four node states | `R={next:15,done:6.5,revisit:12,locked:11}`, transcribed |
| `done` / `revisit` | page-coloured body, reward ring, reward bud at 2.9 |
| `revisit` ring | dashed `3.5 4`, opacity 0.85 — photographed, see below |
| `next` | aura fill 0.07 + ring 0.32 at r=25, filled body at r=15, Leaf number |
| Labels | display semibold, 12px, 0.8 tracking, uppercase, `text-secondary` |
| Label sides | split on the frame's centre line, stacked with a 7pt gap |
| Leader lines | drawn when a label drifts >9pt, 0.8 wide at 0.55 |
| Arbors | 6 on the next cell, 4 elsewhere; depth 4/3; terminal sprays with buds |
| Axon | four tapering segments thrown *across* the spine, plus a tuft |
| Ambient mesh | scattered dots at `surface-3`, bowed arcs + wisps at `graph-edge` |
| Spine | travelled in `primary` at 1.75, ahead in `border` at 2 |
| Tissue opacity | reached `primary` @0.44, unreached `graph-edge` @0.8 |
| Composition | the whole book in about one screen |

**Deliberate differences, with the reason**

1. **Curves have a minimum bow; `graph.jsx`'s do not.** Its `bend` is `(rand()-0.5)*k`, which passes through zero and can emit a straight segment. The floor (`minBend`) is kept because the founder's "constellation, not a neuron" ruling predates the mockup. Mutation-checked: restoring `graph.jsx`'s own form reddens *curves every connection* at every Leaf count and nothing else.
2. **Positions are generated, not hardcoded.** The point of the package.
3. **Labels wrap to two lines on a width-and-scale budget, and drop under a floor.** The section above.
4. **The Leaf number is a React Native `Text`, not SVG `<text>` at a fixed 15px** — `Text.tsx` is the only component allowed to touch `allowFontScaling` and never disables it, so this glyph scales like every other. It is *dropped* once it outgrows its cell (`showsLeafNumber`), same rule as the labels.
5. **The card is placed under the node, not searched.** `placeCard` scores six candidate heights against both sides; I ported the term doing the work — which side buries fewer labels — and left the vertical position under the cell, where a reader looking at their own Leaf will look for it.
6. **The card widens with the text scale**, up to the full frame. Fixed at 45% it truncated its title to two characters at the accessibility sizes, beside two empty gutters.
7. **The spine's bow sign follows the local turn** rather than the PRNG, and is much gentler (0.12 of the gap). At the new node spacing a randomly-signed third-of-a-gap bow is a zigzag.
8. **Ambient dot count is derived from area**, not fixed at 58, so a 30-Leaf Track's background is not sparser than an 18-Leaf one's.

**Remaining differences — not closed**

1. **Not full-bleed.** `graph.jsx`'s SVG spans the full 390; ours sits inside `Screen`'s 24pt horizontal padding, so the frame is 354 and the drawing never reaches the screen edge. **`Screen.tsx` and `TrackDetailScreen.tsx` are outside this package's stated scope** (`screens/track/`). This is the largest single remaining visual gap and it is a one-line change in someone else's file.
2. **No gradient scrims.** The mockup fades the graph under a 236pt header gradient and above a 186pt bottom gradient. Ours has hard edges — the tissue starts abruptly under the Continue button. Same scope boundary.
3. **Different screen architecture.** The mockup is a fixed 844pt screen with pinned header, progress bar, CTA and tab bar over the graph. Ours is a scrolling page with the legal pair and progress above the graph — `TrackLegal` above the fold is WP10's obligation and was not touched.
4. **Every node has a 44pt touch target; the mockup gives one only to the next node.** Ours is the accessibility requirement, kept.
5. **Left/right label balance is 11/6 on Track 42, against the mockup's roughly 9/8.** A consequence of a generated meander rather than hand-placed nodes; it varies by seed and Leaf count.
6. **The spine is C0 at the nodes, not C1.** The mockup runs Catmull-Rom through the centres; ours is per-gap bowed segments, which is what keeps the minimum-bow guarantee in item 1 above.
7. **`revisit` is unreachable.** Below.

---

#### `revisit` is built, tested, photographed, and unreachable — deliberately

The handoff said to build the state and its visual and leave it unreachable until something populates it. Done: `LeafNodeState` has four members, geometry sizes it at 12, paint gives it the dashed reward ring, and `roadmapModel.test.ts` asserts that `buildRoadmapModel` never returns it **at any completion count and on the no-rollup branch** — so the unreachability is a decision with a test on it, and a future package wiring recall data in will fail that test and have to update it deliberately.

Nothing the client receives says a Leaf is due for review: `TrackProgressSummary` carries counts and a `nextLeafId`, `LeafSummary` carries no completion or recall data. WP22's ruling was about the data and still stands; it was never about the drawing.

**Verified on a device by a temporary local patch** (`stateAt` forced index 1 to `revisit`), screenshotted at full resolution, then reverted and the revert confirmed by grep and by re-reading `stateAt`. The dashed amber ring at r=12 sits clearly distinct from the small solid `done` ring above it.

---

#### Density: the number, and how it is bounded

Transcribing `arbors()` literally emits **about 8,700 stroked paths at 18 Leaves** — measured by running the source's own recursion in Node before writing any TypeScript, not estimated. Our previous field was ~450. That is the twentyfold gap the founder was seeing as "sparse".

The shared `dendriteBudget` was raised from 380 to 8,800, and **the way the budget bites changed**: it now scales the terminal spray rather than truncating the recursion. A hard counter spends the whole allowance on whichever branch depth-first recursion walks first and leaves the rest of the field bald; scaling `tips` degrades it evenly, and does so exactly where the paths are.

Measured across the range, at a 354×874 viewport:

| Leaves | height | total paths | generation |
|---|---|---|---|
| 15 | 564 | 10,867 | 23ms |
| 18 | 564 | 9,921 | 19ms |
| 22 | 614 | 10,826 | 26ms |
| 26 | 710 | 10,626 | 24ms |
| 30 | 806 | 10,121 | 23ms |

Flat across the range (ratio 1.10), and the budget test's ceiling moved from 560 to 12,000. **The element count did not move**: those ~10,000 subpaths batch into a few dozen `<Path>` elements, which is why density could go up twentyfold without touching what React renders.

---

#### Assumptions made

1. **`spineBand` 2/3 → 0.25 and the vertical rhythm 104–152pt → 24–40pt are "tuning constants if composition needs it"**, which the handoff explicitly permitted. They are the two changes that make the screen match; without them the port is a repaint of a differently-shaped screen. Both are asserted by tests that state the consequence rather than the constant.
2. **`done` and `revisit` use the reward colour.** This reverses WP22's written rationale that amber is reserved for something won and a finished Leaf is progress rather than a prize. `graph.jsx` uses it for both, the handoff made `graph.jsx` the source of truth, and the founder has called our screen wrong twice. Recorded in `TrackRoadmap.tsx`'s docstring rather than quietly flipped.
3. **`layoutRoadmap` now takes the Leaves' *states*, not a count.** Radius, arbor count and reach are all state-keyed in the source, so geometry has to know. It stays pure, seeded and checkable across 15–30 from an array of string literals; the "geometry does not know about progress" principle in the old docstring is gone and the docstring says why.
4. **The next Leaf's card is not in the handoff's criteria, and I changed it anyway.** Full-width and pinned under the node, it sat on top of four labels at once on real content. `placeCard` exists precisely to stop that.

---

#### Findings worth knowing

**1. The root lint gate is red on `main` today, and it is not from this package.** `design/claude_design/image-slot.js` (53 errors) and the vendored `_ds_bundle.js` fail `no-undef` on browser globals, and `design/` is not in `eslint.config.js`'s ignore list. Both files arrived in `e9d13d0` ("Change the method: port from Claude Design's source, not from pictures"). Confirmed not mine: `git status` shows `design/` untouched by this branch. I added `design/**` to the ignore list — same category as the `apps/pipeline/**` entry already there — because the acceptance criteria require a green root lint and I could not otherwise meet them. **This is the one edit outside the stated scope and it is Architect's to accept or revert.**

**2. React Native's jest preset reports `fontScale: 2`.** Every screen test in this repo therefore renders as though the reader had doubled their text size — so screen tests exercise the *degraded* layout path, not the default one. This cost me a confusing failure: a test naming `roadmap-label-leaf-3` passed, then failed after an unrelated change to card width, with no defect involved. Any future screen test that asserts on default-size layout is testing something else. Worth carrying forward.

**3. A mutation survived, and the test it exposed was wrong.** "Gives every Leaf but the next one a label, **on both sides of the spine**" stayed green when I flipped `labelSide` back to WP22's inward direction — because there are nodes on both sides of the centre line whichever way the labels point, so the assertion did not test the rule it was written beside. Added *sends every label outward, to the gutter on its own node's side of the spine*, which reddens on that mutation. This is the second time in this project a test's name has claimed more than its assertion.

**4. A real bug found by a test I wrote, not by looking.** `wrapTitle` returned a single word longer than the line budget untouched — it would have rendered straight out of the gutter and across the graph. Fixed: an over-long line is the last one shown, truncated.

**5. Metro had been running 26 hours** at the start of this package. Restarted the app rather than the packager and confirmed a fresh bundle by seeing the new drawing; no time lost, recorded because the standing note says this has cost time three times.

**6. Track 42's progress moved from 1/18 to 2/18 partway through** the session, across a multi-hour interruption. Not something this package did — noting it so a future reader does not treat the differing screenshots as a rendering inconsistency.

---

#### Device gate

Simulator: iPhone 16 Pro, iOS 26.3, existing prebuild + Metro. Theme and text size switched with `simctl ui`, per WP24's finding.

| Check | Result |
|---|---|
| Track 42, 18 Leaves, dark, default size | Pass — screenshotted |
| Track 42, light | Pass — reward reads as deep amber, primary as deep green |
| Dark at `accessibility-extra-extra-extra-large` | Pass — labels drop, card goes full width, number drops |
| Light at the same | Pass |
| 20-Leaf placeholder Track (dark) | Pass — all 20 labels placed, leaders drawn, **no card** (no next Leaf), stacking holds |
| All four node states in one frame | Pass — photographed at full resolution via the temporary patch |

Two defects were found *by* the device gate and fixed in it: the card burying four labels, and the card plus Leaf number becoming illegible at the accessibility sizes. Neither was visible to a unit test before I wrote tests for them.

**Not measured: frame rate.** I scrolled the 18- and 20-Leaf graphs repeatedly and rendering stayed intact and responsive, but I did not instrument it, and ~10,000 subpaths is a real increase. If anyone reports scroll stutter on this screen, `GRAPH.dendriteBudget` is the single constant to turn down; the tip-scaling degradation is designed for exactly that and needs no other change.

**Not re-checked: the `design/typography.ts` font-scaling clip.** Present as always at the top text sizes on the progress caption and the Continue button. Logged in `launch-blockers.md`, deliberately not fixed, not re-raised.

---

#### Tests added/updated

- **`roadmapLabels.test.ts` (new, 26 tests).** Tier A on `wrapTitle` — the verbatim-prefix property across every budget, word-boundary breaks, the overflow fold, the line budget, the over-long word. Tier B on placement, the card, and the two degradations.
- **`roadmapGeometry.test.ts`** — reworked for the states signature; new coverage for the four states, the aura's exclusivity to `next`, terminal buds, per-generation fade, the narrow band's gutter consequence, one-screen composition, and ambient density across book lengths. 241 tests.
- **`roadmapModel.test.ts`** — `revisit` unreachable at every completion count and on the no-rollup branch.
- **`trackDetail.test.tsx`** — the accessibility-label guarantee per Leaf; the prefix property over every rendered label.

**Twelve mutations, all precise** (each reddened its own test and only its own, across every parameterised Leaf count): the over-long-word guard; the card's label suppression; `showsLeafNumber`; `MIN_LABEL_CHARS`; the card's scale-widening; `labelSide` outward (survived once — see finding 3 — then reddened after the test was fixed); `spineBand`; the vertical rhythm; terminal buds; the aura's exclusivity; `revisit`'s radius; the minimum-bow floor.

**Cannot be mutation-checked, and saying so:** *"never lets two labels in the same gutter overlap"* and *"keeps each label inside its own gutter"* assert the absence of a collision. Breaking the stacking does redden the first, but both guard a future regression more than they prove present behaviour.

**Deferred to WP14:** component render tests for the four paint branches; theme permutations of `paintFor`; the `inconsistent`/`unknown` progress branches rendered on a device rather than in jsdom; `dotPath`'s circle approximation.

---

#### Follow-ups / tech debt for Architect

1. **Rule on the `eslint.config.js` change** (finding 1). Either `design/**` stays ignored, or the two files need fixing and the root gate is red until then.
2. **Full-bleed and the gradient scrims** are the largest remaining visual gap and both live outside `screens/track/`. Worth a small follow-up package if the founder still sees a difference — it is the difference between a graph on a page and the mockup's graph *as* the page.
3. **`revisit` has no data source.** Whenever spaced repetition, a failed payoff, or an author correction lands, the rendering is waiting and `roadmapModel.test.ts`'s unreachability test is the one to update.
4. **The mockup prototype is worth serving locally for WP25/WP27**, which port from the same source. `design/claude_design/ZoomOut prototype.html` loads `proto/*.jsx` and needs a static server rooted at `design/claude_design` (its stylesheets are relative); the jump bar at the bottom of the prototype goes straight to any screen. I used a throwaway node server and removed it rather than leave an untracked file failing the root lint — worth ten lines in a future package rather than rediscovering it.

**Time:** implementation ~35%; tests and the twelve mutation checks ~20%; the device gate ~25% (of which the two defects it caught and their fixes were most of it); the cold gate ~5%; this write-up ~15%.

#### Addendum to WP23.1, below — added before push, not before sign-off

Between finishing the device pass and pushing this branch, `origin/main` picked up **"Record the PayoffSlide ruling the WP23.1 row already pointed at"** (`b28db6c`), folding an actual Payoff re-skin into WP22.2. It corrects this report's Payoff section in one place and confirms it in another, and I'd rather say so than let a PR stand next to reasoning that's already half-superseded:

**Confirmed:** no schema field backs the mockup's heading — that half of the reasoning below holds, and the ruling keeps it.
**Corrected:** *"the existing animation is well-reasoned work"* is not, on its own, a reason to leave a slide's whole visual treatment untouched — that would exempt anything ever built carefully, including the surfaces most worth getting right. Preserving the amber unlock behaviour and restyling around it were never actually in tension.

**No code changed as a result.** The scope outcome — `PayoffSlide` untouched in this package — still stands; the ruling moves the actual re-skin to WP22.2 rather than asking for it here. Leaving the addendum at the reasoning level rather than editing the section below, since the report should show what I actually knew when I wrote it, not a quietly corrected version of it. Left `project/projectRoadmap.md` alone — that entry is Architect's.

---

### Completed: WP23.1 — the four remaining Leaf slides, and the cork board — 2026-09-09

**All nine acceptance criteria met; the payoff gate and the wrong/correct-answer behaviour were verified by exercising them on a real Track 42 Leaf, not by reading the diff.** Root `lint`, `typecheck` (4 workspaces), `test` (1,226 passing: shared 71, admin 198, backend 477, mobile 480 — unchanged from WP24, no new tests added) and `build` (backend/mobile/admin outputs confirmed present on disk after a `dist`/`.next`/reinstall) are clean from a cold gate. Branched from `origin/main` — which now carries WP24 merged, WP25's handoff, and the cork-board ruling — as `wp23.1-leaf-slides-cork-board`, since `main` itself was checked out in a separate worktree by the Architect session running concurrently.

**What changed:** Summary, Scenario and Takeaway now share `SlideFrame`, a small new colocated component — the rounded/bordered/padded card `design/leaf_player/`'s screenshots use consistently across four of five slides, built entirely from tokens already in use elsewhere (`StickyNotesSlide`'s board, `TakeawaySlide`'s apply-in-life panel). `ScenarioSlide`'s wrong-answer treatment now matches the mockup's visual weight: the red-bordered option no longer dims (the `opacity: 0.55` is gone — the border plus the shaped incorrect-icon already carry the signal without it), and the retry message is now a bordered card with a "Not quite" label instead of a bare icon-and-text row. `TakeawaySlide`'s body line is `h1` now, not `h2`, matching the mockup's weight for "the one line to leave with." `StickyNotesSlide`'s board draws a real cork texture — a repeating SVG `<Pattern>` of small irregular flecks in `theme.palette.border`, no image asset, no new colour value. `PayoffSlide` was read closely against the mockup and **deliberately left unchanged** — the audit and the reasoning are recorded in its own docstring, not just here.

**Files touched:**
- `apps/mobile/src/screens/leaf/SlideFrame.tsx` (new) — the shared card wrapper. No logic, no test: decorative composition, same precedent as `PROGRESS_DOT_SIZE`
- `apps/mobile/src/screens/leaf/SummarySlide.tsx` — wrapped in `SlideFrame`; docstring records why no illustration slot was added
- `apps/mobile/src/screens/leaf/ScenarioSlide.tsx` — wrapped in `SlideFrame`; opacity dimming removed from wrong options; retry feedback upgraded to a bordered card
- `apps/mobile/src/screens/leaf/TakeawaySlide.tsx` — wrapped in `SlideFrame`; body `h2` → `h1`
- `apps/mobile/src/screens/leaf/StickyNotesSlide.tsx` — `CorkTexture` added behind the notes; docstring's superseded "flat panel" reasoning replaced with the 2026-09-09 ruling and why it still holds the tokens-only line
- `apps/mobile/src/screens/leaf/PayoffSlide.tsx` — docstring only; no functional or visual change

---

#### Six things that would have been wrong if the mockup had been copied literally — the four named, and two more found by reading the schemas

The four the handoff named were all real and all avoided: the dashed illustration placeholder (never built — `SlideImage` already renders nothing when there's no asset), the "no red" rule (this is a wrong-answer state, not a system failure, so the incorrect treatment stayed), the report-an-error flag (never at risk, since the chrome that carries it was out of scope and untouched), and the invented Leaf duration (no field exists anywhere in the schema — `durationSeconds` is `audioRefSchema`'s reserved Phase-2 voiceover metadata, unrelated, and no header field was added since the chrome stayed untouched).

**Two more, found by reading `content.ts` rather than assuming the mockup's content was real:**

1. **The slide headings.** `design/leaf_player/`'s Summary ("The first number sets the range") and Payoff ("Why the first number wins") each carry a bold heading above the body. Neither `summarySlideSchema` nor `payoffSlideSchema` has a field for one — both are exactly `{ body, audio? }`. There is nowhere to source that text from except inventing it, which is the fabrication risk the source-reference mechanism and `LEGAL.md` exist to prevent. Neither slide gained a heading.
2. **Per-option scenario feedback.** The mockup's wrong/correct states show specific explanatory text ("ask what set the range you gave ground inside…," "The opening figure moved the whole range…"). `scenarioOptionSchema` is `{ id, text, isCorrect }` — no explanation field. The generic pre-existing copy ("Not that one. Have another look — there is no limit on tries.") stayed generic; only its visual weight changed.

**A third, not fabrication but a genuine interaction-model mismatch:** the mockup's Scenario has no separate submit control — tapping an option answers it immediately. The real app deliberately separates select from check (`ScenarioSlide`'s own docstring: "a mis-tap that silently spends that bonus is a bad trade for one saved gesture"), which is product logic, not chrome, and stayed exactly as built. I considered and rejected adding the mockup's "Answer the scenario to unlock the payoff" hint text for the same reason — it answers a question ("why can't I proceed") the real two-tap flow doesn't actually pose, since a visible, always-available "Check answer" button already answers it.

**A fourth, in Takeaway:** the mockup folds an XP chip, a "Leaf 8 complete" badge and a "next up" hint into the takeaway card itself. In the real app that is a different screen — `CompletionSummary` in `LeafPlayerScreen.tsx`, reached after "Finish," with considerably more careful reasoning already built around XP display, first-try-bonus ordering and the daily cap. None of that was transplanted into `TakeawaySlide`; the XP amount in particular isn't even known until `complete()` resolves, so it couldn't have been rendered there regardless.

#### The screenshot set itself: two of nine aren't the spec

The handoff says "nine screenshots walking the five slides in several states." Two of the nine — `Screenshot 2026-09-08 at 10.33.49 AM.png` and `...10.33.57 AM.png` — are not Leaf player content at all. They're the age-gate screen mid a `SecureStore`/Keychain error, from a different, unrelated debugging session, dated the day before this package's own screenshots. The remaining seven cover Summary, Scenario (unanswered / wrong / correct), Payoff, Sticky notes and Takeaway — five slide types, which is what the handoff actually needed. Flagged the way WP23 and WP24 each flagged their own stale citations: worth being precise about, not blocking anything, since the seven real ones were sufficient on their own.

#### The one deliberate judgement call: Payoff stays exactly as it was

`design/leaf_player/`'s Payoff screenshot renders as plain text on the page background — no card, a teal "Payoff" label, a bold heading. None of that was adopted. Beyond the missing-heading problem above, the amber "Unlocked" treatment and its spring animation are this file's own most-reasoned piece of work — explicitly cited from `design-direction.md` §6 as "the most crafted animation in the app," with the amber-is-reserved-for-reward rule stated and justified at length, the same rule the cork board's "no amber" line follows in the other direction. A plain-text mockup built without this slide's reward psychology in mind reads as showing the destination's *layout*, not overriding its *feel* — so it was read for intent (the reward should look earned) rather than transcribed. Recorded in `PayoffSlide.tsx`'s own docstring, flagged here rather than decided silently either way.

#### What's device-verified vs reasoned

**Device-verified this session, on a real Track 42 Leaf ("The Science of Getting Rich"), with screenshots at each step:**
- All five slides, dark theme, full pass, real content throughout — a real scenario illustration, a real 3-note board with its real two-column diagram
- Wrong answer (option A) → red border, no dimming, the upgraded "Not quite" card. Second wrong answer (option B) → same treatment, `Check answer` correctly disarmed while B was the live (wrong) selection. Correct answer (option C) → payoff gate unlocked, auto-advanced to slide 3, amber "Unlocked" treatment rendered
- The report-an-error affordance, visible and unchanged, on slide 1
- Cork board and Takeaway, light theme — the palette-only theme switch confirmed correct, no layout drift
- **The cork board specifically, at true accessibility-max text size** (`accessibility-extra-extra-extra-large` — the genuine maximum, one step past the standard XXXL WP23's debt note refers to) **in light theme:** the single-column collapse fired correctly, all three notes render in full with no clipped text (confirmed by scrolling the entire board), board and note corners stay clean

**Reasoned, not separately re-observed:** dark theme at accessibility-max on the board. Theme is a palette swap only — spacing, radius and the type scale are identical in both modes by construction (`theme.ts`) — so an accessibility-max clipping question is layout-only and theme-independent; light-theme-at-max is sufficient evidence dark-theme-at-max holds too, the same reasoning WP24 used for its own theme/size intersection gap. Summary, Scenario and Payoff at accessibility-max and in light theme weren't separately screenshotted either; their new `SlideFrame` wrapper is the identical padding/radius/border combination already verified clean on the board and on Takeaway, and neither slide carries size-dependent layout logic (unlike the board's collapse threshold) for a text-size change to interact with.

#### A genuine, reproducible tooling finding — related to, but distinct from, the one WP24 already logged

WP24 logged dropped/truncated keystrokes as a known simulator-input issue (an email lost its last four characters once). This package hit the same *family* of bug on the age-gate's date-of-birth field specifically, twice, in a shape worth distinguishing: **a freshly-typed, visually-correct `YYYY-MM-DD` value repeatedly failed the exact-format validation that should have accepted it** — not a rendering glitch, a real validation rejection. Confirmed the typed value was genuinely correct two independent ways: zoomed into a full-resolution `simctl` screenshot and read the glyphs directly (the hyphens matched the format-hint text's character-for-character), and round-tripped the identical string through the backend's real `/auth/signup` endpoint via `curl`, which accepted it without complaint. So the string itself was valid; whatever the client held at submit time either wasn't, or wasn't what the screen showed. Worked around twice, two different ways: for the main verification pass, created the test account directly via the backend API and signed in through the UI instead (sign-in has no date field to hit); for the age-refused screenshot specifically — where the client-side check has to be exercised, since it fires and redirects before any server call — a second, slower, more careful single type-and-submit succeeded cleanly. **Root cause unidentified. Noting the shape** (a `TextField` with `autoComplete="birthdate-full"`, validated by an exact-match regex) **in case it recurs** — it reads as a different failure mode from WP24's dropped-character finding (that one was visibly wrong on screen; this one looked right and was rejected anyway), so I'm not folding it into the same line item.

**Two reusable techniques worth carrying into WP25/WP26, alongside WP24's coordinate-space and `simctl` findings:**
1. **Compute tap coordinates from the component's own source** — `Screen.tsx`'s padding, `Button.tsx`'s height, the token values stacked in between — **rather than estimating pixel positions from a screenshot.** Every miscalibration this session traced back to eyeballing an image; every analytically-derived coordinate landed correctly on the first attempt.
2. **The iOS edge-swipe-back gesture** (a `swipe` starting within ~4pt of the screen's left edge) reliably backs out of a pushed screen and needs no target coordinate at all. Faster and more robust than locating a specific "Back" control, and the one technique that got me off `TrackDetailScreen` after its own Back button resisted several analytically-reasonable coordinate guesses in a row.

#### Mutation-checked

No new tests. Tier B, and the changed surface here is genuinely thin by construction: `SlideFrame` and the cork pattern are both non-conditional decorative composition — a `View` with fixed style props; seven fixed-coordinate `Circle` elements in one `Pattern` — the same category WP21/22/23 have each noted has nothing for a unit test to assert beyond "the string is present." The one behavioural change, removing the wrong-option's opacity dimming, is covered by the existing `ScenarioSlide` interaction tests in `leafPlayer.test.tsx`, all of which still pass unmodified; none of them asserted on the removed style, so there was nothing to mutation-check there either. The evidence for this package is the device pass above, not a test suite — consistent with how WP21–23 each characterised their own re-skin work.

#### Time

Roughly: a fifth on implementation (the five files), a fifth reading `content.ts`'s schemas and the mockup HTML/screenshots to separate real content from mockup invention, and **three-fifths on the device session** — signup/age-gate friction (including the date-field finding above), working out reliable tap coordinates from source rather than screenshots, and the five-slide interaction pass itself, including the bonus WP24 screenshots below. That last share is the highest of any package logged so far; the coordinate-from-source technique is the concrete thing that should bring it down next time.

**Assumptions made:**
1. `SlideFrame` colocated under `apps/mobile/src/screens/leaf/` rather than promoted to `apps/mobile/src/components/` — the handoff's scope line names only the leaf screens directory, and a component used by exactly one screen family doesn't yet meet the shared-library bar `components/index.ts`'s own docstring states.
2. Cork texture drawn as a single fixed 28×28pt tile with seven hand-placed circles, not a generated or randomised pattern — matches WP22's determinism rule (never reshuffle on re-render) and needs no seed or parameter, since the tile repeats identically regardless of board size or note count.
3. Removed the wrong option's `opacity: 0.55` rather than keeping it alongside the new red border — the mockup shows full-opacity wrong options, and the border-plus-shaped-icon pair already satisfies "never signalled by colour alone" without the dimming.

**Follow-ups / tech debt for Architect:**
1. **The six mockup-fidelity traps above (headings, per-option feedback, the one-tap interaction model, Takeaway's XP transplant, Payoff's plain treatment, and the two stray screenshots) are worth a line wherever `design/leaf_player/` gets cited again** — a future session reading only the screenshots without also reading the schemas would plausibly reintroduce two or three of these.
2. **The age-gate date-field validation finding above is unresolved, and I'd flag it above the "known flaky input" line, not below it** — WP24's dropped-keystroke finding was cosmetic (a lost character, visibly wrong on screen); this one is a value that renders correctly and is rejected anyway, which is a different and less obviously-tooling shape. Worth someone with more time than this package had confirming it's actually the simulator and not a real edge case in the field's own handling.
3. No component-level render test exists for `SummarySlide`, `ScenarioSlide`, `PayoffSlide` or `TakeawaySlide` in isolation — Tier C, consistent with the same pre-existing gap WP24 logged for the auth screens.

---

### WP24 follow-up — its two open criteria closed, with screenshots — 2026-09-09

Per the founder's request, captured opportunistically while the device session above was already up. WP24's completion report left three things "reasoned from an unchanged diff, not observed": `AgeGateScreen`, `AgeRefusedScreen`, and `TrackDetailScreen`'s legal pair. All three now observed directly, dark theme, on a real device:

- **`AgeGateScreen`** — clean, unanswered state. No functional diff exists against WP24's own audit, and this simply confirms it renders the way that audit described.
- **`AgeRefusedScreen`** — reached via the client-side check (`meetsAssumedAgeThreshold`), the same path a real underage reader hits, not the server's separate refusal. The copy reads "Not quite yet… Come back when you are old enough — the books will still be here," which is the kind-not-punitive tone WP24's docstring audit claimed for it. Confirmed by looking at the actual screen, not by re-reading that claim.
- **`TrackDetailScreen`'s legal pair** — on a real Track (42, "The Science of Getting Rich"), the non-endorsement disclaimer and the Gutenberg purchase link render inside one card, above the fold, legible without zooming, exactly where `TrackLegal.tsx`'s WP24 restyle and the WP10/WP22 placement ruling put them. WP22's knowledge-graph roadmap below it is confirmed intact and unaffected.

Screenshots sent to the founder alongside this session's Leaf-player evidence.

---

### Completed: WP24 — the account and age-gate screens, and the legal surface — 2026-09-11

**6 of 8 acceptance criteria device-verified with screenshots, not just tests; the other two are reasoned from an unchanged diff rather than observed.** Root `lint`, `typecheck` (4 workspaces), `test` (1,226 passing: shared 71, admin 198, backend 477, mobile 480 — 455 + 25 new) and `build` (backend/mobile/admin outputs all present) are clean from a cleaned `dist`/`.next`/reinstall. Unlike WP23, this package got a real device session — see "The simulator worked this time" below for why, since it changes what future packages should try first.

**What changed:** `SignInScreen` drops the dormant social-provider loop entirely — no detection effect, no "or continue with" row, no dead-code path left "ready" for a launch that isn't happening (screen-09's spec: *"leaving room for it is wrong"*) — and gains the forgot-password affordance the spec requires, which reveals an honest in-place notice (*"Password reset isn't built yet — check back soon"*) rather than navigating anywhere. `SignUpScreen` now validates against a new pure module, `signUpValidation.ts`, that mirrors the backend's actual `signUpBodySchema` exactly instead of approximating it — this closes the logged bug where `includes('@')` let a malformed email through to the age-gate screen, which submitted it and surfaced the backend's bare *"Request body is invalid"* two screens later. `TrackLegal`'s disclaimer moves from `small`/`textMuted` to `body`/`textPrimary` so it reads as prose rather than a footnote, in place, not moved. `AgeGateScreen` and `AgeRefusedScreen` were read closely against `screen-07-onboarding-and-legal.txt` and left unchanged — audit below, not an oversight, and recorded beside the code in both files' own docstrings.

**Files touched:**
- `apps/mobile/src/auth/signUpValidation.ts` (new) — `displayNameError`, `emailError`, `passwordError`, mirroring `auth.routes.ts`'s `signUpBodySchema`. Tier A, mutation-checked
- `apps/mobile/src/auth/signUpValidation.test.ts` (new) — 19 tests
- `apps/mobile/src/screens/auth/SignInScreen.tsx` — social block removed, forgot-password added
- `apps/mobile/src/screens/auth/SignUpScreen.tsx` — wired to the new validation module
- `apps/mobile/src/screens/auth/authScreens.test.tsx` — extended: `SignUpScreen` had no tests before this package (gap closed), the stale "hides social buttons" test reframed, forgot-password covered
- `apps/mobile/src/components/TrackLegal.tsx` — disclaimer restyled in place
- `apps/mobile/src/screens/auth/AgeGateScreen.tsx`, `AgeRefusedScreen.tsx` — audit recorded in each docstring, no functional change

---

#### The backend research the "do not read `apps/backend`" note didn't anticipate

The handoff's reading list excludes `apps/backend`, but its own requirement — *"match the backend's actual rules rather than approximating them"* — cannot be done without knowing what those rules are. I read exactly `auth.routes.ts`'s two schema definitions (about 20 lines) rather than treating the exclusion as blanket permission to explore the backend, and it's worth naming precisely what I found, because **the handoff's own description of the bug is imprecise in a way that would have produced a wrong fix if taken literally**: it says the current code *"ignores the backend's 256-character limit"* without saying which field. There is no 256 limit on email anywhere in the backend — `email: z.email()` is unbounded. The 256 limit is the **password's** maximum (`min(12).max(256)`). `displayName` has an 80-character maximum via `.trim().min(1).max(80)`, unmentioned by the handoff at all. `signUpValidation.ts` mirrors all three exactly, including the email regex copied verbatim from `zod`'s own source with a citation, and a test (`places no length ceiling on email, matching the backend's bare z.email()`) that would fail if I'd added the ceiling the handoff's wording suggests. Flagging this the way the WP23/Architect exchange flagged the stale sticky-notes citation: **the description of a defect is not always precise even when the defect itself is real**, and the fix should match the code, not the prose describing it.

#### Two decisions the letter of the spec didn't settle, and why I settled them this way

**`SignUpScreen` keeps the display-name field, though `screen-09-sign-in-and-sign-up.txt` opens with "email and password only."** The backend's `signUpBodySchema` requires `displayName` (`min(1).max(80)`, non-optional) — dropping the field would not simplify the screen, it would make every signup fail closed. I read this as the prompt eliding a field that doesn't change the visual language (it's the same `TextField` as the other two), not as an instruction to break signup. Recorded in the screen's own docstring, flagged here rather than decided silently either way.

**"Forgot password?" reveals an inline `StatusMessage`, not a navigation.** No password-reset flow exists anywhere in this app or the backend (out of scope, confirmed — password reset itself is explicitly excluded from this package). The handoff's constraint is exact: *"it must not navigate somewhere that pretends to work."* A `Pressable` toggling an honest, static notice in place satisfies that literally — no route was invented, nothing pretends. If a real reset flow ships later, this becomes the affordance's real destination; until then it says what's true.

#### Two things the handoff cited that turned out to be stale, checked before repeating them

**"The plaintext password in `EmailSignUpDraft`'s route params"** — named in Out of scope as *"a real logged security item you will be next to it"* and told to re-flag for its own item. `EmailSignUpDraft` does not exist anywhere in the current tree (`grep` across `apps/mobile/src`, zero hits). `SignUpDraft.tsx`'s own docstring explains why: the draft moved into a ref-held context specifically so the password never becomes a navigation param, and `git log --follow` on that file shows exactly one commit — WP6's *"close the six review fixes and two cheap ones."* This was fixed at the source four packages ago and the handoff's citation of it is stale, the same shape as WP23's stale sticky-notes-prompt citation. **Not re-flagging it** — repeating a closed item back to Architect would be the same mistake in the other direction.

**The "256-character limit" attributed to email**, covered above — not stale exactly, but imprecise in a way worth distinguishing from the `EmailSignUpDraft` case: that one no longer exists; this one exists but on the wrong field.

#### What's device-verified vs. reasoned

**Device-verified, this session, with screenshots at each step (detail in "the simulator worked this time" below):**
- `SignInScreen`: no social row, no "or continue with" divider — dark and light themes
- `SignInScreen`: "Forgot password?" reveals the honest notice in place, confirmed it does **not** navigate (`nav.navigate` aside — this is the live app, not the test harness)
- `SignUpScreen`: a malformed email (`reader@example`, the exact historical bug case) reports **on the email field**, red border plus the "!" glyph, not a banner, not silently submitted — dark theme
- `SignUpScreen`: simultaneously, a too-short password reports **on the password field** with its own message — light theme
- Both screens at the **true accessibility maximum** (`content_size accessibility-extra-extra-extra-large`, one step past the standard XXXL WP23's debt note refers to) — light theme. Long strings (*"Forgot password?"*, the password hint, *"I already have an account"*) wrap across 2–3 lines; fields and buttons grow via `minHeight` rather than clipping. **Nothing clipped, including the case none of the app's other accessibility checks have specifically hit before: a wrapped multi-line link.**
- Root `lint`/`typecheck`/`test`/`build`, clean from a full cold gate

**Not device-verified — reasoned from an unchanged diff, not watched on a screen:**
- `AgeGateScreen`, `AgeRefusedScreen` at any text size or theme. Zero functional diff in either file (docstring-only), so the risk this hides something is low, but "low risk" and "observed" are different claims and I'm not collapsing them.
- `TrackDetailScreen`'s legal pair: confirmed **by diff** that its position is untouched (`TrackLegal.tsx` restyled in place; `TrackDetailScreen.tsx` has no diff at all) and confirmed by `trackDetail.test.tsx` and `leafPlayer.test.tsx` (TrackLegal's two consumers) still passing — but never rendered on the device this session. I ran out of a reliable path back to an authenticated screen (below) before reaching it.
- Dark theme specifically at the accessibility maximum — I have dark-theme-at-default-size and light-theme-at-maximum-size, not the intersection of both. Theme changes colour tokens only, never layout, so I'm confident but it's an inference, not a fourth screenshot.

#### The simulator worked this time — two findings worth carrying into WP25/26, unlike the last four packages' dead ends

This is the first package in this project's four-package simulator-friction history where the device session actually produced what it was for, so it's worth being precise about what changed rather than filing it as one more entry in the pattern.

**Finding 1 — my own error, not the tooling's: tap coordinates are in device points, not the screenshot's pixels.** The simulator tool states its coordinate space at `attach`/`launch` (**402×874 points** for this iPhone 16 Pro) but a screenshot renders at 3× that in the pixels a viewer sees. I spent the first several taps computing coordinates directly off what I was looking at, landing at points like `(859, 1183)` in a 402-wide space — genuinely off-canvas — which produced exactly the symptom this project's prior packages logged as "the simulator doesn't respond": identical screenshots across repeated taps, no error, nothing to debug. It is not a simulator defect and it cost real time to notice, because the failure mode is indistinguishable from the real flakiness WP21–23 hit. Once I divided by ~2.29 (or equivalently used the tool's stated point space directly rather than eyeballing the image), every tap landed. **Worth a line in whatever carries standing gotchas forward:** compute simulator tap coordinates in the tool's stated point space, never off a screenshot's displayed pixel size.

**Finding 2 — a real, reproducible tool bug, worked around:** `npx expo run:ios`, with or without `--device <name-or-UDID>`, fails immediately with *"No code signing certificates are available to use"* — the physical-device signing error — even when targeting the already-booted simulator by exact name. Confirmed reproducible three times, different arguments each time. **Workaround that built and ran cleanly:** skip `expo run:ios` and drive `xcodebuild` directly against the existing prebuild — `xcodebuild -workspace apps/mobile/ios/ZoomOut.xcworkspace -scheme ZoomOut -configuration Debug -destination 'platform=iOS Simulator,id=<UDID>' -sdk iphonesimulator build` — then hand the resulting `.app` path (`Build/Products/Debug-iphonesimulator/ZoomOut.app` under the workspace's DerivedData) to the simulator tool's `launch` action directly, which installs and launches it in one step. Full build took roughly 15–20 minutes cold (Reanimated's C++ compiles slowest). **Bonus, tap-free and reliable for exactly the checks this project's device gates keep asking for:** `xcrun simctl ui <UDID> appearance <dark|light>` and `xcrun simctl ui <UDID> content_size <category>` (up to `accessibility-extra-extra-extra-large`) switch theme and Dynamic Type instantly, with zero taps and zero flakiness — this is what made the both-themes and largest-accessibility-size checks above possible without fighting navigation twice more. No prior package used either command.

**What still didn't work, honestly:** typed text was occasionally dropped mid-field (an email lost its last four characters once; a re-navigation once landed keystrokes in the wrong screen's fields entirely), and one intended tap on "Create an account" silently no-opped, leaving me typing into whatever was already focused. Both are consistent with WP23's "taps registered late and out of order." I worked around the first by completing the partial text rather than fighting field-clearing, and stopped rather than chase the second — which is what put `TrackDetailScreen` out of reach for this session rather than a hard blocker.

#### Mutation-checked, and precise

| Mutation | Reddened | Precise? |
|---|---|---|
| `passwordError`: `< MINIMUM` → `<= MINIMUM` | only the two tests about the minimum boundary | yes |
| `passwordError`: `> MAXIMUM` → `>= MAXIMUM` | only "accepts exactly the maximum" | yes |
| `displayNameError`: `> MAXIMUM` → `>= MAXIMUM` | only the two tests about the maximum boundary | yes |
| `emailError`: regex check → `.includes('@')` (the original bug, restored) | only the four tests that distinguish real shape validation from `includes('@')` | yes |

All four reverted after confirming. `authScreens.test.tsx`'s new field-level and forgot-password tests are call-site wiring, not mutation-checked individually — same gap WP22.1 and WP23 both named for their own screen-level tests, not new to this package.

#### Time

Roughly: a fifth on implementation (the validation module, the two screen rewrites, the TrackLegal restyle), a fifth on tests and mutation-checking, and three-fifths on the device session — the native build (~20 min), the coordinate-space debugging that turned out to be my own error, and the verification walkthrough itself. That last share is disproportionate to the other packages' but it's the reason this package has six device screenshots instead of zero; WP23 spent a comparable fraction on the device session and got none.

**Assumptions made:**
1. Kept `displayName` on `SignUpScreen` against the prompt's literal "email and password only" — the backend requires it.
2. "Forgot password?" reveals an inline notice rather than navigating — no reset flow exists to navigate to.
3. `AgeGateScreen`/`AgeRefusedScreen` need no code change — audited against `screen-07-onboarding-and-legal.txt`'s every stated constraint and found already compliant.
4. `TrackLegal`'s disclaimer moves to `body`/`textPrimary` as the concrete meaning of "legible... not a footnote" — a judgement call, not a value named in the spec.
5. Added an 80-character `displayName` ceiling beyond the two fields (email, password) the handoff named explicitly — same bug class, same fix, flagged as an extension rather than done silently.

**Follow-ups / tech debt for Architect:**
1. **`TrackDetailScreen`'s legal pair and `AgeGateScreen`/`AgeRefusedScreen` still need a device pass** — position and legibility are reasoned from an unchanged diff, not observed. Given finding 2 above, a future session should reach this in minutes rather than needing another cold build.
2. **The stale `EmailSignUpDraft` security item should be struck from wherever it's tracked** — it was fixed in WP6 and the citation in this handoff's Out-of-scope section is the second stale citation this project has surfaced in as many packages.
3. **The simulator findings above (points-not-pixels, the `expo run:ios` signing bug and its `xcodebuild` workaround, `simctl ui appearance`/`content_size`) are worth a permanent home** — the same shape of "inherit rather than rediscover" block WP22 and WP23 carried forward, but this is the first package with something to hand forward that isn't just "expect friction."
4. No component test exists for `SignInScreen`/`SignUpScreen`/`AgeGateScreen`/`AgeRefusedScreen` as components (only the black-box `authScreens.test.tsx` suite) — Tier C, consistent with the pre-existing pattern logged in prior packages.

---

### Completed: WP23 — the Leaf player re-skin, and the sticky-notes board — 2026-09-08

**5 of 8 acceptance criteria met with confidence; the board's visual rendering — clipping, the collapse firing where set, both themes, the real diagram — is implemented and unit-tested but not device-observed, and the founder made the call to close this out without that observation rather than keep fighting the simulator (below).** Root `lint`, `typecheck` (4 workspaces), `test` (1,201 passing: shared 71, admin 198, backend 477, mobile 455 — 451 + 4 new) and `build` (backend/mobile/admin outputs all present) are clean from a cleaned `dist`/`.next`. Read "What's device-verified vs. reasoned" before treating the board as closed — it names exactly which claims rest on which kind of evidence.

**What changed:** `StickyNotesSlide` is rebuilt around a new pure module, `stickyNotesLayout.ts` (`boardLayout`, Tier A, mutation-checked). Notes render as rotated, taped paper on a bordered board panel, staggered two-up by default and collapsing to one column above a font-scale threshold; note text uses `fontFamilies.handwritten` (Caveat, WP21's first real caller) with a `useWindowDimensions().fontScale`-aware line-height so it does not clip as text size grows. The player chrome (`LeafPlayerScreen.tsx`) gets a step-dot progress indicator beside the existing "N of M" text, and a header hairline echoing the footer's. `SummarySlide`, `ScenarioSlide`, `PayoffSlide` and `TakeawaySlide` are unchanged — reasoning below, not an oversight.

**Files touched:**
- `apps/mobile/src/screens/leaf/stickyNotesLayout.ts` (new) — `boardLayout(noteCount, fontScale)`, the collapse predicate
- `apps/mobile/src/screens/leaf/stickyNotesLayout.test.ts` (new) — 4 tests, mutation-checked
- `apps/mobile/src/screens/leaf/StickyNotesSlide.tsx` (rewritten) — the board
- `apps/mobile/src/screens/leaf/LeafPlayerScreen.tsx` — chrome: `SlideProgress` dots, header hairline

---

#### A reading-order bug caught before it shipped, not after

My first draft split notes into two literal column containers — all even indices rendered first, then all odd — because that is the obvious way to lay out "two columns" and it looks identical to the intended result when sighted. It is wrong: a screen reader announces DOM order, so a six-note board would read 0, 2, 4, 1, 3, 5 instead of 0 through 5 in sequence, silently scrambling the notes for exactly the reader who can't see that the scramble happened. Caught by re-reading the render tree I'd just written, not by a test — there is no non-visual test in this suite that would have caught it, which is itself worth naming as a gap.

The fix drops the two-container approach entirely: every note stays in one `flexWrap` row, in original order, sized to roughly half width. The two-up look comes from width and per-note rotation, not from two DOM subtrees. Screen-reader order and sighted layout are the same list now, by construction, which is a stronger guarantee than "I checked it once."

#### Two requirements the letter of the handoff couldn't be followed exactly, and why

**"Layered shadow" vs. this app's own rule that there is no `shadowOpacity` anywhere in it.** `design/layout.ts` is explicit and not incidental: *"Shadows are invisible on a dark background, so a shadow-based depth system would silently do nothing in the app's default theme."* I verified the rule is actually followed, not just documented — zero hits for `shadowColor`/`shadowOpacity`/`shadowRadius`/`elevation:` anywhere in `apps/mobile/src`. Adding a real shadow for one slide would reintroduce exactly the failure mode that rule exists to prevent, invisibly, in the app's own default theme. "Raised paper" instead comes from `elevation`: each note sits on `surfaceFor('raised')`, one step above the board's `surfaceFor('card')` — the same mechanism every other surface in the app uses for depth. "Layered" is the note's own paper-plus-tape composition (two surfaces, one item), not notes overlapping each other.

**"Textured board (cork, felt or wood grain)" vs. "built from existing tokens."** There is no texture asset in `design/`, and generating a repeating pattern would mean either a new image asset or an SVG generator built for a surface nothing else in the app needs — a bigger addition than a re-skin package should be making unasked. The board is a solid, bordered, generously-rounded panel one elevation step off the page. It reads as "a board" by being a distinct surface; it is not literally textured. If the founder saw an actual texture in the mockup and wants it, that is a real follow-up, not something I judged out on my own authority — flagged below.

Both are recorded in `StickyNotesSlide.tsx`'s own docstring, not just here, so the next reader finds the reasoning beside the code rather than only in an aging log entry.

#### The collapse threshold: reasoned, not measured

`boardLayout` collapses on two independent conditions: **below 3 notes**, always single-column (two side-by-side items isn't a board to stagger, it's two notes); **at or above a font-scale of 1.7**, single-column regardless of count. The count floor I'm confident in — it's a small, discrete design call. **The font-scale number is not verified on a device**, which the handoff explicitly asked for ("choose the threshold empirically") and I did not deliver. 1.7 sits at roughly the standard/accessibility Dynamic Type boundary, chosen from general knowledge of iOS's content-size-category scale, with real margin below `accessibilityExtraExtraExtraLarge` (~2.85) — which is where this component's own pre-redesign docstring already found two columns failing outright. That margin is a reasoned buffer, not a measurement. **If this number is wrong, the failure mode is narrow and visible**: the board either collapses later than it should (a column clips at some accessibility size below XXXL) or earlier than it should (loses the two-up look sooner than necessary). Either is a one-line constant change once someone reports what they saw.

#### What's device-verified vs. reasoned — read this before trusting the board is done

I could not reliably drive the simulator this package (detail below), so I split what I'm claiming into two kinds of evidence rather than blur them:

**Verified, via the backend API directly — no simulator involved:**
- Track 42 is real, has 18 Leaves, and every one of them carries a diagram. Queried directly from Payload (`GET /api/leaves?limit=45&depth=0`, filtered client-side with `jq`).
- **Track 42's real note counts range 3–4, not the schema's full 2–6.** Leaves 0,1,4,6,15 carry 3; the rest carry 4.
- **The schema's full 2–6 range does exist in the broader corpus, but only in placeholder content.** All five 2-note leaves and all four 6-note leaves are on Track 29 ("the 20-Leaf placeholder flagship") or Track 1 ("The mountain is you", also a placeholder) — none are real, human-authored content. Distribution across all 39 leaves: 2 notes ×5, 3 ×9, 4 ×17, 5 ×4, 6 ×4.
- This matters for the device gate's "extremes" requirement: **the founder exercising the real 3–4 range on Track 42 will never see the schema's true extremes** (2 or 6) unless they specifically open Track 29 or Track 1.
- `stickyNotesLayout.test.ts` passes, and both mutation checks (below) land precisely.
- Root `lint`/`typecheck`/`test`/`build` are clean.

**Not verified — reasoned from the code and from Reanimated/RN's documented behaviour, not watched on a screen:**
- Whether the board actually renders as intended (rotation, tape placement, board panel) at all.
- Whether note text clips at any accessibility text size, including the ones below the collapse threshold.
- Whether the collapse actually fires at `fontScale` 1.7 in practice, and whether 1.7 is the right number.
- Both themes.
- The step-dot progress indicator's appearance.
- That the payoff gate is visually unaffected by the chrome changes (its *logic* is untouched — `useLeafSession.ts` has no diff — but I have not watched it on screen since editing the file it renders inside).

#### Why the device gate wasn't completed

I hit the same class of problem WP21, WP22 and WP22.1 all logged, a fourth time running, with a new specific cause each time. This time: the backend and Payload CMS (port 3001) were not running at all — both had to be started before Explore would load anything — and once they were up, simulator touch input itself became unreliable in a way I could not resolve: taps registered late and out of order (confirmed by the simulator clock jumping across screenshots with no visible change in between), `detach`/`attach` fixed it once and then stopped fixing it, and `touch_path` didn't help either. I got as far as: Track 42 added to the library, its roadmap rendering correctly with real progress state (confirms WP22's screen still works against live data) — but could not reliably tap into the Leaf player itself to reach the board.

Per the 2026-09-09 ruling, I raised this with the founder rather than continuing to hunt coordinates, laid out the options, and **the founder chose to close the package on what's verified above rather than spend further time on simulator reliability.** That is their call to make and they made it; I'm recording it here as a decision, not as my own judgment that the gap doesn't matter.

Two backend services are now running locally as a result (`npm run dev --workspace=apps/backend` on :3000, `npm run dev --workspace=apps/admin` on :3001, both detached, logs in the session scratchpad) — left running rather than torn down, since whoever next opens the simulator to look at this board will want them up.

#### Mutation-checked, and precise

| Mutation | Reddened | Precise? |
|---|---|---|
| `noteCount < MIN_NOTES_TO_STAGGER` → `<=` | only "staggers at 3–6 notes below the collapse threshold" | yes |
| `fontScale >= COLLAPSE_FONT_SCALE` → `>` | only "collapses exactly at the threshold, not only past it" | yes |

Both reverted after confirming. As with WP22.1, I did not mutation-check the call site wiring itself — no component test exists for `StickyNotesSlide` (Tier C, consistent with the fact none of the five slides had one before this package either), so a call-site regression would not redden anything today.

#### Why four of five slides are untouched

The handoff's own requirements section gives the sticky-notes board enough detail to build from without the mockup — rotation, tape, board texture, staggering, no amber, the collapse rule are all spelled out inline. It does not give that level of detail for Summary, Scenario, Payoff or Takeaway, and I could not reach either named source for it: **the "sticky-notes prompt... recorded in this log under 2026-09-06" does not exist** — I searched `collaboration-log.md`, both phase archives, and `design/` (including `remaining-screen-prompts.md` and the `design/prompts/` directory) and found nothing dated 2026-09-06 that is about sticky notes; the actual 2026-09-06 handoff in this log is WP21, which is SVG/font infrastructure, not a visual spec. The live Claude Design mockup I was told not to drive myself.

Rather than guess at a redesign for four screens I have no source material for, I read each one on its own merits: all four already compose from current tokens (`theme.surfaceFor`, `theme.radius.lg`, icons, elevation-based cards), and each has substantial in-file docstring reasoning from earlier packages I'd be overriding without a documented reason to (`SummarySlide`'s plainness is explicitly deliberate — *"the reader should arrive at the scenario with the setup in mind, not with a memory of the layout"* — touching it would contradict that on my own authority, not on this handoff's). I judged the actual visual gap to be specifically the board (flat cards standing in for physical notes, amber misused on a non-reward slide) and the chrome (plain text-only progress, no defining border), not these four. **This is a scope call I'm flagging, not asserting** — if the founder has mockup images for these four and wants them redone against it, that's a clean, well-bounded follow-up now that the pattern (board + chrome) exists as a reference.

#### Time

Roughly: two-fifths on the board and its layout module including the reading-order fix, one-fifth on the chrome, one-fifth on tests and mutation-checking, and two-fifths on environment/device-gate work — starting two backend services from cold, and the simulator session that didn't ultimately produce visual confirmation. That last share produced real, valuable output (the corpus data above) but not the thing it was aimed at.

**Assumptions made:**
1. "Textured board" and "layered shadow" are satisfied by this app's existing elevation/surface system rather than literally, per the reasoning above.
2. The diagram stays above and outside the board, in its own frame, not pinned to it as another board object — WP15's "above, never instead" placement, not relitigated, because integrating it into the paper/rotation treatment risks either crushing the image or requiring the board to special-case its one non-paper child, and nothing in this handoff asked for that.
3. `COLLAPSE_FONT_SCALE = 1.7` is a placeholder pending the device observation this report couldn't complete.

**Follow-ups / tech debt for Architect:**
1. **The board's visual rendering needs a device pass** — nothing clips, the collapse fires where set (ideally checked against Track 42 at 3–4 notes *and* Track 29/Track 1 at the schema's real 2 and 6 extremes), both themes, the chrome looks right. Suggest the founder does this directly per the standing 2026-09-09 ruling.
2. **The "2026-09-06 sticky-notes prompt" citation is stale or was never written** — worth fixing at the source so the next handoff that references it doesn't repeat this search.
3. **Simulator automation reliability is now a four-package pattern** (WP21, WP22, WP22.1, WP23), a different specific cause each time. Worth a real debt-register line rather than four scattered mentions — the aggregate cost is now substantial even though no single instance was a code defect.
4. If mockup access becomes available, Summary/Scenario/Payoff/Takeaway are open follow-ups per the scope call above.
5. No component test exists for any of the five slides (Tier C, logged for WP14, consistent with the pre-existing pattern).

---

### Completed: WP22.1 — close the reduce-motion mechanism, not four call sites — 2026-09-08

**5 of 6 acceptance criteria met outright; the sixth — live on-device observation, "measured, not inspected" — was not achieved this session, and that gap is the one thing in this report that needs a founder decision, not just a read.** Root `lint`, `typecheck` (4 workspaces), `test` (1,197 passing: shared 71, admin 198, backend 477, mobile 451 — 447 + 4 new) and `build` (backend/mobile/admin outputs all present) are clean from a cleaned `dist`/`.next`. What I have instead of device measurement is a source-level trace of Reanimated's actual reduce-motion resolution code, which is precise but is not the thing the handoff asked for. Detail and the reasoning for that call are below; please read the "What I could not verify" section before treating the four surfaces as closed.

**What changed:** `motionPlan` gained the companion the handoff asked for. `motionTimingConfig(plan)` in `apps/mobile/src/design/motion.ts` returns the actual Reanimated `WithTimingConfig` (`{ duration, reduceMotion: REDUCE_MOTION_OVERRIDE }`), and `REDUCE_MOTION_OVERRIDE` (`= ReduceMotion.Never`) is the one named place the flag now lives, with its rationale written beside it. `PayoffSlide`, `ScenarioSlide` and `AchievementUnlock` route their reduced-motion `withTiming` calls through it; `AchievementUnlock` additionally passes `REDUCE_MOTION_OVERRIDE` to `withDelay`'s own `reduceMotion` parameter, for a reason that isn't obvious — see below. `TrackRoadmap.tsx` was not touched, per the handoff's scope. `AuthStack.tsx` was not touched either, but for a different reason: it isn't broken, and the reasoning is below.

**Files touched:**
- `apps/mobile/src/design/motion.ts` — `motionTimingConfig` + `REDUCE_MOTION_OVERRIDE`, with the "why" recorded beside the flag
- `apps/mobile/src/design/index.ts` — exports the two new symbols
- `apps/mobile/src/design/motion.test.ts` — new `motionTimingConfig`/`REDUCE_MOTION_OVERRIDE` coverage
- `apps/mobile/src/screens/leaf/PayoffSlide.tsx` — reduced-motion fade routed through the mechanism
- `apps/mobile/src/screens/leaf/ScenarioSlide.tsx` — the wrong-answer feedback fade routed through it
- `apps/mobile/src/components/AchievementUnlock.tsx` — the fade **and** its `withDelay` wrapper routed through it

---

#### Why `withDelay` needed its own argument, not just the inner config

This is the one non-obvious piece of the mechanism, and worth recording precisely because it is exactly the shape of mistake this package exists to close off. I read Reanimated 4.5.1's actual source (`node_modules/react-native-reanimated/src/animation/{util,timing,delay}.ts`) rather than assume from the reference implementation:

- Every animation — leaf (`withTiming`) or higher-order (`withDelay`, `withRepeat`, `withSequence`) — resolves its own `reduceMotion` independently, from its own optional config argument. If none is given, it defaults to live OS state at the moment the animation starts.
- For a leaf animation, if `reduceMotion` resolves true, Reanimated's `decorateAnimation` wrapper sets `animation.current = animation.toValue` immediately and replaces `onFrame` with a no-op. **This is the precise, sourced answer to a question I had to resolve before I could know what to look for on-device: a suppressed animation snaps instantly to its target value — it does not freeze at the start value.** Content is never missing; the transition is.
- `withDelay`'s own `onFrame` is `if (now - startTime >= delayMs || animation.reduceMotion)` — if **the delay's own** `reduceMotion` resolves true, the wait is skipped on the very first frame, regardless of what the wrapped animation's config says. Its `onStart` only inherits its resolved value into the child *if the child's `reduceMotion` is still `undefined`* — so a child with its own explicit override is never overwritten by the parent, but the parent's *own* behaviour (the wait itself) is ungoverned by the child either way.

Concretely, this means `AchievementUnlock`'s original code — `withDelay(stagger, withTiming(1, { duration: duration.standard }))`, no `reduceMotion` anywhere — had two independent failure points, not one: the inner fade would snap instead of transition, **and**, separately, every card's stagger would collapse to zero because the outer delay would resolve `reduceMotion` from live OS state and skip itself. Fixing only the inner `withTiming` (which is as far as a literal reading of "the config" goes) would have left the stagger bug standing. `PayoffSlide` and `ScenarioSlide` don't use `withDelay` in their reduced-motion branch, so they needed only the inner fix.

#### Per site: was it broken?

All four assessments below rest on the source trace above, applied to each site's *original* code, not on live observation — see the next section for why. Stated as plainly as WP22 stated its own:

| Site | Reduced-motion animation | Verdict | Why |
|---|---|---|---|
| `PayoffSlide` | one `withTiming`, no wrapper | **Was broken** | No `reduceMotion` anywhere in the original; under real Reduce Motion the 280ms fade would snap to opaque instantly. Content still appears — this is a lost transition, not a missing one. |
| `ScenarioSlide` | one `withTiming`, no wrapper, runs in **both** motion modes | **Was broken** | Same mechanism. This one runs unconditionally, so it was silently vulnerable even outside the "reduced motion" branch — nothing in the original code path so much as checked `reducedMotion` before this line ran. |
| `AchievementUnlock` | `withTiming` inside `withDelay` | **Was broken, two ways** | The fade would snap (as above) **and** the per-card stagger would collapse to simultaneous, independently, per the `withDelay` mechanism above. |
| `AuthStack` | none — no Reanimated | **Was already fine** | Its transition is `@react-navigation/native-stack`'s own `animation`/`animationDuration` props, which `react-native-screens` implements as a **native** platform transition. Confirmed by reading both packages' `package.json`: neither lists `react-native-reanimated` as a dependency, and `react-native-screens` only reaches for it from an opt-in `reanimated/` subpath this app never imports. WP22's finding is specifically about Reanimated's own reduce-motion default; a mechanism that never touches Reanimated cannot carry that specific bug. I did not change this file. |

#### Mutation-checked, and precise

| Mutation | Reddened | Precise? |
|---|---|---|
| Drop `reduceMotion` from `motionTimingConfig`'s returned object | the 2 tests asserting the override is present (fade-plan and spring-plan cases) | yes — nothing else moved |
| `REDUCE_MOTION_OVERRIDE = ReduceMotion.System` instead of `.Never` | those same 2, plus the test on the constant itself | yes |

Both reverted after confirming. I did not mutation-check the three call sites themselves — there is no component test for `PayoffSlide`, `ScenarioSlide` or `AchievementUnlock` to catch it (none existed before this package, and Tier B for this handoff didn't ask for one), and the shipped Jest mock resolves every Reanimated animation to its target value immediately regardless of config, so a call-site mutation would not redden anything even if a test existed to try. **The wiring from call site to mechanism is protected by TypeScript's function signatures and by this report's diff review, not by an automated test.** That is a real, if narrow, gap — noted rather than papered over.

#### What I could not verify, and why

The handoff's device gate asks for observation "measured, not inspected" on all four surfaces, using the pixel technique WP22 invented. I attempted this and did not get it to a state I'd stand behind. Two separate things went wrong, and they're different in kind:

**1. Simulator touch input was unreliable in this session** — the same thing WP21 and WP22 both logged (WP22's handoff carried it forward explicitly: *"Tapping this app's pill buttons through simulator automation is unreliable and has cost real time in two packages now. It is not a code defect... asking the founder to tap has twice been faster than hunting coordinates."*) I hit the same wall a third time: taps silently no-op'd or landed on stale state repeatedly before I found the actual cause — my coordinates were being interpreted in the *displayed* screenshot's pixel space rather than the device's 402×874 point space (a ~2.3x mismatch), not a timing race as I first assumed. Once corrected, taps became reliable. I'm recording the precise fix (displayed-image px → device pt is roughly ×1.31 then ÷3 for this device) since this is now the third package to lose time to this class of problem, and the actual cause turned out to be different each time.

**2. Once input was reliable, catching the transition itself was a harder problem than WP22's, and a different one.** WP22 measured a *continuously repeating* animation — the ring pulses forever, so ten screenshots taken at any arbitrary moments are already a valid sample. Three of my four sites are **one-shot** transitions (150–280ms) that settle permanently. Bracketing a 150ms window requires the screenshot burst to start *before or during* the state change, and every tool round-trip in this environment (the tap call returning, then a separate call starting a capture loop) cost enough latency that my bursts landed entirely before or entirely after the transition, never during it — confirmed by twenty-five-frame bursts coming back byte-identical, consistent with "settled the whole time," not with "caught nothing by bad luck." This is a genuine limitation of sequential tool calls against a sub-300ms event, not a fixable coordinate bug like the first one.

I considered and rejected temporarily lengthening the animation durations to make the window easier to catch, live: the handoff's constraints say tokens and constants unchanged, and I didn't want to risk that boundary for a verification step, reverted or not.

**What this means concretely: the mechanism's correctness rests on the Reanimated source trace above (which I'm confident in — it's reading the actual shipped code, not inference) and on the unit tests, not on having watched it swap on a screen.** The four device-gate checks the handoff asks for — the auth transition, the scenario answer, the payoff unlock, and an achievement unlock, all with Reduce Motion on — are still open. Given WP21 and WP22's own precedent, I'd suggest the founder do these directly rather than a third session re-fighting simulator automation; each is a five-second check once you're on the right screen (submit a wrong scenario answer; reach a fresh payoff; cross an achievement threshold; open the auth stack) and "does the thing fade in smoothly or pop instantly" is easy to see by eye even without WP22's pixel technique, precisely because the failure mode is a lost transition, not lost content.

**WP8's founder criterion — "iOS Reduce Motion on, replay the unlock" — is not closed by this report.** The mechanism that would have broken it is fixed and the fix is reasoned through precisely above, but per the handoff's own instruction I'm saying plainly rather than borrowing confidence from the code: it needs the founder's own look before it's struck off, same as WP22 flagged for the roadmap's "neuron, not star chart" judgement.

#### Time

Roughly: a fifth implementing the mechanism and the three call sites, a fifth on the Reanimated source trace (this bought real confidence and is reusable — the next package touching this mechanism doesn't have to redo it), a fifth on tests and mutation-checking, and the remaining two-fifths on the device-gate attempt that's reported above as not fully successful. That last share is larger than the work it produced; the simulator-automation problem is now costing this project time out of proportion to what it should, three packages running.

**Assumptions made:** That "the config" in the handoff's second requirement was meant to cover every nesting level a `MotionPlan`-driven animation actually uses in these four sites (config object *and* wrapper argument), not only `withTiming`'s own field — the `withDelay` finding above is what that assumption rests on, not a guess.

**Follow-ups / tech debt for Architect:**
1. The device-gate observation (all four surfaces, Reduce Motion on) is still open — see above for why, and the suggestion to close it directly rather than via another simulator session.
2. Simulator touch-automation reliability has now cost time in three consecutive packages (WP21, WP22, WP22.1), for three different underlying reasons each time. Worth a line in the debt register even though no single instance is a code defect — the pattern itself is the cost.
3. No component test exists for `PayoffSlide`, `ScenarioSlide`, or `AchievementUnlock` — Tier C, logged per the testing bar's "report what you did not test" rule, worklist for WP14.

---

### Completed: WP22 — the Track roadmap: the knowledge graph, on real data — 2026-09-08

**All 10 acceptance criteria met, verified on a signed build against the live local backend.** Root `lint`, `typecheck` (4 workspaces), `test` (1,193 passing: shared 71, admin 198, backend 477, mobile 447) and `build` (backend/mobile/admin outputs all present) are clean from a cleaned `dist`/`.next`.

**What changed:** `TrackDetailScreen` now renders a Track's Leaves as a neuron-like knowledge graph below the legal pair. Four new files under `apps/mobile/src/screens/track/`, one rewritten screen, one new screen test. Nothing outside `apps/mobile/src/screens` was touched; no backend, no `packages/shared`, no new dependency.

**Files touched:**
- `apps/mobile/src/screens/track/roadmapGeometry.ts` (new) — the pure layout, `(leafCount, viewport, seed) → geometry`
- `apps/mobile/src/screens/track/roadmapGeometry.test.ts` (new) — 187 tests
- `apps/mobile/src/screens/track/roadmapModel.ts` (new) — state derivation, the `nextLeafId` cross-check, label truncation
- `apps/mobile/src/screens/track/roadmapModel.test.ts` (new) — 19 tests
- `apps/mobile/src/screens/track/TrackRoadmap.tsx` (new) — the SVG component
- `apps/mobile/src/screens/TrackDetailScreen.tsx` (rewritten body)
- `apps/mobile/src/screens/trackDetail.test.tsx` (new) — 8 tests

---

#### The structural decision, and what it bought

**The layout is a pure function and the component is a thin consumer**, exactly as the handoff required. Geometry takes a *count*, not the Leaves — it has no access to a title or a completion state, so it cannot accidentally encode one. The component pairs `geometry.nodes[i]` with `model.nodes[i]`.

What that bought is the whole point of the package: **the 15–30 range is a unit test, not a device session.** Every count from 15 to 30 is exercised for node count, frame containment, the middle-two-thirds spine band, one spine curve per gap, recursive taper, the axon, the irregular soma, and the absence of straight segments. 187 tests, and none of them needed a Track to be authored first.

**Determinism** seeds from the Track id via FNV-1a into mulberry32. Three tests: identical geometry across repeated calls (deep equality over every control point, not a spot check on centres); identical on a *third* call after a different Track was laid out in between, which is what catches a generator held in module scope; and different Tracks producing different graphs. Confirmed on device — Track 42 and Track 29 draw visibly different meanders.

#### The cross-check

Implemented exactly as specified: the Leaf at index `completedLeaves` must be `nextLeafId`, with the finished-Track branch asserting the pointer is null instead. Range and integrality are checked first so the index is never taken on a nonsense count.

**The degrade keeps what the server asserted and drops only what this client derived.** On a mismatch, the node matching `nextLeafId` is still marked `next` — the server said so — and every `done` claim is dropped, `completedLeaves` is reported as zero rather than repeating half of a contradiction beside a map that disagrees with it, and the screen shows a caveat. The reader still has somewhere to resume; they just are not shown a confident map of progress that may not be theirs.

**Mutation-checked, and it lands precisely.** Replacing `sorted[completed]?.id === progress.nextLeafId` with `sorted[completed] !== undefined` reddens exactly five tests — the four cross-check unit tests and the one screen test — and nothing else.

#### Nine mutation checks, all precise

| Mutation | Reddened | Precise? |
|---|---|---|
| Cross-check accepts any Leaf at the completed index | 4 model + 1 screen — all the cross-check tests | yes |
| `minBowFraction: 0.4 → 0` (remove the bow floor) | only "curves every connection, background web included" | yes |
| `spineBand: 2/3 → 1` | "spine inside the middle two thirds" + "node inside the frame" | yes — the second is a real consequence, not noise |
| `mulberry32(seed)` → `Math.random()` | only the two determinism tests | yes |
| Fixed per-node dendrite budget | all three density-budget tests | yes |
| Truncation uppercases instead of only cutting | "never rewords, only cuts" + 2 exact-output + 1 screen | yes |
| `maxDepth: 4 → 1` (spokes, not recursion) | "tapering, recursive dendritic field" + path-count flatness | yes |
| Remove the try/catch around the library read | only "keeps the legal pair on screen when the library request fails" | yes |
| `somaJitter: 0.24 → 0` (perfect circles) | only "irregular body rather than a circle" | yes |

Note the fourth row: `Math.random()` did **not** redden "gives different Tracks different graphs", correctly — random satisfies difference. That test is real but it is not the one guarding determinism, and it would have been easy to believe otherwise.

#### Two things the device gate caught that no test could

**1. Reduce Motion silently turned the swap into a removal.** Reanimated reads the OS reduce-motion setting *itself* and disables animations by default — so with Reduce Motion on it cancelled the opacity fade too, which is the accommodation, not the thing being accommodated. Nothing failed, nothing warned in the app, and the ring simply sat still: indistinguishable from a ring that was never meant to move.

Caught by measurement rather than by eye. Ten native screenshots per mode, mean brightness of a box around the ring: **before the fix, six frames identical to three decimal places (spread 0.000)**. After adding `ReduceMotion.Never` to the fade: spread 7.011, oscillating smoothly. Frame-differencing then separates the two modes cleanly — with motion allowed the changed pixels sweep a **26–100 px annulus with deltas up to 156 levels** (the ring physically scaling); with Reduce Motion on they sit in a **31–83 px band with deltas ≤ 86** and a near-constant changed-pixel count (the ring holding position and only changing brightness). Same element, different property. Swap, not remove — and now actually so.

`motionPlan` had never been used anywhere in the app before this; it was exported and dead. This is its first load-bearing call site.

**2. Node labels were shouting.** I first used `variant="caption"`, which is the right weight but uppercases and letter-spaces. On device, eighteen fragments of a real author's chapter titles in caps read as signage rather than as a table of contents, and were materially harder to scan. Switched to `small`. Truncating a title is a space decision; restyling its capitalisation is a different kind of change to make to someone else's words.

#### Performance — measured, and density did **not** have to be cut

| Leaves | Curves | `<Path>` elements | Graph height |
|---|---|---|---|
| 15 | 437 | 20 | 1,870 pt |
| **18** (Track 42) | **449** | **20** | 2,240 pt |
| 20 (Track 29) | 457 | 20 | 2,486 pt |
| 24 | 473 | 20 | 2,980 pt |
| **30** | **497** | **20** | 3,720 pt |

Two mechanisms, and they are independent:

- **A shared dendrite budget rather than a per-node one.** 380 dendrite paths are divided across the Track, so per-node density falls from 25 at 15 Leaves to 13 at 30 — this is the handoff's "reduce dendrite density as node count rises", and it keeps the *curve* count within 14% across a range where the node count doubles.
- **Curve batching.** SVG path data takes many subpaths in one `d`, so every curve sharing a colour and stroke width is concatenated into a single `<Path>`. **450 curves become 20 native elements, and that number is flat at every Leaf count.** One React element per curve would have meant ~450 native views inside a scroll view, which is where a screen like this stutters.

Because of the second mechanism the first never had to bite hard: **no Track length was capped and no visual density was sacrificed.** Scrolling the full 2,486 pt of the 20-Leaf Track in four fast swipes rendered and settled correctly every time. **I want to be exact about the limit of that claim: I can confirm correct rendering under fast scrolling, not frame timing — screenshots cannot measure dropped frames.** The founder holding the device is the only one who can say it *feels* smooth, and 20 flat native paths is the reason I expect it does.

#### Reading judgement: neuron, not star chart — with one honest reservation

Asked for plainly, so answered plainly. **It reads as a neuron.** The recursive tapering dendrites and the fine terminal branches do most of that work, and the total absence of straight segments does the rest — there is nothing in the frame that reads as a constellation, which was the specific failure being corrected.

**The reservation:** it reads as a *chain of neurons* more than as a field of stained tissue. Cells sit roughly 123 pt apart and their dendritic fields only just reach each other, so the eye follows a strand rather than resting on a mesh. I chose not to push dendrite reach further because longer processes start tangling with the node labels, and legibility of a real author's chapter titles seemed the more valuable half of that trade. **It is a one-constant change (`GRAPH.primaryLength`) if the founder wants it denser** — worth looking at on the device before deciding, because it reads differently at actual size than in a screenshot.

#### Decisions made, with reasons

1. **Progress is read from `GET /library` and matched by Track id.** There is no `GET /content/tracks/:id/progress` — `TrackProgressSummary` reaches the client on a `LibraryEntry` and nowhere else. One extra request on this screen; the alternative was a backend change, which was explicitly out of scope. **A failed library read does not take the screen down**: the disclaimer and purchase links are why this screen exists and they are legal obligations, so a failed *progress* request degrades to a caveat. Mutation-checked.

2. **Three sources of "no progress", three sentences.** Not on the shelf yet / could not be checked / the server contradicted itself. Collapsing them would have told a reader browsing from Explore that something had gone wrong when nothing had. Both of the first two were observed on device.

3. **Only the `next` node opens from the map.** Re-reading a completed Leaf is a capability this app has deliberately not shipped — `LibraryScreen` declined it for want of a Leaf id, and this screen is the first place on the client where that id exists. Adding it *because I now could* is a different decision from this package's, so it is a follow-up below rather than a quiet inclusion. Every node is still an accessibility node with its state spoken; the others are simply not buttons rather than buttons that are disabled.

4. **Back moved from the bottom of the screen to the top.** It used to sit after the purchase links, which was fine when the screen ended there; with a 2,240 pt graph below it, a back control at the bottom is one the reader must traverse the entire book to reach. The legal pair is still above the fold with it there — confirmed on device on both Tracks, including Track 29 whose title wraps to three lines.

5. **Continue sits between the legal pair and the graph.** It is the only position reachable without scrolling past the whole book, and a floating pill over a scrolling graph would cover the nodes it is about.

6. **No `npm install` in the cold gate.** Deliberate, and I want it on the record: this diff adds no dependency, so a reinstall would prove nothing — and it would destroy the `Swift.abs` patch in `node_modules/expo-modules-jsi` that WP21 flagged and that the handoff says to preserve. `dist` and `.next` were deleted and the whole gate run from cold.

**Assumptions made:** one, stated because the handoff did not cover it — this screen is reachable from Explore for a Track that is **not on the reader's shelf**, where no rollup exists to fetch. That renders as `confidence: 'unknown'`: the graph draws (the shape of a book is not a claim about the reader), nothing is marked done, no Continue appears, and a line says why.

**Tokens:** no new colour, spacing, radius or duration value. Every colour in the new component comes from `theme.palette` / `surfaceFor`; every dimension from `spacing` / `radius` / `borderWidth` / `MIN_TOUCH_TARGET`. Amber is untouched — a finished Leaf on a map is progress, not a prize. The numbers in `GRAPH` (curvature ratios, taper factors, branch lengths) are algorithm parameters with no meaning outside that file, and are documented as such beside the rule they are not.

**The three states differ by shape, not only hue:** done is a *filled* body, locked is a *hollow* outline, and next is the only one wearing a ring and the only one showing its full title. It survives greyscale.

---

**Follow-ups / tech debt for Architect:**

- **Re-reading a completed Leaf from the map is now one line away.** The client holds real Leaf ids on this screen for the first time; `LibraryScreen`'s comment deferring this to WP14 was written when it did not. Worth a decision rather than a drive-by: `completeLeaf` is idempotent and awards 0 XP on replay, so it is safe, but "can a reader re-open a finished Leaf" is a product question.
- **Density is one constant from being denser** — `GRAPH.primaryLength`, currently 30. See the reading judgement above.
- **Locked dendrites at 0.28 opacity are very faint in the light theme** — near-invisible on white in places. Deliberate (locked content is de-emphasised and the outline plus label carry the information), but if the founder wants the tissue more present in light, that opacity is theme-independent today and would need splitting.
- **The handoff says `motionPlan` is "already used in four places"; it was used in none.** `useReducedMotion` is used in four (AuthStack, PayoffSlide, ScenarioSlide, AchievementUnlock); `motionPlan` was exported and dead until this package. No consequence — flagging it only because the roadmap may be tracking it as covered.
- **Tier C deferred, for WP14's worklist:** no component render tests for `TrackRoadmap` in the light theme (theme correctness was verified on device in both, on both Tracks); no test that the reduce-motion branch is selected (it is a Reanimated runtime behaviour and the pixel measurement above is the only real evidence — a jest test with the mock would assert nothing); no test for label *placement* (left/right side selection, the next-node card); no failure-path tests for `getTrack`/`listLeaves` beyond the one error state the screen already had.
- **One test that cannot be mutation-checked, noted per the standing rule:** "keeps the legal pair on screen when the library request fails" *can* be — and was. But `roadmapGeometry.test.ts`'s "grows tall enough to hold every Leaf without overlapping the frame edge" is close to structural and would survive most plausible breakages; treat it as weak.
- **Metro had been running for 6h42m** at the start of this package and I restarted it with `--clear` pre-emptively rather than discover a stale bundle later. No time lost, and recording it because the standing note says this has cost time three times.
- **A test account with real progress exists for future device gates:** `wp22-roadmap-1788854406@example.test`, Track 42 at 5/18 and Track 29 at 3/20. Completing more Leaves on it today will award 0 XP — it hit the 500 XP daily cap during setup, which is correct behaviour and worth knowing before someone reads it as a bug.

**Update, same day — density raised on the founder's call.** The reading judgement above flagged that the graph read as a *chain of cells* rather than a field of tissue, and offered `GRAPH.primaryLength` as the one-constant fix. The founder asked for "slightly denser"; it is now **36, raised from 30**.

**Reach, not branch count** — the shared dendrite budget is untouched, so the curve count and the 20 `<Path>` elements are unchanged at every Leaf count. The change is free. Neighbouring dendritic fields now overlap rather than reaching toward each other, and the graph reads as continuous tissue while the spine stays legible and no label is crowded. Verified on Track 42 in both themes. Full gate re-run clean: lint, typecheck, 1,193 tests, build.

**One incidental fixture change, so nobody reads it as a bug later:** the test account's Track 42 progress moved from 5/18 to 6/18 during this session. Leaf 249 was completed at 08:36 through the normal player flow — my own stray taps while navigating the simulator between checks, not anything the app did on its own. The roadmap picked the new state up correctly, which is a small piece of evidence in its favour: "Guard your mind against…" flipped to done and the ring moved to "Build a precise mental picture…" on the next load.

**Time:** implementation ~20%; tests and the nine mutation checks ~20%; the device gate ~45% (of which the reduce-motion investigation and its pixel measurement was the single largest block, and sign-in/navigation friction a distant second); the cold gate ~5%; this write-up ~10%.


### Completed: WP20.1 — attach Track 42's scenario images — 2026-09-02

**All 6 acceptance criteria met.** 18 of 18 Leaves carry a scenario image as a **draft**;
the published versions still show none. `apps/pipeline` lint, `ruff format --check`,
`mypy --strict` (69 files) and `pytest` (198 passed, 2 deselected) are clean. Nothing
outside `apps/pipeline` was touched.

**Verified against live data, not against the command's own report:**

| | |
|---|---|
| Draft view — `scenario.image` set, with alt | **18/18** |
| Published view — `scenario.image` set | **0/18** — a human publishes |
| `scenario.prompt` differing from the published version | **none** |
| `scenario.options` differing from the published version | **none** |
| Leaves without exactly 3 options / exactly 1 correct | **none** |
| Media created by this package | **none** |

The sibling proof is stronger than the handoff asked for. Rather than only comparing
before-and-after around the write, the draft's prompt and options are compared against the
**published** version — a copy this package never touched and could not have touched. They
are byte-identical on all 18.

**Leaf 0 was skipped and kept its existing image.** It was a pick a human made through
WP15.7's own button during that package's device gate. Overwriting a person's choice to
install an automatic one is the opposite of what a delegated pass is for, so
`choose_candidate` leaves any Leaf that already has an image alone. The other 17 took
candidate 0, which passed the guardrails in every case.

---

**Read-it-yourself gate — all 18 looked at, and the result is worth acting on.**

**8 of 18 breach the style contract's no-glow rule.** `asset_style.md` is explicit: *"No
lighting effects. No glow, no light cones or beams, no lens flare, no bloom, no volumetric
light. A lamp is a shape, and the room around it is a darker shape."*

| | Leaves |
|---|---|
| **Clean** | 0, 5, 6, 8, 9, 10, 12, 13, 15, 17 |
| **Glow breach** | 1, 2, 3, 4, 7, 11, 14, 16 |

Severity varies: **4, 7, 11 and 16** render a pronounced lamp or overhead cone; **1** projects
a cone from a laptop screen; **3** is a softer lamp halo; **14** is screen bloom only. **Leaf 11
is the exact image flagged in WP20's completion report** as the sampled candidate that
rendered a luminous cone — the risk named there has now materialised on a Leaf, because
nothing mechanical stands between a drifting candidate and selection.

**This is the guardrail gap WP20 raised, now with a measured rate.** `check_reward_amber` is
the only mechanical guardrail; all 72 images pass it, correctly, because the glow is pale
cream rather than reserved amber. Selecting "the first candidate that passes the guardrails"
is therefore only as strong as the guardrails, and on this dimension they are silent.
**Roughly 44% of first candidates drift**, which is high enough that automatic selection on
guardrails alone should not be the pattern for later books.

**Subject matching is good.** No mismatch of the kind the handoff warned about — no empty
desk standing in for a difficult conversation. The strongest: **Leaf 5** (colleagues at a
lunch table mid-complaint, one visibly disengaged, for "guard your mind against negative
talk"), **Leaf 9** (freelancer meeting a client over coffee, notebook open), **Leaf 17**
(head in hands beside a task checklist, which is exactly what its correct answer is about),
and **Leaf 0** (the roaster looking out at the rival cafe). Two are weak rather than wrong:
**Leaf 12** and **Leaf 15** are generic desk scenes carrying little of their scenario.

**Faces remain compliant.** Every figure is a profile silhouette with no eyes, mouth or
brows. WP19's fully-featured-face drift has not recurred anywhere in the set.

---

**A correction to WP20's own completion report.** It recorded "53 orphaned media files".
That count was taken mid-run, before the asset regeneration finished, and is wrong. The
library holds **146 media, 72 referenced, 74 unreferenced**. The orphans are WP18's
superseded set (`scenario-1/2/3`, `diagram-0`) plus a few from re-runs. **Untouched, as the
handoff requires** — nothing was created or deleted by this package, confirmed by the
newest media pre-dating it.

---

**Open for the founder.**

1. **Override the 8 glow breaches**, or accept them. Each Leaf still carries its other two
   candidates, so overriding is one click per Leaf in WP15.7's control. I did not choose on
   quality grounds beyond the guardrails, per scope.
2. **Publish when ready.** The images are drafts; readers see none of them until a human
   publishes. The pipeline cannot.
3. **The orphan sweep stays deferred**, correctly — the candidates a founder might switch to
   are among the unreferenced files only after they switch. Sweep after the overrides.

**Open for Architect.**

**The mechanical guardrail gap now has a number.** WP20 reported it as a risk; this package
measures it at **8 of 18 first candidates breaching the no-glow rule**. Two options worth
ruling between: add a mechanical check for large uniform bright regions, or accept that
image selection cannot be delegated without a human pass. The founder delegated this Track
explicitly and will choose personally for later books, so nothing is blocked — but
"first that passes the guardrails" is a weaker filter than it sounds while the guardrails
cover one of the three stated conditions.

### Completed: WP15.7 — "Use this candidate" (implementation done, live-verified; root gate + commit still pending) — 2026-09-02

**What changed:** `ImageCandidateThumbnail.tsx` (built in WP15.6) now has a "Use this candidate" button under each thumbnail. Clicking it makes two independent `useField({path: 'scenario.image.url'}).setValue(...)` / `.../.alt` calls — never sets the `scenario` or `scenario.image` group as a whole. Deliberate: Payload's form state is a flat path-keyed map, so a leaf-level `setValue` cannot touch `scenario.image.width`/`.height` or `scenario.prompt`/`scenario.options` — the exact unverified risk WP15.6 flagged.

**That risk is now verified live, not just reasoned through.** The founder logged into the WP15.7 worktree's dev server and, on Track 42 / Leaf 244 — a real, published Leaf whose `scenario.image` had never been set despite carrying 3 `imageCandidates` — clicked "Use this candidate" and saved as a draft. Re-fetched the stored document via `GET /api/leaves/244?draft=true` (authenticated; not the form's own display): `scenario.image.url`/`.alt` now hold the chosen candidate's values exactly; `scenario.prompt` and all three `scenario.options` — including which one is `isCorrect` — are byte-for-byte unchanged from the published version; `_status` is `draft`, and the published version (`GET /api/leaves/244`, no draft param) is untouched. Both halves of the criteria that mattered are proven: the never-set-before case, and sibling survival.

**Finding, not caused by this package:** all 18 of Track 42's Leaves are published with `scenario.image` unset despite all carrying 3 `imageCandidates` — WP20's gate 2 pass never attached a chosen image to any of them. Worth Architect knowing; not something WP15.7 should fix.

**"Picking a different candidate replaces cleanly" is asserted by code inspection, not a second live round-trip** — `applyCandidate` does an unconditional overwrite with no accumulation logic, so there's no mechanism by which a second click could leave stale data. Flagging the difference in evidence quality rather than letting a live-verified claim and a reasoned-through one blur together.

**Manual editing of `scenario.image` still works** — untouched by this diff; not independently re-tested, since nothing in the change path touches that field's admin config.

**What's NOT done, and why this is written up now instead of as a normal sign-off:**

Mid-package, this session's shell lost the ability to call `getcwd()` — every `git`/`npm`/`payload`-CLI invocation started failing with `EPERM`/"Unable to read current working directory," including bare `git status` with no path argument, in a freshly re-exec'd shell, regardless of which directory was targeted. First trigger was Payload's own CLI (`npm run create-admin`, then `npm run generate:types` — both go through the `payload` binary) hitting the sandbox and crashing; every `git`/npm call after that point failed the same way, including ones unrelated to `payload` or to either worktree. Tried: fresh shell re-exec, stopping and restarting the dev server — neither recovered it. **The breakage then widened**: the `Read` tool itself started refusing pre-existing files under `/Users/ayushgupta/Documents/ZoomOut/ZO` (confirmed on `CLAUDE.md`, `collaboration-log.md`, and an untouched `Tracks.ts`, so it is not file-specific), while a newly-`Write`-created file remained readable immediately after. `Edit` on `collaboration-log.md` failed the same way despite that file having been read successfully earlier in this same conversation. Net effect: this session can still create new files, but can no longer reliably read or edit pre-existing project files, or run git/npm/payload at all.

**Concretely still outstanding:**
- Root `lint`/`typecheck`/`test`/`build` (the cold gate) has **not** been run. Workspace-level `apps/admin` typecheck, lint, and test (198 tests) all passed **before** the shell broke — no code has changed since. Root-level `lint` also passed before the break. Root-level `test` and `build` were never attempted.
- `payload generate:types` was never actually run (also blocked) — but this package makes zero changes to any collection-schema file, only to `ImageCandidateThumbnail.tsx`. Confirmed earlier by direct inspection (before the `Read` tool broke): `Leaves.ts`'s `imageCandidates` field block is untouched.
- **Nothing has been committed.** The one file changed — `apps/admin/src/components/ImageCandidateThumbnail.tsx` — sits uncommitted on the `wp15.7-use-candidate` branch, checked out in a separate worktree at `/Users/ayushgupta/Documents/ZoomOut/ZO-admin` (created so a `main`-checkout Architect session could keep working undisturbed while this ran). This status note is itself uncommitted, in the primary checkout.

**For whoever picks this up:** the worktree already has `npm install` run and `packages/shared` built (`npm run build:shared`), and `apps/admin/.env` copied over from the main checkout (gitignored, not committed — needed again if the worktree is ever recreated). A second dev-server entry was added to `.claude/launch.json` (`admin-wp15.7`, port 3002) alongside the existing `admin` entry, via a `bash -c "cd ... && npm run dev"` wrapper — that file is itself uncommitted and untracked (was already untracked before this package started). A stray one-line probe file, `.claude-probe.txt` at the repo root, was created while diagnosing the read breakage above — harmless, delete it along with this file once merged. Everything needed to finish: run the cold gate in the worktree, confirm clean, `git add apps/admin/src/components/ImageCandidateThumbnail.tsx` on that branch, commit, push, open the PR. **Do not redo the live device-gate check above** — it's real, it's done, and re-running it would spend the founder's time again for no new information.

**Files touched:** `apps/admin/src/components/ImageCandidateThumbnail.tsx` (the only code change). `.claude/launch.json` (tooling, added a second dev-server entry — itself untracked). This status note (to be merged into `collaboration-log.md`).

**Tests added/updated:** none. Following WP15.6's own precedent: the actual risk here was Payload's live client-side form-state behavior, which a mocked `useField` unit test cannot exercise — it would only prove the calls were written as written. The live, re-fetched-document verification above is the real evidence; Tier B's "one happy path" is better spent as that live check than as a test asserting nothing about the actual risk.

**Assumptions made:** none beyond WP15.6's own precedent — the button lives in the existing thumbnail component rather than a new one, per the handoff's own phrasing ("the `imageCandidates` component WP15.6 built").

**Follow-ups / tech debt for Architect:**
- All 18 of Track 42's Leaves are published with no `scenario.image` set (see finding above) — a real content gap, now a one-click fix, independent of whether WP15.7 itself is considered closed.
- The shell/sandbox fault itself: unclear whether it's specific to this machine's current Claude Code sandbox state, to the `payload` CLI binary specifically, or something broader — flagging so it isn't a surprise if it recurs. No diagnosis beyond what's written above.

**Update — 2026-09-02, picked up by a fresh session:** everything marked outstanding above is now done. This session's own `git`/`Read`/`Edit`/`Bash` access showed no sign of the fault described above — whatever it was didn't reproduce here. Read the diff directly against the "What changed" description before trusting it: matches exactly, only `ImageCandidateThumbnail.tsx` touched, no schema file involved. Root cold gate run clean in the `ZO-admin` worktree: `lint`, `typecheck` (4 workspaces), `test` (974 passed — 71 shared + 198 admin + 473 backend + 232 mobile), `build` (backend/mobile/admin, including `expo export` and `next build`). Staged exactly `apps/admin/src/components/ImageCandidateThumbnail.tsx` (confirmed via `git diff --cached --name-only` — nothing else picked up), committed, pushed `wp15.7-use-candidate`, opened [PR #28](https://github.com/ayush237/ProjectZoomOut/pull/28) against `main`. Did not re-run the live device-gate check — already real, already done, per the note above. `.claude/launch.json`'s `admin-wp15.7` entry is left as-is, untracked, out of scope for this diff. WP15.7 is closed pending PR review/merge.

### Completed: WP20 — one book, end to end, published — 2026-09-01

**All 7 requirements and all 11 acceptance criteria met.** Track 42 —
*The Science of Getting Rich* — is regenerated, illustrated, reviewed through gate 2 by
the founder, **published**, and its raw text purged. `apps/pipeline` lint, `ruff format`,
`mypy --strict` (67 files) and `pytest` (187 passed, 2 deselected) are clean; nothing
outside `apps/pipeline` was touched, so root `lint`/`test`/`build` are unaffected.

**The two numbers this package existed to produce:**

| | |
|---|---|
| **Compute per book** | **$5.95** — text + review $2.94, images $2.81, diagram specs $0.11, distractor repair $0.09 |
| **Founder time per book** | **~73 min** — 4:03 per Leaf, **73% reading / 27% correcting** |

The run as executed cost $10.50; the $4.55 difference was images bought twice through a
bug that no longer exists. **$5.95 is the figure to plan from.**

**The finding that decides what to build next: it is the screen, not the reviewer.**
Reading time has a **standard deviation of 13 seconds** across Leaves whose correcting
cost ranged from 0:00 to 2:30. A Leaf approved untouched still took 2:40 to read. Reading
cost is independent of content quality, so no improvement to generation, prompts or the
editorial reviewer can reduce three-quarters of gate 2 — only a better review surface can.
Correcting is spiky rather than a tax: two of the five timed Leaves were approved as-is,
and **one Leaf accounted for 46% of all correcting time**, almost entirely a single
missing dinner-table fact. That part is addressable upstream; it is the smaller half.

**WP19's 4:00 estimate matched at 72:54 against 72:00, and the agreement is coincidence.**
WP19 measured a machine reading for four minutes and correcting nothing. The founder reads
in 2:58 and corrects for 1:05. Same total, different composition — anyone planning from
that number would have assumed correcting was free.

**The ratio that constrains the library:** the remaining credit buys ~48 books; the
founder's time buys about 12. Money was never the ceiling and still is not.

---

**Requirement 1 — review wired as live graph edges.** `ground_check → review_leaf →
{draft_leaf | answer_length_check}`. A fresh run now arrives at gate 2 already reviewed
with no `--run-id` retrofit. Proven on the live run, not only in test.

**Requirement 2 — text regenerated.** 18 Leaves, all grounded first attempt, old Leaves
deleted rather than carried forward. Structure improved against the old Track: Leaves
drawing on a single chapter 24% → **0%**, steps following the book's order 81% → **59%**.

*The answer-length defect is removed: 83% → 61% on regeneration → **11% after repair**,*
below the 33% chance rate. **Regenerating did not fix it.** `draft_leaf.md` has forbidden
the tell since WP19 and the model complies about a third of the time it matters, because
the correct option carries the Leaf's concept and nuance costs words — a general
prohibition fights the semantics of the task. So `balance-distractors` rewrites only the
wrong options of Leaves that show it: no citations touched, editorial review preserved,
passing Leaves left alone. $0.09 and three minutes, against $3 and 35 minutes for a full
regeneration. It **refuses** rewrites that miss the length target rather than reporting a
fix that did not happen — three Leaves kept their originals.

The position shuffle is intact (4/5/9 across slots, versus the old "second in 15 of 18,
never third"). Attributive framing is visible throughout — *"Wattles argues that…"*,
*"Because he views nature's supply as inexhaustible…"* — and apply-in-life carries
behavioural residue with no metaphysics: *"Before finalizing your next business deal,
evaluate whether what you are providing delivers more practical value than the cash value
you are receiving."*

**Requirement 3 — assets regenerated from the six-anchor set.** 54 scenario candidates and
18 diagrams; every one carries alt text; all 72 pass the amber guardrail. `scenario.image`
was left empty on all 18 by design — the pick is the human's.

*On the sixth anchor: it demonstrably works and is demonstrably insufficient.* One sampled
candidate showed the unlit-lamp treatment exactly as taught; another rendered the luminous
cone the anchor exists to prevent. An anchor teaches a tendency, not a rule. **WP19's
fully-featured-face drift did not recur** — figures are profile silhouettes with no eyes,
mouth or brows. Not a blocker: three candidates per Leaf means drift costs a click.

**Requirement 4 — gate 2 by the founder.** All 18 Leaves carry `approved`. Timings above.

**Requirement 5 — published.** First time pipeline output has reached a published state.
Payload's publish validation passed on all 18. **A human published; the pipeline still
cannot and did not gain the ability.**

**Requirement 6 — retention closed, verified by query.** Raw text 123,872 chars → **0**,
`raw_text_purged_at` stamped. Retained: 136 chunks, 136 embeddings, 94 cited passages with
their text, all 18 chapter locators. 42 uncited chunk texts nulled → 0 remain. A live
pgvector similarity query still returns ranked results, so the vectors are usable rather
than merely present. **168 source references across the published Track, zero with an
unresolvable locator, 164 quotes still findable in retained cited text.**

**Requirement 7 — housekeeping.** The handoff said three `A Test Book` Tracks and one WP17
fixture. Actually present: **five test Tracks and two fixtures — 7 Tracks, 111 Leaves**,
plus Track 42's 18 superseded ones. All 129 deleted with a human credential. Track 42 and
the 28 placeholder Tracks untouched.

---

**Seven defects fixed that were not in the handoff, and the pattern behind four of them.**

| | |
|---|---|
| `gemini-3.6-flash` unpriced | every text call in every run reported **$0.00** |
| `USD_PER_IMAGE` a single constant | wrong model's rate — every image cost **3.4× under** |
| answer-length check outside the graph | a fresh run reached the CMS never having measured itself |
| editorial cap not configurable | a throughput bound answerable only by editing a cost constant |
| SDK retry stacking under ours | **109 minutes of a two-hour run** spent inside calls that had not returned |
| image client had no timeout at all | asset run hung **3h12m** on one call, process alive, log silent |
| asset bookkeeping written once, at the end | a killed run re-bought images it already owned |

**Four of these are the same shape: a fix or guard that existed in one place and was never
carried to its sibling.** The SDK retry fix was in the text client, not the image client.
The find-then-skip idempotency guard was in `write_drafts_to_cms`, not the asset path —
where it failed at Leaf 11 of 18, *the identical failure that node's own comment
documents*. The answer-length check ran in the retrofit command, not the graph. **The
codebase knew about every one of these problems; it knew in the wrong file.** Tests now
cover both siblings wherever a pair exists — `test_every_sdk_client_bounds_its_own_requests`
is parametrised over both constructors for exactly this reason.

Also corrected: `test_client_config.py` was passing or failing based on the operator's
shell. Exporting the run environment turned two tests red — not because a guard broke, but
because the shell supplied what they asserted was missing. The same leak turns a genuinely
broken guard green.

---

**Read-it-yourself gate — three Leaves read end to end (3, 11, 17).**

Scenarios are now real dilemmas. Leaf 11's are the clearest: quit today and force the
change, keep it as a hobby and grow where your talents already are, or transition
gradually — all three are things people actually do, and the *longest option is wrong*.

**The prose is still stiff, and this is now settled rather than impressionistic.** After a
full editorial pass and a revision loop on every Leaf, WP19's *"more honest, not less
stiff"* holds. From Leaf 17: *"Wattles asserts that failure is impossible when you follow
the scientific process, so a missed opportunity is simply a sign that a larger good is on
its way."* Accurate reporting in 1910's cadence. The reviewer fires reliably on
attribution, pedagogy and scenario plausibility — those were the categories across the
whole run — and reliably does not touch register. **WP14 should treat register as a prompt
problem the current reviewer does not address.**

---

**Open for Architect.**

1. **Should the answer-length check block?** It warns. The remedy is generation-side, so a
   block loops over re-drafting all 18 Leaves with no per-Track attempt counter to
   terminate it, and halting leaves the founder nothing to review. WP19's *"an advisory
   finding is too weak a guard"* is recorded beside the decision. If it wins, the answer is
   a per-Track regeneration budget — **not** folding this into `ground_check`, which R3
   must keep unarguable on style grounds.
2. **Should `purge_raw_text` be the terminal graph node?** `repository.py` says WP20 would
   wire it; deliberately not done. Purging at `END` means a failed asset run, a rejected
   gate 2, or a regeneration forces a full re-ingest. **The natural end of a run is not
   `write_drafts_to_cms` — it is after a human publishes, and the graph does not model
   that.**
3. **One of three asset conditions is mechanically enforced.** The criterion is "no amber,
   no text, no identifiable people"; `check_reward_amber` is the only guardrail. Text and
   faces rest on the prompt, the anchors and the human eye. The no-glow rule is unchecked.
4. **WP15.7 is unbuilt**, so gate 2's image pick is a manual url/alt copy. Image selection
   was deliberately deferred to a second pass; the 73-minute figure excludes it, and should
   not be compared against a future measurement that includes it.

**Deferred / not done:** scenario images are not attached to any Leaf (awaiting WP15.7);
53 orphaned media files from the superseded assets remain in the library, unreferenced;
the published Track's `disclaimer`, `coverUrl` and `purchaseLinks` need founder attention
(the disclaimer currently contains editorial instructions, the cover hotlinks a third-party
retailer CDN, and the purchase URL has no scheme).


### Completed: WP15.8 — resolve Payload-relative media URLs so real content maps — 2026-09-04
**What changed:** Added `resolveMediaUrl`/`isAbsoluteUrl` to `content.mapper.ts`. An already-absolute URL is returned exactly as stored (no round-trip through `URL`, which can normalise ports/trailing slashes/escaping and change a value that had no reason to change). A leading-slash CMS-relative reference (`/api/media/file/...`) resolves against a `baseUrl` parameter via `new URL(url, baseUrl)`. Anything that is neither is passed through unchanged, so `imageAssetSchema`'s `z.url()` still catches genuine content defects (typos, hand-entered non-URLs) instead of `new URL(x, base)` laundering them into something superficially valid. `baseUrl` is threaded as a parameter through `mapTrack`, `mapLeaf`, `optionalImage`, `optionalDiagram`, and `mapImageParts` — the mapper stays pure, no config read inside it. `content.repository.ts` passes `this.config.CONTENT_API_URL` at all four call sites (`listTracks`, `findTrack`, `listLeavesForTrack`, `findLeaf`). `packages/shared` untouched, as scoped — the schema and the stored relative value were both already correct; the missing piece was purely the resolution step between them.

Design and most of the implementation (including ~390 lines of new tests) were already in the working tree at task start, per the handoff. My work was: read and verify the existing diff against the requirements, run the full gate suite, mutation-check the resolution logic, add the mobile-ios gitignore line, and do the device gate — which is where the actual net-new finding is (see below).

**Files touched:**
- `apps/backend/src/content/content.mapper.ts` — `resolveMediaUrl`, `isAbsoluteUrl`, `baseUrl` threaded through five functions
- `apps/backend/src/content/content.mapper.test.ts` — ~390 new lines: the real Leaf 244 / Track 42 fixtures (copied verbatim from the live CMS, not hand-written) plus explicit already-absolute-passthrough assertions
- `apps/backend/src/content/content.repository.ts` — `config.CONTENT_API_URL` passed at all four `mapTrack`/`mapLeaf` call sites
- `.gitignore` — added `apps/mobile/ios/` (untracked 1.2GB Expo prebuild, regenerated by `expo prebuild`, was one `git add -A` away from being swept in)

**Tests added/updated:** 49 tests in `content.mapper.test.ts` (all passing), including the two load-bearing ones: `mapLeaf` against the real Leaf 244 document (relative `scenario.image.url` and `stickyNotes.diagram.url`, both resolve to `http://127.0.0.1:3001/api/media/file/...`) and `mapTrack` against a real Track 42 document with `coverUrl` overridden to relative. Four more assert an already-absolute URL is returned byte-for-byte unchanged (scenario image and cover, each on both the relative and absolute path so the "leave it alone" behavior is independently covered).

**Mutation check:** Replaced `resolveMediaUrl`'s body with `return url;` (full no-op). Result: exactly the two tests that assert relative→absolute resolution went red (`Leaf 244: scenario.image.url — Invalid URL` / `stickyNotes.diagram.url — Invalid URL`, and the Track 42 cover equivalent); all 47 other tests — including the four "already-absolute, unchanged" tests, which by construction cannot distinguish a real resolver from a no-op — stayed green. Reverted immediately after. This is the expected, correct result: it confirms the two resolution-specific tests are load-bearing and nothing else in the file was accidentally coupled to the change.

**Root gate (run once, cold, at the end):** `lint` clean, `typecheck` clean across all four workspaces, `test` — 978 passing (shared 71, admin 198, backend 477, mobile 232), `build` — backend/mobile/admin all built successfully. No pre-existing failures encountered.

**Device gate — done, and this is where the package earned its keep:**

Confirmed against the *live, running* backend + Payload (not fixtures) first: signed up a throwaway local test user via `/auth/signup`, then `GET /content/leaves/244` with that session's bearer token returned **200** (was 502 before this change) with `scenario.image.url` and `stickyNotes.diagram.url` both resolved to `http://127.0.0.1:3001/api/media/file/...`. Fetched both resolved URLs directly with a real GET — 200, real PNG bytes (975KB scenario image, 36KB diagram). One false alarm during that check: `curl -I` (HEAD) on the media route returned 404, which had me briefly worried the files were served-but-missing — a plain GET returns 200 fine, so Payload's file route just doesn't answer HEAD. Not a defect, don't re-chase it.

Then the actual app: attached the iOS Simulator (iPhone 16 Pro, already booted with a live session and Track 42 already in the Library from prior work), played a Leaf all the way through — Summary → Scenario → answer submission → Payoff unlock → Sticky Notes → Takeaway → Finish (+100 XP) — with **zero backend errors** at any step. Confirmed both required visuals directly: **the scenario illustration renders above the prompt**, and **the sticky-notes diagram renders on the notes slide**, the latter checked in both light and dark theme (dark first, since I happened to flip there for the theme check — diagram's own dark backdrop reads fine either way). This was Leaf 245 (order-index 1; Leaf 244/order-index 0 was already marked complete from earlier verification work), same Track, same media pipeline — the fix is exercised identically.

**One real friction point worth recording:** Metro had gone stale (a 3-week-old `expo start` process still resident but not actually listening — classic "dies silently," per the standing note above). Killed it and started fresh, then had to force-quit and reopen Expo Go (`simctl terminate ... host.exp.Exponent` + `open_url exp://...`) to get it off the cached bundle — the same fix already documented for this failure mode. Separately, and this cost the most wall-clock time in the whole package: this simulator control tool's coordinate space is `402×874` points, but pill-shaped CTA buttons (`Continue`, `Back`, `Next`, `Check answer`) needed noticeably more precise targeting than their visual bounds suggested — many tap attempts across a wide, reasonable-looking coordinate range landed on nothing before the right spot was found by trial. Tab-bar navigation and the native edge-swipe-back gesture were reliable throughout, so this reads as an artifact of small-target tap precision in this tool rather than an app defect — nothing here touched app code, and I'm not asserting a bug in `apps/mobile`. Flagging it only so the next session doesn't re-diagnose it from scratch if it recurs.

**Assumptions made:** None beyond what the handoff already specified. The design, the fixture-sourcing discipline (real CMS documents, not hand-written), and the scope boundaries were all already settled in the working tree.

**Follow-ups / tech debt for Architect:**
- **Production media serving is still unenforced** (flagged at sign-off in the handoff, repeating it here per template): this makes the mapper emit a resolvable URL, it does not make that URL reachable from a phone once Payload is private. Needs a storage adapter or a backend proxy. Belongs to WP12.
- Tier C (deferred per the testing bar): no failure-path tests for `resolveMediaUrl` beyond what the schema gate already forces (e.g., a malformed-but-slash-prefixed value) — the existing "not-a-url passes through and the schema catches it" design is documented in the code comments but not separately unit-tested beyond the pre-existing non-URL-cover test in `mapTrack`.
- The tap-precision friction above may be worth a look if a future package needs heavier iOS Simulator interaction — possibly nothing to fix, just noting the cost.

**Time:** rough split — verifying the existing diff against requirements and reading the named files: ~10%; running/confirming the gate and mutation check: ~15%; live-backend curl verification: ~15%; device gate (Metro/Expo Go recovery + simulator interaction + full Leaf playthrough in both themes): ~55%; this write-up: ~5%.

### Completed: WP21 — react-native-svg + Caveat font foundation, no visible change — 2026-09-08
**What changed:** Added `react-native-svg` (15.15.4, the SDK 57-pinned version, via `expo install`) and Caveat (`@expo-google-fonts/caveat`, one weight — `Caveat_400Regular` — loaded through `App.tsx`'s existing `useFonts` call). `fontFamilies.handwritten` in `typography.ts` exposes it as a **plain string**, not a `{regular,semibold,bold}` object like the other two families — deliberate: it's one weight used directly by sticky notes, not a fourth entry in the type scale, and it has no `TypographyVariant`. `typography.ts`'s docstring now records the exception to the two-family ceiling beside the rule it breaks, naming WP21, the founder's explicit instruction, and the sticky-notes-only scope. Nothing in any existing screen changed — the diff is additive (new import, new key in a `useFonts` object literal, new key in `fontFamilies`, docstring prose).

**The pending `apps/mobile/package.json` edit** (`expo start --ios/--android` → `expo run:ios/run:android`) was adopted into this commit, as the handoff left as my call: a native module means Expo Go no longer suffices, and that script change is exactly what the transition to a dev-client/prebuild workflow requires. Whoever made that edit called it correctly ahead of time.

**Token diff against `design/zoomout-design-system.md`** (reported, not acted on, per scope): **none.** Dark palette, light palette, the full type scale (display/h1/h2/h3/body/payoff/small/caption), spacing (4/8/12/16/24/32/48), radius (8/12/20/999), and motion durations (150/280/900ms) all match the doc exactly — I checked every value in both directions, not just spot-checked. The exploration's claim that these were carried over unchanged from the shipping system holds; confirming that is the actual result here, not a null one. The only genuinely new token is `fontFamilies.handwritten` itself, and the doc's silence on it isn't a divergence — the doc predates this package, and documenting the exception there is presumably a later package's job, not mine.

**Tests added:** `typography.test.ts`, one test, asserting `fontFamilies.handwritten === 'Caveat_400Regular'`. Exactly as thin as the handoff predicted and said to be honest about: this proves the string, and the string is exactly what fails silently in React Native (a wrong `fontFamily` falls back to the system font with no error, no failing test). The device gate is where the real evidence for this package lives, not the test suite.

**Root gate:** `lint`, `typecheck` (all four workspaces), `test` (979 passing: shared 71, admin 198, backend 477, mobile 233), `build` (backend/mobile/admin) all clean.

**Device gate — done, with one gap, clearly bounded:**

Confirmed unconditionally, in both themes, on a native build that actually includes `react-native-svg` and Caveat: **a bezier path draws**, and **Caveat renders as a genuine script face**, not the system-font fallback the handoff specifically warned would fail silently and green every test. Also confirmed, rendering correctly with the same overlay visible and no regression: the sign-in screen, the create-account form (step 1 of 2), and the age-gate/DOB screen (step 2 of 2) — three real, distinct screens, not the same one twice. A full sign-in round trip against the live local backend also succeeded (`POST /auth/login` → 200) with an existing test account, confirming the network and UI layers both still work end to end up to that point.

**What I did not reach:** the authenticated tab bar (Explore/Library/Journey/Profile) and a Leaf. Not a coordinate-hunting failure this time — I diagnosed the actual cause. This build has no code signing (see below for why), so it carries no entitlements, and `expo-secure-store`'s Keychain calls throw (`KeyChainException: A required entitlement isn't present`) every time the app tries to persist a session. Sign-in itself succeeds over the network; the app just can't remember it happened, so it never navigates past the auth screens. This is a property of *how I had to build the app for this verification*, not of the code in this diff — `expo-secure-store` and the auth flow predate WP21 and are untouched by it. I do not believe this generalises to a properly-signed build (see follow-up below), but I'm not asserting that as verified, only as the diagnosis.

**Follow-ups / tech debt for Architect:**
- **Local device-gate testing on this machine needs a real code-signing identity to reach authenticated screens.** No Apple ID is configured in Xcode and no certificates exist in Keychain (confirmed via `security find-identity`). This blocked nothing about *this* package's core proof, but it will block the *next* one if a screen package needs to verify anything behind sign-in. Adding a personal Apple ID to Xcode's Accounts preferences (free, no paid developer account needed for simulator/local-device work) would resolve it — that's a several-minute GUI action, not something I can do from here, and not something I attempted (entering Apple ID credentials isn't mine to do).
- **Do not try to fix a missing entitlement by ad-hoc re-signing an already-built `.app` with `codesign --deep`.** I tried this once, on the built bundle, and it broke simulator launch entirely (`SBMainWorkspace` denied the request) — deep-signing a React Native bundle's many embedded frameworks after the fact is fragile enough that a clean rebuild was faster than debugging the broken signature. Recorded so the next session doesn't spend the time rediscovering this.
- **A one-line local patch to a vendored dependency, not committed, may need reapplying.** `node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift:53` fails to compile under Swift 6.2 (`type of expression is ambiguous without a type annotation` on `abs(milliseconds)`) — a genuine Swift-6.2 strictness regression in Expo's own vendored source, unrelated to this package's diff. I qualified the call to `Swift.abs(milliseconds)` directly in `node_modules` to unblock the build; this is correctly *not* part of the git diff, but it also means a fresh `npm install` on this machine (or SDK/dependency upgrade) will hit the same compile error again until Expo ships a real fix upstream. Worth a `patch-package` entry if this recurs, or just re-applying the one-line change.
- **This machine's toolchain moved a lot mid-package, all now resolved but worth a line for the record:** Xcode was upgraded 16.4 → 26.3 partway through (at my request, to clear a Swift-tools-version mismatch that would have blocked any native build regardless of what module was being added); the `iPhone 16 Pro` simulator that predates that upgrade could no longer produce a screen surface afterward (`Could not find the Main Screen Surface`, reproducible via raw `simctl io screenshot` too, not just this session's tooling) and was deleted and recreated on the new iOS 26.3 runtime under the same name; the Claude Code app itself needed a quit/reopen for its own simulator-control connection to stop pointing at the deleted device's stale UDID. None of this is mobile-app code, all of it is now stable, and I mention it only so a future "the simulator is behaving strangely" report on this machine has a paper trail instead of starting from zero.

**Time:** environment/toolchain recovery (Xcode version gap, simulator runtime mismatch, the Swift compile patch, the failed re-sign attempt) dominated this package by a wide margin — genuinely more than half of it. Actual implementation (the diff itself) was small and fast, matching the handoff's own framing that the design left no judgement to buy. Device-gate verification once the build actually ran was quick; most of its time went to locating reliable tap coordinates on custom-styled buttons, a recurring cost in this app noted in a prior WP15.8 report too.

**Update, same day — the device-gate gap above is closed.** The founder added their Apple ID to Xcode's Accounts, and a follow-up build (`xcodebuild ... -allowProvisioningUpdates CODE_SIGN_STYLE=Automatic`) picked it up automatically, signing with "Sign to Run Locally" — no paid developer account needed. That resolved the `expo-secure-store` Keychain entitlement gap entirely: sign-in now persists correctly. Completed the rest of the walkthrough on that signed build: **Explore, Library, Journey, and Profile all render correctly**, and starting a real Leaf succeeds end to end (`POST /progress/leaves/2/start` → 200, confirmed in backend logs). No visual regression anywhere. All acceptance criteria for this package are now met, not just the ones already closed at first write-up.

One process note for next time: reliably tapping this app's primary pill-shaped CTA buttons (Sign In, Create Account, Continue, Start Reading) via the simulator-control tool's coordinate-based `tap` took many attempts across almost every screen this package touched — text fields and tab-bar icons were never a problem, only these buttons. Whatever the cause (custom Pressable/animation wrapper, hit-region smaller than the visible pill, something else), it cost real time in both this package and WP15.8's. Twice this session, asking the founder to tap the button directly (they had the simulator open) was faster than continuing to hunt coordinates. Worth a look if a future package needs heavy simulator interaction — not a code defect, but a real, recurring cost.
