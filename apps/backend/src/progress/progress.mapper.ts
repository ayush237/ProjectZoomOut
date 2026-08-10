import { leafProgressSchema, type LeafProgress } from '@zoomout/shared';

import type { LeafProgressRow } from '../db/schema.js';

/**
 * Translates a persisted progress row into the shared domain shape.
 *
 * Same seam and same reasoning as `user.mapper.ts`: Drizzle hands back JS `Date`s and
 * the domain model uses ISO-8601 strings, so an instant can never be serialised two
 * different ways across the API boundary. Validating on the way out is not paranoia
 * about our own database — it is what catches a column added to the table and forgotten
 * here, which would otherwise surface as a silently missing field in the client.
 *
 * `completedLocalDate` is deliberately **not** projected. It is a WP5 grouping key
 * computed in the reader's timezone; a client has no use for it, and shipping it would
 * invite the mobile app to derive "today" from it and reintroduce the timezone bug it
 * exists to prevent.
 */

/**
 * @throws {z.ZodError} if the row violates the domain contract.
 */
export function toDomainProgress(row: LeafProgressRow): LeafProgress {
  return leafProgressSchema.parse({
    userId: row.userId,
    leafId: row.leafId,
    attemptCount: row.attemptCount,
    firstTryCorrect: row.firstTryCorrect,
    correctAt: row.correctAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    xpAwarded: row.xpAwarded,
  });
}

/**
 * Progress for a Leaf the reader has never opened.
 *
 * Returned instead of a 404 so a client asking "where am I in this Leaf" gets an
 * answer it can render in both cases, rather than having to treat a missing row as a
 * special kind of success. Nothing is persisted — a row appears when the reader
 * actually does something.
 */
export function untouchedProgress(userId: string, leafId: string): LeafProgress {
  return {
    userId,
    leafId,
    attemptCount: 0,
    firstTryCorrect: false,
    correctAt: null,
    completedAt: null,
    xpAwarded: 0,
  };
}
