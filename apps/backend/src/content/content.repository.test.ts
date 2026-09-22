import { createHash } from 'node:crypto';

import type { Leaf as CmsLeaf, Track as CmsTrack } from '@zoomout/shared/cms';
import { describe, expect, it, vi } from 'vitest';

import { loadConfig, type AppConfig } from '../config/env.js';
import type { AppLogger } from '../logging/logger.js';
import { PayloadContentRepository } from './content.repository.js';
import type { PayloadClient, PayloadListResponse } from './payloadClient.js';

/**
 * `keepValid`/`requireValid` are the only place a mapped document's `warnings`
 * (VO-1.1) get logged — the mapper itself has no logger and no side effects. The
 * mapper's own test file proves *which* audio entries get dropped and why; this
 * proves that a mapping which succeeds but carries warnings still gets served, and
 * still gets logged, through both of this repository's read paths.
 */

const stubLogger = (): AppLogger =>
  ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }) as unknown as AppLogger;

const config: AppConfig = loadConfig({
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
  AUTH_JWT_SECRET: 'x'.repeat(48),
});

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** A CMS Leaf whose one audio entry's digest no longer matches its own text. */
function leafWithStaleAudio(id: number): CmsLeaf {
  return {
    id,
    trackId: 1,
    orderIndex: 0,
    title: 'A Leaf with stale narration',
    summary: {
      body: 'The current text.',
      audio: [
        {
          narrator: 'female',
          url: 'https://cdn.test/clip.mp3',
          durationSeconds: 10,
          textDigest: sha256('an older version of the text'),
          id: 'row-1',
        },
      ],
    },
    scenario: {
      prompt: 'Prompt?',
      options: [
        { id: 'o1', text: 'A', isCorrect: true },
        { id: 'o2', text: 'B', isCorrect: false },
        { id: 'o3', text: 'C', isCorrect: false },
      ],
    },
    payoff: { body: 'Payoff.' },
    stickyNotes: {
      notes: [
        { id: 'n1', note: 'Note one.' },
        { id: 'n2', note: 'Note two.' },
      ],
    },
    takeaway: { body: 'Takeaway.' },
    sourceReferences: [],
    isPlaceholder: false,
    createdAt: '2026-08-08T12:00:00.000Z',
    updatedAt: '2026-08-08T12:00:00.000Z',
    _status: 'published',
  };
}

function clientReturning(leaves: CmsLeaf[]): PayloadClient {
  const response: PayloadListResponse<CmsLeaf> = {
    docs: leaves,
    totalDocs: leaves.length,
    page: 1,
    totalPages: 1,
    hasNextPage: false,
  };

  return { get: vi.fn().mockResolvedValue(response) } as unknown as PayloadClient;
}

/** Routes by path, so one fake client can serve both `/tracks` and `/leaves` in a
 *  single test — needed for the media-URL tests below, which check a Track's
 *  `coverUrl` and a Leaf's assets together. */
function clientWith(tracks: CmsTrack[], leaves: CmsLeaf[]): PayloadClient {
  const trackResponse: PayloadListResponse<CmsTrack> = {
    docs: tracks,
    totalDocs: tracks.length,
    page: 1,
    totalPages: 1,
    hasNextPage: false,
  };
  const leafResponse: PayloadListResponse<CmsLeaf> = {
    docs: leaves,
    totalDocs: leaves.length,
    page: 1,
    totalPages: 1,
    hasNextPage: false,
  };

  return {
    get: vi.fn((path: string) => {
      if (path === '/tracks') {
        return Promise.resolve(trackResponse);
      }
      if (path === '/leaves') {
        return Promise.resolve(leafResponse);
      }
      throw new Error(`clientWith: no fixture wired up for path ${path}`);
    }),
  } as unknown as PayloadClient;
}

/**
 * A Track with every optional **media** field populated — `coverUrl` — relative, the
 * way Payload actually stores it (WP15.8), so resolving it is a real exercise of
 * `resolveMediaUrl` rather than a pass-through of an already-absolute fixture value.
 */
