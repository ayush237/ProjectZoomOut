import {
  isProductionPublishable,
  toPublicLeaf,
  type Leaf,
  type PublicLeaf,
  type Track,
} from '@zoomout/shared';

import type { AppConfig } from '../config/env.js';
import type { AppLogger } from '../logging/logger.js';
import { ContentNotFoundError } from './content.errors.js';
import type { ContentRepository, TrackPage } from './content.repository.js';

/** Leaf metadata for a Track's contents list — no slide bodies. */
export interface LeafSummary {
  readonly id: string;
  readonly trackId: string;
  readonly orderIndex: number;
  readonly title: string;
  readonly isPlaceholder: boolean;
}

/**
 * Content delivery decisions.
 *
 * Two product guarantees are enforced here and nowhere else:
 *
 *  1. **Placeholder content is invisible in production.** `isProductionPublishable`
 *     has existed in `packages/shared` since WP0 with nothing calling it, which made
 *     the guard decorative. This is where it starts doing work.
 *  2. **The answer key never leaves the server.** Every Leaf goes out through
 *     `toPublicLeaf`; there is no path in this class that returns a raw `Leaf`.
 */
export class ContentService {
  private readonly hidesPlaceholders: boolean;

  constructor(
    private readonly repository: ContentRepository,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
  ) {
    /**
     * Environment-aware by design (plan §3.4).
     *
     * Placeholder content is the whole point of Phase 1 development — every surface is
     * built against it — so it must be visible in development and staging. It must be
     * invisible in production, where mock prose sitting under a real author's name is
     * the exact failure that damaged Bookey.
     *
     * Derived once from validated config, so the behaviour changes by environment
     * variable rather than by code.
     */
    this.hidesPlaceholders = config.NODE_ENV === 'production';
  }

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
   * One full Leaf, as the client is allowed to see it.
   *
   * The return type is `PublicLeaf`, which makes the answer-key strip a compile-time
   * property of this method rather than something a future edit could forget.
   */
  public async getLeaf(leafId: string): Promise<PublicLeaf> {
    const leaf = await this.repository.findLeaf(leafId);

    if (!this.isVisible(leaf)) {
      throw new ContentNotFoundError('Leaf');
    }

    return toPublicLeaf(leaf);
  }

  /**
   * Whether a reader may see this content in the current environment.
   *
   * Outside production the published check still applies — a draft is never servable
   * anywhere. Only the placeholder half of `isProductionPublishable` is relaxed.
   */
  private isVisible(content: { status: 'draft' | 'published'; isPlaceholder: boolean }): boolean {
    return this.hidesPlaceholders
      ? isProductionPublishable(content)
      : content.status === 'published';
  }
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
