import { z } from 'zod';

import { isoTimestampSchema } from './primitives.js';

/**
 * Achievements, settled in WP5b from `project/proposals/achievements.md`.
 *
 * **Replaces the WP0 provisional shape**, which keyed an achievement by `uuid` and
 * implied a table of achievement *rows*. The proposal rules the opposite: achievements
 * are a **registry** — data plus a predicate, defined in code and evaluated by one
 * engine — so their identity is a stable slug an engineer writes, not a primary key a
 * database hands out. `first-leaf` means the same thing in every environment; a UUID
 * would differ per deployment and could not be referenced from a predicate at all.
 *
 * **The catalogue is not defined here.** The nineteen definitions and their predicates
 * live in `apps/backend/src/achievements/registry.ts`, and the client receives them over
 * the wire rather than holding a second copy — the same reasoning as the session cap's
 * thresholds travelling with `SessionStatus`. A client-side list would go stale the
 * moment a twentieth achievement shipped, and locked tiles would silently disappear.
 */

export const ACHIEVEMENT_TIERS = ['common', 'rare', 'milestone'] as const;

/**
 * Visual weight on the unlock screen, per §2 of the proposal.
 *
 * Ordered least to most significant. It is presentation, not access — nothing is gated
 * on a tier, and a `milestone` awards no more XP than a `common`.
 */
export const achievementTierSchema = z.enum(ACHIEVEMENT_TIERS);

/**
 * One achievement's definition, as the client receives it.
 *
 * No `iconUrl`: Phase 1 renders these with the app's own icon set keyed on `tier`, and
 * a remote image per achievement would be nineteen network requests to draw a grid.
 */
export const achievementSchema = z.object({
  /** A stable slug, e.g. `first-leaf`. Safe to reference in code and in tests. */
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  tier: achievementTierSchema,
});

/**
 * An achievement the reader has just earned.
 *
 * Returned in the response of the action that triggered it, so the client can animate
 * immediately instead of polling — which is why `unlockedAt` is non-nullable here and
 * nullable in `achievementStatusSchema`. The two shapes answer different questions:
 * "what did this action award" versus "where does the reader stand".
 */
export const unlockedAchievementSchema = achievementSchema.extend({
  unlockedAt: isoTimestampSchema,
});

/**
 * One row of the reader's achievement grid: the definition, plus whether they have it.
 *
 * **Locked achievements are part of the response, not omitted.** §3 of the proposal is
 * explicit that four of the nineteen are unreachable with one 20-Leaf Track and ship
 * anyway, because a visible locked tile is a reason to come back. Filtering them
 * server-side would quietly undo that decision.
 */
export const achievementStatusSchema = achievementSchema.extend({
  /** Null while still locked. */
  unlockedAt: isoTimestampSchema.nullable(),
});

export type AchievementTier = z.infer<typeof achievementTierSchema>;
export type Achievement = z.infer<typeof achievementSchema>;
export type UnlockedAchievement = z.infer<typeof unlockedAchievementSchema>;
export type AchievementStatus = z.infer<typeof achievementStatusSchema>;
