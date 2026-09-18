# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Active: voiceover — approved 2026-09-17

**The app reads the Leaf aloud in a human, emotionally expressive voice.** Four slides —
Summary, Scenario, Payoff, Takeaway — one voice, Ikigai only. 72 clips, 20,792 characters,
about 23 minutes of audio. **Ceiling $3 against the existing Google Cloud credit**; the
realistic cost is ~$0.35.

### The finding that shapes the decomposition

**The TTS integration is not the first package, and it is not the risky one.** Two blockers sit
in front of it and **both are outside Pipeline Manager's scope**, which is the WP4 lesson: a
criterion that cannot be met inside the scope it was given forces a scope breach.

1. **`Media` rejects audio.** `apps/admin/src/collections/Media.ts:45` is
   `mimeTypes: ['image/png', 'image/jpeg', 'image/webp']`, and there is no audio collection.
   **The pipeline cannot upload an mp3 today.**
2. **The backend mapper passes audio URLs through raw.** `content.mapper.ts:224` is
   `url: audio.url`, while images get `resolveMediaUrl(url, baseUrl)` at `:299`. **WP15.8's fix
   was never applied to audio**, because audio was never populated. Payload serves
   `/api/media/file/x.mp3`; `audioRefSchema` requires `z.url()`, so a relative URL does not
   merely fail to play — **it fails validation and can drop the Leaf.** The mapper test at
   `:259` uses an absolute URL, so **a green suite cannot see this.** Same shape as WP15's
   dropped fields.

**Both were found by reading the code rather than trusting the schema's readiness.** The schema
*is* ready — `audioRefSchema` has sat on all five slides since Phase 1 with a comment saying
enabling audio should be "a data migration rather than a reshaping of the Leaf." That was true
about the shape and not about the path.

### Packages

| | Package | Owner | Model | Delivers |
|---|---|---|---|---|
| **VO-1** | Foundations | Manager | Sonnet | Audio mime types on `Media`; `resolveMediaUrl` applied to audio, with a **relative**-URL test |
| **VO-2** | Generation | **Pipeline Manager** | **Opus** | Gemini 2.5 Flash TTS, voice selection, 72 clips, upload, draft writes, a concatenated review track |
| **VO-3** | Playback | Manager | Sonnet | The player, the control, the audio session. **Absorbs WP29** |

**Order: VO-1 → VO-2 → the founder publishes again → VO-3.** VO-3 needs real clips; a player
with nothing to play cannot verify itself.

**VO-3's handoff is deliberately not written yet.** Its spec depends on what VO-2 actually
produces — duration metadata, file naming, how a clip behaves at the end. Writing it now would
be writing criteria against a contract that does not exist, which this project has paid for
three times.

### Why Gemini TTS and not ElevenLabs, which PRODUCT.md named

**The wall is free-tier commercial licensing, not cost.** ElevenLabs, Hume, Cartesia and Azure
all forbid commercial use on their free tiers — ElevenLabs additionally requires "elevenlabs.io"
in the title. **Expressive + free + commercially usable is offered by zero hosted vendors.**

**Google Cloud TTS is the exception on all three**, and it is *not* the product WP32's check
refuses. That check gates the Gemini Developer API (AI Studio), whose own pricing page states it
trains on submitted content. **Cloud TTS and Vertex are Customer Data under the GCP DPA's
training restriction, and they are what the credit pays for.** The legal answer and the cost
answer agree, which is worth noticing because they usually do not.

The true zero-cost fallback, if the credit is ever withdrawn, is **Chatterbox** — MIT licensed
and the only permissively-licensed local model with a real emotion control. It costs Mac time
and quality, and its Apple Silicon support is reportedly inconsistent.

### Rulings — all four approved by the founder 2026-09-17

**Ruling 1 — $3 ceiling.** The work is ~$0.35. Three dollars covers regeneration, a voice A/B
and being wrong twice. **It is the stop signal, not a target.**

**Ruling 2 — voiceover uses the iOS `playback` category, SFX keeps `ambient`.** Voiceover plays
even with the hardware silent switch on; SFX stays muted by it. **A reader who taps "read this
to me" has asked for sound, and being silently ignored reads as broken.** The consequence is
that the app switches category by use, and VO-3 owns that. `SoundProvider.tsx` already records
the `ambient` half of this contract on `SoundPlayer`.

**Ruling 3 — WP29 is absorbed into VO-3.** WP29 restructures the Leaf player's footer so it
holds the currently-live action; a voiceover control is a persistent *secondary* control in the
same space. Designing them separately means restructuring that footer twice, with the second
pass invalidating the first — WP22.2's shape. **WP29 was handed off 2026-09-11 and never
started, so this costs nothing today.** Its handoff is superseded, not dropped.

**Ruling 4 — Ikigai only.** Track 42 would double it to ~$0.70, which is still nothing — but it
is 72 more clips to listen to, and Track 42's images are an unresolved problem already. **The
pilot decides whether voiceover earns a second book.**

### The risk worth naming loudest

**Nothing in the pipeline will hear all 72 clips as a set.** Each call is independent, so
prosody and energy can drift — clip 3 warm, clip 41 brisk. **This is structurally the same
defect as Track 42's eighteen identical scenario images:** *"nothing in the pipeline ever sees
the whole set, so collapse is structurally undetectable."* The images got a contact sheet and a
variety measure; **audio gets a single concatenated review track**, so the book can be heard end
to end in 23 minutes rather than approved 72 files at a time.

### The legal boundary, recorded before anyone can cross it

**Narration covers the body fields only — `summary.body`, `scenario.prompt`, `payoff.body`,
`takeaway.body`. Never `sourceReferences[].quote`.** Those bodies are ZoomOut's own prose; the
quotes are the book's verbatim text. **Reading the bodies aloud narrates our words; reading the
quotes aloud would produce an audio reproduction of copyrighted text**, which is a materially
different posture. A future package asked to "narrate the slide" would cross this without
noticing. Also in `LEGAL.md` as of this plan.

### ⚠️ Scope changed mid-VO-2: two narrators, and the reader chooses — 2026-09-17

**The founder auditioned six voices in the Pipeline Manager session and chose two** — Achernar
(female) and Sadaltager (male) — for readers to pick between. **This replaces Ruling 4's sibling,
"one voice is enough," made earlier the same day.** It is the founder's call and a good one to make
by ear; it is recorded here because it turned a data-fill into a **content-model change**, and
that changes the package order below.

