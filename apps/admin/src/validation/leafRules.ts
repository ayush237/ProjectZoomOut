import { SLIDE_KEYS } from '@zoomout/shared';

import {
  failed,
  hasText,
  PASSED,
  type LeafDocumentInput,
  type RuleResult,
} from './types';

/**
 * Content invariants for a Leaf.
 *
 * These deliberately duplicate `leafSchema` in `packages/shared`. That is a ruled
 * decision (roadmap, 2026-08-06), not an oversight: the CMS is third-party software
 * whose validation is configuration, while `leafSchema` is ours and version
 * controlled. Two independent gates on the highest-severity risk in `LEGAL.md`, and
 * if they ever disagree the content does not ship. Do not collapse them.
 */

/* -------------------------------------------------------------------------- */
/* Exactly one correct option                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The scenario must offer exactly one correct answer.
 *
 * This is the unlock gate for the payoff slide, and therefore the mechanic the whole
 * active-recall thesis rests on. Zero correct answers makes the Leaf uncompletable;
 * two makes the gate meaningless.
 *
 * Enforced on every save, not only on publish — the handoff lists it outside the
 * publish-gated group.
 */
export function checkExactlyOneCorrectOption(leaf: LeafDocumentInput): RuleResult {
  const options = leaf.scenario?.options;

  if (options === null || options === undefined) {
    // Absent rather than wrong. Row count is Payload's job via minRows/maxRows, and
    // a rule that also policed it would produce two errors for one mistake.
    return PASSED;
  }

  const correctCount = options.filter((option) => option.isCorrect === true).length;

  if (correctCount === 1) {
    return PASSED;
  }

  const detail =
    correctCount === 0
      ? 'none is marked correct'
      : `${String(correctCount)} are marked correct`;

  return failed(
    'scenario.options',
    `A scenario needs exactly one correct answer, but ${detail}. Tick exactly one option.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Dinner Table Knowledge must be sourced                                      */
/* -------------------------------------------------------------------------- */

/**
 * Dinner Table Knowledge requires a source reference on the takeaway slide.
 *
 * `LEGAL.md` names fabricated content attributed to a real author as the
 * highest-severity risk in the product and singles out this field: it is the one most
 * likely to be an interesting-sounding claim, and the one a reader is most likely to
 * repeat out loud. An unsourced one is exactly the Bookey failure.
 *
 * Enforced on every save. Attaching a source is the same edit as writing the fact, so
 * deferring the check to publish would only let the two drift apart.
 */
export function checkDinnerTableKnowledgeIsSourced(leaf: LeafDocumentInput): RuleResult {
  const fact = leaf.takeaway?.dinnerTableKnowledge;

  if (!hasText(fact)) {
    return PASSED;
  }

  const references = leaf.sourceReferences ?? [];
  const hasTakeawaySource = references.some(
    (reference) => reference.slideKey === 'takeaway' && hasText(reference.note),
  );

  if (hasTakeawaySource) {
    return PASSED;
  }

  return failed(
    'takeaway.dinnerTableKnowledge',
    'Dinner Table Knowledge must be traceable to the book. Add a Source Reference ' +
      'with slide "takeaway" and a note recording where this fact comes from, or ' +
      'remove the fact.',
  );
}

/* -------------------------------------------------------------------------- */
/* All five slides present before publish                                      */
/* -------------------------------------------------------------------------- */

/** Per-slide emptiness checks, keyed so the error can name the offending slide. */
const SLIDE_IS_POPULATED: Record<
  (typeof SLIDE_KEYS)[number],
  (leaf: LeafDocumentInput) => boolean
> = {
  summary: (leaf) => hasText(leaf.summary?.body),
  scenario: (leaf) =>
    hasText(leaf.scenario?.prompt) &&
    (leaf.scenario?.options ?? []).filter((option) => hasText(option.text)).length === 3,
  payoff: (leaf) => hasText(leaf.payoff?.body),
  stickyNotes: (leaf) =>
    (leaf.stickyNotes?.notes ?? []).some((entry) => hasText(entry.note)),
  takeaway: (leaf) => hasText(leaf.takeaway?.body),
};

/**
 * Every one of the five slides must carry content before a Leaf can be published.
 *
 * Publish-gated: a half-written Leaf is a normal intermediate state for an author, and
 * blocking the save would make the editor unusable. Blocking the *publish* is what
 * matters, because that is the point at which a reader could see it.
 */
export function checkAllSlidesPopulated(leaf: LeafDocumentInput): RuleResult {
  const missing = SLIDE_KEYS.filter((key) => !SLIDE_IS_POPULATED[key](leaf));

  if (missing.length === 0) {
    return PASSED;
  }

  return {
    ok: false,
    violations: missing.map((key) => ({
      path: key,
      message: `The "${key}" slide is incomplete. All five slides must be filled in before a Leaf can be published.`,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Composition                                                                 */
/* -------------------------------------------------------------------------- */

/** Rules enforced on every save, draft or published. */
export const LEAF_ALWAYS_RULES = [
  checkExactlyOneCorrectOption,
  checkDinnerTableKnowledgeIsSourced,
] as const;

/** Additional rules enforced only when the document is being published. */
export const LEAF_PUBLISH_RULES = [checkAllSlidesPopulated] as const;

export function validateLeaf(leaf: LeafDocumentInput, isPublishing: boolean): RuleResult {
  const rules = isPublishing ? [...LEAF_ALWAYS_RULES, ...LEAF_PUBLISH_RULES] : LEAF_ALWAYS_RULES;

  const violations = rules.flatMap((rule) => {
    const result = rule(leaf);
    return result.ok ? [] : result.violations;
  });

  return violations.length === 0 ? PASSED : { ok: false, violations };
}
