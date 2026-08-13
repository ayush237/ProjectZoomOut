import { PostgresAchievementRepository } from '../../src/achievements/achievements.repository.js';
import { SessionSummaryService } from '../../src/progress/sessionSummary.service.js';
import { AchievementService } from '../../src/achievements/achievements.service.js';
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
import { PayloadContentRepository } from '../../src/content/content.repository.js';
import { ContentService } from '../../src/content/content.service.js';
import { PayloadClient } from '../../src/content/payloadClient.js';
import { createDatabaseClient, type DatabaseClient } from '../../src/db/client.js';
import { PostgresLibraryRepository } from '../../src/library/library.repository.js';
import { LibraryService } from '../../src/library/library.service.js';
import { PostgresHealthRepository } from '../../src/health/health.repository.js';
import { HealthService } from '../../src/health/health.service.js';
import { createLogger } from '../../src/logging/logger.js';
import { PostgresProgressRepository } from '../../src/progress/progress.repository.js';
import { PostgresSessionRepository } from '../../src/progress/session.repository.js';
import { ProgressService } from '../../src/progress/progress.service.js';
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

  // Wired exactly as `src/index.ts` does it, including the direction of the
  // content/progress dependency — see the comment there.
  const contentRepository = new PayloadContentRepository(
    new PayloadClient(config, logger),
    logger,
    config,
  );
  const libraryRepository = new PostgresLibraryRepository(database);
  const progressRepository = new PostgresProgressRepository(database);
  const sessionRepository = new PostgresSessionRepository(database);
  const achievementRepository = new PostgresAchievementRepository(database);
  const achievementService = new AchievementService(
    achievementRepository,
    progressRepository,
    logger,
  );
  const progressService = new ProgressService(
    progressRepository,
    contentRepository,
    config,
    logger,
    libraryRepository,
    sessionRepository,
    achievementService,
  );
  const contentService = new ContentService(contentRepository, config, logger, progressService);

  const authRepository = new PostgresAuthRepository(database);
  const tokenService = new TokenService(config);

  const sessionSummaryService = new SessionSummaryService(
    progressRepository,
    sessionRepository,
    achievementRepository,
    contentService,
    config,
    logger,
  );

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
    contentService,
    libraryService: new LibraryService(
      libraryRepository,
      contentService,
      progressService,
      logger,
      achievementService,
    ),
    progressService,
    sessionSummaryService,
    achievementService,
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
