import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Leaf as CmsLeaf, Track as CmsTrack } from '@zoomout/shared/cms';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from '../src/db/migrate.js';
import { FakePayload } from './helpers/fakePayload.js';
import { buildTestApp, type TestApp } from './helpers/buildTestApp.js';

/**
 * The fix queue (WP10), end to end.
 *
 * **This is a legal surface, so the Tier A cases are about the two ways it fails
 * quietly:** a report that is accepted and not stored, and a queue that can be read by
 * somebody who should not see it. Both look fine from the outside.
 *
 * Real Postgres, and a real operator token in config, because the refusal path is the
 * one that must be asserted rather than assumed.
 */

const POSTGRES_IMAGE = 'postgres:16-alpine';
const OPERATOR_TOKEN = 'an-operator-token-of-at-least-32-characters';

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
  leafCount: 1,
  acquisition: 'undocumented',
  isPlaceholder: true,
  createdAt: '2026-08-08T12:00:00.000Z',
  updatedAt: '2026-08-08T12:00:00.000Z',
  _status: 'published',
};

const LEAF: CmsLeaf = {
  id: 10,
  trackId: 1,
  orderIndex: 0,
  title: 'A concept',
  summary: { body: 'Placeholder summary.' },
  scenario: {
    prompt: 'Placeholder prompt?',
    options: [
      { text: 'Right', isCorrect: true, id: 'o1' },
      { text: 'Wrong', isCorrect: false, id: 'o2' },
      { text: 'Also wrong', isCorrect: false, id: 'o3' },
    ],
  },
  payoff: { body: 'The payoff.' },
  stickyNotes: {
    notes: [
      { note: 'One', id: 'n1' },
      { note: 'Two', id: 'n2' },
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

async function createReader(): Promise<{ userId: string; token: string }> {
  const response = await app().inject({
    method: 'POST',
    url: '/auth/signup',
    payload: {
      email: `reader-${String(Math.random()).slice(2)}@example.test`,
      password: 'a-sufficiently-long-password',
      displayName: 'Test Reader',
      dateOfBirth: '1994-03-17',
      timezone: 'Europe/London',
    },
  });

  const body = bodyOf<{ userId: string; accessToken: string }>(response);
  return { userId: body.userId, token: body.accessToken };
}

const auth = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` });

const report = (token: string, payloadBody: Record<string, unknown>, leafId = 10) =>
  app().inject({
    method: 'POST',
    url: `/content/leaves/${String(leafId)}/reports`,
    headers: { ...auth(token), 'content-type': 'application/json' },
    payload: payloadBody,
  });

interface ReportBody {
  readonly report: {
    id: string;
    userId: string | null;
    leafId: string;
    trackId: string;
    reason: string;
    detail: string | null;
    status: string;
    createdAt: string;
  };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  payload = await FakePayload.start();

  harness = await buildTestApp({
    databaseUrl: container.getConnectionUri(),
    env: {
      CONTENT_API_URL: payload.apiUrl,
      CONTENT_CACHE_TTL_SECONDS: '0',
      AUTH_RATE_LIMIT_MAX: '1000',
      MODERATION_OPERATOR_TOKEN: OPERATOR_TOKEN,
      // High enough that the happy-path tests are not throttled; the limit itself has
      // its own test with its own app.
      REPORT_RATE_LIMIT_MAX: '1000',
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
});

/* -------------------------------------------------------------------------- */
/* Tier A — a report is persisted                                              */
/* -------------------------------------------------------------------------- */

describe('filing a report', () => {
  it('persists reader, Leaf, Track, reason, text and time', async () => {
    const reader = await createReader();

    const response = await report(reader.token, {
      reason: 'factual_error',
      detail: 'Chapter 3 does not say this.',
    });

    expect(response.statusCode).toBe(201);

    const body = bodyOf<ReportBody>(response).report;
    expect(body.userId).toBe(reader.userId);
    expect(body.leafId).toBe('10');
    // Denormalised at filing time, so triage survives the content being pulled.
    expect(body.trackId).toBe('1');
    expect(body.reason).toBe('factual_error');
    expect(body.detail).toBe('Chapter 3 does not say this.');
    expect(body.status).toBe('open');

    const rows = await harness.database.pool.query(
      `select count(*)::int as n from error_reports where user_id = $1 and leaf_id = '10'`,
      [reader.userId],
    );
    expect(rows.rows[0]).toEqual({ n: 1 });
  });

  it('accepts a reason with no free text', async () => {
    const reader = await createReader();

    const response = await report(reader.token, { reason: 'offensive' });

    expect(response.statusCode).toBe(201);
    expect(bodyOf<ReportBody>(response).report.detail).toBeNull();
  });

  it('rejects a reason outside the enum', async () => {
    // The queue is only sortable by a human if the reasons are closed.
    const reader = await createReader();

    expect((await report(reader.token, { reason: 'made_up' })).statusCode).toBe(400);
  });

  it('refuses a report against a Leaf that is not visible here', async () => {
    // Otherwise the queue can be filled with rows about content that does not exist.
    const reader = await createReader();
    payload.setPublished('leaf', 10, false);

    expect((await report(reader.token, { reason: 'other' })).statusCode).toBe(404);
  });

  it('rejects an unauthenticated report', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/content/leaves/10/reports',
      headers: { 'content-type': 'application/json' },
      payload: { reason: 'other' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('keeps the report when the reporting account is deleted', async () => {
    /**
     * The row is `on delete set null`, not cascade. A deleted account must not erase
     * the evidence that a factual claim was disputed — that report is the start of a
     * takedown clock and outlives the person who filed it.
     */
    const reader = await createReader();
    const filed = bodyOf<ReportBody>(await report(reader.token, { reason: 'wrong_answer' })).report;

    await harness.database.pool.query(`delete from users where id = $1`, [reader.userId]);

    // Scoped to the row this test filed. Other tests in this file report the same Leaf
    // from readers who still exist, so an aggregate over `leaf_id` would read theirs.
    const rows = await harness.database.pool.query<{ user_id: string | null; reason: string }>(
      `select user_id::text as user_id, reason from error_reports where id = $1`,
      [filed.id],
    );

    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.reason).toBe('wrong_answer');
    expect(rows.rows[0]?.user_id).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Tier A — the queue refuses an untokened caller                              */
/* -------------------------------------------------------------------------- */

describe('the operator queue', () => {
  it('lists reports for a caller holding the token', async () => {
    const reader = await createReader();
    await report(reader.token, { reason: 'factual_error', detail: 'A note.' });

    const response = await app().inject({
      method: 'GET',
      url: '/moderation/reports',
      headers: auth(OPERATOR_TOKEN),
    });

    expect(response.statusCode).toBe(200);
    expect(bodyOf<{ reports: unknown[] }>(response).reports.length).toBeGreaterThan(0);
  });

  it.each([
    ['no header at all', undefined],
    ['an empty bearer', 'Bearer '],
    ['the wrong token', 'Bearer not-the-operator-token-but-long-enough-x'],
    ['a reader’s own access token shape', 'Bearer eyJhbGciOiJIUzI1NiJ9.fake.fake'],
    ['the right token under the wrong scheme', `Basic ${OPERATOR_TOKEN}`],
  ] as const)('refuses %s', async (_label, header) => {
    const response = await app().inject({
      method: 'GET',
      url: '/moderation/reports',
      ...(header === undefined ? {} : { headers: { authorization: header } }),
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a reader holding a perfectly valid reader token', async () => {
    // The queue is not reader-authenticated. Every report in it belongs to somebody.
    const reader = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/moderation/reports',
      headers: auth(reader.token),
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses everyone when no operator token is configured', async () => {
    /**
     * The fail-closed default, and the one worth a dedicated app: an unset secret must
     * not become an open door. Getting this backwards would publish every
     * reader-submitted report on any deployment that forgot the variable.
     */
    const unconfigured = await buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: {
        CONTENT_API_URL: payload.apiUrl,
        CONTENT_CACHE_TTL_SECONDS: '0',
        AUTH_RATE_LIMIT_MAX: '1000',
      },
    });

    try {
      for (const header of [undefined, `Bearer ${OPERATOR_TOKEN}`, 'Bearer anything']) {
        const response = await unconfigured.app.inject({
          method: 'GET',
          url: '/moderation/reports',
          ...(header === undefined ? {} : { headers: { authorization: header } }),
        });

        expect(response.statusCode).toBe(401);
      }
    } finally {
      await unconfigured.close();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Tier B — the rate limit                                                     */
/* -------------------------------------------------------------------------- */

describe('rate limiting', () => {
  it('throttles a reader filing repeatedly', async () => {
    const limited = await buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: {
        CONTENT_API_URL: payload.apiUrl,
        CONTENT_CACHE_TTL_SECONDS: '0',
        AUTH_RATE_LIMIT_MAX: '1000',
        MODERATION_OPERATOR_TOKEN: OPERATOR_TOKEN,
        REPORT_RATE_LIMIT_MAX: '2',
        REPORT_RATE_LIMIT_WINDOW_SECONDS: '60',
      },
    });

    try {
      const signup = await limited.app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          email: `limited-${String(Math.random()).slice(2)}@example.test`,
          password: 'a-sufficiently-long-password',
          displayName: 'Limited',
          dateOfBirth: '1994-03-17',
          timezone: 'Europe/London',
        },
      });
      const token = bodyOf<{ accessToken: string }>(signup).accessToken;

      const file = () =>
        limited.app.inject({
          method: 'POST',
          url: '/content/leaves/10/reports',
          headers: { ...auth(token), 'content-type': 'application/json' },
          payload: { reason: 'other' },
        });

      expect((await file()).statusCode).toBe(201);
      expect((await file()).statusCode).toBe(201);
      // 429 rather than 500: WP2's error handler passes a plugin's 4xx through.
      expect((await file()).statusCode).toBe(429);
    } finally {
      await limited.close();
    }
  });
});
