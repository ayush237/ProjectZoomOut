import { isProductionPublishable } from '@zoomout/shared';

import type { AppConfig } from '../config/env.js';

/**
 * Whether a piece of content may be served, in a given environment.
 *
 * Extracted from `ContentService` in WP4 rather than left as a private method, because
 * the learning loop needs the same answer. Grading has to fetch the *full* Leaf through
 * `ContentRepository` to see the answer key, which bypasses `ContentService` and with
 * it the placeholder guard — so the guard has to be reachable from both, and there must
 * be exactly one copy of it. Two copies would drift, and the direction they drift in is
 * a reader grading a Leaf that production is supposed to be hiding.
 *
 * Outside production the published check still applies: a draft is never servable
 * anywhere. Only the placeholder half of `isProductionPublishable` is relaxed, because
 * placeholder content is the whole of Phase 1 development.
 */

/** The two fields the decision turns on. Both `Track` and `Leaf` satisfy this. */
export interface VisibilityCandidate {
  readonly status: 'draft' | 'published';
  readonly isPlaceholder: boolean;
}

export function isVisibleIn(
  environment: AppConfig['NODE_ENV'],
  content: VisibilityCandidate,
): boolean {
  return environment === 'production'
    ? isProductionPublishable(content)
    : content.status === 'published';
}
