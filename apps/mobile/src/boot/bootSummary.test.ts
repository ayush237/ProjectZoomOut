import { trackSchema, type Track } from '@zoomout/shared';
import { describe, expect, it } from 'vitest';

import { buildBootSummary } from './bootSummary';

/**
 * Doubles as the mobile workspace's proof that `packages/shared` resolves, typechecks
 * and runs here — the schema is parsed at runtime and the `Track` type is used at
 * compile time.
 */

const buildTrack = (overrides: Partial<Track> = {}): Track => ({
  ...trackSchema.parse({
    id: 'track-placeholder',
    bookTitle: 'Placeholder Book Title',
    author: 'Placeholder Author',
    publisher: 'Placeholder Publisher',
    coverUrl: 'https://example.test/cover.png',
    description: 'Placeholder description for the boot screen.',
    disclaimer: 'Placeholder non-endorsement disclaimer.',
    purchaseLinks: [{ retailer: 'Example Books', url: 'https://example.test/book' }],
    status: 'draft',
    leafCount: 20,
    createdAt: '2026-08-06T12:00:00.000Z',
    updatedAt: '2026-08-06T12:00:00.000Z',
  }),
  ...overrides,
});

describe('buildBootSummary', () => {
  it('uses the book title as the headline', () => {
    expect(buildBootSummary(buildTrack()).headline).toBe('Placeholder Book Title');
  });

  it('builds a byline from the author and Leaf count', () => {
    expect(buildBootSummary(buildTrack()).byline).toBe('Placeholder Author · 20 Leaves');
  });

  it('uses the singular form for a one-Leaf Track', () => {
    expect(buildBootSummary(buildTrack({ leafCount: 1 })).byline).toContain('1 Leaf');
  });

  it('surfaces the non-endorsement disclaimer', () => {
    expect(buildBootSummary(buildTrack()).disclaimer).toBe(
      'Placeholder non-endorsement disclaimer.',
    );
  });

  it('warns when the Track is placeholder content', () => {
    expect(buildBootSummary(buildTrack({ isPlaceholder: true })).placeholderWarning).toContain(
      'Placeholder content',
    );
  });

  it('shows no warning for real content', () => {
    expect(buildBootSummary(buildTrack({ isPlaceholder: false })).placeholderWarning).toBeNull();
  });
});
