import { z } from 'zod';

import {
  cmsIdSchema,
  isoTimestampSchema,
  localDateSchema,
  timeZoneSchema,
  uuidSchema,
} from './primitives.js';

/**
 * Sign-in methods offered in Phase 1 (PRODUCT.md). Sign in with Apple is mandatory
 * once Google is offered, so the three ship together.
 */
export const authProviderSchema = z.enum(['email', 'apple', 'google']);

export const userSchema = z.object({
  id: uuidSchema,
  email: z.email(),
  authProviders: z.array(authProviderSchema).min(1),
  displayName: z.string().min(1),

  /**
   * Collected at signup for the age gate. A birth date is a calendar date, not an
   * instant — storing it as a timestamp is how people end up a day older or younger
   * depending on the server's timezone.
   *
   * The gate's threshold is deliberately not encoded here: it is legally undecided
   * (LEGAL.md) and lives in backend config so that settling it is a config change
   * rather than a code change. Age-gate logic itself is WP2.
   */
  dateOfBirth: localDateSchema,

  /** Drives local-midnight rollover for the session cap and streaks (plan §3.5). */
  timezone: timeZoneSchema,

  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

/**
 * PROVISIONAL — the exact state set is settled with the Library surface in WP7.
 */
export const userTrackStatusSchema = z.enum(['active', 'completed', 'archived']);

/** A Track the user has added to their Library. */
export const userTrackSchema = z.object({
  userId: uuidSchema,
  trackId: cmsIdSchema,
  addedAt: isoTimestampSchema,
  status: userTrackStatusSchema,
});

export type AuthProvider = z.infer<typeof authProviderSchema>;
export type User = z.infer<typeof userSchema>;
export type UserTrackStatus = z.infer<typeof userTrackStatusSchema>;
export type UserTrack = z.infer<typeof userTrackSchema>;
