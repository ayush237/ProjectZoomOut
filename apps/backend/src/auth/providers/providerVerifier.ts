import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { InvalidProviderTokenError } from '../auth.errors.js';

/**
 * Server-side verification of Apple and Google ID tokens.
 *
 * This is a security boundary, not a formality. The client sends a string it claims
 * came from Apple or Google; without checking the signature against the provider's
 * published keys, anyone can mint one asserting any `sub` and any email and log in as
 * anybody. Four things are checked and all four matter:
 *
 *  - **signature** against the provider's JWKS — proves the provider issued it
 *  - **issuer** — proves it came from the provider we think it did
 *  - **audience** — proves it was minted for *our* app and not some other app the
 *    same provider serves, which is otherwise a valid-token replay across tenants
 *  - **expiry** — bounds the replay window
 *
 * The JWKS URI is injected rather than hardcoded so tests can serve a local key set
 * and exercise this code for real, instead of stubbing out the very thing that
 * protects the login path.
 */

export type SocialProvider = 'apple' | 'google';

export interface ProviderSettings {
  /** Accepted `iss` values. Google emits two spellings of its own issuer. */
  readonly issuers: readonly string[];
  /** Our client id at this provider — the expected `aud`. */
  readonly audience: string;
  readonly jwksUri: string;
}

export interface VerifiedProviderIdentity {
  readonly provider: SocialProvider;
  /** The provider's stable identifier. This, not the email, is the identity. */
  readonly subject: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
}

export const APPLE_DEFAULTS = {
  issuers: ['https://appleid.apple.com'],
  jwksUri: 'https://appleid.apple.com/auth/keys',
} as const;

export const GOOGLE_DEFAULTS = {
  // Google issues both spellings and documents both as valid.
  issuers: ['https://accounts.google.com', 'accounts.google.com'],
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
} as const;

type JwksResolver = ReturnType<typeof createRemoteJWKSet>;

export class ProviderTokenVerifier {
  private readonly jwks = new Map<SocialProvider, JwksResolver>();

  constructor(private readonly settings: Readonly<Record<SocialProvider, ProviderSettings>>) {}

  /**
   * @throws {InvalidProviderTokenError} on any verification failure.
   */
  public async verify(
    provider: SocialProvider,
    idToken: string,
  ): Promise<VerifiedProviderIdentity> {
    const settings = this.settings[provider];
    let payload: JWTPayload;

    try {
      ({ payload } = await jwtVerify(idToken, this.resolverFor(provider), {
        issuer: [...settings.issuers],
        audience: settings.audience,
      }));
    } catch (error) {
      // Collapsed to one error deliberately: which check failed is useful to an
      // attacker probing the endpoint and useless to a legitimate client.
      throw new InvalidProviderTokenError({ cause: error });
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new InvalidProviderTokenError();
    }

    return {
      provider,
      subject: payload.sub,
      email: typeof payload['email'] === 'string' ? payload['email'].toLowerCase() : null,
      emailVerified: parseEmailVerifiedClaim(payload['email_verified']),
    };
  }

  /**
   * JWKS resolvers are cached per provider because `createRemoteJWKSet` keeps its own
   * key cache and rate-limits refetches. Building a new one per request would discard
   * that and hammer the provider on every sign-in.
   */
  private resolverFor(provider: SocialProvider): JwksResolver {
    const existing = this.jwks.get(provider);
    if (existing !== undefined) {
      return existing;
    }

    const resolver = createRemoteJWKSet(new URL(this.settings[provider].jwksUri));
    this.jwks.set(provider, resolver);
    return resolver;
  }
}

/**
 * Reads `email_verified`, which is not reliably a boolean.
 *
 * Apple has long emitted it as the *string* `"true"` rather than a boolean. A plain
 * `=== true` check therefore reads every Apple account as unverified, which under our
 * account-linking rule would refuse to link legitimate returning users. Anything that
 * is not exactly `true` or `"true"` is treated as unverified — the safe direction,
 * since the consequence of a false positive is account takeover.
 */
function parseEmailVerifiedClaim(claim: unknown): boolean {
  return claim === true || claim === 'true';
}