**VO-2 stopped at the CMS write, correctly.** `audioRefSchema` holds one reference per slide, so
there was nowhere to put a second voice. 144 clips are rendered and checked (183 raw renders
cached, 228 MB, gitignored — **do not clean `ZO-pipeline/apps/pipeline/runs/`**). $1.79 of the $3
ceiling is spent; **$1.21 remains for everything that follows.**

### The schema ruling — how a slide carries two voices

**Slide audio becomes an array, keyed by narrator, and each entry carries a digest of the text it
was generated from.** Pipeline Manager's option (a), with three additions.

```ts
// packages/shared — the only list of narrators anywhere
export const NARRATOR_IDS = ['female', 'male'] as const;

audioRefSchema = z.object({
  narrator:        z.enum(NARRATOR_IDS),
  url:             z.url(),
  durationSeconds: z.number().positive(),        // now required — every clip is measured
  textDigest:      z.string().regex(/^[0-9a-f]{64}$/),
});
// each slide: audio: z.array(audioRefSchema).optional()  — at most one entry per narrator
```

**Keys are ZoomOut's, not Google's**, as Pipeline Manager recommended: a narrator can be re-cast
without breaking a reader's saved choice, and a reader who picked "female" on Ikigai gets the
female narrator on a second book even if a different Google voice reads it. **`female`/`male` are
accepted as named** because that is how the founder framed the choice. Adding a second narrator of
the same gender later needs a new key; the closed enum makes that a deliberate change rather than a
string someone typed. **The field is `narrator`, not `voice`** — "voice" already means Google's
name in the pipeline, and the whole point is keeping the two apart.

**Addition 1 — the default narrator lives in app config, never in array order.** Pipeline
Manager's draft said the player "falls back to the first." **That quietly reintroduces option (b)'s
flaw through ordering:** if regeneration writes Sadaltager first on one Leaf and Achernar first on
the next, a reader with no preference hears the narrator change between Leaves. **Array order
carries no meaning.** Which narrator plays before a reader chooses is a founder ruling, owned by
VO-3.

**Addition 2 — all narrators or none, per Leaf.** Pipeline Manager already refuses to attach a
Leaf with one failing clip, because *"three clips and a silent fourth reads as a broken player."*
**The same logic runs across narrators:** a reader who chose one voice must never be handed the
other mid-book because the first failed. A Leaf is attached only when every narrator passes on
every narrated slide.

**Addition 3 — `textDigest`, and the backend drops stale audio.** Reading VO-2's code: the
pipeline's clip cache correctly includes the text, but **nothing about the source text reaches the
CMS.** So once audio is attached, **anyone who edits a Leaf's text leaves narration playing that no
longer matches the screen — and nothing would notice.** Audio is *derived* from text, and this is
the first derived content in the model. The digest is `sha256` of the narrated field **exactly as
read back from Payload**, lowercase hex. The backend mapper recomputes it and **omits any entry
that does not match, with a structured warning** — so a stale clip fails closed, as a missing
button, rather than as words a reader cannot find on the page. **This is the cheapest moment to add
it: nothing reads the field and nothing has been written to it.**

**Narrated field per slide, which both sides must agree on exactly:** `summary.body` ·
`scenario.prompt` · `payoff.body` · `takeaway.body`. **`stickyNotes` has no narrated field, so any
audio entry there cannot be verified and is omitted.** Fail-safe; nothing writes it.

### Status 2026-09-18

**VO-1.1 is merged (12/12).** The narrator-keyed array is live in the dev database, backed up and
re-verified; the backend contract test `manager.md` had claimed for weeks now exists. **VO-2.1 is
handed off.** Remaining ceiling: **$1.21 of $3.**

**Two things the founder must do before VO-2.1 runs:**

1. **Leaf 9 (271) lost a space in the hand edit — it now reads `investments exposeyou to`, published.**
   Paste the whole sentence rather than retyping the fragment. **That is Architect's lesson, recorded
   in `architect.md`:** the unit handed to the founder should be pasteable whole.
2. **The backend is not running and cannot start on port 3000** — an unrelated Next.js project holds
   it on both stacks. Stop that project and start the backend. **VO-3 moves ZoomOut off 3000
   permanently**, because Next defaults there and this will otherwise recur.

**Leaf 5 (267) is correctly fixed** — "known as takumi", published.

### The default narrator, and what comes after voiceover

**The founder ruled 2026-09-18 that the reader's narrator is chosen in an onboarding flow** — a
separate feature, picked up once voiceover ships.

**It does not close VO-3's question.** VO-3 ships before onboarding exists, so it still needs a
default for every reader who has not been onboarded. **What it settles is the mechanism:** the
narrator is a stored preference with a default, and onboarding later *writes* that preference
rather than adding a second way to set the same thing. So **VO-3's design is unchanged, and only
the default value is still open** — a question for the founder's ear, best answered while
listening to the two review tracks.

### VO-2.1 signed off — 9 of 9, 2026-09-18

**144 entries attached across 18 Leaves × 4 slides × 2 narrators, all drafts, nothing published.**
Re-rendered exactly 4 (Leaf 5 summary, Leaf 9 payoff, both voices) for **$0.0346**. Ledger
**$1.8230 of the $3.00 ceiling.** Ran on Sonnet, as suggested.

**Gate counts traced rather than accepted** — the rule exists because WP33's silently narrowed.
`mypy` configured target **97 files**, `pytest` **438 passed**, against VO-2's **97** and **422**.
**No drop; +16 tests, all additions.** One label correction: the report compares to "VO-1.1", which
was the TypeScript package (1,391 JS tests, no Python gate). **The right baseline is VO-2, and
against VO-2 the numbers are correct.**

**What I verified, and what I did not.** Counts, criteria and the report's internal consistency:
verified. **The 144 live entries: not independently re-checked — Payload was not running when this
was signed off** (nothing on 3001). The report's own evidence is strong — a script outside the
pipeline and outside the test suite, re-fetching all 18 Leaves and recomputing every digest from the
JSON Payload returned — but it is the package's evidence, not a second opinion. Stated rather than
blurred.

### The finding that outranks both of VO-2.1's questions

**No gate in this pipeline can catch a typo, and Leaf 9 is the live case.**

`textDigest` proves the clip matches the stored text. **It says nothing about whether the stored
text is right.** A misspelling is therefore invisible to every check the pipeline runs: the guard
passes, the digest matches, verification is clean, and the narrator reads the error aloud in a
perfectly consistent way.

**Leaf 9 (271) was recorded on 2026-09-18 as published reading `investments exposeyou to`** — a
space lost when the founder retyped a hand-edit. **VO-2.1 then re-rendered Leaf 9's payoff in both
voices.** Whether it rendered the corrected text or the broken text depends on when the fix landed,
and **it cannot be determined from the report, because no gate looks at spelling.**

