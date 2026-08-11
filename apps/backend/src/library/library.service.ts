import type { Track, TrackProgressSummary } from '@zoomout/shared';

import type { AppLogger } from '../logging/logger.js';
import { toError } from '../errors.js';
import { ContentNotFoundError } from '../content/content.errors.js';
import type { ContentService } from '../content/content.service.js';
import type { TrackProgressReader } from '../progress/progress.service.js';
import type { LibraryRepository } from './library.repository.js';

export interface LibraryEntry {
  readonly track: Track;
  readonly addedAt: string;
  readonly status: 'active' | 'completed' | 'archived';
  /**
   * Derived per request, never stored. See `trackProgressSummarySchema`.
   *
   * This is what WP6's library could not answer and what Library and Journey are built
   * on: "7 of 20", and where resume goes.
   */
  readonly progress: TrackProgressSummary;
}

/**
 * A reader's library.
 *
 * Sits above both content and progress and composes them — which is why the rollup
 * lives here rather than in either. `ContentService` knows which Leaves a reader may
 * see; `ProgressService` knows which they have finished; neither should have to know
 * about the other to answer "how far through this book am I".
 */
export class LibraryService {
  constructor(
    private readonly repository: LibraryRepository,
    private readonly content: ContentService,
    private readonly progress: TrackProgressReader,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Adds a Track to the reader's library.
   *
   * The Track is resolved through `ContentService` first, so visibility is enforced on
   * the way in: a reader cannot add a draft, or — in production — a placeholder, by
   * guessing an id. Idempotent, so tapping "add" twice succeeds twice.
   *
   * @throws {ContentNotFoundError} if no visible Track has that id.
   */
  public async addTrack(userId: string, trackId: string): Promise<void> {
    await this.content.getTrack(trackId);

    await this.repository.addTrack(userId, trackId);
    this.logger.info({ userId, trackId }, 'Track added to library');
  }

  /**
   * Removes a Track.
   *
   * Removing something absent is a success. The client's intent — "this should not be
   * in my library" — is satisfied either way, and a 404 here would make a retry after
   * a dropped connection look like a failure.
   */
  public async removeTrack(userId: string, trackId: string): Promise<void> {
    const removed = await this.repository.removeTrack(userId, trackId);

    if (removed) {
      this.logger.info({ userId, trackId }, 'Track removed from library');
    }
  }

  /**
   * The reader's library, with each Track resolved from the CMS.
   *
   * A Track that has since been unpublished or taken down is **omitted**, not shown as
   * a broken entry. That is the takedown requirement reaching all the way into a
   * personal library: pulling a Track has to remove it everywhere a reader could see
   * it, not just from Explore.
   */
  public async listLibrary(userId: string): Promise<readonly LibraryEntry[]> {
    const rows = await this.repository.listTrackIds(userId);

    const entries = await Promise.all(
      rows.map(async (row): Promise<LibraryEntry | null> => {
        try {
          // Resolved together rather than in sequence: a library of twenty books would
          // otherwise be forty round trips end to end, most of them waiting on the CMS.
          const [track, progress] = await Promise.all([
            this.content.getTrack(row.trackId),
            this.summarise(userId, row.trackId),
          ]);

          return {
            track,
            addedAt: row.addedAt.toISOString(),
            status: row.status,
            progress,
          };
        } catch (error) {
          if (error instanceof ContentNotFoundError) {
            this.logger.info(
              { userId, trackId: row.trackId },
              'Library entry skipped: Track is no longer available',
            );
            return null;
          }

          // Anything else — the CMS being unreachable, a validation failure — is not
          // ours to swallow. One reader's library quietly rendering empty during a
          // Payload outage would look like data loss.
          this.logger.error(
            { err: toError(error), userId, trackId: row.trackId },
            'Failed to resolve a library entry',
          );
          throw error;
        }
      }),
    );

    return entries.filter((entry): entry is LibraryEntry => entry !== null);
  }

  /**
   * How far this reader is through one Track.
   *
   * Public because Journey and a future Track-detail screen want it for a Track that
   * may not be in the library yet, without paying for the whole list.
   *
   * Counts **visible** Leaves only, because it goes through `ContentService.listLeaves`
   * — so a placeholder Leaf hidden in production is not in the denominator, and a
   * reader is not shown "3 of 20" for a book that currently offers three.
   */
  public async summarise(userId: string, trackId: string): Promise<TrackProgressSummary> {
    const leaves = await this.content.listLeaves(trackId);

    return this.progress.summariseTrack(userId, trackId, leaves);
  }
}
