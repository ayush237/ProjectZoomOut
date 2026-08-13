import { z } from 'zod';

import type { ZoomOutApp } from '../app.js';
import { requireUserId, type Authenticator } from '../auth/authenticate.js';
import type { ProgressService } from './progress.service.js';
import type { SessionSummaryService } from './sessionSummary.service.js';

/**
 * Learning-loop endpoints. All authenticated.
 *
 * No `:userId` anywhere, for the same reason as the library routes: progress is always
 * the caller's own, so grading or completing on someone else's behalf is not a check
 * that can be forgotten — it is a request that cannot be expressed.
 *
 * Handlers parse and delegate. Grading, the unlock gate, XP and idempotency all live in
 * the service; nothing here decides anything.
 */

const leafIdParams = z.object({ leafId: z.string().min(1) });

/**
 * The client sends an option id and nothing else.
 *
 * `.strict()` on purpose: a body carrying `isCorrect` alongside the id is either a
 * confused client or someone testing whether the server will take its word for it, and
 * silently ignoring the extra field is how that misunderstanding survives to WP8.
 */
const answerBody = z.object({ optionId: z.string().min(1) }).strict();

export function registerProgressRoutes(
  app: ZoomOutApp,
  service: ProgressService,
  summaries: SessionSummaryService,
  authenticate: Authenticator,
): void {
  /**
   * Today's cap state and the reader's streak.
   *
   * One endpoint rather than two: Profile shows the streak, the limit screen shows the
   * cap, and both are one round trip at app open. Neither takes a date parameter —
   * "today" is the server's answer, computed from the reader's stored timezone, so a
   * device with a skewed clock cannot reset its own cap.
   */
  app.get('/progress/today', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);

    return reply.send(await service.readDay(userId));
  });

  /**
   * The reader's day, assembled for the wrap-up screen (WP9).
   *
   * A **GET**, and deliberately not the thing that records the wrap: ending a session is
   * an event the reader causes and goes to `POST /events`, while this only reports. Two
   * calls rather than one so that opening the summary from Journey — or re-opening it
   * after the cap fires — does not silently log a second wrap-up.
   *
   * No date parameter, for the same reason as `/progress/today`.
   */
  app.get('/progress/summary', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);

    return reply.send(await summaries.read(userId));
  });

  app.get('/progress/leaves/:leafId', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireUserId(request);
    const { leafId } = leafIdParams.parse(request.params);

    return reply.send({ progress: await service.getProgress(userId, leafId) });
  });

  app.post(
    '/progress/leaves/:leafId/start',
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { leafId } = leafIdParams.parse(request.params);

      // 200, not 201: idempotent, and re-entering a Leaf creates nothing the second
      // time. The reader's existing progress is the point of the response.
      return reply.send({ progress: await service.startLeaf(userId, leafId) });
    },
  );

  app.post(
    '/progress/leaves/:leafId/answer',
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { leafId } = leafIdParams.parse(request.params);
      const { optionId } = answerBody.parse(request.body);

      // A wrong answer is a 200. It is the expected, designed-for outcome of the
      // mechanic — not an error — and the client renders it, retries, and moves on.
      return reply.send(await service.submitAnswer(userId, leafId, optionId));
    },
  );

  app.post(
    '/progress/leaves/:leafId/complete',
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { leafId } = leafIdParams.parse(request.params);

      return reply.send(await service.completeLeaf(userId, leafId));
    },
  );
}
