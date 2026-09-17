import { createHash } from 'node:crypto';

import type { Leaf as CmsLeaf } from '@zoomout/shared/cms';
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
