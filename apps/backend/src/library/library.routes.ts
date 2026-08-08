import { z } from 'zod';

import type { ZoomOutApp } from '../app.js';
import { requireUserId, type Authenticator } from '../auth/authenticate.js';
import type { LibraryService } from './library.service.js';

/**
 * Library endpoints. All authenticated.
 *
 * There is no `:userId` in any path. The library is always the caller's own, which
 * makes cross-user access structurally impossible rather than a check somebody has to
 * remember — unlike the profile routes, where an explicit id is genuinely useful.
 */

const trackIdParams = z.object({ trackId: z.string().min(1) });

const HTTP_NO_CONTENT = 204;

export function registerLibraryRoutes(
  app: ZoomOutApp,
  service: LibraryService,
  authenticate: Authenticator,
): void {
  app.get('/library', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);

    return reply.send({ entries: await service.listLibrary(userId) });
  });

  app.post('/library/tracks/:trackId', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);
    const { trackId } = trackIdParams.parse(request.params);

    await service.addTrack(userId, trackId);

    // 204 rather than 201: idempotent, so "created" would be a lie on the second call
    // and the client has nothing to do with a body either way.
    return reply.status(HTTP_NO_CONTENT).send();
  });

  app.delete('/library/tracks/:trackId', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);
    const { trackId } = trackIdParams.parse(request.params);

    await service.removeTrack(userId, trackId);

    return reply.status(HTTP_NO_CONTENT).send();
  });
}
