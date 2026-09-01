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
