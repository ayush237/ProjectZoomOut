import { z } from 'zod';

import { cmsIdSchema, isoTimestampSchema, uuidSchema } from './primitives.js';

/**
 * Settled in WP10, from the WP0 provisional shape.
 *
 * Three things changed and each was a gap rather than a preference:
 *
 *  - **`reason` is a closed enum, not a free string.** A queue the founder has to read
 *    is only workable if reports can be sorted, and "offensive content" needs to be
 *    separable from "the wrong option is marked correct" without reading prose. The free
 *    text moved to `detail`, where it belongs.
 *  - **`trackId` was missing.** A report names a Leaf, but the thing that gets pulled in
 *    a takedown is a Track, and resolving Leaf → Track at triage time means asking the
 *    CMS about content that may by then be gone.
 *  - **The status set narrowed to `open` / `resolved`.** WP0 guessed at four;
 *    `triaged` and `rejected` are states nothing sets and nothing reads, and the WP10
 *    handoff asks for the smallest queue that can be worked. Rejecting a report is
 *    resolving it.
 */

/**
 * Why the reader is reporting.
 *
 * `wrong_answer` is deliberately its own reason rather than folded into `factual_error`.
 * It is the highest-severity class in the product: an option marked correct that is not
 * means the payoff gate is teaching the wrong thing, and the whole active-recall claim
 * inverts. It needs to be findable in the queue without reading every report.
 */
export const ERROR_REPORT_REASONS = [
  'factual_error',
  'wrong_answer',
  'offensive',
  'other',
] as const;

export const errorReportReasonSchema = z.enum(ERROR_REPORT_REASONS);

/**
 * `open` until a human has dealt with it; `resolved` once they have.
 *
 * Nothing sets this automatically — the queue is worked by a person, and a status a
 * machine could set would be a status that means nothing about whether the content was
 * actually checked.
 */
export const errorReportStatusSchema = z.enum(['open', 'resolved']);

/** The most free text a reader may attach. Long enough to describe, short enough to read. */
export const ERROR_REPORT_DETAIL_MAX = 2000;

/**
 * A user-submitted report against one Leaf.
 *
 * Every Leaf carries a "report an error" action routed to a fix queue with a defined
 * SLA (PRODUCT.md, LEGAL.md, and the SLA itself is written into LEGAL.md's content
 * integrity section). This is the operational half of the zero-fabrication policy — the
 * channel by which a false claim attributed to a real author gets found and pulled — so
 * it is a launch requirement, not a feedback nicety.
 */
export const errorReportSchema = z.object({
  id: uuidSchema,
  /**
   * Null once the reporting account is gone.
   *
   * A deleted account must not erase the evidence that a factual claim was disputed —
   * that report is the start of a takedown clock, and it outlives the person who filed
   * it. Nullable here rather than defaulted to a placeholder id, because "we no longer
   * know who reported this" is the truth and a fake uuid would not be.
   */
  userId: uuidSchema.nullable(),
  leafId: cmsIdSchema,
  /** Resolved when the report is filed, so triage never depends on content still existing. */
  trackId: cmsIdSchema,
  reason: errorReportReasonSchema,
  /** Optional free text. Null when the reader submitted only a reason. */
  detail: z.string().max(ERROR_REPORT_DETAIL_MAX).nullable(),
  status: errorReportStatusSchema,
  createdAt: isoTimestampSchema,
  /** Null until the report leaves the queue. */
  resolvedAt: isoTimestampSchema.nullable(),
});

/** What a reader submits. The server supplies everything else. */
export const errorReportSubmissionSchema = z.object({
  reason: errorReportReasonSchema,
  detail: z.string().min(1).max(ERROR_REPORT_DETAIL_MAX).optional(),
});

export type ErrorReportReason = z.infer<typeof errorReportReasonSchema>;
export type ErrorReportStatus = z.infer<typeof errorReportStatusSchema>;
export type ErrorReport = z.infer<typeof errorReportSchema>;
export type ErrorReportSubmission = z.infer<typeof errorReportSubmissionSchema>;
