# Diagram spec — the sticky-notes recap, as structure

Turn this Leaf's recap into **one small diagram**, described as structure rather than drawn.
We render it ourselves, so you are choosing shape and words, not pictures.

## The Leaf

**{title}**

{concept}

**Its sticky notes:**

{notes}

## Choose one shape

- **`flow`** — an ordered sequence. Use it when the notes describe steps that follow one
  another.
- **`contrast`** — two opposed sides. Use it when the notes divide into a "this, not that".
  Give `left_heading` and `right_heading`.
- **`cycle`** — a loop that returns to its start. Use it only when the last step genuinely
  feeds the first.

If the notes do not fit any of these, **return nothing.** A recap that is simply four
unrelated points is not a diagram, and forcing one produces a picture that adds nothing to
the slide.

## Constraints, which are about legibility rather than taste

- **Two to five nodes.** More than five is unreadable on a phone, and the renderer rejects it.
- **Labels of at most 42 characters.** Short noun or verb phrases, not sentences. "Takes from
  others", not "The competitive mind takes value from other people".
- Labels must come from the Leaf's own notes and concept — this is a recap, not new material.
