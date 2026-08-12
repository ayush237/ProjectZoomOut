import { z } from 'zod';

import type { ZoomOutApp } from '../app.js';
import { requireUserId, type Authenticator } from '../auth/authenticate.js';
import type { AchievementService } from './achievements.service.js';

/**
 * Achievements and the events only the reader can report. All authenticated.
 *
 * No `:userId` anywhere, as everywhere else: achievements are always the caller's own,
 * so awarding one to somebody else is a request that cannot be expressed rather than a
 * check that could be forgotten.
 */

/**
 * The event body.
 *
 * `.strict()`, and the event type is an enum rather than a free string — this endpoint
 * writes a row on the reader's say-so, so the set of things they may assert is closed.
 * `leafId` is optional because a session wrap belongs to a day, not to a Leaf.
 */
const eventBody = z
  .object({
    type: z.enum(['dinner_table_open', 'session_wrap']),
    leafId: z.string().min(1).optional(),
  })
  .strict();

export function registerAchievementRoutes(
  app: ZoomOutApp,
  service: AchievementService,
  authenticate: Authenticator,
): void {
  /**
   * The full catalogue with this reader's unlocks resolved against it.
   *
   * All nineteen, locked ones included. The client holds no copy of the list — a
   * client-side catalogue would go stale the moment a twentieth shipped, and the reader
   * would simply stop being shown the tile they were meant to come back for.
   */
  app.get('/achievements', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);

    return reply.send({ achievements: await service.listForReader(userId) });
  });

  /**
   * Records something only the reader can tell us, and returns what it unlocked.
   *
   * Opening a Dinner Table Knowledge fact is invisible server-side — the takeaway slide
   * ships with the Leaf, and the fact is revealed by a tap. Without this there is no
   * signal that the deep-cut content is read at all, which the proposal names as reason
   * enough on its own.
   *
   * 200 with the unlocks rather than 204: the unlock has to arrive in the response of
   * the action that caused it, and this *is* that action.
   */
  app.post('/events', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);
    const { type, leafId } = eventBody.parse(request.body);

    const unlocked = await service.recordEvent(userId, type, leafId ?? null);

    return reply.send({ unlocked });
  });
}
