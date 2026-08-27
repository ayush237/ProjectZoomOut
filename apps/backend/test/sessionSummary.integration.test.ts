import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Leaf as CmsLeaf, Track as CmsTrack } from '@zoomout/shared/cms';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from '../src/db/migrate.js';
import { FakePayload } from './helpers/fakePayload.js';
import { buildTestApp, type TestApp } from './helpers/buildTestApp.js';

/**
 * The wrap-up summary (WP9), end to end.
 *
 * Two things here are Tier A and the rest is one happy path.
 *
 *  1. **The summary is the reader's local day.** It is assembled from
 *     `completed_local_date`, and a server that grouped by its own date would show a
 *     reader in Auckland yesterday's work under today — on the one screen built to be
 *     shown to other people.
 *  2. **Wrapping up must not lock anyone out.** The handoff rules it a ceremony rather
 *     than a gate, and the failure mode is invisible until a reader taps a celebratory
 *     button and finds the app has stopped paying them.
 *
 * Real Postgres, because both guarantees are written in SQL.
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
  bookTitle: 'The Placeholder Book',
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

const FIRST_CORRECT = '6a7629ee570031ac25de62bf';
const SECOND_CORRECT = '7b8730ff681142bd36ef73d0';

const leafFor = (id: number, title: string, correct: string): CmsLeaf => ({
  id,
  trackId: 1,
  orderIndex: id - 10,
  title,
  summary: { body: 'Placeholder summary.' },
  scenario: {
    prompt: 'Placeholder prompt?',
    options: [
      { text: 'Right', isCorrect: true, id: correct },
      { text: 'Wrong', isCorrect: false, id: `${correct}a` },
      { text: 'Also wrong', isCorrect: false, id: `${correct}b` },
    ],
  },
  payoff: { body: 'The payoff.' },
  stickyNotes: {
    notes: [
      { note: 'Note one', id: 'n1' },
      { note: 'Note two', id: 'n2' },
    ],
  },
  takeaway: { body: 'Placeholder takeaway.' },
  // No Dinner Table Knowledge here, so a takeaway source reference is not required —
  // `leafSchema` only demands one when DTK is present. See the WP5b suite for the trap.
  sourceReferences: [
    { slideKey: 'summary', chapter: 'Chapter 1', page: null, quote: null, note: 'A note.', id: 's1' },
  ],
  isPlaceholder: true,
  createdAt: '2026-08-08T12:00:00.000Z',
  updatedAt: '2026-08-08T12:00:00.000Z',
  _status: 'published',
});

const FIRST_LEAF = leafFor(10, 'The first concept', FIRST_CORRECT);
const SECOND_LEAF = leafFor(11, 'The second concept', SECOND_CORRECT);

interface Reader {
  readonly userId: string;
  readonly token: string;
}

interface SummaryBody {
  readonly localDate: string;
  readonly leaves: readonly {
    leafId: string;
    title: string;
    trackTitle: string;
    xpAwarded: number;
    firstTryCorrect: boolean;
  }[];
  readonly xpEarned: number;
  readonly streak: { current: number };
  readonly achievements: readonly { id: string }[];
  readonly session: { capReached: boolean };
}

async function createReader(on: TestApp, timezone: string): Promise<Reader> {
  const response = await on.app.inject({
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

/** Answers correctly and completes, so the Leaf lands in the day's summary. */
async function finishOn(
  on: TestApp,
  reader: Reader,
  leafId: number,
  optionId: string,
): Promise<number> {
  await on.app.inject({
    method: 'POST',
    url: `/progress/leaves/${String(leafId)}/answer`,
    headers: { ...auth(reader.token), 'content-type': 'application/json' },
    payload: { optionId },
  });

  const completion = await on.app.inject({
    method: 'POST',
    url: `/progress/leaves/${String(leafId)}/complete`,
    headers: auth(reader.token),
  });

  return bodyOf<{ xpAwarded: number }>(completion).xpAwarded;
}

const summaryFor = (on: TestApp, reader: Reader) =>
  on.app.inject({ method: 'GET', url: '/progress/summary', headers: auth(reader.token) });

