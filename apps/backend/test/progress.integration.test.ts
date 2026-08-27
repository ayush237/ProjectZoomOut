import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Leaf as CmsLeaf, Track as CmsTrack } from '@zoomout/shared/cms';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from '../src/db/migrate.js';
import { FakePayload } from './helpers/fakePayload.js';
import { buildTestApp, type TestApp } from './helpers/buildTestApp.js';

/**
 * The learning loop, end to end: answer, unlock, complete, award.
 *
 * Real Postgres, because the guarantees under test are written in SQL — the attempt
 * increment, the frozen first-try flag, and above all one-shot XP. A fake repository
 * would prove the fake behaves and nothing about the statements that ship.
 *
 * A controllable stand-in for Payload supplies content, for the reasons in
 * `fakePayload.ts`. The Leaves here are shaped exactly as the real CMS returns them,
 * including the hex row ids Payload assigns to scenario options.
 *
 * Requires a running Docker daemon.
 */

const POSTGRES_IMAGE = 'postgres:16-alpine';

let container: StartedPostgreSqlContainer;
let payload: FakePayload;
let harness: TestApp;

const app = (): TestApp['app'] => harness.app;

function bodyOf<T>(response: { body: string }): T {
  const parsed: unknown = JSON.parse(response.body);
  return parsed as T;
}

const TRACK: CmsTrack = {
  id: 1,
  bookTitle: 'Placeholder Book',
  author: 'Placeholder Author',
  publisher: 'Placeholder Publisher',
  coverUrl: 'https://example.test/cover.png',
  description: 'Placeholder description.',
  disclaimer: 'ZoomOut is not affiliated with or endorsed by the author or publisher.',
  purchaseLinks: [
    { retailer: 'Example Books', url: 'https://example.test/book', isAffiliate: false, id: 'r1' },
  ],
  leafCount: 2,
  acquisition: 'undocumented',
  isPlaceholder: true,
  createdAt: '2026-08-08T12:00:00.000Z',
  updatedAt: '2026-08-08T12:00:00.000Z',
  _status: 'published',
};

/** Payload row ids are hex strings, verified against the live CMS in WP3. */
const CORRECT_OPTION = '6a7629ee570031ac25de62bf';
const WRONG_OPTION = '6a7629ee570031ac25de62c0';
const OTHER_WRONG_OPTION = '6a7629ee570031ac25de62c1';
/** Belongs to Leaf 11. A real id, on the wrong scenario. */
const OTHER_LEAF_OPTION = '7b8730ff681142bd36ef73d0';

const PAYOFF_PROSE = 'The payoff nobody may read before answering.';

const LEAF: CmsLeaf = {
  id: 10,
  trackId: 1,
  orderIndex: 0,
  title: 'Concept One',
  summary: { body: 'Placeholder summary.' },
  scenario: {
    prompt: 'Placeholder prompt?',
    options: [
      { text: 'The right one', isCorrect: true, id: CORRECT_OPTION },
      { text: 'A wrong one', isCorrect: false, id: WRONG_OPTION },
      { text: 'Another wrong one', isCorrect: false, id: OTHER_WRONG_OPTION },
    ],
  },
  payoff: { body: PAYOFF_PROSE },
  stickyNotes: {
    notes: [
      { note: 'Note one', id: 'n1' },
      { note: 'Note two', id: 'n2' },
    ],
  },
  takeaway: { body: 'Placeholder takeaway.' },
  sourceReferences: [
    { slideKey: 'summary', chapter: 'Chapter 1', page: null, quote: null, note: 'A note.', id: 's1' },
  ],
  isPlaceholder: true,
  createdAt: '2026-08-08T12:00:00.000Z',
  updatedAt: '2026-08-08T12:00:00.000Z',
  _status: 'published',
};

const SECOND_LEAF: CmsLeaf = {
  ...LEAF,
  id: 11,
  orderIndex: 1,
  title: 'Concept Two',
  scenario: {
    prompt: 'A different prompt?',
    options: [
      { text: 'Right', isCorrect: true, id: OTHER_LEAF_OPTION },
      { text: 'Wrong', isCorrect: false, id: '7b8730ff681142bd36ef73d1' },
      { text: 'Also wrong', isCorrect: false, id: '7b8730ff681142bd36ef73d2' },
    ],
  },
};

interface Reader {
  readonly userId: string;
  readonly token: string;
}

async function createReader(timezone = 'Europe/London'): Promise<Reader> {
  const response = await app().inject({
    method: 'POST',
    url: '/auth/signup',
    payload: {
      email: `reader-${String(Math.random()).slice(2)}@example.test`,
      password: 'a-sufficiently-long-password',
      displayName: 'Test Reader',
      dateOfBirth: '1994-03-17',
      timezone,
    },
  });

  const body = bodyOf<{ userId: string; accessToken: string }>(response);
  return { userId: body.userId, token: body.accessToken };
}

