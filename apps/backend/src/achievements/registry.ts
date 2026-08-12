import type { Achievement, AchievementTier } from '@zoomout/shared';

/**
 * The nineteen achievements, from `project/proposals/achievements.md`.
 *
 * **A registry, not branches** (§4). Each row is data plus a predicate over a snapshot
 * of facts, and one engine evaluates all of them. Adding a twentieth is a row and a
 * predicate — not a new branch in a service, and not a migration, because the catalogue
 * is deployed rather than inserted.
 *
 * Two rules hold for every predicate here:
 *
 *  - **Pure, total, and synchronous.** A predicate reads the snapshot it is given and
 *    returns a boolean. It cannot query, so it cannot be the reason an evaluation is
 *    slow, and it cannot half-fail. Everything expensive happens once, in
 *    `AchievementRepository.readFacts`.
 *  - **Monotonic in the reader's favour.** Once true, a predicate stays true for the
 *    same reader — except where the underlying fact genuinely resets, which is only the
 *    consecutive-first-try run. That matters because awarding is one-shot: an
 *    achievement whose predicate could flicker back to false would still be held, and
 *    the tile would be right while the predicate was wrong.
 *
 * Ordering is the proposal's, by category then by threshold. It is the order the client
 * renders the grid in, so it is not incidental.
 */

/**
 * Everything the predicates are allowed to know, gathered once per evaluation.
 *
 * Deliberately a flat snapshot of *counts*, not repositories or a database handle. That
 * is what keeps a predicate a one-line expression that can be read against the proposal
 * table and unit-tested with a literal — and what stops nineteen predicates issuing
 * nineteen queries.
 */
export interface AchievementFacts {
  /** Leaves finished, ever. */
  readonly completedLeaves: number;
  /** Whether any scenario has ever been answered right on the first attempt. */
  readonly hasFirstTryCorrect: boolean;
  /**
   * The current run of first-try-correct completions, ordered by completion time.
   *
   * Resets to zero on a completion that was not first-try — the reset rule §4 says is
   * the part that actually matters. Derived rather than maintained; see
   * `readConsecutiveFirstTry` for why.
   */
  readonly consecutiveFirstTry: number;
  /** Leaves finished after getting the scenario wrong at least once. */
  readonly imperfectCompletions: number;
  /** Leaves finished after **three or more** wrong attempts. */
  readonly hardWonCompletions: number;
  /** Tracks in the reader's library. */
  readonly libraryTracks: number;
  /** The reader's current streak, in days. */
  readonly streakCurrent: number;
  /** Whether today's cap has been reached. */
  readonly capReachedToday: boolean;
  /**
   * Whether the Track in hand is now fully complete.
   *
   * False whenever the evaluation is not about a Track — answering a scenario, adding a
   * book, opening a fact. `track-complete` is therefore only ever awarded on the
   * completion that finished the Track, which is also the only moment a reader would
   * expect to see it.
   */
  readonly trackCompleted: boolean;
  /** Whether every Leaf in the Track in hand was answered first-try. */
  readonly trackPerfect: boolean;
  /** Dinner Table Knowledge facts opened, ever. */
  readonly dinnerTableOpens: number;
  /** Sessions the reader has deliberately wrapped up. */
  readonly sessionWraps: number;
}

export interface AchievementDefinition extends Achievement {
  /** Pure and synchronous. See the rules above. */
  readonly unlocks: (facts: AchievementFacts) => boolean;
}

