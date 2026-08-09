import { z } from 'zod';

import type { ZoomOutApp } from '../app.js';
import type { Authenticator } from '../auth/authenticate.js';
import type { ContentService } from './content.service.js';

/**
 * Content delivery endpoints. **All authenticated** — Phase 1 has no guest mode.
 *
 * Handlers parse, call the service, and return. The placeholder guard, the answer-key
 * strip and domain validation all live below this layer.
 */

const trackIdParams = z.object({ trackId: z.string().min(1) });
const leafIdParams = z.object({ leafId: z.string().min(1) });

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Bounded so a caller cannot ask for the entire library in one request and turn
  // Explore into a denial-of-service against Payload.
  perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});

export function registerContentRoutes(
  app: ZoomOutApp,
  service: ContentService,
  authenticate: Authenticator,
): void {
  app.get('/content/tracks', { preHandler: authenticate }, async (request, reply) => {
    const { page, perPage } = listQuery.parse(request.query);

    return reply.send(await service.listTracks(page, perPage));
  });

  app.get('/content/tracks/:trackId', { preHandler: authenticate }, async (request, reply) => {
    const { trackId } = trackIdParams.parse(request.params);

    // The response carries the disclaimer and purchase links because `trackSchema`
    // makes both non-optional — a Track missing either fails validation in the mapper
    // and never reaches here.
    return reply.send(await service.getTrack(trackId));
  });

  app.get(
    '/content/tracks/:trackId/leaves',
    { preHandler: authenticate },
    async (request, reply) => {
      const { trackId } = trackIdParams.parse(request.params);

      return reply.send({ leaves: await service.listLeaves(trackId) });
    },
  );

  app.get('/content/leaves/:leafId', { preHandler: authenticate }, async (request, reply) => {
    const { leafId } = leafIdParams.parse(request.params);

    return reply.send(await service.getLeaf(leafId));
  });
}