const wrapUp = (on: TestApp, reader: Reader) =>
  on.app.inject({
    method: 'POST',
    url: '/events',
    headers: { ...auth(reader.token), 'content-type': 'application/json' },
    payload: { type: 'session_wrap' },
  });

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
  payload.seedLeaf(FIRST_LEAF, { published: true });
  payload.seedLeaf(SECOND_LEAF, { published: true });
});

/* -------------------------------------------------------------------------- */
/* Tier B — one happy path                                                     */
/* -------------------------------------------------------------------------- */

describe('the session summary', () => {
  it('returns the day in one call: Leaves, book, XP, streak and achievements', async () => {
    const reader = await createReader(harness, 'Europe/London');

    await finishOn(harness, reader, 10, FIRST_CORRECT);

    const body = bodyOf<SummaryBody>(await summaryFor(harness, reader));

    // The whole point of the endpoint: a stranger reading the shared image needs the
    // book, not just a count.
    expect(body.leaves).toHaveLength(1);
    expect(body.leaves[0]?.title).toBe('The first concept');
    expect(body.leaves[0]?.trackTitle).toBe('The Placeholder Book');
    expect(body.leaves[0]?.firstTryCorrect).toBe(true);

    expect(body.xpEarned).toBe(100);
    expect(body.streak.current).toBe(1);
    expect(body.achievements.map((one) => one.id)).toEqual(
      expect.arrayContaining(['first-leaf', 'first-try-first']),
    );
    expect(body.session.capReached).toBe(false);
  });

  it('is empty, not an error, before the reader has done anything today', async () => {
    const reader = await createReader(harness, 'Europe/London');

    const response = await summaryFor(harness, reader);
    const body = bodyOf<SummaryBody>(response);

    expect(response.statusCode).toBe(200);
    expect(body.leaves).toEqual([]);
    expect(body.xpEarned).toBe(0);
    expect(body.achievements).toEqual([]);
  });

  it('rejects an unauthenticated request', async () => {
    const response = await app().inject({ method: 'GET', url: '/progress/summary' });

    expect(response.statusCode).toBe(401);
  });

  it('omits a Leaf whose Track has been withdrawn since it was read', async () => {
    /**
     * Takedown reaches the shareable image too. The reader still finished the Leaf, so
     * the rest of the day survives — but a withdrawn book must not reappear in something
     * built to be posted in public.
     */
    const reader = await createReader(harness, 'Europe/London');
    await finishOn(harness, reader, 10, FIRST_CORRECT);

    payload.setPublished('track', 1, false);

    const body = bodyOf<SummaryBody>(await summaryFor(harness, reader));

    expect(body.leaves).toEqual([]);
    // The day itself is intact: the XP was earned and is still reported.
    expect(body.xpEarned).toBe(100);
  });
});

/* -------------------------------------------------------------------------- */
/* Tier A — wrapping up is a ceremony, not a lock                              */
/* -------------------------------------------------------------------------- */

describe('wrapping up', () => {
  it('records the wrap and unlocks first-wrap', async () => {
    const reader = await createReader(harness, 'Europe/London');
    await finishOn(harness, reader, 10, FIRST_CORRECT);

    const unlocked = bodyOf<{ unlocked: { id: string }[] }>(await wrapUp(harness, reader)).unlocked;

    expect(unlocked.map((one) => one.id)).toContain('first-wrap');

    const rows = await harness.database.pool.query(
      `select count(*)::int as n from reader_events where user_id = $1 and type = 'session_wrap'`,
      [reader.userId],
    );
    expect(rows.rows[0]).toEqual({ n: 1 });
  });

  it('does NOT prevent completing another Leaf afterwards', async () => {
    /**
     * The ruling this package exists to honour: wrapping up is the ritual ending, and
     * the daily cap is the only hard stop. A reader who closes out their day and then
     * wants one more Leaf must still be paid for it — anything else punishes them for
     * tapping a celebratory button.
     */
    const reader = await createReader(harness, 'Europe/London');
    await finishOn(harness, reader, 10, FIRST_CORRECT);

    await wrapUp(harness, reader);

    const awarded = await finishOn(harness, reader, 11, SECOND_CORRECT);

    expect(awarded).toBe(100);

    const body = bodyOf<SummaryBody>(await summaryFor(harness, reader));
    expect(body.leaves).toHaveLength(2);
    expect(body.xpEarned).toBe(200);
  });

  it('can be done twice in a day, and the summary reflects the day so far', async () => {
    const reader = await createReader(harness, 'Europe/London');
    await finishOn(harness, reader, 10, FIRST_CORRECT);

    await wrapUp(harness, reader);
    const second = bodyOf<{ unlocked: { id: string }[] }>(await wrapUp(harness, reader)).unlocked;

    // The second wrap earns nothing — `first-wrap` is already held — but is not an error.
    expect(second.map((one) => one.id)).not.toContain('first-wrap');

    const rows = await harness.database.pool.query(
      `select count(*)::int as n from reader_events where user_id = $1 and type = 'session_wrap'`,
      [reader.userId],
    );
    expect(rows.rows[0]).toEqual({ n: 2 });
  });
});

