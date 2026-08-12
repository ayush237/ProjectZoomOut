import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Leaf as CmsLeaf, Track as CmsTrack } from '@zoomout/shared/cms';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from '../src/db/migrate.js';
import { FakePayload } from './helpers/fakePayload.js';
import { buildTestApp, type TestApp } from './helpers/buildTestApp.js';

/**
 * Content and library endpoints, end to end.
 *
 * Real Postgres for the library, a controllable stand-in for Payload so content can be
 * unpublished mid-test. See `fakePayload.ts` for why that is the right tool here —
 * Payload's own access control was proven against the real CMS in WP1.
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
  leafCount: 1,
  isPlaceholder: true,
  createdAt: '2026-08-08T12:00:00.000Z',
  updatedAt: '2026-08-08T12:00:00.000Z',
  _status: 'published',
};

const LEAF: CmsLeaf = {
  id: 10,
  trackId: 1,
  orderIndex: 0,
  title: 'Concept One',
  summary: { body: 'Placeholder summary.' },
  scenario: {
    prompt: 'Placeholder prompt?',
    options: [
      { text: 'Option A', isCorrect: true, id: 'o1' },
      { text: 'Option B', isCorrect: false, id: 'o2' },
      { text: 'Option C', isCorrect: false, id: 'o3' },
    ],
  },
  payoff: { body: 'Placeholder payoff.' },
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

/** Signs up a fresh reader and returns their bearer token. */
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

