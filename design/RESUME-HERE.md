# Resume note — app visual redesign

**Written 2026-09-05, immediately before a `/clear`.** Everything below was in a conversation that
no longer exists. Read this first if you are picking the design work back up.

---

## Where this sits relative to the build

This is **not** a work package. No handoff has been written and nothing has been committed to
`apps/mobile`. It is design exploration, sitting ahead of a future package. The last *code* work was
WP15.8 (media URL resolution), signed off and merged.

Everything in `design/` is untracked. Decide deliberately whether it gets committed — it is Architect
-owned design work and arguably belongs in the repo, but it is currently outside `project/`.

## What exists

**In Claude Design (claude.ai/design), on the founder's account:**

| Thing | State |
|---|---|
| **ZoomOut Design System** (`442bf93e-11be-447f-b4c6-087de7180cb9`) | ✅ Complete, published, **org default**. 94 tokens, 20 components, 29 cards, 1 template. Verified line by line against `apps/mobile/src/design/palette.ts` and `motion.ts` — every value exact, and the amber-is-reward-only rule survived into the CSS comments |
| **ZoomOut Track Roadmap** (`767ad8c3-0054-459d-a83b-c55c00d3e562`) | Screen 1 done (`Track roadmap.html`), Screen 2 generating (`Leaf player.html`). This project is where all remaining screens go, so they share one conversation and stay consistent |

**In this repo, under `design/`:**

- `zoomout-knowledge-tree.html` — the published canvas of my own early concepts. Superseded by
  Claude Design's output but keeps the rejected directions for the record
- `claude-design-prompts.md` — the original prompt pack. **Block 0 is now obsolete** — the design
  system carries it natively
- `remaining-screen-prompts.md` — screens 3 through 8, one paragraph each, ready to paste
- `zoomout-design-system.md`, `design-system-notes.txt` — what was pasted into the design-system
  setup. Keep as the record of what it was told
- `gen_tree.py`, `gen_synapse.py` — generators from my own attempts. `gen_synapse.py` has the
  same flaw the founder identified (straight `<line>` edges); useful only as a starting point

## The direction, and how it got there

**Knowledge graph — neurons, mindmaps, constellations.** Not a botanical tree.

Two rejections that must not be re-litigated:

1. **A botanical tree was tried and rejected as childish.** The concrete reason: every branch was a
   constant-width, round-capped stroke, making it a *silhouette* — a solid cartoon shape. The app is
   13+ and should read closer to a good IDE than to a kids' game.
2. **A three-tab navigation was invented by the tool and rejected.** The shipped app has **four**
   tabs: Explore, Library, Journey, Profile. Changing IA is a far larger job than a visual pass and
   was never asked for.

Also standing: **no real in-copyright book titles as sample content.** Use invented placeholders.
Claude Design's first mockup used *Atomic Habits*, which is specifically the title the roadmap
flagged for shipping its own competing companion app.

## ⚠️ Founder feedback on Screen 1 — NOT YET ACTED ON

Screen 1 rendered well and the founder approved the direction, with three corrections:

1. **The path is too wide.** The meander amplitude should be narrower.
2. **Add a small preview of each Leaf's details** — name, and similar — rather than bare numbers.
3. **The neurons look immature and artificial, and so does the background web.** Too many straight
   lines and too few curves, which makes it read as a **constellation rather than a neuron.** It
   needs to be curvier, more detailed, more real.

**Point 3 is the substantive one and the diagnosis is correct.** Both my generator and Claude
Design's output draw the background web as straight `<line>` segments between points — which is
literally how star charts are drawn. That is the whole problem in one detail.

### What actually makes a neuron read as real

Worth putting in the next prompt, because "make it more real" alone will not land:

- **Every connection curves.** No straight segments anywhere — quadratic or cubic béziers with
  varying curvature, including in the background web.
- **Dendrites branch recursively and taper**, three or four levels deep. They do not radiate as
  straight spokes from a centre, which is the current failure.
- **Many fine terminal branches.** Density at the extremities is most of what reads as organic.
- **Asymmetry.** Real dendritic fields are lopsided; radial symmetry reads as a snowflake.
- **The soma is a slightly irregular rounded shape**, not a perfect circle.
- **One process is longer and thinner than the rest** — the axon — giving the cell a direction.

## Next action

Redo Screen 1 in the existing `ZoomOut Track Roadmap` project with a prompt covering the three
points above, then continue with `remaining-screen-prompts.md` — screens 3 to 8.

**Two operational notes about Claude Design, learned the hard way:**

- **Enter sends.** A prompt containing newlines is submitted as separate fragments. Write prompts as
  a single paragraph, or use Shift+Enter.
- **Do not drive the browser from a Claude Code session.** It consumes usage limits very fast for
  very little return. The founder drives Claude Design; this session writes the prompts.

## Checks worth running once all screens exist

- **Amber only ever appears on a reward.** The rule most likely to erode across many generations.
- **The four tabs stay four.** It reverted to three once already.
- **Do the dendrites earn their place at real phone size?** They are what makes it read neural
  rather than as a subway map, but they are also the detail most likely to become noise. Ask for one
  frame with and one without, and compare at actual size rather than zoomed.
