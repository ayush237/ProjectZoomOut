import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client.js';
import { leafProgress, users, type LeafProgressRow } from '../db/schema.js';

/**
 * Persistence for the learning loop.
 *
 * Two rules shape every method here.
 *
 * **Scoped by `userId` in the query itself**, never filtered afterwards — the same rule
 * the library repository follows, and for the same reason: a repository that *can*
 * return another reader's row is one forgotten `where` clause from leaking it.
 *
 * **State transitions are single statements, not read-then-write.** Incrementing an
 * attempt and awarding XP are both things a client can fire twice by retrying a request
 * that already succeeded, and a check in the service cannot close that window — the two
 * requests interleave between the check and the write. Expressed as one conditional
 * statement, Postgres's row lock does the work and the race stops existing.
 */

export interface RecordAttemptInput {
  readonly userId: string;
  readonly leafId: string;
  readonly correct: boolean;
  readonly at: Date;
}

export interface CompleteLeafInput {
  readonly userId: string;
  readonly leafId: string;
  readonly xpAwarded: number;
  readonly at: Date;
  /** The reader's local calendar date, `YYYY-MM-DD`. Never derived from `at`. */
  readonly localDate: string;
}

export interface ProgressRepository {
  find(userId: string, leafId: string): Promise<LeafProgressRow | null>;
  start(userId: string, leafId: string): Promise<LeafProgressRow>;
  recordAttempt(input: RecordAttemptInput): Promise<LeafProgressRow>;
  /** @returns the completed row, or null if it was already complete. */
  completeIfUnfinished(input: CompleteLeafInput): Promise<LeafProgressRow | null>;
  /** The reader's IANA timezone, for the local completion date. Null if no such user. */
  findReaderTimezone(userId: string): Promise<string | null>;
  /**
   * Which of these Leaves this reader has completed.
   *
   * Takes the candidate ids rather than returning every completion the reader has: a
   * library of twenty books would otherwise pull the reader's entire history to answer
   * a question about one Track.
   */
  listCompletedLeafIds(userId: string, leafIds: readonly string[]): Promise<readonly string[]>;
  /**
   * The reader's lifetime XP, summed on read.
   *
   * WP5b, Part C. Ruled 2026-08-09 against a `users.total_xp` counter: this table is
   * the source of truth, and the completion path is idempotent precisely because
   * replaying it is ordinary — a denormalised total is exactly where that replay would
   * land as a double increment with no way to detect it afterwards.
   */
  sumXpAwarded(userId: string): Promise<number>;
  /** How many of these Leaves the reader completed having answered first try. */
  countFirstTryCompletions(userId: string, leafIds: readonly string[]): Promise<number>;
}

export class PostgresProgressRepository implements ProgressRepository {
  constructor(private readonly client: DatabaseClient) {}

  public async find(userId: string, leafId: string): Promise<LeafProgressRow | null> {
    const [row] = await this.client.db
      .select()
      .from(leafProgress)
      .where(and(eq(leafProgress.userId, userId), eq(leafProgress.leafId, leafId)))
      .limit(1);

    return row ?? null;
  }

  /**
   * Opens a Leaf, or returns the existing progress untouched.
   *
   * Idempotent and non-destructive: this is what makes progress resumable. A reader
   * coming back to a Leaf they half-finished must get their attempts and their unlock
   * back, and "start" is exactly the call a client makes on re-entry — so if it reset
   * anything, returning to a Leaf would silently cost the reader their progress.
   */
  public async start(userId: string, leafId: string): Promise<LeafProgressRow> {
    const [inserted] = await this.client.db
      .insert(leafProgress)
      .values({ userId, leafId })
      .onConflictDoNothing({ target: [leafProgress.userId, leafProgress.leafId] })
      .returning();

    if (inserted !== undefined) {
      return inserted;
    }

    const existing = await this.find(userId, leafId);

    if (existing === null) {
      throw new Error('Progress row vanished between insert and read-back');
    }

    return existing;
  }

