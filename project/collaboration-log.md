# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.


> **Phase 1 entries (WP0–WP15, to 2026-08-13) moved to `project/archive/collaboration-log-phase1.md`
> on 2026-08-28.** This file was 397KB — roughly 100k tokens that every session paid before reading a
> line of code. The archive is the durable record and is still there when a decision needs tracing;
> it is simply no longer loaded by default.


> **Older entries are archived.** Phase 1 in `project/archive/collaboration-log-phase1.md`,
> Phase 2 in `project/archive/collaboration-log-phase2.md`, and the visual redesign plus the first
> two books in `project/archive/collaboration-log-redesign.md` (split 2026-09-15). This file keeps
> the four most recent of each section — **plus any handoff whose package is still open**, an
> exception added 2026-09-15 because pruning a live handoff is how WP28 lost time. Every session
> pays for this file at startup. Archive at each sign-off, not when it hurts.

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

### Handoff: 2026-09-18 — VO-2.1: attach both narrators

*Pipeline Manager. **Suggested model: Sonnet** — you built this path already; it changes shape, not intent. The one thing that could have failed silently, whether Python and Node hash text identically, **has been verified rather than left to you** (9 of 9 vectors, below).*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **This is a linked git worktree, so `git checkout main` will fail** — `main` belongs to the primary checkout at `ZO`. Use **`git fetch origin && git switch -c vo-2.1-attach-narrators origin/main`** instead. (Corrected 2026-09-18: the original text said `git checkout main && git pull`, which is what left this worktree squatting on `main` and blocked the founder.) **VO-1.1 is merged and the array shape is live in the dev database.**
> **Commit, push and open the PR yourself when done** — added to `agents/pipeline-manager.md` on 2026-09-17; it never reached that file before, which is why VO-2 sat uncommitted.
> **Read:** this handoff · **your own VO-2 report** · **VO-1.1's completion report** for the shape Payload actually returns · `packages/shared/src/content.ts` (`NARRATOR_IDS`, `audioRefSchema`) **as the source of truth to mirror, not a file to edit** · `agents/pipeline-manager.md`.
> **Do not read or edit:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: VO-2.1 — the 144 clips reach the CMS

**Suggested model:** Sonnet.

**Context:** VO-2 rendered and checked 144 clips and stopped at the write, correctly — one voice per slide was all the schema could hold. **VO-1.1 replaced that with an array keyed by narrator, each entry carrying a digest of the text it was made from.** Everything is cached: 183 raw renders on disk, so this package buys almost nothing.

**Objective:** All 18 Leaves carry both narrators on all four narrated slides, as pending draft versions, with digests the backend will accept. Nothing published.

**Scope:** `apps/pipeline` — principally `narration_patch` and `verify_narration_write` — plus Ikigai's Leaf records. **Verify against VO-1.1's report rather than assuming the array shape.**

**The entry shape** — one per narrator, per narrated slide:

```
{ narrator: 'female' | 'male', url, durationSeconds, textDigest }
```

- **`NARRATOR_IDS` in `packages/shared` is the source of truth.** Mirror the two values with a test asserting exactly `female` and `male`, and a comment naming where they come from. **Achernar → `female`, Sadaltager → `male`.**
- **`textDigest` is `sha256` of the narrated field exactly as Payload returns it** — `summary.body`, `scenario.prompt`, `payoff.body`, `takeaway.body`. **No trim, no normalise, no case change.** The backend recomputes it and **silently drops any entry that does not match**, so a normalisation on your side alone makes every clip vanish after the founder publishes.

  > **Already checked, so you do not have to:** `hashlib.sha256(t.encode('utf-8')).hexdigest()` and Node's `createHash('sha256').update(t,'utf8').digest('hex')` agree on all 9 test vectors — ASCII, em dashes, curly quotes, padded whitespace, three real Leaf bodies, **and both Unicode forms of "Héctor García", which correctly hash differently from each other.** Neither side normalises. **Add the vectors as a Python test anyway**, so a future change that introduces normalisation fails loudly here instead of silently in the app.

- **`durationSeconds` is now required and must be positive.** You already measure it from the encoded bytes.
- **Array order carries no meaning.** The reader's default narrator is an app setting, not position. Do not rely on order and do not sort to imply precedence.

**Requirements**
- **All narrators or none, per Leaf.** You already refuse a Leaf with one failing clip because *"three clips and a silent fourth reads as a broken player."* **The same across voices:** a reader who chose one narrator must never be handed the other mid-book. A Leaf attaches only when both narrators pass on all four slides.
- **Re-render what changed.** The founder corrected two texts, so those clips must be re-made — your cache keys on the text, so this should happen by itself. **Say which clips were re-rendered and confirm it was only those.** They are Leaf 5's summary and Leaf 9's payoff, in both voices — **4 clips, about $0.05.**
- **This is the first time the upload path touches the live CMS.** `Media` accepts `audio/mpeg` as of VO-1 and the admin server has since restarted. **If an upload is rejected, stop and report** — that is a finding about the running server, not something to work around.
- **Draft writes only** (`?draft=true`). Re-fetch both versions and verify. **Refuse any Leaf carrying unpublished changes**, as you already do — and **say so loudly if one does**, because it means someone edited text after this handoff and its digest will be wrong.
- **Report what Payload's array actually returns** — row ids, ordering, how an empty array comes back. **VO-3 will build against that**, and it is the shape a hand-written fixture gets wrong.
- Record the transport, as VO-2 did. Report spend.

**Out of scope**
- **Publishing.** The founder publishes the Leaves a second time after this lands. **Nothing here publishes anything.**
- **Track 42**, `stickyNotes` audio, re-recording anything the founder has not changed.
- **The player, the narrator picker, the default narrator** — VO-3.
- `apps/mobile`, `apps/backend`, `apps/admin`, and `packages/shared` — **read `NARRATOR_IDS`, do not edit it.**

**Constraints:** **$1.21 remains of the $3 voiceover ceiling** — VO-2 spent $1.79. Expected spend here is about $0.05. **If you are approaching the ceiling, something is wrong; stop and report.** **`runs/` is gitignored and holds 228 MB of paid renders — do not clean it.**

**Device gate — the CMS, not the app.** The audio lands as unpublished drafts, so there is nothing to hear yet, and **the backend cannot be reached at all right now** — port 3000 is held by an unrelated project and ZoomOut's backend is down (register, 2026-09-18). **What to observe: re-fetch all 18 Leaves and see, in the draft version, both narrators on all four narrated slides with a URL, a positive duration and a digest — and the published version still carrying no audio at all.** Say plainly that you could not observe anything in the app and why.

**Acceptance criteria**
- [ ] `ruff check`, `ruff format --check`, `mypy` **(the configured target — report the file and test counts, and explain any drop)**, `pytest` clean; nothing outside `apps/pipeline` touched
- [ ] **18 Leaves × 4 slides × 2 narrators = 144 entries attached**, each with URL, positive `durationSeconds` and a 64-char lowercase digest
- [ ] **Every digest recomputes correctly from the text Payload returns** — checked by re-reading the stored Leaf, not from what you sent
- [ ] **The cross-language vectors are a Python test**, and it fails if normalisation is introduced
- [ ] **Exactly 4 clips re-rendered** (Leaf 5 summary, Leaf 9 payoff, both voices) — named, with cost
- [ ] **Every Leaf still `_status: published` with all audio confined to the pending draft** — verified by re-fetching both versions
- [ ] **A Leaf missing either narrator on any slide is refused, not partially attached** — mutation-checked
- [ ] **Payload's real array response shape is reported** for VO-3
- [ ] Transport recorded; spend reported against the $1.21 remaining
- [ ] **Anything you are not happy with is stated even though you shipped it**

**Testing expectations:** unit coverage on the reshaped patch and verification, each mutation-checked as its own reversion. **The load-bearing new test is the digest vector set** — it is the only thing standing between a normalisation change and 144 clips silently disappearing from a reader's screen. Say which evidence is a test, which is tooling, and which is you.

---

### Handoff: 2026-09-17 — VO-1.1: two narrators, a digest, and the contract test that was never there

*Manager. **Suggested model: Opus** — unlike VO-1. The code is small and fully specified below. **The care is the package:** it pushes a schema change that **drops columns** on the database holding the only two real books, and its test creates and deletes content against real Payload. A careless run here costs Ikigai, not a test.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO`. `git checkout main && git pull`, then branch from `origin/main`. **Push the branch and open the PR yourself when done** — ruled 2026-09-17, now in `agents/manager.md`.
> **Read:** this handoff · `project/projectplan.md`'s voiceover section, **especially "The schema ruling"** · `packages/shared/src/content.ts` (`audioRefSchema`) · `apps/admin/src/collections/Leaves.ts` (`audioField` ~line 99) · `apps/backend/src/content/content.mapper.ts` (`optionalAudio`, `mapBodySlide`, `resolveMediaUrl`) and its tests · `agents/manager.md`, **including the corrected maximal-fixture paragraph** · `apps/pipeline/tests/test_cms_roundtrip.py` **as a pattern to read, not a file to edit**.
> **Do not read:** `design/`, `projectRoadmap.md`. **Do not edit** anything under `apps/pipeline`.

### Task: VO-1.1 — slide audio carries a narrator and a digest

**Suggested model:** Opus.

**Context:** Voiceover was scoped to one voice; **the founder then chose two narrators — a female and a male voice — for readers to pick between.** Pipeline Manager has 144 clips rendered and checked, and stopped at the CMS write because `audioRefSchema` holds exactly one reference per slide. **Nothing reads slide audio yet and nothing has ever been written to it, so the shape can change now without migrating any data. It will never be cheaper.**

Reading the pipeline's code also showed that **nothing about the source text ever reaches the CMS.** Audio is the first content in this model that is *derived* from other content, and right now a Leaf whose text is edited after its audio is attached would keep playing narration that no longer matches the screen — with nothing able to notice.

**Objective:** Every narrated slide can carry one clip per narrator, each clip records a digest of the text it was made from, and the backend serves only clips whose digest still matches — proven end to end against real Payload and the real backend.

**Scope:** `packages/shared/src/content.ts` (+ regenerated `cms-generated.ts`), `apps/admin/src/collections/Leaves.ts`, `apps/backend/src/content/content.mapper.ts`, their tests, and a new live contract test in `apps/backend`. **Plus the live dev database's schema.** Verify this list rather than trusting it.

---

## Part A — the shared schema

```ts
export const NARRATOR_IDS = ['female', 'male'] as const;   // the only list of narrators, anywhere

audioRefSchema = z.object({
  narrator:        z.enum(NARRATOR_IDS),
  url:             z.url(),
  durationSeconds: z.number().positive(),                 // required now — every clip is measured
  textDigest:      z.string().regex(/^[0-9a-f]{64}$/),    // sha256, lowercase hex
});
// each slide that has audio today:  audio: z.array(audioRefSchema).optional()
```

- **At most one entry per narrator per slide** — enforce it in the schema, not only in Payload.
- **The field is `narrator`, not `voice`.** "Voice" means Google's name (Achernar, Sadaltager) in the pipeline; keeping the two words apart is the point.
- **Nothing about a *default* narrator goes here.** Which voice plays before a reader chooses is an app concern, owned by VO-3. **Array order carries no meaning** — see Part D.
- Update the reservation comment on `audioRefSchema`: it is no longer reserved.

## Part B — the Payload field

`audioField` becomes a `type: 'array'` with `narrator` (select, from the same list — **one source for the narrator IDs; say how you wired it**), `url` (text), `durationSeconds` (number), `textDigest` (text).

- **Validate one entry per narrator** on the array.
- **Make it visible and read-only in the admin** instead of hidden — the founder will want to see what is attached, and **a hand-edited entry would carry a wrong digest**. `readOnly` affects the admin UI only; the pipeline writes through the API.
- Regenerate `cms-generated.ts` and confirm it matches.

## Part C — the live database. **This is the part that can hurt.**

Payload runs in **dev push mode** — there is no migrations directory. Turning a `group` into an `array` means the push **drops the group's columns** (e.g. `summary_audio_url`) on **both** `leaves` **and its versions table**, and creates new array tables. **Drizzle prompts before dropping columns.**

**Requirements, in order:**
1. **Take a restorable backup of the Payload database before anything else.** Say where it is and how you would restore it.
2. **Prove the columns being dropped are empty** — every audio column, on `leaves` and on the versions table, `NULL` in every row. **Show the queries and the counts.** Nothing has ever written audio, so they should be; *should* is not evidence.
3. **Record the baseline:** row counts for Tracks, Leaves and Leaf versions; published counts; **Tracks 42 and 50 and their 36 Leaves, with `_status` and `updatedAt`.**
4. Apply the push. **Do not run it in a way that auto-declines or hangs on the prompt** — a non-interactive shell is exactly where that happens. **If it cannot be applied cleanly, stop and report; do not improvise with raw DDL against this database.**
5. **Repeat step 3 and compare.** And the check that matters most: **an anonymous fetch of Track 50's Leaves still returns 18, all published** — the same query the founder used on 2026-09-17.

WP15.4 set the precedent: **verified against the live dev DB, not only a fresh container.**

## Part D — the backend mapper

- **Map the array to entries; drop Payload's row `id`.**
- **Every entry's `url` goes through `resolveMediaUrl`.** VO-1 fixed this for the single object two packages ago; **a reshape that reintroduces raw URLs undoes VO-1**, and the test for it must now use a relative URL *inside an array entry*.
- **The digest check.** For each entry, recompute `sha256` of the slide's narrated text and **omit the entry if it does not match**, with a **structured warning** (Leaf id, slide, narrator, digest prefixes). Find the mapper's existing mechanism for reporting problems rather than inventing one.

  | Slide | Narrated field — both sides must hash exactly this |
  |---|---|
  | summary | `summary.body` |
  | scenario | `scenario.prompt` |
  | payoff | `payoff.body` |
  | takeaway | `takeaway.body` |
  | stickyNotes | **none — omit any entry, with a warning.** Nothing writes it; an unverifiable clip fails closed |

  **Hash the value exactly as Payload returns it** — no trimming, no normalising. The pipeline will hash the value it reads back from Payload; any normalisation on one side only makes *every* clip look stale. That failure is at least loud — the audio disappears — but it is the one to test for.
- **Fail closed, per entry, never per Leaf.** A stale entry, a missing `durationSeconds`, or **two entries for the same narrator** (keep neither — array order carries no meaning, so there is no "first") each drop that entry and warn. **The Leaf itself stays readable.**
- **No entries left → no `audio` key at all** (`exactOptionalPropertyTypes`, as today).

## Part E — the backend contract test that `manager.md` described and nobody built

`manager.md` said for weeks that a maximal-fixture test in `apps/backend` fetched content through the backend. **It never existed** (corrected 2026-09-17). The pipeline's round-trip goes pipeline → Payload → pipeline and never calls the backend. **WP15's dropped fields and VO-1's raw audio URLs both lived on the seam no test covers — and this package changes that seam again**, from an object to an array, which is exactly where a fixture written from understanding diverges from what Payload really returns.

**Build it:** author a Track and Leaf in **real Payload** with **every optional field populated** — including audio for **both narrators on all four narrated slides**, with **relative** URLs and correct digests, **plus one entry with a wrong digest and one on `stickyNotes`** — publish them, fetch through the **real backend** as an authenticated reader, and assert every field survives: relative URLs absolute, the stale and `stickyNotes` entries absent, row ids gone.

**Constraints on the test, because of where it runs:**
- **It must never create, modify or delete anything belonging to Tracks 42 or 50**, or any record it did not create. Whether it uses a dedicated fixture Track in the dev database or an isolated one is your call — **say which and why.**
- **It cleans up even when it fails.** A failed run must not leave a fixture Track in the founder's Explore screen.
- **The fixture Track must satisfy `trackSchema`'s requirements, not just Payload's publish gate** — Payload checks two fields, the backend requires seven, and a Track that fails the backend's check is dropped silently. **That will look like "Leaf not found," not like a validation error.**
- **Live-marked and excluded from the default gate**, like the pipeline's; the run command documented.

**Out of scope**
- **Anything under `apps/pipeline`.** VO-2's held write path targets the old shape and **will not work against this one** — that is expected, and VO-2.1 reshapes it. **Nobody should run it in between.**
- Playing audio, the narrator picker, the default narrator — VO-3.
- `apps/mobile`. Writing any real audio to any real Leaf.
- The contract test for every other collection — this is the Leaf maximal fixture, which is what `manager.md` names.

**Constraints:** no new runtime dependency. `resolveMediaUrl` already exists. **Structured logging** on every suppressed entry — *nothing fails silently*. Only the pre-push backup and the baseline queries touch the database outside Payload.

**Device gate — the live database and the contract test, not a screen.** Nothing plays audio yet, so there is nothing to see in the app. **What to observe: the before/after counts matching, Ikigai still returning 18 published Leaves anonymously, and the contract test going green against the real backend.** And one thing on a device if you can: **Ikigai still opens and reads normally** after the push. Say plainly which of these you observed.

**Acceptance criteria**
- [ ] Root `npm run lint`, `npm run typecheck`, `npm test` clean — **report the test and file counts**, and explain any drop from the last package's
- [ ] A **restorable backup** existed before the push, and its location is stated
- [ ] **Every dropped audio column proven `NULL`** on `leaves` **and** its versions table before the push — queries and counts shown
- [ ] **Baseline and post-push counts match**; Tracks 42 and 50 and their 36 Leaves unchanged in `_status` and content
- [ ] **Anonymous fetch of Track 50's Leaves returns 18 published** after the push
- [ ] `audioRefSchema` is narrator-keyed with `textDigest`, one entry per narrator enforced, `durationSeconds` required
- [ ] **A relative URL inside an array entry maps to absolute** — and the test **goes red** with `resolveMediaUrl` removed from the entry path
- [ ] **A stale digest is dropped with a structured warning** — and the test **goes red** with the digest check removed
- [ ] **Two entries for one narrator: neither survives** — tested
- [ ] **The live contract test passes against real Payload and the real backend**, and **goes red** when the mapper maps only the first array entry
- [ ] **The contract test touched nothing it did not create**, and cleaned up after a deliberately failed run — say how you checked
- [ ] Nothing under `apps/pipeline` or `apps/mobile` changed

**Testing expectations:** unit tests for every mapper rule above, each mutation-checked **as a separate reversion** — WP33.1 showed that one combined mutation cannot tell a fix from its bodyguard. The contract test is the load-bearing new artefact: **its value is that it contradicts our own understanding of Payload's response**, so if it passes first time with no surprises, look again at what it asserts. Say which evidence is a unit test, which is the live test, which is a database query, and which is you looking.

---

### Handoff: 2026-09-17 — VO-2: Ikigai, read aloud

*Pipeline Manager. **Suggested model: Opus** — the integration is small and the judgement is the whole package. **72 clips is more than anyone will listen to properly**, and that is exactly the pressure that let Leaf 4's bloom past two human passes, one of them Architect's at sign-off. "Does this sound like a person, or like a machine doing an impression of feeling" is the deliverable.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Check your branch — this checkout has been parked on a stale feature branch every time anyone looked.** `git checkout main && git pull`, then branch from `origin/main`. **VO-1 must be merged first** — without it `Media` rejects your uploads outright.
> **Transport:** Google **Cloud TTS**, billed to the founder's existing GCP credit. **This is not the AI Studio tier `require_paid_tier` refuses** — Cloud TTS and Vertex are Customer Data under the GCP DPA's training restriction, and they are what the credit pays for. Confirm that is the path you are actually on rather than assuming it from the SDK you imported.
> **Read:** this handoff · `project/projectplan.md`'s voiceover section, **including the legal boundary** · `project/LEGAL.md`'s narration section · `apps/pipeline/src/zoomout_pipeline/assets/` for the image pipeline's shape — upload, attach, draft-write — which is the precedent to follow · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: VO-2 — 72 clips that sound like someone who means it

**Suggested model:** Opus.

**Context:** Voiceover is approved — four slides per Leaf, one narrator, Ikigai only. The founder's requirement is explicit and it is not "audio exists": *"it should not read it directly like a robot, instead it should have emotions so that users can actually feel things."* **Gemini 2.5 Flash TTS supports natural-language style direction and inline tags** (`[curiosity]`, `[hope]`, `[short pause]`), which is the reason this vendor was chosen over three cheaper ones. **A technically correct, flat result is a failed package.**

**Objective:** All 72 clips exist, attached to Ikigai's Leaves as pending draft versions, in one consistent voice that a person would describe as warm rather than synthetic — and a single review track that lets the founder hear the whole book without opening 72 files.

**Scope:** `apps/pipeline`, plus Ikigai's Leaf records. **Verify the upload/attach path yourself against the image pipeline rather than trusting this list.**

**The four narrated fields, and nothing else:**
`summary.body` · `scenario.prompt` · `payoff.body` · `takeaway.body`

> **⚠️ `sourceReferences[].quote` is never narrated, and this is a legal boundary rather than a scoping preference.** Those bodies are ZoomOut's own prose; the quotes are the book's verbatim words. **Reading the bodies aloud narrates our words; reading the quotes aloud would produce an audio reproduction of copyrighted text**, which our fair-use position does not reach. `takeaway.dinnerTableKnowledge` and `applyInLife` are also out — not for legal reasons, just not in scope. **If you find yourself writing "narrate the slide", stop and narrate the named field.**

**Requirements**
- **Choose the voice, and justify it.** 30 prebuilt voices. **One narrator for all 72.** Say what you picked, what you rejected, and what you were listening for — this is the single most consequential aesthetic decision in the package and it should not be the first voice in the list.
- **Use the emotion steering rather than defaulting past it.** Work out what direction suits each slide *type* — a scenario is a situation being set, a payoff is an explanation landing, a takeaway is a closing thought. **Per-slide-type direction, not per-clip hand-tuning**, which would not survive a second book.
- **Populate `durationSeconds`.** `audioRefSchema` makes it optional and the player will want it. Measure it from the file; do not estimate.
- **`alt` is required on every Media upload and the founder has ruled it stays required.** Supply a real label — *"Narration of the Payoff slide, Leaf 4"* — not a placeholder. It is what makes 72 rows legible in the admin list.
- **Ikigai's Leaves are published, so every write must be a draft write** (`?draft=true` — `machinesUpdateDraftsOnly` permits nothing else for a machine). Each lands as a pending draft version; **the live Leaf shows no audio until the founder publishes again.** That second publish is theirs and is not this package's.
- **Produce one concatenated review track** — all 72 in reading order, ~23 minutes. See the risk below.
- **Record the transport**, the way image generation now does. Cloud TTS is a **second egress path** for Leaf content and should not arrive unlisted.
- **Report spend against the ceiling.**

**The risk this package exists to manage**

**Nothing will hear the 72 as a set unless you build the thing that does.** Each call is independent, so prosody and energy drift — clip 3 warm, clip 41 brisk, and no individual clip is wrong. **This is structurally identical to Track 42's eighteen identical scenario images:** *"nothing in the pipeline ever sees the whole set, so collapse is structurally undetectable."* The images got a contact sheet and a variety measure. **The review track is the audio equivalent and it is a requirement, not a nicety** — spot-checking eight clips is what clearing Leaf 4 by eye looked like.

**Things worth listening for specifically**
- **Em dashes and quotation marks.** The prose is full of them. An em dash should become a pause, not a word, and a quoted phrase should not shift register oddly. The grounding gate already had an em-dash defect; this is a different one at the same character.
- **Names and Japanese terms.** *Ikigai*, *Okinawa*, *Héctor García*, *moai*. Get them wrong and the whole thing sounds careless.
- **The end of a clip.** Trailing silence, a clipped final syllable, or an audible breath at the cut are what make a set feel cheap.

**Out of scope**
- **Publishing anything.** The founder publishes the Leaves a second time after this lands.
- **Track 42.** Ruled: Ikigai only. The pilot decides whether voiceover earns a second book.
- **`stickyNotes` audio.** The schema has the field; the product scope does not include it.
- **Anything in the mobile app.** No player, no UI — VO-3 owns that.
- **The backend contract-test gap** (register, 2026-09-17). Real, not yours, not now.
- `apps/mobile`, `apps/backend`, `apps/admin`.

**Constraints:** **Ceiling $3**, against ~$0.35 of expected cost. The headroom is for regenerating and for a voice comparison, **not for iterating toward a threshold.** **If you are approaching the ceiling, stop and report** — that is the signal, not a reason to ask for more. **If the emotion steering turns out not to work, that finding is worth more than 72 flat clips**: say so and stop rather than shipping audio that fails the requirement while meeting the criteria.

**Device gate — the review track, not the app.** Ikigai's Leaves are published but the *audio* lands as unpublished drafts, so there is nothing to hear in the app yet. **What to observe: the full review track, start to finish, in one sitting** — that it is recognisably one narrator throughout, that the emotion reads as meant rather than performed, and that nothing in it would make a listener wince. **Say that you listened to all of it, or say which parts you sampled.** Both are acceptable; only the pretence is not.

**Acceptance criteria**
- [ ] `ruff check`, `ruff format --check`, `mypy --strict`, `pytest` clean; nothing outside `apps/pipeline` touched
- [ ] **72 clips attached** — 18 Leaves × 4 slides — each with a URL, a measured `durationSeconds`, and a descriptive `alt`
- [ ] **Every Leaf still reads `_status: published` with the audio sitting in a pending draft version** — verified by re-fetching, not inferred from the write succeeding
- [ ] **No `sourceReferences[].quote` was sent to the TTS API.** Say how you ensured it — a code path that cannot reach those fields is better evidence than a promise
- [ ] **The voice choice is stated with its reasoning**, and the per-slide-type direction is written down
- [ ] **The review track exists and you listened to it**, reported as observation
- [ ] **The transport is recorded as a queryable row**, and you confirmed the run went through Cloud TTS rather than the AI Studio endpoint
- [ ] Spend reported against the $3 ceiling
- [ ] **Anything you heard that you are not happy with is stated even if you shipped it** — a known flaw on a list beats a discovery on a reader's phone

**Testing expectations:** unit coverage on the text selection (that only the four fields are reachable) and on the attach/draft-write path, mutation-checked. **The audio quality itself is not testable and should not be faked into one** — its evidence is the review track and you listening. As before: say which evidence is a test, which is the tooling, and which is you.

---

### Handoff: 2026-09-17 — VO-1: make the audio path exist

*Manager. **Suggested model: Sonnet** — two small fixes, both diagnosed, both with the correct implementation already identified in this handoff. **There is no judgement left to buy; the judgement was in finding them.***

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO`. **Check your branch first — this checkout was on `wp28.1-motion-override` and 47 commits behind on 2026-09-17.** `git checkout main && git pull`, then branch from `origin/main`.
> **Read:** this handoff · `apps/admin/src/collections/Media.ts` · `apps/backend/src/content/content.mapper.ts` (`optionalAudio` ~line 217, `resolveMediaUrl` ~line 299, and the WP15.8 note at ~line 37) · `apps/backend/src/content/content.mapper.test.ts` (the audio cases ~246–265) · `packages/shared/src/content.ts` (`audioRefSchema`) · `agents/manager.md`.
> **Do not read:** `apps/pipeline`, `design/`, `projectRoadmap.md`.

