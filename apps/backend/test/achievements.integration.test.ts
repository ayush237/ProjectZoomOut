import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Leaf as CmsLeaf, Track as CmsTrack } from '@zoomout/shared/cms';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PostgresAchievementRepository } from '../src/achievements/achievements.repository.js';
import { runMigrations } from '../src/db/migrate.js';
import { FakePayload } from './helpers/fakePayload.js';
import { buildTestApp, type TestApp } from './helpers/buildTestApp.js';

/**
 * Achievements, end to end.
 *
 * Real Postgres, because the guarantee that matters here is written in SQL: the unique
 * index on `(user_id, achievement_id)` is what makes awarding idempotent, and a fake
 * repository would prove the fake deduplicates. The same reasoning WP4 recorded for XP
 * and WP5a for the streak upserts.
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

const CORRECT_OPTION = '6a7629ee570031ac25de62bf';
const WRONG_OPTION = '6a7629ee570031ac25de62c0';
const SECOND_CORRECT_OPTION = '7b8730ff681142bd36ef73d0';
const SECOND_WRONG_OPTION = '7b8730ff681142bd36ef73d1';

const leafFor = (id: number, correct: string, wrong: string): CmsLeaf => ({
  id,
  trackId: 1,
  orderIndex: id - 10,
  title: `Concept ${String(id)}`,
  summary: { body: 'Placeholder summary.' },
  scenario: {
    prompt: 'Placeholder prompt?',
    options: [
      { text: 'The right one', isCorrect: true, id: correct },
      { text: 'A wrong one', isCorrect: false, id: wrong },
      { text: 'Another wrong one', isCorrect: false, id: `${wrong}f` },
    ],
  },
  payoff: { body: 'The payoff nobody may read before answering.' },
  stickyNotes: {
    notes: [
      { note: 'Note one', id: 'n1' },
      { note: 'Note two', id: 'n2' },
    ],
  },
  takeaway: { body: 'Placeholder takeaway.', dinnerTableKnowledge: 'A fact worth repeating.' },
  /**
   * The takeaway reference is **required**, not decoration.
   *
   * These Leaves carry Dinner Table Knowledge, and `leafSchema` refuses a Leaf whose
   * DTK has no sourced takeaway — `LEGAL.md` calls unsourced DTK the highest-severity
   * risk, so the mapper rejects the document rather than serving it. Omitting it here
   * makes every request 502 with nothing that looks like a validation failure.
   */
  sourceReferences: [
    { slideKey: 'summary', chapter: 'Chapter 1', page: null, quote: null, note: 'A note.', id: 's1' },
    { slideKey: 'takeaway', chapter: 'Chapter 2', page: null, quote: null, note: 'A note.', id: 's2' },
  ],
  isPlaceholder: true,
  createdAt: '2026-08-08T12:00:00.000Z',
  updatedAt: '2026-08-08T12:00:00.000Z',
  _status: 'published',
});

const LEAF = leafFor(10, CORRECT_OPTION, WRONG_OPTION);
const SECOND_LEAF = leafFor(11, SECOND_CORRECT_OPTION, SECOND_WRONG_OPTION);

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

const listAchievements = (reader: Reader) =>
  app().inject({ method: 'GET', url: '/achievements', headers: auth(reader.token) });

const postEvent = (reader: Reader, payload: Record<string, unknown>) =>
  app().inject({ method: 'POST', url: '/events', headers: auth(reader.token), payload });

const addToLibrary = (reader: Reader, trackId = 1) =>
  app().inject({
    method: 'POST',
    url: `/library/tracks/${String(trackId)}`,
    headers: auth(reader.token),
  });

interface Unlocked {
  readonly id: string;
  readonly name: string;
  readonly tier: string;
  readonly unlockedAt: string;
}

interface AchievementStatusBody {
  readonly id: string;
  readonly unlockedAt: string | null;
}

