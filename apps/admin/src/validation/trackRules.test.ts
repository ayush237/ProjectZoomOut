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

/* -------------------------------------------------------------------------- */
/* A cover stored as a Payload media path (GUARD-1 A)                          */
/* -------------------------------------------------------------------------- */

/**
 * What the backend does with a stored cover (`resolveMediaUrl` in
 * `apps/backend/src/content/content.mapper.ts`): a value that starts with `/` is
 * resolved with `new URL(value, MEDIA_BASE_URL)`. Mirrored here so a test can show that
 * a shape it expects the rule to refuse really does land somewhere the media host is not
 * — otherwise a table of rejected strings only proves the rule agrees with itself.
 */
const MEDIA_BASE = 'http://192.168.1.9:3001';
const MEDIA_FOLDER = `${MEDIA_BASE}/api/media/file/`;

function resolvesAsTheBackendWould(storedValue: string): string {
  return new URL(storedValue, MEDIA_BASE).toString();
}

describe('checkCoverUrlIsImage — a cover stored as a Payload media path', () => {
  // The two published Tracks' covers, in the form Payload stores for an upload. The
  // absolute form broke both covers every time the Mac's LAN address changed.
  it.each([
    '/api/media/file/track-42-cover-01.png',
    '/api/media/file/track-50-cover-01.png',
    '/api/media/file/cover.jpg',
    '/api/media/file/cover.jpeg',
    '/api/media/file/cover.webp',
    '/api/media/file/cover.avif',
    '/api/media/file/cover.gif',
    '/api/media/file/COVER.PNG',
  ])('accepts %s', (coverUrl) => {
    expect(checkCoverUrlIsImage(completeTrack({ coverUrl })).ok).toBe(true);
  });

  it('ignores a query string, as it does for an absolute cover', () => {
    const withParams = '/api/media/file/track-50-cover-01.png?v=2';

    expect(checkCoverUrlIsImage(completeTrack({ coverUrl: withParams })).ok).toBe(true);
  });

  it('lets a Track with a media-path cover publish', () => {
    const track = completeTrack({ coverUrl: '/api/media/file/track-50-cover-01.png' });

    expect(validateTrack(track, true).ok).toBe(true);
  });

  it('only accepts paths that resolve onto the media host, inside the media folder', () => {
    // The premise of the whole rule, checked against the URL parser rather than argued:
    // every accepted shape stays on the host the backend resolves it against.
    for (const coverUrl of [
      '/api/media/file/track-50-cover-01.png',
      '/api/media/file/COVER.PNG',
      '/api/media/file/track-50-cover-01.png?v=2',
    ]) {
      expect(resolvesAsTheBackendWould(coverUrl).startsWith(MEDIA_FOLDER)).toBe(true);
    }
  });

  // Starts with a slash, so `resolveMediaUrl` resolves it — but not onto the media folder.
  it.each([
    ['an absolute path outside the media folder', '/cover.png'],
    ['a sibling of the media folder', '/api/media/cover.png'],
    ['the media folder name with no slash after it', '/api/media/filecover.png'],
    ['the media folder in the wrong case', '/API/MEDIA/FILE/cover.png'],
    ['another API route', '/api/tracks/42/cover.png'],
  ])('rejects %s', (_shape, coverUrl) => {
    expect(checkCoverUrlIsImage(completeTrack({ coverUrl })).ok).toBe(false);
  });

  // `resolveMediaUrl` hands any `/`-prefixed value to `new URL(value, base)`, and the URL
  // parser reads these as an authority, so the "relative" value names another host. The
  // `/api/media/file/` after the host is deliberate: it is the shape a check on the
  // resolved *path* alone would wave through.
  it.each([
    ['a protocol-relative URL', '//evil.test/cover.png'],
    [
      'a protocol-relative URL that repeats the media folder',
      '//evil.test/api/media/file/cover.png',
    ],
    ['a protocol-relative URL written with a backslash', '/\\evil.test/api/media/file/cover.png'],
    [
      'a protocol-relative URL with a tab the parser strips',
      '/\t/evil.test/api/media/file/cover.png',
    ],
  ])('rejects %s', (_shape, coverUrl) => {
    expect(checkCoverUrlIsImage(completeTrack({ coverUrl })).ok).toBe(false);
  });

  it('rejects them because they really do resolve off the media host', () => {
    // Guards the test data above: were any of these actually harmless, rejecting it
    // would be over-reach and the table would be asserting something false.
    for (const coverUrl of [
      '//evil.test/cover.png',
      '//evil.test/api/media/file/cover.png',
      '/\\evil.test/api/media/file/cover.png',
      '/\t/evil.test/api/media/file/cover.png',
    ]) {
      expect(new URL(resolvesAsTheBackendWould(coverUrl)).origin).not.toBe(MEDIA_BASE);
    }
  });

  // These begin with the media folder, so a prefix check on the stored text alone accepts
  // them; the URL parser resolves the dot segments and the path ends up outside it.
  it.each([
    ['a ".." escape', '/api/media/file/../../cover.png'],
    ['a ".." escape out of one level', '/api/media/file/../cover.png'],
    ['a percent-encoded ".." escape', '/api/media/file/%2e%2e/%2e%2e/cover.png'],
    ['an upper-case percent-encoded ".." escape', '/api/media/file/%2E%2E/cover.png'],
    ['a half-encoded ".." escape', '/api/media/file/.%2e/cover.png'],
    ['a backslash ".." escape', '/api/media/file/..\\..\\cover.png'],
  ])('rejects %s', (_shape, coverUrl) => {
    expect(checkCoverUrlIsImage(completeTrack({ coverUrl })).ok).toBe(false);
  });

  it('rejects those escapes because they really do leave the media folder', () => {
    for (const coverUrl of [
      '/api/media/file/../../cover.png',
      '/api/media/file/../cover.png',
      '/api/media/file/%2e%2e/%2e%2e/cover.png',
      '/api/media/file/%2E%2E/cover.png',
      '/api/media/file/.%2e/cover.png',
      '/api/media/file/..\\..\\cover.png',
    ]) {
      expect(resolvesAsTheBackendWould(coverUrl).startsWith(MEDIA_FOLDER)).toBe(false);
    }
  });

  // The extension check is what keeps a page from passing as an image; it has to hold on
  // this branch too, and read the path rather than the whole string.
  it.each([
    ['no extension', '/api/media/file/track-50-cover-01'],
    ['no file name at all', '/api/media/file/'],
    ['a document extension', '/api/media/file/cover.html'],
    ['an image extension that is not the end', '/api/media/file/cover.png.exe'],
    ['an image name only in the query string', '/api/media/file/page?thumb=cover.png'],
    ['an image name only in the fragment', '/api/media/file/page#cover.png'],
  ])('rejects a media path with %s', (_shape, coverUrl) => {
    expect(checkCoverUrlIsImage(completeTrack({ coverUrl })).ok).toBe(false);
  });

  it('still reports every other relative value as not a cover', () => {
    // No leading slash: `resolveMediaUrl` leaves these alone, and `trackSchema` refuses
    // them at serve time. The CMS has to be at least as strict.
    for (const coverUrl of ['api/media/file/cover.png', 'media/cover.png', './cover.png']) {
      expect(checkCoverUrlIsImage(completeTrack({ coverUrl })).ok).toBe(false);
    }
  });

  it('blocks publishing a Track whose cover would resolve off the media host', () => {
    const track = completeTrack({ coverUrl: '//evil.test/api/media/file/cover.png' });

    expect(validateTrack(track, true).ok).toBe(false);
  });

  it('does not block saving that Track as a draft', () => {
    const track = completeTrack({ coverUrl: '//evil.test/api/media/file/cover.png' });

    expect(validateTrack(track, false).ok).toBe(true);
  });
});

