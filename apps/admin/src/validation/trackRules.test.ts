import { describe, expect, it } from 'vitest';

import {
  checkDisclaimerPresent,
  checkPurchaseLinkPresent,
  validateTrack,
} from './trackRules';
import type { TrackDocumentInput } from './types';

function completeTrack(overrides: Partial<TrackDocumentInput> = {}): TrackDocumentInput {
  return {
    bookTitle: 'Placeholder Book',
    disclaimer: 'ZoomOut is not affiliated with or endorsed by the author or publisher.',
    purchaseLinks: [{ retailer: 'Example Books', url: 'https://example.test/book' }],
    ...overrides,
  };
}

describe('checkDisclaimerPresent', () => {
  it('passes when a disclaimer is set', () => {
    expect(checkDisclaimerPresent(completeTrack()).ok).toBe(true);
  });

  it('fails when the disclaimer is missing', () => {
    expect(checkDisclaimerPresent(completeTrack({ disclaimer: null })).ok).toBe(false);
  });

  it('fails when the disclaimer is empty', () => {
    expect(checkDisclaimerPresent(completeTrack({ disclaimer: '' })).ok).toBe(false);
  });

  it('fails when the disclaimer is only whitespace', () => {
    expect(checkDisclaimerPresent(completeTrack({ disclaimer: '   ' })).ok).toBe(false);
  });

  it('tells the author what the disclaimer has to say', () => {
    const result = checkDisclaimerPresent(completeTrack({ disclaimer: null }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.message).toMatch(/not affiliated with or endorsed by/u);
    }
  });
});

describe('checkPurchaseLinkPresent', () => {
  it('passes with one complete purchase link', () => {
    expect(checkPurchaseLinkPresent(completeTrack()).ok).toBe(true);
  });

  it('fails with no purchase links', () => {
    expect(checkPurchaseLinkPresent(completeTrack({ purchaseLinks: [] })).ok).toBe(false);
  });

  it('fails when purchaseLinks is absent entirely', () => {
    expect(checkPurchaseLinkPresent({ bookTitle: 'x' }).ok).toBe(false);
  });

  it('fails when the only link has a retailer but no URL', () => {
    const track = completeTrack({ purchaseLinks: [{ retailer: 'Example Books', url: '' }] });

    expect(checkPurchaseLinkPresent(track).ok).toBe(false);
  });

  it('fails when the only link has a URL but no retailer', () => {
    const track = completeTrack({ purchaseLinks: [{ retailer: null, url: 'https://example.test' }] });

    expect(checkPurchaseLinkPresent(track).ok).toBe(false);
  });

  it('passes when at least one link among several is complete', () => {
    const track = completeTrack({
      purchaseLinks: [
        { retailer: 'Half Empty', url: '' },
        { retailer: 'Example Books', url: 'https://example.test/book' },
      ],
    });

    expect(checkPurchaseLinkPresent(track).ok).toBe(true);
  });
});

describe('validateTrack', () => {
  it('allows a draft Track with neither disclaimer nor purchase link', () => {
    // Both rules are publish-gated: an author starting a Track has neither yet, and
    // blocking the save would make the editor unusable.
    expect(validateTrack({ bookTitle: 'Just started' }, false).ok).toBe(true);
  });

  it('blocks publishing that same Track', () => {
    expect(validateTrack({ bookTitle: 'Just started' }, true).ok).toBe(false);
  });

  it('reports both legal requirements at once', () => {
    const result = validateTrack({ bookTitle: 'Just started' }, true);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((v) => v.path).sort()).toEqual(['disclaimer', 'purchaseLinks']);
    }
  });

  it('passes a complete Track on publish', () => {
    expect(validateTrack(completeTrack(), true).ok).toBe(true);
  });
});
