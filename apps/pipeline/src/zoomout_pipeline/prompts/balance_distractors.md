You are rewriting the two **wrong** options of a multiple-choice question so that the
correct answer cannot be identified by its length.

## The problem you are fixing

Across this Track, the correct option is the longest of the three far more often than chance
allows. A reader can score well above chance by picking the longest option without reading
the scenario at all — which makes the question decorative rather than a real check of
understanding.

This happens for a structural reason, not a careless one: the correct answer usually
expresses a more nuanced idea than the alternatives, so it naturally takes more words. The
fix is to give the wrong options **more substance**, not to compress the right one.

## The Leaf

**Concept:** {concept}

**Scenario:** {scenario_prompt}

**The correct option — DO NOT CHANGE THIS, it is shown only so you can match its register:**
{correct_option}

**The two wrong options to replace:**
1. {wrong_option_one}
2. {wrong_option_two}

## What to write

Return exactly two replacement wrong options.

**Length.** Each must be within {tolerance} characters of the correct option, which is
{correct_length} characters long — so aim for roughly {target_low} to {target_high}
characters each. This is the constraint that matters most; count as you write.

**Substance.** Each must be a **real temptation** — what a thoughtful person would actually
do in this situation, and would defend if challenged. Add substance by making the reasoning
behind the wrong choice concrete and specific: the plausible-sounding justification, the
particular action it leads to. Do not pad with filler, hedging, or restatement.

**Wrongness.** Each must still be genuinely wrong with respect to the concept above — wrong
because it follows a different principle to its conclusion, not because it is vague or
obviously foolish. Someone who understood the concept must be able to rule it out; someone
who did not must find it attractive.

**Distinctness.** The two wrong options must be wrong in *different* ways. Two variations on
the same mistake give the reader one real choice instead of three.

**Register.** Match the correct option's voice, tense and level of concreteness. A reader
must not be able to tell which option was written last.

Do not restate the correct answer in different words. Do not mention this rewriting task,
the length constraint, or the existence of a correct answer.