**Check before the 59-minute listen, not after.** If the field still reads `exposeyou`, the fix is
to correct and publish the text, then re-render that one slide in both voices — two clips, roughly
$0.017.

**The general rule this produces:** a pipeline gate that proves *consistency* must never be reported
as proving *correctness*. The two read identically in a green report.

### Ruling — `narrate --max-attempts` defaults to 3

**Raise it, and move `MAX_NARRATION_ATTEMPTS` with it** so the library default and the CLI default
cannot diverge. Verified in code 2026-09-18: `cli.py` defaults to **2** with `min=1, max=3`;
`narration_nodes.py` holds `MAX_NARRATION_ATTEMPTS = 2`; the README's documented recipe at line 274
already passes **3**. **A CLI whose default contradicts its own documented recipe is a trap**, and
Ikigai is the proof — it was rediscovered exactly the way a trap gets rediscovered, by a held Leaf
mid-run.

**The cost argument is settled by the option's own help text:** *"Attempts already on disk are
reused, so raising this re-buys only clips that still fail."* So the default does not multiply
across the corpus — it applies only to the clips that failed twice, which is precisely the set worth
retrying. At VO-2.1's measured **$0.0087 per clip**, five difficult lines in a new book cost about
**four cents.**

**The asymmetry decides it.** Too few attempts costs a held Leaf discovered mid-run, founder
attention, and a re-run. Too many costs pennies on the few clips that earn them.

**Accepted consequence:** the default then equals the maximum, so the flag's role flips from "raise
this when you have trouble" to "lower this to economise." **That is the better shape** — the safe
value is what you get by default, and thrift is the deliberate choice.

**Not a package.** Two constants, a README line and a test. **It rides the next pipeline handoff**
and is in the debt register — recorded in both places deliberately, because register entries have
gone stale in this project five times across four packages, and a handoff is what actually gets read.

### Payload's real array shape — recorded here so VO-3 cites the plan, not another worktree's report

Reported by VO-2.1 from the live server rather than assumed. Each row:

```
{ id, narrator, url, durationSeconds, textDigest }
```

**The two details that would actually bite VO-3:**

- **`id` is Payload's own bookkeeping** — a 24-character hex string, **absent before the first write
  and stable across re-fetches after.** Never compare rows on it; VO-2.1's own idempotency check had
  to be rewritten narrator-keyed for exactly this reason.
- **An untouched slide reads back `[]` — never `null`, never omitted.** So absence and emptiness are
  the same state, and a mapper that distinguishes them is inventing a case the server never sends.

Order is whatever the writer sent (VO-2.1 always writes female-then-male). **`content.ts` is explicit
that nothing may rely on it**, and VO-2.1's verification sorts before comparing.

### Package order, revised

| | | Owner | Model |
|---|---|---|---|
| 1 | **Commit VO-2**, push, PR, merge | Pipeline Manager → founder | — |
| 2 | **VO-1.1** — narrator-keyed audio + `textDigest`, the live DB push, **the backend contract test** | Manager | **Opus** |
| 3 | **Fix two Leaf texts and publish them** — see below | founder | — |
| 4 | **VO-2.1** — attach both narrators as drafts; first live run of the upload path | Pipeline Manager | Sonnet |
| 5 | **Listen to both review tracks** (~59 min) | founder | — |
| 6 | **Publish the 18 Leaves again** | founder | — |
| 7 | **VO-3** — player, **the stored narrator preference and its default**, audio session, the footer. **Not a first-run chooser** — see the pinned split below | Manager | Sonnet |

**VO-1.1 is Opus, unlike VO-1, because of what it touches.** It pushes a schema change that
**drops columns** on the database holding your only real books — Payload is in dev push mode (no
migrations directory), and turning a `group` into an `array` removes the group's columns on both
`leaves` and its versions table, which makes Drizzle prompt before dropping anything. And its
contract test creates and deletes content against real Payload. **The code is small; the care is
the package.**

**The backend contract test comes in now, reversing "not in front of voiceover" from earlier
today — because the scope changed.** One voice was a data fill; two voices is a content-model
change, which is precisely the trigger `manager.md` names, **on the exact seam that has now
produced two silent bugs** (WP15's dropped fields, VO-1's raw audio URLs). A new array field is
where a fixture written from understanding diverges from what Payload really returns — row `id`s,
empty arrays versus absent keys — and the fake inherits the blind spot.

**VO-2.1 and VO-3 are not written yet**, for the usual reason: VO-2.1 depends on the array shape
Payload actually produces, which VO-1.1 discovers.

**VO-3 owns the narrator *mechanism*; onboarding owns the *choosing*. Pin this in VO-3's handoff.**
Row 7 above reads *"player, narrator choice, audio session, the footer"* — written on 2026-09-17,
**before** the founder ruled the next day that the narrator is chosen in onboarding. Handed off as
written, that line has Manager build a chooser, and then the onboarding package builds a second one —
**which is the exact outcome the 2026-09-18 ruling rejected** when it turned down VO-3 asking on first
play. The split that honours it: **VO-3 builds the stored preference, its default, and a way to change
it later; onboarding writes that same preference at first run.** Recorded here rather than left in a
conversation, because this plan is what the handoff gets written from.

### Two Leaf texts, fixed by the founder before VO-2.1

Pipeline Manager flagged both because the narrators read them differently from how they are
written. **Verified against the live CMS 2026-09-17.**

| Leaf | Now | Suggested |
|---|---|---|
| **5** (id 267), summary | *"Japanese artisans, known as **takumis**, elevate…"* | *"…known as **takumi**, elevate…"* — Japanese has no plural inflection, and both narrators already say "takumi" |
| **9** (id 271), payoff | *"…while **small investments and a secondary income stream expose** you to…"* | *"…while **a secondary income stream and small investments expose** you to…"* |

**Leaf 9's sentence is grammatically correct** — the compound subject takes "expose." It reads as a
slip because a singular noun sits right before a plural verb, and **both narrators said "exposes,"
which is what a skimming reader will hear in their head too.** Swapping the order puts a plural noun
against its verb.

**Edit and *publish* — do not just save.** VO-2's attach path refuses a Leaf with unpublished
changes, deliberately. The four affected clips are re-rendered in VO-2.1 for about $0.05.

### The `alt` ruling — VO-1's question, decided 2026-09-17

