# Token budget — how this project stops burning the weekly limit

**Written 2026-08-29** after the founder hit the limit repeatedly. Applies to all three sessions.

Everything here is ranked by **measured** impact on this repository, not by general advice. The measurements are at the bottom.

---

## The one-line version

**The cost is not code. It is the same words being re-sent over and over** — a 104k-token document load at every session start, and a conversation that re-sends its entire history on every single turn. Fix those two and nothing else matters much.

---

## Lever 1 — Architect clears between milestones, like everyone else

**The largest single consumer, and it is free to fix.**

`GETTING_STARTED.md` has mandated clearing Manager after every work package since Phase 1. **It never said the same about Architect, and Architect has never cleared** — one continuous session has now spanned WP15 through WP20.

Every turn in a conversation re-sends the whole conversation. A session fifteen packages deep pays for all fifteen on every message, including the ones about work that shipped weeks ago. That is not a small overhead; on a long session it dwarfs everything else in this document.

**The mechanism to survive clearing already exists and is already trusted.** The collaboration log and the roadmap are the memory — that is precisely why Manager can be cleared between packages without losing anything. Architect wrote those files; Architect can read them back.

**Practice:** clear Architect at each milestone boundary — a package signed off and merged, a phase closed — not mid-decision. Re-send the persona message, then point it at `projectRoadmap.md` and the newest log entries.

---

## Lever 2 — Archive on a schedule, not when it hurts

**Measured today: a fresh session loads ~104k tokens before reading one line of code.** Three sessions, several clears a week, and that is the biggest recurring line item after Lever 1.

| File | Size | ~tokens | What it is |
|---|---|---|---|
| `collaboration-log.md` | 190KB | **47k** | Handoffs + completion reports |
| `projectRoadmap.md` | 130KB | **32k** | Of which the decisions log is 73KB and the debt register 42KB |
| everything else | 96KB | 25k | Personas, PRODUCT, LEGAL, proposals, launch blockers |

**Those two files are 76% of the load.** The log was split once already, from 397KB to 145KB — and grew back to 190KB in a week, because archiving happened as a rescue rather than as a habit.

**Practice — at every package sign-off, Architect moves the closed entries out:**

- Handoff and completion report for the signed-off package → `project/archive/collaboration-log-<phase>.md`
- Decision rows older than the current phase → `project/archive/decisions-<phase>.md`
- Debt rows marked ✅ Fixed → the same archive

The active files should hold **the current phase and nothing else**. Everything archived stays in git and stays readable; it is simply not loaded by default.

**Target: the active set under 40k tokens.**

---

### Archive at a boundary, never mid-package

Learned immediately, by getting it wrong. The 2026-09-02 archive landed while the Pipeline Manager was mid-package on WP20.1, and rewrote `collaboration-log.md` substantially underneath it. Its handoff survived the cut — that was checked — but the session had already read the file, and concluded from a stale read that no handoff existed. It stopped and asked, which was right, and cost a round trip.

**The rule is the same one that governs clearing:** archive when no session is mid-package. Verifying that the in-flight handoff survives is necessary and not sufficient — a session that has already read the file does not re-read it because the file changed.

## Lever 3 — Not every session reads every file

A Manager package touching `apps/admin` does not need `content-pipeline.md`. A Pipeline Manager package does not need Phase 1's mobile handoffs. Today both read everything because `CLAUDE.md` points everyone at the same list.

**Practice:** the handoff names what to read. If a package needs three files, say those three. `CLAUDE.md` stays the map; it should not be a reading list.

---

## Lever 4 — Model tier per package

Already in force since 2026-08-28 and already paying off: WP15.5 and WP15.6 both ran on Sonnet and both found real defects.

**Sonnet** where the handoff already contains the design. **Opus** where the finding matters more than the code — the legal gates, and anything whose value is judgement rather than typing. Every handoff carries a suggested model.

This does not reduce tokens. It reduces how heavily they draw against the weekly limit.

---

## Lever 5 — Subagents for search, not for work

When a session needs to find something across many files, a subagent reads them and returns **conclusions**; the files never enter the parent's context. Reading them directly puts every byte in the transcript, permanently, for the rest of the session.

Use it for "where is X handled", "which files touch Y". Do not use it for implementation — a subagent starts cold and re-derives context you already have, which costs more than it saves.

---

## Lever 6 — Run `/context` when a session feels heavy

It breaks down what is actually occupying the window — system prompt, `CLAUDE.md`, MCP servers, subagents, skills. **A chatty MCP server is a common hidden cost**: its tool definitions can sit in context on every request. Worth checking rather than assuming.

**Measured at last on 2026-09-22, and this lever was right.** An Architect session had **72 connector
tools loaded: Notion 45, Google Drive 11, Claude Docs 8, visualize 2, scheduled-tasks 6.** This project's
record is in git and its content is in Payload; it touches none of them. **56 tools rode along on every
request of every session for a month** because this lever said "worth checking" and nobody checked.

