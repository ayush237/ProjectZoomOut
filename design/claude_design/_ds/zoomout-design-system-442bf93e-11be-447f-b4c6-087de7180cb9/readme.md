# ZoomOut Design System

ZoomOut turns non-fiction books into gamified, interactive micro-lessons. iOS-first,
React Native. A **Track** is one book. A **Leaf** is one ~3-minute lesson of exactly
five slides — Summary, Scenario, Payoff, Sticky Notes, Takeaway. The reader answers a
three-option scenario question and **the Payoff slide stays locked until they answer
correctly**: active recall is the product thesis, not decoration. Sessions are capped at
about 15 minutes by design.

Audience is 13+. Gamified, but not a children's app. The register should read closer to
a good IDE or a trading terminal than to a kids' game.

## Sources this system was built from

- **Attached codebase (read-only mount):** `design/` — the shipping token layer of the
  mobile app: `palette.ts`, `typography.ts`, `layout.ts`, `motion.ts`, `theme.ts`,
  `ThemeProvider.tsx`, `contrast.ts`, `index.ts`, plus `palette.test.ts`,
  `motion.test.ts`, `ThemeProvider.test.tsx`. In the product repo these live at
  `apps/mobile/design/`, deliberately not in `packages/shared`.
- **Brand direction supplied in the brief** (colour, type, shape, motion, rules, the
  never-list). Every value here comes from one of those two places; none were invented.
- The token files repeatedly cite a document called `design-direction.md` (§3 colour,
  §4 type, §5 shape, §6 motion, §11 placement). **That document was not in the mount** —
  if you have it, it is the authority above this readme.
- No Figma file, no logo, no icon assets, no imagery and no slide template were provided.

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | The one file consumers link. `@import` lines only. |
| `tokens/colors.css` | Dark (default) and light palettes, plus semantic aliases. |
| `tokens/typography.css` | Families, weights, the eight-variant scale, `.zo-*` type classes. |
| `tokens/spacing.css` | 4pt spacing, radii, border widths, 44px hit target, gutter. |
| `tokens/motion.css` | Durations, spring easings, keyframes, reduced-motion swap. |
| `tokens/fonts.css` | Nunito + Nunito Sans via Google Fonts. |
| `tokens/base.css` | Element resets, link colours, focus ring. |
| `components/**` | 20 React primitives (list below). |
| `ui_kits/mobile/` | Click-through recreation of the iOS app — start at `index.html`. |
| `guidelines/*.card.html` | Foundation specimen cards (Colors, Type, Spacing, Motion, Brand). |
| `SKILL.md` | Agent-skill entry point. |

## Components

Grouped by concern. Each has a sibling `.d.ts` (props contract) and `.prompt.md`
(what & when + usage).

- `components/core/` — **Button**, **IconButton**, **Icon**, **Card**, **Badge**
- `components/forms/` — **Input**, **OptionButton**, **Switch**
- `components/navigation/` — **TopBar**, **TabBar**, **SlideProgress**
- `components/feedback/` — **ProgressBar**, **FeedbackNote**, **LockedPanel**
- `components/rewards/** — **XpChip**, **StreakBadge**
- `components/graph/` — **TrackGraph**
- `components/lesson/` — **SlideFrame**, **StickyNote**, **TrackCard**

### Intentional additions

No source defined a component inventory — the mount is a token layer only — so this set
was authored from the product spec and the brand rules. Each entry maps to something the
product demonstrably has:

- **OptionButton, LockedPanel, FeedbackNote, SlideFrame, StickyNote, SlideProgress** —
  the five-slide leaf and its recall gate.
- **TrackGraph, TrackCard** — the graph metaphor's single sanctioned use: progress
  through a book.
- **XpChip, StreakBadge** — the only two places reward amber is legal.
- **Icon** — a wrapper over the substituted Lucide glyph set (see Iconography).

Nothing here is a "design systems usually have one" component: there is no Toast,
Avatar, Tooltip, Dialog, Accordion or Tabs, because nothing in the sources calls for one.

## The rules (requirements, not preferences)

1. **Reward amber `#FFB020` is for reward moments only** — XP, streaks, achievements,
   completion. Never navigation, buttons, links or brand. Teal is the interface. This is
   what stops a reward competing with the UI for attention.
2. **Depth comes from surface lightness, not shadow.** An elevated card is a lighter
   surface with a hairline border. Shadows are invisible on dark and are not used.
3. **No glow, light cones, beams, bloom, lens flare or volumetric light.** Anywhere.
4. **Never signal by colour alone.** Correct/incorrect carry an icon and a motion cue as
   well — correct green and primary teal are adjacent in hue, and a reader must never
   have to tell them apart to know whether they were right.
5. **WCAG AA against the surface the text actually sits on**, verified per elevation
   level, not once against surface/0. Body 4.5:1, large 3:1. (Verified: see
   `guidelines/colors-contrast-dark.card.html` — the worst dark pairing is muted text on
   surface/3 at 6.38:1.)
