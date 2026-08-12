import { PostgresAchievementRepository } from './achievements/achievements.repository.js';
import { AchievementService } from './achievements/achievements.service.js';
import { buildApp } from './app.js';
import { createAuthenticator } from './auth/authenticate.js';
import { PostgresAuthRepository } from './auth/auth.repository.js';
import { AuthService } from './auth/auth.service.js';
import {
  APPLE_DEFAULTS,
  GOOGLE_DEFAULTS,
  ProviderTokenVerifier,
} from './auth/providers/providerVerifier.js';
import { RefreshTokenReaper } from './auth/refreshTokenReaper.js';
import { TokenService } from './auth/tokens.js';
import { ConfigurationError, loadConfig } from './config/env.js';
import { PayloadContentRepository } from './content/content.repository.js';
import { ContentService } from './content/content.service.js';
import { PayloadClient } from './content/payloadClient.js';
import { PostgresLibraryRepository } from './library/library.repository.js';
import { LibraryService } from './library/library.service.js';
import { createDatabaseClient } from './db/client.js';
import { toError } from './errors.js';
import { PostgresHealthRepository } from './health/health.repository.js';
import { HealthService } from './health/health.service.js';
import { createLogger } from './logging/logger.js';
import { PostgresProgressRepository } from './progress/progress.repository.js';
import { PostgresSessionRepository } from './progress/session.repository.js';
import { ProgressService } from './progress/progress.service.js';
import { ProfileService } from './users/profile.service.js';

/**
 * Composition root.
 *
 * The only place that knows how the layers are wired together. Every other module
 * receives its collaborators through its constructor, which is what keeps them
 * testable in isolation.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const database = createDatabaseClient(config, logger);

  const healthService = new HealthService(new PostgresHealthRepository(database), logger);

  const authRepository = new PostgresAuthRepository(database);
  const tokenService = new TokenService(config);

  // An unconfigured provider gets an audience no token can match, so a sign-in
  // attempt fails the audience check rather than skipping it. Failing closed matters
  // more here than a tidier error, because the alternative is accepting tokens minted
  // for somebody else's app.
  const providerVerifier = new ProviderTokenVerifier({
    apple: { ...APPLE_DEFAULTS, audience: config.AUTH_APPLE_CLIENT_ID ?? ' unconfigured' },
    google: { ...GOOGLE_DEFAULTS, audience: config.AUTH_GOOGLE_CLIENT_ID ?? ' unconfigured' },
  });

  if (config.AUTH_APPLE_CLIENT_ID === undefined || config.AUTH_GOOGLE_CLIENT_ID === undefined) {
    logger.warn(
      {
        apple: config.AUTH_APPLE_CLIENT_ID !== undefined,
        google: config.AUTH_GOOGLE_CLIENT_ID !== undefined,
      },
      'Social sign-in is not fully configured; those providers will reject all tokens',
    );
  }

  const authService = new AuthService(
    authRepository,
    tokenService,
    providerVerifier,
    config,
    logger,
  );
  const profileService = new ProfileService(database, authRepository);

  /**
   * Content and progress are wired in this order because the dependency runs one way
   * and back again, through an interface rather than a cycle: progress reads the full
   * Leaf from the *repository* to grade an answer, and content delivery asks the
   * progress service — as a `PayoffAccessPolicy` — whether the payoff is unlocked.
   * Neither service imports the other's concrete class.
   */
  const contentRepository = new PayloadContentRepository(
    new PayloadClient(config, logger),
    logger,
    config,
  );
  const libraryRepository = new PostgresLibraryRepository(database);
  const progressRepository = new PostgresProgressRepository(database);

  /**
   * Achievements are constructed before the services that trigger them, because both
   * the learning loop and the library depend on the awarder rather than the other way
   * round. It reads the reader's timezone through `progressRepository`, which already
   * exposes exactly that one method — a narrow port, not the whole repository.
   */
  const achievementService = new AchievementService(
    new PostgresAchievementRepository(database),
    progressRepository,
    logger,
  );

  const progressService = new ProgressService(
    progressRepository,
    contentRepository,
    config,
    logger,
    libraryRepository,
    new PostgresSessionRepository(database),
    achievementService,
  );
  const contentService = new ContentService(contentRepository, config, logger, progressService);
  const libraryService = new LibraryService(
    libraryRepository,
    contentService,
    progressService,
    logger,
    achievementService,
  );

  const reaper = new RefreshTokenReaper(
    authRepository,
    logger,
    config.AUTH_TOKEN_REAP_INTERVAL_MINUTES * 60 * 1000,
  );
  reaper.start();

  const app = await buildApp({
    config,
    logger,
    healthService,
    authService,
    profileService,
    contentService,
    libraryService,
    progressService,
    achievementService,
    authenticate: createAuthenticator(tokenService),
  });

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    // Two Ctrl-Cs should not start two shutdowns and race each other to close the pool.
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info({ signal }, 'Shutting down');

    void (async (): Promise<void> => {
      try {
        reaper.stop();
        await app.close();
        await database.close();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ err: toError(error) }, 'Shutdown failed');
        process.exit(1);
      }
    })();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info({ port: config.PORT, host: config.HOST }, 'Backend listening');
}

main().catch((error: unknown) => {
  // The logger needs a valid config, so a configuration failure has to report itself
  // through stderr directly. Its message names the offending variables, never values.
  if (error instanceof ConfigurationError) {
    console.error(error.message);
    process.exit(1);
  }

  console.error('Fatal error during startup:', toError(error));
  process.exit(1);
});