**This is the one cost in this document that archiving cannot reach.** Document load is paid once per
session and shrinks when you archive. Tool definitions are paid **per request** and shrink only when the
connector is turned off. Notion and Google Drive were turned off on 2026-09-22 — see
`GETTING_STARTED.md`, which carries the standing rule.

---

## Two things deliberately *not* recommended

### A code-graph / repo-indexing extension

**Rejected for this project, on the evidence above.** A code graph reduces the cost of *finding* code. This project's handoffs already name the exact files, so search is not where the tokens go — the measured cost is document load and conversation length. It would also most likely arrive as an MCP server, which *adds* a permanent context cost to every request.

Revisit if the pattern changes: a much larger codebase, or sessions that explore rather than execute against a spec.

### Routing Claude Code's file I/O through Gemini

**The idea is sound; the implementation is not worth it here.** Claude Code cannot natively hand its own file reads to another model — you would build an MCP server or a script layer to do it, which is real engineering, adds failure modes in the middle of every operation, and costs context itself.

*(The article that proposed this could not be read — Medium returned 403 — so this assesses the general approach, not that author's specific setup.)*

**The version of this idea that is free and works today: use Gemini for work that does not need the repo.** Research, reading long documents, drafting prose, first-pass thinking about a design. That is a separate window and a separate subscription, with zero integration risk. The pipeline already runs entirely on Gemini, which is the same principle applied where it fits.

---

## Order of implementation

1. **Archive the log and the decisions register** — Architect, ~15 minutes, cuts the ~104k load to roughly 40k. *(Lever 2)*
2. **Clear Architect at the next milestone**, and add the rule to `GETTING_STARTED.md`. Free. *(Lever 1)*
3. **Name the reading list in each handoff** from the next package onward. Free. *(Lever 3)*
4. **Keep marking models.** Already running. *(Lever 4)*
5. **Run `/context` in each session once**, to catch anything unexpected. *(Lever 6)*

Steps 1 and 2 are the ones that matter. The rest is tidying.

---

## One thing worth knowing before optimising too hard

**The heavy build is nearly over.** WP20 is the last pipeline package; WP12, WP13 and WP14 remain on the app side. What follows is mostly content review — founder hours in a CMS, costing no tokens at all.

The burn rate is about to fall on its own. These changes are worth making because they are cheap and permanent, not because the current rate continues indefinitely.

---

## Measured again — 2026-09-15

**The rules in this file were not followed, and the file grew past the point the last rescue started from.**

| | 2026-08-29 | 2026-09-15 before | 2026-09-15 after |
|---|---|---|---|
| `collaboration-log.md` | 190KB / 47k | **417KB / 106k** | **79KB / 20k** |
| `projectRoadmap.md` | 130KB / 32k | 169KB / 43k | 153KB / 39k |
| **Startup load** | ~104k | **~181k** | **~91k** |

**What went wrong is exactly what Lever 2 predicted.** Archiving happened as a rescue, not as a habit: five packages were signed off between 2026-09-11 and 2026-09-15 and none of them archived anything, so the log more than doubled and ended up **larger than it was before the previous split**. Lever 1 was also not followed — one Architect session ran WP28.1 through WP32, six packages, without clearing.

**Two things changed in the rules, both learned here.**

**The log's "keep the four most recent" rule gains an exception: a handoff whose package is still open is never pruned.** WP29 was handed off 2026-09-11 and not started; under the plain rule it would have been archived out of the active file while still being the live instruction for an unstarted package. That is the pruned-pointer failure that already cost WP28 time, one step earlier.

**Open debt is not archived, only resolved debt is.** The register is 140 open rows and 85KB — the largest remaining item, and the obvious next cut. It was deliberately left alone: **open debt that is not loaded is debt that gets forgotten**, and this project's own record says a defect is not recorded until it reaches a list someone reads. Shrinking it is a real decision about what to stop tracking, not a tidy-up, and it should be made deliberately rather than at the end of a session that is already over budget.

**So the remaining gap to the 40k target is the debt register, and closing it needs a ruling rather than a script.**

---

## Measured again — 2026-09-25, after the archive pass

| | before | after |
|---|---|---|
| `collaboration-log.md` | 271KB / ~68k | **103KB / ~26k** |
| `projectRoadmap.md` | 169KB / ~42k | **141KB / ~35k** |
| **Active pair** | ~109k | **~61k** |

**The habit held, and the target is still missed for one reason: the debt register is 102KB (~26k tokens),
three-quarters of the roadmap.** It is deliberately not archived — open debt that is not loaded is debt that
gets forgotten — so closing the last ~20k needs a ruling about what to stop tracking, not a script.

**The log went from ~56KB on 2026-09-22 to 271KB on 2026-09-25**: six long packages in three days, with the
archive deferred each time by "never archive mid-package" (the roadmap recorded each deferral). The pass ran
when both peer sessions were idle and every PR was merged. **If overlapping packages continue, that boundary
has to be made on purpose:** merge, let both sessions go idle, archive, then hand off the next package.

---

## Measured again — 2026-10-03, after the second archive pass and the issue of GUARD-1 and LEDGER-1

Bytes ÷ 4, as before.

| | 2026-09-25 (after the pass) | 2026-10-03 (after the pass, `70d4dd9`) | 2026-10-03 (two handoffs issued) |
|---|---|---|---|
| `collaboration-log.md` | 103KB / ~26k | 131KB / ~33k | **172KB / ~43k** |
| `projectRoadmap.md` | 141KB / ~35k | 140KB / ~35k | **145KB / ~36k** |
| **Active pair** | ~61k | ~68k | **~79k** |

**The pair is back above its 2026-09-25 mark for two named reasons, and neither is drift.** (1) The log holds **four packages' worth of open or just-closed material**: VO-4 and VO-4.1 (handoffs and completion reports, ~45KB, kept because the next voiceover package builds directly on `narrate`) and the two new handoffs — **GUARD-1 22KB and LEDGER-1 19KB, ~10k tokens between them**, each a full template because an executor cold-starts from it. (2) The roadmap gained ~5KB for the same two issues (two board rows, two decisions rows, the status bullets). **Both leave at the sign-offs:** the open-handoff exception is absolute until then, and the pass at their sign-offs takes VO-4 and VO-4.1 out with them. **Estimated floor after that pass ≈ 60k** — the roadmap's ~36k plus a log holding only GUARD-1's and LEDGER-1's handoffs and completions.

**The register is the constant: 145 rows by the `| **` count, 110KB, ~27.5k tokens — about three-quarters of the roadmap.** It is still a ruling about what to stop tracking, not a script. **A reasonable moment for it is soon:** with book #3 deferred and the enhancement work not yet specified, little new is being added to the register's most crowded areas (narration, onboarding) for a while.

**What worked this time.** The pass ran at a clean boundary (both peers idle, every PR merged) and **promoted seven rules into `agents/architect.md` before moving the rows that taught them** — the constraint the decisions log states ("do not archive a ruling until its rule has a home"). **What did not:** the two handoffs were issued after the pass, as the founder's last act of the session, so the log grew by 40KB within an hour of shrinking. That is the "open handoff is never pruned" rule doing its job, not a failure of it — but it does mean the cheapest moment to archive is *before* a handoff goes out, and the second-cheapest is at its sign-off.

---

## Measured again — 2026-10-09, after the third archive pass

Bytes ÷ 4, as before.

| | 2026-09-25 (after pass 1) | 2026-10-03 (after pass 2, then two handoffs) | 2026-10-09 before pass 3 | 2026-10-09 after pass 3 |
|---|---|---|---|---|
| `collaboration-log.md` | 103KB / ~26k | 131KB → 172KB | 324KB / ~81k | **117KB / ~29k** |
| `projectRoadmap.md` | 141KB / ~35k | 140KB → 145KB | 163KB / ~41k | **154KB / ~38k** |
| **Active pair** | ~61k | ~68k → ~79k | ~122k | **~67k** |

**One pass took the pair from ~122k to ~67k:** six log entries (940 lines) and eleven table rows — two board rows, three decisions rows, six closed register rows — moved verbatim, with a line-by-line check that nothing was lost or altered (only the log's header note was rewritten, and two register rows had their closing status written before they moved). The two archives that grew are `archive/collaboration-log-voiceover.md` (VO-4, VO-4.1) and a new `archive/collaboration-log-hardening.md` (LEDGER-1; LEDGER-1.1 and GUARD-1 join it when they leave).

**Why the log reached 324KB:** four packages (LEDGER-1, LEDGER-1.1, GUARD-1, and the VO-4 pair still there from before) were issued and closed in six days, each a full handoff and a 60KB completion report, and "never archive mid-package" held the pass back because GUARD-1's branch was open and stopped for a usage limit. **The deferral was right** — an archive pass during GUARD-1 would have changed what "keep both entries" meant for the Manager's merge — **and it cost ~40k tokens of log nobody was reading for five days.** The 2026-09-25 lesson stands and is now a practice: when packages overlap, make the boundary on purpose (merge, let both sessions go idle, archive, then hand off the next).

**What is left is the register: 142 rows, ~113KB, ~28k tokens — 73% of the roadmap.** Open debt is still deliberately not archived, so closing the last ~27k of the 40k target is a ruling about what to stop tracking. **A reasonable moment is when the enhancement work has been specified**: little is being added to the register's most crowded areas (narration, onboarding, the pipeline's lock) until then.
