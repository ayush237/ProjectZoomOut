import { eq } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client.js';
import {
  readerEvents,
  userAchievements,
  type ReaderEventRow,
  type UserAchievementRow,
} from '../db/schema.js';
import type { AchievementFacts } from './registry.js';

/**
 * Persistence for achievements and the events only a reader can signal.
 *
 * Two things here are worth reading before changing anything.
 *
 * **Awarding is one statement with `on conflict do nothing ... returning`.** The
 * returned rows are exactly the ones this call inserted, so "what did this action
 * unlock" is answered by the database rather than by a check-then-insert in the
 * service. That is what makes a replayed completion — and two concurrent ones —
 * announce an unlock once instead of twice, and it is the same shape WP4 used for XP
 * for the same reason.
 *
 * **The facts snapshot is one round trip.** Nineteen predicates need ten counts, and
 * ten queries per completion would put the whole registry in the critical path of the
 * product's core interaction. They are scalar subqueries over indexed columns against
 * one reader's rows.
 */

export type ReaderEventType = 'dinner_table_open' | 'session_wrap';

/** What the caller knows that the database cannot be asked. */
export interface FactsContext {
  /** The reader's local date, for today's cap. */
  readonly localDate: string;
  /** Set only when the evaluation is about a Track the reader just worked on. */
  readonly trackCompleted: boolean;
  readonly trackPerfect: boolean;
}

export interface AchievementRepository {
  readFacts(userId: string, context: FactsContext): Promise<AchievementFacts>;
  listUnlocked(userId: string): Promise<readonly UserAchievementRow[]>;
  /** @returns only the rows this call actually inserted. */
  award(
    userId: string,
    achievementIds: readonly string[],
    at: Date,
  ): Promise<readonly UserAchievementRow[]>;
  recordEvent(
    userId: string,
    type: ReaderEventType,
    leafId: string | null,
    at: Date,
  ): Promise<ReaderEventRow>;
}

/** `count(*)` is `bigint`, which `pg` returns as a string. Cast in SQL, not in JS. */
interface FactsRow {
  readonly completed_leaves: number;
  readonly first_try_any: number;
  readonly imperfect: number;
  readonly hard_won: number;
  readonly consecutive_first_try: number;
  readonly library_tracks: number;
  readonly streak_current: number;
  readonly cap_reached: number;
  readonly dtk_opens: number;
  readonly wraps: number;
}

export class PostgresAchievementRepository implements AchievementRepository {
  constructor(private readonly client: DatabaseClient) {}

  /**
   * Every count the registry can ask for, in one statement.
   *
   * **`consecutive_first_try` is derived, not maintained.** §4 of the proposal allows
   * either and says the reset rule is what matters; deriving it means there is no second
   * copy to drift, and no reset branch that can be forgotten — the run is defined by the
   * data rather than kept in step with it. It is the length of the leading block of
   * first-try completions when ordered newest first: the position of the most recent
   * non-first-try completion, minus one, or all of them when there is no such row. The
   * `leaf_id` tiebreaker keeps the order total, since two completions can share a
   * timestamp and an ambiguous order would make the count non-deterministic.
   *
   * **`hard_won` requires `not first_try_correct`.** `attempt_count` counts every
   * answer, and a reader may re-answer a scenario after unlocking it, so the flag is
   * what separates "wrong three times, then right" from "right immediately, then poked
   * at the other options". It can still over-count by answering wrongly *after* being
   * paid — which needs deliberate effort and errs toward the reader, so it stands.
   */
  public async readFacts(userId: string, context: FactsContext): Promise<AchievementFacts> {
    const { rows } = await this.client.pool.query<FactsRow>(
      `with completions as (
         select first_try_correct, attempt_count, completed_at, leaf_id
         from leaf_progress
         where user_id = $1 and completed_at is not null
       ),
       ordered as (
         select first_try_correct,
                row_number() over (order by completed_at desc, leaf_id desc) as rn
         from completions
       )
       select
         (select count(*) from completions)::int as completed_leaves,
         (select count(*) from leaf_progress
           where user_id = $1 and first_try_correct)::int as first_try_any,
         (select count(*) from completions where not first_try_correct)::int as imperfect,
         (select count(*) from completions
           where attempt_count >= 4 and not first_try_correct)::int as hard_won,
         coalesce(
           (select min(rn) - 1 from ordered where not first_try_correct),
           (select count(*) from ordered)
         )::int as consecutive_first_try,
         (select count(*) from user_tracks where user_id = $1)::int as library_tracks,
         coalesce((select current from streak where user_id = $1), 0)::int as streak_current,
         (select count(*) from daily_session
           where user_id = $1 and local_date = $2::date
             and cap_reached_at is not null)::int as cap_reached,
         (select count(*) from reader_events
           where user_id = $1 and type = 'dinner_table_open')::int as dtk_opens,
         (select count(*) from reader_events
           where user_id = $1 and type = 'session_wrap')::int as wraps`,
      [userId, context.localDate],
    );

    const row = rows[0];

    if (row === undefined) {
      throw new Error('Achievement facts query returned no row');
    }

    return {
      completedLeaves: row.completed_leaves,
      hasFirstTryCorrect: row.first_try_any > 0,
      consecutiveFirstTry: row.consecutive_first_try,
      imperfectCompletions: row.imperfect,
      hardWonCompletions: row.hard_won,
      libraryTracks: row.library_tracks,
      streakCurrent: row.streak_current,
      capReachedToday: row.cap_reached > 0,
      trackCompleted: context.trackCompleted,
      trackPerfect: context.trackPerfect,
      dinnerTableOpens: row.dtk_opens,
      sessionWraps: row.wraps,
    };
  }

  public async listUnlocked(userId: string): Promise<readonly UserAchievementRow[]> {
    return this.client.db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));
  }

  /**
   * Awards achievements the reader does not hold, and reports which were new.
   *
   * `onConflictDoNothing` against the unique index is the whole guarantee. A service
   * that checked first and inserted second would be correct until two completions
   * arrived at once, and the visible symptom of that race is not a duplicate row — the
   * index would reject the second insert with an error — but a failed completion for a
   * reader whose only mistake was tapping twice.
   */
  public async award(
    userId: string,
    achievementIds: readonly string[],
    at: Date,
  ): Promise<readonly UserAchievementRow[]> {
    if (achievementIds.length === 0) {
      // The overwhelmingly common case: nothing new was earned. An insert with no
      // values is a SQL error, so this is a guard rather than an optimisation.
      return [];
    }

    return this.client.db
      .insert(userAchievements)
      .values(achievementIds.map((achievementId) => ({ userId, achievementId, unlockedAt: at })))
      .onConflictDoNothing({
        target: [userAchievements.userId, userAchievements.achievementId],
      })
      .returning();
  }

  public async recordEvent(
    userId: string,
    type: ReaderEventType,
    leafId: string | null,
    at: Date,
  ): Promise<ReaderEventRow> {
    const [row] = await this.client.db
      .insert(readerEvents)
      .values({ userId, type, leafId, occurredAt: at })
      .returning();

    if (row === undefined) {
      throw new Error('Reader event insert returned no row');
    }

    return row;
  }

}
