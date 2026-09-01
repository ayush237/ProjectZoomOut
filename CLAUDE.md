# CLAUDE.md

Read this file in full before taking any action in this repository. It applies to every session, regardless of role.

## Project
- **Name:** ZoomOut
- **One-liner:** Turns non-fiction books into gamified, interactive micro-lessons — active engagement instead of passive summaries, in ~15-minute sessions.
- **Stack:** React Native (Expo) + TypeScript mobile app, Node.js + TypeScript backend, PostgreSQL. The Phase 2 AI pipeline will likely be a separate Python service (Gemini via Vertex AI, ElevenLabs).
- **Full product context:** `project/PRODUCT.md` — read this before planning or implementing any feature. It defines the Track/Leaf taxonomy, the 5-slide Leaf structure, and the legal/content-integrity constraints that are hard requirements, not suggestions.

## How this repo is worked on
Built through three persistent, separate Claude Code sessions with distinct roles. They are not interchangeable.

| Session | Persona file | Launch | Owns |
|---|---|---|---|
| Architect | `agents/architect.md` | `claude-architect` (see `project/GETTING_STARTED.md`) | Planning, roadmap, architecture, handoff prompts, proposal/design docs. Doesn't touch application code — by instruction, not a technical restriction. |
| Manager | `agents/manager.md` | `claude-manager` | Implementation, tests, e2e verification. Never edits planning docs (only appends to the collaboration log). |
| Pipeline Manager | `agents/pipeline-manager.md` | see `project/GETTING_STARTED.md` | The Python content pipeline at `apps/pipeline` and nothing else. Added 2026-08-13. Same rules as Manager on planning docs. |

Note: `agents/` here holds our own persona documents, loaded via `--append-system-prompt`. It's separate from Claude Code's native subagent directory at `.claude/agents/`, which holds `researcher` and `code-reviewer` — small, focused helpers the Architect session invokes mid-conversation for research and read-only review.

If you're a fresh session and don't know which role you are, stop and ask before doing anything else.

## Reporting to the founder
Applies to both sessions. The founder is a developer — jargon is not the problem. Density and ordering are.

**Every report in chat opens with a summary block, before any detail:**

```
**Bottom line:** <one sentence — what state is this in>
**Needs you:** <decisions or actions required, or "nothing">
**Blocked:** <what's waiting, on what, or "nothing">
```

That block must be readable in about fifteen seconds. Detail follows underneath, ordered by consequence — most important first, not chronologically.

**Depth is not the problem and must not be cut.** The rationale behind a ruling, the reason a bug matters, the tradeoff that was taken — all of it stays. It just stops being the first thing, and stops competing with the one line the founder actually needs to act on.

Rules of thumb:
- **Conclusion before reasoning, always.** Never make the founder read an argument to find the verdict.
- One idea per paragraph. If a paragraph carries three, split it.
- Bold the load-bearing phrase in a long bullet so it survives skimming.
- Write "nothing" explicitly rather than dropping a heading — an absent line is ambiguous.
- Don't restate in prose what a table already says.
- Findings, decisions, and status are three different things. Don't interleave them.

**This governs chat only.** Files under `project/` — the collaboration log, roadmap, and debt register — are the durable record and keep their full depth and current structure. Do not compress them to match a chat summary.

## Repository map
```
.
├── CLAUDE.md
├── agents/
│   ├── architect.md
│   └── manager.md
├── project/
│   ├── PRODUCT.md             # full product spec — read first
│   ├── LEGAL.md                # full legal/IP strategy — read before content-generation features
│   ├── original-brief.md       # founder's original, unedited brief (archival)
│   ├── projectplan.md         # active feature plan (Architect-owned)
│   ├── projectRoadmap.md      # roadmap, backlog, decisions (Architect-owned)
│   ├── collaboration-log.md   # handoffs + completion reports (active packages only)
│   ├── archive/               # Phase 1 + Phase 2 logs and pre-08-25 decisions — read only when tracing history
│   ├── token-budget.md        # how this project keeps per-session context small — read before adding to project/
│   └── GETTING_STARTED.md     # how to launch each session
├── .claude/
│   ├── settings.json
│   └── agents/                 # native subagents: researcher, code-reviewer
├── apps/
│   ├── mobile/                 # React Native (Expo) app
│   ├── backend/                 # Node.js/TypeScript API — users, gamification, content, auth
│   └── admin/                   # internal content-authoring tool (Phase 1 priority)
├── packages/
│   └── shared/                  # shared TypeScript types (Leaf, Track, User, Progress...)
└── .github/workflows/           # CI — TBD
```

## Commands
Standard for this stack — verify against the real `package.json` scripts once the repo is scaffolded:
- Install: `npm install` (repo root, npm workspaces)
- Dev (mobile): `npm run dev --workspace=apps/mobile`
- Dev (backend): `npm run dev --workspace=apps/backend`
- Test: `npm test`
- Lint / typecheck: `npm run lint` / `npm run typecheck`
- Build: `npm run build`

## Engineering standards (applies to all code, regardless of who writes it)
- TypeScript strict mode across mobile, backend, and shared packages — no `any` without a comment explaining why
- SOLID principles, sound OOP (clear interfaces, encapsulation), composition over inheritance by default
- Clear layering (handler/service/repository or the stack's idiomatic equivalent) — no business logic in handlers/controllers
- Explicit, typed error handling — nothing fails silently
- Config and secrets via environment variables only — never hardcoded, never committed
- Every new piece of logic ships with tests (unit at minimum; integration/e2e where it crosses a boundary)
- Structured logging at service boundaries and error paths
- Shared types (Leaf, Track, User, Progress, etc.) live in `packages/shared` — never redefine the same shape in both `apps/mobile` and `apps/backend`

## Source of truth for planning
- `project/projectplan.md` — the feature currently being planned or implemented
- `project/projectRoadmap.md` — backlog, milestones, decisions log
- `project/collaboration-log.md` — append-only record of what was handed off and what was completed

## Non-negotiables
1. Architect never edits code under `apps/` or `packages/` — an instruction it follows, not a tool restriction, since it needs Edit/Write for planning docs and proposals.
2. Manager never edits `projectplan.md` or `projectRoadmap.md` — only appends to `collaboration-log.md`.
3. Nothing is "done" without passing tests and a logged completion report.
4. No secrets or credentials in anything that gets committed.
5. Any content-generation or content-admin feature must follow `project/PRODUCT.md`'s Content Integrity & Legal Constraints section — these support ZoomOut's fair-use legal position and are not optional polish.

## Useful commands for both sessions
- `/context` — check which memory files actually loaded this session
- `/compact` — proactively compact before a session feels heavy
- `/init` — regenerate this file's factual sections once real code exists (review before accepting)