/** Answers correctly and completes, so the Leaf counts toward the progress ladder. */
async function finishLeaf(reader: Reader, leafId: number, optionId: string): Promise<Unlocked[]> {
  await answer(reader, optionId, leafId);
  const response = await complete(reader, leafId);

  return bodyOf<{ unlocked: Unlocked[] }>(response).unlocked;
}

const idsOf = (unlocked: readonly Unlocked[]): string[] => unlocked.map((one) => one.id);

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
/* Tier A — the migration                                                      */
/* -------------------------------------------------------------------------- */

describe('the achievements migration', () => {
  it('creates user_achievements and reader_events', async () => {
    const result = await harness.database.pool.query(
      `select table_name from information_schema.tables
       where table_schema='public' and table_name in ('user_achievements','reader_events')
       order by table_name`,
    );

    expect(result.rows).toEqual([{ table_name: 'reader_events' }, { table_name: 'user_achievements' }]);
  });

  it('enforces one row per reader per achievement', async () => {
    // The whole idempotency guarantee, at the only layer a race cannot get past.
    const result = await harness.database.pool.query(
      `select 1 from pg_indexes
       where tablename='user_achievements' and indexname='user_achievements_user_achievement_unique'`,
    );

    expect(result.rowCount).toBe(1);
  });

  it('leaves no users.total_xp column behind', async () => {
    // Part C is derived on read, and this is the criterion that says so. A counter here
    // is where an idempotent completion would land as a double increment.
    const result = await harness.database.pool.query(
      `select 1 from information_schema.columns
       where table_name='users' and column_name='total_xp'`,
    );

    expect(result.rowCount).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Tier A — awarding twice awards once                                         */
/* -------------------------------------------------------------------------- */

describe('awarding is idempotent', () => {
  it('announces an unlock on the completion that earned it, and not again on a replay', async () => {
    const reader = await createReader();

    const first = await finishLeaf(reader, 10, CORRECT_OPTION);
    expect(idsOf(first)).toContain('first-leaf');

    // The replay. The server re-evaluates, re-decides that `first-leaf` is earned, and
    // the insert conflicts — so nothing comes back and the client does not animate a
    // badge the reader already has.
    const replay = bodyOf<{ unlocked: Unlocked[] }>(await complete(reader, 10)).unlocked;
    expect(replay).toEqual([]);

    const rows = await harness.database.pool.query(
      `select count(*)::int as n from user_achievements
       where user_id = $1 and achievement_id = 'first-leaf'`,
      [reader.userId],
    );
    expect(rows.rows[0]).toEqual({ n: 1 });
  });

  it('awards once when two completions of the same Leaf land together', async () => {
    /**
     * The concurrency half, and the reason the unique index exists rather than a
     * check-then-insert in the service. Two in-flight completions both read a state in
     * which `first-leaf` is unearned; both decide to award it. Without the index one of
     * them fails the whole completion — the visible symptom is not a duplicate row but
     * a reader losing a Leaf for tapping twice.
     */
    const reader = await createReader();
    await answer(reader, CORRECT_OPTION, 10);

    const [a, b] = await Promise.all([complete(reader, 10), complete(reader, 10)]);

    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);

    // Scoped to the badge the completions race over. The answer above already earned
    // `first-try-first`, so counting every row for this reader would be counting two
    // unrelated achievements and calling it a duplicate.
    const rows = await harness.database.pool.query(
      `select count(*)::int as n from user_achievements
       where user_id = $1 and achievement_id = 'first-leaf'`,
      [reader.userId],
    );
    expect(rows.rows[0]).toEqual({ n: 1 });

    // Exactly one of the two calls announced it, so the client animates once.
    const announced = [
      ...idsOf(bodyOf<{ unlocked: Unlocked[] }>(a).unlocked),
      ...idsOf(bodyOf<{ unlocked: Unlocked[] }>(b).unlocked),
    ].filter((id) => id === 'first-leaf');
    expect(announced).toEqual(['first-leaf']);
  });

  it('inserts one row and reports one winner when the same award races itself', async () => {
    /**
     * The storage guarantee on its own, at the repository.
     *
     * Going through the HTTP layer does **not** exercise this: the service filters out
     * already-held achievements before it ever calls `award`, so on a replay the insert
     * is never reached, and two concurrent completions usually serialise far enough
     * apart that the loser also sees the winner's row. Both are fine behaviours — but
     * they mean the endpoint tests above pass whether or not `onConflictDoNothing` is
     * still there, which was confirmed by mutation: swapping it for an upsert left all
     * of them green.
     *
     * This is the test that goes red for that mutation, because it is the only one that
     * puts two inserts of the same badge in flight at once.
     */
    const reader = await createReader();
    const repository = new PostgresAchievementRepository(harness.database);
    const at = new Date();

    const [first, second] = await Promise.all([
      repository.award(reader.userId, ['first-leaf'], at),
      repository.award(reader.userId, ['first-leaf'], at),
    ]);

    // One insert wins and returns its row; the other conflicts and returns nothing —
    // which is what stops two unlock animations for one badge.
    expect(first.length + second.length).toBe(1);

    const rows = await harness.database.pool.query(
      `select count(*)::int as n from user_achievements
       where user_id = $1 and achievement_id = 'first-leaf'`,
      [reader.userId],
    );
    expect(rows.rows[0]).toEqual({ n: 1 });
  });

  it('awards once when two Dinner Table opens land together', async () => {
    // The same race on the event path, which writes a row before evaluating.
    const reader = await createReader();

    const [a, b] = await Promise.all([
      postEvent(reader, { type: 'dinner_table_open', leafId: '10' }),
      postEvent(reader, { type: 'dinner_table_open', leafId: '10' }),
    ]);

    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);

    const rows = await harness.database.pool.query(
      `select count(*)::int as n from user_achievements
       where user_id = $1 and achievement_id = 'dinner-party'`,
      [reader.userId],
    );
    expect(rows.rows[0]).toEqual({ n: 1 });
  });
});

/* -------------------------------------------------------------------------- */
/* Tier B — one happy path per evaluation point                                */
/* -------------------------------------------------------------------------- */

describe('the evaluation points', () => {
  it('unlocks first-book in the response of the add that earned it', async () => {
    const reader = await createReader();

    const response = await addToLibrary(reader);

    expect(response.statusCode).toBe(200);
    expect(idsOf(bodyOf<{ unlocked: Unlocked[] }>(response).unlocked)).toContain('first-book');
  });

  it('unlocks first-try-first on the answer, before any Leaf is completed', async () => {
    // Answering is its own evaluation point: a reader who answers correctly first time
    // and stops has still done the thing `first-try-first` celebrates.
    const reader = await createReader();

    const response = await answer(reader, CORRECT_OPTION, 10);
    const unlocked = idsOf(bodyOf<{ unlocked: Unlocked[] }>(response).unlocked);

    expect(unlocked).toContain('first-try-first');
    expect(unlocked).not.toContain('first-leaf');
  });

  it('records a Dinner Table open and unlocks dinner-party', async () => {
    const reader = await createReader();

    const response = await postEvent(reader, { type: 'dinner_table_open', leafId: '10' });

    expect(idsOf(bodyOf<{ unlocked: Unlocked[] }>(response).unlocked)).toContain('dinner-party');

    // The row itself, because it is the only signal that the deep-cut content is read
    // at all — the badge is a side effect of collecting it, not the reason.
    const rows = await harness.database.pool.query(
      `select type, leaf_id from reader_events where user_id = $1`,
      [reader.userId],
    );
    expect(rows.rows).toEqual([{ type: 'dinner_table_open', leaf_id: '10' }]);
  });

  it('unlocks first-wrap when a session is wrapped up', async () => {
    // The wrap-up *screen* is WP9. The event it will fire is here, so `first-wrap`
    // ships reachable rather than as a tile nothing can ever award.
    const reader = await createReader();

    const response = await postEvent(reader, { type: 'session_wrap' });

    expect(idsOf(bodyOf<{ unlocked: Unlocked[] }>(response).unlocked)).toContain('first-wrap');
  });

  it('unlocks track-complete and perfect-track on the Leaf that finishes a book', async () => {
    const reader = await createReader();
    await addToLibrary(reader);

    await finishLeaf(reader, 10, CORRECT_OPTION);
    const last = await finishLeaf(reader, 11, SECOND_CORRECT_OPTION);

    // Both Leaves answered first try, so finishing the book is also flawless.
    expect(idsOf(last)).toEqual(expect.arrayContaining(['track-complete', 'perfect-track']));
  });

  it('withholds perfect-track when a Leaf took more than one attempt', async () => {
    const reader = await createReader();

    await answer(reader, WRONG_OPTION, 10);
    await finishLeaf(reader, 10, CORRECT_OPTION);
    const last = await finishLeaf(reader, 11, SECOND_CORRECT_OPTION);

    expect(idsOf(last)).toContain('track-complete');
    expect(idsOf(last)).not.toContain('perfect-track');
  });
});

/* -------------------------------------------------------------------------- */
/* Tier B — the catalogue and total XP                                         */
/* -------------------------------------------------------------------------- */

describe('the catalogue', () => {
  it('returns all nineteen, locked ones included', async () => {
    const reader = await createReader();

    const body = bodyOf<{ achievements: AchievementStatusBody[] }>(await listAchievements(reader));

    expect(body.achievements).toHaveLength(19);
    // A reader who has done nothing still gets nineteen tiles — §3 ships four that are
    // unreachable at launch precisely so they are visible.
    expect(body.achievements.every((entry) => entry.unlockedAt === null)).toBe(true);
  });

  it('resolves the reader’s unlocks against it', async () => {
    const reader = await createReader();
    await finishLeaf(reader, 10, CORRECT_OPTION);

    const body = bodyOf<{ achievements: AchievementStatusBody[] }>(await listAchievements(reader));
    const firstLeaf = body.achievements.find((entry) => entry.id === 'first-leaf');

    expect(firstLeaf?.unlockedAt).toEqual(expect.any(String));
    expect(body.achievements.find((entry) => entry.id === 'streak-30')?.unlockedAt).toBeNull();
  });

  it.each([
    ['GET', '/achievements'],
    ['POST', '/events'],
  ] as const)('rejects unauthenticated %s %s', async (method, url) => {
    const response = await app().inject({ method, url });

    expect(response.statusCode).toBe(401);
  });

  it('rejects an event type the reader made up', async () => {
    // This endpoint writes a row on the reader's say-so, so the set of assertable
    // things is closed rather than free text.
    const reader = await createReader();

    const response = await postEvent(reader, { type: 'invented_event' });

    expect(response.statusCode).toBe(400);
  });
});

describe('total XP', () => {
  it('matches the sum of awarded XP and is not stored anywhere', async () => {
    const reader = await createReader();

    await finishLeaf(reader, 10, CORRECT_OPTION);
    await finishLeaf(reader, 11, SECOND_CORRECT_OPTION);

    const standing = bodyOf<{ totalXp: number }>(
      await app().inject({ method: 'GET', url: '/progress/today', headers: auth(reader.token) }),
    );

    const summed = await harness.database.pool.query<{ total: number }>(
      `select coalesce(sum(xp_awarded), 0)::int as total from leaf_progress where user_id = $1`,
      [reader.userId],
    );

    // Two first-try Leaves at the shipped defaults: (80 + 20) twice.
    expect(standing.totalXp).toBe(200);
    expect(standing.totalXp).toBe(summed.rows[0]?.total);
  });

  it('is zero for a reader who has completed nothing', async () => {
    // `sum` over no rows is null, not zero — the coalesce is what stops Profile
    // rendering a missing field.
    const reader = await createReader();

    const standing = bodyOf<{ totalXp: number }>(
      await app().inject({ method: 'GET', url: '/progress/today', headers: auth(reader.token) }),
    );

    expect(standing.totalXp).toBe(0);
  });
});
