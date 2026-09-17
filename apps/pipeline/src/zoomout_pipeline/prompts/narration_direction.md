<!--
Voiceover direction, per slide type (VO-2).

Sent as Cloud Text-to-Speech's `prompt` field — the style instruction — and never as spoken
text. `## shared` is prepended to each slide's own section; nothing outside a section is sent.

**Describe the delivery. Never tell the model to read anything.** The first version of this
file opened "Read the text exactly as written: every word, in order, with nothing added and
nothing left out", and Gemini-TTS read aloud everything after that colon — the whole direction —
before the Leaf text, in 12 of the 13 directed audition clips (2026-09-17); the 13th opened
"Sound like a software developer" where the Leaf says "You are". Every leaked transcript began
at "Every word, in order". A style prompt is not a place for instructions about the text; the
transcript guard and the pace check are what hold the text to the page.

**Short, like Google's own examples** ("Narrate this in the calm, authoritative tone of a nature
documentary narrator"). No colons, no lists, no quoted words.

**No conversational framing.** The second version's summary said "as if telling a friend", and
four of six audition voices opened Leaf 11 with "You know, in Okinawa…" — words nobody wrote. A
direction that casts the narrator as chatting invites the chat.

**Direction lives here, per slide type, and never per clip.** Hand-tuning 72 clips would not
survive a second book, and a direction that only works for Ikigai is not a direction.

**Emotion is set in prose, not with inline tags.** Google documents that emotional-adjective
tags such as [curious] are spoken aloud as words, and an untested tag may behave the same way.

Changing any section changes the hash every clip of that slide type is filed under, so a
direction change regenerates deliberately rather than mixing two directions in one book.
-->

## shared

A warm, grounded narrator speaking to one listener in a short lesson, natural and unhurried, with sincere feeling that comes from the meaning of the words rather than from performance, never like an announcer, a salesperson or a machine.

## summary

Introduce this idea from a book with gentle curiosity, warm and clear, never dramatic.

## scenario

Set up this everyday situation intimately and a little slowly so the listener can picture it, and let the closing question sound open and genuinely curious.

## payoff

Explain why this works with calm conviction and quiet warmth, like a good teacher watching understanding arrive, never lecturing.

## takeaway

Offer this closing thought a little more slowly, with warmth and quiet encouragement, and let the final sentence settle and come to rest.
