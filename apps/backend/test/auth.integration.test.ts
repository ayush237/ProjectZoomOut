import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresAuthRepository } from '../src/auth/auth.repository.js';
import { RefreshTokenReaper } from '../src/auth/refreshTokenReaper.js';
import { hashRefreshToken } from '../src/auth/tokens.js';
import { runMigrations } from '../src/db/migrate.js';
import { createLogger } from '../src/logging/logger.js';
import { loadConfig } from '../src/config/env.js';
import { buildTestApp, type TestApp } from './helpers/buildTestApp.js';

/**
 * End-to-end authentication against a real Postgres instance and a real (local) JWKS.
 *
 * Nothing in the security path is mocked. The rotation and replay behaviour in
 * particular cannot be verified any other way — it is a property of what is actually
 * committed to the database across several requests, not of any single function.
 *
 * Requires a running Docker daemon.
 */

const POSTGRES_IMAGE = 'postgres:16-alpine';
const PROVIDER_ISSUER = 'https://provider.test';
const PROVIDER_AUDIENCE = 'zoomout-test-client';
const KEY_ID = 'integration-key';

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

let container: StartedPostgreSqlContainer;
let harness: TestApp;
let jwksServer: Server;
let signingKey: PrivateKey;

const app = (): TestApp['app'] => harness.app;

/**
 * Reads a response body as a known shape.
 *
 * Fastify's `inject().json()` is typed `any`, which the repo's lint rules rightly
 * refuse to let flow into assertions. Routing through `unknown` makes the narrowing
 * explicit and keeps the tests type-checked rather than silently untyped.
 */
function bodyOf<T>(response: { body: string }): T {
  const parsed: unknown = JSON.parse(response.body);
  return parsed as T;
}

interface SessionBody {
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

/** A signup body that passes validation. Override to exercise a specific rule. */
const signUpBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  email: `reader-${String(Math.random()).slice(2)}@example.test`,
  password: 'a-sufficiently-long-password',
  displayName: 'Test Reader',
  dateOfBirth: '1994-03-17',
  timezone: 'Europe/London',
  ...overrides,
});

/** A reaper wired to the same database the app under test is using. */
const buildReaper = (): RefreshTokenReaper =>
  new RefreshTokenReaper(
    new PostgresAuthRepository(harness.database),
    createLogger(
      loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: container.getConnectionUri(),
        AUTH_JWT_SECRET: 'integration-test-signing-secret-at-least-32-chars',
      }),
    ),
    60_000,
  );

const providerToken = async (claims: Record<string, unknown>): Promise<string> =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setSubject((claims['sub'] as string | undefined) ?? 'provider-sub')
    .setIssuer(PROVIDER_ISSUER)
    .setAudience(PROVIDER_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(signingKey);

beforeAll(async () => {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();

  const pair = await generateKeyPair('RS256', { extractable: true });
  signingKey = pair.privateKey;
  const publicJwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: KEY_ID, alg: 'RS256' };

  jwksServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [publicJwk] }));
  });
  await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
  const { port } = jwksServer.address() as AddressInfo;

  harness = await buildTestApp({
    databaseUrl: container.getConnectionUri(),
    providerSettings: {
      issuers: [PROVIDER_ISSUER],
      audience: PROVIDER_AUDIENCE,
      jwksUri: `http://127.0.0.1:${String(port)}/keys`,
    },
    // Generous limit so the functional tests are not throttled; a dedicated suite
    // below builds its own app with a limit of 2 to test throttling itself.
    env: { AUTH_RATE_LIMIT_MAX: '1000' },
  });

  await runMigrations(harness.database);
  await app().ready();
}, 300_000);

afterAll(async () => {
  await harness?.close();
  await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
  await container?.stop();
});

/* -------------------------------------------------------------------------- */
/* Migration                                                                   */
/* -------------------------------------------------------------------------- */

