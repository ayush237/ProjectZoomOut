import { describe, expect, it, vi } from 'vitest';

import { buildLeaf, buildTrack } from '../../test/helpers/leafFixture.js';
import { NotFoundError } from '../auth/auth.errors.js';
import { loadConfig, type AppConfig } from '../config/env.js';
import { ContentNotFoundError } from '../content/content.errors.js';
import type { ContentRepository } from '../content/content.repository.js';
import type { DailySessionRow, StreakRow } from '../db/schema.js';
import type { LeafProgressRow } from '../db/schema.js';
import type { AppLogger } from '../logging/logger.js';
import { LeafNotUnlockedError, UnknownScenarioOptionError } from './progress.errors.js';
import type { ProgressRepository } from './progress.repository.js';
import { ProgressService } from './progress.service.js';

/**
 * Orchestration in the learning loop.
 *
 * Scoped deliberately: the guarantees that live in SQL — the attempt increment, the
 * frozen first-try flag, one-shot XP — are **not** tested here, because a fake
 * repository would only prove the fake behaves. Those are in
 * `test/progress.integration.test.ts` against real Postgres.
 *
 * What is worth asserting without a database is what the service refuses to do at all:
 * which calls it declines to make, and in what order.
 */

const stubLogger = (): AppLogger =>
  ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }) as unknown as AppLogger;

const configFor = (nodeEnv = 'test'): AppConfig =>
  loadConfig({
    NODE_ENV: nodeEnv,
    DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
    AUTH_JWT_SECRET: 'x'.repeat(48),
  });

const READER = '11111111-1111-4111-8111-111111111111';

function rowOf(overrides: Partial<LeafProgressRow> = {}): LeafProgressRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    userId: READER,
    leafId: 'l1',
    attemptCount: 0,
    firstTryCorrect: false,
    correctAt: null,
    completedAt: null,
    completedLocalDate: null,
    xpAwarded: 0,
    startedAt: new Date('2026-08-09T10:00:00.000Z'),
    updatedAt: new Date('2026-08-09T10:00:00.000Z'),
    ...overrides,
  };
}

interface Harness {
  readonly service: ProgressService;
  readonly repository: {
    [K in keyof ProgressRepository]: ReturnType<typeof vi.fn>;
  };
  readonly content: {
    findLeaf: ReturnType<typeof vi.fn>;
    findTrack: ReturnType<typeof vi.fn>;
    listLeavesForTrack: ReturnType<typeof vi.fn>;
  };
  readonly trackStatus: { setStatus: ReturnType<typeof vi.fn> };
  readonly sessions: {
    session: DailySessionRow | null;
    findSession: ReturnType<typeof vi.fn>;
    accumulate: ReturnType<typeof vi.fn>;
    findStreak: ReturnType<typeof vi.fn>;
    recordActiveDay: ReturnType<typeof vi.fn>;
  };
}

function emptySessionRow(capReached: boolean): DailySessionRow {
  return {
    userId: 'user-1',
    localDate: '2026-08-12',
    secondsActive: 0,
    xpEarned: 0,
    capReachedAt: capReached ? new Date('2026-08-12T10:00:00.000Z') : null,
    createdAt: new Date('2026-08-12T09:00:00.000Z'),
    updatedAt: new Date('2026-08-12T10:00:00.000Z'),
  };
}

function stubStreakRow(): StreakRow {
  return {
    userId: 'user-1',
    current: 1,
    longest: 1,
    lastActiveLocalDate: '2026-08-12',
    updatedAt: new Date('2026-08-12T10:00:00.000Z'),
  };
}

