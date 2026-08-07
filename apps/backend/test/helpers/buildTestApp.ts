import { buildApp, type ZoomOutApp } from '../../src/app.js';
import { createAuthenticator } from '../../src/auth/authenticate.js';
import { PostgresAuthRepository } from '../../src/auth/auth.repository.js';
import { AuthService } from '../../src/auth/auth.service.js';
import {
  ProviderTokenVerifier,
  type ProviderSettings,
} from '../../src/auth/providers/providerVerifier.js';
import { TokenService } from '../../src/auth/tokens.js';
import { loadConfig } from '../../src/config/env.js';
import { createDatabaseClient, type DatabaseClient } from '../../src/db/client.js';
import { PostgresHealthRepository } from '../../src/health/health.repository.js';
import { HealthService } from '../../src/health/health.service.js';
import { createLogger } from '../../src/logging/logger.js';
import { ProfileService } from '../../src/users/profile.service.js';

/**
 * Builds the real application against a caller-supplied database.
 *
 * Same wiring as `src/index.ts`, minus the listening socket. Integration tests get the
 * actual middleware stack, error handler, rate limiter and access control rather than
 * a hand-assembled subset that could drift from what ships.
 */

export interface TestAppOptions {
  readonly databaseUrl: string;
  /** Overrides the real Apple/Google settings so tests can serve a local JWKS. */
  readonly providerSettings?: ProviderSettings | undefined;
  readonly env?: Record<string, string> | undefined;
}

export interface TestApp {
  readonly app: ZoomOutApp;
  readonly database: DatabaseClient;
  close(): Promise<void>;
}

const UNREACHABLE_JWKS = 'http://127.0.0.1:1/jwks';

export async function buildTestApp(options: TestAppOptions): Promise<TestApp> {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: options.databaseUrl,
    DATABASE_CONNECTION_TIMEOUT_SECONDS: '5',
    AUTH_JWT_SECRET: 'integration-test-signing-secret-at-least-32-chars',
    ...options.env,
  });

  const logger = createLogger(config);
  const database = createDatabaseClient(config, logger);

  const providerSettings: ProviderSettings = options.providerSettings ?? {
    issuers: ['https://unconfigured.test'],
    audience: 'unconfigured',
    jwksUri: UNREACHABLE_JWKS,
  };

  const authRepository = new PostgresAuthRepository(database);
  const tokenService = new TokenService(config);

  const app = await buildApp({
    config,
    logger,
    healthService: new HealthService(new PostgresHealthRepository(database), logger),
    authService: new AuthService(
      authRepository,
      tokenService,
      new ProviderTokenVerifier({ apple: providerSettings, google: providerSettings }),
      config,
      logger,
    ),
    profileService: new ProfileService(database, authRepository),
    authenticate: createAuthenticator(tokenService),
  });

  return {
    app,
    database,
    close: async (): Promise<void> => {
      await app.close();
      await database.close();
    },
  };
}