6. **Minimum 44px hit targets.**
7. **No fake iOS status bar and no fake keyboard** — the real ones render on top.
8. **Icons: inline SVG, 24px grid, stroke-based, one consistent weight. Never emoji.**
9. **Support OS font scaling** — no absolute line heights that clip when text is sized
   up. (Web tokens are `rem` sizes with unitless leadings for exactly this reason.)
10. **The graph metaphor owns exactly one thing: progress through a book.** XP is not
    sap, streaks are not roots. Extending it further makes the product cute and stops it
    being 13+.

**Never:** orange as a brand colour; gradient-mesh backgrounds; Inter, Roboto or Arial;
drop shadows; a mascot or character; rounded cards with a left-border accent stripe;
confetti; trophies or medals; leaderboards or social comparison; invented metrics the
product does not track (no time-saved, no percentile, no rating); more than five slides
in a lesson, ever.

---

# Visual foundations

## Colour

Two independently chosen palettes. **Dark is the default and the fallback** — the app
follows the OS appearance setting when it expresses one and renders dark when it does
not. Nothing is shared between the themes but the token names: a colour tuned for a dark
background is the wrong colour on a light one (`#3DDCC8` on white is 1.6:1 — effectively
invisible).

**Dark:** surface/0 `#0B0F12` page · surface/1 `#141A1E` cards · surface/2 `#1C242A`
raised and inputs · surface/3 `#26313A` pressed · border `#2E3A44`. Primary
`#3DDCC8`, hover `#5FE6D5`, press `#26B8A6`, on-primary `#0B0F12`. Reward `#FFB020`,
soft `#FFC44D`, on-reward `#0B0F12`. Correct `#4ADE80`, incorrect `#FF6B6B` (softened —
pure red glares on dark). Text `#F2F5F7`, muted `#A7B6C0`.

**Light:** surfaces `#FFFFFF` → `#F1F5F8` → `#E6EDF1` → `#D8E2E8`, border `#C3D1DA`.
Primary `#006A5E` / `#00584E` / `#00443C`. Reward `#8A5200` (soft `#FFC44D` carries the
decorative half of a reward moment; `#8A5200` carries anything load-bearing). Correct
`#0F7038`, incorrect `#B3261E`, text `#0B1519`, muted `#4C5C66`, on-primary and
on-reward `#FFFFFF`.

Elevation is separation from the page, not a shadow: on dark each level is **lighter**
than the last; on light each level is **darker**, because the page is already white.
Same rule, opposite sign.

## Type

**Nunito** for display, headings, buttons and labels; **Nunito Sans** for body copy.
Weights 400 / 600 / 700 only — two families is a deliberate ceiling. Scale: display
32/40, h1 28/36, h2 22/28, h3 18/24, body 16/26, payoff 17/30, small 14/20, caption
12/16 uppercase with 0.8px tracking. Captions are the workhorse for metadata, slide
kinds and section labels. `payoff` exists for one screen only — the Payoff slide is the
product's slow, effortful-processing moment and the one screen optimised for reading
rather than tapping.

## Shape and spacing

4pt base: 4, 8, 12, 16, 24, 32, 48. Radii: 8 chips and inputs, 12 default, 20 cards and
sheets, 999 buttons and pills. Buttons are fully rounded pills — the single cheapest
signal that this is a game-shaped product rather than a reader. Generous radii carry
most of the playful register on their own, which is why nothing else has to.

## Backgrounds and imagery

Flat surface colours, full stop. No gradient meshes, no textures, no repeating patterns,
no photography, no hand-drawn illustration, no protection gradients (there is nothing to
protect text from). **The only graphic in the system is the knowledge graph**: hairline
edges at 1–1.75px, precise nodes at r4.5–5, depth from ambient density rather than mass.
Done and current nodes are teal; unreached nodes sit at surface/3. A botanical tree was
tried and rejected — constant-width, round-capped branches read as a cartoon silhouette,
which is wrong for 13+.

There is **no cover artwork** anywhere in the sources, so a track's card shows its own
graph instead of faking a cover.

## Cards, borders, shadows

A card is a lighter surface + a 1px hairline + 20px radius. No `box-shadow` exists in
this system; neither does an inner-shadow or bevel system. Never a rounded card with a
coloured left-border accent stripe. Hairlines separate; the focus ring is 2px teal with a
2px offset.

## Transparency and blur

Effectively unused. Disabled controls drop to 0.45 opacity, ambient graph edges sit at
0.5, and that is the whole inventory — no frosted glass, no scrims, no backdrop blur.

## Motion

