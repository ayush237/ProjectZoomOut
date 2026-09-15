# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Active: the paid-tier check — ruled 2026-09-15, not yet handed off

**This jumped the queue and the reason is not code quality.** `config.py` states that `require_paid_tier` *"turns that from a memory into a check."* **That function does not exist anywhere in the repo** — confirmed by grep against `origin/main`; `paid_tier` is read by no code at all and survives only in two comments. Google's free tier trains on submitted content, so this is the control that keeps copyrighted books off it, and right now it is prose.

**Ikigai already ran.** It ran correctly — Pipeline Manager used Vertex with the API key unset and verified the transport before the first paid call — **but nothing in the repo records that**, so the claim cannot be checked after the fact and never will be. The next session will not know to do any of it.

**Two design points for the package.** Key the check off the Track's `acquisition` status rather than a hand-set bool: `public-domain` may use the free tier, everything else must be Vertex. A flag someone has to remember to set is the failure this already is. And **the run must record its transport**, so provenance is a query rather than a memory — the same argument that produced the `acquisition` field.

**Interim, until it exists:** run nothing without `USE_VERTEX=true` and the Gemini API key unset from the process.

### Queued behind it, in order

1. **The output-side image detector** — text, glow and floating iconography in generated images. It now owns three things: Ikigai Leaves 3 and 7, Track 42's published Leaf 1 (which renders "$10K" and "$2K" legibly *and* carries a glow, live), and the light-rule rewrite ruled below.
2. **The grounding gate's false reject** — an em dash before a PDF line break makes an honest quote fail to match. Safe direction, but it thins the audit trail, and the audit trail is the legal artefact. **Before book #3.**
3. **The gate-1 named-framework flag** — flag any planned Leaf whose `source_chapters` include a chapter that is itself a named framework.

### The light ruling, because it changes what "correct" means

`asset_style.md` forbids *"a shaft of light thrown across a surface"* while the whole library — and the committed anchors — draw cast light. **The line is falloff, not subject matter:** cast light may be a flat, hard-edged shape of a lighter surface value; no gradient, bloom, halo or emissive source. That matches the rule's own origin (added after an anchor came back as a luminous cone that "cannot be reproduced consistently"), keeps the library legal, and **leaves Leaf 3's phone glow a real breach** — a ruling that excused it would have been the wrong ruling.

