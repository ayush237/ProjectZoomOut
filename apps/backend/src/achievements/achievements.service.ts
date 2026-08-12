import type { AchievementStatus, UnlockedAchievement } from '@zoomout/shared';

import { NotFoundError } from '../auth/auth.errors.js';
import { localDateIn } from '../auth/ageGate.js';
import { toError } from '../errors.js';
import type { AppLogger } from '../logging/logger.js';
import type { AchievementRepository, ReaderEventType } from './achievements.repository.js';
import { ACHIEVEMENTS, evaluate, toAchievement } from './registry.js';

/**
 * The achievement engine's one entry point.
 *
 * Every evaluation point calls `award`, which is deliberately the only way in: read the
 * facts, ask the registry, insert what is new, return what was actually inserted. The
 * *caller* decides when to evaluate; it never decides what unlocks.
 */

/**
 * The Track the reader just worked on, when there is one.
 *
 * Supplied by the caller because it is the caller who already paid for the Leaf list —
 * `ProgressService` fetches it to decide whether finishing a Leaf finishes the book, and
 * asking the CMS a second time here would double the cost of every completion.
 */
export interface TrackContext {
  readonly completed: boolean;
  readonly perfect: boolean;
}

/**
 * Reads the reader's IANA timezone.
 *
 * A port, not the progress repository, because this service needs one fact about a
 * reader and has no business being able to grade or complete anything.
 * `PostgresProgressRepository` already satisfies it.
 */
export interface ReaderTimezoneReader {
  findReaderTimezone(userId: string): Promise<string | null>;
}

/**
 * What `ProgressService` and `LibraryService` depend on.
 *
 * Narrow on purpose: an evaluation point may award, and may do nothing else. It exposes
 * the non-throwing form only — see `awardQuietly` for why an achievement must never be
 * able to fail a completion.
 */
export interface AchievementAwarder {
  awardQuietly(
    userId: string,
    track?: TrackContext,
    at?: Date,
  ): Promise<readonly UnlockedAchievement[]>;
}

export class AchievementService implements AchievementAwarder {
  constructor(
    private readonly repository: AchievementRepository,
    private readonly readers: ReaderTimezoneReader,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Evaluates the registry and awards whatever is newly earned.
   *
   * **Returns only what this call inserted.** A replayed completion re-evaluates and
   * re-decides that the reader has earned `first-leaf`, the insert conflicts, and the
   * empty result is what stops the client animating the same badge twice. The engine
   * being idempotent at the *storage* layer rather than the service layer is what makes
   * that true under concurrency as well as under replay.
   *
   * @throws {NotFoundError} if the reader has no row — their token authenticated, so
   *   this means the account was deleted mid-request. Defaulting to UTC instead would
   *   evaluate today's cap against the wrong day.
   */
  public async award(
    userId: string,
    track?: TrackContext,
    at: Date = new Date(),
  ): Promise<readonly UnlockedAchievement[]> {
    const localDate = localDateIn(await this.requireReaderTimezone(userId), at);

    const [facts, held] = await Promise.all([
      this.repository.readFacts(userId, {
        localDate,
        trackCompleted: track?.completed ?? false,
        trackPerfect: track?.perfect ?? false,
      }),
      this.repository.listUnlocked(userId),
    ]);

    const earned = evaluate(facts, new Set(held.map((row) => row.achievementId)));

    if (earned.length === 0) {
      return [];
    }

    const inserted = await this.repository.award(
      userId,
      earned.map((achievement) => achievement.id),
      at,
    );

    const byId = new Map(earned.map((achievement) => [achievement.id, achievement]));

    const unlocked = inserted.flatMap((row): UnlockedAchievement[] => {
      const definition = byId.get(row.achievementId);

      // Unreachable: every inserted id came from `earned` a line above. Skipped rather
      // than asserted because an achievement retired from the registry between deploy
      // and request is the one way it could happen, and dropping it from the response
      // is better than failing the completion that earned it.
      if (definition === undefined) {
        return [];
      }

      return [{ ...toAchievement(definition), unlockedAt: row.unlockedAt.toISOString() }];
    });

    if (unlocked.length > 0) {
      this.logger.info(
        { userId, achievements: unlocked.map((achievement) => achievement.id) },
        'Achievements unlocked',
      );
    }

    return unlocked;
  }

  /**
   * Records a reader-signalled event, then evaluates.
   *
   * The event is written **before** the evaluation reads the facts, so the open that
   * triggers `dinner-party` is visible to the query that decides it. Reversing the order
   * would award on the reader's *second* fact rather than their first, which is the kind
   * of off-by-one that looks like a flaky test forever.
   */
  public async recordEvent(
    userId: string,
    type: ReaderEventType,
    leafId: string | null,
    at: Date = new Date(),
  ): Promise<readonly UnlockedAchievement[]> {
    await this.repository.recordEvent(userId, type, leafId, at);
    this.logger.info({ userId, type, leafId }, 'Reader event recorded');

    return this.award(userId, undefined, at);
  }

  /**
   * The whole catalogue, with the reader's unlocks resolved against it.
   *
   * Locked achievements are included — §3 of the proposal ships four that are
   * unreachable at launch precisely so their tiles are visible. Driven by the registry's
   * order rather than by the rows, so a reader with no unlocks still gets nineteen
   * entries in the order the grid expects.
   */
  public async listForReader(userId: string): Promise<readonly AchievementStatus[]> {
    const held = new Map(
      (await this.repository.listUnlocked(userId)).map((row) => [row.achievementId, row.unlockedAt]),
    );

    return ACHIEVEMENTS.map((definition) => ({
      ...toAchievement(definition),
      unlockedAt: held.get(definition.id)?.toISOString() ?? null,
    }));
  }

  /**
   * Awards without letting a failure take the triggering action down with it.
   *
   * For callers whose action has already succeeded and been paid for — a completed Leaf,
   * an added book. Losing an unlock animation is a disappointment; turning a successful
   * completion into a 500 because a badge could not be written is a lost Leaf. The next
   * evaluation re-decides it anyway, because the predicates are monotonic.
   */
  public async awardQuietly(
    userId: string,
    track?: TrackContext,
    at?: Date,
  ): Promise<readonly UnlockedAchievement[]> {
    try {
      return await this.award(userId, track, at);
    } catch (error) {
      this.logger.error({ err: toError(error), userId }, 'Could not evaluate achievements');

      return [];
    }
  }

  private async requireReaderTimezone(userId: string): Promise<string> {
    const timezone = await this.readers.findReaderTimezone(userId);

    if (timezone === null) {
      throw new NotFoundError('Reader not found');
    }

    return timezone;
  }
}