**`Media.alt` stays required for everything, and VO-2 supplies a real descriptive label for each
of the 72 clips.** Not a conditional requirement, and not a transcript field.

**Audio needs no text alternative here, because it *is* the text alternative.** A transcript of
a narrated slide is the slide's own body, which is already on screen and already the accessible
form. Adding a transcript field would store a second copy of text the reader can already see.

**Conditional-required was the tempting answer and it is the wrong trade.** `Media.ts` records
why `alt` is enforced at three gates: *"a single shared predicate means one bug defeats every
gate."* Making it conditional adds a branch to a gate that exists to catch an image with no alt
text at upload time — and a bug in that branch makes `alt` optional for **images**, which is the
case that actually matters. **The cost of leaving it required is 72 strings; the cost of getting
the condition wrong is the gate.**

So `alt` becomes a useful label rather than a nuisance: *"Narration of the Payoff slide, Leaf 4."*
Payload's admin list shows it, which turns 72 rows of `leaf-04-payoff.mp3` into something legible.

### Open, carried rather than resolved

- **WP32's check does not cover a TTS client.** It gates the Gemini Developer API transport;
  Cloud TTS is a second egress path for Leaf content. The content is our own prose, so the
  hazard is lower — but this project records egress paths, and **VO-2 records its transport the
  way image generation now does.**
- **A second publish pass is required.** Ikigai's Leaves are published, so VO-2's writes land as
  pending draft versions (`machinesUpdateDraftsOnly` permits a machine write only with
  `?draft=true`) and **the live Leaf shows no audio until the founder publishes again.**

---

## Approved: INTRO-1 — the first-run intro, a zoom out through a neuron network — 2026-09-18

**Approved by the founder 2026-09-18** — the four beats, the five rulings and the copy. **Parallel to
voiceover**: mobile only, no backend, no content, no audio, so it runs while VO-2.1 and VO-3 are in
flight.

### The finding that shaped it

**The app already draws neurons.** `apps/mobile/src/screens/track/roadmapGeometry.ts` is a pure,
seeded function — `(states, viewport, seed) → geometry` — emitting nodes with **dendritic arbors**, a
**spine** of cubic Béziers, and a faint background **web** of unreached tissue. Its own docstring
records that an earlier mockup was rejected by the founder for reading *"as a constellation, not a
neuron"*, so **the neuronal quality is already art-directed** rather than something this package
invents.

`screens/share/constellationLayers.ts` already paints that geometry from `theme.palette` and batches
curves into one `<Path>` per (colour, width, opacity) — which is what makes a graph this dense
renderable at all. `TrackRoadmap.tsx` already animates SVG content through a Reanimated
`Animated.View` wrapper driven by `useSharedValue`. **The exact technique the zoom-out needs is
already working in this repository.**

So this is a camera move over existing geometry, not a new art project.

**And the intro is a preview of the Track roadmap** — the screen a reader spends their time inside.
The first thing anyone sees is what the product is, and the product is called ZoomOut. That coherence
is worth more than the effort it saves.

### The four beats

| # | Line | The camera |
|---|---|---|
| 1 | **Your mind is a vast landscape.** | One node at high magnification — a cell body with its dendritic arbors |
| 2 | **Nothing grows here in a single leap.** | Pulling back; neighbours and the spine curves enter |
| 3 | **What changes you is how small things connect.** | Still pulling; the `web` and `webDots` resolve |
| 4 | **Let's zoom out.** | Full graph, and signal travels the spine |

**One continuous camera move across all four, not four slides.** That is what makes it a film rather
than a carousel, and it is the conceit the product is named after.

**Beat 4's travelling signal is the only genuinely new visual** — an animated `strokeDashoffset` pulse
along the spine curves. On-system: the network is **teal** (interface) and the pulse is **amber**
(reward), which is the two-accent split `proposals/design-direction.md` describes.

**Beat 4 is the only beat carrying a control.** Beats 1–3 are film; beat 4 hands off to sign-in, which
is where *"Let's"* stops being decorative.

### The copy, and the one word changed on review

The founder mixed the final line set from two drafts. The chosen line 3 read *"What changes you is how
**they** connect"* — which worked in its original set, where the two preceding lines established
"ideas" as the antecedent. **In this mix nothing plural precedes it, so `they` pointed at nothing.**

On screen the picture supplies the referent. **For a VoiceOver reader hearing four lines, and for the
Reduce Motion still frame, it does not** — and those are exactly the two readers the composition
approach exists to serve. Changed to `small things`, which also earns the zoom inside the copy:
*vast landscape* → *small things* → connected.

**Lines are five to eight words by design, not only by taste.** The founder's first draft of line 3 ran
seventeen words; at the largest OS text setting that is the line that clips, against a live debt entry
about exactly that. The constraint improved the writing.

### The five rulings, approved 2026-09-18

| Question | Ruling |
|---|---|
| When does it play? | **First launch only, before sign-in** — a device-local flag on the `zoomout.soundEnabled` SecureStore pattern |
| Skippable? | **Yes, from the first frame.** An App Store reviewer meets this screen too |
| Advance | **Auto-advance on one continuous zoom**; tap skips ahead. Tap-to-advance would break the single camera move |
| Duration | **12–16 seconds** |
| Existing installs on update | **No.** It is a first-run piece |

### Built as a composition, not a video file

| Reason | What a video loses |
|---|---|
| **Theme** | A composition reads `theme.palette` and is correct in dark *and* light for free. A video bakes one theme, needs two exports, and drifts the moment a token changes |
| **Text** | Real `<Text>` on the app's `typography` **scales with the OS text setting and is read by VoiceOver.** Baked text does neither — a deliberate accessibility regression on the one surface every single user sees, in an app carrying a live large-text clipping debt |
| **Reduce Motion** | A video cannot honour it. A composition swaps to cross-fades: **the poetry survives, the motion does not** |
| **Cost** | No new dependency and no multi-MB asset. `react-native-svg` 15.15.4 and `react-native-reanimated` 4.5.1 are already dependencies |

**The honest counter-argument, recorded rather than waved away:** a hand-crafted After Effects piece
can be more beautiful than anything procedural. It is less true here, because the geometry is already
art-directed and a *camera move over existing geometry* is where procedural is strongest.

### Where it sits, and how it relates to onboarding

**Install → intro → sign-in/sign-up → age gate → account → onboarding's five beats → Leaf 1.**

They stay separate, and account creation sits between them, so first run is not seven taps in a row.

**One refinement to the onboarding section above: the intro now carries the emotional job, so
onboarding beat 1 keeps only the contract** — 15 minutes, one book, you will have to think. A narrowing
of beat 1, not a contradiction of it.

