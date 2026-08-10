import { z } from 'zod';

import { cmsIdSchema, isoTimestampSchema, localDateSchema, uuidSchema } from './primitives.js';

/**
 * A user's progress through one Leaf.
 *
 * `firstTryCorrect` drives the XP bonus (PRODUCT.md). Wrong answers retry without
 * limit, so `attemptCount` is unbounded above — the stakes live in XP, not in access.
 */
export const leafProgressSchema = z.object({
  userId: uuidSchema,
  leafId: cmsIdSchema,
  attemptCount: z.number().int().nonnegative(),
  firstTryCorrect: z.boolean(),
  /**
   * When the reader first answered the scenario correctly. **Null means the payoff is
   * locked**, and that is the whole unlock gate: the server consults this before it
   * will put payoff prose in any response.
   *
   * Added in WP4. `firstTryCorrect` cannot stand in for it — it is false both for a
   * reader who has never answered and for one who got it right on the third attempt,
   * and those two must not be given the same access. A timestamp rather than a boolean
   * because WP5 groups activity by day and will want to know *when*, not just whether.
   */
  correctAt: isoTimestampSchema.nullable(),
  /** Null until the Leaf is finished; a started-but-unfinished Leaf still has a row. */
  completedAt: isoTimestampSchema.nullable(),
  xpAwarded: z.number().int().nonnegative(),
});

/**
 * One day of activity, keyed on the user's **local** date.
 *
 * Not UTC. Plan §3.5 calls this out as the single most common source of streak and
 * cap bugs, and PRODUCT.md fixes the reset at the user's local midnight. The type is
 * `localDateSchema` rather than a timestamp so that keying it off a UTC instant
 * requires a deliberate, visible conversion.
 */
export const dailySessionSchema = z.object({
  userId: uuidSchema,
  localDate: localDateSchema,
  secondsActive: z.number().int().nonnegative(),
  xpEarned: z.number().int().nonnegative(),
  /** Set the moment the 15-minute or 500 XP cap is hit; null while still under it. */
  capReachedAt: isoTimestampSchema.nullable(),
});

/**
 * Maintained by completing at least one Leaf in a local day. No freezes or repairs in
 * Phase 1 (PRODUCT.md).
 */
export const streakSchema = z.object({
  userId: uuidSchema,
  current: z.number().int().nonnegative(),
  longest: z.number().int().nonnegative(),
  /** Null for a user who has never completed a Leaf. */
  lastActiveLocalDate: localDateSchema.nullable(),
});

export type LeafProgress = z.infer<typeof leafProgressSchema>;
export type DailySession = z.infer<typeof dailySessionSchema>;
export type Streak = z.infer<typeof streakSchema>;
