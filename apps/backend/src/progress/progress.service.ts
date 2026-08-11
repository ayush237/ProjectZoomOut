import type {
  Leaf,
  LeafProgress,
  PayoffSlide,
  TrackProgressSummary,
} from '@zoomout/shared';

import { NotFoundError } from '../auth/auth.errors.js';
import { localDateIn } from '../auth/ageGate.js';
import type { AppConfig } from '../config/env.js';
import { ContentNotFoundError } from '../content/content.errors.js';
import { toError } from '../errors.js';
import type { ContentRepository } from '../content/content.repository.js';
import { isVisibleIn } from '../content/contentVisibility.js';
import type { PayoffAccessPolicy } from '../content/payoffAccess.js';
import type { TrackStatusWriter } from '../library/library.repository.js';
import type { AppLogger } from '../logging/logger.js';
import { gradeAnswer } from './grading.js';
import { summariseTrackProgress, type CountableLeaf } from './trackProgress.js';
import { toDomainProgress, untouchedProgress } from './progress.mapper.js';
import { LeafNotUnlockedError } from './progress.errors.js';
import type { ProgressRepository } from './progress.repository.js';
import { calculateLeafXp, type XpRules } from './xp.js';

/**
 * The learning loop: answer, unlock, complete, award.
 *
 * Everything the reader cannot be trusted with lives here. The client submits an option
 * id and is told a result; it never receives the answer key, never decides whether the
 * payoff is unlocked, and never says how much XP it earned. That is not defensive
 * programming for its own sake — a client that can unlock its own payoff turns the
 * scenario into a slide you swipe past, and active recall is the entire product thesis.
 *
 * Implements `PayoffAccessPolicy` so content delivery can ask the unlock question
 * without knowing anything about progress. See `content/payoffAccess.ts` for why the
 * dependency points that way.
 */
/**
 * The rollup, as its consumers see it.
 *
 * Declared as a port so `LibraryService` depends on the question rather than on the
 * whole learning loop — it has no business being able to grade an answer.
 */
export interface TrackProgressReader {
  summariseTrack(
    userId: string,
    trackId: string,
    leaves: readonly CountableLeaf[],
  ): Promise<TrackProgressSummary>;
}

export class ProgressService implements PayoffAccessPolicy, TrackProgressReader {
  private readonly xpRules: XpRules;

  constructor(
    private readonly repository: ProgressRepository,
    private readonly content: ContentRepository,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
    /**
     * Writes `user_tracks.status`. A narrow port, not the library repository, because
     * completing a Leaf should be able to finish a Track without being able to add or
     * remove one.
     */
    private readonly trackStatus: TrackStatusWriter,
  ) {
    this.xpRules = {
      completion: config.XP_LEAF_COMPLETION,
      firstTryBonus: config.XP_FIRST_TRY_BONUS,
    };
  }

  /**
   * Opens a Leaf and returns the reader's state in it.
   *
   * Resumable, so this is safe to call every time the reader enters the Leaf: an
   * existing row comes back untouched rather than reset.
   *
   * @throws {ContentNotFoundError} if the Leaf does not exist or is not visible here.
   */
  public async startLeaf(userId: string, leafId: string): Promise<LeafProgress> {
    await this.requireVisibleLeaf(leafId);

    const row = await this.repository.start(userId, leafId);
    this.logger.info({ userId, leafId }, 'Leaf started');

    return toDomainProgress(row);
  }

  /**
   * The reader's state in a Leaf.
   *
   * A Leaf the reader has never opened is a zero-valued progress, not a 404 — the Leaf
   * exists, and "you have done nothing here yet" is a real answer to the question. A
   * Leaf that does *not* exist is still a 404, so this cannot be used to probe ids.
   */
  public async getProgress(userId: string, leafId: string): Promise<LeafProgress> {
    await this.requireVisibleLeaf(leafId);

    const row = await this.repository.find(userId, leafId);

    return row === null ? untouchedProgress(userId, leafId) : toDomainProgress(row);
  }