**Both packages edit `RootNavigator.tsx`, at different points** — the intro ahead of `AuthStack`,
onboarding after `signedIn`. Sequential in time, so this is a note rather than a conflict.

### Three risks

**Performance is the real one.** The geometry reports a `pathCount` and the drawing code batches paths
deliberately. Animating a zoom re-renders that every frame, and the batching is what keeps it viable.
**Smoothness is a physical-device observation; the simulator is not a performance signal.**

**The intro needs a synthetic graph.** `layoutRoadmap` takes real Leaf states and the intro has no
Track, so it needs a fixed state array and a **fixed seed** — which is what a brand moment wants
anyway, since it should be identical on every install and every device. **Render several seeds, look
at them, pick the prettiest**; do not take the first one that runs.

**Reduce Motion needs a designed fallback, not a disabled animation.** Four lines cross-fading over a
still frame of the finished network. `src/design/reduceMotionCallSites.test.tsx` is the mechanical
guard — **verified 2026-09-18 rather than cited from memory**: it spies on Reanimated and renders each
surface **twice**, accommodation on and off. **The intro is standalone-renderable and generates its own
fixture, so unlike `TrackRoadmap`'s `NextNodeRing` it can join that guard rather than be excluded from
it.**

## Approved, gated on VO-3: the onboarding flow — 2026-09-18

**Approved by the founder 2026-09-18** — the shape below and all five recommendations. **Not handed
off**, and the reason is a standing rule in `agents/architect.md`: beat 3 consumes an audio layer VO-3
has not built, and writing acceptance criteria against a contract that does not exist is the mistake
that has already caused three out-of-scope excursions. The handoff is written when VO-3's audio layer
can be read.

### What onboarding is for — the sentence that decides everything else

**It is an activation flow, not a preference wizard.** ZoomOut's differentiator is the active-recall
gate, and that is a feature bullet when explained and the product when experienced. A reader who
finishes one Leaf understands ZoomOut; a reader who reads three explainer screens does not. **So the
flow ends inside the Leaf player, not on Explore.**

The risk this guards against is specific rather than general. The founder's 2026-09-18 ruling
introduced onboarding as the place the narrator gets chosen — which is a *preference*. Design the
whole flow around preferences and the result is a settings wizard readers skip.

### The constraint that rules out the conventional design

**The library is two real Tracks.** Explore serves 28, of which Track 42 and Track 50 are real content
and the rest are placeholders. **Every conventional onboarding pattern is a lie at that size** —
interest tags, topic selection, "personalising your feed." The answer cannot be honoured, and the
hollowness lands on the very next screen.

That is permission rather than limitation: show the real books and let the reader pick one.

### The five beats

| # | Beat | What it does |
|---|---|---|
| 1 | **The promise** | One screen, not a carousel. **Narrowed 2026-09-18 to the contract only** — 15 minutes, one book, you will have to think — because INTRO-1 now carries the emotional job before sign-in |
| 2 | **Pick your first book** | The real Tracks as full-bleed cards, one line of promise each. Picking adds to Library through the existing mechanic |
| 3 | **Choose your narrator** | Two cards, female and male, each with a play button and a real sample. **The ruled beat** |
| 4 | **Into Leaf 1** | Lands in the player, not the catalogue |
| 5 | **The gate teaches itself** | A coach-mark on the scenario slide rather than an explainer screen |

**Beat 1 is where the session cap becomes an asset instead of a paywall.** The 15-minute / 500-XP cap
is a deliberate and unusual product decision. A reader who meets it on day one with no prior framing
reads it as a paywall; claimed up front it is the reason to trust the app. **This is the only place
that framing can happen before the fact.**

**Beat 2 precedes beat 3 deliberately, and there is a payoff in the order.** Book first lets the
narrator sample read a line from the book just picked — the product demonstrating itself rather than a
voice demo. **One caveat defers it:** VO-2 rendered audio for Ikigai only, so the flourish works for
Track 50 and not Track 42. Sample generically until voiceover coverage grows, and revisit when it does.

**Beat 5 is held loosest.** The unlock mechanic is self-evident the moment a reader meets it, and
explainer screens are what readers tap through fastest. A design call rather than a technical one.

### Deliberately excluded

- **An interests or goals questionnaire** — nothing behind it at two Tracks.
- **A "minutes per day" goal setter** — the cap is fixed and server-authoritative. Offering a choice
  implies configurability that does not exist and **undercuts the positive-friction design**, whose
  whole point is that the app decides rather than the reader.
- **A second age gate** — an auth step, built and audited in WP24. Onboarding starts after it.
- **A feature-tour carousel** — beat 4 does the job better.

### The five rulings, approved 2026-09-18

| Question | Ruling | Why |
|---|---|---|
| Before or after account creation? | **After** | `PRODUCT.md` rules out guest mode, so a pre-auth taste Leaf needs **client-side grading — a second implementation of the thing the product guarantees is server-decided.** A real architectural cost against a conversion hypothesis that cannot be tested yet |
| Notifications permission in onboarding? | **No** | **iOS grants exactly one prompt, ever.** Push notifications are Stage 4 and do not exist. Asking before there is anything to send spends a one-shot asset for nothing, and a reader who declines is gone permanently. The moment is after the first streak day, when the value is concrete |
| Skippable? | **Yes — but skip must land somewhere designed** | The narrator has a default, so nothing breaks. Skipping today drops the reader on **Explore with no first-run state**, which is the exact weak moment onboarding exists to fix. **So Explore's first-run treatment is in scope for the same package** |
| Narrator preference — device or account? | **Device, matching VO-3** | Zero backend work, and it honours the ruling that onboarding *writes* the existing preference rather than adding a second mechanism. `userSchema` has no preferences field at all, so account storage means a schema change, a migration and an endpoint |
| What do existing installs see? | **The narrator beat only** | Readers with an account and a non-empty library must not be sent through a first-book picker |

**The device-storage ruling carries a consequence to accept rather than discover: a reinstall or a
second device means the default narrator, and onboarding running again.** Correct for MVP, taken
knowingly.

### Two risks recorded now

**Onboarding promotes the cover problem from cosmetic to blocking.** Founder item 1 in
`launch-blockers.md` is that Track 42's cover hotlinks a retailer's CDN. Today that is a card in a
list. **A first-book picker makes covers the entire visual of a screen** — two or three full-bleed
cards and nothing else. The moment this flow is real, covers stop being polish.