const auth = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` });

const answer = (reader: Reader, optionId: string, leafId = 10) =>
  app().inject({
    method: 'POST',
    url: `/progress/leaves/${String(leafId)}/answer`,
    headers: auth(reader.token),
    payload: { optionId },
  });

const complete = (reader: Reader, leafId = 10) =>
  app().inject({
    method: 'POST',
    url: `/progress/leaves/${String(leafId)}/complete`,
    headers: auth(reader.token),
  });

const readLeaf = (reader: Reader, leafId = 10) =>
  app().inject({
    method: 'GET',
    url: `/content/leaves/${String(leafId)}`,
    headers: auth(reader.token),
  });

const readProgress = (reader: Reader, leafId = 10) =>
  app().inject({
    method: 'GET',
    url: `/progress/leaves/${String(leafId)}`,
    headers: auth(reader.token),
  });

interface ProgressBody {
  progress: {
    attemptCount: number;
    firstTryCorrect: boolean;
    correctAt: string | null;
    completedAt: string | null;
    xpAwarded: number;
  };
}

interface AnswerBody extends ProgressBody {
  correct: boolean;
  payoffUnlocked: boolean;
  payoff: { body: string } | null;
}

interface CompletionBody extends ProgressBody {
  xpAwarded: number;
  alreadyCompleted: boolean;
}

interface LeafBody {
  payoffUnlocked: boolean;
  payoff: { body: string } | null;
}

/** XP at the shipped defaults: 80 for completion, +20 for a first-try correct answer. */
const XP_BASE = 80;
const XP_FIRST_TRY = 100;

beforeAll(async () => {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  payload = await FakePayload.start();

  harness = await buildTestApp({
    databaseUrl: container.getConnectionUri(),
    env: {
      CONTENT_API_URL: payload.apiUrl,
      CONTENT_CACHE_TTL_SECONDS: '0',
      AUTH_RATE_LIMIT_MAX: '1000',
    },
  });

  await runMigrations(harness.database);
  await app().ready();
}, 300_000);

afterAll(async () => {
  await harness?.close();
  await payload?.stop();
  await container?.stop();
});

beforeEach(() => {
  payload.failing = false;
  payload.seedTrack(TRACK, { published: true });
  payload.seedLeaf(LEAF, { published: true });
  payload.seedLeaf(SECOND_LEAF, { published: true });
});

/* -------------------------------------------------------------------------- */
/* Migration                                                                   */
/* -------------------------------------------------------------------------- */

describe('the progress migration', () => {
  it('creates leaf_progress', async () => {
    const result = await harness.database.pool.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name='leaf_progress'`,
    );

    expect(result.rowCount).toBe(1);
  });

  it('enforces one row per reader per Leaf', async () => {
    // What makes an idempotent start safe, and what stops two concurrent first answers
    // becoming two rows that each believe they were the first try.
    const result = await harness.database.pool.query(
      `select 1 from pg_indexes where tablename='leaf_progress' and indexname='leaf_progress_user_leaf_unique'`,
    );

    expect(result.rowCount).toBe(1);
  });

  it('stores the completion date as a date, not a timestamp', async () => {
    // A `timestamp` here would reintroduce the timezone bug the column exists to avoid.
    const result = await harness.database.pool.query(
      `select data_type from information_schema.columns
       where table_name='leaf_progress' and column_name='completed_local_date'`,
    );

    expect(result.rows[0]).toEqual({ data_type: 'date' });
  });
});

/* -------------------------------------------------------------------------- */
/* Authentication                                                              */
/* -------------------------------------------------------------------------- */

describe('authentication', () => {
  it.each([
    ['GET', '/progress/leaves/10'],
    ['POST', '/progress/leaves/10/start'],
    ['POST', '/progress/leaves/10/answer'],
    ['POST', '/progress/leaves/10/complete'],
  ] as const)('rejects unauthenticated %s %s', async (method, url) => {
    const response = await app().inject({ method, url });

    expect(response.statusCode).toBe(401);
  });
});

/* -------------------------------------------------------------------------- */
/* The loop                                                                    */
/* -------------------------------------------------------------------------- */

describe('the full learning loop', () => {
  it('runs start → wrong → wrong → correct → complete', async () => {
    const reader = await createReader();

    const started = await app().inject({
      method: 'POST',
      url: '/progress/leaves/10/start',
      headers: auth(reader.token),
    });
    expect(started.statusCode).toBe(200);
    expect(bodyOf<ProgressBody>(started).progress.attemptCount).toBe(0);

    const firstWrong = bodyOf<AnswerBody>(await answer(reader, WRONG_OPTION));
    expect(firstWrong.correct).toBe(false);
    expect(firstWrong.progress.attemptCount).toBe(1);

    const secondWrong = bodyOf<AnswerBody>(await answer(reader, OTHER_WRONG_OPTION));
    expect(secondWrong.correct).toBe(false);
    expect(secondWrong.progress.attemptCount).toBe(2);
    expect(secondWrong.payoffUnlocked).toBe(false);

    const right = bodyOf<AnswerBody>(await answer(reader, CORRECT_OPTION));
    expect(right.correct).toBe(true);
    expect(right.progress.attemptCount).toBe(3);
    expect(right.payoffUnlocked).toBe(true);
    expect(right.payoff?.body).toBe(PAYOFF_PROSE);

    const completed = bodyOf<CompletionBody>(await complete(reader));
    expect(completed.alreadyCompleted).toBe(false);
    expect(completed.xpAwarded).toBe(XP_BASE);
    expect(completed.progress.completedAt).not.toBeNull();
  });

  it('awards the first-try bonus when the reader starts the Leaf first', async () => {
    // The path every real client takes, and the one the other first-try tests skip.
    //
    // Answering without `start` inserts the progress row, so `first_try_correct` comes
    // from the INSERT values. Answering *after* `start` updates an existing row, so the
    // flag is decided by the `case when attempt_count = 0 and $correct` expression in
    // the ON CONFLICT branch instead — a different piece of SQL, and the one that runs
    // in production. Without this test that branch is never exercised with a correct
    // first answer, and a reader who opens a Leaf before answering it would silently
    // lose the bonus.
    const reader = await createReader();

    await app().inject({
      method: 'POST',
      url: '/progress/leaves/10/start',
      headers: auth(reader.token),
    });

    const answered = bodyOf<AnswerBody>(await answer(reader, CORRECT_OPTION));
    expect(answered.progress.attemptCount).toBe(1);
    expect(answered.progress.firstTryCorrect).toBe(true);

    const completed = bodyOf<CompletionBody>(await complete(reader));
    expect(completed.progress.firstTryCorrect).toBe(true);
    expect(completed.progress.attemptCount).toBe(1);
    expect(completed.xpAwarded).toBe(XP_FIRST_TRY);
    expect(completed.progress.xpAwarded).toBe(XP_FIRST_TRY);
  });

  it('does not award the first-try bonus after a wrong answer', async () => {
    const reader = await createReader();

    await answer(reader, WRONG_OPTION);
    await answer(reader, CORRECT_OPTION);
    const completed = bodyOf<CompletionBody>(await complete(reader));

    expect(completed.progress.firstTryCorrect).toBe(false);
    expect(completed.xpAwarded).toBe(XP_BASE);
  });

  it('pays more for a first-try correct answer than for a later one', async () => {
    const quick = await createReader();
    const slow = await createReader();

    await answer(quick, CORRECT_OPTION);
    const quickXp = bodyOf<CompletionBody>(await complete(quick)).xpAwarded;

    await answer(slow, WRONG_OPTION);
    await answer(slow, CORRECT_OPTION);
    const slowXp = bodyOf<CompletionBody>(await complete(slow)).xpAwarded;

    expect(quickXp).toBe(XP_FIRST_TRY);
    expect(quickXp).toBeGreaterThan(slowXp);
  });

  it('lets a reader retry without limit', async () => {
    // PRODUCT.md: the stakes are XP, not access. Nothing locks a reader out.
    const reader = await createReader();

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await answer(reader, WRONG_OPTION);
      expect(response.statusCode).toBe(200);
    }

    const eventually = bodyOf<AnswerBody>(await answer(reader, CORRECT_OPTION));
    expect(eventually.correct).toBe(true);
    expect(eventually.progress.attemptCount).toBe(13);
    expect(eventually.payoffUnlocked).toBe(true);
  });

  it('resumes where the reader left off', async () => {
    const reader = await createReader();
    await answer(reader, WRONG_OPTION);
    await answer(reader, CORRECT_OPTION);

    // Re-entering the Leaf is a `start` call; it must not reset anything.
    const restarted = bodyOf<ProgressBody>(
      await app().inject({
        method: 'POST',
        url: '/progress/leaves/10/start',
        headers: auth(reader.token),
      }),
    );

    expect(restarted.progress.attemptCount).toBe(2);
    expect(restarted.progress.correctAt).not.toBeNull();
  });

  it('reports a zero state for a Leaf never opened', async () => {
    const reader = await createReader();

    const response = await readProgress(reader);

    expect(response.statusCode).toBe(200);
    expect(bodyOf<ProgressBody>(response).progress.attemptCount).toBe(0);
  });

  it('404s progress for a Leaf that does not exist', async () => {
    const reader = await createReader();

    const response = await readProgress(reader, 9999);

    expect(response.statusCode).toBe(404);
  });
});