  /**
   * Grades one answer and records the attempt.
   *
   * Returns the payoff on a correct answer, because that is the moment it is earned and
   * a second round trip to fetch it would put a visible seam in the one interaction the
   * product is built around.
   *
   * @throws {UnknownScenarioOptionError} if the option id is not one of this Leaf's —
   *   including an id belonging to a different Leaf's scenario. No attempt is recorded:
   *   nothing was answered, and counting it would let a client bug spend a reader's
   *   first-try bonus.
   * @throws {ContentNotFoundError} if the Leaf does not exist or is not visible here.
   */
  public async submitAnswer(
    userId: string,
    leafId: string,
    optionId: string,
  ): Promise<AnswerOutcome> {
    const leaf = await this.requireVisibleLeaf(leafId);

    // Throws before anything is written, so an unrecognised option leaves no trace.
    const correct = gradeAnswer(leaf, optionId);

    const row = await this.repository.recordAttempt({
      userId,
      leafId,
      correct,
      at: new Date(),
    });

    const unlocked = row.correctAt !== null;

    this.logger.info(
      { userId, leafId, correct, attemptCount: row.attemptCount },
      'Scenario answered',
    );

    return {
      correct,
      progress: toDomainProgress(row),
      payoffUnlocked: unlocked,
      payoff: unlocked ? leaf.payoff : null,
    };
  }

  /**
   * Completes a Leaf and awards its XP, exactly once.
   *
   * Idempotent by contract: replaying it returns the same progress with `xpAwarded: 0`
   * rather than failing. A client that retries a request whose response it never saw is
   * doing the right thing, and it must not be paid twice for it — nor punished with an
   * error for a call that did, in fact, succeed.
   *
   * @throws {LeafNotUnlockedError} if the scenario has not been answered correctly.
   */
  public async completeLeaf(userId: string, leafId: string): Promise<CompletionOutcome> {
    // Kept, not discarded: the Track this Leaf belongs to decides whether finishing it
    // also finishes the book.
    const leaf = await this.requireVisibleLeaf(leafId);

    const existing = await this.repository.find(userId, leafId);

    if (existing === null || existing.correctAt === null) {
      throw new LeafNotUnlockedError();
    }

    if (existing.completedAt !== null) {
      return { progress: toDomainProgress(existing), xpAwarded: 0, alreadyCompleted: true };
    }

    const xp = calculateLeafXp(this.xpRules, existing);
    const at = new Date();

    const completed = await this.repository.completeIfUnfinished({
      userId,
      leafId,
      xpAwarded: xp,
      at,
      // The reader's own calendar date, not the server's. WP5 groups streaks and the
      // daily cap by this; deriving it from `at` in UTC is plan §3.5's named bug.
      localDate: localDateIn(await this.requireReaderTimezone(userId), at),
    });

    if (completed === null) {
      // Lost the race to a concurrent completion of the same Leaf. The other request
      // awarded the XP, so this one reports the replay outcome rather than paying again.
      const current = await this.repository.find(userId, leafId);

      if (current === null) {
        throw new Error('Progress row vanished during completion');
      }

      this.logger.warn({ userId, leafId }, 'Concurrent completion; no XP awarded twice');

      return { progress: toDomainProgress(current), xpAwarded: 0, alreadyCompleted: true };
    }

    this.logger.info(
      { userId, leafId, xpAwarded: xp, firstTryCorrect: completed.firstTryCorrect },
      'Leaf completed and XP awarded',
    );

    await this.finishTrackIfDone(userId, leaf.trackId);

    return { progress: toDomainProgress(completed), xpAwarded: xp, alreadyCompleted: false };
  }

