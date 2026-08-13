import type {
  Achievement,
  CompletedLeafSummary,
  SessionStatus,
  SessionSummary,
  StreakStatus,
} from '@zoomout/shared';

import { toAchievement, ACHIEVEMENTS } from '../achievements/registry.js';
import type { AchievementRepository } from '../achievements/achievements.repository.js';
import { NotFoundError } from '../auth/auth.errors.js';
import { localDateIn } from '../auth/ageGate.js';
import type { AppConfig } from '../config/env.js';
import { ContentNotFoundError } from '../content/content.errors.js';
import type { ContentService } from '../content/content.service.js';
import type { AppLogger } from '../logging/logger.js';
import type { ProgressRepository } from './progress.repository.js';
import type { SessionRepository } from './session.repository.js';

/**
 * The reader's day, in one call — what the wrap-up screen is built on (WP9).
 *
 * **Its own service rather than a method on `ProgressService`.** This composes three
 * domains — progress, content and achievements — and `ProgressService` is already the
 * largest class in the backend and the one holding the payoff gate. Adding a read that
 * needs the *content* service to it would also have created a cycle: `ContentService`
 * depends on `ProgressService` as its `PayoffAccessPolicy`, so `ProgressService` cannot
 * depend on `ContentService` back. Sitting above both, as `LibraryService` does, avoids
 * that entirely.
 *
 * **Content is read through `ContentService`, never the repository.** The summary names
 * books and Leaves in an image built to be posted in public, so the placeholder guard
 * and the takedown cascade have to apply to it — a withdrawn Track must not reappear in
 * a screenshot. That is the opposite of the deliberate exception `ProgressService` makes
 * for grading, and the reason is the same one stated there: going around the service
 * means going around its guards.
 */
export class SessionSummaryService {
  constructor(
    private readonly progress: ProgressRepository,
    private readonly sessions: SessionRepository,
    private readonly achievements: AchievementRepository,
    private readonly content: ContentService,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Everything the reader did today.
   *
   * "Today" is resolved here from the reader's stored timezone, exactly as
   * `ProgressService.readDay` does it and for the same reason: a client that supplied
   * its own date could rewrite which day its work counted for by changing the device
   * clock, and the wrap-up screen is the one place a reader has an incentive to.
   *
   * @throws {NotFoundError} if the reader has no row — their token authenticated, so
   *   this means the account was deleted mid-request. Defaulting to UTC would summarise
   *   the wrong day.
   */
  public async read(userId: string, at: Date = new Date()): Promise<SessionSummary> {
    const timezone = await this.requireReaderTimezone(userId);
    const localDate = localDateIn(timezone, at);

    const [completed, session, streak, unlocked] = await Promise.all([
      this.progress.listCompletedOn(userId, localDate),
      this.sessions.findSession(userId, localDate),
      this.sessions.findStreak(userId),
      this.achievements.listUnlockedOn(userId, timezone, localDate),
    ]);

    return {
      localDate,
      leaves: await this.describe(completed),
      /**
       * From the day's row, not `sum(leaves.xpAwarded)`.
       *
       * They can legitimately differ: a Leaf completed after the cap has fired is worth
       * zero, and a reader whose day is capped should still see the Leaf listed. The
       * row is what the cap was actually enforced against, so it is the honest total.
       */
      xpEarned: session?.xpEarned ?? 0,
      streak: toStreakStatus(streak),
      achievements: this.describeAchievements(unlocked.map((row) => row.achievementId)),
      session: this.toSessionStatus(localDate, session),
    };
  }

  /**
   * Names each completed Leaf and its book.
   *
   * Tracks are fetched **once per distinct book**, not once per Leaf: five Leaves from
   * one Track is one Track read, and the content cache absorbs the rest. That matters
   * because the launch-blocker list already carries an N+1 on the library rollup, and
   * this is the same mistake one screen later.
   *
   * **A Leaf that no longer resolves is dropped, not fatal.** Its Track may have been
   * unpublished since it was read, and the reader still finished it — losing one line
   * of a summary is better than a wrap-up screen that cannot render at all.
   */
  private async describe(
    rows: readonly { leafId: string; xpAwarded: number; firstTryCorrect: boolean }[],
  ): Promise<readonly CompletedLeafSummary[]> {
    const trackTitles = new Map<string, string>();

    const described = await Promise.all(
      rows.map(async (row): Promise<CompletedLeafSummary | null> => {
        try {
          const leaf = await this.content.getLeafSummary(row.leafId);

          if (!trackTitles.has(leaf.trackId)) {
            trackTitles.set(leaf.trackId, (await this.content.getTrack(leaf.trackId)).bookTitle);
          }

          return {
            leafId: leaf.id,
            title: leaf.title,
            trackId: leaf.trackId,
            trackTitle: trackTitles.get(leaf.trackId) ?? '',
            xpAwarded: row.xpAwarded,
            firstTryCorrect: row.firstTryCorrect,
          };
        } catch (error) {
          if (error instanceof ContentNotFoundError) {
            this.logger.info(
              { leafId: row.leafId },
              'Leaf completed today is no longer available; omitted from the summary',
            );
            return null;
          }

          throw error;
        }
      }),
    );

    return described.filter((leaf): leaf is CompletedLeafSummary => leaf !== null);
  }

  /**
   * Resolves stored ids against the registry.
   *
   * An id with no definition is skipped rather than thrown on — the only way it occurs
   * is an achievement retired from the registry while a reader still holds the row, and
   * that must not take down the screen celebrating their day.
   */
  private describeAchievements(ids: readonly string[]): readonly Achievement[] {
    const byId = new Map(ACHIEVEMENTS.map((definition) => [definition.id, definition]));

    return ids.flatMap((id) => {
      const definition = byId.get(id);

      return definition === undefined ? [] : [toAchievement(definition)];
    });
  }

  /** Identical in shape to `ProgressService.toSessionStatus`; see the note there. */
  private toSessionStatus(
    localDate: string,
    row: { secondsActive: number; xpEarned: number; capReachedAt: Date | null } | null,
  ): SessionStatus {
    return {
      localDate,
      secondsActive: row?.secondsActive ?? 0,
      xpEarned: row?.xpEarned ?? 0,
      capReached: row !== null && row.capReachedAt !== null,
      capSeconds: this.config.SESSION_CAP_SECONDS,
      capXp: this.config.SESSION_CAP_XP,
    };
  }

  private async requireReaderTimezone(userId: string): Promise<string> {
    const timezone = await this.progress.findReaderTimezone(userId);

    if (timezone === null) {
      throw new NotFoundError('Reader not found');
    }

    return timezone;
  }
}

function toStreakStatus(
  row: { current: number; longest: number; lastActiveLocalDate: string | null } | null,
): StreakStatus {
  return {
    current: row?.current ?? 0,
    longest: row?.longest ?? 0,
    lastActiveLocalDate: row?.lastActiveLocalDate ?? null,
  };
}

