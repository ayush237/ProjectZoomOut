import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Tables owned by the backend.
 *
 * Content tables belong to the CMS (plan §3.2 — the backend reads content over
 * Payload's REST API and never owns those tables). Gamification — `daily_sessions`,
 * `streaks`, achievements — arrives with WP5.
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

export const userTrackStatusEnum = pgEnum('user_track_status', [
  'active',
  'completed',
  'archived',
]);

/**
 * A reader's library — the Tracks they have added.
 *
 * `track_id` is text, not a foreign key, and deliberately so: Tracks live in the CMS's
 * own database, which this one has no reference to and must not read (plan §3.2).
 * Referential integrity across that boundary is the `ContentRepository`'s job — a
 * library row pointing at a Track that has since been unpublished simply resolves to
 * nothing when the content API is asked for it.
 *
 * Progress, XP and completion are **not** here. They arrive with WP4 and belong to
 * `LeafProgress`; this table records membership only.
 */
export const userTracks = pgTable(
  'user_tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The CMS's id for the Track, stringified — Payload uses serial integers. */
    trackId: text('track_id').notNull(),

    status: userTrackStatusEnum('status').notNull().default('active'),

    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Adding a Track twice is idempotent rather than an error, and this is what makes
    // that true at the storage layer rather than depending on a check-then-insert
    // race in the service.
    uniqueIndex('user_tracks_user_track_unique').on(table.userId, table.trackId),
    index('user_tracks_user_id_idx').on(table.userId),
  ],
);

/**
 * A reader's progress through one Leaf — the learning loop's only state.
 *
 * The first table here whose rows record achievement rather than identity, which is
 * why almost every column is written by a conditional `UPDATE` rather than by
 * read-then-write: XP that can be awarded twice by replaying a request is the obvious
 * exploit, and the guard against it belongs in the storage layer where a race cannot
 * get between the check and the write.
 *
 * `leaf_id` is text and not a foreign key, for the same reason as `user_tracks.track_id`
 * — Leaves live in the CMS's database, which this one must not read.
 */
export const leafProgress = pgTable(
  'leaf_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The CMS's id for the Leaf, stringified — Payload uses serial integers. */
    leafId: text('leaf_id').notNull(),

    /** Every submitted answer, right or wrong. Unbounded: retries are unlimited. */
    attemptCount: integer('attempt_count').notNull().default(0),

    /**
     * Whether the *first* attempt was correct. Frozen after that first answer — this is
     * what the XP bonus is paid on, so a later correct answer must not be able to
     * upgrade it.
     */
    firstTryCorrect: boolean('first_try_correct').notNull().default(false),

    /**
     * When the reader first answered correctly. **Null means the payoff stays locked.**
     *
     * Set once and never cleared, so re-answering wrongly after unlocking cannot take
     * the payoff back — that would punish a reader for exploring, and the stakes are
     * XP, not access (PRODUCT.md).
     */
    correctAt: timestamp('correct_at', { withTimezone: true }),

    completedAt: timestamp('completed_at', { withTimezone: true }),

    /**
     * The completion date in the **reader's own timezone**, not UTC.
     *
     * WP5's streaks and daily cap group activity by local day (plan §3.5). Storing only
     * `completed_at` would leave WP5 reinterpreting a UTC instant against whatever
     * timezone the reader has *by then* — so a reader who completes a Leaf at 11pm in
     * Auckland and later moves to London would silently change which day it counted for.
     * Computed once, at completion, with `localDateIn(user.timezone)`.
     */
    completedLocalDate: date('completed_local_date', { mode: 'string' }),

    /** Awarded once, at completion. Zero until then. */
    xpAwarded: integer('xp_awarded').notNull().default(0),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One row per reader per Leaf. This is what makes `onConflictDoNothing` a safe
    // idempotent start, and what stops two concurrent first answers creating two rows
    // that each think they were the first try.
    uniqueIndex('leaf_progress_user_leaf_unique').on(table.userId, table.leafId),
    index('leaf_progress_user_id_idx').on(table.userId),
    // WP5 reads "what did this reader complete on this local day" on every session.
    index('leaf_progress_user_completed_date_idx').on(table.userId, table.completedLocalDate),
  ],
);