**The mascot slot.** `proposals/design-direction.md` reserves four moments for a future character and
says to compose the layouts with that space accounted for. Onboarding is a natural fifth and probably
the best showcase of the five. **Compose beats 1–3 with that space** so a mascot stays an asset swap
rather than a redesign.

### Open, and not owned by onboarding

**Where terms-of-service and privacy acceptance land.** WP24's design prompt forbids the age gate's
checkbox from implying consent to anything but age, and GDPR/CCPA is a pre-launch blocker.
**Onboarding is the tempting place and the wrong one** — it belongs to Stage 5. Recorded so it does not
drift in by default.

### Why this is not handed off yet

Beat 3 plays an audio sample, so it consumes VO-3's audio layer. Building that layer inside an
onboarding package would invert the order and put foundational audio work in a package about first-run
UX. **VO-3 first; onboarding consumes it.**

The stronger reason is about the handoff itself. **Its acceptance criteria and device gate for beat 3
depend on what VO-3 actually builds** — how a sample is played, how the narrator preference is read and
written. `agents/architect.md` records three out-of-scope excursions caused by writing criteria against
a documented *intent* rather than a live *contract*. Writing them now would be the fourth.

## Active: the in-person pilot — one step left, 2026-09-17

**Step 1 (WP33, Leaf 4's bloom) and step 2 (publishing the eighteen Leaves) are both done.**
Ikigai is live and the app serves it — 18/18 verified anonymously, media serving, backend
answering. **What is left is a dev build on the founder's phone, shown to friends in person.**

> **⚠️ Founder signalled on 2026-09-17 that a new feature should be deployed first.** That
> **reverses the standing ruling of 2026-09-15** — *"stay on the free setup until Ikigai is
> published and real readers have seen it; no paid billing, no Claude on Vertex, no
> deployment."* The reversal may well be right, and it is the founder's to make; it is flagged
> here because the ruling is recorded and three parked packages hang off it. **What "deployed"
> costs is not small: WP12 needs a domain and the GCP account, and production media serving is
> still undesigned — it remains the single thing between real content and a real phone.**
> **Unresolved at the end of the 2026-09-17 session: whether "deploy first" means WP12, or a
> new feature that happens to need deploying. The next Architect session should settle that
> before planning anything.**

### The original three steps, for the record

### Superseded framing: the in-person pilot — the only thing on the critical path, 2026-09-16

**Three steps, in this order, and the order is load-bearing.**

1. ~~**WP33 — regenerate Ikigai Leaf 4's image**~~ ✅ **Done 2026-09-16, 8/8, $0.1455.** Passed on attempt 1 of 1. **One open question came back with it and it is the founder's:** see *Before step 2* below.
2. **The founder publishes Ikigai's eighteen Leaves.**
3. **A dev build on the founder's phone, shown to friends in person.**

**Why step 1 comes first, and it is not fussiness.** The machine account cannot edit a published
document — `access/publishing.ts`: *"an update to a live document is a live content change."*
Publish the Leaves first and Leaf 4's bloom is frozen permanently, exactly as Track 42's published
Leaf 1 is frozen today with "$10K" rendered on it. **Track 50 being published while its Leaves were
still drafts is the only reason WP31 could run at all**; that accident does not repeat.

**Leaf 4's bloom is the strongest evidence WP31 produced, and it is evidence against human review.**
A teal radial falloff at a soldering-iron tip. WP30.1's human pass cleared it; **Architect cleared it
again at sign-off, looking at the same contact sheet**; the guard caught it. A style check by eye
fails on exactly the images that look fine.

**✅ Step 1 is complete and the pre-flight passed — 18 of 18, $0.00 (WP33.1, PR #49). Publish when you are ready.** The caveat below is kept because it is the part that stays true after publishing.

**Before step 2 — the one decision WP33 handed back.** "Ikigai has no known style breach" means
*guarded at generation* for seventeen Leaves and *guarded as attached* for Leaf 4 only. Nothing in the
CLI has ever read an attached image back from Payload, and Manager was careful to say that their own
look at the other seventeen was a **contact sheet at ~240px**, not WP31's one-by-one pass at full size
— *"the set coheres, and that is all my looking establishes this time."* **That caution is right and
it is the same thumbnail-scale review that cleared Leaf 4 wrongly in WP30.1.**

**Ruled: publish, with a free pre-flight that is neither of the two options offered.** Re-guarding the
seventeen buys a *second non-deterministic sample* from the same instrument — the guard is a vision
call, and WP31 measured its precision at four real breaches and one false positive across nineteen. It
does not buy certainty, and it costs a package on the critical path. **The question actually worth
answering is whether the bytes Payload serves are the bytes the guard already cleared** — and that is
a sha256 comparison: free, deterministic, no model call. Every candidate is still on disk, each
overwritten in place by its own regeneration, and **Manager already proved the method on Leaf 4**
(byte-identical, `c2e0c8d6…`). It needs the machine key, so it is a two-minute Pipeline Manager task.

**What the hash check closes and what it does not.** It closes transfer and wiring — that the cleared
image is the served image, and that no candidate landed on the wrong Leaf, which is WP20's Leaf-11
defect family. **It does not re-examine the images**; seventeen still rest on their generation-time
verdict. That residual is accepted deliberately, because the pilot is friends in person on the
founder's own phone, and unpublish-then-fix is available.

**The honest counterweight, because it has a track record:** Track 42's published Leaf 1 has rendered
"$10K" with a glow since 2026-08-29, and the reason it is still there is that unpublishing is a founder
decision nobody has made. **"We can always take it down" is true and has not historically happened.**

**Founder ruling 2026-09-15, still governing: stay on the free setup until real readers have seen it.**
No paid billing, no Claude on Vertex, no deployment. Reviews come from friends, in person, on the
founder's own phone over LAN. That is what deprioritises WP12, WP13 and the cross-family work — they
are not blocked, they are deliberately behind the pilot.

**One check worth doing before step 3.** Payload's publish gate requires only a `disclaimer` and one
purchase link, but `trackSchema` in `packages/shared` requires five fields including `coverUrl` as
`z.url()`. **A Track can be published and then silently dropped by the backend** — that is Track 42's
bug and Ikigai is the same shape. One anonymous fetch of Track 50 after step 2 answers whether the
book actually opens. Better found now than in front of a friend.

### Open alongside, none of it blocking the pilot

- **WP29** — the Leaf player's footer. Handed off 2026-09-11, **never started**; its handoff is
  deliberately retained in the active log rather than pruned, because pruning a live handoff is how
  WP28 lost time.
- **WP26.1** — Track-scoped XP and first-try count. **Proposed 2026-09-10, still unanswered.**
- **Four pipeline items**, all separately packaged and all behind the pilot:
  1. **Track 42's live "$10K" image** — its published Leaf 1 renders "$10K" and "$2K" legibly *and*
     carries a glow: two absolute prohibitions, live in front of any reader. **The pipeline cannot
     fix it** — the machine account cannot edit published content — so it needs the founder to
     unpublish first. **That is a founder decision, and it is the only one of the four that a
     reader can currently see.**
  2. **The Leaf publish gate** — nothing stops a Leaf being published before the guard has seen it,
     and three completion reports have now asked people to remember instead. Track 50's Leaves
     being drafts is the accident that saved WP31.
  3. **The grounding gate's false reject** — `normalise_for_quote_match` folds an em dash to a
     hyphen and then collapses whitespace, so a PDF line break after an em dash makes an honest
     verbatim quote fail to match. Safe direction, but it thins the audit trail, and **the audit
     trail is the legal artefact.** Before book #3.
  4. **The gate-1 named-framework flag** — flag any planned Leaf whose `source_chapters` include a
     chapter that is itself a named framework. Ikigai's Leaf 17 was that breach and it passed every
     mechanical gate, because the 1:1 check measures chapter mapping and cannot see phrasing.

### The light ruling still stands, because it changes what "correct" means

`asset_style.md` forbade *"a shaft of light thrown across a surface"* while the whole library — and
the committed anchors — draw cast light. **The line is falloff, not subject matter:** cast light may
be a flat, hard-edged shape of a lighter surface value; no gradient, bloom, halo or emissive source.
WP31 rewrote the rule on that line and **it does not launder the breach it was asked about** — Leaf
8's auditorium is legal under it, Leaf 3's phone bloom is not, both verified against committed
fixtures. **This is the rule WP33's Leaf 4 is judged against.**

**A caution WP31 paid for twice:** the first rewrite explained hardness as *"an edge you could trace
with one line"* — the word *line*, in a contract whose previous paragraph forbids line art — and both
regenerated images came back as outlined drawings. A model-facing prompt that explains a prohibition
reintroduces it; that is now three for three.

---

## Completed: WP30.1 — finish Ikigai's images inside the credit, and fix Leaf 17 — 2026-09-15

**WP30 is signed off at 7 of 9.** The generator works and Ikigai's text exists — Track 50, 18 draft Leaves, nothing published, 134/134 source references with locators, and the shuffle confirmed working at 6/5/7 across A/B/C where Track 42 was position B on 15 of 18. **Both unmet criteria have a single cause: no Ikigai images were ever generated**, because spend hit $10.07 and stopped.

**WP30.1 finishes it on the existing Google Cloud credit**, which the founder has confirmed covers the remaining work. $5 ceiling. Eighteen images at one candidate each is $2.41; one candidate rather than gate 2's three is deliberate, because the new variety check catches collapse mechanically and that was most of what the extra candidates were for.

**Leaf 17 is rewritten first, and the order is not arbitrary.** It lifts three of the book's *"ten rules of ikigai"* in the book's own imperative phrasing — a named-framework breach that passed every mechanical gate, because the 1:1 check measures chapter mapping and cannot see phrasing. Rewriting it changes its scenario, which changes its derived setting, which changes its image; generate first and that image is bought twice.

**One criterion in WP30 was unmeetable as written, and that was mine.** The handoff required Ikigai to stay a draft *and* required an Ikigai Leaf observed in the app. `contentVisibility.ts` makes a draft unservable in **every** environment, deliberately — so closing that gap needs a backend change the same handoff excluded. WP30.1 replaces the device gate with an observation of the images themselves, and the in-app check is deferred to publication rather than dropped.

**Three packages are queued behind this**, all deliberately kept out so they cannot put a credit-bound run at risk: an **output-side text and glow detector** (Track 42's published Leaf 1 renders "$10K" and "$2K" legibly *and* carries a glow — two absolute prohibitions, live); a **per-Track text budget that refuses** rather than warns; and a **gate-1 flag** for any plan that puts a Leaf on the chapter holding a named framework.

**Still open alongside it:** WP29 (Manager, the Leaf player's footer) · WP26.1 (proposed, unanswered) · WP27's PR #40, now mergeable and waiting on a click.

---

## Completed: WP30 — Ikigai end to end, and the scenario-image fix — handed off 2026-09-11

**Book #2 is the active feature.** *Ikigai* (`ZO-admin/booksSource/Ikigai.pdf`) goes through the existing pipeline, and it carries a defect fix the founder found by looking at the app: **Track 42's eighteen scenario images are all a seated figure at a table in a dim interior**, whatever the scenario.

**One package, two halves, sequenced — and the sequence is the point.** Half A fixes and *proves* the image generator on a four-image before/after against Track 42's own scenario text, where the content already exists and only image spend is at risk. Half B then runs Ikigai once, with a generator that is known to work. Reversed, the eighteen-image spend gets paid twice.

**The diagnosis, verified against the live CMS rather than inferred.** Four causes, none of them the scenario prose: the image prompt never names a *place*; `asset_style.md`'s subject list is four-fifths people-at-tables; five of the six committed anchors are seated interiors, and a reference image carries environment as well as palette; and nothing in the pipeline ever sees the whole set, so collapse is structurally undetectable.

**The judgement call inside it is the anchor set** — it is what makes the library cohere, and a careless change trades sameness for the AI-slop drift the founder ruled against. That is why this is an Opus package.

**Two founder rulings carried into the handoff.** Ikigai lands as a **draft, not published** — it is in copyright, building against it was ruled acceptable 2026-08-13, and what ships at launch is still open. And **Track 42's published images are left alone** until the before/after exists, because that comparison is what answers whether to regenerate them.

**Still open alongside it:** WP29 (Manager, the Leaf player's footer) · WP26.1 (proposed, unanswered) · WP27's PR #40, signed off but unmerged.

---

## Completed: the visual redesign, WP21–WP27 — approved 2026-09-06, extended 2026-09-09

*Kept for its two rulings, which still constrain the app.*

The design exploration is complete: all 14 app surfaces exist as clickable mockups in Claude Design plus a published design system. Entry point `design/RESUME-HERE.md`. **Nothing in `apps/mobile` has changed yet.** This plan turns those mockups into the app, and was approved by the founder on 2026-09-06 including both rulings below.

**The redesign is three kinds of work wearing one name, and they carry very different risk.** That is the whole basis of the decomposition.

| | Package | What it is | Model | Status |
|---|---|---|---|---|
| **Layer 1** | **WP21 — foundation** | `react-native-svg`, Caveat font, token diff. **No screen changes** | Sonnet | 📤 **Handed off 2026-09-06** |
| **Layer 2** | **WP22 — Track roadmap** | Net-new screen with a real layout algorithm | **Opus** | ✅ **Signed off 2026-09-09 (10/10)**, PR #32 |
| | **WP22.1 — reduce-motion mechanism** | One flag, one place, four call sites routed through it | Sonnet | ✅ **Signed off 2026-09-09, 6/6** — closed by founder observation 2026-09-10 |
| **Layer 3** | WP23 — the sticky-notes board | Delivered. The re-skin half did not — no spec | Sonnet | ⚠️ **Partial, 2026-09-11**, PR #34 |
| | WP23.1 — the other four slides + the cork board | Unblocked: the spec is now nine screenshots in `design/leaf_player/` | Sonnet | 📤 **Handed off 2026-09-09** |
| | WP24 — auth, age gate, legal surface | Re-skin; all five surfaces exist | Sonnet | ✅ **Signed off (6/8 observed)**, PR #35 |
| | WP25 — achievement unlock, session-end/cap, report-error, failure states | Re-skin; all four exist | Sonnet | 📤 **Handed off 2026-09-09** |
| | WP26 — Track complete + share card | One new screen, one re-skin | Sonnet | 📤 **Handed off 2026-09-10**, blocked on PR #37 |
| | **WP27 — Explore, Library, Journey, Profile** + the icon swap | The gap found 2026-09-09, the last redesign package | Sonnet | ✅ **Signed off 2026-09-10**, PR #40 |

**✅ WP27's PR #40 is merged.** *This line said it was still open; corrected 2026-09-16 after checking — zero open PRs, and `Icon.tsx:91` reads `achievement: 'leaf'`. All fourteen surfaces are on `main`.*

**🎨 The redesign is complete as of 2026-09-10** — all fourteen surfaces in the new visual language, seven packages plus four follow-ups. What remains open is listed below, and none of it is redesign work.

Layer 1 is additive and invisible. Layer 3 is screen-by-screen and independently reversible. **Layer 2 is the only genuinely hard package**, and it is the centrepiece of the visual language.

## The two rulings — both decided 2026-09-06

**Ruling 1 — the roadmap becomes `TrackDetailScreen`.** It does not get a new screen, and Journey keeps its per-track card.

The collision this resolves: `TrackDetailScreen.tsx`'s own docstring refuses to be what the roadmap is — *"Deliberately thin. It is not a contents list — Journey and Library already own 'where am I in this'."* The roadmap **is** a contents list, so this was an information-architecture change to a decision WP10 made on purpose, not a visual one. Ruled toward absorption because a reader tapping a book should get the book: two screens that both mean "this book" is a tap the reader has to learn. **The legal pair — disclaimer and purchase-forward link — stays on that screen, below the graph.** It is the only place in the app that renders it today and WP3 makes a Track unservable without it.

**Ruling 2 — the sticky-notes board collapses to a single rotated column above a text-size threshold.** Notes keep their tape, shadow and paper at every size; they lose the scatter at large ones.

The collision this resolves is the sharpest in the redesign, and three things compound in it. `StickyNotesSlide.tsx` records that single-column was chosen *because* multi-column clips: *"at `accessibilityExtraExtraExtraLarge` any two-column arrangement either clips or leaves one column nearly empty — the seeded corpus varies note counts from two to six precisely so that was visible before it shipped."* The new board is exactly the staggered arrangement that finding rejected. On top of that sits the open, deliberately-unfixed debt that absolute `lineHeight` clips app-wide at XXXL, and Caveat renders roughly 1.35× larger. **Ruled toward degrading rather than accepting clipping, because the alternative makes the most decorative screen the one that breaks for the readers who need large text.**

## Findings that shaped the decomposition

- **The roadmap has no counterpart in the app at all.** The nearest thing, `TrackDetailScreen.tsx`, is 96 lines and deliberately not a contents list. So WP22 is a build, not a re-skin.
- **The mockup contains a picture of one instance, not an algorithm.** Its geometry is hardcoded — `{n:1,x:150,y:212}` — for **18 nodes**, and Track 42 has **exactly 18 Leaves**. A package verified against Track 42 alone would pass while proving nothing. `PRODUCT.md` specifies 15–30 Leaves, so **WP22's device gate must open a Track whose Leaf count is not 18.**
- **The share card is nearly free, and its risk is somewhere else.** `ShareCard.tsx` is already forced-light for precisely the reason the mockup gives, already brutal for thumbnail legibility, and already reserves a `MascotSlot` whose docstring says an illustration should drop in by *"replacing the contents of `MascotSlot` and nothing else"* — which is exactly where the constellation fragment goes. **The risk is the capture path**: `collapsable={false}` is load-bearing on Android and has not been re-tested since WP9. WP26's criterion must be about the captured image, not the rendered card.
- **Caveat is a three-line change.** `expo-font` and `@expo-google-fonts/*` are already wired and `App.tsx` gates first paint on `useFonts`.
- **A stale debt entry, corrected by checking.** The register still said `useReducedMotion` was "exported but never called — required fix". It is called in four places today (`AuthStack`, `ScenarioSlide`, `PayoffSlide`, `AchievementUnlock`). The real point survives the correction: the redesign multiplies animated surfaces — two four-frame sequences and the constellation resolve — so **swap-never-remove becomes a per-package criterion rather than a one-off.**

## Alternatives rejected

**A single big-bang re-skin.** One package touching 14 screens has no useful device gate and no way back, against an app that currently works end to end with 12 mobile test files behind it. Six packages each leave a shippable app. The accepted cost is that the app looks half-migrated between WP22 and WP26 — tolerable precisely because nothing is deployed and the founder is the only reader.

**Skia instead of `react-native-svg`.** `react-native-svg` covers every curve in the direction and is a first-party Expo SDK package versioned against the SDK; the direction explicitly rejects the lighting effects Skia exists for. `Icon.tsx` declined an SVG dependency once, but that reasoning was about taking a native dependency for icons alone and does not transfer.

**Building the curve primitive in WP21.** A primitive designed before its only caller exists is a guess. WP22 builds what it actually needs.

## Standing, unchanged by this plan

- **The second book** — still recommended, still Pipeline Manager's time, still runs in parallel with any of this.
- **WP12 deployment** — still parked. Production media serving remains the only thing between Track 42 and a real phone, and the answer-length publish-time check is still WP12's to carry.