function maximalCmsTrack(overrides: Partial<CmsTrack> = {}): CmsTrack {
  return {
    id: 1,
    bookTitle: 'The Maximal Book',
    author: 'An Author',
    publisher: 'A Publisher',
    coverUrl: '/api/media/file/cover.png',
    description: 'A description.',
    disclaimer: 'ZoomOut is not affiliated with or endorsed by the author or publisher.',
    purchaseLinks: [{ retailer: 'Example Books', url: 'https://example.test/book', isAffiliate: false }],
    leafCount: 1,
    acquisition: 'undocumented',
    isPlaceholder: false,
    createdAt: '2026-09-22T12:00:00.000Z',
    updatedAt: '2026-09-22T12:00:00.000Z',
    _status: 'published',
    ...overrides,
  };
}

/**
 * A Leaf with every optional **media** field populated: `scenario.image`,
 * `stickyNotes.diagram`, and narration audio on all **four** narrated slides —
 * summary, scenario, payoff, takeaway. Every media URL is CMS-relative, matching real
 * Payload (WP15.8), and every `textDigest` is computed from this fixture's own text so
 * `mapAudioEntries` does not drop any of them as stale.
 *
 * **Deliberately excludes `stickyNotes.audio`.** `stickyNotes` has no narrated field to
 * verify against, so `mapAudioEntries` omits every entry there unconditionally
 * (`content.mapper.ts`) — populating it would prove nothing but its own removal. Four
 * narrated slides, not five, is the correct maximum, matching the handoff's own count.
 */
function maximalCmsLeaf(overrides: Partial<CmsLeaf> = {}): CmsLeaf {
  const summaryBody = 'Full summary text for the maximal-fixture contract test.';
  const scenarioPrompt = 'Full scenario prompt for the maximal-fixture contract test?';
  const payoffBody = 'Full payoff text for the maximal-fixture contract test.';
  const takeawayBody = 'Full takeaway text for the maximal-fixture contract test.';

  const audioEntry = (narratedText: string, fileName: string) => [
    {
      narrator: 'female' as const,
      url: `/api/media/file/${fileName}`,
      durationSeconds: 12,
      textDigest: sha256(narratedText),
      id: `audio-${fileName}`,
    },
  ];

  return {
    id: 244,
    trackId: 1,
    orderIndex: 0,
    title: 'A Leaf with every optional media field populated',
    summary: { body: summaryBody, audio: audioEntry(summaryBody, 'summary-female.mp3') },
    scenario: {
      prompt: scenarioPrompt,
      options: [
        { id: 'o1', text: 'A', isCorrect: true },
        { id: 'o2', text: 'B', isCorrect: false },
        { id: 'o3', text: 'C', isCorrect: false },
      ],
      image: { url: '/api/media/file/scenario.png', alt: 'A scenario illustration.', width: 800, height: 600 },
      audio: audioEntry(scenarioPrompt, 'scenario-female.mp3'),
    },
    payoff: { body: payoffBody, audio: audioEntry(payoffBody, 'payoff-female.mp3') },
    stickyNotes: {
      notes: [
        { id: 'n1', note: 'Note one.' },
        { id: 'n2', note: 'Note two.' },
      ],
      diagram: {
        url: '/api/media/file/diagram.png',
        alt: 'A diagram.',
        width: 800,
        height: 600,
        spec: '{"kind":"contrast"}',
        specFormat: 'json',
      },
    },
    takeaway: { body: takeawayBody, audio: audioEntry(takeawayBody, 'takeaway-female.mp3') },
    sourceReferences: [],
    isPlaceholder: false,
    createdAt: '2026-09-22T12:00:00.000Z',
    updatedAt: '2026-09-22T12:00:00.000Z',
    _status: 'published',
    ...overrides,
  };
}

interface WarnCall {
  readonly warnings: readonly string[];
  readonly kind: string;
}

