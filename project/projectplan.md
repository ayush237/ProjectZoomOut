# Project Plan — Active Feature

Owned by Architect. Represents the single feature currently being planned or implemented. Overwrite this file's content each time a new feature starts — history lives in `projectRoadmap.md`, `collaboration-log.md`, and this file's git history.

## Nothing is in flight — 2026-09-02

WP15.7 (7/7) and WP20.1 (6/6) both closed today. Track 42 carries a scenario image on all 18 draft Leaves and none on any published one, which is the boundary working as designed.

**Two things are waiting, and neither is a work package.**

1. **Open WP20.1's PR** — two commits on `wp20.1-attach-scenario-images`, not yet raised.
2. **Founder, ~15 minutes:** override the 8 images that breach the no-glow rule (Leaves 1, 2, 3, 4, 7, 11, 14, 16 — one click each in WP15.7's control, every Leaf still carrying two alternatives), then publish.

## Next — the recommendation is a second book

**A second book, public domain, structurally unlike Wattles. Not deployment.**

The case is a measurement one before it is a content one. **Every pipeline number this project owns comes from a single text** — structure-check thresholds, prompt quality, the model comparison, cost per Track, the 3–4 sticky-note clustering, and the 73-minute gate 2 figure. Wattles is short, aphoristic, and from 1910. A second, structurally different book is the cheapest way to learn which of those findings describe the pipeline and which describe *The Science of Getting Rich*. That has been in the debt register since WP16.1, flagged twice by Pipeline Manager, and it gets more expensive to answer the more decisions get built on the single sample.

**It is also the first run that is not simultaneously a debugging session.** WP20 fixed seven defects that were not in its handoff, including two retry layers multiplying and an image client with no timeout at all. Nobody has yet watched the pipeline run start to finish with those fixes in place, so the throughput and cost figures are projections, not observations.

**Why public domain, specifically: it takes the blocking decision off the table.** The curation policy has been open since the brief and is founder item 2. A public-domain title needs none of it — the 2026-08-25 ruling already established that the engineering phase carries zero exposure — so a measurement run can happen this week without settling a question that deserves more than a rushed answer. **If book #2 is meant to be launch content rather than a measurement, then the curation policy is the blocker and has to be settled first.** That is the fork, and it is the founder's.

### Why not WP12 — deployment — first

Deployment carries the one genuine security hole: Payload's REST API serves the payoff and the answer key anonymously, so an exposed CMS makes the unlock gate bypassable, and today "private networking" is a comment in one file. That is real and it is why WP12 is Stage 1 in `launch-blockers.md`.

**But it is not urgent in the way it looks.** No users exist, nothing is deployed, and the hole is a property of being deployed rather than of the code. WP12 is also the longest package on the list, it needs a domain and the founder's new GCP account, and **it produces nothing a reader could open** — the library would still be 27 placeholder Tracks and one real book.

The ordering argument is about which resource is scarce. **Compute buys ~48 books; founder review hours buy about 12.** Deployment does not consume review hours and can happen at any time. Content consumes the only input that does not scale, so time spent not generating is the one cost that cannot be recovered later.

### Also unblocked, and small

**The orphan sweep** — 146 media, 72 referenced, 74 unreferenced. It becomes a query rather than a judgement the moment the founder has overridden and published, because a candidate they might switch to only becomes an orphan after they switch. Worth folding into whatever package comes next rather than raising alone.

### Standing blocker to design around, not to solve now

**The answer-length publish-time check does not exist.** Ruled 2026-08-29: warn-only is correct while the founder is the only reader, and it stops being correct the moment a Track is visible to anyone else. **Its trigger is WP12, not the next book** — but a package that deploys before that check exists ships a mechanic `PRODUCT.md` calls the product thesis in a decorative state. Whoever writes WP12's handoff must carry it.

## What was true at the end of Phase 2 that was not obvious at the start

- **The constraint is founder hours, not money.** ~$6 of compute a book against ~73 minutes of gate 2 review. Every cost estimate made before WP20 was wrong, in one case because an unpriced model reported $0.00 and that was read as a total rather than as a broken instrument.
- **Three-quarters of gate 2 is reading, and reading does not get cheaper.** Reading time has a standard deviation of 13 seconds across Leaves whose correcting ranged from zero to 2:30. No improvement to generation, prompts or the editorial reviewer can touch it — only a better review surface can.
- **A fix belongs everywhere its concern has a sibling.** Four of WP20's seven defects were one-sided: a retry fix in the text client and not the image client, an idempotency guard in one write path and not the other. The codebase knew about every one of them; it knew in the wrong file.
- **Guardrail language outran guardrail coverage four times.** One mechanical check out of four stated image conditions, described in the plural. Ruled 2026-09-02 into a naming rule.
- **Manual verification kept finding what tests could not**, through both phases — a flagship Track invisible behind pagination, an app pinned to light mode for six packages, a citation silently pointing at the wrong chapter, and now 44% of first-choice images breaching a style rule no test could see.
