import type { Leaf, Track } from '@zoomout/shared';
import { describe, expect, it, vi } from 'vitest';

import { loadConfig, type AppConfig } from '../config/env.js';
import type { AppLogger } from '../logging/logger.js';
import { ContentNotFoundError } from './content.errors.js';
import type { ContentRepository } from './content.repository.js';
import { ContentService } from './content.service.js';
import type { PayoffAccessPolicy } from './payoffAccess.js';

/**
 * The placeholder guard, tested across environments.
 *
 * `isProductionPublishable` shipped in WP0 with nothing calling it. These tests are
 * what make it load-bearing: the same content must be visible in development and
 * invisible in production, with nothing changing but an environment variable.
 */

const stubLogger = (): AppLogger =>
  ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }) as unknown as AppLogger;

const configFor = (nodeEnv: string): AppConfig =>
  loadConfig({
    NODE_ENV: nodeEnv,
    DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
    AUTH_JWT_SECRET: 'x'.repeat(48),
  });

const track = (overrides: Partial<Track> = {}): Track => ({
  id: 't1',
  bookTitle: 'Placeholder Book',
  author: 'Placeholder Author',
  publisher: 'Placeholder Publisher',
  coverUrl: 'https://example.test/cover.png',
  description: 'Description.',
  disclaimer: 'Not affiliated.',
  purchaseLinks: [{ retailer: 'R', url: 'https://example.test/b', isAffiliate: false }],
  status: 'published',
  leafCount: 1,
  acquisition: 'undocumented',
  isPlaceholder: true,
  createdAt: '2026-08-08T12:00:00.000Z',
  updatedAt: '2026-08-08T12:00:00.000Z',
  ...overrides,
});

const leaf = (overrides: Partial<Leaf> = {}): Leaf => ({
  id: 'l1',
  trackId: 't1',
  orderIndex: 0,
  title: 'Concept One',
  status: 'published',
  isPlaceholder: true,
  summary: { body: 'Summary.' },
  scenario: {
    prompt: 'Prompt?',
    options: [
      { id: 'o1', text: 'A', isCorrect: true },
      { id: 'o2', text: 'B', isCorrect: false },
      { id: 'o3', text: 'C', isCorrect: false },
    ],
  },
  payoff: { body: 'Payoff.' },
  stickyNotes: { notes: ['One', 'Two'] },
  takeaway: { body: 'Takeaway.' },
  sourceReferences: [],
  createdAt: '2026-08-08T12:00:00.000Z',
  updatedAt: '2026-08-08T12:00:00.000Z',
  ...overrides,
});

function repositoryReturning(tracks: Track[], leaves: Leaf[] = []): ContentRepository {
  return {
    listTracks: vi.fn().mockResolvedValue({
      tracks,
      page: 1,
      totalPages: 1,
      totalTracks: tracks.length,
    }),
    findTrack: vi.fn().mockImplementation((id: string) => {
      const found = tracks.find((t) => t.id === id);
      return found ? Promise.resolve(found) : Promise.reject(new ContentNotFoundError('Track'));
    }),
    listLeavesForTrack: vi.fn().mockResolvedValue(leaves),
    findLeaf: vi.fn().mockImplementation((id: string) => {
      const found = leaves.find((l) => l.id === id);
      return found ? Promise.resolve(found) : Promise.reject(new ContentNotFoundError('Leaf'));
    }),
  };
}

/** A payoff policy with a fixed answer, so delivery can be tested on either side of it. */
const policyReturning = (unlocked: boolean): PayoffAccessPolicy => ({
  isPayoffUnlocked: vi.fn().mockResolvedValue(unlocked),
});

const serviceIn = (
  nodeEnv: string,
  tracks: Track[],
  leaves: Leaf[] = [],
  payoffUnlocked = true,
): ContentService =>
  new ContentService(
    repositoryReturning(tracks, leaves),
    configFor(nodeEnv),
    stubLogger(),
    policyReturning(payoffUnlocked),
  );

const READER = '11111111-1111-4111-8111-111111111111';

/* -------------------------------------------------------------------------- */
/* Placeholder visibility                                                      */
/* -------------------------------------------------------------------------- */