function harness(
  options: {
    row?: LeafProgressRow | null;
    leaf?: ReturnType<typeof buildLeaf>;
    nodeEnv?: string;
    track?: ReturnType<typeof buildTrack>;
    trackLeaves?: readonly ReturnType<typeof buildLeaf>[];
    /** Start the day already over the cap, so a completion earns nothing. */
    capReached?: boolean;
  } = {},
): Harness {
  const row = options.row ?? null;

  const repository = {
    find: vi.fn().mockResolvedValue(row),
    start: vi.fn().mockResolvedValue(row ?? rowOf()),
    recordAttempt: vi.fn().mockResolvedValue(row ?? rowOf({ attemptCount: 1 })),
    completeIfUnfinished: vi.fn().mockResolvedValue(rowOf({ completedAt: new Date() })),
    findReaderTimezone: vi.fn().mockResolvedValue('Europe/London'),
    listCompletedLeafIds: vi.fn().mockResolvedValue([]),
    sumXpAwarded: vi.fn().mockResolvedValue(0),
    countFirstTryCompletions: vi.fn().mockResolvedValue(0),
    // WP9's summary read. Nothing in this file exercises it; the local-date query it
    // exists for is proven against real Postgres in the integration suite.
    listCompletedOn: vi.fn().mockResolvedValue([]),
  };

  const content = {
    findLeaf: vi.fn().mockResolvedValue(options.leaf ?? buildLeaf()),
    /**
     * The parent Track, resolved on every Leaf read since the takedown cascade.
     * Published and non-placeholder by default, so a test opts *into* a hidden Track
     * rather than every existing test having to opt out.
     */
    findTrack: vi.fn().mockResolvedValue(options.track ?? buildTrack()),
    // Read when a completion asks whether the Track is now finished.
    listLeavesForTrack: vi.fn().mockResolvedValue(options.trackLeaves ?? [options.leaf ?? buildLeaf()]),
  };

  const trackStatus = { setStatus: vi.fn().mockResolvedValue(true) };

  /**
   * The session store, stubbed.
   *
   * Deliberately not a working in-memory accumulator. The cap and the streak are
   * upsert-shaped and their guarantees are written in SQL — `ON CONFLICT`, `greatest`,
   * Postgres date arithmetic — so a JavaScript re-implementation here would prove the
   * re-implementation and ship the statements unverified. That is exactly the split the
   * handoff warns about, and those tests live in the integration suite against a real
   * database. What this needs to do is let the existing unit tests run, and let a test
   * that cares set the pre-existing session with `sessions.session`.
   */
  const sessions = {
    session: null as DailySessionRow | null,
    findSession: vi.fn(() => Promise.resolve(sessions.session)),
    accumulate: vi.fn(() =>
      Promise.resolve(sessions.session ?? emptySessionRow(options.capReached === true)),
    ),
    findStreak: vi.fn(() => Promise.resolve(null)),
    recordActiveDay: vi.fn(() => Promise.resolve(stubStreakRow())),
  };

  if (options.capReached === true) {
    sessions.session = emptySessionRow(true);
  }

  return {
    service: new ProgressService(
      repository,
      // Only the reads the service actually makes are implemented. The cast is the
      // price of not stubbing the rest of the repository.
      content as unknown as ContentRepository,
      configFor(options.nodeEnv),
      stubLogger(),
      trackStatus,
      sessions,
      /**
       * The awarder, stubbed to award nothing.
       *
       * WP5b makes completion and answering evaluation points, but nothing in this file
       * is about achievements — and `awardQuietly` is by contract unable to fail its
       * caller, so a stub that returns nothing is the honest neutral. The engine's own
       * guarantees are integration-tested against a real database, where the unique
       * index that makes awarding idempotent actually exists.
       */
      { awardQuietly: vi.fn().mockResolvedValue([]) },
    ),
    repository,
    content,
    trackStatus,
    sessions,
  };
}

/* -------------------------------------------------------------------------- */
/* An unrecognised option is not a wrong answer                                */
/* -------------------------------------------------------------------------- */