Spring physics, never linear easing — linear reads as corporate and kills the register
instantly. 150ms taps (`--ease-snappy`, damping 20 / stiffness 300), 280ms transitions
(`--ease-standard`, 18 / 180), 900ms celebrations (`--ease-reward`, 10 / 200 —
deliberately underdamped, so it overshoots). Overshoot on an ordinary button press reads
as sloppy rather than lively; it earns its place only when something has been won.
Reduced motion **swaps to an opacity fade and never removes feedback** — removing it
leaves someone who needs the accommodation with no confirmation that their tap
registered.

## Interaction states

- **Hover** (web only): primary lightens to `#5FE6D5`; secondary and ghost step up one
  surface level.
- **Press:** fill darkens to `--primary-press` or steps to `--surface-3`, plus a scale to
  0.97 (0.94 on icon buttons) on the snappy spring. Never an opacity dip.
- **Focus:** 2px teal outline, 2px offset.
- **Selected:** 2px teal border on a raised surface.
- **Correct / incorrect:** 2px semantic border **and** an icon **and** a motion cue.
- **Disabled:** 0.45 opacity, no colour change.

## Layout

One-column mobile layout, 20px gutter (`--gutter`). Sticky elements: the TopBar inside a
track, the primary action at the bottom of a track, and the TabBar — which is hidden
entirely inside a leaf, because a lesson is a focused, uninterrupted flow.

---

# Content fundamentals

**Voice: second person, present tense, plain.** You address the reader as "you" and never
refer to ZoomOut as "we". Copy is short, declarative and specific; it explains rather
than sells.

**Casing:** sentence case for headings, titles and buttons ("Start leaf", "Why it
works", "Three things to keep"). UPPERCASE only in the caption variant, where it is a
type decision, not emphasis — slide kinds, section labels, counters. No title case
anywhere. No exclamation marks.

**Emoji: never.** Not in copy, not in UI, not in notifications. Icons are stroke-based
SVG.

**Numbers are the ones the product tracks.** "4 / 12 leaves", "+40 XP", "12 day streak",
"12 min left today", "3 min" leaf length. Never a time-saved claim, a percentile, a
rating, a "top 5%" or any social comparison.

**Register examples**

| Do | Don't |
| --- | --- |
| "Start leaf · 3 min" | "Let's dive in! 🚀" |
| "Answer the scenario to unlock the payoff" | "Oops! Try again to see the secret" |
| "Not quite. Look at what set the range you were judging offers against." | "Wrong!" |
| "Correct — the opening figure moved the whole range." | "Amazing job, genius!" |
| "12 min left today" | "You've saved 4 hours of reading!" |
| "One more node on the graph. Next up: Availability." | "Your tree grew a new leaf! 🌱" |

**Feedback copy** names the reasoning, never just the verdict: the incorrect note points
at what to reconsider without giving the answer away; the correct note explains the
mechanism in one sentence. Lesson copy is written so a 13-year-old can follow it and an
adult does not feel condescended to — no baby talk, no jargon.

---

# Iconography

**Set:** Lucide (`lucide@0.544.0`), loaded from CDN. **This is a substitution and should
be reviewed:** the attached codebase contains no icon font, sprite, SVG assets or icon
component, so there was nothing to copy in. Lucide was chosen because it already matches
the house rules — 24px grid, 2px stroke, round caps and joins, one weight, outline only.
No icon assets were invented or drawn by hand, and `assets/` is intentionally absent.

**Usage:** always via the `Icon` component (`components/core/Icon.jsx`), which reads the
glyph from the Lucide global and renders it at `currentColor`. Any page mounting these
components loads:

```html
<script src="https://unpkg.com/lucide@0.544.0/dist/umd/lucide.js"></script>
```

**Rules:** one stroke weight everywhere; 24px default (18–20px inline with text, 14–16px
inside pills); never emoji; never a filled variant; never a unicode character standing in
for an icon; never a second icon family. Icons are muted or `--text` by default and teal
when they mark the active interface state. The **only** icons ever tinted amber are the
reward glyphs `zap` (XP) and `flame` (streak).

**The working set:** `book-open`, `network`, `sticky-note`, `lock`, `lock-open`, `check`,
`x`, `zap`, `flame`, `chevron-left`, `chevron-right`, `house`, `compass`, `user`,
`settings`, `play`, `bookmark`, `circle-alert`.

# Logo

**No logo or brand mark exists in the provided sources, and none was created.** Wherever
a mark would go, the name is set in Nunito 700 — see
`guidelines/brand-wordmark.card.html`. If you have the real mark, drop it in `assets/`
and update that card.

# Fonts

Nunito and Nunito Sans are loaded from Google Fonts (`tokens/fonts.css`). **No font
binaries are vendored here** — the mobile app loads them through
`expo-google-fonts` (`Nunito_400Regular`, `Nunito_600SemiBold`, `Nunito_700Bold`,
`NunitoSans_400Regular`, …), so Google Fonts is the source of truth rather than a
substitution. If you need offline or self-hosted copies, supply the `.woff2` files and
they can be wired up as `@font-face` rules in `tokens/fonts.css`.
