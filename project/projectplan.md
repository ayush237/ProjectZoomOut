# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## The design exploration is complete — 2026-09-06

WP15.8 signed off and merged 2026-09-02 (see roadmap). Since then, a visual-redesign exploration ran directly on `main` — not a work package, no handoff, per `agents/architect.md`'s own scope for design docs under active exploration. It is now done: all 14 app surfaces the plan named are built as clickable mockups in Claude Design (project "ZoomOut Track Roadmap"), plus a published design system (94 tokens, 20 components). Entry point and full history: `design/RESUME-HERE.md`.

**What exists now that didn't a week ago:** a knowledge-graph/neuron visual language covering onboarding, sign-in/sign-up, the track roadmap, the 5-slide Leaf player (including a redesigned sticky-notes board — physical notes pinned to a textured board, not flat cards), session-end plus the daily-cap state, achievement unlock, report-an-error plus failure states, track-complete, and the share card (light-theme, for social). Every screen has a still plus, where the moment needs it, a multi-frame sequence showing how it arrives.

**Two real dependencies this creates, neither yet in the codebase:**
- **`react-native-svg`** — the entire visual language is bezier curves (the track roadmap's dendritic connections, the meandering spine). `apps/mobile` has `react-native-reanimated` but no SVG/Skia today. Recommended over Skia because it's a first-party Expo SDK package and the direction deliberately avoids the lighting effects Skia would be for.
- **A new font token, `--font-handwritten`** (Caveat, via Google Fonts) — added to the design system scoped explicitly to sticky-note text, on the founder's explicit instruction, after the design system was confirmed to otherwise carry only Nunito/Nunito Sans. Every other surface is unaffected.

Both are recorded in the debt register below as **required, not yet built** — not blocking anything today, but whoever scopes the implementation work must carry them; neither should be rediscovered mid-package.

**None of this has touched `apps/mobile`.** It is a complete design reference, disconnected from the running app, which already works end-to-end against the *current* (un-redesigned) visual language.

## The decision — three independent threads, one founder's attention

**1. Implement the redesign in `apps/mobile`.** The largest of the three by far. This is not a single work package — it's a full re-skin of an app that already works and is already tested (932+ tests, device-verified through WP0–WP11), across 14 screens, plus a new rendering primitive the app doesn't have today. Done carelessly, it's the highest-risk item on this list: a big-bang rewrite risks the regressions the tiered testing bar exists to catch. Done properly, it needs its own sequenced plan — foundation (SVG + font + ported design-system primitives) before core-loop screens (roadmap, Leaf player) before secondary screens (auth, achievements, errors) before growth screens (track-complete, share-card) — each stage device-gated before the next starts. **I have not written that plan yet. It's real work, and it deserves the same rigor as any other package, not a casual handoff because the mockups already exist.**

**2. The second book — still standing, unchanged by any of this.** Every pipeline number this project owns still comes from one text (Wattles). Public-domain, structurally unlike Wattles, sidesteps the curation-policy blocker entirely. See below for the unchanged reasoning.

**3. WP12 — deployment — still parked, still Stage 1 of `launch-blockers.md`.** Unchanged reasoning below.

**These three don't fully compete.** The second book is Pipeline Manager's time, not Manager's — it can run in parallel with whichever of (1) or (2) Manager picks up. (1) and (3) do compete: they're both Manager, sequential.

**My recommendation: let the second book run now regardless — it's cheap, independent, and has been waiting since WP16.1. For Manager's next single-threaded package, I'd plan the redesign implementation before WP12.** The redesign is what the founder has just spent real time and attention on; letting that momentum go cold costs more than deployment slipping another cycle, and nothing about WP12 gets harder by waiting — it's the same argument that already justified deprioritizing it once. But this is the founder's call, not mine to make unilaterally: WP12 is real, and "the founder wants to see the new design working" is a legitimate reason to disagree with that ordering.

**If the redesign goes first: say so and I'll write the actual implementation plan** — reading the current `apps/mobile` screen implementations against the new mockups first, so the plan reflects the real gap rather than an assumption. That reading is what the next session should spend its budget on, not re-deriving what's already settled above.

### Why not WP12 first (unchanged reasoning, still holds)

Deployment carries the one genuine security hole: Payload's REST API serves the payoff and the answer key anonymously, so an exposed CMS makes the unlock gate bypassable, and today "private networking" is a comment in one file. That is real and it is why WP12 is Stage 1 in `launch-blockers.md`.

**But it is not urgent in the way it looks.** No users exist, nothing is deployed, and the hole is a property of being deployed rather than of the code. WP12 is also the longest package on the list, it needs a domain and the founder's new GCP account, and **it produces nothing a reader could open** — the library would still be 27 placeholder Tracks and one real book.

### Why the second book, specifically (unchanged reasoning, still holds)

**Every pipeline number this project owns comes from a single text** — structure-check thresholds, prompt quality, the model comparison, cost per Track, the 3–4 sticky-note clustering, and the 73-minute gate 2 figure. Wattles is short, aphoristic, and from 1910. A second, structurally different book is the cheapest way to learn which of those findings describe the pipeline and which describe *The Science of Getting Rich*. **Why public domain, specifically: it takes the blocking decision off the table** — the curation policy has been open since the brief and is founder item 2, and a public-domain title needs none of it.

### Standing blocker to design around, not to solve now

**The answer-length publish-time check does not exist.** Warn-only is correct while the founder is the only reader, and it stops being correct the moment a Track is visible to anyone else. **Its trigger is WP12, not the next book or the redesign** — whoever writes WP12's handoff must carry it.

## What was true at the end of Phase 2 that was not obvious at the start

- **The constraint is founder hours, not money.** ~$6 of compute a book against ~73 minutes of gate 2 review. Every cost estimate made before WP20 was wrong, in one case because an unpriced model reported $0.00 and that was read as a total rather than as a broken instrument.
- **Three-quarters of gate 2 is reading, and reading does not get cheaper.** Reading time has a standard deviation of 13 seconds across Leaves whose correcting ranged from zero to 2:30. No improvement to generation, prompts or the editorial reviewer can touch it — only a better review surface can.
- **A fix belongs everywhere its concern has a sibling.** Four of WP20's seven defects were one-sided: a retry fix in the text client and not the image client, an idempotency guard in one write path and not the other. The codebase knew about every one of them; it knew in the wrong file.
- **Guardrail language outran guardrail coverage four times.** One mechanical check out of four stated image conditions, described in the plural. Ruled 2026-09-02 into a naming rule.
- **Manual verification kept finding what tests could not**, through both phases — a flagship Track invisible behind pagination, an app pinned to light mode for six packages, a citation silently pointing at the wrong chapter, and 44% of first-choice images breaching a style rule no test could see.
