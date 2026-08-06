import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { ConfigurationError, loadConfig } from '../config/env.js';
import { createDatabaseClient, type DatabaseClient } from './client.js';
import { toError } from '../errors.js';
import { createLogger } from '../logging/logger.js';

/**
 * Migration runner, usable both as a CLI (`npm run db:migrate`) and from tests, which
 * need to bring a throwaway database up to the current schema before asserting
 * against it.
 */

const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

export async function runMigrations(client: DatabaseClient): Promise<void> {
  await migrate(client.db, { migrationsFolder: MIGRATIONS_FOLDER });
}

/** True when this module was executed directly rather than imported. */
function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === `file://${path.resolve(entrypoint)}`;
}

if (isMainModule()) {
  const config = loadConfig();
  const logger = createLogger(config);
  const client = createDatabaseClient(config, logger);

  try {
    await runMigrations(client);
    logger.info('Migrations applied');
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message);
    } else {
      logger.error({ err: toError(error) }, 'Migration failed');
    }
    await client.close();
    process.exit(1);
  }

  await client.close();
}
