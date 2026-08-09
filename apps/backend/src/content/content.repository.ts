import type { Leaf, Track } from '@zoomout/shared';
import type { Leaf as CmsLeaf, Track as CmsTrack } from '@zoomout/shared/cms';

import type { AppConfig } from '../config/env.js';
import type { AppLogger } from '../logging/logger.js';
import { ContentInvalidError, ContentNotFoundError } from './content.errors.js';
import { CONTENT_QUERY_DEPTH, mapLeaf, mapTrack, type MappingResult } from './content.mapper.js';
import type { PayloadClient, PayloadListResponse } from './payloadClient.js';
import { TtlCache } from './ttlCache.js';

/**
 * Reads content from the CMS and returns domain objects.
 *
 * The abstraction the plan calls for (§3.2): everything above this layer works in
 * `Track` and `Leaf` and knows nothing about Payload. If the publish-to-snapshot
 * pipeline arrives in Phase 2, this is the only file that changes.
 */

export interface TrackPage {
  readonly tracks: readonly Track[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalTracks: number;
}

export interface ContentRepository {
  listTracks(page: number, perPage: number): Promise<TrackPage>;
  findTrack(trackId: string): Promise<Track>;
  listLeavesForTrack(trackId: string): Promise<readonly Leaf[]>;
  findLeaf(leafId: string): Promise<Leaf>;
}

export class PayloadContentRepository implements ContentRepository {
  private readonly cache: TtlCache<unknown>;

  constructor(
    private readonly client: PayloadClient,
    private readonly logger: AppLogger,
    config: AppConfig,
  ) {
    this.cache = new TtlCache(config.CONTENT_CACHE_TTL_SECONDS * 1000);
  }

  public async listTracks(page: number, perPage: number): Promise<TrackPage> {
    const response = await this.cached(`tracks:${String(page)}:${String(perPage)}`, () =>
      this.client.get<PayloadListResponse<CmsTrack>>('/tracks', {
        page,
        limit: perPage,
        depth: CONTENT_QUERY_DEPTH,
        sort: 'bookTitle',
      }),
    );

    return {
      // A single malformed Track must not blank the whole Explore surface, so invalid
      // documents are dropped and logged rather than thrown. Fetching one specific
      // Track behaves differently on purpose — see `findTrack`.
      tracks: this.keepValid(response.docs.map(mapTrack), 'Track'),
      page: response.page,
      totalPages: response.totalPages,
      totalTracks: response.totalDocs,
    };
  }

  public async findTrack(trackId: string): Promise<Track> {
    const response = await this.cached(`track:${trackId}`, () =>
      this.client.get<PayloadListResponse<CmsTrack>>('/tracks', {
        'where[id][equals]': trackId,
        depth: CONTENT_QUERY_DEPTH,
        limit: 1,
      }),
    );

    const [document] = response.docs;
    if (document === undefined) {
      throw new ContentNotFoundError('Track');
    }

    return this.requireValid(mapTrack(document), 'Track');
  }

  public async listLeavesForTrack(trackId: string): Promise<readonly Leaf[]> {
    const response = await this.cached(`leaves:${trackId}`, () =>
      this.client.get<PayloadListResponse<CmsLeaf>>('/leaves', {
        'where[trackId][equals]': trackId,
        sort: 'orderIndex',
        depth: CONTENT_QUERY_DEPTH,
        limit: 100,
      }),
    );

    return this.keepValid(response.docs.map(mapLeaf), 'Leaf');
  }

  public async findLeaf(leafId: string): Promise<Leaf> {
    const response = await this.cached(`leaf:${leafId}`, () =>
      this.client.get<PayloadListResponse<CmsLeaf>>('/leaves', {
        'where[id][equals]': leafId,
        depth: CONTENT_QUERY_DEPTH,
        limit: 1,
      }),
    );

    const [document] = response.docs;
    if (document === undefined) {
      throw new ContentNotFoundError('Leaf');
    }

    return this.requireValid(mapLeaf(document), 'Leaf');
  }

  /** Exposed for tests and for an operational purge; not called on the request path. */
  public clearCache(): void {
    this.cache.clear();
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit !== undefined) {
      return hit as T;
    }

    const value = await load();
    this.cache.set(key, value);
    return value;
  }

  /**
   * Drops invalid documents from a list, logging each one.
   *
   * Not silent: a rejected document is a content defect somebody has to fix, and the
   * log line names the Leaf or Track and the failing field. But one bad record should
   * degrade a listing, not empty it.
   */
  private keepValid<T>(results: readonly MappingResult<T>[], kind: string): readonly T[] {
    const valid: T[] = [];

    for (const result of results) {
      if (result.ok) {
        valid.push(result.value);
      } else {
        this.logger.error(
          { reasons: result.reasons, kind },
          'Content failed domain validation and was withheld',
        );
      }
    }

    return valid;
  }

  /**
   * Requires a single document to be valid.
   *
   * Throws where a listing would skip: a reader who asked for this exact Track must
   * not be shown a success response for something we refused to serve.
   */
  private requireValid<T>(result: MappingResult<T>, kind: string): T {
    if (result.ok) {
      return result.value;
    }

    this.logger.error(
      { reasons: result.reasons, kind },
      'Content failed domain validation and was withheld',
    );

    throw new ContentInvalidError(result.reasons);
  }
}
