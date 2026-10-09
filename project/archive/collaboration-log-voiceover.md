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
| VO-3 — the player | `collaboration-log-activation.md` | `collaboration-log-activation.md` |
| VO-4 — the ×1.3 stretch (**added 2026-10-09**) | **this file** | **this file** |
| VO-4.1 — the finish: a drifted Leaf holds on its own, then the last nine Leaves (**added 2026-10-09**) | **this file** | **this file** |

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

### Handoff: 2026-10-02 — VO-4.1: finish the book — a Leaf whose text drifted holds on its own, a free stale-audio check, then the last nine Leaves

*Pipeline Manager. Issued by the Architect 2026-10-02 as VO-4's close-out — **the founder's paste is the go.** **Part A is $0 and calls no model.** **Part B spends (Google Cloud, ≈ $0.24 expected) only after an explicit yes in your session**, and only once the founder has confirmed the tempo by ear.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Check your branch first** — the worktree is on `vo-4-narration-tempo` (PR #64). **If the founder has merged #64:** `git fetch origin && git checkout -b vo-4-1-finish-the-book origin/main`. **If it is not merged yet, stop and ask them to merge it** — do not stack on an open PR. **Never `git checkout main` in a linked worktree.** `runs/` is gitignored and holds everything paid for: never clean, prune, move or overwrite a file under `runs/ikigai/audio/{raw,final,checks,snapshots}` or `review-before-vo4/` — **that last one is the only copy of the full-book 1.0× tracks; hash its six files and put the hashes in your report.** Commit, push and open the PR yourself.
> **Read:** this handoff · your own VO-4 completion entry · `project/LEGAL.md`, "Narration" · `graph/narration_nodes.py` (whole) · `cli.py`'s `narrate`, `_Narration` and the per-Leaf loop · `assets/narration.py` (`text_digest`, `narration_script`, `NARRATED_FIELDS`, `clip_digest`) · `cms/client.py` (`get_leaf`, `list_leaves`, `whoami`) · `apps/backend/src/content/content.mapper.ts` lines ~330–380 (the drop rule — why a stale entry is silent) · `tests/test_no_synthesis.py`, `tests/test_narrate_cli.py`, `tests/narration_fakes.py` · `agents/pipeline-manager.md`.

### Task: VO-4.1 — finish the book
**Suggested model:** Sonnet — Part A is three small, bounded changes to code you wrote, each with a stated behaviour; Part B is a procedure with stop rules. The risk is a stale check that passes for the wrong reason, so it is shown red against the real shape of a drifted Leaf before it is trusted. The one thing nobody here can judge is the sound; that is the founder's ear.
**Context:**
- **VO-4 is good, and I re-checked it rather than the report.** Gate by hand at `bfd8522`: `ruff format` 130 files · `mypy` 112 · `pytest` **690 passed** (my first run failed one greeting test because I had exported `ZOOMOUT_PIPELINE_USE_VERTEX` — **run pytest without the Vertex variables**; it asserts the greeting command refuses off Vertex). The run's saved ledger: narration (speech) **$1.2964, unchanged** — zero synthesis — guard $0.5266 → **$0.7203**, and the 77 new listens on disk cost **$0.1937**. All **72** pending draft audio rows in the CMS point at files in `apps/admin/media` that are **byte-identical** to your `final/` clips. **20 of your mutants on a scratch copy: 19 red**; the survivor was mine — a 30-character *prefix* of the line's words in the not-on-disk message, which your pin (it refuses the whole text) cannot see: Part A5. **The pitch finding: reproduced, and not a defect.** `measure()`'s Sadaltager median moves +1.6% (10 of 36 outside ±2% in Leaves 0–8) and an independent estimator agrees on the clip-level median — but compared at **matched instants** Sadaltager's pitch is unchanged (median −0.1%, range −1.2%…+0.6%). The table's miss is which frames count as voiced. Nothing to change in `measure()`.
- **Leaf 9, verified against the CMS database (read-only SQL) rather than your reading of the code.** Of the 144 published audio rows, **142 match** the sha256 of their slide's current text; the two that do not are Leaf 9's payoff, both narrators (stored `13c9a963…`, current `66262e04…`). The version trail: **2026-09-17 21:06 UTC** — a draft of the corrected text carrying all eight audio rows (VO-2.1's attach); **2026-09-18 04:38:18 UTC** — **a human edit in the admin, published**: the payoff is now 302 characters, "…a secondary income stream, paired with small investments, exposes you…", and the eight audio rows rode along unchanged. **So that slide has been silent in both voices for two weeks.** (The CMS keeps no author on a version; it is almost certainly the founder's edit and a deliberate one — VO-2.1's own report flagged the older sentence as reading like a slip. The other 17 Leaves were published at 04:59:48 the same morning.)
- **A flaw in my VO-4 handoff — mine.** It said the tempo-1.0 regression's CLI leg would complete with no halt, and that all 144 accepted lines were cached. I checked that by `(leaf, slide, voice)` key, not by `clip_digest` computed from each Leaf's **current** text, which is the key the cache actually uses; the real check would have shown Leaf 9's payoff missing. Part A1's pre-flight is that check.
- **One thing my check found that your report does not say.** Of the 72 attached lines, 71 come from the same take VO-2.1 accepted. **One does not: Leaf 2, scenario, Achernar** — accepted at attempt 2 at 1.0 (attempt 1's blind reading was **22 of 27 words**), but at ×1.3 attempt 1's reading came back **27 of 27, exact**, so it was the one attached. Keep it (the guard's own rule), but it is a take the founder has not heard, and the guard is a noisy listener. Part B lists every such line.

**Objective:** **(A)** `narrate` holds a Leaf whose audio is not on disk **on its own** — named, free, and the run carries on; `--leaf N` selects Leaves; a free **read-only stale check** names every slide whose stored `textDigest` no longer matches its Leaf's current text; a partial run can no longer shrink a review. **(B)** With the founder's yes: Leaves 10–17 attach at the confirmed tempo and Leaf 9's two payoff clips are narrated fresh from its current text, so **all 18 Leaves wait as drafts, every slide's `textDigest` matching its own current text**. Nothing is published.
**Scope:** `apps/pipeline` only — `graph/narration_nodes.py`, `cli.py`, `README.md`, new tests, and a small new module for the stale check if cleaner. **Not touched:** `assets/speech.py`, `graph/greeting_nodes.py`, `assets/greeting.py`, `prompts/`, `assets/audio.py`, `apps/backend`, `apps/admin`, `apps/mobile`.
**Requirements:**

*Part A — $0, no model call, offline tests. The behaviours are the requirement; the shapes are hypotheses to verify against the code.*
- **A1. A Leaf whose audio is not on disk is held on its own.** *This reverses the line in my VO-4 handoff that a missing first attempt "stops the run" — ruled 2026-10-02: that line existed so a run over cached audio would be **unable to buy**, which `--no-synthesis` already guarantees, and Leaf 9 showed that a drifted Leaf is the ordinary result of editing text, not an anomaly worth stopping eight clean Leaves for.*
  (i) Before rendering or listening to anything for a Leaf, a `--no-synthesis` run checks that **every clip's first attempt is on disk** — `clip_digest(…)` from the Leaf's current text, then `store.raw_path(…).exists()`, all eight, free. (ii) A Leaf with any missing is **held — NOT ON DISK**: nothing rendered, nothing listened to (the guard fake's call count shows it), nothing attached, no spend — and the run **continues** with the next Leaf. (iii) The end-of-run output gives these Leaves their own heading, naming each missing (slide, narrator), saying the usual cause ("the Leaf's text changed after it was narrated") and the two ways out (`narrate --leaf N` without `--no-synthesis`, or revert the text) — never the words. (iv) The exit code is 1 if any Leaf was held for any reason; `HALTED` keeps meaning budget or speech failure, and **those two still stop the whole run**. (v) If a `NarrationNotOnDiskError` still arises mid-Leaf, it is the same Leaf-local hold: that Leaf's clips are discarded, never attached. (vi) In a run that **may** synthesise, nothing is held for this reason, but the same check **prints what the run will buy** — how many clips and which (slide, narrator), no words — before the first call. (vii) `render_line`, `_render_attempt` and the typed error are unchanged for library callers.
- **A2. `narrate --leaf N`** (repeatable, by `orderIndex`): only those Leaves, in order. An unknown index is refused **before** anything runs; `--leaf` with `--limit` is refused. The header says which Leaves it will do.
- **A3. A free, read-only stale check** — my suggestion is a separate command (`narration-stale --run-id`), **not a flag on `narrate`**, so the code that can spend is never constructed. For every Leaf of the run's Track, in **both** the published version and the latest draft, compare each audio entry's `textDigest` with `text_digest(<that slide's current text>)`. Print each mismatch — Leaf, slide, narrator, version (live | draft), stored and current digest (first 8 hex) — and a last line ("N stale slides in M Leaves"); exit 1 if any, 0 if none. Where there is no pending draft, report once, as live. It must **not** be able to spend or write: no `SpeechClient`, `Guard` or budget is constructed — pinned by a test with exploding fakes — and it reuses `_Narration`'s `whoami` check, because an anonymous 200 shows no drafts and would report "clean". **Before you trust it, show it red against Leaf 9's actual shape** (a stored digest of the older sentence, a current reworded one) **and green on a clean Leaf.**
- **A4. A partial run cannot shrink a review.** This run's 72 → 36 is how the full-book tracks nearly went. A run that covers fewer clips than the review it would overwrite writes beside it (a name that carries the coverage) and says so; a run that covers every Leaf it was asked for, and at least as many as the existing review, overwrites as now. Test both directions.
- **A5. Tighten one pin.** The not-on-disk message test refuses the whole text; make it refuse **any 12-character window of the line's text**. My prefix-leak mutant must go red.
- **A6. The README and the docstrings** say what the code now does: `--leaf`, the stale check, the Leaf-local hold, the review rule. A grep finds no remaining "stops the run" for a missing clip.

*Part B — the finish. It starts only when the founder has told you, **in your session**: (1) the tempo is right — or the one to use instead; (2) what Leaf 9's text should be (my recommendation: **keep the edit**); (3) **yes to the money**, after you have given them the ledger, the ceiling, the expected figure, the worst case and the headroom.* If the founder has not yet listened to `review/vo4-before-after/`, **ask before you spend anything**: the tempo is theirs to confirm by ear, and a different tempo means the nine attached Leaves are redone.
- **B1. Free first.** Run the stale check. Expected: exactly Leaf 9's payoff, both narrators, live; nothing in any draft. **Anything else: stop and report.** (If the founder reverted Leaf 9's text, expected is nothing, and B3 is not needed.)
- **B2. The bulk, guard only.** `ZOOMOUT_PIPELINE_MAX_NARRATION_USD=2.75 narrate --run-id ikigai --no-synthesis --tempo <confirmed>` — the ceiling inline, never in `.env`, and the header must show it. Expected: Leaves 0–8 "already held" at $0; **Leaf 9 held NOT ON DISK, named, no listens**; Leaves 10–17 render, are listened to and attach (**64 clips, ≈ 77 listens with retries, ≈ $0.21**); exit 1 because of Leaf 9. **The speech line of the ledger must not move.**
- **B3. Leaf 9's payoff, the only synthesis.** First `narrate --leaf 9 --no-synthesis` (free): it must name **exactly** the two payoff clips. Anything else: stop and report. Then, with the founder's explicit yes to *speech*: `ZOOMOUT_PIPELINE_MAX_NARRATION_USD=2.75 narrate --run-id ikigai --leaf 9 --tempo <confirmed>`. Expected: two clips synthesised (≈ $0.014; worst case six with retries, ≈ $0.04), Leaf 9's listens (≈ $0.016), the draft written. **The speech line moves by about that and by nothing else; `raw/` gains exactly the files for the clips synthesised and every other raw file is byte-identical.**
- **B4. One whole-book pass.** `narrate --run-id ikigai --no-synthesis --tempo <confirmed>`: all 18 "already held", $0, exit 0, and the review rebuilt for **all 18 at the confirmed tempo** (72 clips a voice; quote the cue sheet's own "N clips, MM:SS" line, do not estimate).
- **B5. Re-verify from outside, and by the check VO-4 lacked.** By REST (or SQL if you have a way; or the A3 command as a second opinion): every draft audio row's served bytes equal your `final/` clip; **every draft slide's `textDigest` equals the sha256 of that Leaf's current text — all 144**; the stale check is clean for drafts and reports only Leaf 9's *live* rows, which publishing the draft fixes; every live Leaf's `updatedAt` is untouched. **Take a before/after of the live audio by REST before B2** and compare after.
- **B6. A take-change table.** List every line, in all 18 Leaves, whose attached attempt differs from the take VO-2.1 accepted (find it by re-rendering each raw attempt at tempo 1.0 and matching the pre-VO-4 `final/` mp3 — **the Leaf 2 scenario, Achernar is one**), with the guard's reading of each. The founder approved the old takes by ear; they should know which lines are different.
- **B7. Report** the ledger delta by node, the cumulative total against $2.75, the orphan count (**144 old Media documents become orphans when the founder publishes** — the machine key cannot delete Media), and the idempotence run's $0.

**Out of scope:**
- Any change to `apps/admin`, `apps/backend` or `apps/mobile`. **The admin has no warning when a narrated field is edited under existing audio, and the backend drops the stale entry with a log line nobody reads** — that is the cause of Leaf 9, it is a Manager package, and it is in the register.
- `measure()`, `pitch_track` and their fields. **Never edit a Leaf's text — Leaf 9's included.** If the founder wants it reverted, they revert it in the admin and you re-run B1.
- Publishing; deleting Media; a direction change; a second book; the cost-ledger lock (still open — **one `narrate` process at a time**); any synthesis other than Leaf 9's payoff.

**Constraints:**
- **The legal fence stands.** Nothing in this package reaches a voice by a new path; `assets/speech.py` is not modified. The only synthesis is Leaf 9's `payoff.body`, the Leaf's own prose, through the existing door.
- **Spend: Part B exactly.** No other paid call. **If the run halts on the ceiling, stop and report — raising it is the founder's decision.** A change of tempo costs ≈ $0.2 more and still fits under $2.75 (ledger $2.0167 today; ≈ $2.26 after B2–B3); any further change would not — stop and ask.
- **The shapes named are hypotheses** — the pre-flight's place, the command's name, the review-naming rule. Verify each against the code and say so where it disagrees.
- **Payload on `:3001` must be up** for `narrate` and the stale check. It is the founder's dev server: ask them to start it, do not start it yourself. The environment variables are the README's; **pytest runs without the Vertex ones.**
- **Mutation discipline, as you have been doing it:** every new guard broken on purpose, watched red, restored byte for byte, hash-verified; where two changes could each explain a green test, revert them separately. Include my prefix-leak mutant (A5).
- **Gates run the configured target.** From `ZO-pipeline/apps/pipeline`: `.venv/bin/ruff format --check . && .venv/bin/ruff check . && .venv/bin/mypy && .venv/bin/pytest`. Baseline, **re-checked by the Architect by hand at `bfd8522`: ruff format 130 files, mypy 112, pytest 690 passed (6 `live` deselected).** Counts must rise; reconcile any drop; no existing test modified except additions you name.
- Stage specific paths (`git diff --cached --name-only`); never `git add .`; never commit to `main`. **Re-derive every number and every path in your completion entry from the disk before you write it** (VO-4's first draft got a track length and two counts wrong), and add the entry at the **top** of Completions, where the newest goes (VO-4's went to the bottom).

**Device gate:** *(The founder's ear, at the Mac. **Every path absolute, in `ZO-pipeline`, not `ZO`.** Nothing reaches a reader until the founder publishes in the admin — and that, not you, is how Leaf 9's payoff gets its sound back.)*
- **Before Part B,** the founder listens: `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/vo4-before-after/` (nine pairs), **and a stretch of the audio that is actually attached** — `…/review/ikigai-narration-sadaltager.mp3` (Druv, 11:31) or `…/ikigai-narration-achernar.mp3` (Lara, 11:19): Leaves 0–8 at ×1.3. They tell you the tempo is right, or what to use.
- **After Part B:** the full-book tracks at the same paths, rebuilt (≈ 22–23 minutes a voice). Give the cue-sheet time of **Leaf 9's payoff in each**, and of every line in the take-change table, so the founder can go straight to them. **The founder listens for:** clearly faster, not rushed; shorter pauses; any warble, doubled syllable or clipped consonant (name the clip); takeaways that still come to rest; and that Leaf 9's new payoff sounds like its neighbours.
- **After the founder publishes the 18 Leaves,** in the app: Leaf 9's payoff slide has a play control in both voices — **the thing that has been missing since 2026-09-18.** That check is theirs.

**Acceptance criteria:**
- [ ] A1: a `--no-synthesis` run holds a Leaf with a missing first-attempt raw **before any listen** (the guard fake's call count for that Leaf is zero), attaches the Leaves after it, prints the NOT ON DISK heading with each missing (slide, narrator) and no words, and exits 1; budget and speech failures still stop the whole run; a synthesising run holds nothing for this reason and prints what it will buy — each pinned through the command with fakes
- [ ] A1: a `NarrationNotOnDiskError` arising mid-Leaf is the same Leaf-local hold; `render_line`, `_render_attempt` and the typed error are unchanged for library callers
- [ ] A2: `--leaf` selects exactly the named Leaves; an unknown index and `--leaf` with `--limit` are refused before anything runs
- [ ] A3: the stale check reports Leaf 9's shape in the live version and in a draft, reports a clean Leaf as clean, **cannot construct any paid client or write** (exploding fakes, and a test that the command never reaches `SpeechClient`/`Guard`/the budget), refuses an anonymous key, and is **seen red against the drifted shape before it is trusted**
- [ ] A4: a partial run never overwrites a larger review and says where it wrote; a full run overwrites — both directions pinned
- [ ] A5: the not-on-disk message pin refuses any 12-character window of the text; my prefix-leak mutant goes red
- [ ] A6: README and docstrings match the code; a grep finds no "stops the run" for a missing clip
- [ ] Part A cost **$0**: the ledger's spend is identical before and after, and no model was called
- [ ] The gate passes with counts above 130 / 112 / 690; the five `NARRATION_TEMPO` places and `render_line`'s own default unchanged and still pinned; the greetings' two sha256 values (`c79a8725…`, `e598939f…`) identical before and after; `git diff origin/main` of `assets/speech.py`, `graph/greeting_nodes.py`, `assets/greeting.py`, `assets/audio.py` and `prompts/` empty
- [ ] Every new guard is in a mutation table in the report (breakage → tests red), restored byte for byte and hash-verified
- [ ] B0: the founder's three answers are quoted in the report, with the figures you gave them before the yes
- [ ] B1–B4: the stale check, the bulk run, Leaf 9's payoff and the whole-book pass each ran as written; the speech line moved **only** in B3 and only by the clips named; `raw/` gained exactly those files; the ledger total stays under $2.75
- [ ] B5: all 144 draft audio rows have served bytes equal to the rendered clips **and `textDigest` equal to the sha256 of their Leaf's current text**; the live Leaves are as before B2
- [ ] B6: the take-change table is in the report, Leaf 2 scenario Achernar included
- [ ] Every Leaf that is held or refused is named with its reason and nothing was written to it
- [ ] The report gives absolute paths, and every number in it was re-derived from the disk

**Testing expectations:** **Tier A** for A1 (no listen for a held Leaf; the exit code; the run carrying on), A3 (cannot spend; red against the real drift shape) and A4 — these are the shape of bug that ships quietly, and the stale check in particular must not be a thing that is green because it is blind. Tier B for the option plumbing and the docs. Say which evidence is a unit test, which is a mutation, which is a read-back from the CMS, and which is the founder's ear. No live-model test; the guard is the existing fake everywhere but Part B.

---

### Handoff: 2026-09-25 — VO-4: speed up the book narration with a proportional time-stretch of the clips already on disk

*Pipeline Manager. Approved by the founder 2026-09-25 ("let's not take any audition, just increase words per minute proportionately for the book clips"). **The only money in it is Google Cloud** — the guard listening to the new clips, **expected ≈ $0.41** — under a ceiling **the founder confirms to you in your session before that step**. **No speech is synthesised.***

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Check your branch first** — the worktree is on `onboard-2-1-fence-and-cap` (PR #62, merged as `6c5d8fd`); leave that branch alone. `git fetch origin && git checkout -b vo-4-narration-tempo origin/main`. **Never `git checkout main` in a linked worktree.** **`runs/` is git-ignored and holds everything already paid for: never clean, prune, move or overwrite a file under `runs/ikigai/audio/raw/`, `final/` or `checks/`.** Commit, push and open the PR yourself when done.
> **Read:** this handoff · `project/LEGAL.md`, the whole "Narration" section (the fence does not change) · `apps/pipeline/src/zoomout_pipeline/graph/narration_nodes.py`, the whole file · `assets/audio.py` (`level`, `shape_edges`, `EdgeReport`, `measure`, `ClipMetrics`) · `assets/narration_guard.py` (`speaking_rate`, `pace_is_natural`, the 100–330 band) · `assets/review_track.py` (what reads the edge report) · `cli.py`'s `narrate` command and `_Narration` · `tests/test_attempt_defaults.py` (how a default is pinned everywhere it is stated), `tests/test_narration_write.py`, `tests/narration_fakes.py` · `graph/greeting_nodes.py`'s module note (why its render is a *sibling* of `_render_attempt`; you will not touch it) · `apps/pipeline/README.md`, `narrate`'s section · ONBOARD-2.1's completion entry (merge `6c5d8fd`; in `project/collaboration-log.md`) for the fence and the `$0` discipline · VO-2.1's completion in `project/archive/collaboration-log-voiceover.md` (the first live attach: 144 = 18 Leaves × 4 slides × 2 narrators, ledger closed at $1.8230) · `agents/pipeline-manager.md`.

### Task: VO-4 — speed up the book narration with a proportional time-stretch of the clips already on disk
**Suggested model:** Sonnet — the design is here and the bar is objective: every measure below is compared against the clips already accepted. The risk is a stretch that passes its numbers and sounds processed, and that is answered by a table against real clips and the founder's ear on before/after pairs, **not by tuning until the numbers pass**. If a sound implementation fails the real-clip table, that is a finding: stop and report it.
**Context:** At the device gate on 2026-09-25 the founder said the book narration is "too slow and boring" next to the narrator hellos, which ONBOARD-2 re-paced, and asked for the same faster pace on every book clip. They then ruled out an audition and a re-render: *"just increase words per minute proportionately … it should be fine as long as the pace is increasing."* So this is DSP on audio we already own, not new synthesis.
- **What the numbers say** (read-only, 2026-09-25: the 144 accepted clips decoded from `runs/ikigai/audio/final/`, words over **speech time only**, joined by content hash to the guard's cached transcripts): **median 160 words a minute** — Lara 157, Druv 163; by slide, takeaway 135, summary 159, payoff 160, scenario 176; range 108–215; median clip 21.8 s, longest 43.7 s, longest pause median 0.77 s. **The cue sheet's Pace column reads about 120 for the same clips: that is a different measure, pauses included.** The two hellos, measured the same way: **243 (Lara) and 260 (Druv)** speech-only — 14 words each, which ONBOARD-2 itself called a poor measure at that length — and ≈ 180 overall with pauses. **So the hellos run about 1.5× the lessons, on either measure.**
- **Why the lessons are slow:** `narration_direction.md` says "natural and unhurried" and, for two slide types, "a little slowly" and "a little more slowly"; ONBOARD-2 measured that such wording buys long pauses as well as a slower voice.
- **Why a stretch, and what it cannot do.** A constant time-stretch of the model's audio, pitch preserved, raises every clip's words a minute in proportion, so the differences the direction file sets between slides (takeaways slowest) are kept — which is what "proportionately" asks. **It scales the pauses too:** a 0.8 s dwell becomes 0.6 s at 1.3×. That lifts the *overall* pace as much as the speech rate, but it does not thin out long pauses the way ONBOARD-2's re-render did. If the founder still finds it slow after listening, the next levers are a larger factor (it is one constant) or a direction re-render (≈ $1.5, **not** in this package).
- **Why 1.3×.** It is +30%: the median goes from 160 to about 208 words a minute of speech and from about 120 to about 156 overall — audiobook pace — and the fastest clip goes from 215 to about 280, inside the pace band's 330. Matching the hellos would take about 1.5×, which puts the fastest clip at about 323 against that band and is where a stretch starts to sound processed. **It is a constant and a founder's-ear decision:** ONBOARD-2's lesson stands, that the numbers were a poor guide to what "slightly faster" meant and the founder's ear settled it.

**Objective:** The Ikigai narration — all 144 clips — attached as **drafts** at **`NARRATION_TEMPO = 1.3`**, made by stretching the raw audio already on disk **without synthesising a single clip**, every clip listened to by the guard again on its new bytes; and the same default pace applies to every book narrated from now on.
**Scope:** `apps/pipeline` — `assets/audio.py` (the stretch), `graph/narration_nodes.py` (the constant, the render stage, the no-synthesis rule), `cli.py` (`narrate`'s options and header), `README.md`, and tests. **Not touched:** `assets/speech.py`, `graph/greeting_nodes.py`, `assets/greeting.py`, `prompts/`.
**Requirements:**

*Part 1 — the stretch (`assets/audio.py`).* `change_tempo(pcm, tempo) -> Pcm`, pure NumPy.
- **Pitch and timbre preserved; duration ÷ tempo.** Not resampling (that shifts pitch) and, I would expect, not a phase vocoder (it smears consonants). The standard answer for speech at this size of change is **WSOLA** — Hann-windowed frames of about 25–30 ms, a half-frame output hop, an input hop of tempo × that, each frame taken within about ±10 ms of nominal at the best normalised cross-correlation against the natural continuation of the last. **That is a hypothesis about the algorithm, not a specification of it.**
- **Deterministic:** a pure function of its input, so a re-run produces byte-identical clips, hence the same filenames, the same cached listens, and no second upload.
- **`tempo == 1.0` returns the input itself**, not a copy that went through the algorithm. The accepted range is 1.0 ≤ tempo ≤ 1.5; anything else raises `AudioError`.
- **No external binary and no new dependency.** `ffmpeg`, `sox` and `rubberband` are not installed and must not become requirements. If your own version cannot meet Part 5's table, **stop and report the numbers**: `audiotsm` (NumPy-only, MIT) is the candidate library, and adding a dependency is the founder's call.
- Speed: minutes for the whole set, not hours (144 clips of about 22 s at 24 kHz) — vectorise the search; do not loop per sample.
- **Tests on synthetic signals, none reading `runs/`:** (i) a sine keeps its frequency within 1% and its level within 1 dB, its length is `round(n / tempo)` within one hop, and it has no jump larger than its own slope allows (no clicks); (ii) tone–silence–tone: the silence shrinks by the tempo; (iii) a two-tone or chirp signal has no comb-filter dips (level per band within 3 dB); (iv) identity at 1.0, and the same bytes twice; (v) out-of-range refused.

*Part 2 — where it goes in the render, and three traps.* In `_render_attempt`, after the raw audio is read from cache (or, in a future run, just synthesised) and before it becomes an mp3. `tempo` is an explicit parameter of `_render_attempt`; **`render_line`'s own default stays 1.0**, so every existing caller and test behaves exactly as before; `narrate` passes its option. Three things the placement must keep true — **pin each with a test, and say in the report where you put the stage and why:**
1. **The clip that reaches `encode_mp3` has the same head pad (60 ms), tail silence (350 ms), speech loudness and peak ceiling as today, whatever the tempo.** `RenderedClip.words_per_minute` subtracts `HEAD_PAD_SECONDS` and `TAIL_SILENCE_SECONDS` as constants, and `level` sets a fixed loudness and keeps peaks under −2 dB. *A stretch after `shape_edges` scales the pads (60 → 46 ms, 350 → 269 ms) and breaks the first; a stretch that comes out a little louder or quieter needs `level` after it, not before.*
2. **The edge report keeps describing the model's own ending.** `EdgeReport` (`breath_cut`, `low_tail_seconds`, `ends_mid_sound`) is what the cue sheet flags for the founder's ear. Computed on stretched audio it would scale the timings — a 0.30 s breath becomes 0.23 s, slips under `MAX_DECAY_SECONDS`, and is no longer cut — and the stretch's own window taper on the last 20 ms could hide a clip the model cut off mid-sound. **The same raw gives the same `EdgeReport` at tempo 1.0 and at 1.3**, pinned.
3. **Nothing stretched is ever written to `raw/`.** `raw/` is what the model returned, keyed by what was asked; a stretched file there would be served to the next run as raw and stretched again. A test: a stretched render leaves every `raw/` file byte-identical and adds none. **And the stretch is applied once** — a duration ratio of 1/tempo, not 1/tempo².

*Part 3 — no synthesis.* A run over cached audio must be **unable** to buy a clip. `narrate --no-synthesis`, and the same keyword on `render_line` and `_render_attempt`: Cloud TTS is never called and `budget.reserve` is never reached for speech. **A first attempt that is not on disk** stops the run with a typed error naming the line. **A later attempt that is not on disk** ends that line's retries and keeps the best attempt so far, named — the same outcome as attempts exhausted, so a stretched clip the guard still fails **holds its Leaf** instead of causing a paid regeneration. **Tests through `render_line`, with a speech fake that raises if called:** a cached first attempt (works, no call); a missing first attempt (typed error, no call); a failing first attempt with a missing second (returns the first, flagged, no call); and the speech line of the ledger is $0 after a full pass. `--no-synthesis` forbids speech only — the guard's listens still happen, and cost.

*Part 4 — the option, and the default that stays put.* `narrate --tempo` (default `NARRATION_TEMPO = 1.3`, `min=1.0`, `max=1.5`), printed in `narrate`'s header beside the narrators (with `--no-synthesis` when it is on) and in each review's preamble ("time-stretched ×1.3"). **The default is stated in five places and pinned in each, the way `tests/test_attempt_defaults.py` pins the attempts:** the constant, the option's literal (the module imports lazily, so a literal, pinned to the constant), `narrate`'s docstring, the README, and the value `narrate` passes down. `render_line`'s own default of 1.0 is pinned too, **deliberately different**. `audition-voices` keeps its current behaviour (1.0) — say so in the report. Carry `tempo` on `RenderedClip` and into `AttachedLeaf.media[...]`, so the run's state records which clips are stretched.

*Part 5 — free checks before any spend.* Everything here runs at $0 on the clips already on disk:
1. **The regression: tempo 1.0 reproduces today's clips — proved two ways, and neither can spend.** (a) **A throwaway script with `guard=None`:** re-derive each of the 144 accepted lines from its cached raw at tempo 1.0 and compare the sha256 of the mp3 with the file in `runs/ikigai/audio/final/` — **144 of 144 equal**. (b) **The CLI, with the ceiling set to $1.83:** `ZOOMOUT_PIPELINE_MAX_NARRATION_USD=1.83 .venv/bin/zoomout-pipeline narrate --run-id ikigai --render-only --no-synthesis --tempo 1.0`. The ledger stands at $1.8230, so no listen (a $0.032 reservation) fits under $1.83: **a cache miss halts the run instead of buying a listen.** All 144 accepted clips have a cached listen under the current guard (`gemini-3.6-flash`, prompt digest `8f3e1d29`, verified 2026-09-25), and a listen is cached by the hash of the bytes heard, so the command must complete with **no HALT, the ledger's spend line unchanged to the cent, and every clip `(cached)`** (that word means its raw audio was on disk; the ledger is what proves no listen was bought). **If either fails, your stage changed the bytes at 1.0: stop, and do not spend.** Copy `runs/ikigai/audio/review/` to `review-before-vo4/` first: (b) rewrites it, with the same content if you are right. *Any `narrate` needs Payload on `:3001` up — it reads the Leaves through REST even with `--render-only` — and the environment variables `apps/pipeline/README.md` lists (`ZOOMOUT_PIPELINE_DATABASE_URL`, `ZOOMOUT_PIPELINE_USE_VERTEX=true`, `ZOOMOUT_PIPELINE_VERTEX_PROJECT=zoomout-vertex`); the founder's pre-flight in `project/GETTING_STARTED.md` checks the port. If Payload is down, say so.*
2. **The stretch itself, on the real clips, against the accepted ones** — all 144, through the same render path, from a throwaway script that calls `_render_attempt` with `guard=None` and `no_synthesis=True` (the CLI would listen; these numbers need no listen): duration ratio = 1/tempo ± 0.5% · `pitch_median_hz` within ±2% and `pitch_spread_semitones` within ±0.3 · `articulation_wpm` ratio = tempo ± 3% · `speech_db` and `peak_db` equal to the old clip's · `voiced_fraction` within ±0.03 · `longest_pause_seconds` scaled by 1/tempo ± 0.1 s · **the fastest clip's `articulation_wpm` under the 330 band** (about 280 expected). **A clip outside a tolerance: stop and report the table; do not tune to pass it, and do not widen the band.** Give min / median / max per measure in the report.
3. **The greetings are untouched:** `sha256` of `runs/greetings/audio/final/narrator-greeting-female.mp3` is `c79a872587806a367a6f0513fc6cfd84d53a9fc999c7aaa9dd6f9642bacd3eb7` and of `narrator-greeting-male.mp3` is `e598939f6854e8667bdf44c97750db51f73216c2ff8fb8401ec9141ecb16e6a7` — **before and after your work** — and `git diff origin/main -- apps/pipeline/src/zoomout_pipeline/graph/greeting_nodes.py apps/pipeline/src/zoomout_pipeline/assets/greeting.py apps/pipeline/src/zoomout_pipeline/assets/speech.py apps/pipeline/src/zoomout_pipeline/prompts` is empty. **`prompts/narration_direction.md` is part of every raw clip's cache key: any edit re-buys the whole book.**

*Part 6 — the one paid step: the guard listens to the new clips.*
- **What is bought:** guard listens on the stretched bytes (`gemini-3.6-flash`) and **nothing else**. A full cached walk of the 144 accepted lines is **153 listens** (144, plus 9 earlier attempts on the 7 lines that needed a second or third try). The 191 listens cached on disk cost **$0.5104** at the ledger's own rates, a mean of **$0.0027**, so **expected ≈ $0.41** (a shorter clip is not dearer to listen to, so this is if anything high).
- **Ceiling: $2.75 cumulative, on the Ikigai narration ledger. Google Cloud, not Anthropic.** The ledger stands at **$1.8230** of a default $3.00. `NarrationBudget` refuses a call whose worst case would cross the ceiling — **$0.032 for a listen, reserved before the call** — so **the real headroom is about $0.90**, about twice the expected spend. **One full pass fits and a second pass at another tempo fits; a third does not.** Set it inline, never in `.env` (`narrate` has no ceiling flag; the variable is `ZOOMOUT_PIPELINE_MAX_NARRATION_USD`): `ZOOMOUT_PIPELINE_MAX_NARRATION_USD=2.75 .venv/bin/zoomout-pipeline narrate …`, and check that the `budget` line in the command's header shows $2.75. **The founder's `.env` is permission-blocked — ask them to paste a line if you need one; do not add a duplicate key.**
- **Before the paid step, tell the founder in chat the ledger's spend, the ceiling, the expected cost and the real headroom, and wait for a yes. This handoff is not that yes.** A rate mentioned while the run is going is a status update, not a question. **If the run halts on the ceiling, stop and report: raising it is the founder's decision.** **One `narrate` process at a time** — the ledger has no lock (a register row), and two processes on one run race on it.
- **Leaf 0 first:** `narrate --run-id ikigai --no-synthesis --tempo 1.3 --limit 1` (8 clips, about $0.02, and it attaches that Leaf's draft). Check its listens, its severities, and its REST state; then the rest: the same command without `--limit` (Leaf 0 reports "draft already held this audio").

*Part 7 — attach as drafts, verify from outside, report.* `narrate`'s existing flow: both narrators × four slides, all passing, then one draft write per Leaf, then its own re-fetch. **It never publishes** — the founder does, in admin. Beyond that:
- A Leaf `attach_leaf_narration` refuses (unpublished changes) or holds (a clip still fails) is **named with its reason**, and nothing is written to it. A held Leaf keeps its current audio; say which Leaves would then be at the old pace.
- **Your own REST re-fetch of every attached Leaf**, not the command's verdict: the draft's audio URLs serve bytes whose sha256 equals the clip's, and the live version's audio URLs and durations are exactly as before the run. **Record each Leaf's live audio (URLs and durations) by REST before the paid step** and compare after; do not lean on the numbered files in `runs/ikigai/audio/snapshots/`, which every run adds to, the idempotence run included.
- **A second run at the same tempo spends $0, uploads 0, and prints "draft already held this audio" for all 18** — the proof of determinism and idempotence.
- The old Media stays as orphans (the machine key cannot delete Media): count them and say so.

**Out of scope:**
- Any re-render, any audition, any direction change. **`prompts/narration_direction.md` stays byte-identical.**
- The greetings, the fence (`assets/speech.py`), the guard prompt, and the pace band (`MIN_NATURAL_WPM`, `MAX_NATURAL_WPM`).
- The cost-ledger lock (register row, still open); a second book's narration; any mobile change (an in-app speed control is a separate, later idea); publishing; deleting Media.

**Constraints:**
- **The legal fence stands.** The stretch touches audio only; no text reaches any voice by a new path, and `SpeechClient` is not modified.
- **Spend:** Part 6, exactly. No other paid call — no synthesis of any kind, no `audition-voices`, no `generate-greetings`.
- **The fixes named here are hypotheses** — the algorithm, the stage's placement, the shape of `--no-synthesis`, the tolerances. Verify each against the code and the real clips first; if the code says otherwise, say so and why rather than implementing silently.
- **Explicit, typed errors** — `AudioError` for a bad tempo; a typed error for the missing-cache case; nothing fails silently. Structured logging where the render already logs.
- **Mutation discipline:** each new pin is broken on purpose, watched red, and restored byte for byte — a stretch after `shape_edges`; a stretch applied twice; a stretched file written to `raw/`; a path under `--no-synthesis` that reaches `synthesize`; a default changed in one of the five places.
- **Gates run the configured target, not a subset.** From `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline`: `.venv/bin/ruff format --check . && .venv/bin/ruff check . && .venv/bin/mypy && .venv/bin/pytest` (`uv` is not on PATH; the `.venv` tools run directly; `pytest` needs the `zoomout-pipeline-postgres` container on `127.0.0.1:5433`). Baseline from ONBOARD-2.1's report: **`ruff format` 125 files, `mypy` 107 files, `pytest` 573 passed** (6 `live` deselected) — reconcile any drop.
- Stage specific paths (`git diff --cached --name-only`); never `git add .`; never commit to `main`.

**Device gate:** *(The founder's ear, at the Mac. No phone: nothing reaches a reader until the founder publishes. **Give every path absolute and in `ZO-pipeline`, not `ZO`** — the founder browses `ZO`, where these runs are not.)*
- **You produce** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/vo4-before-after/`: **one Leaf's eight clips** (both narrators, four slides) **and the set's single slowest and single fastest clip**, each as a `before` and an `after` named so a pair sorts together, plus a README table of the measured numbers per pair (speech wpm, overall wpm, longest pause; before → after). **Choose the Leaf by the numbers, not by taste, and say why:** the one whose scenario clip has the longest pause — the clearest test of "pauses shrink too". Copy, do not move. Also point at the regenerated review tracks and pages, by absolute path: `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/ikigai-narration-achernar.html` and `…-sadaltager.html` (each with its `.mp3` beside it — about 28 minutes a narrator, so this is for reference, not for the founder to sit through).
- **The founder listens for, and tells you:**
  - **Faster, and by how much it feels** — "clearly faster, not rushed" is the target. Do the pauses feel shorter?
  - **An artefact:** a warble or "underwater" sound, a doubled or stuttered syllable, a clipped consonant, a word that sounds different. Name the clip.
  - **The takeaways:** do they still come to rest?
- The founder's answer decides: publish the 18 drafts in admin; or ask for another factor (one more paid pass, and a new yes); or stop. **Nothing can prove the sound; do not claim it.**

**Acceptance criteria:**
- [ ] `change_tempo`: pitch preserved (±1% on a sine), length ÷ tempo, deterministic, identity at 1.0, refuses outside 1.0–1.5, no clicks, no comb dips — on synthetic signals, none reading `runs/`
- [ ] Part 2's three traps each pinned by a test: pads, loudness and peak at any tempo; the same `EdgeReport` at 1.0 and 1.3; `raw/` never written by a stretched render, and the stretch applied once
- [ ] `--no-synthesis`: the speech fake is never called in any of Part 3's cases, and a full pass's ledger shows $0 of speech
- [ ] `NARRATION_TEMPO` = 1.3 pinned in all five places; `render_line`'s default 1.0 pinned; `audition-voices` unchanged; `tempo` recorded on the clip and in the run's `cms_narration`
- [ ] **The regression:** at tempo 1.0 all 144 clips re-derive byte for byte equal to `final/` (script), and the CLI run under the $1.83 ceiling completes with no halt, the ledger unchanged and every clip `(cached)`
- [ ] The real-clip table: all 144 within Part 5.2's tolerances, min / median / max per measure reported and the fastest clip under 330 — **or the work stopped there and the table is the report**
- [ ] The greetings' two sha256 values identical before and after; `git diff origin/main` of `graph/greeting_nodes.py`, `assets/greeting.py`, `assets/speech.py` and `prompts/` empty
- [ ] Before the paid step the founder was told the ledger, the ceiling, the expected cost and the real headroom, and said yes; the header showed $2.75; **spend reported as this run's delta and the ledger's total**, against the ≈ $0.41 expected; the run was Leaf 0 first
- [ ] All 18 Leaves: 144 clips passed the guard on the stretched bytes and were attached as drafts — **or** each held or refused Leaf is named with its clip, its words a minute, its findings, and nothing was written to it
- [ ] Your own REST re-fetch: every attached draft's audio serves the clip's bytes (sha256), and the live Leaves' audio is exactly as before the run
- [ ] A second run at the same tempo: $0, 0 uploads, "draft already held this audio" for every attached Leaf
- [ ] The before/after folder exists at the absolute path above, and the report says what the founder should listen for
- [ ] The gate passes with counts against 125 / 107 / 573; existing tests modified only by additions (each exception named); `git diff --stat origin/main` limited to `assets/audio.py`, `graph/narration_nodes.py`, `cli.py`, `README.md`, tests and your completion entry
- [ ] Every new guard is in a mutation table in the report (breakage → the tests that went red), each restored byte for byte

**Testing expectations:** **Tier A** for the stretch's properties, the three traps, the no-synthesis rule and the five pinned defaults — these are the shape of bug that ships quietly (a stretch that is right on a sine and wrong on speech is caught by the real-clip table, not by the sine). Tier B for the option plumbing. **Say which evidence is a unit test, which is the real-clip table, which is a mutation, and which is the founder's ear.** No live-model test and no test that reaches a paid endpoint; the guard is the existing fake everywhere but the one paid step.

---

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

### Completed: VO-4.1 — the book is finished: all 18 Leaves wait as drafts at ×1.3, every `textDigest` matching its own text, and Leaf 9's payoff is narrated fresh; Part B cost $0.2155 — 2026-10-03

*Pipeline Manager. Branch `vo-4-1-finish-the-book`, worked in `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`, off `origin/main` at `9997b14` (PR #64's merge). PR: [#65](https://github.com/ayush237/ProjectZoomOut/pull/65) — the founder merges. Part A was built on 2026-10-02. Part B ran on the night of 2026-10-02 → 03: the free checks, then the two paid runs (B2 23:48–00:13, B3 00:15–00:20), then the free whole-book pass and the verification.*

**Every acceptance criterion is verified, Part B cost $0.2155, and nothing is published.** All 18 Leaves now wait as **pending drafts**: 144 audio rows, each serving the exact bytes in `final/` and carrying the digest of its own Leaf's *current* text — read back by REST (B5) and again by the new `narration-stale` command. Leaf 9's payoff was narrated fresh from the text it holds now (the founder's "keep the edit"), and both voices passed the guard on the first attempt. **What is not verified is the sound.** The guard read the whole book at 136 exact, 8 minor, 0 major of 144 clips, and it is a noisy listener (B6 has a case); whether ×1.3 is clearly faster *and not rushed* is the founder's ear (device gate, below). Publishing the 18 drafts in the admin is what gives Leaf 9's payoff its sound back — it has been silent since 2026-09-18.

| | |
|---|---|
| Part A | A1 a drifted Leaf is held on its own · A2 `narrate --leaf N` · A3 `narration-stale` (free, read-only, its own command) · A4 a partial run cannot shrink a review · A5 the not-on-disk pin refuses any 12-character window · A6 README and docstrings match the code |
| Part B | **B1** the stale check named exactly Leaf 9's payoff, both voices, live · **B2** Leaves 10–17 attached (64 clips, 69 listens), Leaf 9 held NOT ON DISK, exit 1 as written · **B3** Leaf 9's two payoff clips synthesised, both exact on the first attempt · **B4** whole-book pass: 18 of 18 already held, $0, exit 0, reviews rebuilt at 72 clips a voice — **22:57** Achernar and **23:26** Sadaltager, from 29:11 and 29:52 at 1.0× · **B5** 144 of 144 bytes and 144 of 144 `textDigest`, live Leaves untouched · **B6** one take differs from the one VO-2.1 accepted (Leaf 2 scenario, Achernar); two lines are new words (Leaf 9's payoffs) · **B7** below |
| Gate | After Part A, **re-run after Part B** (Part B changed no tracked file; `git status` clean): `ruff format --check` **133** files (baseline 130) · `ruff check` clean · `mypy` strict **115** (baseline 112) · `pytest` **750 passed** (baseline 690, **+60** = 39 in `test_narrate_hold.py` + 21 in `test_narration_stale.py`), 6 deselected as `live`. Run **without** the Vertex variables, as the handoff says (none was exported) |
| Spend | Part A **$0, no model called.** **Part B $0.2155:** speech **+$0.0123** (the two payoff clips), guard **+$0.2032** (75 listens: B2 69 for $0.1884, B3 6 for $0.0148). Narration total **$2.0167 → $2.2322 of the $2.75 ceiling**, headroom **$0.5178**; the ceiling was never near. The handoff expected ≈ $0.24 and ≈ $2.26 |
| Left alone | After Part A and again after Part B: the six `review-before-vo4/` files (below) identical · the greetings' sha256 `c79a8725…` and `e598939f…` identical · `git diff origin/main` of `assets/speech.py`, `graph/greeting_nodes.py`, `assets/greeting.py`, `assets/audio.py` and `prompts/` is empty, and nothing outside `apps/pipeline` (and this entry) changed. **`raw/` gained exactly the four files of the two clips B3 synthesised; the other 374 are byte-identical** (Part B, below) |
| Mutation-checked | **56 breakages, 56 red, none survived** (A1 17, A2 6, A3 18, A4 11, A5 1, A6 3); every file restored and hash-verified after every run. Table below |
| Existing tests | **Two modified, both named below, and one helper added** (`git diff --numstat origin/main`: `test_narrate_cli.py` +19 −10, `test_no_synthesis.py` +6 −2, `narration_fakes.py` +16 −0). Everything else is new |

**`review-before-vo4/` — the only copy of the full-book 1.0× tracks, hashed before and after Part A (identical):**

| File | sha256 |
|---|---|
| `ikigai-narration-achernar.html` | `9e355970db089f4b435d9f2cbd6bf9d37fcc50359708220051689474515f6c9c` |
| `ikigai-narration-achernar.md` | `936600b7693b2626b94bc08ecfcf380e9f5ad3f16908c6966efa54fce8089696` |
| `ikigai-narration-achernar.mp3` | `379a66183c7d5adf76c3391a24534dc05b289c89eb25728b17d57a53641844ec` |
| `ikigai-narration-sadaltager.html` | `a3c7b628d73434343a6e9d96f9949950a82b3fde00f7e7e97fb0bf5991fb0b22` |
| `ikigai-narration-sadaltager.md` | `a8e58fafe2e4b1436cc5c1e57c3f64443462b8e1b33bbd5a8fe208f17fbb3974` |
| `ikigai-narration-sadaltager.mp3` | `1011a56e568897e30f025737a6b5866ceb8a4834c3c6c1a13405c8f71c88223b` |

---

## What the founder would notice

- **Nothing in the app yet.** Nothing is published: the 18 Leaves' new audio waits in pending drafts, and the published book is exactly as it was (every live Leaf's `updatedAt` and audio rows re-read and unchanged).
- **After they publish:** the book's narration plays about **21% shorter** (the full-book review tracks go 29:11 → 22:57 in Achernar and 29:52 → 23:26 in Sadaltager) in the same two voices; and **Leaf 9's payoff has a play control in both voices again** — the thing missing since 2026-09-18. Every other slide is the same words in the same take VO-2.1 accepted, sped up, except one: the Leaf 2 scenario in Achernar (B6).
- **For whoever runs `narrate` next:** a Leaf whose text was edited is named and skipped instead of stopping the run; `narrate --leaf N` does just those Leaves; `narration-stale` lists every silent slide in one read-only command; a partial run writes its review beside a fuller one instead of replacing it.

## Needs the founder

1. **Listen** — the device gate, next section. You confirmed ×1.3 (B0). Leaves 10–17 have not been heard at ×1.3 by anyone, and Leaf 9's new payoff has not been heard at all.
2. **Publish the 18 drafts in the admin.** That is the step that makes any of this audible, and it is what fixes Leaf 9's payoff. Publishing leaves the 144 old Media documents referenced by nothing (B7); the machine key cannot delete Media, so they stay until someone removes them.
3. **Merge [#65](https://github.com/ayush237/ProjectZoomOut/pull/65)** (the code and this entry). Merging changes no audio.

## Device gate — for the founder's ear

*Every path is absolute and in `ZO-pipeline`, not `ZO`. Open the `.html` — the cue sheet is at the top and the audio is embedded; the `.mp3` is the same track.*

- `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/ikigai-narration-achernar.html` — Lara, **72 clips, 22:57 in total**
- `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/ikigai-narration-sadaltager.html` — Druv, **72 clips, 23:26 in total**

Cue-sheet times (positions in each narrator's track):

| Where | Achernar | Sadaltager |
|---|---|---|
| **Leaf 9 payoff — new, narrated from the text you kept** (B3) | **11:59** (18.4 s) | **12:12** (19.2 s) |
| Leaf 9 as a run, to hear the payoff beside its neighbours: summary → scenario → payoff → takeaway | 11:19 → 11:43 → 11:59 → 12:18 | 11:31 → 11:54 → 12:12 → 12:32 |
| **Leaf 2 scenario — the one take that differs from the one you approved** (B6) | **02:44** (9.5 s) | 02:47 (same take as before) |
| Fastest clips, for "clearly faster, not rushed" (the cue sheet's overall pace, pauses in) | Leaf 10 payoff **13:03**, 217 wpm (typical payoff 161) · Leaf 0 summary 00:00, 188 | Leaf 14 scenario **18:09**, 204 wpm (typical 170) · Leaf 10 payoff 13:16, 197 |
| Flagged by the cue sheet for its ending | — | Leaf 7 payoff **09:30**: "the model's audio ended mid-sound — the last syllable may be clipped". **Not new**: the 1.0× sheet flagged the same clip at 12:06, and the stretch keeps the model's own edges |

**What to listen for:** clearly faster, not rushed; shorter pauses between sentences; any warble, doubled syllable or clipped consonant — the guard flagged none (0 major of 144), but it transcribes what it hears and is not a judge of artefacts, so name any clip you catch; takeaways that still come to rest; and that Leaf 9's new payoff sounds like the Leaves around it. The 8 clips the guard read as *minor* are one- and two-word differences, none of them a missing sentence — Leaf 5 payoff (both voices), Leaf 7 takeaway and Leaf 12 payoff and Leaf 13 summary (Achernar), Leaf 9 scenario, Leaf 11 scenario and Leaf 16 summary (Sadaltager): "apprentice" heard as "apprentices", "you have" as "you've", "antifragility" as "anti fragility".

**Beside them, superseded, not deleted.** B2 and B3 each wrote a partial review next to the full one, as A4 says a partial run must: `ikigai-narration-{achernar,sadaltager}-leaves-0-8+10-17.{html,mp3,md}` (68 clips) and `…-leaves-9.{html,mp3,md}` (4 clips). The full tracks above cover all of it; the founder can delete those twelve files, and I did not. `review-before-vo4/` (the only 1.0× copy) and `review/vo4-before-after/` are untouched.

**After publishing, in the app:** Leaf 9's payoff slide has a play control in both voices. That check is the founder's.

## B0 — the founder's answers

1. **Tempo:** "1.3x is fine." (Quoted from the session; `NARRATION_TEMPO` stays 1.3, so the nine attached Leaves stand.)
2. **Leaf 9's text:** "I want to keep the edit in leaf 9." (So Leaf 9's payoff is narrated fresh from the text it holds now; B3. I did not touch the Leaf.)
3. **The money:** asked in the session with the figures below, and answered **"Yes — all of Part B, up to $2.75"** (2026-10-02), the option whose description named the speech: Leaves 10–17 listened to, Leaf 9's two payoff clips synthesised and listened to. The figures given with the question, all derived from the raw cache through the real key (`clip_key`) and the ledger's own rates, not typed in:
   - **B2, guard only, Leaves 10–17:** 64 clips; the most it can buy is **69 listens** (every reachable attempt, the retry chains on Leaf 12's scenario and Leaf 14's summary included), at the **$0.0025** each that VO-4's 77 listens cost: **$0.161–$0.174**. *The handoff estimated "≈ 77 listens, ≈ $0.21"; the raw cache says 69 at most.*
   - **B3, Leaf 9's payoff:** speech for two ~30 s clips **$0.0152** (worst case six, three attempts in each voice: **$0.0457**), plus **6–10** listens (**$0.015–$0.025**).
   - **Total** ≈ **$0.20** expected, **≈ $0.25** worst, taking the ledger to **≈ $2.21–$2.27** of the **$2.75** ceiling. `NarrationBudget` reserves a call's worst case *before* making it (**$0.164** for a speech call, **$0.032** for a listen), so the run cannot cross the ceiling: it halts instead, and raising it is the founder's decision.
   - **What it actually cost (B7):** B2 **$0.1884** — *above* the $0.161–$0.174 I gave, which is a miss of mine (below) — and B3 **$0.0271** (speech $0.0123, listens $0.0148): **$0.2155** together, inside the "≈ $0.20 expected, ≈ $0.25 worst" the founder was shown.

---

## Part A, item by item — what was built, and where the handoff's shapes were hypotheses

**A1 — a Leaf whose audio is not on disk is held on its own.** `missing_first_attempts` (`graph/narration_nodes.py`) runs `clip_key` over each Leaf's *current* text and `stat`s the raw cache: free, in render order. `clip_key` is now the **only** place the cache's key is built, and `_render_attempt` calls it too, so the pre-flight cannot ask a different question from the render: the VO-4 handoff's mistake was a check by `(leaf, slide, voice)`, which passes exactly when the text has drifted (mutation H2 *is* that mistake, and goes red in six tests). In `narrate`, a `--no-synthesis` run checks before rendering or listening to anything for a Leaf; a Leaf with any clip missing is **held NOT ON DISK**, named by slide and narrator and never by words, and the run **carries on**. The end of the run gives these Leaves their own heading with the usual cause ("the Leaf's text changed after it was narrated") and both ways out (`narrate --leaf N` without `--no-synthesis`, or revert the text). **Exit 1 if any Leaf was held for any reason; only a budget or a speech failure stops the whole run** (each pinned through the command). A `NarrationNotOnDiskError` arising mid-Leaf is the same hold: its clips are discarded, never attached — and its heading says so honestly: *"found while rendering: its earlier clips were already listened to, and that is on the ledger"*, because unlike the pre-flight hold it has already spent a little. **A run that may synthesise holds nothing and prints what it will buy** (`will buy   : 2 clips — leaf 9 payoff (female, Achernar), …`), before the first call. `render_line`, `_render_attempt` and the typed error are unchanged for library callers: after the key refactor **all 144 clips at the model's pace re-derive byte for byte at tempo 1.0, and all 72 of VO-4's at 1.3** (script, guard off, synthesis impossible, $0).

**A2 — `narrate --leaf N`.** Repeatable, by `orderIndex`; Leaves are done in order whatever order they are named, and a repeat is one Leaf. An unknown index is refused before anything runs (exit 2, nothing rendered, listened to, written or spent), and `--leaf` with `--limit` is refused before the session is even built. The header says which Leaves it will do.

**A3 — `narration-stale --run-id`.** A command of its own, so the code that can spend is **never constructed**: pinned by exploding fakes (speech client, guard, budget and `_Narration` fail if built; the CMS refuses every write; the run's checkpoint refuses an update) **and** by a scan of the command's own source — and mutations C1a and C1b show the two pins are independently necessary (a dynamic construction only the fakes see; a named-but-never-run one only the scan sees). It reads the run through `read_run_state`, checks who the key is first (`_checked_cms`; an anonymous 200 shows no drafts), reads each Leaf's published version and latest draft, and prints every entry the backend would drop: Leaf, slide, narrator, version, eight hex of the stored and current digest, then the count of slides and Leaves and an exit code. It prints **how many entries it compared**, so a check that looked at nothing cannot read as clean. **Seen red against Leaf 9's actual shape before it was trusted**: the fixture is built from the two real sentences and the test asserts the digests the CMS showed (`13c9a963…` stored, `66262e04…` current).

**A4 — a partial run cannot shrink a review.** `review_target` overwrites an existing review only when the run covers **every Leaf it was asked for and at least as many clips**; otherwise it writes beside it as `<book>-narration-<voice>-leaves-0-8+10-17` (a name that carries the coverage), says **BESIDE** in the output, puts "Partial: Leaves … only" in the cue sheet, and leaves the existing one byte-identical. No existing review: the standard name. An existing review whose size cannot be read is never overwritten. Tested both ways through the command, and as a truth table.

**A5 — the pin.** `leaked_window` refuses any 12-character window of a line's text in the not-on-disk message. **Shown to be needed, not just asserted:** against the Architect's prefix-leak mutant (P1) the old whole-text assertion *passes* and the new one names the leaked window (`'You are buil'`). **A6 —** no README line, help text or source comment says a missing clip "stops the run" (a scan that also goes red on the old sentence: D1, D2), and the README documents `--leaf`, `narration-stale`, the hold and the review rule.

**Where I departed from the handoff's hypotheses, and why.** (1) A3 said to reuse `_Narration`'s `whoami` check; `_Narration` builds the speech client, the budget and the guard, which the stale check must never build, so the identity and Track check was **extracted** into `_checked_cms` and both use it (`_Narration`'s behaviour is unchanged). (2) The review-naming rule and the pre-flight live in `narration_nodes.py`, not a new module; only the stale check got one (`graph/narration_stale.py`), as the handoff allowed. (3) **B2's figure:** the handoff says "≈ 77 listens, ≈ $0.21"; computed from the raw cache through the real key, the most B2 can buy is **69** (above).

## The existing tests that changed (each named)

- **`test_narrate_cli.py::test_a_clip_that_is_not_on_disk_stops_the_run_cleanly_and_names_the_line` — rewritten** as `…holds_its_leaf_cleanly_and_names_it`. It pinned exactly the behaviour A1 reverses (`HALTED`, "stops the run"), so it could not stay; it now pins the hold, the exit code, the slide and narrator names, that `HALTED` is absent, and that no 12-character window of the Leaf's text is printed. The module docstring and one import changed with it.
- **`test_no_synthesis.py::test_a_first_attempt_that_is_not_on_disk_is_a_typed_error_naming_the_line` — one assertion strengthened (A5):** whole-text → any 12-character window. One import added.
- **`narration_fakes.py` — `leaked_window` added** (a helper, nothing existing touched).

## Mutation table — 56 breakages, 56 red

Each breakage is a set of exact-match edits that must match exactly once, applied in place by a scratch harness (not kept in the repo), the relevant test files run in the foreground, then the files restored in a `finally` and **verified byte-identical by hash**; `git status` was clean after every batch, and the four mutable files hash identically before the first run and after the last. Test sets: the **hold/review** items ran `test_narrate_hold`, `test_narrate_cli`, `test_no_synthesis`; the **stale** items ran `test_narration_stale`, `test_paid_tier`, `test_tempo_defaults`, `test_narrate_cli`. "Red" is the count of failing tests; the three named are the first three, in pytest's order (the full lists are saved with the harness's results).

| # | Item | Breakage | Red | First tests red |
|---|---|---|---|---|
| H1 | A1 | The pre-flight is never consulted | 4 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on`; hold `two_drifted_leaves_are_each_held_and_the_rest_attach`; hold `render_only_holds_a_drifted_leaf_too_and_writes_nothing` (+1 more) |
| H2 | A1 | The pre-flight checks by (leaf, slide, voice) - the VO-4 handoff's proxy key | 6 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on`; hold `two_drifted_leaves_are_each_held_and_the_rest_attach`; hold `render_only_holds_a_drifted_leaf_too_and_writes_nothing` (+3 more) |
| H3 | A1 | A held Leaf falls through to the render (no continue) | 3 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on`; hold `two_drifted_leaves_are_each_held_and_the_rest_attach`; hold `render_only_holds_a_drifted_leaf_too_and_writes_nothing` |
| H4 | A1 | A held Leaf breaks the loop instead of continuing | 4 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on`; hold `two_drifted_leaves_are_each_held_and_the_rest_attach`; hold `render_only_holds_a_drifted_leaf_too_and_writes_nothing` (+1 more) |
| H5 | A1 | The exit code ignores a Leaf held NOT ON DISK | 6 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on`; hold `two_drifted_leaves_are_each_held_and_the_rest_attach`; hold `render_only_holds_a_drifted_leaf_too_and_writes_nothing` (+3 more) |
| H6 | A1 | A NarrationNotOnDiskError stops the whole run again (the old behaviour) | 1 | hold `not_on_disk_error_arising_mid_leaf_is_the_same_hold` |
| H7 | A1 | A run that may synthesise holds a Leaf for a missing clip too | 2 | hold `speech_failure_still_stops_the_whole_run`; hold `run_that_may_synthesise_holds_nothing_and_says_what_it_will_buy` |
| H8 | A1 | The 'will buy' preview is gone | 2 | hold `run_that_may_synthesise_holds_nothing_and_says_what_it_will_buy`; hold `run_with_everything_on_disk_says_it_will_buy_nothing` |
| H9 | A1 | The held line quotes thirty characters of a Leaf's words | 2 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on`; cli `clip_that_is_not_on_disk_holds_its_leaf_cleanly_and_names_it` |
| H10 | A1 | The end heading drops the 'narrate --leaf N' way out | 2 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on`; hold `two_drifted_leaves_are_each_held_and_the_rest_attach` |
| H11 | A1 | A budget failure no longer stops the run (it propagates) | 1 | hold `budget_failure_still_stops_the_whole_run` |
| H12 | A1 | A budget or speech failure holds the Leaf and carries on instead of stopping | 1 | hold `speech_failure_still_stops_the_whole_run` |
| N1 | A1 | A hold found mid-Leaf is not marked as such | 1 | hold `not_on_disk_error_arising_mid_leaf_is_the_same_hold` |
| N2 | A1 | A pre-flight hold claims it was found while rendering | 1 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on` |
| K1 | A1 | The pre-flight looks at the second attempt, not the first | 18 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on`; hold `two_drifted_leaves_are_each_held_and_the_rest_attach`; hold `run_over_cached_audio_that_has_not_drifted_holds_nothing` (+15 more) |
| K2 | A1 | The pre-flight ignores the direction (keys with an empty prompt) | 18 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on`; hold `two_drifted_leaves_are_each_held_and_the_rest_attach`; hold `run_over_cached_audio_that_has_not_drifted_holds_nothing` (+15 more) |
| K3 | A1 | The pre-flight checks only the first narrator | 5 | hold `drifted_leaf_is_held_before_any_listen_and_the_run_carries_on`; hold `run_that_may_synthesise_holds_nothing_and_says_what_it_will_buy`; hold `pre_flight_names_exactly_the_edited_slide_in_render_order` (+2 more) |
| L1 | A2 | --leaf is ignored | 6 | hold `leaf_does_just_the_named_leaves_in_order_whatever_order_they_are_named`; hold `repeated_leaf_is_one_leaf`; hold `unknown_leaf_is_refused_before_anything_runs` (+3 more) |
| L2 | A2 | An unknown index is not refused | 1 | hold `unknown_leaf_is_refused_before_anything_runs` |
| L3 | A2 | An unknown index is reported but the run goes on | 1 | hold `unknown_leaf_is_refused_before_anything_runs` |
| L4 | A2 | --leaf with --limit is not refused | 1 | hold `leaf_with_limit_is_refused_before_the_session_is_even_built` |
| L5 | A2 | Leaves are done in the order named, not in order | 1 | hold `leaf_does_just_the_named_leaves_in_order_whatever_order_they_are_named` |
| L6 | A2 | The header does not say which Leaves | 2 | hold `leaf_does_just_the_named_leaves_in_order_whatever_order_they_are_named`; hold `repeated_leaf_is_one_leaf` |
| S1 | A3 | Compares only the published version | 4 | stale `draft_that_fixes_a_stale_published_entry_leaves_the_published_one_reported`; stale `draft_whose_own_text_was_edited_under_its_audio_is_stale_in_the_draft`; stale `summary_line_counts_slides_and_leaves_not_just_entries` (+1 more) |
| S2 | A3 | Compares only the pending draft | 12 | stale `leaf_nines_actual_shape_is_stale_in_both_voices_in_the_published_version`; stale `clean_leaf_is_clean_and_says_how_much_it_looked_at`; stale `leaf_with_no_pending_draft_is_reported_once_not_twice` (+9 more) |
| S3 | A3 | Does not trim and lower-case a stored digest as the backend does | 1 | stale `stored_digest_is_compared_the_way_the_backend_compares_it` |
| S4 | A3 | An entry with no digest is called fine | 1 | stale `entry_with_no_digest_is_stale_because_the_backend_drops_it_too` |
| S5 | A3 | Every Leaf is treated as having a pending draft (reported twice) | 9 | stale `leaf_nines_actual_shape_is_stale_in_both_voices_in_the_published_version`; stale `clean_leaf_is_clean_and_says_how_much_it_looked_at`; stale `leaf_with_no_pending_draft_is_reported_once_not_twice` (+6 more) |
| S6 | A3 | No Leaf is ever treated as having a pending draft | 4 | stale `draft_that_fixes_a_stale_published_entry_leaves_the_published_one_reported`; stale `draft_whose_own_text_was_edited_under_its_audio_is_stale_in_the_draft`; stale `summary_line_counts_slides_and_leaves_not_just_entries` (+1 more) |
| S7 | A3 | Audio beside a field with no text is skipped, not stale | 1 | stale `audio_beside_a_field_with_no_text_is_stale_not_silently_fine` |
| S8 | A3 | The summary counts entries as slides | 3 | stale `summary_line_counts_slides_and_leaves_not_just_entries`; stale `it_is_red_against_leaf_nines_actual_shape`; stale `it_reads_a_pending_draft_as_well_as_the_published_version` |
| S9 | A3 | The line loses which version an entry is in | 3 | stale `line_names_leaf_slide_narrator_version_and_eight_hex_of_each_digest`; stale `it_is_red_against_leaf_nines_actual_shape`; stale `it_reads_a_pending_draft_as_well_as_the_published_version` |
| C1 | A3 | The command constructs a NarrationBudget | 2 | stale `it_cannot_construct_anything_that_spends_or_write_anything`; stale `command_never_names_a_paid_client_a_write_or_the_narration_session` |
| C1a | A3 | The command constructs a NarrationBudget by a dynamic lookup the source scan cannot see | 1 | stale `it_cannot_construct_anything_that_spends_or_write_anything` |
| C1b | A3 | The command names NarrationBudget in code that never runs, so nothing is constructed | 1 | stale `command_never_names_a_paid_client_a_write_or_the_narration_session` |
| C2 | A3 | The command writes the run's state | 8 | stale `it_is_red_against_leaf_nines_actual_shape`; stale `it_is_green_on_clean_leaves_and_still_shows_what_it_looked_at`; stale `it_reads_a_pending_draft_as_well_as_the_published_version` (+5 more) |
| C3 | A3 | An anonymous key is no longer refused | 1 | stale `anonymous_key_is_refused_before_a_single_leaf_is_read` |
| C4 | A3 | A Track whose Leaves are not the run's is no longer refused | 1 | stale `track_whose_leaves_are_not_the_runs_is_refused` |
| C5 | A3 | Stale entries found, exit code 0 | 3 | stale `it_is_red_against_leaf_nines_actual_shape`; stale `it_reads_a_pending_draft_as_well_as_the_published_version`; stale `it_cannot_construct_anything_that_spends_or_write_anything` |
| C6 | A3 | The 'compared N audio entries' line is gone | 3 | stale `it_is_red_against_leaf_nines_actual_shape`; stale `it_is_green_on_clean_leaves_and_still_shows_what_it_looked_at`; stale `it_reads_a_pending_draft_as_well_as_the_published_version` |
| C7 | A3 | The command reads the run's state itself instead of through read_run_state | 9 | stale `it_is_red_against_leaf_nines_actual_shape`; stale `it_is_green_on_clean_leaves_and_still_shows_what_it_looked_at`; stale `it_reads_a_pending_draft_as_well_as_the_published_version` (+6 more) |
| R1 | A4 | A partial run always overwrites | 6 | hold `partial_run_writes_beside_a_fuller_review_and_leaves_it_alone`; hold `run_asked_for_more_than_it_covered_never_overwrites_even_with_enough_clips`; hold `review_target_overwrites_only_a_review_it_does_not_shrink[asked2-covered2-11-12-True]` (+3 more) |
| R2 | A4 | A run always writes beside, even when there is nothing to shrink | 9 | hold `partial_run_writes_beside_a_fuller_review_and_leaves_it_alone`; hold `run_that_covers_every_leaf_it_was_asked_for_and_enough_clips_overwrites`; hold `run_asked_for_more_than_it_covered_never_overwrites_even_with_enough_clips` (+6 more) |
| R3 | A4 | The 'every Leaf asked for' clause is dropped | 2 | hold `run_asked_for_more_than_it_covered_never_overwrites_even_with_enough_clips`; hold `review_target_overwrites_only_a_review_it_does_not_shrink[asked3-covered3-12-12-True]` |
| R4 | A4 | The 'at least as many clips' clause is dropped | 3 | hold `partial_run_writes_beside_a_fuller_review_and_leaves_it_alone`; hold `review_target_overwrites_only_a_review_it_does_not_shrink[asked2-covered2-11-12-True]`; hold `review_target_overwrites_only_a_review_it_does_not_shrink[asked4-covered4-4-12-True]` |
| R5 | A4 | A review whose size cannot be read is overwritten | 1 | hold `review_whose_size_cannot_be_read_is_never_overwritten` |
| R6 | A4 | The beside name does not carry the coverage | 5 | hold `partial_run_writes_beside_a_fuller_review_and_leaves_it_alone`; hold `run_asked_for_more_than_it_covered_never_overwrites_even_with_enough_clips`; hold `review_target_overwrites_only_a_review_it_does_not_shrink[asked2-covered2-11-12-True]` (+2 more) |
| R7 | A4 | Leaves_label does not merge consecutive Leaves into ranges | 5 | hold `run_asked_for_more_than_it_covered_never_overwrites_even_with_enough_clips`; hold `leaves_label_carries_the_coverage[orders0-0-8]`; hold `leaves_label_carries_the_coverage[orders2-0-3+8+10-11]` (+2 more) |
| R8 | A4 | A review with only an mp3 is read as absent, not unreadable | 1 | hold `review_with_only_an_mp3_is_unreadable_not_absent` |
| R9 | A4 | The command passes what it covered as what it was asked for | 1 | hold `run_asked_for_more_than_it_covered_never_overwrites_even_with_enough_clips` |
| R10 | A4 | The command no longer says BESIDE | 2 | hold `partial_run_writes_beside_a_fuller_review_and_leaves_it_alone`; hold `run_asked_for_more_than_it_covered_never_overwrites_even_with_enough_clips` |
| R11 | A4 | A partial review's cue sheet does not say it is partial | 1 | hold `partial_run_writes_beside_a_fuller_review_and_leaves_it_alone` |
| P1 | A5 | The not-on-disk message carries the first thirty characters of the line (the Architect's prefix-leak mutant) | 1 | nosyn `first_attempt_that_is_not_on_disk_is_a_typed_error_naming_the_line` |
| D1 | A6 | The README says a clip not on disk stops the run again | 1 | hold `no_text_says_a_missing_clip_stops_the_run` |
| D2 | A6 | The --no-synthesis help says a clip not on disk stops the run again | 2 | hold `no_text_says_a_missing_clip_stops_the_run`; hold `help_and_the_readme_describe_the_hold_and_the_options` |
| D3 | A6 | The README does not mention the stale-check command | 1 | hold `help_and_the_readme_describe_the_hold_and_the_options` |

## Part B — what ran, and what it found

Every paid command ran with the ceiling inline (`ZOOMOUT_PIPELINE_MAX_NARRATION_USD=2.75`, never in `.env`) and its header shows it; one `narrate` process ran at a time; Payload on `:3001` is the founder's and I never started it. **The only synthesis anywhere was B3's two clips.**

| Step | Command | What came out | Cost |
|---|---|---|---|
| **B1** | `narration-stale --run-id ikigai` | "compared 216 audio entries — 144 in the published versions, 72 in 9 pending drafts"; **exactly** `leaf 9 payoff female live stored 13c9a963 current 66262e04` and the male row; "1 stale slide in 1 Leaf — 2 audio entries (live 2, draft 0)"; exit 1. As predicted: nothing in any draft | $0 |
| **B3a** | `narrate --run-id ikigai --leaf 9 --no-synthesis --tempo 1.3` | "HELD — NOT ON DISK: payoff (female, Achernar), payoff (male, Sadaltager); nothing rendered, listened to or attached" — **exactly the two clips**, no words printed; exit 1; spend line unchanged at $2.0167 | $0 |
| **B2** | `narrate --run-id ikigai --no-synthesis --tempo 1.3` (24 min) | `budget : $2.0167 of the $2.75 voiceover ceiling`. Leaves 0–8 "already held"; **Leaf 9 held NOT ON DISK, nothing listened to**; Leaves 10–17 each "draft written; 8 uploaded; verified" (**64 clips**); guard "129 exact, 7 minor, 0 major, 0 unchecked — of 136 clips"; the review written **BESIDE** the 36-clip one (68 clips a voice); exit 1, because of Leaf 9 — as written | **$0.1884** for 69 listens; speech line unmoved |
| **B3** | `narrate --run-id ikigai --leaf 9 --tempo 1.3` (4 min 38 s) | `budget : $2.2051 …`; **`will buy : 2 clips — leaf 9 payoff (female, Achernar), leaf 9 payoff (male, Sadaltager); and a retry for any clip the guard fails`**; both **exact on the first attempt** (18.4 s and 19.2 s at ×1.3); "draft written; 8 uploaded; verified"; guard 7 exact, 1 minor of 8; exit 0 | **$0.0271:** speech +$0.0123 (2 clips), 6 listens +$0.0148 |
| **B4** | `narrate --run-id ikigai --no-synthesis --tempo 1.3` (39 s) | all **18** "draft already held this audio; 0 uploaded; verified"; guard "136 exact, 8 minor, 0 major, 0 unchecked — of 144 clips"; reviews rebuilt for all 18; exit 0 | **$0** |

**What the paid runs put on disk — the handoff's "exactly".** The four trees, each hashed as the sha256 of its sorted per-file sha256 listing:

| | before Part B | after B2 | after B3 | after B4 |
|---|---|---|---|---|
| `raw/` | 374 · `8d901c89…` | 374 · `8d901c89…` | **378** · `ff4c2995…` | 378 · `ff4c2995…` |
| `final/` | 216 · `72c13790…` | 280 · `bb09f4d0…` | 288 · `012e5f3e…` | 288 · `012e5f3e…` |
| `checks/` | 268 · `28a8c65e…` | 337 · `8747dab0…` | 343 · `35369431…` | 343 · `35369431…` |
| `snapshots/` | 55 · `84b31ead…` | 72 · `5698f7e1…` | 73 · `d35e38e7…` | **91** · `f664cb0d…` |

- **`raw/` did not change in B2** (guard only) and **gained exactly four files in B3**: `8b2b723b….{wav,json}` (Achernar's payoff) and `1aeec941….{wav,json}` (Sadaltager's), the two clips "will buy" named. A per-file sha256 listing taken immediately before B3 and one after differ only by those four lines: **none changed, none removed.** B3 listened to six clips, not eight: Achernar's summary and scenario had been listened to in VO-4's run.
- **In the CMS**, Part B wrote nine drafts (Leaves 9–17; Leaves 0–8 already held VO-4's) and uploaded **72 Media documents** (B2 64, B3 8). It wrote nothing to any published version (B5).
- **B4 is idempotent for everything but `snapshots/`.** The ledger, `raw/`, `final/` and `checks/` are identical to after B3, and by the code path (the already-attached branch calls no `update_leaf_draft`) and the 0 uploads it reports, the CMS was not written to. `snapshots/` rose 73 → 91: one local read-back file per Leaf visited (`leaf-NN-before-K`, K = snapshots already taken for that Leaf + 1), taken before the attach step knows whether there is anything to attach. That is VO-4's behaviour, not new (B2 added 17 and B3 one), roughly 20 KB each, and it grows with every pass over the book.

**B5 — from outside, and by the check VO-4 lacked.** Two independent readers, against the real Payload, the machine key's identity checked first:
- A REST script (scratch, not in the repo): **144 draft audio rows; served bytes equal the `final/` clip (sha256) for 144 of 144; `textDigest` equals the sha256 of the Leaf's current text for 144 of 144** — Leaf 9's payoff included; no Leaf without a pending draft; **no live Leaf changed** since the snapshot taken before B2 (`updatedAt` and every live audio row compared). Its first run failed before reading anything (no database URL in its environment); the numbers are from the rerun.
- `narration-stale`: "compared 288 audio entries — 144 in the published versions, 144 in 18 pending drafts"; the only entries it reports are Leaf 9's payoff, both narrators, **live** (stored `13c9a963`, current `66262e04`) — "1 stale slide in 1 Leaf — 2 audio entries (live 2, draft 0)", exit 1. Expected: publishing the draft is what fixes them. The drafts are clean.

**B6 — the take-change table.** Each of the 144 attached lines was matched to the take VO-2.1 accepted (every raw attempt re-rendered at 1.0× and matched to a pre-VO-4 `final/` mp3: 144 recovered) and the attached attempt compared. **144 = 141 the same take + 1 a different take + 2 new words.**

| Line | VO-2.1 accepted | Attached now | The guard's reading | Listen |
|---|---|---|---|---|
| **Leaf 2 · scenario · Achernar** | attempt 2 at 1.0× — read 27 of 27, exact | attempt 1 at ×1.3 (9.5 s) | attempt 1 at ×1.3: **27 of 27, exact**. *The same attempt at 1.0×: 22 of 27* — not heard: "what is your next move" | Achernar **02:44** |
| **Leaf 9 · payoff · Achernar** — *new words*, not a take choice | the live clip was made from the older sentence (`13c9a963…`) | new synthesis, attempt 1 at ×1.3 (18.4 s) | exact | Achernar **11:59** |
| **Leaf 9 · payoff · Sadaltager** — *new words* | same | new synthesis, attempt 1 at ×1.3 (19.2 s) | exact | Sadaltager **12:12** |

The Leaf 2 row is the one take the founder has not approved by ear. **A time-stretch cannot add words to a clip**, so the five words the guard did not hear at 1.0× were in attempt 1's audio all along; the likeliest reading is that VO-2.1 discarded a sound take on a bad reading. Whether attempt 1 *sounds* as good as the attempt 2 the founder approved is the ear's call. The guard is a noisy listener: the same samples read 22 of 27 and 27 of 27.

**B7 — the figures.**

| Node | Before Part B | After | Change |
|---|---|---|---|
| `narration` (speech) | $1.2964 | $1.3087 | **+$0.0123** (the two payoff clips) |
| `narration_guard` | $0.7203 | $0.9235 | **+$0.2032** (B2 $0.1884 + B3 $0.0148; 75 listens, `checks/` 268 → 343) |
| **narration total** | $2.0167 | **$2.2322** | **+$0.2155** — 81% of the $2.75 ceiling; **headroom $0.5178** |
| whole run, every node | $6.3600 | $6.5755 | +$0.2155 |

- **Idempotence run (B4): $0** — the spend line reads $2.2322 before and after.
- **Orphans: 144.** The live versions point at 144 files, all 144 still in the CMS; the pending drafts point at 144 others; **none is in both**. When the founder publishes, **144 old Media documents are referenced by nothing**, and the machine key cannot delete Media.
- **The review tracks, from the cue sheets' own lines:** `**72 clips, 22:57 in total.**` (Achernar) and `**72 clips, 23:26 in total.**` (Sadaltager); at 1.0× (`review-before-vo4/`) 29:11 and 29:52. The six `review-before-vo4/` files hash identically to the table above after Part B.

## What I got wrong, and what surprised me

- **My listener could not tell one Leaf's clip from another's.** The stock fake voice makes audio from the text's *length* only, so Leaves 1, 2 and 3's payoffs were identical bytes, and my `{sha256 → text}` registry silently kept the last writer. A one-word mishearing is only "minor", so tests passed partly by luck, and the first `StopIteration` is what showed it. Fixed by a fake voice whose audio depends on the text and by a registry that **refuses to be built** if two texts share their bytes (`ContentBackend`, `prime`).
- **My first A6 scan flagged the new, true sentence** ("only a budget or a speech failure stops the whole run"). The old claim is about a *missing clip*, so the pattern is now "stops the run" within a sentence of "not on disk"/"missing", and a second test proves the scan goes red on the old wording.
- **I wrote an `assert` for type-narrowing in production code**, then replaced it with an explicit argument: the repo's standard is explicit errors, and `-O` would have stripped it.
- **A regression script of mine said "144 of 216".** `final/` now holds two generations, the 144 originals and VO-4's 72 at ×1.3, and the script assumed one. Split by age and re-derived each at its own tempo, it reads 144/144 and 72/72.
- **Cost of the tests:** the hold tests render real clips through the real command, so `test_narrate_hold.py` takes about 30 s of a suite that now takes about 50 s (it was ~22 s). The raw cache is bought once per module and copied per test, which took it from 51 s to 30 s.
- **Part B — my "no other `narrate` is running" check before B3 was malformed, and I did not gate on it.** I counted processes by matching the text `zoomout-pipeline narrate`; it printed `2` beside "(must be 0)" and the paid run started in the same command anyway. The 2 were the harness's own shell wrappers, whose command lines contain that text: a read-only command with no `narrate` in it prints 2 the same way. No second `narrate` was running. B2's exit code was recorded and B3's header read B2's final $2.2051; the ledger moved by exactly B3's own printed delta ($2.2322 − $2.2051 = $0.0271 = $0.0123 + $0.0148); `raw/` gained the four files and `checks/` the six that B3 reports. B4's check was a real gate (processes whose command is not a `zsh -c` wrapper; abort unless there are none) and found none. The "one `narrate` at a time" rule held, but I had not verified it when I spent, and a check that is not a gate is not a check.
- **Part B — B2 cost more than the figure I gave the founder, and the miss is mine:** **$0.1884** against the **$0.161–$0.174** I quoted before the yes. The 69-listen bound was exact (the run bought exactly 69); the dollar figure priced them at VO-4's $0.00252 a listen, and B2's came to $0.00273. Leaves 10–17's clips run about 4.5% longer than Leaves 0–8's (a mean of 18.6 s against 17.8 s), which explains about half of the 8.5% rise; I did not trace the rest. Part B still came in under the handoff's ≈ $0.24 ($0.2155) and the ceiling was never near, but the range I gave should have allowed for a dearer listen.
- **Part B — my first B6 pass called 12 lines "new words", and ten were my script's error.** I compared a raw sidecar's text, which is the *spoken* text, with `textDigest`, which hashes the *field* text. The two are not byte-identical for some slides (Leaves 2, 4, 7, 11 and 14, both voices; I did not trace which characters), so ten correct lines read as changed. The live clip's `textDigest` equals the attached one for all ten, checked line by line, so the words never changed. Compared digest to digest (live against attached), exactly two lines differ: Leaf 9's payoffs. The B6 figures are from the corrected script, and anyone who matches a sidecar's text to a stored digest will meet the same trap.
- **Part B — B4 is not idempotent for `snapshots/`** (73 → 91; explained under B7). I saw it because I measured the four trees after B4 instead of assuming a run that uploads nothing writes nothing. It is VO-4's behaviour and writes nothing to the CMS, but "idempotent" is true of the ledger, `raw/`, `final/` and `checks/`, not of that folder.
- **Part B — in the good direction:** both payoff clips passed the guard on the first attempt, so B3 used none of its retry budget; speech cost **$0.0123** against the $0.0152 I estimated for two clips (worst case $0.0457).

## What I could not verify

- **The sound.** Every "exact" above is a guard reading, a model's transcript of each clip, not a listening. It cannot judge pace, a warble or whether ×1.3 feels rushed, and B6's 22 of 27 against 27 of 27 on the same samples shows it can miss. That is the device gate, and it is the founder's.
- **Playback in the app.** B5 proves what the backend's drop rule needs: every draft row's `textDigest` equals the sha256 of its slide's current text, compared as the backend compares it, and the CMS serves the exact clip bytes. I did not run the backend or the mobile app against the drafts, and nothing can play until the founder publishes.
- **Part A against the real CMS: now done.** The hold and `narration-stale` were first exercised against a fake Payload; B1, B2 and B3a ran them against the real one and each did what the fake said. What the check relies on, that a pending draft is the newest version with `_status == "draft"` and a Leaf with none reports `published`, was seen on the real Payload in VO-4 and is what B1 and B5 read.

## Files touched

All under `apps/pipeline`; the one path outside it is this entry.

- **Source:** `src/zoomout_pipeline/graph/narration_nodes.py` (`clip_key`, `MissingClip`, `missing_first_attempts`, `leaves_label`, `existing_review_clips`, `ReviewTarget`, `review_target`; `_render_attempt` builds its key through `clip_key`) · `src/zoomout_pipeline/graph/narration_stale.py` **(new)** · `src/zoomout_pipeline/cli.py` (`narrate`: `--leaf`, the pre-flight, the hold, the will-buy line, the review rule; `narration-stale`; `_checked_cms`; `_select_leaves`, `_planned_purchases`, `_will_buy`) · `README.md`.
- **Tests, new:** `tests/test_narrate_hold.py` (39) · `tests/test_narration_stale.py` (21). **Changed, named above:** `tests/test_narrate_cli.py`, `tests/test_no_synthesis.py`, `tests/narration_fakes.py`.
- **Deliberately untouched:** `assets/speech.py`, `graph/greeting_nodes.py`, `assets/greeting.py`, `assets/audio.py`, `prompts/`, `packages/shared`, every other app. **No Leaf's text was edited, Leaf 9's included.**
- **Part B touched no tracked file except this entry.** What it wrote is under `runs/` (gitignored) and in the CMS: `raw/` +4, `final/` +72 (64 + 8), `checks/` +75, `snapshots/` +36 (17 + 1 + 18), the reviews under `review/`; and in Payload nine pending drafts (Leaves 9–17) and 72 Media documents. No published version was written.

---

### Completed: VO-4 — the tempo stretch shipped and verified; 9 of 18 Leaves attached, Leaf 9's own text drift blocks the rest — 2026-10-02

*Pipeline Manager. Branch `vo-4-narration-tempo`, worked in `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`, off `origin/main` at `5e352e8` (rebased once, cleanly, onto ONBOARD-3.1's merge — no file either package touched overlaps). PR: [#64](https://github.com/ayush237/ProjectZoomOut/pull/64) — the founder merges.*

**11 of 14 acceptance criteria fully verified. Three are not, each named: #5's CLI leg runs and halts at Leaf 9 instead of completing; #6 (the real-clip table) is verified with a reported finding, not a silent pass; #9 (all 18 Leaves attached) stands at 9 of 18, blocked by a fact outside this package — Leaf 9's own text was edited after it was narrated, a week before this package started (its `updatedAt` is 2026-09-18).** Given the choice between finishing Leaf 9 (new synthesis, out of scope), fixing its text myself (not my role), or shipping the 9 clean Leaves now and naming the rest as a follow-up, **the founder chose the third, explicitly, in chat.**

| | |
|---|---|
| Attached | **9 of 18 Leaves (0–8), 72 clips, all passing** — 69 exact, 3 minor (Leaf 5 payoff both voices, Leaf 7 takeaway Achernar; the same clips that were minor before the stretch). Verified independently by REST, not the command's own verdict: every served byte matches its URL's hash, every live Leaf's `updatedAt` is untouched, every clip's `tempo` is `1.3` in the run's own state |
| Held at | **Leaf 9, by design.** `NarrationNotOnDiskError`, named, nothing reserved, nothing called. Leaves 10–17 never attempted — `narrate`'s loop stops the whole run on this error, not just the one Leaf, and there is no `--skip`. See "Leaf 9," below |
| Spend | **$0.1937** this package: narration (speech) unchanged at **$1.2964** — confirming zero synthesis — narration_guard (listening) **$0.5266 → $0.7203**, which is **77 new listens** (72 kept clips + 3 retried first attempts + 2 on Leaf 9's Achernar summary and scenario, listened to before the halt at its payoff: ≈$0.006 on clips that were never attached). Ledger **$2.0167** of the **$2.75** ceiling the founder approved in chat, Google Cloud. A second run at the same tempo: **$0**, 0 uploads, "draft already held this audio" for all 9 |
| Gate | `ruff format --check` **130** files (baseline 125) · `ruff check` clean · `mypy --strict` **112** files (baseline 107) · `pytest` **690 passed** (baseline 573, **+117**, 6 deselected as `live`). Every new test lives in 5 new files; **zero existing tests modified** |
| Mutation-checked | **34 breakages** — the stretch's properties, the three render-placement traps, every no-synthesis case, the five pinned defaults plus `render_line`'s own, the state recording. **33 were red the first time; one survived** (the window-overlap property), which exposed a missing pin; the pin was added and that mutation re-run red. Every file restored and hash-verified after every run. Table below, with the tests that went red |

---

## What the founder would notice

- **The book narration is ~30% faster, for 9 of 18 Leaves.** The other 9 wait on Leaf 9 (below) — not a quality problem with the stretch, a pre-existing fact about Leaf 9's text.
- **Nothing was lost.** The old (1.0×) audio for Leaves 0–8 stays live and untouched until you publish; the new drafts wait beside it. Leaves 9–17 are exactly as they were.
- **Leaf 9's payoff slide plays no narration for readers today, in either voice** — and has not since its text was edited. This is not caused by VO-4 and is not fixed by it: the backend drops an audio entry whose `textDigest` no longer matches the slide's current text (see "Leaf 9," below). The other 142 entries are fine.
- **One real finding on the audio numbers, not hidden:** nearly half of Sadaltager's clips (32 of 72) miss the table's literal pitch tolerance — explained below; it looks like a measurement artefact rather than an audible change, but only an ear can confirm that.
- **72 old Media documents will become orphans once you publish** (the machine key can't delete Media) — expected, named in the handoff, not a bug.
- **The two review tracks now cover Leaves 0–8 only** (see "Device gate"); the full-book originals are preserved in `review-before-vo4/`.

## Needs a ruling

1. **Leaf 9.** Its payoff text changed after VO-2.1 narrated it (shown below, word for word), and the slide is silent until that is resolved. I presented three options in chat — finish at 9/18 now, fix the text first and I continue today, or synthesise it fresh as a separate paid step — **the founder chose the first.** What's left: decide what Leaf 9's payoff should actually say. **My recommendation: keep the edit.** VO-2.1's own report flagged the old sentence as reading like a slip ("the verb is correct for the compound subject, but it reads as a slip"), so the new wording looks deliberate, and the cost of narrating it fresh is about $0.03 (two clips, in the same run as the remainder — Follow-ups #1). **Reverting** is free and brings the audio back the moment the revert is published, but it undoes an apparent editorial fix to save three cents. It is the founder's text either way.
2. **Should one drifted Leaf stop the whole run?** The handoff said a missing first attempt "stops the run", and it does — which is why one Leaf blocked eight clean ones. I'd make it **Leaf-local** (hold that Leaf, name it, carry on, exit non-zero — the shape `NarrationHeldError` already has). It is a ~10-line change with tests, but it reverses an explicit line of the handoff, so it is yours to rule, not mine to take.
3. **The pitch-measurement finding** (Part 5, below) is reported, not resolved. `measure()`'s own `pitch_median_hz`/`voiced_fraction` is not touched by this package and the finding doesn't block anything, but it's worth an Architect look since it would affect how *any* future comparison across a stretch reads these three fields.

---

## Part 1 — the stretch (`assets/audio.py`)

`change_tempo(pcm, tempo) -> Pcm`: WSOLA, pure NumPy, no new dependency — 30 ms frames, half-frame output hop, ±10 ms similarity search against the natural continuation of the last frame, periodic (not symmetric) Hann windows so two copies half a frame apart sum to exactly one. `tempo == 1.0` returns the input object itself. Deterministic (same bytes twice, verified). Refuses outside `1.0`–`1.5` **before** `shape_edges` is reached, via a shared `require_tempo` so a bad tempo is caught before anything is bought, not after.

**Speed:** minutes at most for the whole set, as the handoff asked. A full pass over the 157 cached ruled-narrator attempts took between 24 s and about 2½ minutes across my runs (the spread is machine load, not the algorithm); the real-clip table, which renders every accepted clip twice and runs the pitch analysis on both, took about a minute.

**Tested on synthetic signals, none reading `runs/`:** a sine keeps its frequency within 1% and its level within 1 dB at every tempo in range, with no step larger than the source signal's own slope allows (no clicks); tone–silence–tone shows every segment — both tones and the silence between — shrinking by the tempo, not just the tones; an exponential sweep and a two-tone signal both show **band power** within 3 dB everywhere (not peak-bin level, which a first draft used and which reported a false 1.2 dB "loss" on an unchanged 300 Hz tone — a Hann window's scalloping loss, not a real level change, and length-dependent in a way the stretch itself changes); identity at 1.0 is the same object, the same audio gives the same bytes twice, an empty clip comes back as itself; every value outside 1.0–1.5 including `nan`/`inf`/negative is refused. **One property a first pass missed and a mutation found:** a constant signal must come through as the same constant at every tempo — this is what actually proves the overlapping windows sum to one; a window that doesn't (a plain Hann instead of the periodic one) passed every other test here and still rippled the level by about 0.03 dB at the frame rate, invisible to a level tolerance. Added, and the mutation that exposed it is in the table below.

## Part 2 — the three traps, and the real-clip confirmation

All three are pinned at the unit level (`tests/test_tempo.py`, `tests/test_narration_tempo.py`) and separately confirmed on **all 144 real accepted clips** (Part 5):

1. **Pads, loudness, peak.** The stretch runs *inside* `shape_edges`, after the head/tail are decided but before they're applied — so the 60 ms head and 350 ms tail are the constants `words_per_minute` subtracts, at every tempo, not the constants divided by it. Confirmed on the real set: 144/144 unchanged. Levelling runs a second time after the stretch (a stretch is not exactly level-neutral — proven on noise, not the tone-burst fake, which happens to come through level-neutral and would have hidden a missing second `level()` call).
2. **The edge report describes the model's own ending, at every tempo.** `shape_edges` scans for speech, decides the breath-cut and the mid-sound-ending verdicts, **before** stretching — so a 0.30 s breath that would read as 0.23 s (under `MAX_DECAY_SECONDS`) at 1.3× if decided after the stretch is still cut, because the decision was never made on the stretched audio. Confirmed: `EdgeReport` identical at 1.0 and 1.3 on 144/144 real clips, `gain_db` identical on 144/144.
3. **`raw/` is never written by a stretch, and the stretch runs once.** Confirmed by re-running the full 0–8 pass twice (once as the real paid run, once as its idempotent repeat): `raw/`'s tree hash is **identical** before and after both — `8d901c89…` — 374 files, byte for byte. Duration ratio is `1/tempo`, not `1/tempo²`, confirmed to within 0.5% on the spoken span of all 144 clips (Part 5).

## Part 3 — no synthesis

`--no-synthesis` (and the same keyword on `render_line`/`_render_attempt`) makes a run **unable** to buy a clip, not merely unlikely to: the speech backend is never touched, and `budget.reserve` for speech is never reached. Tested with a speech fake that **raises** on any call, across every case the handoff names: a cached first attempt (no call); a missing first attempt (`NarrationNotOnDiskError`, named, no call); a missing *later* attempt (ends that line's retries, keeps the best attempt so far — the same outcome as attempts exhausted, so a stretched clip the guard still fails holds its Leaf rather than causing a paid regeneration); a full 8-clip Leaf pass with the ledger's speech line unchanged to the cent.

**Confirmed live, not just on the fake.** `narration` stayed at exactly **$1.2964** across both paid invocations of this package — the exact figure it was at before VO-4 touched anything. Every cent spent was `narration_guard`.

## Part 4 — the five defaults

`NARRATION_TEMPO = 1.3` is pinned equal in the constant, the CLI option's literal, `narrate`'s docstring, the README, and what `narrate` passes to `render_line` — five places, five tests, the same shape `test_attempt_defaults.py` used for the attempts ruling. `render_line`'s own default is `1.0` and is pinned **different** from `NARRATION_TEMPO`: every other caller — `audition-voices`, every existing test — keeps the model's own pace, confirmed by an AST scan of `cli.py` that `audition_voices` passes neither `tempo` nor `no_synthesis` to anything. `tempo` is carried on `RenderedClip` and recorded in `AttachedLeaf.media[...]`, confirmed live: every one of the 72 attached clips reads `tempo: 1.3` back from the run's own checkpoint state.

## Part 5 — the free checks

**5.1 The regression.** Both ways, exactly as specified, **free — no model is ever called:**
(a) A throwaway script with `guard=None`, re-deriving all 144 accepted clips from their cached raw audio at tempo 1.0 through the real render path (`_render_attempt`) and comparing sha256 against `final/`: **144 of 144 equal.** (Built Payload-free, against the raw cache's own sidecars, since Payload was down when this check first ran; one real wrinkle — `narration_direction.md` was edited once early in Ikigai's history, leaving two raw files for one semantic attempt (Leaf 11 summary, Achernar, attempt 1) under two old prompts; deduplicating by (leaf, slide, voice, attempt, text) rather than by raw digest file fixed a self-inflicted double-count in the check script, not a defect in the code under test.)
(b) The CLI, `ZOOMOUT_PIPELINE_MAX_NARRATION_USD=1.83 narrate --render-only --no-synthesis --tempo 1.0`: **all 72 clips of Leaves 0–8 printed `(cached)` (counted: 72 of 72), the ledger stayed at $1.8230 to the cent, no spend.** It then halts at Leaf 9 — the same halt the paid run later hit, for the same reason (below) — so it did **not** complete "with no HALT" as the handoff pictured, and it never reached the 72 clips of Leaves 9–17; those are covered by leg (a), which does re-derive all 144. Run twice (once before Payload went down, once after), same result both times. Everything this leg *can* prove, it proves at $0.

**5.2 The real-clip table.** All 144 accepted clips, old vs. ×1.3, through `_render_attempt` with `guard=None, no_synthesis=True` — no listen, no spend.

| Measure | Tolerance | Result (min / median / max) | Verdict |
|---|---|---|---|
| Duration ratio, spoken span (file minus the fixed 60 ms + 350 ms) | 1/1.3 = 0.7692 ±0.5% | 0.7687 / 0.7699 / 0.7716 | **144/144** |
| Duration ratio, whole file, literal | 0.7692 ±0.5% | 0.7716 / 0.7741 / 0.7806 | **36/144** — see note |
| Articulation rate (speech-only wpm), ratio | 1.3 ±3% | 1.274 / 1.292 / 1.312 | **144/144** |
| Longest pause, new − old/1.3 | ±0.1 s | −0.082 / −0.001 / +0.092 | **144/144** |
| Pace band (100–330 wpm of speech) | inside the band | 141 / 206 / 278 | **144/144**, fastest at 278 |
| `EdgeReport` identical at 1.0 and 1.3 | equal | — | **144/144** |
| `gain_db` identical | equal | — | **144/144** |
| `pitch_median_hz`, new/old − 1 | ±2% | −0.51% / +0.76% / +7.96% | **111/144** — see finding |
| `pitch_spread_semitones`, new − old | ±0.3 st | −0.71 / −0.03 / +1.09 | **128/144** — see finding |
| `voiced_fraction`, new − old | ±0.03 | −0.047 / −0.007 / +0.026 | **122/144** — see finding |

**The whole-file duration miss is a definition artefact, not a drift.** The mp3 encoder's own fixed delay and padding (well under a tenth of a second) doesn't scale with the tempo, so it's a bigger share of a shorter clip; the literal reading drifts from 1/tempo by a near-constant *absolute* offset. Measured on the spoken span alone — what `words_per_minute` actually reads — the ratio is dead on, 144/144.

**The pitch/voicing finding, not tuned away.** The three misses above are **concentrated almost entirely in one voice**: Sadaltager fails pitch tolerance on 32 of 72 clips (median +1.93%), Achernar on 1 of 72 (median +0.35%); `voiced_fraction` the same shape (Sadaltager −0.026 median, 22/72 outside; Achernar 0/72). I didn't stop at the aggregate. A **frame-aligned** comparison — the same instant in the speech, before vs. after, matched by mapped time rather than by population statistics — shows the real pitch shift is **≤0.17 semitones (1%) even in the single worst clip** (the one that misses the batch tolerance by 7.96%). So the batch `pitch_median_hz`/`voiced_fraction` numbers are moving because the stretch slightly changes *which* borderline frames the autocorrelation-based voicing threshold (`SPEECH_DB + 5`, in `pitch_track`) counts as voiced for a lower-pitched voice — a property of `measure()`'s own aggregation, pre-existing and untouched by this package — not because any sound's pitch actually changed. I did not touch `pitch_track`, `measure`, or the thresholds to make this pass; the handoff's instruction was to report a table that misses its tolerance, not tune to it, and that's what this is.

## Part 6 — the paid step

Ledger, ceiling, expected cost and real headroom were given to the founder in chat before anything was spent — narration $1.2964, narration_guard $0.5266, ledger $1.8230 of $3.00 default; proposed ceiling $2.75; expected **≈$0.42** for a full 153-listen pass (144 kept + 9 earlier attempts on 7 lines that needed a retry — independently reconfirmed from this package's own regression, matching the handoff's own count exactly); real headroom **≈$0.93**, verified against `guard_worst_case_usd` (~$0.032/call reserved, ~$0.0028/call actually settled) rather than just quoted. **The founder said yes, with the ceiling at $2.75, after Payload was started.**

**Leaf 0 first**, as instructed: `narrate --no-synthesis --tempo 1.3 --limit 1`, with the ceiling set inline; the header confirmed it before any spend (`budget : $1.8230 of the $2.75 voiceover ceiling`). 8 clips, all cached, all exact, draft written, 8 uploaded, verified — $1.8230 → $1.8417 (+$0.0187). Checked independently by REST before going further (below). Then the rest, no `--limit`: Leaves 1–8 the same way, **halting at Leaf 9** exactly as the free check had already predicted. Spend: $2.0167 of $2.75 — **$0.73 of the approved ceiling was never touched.**

**The 77 listens, accounted for** (`checks/` went 191 → 268 files, every new one dated 2026-10-01): 72 kept clips for Leaves 0–8, plus 3 first attempts that failed and were retried (Leaf 3 Achernar summary; Leaf 7 scenario in both voices), plus **2 on Leaf 9's Achernar summary and scenario**. Those two are the avoidable part: a Leaf's clips are rendered line by line with the listen inline, so the run had already bought them when it reached Leaf 9's payoff and found it was not on disk. About $0.006, and they were never attached — but nothing about the order needs it (Follow-ups #2).

*(One thing for my own record: the backgrounded invocation of the full pass was piped through `grep | tee` for log filtering, and that pipeline's own exit code — what the background-task notification reported — was `0`, because `tee` is the last command in the pipe and always exits 0 regardless of what `zoomout-pipeline` itself returned. The printed `HALTED:` line is unambiguous and only one code path produces it; a direct, unpiped re-run of the same command confirmed the real process exit code is `1`, as the code's `raise typer.Exit(1)` says it should be. Not a defect — a gap in how I invoked it the first time.)*

## Part 7 — attach, verify, idempotence, orphans

**Verified by REST, not the command's own verdict**, for all 9 attached Leaves: every one of the 72 draft audio rows' served bytes (`fetch_media`, hashed independently) match the sha256 embedded in their own URL; every live Leaf's `updatedAt` is byte-for-byte the same as a snapshot taken immediately before the paid step; every clip's `tempo` reads `1.3` from the run's own checkpoint state (`cms_narration`), not inferred.

**A second run at the same tempo**, same command: all 9 Leaves report **"draft already held this audio; 0 uploaded; verified,"** spend unchanged at $2.0167 to the cent, and the halt at Leaf 9 reproduces identically. This is the determinism and idempotence proof.

**Orphans:** all **72** of the old (tempo-1.0) Media documents for Leaves 0–8 are confirmed still present and findable by filename. They are not referenced by the pending drafts (which point at the new ×1.3 files) and will become true orphans the moment the founder publishes — expected, and the machine key cannot delete Media, per the handoff.

## Leaf 9 — found, explained, handed off

The live, published text of Leaf 9's `payoff.body`, today:

> *"…while a secondary income stream, paired with small investments, exposes you to massive potential gains…"*

What the attached (currently-live) audio was narrated from — the text in both attach-time snapshots (`runs/ikigai/audio/snapshots/leaf-09-before-1.json` and `-2.json`), which is also what the live rows' `textDigest` (`13c9a963…`) hashes. It is VO-2.1's re-render of this line after the founder corrected its text (the VO-2.1 handoff names Leaf 9's payoff as one of the two corrected texts). 291 characters:

> *"…while a secondary income stream and small investments expose you to massive potential gains…"*

(`raw/` also holds the text from before that correction — "…while small investments and a secondary income stream expose you…", also 291 characters, rendered the day before — which is why it has two candidates for this line.)

**The text changed again after the attach.** Both snapshots still hold the narrated text, so the audio matched its slide when it was attached; Leaf 9's `updatedAt` is now 2026-09-18T04:38:18Z (live and draft alike), and nothing has written to it since, so the change happened at or before then. It reads like a grammar fix — singular "stream … exposes" for the old plural "stream and investments expose" — but that is my reading of the diff, not a recorded intent. The debt register's row *"No pipeline gate catches a misspelling"* (archive, closed 2026-09-22) records this Leaf's payoff being hand-edited and corrected, and may be this edit. **I did not verify who changed it or why**: Payload's version history would show it, and Payload was down when I tried to read it.

**The live effect — which is not about VO-4:** `apps/backend/src/content/content.mapper.ts` drops a slide-audio entry whose `textDigest` no longer matches its narrated field's current text ("dropped rather than served"), with a non-fatal warning. So **Leaf 9's payoff slide plays no narration for either narrator today**; the other 142 entries are unaffected. I read this from the mapper's code and did not run the backend. Checked isolated: of all 144 live audio rows across all 18 Leaves, these two are the only ones whose `textDigest` no longer matches the Leaf's current text.

On this package's side, the no-synthesis contract is working exactly as designed: a Leaf whose text no longer matches its cache stops the run rather than silently serving stale audio or silently buying new audio.

I gave the founder three options in chat before doing anything further: finish this package at 9/18 now and name the rest as a follow-up; fix Leaf 9's text first (revert it, or confirm the edit and accept it needs fresh narration later) and I continue today; or treat a fresh synthesis of Leaf 9's current text as its own small paid step, out of this package's no-synthesis scope. **The founder chose the first, explicitly.** Nothing about Leaf 9 was changed by me — its live audio is exactly what it was before this package started.

## Mutation table

Every guard broken on purpose by a scratch harness (not kept in the repo): each breakage is a set of exact-match edits that must match exactly once, applied in place, the five new test files run in the foreground, then the files restored in a `finally` and verified byte-identical **by hash**. **34 breakages. 33 were red the first time; #33 survived** (see Part 1), a pin was added, and it was re-run red. `git status` was clean after every batch.

Tests are named by file — **N** `test_narration_tempo`, **T** `test_tempo`, **S** `test_no_synthesis`, **D** `test_tempo_defaults`, **C** `test_narrate_cli` — with the `test_` prefix dropped. "Red" is the count of tests that failed; the three named are the first three that did, in the order pytest ran them (the harness printed three, not the full list).

| # | Breakage | Red | First tests red |
|---|---|---|---|
| 1 | Stretch applied **after** `shape_edges` (pads scale) | 4 | N `the_clip_that_reaches_the_encoder_has_the_same_pads_loudness_and_peak[1.3]`, `[1.5]`, `a_breath_the_model_left_is_cut_from_the_stretched_clip_too` |
| 2 | Stretch applied twice (1/tempo²) | 6 | N `the_edge_report_is_the_same_raw_at_tempo_1_0_and_1_3`, `a_clip_the_model_cut_off_mid_sound_is_still_reported…`, `a_breath_the_model_left_is_cut…` |
| 3 | A stretched file written to `raw/` | 5 | N `a_stretched_render_leaves_every_raw_file_byte_identical_and_adds_none`, `a_clip_synthesised_at_a_tempo_is_stored_raw_as_the_model_returned_it`, `the_stretch_is_applied_once_not_twice` |
| 4 | Edges decided on the stretched audio | 29 | T `the_edge_report_is_the_models_own_at_every_tempo[…]` (and its siblings) |
| 5 | Lead-in stretched with the speech | 5 | T `the_head_and_the_tail_are_constants_at_every_tempo[1.3]`, `[1.5]`, `a_lead_in_shorter_than_the_pad_is_kept_as_the_model_made_it` |
| 6 | No second `level()` after the stretch | 2 | N `a_stretch_that_comes_out_quieter_is_levelled_again_before_it_is_encoded[1.3]`, `[1.5]` |
| 7 | `no_synthesis` branch never taken (reaches `synthesize`) | 4 | S `a_first_attempt_that_is_not_on_disk_is_a_typed_error_naming_the_line`, `a_failing_first_attempt_with_a_missing_second…`, `the_second_attempt_is_used_when_it_is_on_disk…` |
| 8 | Refusal placed **after** `budget.reserve` | 3 | S `…typed_error_naming_the_line`, `…failing_first_attempt_with_a_missing_second…`; C `a_clip_that_is_not_on_disk_stops_the_run_cleanly_and_names_the_line` |
| 9 | A missing *later* attempt raises instead of ending the retries | 2 | S `…failing_first_attempt_with_a_missing_second…`, `…second_attempt_is_used_when…` |
| 10 | `render_line` doesn't pass `no_synthesis` down | 4 | S (the same first three as #7) |
| 11 | The not-on-disk error repeats the line's words | 1 | S `…typed_error_naming_the_line` |
| 12 | `narrate` doesn't catch the new error (a traceback, not a stop) | 1 | C `a_clip_that_is_not_on_disk_stops_the_run_cleanly_and_names_the_line` |
| 13 | `--no-synthesis` on by default | 2 | D `no_synthesis_is_off_by_default`; C `without_no_synthesis_the_header_does_not_claim_it` |
| 14 | `narrate` passes `no_synthesis=False` regardless of the flag | 2 | D `the_command_passes_the_option_and_the_switch_through_to_the_render`; C `…stops_the_run_cleanly…` |
| 15 | Default place 1 — `NARRATION_TEMPO = 1.25` | 5 | D `the_narration_tempo_is_ruled_at_one_point_three`, `the_narrate_option_defaults_to_the_library_constant`, `narrates_docstring_states_the_default_the_code_has` |
| 16 | Default place 2 — the option's literal is 1.2 | 3 | D `the_narrate_option_defaults_to_the_library_constant`, `the_help_shows_the_default_a_bare_run_will_use`; C `the_default_pace_is_what_actually_reaches_the_render` |
| 17 | Default place 3 — `narrate`'s docstring says 1.4 | 1 | D `narrates_docstring_states_the_default_the_code_has` |
| 18 | Default place 4 — README table row says 1.4 | 1 | D `the_readme_states_the_default_the_code_has` |
| 19 | Default place 4 — README paragraph says 1.4 | 1 | D `the_readme_states_the_default_the_code_has` |
| 20 | Default place 5 — `narrate` doesn't pass `tempo` | 2 | D `the_command_passes_the_option_and_the_switch_through…`; C `the_default_pace_is_what_actually_reaches_the_render` |
| 21 | Default place 5 — `narrate` passes a hardcoded 1.0 | 2 | (the same two as #20) |
| 22 | `render_line` defaults to `NARRATION_TEMPO` instead of 1.0 | 2 | N `render_line_keeps_the_models_pace_unless_it_is_asked_not_to`; D `render_lines_own_default_is_the_models_pace_and_deliberately_not_the_ruled_one` |
| 23 | `render_line` drops the tempo it was given | 13 | N `a_breath_the_model_left_is_cut…`, `a_clip_synthesised_at_a_tempo_is_stored_raw…`, `the_stretch_is_applied_once_not_twice` (and ten more) |
| 24 | `audition-voices` given a hardcoded `tempo=1.3` | 1 | D `the_audition_keeps_the_models_pace_and_may_still_buy` |
| 25 | `_render_attempt` given defaults for `tempo`/`no_synthesis` | 1 | D `the_render_attempt_must_be_told_its_tempo_and_whether_it_may_buy` |
| 26 | `tempo` not recorded in `AttachedLeaf.media` | 2 | N `the_tempo_is_recorded_on_every_clip_and_in_the_runs_state`, `the_state_says_when_a_clip_is_not_stretched_too` |
| 27 | `RenderedClip` doesn't carry its tempo | 3 | N `a_clip_synthesised_at_a_tempo_is_stored_raw…`, `the_tempo_is_recorded_on_every_clip…`; S `a_cached_first_attempt_renders_and_calls_nothing` |
| 28 | A bad tempo isn't refused before the synthesis | 5 | N `a_bad_tempo_is_refused_before_anything_is_bought[0.9]`, `[1.6]`, `[2.0]` |
| 29 | `change_tempo` doesn't check its own range | 9 | T `a_tempo_outside_one_to_one_and_a_half_is_an_error[0.99]`, `[0.0]`, `[-1.3]` |
| 30 | Tempo 1.0 returns a copy, not the input | 2 | T `a_tempo_of_one_returns_the_input_itself_not_a_copy`, `an_empty_clip_comes_back_as_it_was` |
| 31 | The stretch isn't deterministic (noise injected) | 4 | T `a_sine_keeps_its_pitch_and_its_level_and_gains_no_clicks[1.1-60.0]`, `[1.3-60.0]`, `the_same_audio_gives_the_same_bytes_every_time` |
| 32 | No similarity search (frames taken where they nominally fall) | 13 | T `a_sine_keeps_its_pitch_and_its_level_and_gains_no_clicks[1.1-60.0]`, `[1.1-150.0]`, `[1.1-440.0]` |
| 33 | A plain Hann window instead of the periodic one (overlaps don't sum to 1) | **0 → 1** | **Survived** every other test. Red once `T a_constant_signal_comes_through_as_the_same_constant` was added |
| 34 | `shape_edges` changes its own tempo-1.0 output (head pad off by a frame) | 5 | T `at_a_tempo_of_one_shape_edges_is_the_function_it_always_was[long lead-in, clean end]`, `[decay kept]`, `[breath cut]` |

## What surprised me

- **`measure()`'s own `pitch_median_hz` is noisier than I expected for a lower-pitched voice**, and it took a time-aligned comparison — not just a tighter tolerance — to tell a real pitch shift from a population-statistics artefact of which frames clear the voicing threshold.
- **The exit-code pipe trap** in Part 6's footnote — I'd read `background-subshell-completion-notice` in memory and still walked into the *sibling* version of it (a `grep | tee` pipeline, not a `( … ) &` subshell) on the very command whose exit status mattered most.
- **`narration_direction.md` really was edited mid-run**, exactly as the handoff warns it can be — I found the evidence (two raw files, one semantic attempt) by accident, deduplicating a regression script's own double-count, not by looking for it.

## What I could not verify

- **Whether the stretched audio actually sounds right.** Nothing in this pipeline can hear, by design — that's what the before/after folder below is for, and it needs the founder's ear, not mine.
- **Leaves 10–17 at this tempo**, at all — never attempted, blocked entirely on Leaf 9.
- **Who changed Leaf 9's payoff, when, and why.** I have the bounds (after the attach, at or before 2026-09-18T04:38:18Z) and the diff, not the provenance. Payload's version history would show it; Payload was down when I tried to read it, and it is the founder's dev server, not mine to start.
- **That Leaf 9's payoff is silent in the app.** I read it from `content.mapper.ts`; I did not run the backend or open the app on that slide.

## Device gate

**Absolute path, in `ZO-pipeline` as ever:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/vo4-before-after/` — 9 before/after pairs (18 files) plus a `README.md` with a table of speech wpm, overall wpm and longest pause per pair. **Leaf 11**, both narrators, all four slides — its Sadaltager scenario clip has the longest pause in the whole 144-clip set (1.17 s → 0.91 s), the clearest test of "do the pauses feel shorter, not just the words." Plus the set's single fastest clip (Leaf 10, payoff, Achernar: 215 → 278 wpm) and single slowest (Leaf 11's own takeaway, Achernar: 108 → 141 wpm — already inside the Leaf 11 set). 

**The two review tracks are not what the handoff pictured.** `narrate` builds `review/` from the clips a run rendered, and this run halted at Leaf 9, so `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/ikigai/audio/review/ikigai-narration-achernar.html` and `…/ikigai-narration-sadaltager.html` (each with its `.mp3` and `.md` beside it) now cover **Leaves 0–8 at ×1.3 only — 36 clips, 11:19 and 11:31.** The full-book tracks as they were before this package (72 clips, 29:11 and 29:52, at the model's own pace) are intact in `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/ikigai/audio/review-before-vo4/`, a copy taken before the first run. **`runs/` is gitignored and that copy is the only one — it should not be cleaned.** (An earlier commit of this entry called the new tracks the full ~28-minute ones; that was wrong.) They are reference, not something to sit through.

**Listen for:** whether it's "clearly faster, not rushed"; whether the pauses feel shorter, not just the words; any artefact — warble, doubled syllable, clipped consonant, a word that sounds different, named by clip; whether the takeaways still come to rest or feel cut off. Nothing here proves the sound — that's the founder's ear, not a table.

## Follow-ups for Architect

1. **Leaf 9's text needs a ruling, and the remainder is then one command.** Two ways, with what each costs:
   - **Keep the edit (my recommendation, Needs a ruling #1):** run `narrate --tempo 1.3` **without** `--no-synthesis`, ceiling set inline. Leaf 9's two payoff clips are synthesised (≈$0.03), everything else is cached. Leaves 0–8 report "already held" at $0; Leaves 9–17 are listened to (≈77 listens including retries on Leaf 12's scenario and Leaf 14's summary, ≈$0.21). **About $0.24 against $0.73 of headroom under the $2.75 ceiling** — an estimate from the ledger's own rates, not a measurement. This would also rebuild the review tracks for all 18 Leaves at ×1.3.
   - **Revert the text:** no synthesis; the live audio plays again as soon as the revert is published, and `narrate --no-synthesis --tempo 1.3` then carries on past Leaf 9 for the first time with no code change.
2. **Two small improvements to `narrate`, if you want them.** (a) Before the first paid listen of a Leaf, check that all eight of its raw clips are on disk (free); this run bought two listens on Leaf 9 before discovering its payoff wasn't. (b) A free, read-only **`--check-stale`**: list every slide whose attached `textDigest` no longer matches its Leaf's current text. I did this ad hoc with a 30-line script; it is what found Leaf 9 and what proved it is the only one. The underlying gap is that **nothing in the pipeline or the admin connects "text edited" to "audio stale"** — the only symptom is a silent slide and a backend warning.
3. **Should one drifted Leaf stop the whole run** — Needs a ruling #2. Recommendation: Leaf-local.
4. **`narrate` rebuilds `review/` from whatever it rendered**, so a halted run replaces the full-book tracks with a partial set (this one: 72 clips → 36). The originals are safe in `review-before-vo4/`, but it is a quiet way to lose a review. Minor; a name that carries the tempo and coverage, or refusing to shrink an existing review, would do.
5. **The pitch-measurement finding** (Part 5.2) is a property of `pitch_track`'s voicing threshold and a lower-pitched voice, not of this package's stretch — worth a look if `measure()`'s pitch fields are ever used to gate anything automatically, since a stretch (or likely any DSP step that changes frame boundaries) can move them without any audible change.
6. **The cost-ledger lock** (a register row, still open) is more pressing now than before ONBOARD-2.1 flagged it: this package ran real `narrate` invocations back to back by hand, and the remainder above is another one that must not race.

## Files touched

All under `apps/pipeline`; the one path outside it is this entry.

- **Source:** `src/zoomout_pipeline/assets/audio.py` (`change_tempo`, `require_tempo`, `shape_edges(..., tempo=...)`, the tempo constants) · `src/zoomout_pipeline/graph/narration_nodes.py` (`NARRATION_TEMPO`, `NarrationNotOnDiskError`, `tempo`/`no_synthesis` on `render_line`/`_render_attempt`, `RenderedClip.tempo`, the module docstring) · `src/zoomout_pipeline/cli.py` (`narrate --tempo`/`--no-synthesis`, the header, the review preamble) · `README.md` (the tempo row and the no-synthesis paragraph).
- **Tests, all new:** `tests/test_tempo.py` (Part 1, 68 cases) · `tests/test_narration_tempo.py` (Part 2's three traps plus the state/money checks, 22 cases) · `tests/test_no_synthesis.py` (Part 3, 7 cases) · `tests/test_tempo_defaults.py` (Part 4, 13 cases) · `tests/test_narrate_cli.py` (the command end to end as far as fakes reach, 7 cases).
- **Runs (gitignored, not part of this diff):** `runs/ikigai/audio/review/vo4-before-after/` (new, 19 files) · `runs/ikigai/audio/review/ikigai-narration-*.{mp3,md,html}` **rewritten** by the paid run, Leaves 0–8 only · `runs/ikigai/audio/review-before-vo4/` (new: a copy of the pre-VO-4 `review/`, the only copy of the full-book tracks — do not clean) · `runs/ikigai/audio/raw/` untouched (confirmed by tree hash) · `runs/ikigai/audio/final/` gained **72** files, the ×1.3 mp3s (144 → 216); the 144 accepted originals are byte-identical (tree hash `b08db153…` before and after) · `runs/ikigai/audio/snapshots/` gained **19** (36 → 55: one per attach call — Leaf 0's first run, the full pass's nine, the repeat's nine) · `runs/ikigai/audio/checks/` grew by 77 real listens (accounted for in Part 6).
- **Deliberately untouched:** `assets/speech.py`, `graph/greeting_nodes.py`, `assets/greeting.py`, `prompts/` (confirmed empty diff against `origin/main`), `packages/shared`, every other app.

---

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

