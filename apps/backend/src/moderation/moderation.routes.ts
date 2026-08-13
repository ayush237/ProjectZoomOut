import { errorReportSubmissionSchema, errorReportStatusSchema } from '@zoomout/shared';
import { z } from 'zod';

import type { ZoomOutApp } from '../app.js';
import { requireUserId, type Authenticator } from '../auth/authenticate.js';
import type { AppConfig } from '../config/env.js';
import type { ModerationService } from './moderation.service.js';

/**
 * Reporting an error, and reading the queue.
 *
 * Two endpoints with **two different kinds of caller**, which is why they authenticate
 * differently: filing is a reader action behind the normal reader token, while reading
 * the queue is an operator action behind a separate shared secret. Putting the queue
 * behind reader auth would expose every report to every reader.
 */

const leafIdParams = z.object({ leafId: z.string().min(1) });

const queueQuery = z.object({
  status: errorReportStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const HTTP_CREATED = 201;
const HTTP_UNAUTHORIZED = 401;

export function registerModerationRoutes(
  app: ZoomOutApp,
  service: ModerationService,
  config: AppConfig,
  authenticate: Authenticator,
): void {
  /**
   * File a report against a Leaf.
   *
   * **201, and the body is the confirmation.** The reader is told their report exists
   * and carries an id; `LEGAL.md` makes this a trust surface, and a silent 204 reads as
   * being ignored — which is precisely the impression the correction channel exists to
   * avoid.
   *
   * Rate-limited on its own budget, tighter than auth's: this is an authenticated write
   * that creates a row on the reader's say-so.
   */
  app.post(
    '/content/leaves/:leafId/reports',
    {
      preHandler: authenticate,
      config: {
        rateLimit: {
          max: config.REPORT_RATE_LIMIT_MAX,
          timeWindow: config.REPORT_RATE_LIMIT_WINDOW_SECONDS * 1000,
        },
      },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { leafId } = leafIdParams.parse(request.params);
      const { reason, detail } = errorReportSubmissionSchema.parse(request.body ?? {});

      const report = await service.file(userId, leafId, reason, detail);

      return reply.status(HTTP_CREATED).send({ report });
    },
  );

  /**
   * The fix queue, for the founder.
   *
   * **Not behind reader authentication**, and not a UI. A bearer token from validated
   * config is the whole gate — enough for Phase 1, and deliberately less than an admin
   * surface nobody has asked for.
   *
   * The refusal is the part worth testing: an absent or wrong token gets 401, and an
   * **unconfigured** token refuses everyone rather than opening the queue. A misread of
   * that default would publish every reader-submitted report.
   */
  app.get('/moderation/reports', async (request, reply) => {
    if (!service.authorises(bearerFrom(request.headers.authorization))) {
      /**
       * Deliberately indistinguishable from a wrong token, and deliberately silent
       * about whether the endpoint is configured at all. "Operator access is not
       * configured" would tell an unauthenticated caller exactly which deployments are
       * worth attacking.
       */
      return reply
        .status(HTTP_UNAUTHORIZED)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Operator token required' } });
    }

    const { status, limit } = queueQuery.parse(request.query);

    return reply.send({ reports: await service.list(status, limit) });
  });
}

/** `Authorization: Bearer <token>`, or undefined for anything else. */
function bearerFrom(header: string | undefined): string | undefined {
  if (header === undefined) {
    return undefined;
  }

  const [scheme, token] = header.split(' ');

  return scheme?.toLowerCase() === 'bearer' && token !== undefined ? token : undefined;
}
