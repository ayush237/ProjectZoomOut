import { buildApp } from './app.js';
import { ConfigurationError, loadConfig } from './config/env.js';
import { createDatabaseClient } from './db/client.js';
import { toError } from './errors.js';
import { PostgresHealthRepository } from './health/health.repository.js';
import { HealthService } from './health/health.service.js';
import { createLogger } from './logging/logger.js';

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
  const app = buildApp({ config, logger, healthService });

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
