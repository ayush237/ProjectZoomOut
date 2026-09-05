# ZoomOut — design system definition

Paste into **Claude Design → Design systems → new**. Set it up once, then pick it from the
`Design system` dropdown on every generation. Everything below is the *shipping* system, lifted
from `apps/mobile/src/design/` — not a proposal.

---

## Name

**ZoomOut**

## What it is for

A mobile app (iOS-first, React Native) that turns non-fiction books into gamified, interactive
micro-lessons. **Audience 13+.** Gamified but not a children's app — closer in register to a
good IDE or a trading terminal than to a kids' game.

## Colour — dark (the default theme)

| Token | Hex | Use |
|---|---|---|
| `surface/0` | `#0B0F12` | App background |
| `surface/1` | `#141A1E` | Cards, sheets |
| `surface/2` | `#1C242A` | Raised elements, inputs |
| `surface/3` | `#26313A` | Pressed states, highest elevation |
| `border` | `#2E3A44` | Hairline separation |
| `primary` | `#3DDCC8` | Interface, navigation, progress |
| `primary/hover` | `#5FE6D5` | |
| `primary/press` | `#26B8A6` | |
| `on-primary` | `#0B0F12` | Text on a primary fill |
| `reward` | `#FFB020` | **Reward moments only** |
| `reward/soft` | `#FFC44D` | Decorative half of a reward |
| `on-reward` | `#0B0F12` | |
| `correct` | `#4ADE80` | |
| `incorrect` | `#FF6B6B` | Softened — pure red glares on dark |
| `text/primary` | `#F2F5F7` | |
| `text/muted` | `#A7B6C0` | |

## Colour — light (supported, never the default)

**Not tints of the dark values.** A colour tuned for a dark background is the wrong colour on
a light one, so these are chosen independently.

| Token | Hex |
|---|---|
| `surface/0` … `surface/3` | `#FFFFFF` · `#F1F5F8` · `#E6EDF1` · `#D8E2E8` |
| `border` | `#C3D1DA` |
| `primary` / hover / press | `#006A5E` · `#00584E` · `#00443C` |
| `reward` | `#8A5200` (soft `#FFC44D`) |
| `correct` / `incorrect` | `#0F7038` · `#B3261E` |
| `text/primary` / `text/muted` | `#0B1519` · `#4C5C66` |
| `on-primary` / `on-reward` | `#FFFFFF` |

## Typography

**Nunito** — display, headings, UI. **Nunito Sans** — body copy. Both from Google Fonts.
Weights 400 / 600 / 700 only. Two families is a deliberate ceiling.

| Role | Size / line | Weight |
|---|---|---|
| display | 32 / 40 | 700 |
| h1 | 28 / 36 | 700 |
| h2 | 22 / 28 | 700 |
| h3 | 18 / 24 | 600 |
| body | 16 / 26 | 400 |
| payoff | 17 / 30 | 400 |
| small | 14 / 20 | 400 |
| caption | 12 / 16 | 600, uppercase, tracked |

## Shape and spacing

Radii **8** (chips, inputs) · **12** (default) · **20** (cards, sheets, slide containers) ·
**999** (buttons, pills, badges). Spacing on a 4pt base: **4 · 8 · 12 · 16 · 24 · 32 · 48**.

Buttons are fully rounded pills — the cheapest single signal that this is a game-shaped
product rather than a reader.

## Motion

Spring physics, never linear easing — linear reads as corporate and kills the register.
**150ms** taps and toggles · **280ms** transitions · **900ms** celebrations. Rewards overshoot
slightly (underdamped). Reduced motion swaps to an opacity fade and never removes feedback.

## Visual direction

**A knowledge graph** — neurons, mindmaps, constellations, tech trees. A book is a path of
connected nodes through a wider web of ideas not yet reached. **Fine edges, precise nodes,
depth from density rather than mass.**

A botanical tree was tried and rejected: constant-width, round-capped branches read as a
cartoon silhouette, which is wrong for a 13+ product.

## Rules — requirements, not preferences

1. **`reward` amber is reserved for reward moments only** — XP, streaks, achievements,
   completion. Never navigation, buttons, links or brand. Teal is the interface. This is what
   keeps a reward from competing with the UI for attention.
2. **Depth comes from surface lightness, not shadow.** An elevated card is a lighter surface
   with a hairline border. Shadows are invisible on dark and are not used.
3. **No glow, light cones, beams, bloom, lens flare or volumetric light.** Anywhere.
4. **Never signal by colour alone.** Correct/incorrect carry an icon and a motion cue as well —
   `correct` green and `primary` teal are adjacent in hue and a reader must never have to
   distinguish them to know if they were right.
5. **WCAG AA against the surface the text actually sits on**, verified per elevation level, not
   once against `surface/0`. Body ≥ 4.5:1, large ≥ 3:1.
6. **Minimum 44px hit targets.**
7. **No fake iOS status bar, no fake keyboard.** The real ones render on top.
8. **Icons: inline SVG, 24px grid, stroke-based, one consistent weight. Never emoji.**
9. **Support OS font scaling** — no absolute line heights that clip when text is sized up.
10. **The graph metaphor owns exactly one thing: progress through a book.** XP is not sap,
    streaks are not roots. Extending it further makes the product cute and stops it being 13+.

## Never

Orange as a brand colour · gradient-mesh backgrounds · Inter, Roboto or Arial · drop shadows ·
a mascot or character · rounded cards with a left-border accent stripe · confetti · trophies
and medals · leaderboards or social comparison · invented metrics the product does not track
(no "time saved", no percentile, no rating) · more than five slides in a lesson, ever.