/* -------------------------------------------------------------------------- */
/* The payoff is unobtainable before a correct answer                          */
/* -------------------------------------------------------------------------- */

describe('the payoff gate', () => {
  it('withholds the payoff from the Leaf endpoint before a correct answer', async () => {
    const reader = await createReader();

    const response = await readLeaf(reader);

    expect(response.statusCode).toBe(200);
    expect(bodyOf<LeafBody>(response).payoffUnlocked).toBe(false);
    expect(response.body).not.toContain(PAYOFF_PROSE);
  });

  it('still withholds it after wrong answers', async () => {
    const reader = await createReader();
    await answer(reader, WRONG_OPTION);
    await answer(reader, OTHER_WRONG_OPTION);

    const response = await readLeaf(reader);

    expect(response.body).not.toContain(PAYOFF_PROSE);
  });

  it('leaks no payoff prose from any route a locked reader can reach', async () => {
    // The acceptance criterion is "unobtainable by any route", so this walks every
    // endpoint that touches a Leaf rather than trusting the one obvious path.
    const reader = await createReader();
    await answer(reader, WRONG_OPTION);

    const responses = await Promise.all([
      readLeaf(reader),
      readProgress(reader),
      answer(reader, OTHER_WRONG_OPTION),
      app().inject({ method: 'GET', url: '/content/tracks/1/leaves', headers: auth(reader.token) }),
      app().inject({ method: 'GET', url: '/content/tracks/1', headers: auth(reader.token) }),
      app().inject({ method: 'GET', url: '/library', headers: auth(reader.token) }),
    ]);

    for (const response of responses) {
      expect(response.body).not.toContain(PAYOFF_PROSE);
    }
  });

  it('releases the payoff on the Leaf endpoint once earned', async () => {
    const reader = await createReader();
    await answer(reader, CORRECT_OPTION);

    const response = await readLeaf(reader);

    expect(bodyOf<LeafBody>(response).payoffUnlocked).toBe(true);
    expect(bodyOf<LeafBody>(response).payoff?.body).toBe(PAYOFF_PROSE);
  });

  it('keeps the payoff unlocked after a subsequent wrong answer', async () => {
    const reader = await createReader();
    await answer(reader, CORRECT_OPTION);
    await answer(reader, WRONG_OPTION);

    const response = await readLeaf(reader);

    expect(bodyOf<LeafBody>(response).payoffUnlocked).toBe(true);
  });

  it('unlocks per reader, not per Leaf', async () => {
    // One reader answering must not open the payoff for everybody else.
    const solver = await createReader();
    const bystander = await createReader();
    await answer(solver, CORRECT_OPTION);

    const response = await readLeaf(bystander);

    expect(bodyOf<LeafBody>(response).payoffUnlocked).toBe(false);
    expect(response.body).not.toContain(PAYOFF_PROSE);
  });

  it('does not unlock one Leaf by answering another', async () => {
    const reader = await createReader();
    await answer(reader, CORRECT_OPTION, 10);

    const response = await readLeaf(reader, 11);

    expect(bodyOf<LeafBody>(response).payoffUnlocked).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The answer key never leaves the server                                      */
/* -------------------------------------------------------------------------- */

describe('the answer key', () => {
  it('appears in no response body on any progress or content route', async () => {
    // Asserted on the serialised bytes that actually leave the process, not on an
    // object shape a serialiser could still betray.
    const reader = await createReader();

    const responses = await Promise.all([
      readLeaf(reader),
      readProgress(reader),
      app().inject({
        method: 'POST',
        url: '/progress/leaves/10/start',
        headers: auth(reader.token),
      }),
      answer(reader, WRONG_OPTION),
      answer(reader, CORRECT_OPTION),
      app().inject({ method: 'GET', url: '/content/tracks/1/leaves', headers: auth(reader.token) }),
    ]);

    for (const response of responses) {
      expect(response.body).not.toContain('isCorrect');
    }
  });

  it('is not accepted from the client either', async () => {
    // A body claiming its own correctness is a confused client or a probe; either way
    // it is rejected rather than quietly ignored.
    const reader = await createReader();

    const response = await app().inject({
      method: 'POST',
      url: '/progress/leaves/10/answer',
      headers: auth(reader.token),
      payload: { optionId: WRONG_OPTION, isCorrect: true },
    });

    expect(response.statusCode).toBe(400);
  });
});

/* -------------------------------------------------------------------------- */
/* A broken request is not a wrong answer                                      */
/* -------------------------------------------------------------------------- */

describe('unrecognised option ids', () => {
  it('400s an option id that exists on a different Leaf', async () => {
    const reader = await createReader();

    const response = await answer(reader, OTHER_LEAF_OPTION, 10);

    expect(response.statusCode).toBe(400);
    expect(bodyOf<{ error: { code: string } }>(response).error.code).toBe(
      'UNKNOWN_SCENARIO_OPTION',
    );
  });

  it('400s an option id that exists nowhere', async () => {
    const reader = await createReader();

    const response = await answer(reader, 'not-an-option');

    expect(response.statusCode).toBe(400);
  });

  it('records no attempt for an unrecognised option', async () => {
    // The observable difference between a client bug and a struggling reader.
    const reader = await createReader();

    await answer(reader, OTHER_LEAF_OPTION, 10);

    expect(bodyOf<ProgressBody>(await readProgress(reader)).progress.attemptCount).toBe(0);
  });

  it('400s a request with no option id at all', async () => {
    const reader = await createReader();

    const response = await app().inject({
      method: 'POST',
      url: '/progress/leaves/10/answer',
      headers: auth(reader.token),
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});

/* -------------------------------------------------------------------------- */
/* XP is awarded exactly once                                                  */
/* -------------------------------------------------------------------------- */

describe('completion', () => {
  it('refuses to complete a Leaf that was never answered correctly', async () => {
    const reader = await createReader();
    await answer(reader, WRONG_OPTION);

    const response = await complete(reader);

    expect(response.statusCode).toBe(409);
    expect(bodyOf<{ error: { code: string } }>(response).error.code).toBe('LEAF_NOT_UNLOCKED');
  });

  it('awards no XP for a refused completion', async () => {
    const reader = await createReader();
    await answer(reader, WRONG_OPTION);
    await complete(reader);

    expect(bodyOf<ProgressBody>(await readProgress(reader)).progress.xpAwarded).toBe(0);
  });

  it('does not award XP twice when the completion call is replayed', async () => {
    // The exploit a client triggers by accident, retrying a request whose response it
    // never saw. The guard is the conditional UPDATE, so this has to run against
    // real Postgres to mean anything.
    const reader = await createReader();
    await answer(reader, CORRECT_OPTION);

    const first = bodyOf<CompletionBody>(await complete(reader));
    const second = bodyOf<CompletionBody>(await complete(reader));
    const third = bodyOf<CompletionBody>(await complete(reader));

    expect(first.xpAwarded).toBe(XP_FIRST_TRY);
    expect(second.xpAwarded).toBe(0);
    expect(third.xpAwarded).toBe(0);
    expect(second.alreadyCompleted).toBe(true);
    expect(bodyOf<ProgressBody>(await readProgress(reader)).progress.xpAwarded).toBe(XP_FIRST_TRY);
  });

  it('awards once even when completions arrive concurrently', async () => {
    // The version a check-then-write in the service would fail: both requests pass the
    // check before either writes.
    const reader = await createReader();
    await answer(reader, CORRECT_OPTION);

    const outcomes = await Promise.all([complete(reader), complete(reader), complete(reader)]);
    const awarded = outcomes
      .map((response) => bodyOf<CompletionBody>(response).xpAwarded)
      .reduce((total, xp) => total + xp, 0);

    expect(awarded).toBe(XP_FIRST_TRY);
    expect(bodyOf<ProgressBody>(await readProgress(reader)).progress.xpAwarded).toBe(XP_FIRST_TRY);
  });

  it('keeps the completion timestamp from the first call', async () => {
    const reader = await createReader();
    await answer(reader, CORRECT_OPTION);

    const first = bodyOf<CompletionBody>(await complete(reader));
    const replay = bodyOf<CompletionBody>(await complete(reader));

    expect(replay.progress.completedAt).toBe(first.progress.completedAt);
  });

  it('files the completion under the reader’s local date', async () => {
    // WP5 groups streaks and the daily cap by this column. A reader in Auckland
    // completing a Leaf late in the evening belongs to their tomorrow, not UTC's today.
    const reader = await createReader('Pacific/Auckland');
    await answer(reader, CORRECT_OPTION);
    await complete(reader);

    const stored = await harness.database.pool.query<{ completed_local_date: string }>(
      `select to_char(completed_local_date, 'YYYY-MM-DD') as completed_local_date
       from leaf_progress where user_id = $1`,
      [reader.userId],
    );
    const expected = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    expect(stored.rows[0]?.completed_local_date).toBe(expected);
  });
});

/* -------------------------------------------------------------------------- */
/* Progress is per reader                                                      */
/* -------------------------------------------------------------------------- */

describe('reader isolation', () => {
  it('does not let one reader’s answers advance another’s progress', async () => {
    const alice = await createReader();
    const bob = await createReader();

    await answer(alice, WRONG_OPTION);
    await answer(alice, CORRECT_OPTION);

    expect(bodyOf<ProgressBody>(await readProgress(bob)).progress.attemptCount).toBe(0);
    expect(bodyOf<ProgressBody>(await readProgress(bob)).progress.correctAt).toBeNull();
  });

  it('does not let one reader’s completion award another reader XP', async () => {
    const alice = await createReader();
    const bob = await createReader();

    await answer(alice, CORRECT_OPTION);
    await complete(alice);

    expect(bodyOf<ProgressBody>(await readProgress(bob)).progress.xpAwarded).toBe(0);
  });

  it('keeps each reader’s first-try bonus their own', async () => {
    // Checked in both directions: Bob's slower route must not cost Alice her bonus.
    const alice = await createReader();
    const bob = await createReader();

    await answer(alice, CORRECT_OPTION);
    await answer(bob, WRONG_OPTION);
    await answer(bob, CORRECT_OPTION);

    const alicesXp = bodyOf<CompletionBody>(await complete(alice)).xpAwarded;
    const bobsXp = bodyOf<CompletionBody>(await complete(bob)).xpAwarded;

    expect(alicesXp).toBe(XP_FIRST_TRY);
    expect(bobsXp).toBe(XP_BASE);
  });
});

/* -------------------------------------------------------------------------- */
/* XP is configuration                                                         */
/* -------------------------------------------------------------------------- */

describe('XP tuning', () => {
  it('moves with configuration alone', async () => {
    // The numbers are placeholder economics until the loop is playable. Tuning them
    // must be an environment change and a restart, not a code change and a deploy.
    const tuned = await buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: {
        CONTENT_API_URL: payload.apiUrl,
        CONTENT_CACHE_TTL_SECONDS: '0',
        AUTH_RATE_LIMIT_MAX: '1000',
        XP_LEAF_COMPLETION: '7',
        XP_FIRST_TRY_BONUS: '3',
      },
    });

    try {
      const signup = await tuned.app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          email: `tuned-${String(Math.random()).slice(2)}@example.test`,
          password: 'a-sufficiently-long-password',
          displayName: 'Tuned Reader',
          dateOfBirth: '1994-03-17',
          timezone: 'Europe/London',
        },
      });
      const { accessToken } = bodyOf<{ accessToken: string }>(signup);

      await tuned.app.inject({
        method: 'POST',
        url: '/progress/leaves/10/answer',
        headers: auth(accessToken),
        payload: { optionId: CORRECT_OPTION },
      });
      const completed = await tuned.app.inject({
        method: 'POST',
        url: '/progress/leaves/10/complete',
        headers: auth(accessToken),
      });

      expect(bodyOf<CompletionBody>(completed).xpAwarded).toBe(10);
    } finally {
      await tuned.close();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Content the reader cannot see is not gradeable                              */
/* -------------------------------------------------------------------------- */

describe('withdrawn content', () => {
  it('404s an answer submitted against an unpublished Leaf', async () => {
    // Takedown has to reach the loop too, not just Explore: a Leaf pulled for a legal
    // complaint must stop being answerable, not merely stop being listed.
    const reader = await createReader();
    payload.setPublished('leaf', 10, false);

    const response = await answer(reader, CORRECT_OPTION);

    expect(response.statusCode).toBe(404);
  });

  it('404s completion of an unpublished Leaf', async () => {
    const reader = await createReader();
    await answer(reader, CORRECT_OPTION);
    payload.setPublished('leaf', 10, false);

    const response = await complete(reader);

    expect(response.statusCode).toBe(404);
  });
});

/* -------------------------------------------------------------------------- */
/* The per-Track rollup, and what it closes                                    */
/* -------------------------------------------------------------------------- */

interface LibraryBody {
  entries: {
    track: { id: string };
    status: string;
    progress: {
      trackId: string;
      totalLeaves: number;
      completedLeaves: number;
      nextLeafId: string | null;
      isComplete: boolean;
    };
  }[];
}

const library = (reader: Reader) =>
  app().inject({ method: 'GET', url: '/library', headers: auth(reader.token) });

/** Answers correctly and completes one Leaf. */
async function finishLeaf(reader: Reader, leafId: number, optionId: string): Promise<void> {
  await answer(reader, optionId, leafId);
  await complete(reader, leafId);
}

describe('per-Track progress in the library', () => {
  it('reports zero of two for a Track the reader has not started', async () => {
    // Track 1 has two visible Leaves in this fixture, 10 and 11.
    const reader = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(reader.token) });

    const [entry] = bodyOf<LibraryBody>(await library(reader)).entries;

    expect(entry?.progress).toMatchObject({
      trackId: '1',
      totalLeaves: 2,
      completedLeaves: 0,
      isComplete: false,
    });
  });

  it('points resume at the first Leaf before anything is done', async () => {
    const reader = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(reader.token) });

    const [entry] = bodyOf<LibraryBody>(await library(reader)).entries;

    // Asserted on the id, not on "some Leaf was chosen" — the criterion is that resume
    // lands on the right one.
    expect(entry?.progress.nextLeafId).toBe('10');
  });

  it('advances resume past a finished Leaf', async () => {
    const reader = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(reader.token) });
    await finishLeaf(reader, 10, CORRECT_OPTION);

    const [entry] = bodyOf<LibraryBody>(await library(reader)).entries;

    expect(entry?.progress).toMatchObject({
      completedLeaves: 1,
      nextLeafId: '11',
      isComplete: false,
    });
  });

  it('is computed per reader', async () => {
    const alice = await createReader();
    const bob = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(alice.token) });
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(bob.token) });

    await finishLeaf(alice, 10, CORRECT_OPTION);

    const [bobs] = bodyOf<LibraryBody>(await library(bob)).entries;
    expect(bobs?.progress.completedLeaves).toBe(0);
    expect(bobs?.progress.nextLeafId).toBe('10');
  });

  it('stops counting a Leaf that has been taken down', async () => {
    // The denominator has to follow takedown, or a reader is stuck at "1 of 2" on a
    // Track that now has one Leaf and is actually finished.
    const reader = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(reader.token) });
    await finishLeaf(reader, 10, CORRECT_OPTION);

    payload.setPublished('leaf', 11, false);

    const [entry] = bodyOf<LibraryBody>(await library(reader)).entries;
    expect(entry?.progress).toMatchObject({
      totalLeaves: 1,
      completedLeaves: 1,
      isComplete: true,
      nextLeafId: null,
    });
  });
});

