import { localDateSchema, timeZoneSchema, type User } from '@zoomout/shared';
import { z } from 'zod';

import type { UserRow } from '../db/schema.js';

/**
 * Translates a persisted row into the shared domain `User`.
 *
 * The two shapes are deliberately not the same object, and this is the seam where
 * they meet:
 *
 * - Drizzle returns `created_at` / `updated_at` as JS `Date`; the domain model uses
 *   an ISO-8601 string, so a `Date` can never be serialised inconsistently across
 *   the API boundary.
 * - `date_of_birth` stays a `YYYY-MM-DD` string end to end and is re-validated here,
 *   because a birth date that has been through a `Date` is a birth date that may
 *   have moved by a day.
 *
 * `authProviders` is absent from the result: WP0 creates the `users` table only, and
 * the providers table arrives with auth in WP2. Expressing that as `Omit` rather than
 * defaulting to `[]` keeps the gap visible in the type system instead of inventing
 * data that was never stored.
 */
export type PersistedUser = Omit<User, 'authProviders'>;

const persistedUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1),
  dateOfBirth: localDateSchema,
  timezone: timeZoneSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

/**
 * @throws {z.ZodError} if a row violates the domain contract — a corrupt or
 * hand-edited row should fail loudly at the boundary rather than propagate.
 */
export function toDomainUser(row: UserRow): PersistedUser {
  return persistedUserSchema.parse({
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    dateOfBirth: row.dateOfBirth,
    timezone: row.timezone,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
