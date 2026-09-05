# Remaining screen prompts — ZoomOut iOS screen set

Paste into the **same** Claude Design project (`ZoomOut Track Roadmap`, id `767ad8c3…`) so every
screen inherits the same conversation and stays consistent. One per message, wait for each.

**Each prompt is a single paragraph on purpose.** Enter sends the message in Claude Design, so a
prompt containing line breaks gets submitted as fragments. Shift+Enter makes a newline if you want
one; otherwise paste these as-is.

> ## 📋 Paste from `design/prompts/`, not from this file
>
> **Added 2026-09-05.** The blockquotes below are wrapped for reading, and copying one pastes the
> line breaks — which is exactly the fragmenting failure the paragraph above warns about. Every
> prompt now also exists as a **single-line `.txt`** under `design/prompts/`, one file per screen,
> in the same format as `screen-1-v2-prompt.txt` that worked. Open the file, select all, paste.
>
> **This file stays the reference** — it carries the reasoning and the rationale for each *Do not*.
> The `.txt` files are the paste artefacts. If a prompt changes, change both.
>
> | Screen | File |
> |---|---|
> | 3 · Track complete | `prompts/screen-03-track-complete.txt` |
> | 4 · Journey, Explore, Library | `prompts/screen-04-journey-explore-library.txt` |
> | 5 · Profile and progress | `prompts/screen-05-profile-and-progress.txt` |
> | 6 · The share card | `prompts/screen-06-share-card.txt` |
> | 7 · Onboarding and legal | `prompts/screen-07-onboarding-and-legal.txt` |
> | 8 · Component sheet | `prompts/screen-08-component-sheet.txt` — **Ionicons correction already folded in** |
> | 9 · Sign in and sign up | `prompts/screen-09-sign-in-and-sign-up.txt` |
> | 10 · Session end and the cap | `prompts/screen-10-session-end-and-cap.txt` |
> | 11 · Achievement unlock | `prompts/screen-11-achievement-unlock.txt` |
> | 12 · Report an error and failure | `prompts/screen-12-report-error-and-failure.txt` |

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

# Screens 9–12 — the surfaces the original pack missed

**Added 2026-09-05.** Screens 1–8 cover nine of the app's fourteen surfaces. These four cover the
rest. **They belong in the same conversation as the others** — that is the whole reason the pack
says one project — so they must be pasted before that conversation is finished, not after.

Order among 9–12 does not matter much. Screens 1 and 2 establish the language and everything after
inherits it.

## Screen 9 — sign in and sign up

> SCREEN 9 - the two account screens, sign in and sign up, as two frames. This is the first thing
> anyone sees and nothing in the set has designed it yet. Email and password only - there is no
> Google or Apple button, no guest mode and no social sign-in of any kind, so do not leave room for
> them. Sign up collects email and password only; date of birth is a separate screen that follows.
> Include a forgot-password affordance on sign in even though that flow is not built yet, because it
> is the only account-recovery path this product will ever have. Show inline validation for a
> rejected email and a too-short password, on the field itself rather than as a banner at the top.
> The knowledge-graph language should be present but quiet here - this is the one place a reader has
> a task rather than a reward. Do not use a social-login divider or an "or continue with" row. Do
> not use a full-screen illustration that pushes the fields below the fold. Do not put marketing
> copy or feature bullets on a sign-in screen. Do not put a carousel onboarding before the fields.

## Screen 10 — the end of a session, and the daily cap

> SCREEN 10 - the end of a session, as two frames, and this is a named product constraint rather
> than a nicety. The app caps a session at fifteen minutes or five hundred XP, whichever comes
> first, and the specification is explicit that it must read as an ending rather than a refusal -
> the reader is being thanked, not blocked. First frame: the wrap-up a reader reaches by choosing to
> stop, carrying what they did today, Leaves completed, XP earned and streak, with the share action
> primary. Second frame: the same moment arrived at involuntarily because the cap was hit, which
> must differ in copy and not in tone; an in-progress Leaf is always allowed to finish, so the
> reader is never cut off mid-Leaf and the screen must not imply they were. In the knowledge-graph
> language this is the day's path lighting up rather than the whole book. Do not use a lock icon, a
> barrier, a countdown timer or any paywall pattern. Do not use red or any warning colour. Do not
> offer a way to continue past the cap, because there is not one. Do not invent a metric the product
> does not track.

## Screen 11 — the achievement unlock

> SCREEN 11 - the achievement unlock moment, which the product has as a component today but has
> never had designed. There are nineteen achievements across six categories, and I want the still
> plus a four-frame sequence showing how the unlock arrives while the reader is mid-session - it
> interrupts a Leaf, so it must resolve quickly and hand the screen back rather than becoming a
> destination. Reward amber leads here, because this is the reward moment the palette reserves it
> for. Include the badge, its name, one line of what earned it, and a share action; the full list
> lives on Profile and this is not it. Also give me the earned and unearned states of a badge side
> by side, because a locked achievement should read as attainable rather than as a grey absence. Do
> not use confetti. Do not use a trophy or a medal. Do not use a full-screen modal that traps the
> reader. Do not stack multiple unlocks into a queue the reader dismisses one at a time.

## Screen 12 — report an error, and the failure states

> SCREEN 12 - the states nothing in the set has covered: report an error, and failure. Report an
> error is a legal requirement on every Leaf, routed to a fix queue, so it needs an affordance in
> the player a reader can find without hunting, and a form short enough to actually be used - what
> is wrong, in the reader's own words, with the Leaf identified automatically rather than asked for.
> Then three failure frames: content that failed to load, no network, and the confirmation after a
> report is sent. The product is online-only by design, so no-network is a genuine and frequent
> state rather than an edge case, and it should read as calm rather than alarming. In the
> knowledge-graph language a failure is a connection that has not resolved yet, not a broken one. Do
> not use a red error banner or a warning triangle. Do not use a bug or insect icon. Do not ask the
> reader to categorise the problem from a dropdown of our terms. Do not make the report form a
> full-screen takeover of the Leaf they were reading.

---

## One correction to Screen 8 before you paste it

**The icon set is already decided and shipped: Ionicons, via `@expo/vector-icons`.** It was chosen
in `apps/mobile/src/components/Icon.tsx` for reasons that are still current — it is a font, so every
icon takes the theme tint as a text property, which is exactly what WP6's raw text glyphs failed at.
Screen 8 as written asks for "the icon set on a 24px grid" and will invent one.

Add to that prompt: *the icon set is Ionicons and is not being replaced — show the app's actual
vocabulary drawn from it, at 24px, rather than designing new glyphs.*

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
