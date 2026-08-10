import type { IncomingMessage, ServerResponse } from 'node:http';

import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type RawServerDefault } from 'fastify';
import { ZodError } from 'zod';

import type { Authenticator } from './auth/authenticate.js';
import { registerAuthRoutes } from './auth/auth.routes.js';
import type { AuthService } from './auth/auth.service.js';
import type { AppConfig } from './config/env.js';
import { registerContentRoutes } from './content/content.routes.js';
import type { ContentService } from './content/content.service.js';
import { AppError, toError } from './errors.js';
import { registerLibraryRoutes } from './library/library.routes.js';
import type { LibraryService } from './library/library.service.js';
import { registerHealthRoutes } from './health/health.routes.js';
import type { HealthService } from './health/health.service.js';
import type { AppLogger } from './logging/logger.js';
import { registerProgressRoutes } from './progress/progress.routes.js';
import type { ProgressService } from './progress/progress.service.js';
import { registerProfileRoutes } from './users/profile.routes.js';
import type { ProfileService } from './users/profile.service.js';

/**
 * Everything the HTTP layer needs, injected rather than constructed here.
 *
 * `buildApp` is deliberately free of side effects — it opens no sockets and no
 * database connections — so integration tests can build a real app against a real
 * database of their choosing without going through `index.ts`.
 */
export interface AppDependencies {
  readonly config: AppConfig;
  readonly logger: AppLogger;
  readonly healthService: HealthService;
  readonly authService: AuthService;
  readonly profileService: ProfileService;
  readonly contentService: ContentService;
  readonly libraryService: LibraryService;
  readonly progressService: ProgressService;
  readonly authenticate: Authenticator;
}

/**
 * The application's Fastify instance type.
 *
 * Fastify is generic over its logger, so handing it a concrete pino instance produces
 * an instance type narrower than the bare `FastifyInstance` default. Naming it once
 * here keeps routes, tests and the composition root agreeing instead of each
 * rediscovering the mismatch.
 */
export type ZoomOutApp = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse<IncomingMessage>,
  AppLogger
>;

const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_SERVER_ERROR = 500;

interface ClientError {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
}

/**
 * Recognises a 4xx raised by Fastify or one of its plugins.
 *
 * Fastify types the error handler's argument as `unknown`, so this narrows by
 * inspection rather than by cast. Only 4xx qualifies: those describe the request and
 * are safe to echo back, whereas a plugin reporting a 5xx is still our bug and its
 * detail must not leave the process.
 */
function asClientError(error: unknown): ClientError | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const candidate: Record<string, unknown> = error as Record<string, unknown>;
  const statusCode = candidate['statusCode'];

  if (typeof statusCode !== 'number' || statusCode < 400 || statusCode >= 500) {
    return null;
  }

  const code = candidate['code'];
  const message = candidate['message'];

  return {
    statusCode,
    code: typeof code === 'string' ? code : 'BAD_REQUEST',
    message: typeof message === 'string' ? message : 'Request rejected',
  };
}

export async function buildApp(deps: AppDependencies): Promise<ZoomOutApp> {
  const app = Fastify({
    loggerInstance: deps.logger,
    // Trust the platform load balancer for client IPs once deployed behind one.
    trustProxy: deps.config.NODE_ENV === 'production',
  });

  // Registered globally but applied per route, so only the endpoints that opt in are
  // throttled. A blanket limit would throttle authenticated reads too, which is a
  // different problem with a different sensible answer.
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((error, request, reply) => {
    // A malformed body is the client's mistake, not ours. Zod's issue list is safe to
    // return — it describes the request that was just sent, and nothing else.
    if (error instanceof ZodError) {
      return reply.status(HTTP_BAD_REQUEST).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body is invalid',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    if (error instanceof AppError) {
      request.log.warn({ err: error, code: error.code }, 'Request failed');

      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }

    /**
     * Errors raised by Fastify itself or by a plugin.
     *
     * These carry their own 4xx status and a message describing the request, not our
     * internals: rate limiting (429), a malformed JSON body (400), an unsupported
     * content type (415). Without this branch they all collapse into a 500, which
     * both misleads the client and hides a working control — the rate limiter looks
     * broken because a throttled caller is told the server crashed.
     *
     * Restricted to 4xx: a plugin reporting a 5xx is still our problem and must not
     * have its detail forwarded.
     */
    const clientError = asClientError(error);
    if (clientError !== null) {
      request.log.warn({ err: toError(error), statusCode: clientError.statusCode }, 'Request rejected');

      return reply.status(clientError.statusCode).send({
        error: { code: clientError.code, message: clientError.message },
      });
    }

    // Anything not deliberately raised as an AppError is a bug. Log it in full,
    // return nothing about it: internal messages can carry table names, queries and
    // occasionally credentials.
    request.log.error({ err: toError(error) }, 'Unhandled error');

    return reply.status(HTTP_INTERNAL_SERVER_ERROR).send({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  registerHealthRoutes(app, deps.healthService);
  registerContentRoutes(app, deps.contentService, deps.authenticate);
  registerLibraryRoutes(app, deps.libraryService, deps.authenticate);
  registerProgressRoutes(app, deps.progressService, deps.authenticate);
  registerAuthRoutes(app, deps.authService, deps.config, deps.authenticate);
  registerProfileRoutes(app, deps.profileService, deps.authenticate);

  return app;
}
