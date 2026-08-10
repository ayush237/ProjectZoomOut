/**
 * XP calculation.
 *
 * Pure, and separated from the service that awards it, because "what is this worth"
 * and "has this already been paid" are different questions with different failure
 * modes. This file answers only the first.
 *
 * Every value arrives as configuration. The numbers are placeholder economics until
 * the loop is playable (WP6–WP8), and tuning them must not require a deploy.
 */

export interface XpRules {
  /** Flat award for completing a Leaf. */
  readonly completion: number;
  /** Added when the scenario was answered correctly on the first attempt. */
  readonly firstTryBonus: number;
}

/**
 * What completing a Leaf is worth to this reader.
 *
 * The bonus is paid on `firstTryCorrect` and nothing else — not on the attempt count,
 * not on elapsed time. A reader who answers correctly at the second attempt has still
 * done the thing the product is for, so they are paid the base award rather than
 * penalised further.
 *
 * WP5 owns the daily cap. This returns the *earned* amount; capping it is a separate
 * decision made against the reader's session, and conflating the two here would make
 * the cap invisible to whatever eventually has to explain it to a reader.
 */
export function calculateLeafXp(rules: XpRules, progress: { firstTryCorrect: boolean }): number {
  return rules.completion + (progress.firstTryCorrect ? rules.firstTryBonus : 0);
}
