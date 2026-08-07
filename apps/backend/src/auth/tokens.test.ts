import { describe, expect, it } from 'vitest';

import { loadConfig, type AppConfig } from '../config/env.js';
import { InvalidTokenError } from './auth.errors.js';
import { hashRefreshToken, TokenService } from './tokens.js';

const baseEnv = {
  DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
  AUTH_JWT_SECRET: 'a'.repeat(48),
};

const configWith = (overrides: Record<string, string> = {}): AppConfig =>
  loadConfig({ ...baseEnv, ...overrides });

describe('TokenService access tokens', () => {
  it('issues a token that verifies back to the same user', async () => {
    const service = new TokenService(configWith());
    const token = await service.issueAccessToken({ userId: 'user-1' });

    await expect(service.verifyAccessToken(token)).resolves.toEqual({ userId: 'user-1' });
  });

  it('rejects a token signed with a different secret', async () => {
    const issuer = new TokenService(configWith());
    const verifier = new TokenService(configWith({ AUTH_JWT_SECRET: 'b'.repeat(48) }));
    const token = await issuer.issueAccessToken({ userId: 'user-1' });

    await expect(verifier.verifyAccessToken(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects a tampered payload', async () => {
    const service = new TokenService(configWith());
    const token = await service.issueAccessToken({ userId: 'user-1' });

    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'user-2' })).toString('base64url');

    await expect(
      service.verifyAccessToken(`${String(header)}.${forgedPayload}.${String(signature)}`),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects an expired token', async () => {
    const service = new TokenService(configWith({ AUTH_ACCESS_TOKEN_TTL_SECONDS: '1' }));
    const token = await service.issueAccessToken({ userId: 'user-1' });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects a garbage string', async () => {
    const service = new TokenService(configWith());

    await expect(service.verifyAccessToken('not-a-token')).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('rejects an unsigned alg:none token', async () => {
    const service = new TokenService(configWith());
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ sub: 'user-1', iss: 'zoomout', aud: 'zoomout-app', exp: 9_999_999_999 }),
    ).toString('base64url');

    await expect(service.verifyAccessToken(`${header}.${body}.`)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('honours the configured lifetime rather than a literal', async () => {
    const service = new TokenService(configWith({ AUTH_ACCESS_TOKEN_TTL_SECONDS: '3600' }));
    const token = await service.issueAccessToken({ userId: 'user-1' });

    const payload = JSON.parse(
      Buffer.from(String(token.split('.')[1]), 'base64url').toString('utf8'),
    ) as { exp: number; iat: number };

    expect(payload.exp - payload.iat).toBe(3600);
  });
});

describe('TokenService refresh tokens', () => {
  it('issues a high-entropy token with its hash and expiry', () => {
    const service = new TokenService(configWith());
    const issued = service.issueRefreshToken();

    expect(issued.token.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url
    expect(issued.tokenHash).toBe(hashRefreshToken(issued.token));
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('never repeats a token', () => {
    const service = new TokenService(configWith());
    const tokens = new Set(Array.from({ length: 200 }, () => service.issueRefreshToken().token));

    expect(tokens.size).toBe(200);
  });

  it('stores a hash that does not reveal the token', () => {
    const service = new TokenService(configWith());
    const issued = service.issueRefreshToken();

    expect(issued.tokenHash).not.toContain(issued.token);
    expect(issued.tokenHash).toHaveLength(64); // sha256 hex
  });

  it('honours the configured refresh lifetime', () => {
    const service = new TokenService(configWith({ AUTH_REFRESH_TOKEN_TTL_SECONDS: '60' }));
    const issued = service.issueRefreshToken();

    const lifetimeSeconds = Math.round((issued.expiresAt.getTime() - Date.now()) / 1000);
    expect(lifetimeSeconds).toBeGreaterThanOrEqual(58);
    expect(lifetimeSeconds).toBeLessThanOrEqual(60);
  });

  it('mints a distinct family id per login', () => {
    const service = new TokenService(configWith());

    expect(service.newTokenFamilyId()).not.toBe(service.newTokenFamilyId());
  });
});

describe('AUTH_JWT_SECRET validation', () => {
  it('refuses to boot with no secret', () => {
    expect(() => loadConfig({ DATABASE_URL: baseEnv.DATABASE_URL })).toThrow(/AUTH_JWT_SECRET/u);
  });

  it('refuses to boot with a short secret', () => {
    expect(() => configWith({ AUTH_JWT_SECRET: 'too-short' })).toThrow(/at least 32/u);
  });

  it('refuses to boot with the .env.example placeholder', () => {
    expect(() =>
      configWith({ AUTH_JWT_SECRET: 'replace-me-with-at-least-32-random-characters' }),
    ).toThrow(/placeholder/u);
  });

  it('never includes the secret value in the error', () => {
    const secret = 'short';
    try {
      configWith({ AUTH_JWT_SECRET: secret });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
