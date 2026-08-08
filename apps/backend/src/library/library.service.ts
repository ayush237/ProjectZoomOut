import type { Track } from '@zoomout/shared';

import type { AppLogger } from '../logging/logger.js';
import { toError } from '../errors.js';
import { ContentNotFoundError } from '../content/content.errors.js';
import type { ContentService } from '../content/content.service.js';
import type { LibraryRepository } from './library.repository.js';

export interface LibraryEntry {
  readonly track: Track;
  readonly addedAt: string;
  readonly status: 'active' | 'completed' | 'archived';
}

/**
 * A reader's library.
 *
 * Membership only. Progress, XP and completion belong to WP4 and are deliberately
 * absent — returning a half-built progress shape now would give WP7 something to build
 * against that is going to change.
 */
export class LibraryService {
  constructor(
    private readonly repository: LibraryRepository,
    private readonly content: ContentService,
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
          return {
            track: await this.content.getTrack(row.trackId),
            addedAt: row.addedAt.toISOString(),
            status: row.status,
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
}
