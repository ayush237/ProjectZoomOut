# Inspect this illustration against three absolute prohibitions

You are looking at one generated illustration from a library of flat editorial vector
artwork. Report only whether it breaches the three rules below. **Nothing else about the
picture is your concern** — not whether it is beautiful, not whether it suits its subject,
not its palette, not its composition. Those are judged elsewhere by a person.

Report what you can actually see. **Do not report a breach you are inferring from what the
scene would plausibly contain** — a phone in a dark room usually has a lit screen, but if
this picture does not draw one, that is not a finding.

## 1. `text` — any letter, numeral or written symbol

Image models cannot spell, and any text here is untranslatable and unfixable without paying
to regenerate. So the rule is absolute and has no threshold: **one legible character is a
breach.**

This covers writing anywhere in the frame — on a screen, a page, a sign, a label, a price
tag, a book spine, a poster, a badge, a keyboard, a chart axis — and it covers currency
symbols, digits, punctuation used as writing, and logos or wordmarks.

**Put what you read in `quote`**, character for character, so a person can check you. If
marks look like writing but you cannot read them, that is still a breach: say so in `what`
and leave `quote` empty.

**Not a breach:** abstract marks that do not read as characters — a row of plain rectangles
standing in for keys or knobs, blank panels, an unmarked dial, a plain untitled book cover,
stripes, dots, tally marks, the texture of a woven mat.

## 2. `glow` — light drawn as falloff rather than as a shape

**This is a rule about falloff, not about brightness and not about subject matter.** The
library is drawn in flat shapes, and light is allowed — it is simply drawn the way every
other thing in these pictures is drawn.

**Allowed, and common:** cast light as a **flat, hard-edged shape** of a lighter surface
value. A bright window is a lighter rectangle. Light through a doorway is a lighter polygon
on the floor with a clean straight edge. A lamp is a shape and the room around it is a
darker shape. Any number of these may appear. **None of them is a finding.**

**A breach** is light rendered as a *gradient*: a bright core fading smoothly outward with
no edge you could trace. Specifically — a halo or bloom around a lamp, a screen, a candle or
a fire; a soft radial wash on a wall or face; a light cone or beam or godray with soft sides;
lens flare; an object that appears to emit light into the air around it rather than simply
being a lighter shape.

**The test to apply:** could you trace the boundary of the lit area with one clean line? If
yes, it is a shape and it is allowed. If the lit area dissolves gradually into the dark with
no boundary, it is a bloom and it is a breach.

## 3. `floating_icon` — a symbol in the air rather than a thing in the room

These illustrations show concrete situations. A breach is any **user-interface glyph or
symbolic overlay floating free of a physical surface**: a notification badge, a speech or
chat bubble, a bell, a heart, a star, a tick, an exclamation mark in a circle, an arrow or
line pointing at something to explain it, a lightbulb standing for an idea, a floating chart
or graph, an emoji.

**Not a breach:** anything that is a real object in the scene — a picture hanging on a wall,
a poster, a sticker on a laptop, a pattern on fabric, a plant, a sign physically mounted on a
building (though writing *on* it is a `text` breach).

**The test to apply:** is it resting on, attached to, or held by something physical in the
scene? Then it is an object. Is it hanging in empty space near something to comment on it?
Then it is an overlay and it is a breach.

## How to answer

Return one entry per distinct breach. Say **where** in the frame it is, concretely enough
that a person can find it — "above the phone in the figure's hands", "on the two cards at
the left of the desk".

If the picture breaches none of the three, return an empty list. **An empty list is a common
and correct answer, and reporting a breach that is not there costs a real image and real
money to regenerate.**
