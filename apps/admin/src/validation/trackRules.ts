import {
  failed,
  hasText,
  PASSED,
  type RuleResult,
  type TrackDocumentInput,
} from './types';

/**
 * Content invariants for a Track.
 *
 * Both rules below are publish-gated. Both encode requirements from `LEGAL.md` rather
 * than editorial preference, which is why they block publishing rather than merely
 * warning: they are the operational half of the fair-use position, and a Track that
 * reaches a reader without them is the failure mode the strategy exists to prevent.
 */

/**
 * A published Track must carry a non-endorsement disclaimer.
 *
 * Every competitor relying on fair use pairs it with a disclaimer (`LEGAL.md`,
 * competitive landscape). Shipping a Track that implies the author endorses ZoomOut
 * is both a legal exposure and a false-attribution risk.
 */
export function checkDisclaimerPresent(track: TrackDocumentInput): RuleResult {
  if (hasText(track.disclaimer)) {
    return PASSED;
  }

  return failed(
    'disclaimer',
    'A Track cannot be published without a non-endorsement disclaimer. State that ' +
      'ZoomOut is not affiliated with or endorsed by the author or publisher.',
  );
}

/**
 * A published Track must link to somewhere the book can be bought.
 *
 * Purchase-forward framing is the direct mitigation for the market-substitution
 * factor — the factor that decided *Thomson Reuters v. Ross Intelligence* against the
 * defendant (`LEGAL.md`). A Track positioned as a complement to the book, with no way
 * to reach the book, is not a complement.
 */
export function checkPurchaseLinkPresent(track: TrackDocumentInput): RuleResult {
  const usableLinks = (track.purchaseLinks ?? []).filter(
    (link) => hasText(link.retailer) && hasText(link.url),
  );

  if (usableLinks.length > 0) {
    return PASSED;
  }

  return failed(
    'purchaseLinks',
    'A Track cannot be published without at least one purchase link. Add a retailer ' +
      'name and a URL where the book can be bought.',
  );
}

/**
 * A published Track must name its publisher.
 *
 * A compliance field, not a display one. `LEGAL.md`'s curation policy excludes
 * publishers in active AI litigation, and that check cannot be performed on a Track
 * that does not record who published the book.
 */
export function checkPublisherPresent(track: TrackDocumentInput): RuleResult {
  if (hasText(track.publisher)) {
    return PASSED;
  }

  return failed(
    'publisher',
    'A Track cannot be published without a publisher. Use "Independently published" ' +
      'for a self-published title.',
  );
}

/**
 * A published Track must have a cover image.
 *
 * Load-bearing for Explore in WP7 — a Track with no cover is a blank card in a
 * browsing surface whose whole job is to make books look worth opening.
 *
 * Both this and `checkPublisherPresent` were added at the schema-freeze gate
 * (2026-08-08), after a Track published with both fields null. `trackSchema` in
 * `packages/shared` already declared them non-optional, so the CMS was the weaker of
 * the two gates and could emit a document the domain model would reject at serve
 * time. This is the CMS catching up, not a new constraint.
 */
export function checkCoverUrlPresent(track: TrackDocumentInput): RuleResult {
  if (hasText(track.coverUrl)) {
    return PASSED;
  }

  return failed('coverUrl', 'A Track cannot be published without a cover image URL.');
}

/**
 * Image file extensions a cover URL may end in.
 *
 * A closed list rather than "anything with a dot": the failure being prevented is a
 * *web page* URL passing as an image, and page URLs frequently end in something that
 * looks like an extension.
 */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'] as const;

/**
 * Where Payload serves an uploaded image from, and the form it stores for one:
 * `/api/media/file/<file name>` — the `url` on a Media document.
 */
const MEDIA_PATH_PREFIX = '/api/media/file/';

/**
 * A host for the URL parser to resolve a media path against, so the path can be
 * normalised the way the backend normalises it. Nothing is ever fetched from it:
 * `.invalid` is reserved (RFC 2606) and cannot resolve.
 */
const PARSE_ORIGIN = 'http://cms.invalid';

/** What an author is told a cover can be, wherever a message has to say so. */
const COVER_FORMS =
  `Use the path of an image uploaded in Media (${MEDIA_PATH_PREFIX}<file name>), which ` +
  'keeps working if the server moves, or a full https:// address that points directly at ' +
  'an image file.';

/**
 * A published Track's cover must actually be an image.
 *
 * `checkCoverUrlPresent` above only asks whether the field is filled, and the seeded
 * Track passed it with an Amazon **product page** URL — so every Explore card in WP7
 * silently rendered the fallback icon. Nothing was broken enough to fail; it just
 * looked unfinished, which is the kind of defect that survives review.
 *
 * **Two forms are accepted**, and a value belongs to exactly one of them by its first
 * character. A leading slash is a Payload media path — the form the Media document
 * stores, which the backend resolves against its own media host when it serves the
 * Track (`resolveMediaUrl`), so the cover follows the host when the host changes (an
 * absolute address broke both published covers each time the Mac's LAN address did).
 * Anything else has to be an absolute http(s) address, as before.
 *
 * **This is an honest heuristic, not proof.** It checks that the value is one of those
 * two forms and that its *path* ends in an image extension. It deliberately does not
 * fetch anything: a `beforeChange` hook that makes a network call blocks every save on
 * someone else's uptime, turns an offline laptop into a CMS that cannot save, and would
 * still only prove what the server returned at that moment. What it catches is the
 * whole of the observed failure — a page URL where an image belongs. What it misses is
 * a URL that ends in `.png` and serves something else, which no cheap check can catch
 * and which nobody has done by accident.
 */
