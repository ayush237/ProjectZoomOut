import { z } from 'zod';

import { cmsIdSchema, isoTimestampSchema, uuidSchema } from './primitives.js';

/**
 * PROVISIONAL — the queue's exact states are settled with the fix queue in WP10.
 */
export const errorReportStatusSchema = z.enum(['open', 'triaged', 'resolved', 'rejected']);

/**
 * A user-submitted report against one Leaf.
 *
 * Every Leaf carries a "report an error" action routed to a fix queue with a defined
 * SLA (PRODUCT.md, LEGAL.md). This is the operational half of the zero-fabrication
 * policy — the channel by which a false claim attributed to a real author gets found
 * and pulled — so it is a launch requirement, not a feedback nicety.
 */
export const errorReportSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  leafId: cmsIdSchema,
  reason: z.string().min(1),
  status: errorReportStatusSchema,
  createdAt: isoTimestampSchema,
  /** Null until the report leaves the queue. */
  resolvedAt: isoTimestampSchema.nullable(),
});

export type ErrorReportStatus = z.infer<typeof errorReportStatusSchema>;
export type ErrorReport = z.infer<typeof errorReportSchema>;
