import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Leaf as CmsLeaf, Track as CmsTrack } from '@zoomout/shared/cms';

/**
 * A controllable stand-in for Payload's REST API.
 *
 * Why a fake rather than the real CMS: the behaviour under test here is **ours** — the
 * cache TTL, the placeholder filter, the mapper, and the 503 path — and each of those
 * needs content to change on command, mid-test. Booting Payload would also drag in the
 * two upstream defects WP1 documented (`destroy()` leaves the pool open, and no `error`
 * listener is attached to it).
 *
 * Payload's own half of takedown — that unpublished documents disappear from anonymous
 * reads — was already proven against the real thing in WP1's integration suite. This
 * fake reproduces that contract: `setPublished(false)` makes a document vanish from
 * responses, exactly as Payload's access control does.
 */
export class FakePayload {
  private readonly server: Server;
  private tracks: CmsTrack[] = [];
  private leaves: CmsLeaf[] = [];
  private readonly published = new Set<string>();

  /** Requests served, so tests can prove the cache actually prevented a call. */
  public requestCount = 0;

  /** When true, every request fails — used for the unreachable-CMS path. */
  public failing = false;

  /**
   * When true, `where` filters are ignored and every published document is returned.
   *
   * Models a query filter that has quietly stopped working. WP7 pushed the placeholder
   * filter into the Payload query for accurate pagination totals; this is how a test
   * proves that filter is an optimisation and not the control.
   */
  public ignoreWhereFilters = false;

  private constructor() {
    this.server = createServer((request, response) => {
      this.handle(request.url ?? '', response);
    });
  }

  public static async start(): Promise<FakePayload> {
    const instance = new FakePayload();

    await new Promise<void>((resolve) => {
      instance.server.listen(0, '127.0.0.1', resolve);
    });

    return instance;
  }

  public get apiUrl(): string {
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${String(port)}/api`;
  }

  public seedTrack(track: CmsTrack, options: { published?: boolean } = {}): void {
    this.tracks = [...this.tracks.filter((existing) => existing.id !== track.id), track];
    this.setPublished('track', track.id, options.published ?? true);
  }

  public seedLeaf(leaf: CmsLeaf, options: { published?: boolean } = {}): void {
    this.leaves = [...this.leaves.filter((existing) => existing.id !== leaf.id), leaf];
    this.setPublished('leaf', leaf.id, options.published ?? true);
  }

  /** Mirrors Payload's access control: unpublished documents leave the responses. */
  public setPublished(kind: 'track' | 'leaf', id: number, published: boolean): void {
    const key = `${kind}:${String(id)}`;

    if (published) {
      this.published.add(key);
    } else {
      this.published.delete(key);
    }
  }

  public async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private handle(rawUrl: string, response: ServerResponse): void {
    this.requestCount += 1;

    if (this.failing) {
      response.writeHead(500);
      response.end('upstream exploded');
      return;
    }

    const url = new URL(rawUrl, 'http://localhost');
    const idFilter = url.searchParams.get('where[id][equals]');
    const trackFilter = url.searchParams.get('where[trackId][equals]');

    /**
     * The placeholder filter WP7 pushed into the query, honoured unless a test asks it
     * not to be. `ignoreWhereFilters` simulates the filter silently failing — a typo in
     * a parameter name, or a Payload version that stops recognising it — which is the
     * scenario that proves `ContentService`'s guard is still the real control.
     */
    const placeholderFilter = this.ignoreWhereFilters
      ? null
      : url.searchParams.get('where[isPlaceholder][not_equals]');

    const docs: readonly (CmsTrack | CmsLeaf)[] = url.pathname.endsWith('/tracks')
      ? this.tracks
          .filter((track) => this.published.has(`track:${String(track.id)}`))
          .filter((track) => idFilter === null || String(track.id) === idFilter)
          .filter(
            (track) =>
              placeholderFilter !== 'true' || (track.isPlaceholder ?? true) === false,
          )
      : this.leaves
          .filter((leaf) => this.published.has(`leaf:${String(leaf.id)}`))
          .filter((leaf) => idFilter === null || String(leaf.id) === idFilter)
          .filter((leaf) => trackFilter === null || relationshipId(leaf.trackId) === trackFilter);

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        docs,
        totalDocs: docs.length,
        page: 1,
        totalPages: 1,
        hasNextPage: false,
      }),
    );
  }
}

/** `trackId` is `number | Track`; stringifying it blindly would give "[object Object]". */
function relationshipId(relationship: number | { id: number }): string {
  return typeof relationship === 'number' ? String(relationship) : String(relationship.id);
}