export function checkCoverUrlIsImage(track: TrackDocumentInput): RuleResult {
  // Absence is `checkCoverUrlPresent`'s to report. Failing twice for one empty field
  // gives the author two messages describing one problem.
  if (!hasText(track.coverUrl)) {
    return PASSED;
  }

  const raw = track.coverUrl.trim();

  // The backend's own test for "resolve this against the media host" is `startsWith('/')`
  // (`resolveMediaUrl`), so this is where the two sides have to agree.
  if (raw.startsWith('/')) {
    return checkMediaPathCover(raw);
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return failed('coverUrl', `The cover image is not a usable address. ${COVER_FORMS}`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return failed(
      'coverUrl',
      `The cover image has to be an http or https address, or a media path. ${COVER_FORMS}`,
    );
  }

  // The path only — a query string legitimately carries resizing parameters, and
  // matching against the whole URL would accept `.../page?ref=x.png`.
  const path = url.pathname.toLowerCase();

  if (!IMAGE_EXTENSIONS.some((extension) => path.endsWith(extension))) {
    return failed(
      'coverUrl',
      'The cover image URL must point directly at an image file, not at a web page. ' +
        `It should end in one of: ${IMAGE_EXTENSIONS.join(', ')}. ` +
        'On a retailer product page, right-click the cover and copy the image address.',
    );
  }

  return PASSED;
}

/**
 * The slash-prefixed branch of `checkCoverUrlIsImage`: a Payload media path.
 *
 * "Starts with `/`" does not mean "on the media host". `resolveMediaUrl` hands any such
 * value to `new URL(value, MEDIA_BASE_URL)`, and the URL parser reads `//host/x.png`,
 * `/\host/x.png` and `/<tab>/host/x.png` as an authority — the stored "relative" value
 * then names another host, and a Track's cover is whatever that host serves. So the
 * value has to begin with the media folder *literally*, which none of those do.
 *
 * That alone is not enough, because a value can begin with the folder and still leave
 * it: `/api/media/file/../../x.png` is `/x.png` once the parser has resolved the dot
 * segments (`%2e%2e` and `..\` are dot segments to it too). So the folder is checked a
 * second time on the *normalised* path, which is also the path whose extension is read.
 *
 * Neither check can stand in for the other: the first is the only one that sees a
 * protocol-relative value that repeats the folder after the host
 * (`//evil.test/api/media/file/x.png`, whose normalised path looks fine), and the second
 * is the only one that sees an escape the literal text hides.
 */
function checkMediaPathCover(raw: string): RuleResult {
  if (!raw.startsWith(MEDIA_PATH_PREFIX)) {
    return failed(
      'coverUrl',
      `A cover that starts with / has to be a media path beginning ${MEDIA_PATH_PREFIX} — ` +
        `the path of an image uploaded in Media. ${COVER_FORMS}`,
    );
  }

  // Cannot throw: the value starts with `/` followed by a path character, so it is a
  // path-absolute reference and the parser takes the host from the base.
  const { pathname } = new URL(raw, PARSE_ORIGIN);

  if (!pathname.startsWith(MEDIA_PATH_PREFIX)) {
    return failed(
      'coverUrl',
      `The cover path leaves ${MEDIA_PATH_PREFIX} once its ".." segments are resolved. ` +
        'Use the path exactly as Media shows it for the uploaded image.',
    );
  }

  // The path only, as for an absolute cover: the query string and fragment are not the
  // file name.
  const path = pathname.toLowerCase();

  if (!IMAGE_EXTENSIONS.some((extension) => path.endsWith(extension))) {
    return failed(
      'coverUrl',
      'The cover path must name an image file. ' +
        `It should end in one of: ${IMAGE_EXTENSIONS.join(', ')}.`,
    );
  }

  return PASSED;
}

/** Rules enforced only when a Track is being published. */
export const TRACK_PUBLISH_RULES = [
  checkDisclaimerPresent,
  checkPurchaseLinkPresent,
  checkPublisherPresent,
  checkCoverUrlPresent,
  checkCoverUrlIsImage,
] as const;

export function validateTrack(track: TrackDocumentInput, isPublishing: boolean): RuleResult {
  if (!isPublishing) {
    return PASSED;
  }

  const violations = TRACK_PUBLISH_RULES.flatMap((rule) => {
    const result = rule(track);
    return result.ok ? [] : result.violations;
  });

  return violations.length === 0 ? PASSED : { ok: false, violations };
}
