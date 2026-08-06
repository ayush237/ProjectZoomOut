# Getting Started — Running the Two-Agent Workflow

## One-time setup
1. `cd` into the project root.
2. Confirm `claude` is installed and you're logged in (`claude auth status`).
3. Add the two aliases below to your shell profile (`~/.zshrc` / `~/.bashrc`).

```bash
alias claude-architect='claude --append-system-prompt "$(cat agents/architect.md)"'
alias claude-manager='claude --append-system-prompt "$(cat agents/manager.md)"'
```

`--append-system-prompt` is an *append*, not a replacement — Claude Code's default tool guidance and safety behavior stay in place, and the persona file just adds project-specific rules on top. Both sessions now get identical technical permissions; what differs is which persona loads. Architect's "never touch application code" rule (see `agents/architect.md`) is enforced by instruction, not by disabling a tool — it still needs Edit/Write for its own job of keeping `projectplan.md`, `projectRoadmap.md`, and proposal docs current.

Reload your shell (`source ~/.zshrc`), then run `claude-architect` in one terminal tab and `claude-manager` in another, both from the project root.

## No alias yet?
Run `claude` as normal and paste as your first message:

> You are the Architect for this project. Read agents/architect.md in full before doing anything else, then confirm you've internalized it.

(swap for `agents/manager.md` in the other terminal). This works immediately but relies on remembering to say it — the alias is the durable version of the same thing.

## Two terminals, one repo
Both sessions point at the same working directory. `CLAUDE.md` loads automatically for both, on top of whichever persona file the alias appended. If Manager is mid-change, don't have Architect read half-finished code and draw conclusions from it — check in on progress instead.

We deliberately don't `@import` the persona files into `CLAUDE.md`. `CLAUDE.md` loads identically for every session, so importing both personas there would put both in both sessions and defeat the point of the split.

## Context hygiene
- One feature per session where possible. `/clear` before starting the next one.
- Before `/clear`, make sure `collaboration-log.md` has the entry that lets a fresh session pick up context in seconds instead of replaying the conversation.
- If a single feature runs long, `/compact` proactively rather than waiting for an automatic compact at a worse moment. Root-level `CLAUDE.md` reloads automatically after `/compact`; nothing else does — another reason the log file matters.
- Run `/context` any time you want to confirm what actually loaded into a session.
