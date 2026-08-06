import { z } from 'zod';

import { isoTimestampSchema, uuidSchema } from './primitives.js';

/**
 * PROVISIONAL — which badges exist and what unlocks them is an open question in the
 * Phase 1 plan (§7, item 3) and is settled in WP5. This is the minimum shape the
 * roadmap already implies; expect the unlock criteria to arrive as a new field.
 */
export const achievementSchema = z.object({
  id: uuidSchema,
  /** Stable machine-readable identifier, e.g. `first_leaf`. Safe to reference in code. */
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  iconUrl: z.url().optional(),
});

export const userAchievementSchema = z.object({
  userId: uuidSchema,
  achievementId: uuidSchema,
  unlockedAt: isoTimestampSchema,
});

export type Achievement = z.infer<typeof achievementSchema>;
export type UserAchievement = z.infer<typeof userAchievementSchema>;