describe('user_tracks.status', () => {
  it('starts active', async () => {
    const reader = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(reader.token) });

    const [entry] = bodyOf<LibraryBody>(await library(reader)).entries;
    expect(entry?.status).toBe('active');
  });

  it('stays active while any Leaf is unfinished', async () => {
    const reader = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(reader.token) });
    await finishLeaf(reader, 10, CORRECT_OPTION);

    const [entry] = bodyOf<LibraryBody>(await library(reader)).entries;
    expect(entry?.status).toBe('active');
  });

  it('transitions to completed when every Leaf is complete', async () => {
    // The column has read `active` for every row since WP3, because nothing owned the
    // Leaf-count rollup needed to decide otherwise. This is that closing.
    const reader = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(reader.token) });

    await finishLeaf(reader, 10, CORRECT_OPTION);
    await finishLeaf(reader, 11, OTHER_LEAF_OPTION);

    const [entry] = bodyOf<LibraryBody>(await library(reader)).entries;
    expect(entry?.status).toBe('completed');
    expect(entry?.progress.isComplete).toBe(true);
  });

  it('writes the transition to the database, not just the response', async () => {
    const reader = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(reader.token) });

    await finishLeaf(reader, 10, CORRECT_OPTION);
    await finishLeaf(reader, 11, OTHER_LEAF_OPTION);

    const stored = await harness.database.pool.query<{ status: string }>(
      `select status from user_tracks where user_id = $1 and track_id = '1'`,
      [reader.userId],
    );

    expect(stored.rows[0]?.status).toBe('completed');
  });

  it('completes a Track the reader never added, without erroring', async () => {
    /**
     * Adding to the library is optional; finishing a Track is not conditional on it.
     * There is simply no row to update, which must not fail the completion.
     *
     * The first version of this never answered Leaf 11, so `complete()` hit
     * `LeafNotUnlockedError` and `expect([200, 409]).toContain(...)` accepted the 409 —
     * the scenario in the title was never exercised. An assertion that accepts two
     * outcomes asserts nothing.
     */
    const reader = await createReader();

    await finishLeaf(reader, 10, CORRECT_OPTION);
    await answer(reader, OTHER_LEAF_OPTION, 11);
    const response = await complete(reader, 11);

    expect(response.statusCode).toBe(200);
    expect(bodyOf<CompletionBody>(response).progress.completedAt).not.toBeNull();

    // Every Leaf of Track 1 is now done, and there is still no library row to promote.
    await expect(
      harness.database.pool.query(`select 1 from user_tracks where user_id = $1`, [reader.userId]),
    ).resolves.toMatchObject({ rowCount: 0 });
  });

  it('promotes a Track added only after every Leaf was finished', async () => {
    /**
     * The first of the two paths that left `status` stuck at `active`.
     *
     * A reader can finish a book and add it afterwards. The rollup used to run only on
     * the call that awarded the XP, so by the time the row existed nothing ever
     * re-evaluated it. A replayed completion now re-checks, which makes it self-healing.
     */
    const reader = await createReader();

    await finishLeaf(reader, 10, CORRECT_OPTION);
    await finishLeaf(reader, 11, OTHER_LEAF_OPTION);

    // Added late — after the last Leaf was already complete.
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(reader.token) });
    expect(bodyOf<LibraryBody>(await library(reader)).entries[0]?.status).toBe('active');

    // Replaying the final completion is what heals it.
    const replay = await complete(reader, 11);
    expect(replay.statusCode).toBe(200);

    expect(bodyOf<LibraryBody>(await library(reader)).entries[0]?.status).toBe('completed');
  });

  it('leaves an archived Track archived', async () => {
    // `ne(status, 'completed')` matched everything except the target, so finishing a
    // Leaf would have resurrected an archived Track. Archiving is the reader's decision.
    const reader = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(reader.token) });

    await harness.database.pool.query(
      `update user_tracks set status = 'archived' where user_id = $1`,
      [reader.userId],
    );

    await finishLeaf(reader, 10, CORRECT_OPTION);
    await finishLeaf(reader, 11, OTHER_LEAF_OPTION);

    const stored = await harness.database.pool.query<{ status: string }>(
      `select status from user_tracks where user_id = $1`,
      [reader.userId],
    );
    expect(stored.rows[0]?.status).toBe('archived');
  });
});