  /**
   * Marks the Track complete once its last Leaf is done.
   *
   * This is what finally closes `user_tracks.status`, which has been `active` since WP3
   * because nothing owned the Leaf-count rollup it needed. Completion time is the right
   * trigger: the alternative — deciding it while rendering the library — is a write on
   * a read path, and it would leave the status wrong for any reader who never opens
   * their library.
   *
   * Failures here are logged and swallowed. The reader has finished the Leaf and been
   * paid for it; turning a bookkeeping problem into a failed completion would be the
   * worse outcome, and the next completion re-evaluates it anyway.
   */
  private async finishTrackIfDone(userId: string, trackId: string): Promise<void> {
    try {
      // The sanctioned repository read again — see `requireVisibleLeaf`. Filtered
      // through the same predicate, so a placeholder Leaf hidden in production is not
      // counted and cannot hold a Track open that a reader has actually finished.
      const leaves = (await this.content.listLeavesForTrack(trackId)).filter((leaf) =>
        isVisibleIn(this.config.NODE_ENV, leaf),
      );

      const summary = await this.summariseTrack(userId, trackId, leaves);

      if (!summary.isComplete) {
        return;
      }

      if (await this.trackStatus.setStatus(userId, trackId, 'completed')) {
        this.logger.info({ userId, trackId, leaves: summary.totalLeaves }, 'Track completed');
      }
    } catch (error) {
      this.logger.error(
        { err: toError(error), userId, trackId },
        'Could not update Track status after completing a Leaf',
      );
    }
  }

  /**
   * @see TrackProgressReader
   *
   * Takes the Leaves rather than fetching them, so the caller decides what "visible"
   * means. `LibraryService` passes the output of `ContentService.listLeaves`, which is
   * the only thing that applies the placeholder guard — fetching them here would route
   * around it.
   */
  public async summariseTrack(
    userId: string,
    trackId: string,
    leaves: readonly CountableLeaf[],
  ): Promise<TrackProgressSummary> {
    const completed = await this.repository.listCompletedLeafIds(
      userId,
      leaves.map((leaf) => leaf.id),
    );

    return summariseTrackProgress(trackId, leaves, new Set(completed));
  }

  /** @see PayoffAccessPolicy — deliberately reads progress only, never content. */
  public async isPayoffUnlocked(userId: string, leafId: string): Promise<boolean> {
    const row = await this.repository.find(userId, leafId);

    return row !== null && row.correctAt !== null;
  }

  /**
   * The full Leaf, answer key included, for grading.
   *
   * **This is the single deliberate exception to routing content reads through
   * `ContentService`** (WP4 handoff). Grading needs `isCorrect`, and `ContentService`
   * returns `PublicLeaf` — by design, since widening it would put the answer key on the
   * wire and make the unlock gate decorative.
   *
   * Going around `ContentService` means going around its placeholder guard, so the
   * guard is reapplied here from the same shared predicate rather than reimplemented.
   * Without this the loop would happily grade — and pay XP for — a Leaf that production
   * is meant to be hiding.
   *
   * @throws {ContentNotFoundError} if absent, unpublished, or placeholder in production.
   */
  private async requireVisibleLeaf(leafId: string): Promise<Leaf> {
    const leaf = await this.content.findLeaf(leafId);

    if (!isVisibleIn(this.config.NODE_ENV, leaf)) {
      throw new ContentNotFoundError('Leaf');
    }

    return leaf;
  }

  /**
   * @throws {NotFoundError} if the reader has no row. Their token authenticated, so
   *   this means the account was deleted mid-request — rare, but the alternative is
   *   quietly defaulting to UTC and filing the completion under the wrong day.
   */
  private async requireReaderTimezone(userId: string): Promise<string> {
    const timezone = await this.repository.findReaderTimezone(userId);

    if (timezone === null) {
      throw new NotFoundError('Reader not found');
    }

    return timezone;
  }
}

export interface AnswerOutcome {
  readonly correct: boolean;
  readonly progress: LeafProgress;
  readonly payoffUnlocked: boolean;
  /** The earned payoff slide, or null while it is still locked. */
  readonly payoff: PayoffSlide | null;
}

export interface CompletionOutcome {
  readonly progress: LeafProgress;
  /** What *this call* awarded. Zero on a replay; `progress.xpAwarded` holds the total. */
  readonly xpAwarded: number;
  readonly alreadyCompleted: boolean;
}
