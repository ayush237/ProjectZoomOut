# The house style — appended to every image prompt

This is the **style contract**. It is version-controlled because it is the logic that keeps
eighteen Leaves looking like one product instead of eighteen unrelated stock illustrations,
and because a change to it changes every image generated afterwards.

Everything here derives from `project/proposals/design-direction.md`. Where the two disagree,
that document is right and this one is stale.

## Medium and rendering

**Flat editorial vector illustration.** Clean geometric shapes, generous negative space, no
gradients beyond a single soft tonal step, no photographic texture, no 3D rendering, no
painterly brushwork, no glossy highlights.

**Solid filled shapes with no outlines.** Forms are defined by where one colour meets
another, never by a drawn contour. No line art, no stroked edges, no sketch or ink
treatment. *(Added after an anchor candidate came back as outlined line art — the technique
reads as a different illustrator, not a variation.)*

**No lighting effects.** No glow, no light cones or beams, no lens flare, no bloom, no
volumetric light. A lamp is a shape, and the room around it is a darker shape. *(Added after
an anchor candidate rendered a lamp as a luminous cone, which contradicts the depth rule
below and cannot be reproduced consistently.)*

Chosen for legibility at small sizes. A Leaf's illustration is seen on a phone, often at
thumbnail scale, and WP9 established that legibility beats fidelity there. Detailed or
photographic work becomes mud at that size; flat shapes survive it.

## Palette — narrow on purpose

Backgrounds sit in the app's dark surfaces:

```
#0B0F12   deepest
#141A1E
#1C242A
#26313A   lightest surface
```

The single accent is **teal `#3DDCC8`**, used sparingly — **one small focal element, never a
large field or background block.** If teal occupies more than roughly a tenth of the frame it
is being used as a colour scheme rather than an accent, and the illustration will fight the
interface it sits inside.
Supporting tones are desaturated slate blues and greys drawn between the surface values.
Muted warm neutrals are allowed for skin and wood tones.

**`#FFB020` amber must never appear.** `design-direction.md` §3 reserves amber for reward
moments — XP, streaks, achievements — and an illustration using it steals the signal from the
unlock. This is the one colour rule with a product consequence rather than an aesthetic one.

**Depth comes from surface lightness, not shadow** (§2). A raised element is a lighter shape,
not a drop shadow. Shadows are invisible on dark backgrounds anyway.

## Subject treatment

Ordinary modern life: a desk, a commute, a kitchen table, a shop counter, a conversation.
Concrete situations, never abstract metaphor — no lightbulbs, no ladders to the sky, no
brains with gears in them.

**People are simplified and non-identifiable.** Figures are stylised and flat, faces either
turned away, cropped out, or reduced to minimal marks with no distinguishing features. This
is not only a style choice: it is how the guardrail against identifiable people is satisfied
by construction rather than by hoping the model behaves.

## Composition

A single clear subject with room around it. One focal point. The image is a backdrop to text,
so it must read instantly and must not compete with the words on the slide.

## Absolute prohibitions

These are content guardrails, ruled and not negotiable:

- **No text, letters, numerals or written symbols of any kind.** Image models cannot spell,
  and any text is untranslatable and unfixable without regenerating.
- **No identifiable person**, no portrait, no likeness of any real individual — and in
  particular never the book's author.
- **No book cover, title treatment, publisher mark, or any branding.** An image implying the
  author endorses ZoomOut walks straight into the non-endorsement problem `LEGAL.md` is built
  around, in the most shareable medium in the product.
- **No logos, watermarks or signatures.**
