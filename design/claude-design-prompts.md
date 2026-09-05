# Claude Design prompt pack — ZoomOut

**How to use this.** Paste **Block 0** first, on its own, and let it answer. Then paste one
screen prompt per turn. Block 0 is the whole design system; the screen prompts assume it and
stay short on purpose. Re-paste Block 0 after any `/clear`.

**The one rule that matters most:** every prompt below ends with a *"do not"* list. That is
where the value is. Claude Design will produce something competent from the positive brief
alone; the negative list is what stops it producing the generic version.

---

## Block 0 — master context (paste this first, every session)

> You are designing screens for **ZoomOut**, a mobile app (iOS-first, React Native) that turns
> non-fiction books into gamified, interactive micro-lessons. A **Track** is one book. A
> **Leaf** is one ~3-minute lesson made of exactly five slides: Summary, Scenario, Payoff,
> Sticky Notes, Takeaway. The reader answers a 3-option scenario question and the Payoff slide
> stays locked until they answer correctly — active recall is the product thesis, not a
> decoration. Sessions are capped at ~15 minutes by design.
>
> **Audience: 13+.** It is gamified but it is not a children's app. Treat it as an instrument
> people take seriously — closer to a trading terminal or a good IDE than to a kids' game.
>
> **Visual direction: a knowledge graph.** Think neurons, mindmaps, constellations, tech trees.
> A Track is a path of connected nodes through a wider web of ideas the reader has not reached
> yet. Fine edges, precise nodes, depth from **density** rather than from mass. We tried a
> botanical tree and rejected it — constant-width round-capped branches read as a cartoon
> silhouette.
>
> **These are the shipping design tokens. Use these exact values; do not invent new colours.**
>
> Dark theme (the default):
> ```
> surface0 #0B0F12   app background
> surface1 #141A1E   cards, sheets
> surface2 #1C242A   raised elements, inputs
> surface3 #26313A   pressed, highest elevation
> border   #2E3A44   hairlines
> primary  #3DDCC8   interface, navigation, progress   (hover #5FE6D5, press #26B8A6)
> reward   #FFB020   XP, streaks, achievements, completion ONLY   (soft #FFC44D)
> correct  #4ADE80    incorrect #FF6B6B
> text     #F2F5F7    muted #A7B6C0
> on-primary / on-reward: #0B0F12
> ```
> Light theme (supported, never the default — different values, not tints of the above):
> ```
> surface0 #FFFFFF  surface1 #F1F5F8  surface2 #E6EDF1  surface3 #D8E2E8  border #C3D1DA
> primary  #006A5E   reward #8A5200   correct #0F7038   incorrect #B3261E
> text     #0B1519   muted #4C5C66    on-primary / on-reward: #FFFFFF
> ```
>
> **Type:** Nunito (display, headings, UI) and Nunito Sans (body). Both on Google Fonts.
> display 32/40 · h1 28/36 · h2 22/28 · h3 18/24 · body 16/26 · payoff 17/30 · small 14/20 ·
> caption 12/16 uppercase tracked. All weights 400/600/700 only.
>
> **Shape and spacing:** radii 8 (chips) · 12 (default) · 20 (cards, sheets) · 999 (buttons,
> pills). Spacing on a 4pt base: 4 · 8 · 12 · 16 · 24 · 32 · 48. Buttons are fully rounded pills.
>
> **Motion:** spring physics, never linear easing. 150ms taps · 280ms transitions · 900ms
> celebrations. Rewards overshoot slightly (underdamped). Reduced motion swaps to an opacity
> fade — never removes the feedback.
>
> **Hard constraints — these are requirements, not preferences:**
> 1. **Amber `#FFB020` is reserved for reward moments only** — XP, streaks, achievements,
>    completion. Never use it for navigation, buttons, links, or brand. Teal is the interface.
> 2. **Depth comes from surface lightness, not shadow.** An elevated card is a lighter surface
>    with a hairline border. Drop shadows are invisible on dark and must not be used.
> 3. **No glow, no light cones, no bloom, no lens flare, no volumetric light.** Anywhere.
> 4. **Never signal by colour alone.** Correct/incorrect always carry an icon and a motion cue
>    as well as a colour — `correct` green and `primary` teal are adjacent in hue.
> 5. **WCAG AA against the surface the text actually sits on**, checked per elevation level —
>    not once against `surface0`. Body ≥ 4.5:1, large ≥ 3:1.
> 6. **Minimum 44px hit targets.**
> 7. **No fake iOS status bar and no fake keyboard.** The real ones render on top.
> 8. **Icons are inline SVG on a 24px grid, stroke-based, one consistent weight. Never emoji.**
> 9. Support OS font scaling; do not use absolute line heights that clip when text scales up.
>
> **Do not:** use orange as a brand colour · use gradient-mesh backgrounds · use Inter, Roboto
> or Arial · add a mascot or character · use rounded-corner cards with a left-border accent
> stripe · add drop shadows · invent metrics or stats that the product does not track.
>
> Confirm you have this, then wait for the screen brief.

---

## Prompt 1 — Track roadmap (the hero screen)

