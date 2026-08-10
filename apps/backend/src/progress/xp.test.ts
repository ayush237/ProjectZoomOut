import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config/env.js';
import { calculateLeafXp, type XpRules } from './xp.js';

/**
 * XP calculation.
 *
 * The load-bearing test here is the last one: the numbers must move with configuration
 * alone. They are placeholder economics until the loop is playable, and if tuning them
 * needs a code change the founder will be tuning them through pull requests.
 */

const RULES: XpRules = { completion: 80, firstTryBonus: 20 };

describe('calculateLeafXp', () => {
  it('awards the flat completion value', () => {
    expect(calculateLeafXp(RULES, { firstTryCorrect: false })).toBe(80);
  });

  it('adds the bonus for a first-try correct answer', () => {
    expect(calculateLeafXp(RULES, { firstTryCorrect: true })).toBe(100);
  });

  it('pays more for a first-try answer than for a later one', () => {
    // The relationship, not the numbers: this has to stay true through every tuning.
    const firstTry = calculateLeafXp(RULES, { firstTryCorrect: true });
    const eventually = calculateLeafXp(RULES, { firstTryCorrect: false });

    expect(firstTry).toBeGreaterThan(eventually);
  });

  it('still awards the base value when the bonus is configured to zero', () => {
    // Turning the bonus off is a legitimate tuning move; it must not zero the award.
    expect(calculateLeafXp({ completion: 80, firstTryBonus: 0 }, { firstTryCorrect: true })).toBe(
      80,
    );
  });

  it('lands the WP5 daily cap near five Leaves at the shipped defaults', () => {
    // Plan §3.5 wants 500 XP/day to be about five ~3-minute Leaves. Five perfect ones
    // hit it exactly; a reader who needs a second attempt each time takes six or seven.
    const config = loadConfig({
      DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
      AUTH_JWT_SECRET: 'x'.repeat(48),
    });
    const defaults: XpRules = {
      completion: config.XP_LEAF_COMPLETION,
      firstTryBonus: config.XP_FIRST_TRY_BONUS,
    };

    expect(calculateLeafXp(defaults, { firstTryCorrect: true }) * 5).toBe(500);
    expect(calculateLeafXp(defaults, { firstTryCorrect: false }) * 5).toBeLessThan(500);
  });

  it('moves with configuration alone', () => {
    const tuned = loadConfig({
      DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
      AUTH_JWT_SECRET: 'x'.repeat(48),
      XP_LEAF_COMPLETION: '10',
      XP_FIRST_TRY_BONUS: '5',
    });

    expect(
      calculateLeafXp(
        { completion: tuned.XP_LEAF_COMPLETION, firstTryBonus: tuned.XP_FIRST_TRY_BONUS },
        { firstTryCorrect: true },
      ),
    ).toBe(15);
  });
});
