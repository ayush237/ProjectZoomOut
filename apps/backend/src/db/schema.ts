import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Tables owned by the backend.
 *
 * Content tables belong to the CMS (plan §3.2 — the backend reads content over
 * Payload's REST API and never owns those tables). Progress and gamification arrive
 * with WP4/WP5.
 */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Stored lowercased. The service normalises before writing, so the unique index
     * below actually enforces one account per address rather than one per casing.
     */
    email: text('email').notNull(),

    displayName: text('display_name').notNull(),

    /**
     * A `date` column, not a timestamp. A birth date is a calendar date with no
     * instant attached; storing it as a timestamp makes the value shift by a day
     * depending on the server's timezone, which would quietly corrupt the age gate.
     *
     * `mode: 'string'` keeps it as `YYYY-MM-DD` end to end, matching the shared
     * `localDateSchema` rather than round-tripping through a JS `Date`.
     */
    dateOfBirth: date('date_of_birth', { mode: 'string' }).notNull(),

    /** IANA identifier. Drives local-midnight rollover for the cap and streaks. */
    timezone: text('timezone').notNull(),

    /**
     * Reserved. Email verification is out of scope for WP2 — it needs outbound email —
     * but the column exists from the start so enabling it later is a feature rather
     * than a backfill over live accounts.
     */
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const authProviderEnum = pgEnum('auth_provider', ['email', 'apple', 'google']);

/**
 * One row per identity a reader can sign in with.
 *
 * Its own table rather than a column on `users` so that a reader holding both a
 * password and a Google identity is a second row, not a schema change. That is also
 * what makes the account-linking rule expressible: link a new provider to an existing
 * user instead of creating a duplicate account for the same person.
 */
export const userAuthProviders = pgTable(
  'user_auth_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    provider: authProviderEnum('provider').notNull(),

    /**
     * The provider's stable identifier for this person: `sub` from an Apple or Google
     * ID token, and the normalised email address for password sign-in.
     *
     * Apple and Google both document `sub` as stable and email as changeable, so the
     * subject is what identifies a returning user — never the email.
     */
    providerSubject: text('provider_subject').notNull(),

    /**
     * argon2id hash. Set only for `provider = 'email'`; null for social identities,
     * which have no password to store.
     *
     * Kept on the identity rather than on `users` because that is what it belongs to:
     * a reader with Google and no password should have nowhere for a hash to live.
     */
    passwordHash: text('password_hash'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_auth_providers_provider_subject_unique').on(
      table.provider,
      table.providerSubject,
    ),
    index('user_auth_providers_user_id_idx').on(table.userId),
  ],
);

/**
 * Issued refresh tokens, stored hashed so a database leak does not hand over live
 * sessions.
 *
 * Rotation model: each use mints a replacement and marks the old row replaced. Every
 * token descended from one login shares a `family_id`, so presenting an
 * already-rotated token — the signature of a stolen token being replayed — lets the
 * whole family be revoked at once rather than just the one row.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Shared by every token rotated from the same original login. */
    familyId: uuid('family_id').notNull(),

    /**
     * SHA-256 of the token, not argon2.
     *
     * Deliberate, and the opposite of the password choice: a refresh token is 256 bits
     * of CSPRNG output, so it has no dictionary to attack and slow hashing buys
     * nothing. It also has to be *looked up* by value on every refresh, which a salted
     * argon2 hash makes impossible.
     */
    tokenHash: text('token_hash').notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Set when rotated or when the family is revoked. Null means live. */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    /** The token minted in this one's place, for auditing a rotation chain. */
    replacedByTokenId: uuid('replaced_by_token_id'),
  },
  (table) => [
    uniqueIndex('refresh_tokens_token_hash_unique').on(table.tokenHash),
    index('refresh_tokens_family_id_idx').on(table.familyId),
    index('refresh_tokens_user_id_idx').on(table.userId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type UserAuthProviderRow = typeof userAuthProviders.$inferSelect;
export type NewUserAuthProviderRow = typeof userAuthProviders.$inferInsert;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
export type NewRefreshTokenRow = typeof refreshTokens.$inferInsert;
