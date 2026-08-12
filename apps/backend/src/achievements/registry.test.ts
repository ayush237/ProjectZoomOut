import { describe, expect, it } from 'vitest';

import { ACHIEVEMENTS, evaluate, type AchievementFacts } from './registry.js';

/**
 * The registry against the proposal.
 *
 * These are pure predicates over a literal, so the whole file runs in milliseconds and
 * needs no database — which is the point of the registry shape. The thresholds are the
 * one thing here a reader would notice being wrong: `streak-7` firing at six days is
 * invisible in every other test in the repo, because nothing else asserts on what a
 * badge *means*.
 */

/** A reader who has done nothing. Every predicate must be false against this. */
const NOTHING: AchievementFacts = {
  completedLeaves: 0,
  hasFirstTryCorrect: false,
  consecutiveFirstTry: 0,
  imperfectCompletions: 0,
  hardWonCompletions: 0,
  libraryTracks: 0,
  streakCurrent: 0,
  capReachedToday: false,
  trackCompleted: false,
  trackPerfect: false,
  dinnerTableOpens: 0,
  sessionWraps: 0,
};

const facts = (overrides: Partial<AchievementFacts>): AchievementFacts => ({
  ...NOTHING,
  ...overrides,
});

/**
 * One row per achievement: the id, and the smallest facts that unlock it.
 *
 * `justUnder` is the same fact one step below the threshold, and is what actually
 * catches an off-by-one. Where a predicate is a boolean rather than a count there is no
 * "one below", so `NOTHING` serves — which the `unlocks nothing` test already covers.
 */
const CASES: readonly {
  id: string;
  unlocking: AchievementFacts;
  justUnder?: AchievementFacts;
}[] = [
  { id: 'first-leaf', unlocking: facts({ completedLeaves: 1 }) },
  { id: 'first-book', unlocking: facts({ libraryTracks: 1 }) },
  { id: 'first-try-first', unlocking: facts({ hasFirstTryCorrect: true }) },

  { id: 'streak-3', unlocking: facts({ streakCurrent: 3 }), justUnder: facts({ streakCurrent: 2 }) },
  { id: 'streak-7', unlocking: facts({ streakCurrent: 7 }), justUnder: facts({ streakCurrent: 6 }) },
  {
    id: 'streak-14',
    unlocking: facts({ streakCurrent: 14 }),
    justUnder: facts({ streakCurrent: 13 }),
  },
  {
    id: 'streak-30',
    unlocking: facts({ streakCurrent: 30 }),
    justUnder: facts({ streakCurrent: 29 }),
  },

  {
    id: 'sharp-5',
    unlocking: facts({ consecutiveFirstTry: 5 }),
    justUnder: facts({ consecutiveFirstTry: 4 }),
  },
  {
    id: 'sharp-10',
    unlocking: facts({ consecutiveFirstTry: 10 }),
    justUnder: facts({ consecutiveFirstTry: 9 }),
  },
  { id: 'perfect-track', unlocking: facts({ trackPerfect: true }) },

  {
    id: 'comeback',
    unlocking: facts({ hardWonCompletions: 1 }),
    justUnder: facts({ hardWonCompletions: 0, imperfectCompletions: 5 }),
  },
  {
    id: 'comeback-10',
    unlocking: facts({ imperfectCompletions: 10 }),
    justUnder: facts({ imperfectCompletions: 9 }),
  },

  {
    id: 'leaves-5',
    unlocking: facts({ completedLeaves: 5 }),
    justUnder: facts({ completedLeaves: 4 }),
  },
  {
    id: 'leaves-10',
    unlocking: facts({ completedLeaves: 10 }),
    justUnder: facts({ completedLeaves: 9 }),
  },
  {
    id: 'leaves-20',
    unlocking: facts({ completedLeaves: 20 }),
    justUnder: facts({ completedLeaves: 19 }),
  },
  { id: 'track-complete', unlocking: facts({ trackCompleted: true }) },

  { id: 'first-wrap', unlocking: facts({ sessionWraps: 1 }) },
  { id: 'daily-cap', unlocking: facts({ capReachedToday: true }) },

  { id: 'dinner-party', unlocking: facts({ dinnerTableOpens: 1 }) },
];

describe('the catalogue', () => {
  it('has all nineteen achievements from the proposal', () => {
    expect(ACHIEVEMENTS).toHaveLength(19);
  });

  it('covers exactly the ids the proposal names', () => {
    expect(ACHIEVEMENTS.map((achievement) => achievement.id).sort()).toEqual(
      CASES.map((testCase) => testCase.id).sort(),
    );
  });

  it('gives every achievement a name, a description and a tier', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.name.length).toBeGreaterThan(0);
      expect(achievement.description.length).toBeGreaterThan(0);
      expect(['common', 'rare', 'milestone']).toContain(achievement.tier);
    }
  });

  it('has no duplicate ids', () => {
    // A duplicate would make the unique index reject the second insert of a single
    // award batch, failing a completion for a reader who did nothing wrong.
    const ids = ACHIEVEMENTS.map((achievement) => achievement.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the predicates', () => {
  it('unlocks nothing for a reader who has done nothing', () => {
    expect(evaluate(NOTHING, new Set())).toEqual([]);
  });

  it.each(CASES)('unlocks $id at its threshold', ({ id, unlocking }) => {
    expect(evaluate(unlocking, new Set()).map((achievement) => achievement.id)).toContain(id);
  });

  it.each(CASES.filter((testCase) => testCase.justUnder !== undefined))(
    'does not unlock $id one step below its threshold',
    ({ id, justUnder }) => {
      expect(evaluate(justUnder as AchievementFacts, new Set()).map((a) => a.id)).not.toContain(id);
    },
  );

  it('never re-offers something the reader already holds', () => {
    // The engine half of idempotency. The storage half — the unique index — is proven
    // against a real database in the integration suite.
    const held = new Set(['first-leaf']);

    expect(evaluate(facts({ completedLeaves: 1 }), held).map((a) => a.id)).not.toContain(
      'first-leaf',
    );
  });

  it('awards the progress ladder together when a reader crosses several at once', () => {
    // Twenty completed Leaves satisfies 5, 10 and 20. All three are owed, and a reader
    // who earned them in one completion should be told about all three rather than
    // being drip-fed one per action.
    const earned = evaluate(facts({ completedLeaves: 20 }), new Set()).map((a) => a.id);

    expect(earned).toEqual(expect.arrayContaining(['leaves-5', 'leaves-10', 'leaves-20']));
  });
});
