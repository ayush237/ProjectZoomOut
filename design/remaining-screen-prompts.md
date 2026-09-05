# Remaining screen prompts — ZoomOut iOS screen set

Paste into the **same** Claude Design project (`ZoomOut Track Roadmap`, id `767ad8c3…`) so every
screen inherits the same conversation and stays consistent. One per message, wait for each.

**Each prompt is a single paragraph on purpose.** Enter sends the message in Claude Design, so a
prompt containing line breaks gets submitted as fragments. Shift+Enter makes a newline if you want
one; otherwise paste these as-is.

**Two standing corrections** were set in the first message and carry through: four tabs (Explore,
Library, Journey, Profile), and invented placeholder book titles rather than real in-copyright ones.

---

## Screen 3 — Track complete

> SCREEN 3 - Track complete, the moment a reader finishes an entire book. The product has no
> celebration for this today and it is the biggest reward in it. In the knowledge-graph language:
> the reader's path is now fully lit, and the previously faint background web has resolved into a
> complete, connected constellation - the whole book, understood, as one image. The screen carries
> XP earned, day streak, and first-try count. Primary action "Share your constellation", secondary
> "Find your next book". Give me the still, plus a four-frame sequence showing how it arrives.
> Reward amber may lead here because completion is a reward moment, but it is still an accent and
> must not flood the screen. Do not use confetti. Do not use a trophy or a medal. Do not use a
> full-screen modal that traps the reader. Do not invent a metric the product does not track.

## Screen 4 — Journey, Explore, Library

> SCREEN 4 - the three browse surfaces, as three frames side by side, all with the four-tab bar.
> Journey: books in progress, resume at the next incomplete Leaf, and use a compressed strip of
> each Track's graph as the progress indicator instead of a plain bar. Explore: browse published
> books with cover, title, author, a one-line description and an add action, and include a genuine
> pagination affordance because the real screen currently stops at twenty with no sign more exists.
> Library: added books with per-book progress. Then give me a second row of three frames showing
> the empty state of each - no journeys, nothing added, nothing found. Do not use a carousel. Do
> not put more than one primary action on a card. Do not show a rating, review count or trending
> badge, because the product tracks none of those. Do not use a bottom sheet for filters.

## Screen 5 — Profile and progress

> SCREEN 5 - the Profile tab: streak, daily XP, total XP, achievements, and an activity heatmap in
> the style of a contribution graph using the reward ramp. This is where the knowledge-graph idea
> can pay off a second time - consider showing the reader's whole history as one accumulated
> constellation across every book they have finished. Include the four-tab bar. Do not add a
> leaderboard or any social comparison. Do not invent metrics the product does not track - no time
> saved, no percentile, no books-per-month. Do not use a circular progress ring for XP. Do not put
> the avatar in a dashed ring.

## Screen 6 — the share card

> SCREEN 6 - the share card a reader posts after finishing a session or a Track, in both square and
> 9:16. This is a deliberate exception to the dark theme: it lands in bright social feeds, and a
> dark screenshot in a light feed reads as moody rather than triumphant. Use the LIGHT palette,
> high contrast, and make it legible as a small thumbnail. Design it against a mock social feed
> rather than against the app, so I can judge it in context. It carries the streak or XP, the book,
> a fragment of the reader's constellation, and the ZoomOut wordmark. Do not put more than three
> pieces of information on it. Do not use body-weight type for the headline number. Do not include
> a QR code.

## Screen 7 — onboarding and the legal surfaces

> SCREEN 7 - two frames. First, the age gate: the app is 13+ and collects a date of birth, and the
> refusal state must be kind rather than punitive. Second, the Track detail legal surface: the
> non-endorsement disclaimer and the purchase-forward link, which are legally load-bearing and must
> be legible rather than buried in fine print - a reader should be able to read the disclaimer
> without zooming. Do not use a modal for the age gate. Do not style the disclaimer as a footnote.
> Do not use a checkbox that implies consent to anything other than confirming age.

## Screen 8 — the component sheet

> SCREEN 8 - a component sheet showing every state in one place: the four graph node states, buttons
> (primary, secondary, disabled, pressed), the progress bar, the five-slide indicator, cards, chips,
> the scenario option row in all four states, the empty-state layout, and the icon set on a 24px
> grid. Show each in BOTH themes side by side, labelled with the token name that drives it. Do not
> invent a component the screens do not use.

---

## After all screens exist

Two things worth checking across the whole set rather than screen by screen:

- **Amber only ever appears on a reward.** Scan every frame for teal-vs-amber usage. This is the
  rule most likely to erode over seven generations.
- **The four tabs stay four.** The first mockup it produced invented a three-tab structure; if any
  later screen quietly reverts to three, correct it in that message rather than accepting it.

And one thing to decide once you can see them together: **whether the dendrites earn their place**
at real phone size. They are what makes the graph read neural rather than as a subway map, but they
are the detail most likely to look like noise. Ask for one frame with them and one without.
