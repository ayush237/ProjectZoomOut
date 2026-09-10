# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Active: the visual redesign, WP21–WP27 — approved 2026-09-06, extended 2026-09-09

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