describe('PayloadContentRepository — warning logging (VO-1.1)', () => {
  it('logs a warning and still serves the Leaf when findLeaf maps one with withheld audio', async () => {
    const logger = stubLogger();
    const repository = new PayloadContentRepository(
      clientReturning([leafWithStaleAudio(9)]),
      logger,
      config,
    );

    const leaf = await repository.findLeaf('9');

    expect(leaf.summary).not.toHaveProperty('audio');
    expect(logger.warn).toHaveBeenCalledTimes(1);

    const [payload, message] = vi.mocked(logger.warn).mock.calls[0] as [WarnCall, string];
    expect(message).toMatch(/withheld/u);
    expect(payload.kind).toBe('Leaf');
    expect(payload.warnings[0]).toMatch(/stale textDigest/u);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a warning and still serves the Leaf when listLeavesForTrack maps one with withheld audio', async () => {
    const logger = stubLogger();
    const repository = new PayloadContentRepository(
      clientReturning([leafWithStaleAudio(9)]),
      logger,
      config,
    );

    const leaves = await repository.listLeavesForTrack('1');

    expect(leaves).toHaveLength(1);
    expect(leaves[0]?.summary).not.toHaveProperty('audio');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('does not log a warning for a Leaf with no audio at all', async () => {
    const logger = stubLogger();
    const clean = leafWithStaleAudio(9);
    const withoutAudio: CmsLeaf = { ...clean, summary: { body: 'The current text.', audio: [] } };
    const repository = new PayloadContentRepository(clientReturning([withoutAudio]), logger, config);

    await repository.findLeaf('9');

    expect(logger.warn).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* Media URLs — MEDIA_BASE_URL vs CONTENT_API_URL (PILOT-1)                    */
/* -------------------------------------------------------------------------- */

describe('media URLs — MEDIA_BASE_URL vs CONTENT_API_URL', () => {
  it("builds every media URL on MEDIA_BASE_URL's host when it provably differs from CONTENT_API_URL", async () => {
    const twoHosts: AppConfig = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
      AUTH_JWT_SECRET: 'x'.repeat(48),
      CONTENT_API_URL: 'http://cms-private.internal:3001/api',
      MEDIA_BASE_URL: 'https://cdn.example.test',
    });
    const repository = new PayloadContentRepository(
      clientWith([maximalCmsTrack()], [maximalCmsLeaf()]),
      stubLogger(),
      twoHosts,
    );

    const track = await repository.findTrack('1');
    const leaf = await repository.findLeaf('244');

    const mediaUrls = [
      track.coverUrl,
      leaf.scenario.image?.url,
      leaf.stickyNotes.diagram?.url,
      leaf.summary.audio?.[0]?.url,
      leaf.scenario.audio?.[0]?.url,
      leaf.payoff.audio?.[0]?.url,
      leaf.takeaway.audio?.[0]?.url,
    ];

    for (const url of mediaUrls) {
      expect(url, 'expected every media field to be present').toBeDefined();
      expect(url?.startsWith('https://cdn.example.test/')).toBe(true);
      expect(url?.startsWith('http://cms-private.internal:3001')).toBe(false);
    }
  });

  it('resolves the same way through the LIST paths, not only findTrack/findLeaf', async () => {
    // `listTracks` and `listLeavesForTrack` are separate call sites in
    // `content.repository.ts` from `findTrack`/`findLeaf` — same `mapTrack`/`mapLeaf`
    // call, but a different line, and mutation-checking found this: reverting either
    // list variant's `baseUrl` argument back to `CONTENT_API_URL` left every other test
    // in this file green.
    const twoHosts: AppConfig = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
      AUTH_JWT_SECRET: 'x'.repeat(48),
      CONTENT_API_URL: 'http://cms-private.internal:3001/api',
      MEDIA_BASE_URL: 'https://cdn.example.test',
    });
    const repository = new PayloadContentRepository(
      clientWith([maximalCmsTrack()], [maximalCmsLeaf()]),
      stubLogger(),
      twoHosts,
    );

    const { tracks } = await repository.listTracks(1, 20);
    const [leaf] = await repository.listLeavesForTrack('1');

    expect(tracks[0]?.coverUrl).toBe('https://cdn.example.test/api/media/file/cover.png');
    expect(leaf?.scenario.image?.url).toBe('https://cdn.example.test/api/media/file/scenario.png');
  });

  it('keeps every media URL identical to before this change when MEDIA_BASE_URL is unset', async () => {
    // `config` (module-level) sets neither variable, so both fall back to their
    // pre-PILOT-1 defaults — pinned to the exact string, not just "resolved", since
    // that is the actual acceptance criterion: byte-identical, not merely non-crashing.
    const repository = new PayloadContentRepository(
      clientWith([maximalCmsTrack()], [maximalCmsLeaf()]),
      stubLogger(),
      config,
    );

    const track = await repository.findTrack('1');
    const leaf = await repository.findLeaf('244');

    expect(track.coverUrl).toBe('http://127.0.0.1:3001/api/media/file/cover.png');
    expect(leaf.scenario.image?.url).toBe('http://127.0.0.1:3001/api/media/file/scenario.png');
    expect(leaf.stickyNotes.diagram?.url).toBe('http://127.0.0.1:3001/api/media/file/diagram.png');
    expect(leaf.summary.audio?.[0]?.url).toBe(
      'http://127.0.0.1:3001/api/media/file/summary-female.mp3',
    );
    expect(leaf.scenario.audio?.[0]?.url).toBe(
      'http://127.0.0.1:3001/api/media/file/scenario-female.mp3',
    );
    expect(leaf.payoff.audio?.[0]?.url).toBe(
      'http://127.0.0.1:3001/api/media/file/payoff-female.mp3',
    );
    expect(leaf.takeaway.audio?.[0]?.url).toBe(
      'http://127.0.0.1:3001/api/media/file/takeaway-female.mp3',
    );
  });

  it(
    "the maximal-fixture contract test (manager.md): every optional media field survives " +
      'the round trip through the real repository, none dropped, all on the right host',
    async () => {
      // The WP15 lesson, named directly in the handoff: a dropped optional field is
      // indistinguishable from one that was never there, unless a test author
      // populates every one of them and checks each survives. `keepValid`/`requireValid`
      // sit between the client and this assertion exactly as they do in production —
      // nothing here is a shortcut around the real mapping and validation path.
      const twoHosts: AppConfig = loadConfig({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
        AUTH_JWT_SECRET: 'x'.repeat(48),
        CONTENT_API_URL: 'http://cms-private.internal:3001/api',
        MEDIA_BASE_URL: 'https://cdn.example.test',
      });
      const logger = stubLogger();
      const repository = new PayloadContentRepository(
        clientWith([maximalCmsTrack()], [maximalCmsLeaf()]),
        logger,
        twoHosts,
      );

      const track = await repository.findTrack('1');
      const leaf = await repository.findLeaf('244');

      // Nothing withheld — if any of the six media fields below were dropped (a stale
      // digest, a validation failure), it would come with a warn/error log, same as
      // the VO-1.1 tests above.
      expect(logger.error).not.toHaveBeenCalled();

      expect(track.coverUrl).toBe('https://cdn.example.test/api/media/file/cover.png');
      expect(leaf.scenario.image).toEqual({
        url: 'https://cdn.example.test/api/media/file/scenario.png',
        alt: 'A scenario illustration.',
        width: 800,
        height: 600,
      });
      expect(leaf.stickyNotes.diagram).toEqual({
        url: 'https://cdn.example.test/api/media/file/diagram.png',
        alt: 'A diagram.',
        width: 800,
        height: 600,
        spec: '{"kind":"contrast"}',
        specFormat: 'json',
      });
      expect(leaf.summary.audio).toEqual([
        expect.objectContaining({
          narrator: 'female',
          url: 'https://cdn.example.test/api/media/file/summary-female.mp3',
        }),
      ]);
      expect(leaf.scenario.audio).toEqual([
        expect.objectContaining({
          narrator: 'female',
          url: 'https://cdn.example.test/api/media/file/scenario-female.mp3',
        }),
      ]);
      expect(leaf.payoff.audio).toEqual([
        expect.objectContaining({
          narrator: 'female',
          url: 'https://cdn.example.test/api/media/file/payoff-female.mp3',
        }),
      ]);
      expect(leaf.takeaway.audio).toEqual([
        expect.objectContaining({
          narrator: 'female',
          url: 'https://cdn.example.test/api/media/file/takeaway-female.mp3',
        }),
      ]);
      // stickyNotes has no narrated field, so its audio is always dropped — see
      // `maximalCmsLeaf`'s own docstring. Asserted here so a future change that made it
      // survive (a schema change letting it through) would be caught as a surprise.
      expect(leaf.stickyNotes).not.toHaveProperty('audio');
    },
  );
});

/* -------------------------------------------------------------------------- */
/* listTracks query — HIDE_PLACEHOLDER_CONTENT drives the filter, not NODE_ENV */
/* -------------------------------------------------------------------------- */

describe('listTracks query — HIDE_PLACEHOLDER_CONTENT (PILOT-1)', () => {
  const configWith = (nodeEnv: string, hidePlaceholderContent: string): AppConfig =>
    loadConfig({
      NODE_ENV: nodeEnv,
      DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
      AUTH_JWT_SECRET: 'x'.repeat(48),
      HIDE_PLACEHOLDER_CONTENT: hidePlaceholderContent,
    });

  /**
   * A `get` mock kept as its own local, rather than read back off `PayloadClient`
   * (`@typescript-eslint/unbound-method` — `PayloadClient.get` is a real class method,
   * and detaching it from its instance to hand to `expect`/`vi.mocked` trips the rule
   * even though this particular one is a mock).
   */
  function emptyTrackClient(): { readonly client: PayloadClient; readonly get: ReturnType<typeof vi.fn> } {
    const get = vi.fn().mockResolvedValue({
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 1,
      hasNextPage: false,
    } satisfies PayloadListResponse<CmsTrack>);

    return { client: { get } as unknown as PayloadClient, get };
  }

  it('sends the placeholder-exclusion filter when the flag is true, even outside production', async () => {
    const { client, get } = emptyTrackClient();
    const repository = new PayloadContentRepository(client, stubLogger(), configWith('development', 'true'));

    await repository.listTracks(1, 20);

    expect(get).toHaveBeenCalledWith(
      '/tracks',
      expect.objectContaining({ 'where[isPlaceholder][not_equals]': 'true' }),
    );
  });

  it('omits the placeholder-exclusion filter when the flag is false, even in production', async () => {
    // The inverse case, and the one `z.coerce.boolean()` would have gotten wrong: an
    // explicit "false" in production must still turn the filter off.
    const { client, get } = emptyTrackClient();
    const repository = new PayloadContentRepository(client, stubLogger(), configWith('production', 'false'));

    await repository.listTracks(1, 20);

    const [, query] = get.mock.calls[0] as [string, Record<string, unknown>];
    expect(query).not.toHaveProperty('where[isPlaceholder][not_equals]');
  });

  it("keys the cache on the flag, not on NODE_ENV, so two flag values never share a cache entry", async () => {
    // A single repository instance's config is fixed for its lifetime (config is
    // frozen), so this is a same-process, same-instance regression guard on the key
    // *string* itself: the query for flag=true and the query for flag=false must be
    // distinguishable, which `content.repository.ts`'s cache key already encodes as
    // `hidePlaceholders ? 'published' : 'all'`. Proven here via the observable
    // consequence — the client is asked twice, with different query shapes — rather
    // than reaching into the private `TtlCache`.
    const { client, get } = emptyTrackClient();
    const onRepo = new PayloadContentRepository(client, stubLogger(), configWith('development', 'true'));
    const offRepo = new PayloadContentRepository(client, stubLogger(), configWith('development', 'false'));

    await onRepo.listTracks(1, 20);
    await offRepo.listTracks(1, 20);

    const calls = get.mock.calls as [string, Record<string, unknown>][];
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[1]).toHaveProperty('where[isPlaceholder][not_equals]');
    expect(calls[1]?.[1]).not.toHaveProperty('where[isPlaceholder][not_equals]');
  });
});
