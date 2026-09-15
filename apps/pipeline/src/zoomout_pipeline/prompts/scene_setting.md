# Scene settings — the varying half of the style contract

`asset_style.md` fixes what every illustration in this library shares: the medium, the dark
palette, the teal accent, how figures are drawn, and what may never appear. **This file owns
everything it does not** — and the two together are the whole brief for an image.

Your job is to decide, for each Leaf of one Track, **where its scenario physically happens**.

## Why this exists

The first Track generated without this step came back as **eighteen seated figures at a table
in a dim interior, eighteen times out of eighteen.** One of those scenarios was about buying a
family home for a family; it was drawn as a man alone at a desk with a calculator.

Nothing was wrong with any single picture. The set was wrong. The style contract was holding
the *environment* constant along with the palette, and left to itself an image model draws the
room it has already drawn.

**So the setting is decided here, deliberately and in writing, rather than left to a default.**

## What you are given

Every scenario in the Track, in order, with the concept its Leaf teaches. Read all of them
before you answer any of them — the point is that they differ from each other, and you cannot
tell whether they do while looking at one.

## What to return

One entry per Leaf, each with:

- **order** — the Leaf's number, exactly as given.
- **place** — a specific, concrete location, named so an illustrator could draw it without
  asking a question. *"the roasting room behind a small coffee shop, sacks stacked against the
  wall"*, not *"an office"*. Two or more words, and never a bare generic.
- **vantage** — `interior` or `exterior`.
- **light** — `dawn`, `morning`, `midday`, `afternoon`, `evening` or `night`. This changes
  where light falls, never the palette: the picture stays dark at midday.
- **shot** — `close` (hands, an object, a face turned away), `medium` (a person and what is
  immediately around them), or `wide` (a whole room, a street, a yard).
- **figures** — how many people are in frame, 0 to 3. **Zero is a real answer.** An emptied
  workshop at night carries a situation; so does a single chair.

  **If it is zero, nobody's hands are in the picture either.** A focus naming a hand, a face or
  a lap contradicts it, and a model given both draws a disembodied one. Keys lying on a
  doorstep, not keys in a palm.
- **focus** — the one object or action the eye lands on. Never a person's face.

  **And never a thing whose whole point is its writing.** No forms, no signage, no documents,
  no price tags, no boarding passes, no screens showing text, no open books being read. The
  illustrator may not draw a single letter or numeral — that is an absolute prohibition — so a
  focus like "a printed application form" asks for a picture that cannot be drawn, and what
  comes back is a form covered in convincing nonsense. Name something with a *shape*: keys on a
  doorstep, a pair of tweezers over a clock movement, a folded coat, a scoop in a bin of beans.
  The same applies to the place: a shopfront is fine, a shopfront with its name on it is not.

  **And never the light a thing throws, only the thing.** No spotlight, no beam, no shaft, no
  glow, no halo, no bloom. The illustrator draws flat shapes and is forbidden every lighting
  effect there is — a lamp is a shape and the room around it is a darker shape — so "a lectern
  under a spotlight beam" asks for a picture that cannot be drawn, and what comes back is the
  volumetric cone the contract spent a paragraph prohibiting. Name the lectern. `light`
  already says what time of day it is, and that is the only place brightness belongs.

## The rules your answer is checked against

These are mechanical. An answer breaking one is rejected and you are asked again, so it is
cheaper to satisfy them first time.

1. **Every place is different from every other place.** Not differently worded — different.
2. **No word may appear in more than half the places.** *"a cluttered desk"*, *"a tidy desk"*
   and *"a standing desk"* are three strings and one room. That is the exact failure this
   step exists to prevent, and a distinctness rule alone does not catch it.
3. **No bare generics.** *"an office"*, *"a desk"*, *"a room"*, *"home"*, *"a workspace"* name
   nowhere in particular.
4. **Vary the camera.** A Track uses at least two different `shot` values.
5. **Vary the clock.** A Track of eight or more Leaves uses at least three different `light`
   values.
6. **Nothing in the frame carries writing.** See `focus` above — this one is a content
   guardrail rather than a matter of variety, and it is the only rule here with legal weight.
7. **No focus names a lighting effect.** A beam, a glow, a shaft or a spotlight is not an
   object in the room; it is something the illustrator is forbidden to draw. See `focus`.
8. **An empty frame has nobody's hands in it.** If `figures` is 0, the focus may not name a
   hand, a palm, a lap or any other part of a person.

## How to choose a place

**The scenario implies somewhere even when it does not say so.** That implication is what you
are recovering — you are not inventing a setting, you are naming the one the prose already has.

- A scenario about a *coffee roasting business losing customers to a new cafe* happens in the
  roastery, or on the pavement outside looking across the street. It does not happen at a desk.
- A scenario about *buying a family home when prices feel out of reach* happens outside a
  house, in an empty room with the keys not yet handed over, or at an estate agent's window at
  night. It does not happen at a desk.
- A scenario about *a promotion that will cost you your health and your evenings* happens in an
  airport gate at dawn, in a gym nobody is in, at a dinner going cold. It does not happen at a
  desk.

**Where the scenario genuinely is desk work, say so** — some are, and forcing a barn onto an
office scenario is the same failure in the other direction. But it must then be a particular
desk in a particular place, and the rules above cap how many Leaves may be one.

**Spread the Track across the world the book is about.** Non-fiction about work is not only
about offices: it is about kitchens, vans, stockrooms, waiting rooms, building sites, buses,
gardens, corridors, shop floors, workshops, and the street outside any of them. Before
answering, list the places this book's ideas actually touch, and draw from that list.

## A worked example

A fictional book, so nothing here belongs to the Track you are working on.

> **Leaf 0** — *"Your neighbour's fence is falling into your garden and you have avoided
> mentioning it for a year. What do you do?"*
>
> **place**: the strip of grass along a shared garden fence, one panel leaning inward
> **vantage**: exterior · **light**: morning · **shot**: wide · **figures**: 0
> **focus**: the leaning fence panel and the gap of light under it
>
> Nobody is in frame. The situation is the fence, and an empty garden says *avoided for a year*
> more plainly than a person standing in it would.

> **Leaf 1** — *"A colleague takes credit for your idea in a meeting. How do you respond?"*
>
> **place**: a narrow meeting room, chairs pushed back at odd angles
> **vantage**: interior · **light**: afternoon · **shot**: medium · **figures**: 3
> **focus**: a hand resting flat on the table, mid-sentence

Two Leaves, two places, two vantages, two shots, two times of day, and one of them has nobody
in it. That is the range a Track should cover.

{feedback}

---

# The Track

{scenarios}
