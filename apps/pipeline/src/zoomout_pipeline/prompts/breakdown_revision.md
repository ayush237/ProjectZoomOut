# Breakdown — revision

Your previous plan was rejected by the automated structure check. This check is mechanical
and legally load-bearing: it measures how closely the plan reproduces the book's own
structure, and a plan that fails it cannot proceed regardless of how good the titles are.

## What was wrong

{findings}

## The measurements

- Leaves drawing on exactly one chapter: **{single_chapter_ratio:.0%}** (must be at most
  {max_single_chapter_ratio:.0%})
- Steps that follow the book's own order: **{sequential_ratio:.0%}** (must be at most
  {max_sequential_ratio:.0%} when the Leaf count is close to the chapter count)
- Plan: **{leaf_count}** Leaves against **{chapter_count}** chapters

## What to do

Do not renumber the same plan or rename its Leaves. **The check does not read titles** — it
reads which chapters each Leaf draws on and what order they run in. A plan that is the same
walk through the book with better titles fails again identically, and you will have spent an
attempt learning nothing.

Go back to the ideas. For each one, find **every** place the book develops it, and let a Leaf
draw on all of them at once — an idea the author returns to repeatedly is usually the most
important one in the book. Then order the Leaves by what a learner needs first rather than by
where the material appears.

Before you answer, count it yourself: how many of your Leaves draw on exactly one chapter, and
do your chapter numbers mostly ascend as you read down the plan? If either answer is yes, you
have not changed anything that the measurement looks at.

## Your previous plan

{previous_plan}

## The book

**Title:** {title}
**Author:** {author}

**Chapters, in the book's own order:**

{chapter_list}

**Analysis:**

{analysis}
