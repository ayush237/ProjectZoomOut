<!--
A narrator's self-introduction (ONBOARD-2). Sent as Cloud Text-to-Speech's `prompt` field, the
style instruction, and never as spoken text. Everything inside a comment like this one is
stripped before it is sent, and nothing else in this file is.

The first paragraph is the `## shared` block of `narration_direction.md`, word for word, so a
narrator introducing themselves sounds like the same narrator who then reads the lesson.
`tests/test_greetings.py` asserts the two are identical: changing the shared block is a decision
about how the narrator sounds, and it has to be made about this clip too.

The rules that file learned the hard way apply unchanged, and the same tests are run over this
one. Describe the delivery and never tell the model to read anything: a style prompt that does
gets spoken (12 of 13 audition clips). No colons, lists or quoted words. No conversational
framing, which invites words nobody wrote ("You know, in Okinawa..."). No inline tags, which
are also spoken aloud. Short, like Google's own examples.

The second paragraph is delivery only, adjectives and no verb that asks for an utterance, because
this clip is the one place a spoken "hello" added on top of the script would sound natural
instead of wrong. The transcript guard and the pace check are what would catch it.

**It has been through two revisions, and both reasons are measurements** (2026-09-24, against
the 144 lesson clips in the same two voices: Achernar and Sadaltager, 72 each).
1. "Warm, easy and welcoming, with a quiet smile in the voice, never gushing." came back at 219
   words a minute of speech from both narrators, faster than any lesson clip (Achernar 108 to
   215, Sadaltager 111 to 206; the short ones centred on 137 and 146). It was changed to ask for
   "a little slowly and clearly", vocabulary the `takeaway` direction already uses.
2. That version was slower (198 and 190) but Achernar's pitch movement was 10.3 semitones
   against 4.2 to 5.8 in the lesson clips, and the pitch 250 Hz against 219 to 240. **"A quiet smile
   in the voice" raises the voice and animates it**, so the greeting stopped sounding like the
   narrator it introduces. The phrase was dropped. The shared block already carries the warmth.
-->

A warm, grounded narrator speaking to one listener in a short lesson, natural and unhurried, with sincere feeling that comes from the meaning of the words rather than from performance, never like an announcer, a salesperson or a machine.

Warm and welcoming, a little slowly and clearly, never gushing.
