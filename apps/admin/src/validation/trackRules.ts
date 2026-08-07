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

/** Rules enforced only when a Track is being published. */
export const TRACK_PUBLISH_RULES = [checkDisclaimerPresent, checkPurchaseLinkPresent] as const;

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