describe('the auth migration', () => {
  it.each(['user_auth_providers', 'refresh_tokens'])('creates %s', async (table) => {
    const result = await harness.database.pool.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
      [table],
    );

    expect(result.rowCount).toBe(1);
  });

  it('adds email_verified_at to users', async () => {
    const result = await harness.database.pool.query(
      `select 1 from information_schema.columns
       where table_schema='public' and table_name='users' and column_name='email_verified_at'`,
    );

    expect(result.rowCount).toBe(1);
  });

  it('enforces one identity per provider subject', async () => {
    const result = await harness.database.pool.query(
      `select indexdef from pg_indexes
       where tablename='user_auth_providers' and indexname='user_auth_providers_provider_subject_unique'`,
    );

    expect(result.rows[0]).toBeDefined();
  });
});

/* -------------------------------------------------------------------------- */
/* Signup                                                                      */
/* -------------------------------------------------------------------------- */

describe('POST /auth/signup', () => {
  it('creates an account and returns a session', async () => {
    const response = await app().inject({ method: 'POST', url: '/auth/signup', payload: signUpBody() });

    expect(response.statusCode).toBe(201);
    const body = bodyOf<SessionBody>(response);
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.tokenType).toBe('Bearer');
  });

  it('rejects a duplicate email', async () => {
    const payload = signUpBody();
    await app().inject({ method: 'POST', url: '/auth/signup', payload });

    const second = await app().inject({ method: 'POST', url: '/auth/signup', payload });

    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: { code: 'EMAIL_ALREADY_REGISTERED' } });
  });

  it('treats email as case-insensitive so one address cannot become two accounts', async () => {
    const email = `Mixed-${String(Math.random()).slice(2)}@Example.TEST`;
    await app().inject({ method: 'POST', url: '/auth/signup', payload: signUpBody({ email }) });

    const second = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody({ email: email.toLowerCase() }),
    });

    expect(second.statusCode).toBe(409);
  });

  it('rejects a short password', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody({ password: 'short' }),
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects a bare UTC offset as a timezone', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody({ timezone: '+05:30' }),
    });

    expect(response.statusCode).toBe(400);
  });

  it('never returns the password or its hash', async () => {
    const password = 'a-sufficiently-long-password';
    const response = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody({ password }),
    });

    expect(response.body).not.toContain(password);
    expect(response.body).not.toContain('$argon2');
  });
});

/* -------------------------------------------------------------------------- */
/* Age gate                                                                    */
/* -------------------------------------------------------------------------- */

describe('the age gate', () => {
  const today = new Date();
  const yearsAgo = (years: number, dayOffset = 0): string => {
    const date = new Date(today);
    date.setFullYear(date.getFullYear() - years);
    date.setDate(date.getDate() + dayOffset);
    return date.toISOString().slice(0, 10);
  };

  it('refuses a signup below the threshold', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody({ dateOfBirth: yearsAgo(12) }),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'BELOW_MINIMUM_AGE' } });
  });

  it('persists no user row for a refused signup', async () => {
    const email = `minor-${String(Math.random()).slice(2)}@example.test`;

    await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody({ email, dateOfBirth: yearsAgo(9) }),
    });

    const result = await harness.database.pool.query('select 1 from users where email = $1', [
      email.toLowerCase(),
    ]);

    expect(result.rowCount).toBe(0);
  });

  it('admits someone exactly at the threshold', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody({ dateOfBirth: yearsAgo(13) }),
    });

    expect(response.statusCode).toBe(201);
  });

  it('changes outcome by configuration alone', async () => {
    // Same applicant, same code, different AUTH_MINIMUM_AGE_YEARS.
    const strict = await buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: { AUTH_MINIMUM_AGE_YEARS: '18', AUTH_RATE_LIMIT_MAX: '1000' },
    });

    try {
      const response = await strict.app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: signUpBody({ dateOfBirth: yearsAgo(16) }),
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await strict.close();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Login                                                                       */
/* -------------------------------------------------------------------------- */

describe('POST /auth/login', () => {
  it('signs in with correct credentials', async () => {
    const payload = signUpBody();
    await app().inject({ method: 'POST', url: '/auth/signup', payload });

    const response = await app().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: payload['email'], password: payload['password'] },
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const payload = signUpBody();
    await app().inject({ method: 'POST', url: '/auth/signup', payload });

    const response = await app().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: payload['email'], password: 'wrong-but-long-enough' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('gives an identical response for an unknown email and a wrong password', async () => {
    // A different status or message here would turn login into a membership oracle.
    const payload = signUpBody();
    await app().inject({ method: 'POST', url: '/auth/signup', payload });

    const wrongPassword = await app().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: payload['email'], password: 'wrong-but-long-enough' },
    });
    const unknownEmail = await app().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.test', password: 'wrong-but-long-enough' },
    });

    expect(unknownEmail.statusCode).toBe(wrongPassword.statusCode);
    expect(unknownEmail.json()).toEqual(wrongPassword.json());
  });
});

