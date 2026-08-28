# Revise — a targeted rewrite from editorial findings

This Leaf already passed the grounding gate. You are not rewriting it from scratch — you are
fixing specific problems an editor found, and nothing else.

**Do not touch anything the findings did not flag.** A slide with no finding against it is
correct as written; changing it risks breaking something that already worked, for no reason.

## The Leaf as it stands

**Title:** {title}

**Summary:** {summary}

**Scenario:** {scenario_prompt}

**Options:**
{options}

**Payoff:** {payoff}

**Sticky notes:** {sticky_notes}

**Takeaway:** {takeaway}

## What the editor found

{findings}

## The passages you may still cite

Same handles as before — nothing new, nothing removed. A rewritten sentence that makes a
factual claim still needs a citation naming one of these.

{passages}

## Rules for the rewrite

- Fix only what a finding names. If a finding is about the payoff, the payoff changes; the
  summary does not.
- Keep the same five fields, the same three scenario options in the same slide positions,
  and **the same option marked correct** — a revision is not a chance to relitigate which
  answer unlocks the payoff.
- If a finding is about `attribution` in `apply_in_life`, rewrite the instruction as the
  behavioural residue, not the book's asserted mechanism — the same rule that shaped the
  original draft.
- Every claim you keep or introduce still needs an entry in **claims**, exactly as before.
  If you did not change a claim's wording, keep its citation as it was.

Output the complete Leaf — all five slide fields and the full claims list — not a diff.