const define = (
  id: string,
  name: string,
  tier: AchievementTier,
  description: string,
  unlocks: (facts: AchievementFacts) => boolean,
): AchievementDefinition => ({ id, name, description, tier, unlocks });

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  /* --- Onboarding ------------------------------------------------------- */

  define(
    'first-leaf',
    'First Light',
    'common',
    'Complete your first Leaf.',
    (f) => f.completedLeaves >= 1,
  ),
  define(
    'first-book',
    'Shelf Space',
    'common',
    'Add your first book to your Library.',
    (f) => f.libraryTracks >= 1,
  ),
  define(
    'first-try-first',
    'Straight Through',
    'common',
    'Answer a scenario correctly on the first try.',
    (f) => f.hasFirstTryCorrect,
  ),

  /* --- Streaks ---------------------------------------------------------- */

  define('streak-3', 'Three in a Row', 'common', 'Reach a 3-day streak.', (f) => f.streakCurrent >= 3),
  define('streak-7', 'Full Week', 'rare', 'Reach a 7-day streak.', (f) => f.streakCurrent >= 7),
  define('streak-14', 'Fortnight', 'rare', 'Reach a 14-day streak.', (f) => f.streakCurrent >= 14),
  define(
    'streak-30',
    'Month of Mornings',
    'milestone',
    'Reach a 30-day streak.',
    (f) => f.streakCurrent >= 30,
  ),

  /* --- Accuracy: the thesis --------------------------------------------- */

  define(
    'sharp-5',
    'Sharp',
    'common',
    'Answer 5 scenarios in a row correctly on the first try.',
    (f) => f.consecutiveFirstTry >= 5,
  ),
  define(
    'sharp-10',
    'Locked In',
    'rare',
    'Answer 10 scenarios in a row correctly on the first try.',
    (f) => f.consecutiveFirstTry >= 10,
  ),
  define(
    'perfect-track',
    'Flawless',
    'milestone',
    'Answer every Leaf in a book correctly on the first try.',
    (f) => f.trackPerfect,
  ),

  /* --- Persistence ------------------------------------------------------ */

  define(
    'comeback',
    'Second Look',
    'common',
    'Complete a Leaf after three or more wrong attempts.',
    (f) => f.hardWonCompletions >= 1,
  ),
  define(
    'comeback-10',
    'Stubborn',
    'rare',
    'Complete 10 Leaves that took more than one attempt.',
    (f) => f.imperfectCompletions >= 10,
  ),

  /* --- Progress --------------------------------------------------------- */

  define('leaves-5', 'Getting Somewhere', 'common', 'Complete 5 Leaves.', (f) => f.completedLeaves >= 5),
  define('leaves-10', 'Ten Deep', 'common', 'Complete 10 Leaves.', (f) => f.completedLeaves >= 10),
  define('leaves-20', 'Twenty', 'rare', 'Complete 20 Leaves.', (f) => f.completedLeaves >= 20),
  define(
    'track-complete',
    'Full Circle',
    'milestone',
    'Complete every Leaf in a book.',
    (f) => f.trackCompleted,
  ),

  /* --- Session: celebrating the constraint ------------------------------ */

  define(
    'first-wrap',
    'Called It a Day',
    'common',
    'Wrap up a session for the first time.',
    (f) => f.sessionWraps >= 1,
  ),
  /**
   * Deliberate, and the proposal argues it at length: the cap is a wellbeing feature,
   * and an app that treats reaching it as a failure state teaches readers to resent it.
   */
  define(
    'daily-cap',
    'Enough for Today',
    'rare',
    'Reach the daily limit — and stop.',
    (f) => f.capReachedToday,
  ),

  /* --- Curiosity -------------------------------------------------------- */

  define(
    'dinner-party',
    'Dinner Party',
    'common',
    'Open your first Dinner Table Knowledge fact.',
    (f) => f.dinnerTableOpens >= 1,
  ),
];

/** The catalogue without its predicates — what goes over the wire. */
export function toAchievement(definition: AchievementDefinition): Achievement {
  const { id, name, description, tier } = definition;

  return { id, name, description, tier };
}

/**
 * Which achievements these facts satisfy that the reader does not already hold.
 *
 * The engine, in one function. It decides nothing about persistence: awarding is the
 * repository's job and is idempotent there, so a race that lets two evaluations both
 * reach this conclusion still produces one row.
 */
export function evaluate(
  facts: AchievementFacts,
  alreadyHeld: ReadonlySet<string>,
): readonly AchievementDefinition[] {
  return ACHIEVEMENTS.filter(
    (achievement) => !alreadyHeld.has(achievement.id) && achievement.unlocks(facts),
  );
}