beforeAll(async () => {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  payload = await FakePayload.start();

  harness = await buildTestApp({
    databaseUrl: container.getConnectionUri(),
    env: {
      CONTENT_API_URL: payload.apiUrl,
      // Caching off by default so each test sees current content. A dedicated suite
      // below builds its own app with a live TTL to test caching itself.
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
});

/* -------------------------------------------------------------------------- */
/* Migration                                                                   */
/* -------------------------------------------------------------------------- */

describe('the library migration', () => {
  it('creates user_tracks', async () => {
    const result = await harness.database.pool.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name='user_tracks'`,
    );

    expect(result.rowCount).toBe(1);
  });

  it('enforces one row per reader per Track', async () => {
    const result = await harness.database.pool.query(
      `select 1 from pg_indexes where tablename='user_tracks' and indexname='user_tracks_user_track_unique'`,
    );

    expect(result.rowCount).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Authentication                                                              */
/* -------------------------------------------------------------------------- */

describe('authentication', () => {
  it.each([
    ['GET', '/content/tracks'],
    ['GET', '/content/tracks/1'],
    ['GET', '/content/tracks/1/leaves'],
    ['GET', '/content/leaves/10'],
    ['GET', '/library'],
    ['POST', '/library/tracks/1'],
    ['DELETE', '/library/tracks/1'],
  ] as const)('rejects unauthenticated %s %s', async (method, url) => {
    // Phase 1 has no guest mode — every content route is behind auth.
    const response = await app().inject({ method, url });

    expect(response.statusCode).toBe(401);
  });
});

/* -------------------------------------------------------------------------- */
/* Content delivery                                                            */
/* -------------------------------------------------------------------------- */

describe('content delivery', () => {
  it('lists published Tracks', async () => {
    const { token } = await createReader();

    const response = await app().inject({ method: 'GET', url: '/content/tracks', headers: auth(token) });

    expect(response.statusCode).toBe(200);
    expect(bodyOf<{ tracks: unknown[] }>(response).tracks).toHaveLength(1);
  });

  it('returns the disclaimer and purchase links on Track detail', async () => {
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/tracks/1',
      headers: auth(token),
    });

    const track = bodyOf<{ disclaimer: string; purchaseLinks: unknown[] }>(response);
    expect(track.disclaimer).toContain('not affiliated');
    expect(track.purchaseLinks).toHaveLength(1);
  });

  it('lists Leaf metadata without slide bodies', async () => {
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/tracks/1/leaves',
      headers: auth(token),
    });

    expect(response.body).not.toContain('Placeholder payoff');
    expect(bodyOf<{ leaves: unknown[] }>(response).leaves).toHaveLength(1);
  });

  it('never includes the answer key in a Leaf response', async () => {
    // Asserted at the route level, not just in the mapper: this is the serialised
    // bytes that actually leave the process.
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/leaves/10',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain('isCorrect');
  });

  it('404s a Leaf that does not exist', async () => {
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/leaves/9999',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(404);
  });

  it('withholds a Track that fails domain validation, rather than serving it', async () => {
    // A Track the CMS accepted but our own invariants reject — the second gate.
    payload.seedTrack({ ...TRACK, id: 2, publisher: null, coverUrl: null }, { published: true });
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/tracks/2',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain('publisher');
  });
});

/* -------------------------------------------------------------------------- */
/* CMS unreachable                                                             */
/* -------------------------------------------------------------------------- */

describe('when the CMS is unreachable', () => {
  it('returns a clean 503', async () => {
    const { token } = await createReader();
    payload.failing = true;

    const response = await app().inject({ method: 'GET', url: '/content/tracks', headers: auth(token) });

    expect(response.statusCode).toBe(503);
    expect(bodyOf<{ error: { code: string } }>(response).error.code).toBe('CONTENT_UNAVAILABLE');
  });

  it('leaks no stack trace or upstream detail', async () => {
    const { token } = await createReader();
    payload.failing = true;

    const response = await app().inject({ method: 'GET', url: '/content/tracks', headers: auth(token) });

    expect(response.body).not.toContain('upstream exploded');
    expect(response.body).not.toContain('127.0.0.1');
    expect(response.body).not.toMatch(/at \w+ \(/u);
  });
});

/* -------------------------------------------------------------------------- */
/* Takedown                                                                    */
/* -------------------------------------------------------------------------- */

describe('takedown', () => {
  it('removes an unpublished Track from the API', async () => {
    const { token } = await createReader();

    const before = await app().inject({ method: 'GET', url: '/content/tracks', headers: auth(token) });
    expect(bodyOf<{ tracks: unknown[] }>(before).tracks).toHaveLength(1);

    payload.setPublished('track', 1, false);

    const after = await app().inject({ method: 'GET', url: '/content/tracks', headers: auth(token) });
    expect(bodyOf<{ tracks: unknown[] }>(after).tracks).toHaveLength(0);
  });

  it('404s a Track fetched directly after takedown', async () => {
    const { token } = await createReader();
    payload.setPublished('track', 1, false);

    const response = await app().inject({
      method: 'GET',
      url: '/content/tracks/1',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(404);
  });

  it('drops a taken-down Track out of a reader’s library too', async () => {
    // Takedown has to reach everywhere a reader could see the Track, not just Explore.
    const { token } = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(token) });

    payload.setPublished('track', 1, false);

    const response = await app().inject({ method: 'GET', url: '/library', headers: auth(token) });

    expect(bodyOf<{ entries: unknown[] }>(response).entries).toHaveLength(0);
  });

  it('serves cached content for no longer than the configured TTL', async () => {
    const cached = await buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: {
        CONTENT_API_URL: payload.apiUrl,
        CONTENT_CACHE_TTL_SECONDS: '1',
        AUTH_RATE_LIMIT_MAX: '1000',
      },
    });

    try {
      const signup = await cached.app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          email: `cache-${String(Math.random()).slice(2)}@example.test`,
          password: 'a-sufficiently-long-password',
          displayName: 'Cache Reader',
          dateOfBirth: '1994-03-17',
          timezone: 'Europe/London',
        },
      });
      const { accessToken } = bodyOf<{ accessToken: string }>(signup);

      const visible = await cached.app.inject({
        method: 'GET',
        url: '/content/tracks',
        headers: auth(accessToken),
      });
      expect(bodyOf<{ tracks: unknown[] }>(visible).tracks).toHaveLength(1);

      payload.setPublished('track', 1, false);

      // Still cached, so still visible — this is the takedown latency, bounded by config.
      const stillCached = await cached.app.inject({
        method: 'GET',
        url: '/content/tracks',
        headers: auth(accessToken),
      });
      expect(bodyOf<{ tracks: unknown[] }>(stillCached).tracks).toHaveLength(1);

      await new Promise((resolve) => setTimeout(resolve, 1200));

      const expired = await cached.app.inject({
        method: 'GET',
        url: '/content/tracks',
        headers: auth(accessToken),
      });
      expect(bodyOf<{ tracks: unknown[] }>(expired).tracks).toHaveLength(0);
    } finally {
      await cached.close();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Library                                                                     */
/* -------------------------------------------------------------------------- */

describe('library', () => {
  it('adds a Track', async () => {
    const { token } = await createReader();

    const added = await app().inject({
      method: 'POST',
      url: '/library/tracks/1',
      headers: auth(token),
    });
    // 200 since WP5b, where this was 204: the add carries back any achievement it
    // earned, because an unlock has to arrive in the response of the triggering action.
    expect(added.statusCode).toBe(200);

    const list = await app().inject({ method: 'GET', url: '/library', headers: auth(token) });
    expect(bodyOf<{ entries: unknown[] }>(list).entries).toHaveLength(1);
  });

  it('is idempotent when the same Track is added twice', async () => {
    const { token } = await createReader();

    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(token) });
    const second = await app().inject({
      method: 'POST',
      url: '/library/tracks/1',
      headers: auth(token),
    });

    expect(second.statusCode).toBe(200);
    // Still idempotent, and now visibly so: the second add earned nothing, because
    // `first-book` was already awarded by the first.
    expect(bodyOf<{ unlocked: unknown[] }>(second).unlocked).toEqual([]);

    const list = await app().inject({ method: 'GET', url: '/library', headers: auth(token) });
    expect(bodyOf<{ entries: unknown[] }>(list).entries).toHaveLength(1);
  });

  it('removes a Track', async () => {
    const { token } = await createReader();
    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(token) });

    const removed = await app().inject({
      method: 'DELETE',
      url: '/library/tracks/1',
      headers: auth(token),
    });
    expect(removed.statusCode).toBe(204);

    const list = await app().inject({ method: 'GET', url: '/library', headers: auth(token) });
    expect(bodyOf<{ entries: unknown[] }>(list).entries).toHaveLength(0);
  });

  it('treats removing an absent Track as success', async () => {
    const { token } = await createReader();

    const response = await app().inject({
      method: 'DELETE',
      url: '/library/tracks/1',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(204);
  });

  it('refuses to add a Track that does not exist', async () => {
    const { token } = await createReader();

    const response = await app().inject({
      method: 'POST',
      url: '/library/tracks/9999',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(404);
  });

  it('refuses to add an unpublished Track', async () => {
    // Visibility is enforced on the way in, so a reader cannot add a draft by
    // guessing its id.
    const { token } = await createReader();
    payload.setPublished('track', 1, false);

    const response = await app().inject({
      method: 'POST',
      url: '/library/tracks/1',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(404);
  });

  it('shows a reader only their own library', async () => {
    const alice = await createReader();
    const bob = await createReader();

    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(alice.token) });

    const bobsLibrary = await app().inject({
      method: 'GET',
      url: '/library',
      headers: auth(bob.token),
    });

    expect(bodyOf<{ entries: unknown[] }>(bobsLibrary).entries).toHaveLength(0);
  });

  it('does not let one reader remove another reader’s entry', async () => {
    const alice = await createReader();
    const bob = await createReader();

    await app().inject({ method: 'POST', url: '/library/tracks/1', headers: auth(alice.token) });
    await app().inject({ method: 'DELETE', url: '/library/tracks/1', headers: auth(bob.token) });

    const alicesLibrary = await app().inject({
      method: 'GET',
      url: '/library',
      headers: auth(alice.token),
    });

    expect(bodyOf<{ entries: unknown[] }>(alicesLibrary).entries).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Pagination totals in production                                             */
/* -------------------------------------------------------------------------- */

describe('listing Tracks in production', () => {
  /** A production app against the same fake CMS. */
  async function productionApp(): Promise<TestApp> {
    return buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: {
        NODE_ENV: 'production',
        CONTENT_API_URL: payload.apiUrl,
        CONTENT_CACHE_TTL_SECONDS: '0',
        AUTH_RATE_LIMIT_MAX: '1000',
      },
    });
  }

  async function tokenFor(instance: TestApp): Promise<string> {
    const signup = await instance.app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: `prod-${String(Math.random()).slice(2)}@example.test`,
        password: 'a-sufficiently-long-password',
        displayName: 'Prod Reader',
        dateOfBirth: '1994-03-17',
        timezone: 'Europe/London',
      },
    });

    return bodyOf<{ accessToken: string }>(signup).accessToken;
  }

  it('reports a total that matches the rows actually returned', async () => {
    // WP3 filtered placeholders *after* fetching, so a page of them returned no Tracks
    // and still claimed there were several — and paging through gave empty pages. The
    // filter now goes into the Payload query, so the total is right at source.
    payload.seedTrack({ ...TRACK, id: 1, isPlaceholder: true }, { published: true });
    payload.seedTrack({ ...TRACK, id: 2, isPlaceholder: false }, { published: true });

    const production = await productionApp();

    try {
      const response = await production.app.inject({
        method: 'GET',
        url: '/content/tracks',
        headers: auth(await tokenFor(production)),
      });

      const body = bodyOf<{ tracks: unknown[]; totalTracks: number }>(response);
      expect(body.tracks).toHaveLength(1);
      expect(body.totalTracks).toBe(body.tracks.length);
    } finally {
      await production.close();
    }
  });

  it('still hides placeholder content when the query filter does nothing', async () => {
    /**
     * The load-bearing test of the pair.
     *
     * The query filter is an optimisation for pagination totals; `ContentService`'s
     * `isProductionPublishable` guard is the control. Here the CMS ignores the filter
     * entirely — a typo in the parameter name would look exactly like this — and no
     * placeholder may reach the reader regardless. If this ever goes red, the filter
     * has quietly become the only thing hiding mock prose from production.
     */
    payload.seedTrack({ ...TRACK, id: 1, isPlaceholder: true }, { published: true });
    payload.seedTrack({ ...TRACK, id: 2, isPlaceholder: false }, { published: true });
    payload.ignoreWhereFilters = true;

    const production = await productionApp();

    try {
      const response = await production.app.inject({
        method: 'GET',
        url: '/content/tracks',
        headers: auth(await tokenFor(production)),
      });

      expect(bodyOf<{ tracks: { id: string }[] }>(response).tracks.map((t) => t.id)).toEqual([
        '2',
      ]);
    } finally {
      payload.ignoreWhereFilters = false;
      await production.close();
    }
  });

  it('leaves placeholder content visible outside production', async () => {
    // Phase 1 is built entirely on placeholders; the filter must not apply in dev.
    payload.seedTrack({ ...TRACK, id: 1, isPlaceholder: true }, { published: true });
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/tracks',
      headers: auth(token),
    });

    expect(bodyOf<{ tracks: unknown[] }>(response).tracks.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Tier A — a draft must never reach a reader, even if the CMS offers one      */
/* -------------------------------------------------------------------------- */

describe('when the CMS serves drafts', () => {
  /**
   * The scenario: `read: publishedOrAuthenticated` has been misconfigured, or a future
   * Payload upgrade changes its default, and unpublished documents start coming back
   * from an anonymous read.
   *
   * Until WP11 the corpus was entirely published, so nothing had ever *observed* a
   * draft being excluded — the rule was definitive by inspection and untested. And a
   * test written against a fake that hides drafts proves only that the fake hides them.
   * These tests make the fake hand drafts over, so the backend's own `isVisibleIn`
   * filter is the thing under test: **defence in depth, not a duplicate of Payload.**
   */
  beforeEach(() => {
    payload.serveDrafts = true;
  });

  afterEach(() => {
    payload.serveDrafts = false;
  });

  it('keeps a draft Track out of Explore', async () => {
    payload.seedTrack({ ...TRACK, id: 40, bookTitle: 'Draft Book' }, { published: false });
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/tracks',
      headers: auth(token),
    });

    expect(response.body).not.toContain('Draft Book');
  });

  it('404s a draft Track fetched directly', async () => {
    payload.seedTrack({ ...TRACK, id: 41 }, { published: false });
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/tracks/41',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(404);
  });

  it('404s a draft Leaf', async () => {
    payload.seedLeaf({ ...LEAF, id: 42, title: 'Draft Leaf' }, { published: false });
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/leaves/42',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('Draft Leaf');
  });

  it('keeps a draft Leaf out of a Track’s contents', async () => {
    payload.seedLeaf({ ...LEAF, id: 43, title: 'Draft Leaf In List' }, { published: false });
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/tracks/1/leaves',
      headers: auth(token),
    });

    expect(response.body).not.toContain('Draft Leaf In List');
  });

  it('404s a published Leaf whose Track is only a draft', async () => {
    // The takedown cascade, reached from the draft direction rather than by
    // unpublishing something that was live.
    payload.seedTrack({ ...TRACK, id: 44 }, { published: false });
    payload.seedLeaf({ ...LEAF, id: 45, trackId: 44 }, { published: true });
    const { token } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/content/leaves/45',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(404);
  });
});
