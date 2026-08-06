import type { IncomingMessage, ServerResponse } from 'node:http';

import Fastify, { type FastifyInstance, type RawServerDefault } from 'fastify';

import type { AppConfig } from './config/env.js';
import { AppError, toError } from './errors.js';
import { registerHealthRoutes } from './health/health.routes.js';
import type { HealthService } from './health/health.service.js';
import type { AppLogger } from './logging/logger.js';

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

const HTTP_INTERNAL_SERVER_ERROR = 500;

export function buildApp(deps: AppDependencies): ZoomOutApp {
  const app = Fastify({
    loggerInstance: deps.logger,
    // Trust the platform load balancer for client IPs once deployed behind one.
    trustProxy: deps.config.NODE_ENV === 'production',
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      request.log.error({ err: error, code: error.code }, 'Request failed');

      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
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

  return app;
}
