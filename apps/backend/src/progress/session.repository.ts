import { and, eq, sql } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client.js';
import { dailySessions, streaks, type DailySessionRow, type StreakRow } from '../db/schema.js';

/**
 * The daily session and the streak.
 *
 * **Both writes are single-statement upserts, and that is the point of this file.**
 * Read-modify-write would be correct exactly until two completions land at once — and
 * they will, because finishing a Leaf and a retried request that finishes the same Leaf
 * are indistinguishable at this layer. A streak that double-increments cannot be
 * repaired afterwards: there is no record of what it should have been.
 */

export interface AccumulateSessionInput {
  readonly userId: string;
  readonly localDate: string;
  readonly seconds: number;
  readonly xp: number;
  readonly at: Date;
  /** From validated config, never a literal. */
  readonly capSeconds: number;
  readonly capXp: number;
}

export interface SessionRepository {
  findSession(userId: string, localDate: string): Promise<DailySessionRow | null>;
  accumulate(input: AccumulateSessionInput): Promise<DailySessionRow>;
  findStreak(userId: string): Promise<StreakRow | null>;
  recordActiveDay(userId: string, localDate: string, at: Date): Promise<StreakRow>;
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly client: DatabaseClient) {}

  public async findSession(userId: string, localDate: string): Promise<DailySessionRow | null> {
    const [row] = await this.client.db
      .select()
      .from(dailySessions)
      .where(and(eq(dailySessions.userId, userId), eq(dailySessions.localDate, localDate)))
      .limit(1);

    return row ?? null;
  }

  /**
   * Adds to today's totals and decides, in the same statement, whether the cap is now hit.
   *
   * `cap_reached_at` is `COALESCE`d so it records the **first** moment the reader
   * crossed the line and never moves afterwards. Deciding it here rather than in the
   * service is deliberate: the totals and the verdict have to be computed from the same
   * snapshot of the row, and any split between them is a race where two concurrent
   * completions each read an under-cap total and neither marks the cap.
   *
   * The thresholds arrive as parameters rather than being read here, so this stays a
   * repository and the numbers stay configuration.
   */
  public async accumulate(input: AccumulateSessionInput): Promise<DailySessionRow> {
    const crossedOnInsert =
      input.seconds >= input.capSeconds || input.xp >= input.capXp ? input.at : null;

    const [row] = await this.client.db
      .insert(dailySessions)
      .values({
        userId: input.userId,
        localDate: input.localDate,
        secondsActive: input.seconds,
        xpEarned: input.xp,
        capReachedAt: crossedOnInsert,
        createdAt: input.at,
        updatedAt: input.at,
      })
      .onConflictDoUpdate({
        target: [dailySessions.userId, dailySessions.localDate],
        set: {
          secondsActive: sql`${dailySessions.secondsActive} + ${input.seconds}`,
          xpEarned: sql`${dailySessions.xpEarned} + ${input.xp}`,
          /**
           * The casts are load-bearing, not decoration. Postgres cannot infer a type
           * for an untyped `NULL` sitting opposite a bound parameter in a `CASE`, and
           * the whole statement fails at plan time — which surfaces as a 500 on
           * completion rather than as anything resembling a type error.
           */
          capReachedAt: sql`coalesce(${dailySessions.capReachedAt}, case when ${dailySessions.secondsActive} + ${input.seconds}::int >= ${input.capSeconds}::int or ${dailySessions.xpEarned} + ${input.xp}::int >= ${input.capXp}::int then ${input.at}::timestamptz else null::timestamptz end)`,
          updatedAt: input.at,
        },
      })
      .returning();

    if (row === undefined) {
      throw new Error('Daily session upsert returned no row');
    }

    return row;
  }

  public async findStreak(userId: string): Promise<StreakRow | null> {
    const [row] = await this.client.db
      .select()
      .from(streaks)
      .where(eq(streaks.userId, userId))
      .limit(1);

    return row ?? null;
  }

  /**
   * Records that the reader was active on a local day.
   *
   * Three cases, resolved in SQL against the stored date rather than in TypeScript
   * against a clock:
   *
   *  - **Same day again** — already counted. `current` is unchanged, which is what makes
   *    this safe to call on every completion rather than only on the first of the day.
   *  - **The day after** — the streak continues.
   *  - **Anything else**, including a gap and a clock that went backwards — the streak
   *    restarts at one.
   *
   * `$date::date - 1` is Postgres date arithmetic, so it is correct across month ends,
   * leap years and DST — none of which a `Date` subtraction in JavaScript gets right on
   * its own, because a "day" is not always 86,400 seconds in the reader's zone.
   */
  public async recordActiveDay(userId: string, localDate: string, at: Date): Promise<StreakRow> {
    const nextCurrent = sql`case
      when ${streaks.lastActiveLocalDate} = ${localDate}::date then ${streaks.current}
      when ${streaks.lastActiveLocalDate} = ${localDate}::date - 1 then ${streaks.current} + 1
      else 1
    end`;

    const [row] = await this.client.db
      .insert(streaks)
      .values({
        userId,
        current: 1,
        longest: 1,
        lastActiveLocalDate: localDate,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: streaks.userId,
        set: {
          current: nextCurrent,
          // `greatest`, so a restarted streak cannot lower the record.
          longest: sql`greatest(${streaks.longest}, ${nextCurrent})`,
          lastActiveLocalDate: localDate,
          updatedAt: at,
        },
      })
      .returning();

    if (row === undefined) {
      throw new Error('Streak upsert returned no row');
    }

    return row;
  }
}