/* -------------------------------------------------------------------------- */
/* Tier A — the reader's own day, not the server's                             */
/* -------------------------------------------------------------------------- */

describe('the local day', () => {
  /**
   * A long access-token TTL, for the reason WP5a recorded: advancing the clock across a
   * day boundary also advances it past the fifteen-minute expiry, and the resulting 401
   * reads exactly like a date bug.
   */
  async function dayCrossingApp(): Promise<TestApp> {
    return buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: {
        CONTENT_API_URL: payload.apiUrl,
        CONTENT_CACHE_TTL_SECONDS: '0',
        AUTH_RATE_LIMIT_MAX: '1000',
        AUTH_ACCESS_TOKEN_TTL_SECONDS: '604800',
      },
    });
  }

  it('gives an Auckland reader their own day while UTC is still yesterday', async () => {
    /**
     * Auckland is UTC+13 in February. 10:00 and 12:00 UTC on 2026-02-10 are 23:00 that
     * day and 01:00 the *next* day there. One UTC date, two local dates — so a summary
     * grouped by the server's date would show yesterday's Leaf on today's card.
     */
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-10T10:00:00.000Z'));

    const tuned = await dayCrossingApp();

    try {
      const reader = await createReader(tuned, 'Pacific/Auckland');
      await finishOn(tuned, reader, 10, FIRST_CORRECT);

      const yesterday = bodyOf<SummaryBody>(await summaryFor(tuned, reader));
      expect(yesterday.localDate).toBe('2026-02-10');
      expect(yesterday.leaves.map((leaf) => leaf.title)).toEqual(['The first concept']);

      // Two hours later in UTC — but a new day in Auckland.
      vi.setSystemTime(new Date('2026-02-10T12:00:00.000Z'));
      await finishOn(tuned, reader, 11, SECOND_CORRECT);

      const today = bodyOf<SummaryBody>(await summaryFor(tuned, reader));

      expect(today.localDate).toBe('2026-02-11');
      // Only the new day's Leaf. Yesterday's is not carried across.
      expect(today.leaves.map((leaf) => leaf.title)).toEqual(['The second concept']);
      expect(today.xpEarned).toBe(100);
      expect(today.streak.current).toBe(2);
    } finally {
      vi.useRealTimers();
      await tuned.close();
    }
  });

  it('files an achievement under the reader’s day even when UTC disagrees', async () => {
    /**
     * The instant is chosen so the two dates **cannot** agree: 12:00 UTC on 2026-02-10
     * is 01:00 on 2026-02-11 in Auckland. A badge earned here belongs to the reader's
     * 11th, while its stored `unlocked_at` still falls on the server's 10th.
     *
     * **An earlier version of this test used 10:00 UTC and proved nothing.** There the
     * UTC date and the Auckland date happened to be the same, so a naive
     * `unlocked_at::date` passed it — confirmed by mutation. The whole value of the test
     * is in picking an instant where the two disagree and the naive cast is therefore
     * wrong.
     */
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-10T12:00:00.000Z'));

    const tuned = await dayCrossingApp();

    try {
      const reader = await createReader(tuned, 'Pacific/Auckland');
      await finishOn(tuned, reader, 10, FIRST_CORRECT);

      const body = bodyOf<SummaryBody>(await summaryFor(tuned, reader));

      // The reader's day, not the server's.
      expect(body.localDate).toBe('2026-02-11');
      // Grouping by `unlocked_at::date` would file this under the 10th and lose it.
      expect(body.achievements.map((one) => one.id)).toContain('first-leaf');
    } finally {
      vi.useRealTimers();
      await tuned.close();
    }
  });
});
