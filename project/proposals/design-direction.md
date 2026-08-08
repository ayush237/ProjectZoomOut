# Design Direction — Phase 1

**Status:** Proposed — awaiting founder approval
**Author:** Architect, from a working session with the founder
**Date:** 2026-08-08

Input for **WP6 (mobile shell and design system)**, which is blocked without it. This defines the *system* — tokens, principles, constraints. It does not design screens; see §10 for why that distinction matters.

---

## 1. The decisions this rests on

| Decision | Chosen | Made |
|---|---|---|
| Visual feel | **Playful, gamified** — Duolingo-adjacent | 2026-08-08 |
| Colour scheme | **Dark default**, light supported | 2026-08-08 |
| Mascot | **Not in Phase 1** — slot reserved for later | 2026-08-08 |
| Brand accent | **Cool — teal / cyan** | 2026-08-08 |

## 2. The central tension, and how we resolve it

Playful-gamified normally means saturated fills, hard drop shadows, and bright surfaces. **On dark, that toolkit doesn't work:** shadows are invisible against dark backgrounds, and saturated colour halates and glares.

So the system substitutes:

- **Depth comes from surface lightness, not shadow.** An elevated card is a lighter surface with a hairline border, not a shadow on the same surface.
- **Every accent has a dark-tuned variant.** Colours are not reused across themes — the light-mode teal and the dark-mode teal are different values chosen for their own background.
- **Energy comes from motion, not from colour volume.** A dark app can't carry large saturated fills without fatigue, so playfulness is expressed through spring physics, celebration animation, and sound.

**Two accents, two jobs.** Teal is the brand and the interface — navigation, primary actions, progress. A **warm amber** owns every reward moment: XP, streaks, achievements, celebration. This is what keeps a teal-on-dark app from reading as generic, and it means a reward never competes with the interface for attention.

## 3. Colour

Starting values. Exact hexes get tuned once rendered on a device — screens lie in a way swatches don't — but the *structure* below is the part that matters and should not drift.

**Dark surfaces** (elevation by lightness):
```
surface/0   #0B0F12   app background
surface/1   #141A1E   cards, sheets
surface/2   #1C242A   raised elements, inputs
surface/3   #26313A   pressed states, highest elevation
border      #2E3A44   hairline separation
```

**Primary — teal** (interface, navigation, progress):
```
primary       #3DDCC8
primary/hover #5FE6D5
primary/press #26B8A6
on-primary    #0B0F12   dark text on a luminous fill
```

**Reward — amber** (XP, streaks, achievements, celebration only):
```
reward        #FFB020
reward/soft   #FFC44D
on-reward     #0B0F12
```

**Semantic:**
```
correct       #4ADE80
incorrect     #FF6B6B   softened — pure red glares on dark
text/primary  #F2F5F7
text/muted    #9AAAB5
```

**Two constraints that are not negotiable:**

1. **Never signal by colour alone.** Correct and incorrect answers carry an icon and a motion cue as well as a colour. This is an accessibility requirement, and it also protects the one place it matters most — `correct` green and `primary` teal are adjacent in hue, and a user must never have to distinguish them to know whether they got the answer right.
2. **WCAG AA on dark.** Body text ≥ 4.5:1, large text ≥ 3:1, against the surface it actually sits on. Verify per surface level, not once against `surface/0`.

**Light theme** is built from the same token names with its own values, from day one. Retrofitting a second theme means auditing every screen; defining both up front costs a fraction of that even though dark is the default.

## 4. Typography

One family, two roles — fewer font files is meaningfully better for React Native startup.

- **Nunito** — display, headings, UI. Rounded geometric, friendly, carries the playful register without reading juvenile.
- **Nunito Sans** — body copy, and specifically the payoff slide.

The payoff slide is the product's "slow, effortful processing" moment. It gets a longer measure, generous line height, and comfortable size — it is the one screen in the app optimised for reading rather than tapping.

```
display  32 / 40   700
h1       28 / 36   700
h2       22 / 28   700
h3       18 / 24   600
body     16 / 26   400      ← payoff slide uses 17 / 30
small    14 / 20   400
caption  12 / 16   600  uppercase, tracked
```

**Support OS font scaling.** Users who size text up are disproportionately the ones who need to, and RN apps routinely ignore this.

## 5. Shape, spacing, elevation

```
radius/sm   8      inputs, chips
radius/md   12     default
radius/lg   20     cards, sheets, slide containers
radius/full 999    buttons, pills, streak badges

spacing     4 · 8 · 12 · 16 · 24 · 32 · 48   (4pt base)
```

Generous radii carry most of the playful register on their own. Buttons are fully rounded pills — the single cheapest signal that this is a game-shaped product rather than a reader.

**Elevation is a surface token, never a shadow.** `elevation/1` means "render on `surface/1`", not "apply a shadow".

## 6. Motion

Playfulness lives here. This is the budget line that should not get cut.

- **Reanimated** for interaction and gesture; **Lottie** for celebration set-pieces.
- **Spring physics, not linear easing.** Overshoot slightly on rewards. Linear easing reads as corporate and kills the register instantly.
- Durations: micro **120–180ms** (taps, toggles), standard **240–320ms** (transitions), celebration **600–1200ms** (achievement, session wrap).
- **Respect reduced-motion.** Swap to opacity fades; never remove feedback entirely.

**The payoff unlock is the signature moment of the product.** Slide 3 opening after a correct answer is where the active-recall thesis becomes something a user *feels*. It should be the most crafted animation in the app, and it is worth spending disproportionate time on.

## 7. Sound

SFX on correct, incorrect, Leaf completion, achievement unlock, and session wrap-up.

- One consistent timbre family — sounds should be recognisably from the same instrument.
- Respect the hardware silent switch. Provide a setting. Never loud.
- **Incorrect must not be punishing.** Unlimited retries are the ruled behaviour, so a harsh buzzer turns a normal intermediate state into a rebuke.

## 8. The share-screen exception

Achievement and session-wrap screens exist to be screenshotted into bright social feeds. **A dark screenshot in a light feed reads as moody rather than triumphant.**

So these screens are a deliberate exception: a **high-contrast or light-surface variant**, designed to be legible as a small thumbnail, carrying the streak or XP, the book, and the ZoomOut wordmark. Design them against a feed mockup, not against the app.

## 9. The reserved mascot slot

No mascot in Phase 1. But four moments are where a character will eventually live:

- Empty states (no library, no active journey)
- Streak celebration
- Session wrap-up
- Achievement unlock

**Compose those layouts now with that space accounted for** — filled in Phase 1 by an illustrative motion element or oversized typography. Adding a mascot later then becomes an asset swap rather than a redesign of four screens.

## 10. What this document does not do

It defines a system, not screens. **A coherent token set does not produce a beautiful app** — and ZoomOut's growth loop depends specifically on screens people want to screenshot.

So the realistic sequence is: WP6 builds the system and the shell, then we look at rendered screens together and iterate. Budget for that iteration explicitly rather than expecting the first render to land. The Leaf player (WP8) and the share screens (WP9) are the two surfaces worth art-directing properly; everything else can be systematic.

## 11. Where the tokens live

`apps/mobile/src/design/` — **not** `packages/shared`. Shared is consumed by the backend, which has no business carrying UI concerns. If a web surface ever needs these tokens, promoting them is a later decision made with a real second consumer in hand.
