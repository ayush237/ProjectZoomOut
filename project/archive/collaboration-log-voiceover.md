# Collaboration Log — archive: voiceover's schema, generation and attachment

**Split out of `project/collaboration-log.md` on 2026-09-22**, at VO-3's merge (PR #55) — the point
where voiceover became a thing a reader can hear. These entries are closed.

**Voiceover's record is split across two archives, and here is the whole map** so nobody has to guess:

| Package | Handoff | Completion |
|---|---|---|
| VO-1 — the audio path | `collaboration-log-ikigai.md` | `collaboration-log-ikigai.md` |
| VO-2 — 144 clips rendered | `collaboration-log-ikigai.md` | **this file** |
| VO-1.1 — narrator-keyed audio, `textDigest` | **this file** | **this file** |
| VO-2.1 — both narrators attached | **this file** | **this file** |
| VO-3 — the player | active `collaboration-log.md` | active `collaboration-log.md` |

**Why VO-2 is split:** its handoff left the active file on 2026-09-18 under the four-most-recent rule
while its completion was still one of the four newest. Recorded rather than tidied, because the split
is the kind of thing that costs a reader trust when they find it undocumented.

**What these three packages settled**, for anyone tracing the audio contract rather than reading four
reports: slide audio is an **array keyed by a closed narrator enum** (`female`, `male`), each entry
carrying a `url`, a required `durationSeconds` and a `textDigest` the backend uses to drop stale clips.
VO-1.1 pushed that schema to the live database and built the backend contract test. VO-2 rendered 144
clips and wrote nothing, by the founder's mid-package ruling. VO-2.1 attached all 144.

**Where the rest is:** Phase 1 in `collaboration-log-phase1.md` · Phase 2 in
`collaboration-log-phase2.md` · the visual redesign and the first two books in
`collaboration-log-redesign.md` · WP29–WP33.1 and voiceover's first two packages in
`collaboration-log-ikigai.md` · everything newer in the active `project/collaboration-log.md`.

---

## Handoffs (Architect → Manager)

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
### Completed: VO-1.1 — slide audio carries a narrator and a digest — 2026-09-18

<!-- Header restored by Architect 2026-09-18 at the archive: this entry was appended without one, which made it invisible to a structural scan of the log. Body unchanged. -->

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

---

### Completed: VO-2 — 144 clips rendered, nothing written to the CMS — 2026-09-17

<!-- Header restored by Architect 2026-09-18 at the archive: this entry was appended without one. Body unchanged. -->

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