### Task: VO-1 — the two blockers in front of voiceover

**Suggested model:** Sonnet.

**Context:** Voiceover is approved — four slides, one voice, Ikigai, generated by the Python pipeline as 72 audio files. **The Leaf schema has been ready since Phase 1**: `audioRefSchema` sits on all five slides with a comment saying enabling audio should be *"a data migration rather than a reshaping of the Leaf."* That was true about the **shape** and false about the **path**. Two things stop an audio file reaching a reader, and neither is in the pipeline.

**Objective:** An audio file can be uploaded to the CMS and its URL survives the backend as an absolute URL. Nothing plays audio yet — that is VO-3.

**Scope:** `apps/admin/src/collections/Media.ts`, `apps/backend/src/content/content.mapper.ts`, and their tests. **Verify that list rather than trusting it.**

---

## Part A — `Media` rejects audio

`Media.ts:45` reads `mimeTypes: ['image/png', 'image/jpeg', 'image/webp']`, and there is no audio collection. **The pipeline cannot upload an mp3 today.**

**Requirements**
- Accept the audio type the pipeline will produce. **Decide the list yourself and say why** — the pipeline emits from Google Cloud TTS, so `audio/mpeg` is the expected case; whether to also accept `audio/mp4`, `audio/wav` or `audio/ogg` is a judgement about how much surface to open. **A narrower list is the safer default.**
- **Check what else in `Media` assumes an image.** `imageSizes`, resizing, focal point, alt-text handling — anything that runs on upload and would either fail or silently do nothing on an audio file. **Report what you found even where you changed nothing**; "nothing else assumed an image" is a useful result, and so is the opposite.
- Media's own comment says validation happens *"the moment it is uploaded rather than when someone tries to publish a Leaf using it."* **Keep that property.**

---

## Part B — the mapper mangles audio URLs, and the test cannot see it

**This is the one that matters.** `content.mapper.ts:224` returns `url: audio.url` — raw. Images at `:299` go through `resolveMediaUrl(url, baseUrl)`; `coverUrl` at `:76` does too. **WP15.8's fix was never applied to audio, because nothing has ever populated audio.**

Payload serves media at `/api/media/file/<name>` — **CMS-relative**. And `audioRefSchema` requires `z.url()`. So a relative audio URL does not merely fail to play: **it fails validation, and the Leaf carrying it can be rejected outright.** A reader would lose the whole Leaf, not the audio.

**The existing test cannot catch this.** `content.mapper.test.ts:259` asserts audio maps through using `https://cdn.test/a.mp3` — already absolute, so it passes identically with or without the fix. **This is WP15's shape: a mapper mishandling a field while the suite stays green.**

**Requirements**
- Route audio URLs through `resolveMediaUrl`, the same way images and `coverUrl` are. The function returns an already-absolute URL unchanged (see its own note ~line 315), so both cases stay correct.
- **Add a test that fails before your change and passes after** — audio with a **relative** URL, asserting the mapped result is absolute. **Mutation-check it:** revert the one-line fix and confirm your new test goes red **and the existing `:255` test stays green.** That contrast is the evidence; it demonstrates the old test never covered this.
- **Check the other four slides, not just the one you fix.** `optionalAudio` is called from `mapBodySlide` and from three slides directly (`:132`, `:139`, `:149`). **A fix in one call site and not the others is the defect this package exists to remove.**
- **`stickyNotes` carries an audio field too and is not in the narration scope.** Fix its mapping anyway — the mapper should be correct — but do not treat its absence from the product scope as a reason to skip it.

**Out of scope**
- **Playing audio.** No `expo-audio`, no player, no UI. `SoundProvider.tsx`'s deliberate no-op adapter stays exactly as it is — VO-3 owns that, along with the audio-session category ruling.
- **Generating or uploading any audio.** That is VO-2, Pipeline Manager's.
- Writing to any Leaf record.
- `apps/pipeline`, `apps/mobile`.

**Constraints:** no new runtime dependency in either app. **`resolveMediaUrl` already exists — use it rather than writing a second resolver**; two URL resolvers that differ for no reason are two things to remember.

**Device gate — none, deliberately.** There is nothing observable on a device: no audio exists yet and nothing plays it. **What stands in for it: a relative URL in, an absolute URL out, proven by a test that fails without the fix.** Say plainly that you could not observe this on a device rather than implying a check you did not run.

**Acceptance criteria**
- [ ] Root `npm run lint`, `npm run typecheck`, `npm test` clean
- [ ] `Media` accepts the audio type(s) you chose, **with your reasoning stated**, and rejects what is not on the list
- [ ] **What else in `Media` assumed an image is reported**, whether or not it needed changing
- [ ] **A relative audio URL maps to an absolute one** — new test, and it **fails with the fix reverted**
- [ ] **The pre-existing absolute-URL test still passes with the fix reverted** — stated explicitly, as the demonstration that it never covered this
- [ ] **All five slides' audio goes through the resolver**, `stickyNotes` included — say how you checked, not just that you did
- [ ] Nothing in `apps/mobile` changed; `SoundProvider` untouched

**Testing expectations:** unit coverage on both parts. **The load-bearing test is the relative-URL one, and its value is the mutation** — a test that passes before and after proves nothing here, which is exactly what the existing audio test does. If the maximal-fixture contract test needs an audio field to stay honest, add it there too and say so.

---

### Handoff: 2026-09-16 — WP33.1: prove the transfer, then stop the key leaking

*Pipeline Manager. **Suggested model: Sonnet** — Part A is a script over functions you have already run once, and Part B is one line in each of two places plus a test. **The judgement in Part A was spent choosing sha256 over re-guarding; what is left is reading a table.***

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Check your branch — that checkout was on `wp32-paid-tier-check` this morning.** `git checkout main && git pull`, then branch from `origin/main`.
> **Read:** this handoff · **your own WP33 completion report**, where you did Part A once for Leaf 4 · `apps/pipeline/src/zoomout_pipeline/config.py` · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP33.1 — the publish pre-flight, and the credential in the log

**Suggested model:** Sonnet.

**Context:** You ended WP33 by naming exactly the right caveat: *"Ikigai has no known style breach"* means **at generation time** for seventeen Leaves and **as attached** for Leaf 4 only. You offered two options — publish on generation-time evidence, or spend a package on the read-back command. **Ruled: neither.** Re-guarding seventeen images buys a *second non-deterministic sample* from an instrument measured at four real breaches and one false positive across nineteen; it does not buy certainty, and it costs a package on the critical path to the pilot.

**The question worth answering is whether the bytes Payload serves are the bytes the guard already cleared.** That is sha256 — free, deterministic, no model call — and **you already proved the method on Leaf 4** (byte-identical, `c2e0c8d6…`). Every candidate is still on disk and each was overwritten in place by its own regeneration, so the local file for every Leaf is its final cleared version. Verified by mtime 2026-09-16: Leaves 3 and 7 at 20:27/20:29 on 09-15, Leaf 4 at 10:53 on 09-16, the rest from the WP30.1 run.

**Objective:** A table of eighteen rows saying, for each Ikigai Leaf, whether what Payload serves is byte-identical to the candidate the guard cleared — and the Gemini and Payload keys no longer printable by a validation error.

---

## Part A — the pre-flight. **Report this the moment it is done; the founder publishes on it.**

**Scope:** a script. **Read-only against Payload — this part writes nothing, to any collection, ever.** Whether it lands as a committed command or a throwaway is your call; if committing it is more than a few minutes, run it and paste the table.

**Requirements**
- For each of Track 50's eighteen Leaves: fetch `scenario.image`, fetch the media bytes **from Payload**, sha256 them, and compare against `runs/ikigai/images/leaf-NN-scenario-1.png`.
- **Report all eighteen rows** — order index, `_status`, served filename, short hash, verdict. Not just the failures.
- **On any mismatch: stop and report. Do not fix, regenerate, or re-attach anything.** A mismatch means either the wrong candidate is attached or the bytes were transformed, and both change the founder's publish decision. Say which you think it is and what would settle it.

**Three traps, all of which cost me time this morning:**
- **A 200 with zero rows is what "not authenticated" looks like.** Drafts are invisible anonymously, and my first query returned `200` and an empty list, which reads exactly like "nothing there". **Assert the count is 18 before trusting a single verdict**, and say what the count was. *"18 of 18 match"* against an empty set is the failure mode this bullet exists to prevent.
- **The field is `trackId`, not `track`.** `where[track][equals]=50` returns HTTP 400.
- **The orderIndex→filename mapping is an assumption until Leaf 4 proves it.** Leaf 4 is your known-good anchor: you have its hash. **If Leaf 4 does not match, the harness is wrong, not the data** — fix the harness before reading anything else in the table.

**One hypothesis worth holding, so a bad result is read correctly.** If the seventeen mismatch *systematically* while Leaf 4 matches, the likely cause is not corruption — it is that WP30.1's batch path and WP33's script path differ in how they store bytes. **That is a finding about the pipeline, not a reason to regenerate seventeen images.** Say so rather than reaching for the generator.

**What this does not close, and should be said in your report so nobody over-reads it:** it establishes *transfer and wiring* — that the cleared image is the served image, and that no candidate landed on the wrong Leaf, which is WP20's Leaf-11 defect family. **It does not re-examine the images.** Seventeen still rest on their generation-time verdict, and that residual is accepted deliberately.

**Acceptance criteria — Part A**
- [ ] **Eighteen rows reported**, with the fetched-leaf count stated explicitly and asserted to be 18
- [ ] **Leaf 4 matches** its known hash `c2e0c8d6…` — the control that proves the mapping
- [ ] Every Leaf's `_status` is `draft`, and **nothing was written to Payload** — say how you know
- [ ] Any mismatch is reported and **not acted on**, with your read of the cause
- [ ] $0.00 spend — **if this part costs money, something is wrong; stop**

---

## Part B — `SecretStr`. Does not gate publishing.

**Context:** you hit this by accident in WP33 — a pydantic `ValidationError` on settings echoes the whole input dict, and a truncated Gemini key landed in your terminal. It would land in CI output the same way. **Verified in the code 2026-09-16: `config.py:101` declares `gemini_api_key: str`, `:172` `payload_api_key: str`, and `SecretStr` is not imported.**

It is being folded in here rather than waiting for a convenient package because it is a credential in a log, and "the next pipeline package" has historically meant three packages.

**Requirements**
- `SecretStr` on `gemini_api_key` and `payload_api_key`; update the call sites that read them.
- **A test that asserts a validation error does not contain the key material** — trigger the real failure (unset `ZOOMOUT_PIPELINE_DATABASE_URL`) and assert the rendered message. **A test that only asserts the field's type would pass against a future field that leaks.**
- **Mutation-check it:** revert the `SecretStr` on one field and confirm that test alone goes red.

**Out of scope (both parts)**
- **Publishing anything.** The founder publishes the eighteen Leaves; nothing here does it.
- **Regenerating any image**, including on a mismatch.
- Building the general `check-style` command — still debt, still after the pilot.
- `apps/mobile`, `apps/backend`, `apps/admin`.

**Constraints:** **Part A must cost $0.00** — no model calls. Part B is code only. If you find yourself about to call a model in either part, stop and say why.

**Device gate — the table, not the app.** Ikigai's Leaves are drafts and `contentVisibility.ts` makes a draft unservable everywhere, so there is nothing to see in the app. **What to observe: the eighteen rows, with the count asserted** — that every served image is the image the guard cleared, and that Leaf 4's row is the one you can check against a hash you already had.

**Acceptance criteria — Part B**
- [ ] `ruff check`, `ruff format --check`, `mypy --strict`, `pytest` clean; nothing outside `apps/pipeline` touched
- [ ] Both keys are `SecretStr`; the real validation failure renders them masked
- [ ] The test asserts **the absence of key material in the message**, not the field's type — and the mutation goes red

**Testing expectations:** Part A needs no test — it is a measurement, and its evidence is the table plus the Leaf 4 control. Part B needs the one test above. **Say which evidence is a test, which is the script, and which is you looking**; that split is why your last four reports were trustworthy.

---

### Handoff: 2026-09-16 — WP33: regenerate Ikigai Leaf 4's bloom

*Pipeline Manager. **Suggested model: Sonnet** — this is the rare pipeline package where the design is already written. WP31 built the guard, ruled the light rule, and did this exact operation twice on Leaves 3 and 7. There is no judgement left to buy; the guard makes the call.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Check your branch first — that checkout was parked on `wp32-paid-tier-check` on 2026-09-16, which predates WP32's own sign-off.** `git checkout main && git pull`, then branch from `origin/main`.
> **Transport:** `acquisition` is `undocumented`, so `require_paid_tier` now routes this to Vertex and **refuses** the free tier. That is a check as of WP32, not discipline — but confirm the refusal path is live rather than assuming it, because three consecutive reports cited a comment that was never true.
> **Read:** this handoff · **your own WP31 completion report** — the guard, the light-rule rewrite, and the two prompt defects it found · `apps/pipeline/src/zoomout_pipeline/assets/style_guard.py` · `prompts/asset_style.md`'s light rule · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP33 — the last image between Ikigai and a readable book

**Suggested model:** Sonnet.

**Context:** Ikigai's Leaf 4 carries a teal radial falloff at a soldering-iron tip — a bloom, and a breach of the light rule as WP31 rewrote it. **WP31 reported it rather than fixing it**, correctly: that package was scoped to Leaves 3 and 7 and its handoff called a flag on the other sixteen a finding, not a failure. It is now the only thing standing between Ikigai and publication, and **publication is the whole critical path to the in-person pilot.**

**What makes this worth a package rather than a note:** WP30.1's human pass cleared this image, and **Architect cleared it again at sign-off, looking at the same contact sheet.** The guard caught it. That is the strongest evidence WP31 produced and it is evidence against reviewing style by eye.

**Objective:** Leaf 4's scenario image is replaced with one that passes the style guard and still belongs to its scenario and to the set, attached as a draft.

**Scope:** `apps/pipeline`, plus Ikigai's **draft** Leaf 4 record. **Verify the regeneration path yourself** — you ran it twice in WP31 and that report is the authority, not this line.

**Requirements**
- **Regenerate Leaf 4's scenario image until it passes the guard**, then **look at it yourself.** Both, in that order — the guard is the gate, your eye is the second check, and WP31 established the guard catches what the eye misses rather than the reverse.
- **If it resists, stop and report rather than buying attempts.** Leaf 3 took four regenerations across two packages, and the cause was in the scenario prose rather than the image prompt. If Leaf 4 behaves the same way, **the finding is worth more than the image** — say what you found and stop.
- **Leaf 4 stays a draft.** Do not publish it, and do not touch any Track-level field.
- **Report the spend against the ceiling.**

**Out of scope**
- **Publishing Ikigai's Leaves.** That is the founder's action, immediately after this lands, and doing it early would freeze anything still wrong.
- **The other seventeen images.** They were guarded at generation and Leaf 4 is the only one flagged. If you have reason to think that is wrong, say so — do not act on it.
- **Track 42's published Leaf 1.** Still unfixable by this pipeline and still the guard's best fixture.
- **A `check-style` command over existing images** — see the constraint below. It is logged as debt and it is not this package.
- `apps/mobile`, `apps/backend`, `apps/admin`.

**Constraints:** **Ceiling $0.50.** One image at $0.134 plus guard reads at $0.004 each leaves room for three or four attempts, which is more than WP31 needed per Leaf after the prompt fixes landed. **If you are approaching the ceiling, that is the signal to stop and report, not to ask for more.**

**One correction to carry, because your own report will contradict it.** WP31's closing note says *"Do not publish the Leaves without running the guard over the set first — it is now one command and $0.073."* **That command does not exist.** Checked 2026-09-16: `check_style` is imported in exactly one place, `cli.py:397`, inside `generate-assets`, and fires only on a candidate as it is generated. Nothing reads attached images back. The 19-image sweep was your `live` suite. **Nothing was wrong with the work** — the sweep happened — but the note describes an affordance the CLI does not have, and the next person to trust it would skip a check believing they had run one. It is in the debt register; **do not build it here.**

**Device gate — the artefact, not the app.** Ikigai's Leaves are still drafts and `contentVisibility.ts` makes a draft unservable in every environment, so there is nothing to see in the app yet. **What to observe: the new Leaf 4 beside the old one, and the eighteen as a set** — that the bloom is gone, that no glow, text or floating iconography replaced it, that the soldering iron still reads as a soldering iron, and that the set still looks like one library.

**Acceptance criteria**
- [ ] Pipeline `lint`, `ruff format --check`, `mypy --strict`, `pytest` clean; nothing outside `apps/pipeline` touched
- [ ] **The guard goes red on the current Leaf 4** — show the verdict, in its own words. This is the criterion that proves the replacement was necessary rather than assumed
- [ ] **The replacement passes the guard**, and you say which attempt it was and what the earlier ones came back as
- [ ] **You looked at it**, beside the old one and against the set — reported as an observation, not a verdict
- [ ] **Leaf 4 is still a draft**; no Track-level field touched; no Leaf published
- [ ] **The transport is recorded and the run went through Vertex** — a row you can point at, not a sentence in this report
- [ ] Spend reported against the $0.50 ceiling
- [ ] **If anything about the other seventeen changed your mind, it is stated** — as a finding, with nothing acted on

**Testing expectations:** no new test is expected — the guard's coverage landed in WP31 and this package exercises it rather than extending it. **If you find yourself wanting one, that is a finding about the guard and worth reporting.** Say which evidence is the guard, which is a test, and which is you looking; that split is why your last three reports were trustworthy.

---

### Handoff: 2026-09-15 — WP32: make the paid-tier constraint a check

*Pipeline Manager. **Suggested model: Opus** — small code, and the reasoning about what to key it off decides whether it holds. **This was ruled the next package on 2026-09-15 and then not handed off; that delay is Architect's, and it is why three consecutive completion reports have had to report the same gap.***

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. Branch from `origin/main`.
> **⚠️ Until this package exists, the thing it builds does not:** `export USE_VERTEX=true` and unset the Gemini API key from the process before any model call.
> **Read:** this handoff · `apps/pipeline/src/zoomout_pipeline/config.py` (the comment at line 26 and `paid_tier` at ~160) · `apps/pipeline/src/zoomout_pipeline/llm/client.py` (`GeminiClient.__init__`) · `apps/pipeline/src/zoomout_pipeline/cms/mapper.py` (`require_known_author` — **the shape to copy**) · `packages/shared/src/content.ts` `TRACK_ACQUISITION_STATUSES` · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP32 — the constraint that is currently a comment

**Suggested model:** Opus.

**Context:** `config.py:26` says `require_paid_tier` *"turns that from a memory into a check."* **That function has never existed.** `paid_tier: bool = False` is read by no code; the only other mention is a second comment in `client.py`. `GeminiClient` takes `use_vertex` and `api_key` independently and cross-checks neither against the book being processed.

**Google's free tier trains on submitted content.** This is the control that keeps copyrighted works off it, and it is prose. **Ikigai — copyrighted — has already been through the pipeline twice.** It went through correctly, on one session's discipline, and **nothing in the repo records that it did**: the run log has no transport line, so the claim cannot be checked afterwards and never will be.

**Objective:** A run that would send a non-public-domain book through the free tier fails before the first call, and every run records which transport it used.

**Scope:** `apps/pipeline` only.

**Requirements**
- **Key the check off the book's `acquisition` status, not a hand-set bool.** `public-domain` may use the free Developer API; `purchased`, `licensed` and `undocumented` must use Vertex. **A flag someone has to remember to set is the failure this entry already is** — `paid_tier` exists today and is exactly that.
- **Fail before the first paid call, not on it.** `require_known_author` in `cms/mapper.py` is the shape to copy: it refuses, and **the refusal names the fix**. A run that dies at Leaf 9 with a quota error has already sent eight Leaves' worth of a copyrighted book somewhere it must not go.
- **Record the transport in the run.** Vertex or Developer API, the project id when Vertex, and the resolved `acquisition` — written where `status`/`cost` already look. **Provenance becomes a query rather than a memory**, which is the whole argument the `acquisition` field itself was built on.
- **Say what the check cannot see.** If it keys off `acquisition`, then a book mislabelled `public-domain` passes — name that plainly rather than leaving it implied.

**Out of scope**
- The grounding gate's false reject, the gate-1 named-framework flag, the Leaf publish gate — separately packaged.
- Any change to `apps/admin`'s collections or to `packages/shared`. If the check needs a value that does not exist in the pipeline's own state, **say so and stop** rather than reaching into another workspace.
- Fixing Ikigai or Track 42.
- **Chasing the Vertex quota for Claude** — that is a founder console action, tracked separately.

**Constraints:** **Ceiling $1.** This should need almost no model calls; if it needs more than a smoke test, say why before spending.

**Device gate — none, and that is deliberate.** Nothing here reaches a screen. **What to observe instead: the check refusing.** Point a run at a non-public-domain book with Vertex disabled and confirm it **stops before any call is made** — not that it warns, not that it fails partway.

