# Breakdown — build a learning path that departs from the book's own order

Your task is **not** to divide this book into lessons. Dividing it into lessons produces its
table of contents with new titles on it, and that output is rejected.

Your task is to decide **what a learner needs to be taught, and in what order**, using this
book as the source of the ideas but not as the shape of the course. A book is organised the
way its author wanted to argue. A course is organised the way a person learns. Those are
rarely the same order, and where they differ you follow the learner.

**This is a legal requirement, not a preference.** ZoomOut teaches an author's ideas through
its own structure; reproducing the book's structure is the thing the product may not do. A
plan is measured against this after you write it, and a plan that mirrors the book is sent
back regardless of how good its titles are.

## How to build the plan

Work in this order. Do not start by listing chapters.

1. **List the ideas the book actually teaches.** Not its chapters — its ideas. Some occupy
   half a chapter. Some are spread across five chapters because the author keeps returning
   to them. Some are repeated three times in different words and are one idea.
2. **For each idea, find every place the book develops it.** An idea the author returns to
   repeatedly is usually the most important one, and it should become a single Leaf drawing
   on all those places at once.
3. **Order the ideas by dependency.** What must a learner already understand for this to make
   sense? Books frequently open with their most abstract foundation because that is where the
   argument starts — that is rarely where a learner should start. Start with what a learner
   can act on or recognise, and place the abstract material where it becomes necessary.
4. **Split what is too big and drop what does not teach.** A chapter carrying three distinct
   ideas becomes three Leaves, which may sit far apart in the path. Period digressions,
   repetition, and passages that teach nothing actionable become nothing.
5. **Only now write the titles.** A title describes what the learner will be able to do or
   see differently. If a title could be a chapter heading in this book, rewrite it.

## What this looks like — a worked example

A fictional book, so nothing here belongs to the book you are working on.

> *The Patient Gardener* — eight chapters, numbered from 0 as they are given to you:
> 0. Why Gardens Fail · 1. Reading Your Soil · 2. The Myth of the Green Thumb ·
> 3. Watering · 4. Light and Shade · 5. Pruning · 6. Pests and Disease ·
> 7. The Gardener's Year

**A plan that is rejected:**

| order | Title | source_chapters |
|---|---|---|
| 0 | Why Gardens Fail | [0] |
| 1 | Understanding Your Soil | [1] |
| 2 | The Green Thumb Myth | [2] |
| 3 | How to Water | [3] |
| 4 | Light and Shade | [4] |

Eight chapters, eight Leaves, each drawn from one chapter, in the book's order, with the
chapter headings lightly reworded. This is the table of contents. Rejected.

**A plan that is accepted:**

| order | Title | source_chapters | Why |
|---|---|---|---|
| 0 | Most plants die of kindness, not neglect | [0, 3, 6] | Overwatering appears in the failure chapter, the watering chapter and the disease chapter. The book never states it in one place; it is the book's real thesis |
| 1 | Your soil already tells you what will grow | [1, 4] | Soil and light are treated separately by the author but are one decision for a learner |
| 2 | Skill looks like talent from the outside | [2, 7] | The green-thumb myth only lands once you have seen the year-round routine that produces it |
| 3 | Cutting a healthy plant is how you keep it healthy | [5] | Genuinely one chapter. Some ideas are |

Note what changed. Leaves draw on several chapters at once. The order is not the book's — the
year-round routine from chapter 8 arrives early because it explains chapter 3. One Leaf still
comes from a single chapter, and that is fine: the requirement is that the plan as a whole is
not a chapter-by-chapter walk, not that no Leaf may ever sit in one place.

## Check your own plan before you answer

Count, on the plan you are about to return:

- **How many Leaves draw on exactly one chapter?** If that is more than half of them, you
  have divided the book rather than rebuilt it. Go back to step 2 and find the ideas that
  span chapters.
- **Do the chapter numbers mostly ascend as you read down your plan?** If they do, you have
  kept the book's order. Reorder by what a learner needs first.
- **Is your Leaf count close to the chapter count?** If so, look again for chapters holding
  more than one idea, and for ideas that should merge.

Fix the plan before answering. You will not get to see the measurement.

## Output

Propose **between {min_leaves} and {max_leaves} Leaves** — fixed by the product spec; a plan
outside that range is rejected unread. Most books support the upper half of that range once
chapters are split by idea.

**Numbering is 0-based throughout.** `order` runs 0, 1, 2 … with no gaps and no repeats, and
the first Leaf is `order: 0`. Chapter indices are 0-based too — the chapter list below is
numbered the way you must refer to it. A plan numbered from 1 is rejected before it is read.

For each Leaf:

- **order** — position in the path, starting at 0 and increasing by exactly 1.
- **title** — what the learner sees. Concrete, and not a chapter name.
- **concept** — the single thing this Leaf teaches, in one sentence. If you need the word
  "and", it is two Leaves.
- **source_chapters** — 0-based indices of every chapter this Leaf draws on. Be accurate and
  be complete; this is what the measurement reads.

One Leaf teaches exactly one concept and takes about three minutes to consume. You are not
writing the slides here — only deciding what each Leaf is about.

**Output a flat ordered list.** No branches, no sections, no parts, no groupings of any kind.
You may group thematically while thinking; it must not appear in the output.

## Grounding

Every idea must come from this book. Do not import the standard treatment of this topic from
elsewhere, do not modernise the author's claims into something they did not say, and do not
invent examples the book does not contain. If the book's advice is dated or strange, teach
what is actually there.

## The book

**Title:** {title}
**Author:** {author}

**Chapters, in the book's own order:**

{chapter_list}

**Analysis:**

{analysis}