/**
 * One row per reader per **local** day.
 *
 * The composite primary key is doing real work: it is the `ON CONFLICT` target that
 * makes accumulating a session an upsert rather than a read-modify-write. Two Leaves
 * completed at the same moment must add to one row, not race to create two.
 *
 * `local_date` and not a timestamp, for the reason WP4 recorded on
 * `leaf_progress.completed_local_date`: a day is a fact about where the reader is, and
 * re-deriving it later from a UTC instant silently reassigns activity when someone
 * travels.
 */
export const dailySessions = pgTable(
  'daily_session',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    localDate: date('local_date', { mode: 'string' }).notNull(),

    secondsActive: integer('seconds_active').notNull().default(0),
    xpEarned: integer('xp_earned').notNull().default(0),

    /**
     * When the cap was hit. Null while still under it.
     *
     * A timestamp rather than a boolean so "when did they stop today" is answerable —
     * and because a boolean would have to be recomputed every time the thresholds move,
     * whereas this records what actually happened under the rules of the day.
     */
    capReachedAt: timestamp('cap_reached_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.localDate] })],
);

/**
 * One row per reader, ever.
 *
 * `current` and `longest` are both stored rather than deriving `longest` from history:
 * the history is `leaf_progress.completed_local_date`, and recomputing a longest streak
 * across a growing table on every completion is a scan that gets slower forever.
 */
export const streaks = pgTable('streak', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  current: integer('current').notNull().default(0),
  longest: integer('longest').notNull().default(0),

  /** Null for a reader who has never completed a Leaf. */
  lastActiveLocalDate: date('last_active_local_date', { mode: 'string' }),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Achievements a reader has earned. One row per unlock, ever.
 *
 * `achievement_id` is **text and not a foreign key**, because there is no achievements
 * table to point at: the catalogue is a code registry (see `achievements/registry.ts`),
 * so its rows are deployed, not inserted. Storing the slug means a row survives the
 * registry being reordered, and an achievement that is later retired leaves its
 * historical unlocks intact rather than cascading them away.
 *
 * The unique index is the entire idempotency guarantee. Evaluation runs on every
 * completion, every answer and every library add, so the *normal* case is re-deciding
 * that an already-earned achievement is still earned — and two completions landing at
 * once must not produce two rows and two unlock animations for the same badge.
 */
export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The registry's slug, e.g. `first-leaf`. */
    achievementId: text('achievement_id').notNull(),

    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_achievements_user_achievement_unique').on(
      table.userId,
      table.achievementId,
    ),
    index('user_achievements_user_id_idx').on(table.userId),
  ],
);

export const readerEventEnum = pgEnum('reader_event_type', [
  'dinner_table_open',
  'session_wrap',
]);

/**
 * Reader-signalled events that nothing else in the system records.
 *
 * Append-only, and deliberately not a counter. `dinner-party` needs to know a Dinner
 * Table Knowledge fact was opened, and the proposal notes this is **the only signal we
 * would ever have that the deep-cut content is read at all** — a counter would answer
 * the achievement's question and throw that away. With `leaf_id` kept, "which Leaves'
 * facts get opened" stays answerable later without a second instrumentation pass.
 *
 * `leaf_id` is text and nullable: text for the same reason as everywhere else — Leaves
 * live in the CMS's database — and nullable because a session wrap belongs to a day,
 * not to a Leaf.
 */
export const readerEvents = pgTable(
  'reader_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    type: readerEventEnum('type').notNull(),

    /** The Leaf whose fact was opened. Null for events that are not about one Leaf. */
    leafId: text('leaf_id'),

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Every read of this table asks "has this reader ever done X", so the type belongs
    // in the index rather than being filtered after a per-user scan.
    index('reader_events_user_type_idx').on(table.userId, table.type),
  ],
);

export type UserAchievementRow = typeof userAchievements.$inferSelect;
export type ReaderEventRow = typeof readerEvents.$inferSelect;

export type UserTrackRow = typeof userTracks.$inferSelect;
export type NewUserTrackRow = typeof userTracks.$inferInsert;

export type LeafProgressRow = typeof leafProgress.$inferSelect;
export type NewLeafProgressRow = typeof leafProgress.$inferInsert;

export type DailySessionRow = typeof dailySessions.$inferSelect;
export type StreakRow = typeof streaks.$inferSelect;

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type UserAuthProviderRow = typeof userAuthProviders.$inferSelect;
export type NewUserAuthProviderRow = typeof userAuthProviders.$inferInsert;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
export type NewRefreshTokenRow = typeof refreshTokens.$inferInsert;