/* -------------------------------------------------------------------------- */
/* Takedown cascades to every endpoint that serves a Leaf                      */
/* -------------------------------------------------------------------------- */

describe('when a Track is taken down', () => {
  /**
   * The scenario is a legal complaint answered the way it actually would be: unpublish
   * the **Track**. The Leaves are left exactly as they were, published and valid.
   *
   * Before the cascade this cleared Explore, the library and resume, while
   * `GET /content/leaves/:id` went on serving the full Leaf and the progress endpoints
   * went on grading it and paying XP for it.
   */
  const takeDownTrack = (): void => {
    payload.setPublished('track', 1, false);
  };

  it('stops the Leaf endpoint serving its content', async () => {
    const reader = await createReader();
    expect((await readLeaf(reader)).statusCode).toBe(200);

    takeDownTrack();

    const response = await readLeaf(reader);
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain(PAYOFF_PROSE);
  });

  it('stops the Leaf endpoint even for a reader who already unlocked the payoff', async () => {
    // Having earned it is not a licence to keep reading content that has been pulled.
    const reader = await createReader();
    await answer(reader, CORRECT_OPTION);
    expect((await readLeaf(reader)).body).toContain(PAYOFF_PROSE);

    takeDownTrack();

    const response = await readLeaf(reader);
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain(PAYOFF_PROSE);
  });

  it('stops grading answers', async () => {
    const reader = await createReader();
    takeDownTrack();

    expect((await answer(reader, CORRECT_OPTION)).statusCode).toBe(404);
  });

  it('pays no XP for a Leaf in a taken-down Track', async () => {
    // The money path: grading it also completes it and awards XP.
    const reader = await createReader();
    await answer(reader, CORRECT_OPTION);
    takeDownTrack();

    expect((await complete(reader)).statusCode).toBe(404);

    const stored = await harness.database.pool.query<{ xp_awarded: number }>(
      `select xp_awarded from leaf_progress where user_id = $1`,
      [reader.userId],
    );
    expect(stored.rows[0]?.xp_awarded).toBe(0);
  });

  it('stops starting and reporting progress', async () => {
    const reader = await createReader();
    takeDownTrack();

    expect(
      (
        await app().inject({
          method: 'POST',
          url: '/progress/leaves/10/start',
          headers: auth(reader.token),
        })
      ).statusCode,
    ).toBe(404);
    expect((await readProgress(reader)).statusCode).toBe(404);
  });

  it('does not reveal that the Track is the reason', async () => {
    // A reader who asked for a Leaf is not entitled to learn about its parent.
    const reader = await createReader();
    takeDownTrack();

    const response = await readLeaf(reader);
    expect(response.body).not.toContain('Track');
  });
});