/* -------------------------------------------------------------------------- */
/* Refresh rotation and replay                                                 */
/* -------------------------------------------------------------------------- */

describe('POST /auth/refresh', () => {
  const startSession = async (): Promise<{ refreshToken: string }> => {
    const response = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody(),
    });
    return { refreshToken: bodyOf<SessionBody>(response).refreshToken };
  };

  it('exchanges a refresh token for a new session', async () => {
    const { refreshToken } = await startSession();

    const response = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(200);
    expect(bodyOf<SessionBody>(response).refreshToken).not.toBe(refreshToken);
  });

  it('makes the old token single-use', async () => {
    const { refreshToken } = await startSession();
    await app().inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken } });

    const replay = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });

    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toMatchObject({ error: { code: 'REFRESH_TOKEN_REUSE' } });
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    const { refreshToken } = await startSession();

    const rotated = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    const live = bodyOf<SessionBody>(rotated).refreshToken;

    // Replaying the old one is the signature of a stolen token.
    await app().inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken } });

    // The attacker's freshly minted token must die with the family.
    const afterRevocation = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: live },
    });

    expect(afterRevocation.statusCode).toBe(401);
  });

  it('rejects an unknown refresh token', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'not-a-real-token' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('stores refresh tokens hashed, never in plaintext', async () => {
    const { refreshToken } = await startSession();

    const result = await harness.database.pool.query(
      'select 1 from refresh_tokens where token_hash = $1',
      [refreshToken],
    );

    expect(result.rowCount).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Social sign-in                                                              */
/* -------------------------------------------------------------------------- */

describe('POST /auth/provider', () => {
  it('creates an account from a verified provider identity', async () => {
    const idToken = await providerToken({
      sub: `google-${String(Math.random()).slice(2)}`,
      email: `social-${String(Math.random()).slice(2)}@example.test`,
      email_verified: true,
    });

    const response = await app().inject({
      method: 'POST',
      url: '/auth/provider',
      payload: { provider: 'google', idToken, dateOfBirth: '1994-03-17', timezone: 'Europe/London' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('signs the same identity back in without creating a second account', async () => {
    const sub = `google-${String(Math.random()).slice(2)}`;
    const email = `repeat-${String(Math.random()).slice(2)}@example.test`;
    const payload = {
      provider: 'google' as const,
      idToken: await providerToken({ sub, email, email_verified: true }),
      dateOfBirth: '1994-03-17',
      timezone: 'Europe/London',
    };

    const first = await app().inject({ method: 'POST', url: '/auth/provider', payload });
    const second = await app().inject({ method: 'POST', url: '/auth/provider', payload });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(bodyOf<SessionBody>(second).userId).toBe(bodyOf<SessionBody>(first).userId);
  });

  it('links a verified provider to an existing password account', async () => {
    const signup = signUpBody();
    const created = await app().inject({ method: 'POST', url: '/auth/signup', payload: signup });
    const userId = bodyOf<SessionBody>(created).userId;

    const idToken = await providerToken({
      sub: `google-${String(Math.random()).slice(2)}`,
      email: signup['email'],
      email_verified: true,
    });

    const response = await app().inject({
      method: 'POST',
      url: '/auth/provider',
      payload: { provider: 'google', idToken },
    });

    expect(response.statusCode).toBe(200);
    expect(bodyOf<SessionBody>(response).userId).toBe(userId);
  });

  it('refuses to link on an unverified email claim', async () => {
    // The account-takeover case: a provider asserting an address it has not checked.
    const signup = signUpBody();
    await app().inject({ method: 'POST', url: '/auth/signup', payload: signup });

    const idToken = await providerToken({
      sub: `google-${String(Math.random()).slice(2)}`,
      email: signup['email'],
      email_verified: false,
    });

    const response = await app().inject({
      method: 'POST',
      url: '/auth/provider',
      payload: { provider: 'google', idToken },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'UNVERIFIED_EMAIL_COLLISION' } });
  });

  it('rejects a token signed by an untrusted key', async () => {
    const impostor = await generateKeyPair('RS256', { extractable: true });
    const forged = await new SignJWT({ email: 'a@example.test', email_verified: true })
      .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
      .setSubject('forged-sub')
      .setIssuer(PROVIDER_ISSUER)
      .setAudience(PROVIDER_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(impostor.privateKey);

    const response = await app().inject({
      method: 'POST',
      url: '/auth/provider',
      payload: { provider: 'google', idToken: forged, dateOfBirth: '1994-03-17', timezone: 'UTC' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_PROVIDER_TOKEN' } });
  });

  it('names the missing fields in the response body, not just in the message', async () => {
    // A first-time social signup with no date of birth or timezone. The client cannot
    // recover from a bare code here — it has to know *which* inputs to ask for — and
    // until WP6 this list was set on the error object and then dropped by the
    // serialiser, so it never left the process.
    const idToken = await providerToken({
      sub: `google-${String(Math.random()).slice(2)}`,
      email: `details-${String(Math.random()).slice(2)}@example.test`,
      email_verified: true,
    });

    const response = await app().inject({
      method: 'POST',
      url: '/auth/provider',
      payload: { provider: 'google', idToken },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: 'SIGNUP_DETAILS_REQUIRED',
        // Field names the client can route on, not prose it would have to parse.
        missingFields: ['dateOfBirth', 'timezone'],
      },
    });
  });

  it('names only the field that is actually missing', async () => {
    const idToken = await providerToken({
      sub: `google-${String(Math.random()).slice(2)}`,
      email: `partial-${String(Math.random()).slice(2)}@example.test`,
      email_verified: true,
    });

    const response = await app().inject({
      method: 'POST',
      url: '/auth/provider',
      payload: { provider: 'google', idToken, timezone: 'Europe/London' },
    });

    expect(response.json()).toMatchObject({
      error: { missingFields: ['dateOfBirth'] },
    });
  });

  it('exposes nothing beyond code and message for an error that has not opted in', async () => {
    // `responseFields` is opt-in precisely so errors carrying internal detail —
    // `ContentInvalidError.reasons` names CMS fields — cannot be serialised by default.
    // The age gate is an ordinary AppError, so its body must stay at two keys.
    const under = new Date();
    under.setFullYear(under.getFullYear() - 10);

    const idToken = await providerToken({
      sub: `google-${String(Math.random()).slice(2)}`,
      email: `quiet-${String(Math.random()).slice(2)}@example.test`,
      email_verified: true,
    });

    const response = await app().inject({
      method: 'POST',
      url: '/auth/provider',
      payload: {
        provider: 'google',
        idToken,
        dateOfBirth: under.toISOString().slice(0, 10),
        timezone: 'UTC',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(Object.keys(response.json<{ error: object }>().error).sort()).toEqual([
      'code',
      'message',
    ]);
  });

  it('applies the age gate to social signups too', async () => {
    const under = new Date();
    under.setFullYear(under.getFullYear() - 10);

    const idToken = await providerToken({
      sub: `google-${String(Math.random()).slice(2)}`,
      email: `young-${String(Math.random()).slice(2)}@example.test`,
      email_verified: true,
    });

    const response = await app().inject({
      method: 'POST',
      url: '/auth/provider',
      payload: {
        provider: 'google',
        idToken,
        dateOfBirth: under.toISOString().slice(0, 10),
        timezone: 'UTC',
      },
    });

    expect(response.statusCode).toBe(403);
  });
});

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

describe('profile', () => {
  const createReader = async (): Promise<{ userId: string; accessToken: string }> => {
    const response = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody(),
    });
    return bodyOf<SessionBody>(response);
  };

  it('returns the caller their own profile', async () => {
    const { userId, accessToken } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: userId, authProviders: ['email'] });
  });

  it('refuses an unauthenticated request', async () => {
    const response = await app().inject({ method: 'GET', url: '/users/me' });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a garbage bearer token', async () => {
    const response = await app().inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: 'Bearer not-a-token' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses to read another reader’s profile', async () => {
    const alice = await createReader();
    const bob = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: `/users/${bob.userId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('refuses to modify another reader’s profile', async () => {
    const alice = await createReader();
    const bob = await createReader();

    const response = await app().inject({
      method: 'PATCH',
      url: `/users/${bob.userId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { displayName: 'Hijacked' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('leaves the other reader untouched after a refused write', async () => {
    const alice = await createReader();
    const bob = await createReader();

    await app().inject({
      method: 'PATCH',
      url: `/users/${bob.userId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { displayName: 'Hijacked' },
    });

    const bobsProfile = await app().inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });

    expect(bodyOf<{ displayName: string }>(bobsProfile).displayName).toBe('Test Reader');
  });

  it('updates display name and timezone', async () => {
    const { accessToken } = await createReader();

    const response = await app().inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { displayName: 'Renamed', timezone: 'Asia/Kolkata' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ displayName: 'Renamed', timezone: 'Asia/Kolkata' });
  });

  it('rejects a bare UTC offset on update', async () => {
    const { accessToken } = await createReader();

    const response = await app().inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { timezone: '+05:30' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('never exposes a password hash in the profile payload', async () => {
    const { accessToken } = await createReader();

    const response = await app().inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.body).not.toContain('argon2');
    expect(response.body).not.toContain('passwordHash');
  });
});

/* -------------------------------------------------------------------------- */
/* Logout                                                                      */
/* -------------------------------------------------------------------------- */

describe('POST /auth/logout', () => {
  const startSession = async (): Promise<SessionBody> => {
    const response = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody(),
    });
    return bodyOf<SessionBody>(response);
  };

  const logout = async (session: SessionBody, refreshToken = session.refreshToken) =>
    app().inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: { refreshToken },
    });

  it('revokes the caller’s session', async () => {
    const session = await startSession();

    expect((await logout(session)).statusCode).toBe(204);

    const afterLogout = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: session.refreshToken },
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it('succeeds when called twice', async () => {
    const session = await startSession();

    expect((await logout(session)).statusCode).toBe(204);
    expect((await logout(session)).statusCode).toBe(204);
  });

  it('succeeds for a refresh token the server has never seen', async () => {
    const session = await startSession();

    expect((await logout(session, 'never-issued-token')).statusCode).toBe(204);
  });

  it('requires authentication, so a stolen refresh token alone cannot sign someone out', async () => {
    const session = await startSession();

    const response = await app().inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: session.refreshToken },
    });

    expect(response.statusCode).toBe(401);
  });

  it('revokes the whole family, so a rotated token from the same login also dies', async () => {
    const session = await startSession();

    const rotated = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: session.refreshToken },
    });
    const current = bodyOf<SessionBody>(rotated).refreshToken;

    await logout(session, current);

    const afterLogout = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: current },
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it('leaves another device’s session alive', async () => {
    // Two sign-ins for different readers means two families; signing one out must
    // not touch the other.
    const phone = await startSession();
    const tablet = await startSession();

    await logout(phone);

    const tabletStillWorks = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: tablet.refreshToken },
    });
    expect(tabletStillWorks.statusCode).toBe(200);
  });
});

/* -------------------------------------------------------------------------- */
/* Reaping expired refresh tokens                                              */
/* -------------------------------------------------------------------------- */

describe('RefreshTokenReaper', () => {
  const countTokens = async (): Promise<number> => {
    const result = await harness.database.pool.query<{ count: string }>(
      'select count(*)::text as count from refresh_tokens',
    );
    return Number(result.rows[0]?.count ?? '0');
  };

  it('removes tokens whose expiry has passed', async () => {
    const session = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody(),
    });
    const { refreshToken } = bodyOf<SessionBody>(session);

    // Age the row past its expiry rather than waiting for one.
    await harness.database.pool.query(
      `update refresh_tokens set expires_at = now() - interval '1 day'
       where token_hash = $1`,
      [hashRefreshToken(refreshToken)],
    );

    const before = await countTokens();
    const reaped = await buildReaper().reapOnce();

    expect(reaped).toBeGreaterThanOrEqual(1);
    expect(await countTokens()).toBe(before - reaped);
  });

  it('leaves live tokens alone', async () => {
    const session = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody(),
    });
    const { refreshToken } = bodyOf<SessionBody>(session);

    await buildReaper().reapOnce();

    const stillUsable = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(stillUsable.statusCode).toBe(200);
  });

  it('keeps revoked-but-unexpired tokens, because reuse detection depends on them', async () => {
    const session = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody(),
    });
    const { refreshToken } = bodyOf<SessionBody>(session);

    // Rotate, which revokes the original but leaves it unexpired.
    await app().inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken } });
    await buildReaper().reapOnce();

    // Replaying the rotated token must still be recognised as reuse, not as an
    // unknown token — that is the whole point of retaining the row.
    const replay = await app().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(replay.json()).toMatchObject({ error: { code: 'REFRESH_TOKEN_REUSE' } });
  });

  it('reports zero when there is nothing to reap', async () => {
    await buildReaper().reapOnce();

    expect(await buildReaper().reapOnce()).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                               */
/* -------------------------------------------------------------------------- */

describe('rate limiting', () => {
  /**
   * Each case builds its own app so the counters start clean, and because the limiter
   * keys on route + IP — sharing an instance would let one test exhaust another's
   * budget and produce order-dependent failures.
   */
  const withThrottledApp = async (run: (harness: TestApp) => Promise<void>): Promise<void> => {
    const throttled = await buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: { AUTH_RATE_LIMIT_MAX: '2', AUTH_RATE_LIMIT_WINDOW_SECONDS: '60' },
    });

    try {
      await run(throttled);
    } finally {
      await throttled.close();
    }
  };

  it('throttles repeated signup attempts', async () => {
    await withThrottledApp(async (throttled) => {
      const attempt = async (): Promise<number> =>
        (
          await throttled.app.inject({
            method: 'POST',
            url: '/auth/signup',
            payload: signUpBody(),
          })
        ).statusCode;

      expect(await attempt()).toBe(201);
      expect(await attempt()).toBe(201);
      expect(await attempt()).toBe(429);
    });
  });

  it('throttles repeated refresh attempts', async () => {
    await withThrottledApp(async (throttled) => {
      const attempt = async (): Promise<number> =>
        (
          await throttled.app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: { refreshToken: 'not-a-real-token' },
          })
        ).statusCode;

      expect(await attempt()).toBe(401);
      expect(await attempt()).toBe(401);
      expect(await attempt()).toBe(429);
    });
  });

  it('throttles repeated provider sign-in attempts', async () => {
    await withThrottledApp(async (throttled) => {
      const attempt = async (): Promise<number> =>
        (
          await throttled.app.inject({
            method: 'POST',
            url: '/auth/provider',
            payload: { provider: 'google', idToken: 'not-a-real-token' },
          })
        ).statusCode;

      await attempt();
      await attempt();
      expect(await attempt()).toBe(429);
    });
  });

  it('throttles repeated login attempts', async () => {
    const throttled = await buildTestApp({
      databaseUrl: container.getConnectionUri(),
      env: { AUTH_RATE_LIMIT_MAX: '2', AUTH_RATE_LIMIT_WINDOW_SECONDS: '60' },
    });

    try {
      const attempt = async (): Promise<number> =>
        (
          await throttled.app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email: 'nobody@example.test', password: 'wrong-but-long-enough' },
          })
        ).statusCode;

      expect(await attempt()).toBe(401);
      expect(await attempt()).toBe(401);
      expect(await attempt()).toBe(429);
    } finally {
      await throttled.close();
    }
  });

  it('leaves authenticated reads unthrottled', async () => {
    // The limit is per-route on purpose: throttling profile reads would be a
    // different problem with a different sensible answer.
    const created = await app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signUpBody(),
    });
    const { accessToken } = bodyOf<SessionBody>(created);

    for (let index = 0; index < 20; index += 1) {
      const response = await app().inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(200);
    }
  });
});
