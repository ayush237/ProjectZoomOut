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

**⚠️ Never run `git checkout main` in `ZO-admin` or `ZO-pipeline`.** They are *linked* worktrees; `main` is
checked out by the primary checkout at `ZO`, and git refuses to have one branch in two worktrees:
`fatal: 'main' is already used by worktree at …`. Worse is the case that *succeeds* — if `ZO` is on a
feature branch, a linked worktree happily takes `main` and then **`ZO` cannot get it back**, which is
exactly what happened on 2026-09-18 and blocked the founder mid-handoff.

**Always branch straight from the remote instead:**

```bash
git fetch origin && git switch -c <your-branch> origin/main
```

That gets the latest `main` without anyone owning the branch. **`main` lives in `ZO` and nowhere else.**
Handoffs must say this rather than "checkout main" — two of them said the wrong thing before this note
existed.

Point Manager at `../ZO-admin` and Pipeline Manager at `../ZO-pipeline`. Same repository, same history, same remotes — separate HEADs, so neither can disturb the other. Architect keeps the original checkout for `project/` and `agents/`.

**The cost, so it is not a surprise:** each worktree needs its own `npm install`, and the pipeline's needs its own `.venv`. Ten minutes, once.

**When a package finishes**, `git worktree remove <path>`. A worktree left behind on a deleted branch is its own small confusion — and removing one is what broke Architect's shell cwd once, so run it from somewhere else.

**Sequential work does not need this.** One session at a time in the shared checkout is fine and simpler. The rule is only: two sessions working at once means two worktrees.

## Two sessions, one repo
Both sessions point at the same working directory, and `CLAUDE.md` loads automatically for both. Both have identical technical permissions — what differs is which persona loaded. Architect's "never touch application code" rule (see `agents/architect.md`) is enforced by instruction, not by disabling a tool, since it still needs Edit/Write for `projectplan.md`, `projectRoadmap.md`, and proposal docs.

If Manager is mid-change, don't have Architect read half-finished code and draw conclusions from it — check in on progress instead.

We deliberately don't `@import` the persona files into `CLAUDE.md`. `CLAUDE.md` loads identically for every session, so importing both personas there would put both in both sessions and defeat the point of the split.

## Which model each session runs on — added 2026-09-22

**Every handoff has named a suggested model since 2026-08-28. Nothing ever said what the *sessions*
run on, and that is the larger number** — a handoff's model choice governs one package, while a
session's governs every turn it takes.

**Default all three sessions to Sonnet. Switch to Opus deliberately, for the turn or the package that
needs it, not for the session.**

| Session | Default | Reach for Opus when |
|---|---|---|
| **Architect** | **Sonnet** | Ruling on a legal or content-integrity question · reviewing a package whose value is a *finding* rather than code · designing a milestone from scratch |
| **Manager** | **Sonnet** | The handoff says Opus — which per `agents/architect.md` means the finding matters more than the code |
| **Pipeline Manager** | **Sonnet** | Same rule, and it is where most Opus packages have landed: the legal gates live here |

**Why Architect specifically, given it is the session that plans.** Architect runs longest, reads the
most, and re-sends all of it every turn — so it draws hardest on the limit *per unit of thinking*. Most
of what it does is bookkeeping the record already answers: updating a status board, writing a handoff
whose design is settled, archiving a log. **The judgement is concentrated in a few turns, not spread
across the session.** Start on Sonnet and switch up for those turns.

**The reverse mistake is the expensive one, and `agents/architect.md` already names it:** getting the
model wrong in the cheap direction costs a package; getting it wrong in the expensive direction costs
it every time. That asymmetry is about *packages*, where a bad finding ships. It does not transfer to
routine session turns, where there is no finding to miss.

## Turn off the connectors this project does not use — added 2026-09-22

**Measured 2026-09-22: 72 connector tools were loaded into an Architect session — Notion 45, Google
Drive 11, Claude Docs 8, visualize 2, scheduled-tasks 6.** This project's entire record is in git and
its content lives in Payload. It uses none of them.

**Tool definitions sit in context on every single request**, so an unused connector is a recurring cost
paid per turn, not per session — the one kind of cost archiving cannot touch. Notion and Google Drive
were turned off on 2026-09-22, which also made them off by default for new sessions.

**Check with `/context` when a session feels heavy** — `token-budget.md`'s Lever 6 has said to do this
since 2026-08-29 and nobody had, which is why 56 unused tools rode along for a month.


## Before a device gate — added 2026-09-24

The device gate is where the founder's time goes, and 2026-09-23 lost most of a day to five environment problems, **none of them app bugs**: the Mac's LAN address changed (it appears in three places), a duplicated key in `apps/mobile/.env`, backend flags never set, a zombie Metro holding port 8081, and a stale `node_modules`. **Run this first — it prints what is wrong.** Every line was tested 2026-09-24 except the `.env` one, which needs the founder's own shell (an Architect session cannot read `.env`). **The `narrator-samples` line was added 2026-09-25 and has not been run against a live backend** (the founder's was down); the route's answer — 401 without a token — is what ONBOARD-3's live verification and integration test pin. The backend's two flag lines should carry the same IP as the first line; want 0 Metro ports before Expo starts and 1 after.