**Acceptance criteria**
- [ ] Pipeline `lint`, `ruff format --check`, `mypy --strict`, `pytest` clean
- [ ] **A non-public-domain book with the free tier configured refuses before the first model call** — demonstrate it, and show that zero calls were made
- [ ] A public-domain book on the free tier still runs
- [ ] Any book on Vertex runs
- [ ] **The run records its transport, project id and resolved `acquisition`** — show the record from a real run
- [ ] `config.py:26`'s comment is either true or gone — **no comment describing a function that does not exist**
- [ ] **What the check cannot catch, stated plainly**
- [ ] Spend reported against the $1 ceiling

**Testing expectations:** unit coverage on the refusal, both directions, mutation-checked — remove the check and confirm the refusal test goes red. **The load-bearing test is the one proving no call was made**, not the one proving an exception was raised.

---


### Handoff: 2026-09-15 — WP31: the output-side image guard, and Ikigai's last two breaches

*Pipeline Manager. **Suggested model: Opus** — the finding is the deliverable. A detector that reports clean on an image with "$10K" written across it is the exact failure this package exists to prevent, and it is the failure that reports green.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. Branch from `origin/main`.
> **⚠️ Before any model call:** `export USE_VERTEX=true` and **unset the Gemini API key from the process.** `ZOOMOUT_PIPELINE_PAID_TIER` is enforced by nothing — `require_paid_tier` does not exist, `paid_tier` is read by no code — and Ikigai is a copyrighted book. The free Developer API trains on submitted content. This is discipline, not a check, until the paid-tier package lands.
> **Read:** this handoff · **your WP30.1 completion report, commit `88a3e14`** · **WP30's, commit `a00527f`** · `apps/pipeline/src/zoomout_pipeline/assets/variety.py` — the precedent for image analysis in this service · `prompts/asset_style.md` · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP31 — catch in the output what the prompt cannot prevent

**Suggested model:** Opus.

**Context:** Three absolute prohibitions in the style contract are breached by images that passed every gate. **Ikigai Leaf 3** has a soft phone glow and two floating notification icons; **Leaf 7** has floating icons; **Track 42's published Leaf 1** renders "$10K" and "$2K" legibly *and* carries a glow. WP30 closed the input half — a focus object whose whole point is its writing is refused at parse — but a model asked for a laptop still writes "$10K" on it, and **nothing looks at the result.** Both Ikigai scenarios are about digital distraction, so this is a predictable failure of a whole scenario class, not bad luck.

**Objective:** Generated images are checked for text, glow and floating iconography before they are attached, and Ikigai's Leaves 3 and 7 pass.

**Scope:** `apps/pipeline` only, plus Ikigai's **draft** Leaf records. **Track 50 itself is published as of 2026-09-15 and is therefore out of reach** — the machine account cannot edit published documents. Its eighteen Leaves are still drafts, which is what keeps this package runnable.

**Requirements**
- **Build the output-side guard.** Design it yourself — `variety.py` is the precedent for image analysis here, and whether this is classical CV, a vision call, or both is your call. **Say what you chose and what it cannot catch**, because every one of these has a blind spot and an unstated blind spot is worse than a known one.
- **It must fire on the known-bad fixtures.** Track 42's Leaf 1 (text + glow) and Ikigai's current Leaf 3 (glow + floating icons) are the corpus. **A guard that has never gone red against a real breach is not evidence.** Commit them as fixtures the way `collapsed-track` already is.
- **Regenerate Ikigai Leaves 3 and 7 until they pass the guard**, then look at them yourself. Leaf 3 came back worse once already; if it resists, **say so and stop** rather than buying attempts.
- **Rewrite `asset_style.md`'s light rule.** It currently forbids *"a shaft of light thrown across a surface"* while the whole library and the committed anchors draw cast light. **The ruling: the line is falloff, not subject matter — cast light may be a flat, hard-edged shape of a lighter surface value; no gradient, bloom, halo or emissive source.** Leaf 8's auditorium is a hard-edged polygon and stays legal; Leaf 3's phone is a soft bloom and does not. **The rewrite must not launder the breach it was asked about.**

**Out of scope**
- **Track 42's published Leaf 1 — read-only, as a fixture.** The machine account cannot edit published content (`access/publishing.ts`: *"an update to a live document is a live content change"*), so fixing it needs the founder to unpublish first. **That is a founder decision and not this package's.** Use the image; do not try to replace it.
- Publishing Ikigai, or any Track-level field — the founder is filling those by hand.
- The paid-tier check, the grounding false reject, the gate-1 named-framework flag — all separately packaged.
- `apps/mobile`, `apps/backend`, `apps/admin`.

**Constraints:** **Ceiling $4.** Two Leaves at one candidate each is well under; the rest is headroom for regeneration and for whatever the guard itself costs per image. **If the guard is expensive per image, say what it would cost across an 18-Leaf book before adopting it as a default** — a check nobody can afford to run is not a check.

**Device gate — the artefacts, not the app.** Ikigai is still a draft and `contentVisibility.ts` makes drafts unservable in every environment. **What to observe: Leaves 3 and 7 side by side with their current versions, and the eighteen as a set** — that the two replacements carry no text, no glow and no floating iconography, and that they still belong to their scenarios and to the set's visual identity.

**Acceptance criteria**
- [ ] Pipeline `lint`, `ruff format --check`, `mypy --strict`, `pytest` clean
- [ ] **The guard goes red on Track 42 Leaf 1 and on Ikigai's current Leaf 3** — show both results
- [ ] The guard passes the other sixteen Ikigai images — **and if it flags any of them, that is a finding, not a failure; report it**
- [ ] **Ikigai Leaves 3 and 7 replaced**, passing the guard, and **looked at**
- [ ] `asset_style.md`'s light rule rewritten on the falloff line; **Leaf 8's cast light still legal, Leaf 3's glow still a breach**
- [ ] **Ikigai's eighteen Leaves are still drafts**, and no Track-level field is touched. **Track 50 itself was published by the founder on 2026-09-15, after this handoff was written** — the Leaves were not, which is the only reason this package can still run: the machine account cannot edit published documents, and a published Leaf would be frozen. **Do not publish the Leaves**; that is the founder's action once this package lands
- [ ] **What the guard cannot catch, stated plainly**
- [ ] Spend reported against the $4 ceiling

**Testing expectations:** unit coverage on the guard, with the known-bad fixtures as the load-bearing cases. Mutation-check it: disable the detector and confirm the fixture tests go red. **Say which evidence is a test, which is the guard, and which is you looking** — that split is why your last two reports were trustworthy.

---


### Handoff: 2026-09-15 — WP30.1: finish Ikigai's images inside the credit, and fix Leaf 17

*Pipeline Manager — **a fresh session, so this handoff assumes no memory of WP30.** **Suggested model: Opus.** Two judgement calls, both of the kind that report green while being wrong: whether a rewritten Leaf 17 still reproduces the book's named framework, and whether eighteen images actually vary. Neither is testable.*

> **Where you work:** the pipeline checkout at `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Branch from `origin/main`** — WP30 merged as PR #44 and all of its code (`assets/variety.py`, `graph/scene_settings.py`, the rewritten `prompts/asset_style.md`, `prompts/anchor_instruction.md`) is already there. Do **not** continue on `wp30-scenario-settings`.
> **Read:** this handoff · **WP30's completion report, commit `a00527f`** · **WP30's handoff, commit `da5bfb8`** — both cited by hash because the log prunes by position · `apps/pipeline/src/zoomout_pipeline/assets/variety.py` · `apps/pipeline/src/zoomout_pipeline/graph/scene_settings.py` · `apps/pipeline/src/zoomout_pipeline/prompts/asset_style.md` · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP30.1 — Ikigai's eighteen images, and the named-framework breach

**Suggested model:** Opus.

**Context:** WP30 built the scene-setting generator and produced Ikigai's text — Track 50, 18 draft Leaves, nothing published — then stopped before images when spend reached $10.07. **Two of its nine criteria are unmet for one reason: no Ikigai images exist.** Separately, WP30's own report found that **Ikigai's Leaf 17 lifts three of the book's "ten rules of ikigai" as sticky notes, in the book's own imperative phrasing.** `PRODUCT.md` forbids reproducing a named framework 1:1. It passed every mechanical gate, because the 1:1 check measures chapter mapping and cannot see phrasing.

**Budget — the hard constraint of this package.** The founder has confirmed the existing Google Cloud credit covers this and wants Ikigai finished on it. **Ceiling: $5 total.** Eighteen images at one candidate each is $2.41; the Leaf 17 regeneration is the rest. **If the run would exceed $5, stop and report rather than continue** — WP30 overran a stated ceiling by 2x and its own report is clear that narrating a rate is not the same as asking.

**Order matters and is not arbitrary.** Leaf 17 is rewritten **first**. Its rewrite changes its scenario, which changes its derived setting, which changes its image. Generate first and you buy that image twice.

**Scope:** `apps/pipeline` only, plus the Ikigai draft records in the CMS that the pipeline already owns.

**Requirements**
- **Rewrite Leaf 17 so it does not reproduce the book's named framework.** Teach the same idea without lifting the list or its phrasing. Run it at `editorial_attempts=1` — WP20 made that cap configurable for throughput, and WP30 established it is also the cost lever.
- **Re-derive the Track-level ScenePlan after the rewrite**, so Leaf 17's setting reflects the new scenario and the whole-Track variety constraint still holds across all eighteen.
- **Generate eighteen scenario images, one candidate per Leaf.** One rather than gate 2's three is deliberate: the variety check now catches collapse mechanically, which is most of what a second and third candidate were for.
- **The variety check gates the set before anything is attached.** Regenerate only the Leaves it flags, and only if the ceiling allows. If it still fails after one regeneration pass, **stop and report the score** — do not keep buying images toward a threshold.
- **Look at all eighteen yourself before attaching them.** Specifically for: **any text, letters or numerals**; **any glow or light bloom**; and disembodied limbs. All three are absolute prohibitions in the style contract, and all three have shipped past the mechanical gates before — Track 42's published Leaf 1 renders "$10K" and "$2K" legibly *and* has a glow on the teal card, which is live right now on a published Track.
- **Retain the images.** WP30's four-image before/after was its own most important evidence and no longer exists on disk — nothing from that comparison survives, so neither the founder nor Architect can see what was claimed. **Save the eighteen where they survive the session** and hand the founder a contact sheet.

**Out of scope**
- **An output-side text/glow detector.** Wanted, and a separate package — it must not put this credit-bound run at risk.
- **A per-Track text budget that refuses.** Also wanted, also separate; `ImageBudget` already halts, which is what this package needs.
- **Track 42's published images**, including the Leaf 1 breach. Logged separately.
- **Publishing Ikigai.** Draft only, unchanged from WP30.
- `apps/mobile`, `apps/backend`, `apps/admin`, any shared-type or Payload collection change.

**Device gate — replaced, and here is why.** WP30's device gate asked for Ikigai Leaves observed in the app. **That was unmeetable and the fault was Architect's**: `apps/backend/src/content/contentVisibility.ts` returns `content.status === 'published'` in *every* non-production environment — *"a draft is never servable anywhere"*, deliberately — so no draft Track can reach the app without a backend change the same handoff put out of scope. **What to observe instead: the eighteen images as a set, side by side.** For each one, whether its place belongs to its scenario; across the set, whether the places differ. The in-app observation is deferred to whenever Ikigai is published and is recorded as debt, not dropped.

**Acceptance criteria**
- [ ] Pipeline `lint`, `ruff format --check`, `mypy --strict`, `pytest` all clean
- [ ] **Leaf 17 no longer reproduces the ten rules** — neither the list nor its phrasing. Say in your own words why the rewrite clears it, rather than asserting that it does
- [ ] All eighteen Ikigai Leaves carry a scenario image; Track 50 is still a **draft**, still `acquisition: undocumented`
- [ ] **The variety check passes against Ikigai's eighteen** — report the median nearest-neighbour distance and the closest pair, not just the verdict
- [ ] The same check still **fails against Track 42's set** — it is committed as `tests/fixtures/collapsed-track`, so run it both ways and show both numbers
- [ ] **Observed: eighteen images looked at, no text, no glow, no disembodied limbs** — name anything you rejected and regenerated
- [ ] **The eighteen images are retained and a contact sheet is handed over**
- [ ] **Total spend reported against the $5 ceiling**, images and text separately

**Testing expectations:** no new test can prove the variety claim, and do not write one that pretends to. Cover the Leaf 17 regeneration path and any change to scene derivation. **Say plainly which evidence is a test, which is the variety check, and which is you looking at pictures** — WP30 got this right and it is the reason its report was trustworthy.

---


### Handoff: 2026-09-11 — WP30: Ikigai end to end, with scenario images that match their scenarios

*Pipeline Manager. **Suggested model: Opus** — the finding is the deliverable on the first half. "The images vary now" is exactly the claim that can be asserted green while being false; it took the founder's eye to catch the current state.*

> **Read:** this handoff · `apps/pipeline/src/zoomout_pipeline/graph/asset_nodes.py` (`scenario_image_prompt`) · `apps/pipeline/src/zoomout_pipeline/prompts/asset_style.md` · `apps/pipeline/src/zoomout_pipeline/assets/images.py` · `apps/pipeline/assets/anchors/` · `project/proposals/design-direction.md` · your own WP18 and WP20 completion reports in this log · `agents/pipeline-manager.md`.
> **Do not read:** `apps/mobile`, `apps/backend`, `apps/admin`, `design/`, `projectRoadmap.md`.

### Task: WP30 — Ikigai end to end, with scenario images that match their scenarios

**Suggested model:** Opus.

**Context:** Track 42's eighteen scenario images are all a seated figure at a table in a dim interior. **Verified on the published record, not reported** — Architect pulled Leaves 0, 5, 9 and 13 from the live CMS and looked at them. Leaf 13's scenario is *"you want to buy a new house for your family"* and the image is a man alone at a desk at night with a calculator. The house style is working — the library does look like one product — but it is holding the **environment** constant along with the palette, and that is not what it was for. Book #2 is Ikigai, and generating it before this is fixed means paying for eighteen images twice.

**Four causes were identified, and none is the scenario text:**
1. **The prompt never names a place.** `scenario_image_prompt()` is scenario prose + "illustrate as a single quiet moment" + the style contract. The prose describes a situation and a feeling; it contains no location, so the model invents one and defaults to the safest interior.
2. **The style contract's subject list is table-first.** *"Ordinary modern life: a desk, a commute, a kitchen table, a shop counter, a conversation"* — four of five are people at tables, phrased as a menu of examples rather than an instruction to vary.
3. **Five of the six committed anchors are seated interiors.** A reference image carries environment and composition, not only palette and technique, so the anchors are teaching "seated person, table, dim room" as if it were style.
4. **Nothing sees the set.** Each Leaf generates independently, so "they are all the same" is structurally undetectable.

*Secondary, already forbidden by the contract: Leaf 13's papers carry arrow and line glyphs that read as writing.*

**Objective:** Two things, in this order. **(A)** Scenario images keep one visual identity — medium, palette, figure treatment — while their *setting* is driven by the scenario, proven by a before/after on identical scenario text. **(B)** Ikigai is onboarded end to end with the fixed generator and lands in the CMS as a reviewed draft.

**Scope:** `apps/pipeline` only — `graph/asset_nodes.py`, `prompts/asset_style.md`, `assets/` and the anchor set, plus tests.

**Requirements — Half A, the generator**
- **Derive a concrete setting per Leaf from the scenario, and name it in the image prompt.** The scenario implies a place even when it does not state one; the generator should decide it explicitly rather than leave the model to default.
- **This must not require a schema change.** The setting is a generation artifact — recorded in the run, visible in logs — not a new field on the Leaf. Anything touching `packages/shared` or the Payload collections is out of scope and belongs to Manager.
- **Split `asset_style.md` into what is fixed and what must vary.** Fixed: medium, palette, the teal-accent rule, the amber prohibition, depth-from-lightness, non-identifiable figures, every content guardrail. Varying: setting, interior/exterior, time of day, camera distance, number of figures, whether a figure appears at all.
- **Re-examine the anchor set.** Decide whether to recut anchors spanning environments or to reduce their pull on composition — **this is the judgement call of the package**, because the anchors are what make the library cohere and a careless change trades one problem for the AI-slop drift the founder ruled against. Say what you chose and why.
- **A Track-level variety check.** Something that looks at the whole set and fails when it has collapsed. Design it yourself; a setting-label distribution is a supporting signal, not the check, because a label can read "construction site" over a picture of a desk.

**Requirements — Half B, the book**
- **Ingest `/Users/ayushgupta/Documents/ZoomOut/ZO-admin/booksSource/Ikigai.pdf`** and run through gate 1, generation, grounding, assets and gate 2.
- **`acquisition` must be `undocumented`** — the honest value for a downloaded PDF. Not `purchased`, not `licensed`. The point of the field is that "which Tracks need regenerating" stays a query.
- **Ikigai lands as a draft and is not published.** It is in copyright; building against it was ruled acceptable 2026-08-13, and what ships at launch is still open.
- **15–30 Leaves**, and **no 1:1 reproduction of the book's chapter structure or its named framework** — a hard legal constraint, not editorial taste.
- **Source references need a locator, not only a note.** Ikigai is a PDF and `ingest/pdf.py` reads page by page, so **page locators may be achievable for the first time** — every prior Track used chapter/quote because EPUBs have no pages. Report whether page locators actually survive into references; if they do not, say so plainly rather than inventing them.
- **State the image budget before the run and make it halt, not warn.** WP18's reported $2.34/Track was computed at the wrong per-image rate; the real rate is `gemini-3-pro-image` at $0.134.

**Out of scope**
- **Track 42's existing published images.** Regenerating them is a separate founder decision, deliberately deferred until this package's before/after exists. Do not touch the published record.
- `apps/mobile`, `apps/backend`, `apps/admin`, any Payload collection change, any shared-type change.
- Publishing Ikigai live. Draft only.
- The curation policy itself — a founder decision, still open.

**Constraints:** Half A ships and is proven before Half B's run starts. The option shuffle (`shuffle_options`, WP17) must be exercised — Track 42 predates it and carries the correct answer in position B for 15 of 18 Leaves; Ikigai is the first chance to confirm the shuffle works on real content. Raw text is purged after the run, as a deliberate command.

**Device gate:** open an Ikigai Leaf in the app on a device and look at the scenario illustrations across **at least six** Leaves. **What to observe: the settings differ from one another and each one plausibly belongs to its own scenario** — not that the images are pretty, and not that the run exited zero.

**Acceptance criteria**
- [ ] Pipeline `lint`, `typecheck`, `test` pass
- [ ] **Before/after on identical scenario text:** Track 42's Leaves 0, 5, 9 and 13 regenerated as *candidates only* with the new generator, presented beside the current published images. **The four new settings are visibly distinct from each other, and Leaf 13 is no longer a person at a desk**
- [ ] `asset_style.md` separates fixed identity from varying environment, and the fixed half still forbids amber, text/symbols, identifiable people, and book branding
- [ ] The variety check **fails against Track 42's current eighteen images and passes against Ikigai's** — run it both ways and show both results
- [ ] Ikigai is in the CMS as a **draft**, 15–30 Leaves, `acquisition: undocumented`, `isPlaceholder` off
- [ ] Every Leaf's source references carry a note **plus at least one locator**; report whether page locators were achievable
- [ ] Correct-answer positions across Ikigai's Leaves are not concentrated in one position
- [ ] **Observed on a device: six Leaves, six settings that belong to their scenarios**
- [ ] Raw text purged after publish-to-draft, and the run's total cost reported

**Testing expectations:** unit coverage on the setting derivation and the variety check, including a mutation — break the setting derivation and confirm the variety check goes red. **Say plainly which evidence is a test and which is a human looking at pictures**; the variety claim is not fully testable and the before/after is the real proof.

---


### Handoff: 2026-09-11 — WP29: the Leaf player's footer hosts the live action

*Manager. **Suggested model: Sonnet** — one flow change, ruled and scoped. You found this; this is the fix.*

> **Read:** this handoff · your own WP28 completion report — **commit `02f8e31`**, cited by hash because a pruned pointer is what cost WP28 time · `apps/mobile/src/screens/leaf/LeafPlayerScreen.tsx` · `apps/mobile/src/screens/leaf/ScenarioSlide.tsx` · `apps/mobile/src/components/Button.tsx` · `agents/manager.md`.
> **Do not read:** `PRODUCT.md`, `projectRoadmap.md`, `design/`, `apps/pipeline`, `apps/admin`, `apps/backend`.
> **Inherited:** Reduce Motion changed mid-session leaves Reanimated stale — relaunch, don't reload, if you gate on motion. RN's jest preset reports `fontScale: 2`, so screen tests exercise the degraded path only.

### Task: WP29 — the footer carries whatever is actionable

**Suggested model:** Sonnet.

**Context:** WP28 established that the Leaf player pins a **disabled** *Next* in the footer — the position a reader's eye goes to for the primary action — while the live control, *Check answer*, sits below the fold inside the ScrollView. **This cost four packages of engineering time** from people who could read the source; a reader cannot. **The founder ruled 2026-09-11 for the footer fix rather than restyling the disabled state**, because making a dead button look dead still leaves a dead button where the live one should be.

**Objective:** On every slide, the pinned footer holds the action that is currently available. A reader never scrolls to find the primary control, and never sees a prominent control that does nothing.

**Scope:** `LeafPlayerScreen.tsx` and the slides' relationship to the footer.

**Requirements**
- **The footer hosts the currently-live action.** On the scenario slide before an answer that is *Check answer*; once answered it becomes *Next*. Other slides keep whatever they have today if it is already the live action.
- **Do not restyle `Button`'s disabled state.** It is a real finding — `opacity: 0.5` on a teal pill against near-black still reads as live — but it is a design-system change touching every consumer, it is logged separately, and this package must not wait on it.
- **The payoff gate does not change.** The rule that the payoff stays locked until a correct answer is the product's central guarantee. This moves a control; it does not alter when the control becomes available.
- **If a disabled control genuinely must appear in the footer** in some state you find, say so rather than forcing the pattern — and report which state.

**Out of scope:** `Button` itself, the other four slides' content, the report sheet, every other screen.

**Constraints:** tokens only. Do not run `git add -A`; stage by path.

**Device gate:** **play a Leaf end to end.** On the scenario slide, *before answering*, **the footer's control is the one that works** — press it and something happens. Answer wrongly, answer correctly, and confirm the footer follows the state. **Both themes, and at accessibility-max**, where the ScrollView is most likely to push content around.

**Acceptance criteria**
- [ ] Root `lint`, `typecheck`, `test`, `build` pass
- [ ] **On the scenario slide, the footer's control is live at every point** — never a disabled primary
- [ ] The payoff still unlocks only after a correct answer — verified by exercising it
- [ ] **Observed on a device: no scrolling is required to reach the primary action on any slide**
- [ ] Both themes at accessibility-max
- [ ] `Button.tsx` is unchanged in the diff
- [ ] No new colour, spacing, radius or duration values

**Testing expectations:** Tier B, plus **Tier A on the footer-action selector** — "which action is live for this slide and state" is a pure function of slide index and answer state, and belongs in a tested module like `roadmapLabels` and `stickyNotesLayout` before it. Mutation-check it.

---


## Completions (Manager → Architect)

### Completed: VO-2.1 — the 144 clips reach the CMS — 2026-09-18

**9 of 9 acceptance criteria met.** Ran on Sonnet 5, as suggested. `runs/ikigai` (183 raw
clips, 228 MB) buys almost everything: only 4 of 144 attached clips were freshly rendered,
matching the handoff's prediction exactly. Branch `vo-2.1-attach-narrators` in the
`ZO-pipeline` worktree, off `origin/main` at `9cf0b5b` (VO-1.1 merged; the array shape was
live before this package touched anything). Rebasing onto two unrelated planning commits that
landed on `origin/main` mid-session (onboarding/VO-3 scope, `project/projectplan.md` and
`projectRoadmap.md` — not read in depth, out of this role's remit) before push; neither
touches anything this package did.

| | |
|---|---|
| Attached | **144 = 18 Leaves × 4 slides × 2 narrators**, every entry with a URL, a positive `durationSeconds` and a 64-char lowercase `textDigest` — verified by an independent script, outside the pipeline's own code, that re-fetches all 18 Leaves and recomputes every digest from scratch |
| Re-rendered | **Exactly 4**: Leaf 5's summary and Leaf 9's payoff, both voices. Cost **$0.0346** (handoff estimated ≈$0.05) |
| CMS | First real write to the live server. **Every one of 144 uploads accepted `audio/mpeg`** — VO-1's promise, unverified until today |
| Live Leaves | All 18 re-fetched: `_status: published`, all four `audio` arrays `[]`, `updatedAt` unchanged |
| Held, then cleared | Leaf 12's scenario — see "What went sideways," below |
| Gate | `ruff check`, `ruff format --check`, `mypy` (the configured target: src + tests, **97 files**, unchanged from VO-1.1), `pytest` **438 passed** (VO-2's baseline: 422). Nothing outside `apps/pipeline` touched — confirmed by `git diff --stat` against every non-pipeline path the handoff named |
| Spend | **$0.0346** against the **$1.21** remaining. Ledger now $1.8230 of the $3.00 ceiling (Google Cloud) |

---

## Part A — the reshape

`cms/mapper.py`: `AudioRef` gained `narrator` and `text_digest`; `payload()` now emits all
four fields. `narration_patch` takes `Mapping[str, Sequence[AudioRef]]` and writes each
group's `audio` as a full array — still one whole-group PATCH per Leaf, per VO-2's original
design, now carrying two rows instead of one. `verify_narration_write` matches array rows by
`narrator`, never by position (`content.ts`: order carries no meaning), and checks all three
content fields — url, duration, digest — per row. New `narration_already_attached` replaces
the old `dict == dict` idempotency check with a narrator-keyed, id-tolerant comparison, since
Payload's own row `id`s don't exist before the first write and must never be compared.

`graph/narration_nodes.py`: `attach_leaf_narration` now takes **one Leaf's eight clips**
(every narrated slide, both narrators) and refuses before any read or upload if the set isn't
exactly that — checked as a full set against `{slide} × NARRATOR_VOICES`, not just a count, so
a caller that duplicated one narrator instead of supplying the other is refused with the same
clarity as one that's simply short a voice. `textDigest` is computed from `clip.line.text` —
**not** a fresh re-read of the Leaf at write time. That was a real design fork, reasoned
through rather than assumed: a fresh re-read would describe "the text right now," which
matches itself trivially and would silently paper over the one race this digest exists to
catch (text edited after the clip was made, before the write lands). `line.text` describes
what the clip actually says, so a mismatch at serve time means what it's supposed to mean.

`assets/narration.py`: new `NARRATOR_VOICES` (`NarratorId → Google voice name`, Achernar →
female, Sadaltager → male — the founder's audition ruling, now written down once rather than
carried in a CLI default) and `narrator_for_voice`, which refuses any other voice — an
audition voice or a typo has no ZoomOut identity to attach under. New `text_digest`: sha256
hex of a field's text, exactly as `NarrationLine.text` holds it. `models.py` gained
`NarratorId(StrEnum)`, mirroring `NARRATOR_IDS` in `content.ts` the same way `SlideKey`
already mirrors `SLIDE_KEYS` — same file, same precedent, same reasoning.

`cli.py`: `narrate` no longer takes `--voice`. It always renders and attaches **both** ruled
narrators together — the only shape that can satisfy "both or none" without a second,
merge-shaped write path I did not want to build and could not have made atomic. `--render-only`
now builds a review track per narrator in one invocation instead of one invocation per voice.
`config.py`'s `narration_voice` setting is gone — dead the moment `--voice` was, and nothing
else read it (checked: the only other caller, `audition-voices`, takes its own `--voice` list
and never touched the setting).

**Evidence: unit tests**, `test_narration_write.py`'s "patch" and "verify" sections extended
for the array shape (narrator-keyed matching, stale-digest detection, missing-narrator
detection, order-independence proven directly — not just relied on); a new `TestTextDigest`
class (9 tests); two new "attach" tests for the cross-voice refusal (missing entirely, and a
duplicate that leaves one narrator short); `test_narration_selection.py` gained the
`NARRATOR_IDS`-mirror test and a refusal test for `narrator_for_voice`. `narration_fakes.py`'s
`leaf_doc()` fixture now returns `"audio": []` per slide, matching what VO-1.1 proved the live
migration actually produces (Part C of that report) rather than the old single-reference
placeholder.

## Part B — the digest, the load-bearing test

**Cross-language agreement was already checked in the handoff and is not re-verified here** —
this file guards the Python side only. `TestTextDigest` asserts, independently of
`text_digest` itself (every expected value is computed inline with `hashlib.sha256(...)
.hexdigest()`, never by calling the function under test twice): ASCII, a closed-up em dash,
curly quotes, two real Leaf-shaped bodies, no trim, no case-fold, and both Unicode normal
forms of "Héctor García" hashing differently — proving no `unicodedata.normalize` anywhere in
the path. One more assertion lives inside the main attach test rather than standalone: the
fixture's scenario prompt has a closed-up em dash, so `.text` and `.spoken` genuinely differ,
and the attached `textDigest` is checked against `text_digest(.text)` and explicitly *not*
equal to `text_digest(.spoken)` — the one regression (digesting the TTS-rewritten form instead
of the stored field) a bare unit test on `text_digest` alone cannot catch, because
`RenderedClip.line` is the same object `narration_script` built; only a real attach exercises
the seam where a future edit could substitute the wrong one in.

**Independently, outside every test:** the verification script that checked all 144 live
entries (Part D, below) recomputed each digest from the JSON Payload actually returned and
compared byte-for-byte — the closest thing to the backend's own recompute-and-compare this
package can perform without the backend itself.

## Part C — mutation-checked, by hand, each reverted immediately after (md5-verified)

| Guard disabled | Test that went red | Everything else |
|---|---|---|
| the missing-narrator refusal | `test_a_leaf_missing_one_narrators_clips_entirely_is_refused` — and the run log shows *why* it matters: with the guard off, a female-only call attaches cleanly (`uploads=4 wrote=True`), which is exactly the one-voice-mid-book failure this exists to prevent | stayed green |
| the duplicate-clip refusal | `test_a_leaf_with_a_duplicate_clip_for_one_narrator_is_refused` | stayed green |
| the stale-digest check in `verify_narration_write` | `test_verification_catches_a_stale_digest` | stayed green |
| the missing-narrator check in `verify_narration_write` | `test_verification_catches_a_missing_narrator` | stayed green |
| `narrator_for_voice`'s refusal | `test_narrator_for_voice_refuses_anything_not_ruled` | stayed green |

All three touched files (`narration_nodes.py`, `mapper.py`, `narration.py`) confirmed
byte-identical (`md5`) to their pre-mutation state after every revert.

## Part D — the live write, verified independently of the pipeline's own claims

Ran `narrate --run-id ikigai --limit 1` first — one Leaf, alone — before trusting the tool with
all eighteen. Then, rather than trust `attached.passed`, re-fetched Leaf 262 by raw `curl`,
copied its stored `summary.body` text out of the JSON by hand, and computed `sha256` on it in a
separate Python process: matched the stored `textDigest` exactly, on all three narrated fields
I checked. Confirmed the *published* read of the same Leaf still carried `audio: []` on all
four slides and an `updatedAt` from before this session. Only then ran the full eighteen.

**The independent check, at scale:** a script (not part of the pipeline, not part of the test
suite — plain `urllib` and `hashlib`) fetched all 18 Leaves twice each (draft and live) after
the run, and for every one of 144 array entries: recomputed `sha256` of the live field text and
compared to the stored `textDigest`; checked `durationSeconds > 0`; checked a non-empty `url`;
checked the live Leaf's four arrays are `[]` and `_status` is `published`. Zero problems.
Output included below because it is the artifact this package exists to produce:

```
144 audio entries checked across 18 Leaves x 4 slides. Expected: 18 x 4 x 2 = 144.
Sample row: {"id": "6aac55dcafe0951eb0cc55f3", "narrator": "female",
  "url": "/api/media/file/ikigai-leaf-00-summary-achernar-d88c742c88.mp3",
  "durationSeconds": 24.41,
  "textDigest": "863efeea57955fd20437d786e8e300b546288e6b89784d0f0f0dd13369d318c3"}
