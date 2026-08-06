# Getting Started — Running the Two-Agent Workflow

## How we actually run this (Claude Code app)

Two named sessions in the same project — **Architect** and **Manager** — kept open side by side in the sidebar. The app has no `--append-system-prompt` flag, so each session's persona is loaded by telling it to, as the very first message:

> You are the Architect for this project. Read `agents/architect.md` in full before doing anything else, then confirm you've internalized it.

> You are the Manager for this project. Read `agents/manager.md` in full before doing anything else, then confirm you've internalized it.

**Send the persona message on its own and wait for the confirmation before giving it work.** Bundling the persona and the first task into one message reliably produces a session that skims the persona on its way to the task — and the persona is exactly what keeps Architect out of `apps/` and Manager out of the planning docs.

Re-send the persona message after any `/clear`. `CLAUDE.md` reloads automatically; the persona does not.

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

## Two sessions, one repo
Both sessions point at the same working directory, and `CLAUDE.md` loads automatically for both. Both have identical technical permissions — what differs is which persona loaded. Architect's "never touch application code" rule (see `agents/architect.md`) is enforced by instruction, not by disabling a tool, since it still needs Edit/Write for `projectplan.md`, `projectRoadmap.md`, and proposal docs.

If Manager is mid-change, don't have Architect read half-finished code and draw conclusions from it — check in on progress instead.

We deliberately don't `@import` the persona files into `CLAUDE.md`. `CLAUDE.md` loads identically for every session, so importing both personas there would put both in both sessions and defeat the point of the split.

## Context hygiene
- One feature per session where possible. `/clear` before starting the next one.
- Before `/clear`, make sure `collaboration-log.md` has the entry that lets a fresh session pick up context in seconds instead of replaying the conversation.
- If a single feature runs long, `/compact` proactively rather than waiting for an automatic compact at a worse moment. Root-level `CLAUDE.md` reloads automatically after `/compact`; **the persona file does not** — re-send the persona message if a session starts behaving out of role. Another reason the log file matters.
- Run `/context` any time you want to confirm what actually loaded into a session.