```bash
cd /Users/ayushgupta/Documents/ZoomOut/ZO
IP=$(ipconfig getifaddr en0); echo "Mac IP: ${IP:-NONE (not on Wi-Fi?)}"
[ "$(grep '^EXPO_PUBLIC_API_URL=' apps/mobile/.env)" = "EXPO_PUBLIC_API_URL=http://$IP:3000" ] && echo "mobile .env OK" || echo "mobile .env WRONG: $(grep EXPO_PUBLIC_API_URL apps/mobile/.env)"
for p in 3000 3001 8081; do lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1 && echo "port $p: up" || echo "port $p: DOWN"; done
echo "Metro ports in 8081-8089 (want 1 once Expo is running): $(lsof -nP -iTCP:8081-8089 -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $9}' | sort -u | wc -l | tr -d ' ')"
B=$(lsof -nP -tiTCP:3000 -sTCP:LISTEN | head -1); [ -n "$B" ] && ps eww -p "$B" | tr ' ' '\n' | grep -E '^(MEDIA_BASE_URL|HIDE_PLACEHOLDER_CONTENT)=' || echo "backend flags: missing or backend down"
docker exec zoomout-postgres psql -U postgres -d zoomout_cms -tA -c "select id||' '||cover_url from tracks where id in ('42','50') order by id" | while read u; do case "$u" in *"$IP"*) echo "cover OK:    $u";; *) echo "cover STALE: $u";; esac; done
for n in female male; do curl -s -o /dev/null -w "greeting $n: HTTP %{http_code}\n" --max-time 5 "http://$IP:3001/api/media/file/narrator-greeting-$n.mp3"; done
curl -s -o /dev/null -w "narrator-samples route: HTTP %{http_code} (401 = new backend, 404 = old: restart it)\n" --max-time 5 "http://$IP:3000/content/narrator-samples"
S=$(find packages/shared/src -type f ! -name "*.test.ts" -exec stat -f %m {} + | sort -n | tail -1); D=$(find packages/shared/dist -type f -exec stat -f %m {} + 2>/dev/null | sort -n | tail -1); [ "${D:-0}" -ge "${S:-1}" ] && echo "shared build OK" || echo "shared build STALE (the app bundles dist): npm run build --workspace=packages/shared"
```

**If a line is wrong:**

- **The IP changed** → fix `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (one line, key once), both Tracks' `coverUrl` in admin (`http://localhost:3001/admin`, in the **Mac's** browser — not the phone's), and restart the backend with the flags below.
- **`narrator-samples route: HTTP 404`** → the backend on `:3000` predates ONBOARD-3. `git pull` in `ZO`, then restart it with the flags below. Until it is restarted the narrator beat shows an error screen with only *Try again* — no way past it (register row).
- **`shared build STALE`** → `npm run build --workspace=packages/shared`, then reload the app (`r` in the Expo terminal). `packages/shared/dist` is gitignored build output that **both the app and the backend resolve `@zoomout/shared` from**; a `git pull` does not rebuild it, and a stale copy crashes the phone (2026-09-25: `NARRATOR_LABELS` was `undefined`, a red screen on the narrator beat).
- **A port is DOWN** → start it, each in its own terminal (they run until stopped):

```bash
cd /Users/ayushgupta/Documents/ZoomOut/ZO && npm run dev --workspace=apps/admin
```

```bash
cd /Users/ayushgupta/Documents/ZoomOut/ZO && MEDIA_BASE_URL=http://$(ipconfig getifaddr en0):3001/api HIDE_PLACEHOLDER_CONTENT=true npm run dev --workspace=apps/backend
```

```bash
cd /Users/ayushgupta/Documents/ZoomOut/ZO/apps/mobile && npx expo start --clear
```

- **More than one Metro port** → `kill` the older PID. `Ctrl+C` does not always stop it.
- **On the phone:** clear Expo Go's storage (Android: Settings → Apps → Expo Go → Storage) — the intro and onboarding flags are per-install, so a used phone shows none of it — then rescan.
- **After a `git pull` that touched dependencies** → `npm install` in `ZO` first; a pull does not run it.

## Context hygiene

**Architect clears too — added 2026-09-02.** This rule existed for Manager since Phase 1 and Architect was never held to it, so one Architect session ran continuously from WP15 to WP20. **Every turn re-sends the whole conversation**, so a session that deep pays for every earlier package on every message. That was the single largest consumer of the weekly limit, and the fix costs nothing: the roadmap and the log are the memory, and Architect wrote them.

**Clear at a boundary where the record is complete — never mid-package.** A package signed off and merged: clear freely. A package half-built with undocumented reasoning in the session's head: that reasoning is what gets lost.

**Clearing is not free either.** A cleared session re-pays the document load — ~63k tokens after the 2026-09-02 archive, down from ~104k. So the rule of thumb is: **clearing saves once the conversation is longer than the documents it would reload.** That break-even is why archiving comes first, and why archiving at each sign-off matters more than any single clear.

**And resuming a long conversation after a gap is the worst case of all** — the cached context has gone cold, so you pay full price for the entire history and learn nothing new from it. Prefer to end the day at a boundary.

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
