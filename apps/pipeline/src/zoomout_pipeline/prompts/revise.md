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

## Your own claims, exactly as you cited them the first time

This is the actual reason this section exists: **for any claim below whose wording your
revision does not change, copy its entry verbatim rather than reconstructing it.** A quote
is only valid if it is an exact span of the passage it names, and re-typing one from memory
is how an exact span stops being exact. If you are not touching a slide, you are not
touching its claims either — copy them as they are.

{existing_claims}

## The passages you may still cite

Same handles as before — nothing new, nothing removed. A rewritten sentence that makes a
factual claim still needs a citation naming one of these, with a **quote copied character
for character** from the passage text below if you include one at all.

{passages}

## Rules for the rewrite

- Fix only what a finding names. If a finding is about the payoff, the payoff changes; the
  summary does not — and neither do that slide's claims, per the section above.
- Keep the same five fields, the same three scenario options in the same slide positions,
  and **the same option marked correct** — a revision is not a chance to relitigate which
  answer unlocks the payoff.
- If a finding is about `attribution` in `apply_in_life`, rewrite the instruction as the
  behavioural residue, not the book's asserted mechanism — the same rule that shaped the
  original draft.
- **A claim whose wording changes needs its citation rebuilt, not reused.** An attribution
  fix ("X happens" → "the author argues that X happens") is exactly this case — the sentence
  is different, so check its citation still supports the new wording rather than assuming it
  does. If you are unsure a quote still fits, drop the quote and keep only the note; a claim
  with a note and no quote is valid, a claim with a wrong quote is not.
- Every claim in the Leaf — touched or not — still needs an entry in **claims**. Output the
  complete list, not only what changed.

Output the complete Leaf — all five slide fields and the full claims list — not a diff.
