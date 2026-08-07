import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { jwtVerify, SignJWT, type JWTPayload } from 'jose';

import type { AppConfig } from '../config/env.js';
import { InvalidTokenError } from './auth.errors.js';

/**
 * Access and refresh token mechanics.
 *
 * Two tokens with deliberately different properties:
 *
 * - The **access token** is a short-lived signed JWT. It is verified by signature
 *   alone, with no database round trip, which is what keeps every authenticated
 *   request cheap. The cost of that is that it cannot be revoked before it expires —
 *   hence "short-lived".
 * - The **refresh token** is opaque random bytes with a server-side row. It *can* be
 *   revoked, which is what makes sessions terminable, and it rotates on every use.
 */

const ISSUER = 'zoomout';
const AUDIENCE = 'zoomout-app';
const REFRESH_TOKEN_BYTES = 32;

export interface AccessTokenClaims {
  /** The user this token authenticates. */
  readonly userId: string;
}

export interface IssuedRefreshToken {
  /** Returned to the client exactly once; never stored in this form. */
  readonly token: string;
  /** What goes in the database, and what a refresh request is looked up by. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export class TokenService {
  private readonly signingKey: Uint8Array;

  constructor(private readonly config: AppConfig) {
    this.signingKey = new TextEncoder().encode(config.AUTH_JWT_SECRET);
  }

  public async issueAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${String(this.config.AUTH_ACCESS_TOKEN_TTL_SECONDS)}s`)
      .sign(this.signingKey);
  }

  /**
   * @throws {InvalidTokenError} if the signature, issuer, audience or expiry fails.
   */
  public async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    let payload: JWTPayload;

    try {
      ({ payload } = await jwtVerify(token, this.signingKey, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      }));
    } catch (error) {
      // Every failure mode collapses to one error on purpose. Telling a caller
      // *which* check failed helps an attacker far more than it helps a client.
      throw new InvalidTokenError({ cause: error });
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new InvalidTokenError();
    }

    return { userId: payload.sub };
  }

  /**
   * Mints a refresh token.
   *
   * 256 bits from the CSPRNG, base64url encoded. The plaintext is returned to the
   * caller once and never persisted; only its SHA-256 survives, so a database leak
   * yields no usable sessions.
   */
  public issueRefreshToken(): IssuedRefreshToken {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.config.AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    return { token, tokenHash: hashRefreshToken(token), expiresAt };
  }

  /** A fresh family identifier, shared by every token rotated from one login. */
  public newTokenFamilyId(): string {
    return randomUUID();
  }
}

/**
 * SHA-256, not argon2 — see the note on `refresh_tokens.token_hash` in the schema.
 * The token is already high-entropy random, and it has to be looked up by value.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
