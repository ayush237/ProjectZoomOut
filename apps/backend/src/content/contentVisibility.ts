import { isProductionPublishable, type Leaf, type Track } from '@zoomout/shared';

import type { AppConfig } from '../config/env.js';
import { ContentNotFoundError } from './content.errors.js';

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

/** The two reads resolving a Leaf needs. Narrower than the whole repository. */
export interface LeafVisibilitySource {
  findLeaf(leafId: string): Promise<Leaf>;
  findTrack(trackId: string): Promise<Track>;
}

/**
 * A Leaf, only if **both it and its parent Track** may be served.
 *
 * Takedown cascades. Unpublishing a Track is how a legal complaint is answered, and
 * before this it cleared Explore, the library and resume while `GET /content/leaves/:id`
 * carried on serving the full Leaf and the progress endpoints carried on grading it and
 * paying XP for it. A Leaf's own `status` says nothing about whether the book it belongs
 * to has been pulled.
 *
 * Enforced **here, in the backend**, rather than by a CMS hook that cascades the flag
 * onto every child: a hook is a data migration that can half-run, and it would leave the
 * backend trusting a denormalised copy of the answer. The backend is the control.
 *
 * Costs one extra CMS read per Leaf, served by the repository's TTL cache in practice.
 * That is the right trade against serving content somebody has demanded be removed.
 *
 * @throws {ContentNotFoundError} naming the **Leaf**, never the Track — a reader who
 *   asked for a Leaf is not entitled to learn that its Track is the reason it is gone.
 */
export async function resolveVisibleLeaf(
  source: LeafVisibilitySource,
  environment: AppConfig['NODE_ENV'],
  leafId: string,
): Promise<Leaf> {
  const leaf = await source.findLeaf(leafId);

  if (!isVisibleIn(environment, leaf)) {
    throw new ContentNotFoundError('Leaf');
  }

  let track: Track;

  try {
    track = await source.findTrack(leaf.trackId);
  } catch (error) {
    // A Leaf whose Track has been deleted outright is as unservable as one whose Track
    // was unpublished, and for the same reason.
    if (error instanceof ContentNotFoundError) {
      throw new ContentNotFoundError('Leaf');
    }
    throw error;
  }

  if (!isVisibleIn(environment, track)) {
    throw new ContentNotFoundError('Leaf');
  }

  return leaf;
}
