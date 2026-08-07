import { localDateSchema, timeZoneSchema } from '@zoomout/shared';
import { z } from 'zod';

import type { ZoomOutApp } from '../app.js';
import type { AppConfig } from '../config/env.js';
import type { AuthService, IssuedSession } from './auth.service.js';

/**
 * Authentication endpoints.
 *
 * Handlers do three things: parse the body, call the service, shape the response.
 * Every decision — the age gate, credential checking, linking, rotation — belongs to
 * `AuthService`.
 */

const HTTP_CREATED = 201;

/**
 * Minimum password length only.
 *
 * Composition rules (a digit, a symbol, mixed case) are deliberately absent: NIST
 * 800-63B recommends against them because they push people towards predictable
 * substitutions without adding real entropy. Length is what matters.
 */
const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(256, 'Password must be at most 256 characters');

const signUpBodySchema = z.object({
  email: z.email(),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80),
  dateOfBirth: localDateSchema,
  timezone: timeZoneSchema,
});

const signInBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(256),
});

const providerBodySchema = z.object({
  provider: z.enum(['apple', 'google']),
  idToken: z.string().min(1),
  displayName: z.string().trim().min(1).max(80).optional(),
  dateOfBirth: localDateSchema.optional(),
  timezone: timeZoneSchema.optional(),
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

function sessionResponse(session: IssuedSession): Record<string, unknown> {
  return {
    userId: session.userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.accessTokenExpiresInSeconds,
    tokenType: 'Bearer',
  };
}

export function registerAuthRoutes(
  app: ZoomOutApp,
  service: AuthService,
  config: AppConfig,
): void {
  /**
   * Rate limiting applies to all four routes below.
   *
   * Signup and login are the obvious targets for credential stuffing; refresh is
   * included because it is the one unauthenticated endpoint that mints access tokens,
   * so an unthrottled refresh is a free oracle for guessing token values.
   */
  const rateLimit = {
    config: {
      rateLimit: {
        max: config.AUTH_RATE_LIMIT_MAX,
        timeWindow: config.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000,
      },
    },
  };

  app.post('/auth/signup', rateLimit, async (request, reply) => {
    const body = signUpBodySchema.parse(request.body);
    const session = await service.signUpWithEmail(body);

    return reply.status(HTTP_CREATED).send(sessionResponse(session));
  });

  app.post('/auth/login', rateLimit, async (request, reply) => {
    const body = signInBodySchema.parse(request.body);
    const session = await service.signInWithEmail(body);

    return reply.send(sessionResponse(session));
  });

  app.post('/auth/provider', rateLimit, async (request, reply) => {
    const body = providerBodySchema.parse(request.body);
    const session = await service.signInWithProvider(body);

    return reply.send(sessionResponse(session));
  });

  app.post('/auth/refresh', rateLimit, async (request, reply) => {
    const body = refreshBodySchema.parse(request.body);
    const session = await service.refreshSession(body.refreshToken);

    return reply.send(sessionResponse(session));
  });
}
