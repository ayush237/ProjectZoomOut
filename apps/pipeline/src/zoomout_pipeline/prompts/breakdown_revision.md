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

Do not renumber the same plan or rename its Leaves. The check does not read titles — it
reads which chapters each Leaf draws on and what order they run in. A plan that is the same
walk through the book with better titles fails again identically.

Rebuild the path around **what a learner needs first**, and make Leaves that genuinely draw
on several places in the book. Concepts the author returns to repeatedly are the ones that
should become single, well-sourced Leaves.

## Your previous plan

{previous_plan}

## The book

**Title:** {title}
**Author:** {author}

**Chapters, in the book's own order:**

{chapter_list}

**Analysis:**

{analysis}
