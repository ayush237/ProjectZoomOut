import type { FastifyRequest } from 'fastify';

import { InvalidTokenError } from './auth.errors.js';
import type { TokenService } from './tokens.js';

/**
 * Bearer-token authentication as a Fastify `preHandler`.
 *
 * Every route from here on states whether it is authenticated, by attaching this or
 * not attaching it. There is deliberately no global hook with an exemption list:
 * "authenticated unless someone remembered to add it to the array" fails open, and a
 * route added later inherits protection nobody thought about.
 */

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `authenticate`. Read it through `requireUserId`, never directly. */
    authenticatedUserId?: string;
  }
}

const BEARER_PREFIX = 'Bearer ';

export type Authenticator = (request: FastifyRequest) => Promise<void>;

export function createAuthenticator(tokens: TokenService): Authenticator {
  return async function authenticate(request: FastifyRequest): Promise<void> {
    const header = request.headers.authorization;

    if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
      throw new InvalidTokenError();
    }

    const claims = await tokens.verifyAccessToken(header.slice(BEARER_PREFIX.length));
    request.authenticatedUserId = claims.userId;
  };
}

/**
 * The authenticated user's id.
 *
 * Throws rather than returning undefined: reaching a handler that calls this without
 * the `authenticate` preHandler attached is a wiring mistake, and it should fail
 * loudly at the first request rather than quietly treat the caller as anonymous.
 *
 * @throws {InvalidTokenError} if the request was never authenticated.
 */
export function requireUserId(request: FastifyRequest): string {
  const userId = request.authenticatedUserId;

  if (userId === undefined) {
    throw new InvalidTokenError();
  }

  return userId;
}
