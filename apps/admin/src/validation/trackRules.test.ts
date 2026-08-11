import { describe, expect, it } from 'vitest';

import {
  checkCoverUrlIsImage,
  checkCoverUrlPresent,
  checkDisclaimerPresent,
  checkPublisherPresent,
  checkPurchaseLinkPresent,
  validateTrack,
} from './trackRules';
import type { TrackDocumentInput } from './types';

function completeTrack(overrides: Partial<TrackDocumentInput> = {}): TrackDocumentInput {
  return {
    bookTitle: 'Placeholder Book',
    publisher: 'Placeholder Publisher',
    coverUrl: 'https://example.test/cover.png',
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

/* -------------------------------------------------------------------------- */
/* publisher and coverUrl required to publish (frozen 2026-08-08)              */
/* -------------------------------------------------------------------------- */

describe('checkPublisherPresent', () => {
  it('passes when a publisher is set', () => {
    expect(checkPublisherPresent(completeTrack()).ok).toBe(true);
  });

  it.each([null, '', '   '])('fails when the publisher is %p', (publisher) => {
    // The gate published a Track with this null, which trackSchema would then have
    // rejected at serve time — the CMS was the weaker of the two gates.
    expect(checkPublisherPresent(completeTrack({ publisher })).ok).toBe(false);
  });

  it('tells a self-publishing author what to put instead', () => {
    const result = checkPublisherPresent(completeTrack({ publisher: null }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.message).toMatch(/Independently published/u);
    }
  });
});

describe('checkCoverUrlPresent', () => {
  it('passes when a cover URL is set', () => {
    expect(checkCoverUrlPresent(completeTrack()).ok).toBe(true);
  });

  it.each([null, '', '   '])('fails when the cover URL is %p', (coverUrl) => {
    expect(checkCoverUrlPresent(completeTrack({ coverUrl })).ok).toBe(false);
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

  it('reports every publish requirement at once rather than one per attempt', () => {
    const result = validateTrack({ bookTitle: 'Just started' }, true);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((v) => v.path).sort()).toEqual([
        'coverUrl',
        'disclaimer',
        'publisher',
        'purchaseLinks',
      ]);
    }
  });

  it('passes a complete Track on publish', () => {
    expect(validateTrack(completeTrack(), true).ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* The cover must be an image, not a page                                      */
/* -------------------------------------------------------------------------- */

describe('checkCoverUrlIsImage', () => {
  it.each([
    'https://example.test/cover.png',
    'https://example.test/cover.jpg',
    'https://example.test/deep/path/cover.jpeg',
    'https://example.test/cover.webp',
    'https://example.test/cover.PNG',
  ])('accepts %s', (coverUrl) => {
    expect(checkCoverUrlIsImage(completeTrack({ coverUrl })).ok).toBe(true);
  });

  it('accepts an image URL carrying resize parameters', () => {
    // Query strings legitimately carry sizing; matching the whole URL instead of the
    // path would reject every CDN-served cover.
    const withParams = 'https://images.example.test/cover.jpg?width=400&quality=80';

    expect(checkCoverUrlIsImage(completeTrack({ coverUrl: withParams })).ok).toBe(true);
  });

  it('rejects a retailer product page', () => {
    // The observed failure: the seeded Track pointed at an Amazon product page, so
    // every Explore card rendered the fallback icon and nothing failed loudly.
    const productPage =
      'https://www.amazon.in/Mountain-You-Transforming-Self-Sabotage/dp/B09WXXRNZY';

    expect(checkCoverUrlIsImage(completeTrack({ coverUrl: productPage })).ok).toBe(false);
  });

  it('rejects a page whose query string merely mentions an image', () => {
    const sneaky = 'https://example.test/product/page?thumb=cover.png';

    expect(checkCoverUrlIsImage(completeTrack({ coverUrl: sneaky })).ok).toBe(false);
  });

  it('rejects something that is not a URL at all', () => {
    expect(checkCoverUrlIsImage(completeTrack({ coverUrl: 'cover.png' })).ok).toBe(false);
  });

  it('rejects a non-http scheme', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgo=';

    expect(checkCoverUrlIsImage(completeTrack({ coverUrl: dataUri })).ok).toBe(false);
  });

  it('says what to do, not just what is wrong', () => {
    const result = checkCoverUrlIsImage(
      completeTrack({ coverUrl: 'https://example.test/product/page' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.message).toMatch(/right-click/iu);
    }
  });

  it('stays silent when the field is empty', () => {
    // Absence belongs to `checkCoverUrlPresent`. Two messages for one empty field is
    // worse guidance than one.
    expect(checkCoverUrlIsImage(completeTrack({ coverUrl: null })).ok).toBe(true);
  });

  it('blocks publishing a Track whose cover is a page', () => {
    const result = validateTrack(
      completeTrack({ coverUrl: 'https://example.test/product/page' }),
      true,
    );

    expect(result.ok).toBe(false);
  });

  it('does not block saving that Track as a draft', () => {
    // Publish-gated like every other Track rule: an author mid-edit is not an error.
    const result = validateTrack(
      completeTrack({ coverUrl: 'https://example.test/product/page' }),
      false,
    );

    expect(result.ok).toBe(true);
  });
});
