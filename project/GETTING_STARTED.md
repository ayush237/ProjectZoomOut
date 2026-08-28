# Getting Started — Running the Two-Agent Workflow

## How we actually run this (Claude Code app)

Two named sessions in the same project — **Architect** and **Manager** — kept open side by side in the sidebar. The app has no `--append-system-prompt` flag, so each session's persona is loaded by telling it to, as the very first message:

> You are the Architect for this project. Read `agents/architect.md` in full before doing anything else, then confirm you've internalized it.

> You are the Manager for this project. Read `agents/manager.md` in full before doing anything else, then confirm you've internalized it.

> You are the Pipeline Manager for this project. Read `agents/pipeline-manager.md` in full before doing anything else, then confirm you've internalized it.

The **Pipeline Manager** is a third session, added 2026-08-13 for the Phase 2 content pipeline. It owns `apps/pipeline` and nothing else; Manager keeps the app, backend and CMS. Both report to Architect.

**Send the persona message on its own and wait for the confirmation before giving it work.** Bundling the persona and the first task into one message reliably produces a session that skims the persona on its way to the task — and the persona is exactly what keeps Architect out of `apps/` and Manager out of the planning docs.

Re-send the persona message after any `/clear`. `CLAUDE.md` reloads automatically; the persona does not.

## Where planning docs get committed

**Architect commits planning docs straight to `main`, not to Manager's feature branch** (changed 2026-08-11). Everything under `project/` plus `agents/` — roadmap, plan, collaboration log, proposals, personas.

Why: both sessions share one working directory, so uncommitted Architect edits sitting in the tree get swept into Manager's next commit. That happened twice, and a reviewer flagged the second one as an apparent violation of the "Manager never edits the roadmap" rule — which cost real time to disprove. It also means the roadmap on `main` is current immediately, instead of only when a feature branch merges.

**The enforceable rule is explicit staging on both sides** (revised 2026-08-12). "Do it while Manager is idle" was the original rule and it failed, because neither session can tell when the other is working. So instead:

- **Neither session ever runs `git add .` or `git commit -a`.** Stage specific paths, then check `git diff --cached --name-only` before committing. Architect stages `project/` and `agents/` only and aborts if any `apps/` or `packages/` path appears; Manager stages only the code paths it touched.
- **Manager never commits to `main`.** Architect commits planning docs there; Manager works on its package branch.
- If either session sees changes it did not make, it leaves them alone.

The sequence Architect uses:

```bash
git stash push -- project/ agents/
git checkout main
git checkout <manager-branch> -- project/ agents/   # only if the branch has newer docs
git stash pop
git add project/ agents/ && git commit
git push origin main
git checkout <manager-branch>                        # leave the tree where Manager left it
```

Never do this mid-package. If Manager is working, hold the edits and commit at the next boundary.

## Handing work from Architect to Manager

The handoff prompt is written into `collaboration-log.md`, not just printed in chat. So the Manager session doesn't need the plan pasted into it — point it at the file:

> Read `project/collaboration-log.md` and execute the handoff dated `<date>` — "`<title>`". The full milestone plan it references is at `project/proposals/<plan>.md`.

Manager reads both files itself. This is the whole reason plans live on disk instead of in a conversation: neither session has to carry the other's context.

## Running from a terminal instead

If you'd rather use the CLI, the equivalent is a pair of shell aliases:

```bash
alias claude-architect='claude --append-system-prompt "$(cat agents/architect.md)"'
alias claude-manager='claude --append-system-prompt "$(cat agents/manager.md)"'
```

`--append-system-prompt` is an *append*, not a replacement — Claude Code's default tool guidance and safety behavior stay in place, and the persona file adds project-specific rules on top. The advantage over the app flow is that the persona can't be forgotten; the behavior is otherwise identical.

## Give each session its own worktree — added 2026-08-29

