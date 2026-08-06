import { date, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Tables owned by the backend.
 *
 * Scope note: WP0 creates `users` and nothing else. Content tables belong to the CMS
 * (plan §3.2 — the backend reads content over Payload's REST API and never owns those
 * tables), and the progress and gamification tables arrive with WP4/WP5.
 */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

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

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