describe('placeholder content', () => {
  it.each(['development', 'test'])('is visible in %s', async (nodeEnv) => {
    const result = await serviceIn(nodeEnv, [track({ isPlaceholder: true })]).listTracks(1, 20);

    expect(result.tracks).toHaveLength(1);
  });

  it('is invisible in production', async () => {
    const result = await serviceIn('production', [track({ isPlaceholder: true })]).listTracks(
      1,
      20,
    );

    expect(result.tracks).toHaveLength(0);
  });

  it('changes outcome by configuration alone', async () => {
    // Same content, same code path — only NODE_ENV differs.
    const content = [track({ isPlaceholder: true })];

    const inDev = await serviceIn('development', content).listTracks(1, 20);
    const inProd = await serviceIn('production', content).listTracks(1, 20);

    expect(inDev.tracks).toHaveLength(1);
    expect(inProd.tracks).toHaveLength(0);
  });

  it('leaves real content visible in production', async () => {
    const result = await serviceIn('production', [track({ isPlaceholder: false })]).listTracks(
      1,
      20,
    );

    expect(result.tracks).toHaveLength(1);
  });

  it('404s a placeholder Track fetched directly in production', async () => {
    const service = serviceIn('production', [track({ isPlaceholder: true })]);

    // 404 rather than 403: whether hidden content exists is not a reader's business.
    await expect(service.getTrack('t1')).rejects.toBeInstanceOf(ContentNotFoundError);
  });

  it('404s a placeholder Leaf fetched directly in production', async () => {
    const service = serviceIn('production', [track({ isPlaceholder: false })], [leaf()]);

    await expect(service.getLeaf('l1', READER)).rejects.toBeInstanceOf(ContentNotFoundError);
  });
});

/* -------------------------------------------------------------------------- */
/* Draft content is never servable                                             */
/* -------------------------------------------------------------------------- */

describe('draft content', () => {
  it.each(['development', 'production'])('is invisible in %s', async (nodeEnv) => {
    // Only the placeholder half of the rule is relaxed outside production; a draft is
    // never servable anywhere.
    const result = await serviceIn(nodeEnv, [
      track({ status: 'draft', isPlaceholder: false }),
    ]).listTracks(1, 20);

    expect(result.tracks).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Leaf delivery                                                               */
/* -------------------------------------------------------------------------- */

describe('getLeaf', () => {
  it('returns the Leaf with the answer key stripped', async () => {
    const service = serviceIn('development', [track()], [leaf()]);

    const result = await service.getLeaf('l1', READER);

    expect(JSON.stringify(result)).not.toContain('isCorrect');
  });

  it('keeps option ids and order so an answer can be submitted', async () => {
    const service = serviceIn('development', [track()], [leaf()]);

    const result = await service.getLeaf('l1', READER);

    expect(result.scenario.options.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
  });

  /* ------------------------------------------------------------------------ */
  /* The payoff gate                                                           */
  /* ------------------------------------------------------------------------ */

  it('withholds the payoff from a reader who has not earned it', async () => {
    const service = serviceIn('development', [track()], [leaf()], false);

    const result = await service.getLeaf('l1', READER);

    expect(result.payoffUnlocked).toBe(false);
    expect(result.payoff).toBeNull();
  });

  it('leaves no trace of the payoff prose in a locked response', async () => {
    // The body must be absent from the serialised object, not merely flagged — a
    // client that ignores `payoffUnlocked` must still have nothing to render.
    const service = serviceIn('development', [track()], [leaf()], false);

    const result = await service.getLeaf('l1', READER);

    expect(JSON.stringify(result)).not.toContain('Payoff.');
  });

  it('returns the payoff once it is unlocked', async () => {
    const service = serviceIn('development', [track()], [leaf()], true);

    const result = await service.getLeaf('l1', READER);

    expect(result.payoffUnlocked).toBe(true);
    expect(result.payoff?.body).toBe('Payoff.');
  });

  it('still returns every other slide while the payoff is locked', async () => {
    // Locking the payoff must not cost the reader the summary and scenario they need
    // in order to answer and unlock it.
    const service = serviceIn('development', [track()], [leaf()], false);

    const result = await service.getLeaf('l1', READER);

    expect(result.summary.body).toBe('Summary.');
    expect(result.scenario.prompt).toBe('Prompt?');
    expect(result.stickyNotes.notes).toHaveLength(2);
  });
});

describe('listLeaves', () => {
  it('returns metadata only, not slide bodies', async () => {
    const service = serviceIn('development', [track()], [leaf()]);

    const [summary] = await service.listLeaves('t1');

    expect(summary).toEqual({
      id: 'l1',
      trackId: 't1',
      orderIndex: 0,
      title: 'Concept One',
      isPlaceholder: true,
    });
  });

  it('refuses to list the contents of a Track the reader cannot see', async () => {
    // Going straight to the contents endpoint must not bypass Track visibility.
    const service = serviceIn('production', [track({ isPlaceholder: true })], [leaf()]);

    await expect(service.listLeaves('t1')).rejects.toBeInstanceOf(ContentNotFoundError);
  });
});
