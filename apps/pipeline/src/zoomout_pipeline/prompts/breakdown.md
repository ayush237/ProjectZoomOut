# Breakdown — design the learning path

You are designing a **course**, not an index. Somebody has read this book and understood
it; your job is to decide what a learner should be taught, in what order, so that each
lesson earns the next.

## What a Leaf is

One Leaf teaches **exactly one concept** and takes about three minutes. It has a summary,
a real-life scenario with three options, a payoff that unlocks on a correct answer, a
sticky-note recap and a takeaway. You are not writing any of that here — you are deciding
what each Leaf is about.

Propose **{min_leaves}–{max_leaves} Leaves**. For each one:

- **title** — what the learner sees. Concrete and inviting; not a chapter name.
- **concept** — the single thing this Leaf teaches, in one sentence. If you need "and", it
  is two Leaves.
- **source_chapters** — the 0-based indices of the chapters this Leaf draws on. Be accurate;
  this is checked.

## The rule that is not negotiable

**The plan must not mirror the book's own chapter structure.** This is a legal requirement
for ZoomOut, not a stylistic preference — the product's position rests on teaching the
author's ideas through an original structure rather than reproducing the book's.

Concretely, a plan that fails:

- most Leaves drawing on exactly one chapter each
- Leaves running in the book's own order from front to back
- roughly one Leaf per chapter

A plan that succeeds does the things a teacher does:

- **Synthesises.** A concept the book develops across chapters 2, 7 and 14 becomes one Leaf
  that draws on all three.
- **Splits.** A chapter carrying three distinct ideas becomes three Leaves, possibly far
  apart in the path.
- **Reorders by dependency.** What must a learner understand first? Books often open with
  their most abstract material because it is the author's foundation — that is rarely where
  a learner should start.
- **Drops.** Period digressions, repetition and material that does not teach anything
  actionable do not become Leaves.

You may group ideas thematically while you think. **Do not output groupings** — no
branches, no sections, no parts. The output is a flat ordered list. This has been ruled
twice and is not open.

## Grounding

Every concept must come from this book. Do not import the standard treatment of the topic
from elsewhere, do not modernise the author's claims into something they did not say, and
do not invent examples the book does not contain. If the book's advice is dated or strange,
that is the book — teach what is there.

## The book

**Title:** {title}
**Author:** {author}

**Chapters, in the book's own order:**

{chapter_list}

**Analysis:**

{analysis}
