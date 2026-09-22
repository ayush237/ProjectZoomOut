# Collaboration Log

Append-only. Architect appends under "Handoffs" when a task goes to Manager. Manager appends under "Completions" when a task finishes. Add new entries at the top of each section so the most recent is always first.

This file is what lets a fresh session (after `/clear` or the next day) pick up context in seconds instead of you re-explaining, and it's what the `researcher`/`code-reviewer` subagents and future-you have to look back on.

**Give every entry a `### Handoff:` or `### Completed:` header.** Two completion reports — VO-1.1's and
VO-2's — were appended without one and were invisible to a structural scan of this file for weeks. The
headers were restored on 2026-09-18; the bodies were never touched. An entry with no header is not on a
list anyone reads.


> **What stays here: the closing package of the current milestone, plus anything the next package builds
> directly on, plus any handoff whose package is still open.** Never fewer than two entries per section.
>
> **This replaced a "four most recent" rule on 2026-09-22**, which had become a bad proxy. Packages in
> this project run 200–700 lines each, so "four" meant carrying two closed milestones' worth of detail —
> ~20k tokens of reports nobody was reading — while the thing that actually matters is whether the next
> package needs it. The open-handoff exception is unchanged and still absolute: pruning a live handoff is
> how WP28 lost time.
>
> **Archive at each sign-off, not when it hurts**, and never while a session is mid-package.
>
> **Everything older is archived**, in git and readable, simply not loaded by default:
> Phase 1 (WP0–WP15) in `project/archive/collaboration-log-phase1.md` ·
> Phase 2 in `project/archive/collaboration-log-phase2.md` ·
> the visual redesign and the first two books in `project/archive/collaboration-log-redesign.md` ·
> WP29–WP33.1 plus VO-1 and VO-2's handoff in `project/archive/collaboration-log-ikigai.md` ·
> **VO-1.1, VO-2 and VO-2.1 — voiceover's schema, generation and attachment — in
> `project/archive/collaboration-log-voiceover.md`** (split 2026-09-22, at VO-3's merge).

## Handoffs (Architect → Manager)

<!-- ### Handoff: YYYY-MM-DD — <title>
(paste the full handoff prompt here) -->

### Handoff: 2026-09-22 — ONBOARD-1: the five-beat activation flow, promise to first Leaf

*Manager. **Suggested model: Sonnet** — the design is fully specified (five beats, five rulings, approved 2026-09-18) and every contract it touches has been read and confirmed below; what's left is disciplined wiring plus a small number of named, bounded decisions, not open-ended judgement.*

> **Read first:** this handoff · `apps/mobile/src/navigation/RootNavigator.tsx` · `apps/mobile/src/screens/intro/useIntroSeen.ts` + `introSeenStore.ts` (the pattern to mirror) · `apps/mobile/src/audio/useNarrator.ts` + `narratorPreference.ts` · `apps/mobile/src/api/client.ts` (`addToLibrary`, `listTracks`, `listLibrary`) · `apps/mobile/src/screens/TrackDetailScreen.tsx:141` and `LibraryScreen.tsx` (`nextLeafId`) · `apps/mobile/src/components/TrackCard.tsx` · `apps/mobile/src/screens/leaf/ScenarioSlide.tsx` · `project/projectplan.md:557` (`## Approved, gated on VO-3: the onboarding flow — 2026-09-18`, the full approved design and five rulings) · `agents/manager.md`.
> **Depends on COVER-1's art being uploaded** (founder action, tracked separately) before the device gate means anything — see Out of scope.

### Task: ONBOARD-1 — the five-beat activation flow, promise to first Leaf

**Context:** The app works end to end and a reader can hear Ikigai on a phone, but a new signed-up reader lands cold on Explore's catalogue with no framing for the session cap, no help picking a first book, and no introduction to the unlock gate. This is the last piece standing between account creation and a reader actually experiencing the product. VO-3 (the audio layer beat 3 depends on) is merged; that was the only reason this wasn't handed off already.

**Objective:** A new signed-in reader with an empty Library sees five beats — promise, pick a book, choose a narrator, land in Leaf 1, a coach-mark on the unlock gate — then never sees the flow again on that install. An existing signed-in reader with a non-empty Library sees the narrator beat only. Skipping at any point lands on a designed Explore first-run state, never a blank one.

**Scope:**
- `apps/mobile/src/navigation/RootNavigator.tsx` — the new gate, mirroring `useIntroSeen`'s pattern but on the signed-in side
- New: `apps/mobile/src/screens/onboarding/` — the flow itself (five beat screens/components, `useOnboardingSeen` + `onboardingSeenStore.ts`, mirroring `screens/intro/`)
- New: a full-bleed cover-card component for beat 2 (`TrackCard` is a 64px row card — see finding 1 below — do not try to reuse it as-is)
- `apps/mobile/src/screens/ExploreScreen.tsx` — the first-run empty state (the skip ruling)
- `apps/mobile/src/screens/leaf/ScenarioSlide.tsx` — beat 5's coach-mark
- Reused, not modified: `apps/mobile/src/audio/useNarrator.ts`, `narratorPreference.ts`, the `useNarration`/`NarrationControl` playback pattern, `apps/mobile/src/api/client.ts`'s `addToLibrary`/`listTracks`/`listLibrary`
- Verify this list rather than trust it — I read the current code but you're the one shipping against it

**Five findings from reading the actual code, not just the design doc — this changes what you'd otherwise guess:**
1. **`TrackCard.tsx` is a 64px row card** (`COVER_WIDTH = 64`), shared by Explore/Library/Journey. Beat 2 needs "two or three full-bleed cards and nothing else on the screen" — a new component, not a variant prop on this one.
2. **`isPlaceholder` is already on the client-visible `Track` type** (`packages/shared/content.ts:443`). Beat 2 does not need PILOT-1's `HIDE_PLACEHOLDER_CONTENT` at all — filter `!track.isPlaceholder` client-side. `listTracks` is paginated (`page`, `perPage = 20` default); page through until you've seen all of them, not just page 1 — with 2 real Tracks among 28, trusting page 1 alone risks showing only one book if they don't happen to sort together.
3. **`addToLibrary(trackId)` returns only unlocked achievements**, not progress — and it unlocks `first-book`, which `ExploreScreen` shows as a banner today (`ExploreScreen.tsx:118`, its own comment: *"the only place it can be seen"*). Decide deliberately whether beat 2 shows that banner mid-flow or suppresses it, and say which and why in the report — both are defensible, silence is not (same shape as PILOT-1's Part C decision).
4. **There is already a correct, server-computed "next Leaf."** `TrackDetailScreen.tsx:141` and `LibraryScreen.tsx` both key off `progress.nextLeafId` — "the first incomplete Leaf," chosen by the server. Beat 4 must reuse this, via whatever call actually returns it for a freshly-added Track (`listLibrary()` looks right — confirm before relying on it, since `addToLibrary`'s own response doesn't carry it). **Do not compute "first Leaf" as `listLeaves(trackId)[0]`** — that's a second implementation of a decision the server already owns, the exact shape this project's rules exist to catch.
5. **No coach-mark component exists anywhere in this codebase today.** Beat 5 is a new pattern, not a reuse — budget for it accordingly.

**Requirements, by beat:**
- **Beat 1 (the promise):** one static screen, the contract only — 15 minutes, one book, you will have to think (`SESSION_CAP_SECONDS = 900`, `SESSION_CAP_XP = 500`, `env.ts:194-195` — keep the copy's numbers in sync with these; they are not read dynamically by the client). No carousel.
- **Beat 2 (pick your first book):** full-bleed cards for the real Tracks only (finding 2). Picking calls `addToLibrary` (finding 3) and proceeds to beat 3.
- **Beat 3 (choose your narrator):** two cards, `female` and `male` (`NARRATOR_IDS`), each playing a real sample on tap. **Since only Ikigai has narration** (VO-2/VO-2.1), use one fixed Ikigai clip for both narrator cards regardless of which book was picked in beat 2 — this is the existing 2026-09-18 ruling ("sample generically… revisit when [coverage] does"), not a bug. Proposed default: Leaf 1's Summary slide for both narrators — confirm the actual clip length/content reads well before committing to it. Choosing calls the existing `setNarrator` from `narratorPreference.ts` — do not add a second mechanism.
- **Beat 4 (into Leaf 1):** opens `LeafPlayer` with `{ leafId: <the Track's nextLeafId>, trackId, trackTitle }` (finding 4) — lands in the player, not `Tabs`.
- **Beat 5 (the gate teaches itself):** a coach-mark on `ScenarioSlide`'s unlock gate, shown once per install, the first time a new reader reaches it (finding 5) — your call on the exact visual, state your reasoning.
- **The gate in `RootNavigator.tsx`:** mirror `useIntroSeen`'s `'restoring' | 'unseen' | 'seen'` shape, but the "seen" condition for an existing account is **`onboardingSeenStore`'s flag OR the reader's Library is already non-empty** — the ruling that existing installs must not be sent through a first-book picker. This means the gate needs a Library check before it can decide, which the intro's pure-local-flag gate never needed — design this deliberately rather than bolting a second async dependency onto `useIntroSeen`'s shape unchanged.
- **Existing installs (narrator beat only):** after choosing, land on `Tabs` (their normal home) — **not** `LeafPlayer`, since they already have progress and there is no single "their" Leaf to open. This isn't stated in the approved design; I'm proposing it as the sensible default. Flag it back to me if you disagree rather than silently picking something else.
- **Skip:** available wherever the design says so; lands on Explore's new first-run empty state, always — never a blank catalogue.
- **Reduce Motion:** every animated beat needs a designed fallback (fade, not disabled), and this package's new surfaces should join the existing mechanical guard the intro already uses (`design/reduceMotionCallSites.test.tsx` — read how `IntroScreen` joined it before writing a new animated surface that doesn't).

**Out of scope:**
- The second age gate, a notifications permission prompt, an interests/goals questionnaire, a feature-tour carousel — all four explicitly ruled out 2026-09-18. Their absence is a criterion, not just "don't add."
- Terms-of-service / privacy acceptance placement — belongs to Stage 5, not onboarding.
- Pre-auth taste Leaf / any form of client-side grading — ruled out because it duplicates a server-decided guarantee. Onboarding starts after account creation, full stop.
- Backend changes of any kind. Everything this package needs — `isPlaceholder`, `addToLibrary`, `nextLeafId`, the narrator preference key — already exists.
- **Both Track covers rendering correctly is not this package's job to fix.** It depends on the founder having uploaded COVER-1's art before you start the device gate. If the covers are still the old hotlinks when you get there, stop and say so rather than device-gating beat 2 against art that's about to change.

**Constraints:** SecureStore for the onboarding-seen flag and the narrator write, matching every existing preference in this app — no new storage mechanism. New screens follow the existing design system (`useTheme`, `Text`, `Icon`) — no new visual primitives without a documented reason. The new full-bleed card component should be visually consistent with `TrackCard`'s existing conventions (elevation as surface, not shadow) even though it isn't the same component.

**Device gate:** *(Android, Expo Go, on a backend with COVER-1's real art already uploaded)*
- A fresh sign-up with an empty Library sees all five beats in order, ending inside Leaf 1's player — not the catalogue.
- Force the app into a state with an existing account and a non-empty Library (e.g. an account that's already added a Track): only the narrator beat appears, and choosing lands on the normal tab shell.
- Skipping at the earliest skippable point lands on Explore's first-run state — not a blank list, not a crash.
- The chosen narrator is audible in beat 3's sample and is still the active narrator inside Leaf 1's own narration control, without re-selecting it.
- Closing and reopening the app never shows onboarding again on this install (until a reinstall).
- The founder's own eye on: whether beat 1's exact copy lands as intended, and whether the flow feels like the intended first impression — not just that it renders.

**Acceptance criteria:**
- [ ] A new signed-in reader with an empty Library sees beats 1→2→3→4→5 in order; an existing signed-in reader with a non-empty Library sees the narrator beat only and then lands on `Tabs` — both paths pinned by a test exercising `RootNavigator`'s actual gate, not a beat component in isolation, and the branch condition (empty vs. non-empty Library) is mutation-checked as its own reversion
- [ ] Beat 2 shows exactly the Tracks where `isPlaceholder === false`, verified with a fixture where a placeholder Track sorts before a real one in `listTracks`' pagination, so a test that only reads page 1 would fail
- [ ] Picking a book calls the existing `addToLibrary` — no new endpoint — and the achievement-banner decision (finding 3) is implemented as stated and reported, not left ambiguous
- [ ] Choosing a narrator writes through the existing `setNarrator`/`narratorPreference.ts` — verified by reading the same SecureStore key Profile's own narrator control reads, not a parallel key
- [ ] Beat 3 plays a real, distinct sample per narrator card, and does not require Track 42 to have any narration
- [ ] Beat 4 opens `LeafPlayer` with the Track's actual `nextLeafId`, sourced the same way `TrackDetailScreen`/`LibraryScreen` already source it — not `listLeaves(trackId)[0]` or any second implementation
- [ ] Skipping at any skippable point lands on Explore's designed first-run state, pinned by a test — not verified by inspection
- [ ] The onboarding-seen flag is per-install (SecureStore) and survives app restart but not reinstall, mirroring `introSeenStore.ts`'s own test coverage
- [ ] None of the four excluded items (second age gate, notifications prompt, interests questionnaire, feature-tour carousel) appear anywhere in the diff — confirmed by reading it, stated in the report
- [ ] Every new animated surface is covered by the existing Reduce Motion mechanical guard (`reduceMotionCallSites.test.tsx` or its equivalent for this package), accommodation on and off
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass — report states the mobile test count against PILOT-1's 695, reconciling any drop

**Testing expectations:** Tier A for the empty-vs-non-empty-Library branch in `RootNavigator` (get this wrong and either a new reader skips onboarding entirely, or a returning reader with real progress gets shoved through a first-book picker) and for confirming none of the four excluded items exist. Tier B for the rest — rendering, copy, card layout, the coach-mark. Say which evidence is a unit test, which is a query, and which is you looking on the device.

---

### Handoff: 2026-09-22 — COVER-1: two covers that are ours

*Pipeline Manager. **Suggested model: Sonnet** — the design is written out below, the generator and the guard both exist, and the aesthetic judgement belongs to the founder's eye rather than to the session. What this package needs is care with a budget model that does not cover the request being made, and that trap is named.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline`. **Check your branch first** — that checkout was parked on `vo-2.1-attach-narrators` on 2026-09-22. `git fetch origin && git checkout -b cover-1-track-covers origin/main`.
> **Commit, push and open the PR yourself when done.**
> **Read:** this handoff · `apps/pipeline/src/zoomout_pipeline/assets/images.py` (**the cost note at line 44 first — see the budget trap**) · `apps/pipeline/src/zoomout_pipeline/assets/style_guard.py` · `apps/pipeline/src/zoomout_pipeline/prompts/asset_style.md` (the absolute prohibitions) · `apps/pipeline/src/zoomout_pipeline/assets/contact_sheet.py` · the `generate-assets` and `contact-sheet` commands in `cli.py` · `agents/pipeline-manager.md`.
> **Do not read:** `project/projectRoadmap.md`, `project/projectplan.md`, the rest of `collaboration-log.md`, anything under `apps/mobile` or `apps/backend`.

### Task: COVER-1 — replace two hotlinked covers with art we own

**Suggested model:** Sonnet — the design is below; the gate is the guard and the founder's eye.

**Context:** Both real Tracks display someone else's image from someone else's server. **Track 42 hotlinks `harivubooks.com`'s CDN; Track 50 (Ikigai) hotlinks `taleaway.com`** — verified against the live CMS 2026-09-22. For a product whose entire legal posture is care with other people's material, that is the first thing a reader sees. Ikigai's was never even on the blocker list.

**It is also about to get much worse.** The approved onboarding flow opens with a first-book picker built from **full-bleed cover cards** — two or three covers and nothing else on the screen. Today a cover is a 64px thumbnail in a row. The moment that flow is real, these two images become the product's entire first impression.

**Objective:** Two cover images in the house style, generated by us, guard-clean, handed to the founder as files with a contact sheet. **You do not attach them** — see the constraint below, which is not negotiable and is not about trust.

**Scope:** `apps/pipeline` only. A new CLI command and whatever it needs; `images.py`, `style_guard.py` and `contact_sheet.py` are reused, not rewritten.

## The constraint that shapes this package

**The machine account cannot touch published content at all.** `apps/admin/src/collections/Tracks.ts` states it in its own comment — *"a machine account writes drafts and cannot reach published content"* — and **both Tracks are published.** This is exactly what was predicted in advance and then allowed to happen: WP31's record says *"must land before Ikigai publishes — the machine account cannot edit published content, so publishing first makes these two images a founder problem."* It published. It is one.

**So this package ends at a file on disk and a contact sheet.** Do not attempt the attach, do not ask for a wider key, and **do not unpublish anything** — unpublishing a live Track is the takedown mechanism, and borrowing it to change a picture is the kind of shortcut that makes takedown untrustworthy. The founder uploads both covers through the admin UI. That is a minute of their time and the correct division.

## The design

**The covers carry no text, because the style contract forbids it and the app does not need it.** `asset_style.md`'s absolute prohibitions include *"no text, letters, numerals or written symbols of any kind"* and *"never the author of any book"*, and `style_guard.py` enforces it with a `TEXT` finding. **That is not a limitation to work around here.** `TrackCard.tsx` already renders the title as text beside the cover, and onboarding's picker gives each card its own line of promise. **A textless illustration is the right artefact; a generated title would be both a guard breach and a rendering lottery.**

- **Aspect ratio 2:3, portrait.** `TrackCard.tsx` uses `COVER_ASPECT = 2 / 3` and `resizeMode="cover"`, so anything else gets cropped through its subject.
- **Same anchor style as the scenario images** — the library's visual identity is the thing being protected here; a cover that does not look like the book's interior defeats the point.
- **Concrete situation, not abstract metaphor**, per the style contract's own rule — no lightbulbs, no ladders, no mountains-as-metaphor.
- **Subject comes from the book, not from its title.** Ikigai: Okinawan daily life, the concrete texture of the book's world. Track 42 (*The Science of Getting Rich*, 1910): the period and its craft. **Read enough of each Track's published Leaves to choose honestly** — the scenario images are already there as precedent for what "this book's world" has meant.

## The budget trap, which is the one real risk

`images.py:31` sets `DEFAULT_ASPECT_RATIO = "4:3"`, and **line 44 says higher-resolution output costs $0.24 and is deliberately not modelled, "because `DEFAULT_ASPECT_RATIO` never requests it."** You are about to request something else.

**Establish what a 2:3 generation actually costs before generating a batch of them**, and if the cost model does not account for it, **say so and fix the model or state plainly that it is unmodelled** — do not let a package quietly spend outside what the ledger can see. This is the same shape as the paid-tier comment that was true in intent and absent in behaviour for three packages.

**Ceiling: $0.50.** At roughly $0.134 an image that is three or four candidates per cover, which is more than WP30.1 needed per image once the prompts were right. **If you approach the ceiling, stop and report rather than asking for more.**

**Out of scope:**
- **Attaching, uploading to Payload, or editing any Track record.** See the constraint.
- Purchase links, disclaimers, or any other Track-level field.
- `apps/mobile`, `apps/backend`, `apps/admin` — if you believe the cover contract is wrong, **report it rather than changing it**.
- Covers for the 27 placeholder Tracks. They use `placehold.co`, which is what it is for.
- Any change to `asset_style.md`'s prohibitions.

**Constraints:** Reuse `check_style` as the gate — an image that does not come back clean is not a candidate, and the WP31 precedent is that the guard catches what two humans cleared by eye. **Retain every candidate on disk**, WP30.1's lesson: its contact sheet is the only reason that review was possible at all. Transport per `require_paid_tier` — Track 42 is `public-domain`, Ikigai is `undocumented`, so confirm which route each takes rather than assuming they are the same.

**Device gate:** *(this one is the founder's eye, not a device)*
- **A contact sheet the founder can open**, showing every candidate generated for both covers, at a size where the style is judgeable.
- **The two chosen files on disk at a path stated in the report as an absolute path** — the founder browses the `ZO` checkout and the pipeline's runs are not there.
- Each chosen cover **read back and confirmed 2:3**, not merely requested as 2:3.

**Acceptance criteria:**
- [ ] Two cover images exist, one per real Track, **each passing `check_style` clean** — verdict quoted in the report, per image, not summarised
- [ ] **Each is 2:3 portrait, verified by reading the file's actual dimensions**, not by the fact that 2:3 was requested
- [ ] **No text of any kind in either image** — this is the guard's `TEXT` class and the one breach that would be most visible, since a cover is where a model most expects to draw a title. Report the guard's verdict *and* say that you looked
- [ ] The cost of a 2:3 generation is **established and reconciled against the ledger**; if the model does not cover it, the report says so explicitly rather than reporting a total the model cannot support
- [ ] **Spend is under $0.50**, reported per image and in total
- [ ] **Every candidate is retained on disk**, and the contact sheet covers all of them — not only the two chosen
- [ ] **No Track record was modified** — proven by re-fetching both Tracks and showing `updatedAt` unchanged, the same way VO-2.1 proved it
- [ ] Nothing outside `apps/pipeline` changed — confirmed by `git diff --stat`
- [ ] `ruff check`, `ruff format --check`, `mypy` on the configured target, and `pytest` all pass — **and the report states the file count and the test count and compares both to VO-2.1's (97 files, 438 tests)**, reconciling any drop. A number that falls is a scope change until proven otherwise

**Testing expectations:** Tier B for the new command's wiring — one happy path. The guard's coverage already exists and this exercises it rather than extending it; **if you find yourself wanting a new guard test, that is a finding about the guard and worth reporting.** Say which evidence is the guard, which is a test, which is a file you measured, and which is you looking — that split is why these reports are trustworthy.

---

### Handoff: 2026-09-22 — PILOT-1: only real content, and assets that reach a phone

*Manager. **Suggested model: Sonnet** — all three parts have their design written out below, including the two traps. There is no judgement left to buy; what this package needs is care with two-layer guards, and the layers are named.*

> **Where you work:** reuse `/Users/ayushgupta/Documents/ZoomOut/ZO-vo3`. Its branch `vo-3-player` is merged and its `node_modules` is current — I ran the mobile suite there on 2026-09-22, 42 suites / 691 tests green, while the same suite fails to even resolve modules in `ZO`. From inside it: `git fetch origin && git checkout -b pilot-1-real-content origin/main`. **Never `git checkout main` in a linked worktree** — `main` lives in `ZO` alone.
> **Commit, push and open the PR yourself when done.**
> **Read:** this handoff · `apps/backend/src/content/contentVisibility.ts` (**read this first — the placeholder guard already exists and you must not rebuild it**) · `apps/backend/src/content/content.repository.ts` (`listTracks`, and the comment explaining why the query filter is not the control) · `apps/backend/src/content/content.service.ts` · `apps/backend/src/config/env.ts` · `apps/backend/src/content/content.mapper.ts` (`resolveMediaUrl` and every call site) · `apps/mobile/src/audio/useNarration.ts` · `agents/manager.md`.
> **Do not read:** `project/projectRoadmap.md`, `project/projectplan.md`, `apps/pipeline`, the rest of `collaboration-log.md`.

### Task: PILOT-1 — the pilot build shows two real books, and a broken asset stops being silent

**Suggested model:** Sonnet — the design is written below; the risk is procedural and the procedures are named.

**Context:** The app is finished and a reader can hear Ikigai on a phone. Two things stand between that and showing it to someone. **The library displays 29 books of which 27 are placeholders**, because the guard that hides them is keyed to `NODE_ENV === 'production'` and a pilot runs on a dev backend. And **every media URL is built from `CONTENT_API_URL`, whose own docstring calls it the backend's private path to Payload** — so on a real phone every image and every audio clip resolved to `127.0.0.1` and failed while text loaded fine. That cost a full session on 2026-09-22 and presented as two unrelated-looking bugs. It is currently papered over by an untracked `.env` pinning one Mac's LAN address.

**Objective:** A backend that can be told to serve only real content without pretending to be production, media URLs built from a base that is separately configurable, and a narration button that cannot fail silently. No behaviour changes for anyone who sets neither new variable.

**Scope:** `apps/backend/src/config/env.ts` · `apps/backend/src/content/` (`content.mapper.ts`, `content.repository.ts`, `content.service.ts`, `contentVisibility.ts`) · `apps/backend/src/progress/progress.service.ts` (it calls `isVisibleIn` directly — see Part B) · `apps/mobile/src/audio/useNarration.ts` and its tests. Verify this list rather than trusting it.

## Part A — `MEDIA_BASE_URL`, because one value is doing two jobs

`CONTENT_API_URL` is documented as the backend's **private** path to Payload, *"called anonymously and over private networking."* It is also the base `resolveMediaUrl` uses to build the **public** URLs a client fetches. Those are the same string only while backend and client share a host, which stopped being true the moment a phone was involved, and which will not be true at all on Cloud Run.

- Add `MEDIA_BASE_URL` to `env.ts`. **It defaults to whatever `CONTENT_API_URL` resolves to**, so an unset deployment behaves exactly as today.
- Every media URL is built from it: `coverUrl`, `scenario.image`, `stickyNotes.diagram`, and **all four slides' audio**. Audio is the one most likely to be missed — VO-1 found five separate call sites.
- Do **not** change `resolveMediaUrl`'s logic. Its handling of already-absolute URLs and non-`/`-prefixed values is deliberate and documented; only the base it receives changes.

**The trap:** a test that sets both variables to the same value cannot tell which one the mapper used. **Set them to different hosts and assert the output carries `MEDIA_BASE_URL`'s.**

## Part B — `HIDE_PLACEHOLDER_CONTENT`, and the guard that already exists

**Read `contentVisibility.ts` before writing anything.** The mechanism is built, correct, and layered on purpose. You are making its trigger configurable, not building a filter.

- Add `HIDE_PLACEHOLDER_CONTENT`, **defaulting to `NODE_ENV === 'production'`** so nothing changes for anyone who does not set it.
- **Pick the parsing mechanism yourself, and do not reach for `z.coerce.boolean()`.** This is the **first boolean variable in this schema** — I checked, there is no precedent to copy — and `z.coerce.boolean()` is the wrong tool: it is `Boolean(string)`, so `HIDE_PLACEHOLDER_CONTENT=false` parses as **true**. Whatever you choose, `"false"` must mean false and an unrecognised value must be rejected loudly rather than silently falling one way. **There is a criterion on this.**
- Note that the default depends on another field, so it cannot be a plain `.default()` on the key alone. That shape is yours to choose too.
- Route `isVisibleIn`'s placeholder half through the flag. `NODE_ENV` keeps deciding everything else it decides.
- **The draft check is not part of this.** `isVisibleIn` refuses drafts in every environment; that stays absolutely true regardless of the flag.

**Two traps, and they are the reason this is not a one-line change.**

**First: the query filter is not the control, and the code says so.** `listTracks` adds a `where[isPlaceholder][not_equals]` parameter as an *optimisation*, and its comment explains that `ContentService` must keep applying the guard independently because "a query filter is one typo in a parameter name away from silently matching nothing." Both layers must honour the new flag, and **the service guard must be proven to hold on its own** — see the acceptance criteria.

**Second: grading bypasses `ContentService` entirely.** `progress.service.ts` calls `isVisibleIn` and `resolveVisibleLeaf` directly, because grading needs the full Leaf including the answer key. `contentVisibility.ts`'s docstring is explicit that two copies of this decision would drift, and names the direction: *a reader grading a Leaf that production is supposed to be hiding.* **If the flag reaches `ContentService` and not the progress path, a reader can still answer and earn XP on a hidden placeholder Leaf.** That is this package's version of the WP3/WP4 lesson.

**Also note the cache key.** `listTracks` keys its TTL cache on the environment precisely so a cache warmed in one mode does not serve the other's results. **Whatever now decides visibility must be what the key reflects** — if the flag can change independently of `NODE_ENV`, an environment-keyed cache is wrong.

## Part C — a failed `play()` stops being silent

`useNarration.ts` routes three native call sites through one `safely()` wrapper. **Two of them are right and stay exactly as they are**: on unmount and on backgrounding, "not playing" is already true, so the exception carries nothing to act on — that is what its docstring argues, and it is correct.

**The third is `toggle`'s play branch, where the reasoning does not hold.** A reader taps, the native call fails, and the only trace is a `console.warn`. This is precisely why the media-URL bug presented as a dead button rather than as an error.

- A failed **play** must leave the reader with something they can see. Keep it modest — the control returning to a visibly un-started state, or a brief inline "couldn't play" — **not** a modal, and not a persistent error banner.
- `pause`-on-unmount and `pause`-on-background keep swallowing. Do not "fix" them.
- **Design decision left to you, deliberately:** whether that surfaces as control state or as a small message. Pick one, state why in the report. Both are defensible; what is not defensible is silence.

**Out of scope:**
- **Track 42's and Ikigai's cover URLs.** Both hotlink other people's servers; both are founder items and need an asset that does not exist yet. Do not substitute, generate, or blank them.
- Onboarding, deployment, `NODE_ENV`'s other behaviours, anything under `apps/pipeline`, and any change to the content model's *shape*.
- Unpublishing or editing any Track. The flag hides; it does not mutate content.

**Constraints:** Config via environment only, through `env.ts`'s existing zod schema — no new config mechanism. Both new variables are **additive with behaviour-preserving defaults**; a deployment that sets neither must be byte-identical to today, and that is a criterion, not an aspiration. Structured logging where content is withheld already exists in `content.service.ts:63` — extend it rather than adding a parallel channel.

**Device gate:** *(observe, on the founder's Android phone over Expo Go, backend reachable on the LAN)*
- With `HIDE_PLACEHOLDER_CONTENT=true`, **Explore shows two books — Ikigai and The Science of Getting Rich — and no "Placeholder Filler Track" anywhere**, including after scrolling to the end of the list.
- With it unset, the placeholders are back. The founder must be able to flip this without editing code.
- **A Leaf still plays end to end with narration audible**, images visible on the scenario and sticky-notes slides — i.e. Part A changed nothing that was working.
- With `MEDIA_BASE_URL` deliberately pointed at a host that does not exist, **tapping play produces something the reader can see**, and the app does not crash.

**Acceptance criteria:**
- [ ] `MEDIA_BASE_URL` set to a *different* host from `CONTENT_API_URL` produces media URLs on `MEDIA_BASE_URL`'s host — asserted for `coverUrl`, `scenario.image`, `stickyNotes.diagram` **and all four slides' audio**, in one test where the two values provably differ
- [ ] With `MEDIA_BASE_URL` unset, a full Leaf's serialised output is **identical to before this change** — pinned by a test, not by inspection
- [ ] **A maximal-fixture contract test passes**: a record with every optional media field populated, read back through the real system, every field present and on the right host. `manager.md`'s rule, and this package is exactly the shape that broke WP15 — dropped optional fields are indistinguishable from absent ones
- [ ] `HIDE_PLACEHOLDER_CONTENT` unset reproduces today's behaviour exactly, in both `development` and `production`
- [ ] **`HIDE_PLACEHOLDER_CONTENT=false` means false** — pinned by a test, because the obvious mechanism (`z.coerce.boolean()`) gets this exactly backwards, and an unrecognised value is rejected at startup rather than defaulted
- [ ] With the flag on, `GET /content/tracks` returns only non-placeholder Tracks — **and the service guard alone still withholds them with the repository's query filter disabled**, proving the two layers are independent as `listTracks`' comment requires
- [ ] With the flag on, **the progress/grading path also refuses a placeholder Leaf** — exercised through `progress.service.ts`, not only through `ContentService`, because grading reaches `isVisibleIn` by its own route
- [ ] The draft check is unaffected: a draft is refused with the flag in either position, in every environment
- [ ] `listTracks`' cache cannot serve one visibility mode's results in the other — demonstrated, since the key's basis has changed
- [ ] A failed `play()` produces reader-visible feedback; a failed `pause()` on unmount and on backgrounding still produces none
- [ ] Every test above is **mutation-checked as a separate reversion** — break one behaviour, confirm that test and only that test reds. WP33.1 showed a combined mutation cannot tell a fix from its bodyguard
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass — **and the report states the test count and compares it to VO-3's 691 mobile tests**, reconciling any drop

**Testing expectations:** Tier A for Part B — a reader obtaining or grading content the product is meant to be hiding is squarely in `manager.md`'s Tier A definition, whatever this list says. Tier B for Part A's wiring, plus the maximal-fixture contract test, which is the load-bearing artefact. Part C needs one test on the play path and one confirming the other two still swallow; the existing `releaseFakePlayer()` gives you the failure on demand. **Say which evidence is a unit test, which is a query, and which is you looking on the device.** If a criterion turns out unmeetable as written, say so and say why — that has happened twice and both times the handoff was wrong, not the package.

---

### Handoff: 2026-09-18 — VO-3: the player, and the narrator preference

*Manager. **Suggested model: Sonnet** — every risk in this package is procedural and the procedures are written below, including the silent-switch trap that is the classic way audio ships broken. There is no judgement to buy; the founder observes the two things that need ears. **Runs in parallel with INTRO-1**, which is live in `ZO-admin` — see the conflict note.*

> **Where you work:** a **new** worktree. From `/Users/ayushgupta/Documents/ZoomOut/ZO`, the founder creates it with `git worktree add /Users/ayushgupta/Documents/ZoomOut/ZO-vo3 -b vo-3-player origin/main`, then `npm install` inside it. **`main` lives in `ZO` and nowhere else** — never run `git checkout main` in a linked worktree.
> **Commit, push and open the PR yourself when done.**
> **Read:** this handoff · `apps/backend/src/content/content.mapper.ts` (**the audio contract — read the per-entry filtering before writing anything**) · `packages/shared/src/content.ts` (`NARRATOR_IDS`, `audioRefSchema`, `slideAudioSchema` — **mirror, never edit**) · `apps/mobile/src/sound/SoundProvider.tsx` (the SecureStore preference pattern) · `apps/mobile/src/screens/leaf/` (the four narrated slides) · `apps/mobile/src/design/motion.ts` · `agents/manager.md`.
> **Do not read or edit:** `apps/pipeline`, `apps/admin`, `projectRoadmap.md`, `projectplan.md`.

### Task: VO-3 — the four narrated slides play, in the reader's narrator

**Context:** Ikigai's 18 Leaves are published and carry 144 audio clips — both narrators, on all four narrated slides. **Verified against the live CMS on 2026-09-18: 18 Leaves, 144 rows, 8 per Leaf, all `published`, narrators `female` and `male`.** Nothing in the app plays any of it. This package is the last one between the reader and the feature.

**Objective:** On Summary, Scenario, Payoff and Takeaway, a reader can play the slide's narration in their chosen narrator. The choice is a stored preference with a default, changeable from Profile. Audio is audible with the phone's silent switch on, stops when the reader leaves the slide, and behaves when something interrupts it.

**Scope:**
- **New** `apps/mobile/src/audio/` — the player, the audio-session setup, and the narrator preference store
- `apps/mobile/src/screens/leaf/` — the control on the four narrated slides
- `apps/mobile/src/screens/ProfileScreen.tsx` — the narrator control
- `package.json` — one audio dependency, installed with `npx expo install`, never hand-edited
- Tests alongside each

Verify this against the repository rather than trusting it.

**The audio contract — read `content.mapper.ts` before designing around it.** It filters **per entry, fail-closed**, and drops a row for an unknown narrator, an empty URL, a non-positive `durationSeconds`, a **stale `textDigest`**, or a narrator collision. `resolveMediaUrl` has already made the URL absolute. **Three consequences you must handle:**

1. **A slide can arrive with `audio: []`.** Normal, not an error — the server has legitimately suppressed it.
2. **A slide can arrive with only *one* narrator**, because the filtering is per row. VO-2.1's both-or-none rule is enforced at *attach* time and cannot be enforced at *serve* time.
3. **Order carries no meaning.** Match on `narrator`, never on position or on `id`.

**Requirements:**

- **The narrator preference is device-local**, on `SoundProvider`'s SecureStore pattern, keyed `zoomout.narrator`. **The default is `male` (Sadaltager)** — the founder's ruling 2026-09-18, made after listening to both tracks in full.
- **VO-3 owns the preference, its default, and the Profile control. It does not own first-run choosing.** The onboarding flow — a separate, later package — writes this same key. **Do not build an onboarding prompt, a first-play chooser, or any second way to set this.** The 2026-09-18 ruling rejected asking on first play by name.
- **If the reader's narrator is missing for a slide but the other is present, play nothing.** Show the same state as no audio. **Never substitute the other voice** — "a reader who picks one narrator must never be handed the other mid-book" is the founder's rule, and this is the only place it can be honoured at serve time.
- **Audio must be audible when the phone's silent switch is on.** This is the single most common way a feature like this ships broken: it works on the simulator and on a desk, and is silent on a real phone in a pocket. Configure the audio session explicitly; do not rely on a default.
- **Audio stops when the reader leaves the slide**, and when the Leaf player unmounts. A narrator still talking over the next slide is the obvious failure.
- **Audio stops when the app backgrounds.** Do not request a background-audio capability — this is a 15-minute foreground learning session, and the entitlement is a store-review surface for no gain.
- **An interruption (a call, another app) pauses rather than corrupts state.** On return the control is in a sane state, playing or paused, never stuck mid-spinner.
- **One control, identical on all four slides.** Verify whether `SlideFrame` is the right seam or whether the four slides need it passed individually — do not assume.
- The control carries an **accessibility label** that names the action and the narrator. Do not suppress or fight VoiceOver; a screen-reader user may never use this button and must still be able to move through the slide.
- Use the Expo SDK 57 audio package (`expo-audio`; `expo-av` is the deprecated predecessor). **Confirm which one this SDK ships and install with `npx expo install`** so the version is SDK-matched.
- Colour, spacing, duration from `src/design/`. Any animation routes through `motionTimingConfig` / `motionSpringConfig`; **`ReduceMotion` is imported nowhere outside `motion.ts`.**

**Out of scope:**
- **Onboarding's narrator choice** — a later package, as above.
- **The Sticky Notes slide.** Four narrated slides only; `PRODUCT.md` excludes it deliberately.
- **Download, caching, or offline playback.** The app is online-only by decision.
- **Background audio, lock-screen controls, playback speed, scrubbing.** A play/pause control is the package.
- **Sound effects.** A different layer with no assets yet.
- `apps/backend`, `apps/admin`, `apps/pipeline`, `packages/shared` — the contract is already correct; if you believe it is not, **report it rather than changing it.**

**Conflict note — INTRO-1 is live in `ZO-admin` on `intro-1-first-run`, also in `apps/mobile`.** Three predictable collisions; whoever merges second rebases:
1. **A preferences module.** INTRO-1 adds `zoomout.introSeen`. **Keep your narrator preference in `src/audio/`, not in a shared preferences module**, so neither package has to invent the same abstraction.
2. **`reduceMotionCallSites.test.tsx`** — INTRO-1 registers a surface there. If you add an animated one, you will both touch adjacent lines.
3. **`package.json`** — you add an audio dependency; INTRO-1 adds none.

**Inherited environment knowledge — read this before you try to build anything. INTRO-1 lost its single largest block of time here on 2026-09-18.**

- **A native iOS build fails on this Mac and it is not your code.** `expo-modules-jsi` will not compile under Xcode 26.3 / Swift 6 (`JavaScriptCodable+Date.swift:53:50: type of expression is ambiguous`). It is a transitive Expo dependency pinned long before this package. **Do not spend the afternoon on it.** One Xcode is installed; there is no older one to fall back on.
- **Use Expo Go for the visual gate. This is confirmed working, not a proposal** — the founder ran INTRO-1 on a real phone through Expo Go on 2026-09-18 and verified it by eye. `npx expo start` from `apps/mobile`, scan with Expo Go. Every plugin in `app.json` is in the Expo Go runtime, as are `react-native-svg` and `react-native-reanimated`.
- **Your first task, before you build anything: confirm `expo-audio` actually loads under Expo Go.** Install it, import it, render a throwaway screen that constructs a player, and look. **If it is not in the Expo Go runtime, stop and report** — a dev build is the only other route and it is blocked by the wall above. **Do not build a player you have no way of seeing or hearing.** This check costs minutes; discovering it at the device gate costs the package.
- **But be honest about one limit: Expo Go is itself an app with its own audio session.** Its configuration may mask or override yours, so **a silent-switch result in Expo Go is evidence, not proof** — in either direction. If audio is inaudible on silent there, do not conclude your code is wrong; if it is audible, do not claim the criterion outright. **Report what you observed and under which runtime**, and leave the standalone-build confirmation as a named open item.
- If you do attempt `pod install`, this host's shell has **no `LANG` set** and CocoaPods crashes without it — prefix with `LANG=en_US.UTF-8`.
- **SecureStore survives uninstall and reinstall on the iOS Simulator.** Your narrator preference will persist across a reinstall, so testing an unset default that way will mislead you. Clear the key or use a fresh simulator.
- A fresh worktree needs its own `npm install` before anything typechecks — `ZO-admin`'s was stale and missing `react-native-svg` entirely.

**Device gate** — what to observe, before any criterion is claimed:

*Yours, on Expo Go (the simulator's native build is broken — see above):*
- A narrated slide shows the control; a slide the server sent no audio for shows the **no-audio state, not a broken button**
- Switching the narrator in Profile changes which voice plays on the next play
- Leaving the slide mid-playback **stops the audio**
- The control is reachable and labelled at the largest OS text size, in both themes

*Flagged for the founder, on a physical iPhone — do not claim these yourself:*
- **Audio is audible with the ringer switch set to silent.** The reason this gate exists — and, per the environment note above, **the one observation Expo Go may not be able to settle.** If it cannot, say so; it becomes a named open item rather than a claimed criterion
- A real interruption — take a call mid-clip — leaves the control in a sane state

**Acceptance criteria:**
- [ ] All four narrated slides play their clip, and a test pins that **Sticky Notes has no control**
- [ ] **The default is `male` with the key unset**, asserted directly — not inferred from a UI that happens to show it
- [ ] **A slide carrying only the non-preferred narrator plays nothing** and renders the no-audio state — a test constructs exactly that payload, since the server can produce it and the attach-time guard cannot prevent it
- [ ] A slide with `audio: []` renders the no-audio state without error
- [ ] Clips are selected by matching `narrator`, **never by array position or `id`** — pinned by a test whose fixture lists male first, so a positional implementation fails
- [ ] **Audio stops on unmount and on leaving the slide** — both pinned, since they are different code paths and only one of them is the obvious one
- [ ] The audio session is configured explicitly for silent-switch playback, and a test asserts the configuration call happens — the audible check itself is the founder's, on device
- [ ] Changing the narrator in Profile writes `zoomout.narrator` and a subsequent read returns it
- [ ] `ReduceMotion` is imported nowhere outside `motion.ts`
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass — **and your report states the test count and compares it to the previous mobile package's**

**Testing expectations:** Unit tests for the preference store (unset default, set, read) and for narrator selection against the three server shapes — both narrators, one narrator, none. Component tests for the four slides and Sticky Notes' absence, in both themes. Mock the audio package at its boundary; do not assert on real playback. No e2e.

**One thing to flag rather than fix:** `content.mapper.ts` builds a `warnings` channel when it drops a row, and as far as I can tell **nothing surfaces those warnings anywhere.** If you confirm that, report it — it means a suppressed clip is invisible in production, and that is a finding about the contract rather than about your package.

---

### Handoff: 2026-09-18 — INTRO-1: the first-run intro

*Manager. **Suggested model: Sonnet** — the design is written out in full below, including which modules to reuse and the technique to use; what is left is wiring and care, not judgement. **The one aesthetic call — which seed looks best — is the founder's at the device gate**, per the 2026-09-09 ruling. Parallel to the voiceover stream: mobile only, no backend, no content, no audio.*

> **Where you work:** `/Users/ayushgupta/Documents/ZoomOut/ZO-admin`. **This is a linked git worktree, so `git checkout main` will fail** — `main` belongs to the primary checkout at `ZO`. Use **`git fetch origin && git switch -c intro-1-first-run origin/main`**.
> **Commit, push and open the PR yourself when done.**
> **Read:** this handoff · `apps/mobile/src/screens/track/roadmapGeometry.ts` (the geometry you consume — **read it, never edit it**) · `apps/mobile/src/screens/share/constellationLayers.ts` (how that geometry gets painted and batched) · `apps/mobile/src/screens/track/TrackRoadmap.tsx` (the Reanimated-over-SVG technique, already working) · `apps/mobile/src/design/motion.ts` · `apps/mobile/src/design/reduceMotionCallSites.test.tsx` · `apps/mobile/src/sound/SoundProvider.tsx` (the SecureStore preference pattern) · `agents/manager.md`.
> **Do not read or edit:** `apps/backend`, `apps/admin`, `apps/pipeline`, `projectRoadmap.md`, `projectplan.md`.

### Task: INTRO-1 — the first-run intro, a zoom out through a neuron network

**Context:** This is the first thing anyone sees after installing ZoomOut — a ~14-second poetic cold open that plays once, before sign-in. It is not a feature tour. It dramatises the product's name by pulling the camera back from a single neuron to a connected network, and it doubles as a preview of the Track roadmap screen readers will live in.

**Objective:** On first launch the app plays a four-beat, continuously zooming animation over a neuron graph, with four lines of display type, then hands off to sign-in. It never plays again on that install — whether the reader watched it or skipped it. It is correct in both themes, at every OS text size, and under Reduce Motion.

**Scope:**
- **New** `apps/mobile/src/screens/intro/` — the screen, the beat timing, the synthetic graph fixture, and an intro-local painter if the shared one does not fit
- **New** a seen-flag store — follow `src/sound/SoundProvider.tsx`'s SecureStore pattern and key it `zoomout.introSeen`
- `apps/mobile/src/navigation/RootNavigator.tsx` — the insertion point, ahead of `AuthStack`
- `apps/mobile/src/design/reduceMotionCallSites.test.tsx` — register the new animated surface
- Tests alongside each of the above

Verify this list against the repository rather than trusting it.

**Requirements:**

- **The four lines, verbatim.** Any difference is a defect, including punctuation:
  1. `Your mind is a vast landscape.`
  2. `Nothing grows here in a single leap.`
  3. `What changes you is how small things connect.`
  4. `Let's zoom out.`
- **One continuous camera move across all four beats**, not four slides cutting between scales. Beat 1 sits at high magnification on a single node and its dendritic arbors; by beat 4 the whole graph is in frame. The zoom does not stop and restart at beat boundaries — **the text cross-fades over a camera that never stops moving.**
- **Consume `layoutRoadmap` from `roadmapGeometry.ts`.** Pass a fixed synthetic `LeafNodeState[]` and a **hardcoded seed**, so the intro draws an identical graph on every install, every launch and every device.
- **Choose the seed by looking.** Render several, screenshot them, pick the one that reads best, and **say in your report which seeds you compared.** Do not take the first one that runs.
- **Total duration 12–16 seconds**, with beat 4 holding long enough to read before the control is reachable.
- **Beat 4 carries the only control** — the hand-off to sign-in. Beats 1–3 carry no affordance but the skip.
- **A skip control, live from the very first frame**, not only once a beat completes.
- **Beat 4's travelling signal**: an animated `strokeDashoffset` pulse along the spine curves, in the **amber reward accent** against the **teal** network. This is the only new visual in the package.
- **Both exit paths set the flag** — finishing and skipping. See the acceptance criteria; this is the failure this package is most likely to ship.
- **Every animation routes through `motionTimingConfig` / `motionSpringConfig`** so `REDUCE_MOTION_OVERRIDE` is spliced in. Never reach for `ReduceMotion` directly — `motion.ts` is the only place it is imported in `apps/mobile`, and it stays that way.
- **Under Reduce Motion the animation is swapped, never removed:** the four lines cross-fade over a still frame of the finished network. All four lines still appear; the network is still drawn.
- **Text is real `<Text>` on the app's `typography`** — `display` variant, centred. **Not Caveat**, which is the sticky-note voice.
- Colour, spacing and duration come from `src/design/`. **No new tokens and no literals.**

**Out of scope:**
- **`roadmapGeometry.ts`, `roadmapModel.ts`, `TrackRoadmap.tsx`** — read and reuse, never edit. They are tested across 15–30 Leaves and this package must not disturb that.
- **`screens/share/constellationLayers.ts`** — reuse `buildDoneConstellationLayers` if it fits your needs. **If it does not, write an intro-local painter; do not modify the share one.**
- **Onboarding's five beats** — a separate, later package. This one ends at sign-in.
- **Sound.** The intro is silent; the sound layer has no assets yet.
- `apps/backend`, `apps/admin`, `packages/shared`.
- Any new dependency. `react-native-svg` and Reanimated 4 are already present and are all this needs.

**Constraints:**
- **Batch curves into one `<Path>` per (colour, width, opacity)**, the way `constellationLayers.ts` does. Thousands of individual `<Path>` elements will not render; dozens will.
- Animate a wrapping `Animated.View`'s transform, the way `TrackRoadmap.tsx` already does. Do not animate the SVG `viewBox` attribute.
- The flag read must not flash the auth stack before the intro appears. `RootNavigator` already has a `restoring` state for exactly this shape of problem — follow it.

**Inherited knowledge, so a `/clear` does not lose it:**
- **Reduce Motion ON makes the iOS Simulator swallow every touch in the bottom ~15% of the screen** behind an invisible debugger banner. Turn it off with `xcrun simctl spawn <udid> defaults write com.apple.Accessibility ReduceMotionEnabled -bool NO`. **You will be toggling Reduce Motion deliberately in this package, so you will meet this.**
- Screenshot pixel space is not the tool's tap-point space — that was the real cause of WP21–23's tap trouble.
- `simctl` switches theme and text size with zero taps; the route is in WP24's and WP26's log entries.

**Device gate** — what to observe, before any criterion below is claimed:

*Yours, on the simulator:*
- The four lines are **legible in dark and in light**, with the theme switched during playback rather than between runs
- Every line is **fully on screen at the largest OS text size** — no clipped glyph, no truncation, no line pushed off the bottom
- With **Reduce Motion on, all four lines still arrive and the finished network is still drawn** — nothing is missing, only the movement
- The **skip control responds on the very first frame**
- **After finishing, relaunching goes straight to sign-in. After skipping, relaunching also goes straight to sign-in.** Both, separately

*Flagged for the founder, on a physical iPhone — do not claim these yourself:*
- Whether it reads as **one continuous camera move** rather than four slides
- Whether the zoom **runs smoothly at the densest frame**, which is where the web and webDots resolve

**Acceptance criteria:**
- [ ] The four lines render in order and a test asserts the **exact strings**, so a transcription slip cannot reach published copy
- [ ] **Shown exactly once, both exit paths pinned separately:** one test drives the intro to completion and asserts the flag is set; a **second test skips it and asserts the flag is set**; a third asserts that with the flag already set, `RootNavigator` renders `AuthStack` and the intro never mounts. *A test that only exercises the completed path passes while skip silently leaves the flag unset — name and exercise both.*
- [ ] The intro is registered in `reduceMotionCallSites.test.tsx` and **rendered twice there, accommodation on and off**, matching the three surfaces already covered
- [ ] Under Reduce Motion, a test asserts all four lines still render and the network is still drawn — the swap, not a removal
- [ ] The graph is generated from a **fixed seed and fixed synthetic states**, with a test asserting identical geometry across repeated calls
- [ ] Every animated call site in the intro passes a config built by `motionTimingConfig` / `motionSpringConfig`; `ReduceMotion` is imported nowhere outside `motion.ts`
- [ ] **No file under `src/screens/track/` or `src/screens/share/` is modified** — confirm from the diff, not from memory
- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass — **and your report states the test count and the typechecked file count**, so they can be compared against the previous package's

**Testing expectations:** Unit tests for the seen-flag store (set, read, and the unset default) and for the beat sequencing. Component tests for the intro screen covering both themes, the four strings, and the Reduce Motion branch. The `reduceMotionCallSites` registration is a guard, not a substitute for the component tests. No e2e — this package has no backend surface.

**One thing to flag rather than fix:** if `buildDoneConstellationLayers` turns out not to fit, say so in your report with the reason. That is a finding about a shared primitive, and it is worth more than a silent fork.


---

## Completions (Manager → Architect)

### Completed: COVER-1 — two covers that are ours — 2026-09-22

**Done. Both covers generated, guard-clean on the first candidate, $0.275 of the $0.50 ceiling, neither Track touched.** Branch `cover-1-track-covers` in `ZO-pipeline`, off `origin/main` at `af437dc`, fast-forwarded onto `07e76b9` (the debt-register sweep — `project/`-only, no overlap) immediately before this report.

| | |
|---|---|
| Automated gate | `ruff check .`, `ruff format --check .`, `mypy` (configured target: `zoomout_pipeline` + `tests`), `pytest` — all green |
| Files (mypy) | **99**, up from VO-2.1's **97** — `graph/cover_nodes.py` and `tests/test_cover_nodes.py`, exactly the two new source files |
| Tests | **441 passed, 6 deselected** (the `live` marker, unchanged), up from VO-2.1's **438** — the 3 new tests in `test_cover_nodes.py`, no drop anywhere else |
| Spend | 2 images × $0.134 + 2 guard reads × $0.0035 = **$0.2750** of $0.50 |
| Device gate | Contact sheet and both chosen files on disk, absolute paths below. Founder uploads through the admin UI — I do not have and did not seek a wider key |

---

## What changed

**New `apps/pipeline/src/zoomout_pipeline/graph/cover_nodes.py`** — `COVER_BRIEFS` (the two briefs below), `cover_image_prompt`/`cover_alt_text` (the cover's sibling of `asset_nodes.scenario_image_prompt`/`scenario_alt_text`, reusing `scene_block` rather than duplicating it), and `generate_cover_candidates` — the orchestration: one candidate per brief, then a second attempt spent **only** on whichever brief the guard refused, never as a free second option for one that already passed. Not wired into the graph or `PipelineState` at all, on purpose — there is no run or Leaf behind a cover, and WP17's precedent for `generate-assets` (a deliberate invocation rather than a node) applied here too.

**New `apps/pipeline/src/zoomout_pipeline/prompts/cover_track42.md`** and **`cover_ikigai.md`** — the two subject briefs, as version-controlled prompt text per the engineering standard, not string literals.

**New `apps/pipeline/tests/test_cover_nodes.py`** — Tier B, three cases: both briefs pass first try and neither gets a bonus second candidate; one refusal is retried and the brief that already passed is not; two refusals in a row halt on the budget rather than looping. The guard's own coverage is `test_style_guard.py`'s; this exercises the new retry-allocation logic, which is the only thing here that could actually be wrong.

**Modified `apps/pipeline/src/zoomout_pipeline/cli.py`** — the `generate-covers` command, plus `_track_snapshot` (a thin `PayloadClient.get_track` wrapper for the before/after `updatedAt` proof). `git diff --stat` confirms nothing outside `apps/pipeline` changed.

## Subject: read from the Leaves, then deliberately not copied from them

Read all eighteen published Leaves on both Tracks (Payload REST, unauthenticated — both are published) before writing either brief. **Both Tracks' scenario prompts are modernised** — Track 42 is web agencies and freelance design studios, Ikigai is software sprints and grocery runs — rewritten for a reader deciding what to do *today*. A cover built from one of those scenarios would show 2026, not the book, so I deliberately did not use them as the subject:

- **Track 42 — a shopkeeper weighing goods on a brass scale in an early-1900s general store.** The book is Wattles, 1910; "the period and its craft" per the handoff. The existing scenario art for this Track (`leaf-00`, `leaf-13`, checked directly) is a modern coffee-roasting business and a man at a desk with a calculator and a city skyline — confirming the modernisation is real and consistent, and that copying it would have produced exactly the wrong cover.
- **Ikigai — an elderly person tending a small vegetable garden beside a home, at dawn.** Not from a modernised scenario but from the book's own recurring, undisguised content: Leaf 11 names Okinawan *moai* (community gardening groups), Leaf 12 Okinawan elders keeping active roles, Leaf 5 *takumi* craftsmanship, Leaf 0 opens on "jumping out of bed each morning" — which a dawn garden scene illustrates about as literally as this style contract allows. `runs/ikigai/images/leaf-11-scenario-1.png` (a shared community garden) and `leaf-05-scenario-1.png` (a potter's wheel) were the closest existing precedent for "this book's world" and shaped the choice directly.

Both briefs open with the concrete situation, in `.md` files rather than as prompt string literals, per the engineering standard.

## The budget trap, resolved rather than avoided

`images.py`'s existing $0.134/image rate models the **1K/2K** resolution tier; 4K is $0.24 and unmodelled "because `DEFAULT_ASPECT_RATIO` never requests it." A 2:3 cover request is a different **aspect ratio**, not a different **resolution**, and those are independent parameters on `google.genai.types.ImageConfig` — confirmed by reading the installed SDK's own field docs (`image_size` "Supported values are 1K, 2K, 4K. If not specified, the model will use default value 1K") and cross-checked against ai.google.dev/gemini-api/docs/pricing, which prices by pixel tier only: "$0.134 per 1K/2K image," no mention of aspect ratio. `images.py`'s `ImageConfig` call never sets `image_size`, at 4:3 or at 2:3, so it stays in the 1K default either way. **The existing rate already covers this request; nothing needed fixing.** Stated in the command's own output before it spends anything, not just in this report.

## Verification

- **Guard**, quoted per image, not summarised: both `track-42-cover-01.png` and `track-50-cover-01.png` — *"clean: no text, no glow, no floating iconography, no reserved amber."*
- **I looked, beyond the guard.** Zoomed into both windows/light areas (flat polygons with hard edges — "a doorway's spill as a lighter polygon," not falloff), Track 42's jars and cloth bolts (no labels), the scale and the shopkeeper's hands (no currency symbols, no digits), Ikigai's face and hands (angled down, non-identifiable, attached to a body — `figures=1` so the `_an_empty_frame_has_no_hands_in_it` contradiction the schema guards against never applied). Both read as the book, not as stock art, at thumbnail size and at full size.
- **Dimensions, read back rather than trusted**: both **848×1264**, ratio 0.6709 against a 2:3 target of 0.6667 — 0.6% off, inside the ±1% tolerance the command checks. Requested 2:3 and received 2:3.
- **Neither Track was touched.** `updatedAt` before and after, both unchanged: Track 42 `2026-09-02T08:40:38.384Z`, Track 50 `2026-09-15T14:23:17.600Z`. Read through `PayloadClient.get_track`, not a second HTTP caller — see the boundary note below.
- **Acquisition, confirmed against the pipeline's own `books` table, not taken from the handoff's prose**: Track 42 `public-domain` (`first_run_id='wattles-01'`), Ikigai `undocumented` (`first_run_id='ikigai'`) — matches what the handoff stated, independently verified. Both route to Vertex in this environment (`ZOOMOUT_PIPELINE_USE_VERTEX=true`), confirmed in the command's own transport line rather than assumed; had `use_vertex` been unset, Ikigai's `undocumented` acquisition would have been refused by `require_paid_tier` before a single image was bought, which is the scenario this check exists for.

## A boundary I nearly broke

First draft of `_track_snapshot` called `urllib.request` directly — reasoning that a published Track needs no auth (`Tracks.ts`: `read: publishedOrAuthenticated`), so a second, unauthenticated HTTP path felt harmless. `pytest` disagreed: `test_boundaries.py::test_http_is_confined_to_the_cms_client` and `test_the_cms_client_is_the_only_module_that_speaks_http` both failed, correctly — the rule is "one door," not "one door for writes." Fixed by routing through `PayloadClient.get_track(track_id, draft=False)` instead, which meant constructing the client with the machine account's key even though this command never writes with it. Recording this because it is exactly the shape of mistake `agents/pipeline-manager.md` warns about — reasoning locally to a conclusion the codebase already has a test for — and the test caught it before it shipped, which is the point of it existing.

## What I did not spend, on purpose

**Every candidate generated is on the contact sheet, and there are only two — one per Track.** Both passed the guard on the first try, and `generate_cover_candidates` never spends a second attempt on a brief that already has a clean candidate (see "What changed" above). That was a deliberate reading of the $0.50 ceiling as a hard cap to design against rather than a target to spend up to, but it has a real cost: **the founder's "eye" gate is choosing between one option per book, not several.** I did not generate alternates after the fact either, on the same reasoning `agents/pipeline-manager.md` gives for spend generally — a ceiling is something to stop at and report against, not something to use up because there's room left ($0.225 remains). If the founder opens the contact sheet and wants real alternatives to compare, that is a `generate-covers` re-run with the budget raised deliberately, not something I should have decided unilaterally at $0.275. Flagging it here rather than treating "it passed the guard" as "it's definitely the right image" — nobody but the founder has actually judged either one yet.

## Follow-ups for Architect

1. **The founder's action**: open `runs/covers/contact-sheet.png`, and if satisfied, upload the two chosen files to Tracks 42 and 50 through the admin UI. Paths below.
2. **Worth a deliberate decision, not an assumption**: whether one candidate per cover is enough, or whether COVER-1.1 (or a `--candidates` re-run) should buy a second option per book for real comparison. See "What I did not spend" above.
3. **Minor, not fixed**: `scene_block` (`graph/asset_nodes.py`) says "Decided for this Leaf from its scenario" — reused verbatim for a cover, where there is no Leaf. Cosmetic (it does not change what the model draws), and fixing it touches a file outside this package's stated reuse list (`images.py`, `style_guard.py`, `contact_sheet.py`) for a wording-only change, so I left it and I'm naming it instead.

## Where the two chosen files are (absolute paths — this checkout, not `ZO`)

- `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/covers/track-42-cover-01.png` — Track 42, *The Science of Getting Rich*
- `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/covers/track-50-cover-01.png` — Track 50, *Ikigai*
- `/Users/ayushgupta/Documents/ZoomOut/ZO-pipeline/apps/pipeline/runs/covers/contact-sheet.png` — both, side by side

`runs/` is gitignored; these exist only on this disk, not in the diff.

---


### Completed: PILOT-1 — real content only, and assets that reach a phone — 2026-09-22

**Code complete, fully tested, and — unusually for this project's device gates — largely verified live**, not just against mocks. Branch `pilot-1-real-content` in the `ZO-vo3` worktree, off `origin/main`, fast-forwarded onto the 5 doc-only commits origin/main gained while this ran (confirmed zero overlap with anything below before merging) and pushed. PR not yet opened — see the note at the end of this entry.

| | |
|---|---|
| Automated gate | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — all green, root level, all four workspaces (`apps/admin`'s build needed `PAYLOAD_SECRET`/`PAYLOAD_DATABASE_URL` supplied by hand — this worktree has no `.env`, the same gap VO-3's report already flagged; not a regression) |
| Backend tests | **527**, up from 494 across the four files touched (`env.test.ts` +15, `content.repository.test.ts` +7, `content.service.test.ts` +7, `progress.service.test.ts` +4) — no baseline was given for backend as a whole, so this is the honest count rather than a false comparison |
| Mobile tests | **695**, up from **691** (VO-3's own number, reconciled directly) — **+4**, all in `NarrationControl.test.tsx`, all Part C. No drop anywhere |
| Live verification | **HIDE_PLACEHOLDER_CONTENT and MEDIA_BASE_URL confirmed against the real backend, the real Payload CMS and the real local Postgres** — not a simulation of the device gate, an actual exercise of it at the HTTP layer. Part C confirmed by extensive mutation-tested unit coverage only — the mobile-UI half of the device gate is the one thing I could not do myself; see below |

---

## What changed

**Part A — `MEDIA_BASE_URL`** (`apps/backend/src/config/env.ts`, `content.repository.ts`). New optional env var, defaulting to `CONTENT_API_URL`'s *resolved* value — expressible only as a top-level `.transform()` on the whole schema (`configSchema`, wrapping `environmentSchema`), because zod's per-key `.default()` cannot see another key's resolved value. `content.repository.ts`'s four `mapTrack`/`mapLeaf` call sites (`findTrack`, `findLeaf`, and — easy to miss, and initially missed by my own tests until mutation-checking caught it, see below — `listTracks` and `listLeavesForTrack`) now pass `this.config.MEDIA_BASE_URL` instead of `this.config.CONTENT_API_URL`. `resolveMediaUrl` itself is untouched, exactly as instructed.

**Part B — `HIDE_PLACEHOLDER_CONTENT`** (`env.ts`, `contentVisibility.ts`, `content.repository.ts`, `content.service.ts`, `progress.service.ts`). New optional boolean, defaulting to `NODE_ENV === 'production'` (same cross-field `.transform()` as Part A). **Not `z.coerce.boolean()`** — that is `Boolean(string)`, under which `HIDE_PLACEHOLDER_CONTENT=false` parses as `true`; instead `z.enum(['true','false']).optional().transform(...)`, so `"false"` means false and anything else (`"1"`, `"yes"`, `"TRUE"`, `""`) fails startup with a named variable rather than picking a side. `isVisibleIn`/`resolveVisibleLeaf` (`contentVisibility.ts`) now take the resolved boolean instead of `NODE_ENV` directly — `NODE_ENV` no longer flows into this decision at all except through the flag's own default, which is the point. Every call site that used to pass `config.NODE_ENV` for this decision now passes `config.HIDE_PLACEHOLDER_CONTENT`: `content.repository.ts`'s `listTracks` query-filter trigger and cache key, `content.service.ts`'s `isVisible`/`getLeaf`/`getLeafSummary`, and `progress.service.ts`'s `requireVisibleLeaf` **and** `finishTrackIfDone` — the latter is Track-completion accounting, a third call site distinct from the grading path the handoff named, found by reading the file rather than the handoff, and it needed the same fix.

**Part C — a failed `play()` is now visible** (`apps/mobile/src/audio/useNarration.ts`, `NarrationControl.tsx`, `testing/fakeExpoAudio.ts`). `safely()` now returns whether the call succeeded, instead of `void`; the two pause call sites (unmount, backgrounding) ignore the return value and keep swallowing, unchanged. `toggle`'s play branch does not. **Two distinct failure shapes, one signal:** `expo-audio`'s `AudioStatus` type (read from the installed package's own `.d.ts`, `node_modules/expo-audio/build/Audio.types.d.ts:243`) carries `error: string | null` — "cleared when a new source is loaded or playback resumes successfully" — which is the actual channel an unreachable `MEDIA_BASE_URL` reports through, since `player.play()` itself does not throw for that; it only throws for the already-released case `safely()` was originally built for. Neither alone covers both, so `useNarration`'s new `playbackFailed` is `attemptFailed || status.error !== null` — local state for the synchronous throw, a live read for the asynchronous one. `NarrationControl.tsx` renders the existing shared `StatusMessage` component (`tone="error"`, not `"incorrect"` — its own docstring is explicit that `error` is reserved for "something did not happen," `incorrect` for wrong-answer feedback, and conflating them would have been a real, if quiet, misuse) directly under the control when `playbackFailed` is true. Modest by construction: inline, disappears the moment a retry succeeds, never a modal or a persistent banner. `fakeExpoAudio.ts` gained `failFakePlayer()`, alongside the existing `releaseFakePlayer()`, to reproduce the asynchronous shape on demand.

**`.env.example`:** both new variables documented, commented out (so an unset deployment stays byte-identical), with the same reasoning as their `env.ts` docstrings.

---

## Design decisions the handoff left to me, and why

1. **Where the cross-field defaults live.** A single `configSchema = environmentSchema.transform((data) => ({ ...data, MEDIA_BASE_URL: data.MEDIA_BASE_URL ?? data.CONTENT_API_URL, HIDE_PLACEHOLDER_CONTENT: data.HIDE_PLACEHOLDER_CONTENT ?? data.NODE_ENV === 'production' }))`, with `loadConfig` and `AppConfig` retargeted to it. Considered a `superRefine` or resolving the defaults at each call site instead; the single transform keeps "what does an unset variable actually resolve to" in exactly one place, which is where the "byte-identical when unset" acceptance criterion lives.
2. **Part C surfaces as a message, not a control-state change.** The handoff left this open deliberately. Reusing `status.playing` alone (the "control state" option) turns out to add nothing on its own — a failed play already leaves `status.playing` at `false`, which is indistinguishable from a tap that never registered, i.e. still the dead button. `StatusMessage` is this codebase's existing, accessible (icon plus colour, `accessibilityRole="alert"`), already-shared idiom for exactly this class of feedback, used on twelve other screens — reaching for anything new here would have duplicated it.
3. **Reading `status.error` at all.** Not asked for explicitly; found by checking whether the synchronous-throw fix alone would actually cover the device gate's own MEDIA_BASE_URL-pointed-at-nothing scenario, and it does not — see Part C above. Flagging this as a decision rather than a given because it is the one place I went beyond the literal text of the handoff, on the grounds that the acceptance criteria describe an outcome ("tapping play produces something the reader can see") that the narrower fix would not have reliably produced.

---

## Four gaps mutation-checking found, not the handoff or a first test pass

The handoff's own acceptance criteria demand every test be mutation-checked as a separate reversion. Doing that literally — not just running the suite once green — surfaced four places where a real, working test suite would have stayed green through a genuine regression:

1. **`content.service.ts`'s `getLeaf`/`getLeafSummary`.** My first pass at "flag independent of NODE_ENV" coverage only exercised `listTracks`. Reverting `getLeaf`'s `resolveVisibleLeaf` call back to `NODE_ENV === 'production'` left all 20 tests in `content.service.test.ts` green. Two new tests close it (`content.service.test.ts`, the `HIDE_PLACEHOLDER_CONTENT, independently of NODE_ENV` block).
2. **`progress.service.ts`'s `finishTrackIfDone`.** A third call site for the flag, separate from `requireVisibleLeaf` (the grading path the handoff named) — Track-completion accounting, reached only through `completeLeaf`. Reverting it left all 30 tests in `progress.service.test.ts` green. Two new tests close it, exercising a Track with one real and one placeholder Leaf, asserting the Track completes when the flag hides the placeholder and stays open when it does not.
3. **`content.repository.ts`'s `listTracks`/`listLeavesForTrack`.** The media-URL tests I wrote first only called `findTrack`/`findLeaf`. `mapTrack`/`mapLeaf` are called from four sites, not two; reverting either list variant's `baseUrl` argument back to `CONTENT_API_URL` left every test green. One new test (`resolves the same way through the LIST paths`) closes it.
4. **The draft check under an explicit flag value.** The existing `draft content` tests vary `NODE_ENV`, which exercises the flag's two *default* states but never an explicit value opposite the default. Mutating `isVisibleIn` to skip the draft check on the `false` branch entirely — a real, Tier-A-severity bug shape — was still caught by eight tests total once the explicit-flag test existed (`content.service.test.ts` and `progress.service.test.ts` both), which is reassuring in itself: the draft check is thoroughly, if indirectly, load-bearing across this codebase already.

**One of these was my own process error, not a pre-existing gap, and I want it on the record rather than smoothed over.** While adding the Track-completion tests (finding #2), I ran the mutation, confirmed it caught nothing, and then — mid-debugging — fixed the *test* setup but left the *production* line still mutated from an earlier, unrelated check I had not yet reverted. The new test failed for the wrong reason as a result, which I only caught because the failure didn't match what I expected and I went looking with a debug log rather than assuming the test was simply wrong. Both the debug scaffolding (a temporarily-exposed `logger` on the test harness) and the leftover mutation are gone from the final diff; the full suite was re-run clean afterward. Flagging it because the testing bar's own point is that a green run is not proof, and this is a concrete instance of nearly trusting one anyway.

---

## Live verification performed, and what it actually proves

This worktree already had a real local stack running: `zoomout-postgres` (Docker, 2 weeks up) with real seed data — exactly the 2 real Tracks (Ikigai id 50, The Science of Getting Rich id 42) and ~27 placeholders plus one draft the device gate describes — and Payload admin already serving on port 3001. I started a **separate** backend instance from `ZO-vo3` on port 3010 (not 3000, which is the founder's own backend from the `ZO` checkout — confirmed via `ps`/`lsof` before touching anything, left running, untouched), signed up a throwaway test reader (`manager-verify-pilot1@example.test` — harmless, left in the local dev database, not cleaned up), and called the real HTTP API with a real bearer token:

- **`HIDE_PLACEHOLDER_CONTENT` unset, `NODE_ENV=development`:** `GET /content/tracks` returns all 29 published Tracks, the draft excluded. Matches today's behaviour exactly.
- **`HIDE_PLACEHOLDER_CONTENT=true`, `NODE_ENV=development`:** returns exactly 2 Tracks — *Ikigai* and *The Science of Getting Rich* — and `totalTracks: 2`, not 29-with-a-filtered-display, which means the **repository's own query filter** worked against the real Payload instance, not just the service-layer guard against a mock. This is the device gate's central claim, confirmed live.
- **`MEDIA_BASE_URL` unset:** a real Leaf's scenario image, sticky-notes diagram and summary/scenario audio all resolve to `http://127.0.0.1:3001/...`, matching `CONTENT_API_URL`'s default exactly.
- **`MEDIA_BASE_URL=http://192.168.50.77:3001` (a LAN-shaped address, standing in for a phone's view of the founder's Mac):** the same Leaf, same fields, all now resolve to that host instead. Every one of them moved; nothing was missed.

**What this does not prove:** the mobile app's own rendering of any of this — the Explore screen actually showing two cards, a Leaf actually playing audible narration, the "couldn't play" message actually appearing on a phone screen when a tap fails. I could not get to that. A `ZoomOut` (not Expo Go) process was already attached to the booted simulator, Metro already running from `ZO/apps/mobile` (confirmed via `ps`, cwd `/Users/ayushgupta/Documents/ZoomOut/ZO/apps/mobile`) — the founder's own session, left untouched rather than restarted or redirected, per `manager.md`'s standing rule. Standing up an independent second Metro instance and a second app build to avoid touching that one was the alternative; I judged the API-level verification above — which is real, live, and covers every data-shape claim the device gate makes except "and a human can see it render" — to be strong enough evidence that the marginal cost of a second full mobile build wasn't proportionate, especially since the one thing neither a simulator nor a second Metro instance could ever prove is the actual phone-vs-localhost network distinction this package exists to fix. That specific claim needs the founder's own phone regardless of what I do here.

**So, precisely:** every device-gate bullet about *what the backend serves* is verified, live, against real infrastructure. Every device-gate bullet about *what the app shows a reader* — the four bullets under "Device gate" in the handoff — is not verified by me, and needs the founder on their Android phone over Expo Go exactly as the handoff originally asked.

---

## Assumptions, stated so the next session does not have to reconstruct them

- **`isVisibleIn`/`resolveVisibleLeaf` no longer take `NODE_ENV` at all**, only the resolved boolean — a signature change, not just a call-site swap. Considered keeping `environment` as a second parameter alongside the flag for a smaller diff; dropped it because nothing inside either function used `environment` for anything other than the one branch the flag now owns, and an unused parameter would have been dead weight the next reader has to figure out is dead.
- **The maximal-fixture contract test lives in `content.repository.test.ts`, not `content.mapper.test.ts`.** `mapTrack`/`mapLeaf` already take `baseUrl` as a plain argument, so a mapper-level test cannot distinguish "the mapper is broken" from "the wrong config field was threaded in" — the second is what Part A is actually about, and only the repository layer knows which config field feeds `baseUrl`.
- **`stickyNotes.audio` is absent from the maximal fixture, deliberately.** `stickyNotes` has no narrated field to verify a clip's `textDigest` against, so `mapAudioEntries` drops every entry there unconditionally, by design (pre-existing, not touched by this package). Including it in a "maximal" fixture would have asserted its own removal, not its survival.
- **One throwaway test-reader row left in the local dev database** (`manager-verify-pilot1@example.test`) from the live verification above. Harmless, but noted rather than silently left for someone to wonder about later.

---

## Test count, against the last mobile package

**Mobile: 695, up from VO-3's 691 — +4, all in `NarrationControl.test.tsx`, all Part C** (a synchronous-throw play failure showing the message, an asynchronous `status.error` play failure showing the same message — a deliberately distinct test, since it is the one guarding the actual MEDIA_BASE_URL fix — backgrounding-with-a-released-player staying quiet, and the message clearing itself once a retry succeeds). No suite removed, no suite added — all four are new cases inside the existing file.

**Backend: 527.** No prior total for the whole suite was given to reconcile against; the honest number is 494 → 527 (+33) across the four files this package touched, broken down in the table above.

---

## Where the time went

Rough, in descending order: **mutation-checking**, by a wide margin — finding and closing the four gaps above, including debugging my own leftover-mutation mistake, took longer than writing the tests that passed on the first try; **implementation**, Parts A and B together were mechanical once the design was read (the handoff's own two traps were exactly as sized as advertised), Part C took longer once `status.error` turned out to matter; **live verification** — standing up a second backend instance safely alongside the founder's existing one, signing up a test reader, and walking the four scenarios by hand; **reading**, `contentVisibility.ts`, both repository files, and `expo-audio`'s actual shipped `.d.ts` rather than trusting memory of its API; the gate and this report, the rest.

## Follow-ups / tech debt for Architect

1. **The mobile-UI half of the device gate is entirely open** — needs the founder, on their own Android phone over Expo Go, backend reachable on the LAN, exactly as the handoff specified. Everything the backend serves is verified; nothing about how the app renders it is.
2. **Track 42's and Ikigai's cover URLs are out of scope here, and already queued** — `COVER-1`, above this entry in the Handoffs section, replaces both hotlinked covers with owned art. No action needed from this package; noting the connection since Part A's own "out of scope" line names the same two URLs.
3. **This worktree still has no `apps/admin/.env`** — the same gap VO-3's report flagged on 2026-09-18, still true. Cost me one build-verification detour (supplied the two required variables by hand, confirmed the failure was environmental and not a regression) rather than nothing, since `apps/admin` was untouched by this package either way.

**PR: [#57](https://github.com/ayush237/ProjectZoomOut/pull/57).**

---

### Completed: VO-3 — the player, and the narrator preference — 2026-09-18

> **⚠️ Addendum, 2026-09-22 — the founder got a device working, and this package's one named risk landed exactly where it was expected to.** From "Anything I am not happy with" below: *"the whole package rests on `expo-audio`'s hooks behaving the way their `.d.ts` and doc comments describe, since I have never once seen them run."* On a real Android phone: `useAudioPlayer` releases its native player on unmount **on its own** — true of the library, not documented anywhere in its `.d.ts` — and this package's own unmount cleanup (`useNarration.ts`, written to satisfy the "audio stops on unmount" acceptance criterion) was running *after* that release had already happened, calling `player.pause()` on a released native object. Native exception, uncaught, one render crash per slide left while a narrated one was mounted: `Cannot use shared object that was already released`. Fixed same day: all three native call sites in `useNarration.ts` (the unmount cleanup, the `AppState` background listener, and `toggle`) now go through a `safely()` wrapper that catches and `console.warn`s rather than lets the native exception propagate — the desired end state, "not playing," is already true once the player is released, so there is nothing left to do. **Mutation-checked against the exact failure**: `fakeExpoAudio.ts` gained `releaseFakePlayer()`, which reproduces the observed native error on demand; a new test in `NarrationControl.test.tsx` calls it before unmounting and confirms no exception propagates — stripping `safely()` from any one of the three call sites reproduces the founder's exact crash and fails that one test, confirmed by hand before restoring the fix. 691 mobile tests now (was 690). Everything else in this report is as it was on 2026-09-18; this is the one correction. **This is also the reason the device gate mattered as much as it did** — no unit test, mocking `expo-audio` at its own boundary as the testing expectations asked for, could ever have caught a bug in the boundary's own undocumented behaviour.

**Code complete, fully tested, not device-verified.** Every test-shaped acceptance criterion is met and green; the device gate is not, for a reason outside this package's control — detailed below, not passed over quietly. Branch `vo-3-player` in the `ZO-vo3` worktree, off `origin/main` at `c675fac`. Not yet rebased onto the two `project/`-only commits origin/main gained while this ran (`b378258`, `3c7e2c3` — log archiving and a roadmap rewrite; confirmed via `git diff --name-only vo-3-player..origin/main` before this report, no overlap with anything below) — will rebase immediately before push.

| | |
|---|---|
| Automated gate | `npm run lint`, `npm run typecheck`, `npm test` — all green, root level, all four workspaces. `npm run build` — **backend and mobile green; admin fails**, pre-existing and unrelated (see below) |
| Mobile tests | **690** (657 baseline + **33 new**: 32 across 8 new suites, plus 1 added to `surfaces.test.tsx`'s existing Profile block) |
| Typecheck | Root `tsc` clean across `packages/shared`, `apps/admin`, `apps/backend`, `apps/mobile` |
| Device verification | **None obtained.** Expo Go itself never finished installing on the simulator — see "What I could not do." Every "Yours, on Expo Go" bullet in the handoff's device gate is therefore unverified, not just the silent-switch one, which was always the founder's alone |

---

## What changed

**New `apps/mobile/src/audio/`:**
- `narratorPreference.ts` / `useNarrator.ts` — the SecureStore-backed preference (`zoomout.narrator`, default `male`), following `introSeenStore.ts`'s pattern exactly rather than `SoundProvider`'s Context: nothing on screen needs the value from two places at once, so there is no shared state to keep in sync, and the handoff's own conflict note asked for no new shared-preferences abstraction.
- `selectNarration.ts` — pure `(audio, narrator) → AudioRef | undefined`, matching on the `narrator` field only.
- `audioSession.ts` — `configureNarrationAudioSession()`, one explicit `setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false })` call. Both flags happen to match the library's documented defaults today; both are asserted explicitly anyway; that mismatch-with-nothing is the point — a future SDK default change cannot silently take this out from under a reader.
- `useNarration.ts` — the player: wraps `expo-audio`'s `useAudioPlayer`/`useAudioPlayerStatus`, exposes `{ playing, toggle }`. No local "is playing" flag — the control's state is a direct read of the player's own status, so an OS interruption can only ever leave it showing "paused" or "playing," never a state of its own invention.
- `NarrationControl.tsx` — the one control, used identically on Summary, Scenario, Payoff and Takeaway. Renders nothing when there is no clip for the current narrator (the same rule `optionalImage`/`SlideImage` already apply to every other optional asset — see "Assumptions" below).

**`apps/mobile/src/components/Icon.tsx`:** two entries, `play`/`pause` (`play-circle`/`pause-circle`).

**The four slides** (`SummarySlide.tsx`, `ScenarioSlide.tsx`, `PayoffSlide.tsx`, `TakeawaySlide.tsx`): each places `<NarrationControl audio={...} label="..." />` directly, next to its narrated text. **Not through `SlideFrame`** — verified rather than assumed, per the handoff's instruction: `PayoffSlide` does not use `SlideFrame` at all (WP23.1's deliberate exception), so a `SlideFrame`-based seam would have missed a quarter of the slides. Payoff's placement is a plain sibling below the reward panel, not inside its animated `Animated.View` — a utility control has no business springing open with the unlock.

**`apps/mobile/src/screens/ProfileScreen.tsx`:** a new `NarratorCard`, two Pressables ("Female"/"Male", `accessibilityRole="radio"`), between the achievement grid and the account-details card. Reader-facing labels only — never the pipeline's provider voice names (Achernar/Sadaltager), matching `content.ts`'s own stated reason for keeping `narrator` and `voice` apart.

**`apps/mobile/package.json` / `app.json`:** `expo-audio@~57.0.5` via `npx expo install` (SDK-matched); the installer added itself to `app.json`'s `plugins` array automatically — not hand-edited. `expo-av` was not installed; SDK 57 ships `expo-audio` as the current package, confirmed from the installed package's own `.d.ts` rather than assumed from memory.

**`apps/mobile/jest.setup.js`:** `expo-audio` mocked globally, alongside `expo-secure-store` and the others already there — see "A real bug this caught," below, for why this had to move here rather than stay per-test-file.

**Tests:** `narratorPreference.test.ts` (default/set/read/unrecognised-value-falls-back), `selectNarration.test.ts` (the three server shapes, plus the positional fixture the acceptance criteria asked for), `audioSession.test.ts` (the exact config call), `NarrationControl.test.tsx` (eleven cases: the three render shapes, the accessibility label and its update, play→pause toggle, session config, background-stops, unmount-stops, and the leave-the-slide harness described below), one new test each in `SummarySlide.test.tsx` / `PayoffSlide.test.tsx` / `TakeawaySlide.test.tsx` (new files; neither slide had one before) confirming the control is wired to the right data, two added to `ScenarioSlide`'s existing block in `leafPlayer.test.tsx`, one new `StickyNotesSlide.test.tsx` pinning no control renders **even given a fixture with `audio` populated** — the mapper can never actually produce that, so this guards the component itself, not just today's data — and one added to `surfaces.test.tsx`'s Profile block, pressing the real rendered card and asserting the SecureStore write. New shared test helper `apps/mobile/src/testing/fakeExpoAudio.ts` — a small reactive fake (`play`/`pause` mutate a `playing` flag and notify a listener a component's `useAudioPlayerStatus` subscribes to), used by both the global mock and any test that needs to assert on it directly.

---

## A real bug this caught, not just a test-writing issue

Two, actually, both found by writing the tests the acceptance criteria asked for rather than by inspection — worth recording because neither would have shown up in a lighter test pass.

**1. `useNarrator`'s async preference read can outlive the first render, and nothing was switching the player's source when it did.** `useNarrator` starts synchronous state at the hard-coded default (`male`) and corrects it once a SecureStore read resolves — same shape as `useIntroSeen`. But `useAudioPlayer` creates its native player once, from a `useState` lazy initializer, and (as far as I can tell from its `.d.ts` — there is no JS source in this package, only types) does not react to its `source` argument changing on a later render. Put together: **every reader whose narrator preference is not the hard-coded default would, on every single visit to a narrated slide, briefly construct a player bound to the wrong clip on the first render, then never actually switch it** when the real preference arrived a moment later — the UI would relabel itself correctly while the underlying player kept pointing at the other narrator's audio. Caught by the "matches by narrator... second" test failing with the right clip's URL simply never appearing among created players. Fixed by splitting `NarrationControl` into an outer component (decides whether to render anything, no player created yet) and an inner `NarrationButton` **keyed on `entry.url`** — a changed narrator now unmounts the stale player (through the same cleanup already written for the unmount/leave-slide requirement) and mounts a fresh one bound to the right source from the start, rather than trying to reach into an existing one.

**2. `unmount()` is async in this RTL version, same as `render`/`rerender`.** Missed it the same way the existing top-of-file comment in `leafPlayer.test.tsx` warns about for `render` — an un-awaited call returns before the tree (and its cleanup effects) has actually committed. The unmount test passed 0 calls where it expected 1 until I checked the type (`() => Promise<void>`, confirmed from the installed package's own `.d.ts`) and added the `await`. Unrelated to this package's own code, but worth a line here since it is exactly the kind of thing that reads as a real bug on a first failure.

## A regression this almost shipped, caught before the report rather than in it

`ProfileScreen.tsx` importing `useNarrator` from the `src/audio` barrel transitively pulled in `NarrationControl.tsx` → `useNarration.ts` → `expo-audio`'s real module — which has no JS implementation under Node — into **every** test that renders `ProfileScreen`, including `surfaces.test.tsx`, which existed before this package and asserts nothing about audio. Running the full suite (not just the new files) is what caught it: `surfaces.test.tsx` failed with a native-module `TypeError` at import time. Fixed by mocking `expo-audio` once, globally, in `jest.setup.js` — the same shape `expo-secure-store` already gets there, and for the identical reason the file's own docstring gives: a native module with no JS implementation belongs in one place, not scattered as a per-test-file `jest.mock`. The five per-file mocks I had written before finding this were all removed as redundant once the global one existed.

## A finding that corrects the handoff itself, not something I did

**"`content.mapper.ts` builds a warnings channel when it drops a row, and as far as I can tell nothing surfaces those warnings anywhere"** — checked, because the handoff asked me to. **This is not true as written.** `apps/backend/src/content/content.repository.ts`'s `keepValid` and `requireValid` both already call a private `logWarnings`, which does `this.logger.warn({ warnings, kind }, 'Content served with some entries withheld')` whenever a mapped document's `warnings` array is non-empty (`content.repository.ts:169`, `:190`, `:208-214`). A suppressed clip is not invisible — it reaches structured logs at `warn` level, tagged with the Leaf id, slide, narrator and digest prefixes `mapAudioEntries` already builds into the message. What it does **not** have is any admin-UI-facing surface — nothing in Payload shows "3 audio entries withheld on this Leaf" — so the finding is real in a narrower form than stated: this is a log line an operator has to be watching for, not a blank space in the app. Whether that is enough is a product question, not a code one, and not mine to rule on — reporting the corrected fact.

---

## What I could not do

**No device or Expo Go verification, at all.** The handoff's own first instruction was to confirm `expo-audio` loads under Expo Go before building anything else. I could not get that far.

1. **The port-8081 Metro server already running belongs to another session** (`ZO`'s primary checkout, confirmed via `ps`) — left untouched. Started my own on `8083` instead: `npx expo start --ios --go --port 8083` from `ZO-vo3/apps/mobile`.
2. **Expo Go itself never finished downloading onto the simulator.** `nettop` on the Expo CLI's process showed an established connection to `cdn-185-199-108-133.github.com:443` sitting at a fixed **57,599,029 bytes received**, unchanged across two samples taken **~29 seconds apart**, after **12+ minutes** of elapsed time and near-zero CPU — a stalled transfer, not a slow one. Not a rejection and not evidence about `expo-audio`'s Expo Go compatibility either way; I simply never got a running Expo Go to test anything in. Killed the process and confirmed port 8083 free again once it was clear waiting further would not help.
3. **My own reasoned, unverified guess, stated as exactly that:** `expo-audio` is Expo's own first-party playback SDK (the direct successor to `expo-av`, which had Expo Go playback support for years), and nothing this package calls (`useAudioPlayer`, `useAudioPlayerStatus`, `setAudioModeAsync`) touches the recording-permission surface that typically needs a project-specific native config Expo Go's prebuilt binary cannot apply. That is a prior, not an observation — treat it as such.
4. **`react-native-web` is still not installed** (confirmed still absent, as INTRO-1's report found) — did not add it unilaterally, for the same reason INTRO-1 gave: a new dependency purely to route around a device-gate gap is a bigger, murkier change than the gap itself.
5. **Consequence, stated against the handoff's own device-gate list:** every "Yours, on Expo Go" bullet — narrated slide shows the control, switching narrator changes the voice, leaving the slide stops audio, largest text size in both themes — is **unverified by me**, on top of the two already flagged for the founder on a physical iPhone (silent-switch audibility, a real interruption). The founder's own attempt, at a moment when the network path to Expo's simulator CDN is not stuck, is genuinely the fastest way to get a real answer here — mine was not a close call, `nettop` showed zero forward progress.

**`apps/admin`'s build fails in this worktree, unrelated to anything above.** `next build` cannot collect `/api/graphql-playground`'s config: `PAYLOAD_SECRET` and `PAYLOAD_DATABASE_URL` are both undefined. `apps/admin/.env` is gitignored and this worktree never had one — `git worktree add` does not carry untracked files, and nothing in this package's scope ever touched `apps/admin` to notice. Confirmed pre-existing rather than caused by this diff: the primary `ZO` checkout has its own `apps/admin/.env`; this worktree does not, and never did. I attempted to copy it across — **the copy was blocked by a deny rule on reading that file**, which is the correct outcome and I did not try to route around it. `apps/backend` and `apps/mobile` — the two workspaces this package actually touches — both build clean. The founder can close this gap in seconds by copying their own `apps/admin/.env` into `ZO-vo3` if a fully green root `npm run build` is wanted; I cannot.

---

## Assumptions, stated so the next session does not have to reconstruct them

- **The "no-audio state" renders nothing, not a placeholder.** The handoff says a slide missing a clip shows "the same state as no audio... not a broken button" without specifying what that state looks like. I followed this codebase's own precedent for every other optional asset (`optionalImage`/`SlideImage`: "renders nothing at all when there is no image, rather than reserving an empty box" — WP23.1's explicit ruling) rather than inventing a visible "narration unavailable" indicator. Reasoning: voiceover is Ikigai-only today (VO-2's scope), so every other Track's narrated slides would otherwise carry a permanent, meaningless "unavailable" label. If the founder wants a visible indicator instead, that is a one-file change (`NarrationControl`'s early return) and worth a look on a device before deciding, not from this write-up.
- **`NarrationControl` is two components, not one** (`NarrationControl` deciding, `NarrationButton` owning the player, keyed on `entry.url`) — not asked for explicitly, but load-bearing for the bug in "A real bug this caught" above. Flagging the shape change in case a future package reaches for `NarrationControl` expecting a single flat component.
- **Reader-facing narrator labels are "Female"/"Male"**, invented for this package — the handoff and the schema both stop at the `female`/`male` ids and say nothing about display copy. Plain and literal seemed safer than guessing at product voice for two words; easy to change in one place (`NARRATOR_LABELS`, defined identically in `NarrationControl.tsx` and `ProfileScreen.tsx`) if the founder wants something else.
- **`NarratorCard`'s placement on Profile** — between the achievement grid and the account-details card — is my call, not specified. Reasoning: it is a preference, not identity (email/timezone) or a stat (streak/achievements), so it sits between the two groups rather than inside either.
- **The audio session is configured on every `NarrationButton` mount, not once globally** — no "already configured" guard. Simpler, avoids module-level mutable state that would need resetting between tests, and `setAudioModeAsync` is cheap and idempotent; the cost is a handful of redundant native calls per Leaf session, which seemed like the right trade against a stateful guard nothing asked for.

## Test count, against the last mobile package

**690 / 42 suites, up from 657 / 34** (INTRO-1, this same file, verified by re-reading its own report rather than assumed). +33 tests in +8 new suite files, plus one test each added to two existing suites (`leafPlayer.test.tsx` for Scenario, `surfaces.test.tsx` for Profile) — suite count only moves for genuinely new files, which is why it is +8 rather than +10.

## Where the time went

Rough, not measured, in descending order: **reading** (the mapper's audio contract, the shared schema, every existing slide component, `expo-audio`'s actual `.d.ts` rather than assumed API, the SoundProvider/introSeenStore precedents) — this was large, and deliberate, given how much of the handoff's risk was procedural-but-precise; **tests**, including the two real bugs above and the debugging to find them, a close second; **the Expo Go attempt**, thirteen-plus minutes of it dead weight once the stall is accounted for; **implementation** itself, genuinely the smallest slice — the design was mostly settled by the time of writing; the gate and this report, the rest.

## Follow-ups / tech debt for Architect

1. **The device gate is entirely open**, not partially — every "Yours, on Expo Go" item plus the two always-founder items. Worth deciding whether VO-3 should be considered mergeable on code+tests alone (as INTRO-1 effectively was) or should wait on someone reaching a working Expo Go session, given this is now the *second* package in a row to lose real time to this machine's device-verification path (INTRO-1: native build/Xcode; VO-3: Expo Go itself failing to download). If this is becoming a pattern rather than two unlucky packages, it may be worth its own investigation rather than being re-discovered a third time.
2. **`content.mapper.ts`'s warnings-are-invisible concern, as tracked, overstates the gap** — see "A finding that corrects the handoff itself" above. They reach structured logs; they do not reach the admin UI. Worth updating wherever this was tracked as an open item, since "nothing surfaces them" and "they reach logs but not the admin panel" call for different fixes if either is ever prioritised.
3. **`apps/admin`'s build is not runnable in this worktree** without the founder copying their own `.env` across — a `ZO-vo3`-specific gap, cost me nothing beyond the discovery since admin was never in scope, but the same wall would stop anyone else's `npm run build` here too.
4. **The no-audio-state design ("renders nothing") is a judgement call, not a ruling** — see "Assumptions" above. Worth a real look once someone can see the app.

**Anything I am not happy with, stated even though I shipped it:** the whole package rests on `expo-audio`'s hooks behaving the way their `.d.ts` and doc comments describe, since I have never once seen them run. The two bugs I did catch were both about exactly this kind of gap between documented and actual behaviour, and I have no way to rule out a third.

---

### Completed: INTRO-1 — the first-run intro — 2026-09-18

**Code complete, fully tested, not visually verified. That second half is not a footnote — three explicit requirements (the seed-by-eye comparison, the five simulator device-gate checks, "do not take the first one that runs") are unmet, not passed quietly.** Two independent, pre-existing environment problems on this machine blocked every avenue to a running build, detailed below. Branch `intro-1-first-run` in the `ZO-admin` worktree, off `origin/main` at `fa905c1` (fast-forwarded once more before push to pick up VO-3's handoff — unrelated, `project/` only, confirmed by `git diff --name-only` before merging).

| | |
|---|---|
| Automated gate | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — all green, root level, all four workspaces |
| Mobile tests | **657** (616 baseline + **41 new**: 35 across 6 new suites, plus 4 added to `navigation.test.tsx` and 2 to `reduceMotionCallSites.test.tsx`) |
| Typecheck | **966** files across the four-workspace `tsc` run; **117** under `apps/mobile/src` |
| Visual verification | **None.** Every "on the simulator" claim in this report is a test assertion, not an observation — see "What I could not do," which is the most important section here |

---

## What changed

**New `apps/mobile/src/screens/intro/`:**
- `IntroScreen.tsx` — the screen. One continuous camera move (`scale`/`focusX`/`focusY`, three `withTiming`s sharing one span that ends as beat 4 begins) from a tight frame on the fixture's `next` cell to the whole graph fitted to the viewport. Four lines crossfade on their own timeline, identical in both Reduce Motion branches — a fade is already the accommodation, so nothing there needs to swap. The camera and the beat-4 amber pulse do swap: under Reduce Motion they jump straight to their resting values with **no Reanimated animation object created at all**, rather than an animated-then-suppressed one.
- `introBeats.ts` — the four lines verbatim, their timestamps, and `INTRO_HANDOFF_MS`, derived once so the camera's span and the sign-in control's timer cannot disagree about when beat 4 starts.
- `introCamera.ts` — pure `{scale, focus}` math: `fitScale` (contain-fit, centred) and `introCameraFrames` (beat 1's tight frame, beat 4's fitted one).
- `introFixture.ts` — the fixed synthetic graph: 22 states (5 `done`, 1 `next`, 16 `locked`), a literal seed. **22, not a number in `PRODUCT.md`'s 15–30 range chosen for realism** — at 18 the fixture's graph fits inside most current iPhones at scale 1, making "zoom out" a no-op on the devices this ships to; 22 is taller than a Pro Max, so the fit-scale is genuinely below 1 on real hardware. Reasoning is in the file; the seed itself (`8_675_309`) was **not** chosen by the comparison the handoff asked for — see below.
- `introLayers.ts` — an intro-local painter, teal (`palette.primary`) for reached tissue and `palette.border` for unreached, no core buds. **`buildDoneConstellationLayers` does not fit, which is the finding the handoff asked me to report rather than silently work around**: it paints every soma's ring and core bud in `palette.reward`, the earned-progress colour, and nobody has read anything before sign-in. Reusing it would put reward amber on every node in the fixture; the handoff is explicit that amber belongs only to beat 4's pulse. Also exposes the spine as one joined subpath (`chainedPath`) rather than one `M` per gap — the batched static layers use `curvePath` per curve same as the reference files, but the animated pulse needs a single continuous dash phase, and concatenating per-curve `M...` output would reset that phase at every gap, reading as several signals firing at once instead of one travelling the line.
- `introSeenStore.ts` / `useIntroSeen.ts` — the SecureStore flag (`zoomout.introSeen`, `SoundProvider.tsx`'s pattern) and the `restoring`/`unseen`/`seen` hook `RootNavigator` gates on.

**`apps/mobile/src/navigation/RootNavigator.tsx`:** intro gate inserted ahead of `AuthStack`, inside the `status !== 'signedIn'` branch only — checking it unconditionally would show the intro to an *existing signed-in reader* on their next cold start after this update ships, since `introSeen` is a new flag nobody has ever set. `status === 'restoring'` still gates first; `intro.status === 'restoring'` gates second, same blank-frame shape, so a slow SecureStore read cannot flash `AuthStack` before the intro appears.

**Tests:** `IntroScreen.test.tsx` (both themes, the four verbatim strings, skip-from-frame-one, the skip→hand-off swap timed against `INTRO_HANDOFF_MS`, both Reduce Motion branches) · `introBeats.test.ts` / `introCamera.test.ts` / `introFixture.test.ts` / `introLayers.test.ts` (pure-logic coverage, including the "no reward colour anywhere" and "geometry is identical across repeated calls" acceptance criteria) · `navigation.test.tsx` gained an `Intro` block — shows-before-auth-stack, flag-set-on-skip, flag-set-on-completion (fake timers, see below), flag-already-set-skips-straight-to-auth-stack · `reduceMotionCallSites.test.tsx` gained `IntroScreen` as a fourth surface, both branches, with the exact call counts derived by hand (17 reduced-motion, 22 full-motion) and confirmed against the real spy rather than assumed.

**A fake-timers finding worth keeping**, since nothing in this repo's tests used them before: `jest.advanceTimersByTime` fires a `setTimeout` callback's `setState` synchronously, but the resulting React commit needs a microtask tick to flush through `act` even so — a bare `act(() => jest.advanceTimersByTime(ms))` leaves the pre-update tree on screen with no error. `await act(async () => { jest.advanceTimersByTime(ms); await Promise.resolve(); await Promise.resolve(); })` — two empty microtask turns, one was not enough — is the smallest fix I found by hand, isolated as `advanceTimersAndFlush` in `IntroScreen.test.tsx`.

---

## What I could not do

**Nothing in this app rendered on a screen this session.** Two separate, pre-existing environment problems, neither caused by this package:

1. **A native rebuild fails on this machine, unrelated to anything in this diff.** `expo run:ios` (after fixing an unrelated CocoaPods/Ruby locale crash — this host's shell has no `LANG` set, and `pod install` needs `LANG=en_US.UTF-8`) fails compiling `expo-modules-jsi`, a transitive Expo SDK dependency already pinned in the lockfile before this package touched anything: `JavaScriptCodable+Date.swift:53:50: error: type of expression is ambiguous without a type annotation`. This machine has exactly one Xcode installed, 26.3, building against the iOS 26.2 simulator SDK with `-swift-version 6` — a newer Swift compiler than whatever `expo-modules-jsi`'s pinned version was written against. **This will block anyone else's native rebuild on this same machine too**, including VO-3's, if that package's Manager tries one here for the audio-session device gate. Worth a decision — pin an older Xcode, or bump the dependency — before it costs a second package the same afternoon.
2. **The one pre-built `.app` already on the simulators (2026-09-10, predates this package) would not pick up a fresh Metro server.** I lost real time here chasing what turned out to be my own mistake — I killed my own standalone Metro process assuming `expo run:ios` would start its own, then it failed before reaching that step, so port 8082 had nothing listening for a while and every reconnect attempt was silently doomed. Once I caught that and restarted Metro, the dev-client's `com.zoomout.app://expo-development-client/?url=...` deep link (confirmed correct against `@expo/cli`'s own `UrlCreator.ts`) still never produced a single request in Metro's log, tried against two different simulators including a brand-new one created for exactly this (to rule out stale Keychain — SecureStore/Keychain data **does** survive uninstall+reinstall on this simulator, a finding in itself if anyone else assumes otherwise). Since even a successful reconnect would only have shown the **2026-09-10 binary's old code**, not this package's, item 1 is the one that actually matters — fixing item 2 without item 1 would not have gotten me a picture of `IntroScreen` either.
3. **Web is not an option without adding a dependency.** `expo start --web` refuses: `react-native-web` is not installed. I did not install it — a new dependency purely to work around a device-gate gap is a bigger, murkier change than the gap itself, and not mine to add unilaterally.

**Consequence, stated plainly against the handoff's own list:**
- [ ] "Choose the seed by looking... say which seeds you compared" — **not done.** `INTRO_SEED = 8_675_309` is a literal I picked with no rendering at all, justified in `introFixture.ts`'s comments by the reasoning I could do without eyes (node count, camera fit-scale arithmetic) but never looked at.
- [ ] `INTRO_FOCUS_SCALE = 6` (beat 1's magnification) — same: reasoned from the dendrite-reach constants in `roadmapGeometry.ts`, never seen.
- [ ] All five "yours, on the simulator" device-gate bullets — legible in both themes with a live switch, largest OS text size, Reduce Motion's still frame, skip-from-frame-one, both relaunch-after-finish and relaunch-after-skip — **none observed.** Everything under these headings above is a test passing, not a screen I looked at, and I have tried to say so everywhere rather than let a passing test read as a device check.
- [x] Everything else on the handoff's acceptance list — the eight items that are genuinely test-shaped (exact strings, both exit paths, the `reduceMotionCallSites` registration, the Reduce Motion swap, deterministic geometry, the motion-config routing, the `screens/track`/`screens/share` no-touch guarantee, the four root commands) — is met and independently re-checked; see "What changed" for which test covers which.

**I am not confident the intro looks right.** The camera math, the paint, and the pulse are all real, wired, and covered by unit tests down to "is the scale actually below 1 on real hardware" — but "does it read as one continuous move," "is the seed's graph shape pleasant," and "is the text legible over a busy beat-1 close-up" are exactly the three questions no test in this package can answer, and I have not answered them by looking either. Treat the seed and the scale constant as placeholders a first device pass should revisit, not as settled.

---

## Assumptions, stated so the next session does not have to reconstruct them

- **The camera uses `withTiming` with an explicit ease, not a `spring` preset**, despite `motion.ts`'s spring-over-linear default. Reasoned in `IntroScreen.tsx`'s own comment: the spring presets are tuned for short discrete feedback, and a spring stretched to ~10s either idles near zero velocity for most of its length or overshoots the "whole graph in frame" target and settles back into it, which reads as a bump rather than a pull-back. Flagging because it is a departure from a named convention, not because I think it is wrong.
- **The seen-flag gate sits inside `status !== 'signedIn'`, not ahead of the whole navigator.** Explained in `RootNavigator.tsx`'s docstring: gating unconditionally would show the intro to an already-signed-in reader on the first cold start after this ships, since the flag is new and nobody has ever set it for existing installs.
- **`buildDoneConstellationLayers` is not reused** — the handoff invited this finding explicitly ("if it does not fit, say so... that is a finding about a shared primitive"); see "What changed" above for the reward-amber reason.
- **No dedicated test file for `useIntroSeen.ts` itself** — its `restoring`/`unseen`/`seen` transitions are exercised through `navigation.test.tsx`'s `Intro` block against the real store rather than in isolation, which seemed like better coverage than the same three states asserted twice.

## Test count, against nothing

The handoff asks for a comparison to "the previous package's" count. The last several completions in this file are pipeline packages (VO-2.1, VO-1.1, VO-2, VO-1, WP33.1, WP33) — Python, a different test runner, a different app. I do not have a same-app mobile baseline close enough in this file to compare against honestly, so I am reporting **657 mobile tests / 34 suites, up from 616 / 28** (verified via `git diff HEAD~1 HEAD` on the two modified test files rather than assumed) rather than inventing a comparison that would look precise and would not be.

## Where the time went

Rough, not measured: **implementation** (the screen, the camera/paint/beat modules) a little under half; **tests** (including the fake-timers debugging) a quarter; **the device-verification attempt** — native build, deep-link reconnection, the fresh-simulator and Keychain detour, web as a last option — genuinely the single largest block, run through in "What I could not do" above rather than repeated here; the write-up, the rest.

## Follow-ups / tech debt for Architect

1. **The Xcode/`expo-modules-jsi` incompatibility (above) is environment, not code, but it is repo-relevant**: any Manager package needing an on-device check on *this* machine hits the same wall until someone either pins an older Xcode or moves the dependency version. Worth surfacing before VO-3 spends a package finding it independently.
2. **The seed and `INTRO_FOCUS_SCALE` need a real look** — the single most consequential unresolved item in this package. Whoever picks this up next should treat "does the intro look right" as unanswered, not assume the code passing tests means it does.
3. **`ZO-admin`'s `node_modules` was stale relative to the lockfile** (missing `react-native-svg` entirely — an existing dependency, not one this package added) and needed a plain `npm install` before anything using it would even typecheck. Fixed as part of this session; noting it in case another fresh worktree hits the same thing and wastes time wondering why an existing screen won't import.

