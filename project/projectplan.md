# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## 🔵 In flight — WP20.1: attach Track 42's scenario images

**Pipeline Manager. Handed off 2026-09-02.** The full prompt is in `collaboration-log.md`.

WP20 published Track 42 with diagrams but no scenario illustrations — 54 candidates generated, none attached, because selection was WP15.7's affordance and it had not landed yet. **WP15.7 landed on 2026-09-02** (7/7, PR #28), so a candidate is now one click rather than two copy-pastes, and the blocking reason is gone.

**The founder has delegated selection for this Track only.** That is what makes it a command rather than 18 decisions: the pipeline attaches the first candidate passing the guardrails, writes drafts, and reports the 18 picks as a list to override. The founder publishes.

**The two things that must hold**, both drawn from failures already recorded rather than from caution:

- **Drafts only.** The machine key cannot edit published content and must not gain the ability.
- **Full read-modify-write on the scenario group.** WP19 demonstrated by hand that a partial PATCH silently nulls the siblings it omits, on this exact group. `scenario.prompt` and `scenario.options` survive — proven by re-fetching, not by trusting the response.

**Status as of 2026-09-02:** uncommitted work on `wp20.1-attach-scenario-images` in the shared checkout — a new `assets/selection.py`, a CLI command, a CMS client change, and tests. No completion report yet.

## Next, once WP20.1 closes

**No package is queued and no handoff is written.** The sequencing question is open and belongs to the founder, because the two candidates answer to different constraints:

- **WP12 — deployment.** Carries the one genuine security hole: Payload's REST API serves the payoff and the answer key anonymously, so an exposed CMS makes the unlock gate bypassable. Today "private networking" is a comment in one file. It is also the longest package on the list and gates password reset behind it.
- **More books.** The library is 27 placeholder Tracks plus one real one. `launch-blockers.md` calls no real content "the whole game", and the ceiling is founder review hours — about 12 books — not money.

**Founder item 1 is cheaper than either and should not wait for them**: Track 42's `disclaimer` currently holds editorial instructions rather than a non-endorsement disclaimer, and its purchase URL has no scheme. Those are the two surfaces `LEGAL.md` calls load-bearing, on the only real Track we have. Ten minutes in the CMS, and it gets more expensive the moment WP12 makes it reachable.

## What was true at the end of Phase 2 that was not obvious at the start

- **The constraint is founder hours, not money.** ~$6 of compute a book against ~73 minutes of gate 2 review. The credit buys ~48 books; the founder's time buys about 12. Every cost estimate made before WP20 was wrong, in one case because an unpriced model reported $0.00 and that was read as a total rather than as a broken instrument.
- **Three-quarters of gate 2 is reading, and reading does not get cheaper.** Reading time has a standard deviation of 13 seconds across Leaves whose correcting ranged from zero to 2:30. No improvement to generation, prompts or the editorial reviewer can touch it — only a better review surface can.
- **A fix belongs everywhere its concern has a sibling.** Four of WP20's seven defects were one-sided: a retry fix in the text client and not the image client, an idempotency guard in one write path and not the other. The codebase knew about every one of them; it knew in the wrong file.
- **Manual verification kept finding what tests could not**, through both phases — a flagship Track invisible behind pagination, an app pinned to light mode for six packages, a citation silently pointing at the wrong chapter.