/* -------------------------------------------------------------------------- */
/* WP5a — the daily cap                                                        */
/* -------------------------------------------------------------------------- */

interface DayBody {
  session: {
    localDate: string;
    secondsActive: number;
    xpEarned: number;
    capReached: boolean;
    capSeconds: number;
    capXp: number;
  };
  streak: { current: number; longest: number; lastActiveLocalDate: string | null };
}

const readDay = (reader: Reader) =>
  app().inject({ method: 'GET', url: '/progress/today', headers: auth(reader.token) });

/** A reader on a tuned app, so the cap can be reached without seeding seven Leaves. */
async function tunedReader(
  tuned: TestApp,
  timezone = 'Europe/London',
): Promise<Reader> {
  const signup = await tuned.app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: {
      email: `cap-${String(Math.random()).slice(2)}@example.test`,
      password: 'a-sufficiently-long-password',
      displayName: 'Capped Reader',
      dateOfBirth: '1994-03-17',
      timezone,
    },
  });
  const body = bodyOf<{ userId: string; accessToken: string }>(signup);
  return { userId: body.userId, token: body.accessToken };
}

async function finishOn(tuned: TestApp, reader: Reader, leafId: number, optionId: string) {
  await tuned.app.inject({
    method: 'POST',
    url: `/progress/leaves/${String(leafId)}/answer`,
    headers: auth(reader.token),
    payload: { optionId },
  });

  return tuned.app.inject({
    method: 'POST',
    url: `/progress/leaves/${String(leafId)}/complete`,
    headers: auth(reader.token),
  });
}

