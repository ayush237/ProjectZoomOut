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

    const unlocked = await service.addTrack(userId, trackId);

    /**
     * 200 with the unlocks, where WP3 returned 204.
     *
     * Still not 201 — the add is idempotent, so "created" would be a lie on the second
     * call. The body arrived in WP5b because `first-book` has to reach the client in
     * the response of the action that earned it; a 204 would force the app to poll to
     * discover a badge it had just won.
     */
    return reply.send({ unlocked });
  });

  app.delete('/library/tracks/:trackId', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);
    const { trackId } = trackIdParams.parse(request.params);

    await service.removeTrack(userId, trackId);

    return reply.status(HTTP_NO_CONTENT).send();
  });
}