ALL CLEAN.
```

**Payload's real array shape, for VO-3:** each entry carries an `id` — a 24-character hex
string, Payload's own row identity, absent before the first write and stable across re-fetches
after. Order in the response is whatever order the PATCH sent (this package always writes
female then male, because `NARRATOR_VOICES` iterates that way) — **not sorted, not guaranteed,
and content.ts is explicit that nothing may rely on it.** An untouched slide's `audio` reads
back as `[]`, never `null` and never omitted.

**What went sideways, worth knowing:** the first full run held Leaf 12 — its scenario has
leaked a spoken direction under regeneration since VO-2 first hit it, and the README's own
documented recipe uses `--max-attempts 3`, which I did not pass on the first attempt (I used
the command's default, 2). Re-ran with `--max-attempts 3`; the third attempt was already on
disk from VO-2's original audition, so the fix cost nothing and the seventeen already-attached
Leaves were re-verified, not re-written (`wrote=False, uploads=0` on every one — idempotency
held under a full second invocation, which is evidence for that mechanism I didn't have to
construct separately). **Worth a decision:** the CLI default of 2 attempts is a real trap for
a book with even one line like Leaf 12's — a future package should either default to 3 or the
README should say, before the first run rather than after a held Leaf, "known-difficult books
want `--max-attempts 3` from the start."

**No Leaf carried unpublished changes.** `pending_changes_besides_narration` never fired
across all eighteen — stated because a check that never once triggers is easy to stop
believing in without a session that watched it stay silent for a reason (nothing else touched
these Leaves since VO-1.1's migration).

## What I did not test, and why

- **CLI-level test of `narrate`.** Unchanged from VO-1.1/VO-2: the node functions are tested,
  the command was run live, twice, against the real CMS.
- **A clip list with all eight expected pairs present plus a ninth, wrong-voice clip.** The
  `extra` branch in `attach_leaf_narration`'s validation exists and the voice-refusal it
  depends on (`narrator_for_voice`) is unit-tested, but nothing exercises the two together
  through the attach path itself. Tier C — no caller in this codebase can currently produce
  this shape.
- **Google Cloud Monitoring request counts.** VO-2 and VO-1.1 both verified the transport
  (Cloud TTS, not AI Studio) this way in depth. This package's spend is four clips through the
  same, unmodified `SpeechClient`; I relied on that prior verification rather than repeating it
  for $0.03 of traffic.
- **The mobile app.** Could not: `EXPO_PUBLIC_API_URL` still resolves to port 3000, which is
  still held by an unrelated Next.js app on this Mac (confirmed independently — not ZoomOut's
  backend, which is what the handoff's device-gate note already said). Payload itself (port
  3001, where this package actually writes) answered every request normally throughout.

## Assumptions made

- **`textDigest` sourced from `clip.line.text`, not a fresh Payload read at write time** —
  reasoned through above (Part A), not merely the more convenient choice.
- **A slide's `audio` order is female-then-male** because that's `NARRATOR_VOICES`'s
  iteration order — never relied on downstream, and the verification script sorts before
  comparing.

## Deferred: Tier C worklist (inherited, unchanged, plus one addition)

Everything VO-2's original report deferred still applies (no live-model test suite for the TTS
client or guard, `audition-voices` has no output-name option, two `narrate` processes would
race on the cost ledger, the review pages are ~19 MB each). Added: the `extra`-clips branch
noted above.

## How to finish

Nothing left in this package. The founder publishes all 18 Leaves; VO-3 builds the player and
the narrator preference (per `projectplan.md`'s 2026-09-18 ruling: set at onboarding, not
chosen inside VO-3's own UI) against the array shape reported in Part D.

---


**12 of 12 acceptance criteria met.** Root `lint`, `typecheck` and `test` all clean —
**1,391 tests across the repo** (shared 77, admin 204, backend 494, mobile 616), up from
VO-1's 1,367 — **+24, all additions, nothing dropped**: +6 shared (the new `audioRefSchema`
shape and its narrator-uniqueness refine), +6 admin (`noDuplicateNarrators`, which had zero
coverage before this — nothing else exercised it), +12 backend (the mapper's audio rewrite
plus `content.repository.ts`'s new warning-logging path). Branch `vo-1.1-narrator-digest`, off
`origin/main` at `13dc7c0` (VO-1 and VO-2 both already merged when I started — my checkout was
stale on `vo-1-audio-path` and I re-read everything from `origin/main` before branching).
**Not yet pushed** — doing that immediately after this entry, per the handoff's instruction to
open the PR myself.

**Suggested model was Opus; I ran this on Sonnet 5.** Flagged to the founder before starting,
given the DB/live-test risk the handoff named — the founder's call was to proceed on Sonnet 5
rather than switch. Recorded here because the handoff called the model choice out explicitly
and a future reader comparing packages should know this one didn't follow the recommendation.

| Part | Status |
|---|---|
| A — shared schema | ✅ narrator-keyed array, uniqueness refine, `durationSeconds` required |
| B — Payload field | ✅ array field, visible + read-only, `noDuplicateNarrators` validate |
| C — the live database | ✅ backed up, proven empty, pushed under supervision, re-verified identical |
| D — the backend mapper | ✅ per-entry fail-closed filtering, `warnings` channel added to `MappingResult` |
| E — the live contract test | ✅ passes clean; confirmed red on the named regression; cleanup verified by query |

---

## Part A — the shared schema

`packages/shared/src/content.ts`: `NARRATOR_IDS = ['female', 'male']`, `narratorIdSchema`,
`audioRefSchema` now `{narrator, url, durationSeconds (required), textDigest (sha256 hex,
regex-checked)}`. Every slide's `audio` field is `slideAudioSchema` — an array with a
`.refine` enforcing at most one entry per narrator, factored once and reused across all five
slides rather than repeated five times. Updated the file's own "frozen content model" banner
comment with a third "thawed" paragraph, matching the two that already document WP15 and
WP15.1 — this is exactly the kind of change that comment exists to track.

**Evidence: unit tests**, new `describe('VO-1.1 audio', ...)` block in `content.test.ts` (6
tests) — accepts no audio, accepts one clip per narrator, rejects two for the same narrator
(with the exact refine message asserted), rejects a malformed digest (including uppercase —
the contract is lowercase, checked as a plain string equality by the mapper), rejects a
missing `durationSeconds`, rejects a narrator outside the enum.

## Part B — the Payload field

`Leaves.ts`: `audioField` is now `type: 'array'`, `admin.readOnly: true` (visible, not
hidden — the founder can see what's attached; a hand-edited entry would carry a digest that
matches nothing, so read-only is the honest state), fields `narrator` (select, options built
from the same `NARRATOR_IDS` shared imports the rest of the collection already reads from
`@zoomout/shared`), `url`, `durationSeconds`, `textDigest`, all `required: true` at the
Payload level too — safe to do because the field is machine-authored only, so this never
blocks a human mid-draft the way `imageFieldParts` deliberately isn't required.
`noDuplicateNarrators` is a field-level `validate` on the array — the same mechanism
`scenario.options`' `minRows`/`maxRows` already uses for a structural array constraint,
rather than routing through `leafRules.ts` (which is for cross-field/publish-readiness rules,
not this). Exported and given its own `Leaves.test.ts` — **the first test file this
collection has ever had** — because it is genuine new logic and nothing else touches it; the
live contract test's fixture happens to be valid, so it would never have noticed this rule
breaking.

Regenerated `packages/shared/src/cms-generated.ts` via `npm run generate:types
--workspace=apps/admin` — confirmed this does **not** touch the database at all (ran it,
watched it complete in under a second with no schema-push prompt, checked the DB schema
before and after: unchanged). That let me build and fully unit-test Part D against the real
generated shape before Part C ever touched the live database.

**Evidence:** 6 new unit tests in `Leaves.test.ts`, mutation-checked (disabling the
uniqueness comparison turns exactly one test red: "rejects two entries for the same
narrator"). Regenerated types spot-checked by reading the actual diff in
`cms-generated.ts` (narrator/url/durationSeconds/textDigest all non-nullable within a row,
because Payload reflects `required: true` inside an array item differently than it does for
a top-level group field — worth knowing if a future package assumes otherwise).

## Part C — the live database

**The part that could hurt, and where the founder's own hands did the one step I
mechanically cannot.**

1. **Backup.** `docker exec zoomout-postgres pg_dump -U postgres -d zoomout_cms --format=plain`
   → `apps/admin/backups/zoomout_cms_pre_vo1.1_20260917_212944.sql` (2.17MB, plain SQL,
   gitignored — added `apps/admin/backups/` to `.gitignore`). Verified complete: ends with
   Postgres's own "database dump complete" marker, and `COPY public.leaves (...)` /
   `COPY public.tracks (...)` both list every column I expected, including all ten audio
   columns about to be dropped. **Restore:** `docker exec -i zoomout-postgres psql -U
   postgres -d <a-fresh-database-name> < zoomout_cms_pre_vo1.1_20260917_212944.sql` — into a
   new database name, not back over `zoomout_cms` directly, so a bad restore can't compound
   a bad push.
2. **Proof of emptiness, by query, not assumption.** `SELECT count(*), count(col1),
   count(col2), ...` (Postgres's `count(col)` already excludes nulls) against all ten audio
   columns on `leaves` (58 rows) and their `version_*` counterparts on `_leaves_v` (279
   rows): **every one 0/58 and 0/279.** Full output is in this session's transcript; not
   re-pasted here since the numbers below already carry the proof.
3. **Baseline**, recorded to `apps/admin/backups/baseline_*.txt`: 30 Tracks (29 published), 58
   Leaves (57 published), 90 Track versions, 279 Leaf versions, 201 media, 4 admins. Track 42
   and Track 50 both `published`, `leafCount` 18 each, exact `updatedAt` recorded. All 36
   Leaves across both Tracks recorded individually (id, order, title, `_status`,
   `updatedAt`). Anonymous `GET {payload}/api/leaves?where[trackId][equals]=50` (no auth
   header — Payload's own `publishedOrAuthenticated` access control) → **18 returned, 18
   published.**
4. **Applied under supervision, in a terminal the founder could see and type into — not a
   non-interactive shell.** `payload run` (via a throwaway script, `getPayload({config})`
   then exit — deleted immediately after, never committed) triggered drizzle's push prompt.
   **The exact diff it showed matched my independent, pre-computed expectation
   column-for-column** — the same 10+10 columns from step 2, nothing else, no other table
   touched. I showed this to the founder alongside my own verification and asked them to
   type `y`; they did.
5. **Re-verified, not just trusted.** Old columns confirmed gone (`\d leaves`, `\d
   _leaves_v`); ten new tables exist (`leaves_{summary,scenario,payoff,sticky_notes,
   takeaway}_audio` and their `_leaves_v_version_*` counterparts), **all ten empty, 0
   rows**. Every baseline number reproduced identically: same totals, Track 42 and 50
   unchanged (`_status`, `updatedAt`, `leafCount`), **the 36-Leaf detail dump diffed
   byte-for-byte identical** against the pre-push file. Anonymous Track 50 fetch repeated
   against a freshly restarted admin server: **18/18 published again**, and `summary.audio`
   now reads back as `[]` rather than the old group shape.

**One real snag, unrelated to the database itself.** The admin dev server had been running
for days against the old schema; after the push it needed a restart to pick up the new
config, and Turbopack's own `.next` cache served a stale pre-bundled `@zoomout/shared` on
the first restart attempt (`Export NARRATOR_IDS doesn't exist`) even though the rebuilt
`dist/` on disk was correct — a `.next` wipe fixed it. **The founder was already using the
admin UI (I could see `GET /admin/collections/leaves/267` in the server log — the exact Leaf
the roadmap names for a text fix) while I did this**, so I want to be explicit: the restart
briefly interrupted that server, and I did not warn before killing the first (stale) process.
Worth a one-line heads-up next time this happens mid-session.

**Evidence:** the `pg_dump` file itself, plus every query and its output (transcript); the
founder's own confirmation in the terminal; a second, independent anonymous-fetch check
after the restart.

## Part D — the backend mapper