describe('checkCoverUrlIsImage — what the messages tell the author', () => {
  function messageFor(coverUrl: string): string {
    const result = checkCoverUrlIsImage(completeTrack({ coverUrl }));

    if (result.ok) {
      throw new Error(`Expected ${coverUrl} to be rejected`);
    }

    return result.violations.map((violation) => violation.message).join(' | ');
  }

  it('names the media path as the form to use when a value is not an address at all', () => {
    const message = messageFor('cover.png');

    expect(message).toMatch(/\/api\/media\/file\//u);
    expect(message).toMatch(/https:\/\//u);
  });

  it('names the media folder when a path outside it is given', () => {
    expect(messageFor('/cover.png')).toMatch(/\/api\/media\/file\//u);
  });

  it('says a path left the media folder, rather than that it has to start there', () => {
    // Such a value does start with `/api/media/file/`; "has to start with" would be
    // wrong, and the author would be left staring at a prefix that is already right.
    const message = messageFor('/api/media/file/../../cover.png');

    expect(message).toMatch(/leaves/iu);
    expect(message).not.toMatch(/has to start/iu);
  });

  it('tells the author what a media path must end in', () => {
    expect(messageFor('/api/media/file/cover')).toMatch(/\.png/u);
  });

  it('names the media path when the scheme is not http or https', () => {
    expect(messageFor('data:image/png;base64,iVBORw0KGgo=')).toMatch(/\/api\/media\/file\//u);
  });
});
