import { timingSafeEqual } from 'node:crypto';
import type { ErrorReport, ErrorReportReason, ErrorReportStatus } from '@zoomout/shared';

import type { AppConfig } from '../config/env.js';
import type { ContentService } from '../content/content.service.js';
import type { AppLogger } from '../logging/logger.js';
import type { ErrorReportRow } from '../db/schema.js';
import type { ModerationRepository } from './moderation.repository.js';

/**
 * The fix queue: filing reports, and letting an operator read them.
 *
 * A composition service, per the WP9 precedent — it needs `ContentService` to resolve
 * the Leaf a report names, and domain services do not reach sideways for content.
 *
 * **This is a legal surface.** `LEGAL.md` commits to a user-facing correction channel
 * with a defined SLA, so the guarantees that matter here are that a report cannot be
 * silently dropped and cannot be read by someone who should not see it.
 */
export class ModerationService {
  constructor(
    private readonly repository: ModerationRepository,
    private readonly content: ContentService,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Files a report against a Leaf.
   *
   * **The Leaf is resolved through `ContentService` first**, which does two things: it
   * rejects a report against a Leaf that does not exist or is not visible here — so the
   * queue cannot be filled with rows about nothing — and it yields the Track, which is
   * stored alongside so triage never has to ask the CMS about content that may by then
   * have been pulled.
   *
   * @throws {ContentNotFoundError} if the Leaf or its Track is absent or hidden.
   */
  public async file(
    userId: string,
    leafId: string,
    reason: ErrorReportReason,
    detail: string | undefined,
  ): Promise<ErrorReport> {
    const leaf = await this.content.getLeafSummary(leafId);

    const row = await this.repository.file({
      userId,
      leafId: leaf.id,
      trackId: leaf.trackId,
      reason,
      detail: detail ?? null,
      at: new Date(),
    });

    /**
     * Logged at `warn`, not `info`.
     *
     * A reader disputing a factual claim attributed to a real author is the single
     * signal `LEGAL.md`'s zero-fabrication policy is built around noticing. It should be
     * visible in a log the founder skims, not buried among request lines.
     */
    this.logger.warn(
      { reportId: row.id, leafId: row.leafId, trackId: row.trackId, reason: row.reason },
      'Error report filed',
    );

    return toDomain(row);
  }

  /**
   * The queue, for an operator holding the token.
   *
   * @throws {Error} never — authorisation is the route's job, because a service that
   *   returned an empty list to an unauthorised caller would look identical to an empty
   *   queue, and that is the failure nobody notices.
   */
  public async list(
    status: ErrorReportStatus | undefined,
    limit: number,
  ): Promise<readonly ErrorReport[]> {
    const rows = await this.repository.list({ status, limit });

    return rows.map(toDomain);
  }

  /**
   * Whether a presented token is the operator token.
   *
   * **Unset config refuses everyone.** The same fail-closed shape WP2 chose for
   * unconfigured social providers: an absent secret must not become an open door, and
   * the alternative — a default value — would put the queue behind a guessable string.
   *
   * Compared with `timingSafeEqual` on equal-length buffers. The timing signal on a
   * short-circuit compare is small, but this is the only thing standing between the
   * public internet and reader-submitted reports, and constant-time comparison of a
   * fixed secret costs nothing.
   */
  public authorises(presented: string | undefined): boolean {
    const expected = this.config.MODERATION_OPERATOR_TOKEN;

    if (expected === undefined || presented === undefined) {
      return false;
    }

    const a = Buffer.from(presented);
    const b = Buffer.from(expected);

    // `timingSafeEqual` throws on a length mismatch, which would itself leak the length
    // through an exception path — so the lengths are compared first and deliberately.
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

function toDomain(row: ErrorReportRow): ErrorReport {
  return {
    id: row.id,
    userId: row.userId,
    leafId: row.leafId,
    trackId: row.trackId,
    reason: row.reason,
    detail: row.detail,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}