  /**
   * Records one graded attempt.
   *
   * A single upsert, so a reader's very first answer does not need a separate insert
   * that a concurrent request could duplicate. Three things are decided in SQL rather
   * than in JavaScript, all for the same reason — they depend on the row's *current*
   * value, which is only trustworthy under the row lock:
   *
   *  - `attempt_count` increments from whatever is stored, so two answers submitted at
   *    once count as two.
   *  - `first_try_correct` can only be set while `attempt_count` is still 0. Once a
   *    reader has answered, no later correct answer can upgrade it and claim the bonus.
   *  - `correct_at` is `COALESCE`d, so it keeps its original value. The unlock is
   *    permanent: a reader who answers correctly and then goes back and taps a wrong
   *    option does not lose the payoff they already earned.
   */
  public async recordAttempt(input: RecordAttemptInput): Promise<LeafProgressRow> {
    const correctAt = input.correct ? input.at : null;

    const [row] = await this.client.db
      .insert(leafProgress)
      .values({
        userId: input.userId,
        leafId: input.leafId,
        attemptCount: 1,
        firstTryCorrect: input.correct,
        correctAt,
        startedAt: input.at,
        updatedAt: input.at,
      })
      .onConflictDoUpdate({
        target: [leafProgress.userId, leafProgress.leafId],
        set: {
          attemptCount: sql`${leafProgress.attemptCount} + 1`,
          firstTryCorrect: sql`case when ${leafProgress.attemptCount} = 0 and ${input.correct} then true else ${leafProgress.firstTryCorrect} end`,
          correctAt: sql`coalesce(${leafProgress.correctAt}, ${correctAt})`,
          updatedAt: input.at,
        },
      })
      .returning();

    if (row === undefined) {
      throw new Error('Attempt upsert returned no row');
    }

    return row;
  }

  /**
   * Awards completion exactly once.
   *
   * `completed_at is null` in the `where` is the whole idempotency guarantee, and it is
   * here rather than in the service on purpose: replaying a completion is the obvious
   * way to farm XP, and a client can trigger it by accident just by retrying a request
   * whose response it never saw. A second call matches no rows and returns null, so the
   * XP is awarded by whichever call won and by nothing else.
   *
   * `correct_at is not null` is defence in depth. The service refuses an unearned
   * completion with a clear error before it gets here; this makes XP-without-a-correct-
   * answer unrepresentable in storage even if some future caller forgets to ask.
   */
  public async completeIfUnfinished(input: CompleteLeafInput): Promise<LeafProgressRow | null> {
    const [row] = await this.client.db
      .update(leafProgress)
      .set({
        completedAt: input.at,
        completedLocalDate: input.localDate,
        xpAwarded: input.xpAwarded,
        updatedAt: input.at,
      })
      .where(
        and(
          eq(leafProgress.userId, input.userId),
          eq(leafProgress.leafId, input.leafId),
          isNull(leafProgress.completedAt),
          sql`${leafProgress.correctAt} is not null`,
        ),
      )
      .returning();

    return row ?? null;
  }

  public async listCompletedLeafIds(
    userId: string,
    leafIds: readonly string[],
  ): Promise<readonly string[]> {
    if (leafIds.length === 0) {
      // `inArray` with an empty list is a SQL error in some dialects and a full scan in
      // others. A Track with no visible Leaves is ordinary in Phase 1, so it is handled
      // here rather than left to every caller.
      return [];
    }

    const rows = await this.client.db
      .select({ leafId: leafProgress.leafId })
      .from(leafProgress)
      .where(
        and(
          eq(leafProgress.userId, userId),
          inArray(leafProgress.leafId, [...leafIds]),
          isNotNull(leafProgress.completedAt),
        ),
      );

    return rows.map((row) => row.leafId);
  }

  /**
   * `coalesce` because `sum` over no rows is `null`, not zero — a reader who has
   * completed nothing has 0 XP, and `null` would surface as a missing field on Profile.
   *
   * Cast to `int` in SQL: `sum` over an integer column is `bigint`, which `pg` hands
   * back as a **string**, and `"180"` would render as the total right up until something
   * tried to add to it. The reader's own rows only, over the existing
   * `leaf_progress_user_id_idx` — no second index is needed for this.
   */
  public async sumXpAwarded(userId: string): Promise<number> {
    const [row] = await this.client.db
      .select({ total: sql<number>`coalesce(sum(${leafProgress.xpAwarded}), 0)::int` })
      .from(leafProgress)
      .where(eq(leafProgress.userId, userId));

    return row?.total ?? 0;
  }

  public async countFirstTryCompletions(
    userId: string,
    leafIds: readonly string[],
  ): Promise<number> {
    if (leafIds.length === 0) {
      // Same reasoning as `listCompletedLeafIds`: a Track with no visible Leaves is
      // ordinary in Phase 1, and an empty `inArray` is a SQL error.
      return 0;
    }

    const [row] = await this.client.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leafProgress)
      .where(
        and(
          eq(leafProgress.userId, userId),
          inArray(leafProgress.leafId, [...leafIds]),
          isNotNull(leafProgress.completedAt),
          eq(leafProgress.firstTryCorrect, true),
        ),
      );

    return row?.count ?? 0;
  }

  public async findReaderTimezone(userId: string): Promise<string | null> {
    const [row] = await this.client.db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return row?.timezone ?? null;
  }
}