**Still open alongside:** WP29 (Manager, the Leaf player's footer) · WP26.1 (proposed, unanswered) · WP27's PR #40, mergeable and CI-green, waiting on a click · **the in-app observation of draft content, now blocked twice.**

---

## Completed: WP30.1 — finish Ikigai's images inside the credit, and fix Leaf 17 — 2026-09-15

**WP30 is signed off at 7 of 9.** The generator works and Ikigai's text exists — Track 50, 18 draft Leaves, nothing published, 134/134 source references with locators, and the shuffle confirmed working at 6/5/7 across A/B/C where Track 42 was position B on 15 of 18. **Both unmet criteria have a single cause: no Ikigai images were ever generated**, because spend hit $10.07 and stopped.

**WP30.1 finishes it on the existing Google Cloud credit**, which the founder has confirmed covers the remaining work. $5 ceiling. Eighteen images at one candidate each is $2.41; one candidate rather than gate 2's three is deliberate, because the new variety check catches collapse mechanically and that was most of what the extra candidates were for.

**Leaf 17 is rewritten first, and the order is not arbitrary.** It lifts three of the book's *"ten rules of ikigai"* in the book's own imperative phrasing — a named-framework breach that passed every mechanical gate, because the 1:1 check measures chapter mapping and cannot see phrasing. Rewriting it changes its scenario, which changes its derived setting, which changes its image; generate first and that image is bought twice.

**One criterion in WP30 was unmeetable as written, and that was mine.** The handoff required Ikigai to stay a draft *and* required an Ikigai Leaf observed in the app. `contentVisibility.ts` makes a draft unservable in **every** environment, deliberately — so closing that gap needs a backend change the same handoff excluded. WP30.1 replaces the device gate with an observation of the images themselves, and the in-app check is deferred to publication rather than dropped.

**Three packages are queued behind this**, all deliberately kept out so they cannot put a credit-bound run at risk: an **output-side text and glow detector** (Track 42's published Leaf 1 renders "$10K" and "$2K" legibly *and* carries a glow — two absolute prohibitions, live); a **per-Track text budget that refuses** rather than warns; and a **gate-1 flag** for any plan that puts a Leaf on the chapter holding a named framework.

**Still open alongside it:** WP29 (Manager, the Leaf player's footer) · WP26.1 (proposed, unanswered) · WP27's PR #40, now mergeable and waiting on a click.

---

## Completed: WP30 — Ikigai end to end, and the scenario-image fix — handed off 2026-09-11

**Book #2 is the active feature.** *Ikigai* (`ZO-admin/booksSource/Ikigai.pdf`) goes through the existing pipeline, and it carries a defect fix the founder found by looking at the app: **Track 42's eighteen scenario images are all a seated figure at a table in a dim interior**, whatever the scenario.

**One package, two halves, sequenced — and the sequence is the point.** Half A fixes and *proves* the image generator on a four-image before/after against Track 42's own scenario text, where the content already exists and only image spend is at risk. Half B then runs Ikigai once, with a generator that is known to work. Reversed, the eighteen-image spend gets paid twice.

**The diagnosis, verified against the live CMS rather than inferred.** Four causes, none of them the scenario prose: the image prompt never names a *place*; `asset_style.md`'s subject list is four-fifths people-at-tables; five of the six committed anchors are seated interiors, and a reference image carries environment as well as palette; and nothing in the pipeline ever sees the whole set, so collapse is structurally undetectable.

**The judgement call inside it is the anchor set** — it is what makes the library cohere, and a careless change trades sameness for the AI-slop drift the founder ruled against. That is why this is an Opus package.

**Two founder rulings carried into the handoff.** Ikigai lands as a **draft, not published** — it is in copyright, building against it was ruled acceptable 2026-08-13, and what ships at launch is still open. And **Track 42's published images are left alone** until the before/after exists, because that comparison is what answers whether to regenerate them.

**Still open alongside it:** WP29 (Manager, the Leaf player's footer) · WP26.1 (proposed, unanswered) · WP27's PR #40, signed off but unmerged.

---

## Completed: the visual redesign, WP21–WP27 — approved 2026-09-06, extended 2026-09-09

*Kept for its two rulings, which still constrain the app.*

The design exploration is complete: all 14 app surfaces exist as clickable mockups in Claude Design plus a published design system. Entry point `design/RESUME-HERE.md`. **Nothing in `apps/mobile` has changed yet.** This plan turns those mockups into the app, and was approved by the founder on 2026-09-06 including both rulings below.

**The redesign is three kinds of work wearing one name, and they carry very different risk.** That is the whole basis of the decomposition.

| | Package | What it is | Model | Status |
|---|---|---|---|---|
| **Layer 1** | **WP21 — foundation** | `react-native-svg`, Caveat font, token diff. **No screen changes** | Sonnet | 📤 **Handed off 2026-09-06** |
| **Layer 2** | **WP22 — Track roadmap** | Net-new screen with a real layout algorithm | **Opus** | ✅ **Signed off 2026-09-09 (10/10)**, PR #32 |
| | **WP22.1 — reduce-motion mechanism** | One flag, one place, four call sites routed through it | Sonnet | ✅ **Signed off 2026-09-09, 6/6** — closed by founder observation 2026-09-10 |
| **Layer 3** | WP23 — the sticky-notes board | Delivered. The re-skin half did not — no spec | Sonnet | ⚠️ **Partial, 2026-09-11**, PR #34 |
| | WP23.1 — the other four slides + the cork board | Unblocked: the spec is now nine screenshots in `design/leaf_player/` | Sonnet | 📤 **Handed off 2026-09-09** |
| | WP24 — auth, age gate, legal surface | Re-skin; all five surfaces exist | Sonnet | ✅ **Signed off (6/8 observed)**, PR #35 |
| | WP25 — achievement unlock, session-end/cap, report-error, failure states | Re-skin; all four exist | Sonnet | 📤 **Handed off 2026-09-09** |
| | WP26 — Track complete + share card | One new screen, one re-skin | Sonnet | 📤 **Handed off 2026-09-10**, blocked on PR #37 |
| | **WP27 — Explore, Library, Journey, Profile** + the icon swap | The gap found 2026-09-09, the last redesign package | Sonnet | ✅ **Signed off 2026-09-10**, PR #40 |

**⚠️ WP27 is signed off but PR #40 is still open as of 2026-09-11**, so the four tab screens on `main` are still the pre-redesign versions — see the roadmap's WP27 row.

**🎨 The redesign is complete as of 2026-09-10** — all fourteen surfaces in the new visual language, seven packages plus four follow-ups. What remains open is listed below, and none of it is redesign work.

Layer 1 is additive and invisible. Layer 3 is screen-by-screen and independently reversible. **Layer 2 is the only genuinely hard package**, and it is the centrepiece of the visual language.

## The two rulings — both decided 2026-09-06

**Ruling 1 — the roadmap becomes `TrackDetailScreen`.** It does not get a new screen, and Journey keeps its per-track card.

The collision this resolves: `TrackDetailScreen.tsx`'s own docstring refuses to be what the roadmap is — *"Deliberately thin. It is not a contents list — Journey and Library already own 'where am I in this'."* The roadmap **is** a contents list, so this was an information-architecture change to a decision WP10 made on purpose, not a visual one. Ruled toward absorption because a reader tapping a book should get the book: two screens that both mean "this book" is a tap the reader has to learn. **The legal pair — disclaimer and purchase-forward link — stays on that screen, below the graph.** It is the only place in the app that renders it today and WP3 makes a Track unservable without it.

**Ruling 2 — the sticky-notes board collapses to a single rotated column above a text-size threshold.** Notes keep their tape, shadow and paper at every size; they lose the scatter at large ones.

The collision this resolves is the sharpest in the redesign, and three things compound in it. `StickyNotesSlide.tsx` records that single-column was chosen *because* multi-column clips: *"at `accessibilityExtraExtraExtraLarge` any two-column arrangement either clips or leaves one column nearly empty — the seeded corpus varies note counts from two to six precisely so that was visible before it shipped."* The new board is exactly the staggered arrangement that finding rejected. On top of that sits the open, deliberately-unfixed debt that absolute `lineHeight` clips app-wide at XXXL, and Caveat renders roughly 1.35× larger. **Ruled toward degrading rather than accepting clipping, because the alternative makes the most decorative screen the one that breaks for the readers who need large text.**

## Findings that shaped the decomposition

- **The roadmap has no counterpart in the app at all.** The nearest thing, `TrackDetailScreen.tsx`, is 96 lines and deliberately not a contents list. So WP22 is a build, not a re-skin.
- **The mockup contains a picture of one instance, not an algorithm.** Its geometry is hardcoded — `{n:1,x:150,y:212}` — for **18 nodes**, and Track 42 has **exactly 18 Leaves**. A package verified against Track 42 alone would pass while proving nothing. `PRODUCT.md` specifies 15–30 Leaves, so **WP22's device gate must open a Track whose Leaf count is not 18.**
- **The share card is nearly free, and its risk is somewhere else.** `ShareCard.tsx` is already forced-light for precisely the reason the mockup gives, already brutal for thumbnail legibility, and already reserves a `MascotSlot` whose docstring says an illustration should drop in by *"replacing the contents of `MascotSlot` and nothing else"* — which is exactly where the constellation fragment goes. **The risk is the capture path**: `collapsable={false}` is load-bearing on Android and has not been re-tested since WP9. WP26's criterion must be about the captured image, not the rendered card.
- **Caveat is a three-line change.** `expo-font` and `@expo-google-fonts/*` are already wired and `App.tsx` gates first paint on `useFonts`.
- **A stale debt entry, corrected by checking.** The register still said `useReducedMotion` was "exported but never called — required fix". It is called in four places today (`AuthStack`, `ScenarioSlide`, `PayoffSlide`, `AchievementUnlock`). The real point survives the correction: the redesign multiplies animated surfaces — two four-frame sequences and the constellation resolve — so **swap-never-remove becomes a per-package criterion rather than a one-off.**

## Alternatives rejected

**A single big-bang re-skin.** One package touching 14 screens has no useful device gate and no way back, against an app that currently works end to end with 12 mobile test files behind it. Six packages each leave a shippable app. The accepted cost is that the app looks half-migrated between WP22 and WP26 — tolerable precisely because nothing is deployed and the founder is the only reader.

**Skia instead of `react-native-svg`.** `react-native-svg` covers every curve in the direction and is a first-party Expo SDK package versioned against the SDK; the direction explicitly rejects the lighting effects Skia exists for. `Icon.tsx` declined an SVG dependency once, but that reasoning was about taking a native dependency for icons alone and does not transfer.

**Building the curve primitive in WP21.** A primitive designed before its only caller exists is a guess. WP22 builds what it actually needs.

## Standing, unchanged by this plan

- **The second book** — still recommended, still Pipeline Manager's time, still runs in parallel with any of this.
- **WP12 deployment** — still parked. Production media serving remains the only thing between Track 42 and a real phone, and the answer-length publish-time check is still WP12's to carry.