> Design the **Track roadmap** screen: one book's full path, 390×844.
>
> It answers one question in under a second — *what do I do next* — while showing the shape of
> the whole book behind it.
>
> **Three layers, back to front.** A faint **background web** of small nodes and short edges,
> standing for knowledge not yet reached. Fine **dendrites** branching off each Leaf node,
> tapering, so it reads as neural rather than as a flowchart. And the **spine**: a smooth
> meandering path through the book's 18 Leaves, lit teal behind the reader and dim ahead.
>
> **Four node states, all from existing tokens:** *locked* — hollow, `border`, number in muted
> text. *Next* — the only prominent element, filled `primary`, with a translucent ring around
> it and the Leaf title beneath. *Complete* — small, ringed in `reward` with a solid amber
> centre. *Revisit* — dashed `border` ring (a state the product does not have yet; design it
> so it can exist).
>
> Header carries a "TRACK" eyebrow, book title, author, and a thin progress bar with "7 / 18".
> A single primary pill at the bottom: "Continue Leaf 8".
>
> **Nodes must sit exactly on the spine**, not beside it. Put a scrim behind the header and the
> bottom button so labels never sink into the graph.
>
> Also give me a **scrolled state** showing a completed cluster, and an **empty state** for a
> Track just added.
>
> **Do not:** draw a botanical tree, a trunk, or leaf shapes · make every node the same size
> (only the next one is prominent) · label locked Leaves with their titles (they are a spoiler
> and they clutter) · use thick round-capped strokes · centre the spine as a straight vertical
> line · add a minimap.

---

## Prompt 2 — the Leaf player, five slides

> Design the **Leaf player**: five slides a reader swipes through, 390×844 each.
>
> 1. **Summary** — the idea in a short paragraph, with an optional illustration above it.
> 2. **Scenario** — a situation plus three answer options. This is the gate. Show three states:
>    unanswered, one option chosen and wrong (retryable, unlimited, never punishing), correct.
> 3. **Payoff** — the deeper explanation. This is the reading screen: longer measure, 17/30,
>    generous line height. It is optimised for reading, not tapping.
> 4. **Sticky Notes** — 2–6 short key points shown as notes on a board, plus an optional diagram.
> 5. **Takeaway** — one memorable fact, plus one concrete thing to do today.
>
> **The payoff unlock is the signature moment of the product** and deserves the most craft: the
> instant slide 3 opens after a correct answer is where the thesis becomes something the reader
> *feels*. Show the unlock as a sequence of 3–4 frames. The reward should read as caused by the
> answer, not by the navigation.
>
> A slim progress indicator shows which of the five slides you are on.
>
> **Do not:** put the payoff text on a card (it is the screen) · use a modal for the unlock ·
> mark the wrong answer with red alone · show the correct answer after a wrong guess · use
> more than five slides, ever.

---

## Prompt 3 — Track complete

> Design the **Track complete** moment — finishing an entire book, 390×844. The product has no
> celebration for this today and it is the biggest reward in it.
>
> In the knowledge-graph language: the reader's path is now **fully lit**, and the previously
> faint background web has resolved into a complete, connected constellation. The whole book,
> understood, as one image.
>
> Carries: XP earned, day streak, first-try count. Primary action "Share your tree", secondary
> "Find your next book".
>
> Give me the **still**, and a 4-frame sequence of how it arrives.
>
> **Do not:** use confetti · use a trophy or medal · fill the screen with amber (it is an
> accent, even here) · use a full-screen modal that traps the reader.

---

## Prompt 4 — share card

> Design the **share card** a reader posts after finishing a session or a Track. Square and
> 9:16.
>
> **This is a deliberate exception to the dark theme.** It lands in bright social feeds, and a
> dark screenshot in a light feed reads as moody rather than triumphant. Use the light palette,
> high contrast, legible as a small thumbnail. Design it against a mock feed, not against the app.
>
> Carries the streak or XP, the book, a fragment of the reader's constellation, and the ZoomOut
> wordmark.
>
> **Do not:** put more than three pieces of information on it · use body-weight type for the
> headline number · rely on colour the feed may recompress · include a QR code.

---

## Prompt 5 — Journey, Explore, Library

> Design the three browse surfaces, 390×844 each.
>
> **Journey** — books in progress, resume at the next incomplete Leaf. A compressed strip of
> each Track's graph as the progress indicator instead of a bar.
> **Explore** — browse published books. Cover, title, author, one-line description, add action.
> Needs a genuine pagination affordance; it currently stops at twenty with no sign more exists.
> **Library** — added books with per-book progress.
>
> All three need an **empty state** — no books, no journeys, nothing added.
>
> **Do not:** use a carousel · put more than one primary action on a card · show a rating,
> review count, or "trending" badge (the product tracks none of these) · use a bottom sheet
> for filters.

---

## Prompt 6 — Profile and progress

> Design the **Profile** screen, 390×844: streak, daily XP, total XP, achievements, and an
> **activity heatmap** in the style of a contribution graph, using the reward ramp.
>
> This is where the knowledge-graph idea can pay off a second time: consider showing the
> reader's *whole* history as one accumulated constellation across every book.
>
> **Do not:** add a leaderboard or any social comparison · invent metrics the product does not
> track (no "time saved", no "books per month", no percentile) · use a circular progress ring
> for XP · put the avatar in a dashed ring.

---

## Prompt 7 — the component sheet

> Once the screens are settled, produce a **component sheet**: every node state, buttons
> (primary, secondary, disabled, pressed), the progress bar, the five-slide indicator, cards,
> chips, the option row in all four states, empty-state layout, and the icon set on a 24px grid.
>
> Show each in **both themes**, side by side, labelled with the token name that drives it.
>
> **Do not:** invent a component the screens do not use.

---

## Notes for later

- **The dendrites are the open question.** They are what makes it read neural rather than
  subway-map, but at phone size they can look like whiskers. Ask for a version with them and
  a version without, and compare at actual size rather than zoomed in.
- **Metaphor discipline.** The graph owns exactly one thing: progress through a book. If XP
  becomes sap and streaks become roots, it turns cute and stops being 13+. Say so if a design
  starts extending the metaphor.
- **Ask for one screen at a time.** A prompt that asks for six screens gets six mediocre ones.
