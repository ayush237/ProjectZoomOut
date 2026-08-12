import {
  toPublicLeaf,
  type DeliveredLeaf,
  type Leaf,
  type PublicLeaf,
  type Track,
} from '@zoomout/shared';

import type { AppConfig } from '../config/env.js';
import type { AppLogger } from '../logging/logger.js';
import { ContentNotFoundError } from './content.errors.js';
import type { ContentRepository, TrackPage } from './content.repository.js';
import { isVisibleIn, resolveVisibleLeaf } from './contentVisibility.js';
import type { PayoffAccessPolicy } from './payoffAccess.js';

/** Leaf metadata for a Track's contents list — no slide bodies. */
export interface LeafSummary {
  readonly id: string;
  readonly trackId: string;
  readonly orderIndex: number;
  readonly title: string;
  readonly isPlaceholder: boolean;
}

/**
 * `DeliveredLeaf` moved to `packages/shared/src/delivery.ts` in WP8, when the mobile
 * app became its second consumer and CLAUDE.md's one-definition rule started to bite.
 * Re-exported here so the many call sites that import it from this module keep working,
 * and so the payoff gate stays discoverable from the class that enforces it.
 */
export type { DeliveredLeaf };

/**
 * Content delivery decisions.
 *
 * Three product guarantees are enforced here and nowhere else:
 *
 *  1. **Placeholder content is invisible in production.** `isProductionPublishable`
 *     has existed in `packages/shared` since WP0 with nothing calling it, which made
 *     the guard decorative. This is where it starts doing work.
 *  2. **The answer key never leaves the server.** Every Leaf goes out through
 *     `toPublicLeaf`; there is no path in this class that returns a raw `Leaf`.
 *  3. **The payoff is withheld until it is earned** (WP4). Stripping the answer key is
 *     only half the gate: a client that can read the payoff without answering has no
 *     reason to answer, and the active-recall mechanic the product rests on becomes a
 *     screen you swipe past. Delivery consults `PayoffAccessPolicy`, so the decision is
 *     the server's on every request rather than the client's once.
 */
export class ContentService {
  constructor(
    private readonly repository: ContentRepository,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
    private readonly payoffAccess: PayoffAccessPolicy,
  ) {}

  public async listTracks(page: number, perPage: number): Promise<TrackPage> {
    const result = await this.repository.listTracks(page, perPage);
    const visible = result.tracks.filter((track) => this.isVisible(track));

    if (visible.length !== result.tracks.length) {
      this.logger.info(
        { withheld: result.tracks.length - visible.length, environment: this.config.NODE_ENV },
        'Withheld placeholder Tracks from a listing',
      );
    }

    // Totals are left as Payload reported them rather than recomputed from the
    // filtered page. Recomputing would be wrong in a different way — it would claim a
    // total that only holds for this page — and paging over placeholder-filtered
    // content is a WP7 concern once real content exists.
    return { ...result, tracks: visible };
  }

  public async getTrack(trackId: string): Promise<Track> {
    const track = await this.repository.findTrack(trackId);

    if (!this.isVisible(track)) {
      // 404, not 403. Whether a hidden Track exists is not something a reader is
      // entitled to learn, and a 403 would confirm it.
      throw new ContentNotFoundError('Track');
    }

    return track;
  }

  /** Ordered contents of a Track. Metadata only — bodies come from `getLeaf`. */
  public async listLeaves(trackId: string): Promise<readonly LeafSummary[]> {
    // Resolves visibility first, so a hidden Track's contents are not listable by
    // going straight to this endpoint.
    await this.getTrack(trackId);

    const leaves = await this.repository.listLeavesForTrack(trackId);

    return leaves.filter((leaf) => this.isVisible(leaf)).map(toLeafSummary);
  }

  /**
   * One Leaf's metadata — title, Track, order — and nothing else.
   *
   * Added in WP9 for the wrap-up screen, which needs to name what a reader finished
   * today and has only Leaf ids to go on. Deliberately **not** `getLeaf`: that returns
   * slide bodies and takes a reader because the payoff is per-reader, and a summary
   * screen has no business fetching prose it will not render. This keeps the payoff out
   * of a response that has no gate to enforce.
   *
   * Goes through `resolveVisibleLeaf`, so a Leaf whose Track has since been taken down
   * is a 404 here too — a withdrawn book must not resurface in a shareable image.
   *
   * @throws {ContentNotFoundError} if the Leaf or its Track is absent or hidden here.
   */
  public async getLeafSummary(leafId: string): Promise<LeafSummary> {
    const leaf = await resolveVisibleLeaf(this.repository, this.config.NODE_ENV, leafId);

    return toLeafSummary(leaf);
  }

  /**
   * One full Leaf, as this reader is allowed to see it.
   *
   * Takes a reader id because the payoff is per-reader: the same Leaf is a different
   * response to someone who has answered its scenario and someone who has not. The
   * return type is `DeliveredLeaf` rather than `PublicLeaf`, so the payoff being
   * conditional is a compile-time property of this method rather than a convention.
   */
  public async getLeaf(leafId: string, userId: string): Promise<DeliveredLeaf> {
    // Resolves the parent Track too: a Leaf whose Track has been taken down is gone,
    // whatever the Leaf's own status says. See `resolveVisibleLeaf`.
    const leaf = await resolveVisibleLeaf(this.repository, this.config.NODE_ENV, leafId);

    const unlocked = await this.payoffAccess.isPayoffUnlocked(userId, leafId);

    return toDeliveredLeaf(toPublicLeaf(leaf), unlocked);
  }

  /** Delegates to the shared predicate so grading cannot drift from delivery. */
  private isVisible(content: { status: 'draft' | 'published'; isPlaceholder: boolean }): boolean {
    return isVisibleIn(this.config.NODE_ENV, content);
  }
}

/**
 * Applies the payoff gate.
 *
 * Destructures the payoff out rather than overwriting it, so a locked response cannot
 * carry the prose by some spread ordering nobody re-checks. When locked, the body was
 * never on the object that gets serialised.
 */
function toDeliveredLeaf(leaf: PublicLeaf, unlocked: boolean): DeliveredLeaf {
  const { payoff, ...rest } = leaf;

  return {
    ...rest,
    payoff: unlocked ? payoff : null,
    payoffUnlocked: unlocked,
  };
}

function toLeafSummary(leaf: Leaf): LeafSummary {
  return {
    id: leaf.id,
    trackId: leaf.trackId,
    orderIndex: leaf.orderIndex,
    title: leaf.title,
    isPlaceholder: leaf.isPlaceholder,
  };
}
