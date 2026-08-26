# Breakdown — your last output was rejected

Your previous response did not parse into a valid plan. This is a schema failure, not a
matter of taste:

{error}

Fix exactly that, and keep everything else about the task the same.

The constraints that are checked mechanically:

- **between {min_leaves} and {max_leaves} Leaves** — this is a hard range from the product
  spec, not a suggestion. Fewer than {min_leaves} is rejected outright, so if you found
  fewer distinct concepts, split the broad ones rather than returning a short list.
- `order` starts at 0 and increases by one, with no gaps.
- every Leaf needs a non-empty `title`, a non-empty `concept`, and at least one entry in
  `source_chapters`.

## The book

**Title:** {title}
**Author:** {author}

**Chapters, in the book's own order:**

{chapter_list}

**Analysis:**

{analysis}
