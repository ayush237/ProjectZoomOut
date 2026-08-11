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
 * A published Track's cover must actually be an image.
 *
 * `checkCoverUrlPresent` above only asks whether the field is filled, and the seeded
 * Track passed it with an Amazon **product page** URL — so every Explore card in WP7
 * silently rendered the fallback icon. Nothing was broken enough to fail; it just
 * looked unfinished, which is the kind of defect that survives review.
 *
 * **This is an honest heuristic, not proof.** It checks that the URL parses, is http(s),
 * and that its *path* ends in an image extension. It deliberately does not fetch the
 * URL: a `beforeChange` hook that makes a network call blocks every save on someone
 * else's uptime, turns an offline laptop into a CMS that cannot save, and would still
 * only prove what the server returned at that moment. What it catches is the whole of
 * the observed failure — a page URL where an image belongs. What it misses is a URL
 * that ends in `.png` and serves something else, which no cheap check can catch and
 * which nobody has done by accident.
 */
export function checkCoverUrlIsImage(track: TrackDocumentInput): RuleResult {
  // Absence is `checkCoverUrlPresent`'s to report. Failing twice for one empty field
  // gives the author two messages describing one problem.
  if (!hasText(track.coverUrl)) {
    return PASSED;
  }

  const raw = track.coverUrl.trim();
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return failed(
      'coverUrl',
      'The cover image URL is not a valid URL. It should start with https:// and point ' +
        'directly at an image file.',
    );
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return failed('coverUrl', 'The cover image URL must be an http or https address.');
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