describe('submitAnswer', () => {
  it('rejects an option id that does not belong to the Leaf', async () => {
    const { service } = harness();

    await expect(service.submitAnswer(READER, 'l1', 'nope')).rejects.toBeInstanceOf(
      UnknownScenarioOptionError,
    );
  });

  it('records no attempt when the option id is unrecognised', async () => {
    // The reason the grade is computed before the write: a client bug must not be able
    // to spend a reader's first-try bonus.
    const { service, repository } = harness();

    await expect(service.submitAnswer(READER, 'l1', 'nope')).rejects.toThrow();

    expect(repository.recordAttempt).not.toHaveBeenCalled();
  });

  it('withholds the payoff on a wrong answer', async () => {
    const { service, repository } = harness();
    repository.recordAttempt.mockResolvedValue(rowOf({ attemptCount: 1, correctAt: null }));

    const outcome = await service.submitAnswer(READER, 'l1', 'o2');

    expect(outcome.correct).toBe(false);
    expect(outcome.payoffUnlocked).toBe(false);
    expect(outcome.payoff).toBeNull();
  });

  it('returns the payoff with a correct answer', async () => {
    // Delivered in the same response it is earned in: a second round trip would put a
    // seam in the one interaction the product is built around.
    const { service, repository } = harness();
    repository.recordAttempt.mockResolvedValue(
      rowOf({ attemptCount: 1, firstTryCorrect: true, correctAt: new Date() }),
    );

    const outcome = await service.submitAnswer(READER, 'l1', 'o1');

    expect(outcome.correct).toBe(true);
    expect(outcome.payoff?.body).toBe('Payoff prose.');
  });

  it('keeps the payoff unlocked when a later answer is wrong', async () => {
    // `correct_at` is never cleared. Going back and tapping a wrong option after
    // unlocking must not confiscate what the reader already earned.
    const { service, repository } = harness();
    repository.recordAttempt.mockResolvedValue(
      rowOf({ attemptCount: 3, correctAt: new Date('2026-08-09T10:05:00.000Z') }),
    );

    const outcome = await service.submitAnswer(READER, 'l1', 'o2');

    expect(outcome.correct).toBe(false);
    expect(outcome.payoffUnlocked).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Content the reader cannot see is not gradeable                              */
/* -------------------------------------------------------------------------- */

describe('the placeholder guard on the grading path', () => {
  it('404s a placeholder Leaf in production rather than grading it', async () => {
    // Grading reads the Leaf through `ContentRepository`, going around
    // `ContentService` and its guard — so the guard is reapplied in the service. Without
    // this, production would hide a Leaf from Explore and still pay XP for answering it.
    const { service } = harness({ nodeEnv: 'production' });

    await expect(service.submitAnswer(READER, 'l1', 'o1')).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
  });

  it('404s a draft Leaf everywhere', async () => {
    const { service } = harness({
      leaf: buildLeaf({ status: 'draft', isPlaceholder: false }),
    });

    await expect(service.startLeaf(READER, 'l1')).rejects.toBeInstanceOf(ContentNotFoundError);
  });

  it('grades a placeholder Leaf outside production', async () => {
    // Phase 1 is built entirely on placeholder content; hiding it in development would
    // make the loop untestable.
    const { service } = harness({ nodeEnv: 'development' });

    await expect(service.submitAnswer(READER, 'l1', 'o1')).resolves.toBeDefined();
  });
});

/* -------------------------------------------------------------------------- */
/* Completion                                                                  */
/* -------------------------------------------------------------------------- */

describe('completeLeaf', () => {
  it('refuses a Leaf the reader has never answered', async () => {
    const { service } = harness({ row: null });

    await expect(service.completeLeaf(READER, 'l1')).rejects.toBeInstanceOf(LeafNotUnlockedError);
  });

  it('refuses a Leaf answered only incorrectly', async () => {
    const { service } = harness({ row: rowOf({ attemptCount: 4, correctAt: null }) });

    await expect(service.completeLeaf(READER, 'l1')).rejects.toBeInstanceOf(LeafNotUnlockedError);
  });

  it('writes nothing when completion is refused', async () => {
    // Otherwise the gate is a message rather than a control.
    const { service, repository } = harness({ row: rowOf({ correctAt: null }) });

    await expect(service.completeLeaf(READER, 'l1')).rejects.toThrow();

    expect(repository.completeIfUnfinished).not.toHaveBeenCalled();
  });

  it('awards nothing a second time and does not touch storage', async () => {
    const { service, repository } = harness({
      row: rowOf({
        correctAt: new Date('2026-08-09T10:05:00.000Z'),
        completedAt: new Date('2026-08-09T10:06:00.000Z'),
        xpAwarded: 100,
      }),
    });

    const outcome = await service.completeLeaf(READER, 'l1');

    expect(outcome.alreadyCompleted).toBe(true);
    expect(outcome.xpAwarded).toBe(0);
    expect(outcome.progress.xpAwarded).toBe(100);
    expect(repository.completeIfUnfinished).not.toHaveBeenCalled();
  });

  it('reports a replay rather than paying twice when it loses a completion race', async () => {
    // Two concurrent completions: the conditional UPDATE matches for one of them and
    // returns nothing for the other. The loser must report the winner's outcome.
    const completed = rowOf({
      correctAt: new Date('2026-08-09T10:05:00.000Z'),
      completedAt: new Date('2026-08-09T10:06:00.000Z'),
      xpAwarded: 100,
    });
    const { service, repository } = harness({ row: rowOf({ correctAt: new Date() }) });
    repository.completeIfUnfinished.mockResolvedValue(null);
    repository.find.mockResolvedValueOnce(rowOf({ correctAt: new Date() })).mockResolvedValue(completed);

    const outcome = await service.completeLeaf(READER, 'l1');

    expect(outcome.xpAwarded).toBe(0);
    expect(outcome.alreadyCompleted).toBe(true);
  });

  it('files the completion under the reader’s local date, not the server’s', async () => {
    // Pacific/Auckland is a day ahead of UTC late in the evening. WP5 groups streaks by
    // this value, so getting it from a UTC instant is plan §3.5's named bug.
    const { service, repository } = harness({ row: rowOf({ correctAt: new Date() }) });
    repository.findReaderTimezone.mockResolvedValue('Pacific/Auckland');

    await service.completeLeaf(READER, 'l1');

    const [input] = repository.completeIfUnfinished.mock.calls[0] as [{ localDate: string }];
    expect(input.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });

  it('refuses to guess a timezone for a reader who no longer exists', async () => {
    // Defaulting to UTC here would file the completion under the wrong day, silently.
    const { service, repository } = harness({ row: rowOf({ correctAt: new Date() }) });
    repository.findReaderTimezone.mockResolvedValue(null);

    await expect(service.completeLeaf(READER, 'l1')).rejects.toBeInstanceOf(NotFoundError);
  });
});

/* -------------------------------------------------------------------------- */
/* The payoff policy                                                           */
/* -------------------------------------------------------------------------- */

describe('isPayoffUnlocked', () => {
  it('is false for a reader who has never opened the Leaf', async () => {
    const { service } = harness({ row: null });

    await expect(service.isPayoffUnlocked(READER, 'l1')).resolves.toBe(false);
  });

  it('is false for a reader who has only answered wrongly', async () => {
    const { service } = harness({ row: rowOf({ attemptCount: 2, correctAt: null }) });

    await expect(service.isPayoffUnlocked(READER, 'l1')).resolves.toBe(false);
  });

  it('is true once the reader has answered correctly', async () => {
    const { service } = harness({ row: rowOf({ correctAt: new Date() }) });

    await expect(service.isPayoffUnlocked(READER, 'l1')).resolves.toBe(true);
  });

  it('answers without reading content at all', async () => {
    // Content delivery calls this *while* serving a Leaf it has already fetched. If the
    // policy fetched content too, every Leaf request would hit the CMS twice.
    const { service, content } = harness({ row: rowOf({ correctAt: new Date() }) });

    await service.isPayoffUnlocked(READER, 'l1');

    expect(content.findLeaf).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* Resumability                                                                */
/* -------------------------------------------------------------------------- */

describe('getProgress', () => {
  it('reports a zero state for a Leaf the reader has never opened', async () => {
    const { service } = harness({ row: null });

    const progress = await service.getProgress(READER, 'l1');

    expect(progress).toEqual({
      userId: READER,
      leafId: 'l1',
      attemptCount: 0,
      firstTryCorrect: false,
      correctAt: null,
      completedAt: null,
      xpAwarded: 0,
    });
  });

  it('still 404s a Leaf that does not exist', async () => {
    // "No progress" is only a valid answer about a Leaf that is actually there;
    // otherwise this endpoint becomes a way to probe which ids exist.
    const { service, content } = harness({ row: null });
    content.findLeaf.mockRejectedValue(new ContentNotFoundError('Leaf'));

    await expect(service.getProgress(READER, 'l1')).rejects.toBeInstanceOf(ContentNotFoundError);
  });
});

/* -------------------------------------------------------------------------- */
/* Takedown cascades from the Track to its Leaves                              */
/* -------------------------------------------------------------------------- */

describe('when the parent Track has been taken down', () => {
  /**
   * The Leaf itself is untouched and perfectly valid — published, not a placeholder.
   * Only its Track has been pulled, which is exactly how a legal takedown is performed:
   * unpublish the book, not each of its twenty Leaves.
   *
   * Before this cascade, every one of these paths carried on working.
   */
  const withUnpublishedTrack = (): ReturnType<typeof harness> =>
    harness({ track: buildTrack({ status: 'draft' }) });

  it('refuses to start the Leaf', async () => {
    await expect(
      withUnpublishedTrack().service.startLeaf(READER, 'l1'),
    ).rejects.toBeInstanceOf(ContentNotFoundError);
  });

  it('refuses to grade an answer', async () => {
    // The one that pays out: grading a Leaf from a pulled book also awards XP for it.
    await expect(
      withUnpublishedTrack().service.submitAnswer(READER, 'l1', 'o1'),
    ).rejects.toBeInstanceOf(ContentNotFoundError);
  });

  it('records no attempt when it refuses', async () => {
    const { service, repository } = withUnpublishedTrack();

    await expect(service.submitAnswer(READER, 'l1', 'o1')).rejects.toThrow();

    expect(repository.recordAttempt).not.toHaveBeenCalled();
  });

  it('refuses to complete the Leaf', async () => {
    const { service } = harness({
      track: buildTrack({ status: 'draft' }),
      row: rowOf({ correctAt: new Date() }),
    });

    await expect(service.completeLeaf(READER, 'l1')).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
  });

  it('refuses to report progress', async () => {
    await expect(
      withUnpublishedTrack().service.getProgress(READER, 'l1'),
    ).rejects.toBeInstanceOf(ContentNotFoundError);
  });

  it('hides a placeholder Track in production even when the Leaf is real', async () => {
    const { service } = harness({
      nodeEnv: 'production',
      leaf: buildLeaf({ isPlaceholder: false }),
      track: buildTrack({ isPlaceholder: true }),
    });

    await expect(service.submitAnswer(READER, 'l1', 'o1')).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
  });

  it('refuses when the Track has been deleted outright', async () => {
    // Not merely unpublished — gone. As unservable as unpublished, and for the same
    // reason, so it must not surface as an unhandled error.
    const { service, content } = harness();
    content.findTrack.mockRejectedValue(new ContentNotFoundError('Track'));

    await expect(service.startLeaf(READER, 'l1')).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
  });
});
