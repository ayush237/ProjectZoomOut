import type {
  AnswerOutcome,
  CompletionOutcome,
  Leaf,
  LeafProgress,
  ReaderStanding,
  SessionStatus,
  TrackProgressSummary,
} from '@zoomout/shared';

import { NotFoundError } from '../auth/auth.errors.js';
import { localDateIn } from '../auth/ageGate.js';
import type { AchievementAwarder, TrackContext } from '../achievements/achievements.service.js';
import type { AppConfig } from '../config/env.js';
import { toError } from '../errors.js';
import type { ContentRepository } from '../content/content.repository.js';
import { isVisibleIn, resolveVisibleLeaf } from '../content/contentVisibility.js';
import type { PayoffAccessPolicy } from '../content/payoffAccess.js';
import type { TrackStatusWriter } from '../library/library.repository.js';
import type { AppLogger } from '../logging/logger.js';
import { gradeAnswer } from './grading.js';
import { summariseTrackProgress, type CountableLeaf } from './trackProgress.js';
import { toDomainProgress, untouchedProgress } from './progress.mapper.js';
import { LeafNotUnlockedError } from './progress.errors.js';
import type { ProgressRepository } from './progress.repository.js';
import type { SessionRepository } from './session.repository.js';
import type { DailySessionRow } from '../db/schema.js';
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
    /** WP5a. The daily cap and the streak. */
    private readonly sessions: SessionRepository,
    /**
     * WP5b. Completion and answering are both evaluation points, and the unlock has to
     * travel back in this action's response rather than on a later poll.
     */
    private readonly achievements: AchievementAwarder,
  ) {
    this.xpRules = {
      completion: config.XP_LEAF_COMPLETION,
      firstTryBonus: config.XP_FIRST_TRY_BONUS,
    };
  }

  /**
   * Today's session and the reader's streak, for Profile and the limit screen.
   *
   * "Today" is resolved here rather than accepted from the caller: a client that sent
   * its own date would let a device with a wrong clock — or a deliberately altered one —
   * reset the cap at will.
   */
  public async readDay(userId: string): Promise<ReaderStanding> {
    const localDate = localDateIn(await this.requireReaderTimezone(userId));
    const [session, streak, totalXp] = await Promise.all([
      this.sessions.findSession(userId, localDate),
      this.sessions.findStreak(userId),
      // WP5b. Summed on read, never stored — see `ReaderStanding.totalXp`.
      this.repository.sumXpAwarded(userId),
    ]);

    return {
      session: this.toSessionStatus(localDate, session),
      streak: {
        current: streak?.current ?? 0,
        longest: streak?.longest ?? 0,
        lastActiveLocalDate: streak?.lastActiveLocalDate ?? null,
      },
      totalXp,
    };
  }

  /** A row, or the zero state for a reader who has not started today. */
  private toSessionStatus(localDate: string, row: DailySessionRow | null): SessionStatus {
    return {
      localDate,
      secondsActive: row?.secondsActive ?? 0,
      xpEarned: row?.xpEarned ?? 0,
      // `row === null` is a reader who has not started today; both mean not capped.
      capReached: row !== null && row.capReachedAt !== null,
      capSeconds: this.config.SESSION_CAP_SECONDS,
      capXp: this.config.SESSION_CAP_XP,
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

    /**
     * An evaluation point, because `first-try-first` is about *answering* rather than
     * finishing — a reader who answers correctly first time and then puts the phone
     * down has still done the thing it celebrates. No Track context: nothing about a
     * single answer can complete a book.
     */
    return {
      correct,
      progress: toDomainProgress(row),
      payoffUnlocked: unlocked,
      payoff: unlocked ? leaf.payoff : null,
      unlocked: await this.achievements.awardQuietly(userId),
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

    const at = new Date();
    // The reader's own calendar date, not the server's. Streaks and the daily cap group
    // by this; deriving it from `at` in UTC is plan §3.5's named bug.
    const localDate = localDateIn(await this.requireReaderTimezone(userId), at);

    if (existing.completedAt !== null) {
      /**
       * Re-evaluated on a replay, before returning.
       *
       * Below the early return, the rollup only ever ran on the call that *awarded* the
       * XP — so `user_tracks.status` could stick at `active` forever in two live cases:
       * a reader who finishes every Leaf and only then adds the Track, and a
       * `setStatus` failure on the final Leaf, which is swallowed by design. Running it
       * here makes a replayed completion self-healing, and it is already idempotent via
       * the `eq(status, 'active')` guard in the repository.
       */
      const replayTrack = await this.finishTrackIfDone(userId, leaf.trackId);

      return {
        progress: toDomainProgress(existing),
        xpAwarded: 0,
        alreadyCompleted: true,
        // A replay must not add to the clock, but it still reports where the day
        // stands — the client shows the limit screen off this.
        session: this.toSessionStatus(localDate, await this.sessions.findSession(userId, localDate)),
        // Re-derived on a replay too: the reader may be re-entering the Leaf that
        // finished the book, and the purchase link should still be offered.
        trackCompleted: replayTrack.completed,
        /**
         * Empty, and not because evaluation is skipped.
         *
         * A replay re-decides that every already-held achievement is still held, every
         * insert conflicts, and nothing comes back — which is exactly what stops the
         * client replaying the unlock animation each time a reader re-enters a finished
         * Leaf. Left as a real evaluation rather than a hardcoded `[]` so that a badge
         * genuinely earned between the two calls is still awarded.
         */
        unlocked: await this.achievements.awardQuietly(userId),
      };
    }

    /**
     * The cap as it stood **before** this Leaf.
     *
     * This is what makes "an in-progress Leaf finishes rather than being cut off" and
     * "XP past the cap is not awarded" both true at once. A reader who was under the
     * cap when they started is paid in full for the Leaf they are on, even if finishing
     * it crosses the line; the next Leaf they complete is the one that earns nothing.
     * Refusing the completion instead would be the cruel reading — it would discard
     * work already done.
     *
     * `calculateLeafXp` is not told about any of this. It answers what the Leaf *earned*
     * and the cap decides what is *paid*, which keeps the award rules readable on their
     * own and is the separation the handoff asks for.
     */
    const before = await this.sessions.findSession(userId, localDate);
    const capAlreadyReached = before !== null && before.capReachedAt !== null;
    const xp = capAlreadyReached ? 0 : calculateLeafXp(this.xpRules, existing);

    const completed = await this.repository.completeIfUnfinished({
      userId,
      leafId,
      xpAwarded: xp,
      at,
      localDate,
    });

    if (completed === null) {
      // Lost the race to a concurrent completion of the same Leaf. The other request
      // awarded the XP, so this one reports the replay outcome rather than paying again.
      const current = await this.repository.find(userId, leafId);

      if (current === null) {
        throw new Error('Progress row vanished during completion');
      }

      this.logger.warn({ userId, leafId }, 'Concurrent completion; no XP awarded twice');

      return {
        progress: toDomainProgress(current),
        xpAwarded: 0,
        alreadyCompleted: true,
        session: this.toSessionStatus(localDate, await this.sessions.findSession(userId, localDate)),
        // The call that won awarded them; this one has nothing new to announce.
        unlocked: await this.achievements.awardQuietly(userId),
        trackCompleted: (await this.finishTrackIfDone(userId, leaf.trackId)).completed,
      };
    }

    /**
     * The clock and the streak, after the award and only on the call that won.
     *
     * Ordered after `completeIfUnfinished` deliberately: that statement is the one that
     * decides whether this request is the real completion, so accumulating before it
     * would let a losing concurrent request add time and XP for a Leaf it did not
     * complete.
     */
    const session = await this.sessions.accumulate({
      userId,
      localDate,
      seconds: this.leafSeconds(existing.startedAt, at),
      xp,
      at,
      capSeconds: this.config.SESSION_CAP_SECONDS,
      capXp: this.config.SESSION_CAP_XP,
    });

    await this.sessions.recordActiveDay(userId, localDate, at);

    this.logger.info(
      {
        userId,
        leafId,
        xpAwarded: xp,
        firstTryCorrect: completed.firstTryCorrect,
        capReached: session.capReachedAt !== null,
      },
      'Leaf completed and XP awarded',
    );

    const track = await this.finishTrackIfDone(userId, leaf.trackId);

    /**
     * The last thing the completion does, and it uses the rollup that was already paid
     * for above rather than fetching the Track's Leaves a second time.
     *
     * Ordered after `accumulate` and `recordActiveDay` on purpose: `daily-cap` reads
     * today's `cap_reached_at` and the streak achievements read `streak.current`, so
     * evaluating any earlier would judge the reader against the day they had *before*
     * the Leaf they just finished — and a reader would reach a 3-day streak without
     * `streak-3` until their next completion.
     */
    const unlocked = await this.achievements.awardQuietly(userId, track, at);

    return {
      progress: toDomainProgress(completed),
      xpAwarded: xp,
      alreadyCompleted: false,
      session: this.toSessionStatus(localDate, session),
      unlocked,
      trackCompleted: track.completed,
    };
  }

  /**
   * How much of the daily clock this Leaf spent.
   *
   * Elapsed time between opening the Leaf and completing it, clamped. That is the only
   * measure available without a client heartbeat, and it is **wrong in a specific,
   * known way**: a reader who opens a Leaf and returns to it tomorrow would otherwise
   * spend their whole budget on one Leaf. The clamp bounds that to
   * `SESSION_MAX_LEAF_SECONDS`, which under-counts a genuinely slow reader — erring
   * toward letting them continue, which is the right direction for a wellbeing feature.
   *
   * A real activity signal belongs with whatever measures time on the client, and is
   * not this package.
   */
  private leafSeconds(startedAt: Date, at: Date): number {
    const elapsed = Math.floor((at.getTime() - startedAt.getTime()) / 1000);

    // A negative value means clock skew between rows, not travel backwards in time.
    return Math.max(0, Math.min(elapsed, this.config.SESSION_MAX_LEAF_SECONDS));
  }

  /**
   * Marks the Track complete once its last Leaf is done, and reports how it stands.
   *
   * This is what finally closes `user_tracks.status`, which has been `active` since WP3
   * because nothing owned the Leaf-count rollup it needed. Completion time is the right
   * trigger: the alternative — deciding it while rendering the library — is a write on
   * a read path, and it would leave the status wrong for any reader who never opens
   * their library.
   *
   * **Returns the rollup rather than discarding it (WP5b).** `track-complete` and
   * `perfect-track` need exactly what this method already computed, and asking the CMS
   * for the same Leaf list twice would double the cost of the product's core
   * interaction to answer a question that was already on the stack.
   *
   * Failures here are logged and swallowed. The reader has finished the Leaf and been
   * paid for it; turning a bookkeeping problem into a failed completion would be the
   * worse outcome, and the next completion re-evaluates it anyway. A swallowed failure
   * reports `{ completed: false, perfect: false }` — the achievement is simply not
   * awarded this time, which the next completion corrects, rather than being awarded on
   * incomplete information.
   */
  private async finishTrackIfDone(userId: string, trackId: string): Promise<TrackContext> {
    const unknown: TrackContext = { completed: false, perfect: false };

    try {
      // The sanctioned repository read again — see `requireVisibleLeaf`. Filtered
      // through the same predicate, so a placeholder Leaf hidden in production is not
      // counted and cannot hold a Track open that a reader has actually finished.
      const leaves = (await this.content.listLeavesForTrack(trackId)).filter((leaf) =>
        isVisibleIn(this.config.NODE_ENV, leaf),
      );

      const summary = await this.summariseTrack(userId, trackId, leaves);

      /**
       * Answered-first-try across the whole Track, counted only when it is complete.
       *
       * `perfect-track` is "every Leaf answered first-try", which cannot be true of a
       * book the reader has not finished — and checking accuracy on an unfinished Track
       * would award Flawless at the first correct answer of a twenty-Leaf book.
       */
      const perfect =
        summary.isComplete &&
        (await this.repository.countFirstTryCompletions(
          userId,
          leaves.map((leaf) => leaf.id),
        )) === leaves.length;

      if (!summary.isComplete) {
        return unknown;
      }

      if (await this.trackStatus.setStatus(userId, trackId, 'completed')) {
        this.logger.info({ userId, trackId, leaves: summary.totalLeaves }, 'Track completed');
      }

      return { completed: true, perfect };
    } catch (error) {
      this.logger.error(
        { err: toError(error), userId, trackId },
        'Could not update Track status after completing a Leaf',
      );

      return unknown;
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
   * Going around `ContentService` means going around its guards, so they are reapplied
   * here from the same shared helper rather than reimplemented. Without this the loop
   * would happily grade — and pay XP for — a Leaf that production is meant to be hiding,
   * or one whose Track has been taken down.
   *
   * @throws {ContentNotFoundError} if the Leaf or **its Track** is absent, unpublished,
   *   or placeholder in production.
   */
  private async requireVisibleLeaf(leafId: string): Promise<Leaf> {
    return resolveVisibleLeaf(this.content, this.config.NODE_ENV, leafId);
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

/**
 * Both outcomes moved to `packages/shared/src/delivery.ts` in WP8 — the mobile app
 * renders them, and CLAUDE.md allows only one definition of a shape that crosses a
 * workspace boundary. Re-exported so existing importers of this module are unaffected.
 */
export type { AnswerOutcome, CompletionOutcome };
