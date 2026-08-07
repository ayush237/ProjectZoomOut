import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InvalidProviderTokenError } from '../auth.errors.js';
import { ProviderTokenVerifier, type ProviderSettings } from './providerVerifier.js';

/**
 * These tests sign real tokens with a locally generated key pair and serve a real
 * JWKS over a local HTTP server.
 *
 * Nothing about the verification is mocked. Stubbing `jwtVerify` would leave the one
 * piece of code standing between an attacker and every account entirely untested, and
 * calling Apple or Google from CI would be flaky and unable to produce the negative
 * cases at all — a genuinely bad signature is not something a real provider will mint
 * on request.
 */

const ISSUER = 'https://provider.test';
const AUDIENCE = 'zoomout-client-id';
const KEY_ID = 'test-key-1';

/** jose's key type, derived rather than named — `CryptoKey` needs the DOM lib. */
type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

let jwksServer: Server;
let jwksUri: string;
let signingKey: PrivateKey;
let otherKey: PrivateKey;

const sign = async (
  claims: Record<string, unknown>,
  overrides: { issuer?: string; audience?: string; expiresIn?: string; key?: PrivateKey } = {},
): Promise<string> =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setSubject((claims['sub'] as string | undefined) ?? 'provider-subject-1')
    .setIssuer(overrides.issuer ?? ISSUER)
    .setAudience(overrides.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? '5m')
    .sign(overrides.key ?? signingKey);

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  const impostor = await generateKeyPair('RS256', { extractable: true });
  signingKey = pair.privateKey;
  otherKey = impostor.privateKey;

  const publicJwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: KEY_ID, alg: 'RS256' };

  jwksServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [publicJwk] }));
  });

  await new Promise<void>((resolve) => {
    jwksServer.listen(0, '127.0.0.1', resolve);
  });

  const { port } = jwksServer.address() as AddressInfo;
  jwksUri = `http://127.0.0.1:${String(port)}/keys`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    jwksServer.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

function buildVerifier(): ProviderTokenVerifier {
  const settings: ProviderSettings = { issuers: [ISSUER], audience: AUDIENCE, jwksUri };
  return new ProviderTokenVerifier({ apple: settings, google: settings });
}

describe('ProviderTokenVerifier', () => {
  it('accepts a correctly signed token', async () => {
    const token = await sign({ sub: 'sub-123', email: 'reader@example.test', email_verified: true });

    const identity = await buildVerifier().verify('google', token);

    expect(identity).toEqual({
      provider: 'google',
      subject: 'sub-123',
      email: 'reader@example.test',
      emailVerified: true,
    });
  });

  it('rejects a token signed by the wrong key', async () => {
    const token = await sign({ sub: 'sub-123' }, { key: otherKey });

    await expect(buildVerifier().verify('google', token)).rejects.toBeInstanceOf(
      InvalidProviderTokenError,
    );
  });

  it('rejects a token from the wrong issuer', async () => {
    const token = await sign({ sub: 'sub-123' }, { issuer: 'https://evil.test' });

    await expect(buildVerifier().verify('google', token)).rejects.toBeInstanceOf(
      InvalidProviderTokenError,
    );
  });

  it('rejects a token minted for a different audience', async () => {
    // A real, provider-signed token for someone else's app. Without the audience
    // check this would authenticate — the cross-tenant replay.
    const token = await sign({ sub: 'sub-123' }, { audience: 'someone-elses-app' });

    await expect(buildVerifier().verify('google', token)).rejects.toBeInstanceOf(
      InvalidProviderTokenError,
    );
  });

  it('rejects an expired token', async () => {
    const token = await sign({ sub: 'sub-123' }, { expiresIn: '-1m' });

    await expect(buildVerifier().verify('google', token)).rejects.toBeInstanceOf(
      InvalidProviderTokenError,
    );
  });

  it('rejects a structurally invalid token', async () => {
    await expect(buildVerifier().verify('google', 'not-a-jwt')).rejects.toBeInstanceOf(
      InvalidProviderTokenError,
    );
  });

  it('rejects an unsigned token with alg none', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ sub: 'sub-123', iss: ISSUER, aud: AUDIENCE, exp: 9_999_999_999 }),
    ).toString('base64url');

    await expect(buildVerifier().verify('google', `${header}.${body}.`)).rejects.toBeInstanceOf(
      InvalidProviderTokenError,
    );
  });

  it('rejects a token with no subject', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(signingKey);

    await expect(buildVerifier().verify('google', token)).rejects.toBeInstanceOf(
      InvalidProviderTokenError,
    );
  });

  describe('email_verified claim', () => {
    it("accepts Apple's string form", async () => {
      // Apple emits the string "true", not a boolean. Reading it as unverified would
      // refuse to link legitimate returning Apple users.
      const token = await sign({ sub: 's', email: 'a@example.test', email_verified: 'true' });

      expect((await buildVerifier().verify('apple', token)).emailVerified).toBe(true);
    });

    it('accepts the boolean form', async () => {
      const token = await sign({ sub: 's', email: 'a@example.test', email_verified: true });

      expect((await buildVerifier().verify('apple', token)).emailVerified).toBe(true);
    });

    it.each([false, 'false', undefined, null, 1, 'yes'])(
      'treats %p as unverified',
      async (claim) => {
        const token = await sign({ sub: 's', email: 'a@example.test', email_verified: claim });

        expect((await buildVerifier().verify('apple', token)).emailVerified).toBe(false);
      },
    );
  });

  it('lowercases the email so linking is not defeated by casing', async () => {
    const token = await sign({ sub: 's', email: 'Reader@Example.TEST', email_verified: true });

    expect((await buildVerifier().verify('google', token)).email).toBe('reader@example.test');
  });

  it('reports a missing email as null rather than inventing one', async () => {
    const token = await sign({ sub: 's' });

    expect((await buildVerifier().verify('google', token)).email).toBeNull();
  });
});
