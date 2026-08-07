import { authProviderSchema, localDateSchema, timeZoneSchema, type User } from '@zoomout/shared';
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
 * - `authProviders` lives in its own table, so it arrives alongside the row rather
 *   than on it. WP0 left this as an `Omit` because the table did not exist yet; WP2
 *   creates it, and the mapper now returns a complete `User`.
 */

const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  authProviders: z.array(authProviderSchema).min(1),
  displayName: z.string().min(1),
  dateOfBirth: localDateSchema,
  timezone: timeZoneSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

/**
 * @param row The persisted user.
 * @param authProviders Identities from `user_auth_providers`. At least one always
 *   exists — `createUserWithIdentity` writes the user and their first identity in a
 *   single transaction, so a user with none is a corrupt row and should fail loudly.
 * @throws {z.ZodError} if the row violates the domain contract.
 */
export function toDomainUser(row: UserRow, authProviders: readonly User['authProviders'][number][]): User {
  return userSchema.parse({
    id: row.id,
    email: row.email,
    authProviders,
    displayName: row.displayName,
    dateOfBirth: row.dateOfBirth,
    timezone: row.timezone,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