**Two sessions cannot hold two branches in one checkout.** Git has one HEAD per working directory, so when the second session switches branches the first one's files vanish out from under it mid-task.

This has now happened three times, escalating:

1. WP15.1 was branched from a **stale local `main`**, so it built without WP16 and produced a phantom eslint regression that cost real diagnosis time.
2. WP16's untracked `.venv` sat in the tree across checkouts, linting on branches that had no ignore for it.
3. **WP18 and WP15.2 collided directly** — the shared checkout moved to `wp15.2-pipeline-key` mid-session while the Pipeline Manager was verifying WP18, clearing WP18's files from the tree. Nothing was lost, but only because the Pipeline Manager read the commits before touching anything and finished from a worktree instead of switching back, which would have discarded eleven uncommitted `apps/admin` changes.

**The third incident is the argument.** The recovery worked because a careful session noticed; the next one might not.

```bash
git worktree add ../ZO-admin    -b <manager-branch>  main
git worktree add ../ZO-pipeline -b <pipeline-branch> main
```

Point Manager at `../ZO-admin` and Pipeline Manager at `../ZO-pipeline`. Same repository, same history, same remotes — separate HEADs, so neither can disturb the other. Architect keeps the original checkout for `project/` and `agents/`.

**The cost, so it is not a surprise:** each worktree needs its own `npm install`, and the pipeline's needs its own `.venv`. Ten minutes, once.

**When a package finishes**, `git worktree remove <path>`. A worktree left behind on a deleted branch is its own small confusion — and removing one is what broke Architect's shell cwd once, so run it from somewhere else.

**Sequential work does not need this.** One session at a time in the shared checkout is fine and simpler. The rule is only: two sessions working at once means two worktrees.

## Two sessions, one repo
Both sessions point at the same working directory, and `CLAUDE.md` loads automatically for both. Both have identical technical permissions — what differs is which persona loaded. Architect's "never touch application code" rule (see `agents/architect.md`) is enforced by instruction, not by disabling a tool, since it still needs Edit/Write for `projectplan.md`, `projectRoadmap.md`, and proposal docs.

If Manager is mid-change, don't have Architect read half-finished code and draw conclusions from it — check in on progress instead.

We deliberately don't `@import` the persona files into `CLAUDE.md`. `CLAUDE.md` loads identically for every session, so importing both personas there would put both in both sessions and defeat the point of the split.

## Context hygiene

**Clear Manager after every work package. This is not optional housekeeping — it is how the workflow is designed to run.** Five packages in one context window will fill it, and a session running near its limit degrades exactly when the work gets hard.

The sequence that loses nothing:

1. Manager writes its completion report into `collaboration-log.md` **while it still remembers the reasoning** — not after a compact has eaten it. The report is the context transfer.
2. `/clear` — same window is fine, a new one is identical.
3. Re-send the persona message and wait for the confirmation.
4. Point it at the record: *"Read `project/projectplan.md` for current state, then `project/collaboration-log.md` — the newest handoff and the newest completion report. Continue from there."*

**Do not try to carry the conversation across.** You can't, and you don't want to. The log is a curated record of decisions and outcomes; a transcript is the same information buried in dead ends and superseded reasoning. A fresh session reading the log is better informed than a tired one carrying the transcript.

If Manager is mid-package when context runs short, `/compact` to get to the completion report, then clear. Never clear mid-package — the report is what makes clearing safe.

- One feature per session where possible. `/clear` before starting the next one.
- Before `/clear`, make sure `collaboration-log.md` has the entry that lets a fresh session pick up context in seconds instead of replaying the conversation.
- If a single feature runs long, `/compact` proactively rather than waiting for an automatic compact at a worse moment. Root-level `CLAUDE.md` reloads automatically after `/compact`; **the persona file does not** — re-send the persona message if a session starts behaving out of role. Another reason the log file matters.
- Run `/context` any time you want to confirm what actually loaded into a session.