describe('the daily cap', () => {
  it('fires on XP, with XP as the binding constraint', async () => {
    /**
     * The two thresholds are tested separately and each as the *only* one that could
     * have fired: here the time cap is set far out of reach, so a pass cannot be the
     * clock's doing. Testing them together would let one cover for the other.
     */
    const tuned = await buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: {
        CONTENT_API_URL: payload.apiUrl,
        CONTENT_CACHE_TTL_SECONDS: '0',
        AUTH_RATE_LIMIT_MAX: '1000',
        SESSION_CAP_XP: '100',
        SESSION_CAP_SECONDS: '86400',
      },
    });

    try {
      const reader = await tunedReader(tuned);

      // One first-try Leaf is 80 + 20 = exactly the cap.
      const first = bodyOf<CompletionBody & { session: DayBody['session'] }>(
        await finishOn(tuned, reader, 10, CORRECT_OPTION),
      );
      expect(first.xpAwarded).toBe(100);
      expect(first.session.capReached).toBe(true);
      expect(first.session.xpEarned).toBe(100);

      // The next Leaf still completes — it simply earns nothing.
      const second = bodyOf<CompletionBody & { session: DayBody['session'] }>(
        await finishOn(tuned, reader, 11, OTHER_LEAF_OPTION),
      );
      expect(second.xpAwarded).toBe(0);
      expect(second.alreadyCompleted).toBe(false);
      expect(second.progress.completedAt).not.toBeNull();
    } finally {
      await tuned.close();
    }
  });

  it('fires on elapsed time, with time as the binding constraint', async () => {
    // XP set out of reach, so only the clock can trip this.
    const tuned = await buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: {
        CONTENT_API_URL: payload.apiUrl,
        CONTENT_CACHE_TTL_SECONDS: '0',
        AUTH_RATE_LIMIT_MAX: '1000',
        SESSION_CAP_XP: '1000000',
        SESSION_CAP_SECONDS: '60',
        SESSION_MAX_LEAF_SECONDS: '300',
      },
    });

    try {
      const reader = await tunedReader(tuned);

      await tuned.app.inject({
        method: 'POST',
        url: '/progress/leaves/10/answer',
        headers: auth(reader.token),
        payload: { optionId: CORRECT_OPTION },
      });

      // Backdate the open Leaf so the elapsed time is real rather than simulated: the
      // service measures `completed_at - started_at`, and this is that subtraction.
      await tuned.database.pool.query(
        `update leaf_progress set started_at = now() - interval '120 seconds' where user_id = $1`,
        [reader.userId],
      );

      const completed = bodyOf<CompletionBody & { session: DayBody['session'] }>(
        await tuned.app.inject({
          method: 'POST',
          url: '/progress/leaves/10/complete',
          headers: auth(reader.token),
        }),
      );

      expect(completed.session.capReached).toBe(true);
      expect(completed.session.secondsActive).toBeGreaterThanOrEqual(60);
      // Still paid for the Leaf that crossed the line — see below.
      expect(completed.xpAwarded).toBe(100);
    } finally {
      await tuned.close();
    }
  });

  it('lets a Leaf already in progress finish, and pays for it', async () => {
    /**
     * The wellbeing rule: the cap does not interrupt. A reader who was under the cap
     * when they opened a Leaf is paid in full for it even though finishing crossed the
     * line — discarding work already done would be the cruel reading. The *next* Leaf
     * is the one that earns nothing, which the XP test above asserts.
     */
    const tuned = await buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: {
        CONTENT_API_URL: payload.apiUrl,
        CONTENT_CACHE_TTL_SECONDS: '0',
        AUTH_RATE_LIMIT_MAX: '1000',
        SESSION_CAP_XP: '10',
      },
    });

    try {
      const reader = await tunedReader(tuned);
      const completed = bodyOf<CompletionBody & { session: DayBody['session'] }>(
        await finishOn(tuned, reader, 10, CORRECT_OPTION),
      );

      expect(completed.progress.completedAt).not.toBeNull();
      expect(completed.xpAwarded).toBe(100);
      expect(completed.session.capReached).toBe(true);
    } finally {
      await tuned.close();
    }
  });

  it('reports the thresholds so the client never hardcodes them', async () => {
    const reader = await createReader();
    const day = bodyOf<DayBody>(await readDay(reader));

    expect(day.session.capXp).toBe(500);
    expect(day.session.capSeconds).toBe(900);
    expect(day.session.capReached).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* WP5a — daily_session and streak are upsert-shaped                           */
/* -------------------------------------------------------------------------- */

describe('daily_session accumulates rather than overwriting', () => {
  it('takes the INSERT branch on the first completion of a day', async () => {
    // Named deliberately: this is the branch that passes even when `ON CONFLICT` is
    // broken, which is exactly how the WP4 first-try bug survived its test.
    const reader = await createReader();
    await finishLeaf(reader, 10, CORRECT_OPTION);

    const rows = await harness.database.pool.query<{ xp_earned: number; n: string }>(
      `select xp_earned, count(*) over () as n from daily_session where user_id = $1`,
      [reader.userId],
    );

    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.xp_earned).toBe(100);
  });

  it('takes the ON CONFLICT branch on the second completion of the same day', async () => {
    const reader = await createReader();
    await finishLeaf(reader, 10, CORRECT_OPTION);
    await finishLeaf(reader, 11, OTHER_LEAF_OPTION);

    const rows = await harness.database.pool.query<{ xp_earned: number }>(
      `select xp_earned from daily_session where user_id = $1`,
      [reader.userId],
    );

    // One row, and the totals added. A broken conflict clause either raises a duplicate
    // key error or leaves this at 100.
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.xp_earned).toBe(200);
  });
});