`content.mapper.ts`: `optionalAudio` is gone, replaced by `mapAudioEntries` — per slide, per
entry: narrator validity (defensive; Payload's `select` shouldn't admit anything else, but
`specFormat`'s precedent in this same file says not to trust that), `durationSeconds`
presence/positivity, digest match (`sha256` of the narrated field **exactly as Payload
returned it** — no trim, no normalise, checked by its own test), narrator-collision (two
entries for one narrator → both drop, since array order carries no meaning and there is no
"first" to prefer). `stickyNotes` has no narrated field, so any entry there is unconditionally
dropped. Every drop is a warning, never a Leaf failure — `MappingResult<T>`'s success branch
now carries `warnings: readonly string[]`, and `content.repository.ts`'s `keepValid`/
`requireValid` gained the `logger.warn` sibling to their existing `logger.error` calls — the
"mapper's existing mechanism for reporting problems," extended rather than replaced, exactly
as asked.

**Evidence: unit tests**, `content.mapper.test.ts`'s old `describe('audio URL resolution
(VO-1)', ...)` block replaced with `describe('VO-1.1 slide audio', ...)` — omission,
happy-path (both narrators, row id dropped), narrator validity, `durationSeconds` (absent and
non-positive), the digest check (stale, and a no-trim proof using padded whitespace text),
narrator collisions (both drop; and a second test confirming an *uncorrelated* narrator
survives a collision elsewhere), stickyNotes' unconditional drop, and one relative-URL
resolution test per narrated slide. New `content.repository.test.ts` (3 tests) — the
repository's first test file — proving `findLeaf` and `listLeavesForTrack` both log via
`logger.warn` when a mapping succeeds with warnings, and that a clean Leaf logs nothing.

**Every rule mutation-checked by hand, each in isolation, each reverted immediately after —
not claimed, actually run:**

| Rule disabled | Tests that went red | Everything else |
|---|---|---|
| `resolveMediaUrl` on the audio path | 8 — every test using a relative-URL fixture | stayed green |
| the digest comparison | 1 — exactly the digest-staleness test | stayed green |
| the collision-drop loop | 2 — both collision tests (the second because "last one wins" still fails its exact-array check) | stayed green |
| the `durationSeconds` check | 2 — both, failing as a **whole-Leaf** rejection rather than a per-entry one, exactly as predicted in the test's own comment | stayed green |
| the narrator-validity check | 1 — exactly that test | stayed green |
| the stickyNotes "no narrated field" guard | 1 — throws a `TypeError` hashing `undefined`, caught cleanly by vitest as a failure | stayed green |
| `noDuplicateNarrators` (Payload layer) | 1 — exactly that test | stayed green |

No case of "green for the wrong reason" turned up — the closest near-miss was the
`durationSeconds` mutation, which fails for a *different* reason than its own warning
message describes (whole-Leaf `safeParse` rejection, not a per-entry omission); the test's
own comment documents this rather than asserting something the code doesn't do.

## Part E — the backend contract test that `manager.md` described and nobody built

**New:** `content.mapper.test.ts`... no — `content.contract.live.test.ts`, plus
`vitest.live.config.ts` and `"test:live"` in `package.json`. Excluded from the normal gate by
a separate config file rather than an `exclude` pattern alone, because an `exclude` in
`vitest.config.ts` still applies even to a file named explicitly on the command line — a
plain `exclude` would have meant `vitest run content.contract.live.test.ts` silently ran
nothing.

**Two credentials, two different systems, deliberately not one.** The pipeline's machine key
cannot publish (`access/publishing.ts`), so authoring a *published* fixture needs a human
Payload login — reused `PAYLOAD_ADMIN_EMAIL`/`PAYLOAD_ADMIN_PASSWORD`, the exact pair
`apps/admin/src/seed/seed.ts` already uses, rather than creating a second identity. A minimal
Payload REST client is reimplemented locally in the test file (not imported from `apps/admin`
— that would be a real cross-app dependency for a Next-internal module) after
`PayloadRestClient` there proved the pattern: JWT login, and — because of the
`admins JWT <token>`-is-silently-anonymous trap this project has already been bitten by once
(2026-09-01, a delete loop that reported "0 Leaves deleted" and meant "not logged in") — the
client asserts `accountType === 'human'` after login rather than trusting a 200. The backend
read side is a **second,
unrelated auth system**: a throwaway app reader is created via the real `/auth/signup`
(falling back to `/auth/login` on a re-run, so it's idempotent rather than accumulating
throwaway users), and the fetch goes through `/content/tracks/:id` and `/content/leaves/:id`
with a real bearer token — the same path a reader's phone uses.

**Isolation: a dedicated fixture Track in the existing dev database**, not an isolated
instance — this project has no tooling to stand up a second Payload, and the existing
database is what "real Payload" already means for every other check in this package.
Matched, cleaned and re-created by one fixed, distinctive `bookTitle`
(`"ZO Live Contract Test Fixture — VO-1.1 (safe to delete)"`) and Leaf `title`, mirroring
`seed.ts`'s own `RETIRED_TRACK_TITLES` idiom exactly. `beforeAll` deletes any stray copy from
a previous failed run *before* creating a fresh one; `afterAll` deletes what this run
created, best-effort (logs, does not throw, so one delete failing cannot mask the other).
Track 42 and 50 are never queried by id or by any predicate that could match them.

**The fixture is maximal and deliberately uneven**, so one real write proves both the happy
path and both drop rules: summary/payoff/takeaway carry both narrators with correct digests;
scenario carries a correct female entry and a **deliberately stale** male one; stickyNotes
carries one otherwise-well-formed entry that is unconditionally unverifiable. Every other
optional Leaf field is populated too — scenario image, sticky-notes diagram (with spec and
format), Dinner Table Knowledge (sourced, so `checkDinnerTableKnowledgeIsSourced` doesn't
refuse the write), apply-in-life.

**It passed clean on the first real run — and `manager.md`'s own caution is that this is
exactly when to look again, not relax.** I did: I mutated the mapper (`.slice(0, 1)` on the
surviving entries, simulating "maps only the first array entry" — the specific regression
the acceptance criteria name), asked the founder to re-run the live test against the running
(hot-reloaded) server, and it failed with exactly the right assertion —
`summary narrators: expected [ 'female' ] to deeply equal [ 'female', 'male' ]`. Reverted,
confirmed green again via the local suite (I did not ask for a third live run; the revert is
byte-identical to the first, already-passing version, and root `typecheck`/`test` confirm it
compiles and the unit suite is undisturbed).

**Cleanup verified by query, not assumed — including after the deliberately failed run.**
After both the passing run and the failing one, `SELECT ... FROM tracks WHERE book_title LIKE
'ZO Live Contract Test Fixture%'` and the equivalent for `leaves` both returned **zero rows**.
vitest's `afterAll` runs on a failed test in the same describe block; this is what confirms
it actually did, rather than trusting that it should.

**A real, useful side effect: the warning-logging pipe was proven live, not just by unit
test.** The backend's own structured log from the passing run: `"Leaf 280: scenario audio
(narrator male) — omitted: stale textDigest (expected 4ab77a0b…, got 453ed5c3…)"` and the
stickyNotes line beside it, nothing else warned about — independent corroboration of Part D's
unit-level mutation checks, from a real request against a real database.

**Evidence: one live test** (the round trip itself, and its reverse under the deliberate
mutation), **one database query** (cleanup verification, both directions), **the backend's
own structured log line** (the warning pipe, observed rather than inferred), **the founder,
directly** (ran the live test twice, confirmed both outcomes verbatim in chat).

---

## Where the time went, roughly

Reconnaissance (re-reading from `origin/main`, tracing the auth/db/test conventions already
in the repo before writing anything) was the largest single share — more than implementation.
Implementation (Parts A/B/D) was comparatively quick once the shapes were confirmed. Part C
(backup, proof, push, re-verification) and Part E (the live test, plus two founder-run
round trips) together were the next largest share, mostly waiting on and verifying real
systems rather than writing code. The write-up you're reading took a noticeable amount of
time on its own, given how much needed to be said precisely rather than summarised away.

## What I did not test, and why

- **The device gate.** Could not get a clean "Ikigai still opens" read: `EXPO_PUBLIC_API_URL`
  defaults to `127.0.0.1:3000`, and port 3000 is held by an unrelated project on this Mac
  (`NormiesNotebook`) — the same port collision a prior session already recorded. The
  Ikigai Track screen showed "no Leaves yet" for exactly that reason (no reachable ZoomOut
  backend on the port the app expects), not because of anything this package changed. The
  anonymous Payload fetch and the live contract test both exercise the identical data path
  the app depends on, so I'm confident in the result without the screen — but I did not see
  the screen itself, and I'm saying so rather than papering over it.
- **Concurrent writes to the same audio array**, or a mix of a stale digest *and* a narrator
  collision on the same entry in one write. Both are Tier C — no product path produces either
  today (VO-2.1 attaches once, all-narrators-or-none), and the per-entry logic treats them as
  independent checks that would compound correctly by construction, but that is reasoning,
  not a test.
- **More than two narrators**, or a Payload row with extra unknown fields — `NARRATOR_IDS`
  has exactly two entries and nothing plans a third; not worth a test until it's a real case.

## Assumptions made

- **Model:** ran on Sonnet 5 per the founder's explicit choice, not the handoff's suggested
  Opus (see above).
- **`generate:types` does not touch the database.** Verified by running it and checking the
  schema before/after, rather than assumed — but flagging the check itself as an assumption
  worth someone else's awareness, since it is not documented anywhere and the opposite would
  have been a reasonable design too.
- **A dedicated fixture Track in the shared dev database**, not an isolated instance, for
  Part E — this project has no tooling for the latter, and building it was out of scope.

## Follow-ups for Architect

1. **The port-3000 collision is still live** and blocked this package's device gate exactly
   as it must have blocked a prior one. Not this package's to fix, but it will keep costing
   device-gate time on this Mac until either `NormiesNotebook` moves or `EXPO_PUBLIC_API_URL`
   gets a local override recorded somewhere a session can find it before reaching for the
   simulator.
2. **VO-2.1 can now proceed** — the array shape it needs to attach both narrators into exists,
   live, in the dev database. Per the roadmap, nobody should have run it against the old
   shape in between, and nobody did (`git status`/`diff --stat` confirm nothing under
   `apps/pipeline` changed in this branch).
3. **Restarting the admin dev server mid-session interrupted the founder's own use of it**
   (see Part C) — worth a one-line "give me a second, restarting the admin server" next time
   a schema push needs one, rather than doing it silently.



**6 of 9 acceptance criteria met; 2 are blocked by the founder's mid-package ruling, and 1 — listening to the full tracks — is the founder's, because I cannot hear audio.** The founder heard a six-voice audition and chose **two narrators, for readers to pick between: Achernar (female) and Sadaltager (male)**, then ruled to **hold every CMS write** until Architect rules how a slide stores two voices. `audioRefSchema` is one `{url, durationSeconds}` per slide and `content.ts` is frozen. So **144 clips are rendered, checked and in two review tracks; nothing is uploaded and no Leaf is written.** Branch `vo-2-ikigai-voiceover` in the `ZO-pipeline` worktree, off `origin/main` at `5e9d378` (VO-1 merged). **Not committed**, pending the founder's word.

| | |
|---|---|
| Clips | **144 = 72 × 2**, every one the approved text by the guard. Achernar: 65 exact, 7 minor, 0 major. Sadaltager: 67 exact, 5 minor, 0 major |
| CMS | **Nothing written, by ruling.** All 18 Leaves re-fetched at the end: `_status: published`, draft identical to live, no audio, `updatedAt` unchanged since the morning's read |
| Voices | Founder's choice, by ear, from my six-voice shortlist (reasoning below) |
| Direction | Per slide type, `prompts/narration_direction.md`. **Third version**: the first was read aloud, the second made the model ad-lib. **Founder listened to a with/without A/B and ruled to keep it** |
| Transport | Cloud TTS only: the client's own endpoint, a `narration_transport` record on the run, and Google's request counts |
| Spend | **$1.79 on the ledger (≈ $1.80 by Google's count) of $3**, Google Cloud credit. **~$0.32 of it wasted by my first direction** |
| Listening | **Nobody has listened to either full track. I cannot hear audio.** The evidence is the guard, the measurements, and the founder's ears |
| Gate | `ruff check`, `ruff format --check`, `mypy` (the configured target: src + tests, 97 files), `pytest` 422 passed. All clean |
| Artifacts | `ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/ikigai-narration-{achernar,sadaltager}.{html,mp3,md}`: 29:11 and 29:50. The HTML carries the track and seeks to any cue |

---

## Acceptance criteria

| Criterion | State |
|---|---|
| Lint, format, `mypy --strict`, `pytest` clean; nothing outside `apps/pipeline` | ✅ (this log entry is the only other file) |
| 72 clips attached with URL, measured `durationSeconds`, descriptive `alt` | ⛔ **Held by ruling.** `durationSeconds` is measured by decoding the exact mp3 that would upload. `alt` reads "Narration of the Payoff slide, Leaf 4 of Ikigai, read by Achernar". **The upload path has never touched the live CMS**, so the running server accepting `audio/mpeg` is still unverified |
| Every Leaf still published with audio in a pending draft, verified by re-fetch | ⛔ Held. The write-and-verify path is built and tested: whole-group PATCH, re-fetch of both versions, refusal of a Leaf with unpublished changes. All 18 re-fetched at the end, untouched |
| No `sourceReferences[].quote` sent to TTS | ✅ Structurally (one function reads four named fields; the TTS client accepts only its output) and behaviourally (a sentinel in every silent field, through the whole render path including regeneration). Mutation-checked |
| Voice choice with reasoning; per-slide-type direction written down | ✅ Below; direction in `prompts/narration_direction.md` |
| Review track exists and you listened | ⚠️ **Two tracks exist.** **I listened to none of it.** The founder listened to the audition before choosing; the full tracks are theirs to hear |
| Transport recorded as a queryable row; Cloud TTS confirmed, not AI Studio | ✅ `status --run-id ikigai` → `narration : cloud-tts (zoomout-vertex) via texttospeech.googleapis.com — gemini-2.5-flash-tts`. A `narration_transport` row per checkpoint in `checkpoint_blobs` (msgpack, like WP32's `transport`). Google Monitoring below |
| Spend reported against $3 | ✅ Breakdown below |
| Anything not happy with is stated | ✅ Below: everything the guard and the measurements flagged, and what they cannot see |

## Needs a decision

1. **Architect: how a slide carries two voices.** Today there is one optional `audio: {url, durationSeconds}` per slide in `content.ts`, one `audio` group per slide in Payload's Leaf, and one in the backend mapper. **Nothing reads it yet (VO-3 is unbuilt) and nothing has been written, so the shape can change now without migrating any data.** It will never be cheaper.
   - (a) **`audio: AudioRef[]`, each with a `voice` key.** One field, any number of narrators; the player picks by the reader's preference and falls back to the first. A breaking change to an unused type. **My recommendation.**
   - (b) Keep `audio` as the default voice and add `audioAlternates: AudioRef[]`. Additive, but two places to look.
   - (c) `audioFemale` / `audioMale`. This writes today's product decision into the schema. Not recommended.
   - Whichever shape: **make `voice` a ZoomOut key (`female`, `male`), not Google's voice name.** Then a narrator can be re-cast, or a second book voiced differently, without breaking a reader's saved preference. The Google name is already in each file's name and `alt`.
2. **Product / VO-3: which voice plays before a reader chooses.** Not yet ruled.
3. **Founder: listen to both full tracks** (about 59 minutes together) before the second publish. Each page's "Listen here first" list has 11 entries; the rest of the listening is the drift check nobody else can do.
4. **Founder: commit, push and PR?** Nothing is committed yet; this harness commits only on request.
5. **Content, not narration: two Leaf texts worth a look.** Leaf 5's summary writes the Japanese plural as "takumis", and both voices said "takumi". Leaf 9's payoff says "…a secondary income stream expose you…", which both voices said as "exposes"; the verb is correct for the compound subject, but it reads as a slip.

## The direction took three versions

**v1 was read aloud.** It opened "Read the text exactly as written: every word, in order…". Gemini-TTS spoke everything after that colon before the Leaf text in **12 of 13** directed audition clips: 60–85 s of audio for 11–25 s of text. The 13th opened "Sound like a software developer" where the Leaf says "You are". Cost: about $0.32. **The founder was told, and re-approved the spend before anything else was bought.**

**v2 made the model chat.** "Introduce this idea … as if telling a friend" put **"You know, in Okinawa…"** in front of 4 of 6 audition summaries: words nobody wrote.

**v3 is short and descriptive, with no conversational framing.** Tests now forbid colons, "read", quotation marks, and "friend", "telling" or "chat". **It still leaks occasionally, but only from the imperative per-slide sentences, never from the shared block:**
- Achernar: 5 of 72 first attempts were major (two dropped phrases, three spoken directions).
- Sadaltager: 2 of 72 first attempts were major, both spoken directions, and Leaf 12's second attempt was major the same way.
- **Leaf 12's scenario leaked twice in both voices** ("Your 70-year-old neighbor, Arthur…" seems prone to it), so `narrate` gained `--max-attempts` (1–3, default 2). The third attempt was clean both times.

**What the direction measurably does: it slows the read, and does not add pitch movement.** Sulafat, the same lines undirected → directed:
- scenario 17.5 s → 21.1 s;
- takeaway 11.6 s → 18.4 s, with pitch movement down from 5.3 to 3.8 semitones;
- summary 26.8 s → 30.0 s.

**The founder listened to that A/B and chose to keep the direction.** Directed takeaways now run at about 96–98 wpm, against 116–135 for the other slides.

**Emotion tags are not used.** Google's own guide documents that adjective tags such as `[curious]` are spoken aloud; the handoff's `[curiosity]` and `[hope]` are untested tags of exactly that kind.

## The guard, and the check that does not trust it

**The guard is a blind transcript**: Gemini 3.6 Flash on Vertex, never shown the text, compared word by word. **Its first prompt was not good enough.** It silently left the spoken direction out of 9 of 13 transcripts and graded 80-second clips "exact". A literal re-transcription exposed this. The rewritten prompt ("leave nothing out, including anything that sounds like an instruction") returned all 194 words of the same clip and listed the spoken direction. Readings are cached by clip, bytes, model **and a digest of the guard prompt**, so a reading made under the old prompt cannot answer for the new one.

**The pace check needs no model.** It measures words per minute of *speech*, pauses excluded, and requires 100–330. Leaked clips measured 30–42; undirected clips 173–182; directed clips 130–161. **The first version measured total clip length and was wrong:** it failed a slow, word-for-word takeaway whose extra time was all pauses.

**Severity rules:**
- **Major:** a spoken tag or instruction; **any added word**; a run of 2 or more skipped words; a 3-word run of differences; or differences in 10% of the clip. An unnatural pace also overrules to major.
- **Minor:** a single word heard differently, usually a transcription of a name or a plural.
- **A clip still major after its attempts holds back its whole Leaf.** `attach_leaf_narration` refuses before any read or upload, because three clips and a silent fourth reads as a broken player.

**Minor findings worth a listen:**
- **Achernar:** "the authors state" heard as "the author states" (Leaf 13 summary) and "argue" as "argued" (Leaf 12 payoff) may be real misreadings. "Jiro's" as "Jiro" and "warm-ups" as "warmups" look like transcription.
- **Sadaltager:** "intensity" heard as "intensive" (Leaf 16 summary) may be real; "you have" as "you've" (Leaf 11 scenario) is small.
- **Both voices:** takumis, expose and antifragility. The first two are the text itself (item 5); the third is a transcriber splitting the word.
- **Sadaltager's Leaf 7 payoff** ends with speech-level sound in the model's final 20 ms, so its last syllable may be clipped. **This is the one acoustic flag to hear first.**

## The voices

The shortlist came from Google's own one-word descriptors; **the founder chose by ear, not me.**
- **Auditioned:** Sulafat (warm), Vindemiatrix (gentle), Achernar (soft), Achird (friendly), Sadaltager (knowledgeable), Algieba (smooth).
- **Left out before any audio was made:**
  - upbeat, excitable, lively and bright: tiring across 23+ minutes;
  - breathy: fatiguing, and at odds with the "no breath at the cut" requirement;
  - firm and informative: newsreader risk. Kore, the docs' default, is in this group, and the handoff said not to take the first voice in the list;
  - youthful, forward, gravelly and casual.

## Transport, checked three ways

1. **The client's own endpoint.** It is read off the constructed GAPIC client and refused unless it is a Cloud TTS host: `texttospeech.googleapis.com`. The client has no API-key parameter; it uses ADC with `zoomout-vertex` named as the quota project.
2. **Recorded on the run.** `narration_transport` (transport `cloud-tts`, project, model, endpoint) sits beside the existing Gemini `transport` and is printed by `status`.
3. **Google's request counts** (Cloud Monitoring, `api/request_count`, `zoomout-vertex`, last 12 h):
   - `texttospeech.googleapis.com`: SynthesizeSpeech **185 × 200** and 1 × 499.
   - **`generativelanguage.googleapis.com` (AI Studio): no requests.**
   - `aiplatform.googleapis.com`: the guard's calls, each counted under two method names, plus 5 × 429 that were retried.

   The 185 reconciles exactly: 183 clips on disk, plus Leaf 13's payoff (timed out on our side but completed on Google's, and charged twice by design), plus one v1 clip that was in flight when I stopped the first audition. The recipe is in the README.

## What VO-3 inherits: the files, as they are

- **Format:** mp3, 64 kbps CBR, mono, 24 kHz (MPEG-2 Layer III). That is the only audio type `Media` accepts.
- **Levels:** −20 dBFS over speech frames, with a −2 dBFS peak ceiling.
- **Edges:**
  - 60 ms before the first sound;
  - **350 ms of digital silence after the last**;
  - a 5 ms fade-in and a 30 ms fade-out;
  - any low sound lasting more than 250 ms after the last word is treated as a breath and cut.
- **`durationSeconds`:** decoded from the exact bytes, to 2 decimal places, **including about 50 ms of encoder padding**.
- **Clip lengths (Achernar):**
  - summary 22–38 s, median 27;
  - scenario 11–26 s, median 18;
  - payoff 18–42 s, median 34;
  - takeaway 12–29 s, median 15.

  A whole book is about 29–30 minutes per voice.
- **Names:** files are `ikigai-leaf-04-payoff-achernar-<sha256[:10]>.mp3`, and `alt` reads "Narration of the Payoff slide, Leaf 4 of Ikigai, read by Achernar". The hash makes "already uploaded?" a filename lookup.
- **Two voices per slide plus a reader preference**, pending item 1.

## Spend: $1.79 on the ledger of the $3 ceiling (Google Cloud)

| | USD |
|---|---|
| First audition, direction v1 (read aloud): **wasted** | 0.303 |
| Diagnostics that found it (a literal transcription, a guard validation) | 0.016 |
| v2 probe (2 clips) | 0.015 |
| Six-voice audition, v2 | 0.150 |
| v3 summary probe (2 clips) | 0.020 |
| Achernar: 69 new clips (3 reused from the audition and probe), 6 retries | 0.652 |
| Sadaltager: 69 new clips (3 reused), 3 retries | 0.627 |
| Estimated charge for one timed-out call | 0.006 |

**The ledger is reconciled against the files:** every paid clip has one speech entry and every reading one guard entry. Four entries have no file, all on purpose: two diagnostics, the timeout estimate, and the timed-out Leaf 13 payoff charged a second time.

**Against Google's count,** the ledger is about $0.02 short (the v1 clip I killed in flight) and about $0.006 over (the timeout estimate, which Google shows as a client-cancelled 499). **So true spend is about $1.80.**

The machine's network dropped mid-Sadaltager. That run only wrote spend back per Leaf, so one paid clip and its reading were missing; they were found and added from the files. **Spend is now written back after every call**, and a timed-out call is now charged even when every retry fails. Only timeouts are charged; refused connections and 429s never reach generation.

## Evidence: which is a test, which is tooling, which is nobody

- **Tests (422 passing).** They cover:
  - the four-field boundary, as behaviour, structure and entry point;
  - draft-only writes, checked on the wire;
  - the whole-group PATCH against WP19's nulling;
  - re-fetch verification of both versions;
  - refusal of a Leaf with unpublished changes;
  - find-then-skip uploads;
  - the served-bytes proof;
  - the hold;
  - budget reserved before the call;
  - never buying the same clip twice;
  - bounded regeneration;
  - speech-only pace;
  - the guard's blindness and its severity rules;
  - host refusal and a single retry layer;
  - timeout accounting, and spend written back per call;
  - per-voice register;
  - audio levelling, edges, duration and pitch, on synthetic signals.
- **Mutation checks, by hand: 19 of 19 turned a test red.** Each file was restored byte-identical (checked by md5). The mutations:
  - a quote made reachable (two ways);
  - a partial group PATCH;
  - the draft flag dropped;
  - no find-then-skip;
  - live status left unchecked;
  - audio uploaded as png;
  - budget not reserved first;
  - pace ignored;
  - the library retry left on;
  - any host accepted;
  - the guard shown the text;
  - unpublished changes ignored;
  - a failing clip attached;
  - served bytes not compared;
  - a stale guard reading reused;
  - timeouts on a failed call not charged;
  - every failure charged;
  - spend not written back per call.

  One was first missed ("live status unchecked") and needed a new test: a Leaf that was never published.
- **Tooling:** the guard, the pace and pitch measurements, the cue sheets, and Google's request counts.
- **Nobody:** whether it sounds like a person who means it. The founder heard the six-voice audition; nobody has heard the full tracks.

## Other findings

- **WP33.1's "mypy clean" was `mypy src` (50 files), not the configured target (src + tests).** Its `SecretStr` change had left 12 type errors in the tests. Fixed here. Two raw-string calls exist to test the environment path, and those keep a commented ignore.
- **The generated TTS client declares no default timeout and no default retry.** Both are now passed on every call (`retry=None`), so a library update cannot quietly add a second retry layer.
- **ADC user credentials carry no quota project.** The client names `zoomout-vertex` explicitly.
- **`miniaudio.decode` resamples to 44.1 kHz unless told otherwise.** The duration survives; every other measurement would not.
- **A no-op sleep paired with the real clock makes the rate limiter spin for a real minute.** That cost four minutes of test time until the fakes got a clock that advances.
- **The first cue sheet had two flaws.** It keyed notes by (Leaf, slide), so an audition's six readings of a line collapsed into one. It also compared a soprano's pitch with a baritone's. Both fixed: notes are keyed by voice, and the register limit is relative to each voice's own spread. The flat 2-semitone limit had flagged 15 of Sadaltager's clips; that was his normal range.
- **`upload_media` never caught `URLError`**, unlike its sibling `_request`. Fixed; a test confirms the image path still sends `image/png`.

## Deferred: Tier C worklist

- No CLI-level test of `narrate` or `audition-voices`. The node functions are tested, and both commands were run live.
- No live-model test suite for the TTS client or the guard.
- **The upload/attach path has never run against the live CMS** (held).
- `narration_transport` is msgpack in `checkpoint_blobs`, read through `status`. There is no plain-SQL egress table.
- `audition-voices` has no output-name option, so a second audition overwrites the first. The v3 probe called the render step directly to avoid that.
- Review pages embed the whole track, about 19 MB each.
- Two `narrate` processes on one run would race on the cost ledger. Run them one after the other; the README says so.
- The listening page used for the audition grid (per-clip players) was a one-off script, not pipeline code.

## How to finish, once item 1 is ruled

1. Change `narration_patch` and `verify_narration_write` to the ruled shape. Their tests already cover the whole-group and re-fetch behaviour.
2. For each voice, run `narrate --run-id ikigai --voice <v> --max-attempts 3 --listen-for …`. Every clip and reading is cached, so the only cost is the uploads and 18 PATCHes.
3. The founder publishes the Leaves again.

**Files:** all under `apps/pipeline/`.
- New: `assets/{narration,speech,audio,narration_guard,review_track}.py`, `graph/narration_nodes.py`, `prompts/narration_{direction,guard}.md`, `tests/narration_fakes.py` and seven test files.
- Changed: `cli.py`, `config.py`, `cost.py`, `models.py`, `graph/state.py`, `cms/{client,mapper}.py`, `llm/client.py`, `assets/{__init__,budget}.py`, `README.md`, `pyproject.toml` and `uv.lock`, plus nine existing test files.
- New dependencies: `google-cloud-texttospeech`, `numpy`, `lameenc` and `miniaudio`. `lameenc` is LGPL, which is fine for internal tooling that isn't distributed.

**Time:** about 9 hours of wall clock. Roughly 2.5 h on reading and building, 2 h on the three direction versions and their evidence, 3 h waiting on renders (including the network drop and resume), and 1.5 h on reconciliation, calibration and this report.

---

### Completed: VO-1 — the two blockers in front of voiceover — 2026-09-17

**7 of 7 acceptance criteria met.** Root `lint`, `typecheck` and `test` all clean —
1,367 tests across the repo (shared 71, admin 198, backend 482, mobile 616), all
green. No device gate was possible, exactly as the handoff pre-declared: no real audio
file exists yet (VO-2) and nothing plays one (VO-3). Committed locally on branch
`vo-1-audio-path`, off current `main`; **not pushed, no PR opened** — see "Needs a
decision" below.

| | |
|---|---|
| Part A | `Media` now accepts `audio/mpeg`. Everything else it does is already gated by mimetype inside Payload itself — verified by reading the actual upload pipeline, not assumed |
| Part B | `optionalAudio` now routes through `resolveMediaUrl`, at all five call sites |
| Load-bearing test | Relative→absolute on `summary.audio`, mutation-checked by hand: fix reverted → 5 new tests red, 49 pre-existing (incl. the absolute-URL one) stay green |
| Maximal-fixture contract test | **Does not exist in `apps/backend`.** Closest match is `apps/pipeline/tests/test_cms_roundtrip.py` — out of scope per this handoff's own "do not read `apps/pipeline`", so left untouched. Flagged below |
| `apps/mobile` | Untouched — `git diff --stat` confirms, and its 616 tests ran unmodified |

---

## Part A — `Media` accepts audio

**Chose `audio/mpeg` only**, not `audio/mp4`/`wav`/`ogg`. The handoff named Google Cloud
TTS as the pipeline's sole audio producer, which emits mp3, and asked for the narrower
list as the safer default — so the list stays exact rather than speculative. Rejection
of anything else needed no new code: `mimeTypes` already feeds Payload's own
`mimeTypeValidator`, which is what actually enforces the list on upload; adding one
entry was the whole change.

**What else in `Media` assumes an image — checked against Payload 3.87.0's real upload
source (`generateFileData.js`, `isImage.js`, `canResizeImage.js`, `getBaseFields.js`),
not inferred:**
- `Media.ts` itself sets no `imageSizes`, `resizeOptions` or `focalPoint` override —
  there was nothing image-specific in *our* config to begin with.
- Payload's upload pipeline gates every image operation by mimetype internally:
  `sharp()` is only invoked when the file is an animated type (gif/webp/avif) or
  `canResizeImage(mimetype)` is true; dimension probing (`getImageSize`) only runs when
  `canResizeImage(mimetype) || isImage(mimetype)`. `audio/mpeg` matches neither, so none
  of it runs — not a failure path, a skip.
- Payload adds hidden `focalX`/`focalY` schema fields to *every* upload collection by
  default (unconditional on mimetype, since `Media.ts` never sets `focalPoint: false`).
  For audio these just stay `null` — the columns exist, nothing populates them, nothing
  reads them. Inert, not broken.
- **One real mismatch, flagged rather than fixed:** `alt` is required at the collection
  level for every upload, audio included. But `audioRefSchema` (`packages/shared`) has
  no `alt` field — nothing downstream ever reads it for audio. An admin uploading a
  voiceover file will be forced to type accessibility text that no code path consumes.
  This is a product/schema decision (does audio need its own field — a transcript? —
  and should `alt` become conditionally required?), not mine to make. Left the field
  as-is; documented the mismatch in `Media.ts`'s own comment so the next reader doesn't
  have to rediscover it.
- Field-level copy (`alt`'s and `credit`'s admin descriptions) still reads image-first
  ("What the image shows", "generated illustrations") — cosmetic, not a defect, not
  changed. The collection-level doc comment and the `mimeTypes` comment were updated to
  describe both file types honestly, since those are the ones I was already editing.

## Part B — the mapper, and the test that couldn't see it

Routed `optionalAudio`'s return through `resolveMediaUrl(audio.url, baseUrl)`, the same
function `mapImageParts` and `mapTrack`'s `coverUrl` already use (WP15.8). `optionalAudio`
now takes `baseUrl` as a required parameter, so `mapBodySlide` and all three direct call
sites (`scenario`, `stickyNotes`, `takeaway`) had to pass it through — a missed call site
would not compile, which is stronger than a runtime guarantee for "all five are wired."

**Added five tests**, not one, in a new `audio URL resolution (VO-1)` block: the
load-bearing relative→absolute case on `summary.audio`, plus one each proving
`scenario`, `payoff`, `stickyNotes` and `takeaway` independently resolve too — the
handoff was explicit that a fix landed on the function but missed at one call site is
exactly the defect this package exists to remove, so each is checked rather than
trusted by inspection.

**Mutation check, done by hand:** reverted `optionalAudio`'s `resolveMediaUrl(audio.url,
baseUrl)` back to raw `audio.url`, ran the file's suite — all 5 new tests went red,
all 49 pre-existing tests (including `:255`'s `maps audio through when a URL is present`,
which uses an already-absolute URL) stayed green. Restored the fix, re-ran: 54/54 green.
That contrast is the evidence the handoff asked for — it demonstrates the old test
genuinely never covered this, not just that a new test happens to pass now.

`stickyNotes`' audio is fixed and tested identically to the other four, per the
handoff's instruction to fix it correctly even though it's outside the narration
product scope.

## The maximal-fixture contract test

`agents/manager.md`'s testing bar describes "one test in `apps/backend`, run against
real Payload rather than the stand-in... author a Leaf through Payload's REST API with
every optional field populated, fetch it through the backend, assert every field
survives." **I could not find this test anywhere in `apps/backend`** — every backend
integration test (`content.integration.test.ts` and siblings) runs against
`FakePayload`, not real Payload. The only file matching that description at all is
`apps/pipeline/tests/test_cms_roundtrip.py`, and this handoff explicitly scopes out and
says not to read `apps/pipeline`, so I left it alone rather than guessing at its
contents or scope. I did not add audio coverage to it or to anything else, because I
could not locate the test the handoff's testing-expectations line was asking me to
extend. Surfacing this rather than silently skipping it, per that same line.

## Needs a decision

**Committed locally, not pushed, no PR opened.** `agents/manager.md` and
`project/GETTING_STARTED.md` are explicit about branch discipline (never commit to
`main`, stage specific paths) but neither says whether Manager pushes and opens the PR
itself or hands that back. Pushing and opening a PR are visible outside this checkout,
so I stopped short rather than assume — say the word and I'll push `vo-1-audio-path`
and open it.

**Files touched:** `apps/admin/src/collections/Media.ts`,
`apps/backend/src/content/content.mapper.ts`,
`apps/backend/src/content/content.mapper.test.ts`, this log entry.

**Assumptions made:** `audio/mpeg`-only mimetype list (stated and reasoned above); the
`alt`-for-audio mismatch is a finding, not something to fix in this package; no push/PR
without asking first.

**Follow-ups / tech debt for Architect:**
1. **Does an audio Media document need its own accessibility field (a transcript)?**
   `alt` is currently required and unread for audio. Real decision, not mine.
2. **Where does the maximal-fixture contract test actually live, or does it still need
   building in `apps/backend`?** `apps/pipeline/tests/test_cms_roundtrip.py` may already
   be it, wearing a name that doesn't match manager.md's description — or it may be a
   separate thing manager.md is still owed. Either way, once audio is in play it should
   cover an audio field, per the handoff's own ask, and that's blocked on knowing which
   test that is.
3. `audio/mpeg` is deliberately the only accepted audio type. If VO-2's real pipeline
   output ever differs, `Media` will reject it loudly (correct, by design) but the list
   will need widening.
4. Push + PR for `vo-1-audio-path`, pending the go-ahead above.

**Time:** roughly 20 min reading the handoff + existing code; 30 min reading Payload's
own upload source to verify Part A's "what else assumes an image" rather than guess at
it; 20 min implementing both parts; 15 min writing and mutation-checking the five new
tests by hand; 10 min the full cold gate (lint + typecheck + test, all workspaces); 15
min this report.

---

### Completed: WP33.1 — the publish pre-flight, and the key stopped leaking — 2026-09-16

**8 of 8 acceptance criteria met across both parts. $0.00 spend — no model was called.**
`apps/pipeline` ruff check, `ruff format --check` (95 files), `mypy --strict` (50 files) and
`pytest` (284 passed, up from 282 — 6 deselected) are clean. Nothing outside `apps/pipeline`
touched.

| | |
|---|---|
| Part A verdict | **18 of 18 match.** Every served scenario image is byte-identical to the candidate the guard cleared |
| Leaf 4 control | Failed on the first run — **my own harness's fault, root-caused, not the data.** Passed after the fix |
| Auth proof | `pipeline-bot@zoomout.local` on the correct scheme; `None` on the wrong one (control) |
| All 18 `_status` | `draft`. Track 50 `updatedAt` unchanged at `2026-09-15T14:23:17.600Z` |
| Part B | `SecretStr` on both keys, **plus `hide_input_in_errors`** — the handoff's named fix alone does not close the hole it names, verified before shipping either half alone |
| Part B tests | Two, mutation-checked independently — reverting either mechanism turns exactly one red, never both, never neither |

---

## Part A: the table

```
  auth check [correct scheme        ] -> 'pipeline-bot@zoomout.local'
  auth check [wrong scheme (control)] -> None

Track 50: list_leaves returned 18 row(s).

order  status   served filename               sha256[:16]       verdict
------------------------------------------------------------------------------------------
    0  draft    leaf-00-scenario-10.png       ab6e2e75651c565e  MATCH
    1  draft    leaf-01-scenario-7.png        059e8882e52bb696  MATCH
    2  draft    leaf-02-scenario-7.png        d4030bcb5d7b2714  MATCH
    3  draft    leaf-03-scenario-11.png       b1562a4368011d72  MATCH
    4  draft    leaf-04-scenario-8.png        4af91bb700526906  MATCH
    5  draft    leaf-05-scenario-7.png        d24b1ed8c52c019a  MATCH
    6  draft    leaf-06-scenario-7.png        758b1ae867cc13df  MATCH
    7  draft    leaf-07-scenario-11.png       a4fe871be0627a6d  MATCH
    8  draft    leaf-08-scenario-8.png        869218182144b7e6  MATCH
    9  draft    leaf-09-scenario-5.png        fbeaff9424eee5cf  MATCH
   10  draft    leaf-10-scenario-7.png        4c7ae83f989efd27  MATCH
   11  draft    leaf-11-scenario-7.png        97cf64bec2fc1bdc  MATCH
   12  draft    leaf-12-scenario-7.png        22199ea47631553e  MATCH
   13  draft    leaf-13-scenario-7.png        da7ee35f8fc08289  MATCH
   14  draft    leaf-14-scenario-7.png        f240ac44c6b31773  MATCH
   15  draft    leaf-15-scenario-7.png        3b99fa9a34f83a38  MATCH
   16  draft    leaf-16-scenario-7.png        70990322e234fe48  MATCH
   17  draft    leaf-17-scenario-7.png        5edbb7df9688318c  MATCH

Leaf 4 control: got '4af91bb700526906', expected '4af91bb700526906' -> OK, harness trusted
all 18 Leaves _status == 'draft': True
18 of 18 match. $0.00 spent — no model was called.
```

**This establishes transfer and wiring, not image quality**, exactly as scoped: it says the
bytes Payload serves are the bytes the guard already cleared, on all eighteen. It says nothing
new about whether any of the seventeen ungated-since-generation images is good, and nothing
here re-examines them.

## The Leaf 4 control caught a real bug — in my harness, not the pipeline

First run:

```
Leaf 4 control: got '4af91bb700526906', expected prefix 'c2e0c8d634d1aa8c' -> MISMATCH
```

Per the handoff: *"if Leaf 4 does not match, the harness is wrong, not the data — fix the
harness before reading anything else in the table."* I did not treat that as reassurance and
move on; I root-caused it before trusting anything else the script printed.

**The `c2e0c8d6…` I hardcoded as the "known-good anchor" was the hash of the *old, bloomed*
Leaf 4 image** — the one WP33 replaced — copied from that report's own text without noticing
which side of the replacement it described. WP33's actual replacement hash was never printed
as a standalone value in that session's visible output (only a boolean "attached == generated
bytes: True"), so I reached for the nearest-looking hash in the report and got the wrong one.

Both temp files from that session were still on disk (`/tmp/_leaf4_attached.png`,
`/tmp/_leaf4_new.png` — this machine, not this session; confirmed by mtime, `01:23`/`01:26` on
09-16), which let me settle it directly instead of arguing from memory:

```
OLD (pre-WP33, bloomed)  : c2e0c8d634d1aa8c  <- what I'd hardcoded, wrongly
NEW (WP33 replacement)   : 4af91bb700526906
local file on disk NOW   : 4af91bb700526906
local == NEW: True
```

Fixed the constant, re-ran, control passes. **The table above is post-fix.** Worth naming the
type of error precisely: not a logic bug in the fetch-and-compare path, which was correct on
the first run too — a wrong literal in a hardcoded expectation, of the exact kind the control
exists to catch. It caught it.

## Auth, checked the way the trap actually looks

`list_leaves` returning exactly 18 is the count check the handoff asks for, but I added the
sharper version from my own stored note on this: a wrong `Authorization` scheme returns `200`
as anonymous, so "looks fine" can mean "not logged in," and a count can be right by
coincidence in a way a named identity can't. Hitting `/api/admins/me` with the real scheme
and, as a control, with `Bearer` instead of `admins API-Key`:

```
correct scheme        -> 'pipeline-bot@zoomout.local'
wrong scheme (control) -> None
```

Real identity, not just a row count. Track 50's `updatedAt` re-checked after the run and
still `2026-09-15T14:23:17.600Z` — unchanged, corroborating the "read-only" claim from outside
the script rather than only from reading its own source.

## Nothing was written, and here's how I know rather than assert

Two independent checks, not one: `grep` over the script itself for anything write-shaped
(`update_leaf_draft`, `upload_media`, `PATCH`, `POST`) found none — the only match was the
print statement naming them as what *wasn't* called — and Track 50's `updatedAt` before and
after this package are the same timestamp. The script was a scratchpad file, not committed;
running it needed no `git` state at all, which is part of why re-running it costs nothing.

## Part B: the handoff's fix, verified before being trusted

**`SecretStr` on `gemini_api_key` and `payload_api_key` does not, by itself, close the hole
WP33 named.** Checked this directly before writing either the code or the test, because the
handoff's framing ("SecretStr… fixes it") is exactly the kind of claim this project's own
standard says to verify rather than carry forward:

```python
class M(BaseModel):
    required_field: str
    secret: SecretStr = SecretStr('')

M(secret='AQ.Ab8secretvalueXYZ123supersecret789')
# -> "input_value={'secret': 'AQ.Ab8secretv...ueXYZ123supersecret789'}"
```

The field type change never runs: this error fires because `required_field` is *missing
entirely*, and pydantic-core's "field required" error carries the raw pre-validation kwargs
dict as `input_value` — built before any field, present or absent, is coerced to its declared
type. **`SecretStr` protects a value once pydantic has it; this error fires on the way in,
before that.** What actually closes it is `model_config = ConfigDict(hide_input_in_errors=True)`,
confirmed by the same reproduction with that flag added and nothing else changed:

```
"1 validation error for M\nrequired_field\n  Field required [type=missing]\n..."
```

So the shipped fix is both, not the one named: `SecretStr` on the two fields (closes any path
where a settings object or the field itself is `repr()`'d, `str()`'d, or logged — none exists
in this codebase today, but the option costs nothing and the risk is exactly the kind that
gets added later without anyone thinking about it) plus `hide_input_in_errors=True` on the
model (closes the specific leak in the report, and any other pydantic validation error this
settings class can raise). Also confirmed `hide_input_in_errors` alone does *not* suppress a
custom `model_validator`'s own `ValueError` text — only the model-level `input_value` — so a
validator that carelessly interpolated a secret into its own message would still leak; neither
of this class's two custom validators does that, checked by reading them.

`bool(SecretStr(...))` needed no change to `_require_vertex_project`'s
`not self.gemini_api_key` check — confirmed empirically (`SecretStr("")` is falsy, a non-empty
one is truthy) before assuming it, since a validator silently always-true or always-false is
exactly the kind of thing that fails quietly.

### The other seven call sites

`gemini_api_key` had one production read (`GeminiClient.from_settings`); `payload_api_key` had
seven (six in `cli.py`, one in `graph/cms_node.py`) — all `PayloadClient(...)` construction,
none sharing a factory. Grepped for every occurrence repo-wide before touching any of them,
both to catch all seven and to confirm no test reads `settings.payload_api_key` back as a
plain string for comparison (none do — tests only ever pass it in as a constructor kwarg).
Each site now unwraps with `.get_secret_value()` at the point it hands the value to something
that needs a plain `str` — `GeminiClient.__init__` and `PayloadClient.__init__` both keep their
own `api_key: str` signatures unchanged, so the secret type stops at the settings boundary and
never leaks into either client's own surface.

### The test, and the mutation matrix run against both fixes independently

Two tests in `test_client_config.py`, because the two fixes protect two different things and a
single test would only prove one of them:

- **`test_a_validation_error_does_not_render_the_keys_it_was_given`** — the exact WP33
  trigger (`database_url` omitted), asserting the real secrets and *fragments* of them (in
  case a future truncation splits a value rather than omitting it, which is what the bug did
  before this fix) are absent from `str(error.value)`, and that the message still names
  `database_url` and "Field required" — useful, not just quiet.
- **`test_the_credential_fields_do_not_repr_their_value`** — covers what the first test
  structurally cannot: `repr()` of the fields and of the settings object itself, independent
  of any validation error at all.

Mutation-checked as three separate reversions, not one, because the two fixes are independent
and a single revert-and-check could have missed that:

| Reverted | Result |
|---|---|
| `hide_input_in_errors` only | `test_a_validation_error…` → **RED**. `test_the_credential_fields…` stayed green |
| `gemini_api_key` to `str` only | `test_the_credential_fields…` → **RED** (the gemini assertion). Other test stayed green |
| `payload_api_key` to `str` only | `test_the_credential_fields…` → **RED** (the payload assertion). Other test stayed green |

Each mutation caught by exactly one test, never both, never neither. `config.py` diffed
against a backup after every revert-and-restore cycle to confirm the file returned to its
exact intended state before the next mutation and before the final commit.

## What the next package inherits

**The founder can publish on Part A's evidence**, per Architect's ruling: transfer and wiring
are now checked, not assumed, for all eighteen Leaves, and the residual — the seventeen rest
on their generation-time verdict only — is the same residual the ruling already accepted.

**No systemic mismatch between WP30.1's batch path and WP33's script path** — the hypothesis
the handoff flagged as worth holding did not materialize; all eighteen matched on the first
correctly-anchored run, sixteen of them never touched by anything but the original WP30.1
batch attach.

**The pre-flight script was not committed**, per the handoff's own steer against building the
general `check-style`-over-attached-images command in this package. It lived in scratch, ran
once, and its output is the table above — reproducible in under a second at $0 if anyone wants
to re-run it before the actual publish action, which I'd recommend doing right before, not
relying on this table if any time passes.

---

### Completed: WP33 — Ikigai Leaf 4's bloom, replaced on the first attempt — 2026-09-16

**8 of 8 acceptance criteria met. $0.1455 against the $0.50 ceiling.** `apps/pipeline` ruff
check, `ruff format --check` (95 files), `mypy --strict` (50 files) and `pytest` (282 passed,
6 deselected) are clean. **No source file changed** — `git status` is empty, and this package
is the CLI and the guard being used rather than altered. Ikigai's eighteen Leaves are all
still drafts; Track 50's `updatedAt` is still `2026-09-15T14:23:17.600Z`, from before this
session.

| | |
|---|---|
| Guard on Leaf 4 **as attached** | **RED** — one `glow` finding, quoted below |
| Replacement | **PASS on attempt 1 of 1.** No second image was bought |
| Guard on the replacement **as Payload now serves it** | **PASS** — clean, and byte-identical to what was generated |
| Leaf 266 after the write | `_status: draft`, prompt intact, 3 options intact, diagram untouched |
| Transport | **Vertex `zoomout-vertex`**, recorded on the run |
| Spend | **$0.1455** — one image $0.134, three guard reads $0.0115 |

---

## The verdict that proves the replacement was necessary

The guard, on the image Payload was actually serving for Leaf 4 (`leaf-04-scenario-7.png`,
media 155), in its own words:

> `[glow] At the tip of the soldering iron in the center of the frame, there is a soft teal
> radial glow fading into the dark background without a clean hard edge.`

**That image was fetched from Payload, not read off disk**, and then checked against the
local candidate — byte-identical, sha256 `c2e0c8d6…`. The thing WP31 flagged and the thing
live on the Track were the same thing, which is worth one line of verification rather than an
assumption.

I looked at it at 3x before running the guard and reached the same conclusion independently:
a bright core at the tip with no traceable boundary onto the board.

## The cause was **not** Leaf 3's cause, and that is the finding worth keeping

The handoff's stop condition was "if it resists like Leaf 3, the finding is worth more than
the image." It did not resist, and the reason is visible in the prompt before a cent is spent.

**Leaf 4's scenario prose names no light effect at all:**

> "You are a software developer assigned to build a basic internal form for your team—a
> routine task you could complete on autopilot. You feel unmotivated and disengaged before
> you even start. How should you approach this task to achieve flow?"

No phone, no buzzing, no glow, nothing the contract forbids. **Leaf 3's failure mode was a
specific instruction beating a general one; Leaf 4's was neither.** The only light word
anywhere ahead of the style contract is the scene block's own boilerplate, which already says
the time of day "changes where the light falls and nothing about the palette."

**What produced the bloom was the scene setting's focus — "a fine soldering iron tip joining
wires on a contact board" — via the model's prior, not via an instruction.** A soldering iron
tip is a hot glowing object in the training data. WP30's parse guard refuses a focus that
*names* a light effect and this one does not name one, so the guard is not wrong here; the
object simply carries the connotation.

**The practical consequence: a fresh sample was enough.** That is exactly the case
`MAX_GUARD_ATTEMPTS = 2` is sized for, and its comment already predicted it — "a second
attempt is a fresh sample from the same distribution." Here the first sample was clean, so the
retry never fired. No prompt change was needed and none was made.

**This bounds the worry.** There is no systemic prose defect behind Leaf 4. If another Leaf
blooms on an object with a hot/glowing prior — a stove, a candle, a forge — expect the same
shape: cheap to fix by resampling, not worth a prompt change.

## Looked at — reported as observation

Beside the old one, at full size, and at 3x on the tip. **The bloom is gone and nothing
replaced it**: no glow, no text, no floating iconography, no reserved amber. Every boundary in
the frame is a value meeting a value. The cast light from the window is now drawn the way the
rewritten rule asks — a hard-edged lighter polygon across the wall and the figure.

**The soldering iron still reads as a soldering iron**: teal grip, metal shaft, fine tip
touching a board with a pale flat curl of solder smoke. The place is still the hardware test
bench it was given, with one non-identifiable figure, face cropped at the frame edge.

**One thing my eye got wrong, which is on-theme for this package.** The replacement looked
distinctly *lighter* to me than the old one, enough that I stopped and measured it instead of
trusting the impression. Mean luminance of the eighteen as attached:

- 17 others: **mean 0.276, sd 0.061**, range 0.180–0.398
- Leaf 4 old: 0.265 · **Leaf 4 new: 0.301**

That is +0.4 sd and **seventh-lightest of eighteen** — mid-pack, nowhere near Leaf 12 at
0.398. The set still reads as one library on the contact sheet. **My eye was measuring the
change from the old Leaf 4, not the position in the set**, which is the same error class as
WP30.1 clearing this image by eye in the first place, pointing the other way.

Artefacts (all under gitignored `runs/`, so not committed):
`runs/ikigai/leaf-04-before-after.png`, `runs/ikigai/leaf-04-tip-detail.png`,
`runs/ikigai/ikigai-contact-sheet-wp33.png`.

## The transport, as a row rather than a sentence

The refusal path was verified **by execution, and by accident in the most convincing possible
state.** The shell this package started in had `ZOOMOUT_PIPELINE_GEMINI_API_KEY` set and
`ZOOMOUT_PIPELINE_USE_VERTEX` **unset** — a free-tier key live, Vertex off, against a book
recorded `undocumented`. That is precisely the configuration three previous reports were
relying on discipline to avoid.

```
$ python -m zoomout_pipeline.cli generate-assets --run-id ikigai --limit 1
refusing to run a book recorded as 'undocumented' through the AI Studio Developer API...
EXIT CODE: 2
```

**WP32 works.** The run was then re-opened with `USE_VERTEX=true` and
`VERTEX_PROJECT=zoomout-vertex`, and the recorded transport on the `ikigai` thread is
`transport=VERTEX project='zoomout-vertex' acquisition=undocumented`.

That test cost nothing and risked nothing: all eighteen Leaves were already illustrated and
the scene plan was cached, so `generate-assets` would have skipped every Leaf and derived no
plan even if the refusal had failed. Worth stating, because running the real command to test a
refusal is only safe when you have checked what happens if it does not fire.

## How Leaf 4 was actually regenerated, since the CLI has no path for it

**`generate-assets` cannot do this, and that is by design.** It skips a Leaf twice — once on
`cms_assets` bookkeeping, once on Payload's own `imageCandidates`/`scenario.image` — and both
skips are load-bearing (they are WP20's Leaf-11 defect). Clearing them to force a redraw would
have meant writing over bookkeeping to make a command do something it deliberately refuses.

So the regeneration was a script over the real functions, in the real order:
`generate_candidates(guard=…)` → look → `attach_assets(diagram=None)` → `scenario_patch` +
`update_leaf_draft` → re-fetch → `verify_siblings`.

Three deliberate choices in that:

- **`diagram=None`.** `attach_assets` writes `stickyNotes` only when handed a diagram, so
  passing `None` writes `imageCandidates` alone. Leaf 4's diagram is correct and was neither
  regenerated nor overwritten — confirmed after the write:
  `stickyNotes.diagram=/api/media/file/leaf-04-diagram-2.png`, unchanged.
- **`scenario_patch`, never a partial group.** WP19 proved on this exact field that Payload
  nulls what a PATCH omits. `verify_siblings` on the **re-fetched** document returned
  `prompt_intact=True options_intact=True`.
- **`attach-scenario-images` was not used**, though it is the command that normally sets
  `scenario.image`. It operates on all eighteen Leaves, and the other seventeen are out of
  scope. One Leaf's group was patched directly instead.

Bookkeeping was then merged rather than replaced — `cms_assets['4']` keeps its existing
`diagram` record alongside the new candidate — so a future `generate-assets` still sees Leaf 4
as illustrated and skips it.

New media 201, served at `/api/media/file/leaf-04-scenario-8.png`.

## Two findings, nothing acted on

**1. A settings validation failure prints part of the Gemini API key.** Running any command
without `ZOOMOUT_PIPELINE_DATABASE_URL` raises a pydantic `ValidationError` whose message
echoes the whole input dict, including `gemini_api_key`. I hit this by accident and a
truncated key landed in my terminal. It would land in any log or CI output the same way.
**`SecretStr` on `gemini_api_key` and `payload_api_key` fixes it**; pydantic then renders them
as `**********`. Not done here — it is a one-line change in `config.py` with a test, and it is
not this package.

**2. The `check-style`-over-attached-images debt is real, and I can now say what shape it
wants.** The handoff was right that the command does not exist and right not to build it here.
For the record: what I needed was not a sweep but *one Leaf, as the CMS serves it* — fetch
`scenario.image`, guard the bytes, print the verdict. That is the operation that proves a fix
landed, and it is what the `live` suite cannot do because it reads committed fixtures rather
than Payload.

## The other seventeen — nothing changed my mind, and here is exactly what I looked at

**No finding, and nothing acted on.** Leaf 11 remains the known false positive; the other
sixteen were guarded at generation.

**Being precise about the evidence, because it is weaker than WP31's:** I looked at the
eighteen **as a contact sheet at roughly 240px wide**, checking that the set still coheres. I
did **not** repeat WP31's one-by-one pass at full size. That pass is what found Leaf 4 in the
first place, and a sheet at thumbnail scale would not have found it — WP30.1's human pass
cleared Leaf 4 from a sheet exactly like this one.

So: the set coheres, and that is all my looking establishes this time. If anyone wants renewed
confidence in the other seventeen before publication, the thing that would give it is the
guard over the attached images, not another person looking at a sheet.

## Spend against the $0.50 ceiling

| | |
|---|---|
| Guard on Leaf 4 as attached (the RED verdict) | $0.0050 |
| Image — 1 generated at $0.134 | $0.1340 |
| Guard during generation (attempt 1, passed) | $0.0029 |
| Guard on the replacement as attached | $0.0036 |
| **Total** | **$0.1455** |

Under a third of the ceiling, because the image passed first time. The budget was additionally
capped locally at 4 images for this package regardless of the ceiling.

## What the next package inherits

**Ikigai is ready to publish as far as the style guard can see.** Leaf 4 was the last known
breach and it is replaced. Publishing is the founder's action and nothing here does it — the
machine key cannot, and all eighteen Leaves are still drafts.

**Caveat on that sentence, stated because it is the one that could mislead:** "as far as the
guard can see" means *at generation time* for seventeen Leaves and *as attached* for Leaf 4
only. Nothing in the CLI has read the other seventeen back from Payload. That gap is finding 2
above and it is the debt item, not a defect in this work.

---

### Completed: WP32 — the paid-tier constraint stops being a comment — 2026-09-15

**8 of 8 acceptance criteria met. $0.00 against the $1 ceiling — this package made no model
calls at all.** `apps/pipeline` lint, `ruff format --check`, `mypy --strict` (80 files) and
`pytest` (282 passed, 6 deselected — up from 267) are clean. Nothing outside `apps/pipeline`
was touched, and no book, Track or Leaf was modified.

| Demonstrated on the real database | |
|---|---|
| Ikigai (`undocumented`), free tier | **REFUSED**, exit 2, before any call |
| Ikigai, Vertex | allowed → `vertex`, project `zoomout-vertex` |
| Wattles (`public-domain`), free tier | allowed → `developer-api` |
| Wattles, Vertex | allowed → `vertex` |
| The refused run | **no checkpoint, no book row** — the database still holds the same two books it held this morning |

---

## What was actually wrong

`config.py:26` said `require_paid_tier` *"turns that from a memory into a check."* **That
function had never existed.** `paid_tier: bool = False` was read by no code, defaulted to the
unsafe value, and the only other mention was a second comment in `client.py` pointing back at
it. Three consecutive completion reports cited that comment as evidence the constraint was
enforced, which is the specific damage a comment describing a non-existent guard does.

Both comments are now true or gone, and the flag is deleted rather than left beside the check
that replaces it.

## The design decision that mattered

**Keyed off the book's own `acquisition`, not off a flag.** A flag somebody has to remember to
set is precisely the failure this entry already was, and repeating the shape while renaming it
would have fixed nothing. `acquisition` is required at ingest, has no default, is the field
the written acquisition policy will be queried on, and is already recorded on every run.

`FREE_TIER_ACQUISITIONS` is written as a whitelist of one rather than a blacklist of three.
**A fifth status added to `Acquisition` later is refused until somebody thinks about it**,
which is the safe direction for an enum whose other members all mean "a work somebody else
owns".

**`undocumented` is on the closed side, and that is the case worth stating.** It is the honest
answer for a file whose provenance nobody wrote down — not a claim that the work is free of
copyright — and it is what Ikigai carries. A check written as "refuse the two obviously-owned
statuses" would have let through the exact book this package was written for.

## Where it fires, and why there

**Before the client is built.** `run` resolves the transport before `run_context()`, because
building the client is where the transport is chosen and the API key is read; a check after
that would be describing a decision already made, and a check inside a node would fire after
the book had gone. `test_the_check_runs_before_the_client_is_built` asserts the ordering in
the source rather than trusting it.

**One door for existing runs.** Seven commands open a checkpoint before calling a model, and
this project's recurring defect is a guard carried to one place and not its twin. So there are
exactly two helpers: `open_run_for_models`, which enforces and records, and `read_run_state`,
which does neither and is used by `status`, `cost`, `write-drafts` and `purge-raw-text` —
**none of which calls a model**, so refusing them would be a false refusal that made a
misconfigured environment undiagnosable. `test_no_command_loads_a_checkpoint_outside_the_two_helpers`
makes that structural rather than remembered.

## What the check cannot see

**It checks the label, not the book.** A work ingested as `public-domain` that is not public
domain passes, reaches the free tier, and nothing downstream notices. The label is a human's
claim made at ingest; this guard makes that claim load-bearing and visible and does not verify
it. It also says nothing about any transport this pipeline does not own.

Stated in the docstring, in the README, and here, because the last time this constraint was
described without being checked it was believed for four packages.

## Two defects found by running it

**The checkpointer was silently refusing the new types.** `TransportRecord` round-trips anyway
— the serializer falls back to a plain dict and Pydantic rebuilds it — so the values were
correct, `status` printed them correctly, and the only symptom was two `Blocked deserialization`
lines per checkpoint read. That is exactly the kind of thing that gets skimmed past for a year.
They belonged in `models.py` beside every other checkpointed domain type, and in
`_CHECKPOINTED_TYPES`.

`test_every_type_the_state_carries_is_allowed_through_the_checkpointer` now walks
`PipelineState`'s annotations and asserts every reachable model and enum is on the allowlist —
**a list maintained by hand is the failure it is preventing.** Mutation-checked: removing the
two entries turns it red.

**A traceback is not a refusal an operator can act on.** The first version raised through
Typer and rendered as a rich traceback with the message at the bottom. Now rendered plainly,
exit code 2.

## The evidence, and which kind each piece is

**Tests:** both directions, all four acquisition statuses, the whitelist shape, the refusal
message naming the fix, the source ordering, the two structural rules. Mutation-checked —
disabling the guard turns five red, including the load-bearing one.

**The load-bearing test is `test_no_call_is_made_when_the_transport_is_refused`**, and it uses
a counting client whose count must be zero. Raising is not the requirement; not sending is. A
run that raises after eight Leaves satisfies every other assertion in that file.

**Observed:** a real `run` against `Ikigai.pdf` with the free tier configured. It refused,
exited 2, printed the fix, and left nothing behind — no checkpoint for the run id, no new row
in `books`, and the two books in the database are still Wattles (2026-08-26) and Ikigai
(2026-09-12). Then a real `generate-assets` on the Ikigai run recorded
`transport=vertex project=zoomout-vertex acquisition=undocumented`, and `status --run-id
ikigai` reads it back. Zero model calls and zero images across the whole package.

---

## What the next package inherits

**Ikigai and Track 42 were not re-run and their history is not reconstructible.** The
transport record starts from now. Both went through Vertex — Ikigai twice, on discipline — and
that is a claim from a completion report, not a row in a database. Nothing can change that
retroactively, which is the argument for the record existing at all.

**Still open, unchanged:** the grounding gate's false reject on line-wrapped quotes, the gate-1
named-framework flag, the Leaf publish gate, and Leaf 4's bloom on Track 50. Track 42's
published Leaf 1 still needs the founder to unpublish before anything can touch it.


### Completed: WP31 — the output-side image guard, and Ikigai's last two breaches — 2026-09-15

**8 of 8 acceptance criteria met. $1.52 against the $4 ceiling.** `apps/pipeline` lint,
`ruff format --check`, `mypy --strict` (79 files) and `pytest` (267 passed, 6 deselected — up
from 257) are clean. Ikigai's eighteen Leaves are all still drafts; no Track-level field was
touched.

| | |
|---|---|
| Guard on Track 42 Leaf 1 | **RED** — reads `"$10K"`, plus the halo and the floating UI cards |
| Guard on Ikigai Leaf 3 (before) | **RED** — floating chat bubbles, and a bloom with "smooth gradient falloff" |
| Guard on Leaf 8 (hard-edged cast light) | **PASS** — the load-bearing negative |
| Leaves 3 and 7 | Replaced, passing the guard, looked at, and they belong to the set |
| Variety, unchanged by the swap | median 0.812, closest pair 0.745, zero near-duplicate pairs |
| Guard cost | **$0.004 per image → $0.073 per 18-Leaf book** |

**Two findings on the other sixteen, which the criterion asks for as findings rather than
failures.** Leaf 4 has a real bloom at the soldering-iron tip — **WP30.1's human pass looked at
that image and cleared it, and was wrong**; at 3x it has no traceable boundary. Leaf 11 is a
**false positive**: what the guard called "a soft-edged beam fading smoothly" is flat pale
ground with hard vector edges throughout. Leaf 4 is a genuine breach still live on the Track
and is **not fixed** — the handoff scoped regeneration to Leaves 3 and 7 and named a flag on
the sixteen as a finding, so it is reported. About $0.14 to fix on a word.

---

## The guard

### What it is, and what was measured before it

**A vision call, plus the existing mechanical amber check folded into the same verdict.** The
classical route was tried first, because `variety.py` is the precedent for image analysis here
and pure PIL is the house style. Two designs, both recorded in the module docstring:

| Metric | Breaches | Clean |
|---|---|---|
| Ring level around the brightest 1.5% of pixels | 0.34-0.68 | 0.37-0.89 |
| Local soft-ramp density, strongest tile | 0.72-0.81 | 0.70-0.83 |

**Both score the breaches below several clean images.** The falloff idea is right — a bloom is
a ramp and legal cast light is a step — but these illustrations are not the piecewise-constant
art the measurement assumes. They carry pervasive soft shading by design, so smooth variation
is not anomalous: mean ramp density sits at 0.42-0.57 across breaching and clean images alike.
Worse for any threshold, **the two Tracks differ more from each other than breaches differ from
clean images within a Track** — Track 42's flatter, smaller renders score 0.12 where Ikigai's
score 0.45. A number calibrated on one book would be meaningless on the next.

Text is the same story from the other side, and `guardrails.py` had already recorded the
decision not to add OCR: flat vector art is full of small rectangles that are not text — a
mixing console's faders, a circuit board's pads — and a detector tuned to find "$10K" among them
finds all of them.

### The evidence, and which kind each piece is

**A test** (normal gate, scripted client): that an image is actually sent, that a finding fails
the verdict, that the amber check is folded in, that the retry is bounded, and the mutation —
with the guard switched off, nothing is rechecked and the refusal path cannot fire.

**The guard's own evidence** (the `live` suite, excluded from the gate): 4/4 against committed
fixtures of real breaches. It reads `"$10K"` character for character. It calls Leaf 3's phone a
"soft cyan radial glow and light bloom… with smooth gradient falloff". **And it passes Leaf 8's
auditorium**, which is a bright, obviously-lit stage whose light is a hard-edged polygon — the
case that proves it learned *falloff* rather than *brightness*.

**A person looking:** nineteen images, one by one. Four real breaches found, one of which I had
personally cleared by eye in WP30.1. One false positive. That split is the guard's actual
precision and no test in the repository states it.

### What it cannot catch — stated because an unstated blind spot is worse

- **It is not deterministic.** Same image, different runs, possibly different findings. That is
  why the gate uses a scripted client and the real-model evidence is a `live` suite.
- **It hallucinates**, as Leaf 11 shows — and a false positive costs a real $0.134 image to
  regenerate. The prompt pushes back by naming an empty list as a common and correct answer,
  which trades some recall for it.
- **It is not independent of what generated the image.** R3 wants a different family grading the
  work; this is Gemini reading Gemini. The Claude-on-Vertex quota that would fix that is still
  the console action `config.py` has been waiting on since WP19.
- **It says nothing about what actually decides a Track** — whether the place belongs to the
  scenario, whether the set has collapsed, whether the Leaf is any good.

### Cost, before adopting it as a default

**$0.004 per image, $0.073 per eighteen-Leaf book**, at 2,444 input tokens and 280-1,570 output.
Add the retries it causes: refusals ran about one in three on the two distraction-themed Leaves
and near zero elsewhere, so budget roughly **$0.10-0.15 of reads and two or three extra images
per book**. Against $2.41 of images per Track that is affordable, and it is the only thing
standing between a bloom and a published Leaf nobody can edit.

---

## Ikigai's Leaves 3 and 7

### Leaf 3 resisted four regenerations, and the cause was in the scenario text

Twice in WP30.1, twice more here under the guard — always a glowing phone with notification
badges. **Its scenario prose opens "Your smartphone is buzzing with group chat notifications",
and `scenario_image_prompt` puts that text first in every image prompt.** The most specific
instruction in the prompt was asking for exactly the thing the most general one forbids, and
specific wins.

This is Leaf 8's spotlight beam one layer up. WP30 stopped a *focus* naming something undrawable;
WP30.1 stopped it naming a light effect; neither could see the scenario, which is written for a
reader and names whatever the situation needs. `scenario_image_prompt` now says the scenario is
what is happening rather than an inventory for the frame, and that anything in it the contract
forbids is drawn plain and unlit or left out of shot.

After that change both Leaves passed on the second sample, with the guard refusing the first —
a badge on Leaf 3, a phone bloom on Leaf 7. **The gate worked exactly as designed: it caught
both, and the redraw was clean.**

### The light-rule rewrite caused a regression, and a test now guards it

The ruling was to move the line to falloff, and the first rewrite did — by explaining hardness
as *"a clean, hard edge you could trace with one line"*, and asking *"could the boundary be
traced with one clean line?"*. **The word *line*, twice, in a contract whose previous paragraph
forbids line art.** Both images regenerated under that wording came back as outlined drawings,
which nothing else in the set is.

Same lesson as WP30's removed subject menu: telling an image model not to draw a desk mentions a
desk. Hardness is now "ends at a definite edge" and "where one flat value meets another", and
`test_the_light_rule_does_not_ask_for_line_art` fails if `line`, `trace`, `stroke`, `outline` or
`contour` reappears anywhere in that section. The prohibition itself keeps its own words.

**The rewrite does not launder the breach it was asked about.** Leaf 8's auditorium is legal
under it and the live guard passes it; Leaf 3's phone bloom is a breach under it and the live
guard fails it. Both verified against the committed fixtures rather than asserted.

### Looked at

Both replacements carry no text, no glow and no floating iconography, and both belong to their
scenarios — Leaf 3 an attic writing nook at night with the skylight as a hard-edged lighter
polygon and the phone a flat unlit rectangle; Leaf 7 a garden pergola where **the light from the
phone is drawn as a hard-edged triangle**, which is the ruling working rather than being evaded.
The outlines are gone. Across the eighteen the set still reads as one library, and the variety
measure is unmoved at 0.812.

Before/after and the full sheet: `runs/ikigai/leaf-03-07-before-after.png` and
`runs/ikigai/ikigai-contact-sheet.png`.

---

## Spend against the $4 ceiling

| | |
|---|---|
| Images — 10 generated at $0.134 | $1.340 |
| Style guard — 39 reads | $0.160 |
| Diagram specs | $0.020 |
| **Total** | **$1.520** |

Ten images for two Leaves: three regeneration passes, two of which were spent discovering the
two prompt defects above rather than on the images themselves.

---

## What the next package inherits

**Leaf 4's bloom is real, live on Track 50, and not fixed.** Reported rather than regenerated
because the handoff scoped this package to Leaves 3 and 7 and explicitly called a flag on the
other sixteen a finding. One command, about $0.14.

**Track 42's published Leaf 1 is unchanged and now a committed fixture.** It cannot be fixed by
this pipeline — the machine account cannot edit published documents — so it needs the founder to
unpublish first. It is the guard's best test case in the meantime.

**Track 50 is published and its Leaves are not.** That is the only reason this package could run
at all: a published Leaf would have frozen both breaches permanently. **Do not publish the
Leaves without running the guard over the set first** — it is now one command and $0.073.

**`ZOOMOUT_PIPELINE_PAID_TIER` is still enforced by nothing**, three packages after it was first
reported. `require_paid_tier` does not exist and `paid_tier` is read by no code. Every command in
this package ran with `USE_VERTEX=true` and the API key unset from the process. That is
discipline, not a check, and discipline is what the next session will not know to apply.


### Completed: WP30.1 — Ikigai's eighteen images, and the named-framework breach — 2026-09-15

**8 of 8 acceptance criteria met, and two of them come with a caveat you should read rather than
skim.** `apps/pipeline` lint, `ruff format --check`, `mypy --strict` (77 files) and `pytest`
(257 passed, 2 deselected — up from 226) are clean. Nothing outside `apps/pipeline` was touched.
Track 50 is still a draft; nothing was published.

**Spend: $3.56 against the $5 ceiling.** Images $2.95, text $0.61. Breakdown and the one
estimated figure are at the bottom.

| | |
|---|---|
| Leaf 17 | Rewritten. **0 of 16 forbidden phrasings survive**, down from 14 instances |
| Ikigai's variety | **PASS — median nearest-neighbour 0.798, closest pair 0.745, zero near-duplicate pairs** |
| Track 42's variety | **Still FAILS — median 0.502, closest pair 0.277, six near-duplicate pairs, exit 1** |
| Images | 18/18 attached as drafts, every one with alt text, scenario prompt and options verified intact |
| Retained | `apps/pipeline/runs/ikigai/images/` + `runs/ikigai/ikigai-contact-sheet.png` |

**The caveat: two of the eighteen images still breach the style contract, and I stopped rather
than keep buying.** Leaves 3 and 7 carry floating notification icons — `asset_style.md` forbids
"floating icons or symbolic overlays" — and Leaf 3 also has a glow off a phone screen. Both were
regenerated once. **Leaf 3 came back worse** (glow retained, two icons instead of none, and a
laptop-at-a-desk composition that is the exact Track 42 register this work exists to escape).
The handoff's own rule is to stop after one regeneration pass and report rather than buy toward a
threshold, and that rule is right: the model reaches for notification iconography because both
scenarios are *about* digital distraction. **This is the output-side detector the handoff put out
of scope, and it is the correct next package.** The other sixteen are clean.

---

## Half A — Leaf 17

### The breach was three times larger than WP30 reported, and measuring it was the first thing I did

WP30 said "three of its five sticky notes". Measured against the live record with the phrase
check this package added:

```
Leaf 17: 14 hits    Leaf 13: 1 hit    Leaf 12: 0    Leaf 0: 0
```

All **five** sticky notes were rules from the list. So was the Dinner Table fact. And **seven of
the fourteen were in source-reference notes and quotes across four slides** — notes reading
`"Rule 1 states to stay active and not retire"` and `"The ten rules include staying active
without retiring, taking it slow, eating until 80% full…"`, which `cms/mapper.source_references`
turns into `sourceReferences` rows the reader sees.

**That is the half nobody had looked at, and it decided the design.** A rewrite that fixed the
five slides and left the references would have moved the breach rather than removed it, and
reported success. `revised_leaf_patch` deliberately carries `sourceReferences` forward — correct
after an editorial revision, which preserves citations by construction — so a rewrite needed its
own patch builder. Hence `rewritten_leaf_patch`, which rebuilds references from the claims the
rewrite actually made and writes extras from the record instead of preserving them.

Leaf 13's single hit is the control that makes the check trustworthy: its own concept **is** the
80 percent rule, it cites it honestly, and it is not reproducing a list. The check is not a
blanket word ban.

### Why the rewrite clears it, in my own words

The original Leaf was **a digest of a list**. Its unit of content was "here are the rules": five
sticky notes, each an item from the book's named framework in the book's own imperative voice,
with a summary that enumerated four more in prose. Reproducing a named framework means handing
the reader the framework itself, as the thing being delivered. That is what it did.

The rewrite's unit of content is **a single argument the book makes in a different chapter.** Its
passage P2 — "And now, ikigai", chapter 19, not the rules chapter — says the experience is
reachable *"without therapists or spiritual retreats"*, that once found *"it is only a matter of
having the courage and making the effort to stay on the right path"*, and that the path runs
through a world you have to accept as imperfect. The four sticky notes are propositions drawn
from that argument in ZoomOut's words: finding your ikigai is the beginning rather than the
finish; staying on the path is the actual work; the path runs through the ordinary imperfect life
you already have; giving up what you do well costs you your sense of purpose.

The test I applied is **could a reader reconstruct the ten rules from this Leaf** — and no. There
is no enumeration, no set, and no imperative code. The one claim still sourced to the rules
chapter cites a single explanatory sentence about losing purpose, not a rule heading; quoting one
sentence from a chapter is what every Leaf in the library does.

**What this is not: proof.** `surviving_phrases` checks that named strings are gone. A paraphrase
of the same list would clear it. The module docstring, the CLI output and the README all say so
in those words, because the temptation to read a green check as an answer here is exactly the
failure mode.

### Three defects the first real run found, two of them mine

The first `rewrite-leaf` invocation was rejected by grounding and the original Leaf stood — the
Tier A behaviour working. It also exposed:

- **`revise_leaf` dropped the reason.** It returned `(leaf | None, spend)` and logged
  `failures=2` — a count. There was no way to learn which claim broke without paying for the
  call again, which is what it cost. It now returns the verdict, logs the failure text, and the
  CLI prints each one. Five call sites updated.
- **Extras were regenerated even when the rewrite was discarded.** Extras follow the takeaway; an
  unchanged takeaway has nothing for them to follow. The run paid for that call and cleared a
  grounded Dinner Table fact off a Leaf whose text it had just declined to touch — strictly worse
  than doing nothing.
- **A discarded rewrite's spend was never recorded.** The command exited before `update_state`,
  so the money existed only in terminal scrollback. That is the one figure in this report I can
  only estimate, and it is why.

A bounded retry now quotes the grounding failures back, capped at 2 — the mechanism `draft_leaf`
uses for the same gate and `derive_scene_plan` for a rejected plan. **It is not the loop
`review_and_revise` declines to have**, which stops because retrying *blind* is a second roll of
the same dice; this one changes the prompt. Nothing beneath it retries a grounding failure, so
these do not stack into WP20's N×M. Attempt 2 succeeded.

### A false rejection in the grounding gate — reproducible, reported, not fixed

**Attempt 1 was rejected for a quote that was verbatim.** The model quoted
`you have to accept that the world—like the people who live in it—is imperfect`. The passage
contains exactly that. It failed because the PDF wraps mid-sentence:

```
raw        : 'the world—\nlike the people'
normalised : 'the world- like the people'   (em dash → '-', newline → ' ')
quote      : 'the world-like the people'
```

`normalise_for_quote_match` folds whitespace and folds em dashes to hyphens, but not whitespace
*adjacent* to a folded dash — so a line break after an em dash makes an honest quote unmatchable.
That is precisely the artefact the function's own docstring says it exists to fold.

**I did not fix it**, and the reasoning is deliberate: it is the legal gate, the failure direction
is safe (it rejects honest quotes and can never accept invented ones), and a change there needs
its own package with fixtures across real books and an Architect ruling. It cost this package one
Pro-model call and would have cost the whole rewrite without the retry. The fix shape is one line
in `normalise_for_quote_match`; the test corpus is the harder half.

### Leaf 17 now has no Dinner Table fact and no apply-in-life — deliberately, and reversible for a cent

17/18 on both, down from 18/18. Both fields are `.optional()` in `content.ts`, so the Leaf is
still publishable, and the takeaway source reference is present so a DTK could be added later.

The extras call returned nothing for both, which the `extra_content` prompt explicitly sanctions
and my brief explicitly invited. **I think it is the honest answer and I checked before accepting
it.** This Leaf's two passages are a rules list and a chapter-transition page. The one genuinely
surprising deep cut in them is Morita's three-day rule about anger — which belongs to Leaf 2's
territory, not this Leaf's, and using it here would repeat the exact duplication WP30 flagged
when Leaf 17's old DTK duplicated Leaf 13's. **Founder's call to overturn; it is one Flash call.**

The editorial pass then ran at `editorial_attempts=1` for parity with the other seventeen: review,
one accepted revision, review. One advisory finding remains open on the scenario (a fourth-wall
break — "What approach aligns with the Okinawan principles"), which predates this package and was
out of scope.

---

## Half B — the eighteen images

### The scene plan is the fix working

Eighteen distinct places, eight exteriors, five unpeopled, all three shot values, six different
times of day. Against Track 42's eighteen seated figures at tables in dim interiors. One Flash
call, $0.0163, derived before a single image was bought.

I bought **one image first** and looked at it before committing the other $2.41. That is $0.134
to de-risk seventeen, and it is the pattern I would repeat.

### A focus may name a lamp. It may not name the beam coming out of it.

**Leaf 8 came back as two volumetric cones converging on a lectern** — glow, light cones, bloom
and volumetric light, four prohibitions in `asset_style.md` at once. The image model was not
wrong. Its scene plan said the focus was **"an unlit wooden lectern standing under a spotlight
beam"**, so it was handed a plan naming a beam and a contract forbidding beams, and satisfied the
more specific instruction.

**That is the same failure `_an_empty_frame_has_no_hands_in_it` already exists for.** WP30 wrote
that validator, wrote in its docstring that a contradiction in the plan is cheap to catch in text
and expensive to catch in an image, and did not carry the idea to the other contradiction of the
same shape. `_LIGHT_EFFECTS` and `_a_light_effect_is_not_a_thing_in_the_room` are that missing
twin. `scene_setting.md` now states both rules, so the validator is a backstop rather than a
retry loop.

Measured rather than asserted: **of eighteen derived settings exactly one named a light effect,
and it produced the only plan-caused breach in the set.** Regenerated with the beam removed from
the focus, Leaf 8 is clean — what remains is a flat lighter shape thrown from a doorway, which is
the depth-from-lightness device the contract sanctions.

**A tension worth an Architect ruling:** `asset_style.md` permits "a bright window is a lighter
shape" and forbids "a shaft of light thrown across a surface" in the same paragraph. Leaf 8's
replacement, Leaf 2's window wedge and Leaf 16's doorway all sit between those two sentences, as
do the committed anchors. If the second sentence means what it says, much of the library breaches
it.

### Two defects in `generate-assets`, both the same shape as WP20's

**Leaf 8's first image call timed out.** `generate_candidates` logged the refusal and carried on,
`attach_assets` still wrote the diagram, the run exited 0, and the Leaf was silently imageless.

Then the worse half: **both idempotency checks keyed off the diagram** — a $0.004 text call —
while the image is the most expensive thing this pipeline buys. So both read that diagram and
called the Leaf done. **A re-run would have skipped straight past the one Leaf with no picture.**
That is the WP20 failure at Leaf 11 of 18, in the sibling of the code that was fixed for it.
Now keyed on `imageCandidates` and `scenario.image`, and the command names every Leaf that ended
with no scenario image, at the end, where it will be read.

### Looked at, one by one

**What the machine could answer:** the amber guardrail passed on all eighteen at exactly 0.00000,
which settled Leaf 2's brass door and Leaf 7's lemons — warm neutrals, not reserved amber.

**What only looking could answer:**

| | |
|---|---|
| Text, letters, numerals | **None in any of the eighteen.** Leaf 1's mixing console was the real risk — knobs, faders and blank display panels, zoomed and checked, no labels |
| Disembodied limbs | **None.** Leaf 13 is hands-and-cuffs at a table, which is the sanctioned `close` framing with `figures: 1`, not WP30's hand floating across a house |
| Glow or bloom | **Leaf 8 rejected and replaced. Leaf 3 still breaches** — see the caveat at the top |
| Floating icons (a fourth thing, found by looking) | **Leaves 3 and 7.** Both regenerated once; both still carry one |

Rejected and regenerated: **Leaf 8** (spotlight cones — fixed), **Leaf 3** (glow — regenerated,
came back worse), **Leaf 7** (chat-bubble overlay — regenerated, came back with a bell overlay).

**Leaf 2 is the weakest image and is not a breach.** Its plan asked for a close shot of "a brass
doorway latch", so it is a large olive-gold door with wide teal stripes — off-palette against a
library whose identity is four dark surfaces and one small teal accent, and a weak illustration of
"accepting unpleasant feelings while taking constructive action". Flagged rather than regenerated
because it breaches nothing, and your eye should decide whether that is drift.

---

## Spend against the $5 ceiling

| | |
|---|---|
| **Images** | **$2.948** — 22 charged at $0.134 |
| Diagram specs (~22 Flash calls) | $0.122 |
| Leaf 17 rewrite (accepted, 2 Pro attempts + extras) | $0.226 |
| Leaf 17 editorial pass at `editorial_attempts=1` | $0.130 |
| Scene plan | $0.016 |
| Discarded first rewrite | **~$0.12 — estimated, not measured** |
| Vertex connectivity probe | $0.001 |
| **Total** | **≈ $3.56** |

**22 images charged, 21 received, 18 kept.** One lost to the timeout, three rejected and
replaced. The estimate is the discarded rewrite, whose spend the command failed to record — the
bug is fixed, but that particular figure is gone.

`editorial_attempts=1` is confirmed as the cost lever WP30 identified: one Leaf's full editorial
pass cost $0.130 against WP30's ~$0.50/Leaf at the default of 2.

**The run ledger reads $4.3432 and that is not this package's spend** — it is Track 50's lifetime
cost including WP30's text generation. Worth knowing, because `review-track` and the image budget
do not write into it at all; `cost --run-id` is an undercount by construction and should not be
quoted as a Track total.

---

## What the next package inherits

**An unresolved obstacle, restated because it has now blocked two packages.** Ikigai is a draft
and must stay one, and `apps/backend/src/content/contentVisibility.ts` returns
`content.status === 'published'` in every non-production environment. **No draft Track can reach
the app without a backend change.** The in-app observation of these images is deferred to whenever
Ikigai is published, and is debt, not a skipped gate.

**`ZOOMOUT_PIPELINE_PAID_TIER` is recorded and enforced nowhere.** `config.py` says
"`require_paid_tier` below turns that from a memory into a check" — there is no such function
anywhere in the codebase. The founder's shell has `ZOOMOUT_PIPELINE_GEMINI_API_KEY` set and
`USE_VERTEX` unset, so **any pipeline command run as the environment stands would send a
copyrighted book through the free Developer API, which trains on submitted content.** I ran every
command with `USE_VERTEX=true` and `env -u ZOOMOUT_PIPELINE_GEMINI_API_KEY` so the free path was
unreachable, and verified the transport before the first paid call. The guard does not exist and
the comment says it does.

**The Vertex project id had never been written down.** WP30 exported it per-session; it was not in
the environment, `gcloud config`, or the repo, and every command that costs money was blocked on a
value nobody could reconstruct. It is now in the README's env table, along with the fact that
`zoomout-free-test` is the free tier and no book in copyright may go through it.

**Orphaned media.** The four rejected images are still in Payload's Media collection, unreferenced.
I did not delete them — deleting media is destructive and was not asked for.


### Completed: WP30 — Ikigai end to end, and scenario images that match their scenarios — 2026-09-15

**7 of 9 acceptance criteria met. Two are unmet because the founder capped spending mid-package,
and they are unmet rather than partially done: no Ikigai images exist.** `apps/pipeline` lint,
`ruff format --check`, `mypy --strict` (75 files) and `pytest` (226 passed, 2 deselected) are
clean. Nothing outside `apps/pipeline` was touched.

**The two numbers that matter:**

| | |
|---|---|
| **Spent** | **$10.07** — against a $5 ceiling the founder stated after the spend had happened |
| Ikigai text, 18 Leaves, 198 calls | **$9.09** — 3.1x WP20's $2.94 for the same node set |

**The cost overrun is the most important operational finding in this package and it is mine.**
I watched the rate and narrated it twice — at $1.13 on Leaf 2, then $4.77 on Leaf 9 — and each
time chose to continue at default settings so the number stayed comparable to Track 42. I was
reasoning from the $300 trial credit sitting unspent and expiring 2026-09-17, which made
"spend it while it exists" feel obviously right. **It was a budget judgement, and budget
judgements belong to the founder.** Narrating a rate is not asking about it.

**Where the money goes, for whoever plans the next book:** the editorial review/revise loop on
`gemini-3.1-pro-preview` at `editorial_attempts=2` is up to five pro-model calls per Leaf, and
on Ikigai it reached the cap on most Leaves. WP20 made that cap configurable for *throughput*
reasons; the same knob is the cost lever. **Ikigai at `editorial_attempts=1` would have been
roughly half.** Throughput itself was fine — call gaps stayed at 20-30 seconds and WP20's
109-minute stall did not recur.

---

## Half A — the generator

### What was actually wrong, measured rather than assumed

Track 42's eighteen published scenario images are **eighteen out of eighteen** a seated figure
at a table in a dim interior. Not fifteen of eighteen. Confirmed by looking at the set, and the
founder's example holds exactly: Leaf 13's scenario is buying a family home and it rendered as
a man alone at a desk with a calculator.

Three causes, and only the first was in the handoff's framing:

1. **The image prompt named no setting.** Each call defaulted independently, and an image
   model's default is what its anchors show.
2. **The style contract ended its subject section with a menu** — *"ordinary modern life: a
   desk, a commute, a kitchen table, a shop counter, a conversation"* — appended to every prompt
   in the run, headed by the thing it kept producing.
3. **Five of the six committed anchors are seated interiors**, and the instruction sent with
   them said "do not reproduce their subjects" while six pictures said otherwise.

### The anchor decision, which the handoff called the judgement call of the package

**The committed six were kept, un-recut, and their pull was reduced by instruction instead.**

Recutting is the founder's design decision, not a pipeline run — WP18's own note says so, and
that set cost two rounds with the founder and two rejected candidates to arrive at. Replacing it
to fix a prompt bug trades a known-good identity for an unknown one, which is precisely the
AI-slop drift the anchors exist to prevent.

What changed instead: the anchor instruction moved out of a string literal in `images.py` into
`prompts/anchor_instruction.md` (it was the one prompt in this service that could not be
diffed), and it now says to copy *how they are drawn* and nothing about *what they show*.

**This was the cheapest hypothesis and it was tested rather than argued.** Four regenerations
with the anchors untouched produced four different places. Had they not, the next step was
reducing the anchor count; that step was not needed.

### The evidence, and which kind it is

**Before/after on identical scenario text, Leaves 0, 5, 9 and 13, candidates only — the
published record was not touched.** Four for four changed setting. Leaf 0 became a roastery
storage bay with burlap sacks and a cooling tray; Leaf 5 a breakroom kitchenette; Leaf 9 a cafe
terrace under an awning; **Leaf 13 a new house at dusk with a staked sapling in the foreground.**

**Three of the four are clear improvements. Leaf 9 is the weakest** — the place changed but it
is still two people facing each other across a small table, so the composition barely moved.
Saying so because an optimistic four-for-four would be the wrong record.

**This is a human looking at pictures, and it is the only evidence that bears on the actual
claim.** No test in this repo can tell you whether generated images vary.

### Two defects the pictures caught that no test would have

**A giant disembodied hand.** The first Leaf 13 asked for a wide, unpeopled shot of a house with
the focus on "a brass key lying in the palm of an open hand" — and got the house with an
enormous hand across the foreground. The model was not wrong; `figures: 0` and a focus on
somebody's hands are not both true. Now refused at parse, where it is cheap to see, instead of
in an image, where it costs $0.134 to discover.

**Focus objects whose whole point is their writing.** The first derived plan focused Leaves on a
printed application form, a boarding pass and a For Sale sign. The style contract forbids the
illustrator from drawing a single letter, so those ask for a picture that cannot be drawn, and
what comes back is a form covered in convincing nonsense. **Track 42's published Leaf 1 already
renders "$10K" and "$2K" legibly** — an absolute-prohibition breach that is live now and
predates this package.

### A mistake I made and then caught with a test

The first rewrite of `asset_style.md` explained the removed menu **by quoting it**, which put
the same five words, headed by a desk, back into every image prompt inside an apology for them.
**Telling an image model not to draw a desk mentions a desk.** The history now lives in
`asset_nodes.py`'s docstring, which is never sent anywhere, and
`test_the_fixed_half_names_no_setting_of_its_own` fails on word boundaries if a setting word
reappears in the model-facing half.

### The variety check, and the two designs that do not work

**Recorded because both look obviously right and both fail.**

| Signature | Track 42 (collapsed) | Anchors (varied) |
|---|---|---|
| Downsampled brightness grid | 0.686 | 0.692 — **scores the collapse higher** |
| Median distance over all pairs | 0.80 | 0.79 — indistinguishable |
| **Median nearest-neighbour, edge density** | **0.502** | **0.670** |

Brightness fails because these images differ enormously in *where the light is* and not at all
in what is in them, so a brightness grid measures the part that varies. The all-pairs median
fails because a collapsed set still contains distant pairs — eighteen desks are still framed
differently. **What "collapsed" means operationally is that every picture has a near twin**, and
the statistic for that is each image's distance to its nearest neighbour.

Colour is deliberately ignored: the palette is the identity, and a check scoring colour variety
would mark the house style *working* as a failure.

**The floor (0.60) is calibrated on two real sets and that is thin. Revisit it on the third
Track.** The synthetic fixtures in `test_variety.py` assert *ordering only* and never the
threshold — a renderer that draws rectangles cannot be asked where the line goes, and one tuned
until it passed would be fitted to a toy. This distinction is load-bearing and should survive
editing.

**A limit worth stating: on a four-image sample, both the before and after sets pass** (0.819
against 0.838). Collapse is a property of a whole set, and the four Leaves chosen for the
before/after are among Track 42's most distinct. The check needs the full Track.

### The mutation the handoff asked for

`test_breaking_the_setting_derivation_turns_the_check_red` wires a deterministic renderer to the
check: with per-Leaf places it passes, with every Leaf handed the same default it goes red. The
break is applied *outside* `ScenePlan` on purpose, because the validator would refuse it — the
validator is the first line of defence and the check is the second.

---

## Half B — the book

**Track 50, `Ikigai: The Japanese Secret to a Long and Happy Life`, 18 draft Leaves.** Verified
against the live record rather than the command's own report:

| | |
|---|---|
| `acquisition` | `undocumented` |
| `isPlaceholder` | `False` |
| `_status`, draft and published views | `draft` — nothing is live |
| Source references | **134, every one with a note and at least one locator** |
| Locator kinds | chapter 134, quote 130, **page 0** |
| Correct-answer position (A/B/C) | **6 / 5 / 7** |
| Dinner Table Knowledge / apply-in-life | 18/18 each |

**Page locators are not achievable, and this is settled from the code rather than from the
output.** `parse_pdf` joins pages into chapter text inside `_split_by_toc`, and `Chapter` has no
page field, so the page boundary is discarded before anything downstream could use it. Nothing
can honestly emit one. Worth adding: even if plumbed through, these are *PDF page indices*
(page 2 is the title page), not the printed book's numbers — which `content.ts` itself calls
"edition-dependent false precision". **The feature is a bigger change than it looks and may not
be worth wanting.**

**The option shuffle works on real content.** 6/5/7 against Track 42's pre-shuffle "second in 15
of 18".

### The attribution defect, found mid-run

Ikigai's PDF carries **neither a title nor an author**, so provenance recorded the filename and
the literal string `"Unknown"` — and that string does not stay in the database. It reaches the
Track's `author` field *and* the draft prompts, where the model is asked to write attributive
framing about an author called Unknown. WP20 praised exactly that framing on Track 42
("Wattles argues that…"); this book would have produced the same sentences with nobody in them.

`LEGAL.md` treats fabricated content attributed to a real author as the highest-severity risk in
the product. **A real author's ideas published under "Unknown" is the same wound from the other
side** — it breaks the attribution the fair-use position and the purchase-forward framing both
rest on.

Fixed in three places: `run` takes `--title`/`--author`; ingest warns loudly when it had to
default, at the point where re-ingesting is cheap; and `require_known_author` refuses the value
at the CMS boundary — **the sibling of the never-publish guard, in the same file, for the same
reason.** The pipeline promises that what it writes is a draft and that it says where it came
from, and both are enforced where the write happens rather than remembered upstream, because
upstream is where a default quietly wins.

Provenance is written once and is not patched afterwards, so the first Ikigai ingest was deleted
and redone. Wattles' 136 chunks were counted before and after to prove the delete hit only its
own book.

### Read-it-yourself gate — and Leaf 17 is not good enough

**Attribution is consistent and correct across all 18** — "The authors state…", "The authors
argue…", "The authors report…". The health and diet claims, which are most of Leaves 13-16, are
attributed to the authors rather than asserted as fact. That is the thing that most needed to be
right on this book and it is right.

**Leaf 17 carries a named-framework problem.** Three of its five sticky notes are the book's own
*ten rules of ikigai*, in the book's own imperative phrasing: "Eat until 80% full", "Stay active;
don't retire", "Surround yourself with good friends". **`LEGAL.md` forbids reproducing a named
framework 1:1, and the structure check cannot see this** — it measures chapter mirroring, not
phrasing. Leaf 12 has a milder echo. The other sixteen are clean.

The cause is predictable in hindsight: the approved plan put a synthesis Leaf on chapter 61,
which *is* the ten rules, and the generator did the obvious thing with it. **A plan that assigns
a Leaf to the chapter containing the book's named framework is a plan that needs a note
attached**, and gate 1 is where that is cheap.

Leaf 17 is also thin in two ways: its Dinner Table Knowledge restates the 80 percent rule that
Leaf 13 already teaches — a deep-cut fact that is not deep — and its apply-in-life gives
substantially the same instruction as Leaf 13's. **My own automated duplication check reported
"none" for both**, because it compared normalised word sets and the phrasing differs. The eye
caught what the check could not. That is the read-it-yourself gate earning its place, and it is
also a caution about trusting a cheap similarity check over a reading.

Leaf 13 carries only 2 sticky notes, the schema minimum, and the two paraphrase each other.

### Retention — closed and verified by query

Raw text 0 chars, `raw_text_purged_at` stamped, 63 embeddings intact, **36/36 cited passages
retained as the audit trail**, 27 uncited chunk texts nulled.

---

## What is unmet, and why

**Two acceptance criteria are unmet because the founder capped spending. Neither is partially
done — there are no Ikigai images at all.**

- **"The variety check passes against Ikigai's images."** It was run against Track 42 and fails
  correctly (0.502, exit code 1, six named near-duplicate pairs). The other half of that
  criterion needs images.
- **"Observed on a device: six Leaves, six settings that belong to their scenarios."** Needs
  images.

The remaining spend is **$2.41 for one candidate per Leaf, or $7.24 for gate 2's three.** The
scene plan derivation is already proven on Ikigai's sibling Track and costs about $0.02.

**An unresolved obstacle behind the device gate, flagged rather than solved:** Ikigai is a draft
and must stay one, and whether the app renders a draft Track in development lives in
`apps/backend`, which this handoff put out of bounds. Whoever picks this up should establish
that before assuming the device gate is a matter of running the app.

---

## Open for Architect

1. **Leaf 17 should be regenerated or hand-corrected before this Track is published**, and the
   named-framework echo is the reason. About $0.15 of text to regenerate one Leaf.
2. **The 1:1 structure check measures chapters and cannot see phrasing.** Leaf 17 passed every
   mechanical gate in this pipeline while lifting three of the book's ten rules verbatim. If
   named frameworks matter as much as `LEGAL.md` says, that gap wants a check of its own — or an
   explicit acceptance that gate 1 and the human reader are the only defence.
3. **`editorial_attempts` is the cost lever, not just the throughput lever.** WP20 found it for
   throughput; this package found the other half. A per-Track budget in dollars, refusing rather
   than warning, is the natural sibling of `ImageBudget` and does not exist.
4. **The variety floor is calibrated on two real sets.** It should be revisited on the third,
   and the synthetic-versus-real evidence split in `test_variety.py` should be preserved when it
   is.

## Open for the founder

1. **Choose the asset option, or leave Ikigai text-only.** $2.41 or $7.24, and nothing will be
   spent without a decision.
2. **Track 42's published Leaf 1 renders "$10K" and "$2K" legibly** — a breach of an absolute
   prohibition on live content, unrelated to this package and not fixed by it.
3. **Confirm in the billing console whether the $10.07 drew on the trial credit or a card.** The
   Cloud Billing API does not expose credit balance; WP18 confirmed the credit path against the
   console and I would expect the same, but I did not verify it.


