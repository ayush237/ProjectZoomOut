import { timeZoneSchema } from '@zoomout/shared';
import { z } from 'zod';

import type { ZoomOutApp } from '../app.js';
import type { Authenticator } from '../auth/authenticate.js';
import { requireUserId } from '../auth/authenticate.js';
import type { ProfileService } from './profile.service.js';

/**
 * Profile endpoints. All authenticated.
 *
 * `/users/me` resolves to the caller, and `/users/:userId` exists so the client can be
 * explicit — the service compares the requested id against the authenticated one
 * either way, so the second form cannot be used to reach somebody else.
 */

const paramsSchema = z.object({ userId: z.string().min(1) });

const updateBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    /**
     * Goes through the shared schema, which rejects bare UTC offsets like `+05:30`.
     * An offset is frozen, so accepting one would break local-midnight rollover for
     * this reader's streak and session cap the moment their region shifts for DST.
     */
    timezone: timeZoneSchema.optional(),
  })
  .refine(
    (body) => body.displayName !== undefined || body.timezone !== undefined,
    'Provide at least one of displayName or timezone',
  );

export function registerProfileRoutes(
  app: ZoomOutApp,
  service: ProfileService,
  authenticate: Authenticator,
): void {
  app.get('/users/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);

    return reply.send(await service.getProfile(userId, userId));
  });

  app.get('/users/:userId', { preHandler: authenticate }, async (request, reply) => {
    const authenticatedUserId = requireUserId(request);
    const { userId } = paramsSchema.parse(request.params);

    return reply.send(await service.getProfile(authenticatedUserId, userId));
  });

  app.patch('/users/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);
    const body = updateBodySchema.parse(request.body);

    return reply.send(await service.updateProfile(userId, userId, body));
  });

  app.patch('/users/:userId', { preHandler: authenticate }, async (request, reply) => {
    const authenticatedUserId = requireUserId(request);
    const { userId } = paramsSchema.parse(request.params);
    const body = updateBodySchema.parse(request.body);

    return reply.send(await service.updateProfile(authenticatedUserId, userId, body));
  });
}
