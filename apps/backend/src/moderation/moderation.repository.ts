import { and, desc, eq } from 'drizzle-orm';
import type { ErrorReportReason, ErrorReportStatus } from '@zoomout/shared';

import type { DatabaseClient } from '../db/client.js';
import { errorReports, type ErrorReportRow } from '../db/schema.js';

/**
 * Persistence for the fix queue.
 *
 * Plain inserts and reads — there is no state machine here worth defending, because the
 * queue is worked by a person and nothing sets a status automatically. What matters is
 * that a report, once filed, is hard to lose: it survives the reader's account being
 * deleted and the content it describes being unpublished.
 */

export interface FileReportInput {
  readonly userId: string;
  readonly leafId: string;
  readonly trackId: string;
  readonly reason: ErrorReportReason;
  readonly detail: string | null;
  readonly at: Date;
}

export interface ModerationRepository {
  file(input: FileReportInput): Promise<ErrorReportRow>;
  /** Newest first. Optionally narrowed to one status, for working the queue. */
  list(options: {
    status?: ErrorReportStatus | undefined;
    limit: number;
  }): Promise<readonly ErrorReportRow[]>;
}

export class PostgresModerationRepository implements ModerationRepository {
  constructor(private readonly client: DatabaseClient) {}

  public async file(input: FileReportInput): Promise<ErrorReportRow> {
    const [row] = await this.client.db
      .insert(errorReports)
      .values({
        userId: input.userId,
        leafId: input.leafId,
        trackId: input.trackId,
        reason: input.reason,
        detail: input.detail,
        createdAt: input.at,
      })
      .returning();

    if (row === undefined) {
      throw new Error('Error report insert returned no row');
    }

    return row;
  }

  /**
   * **Deliberately not deduplicated.** Ten readers reporting the same Leaf is ten rows,
   * and that is the signal — a claim disputed ten times is more urgent than one disputed
   * once, and collapsing them would hide exactly the pattern the queue exists to surface.
   */
  public async list({
    status,
    limit,
  }: {
    status?: ErrorReportStatus | undefined;
    limit: number;
  }): Promise<readonly ErrorReportRow[]> {
    const where = status === undefined ? undefined : and(eq(errorReports.status, status));

    return this.client.db
      .select()
      .from(errorReports)
      .where(where)
      .orderBy(desc(errorReports.createdAt))
      .limit(limit);
  }
}