describe('the streak', () => {
  it('takes the INSERT branch on a reader’s very first completion', async () => {
    const reader = await createReader();
    await finishLeaf(reader, 10, CORRECT_OPTION);

    const day = bodyOf<DayBody>(await readDay(reader));
    expect(day.streak.current).toBe(1);
    expect(day.streak.longest).toBe(1);
  });

  it('takes the ON CONFLICT branch on a second completion the same day, without double counting', async () => {
    const reader = await createReader();
    await finishLeaf(reader, 10, CORRECT_OPTION);
    await finishLeaf(reader, 11, OTHER_LEAF_OPTION);

    const day = bodyOf<DayBody>(await readDay(reader));

    // Two completions, one day. The conflict branch must recognise "same day" and leave
    // the count alone — incrementing here would inflate every active reader's streak.
    expect(day.streak.current).toBe(1);
  });

  it('continues when yesterday was active', async () => {
    const reader = await createReader();
    await finishLeaf(reader, 10, CORRECT_OPTION);

    // Move the stored day back one, which is what "yesterday" means to the SQL.
    await harness.database.pool.query(
      `update streak set last_active_local_date = last_active_local_date - 1 where user_id = $1`,
      [reader.userId],
    );

    await finishLeaf(reader, 11, OTHER_LEAF_OPTION);

    const day = bodyOf<DayBody>(await readDay(reader));
    expect(day.streak.current).toBe(2);
    expect(day.streak.longest).toBe(2);
  });

  it('breaks after a day with no completion, and keeps the longest', async () => {
    const reader = await createReader();
    await finishLeaf(reader, 10, CORRECT_OPTION);

    await harness.database.pool.query(
      `update streak set current = 9, longest = 9,
         last_active_local_date = last_active_local_date - 3 where user_id = $1`,
      [reader.userId],
    );

    await finishLeaf(reader, 11, OTHER_LEAF_OPTION);

    const day = bodyOf<DayBody>(await readDay(reader));
    expect(day.streak.current).toBe(1);
    // A restart must not erase the record.
    expect(day.streak.longest).toBe(9);
  });
});

/* -------------------------------------------------------------------------- */
/* WP5a — the day boundary is the reader's, not UTC's                          */
/* -------------------------------------------------------------------------- */

describe('local midnight, not UTC midnight', () => {
  /**
   * Only `Date` is faked. Faking timers wholesale would stall the connection pool and
   * the HTTP injection, and none of what is under test depends on a timer — it depends
   * on what `new Date()` says when the service asks.
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * A tuned app with a long-lived access token.
   *
   * Advancing the clock across a day boundary also advances it past the fifteen-minute
   * token expiry, so the second request comes back 401 and the test fails for a reason
   * that has nothing to do with dates. Widening the TTL isolates what is under test
   * rather than working around it — the token lifetime is not the subject here.
   */
  async function dayCrossingApp(): Promise<TestApp> {
    return buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: {
        CONTENT_API_URL: payload.apiUrl,
        CONTENT_CACHE_TTL_SECONDS: '0',
        AUTH_RATE_LIMIT_MAX: '1000',
        // A week. The DST test spans exactly 24 hours, so a one-day TTL expires on the
        // boundary itself and the failure looks like a date bug.
        AUTH_ACCESS_TOKEN_TTL_SECONDS: '604800',
      },
    });
  }

  it('starts a new day at the reader’s midnight while UTC is still yesterday', async () => {
    /**
     * Auckland is UTC+13 in February. At 10:00 UTC it is 23:00 the same day there; at
     * 12:00 UTC it is 01:00 the *next* day. Both instants share a UTC date, so a server
     * grouping by UTC would file them under one day — the reader would lose a day of
     * streak and gain a second day's worth of cap.
     */
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-10T10:00:00.000Z'));

    const tuned = await dayCrossingApp();

    try {
      const reader = await tunedReader(tuned, 'Pacific/Auckland');
      await finishOn(tuned, reader, 10, CORRECT_OPTION);

      vi.setSystemTime(new Date('2026-02-10T12:00:00.000Z'));
      await finishOn(tuned, reader, 11, OTHER_LEAF_OPTION);

      const rows = await tuned.database.pool.query<{ local_date: string }>(
        `select to_char(local_date, 'YYYY-MM-DD') as local_date
           from daily_session where user_id = $1 order by local_date`,
        [reader.userId],
      );

      // Two rows, two consecutive local dates, from one UTC date.
      expect(rows.rows.map((r) => r.local_date)).toEqual(['2026-02-10', '2026-02-11']);

      const day = bodyOf<DayBody>(
        await tuned.app.inject({
          method: 'GET',
          url: '/progress/today',
          headers: auth(reader.token),
        }),
      );

      expect(day.streak.current).toBe(2);
      // A fresh day means a fresh cap: yesterday's XP is not carried across.
      expect(day.session.xpEarned).toBe(100);
    } finally {
      vi.useRealTimers();
      await tuned.close();
    }
  });

  it('treats a DST day as one day, not twenty-five hours', async () => {
    /**
     * London springs forward at 01:00 UTC on 2026-03-29, so that local day is 23 hours
     * long. A streak computed by subtracting 86,400 seconds from a timestamp gets the
     * previous day wrong across this boundary and breaks the streak of every reader in
     * the zone. Postgres `date - 1` is calendar arithmetic and does not.
     */
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-28T12:00:00.000Z'));

    const tuned = await dayCrossingApp();

    try {
      const reader = await tunedReader(tuned, 'Europe/London');
      await finishOn(tuned, reader, 10, CORRECT_OPTION);

      // The next local day, on the far side of the shift.
      vi.setSystemTime(new Date('2026-03-29T12:00:00.000Z'));
      await finishOn(tuned, reader, 11, OTHER_LEAF_OPTION);

      const day = bodyOf<DayBody>(
        await tuned.app.inject({
          method: 'GET',
          url: '/progress/today',
          headers: auth(reader.token),
        }),
      );

      expect(day.streak.current).toBe(2);
      expect(day.session.localDate).toBe('2026-03-29');
    } finally {
      vi.useRealTimers();
      await tuned.close();
    }
  });
});
