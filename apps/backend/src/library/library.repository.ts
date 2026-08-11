import { and, desc, eq } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client.js';
import { userTracks, type UserTrackRow } from '../db/schema.js';

/**
 * Persistence for a reader's library.
 *
 * Every method is scoped by `userId` in the query itself rather than filtering after
 * the fact. A repository that can return another reader's rows is one forgotten
 * `where` clause away from leaking them.
 */
export interface LibraryRepository {
  addTrack(userId: string, trackId: string): Promise<UserTrackRow>;
  removeTrack(userId: string, trackId: string): Promise<boolean>;
  listTrackIds(userId: string): Promise<readonly UserTrackRow[]>;
  hasTrack(userId: string, trackId: string): Promise<boolean>;
  /**
   * Moves a Track between `active` and `completed`.
   *
   * @returns whether a row actually changed. False covers both "already in that state"
   *   and "this Track is not in the reader's library" — a reader can finish a Track they
   *   never added, and that is not an error, just nothing to record.
   */
  setStatus(userId: string, trackId: string, status: UserTrackStatus): Promise<boolean>;
}

/** The subset of the library a writer needs, so progress can update status without
 * depending on the whole repository. */
export interface TrackStatusWriter {
  setStatus(userId: string, trackId: string, status: UserTrackStatus): Promise<boolean>;
}

export type UserTrackStatus = UserTrackRow['status'];

export class PostgresLibraryRepository implements LibraryRepository {
  constructor(private readonly client: DatabaseClient) {}

  /**
   * Adds a Track, or returns the existing row unchanged.
   *
   * `onConflictDoNothing` against the unique index makes this idempotent in one
   * statement. A check-then-insert would race two taps of the same button into a
   * constraint violation surfacing as a 500.
   */
  public async addTrack(userId: string, trackId: string): Promise<UserTrackRow> {
    const [inserted] = await this.client.db
      .insert(userTracks)
      .values({ userId, trackId })
      .onConflictDoNothing({ target: [userTracks.userId, userTracks.trackId] })
      .returning();

    if (inserted !== undefined) {
      return inserted;
    }

    // Already present — the conflict path. Read it back so the caller always gets a row.
    const [existing] = await this.client.db
      .select()
      .from(userTracks)
      .where(and(eq(userTracks.userId, userId), eq(userTracks.trackId, trackId)))
      .limit(1);

    if (existing === undefined) {
      throw new Error('Library row vanished between insert and read-back');
    }

    return existing;
  }

  /** @returns whether a row was actually removed. */
  public async removeTrack(userId: string, trackId: string): Promise<boolean> {
    const deleted = await this.client.db
      .delete(userTracks)
      .where(and(eq(userTracks.userId, userId), eq(userTracks.trackId, trackId)))
      .returning({ id: userTracks.id });

    return deleted.length > 0;
  }

  public async listTrackIds(userId: string): Promise<readonly UserTrackRow[]> {
    return this.client.db
      .select()
      .from(userTracks)
      .where(eq(userTracks.userId, userId))
      .orderBy(desc(userTracks.addedAt));
  }

  public async setStatus(
    userId: string,
    trackId: string,
    status: UserTrackStatus,
  ): Promise<boolean> {
    const updated = await this.client.db
      .update(userTracks)
      .set({ status })
      .where(
        and(
          eq(userTracks.userId, userId),
          eq(userTracks.trackId, trackId),
          /**
           * Only promotes an **active** Track.
           *
           * `ne(status, target)` was wrong in a way that would not have shown up until a
           * reader archived something: it matched every status except the target, so
           * finishing a Leaf in an `archived` Track would quietly resurrect it as
           * `completed`. Archiving is a decision the reader made, and completion is not
           * entitled to overrule it.
           *
           * Still idempotent — a replayed completion matches nothing and writes nothing,
           * which is what makes calling this on every completion safe.
           */
          eq(userTracks.status, 'active'),
        ),
      )
      .returning({ id: userTracks.id });

    return updated.length > 0;
  }

  public async hasTrack(userId: string, trackId: string): Promise<boolean> {
    const [row] = await this.client.db
      .select({ id: userTracks.id })
      .from(userTracks)
      .where(and(eq(userTracks.userId, userId), eq(userTracks.trackId, trackId)))
      .limit(1);

    return row !== undefined;
  }
}
