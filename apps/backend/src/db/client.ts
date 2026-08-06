import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import type { AppConfig } from '../config/env.js';
import { toError } from '../errors.js';
import type { AppLogger } from '../logging/logger.js';
import * as schema from './schema.js';

/**
 * Owns the connection pool and the Drizzle instance bound to it.
 *
 * Exposed as an interface so the repository layer depends on the abstraction rather
 * than on `pg` directly — the seam that lets tests substitute a failing client
 * without standing up a broken database.
 */
export interface DatabaseClient {
  readonly db: NodePgDatabase<typeof schema>;
  readonly pool: pg.Pool;
  close(): Promise<void>;
}

export function createDatabaseClient(config: AppConfig, logger: AppLogger): DatabaseClient {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    connectionTimeoutMillis: config.DATABASE_CONNECTION_TIMEOUT_SECONDS * 1000,
  });

  // An idle client erroring is asynchronous and unattached to any request. Without
  // this listener `pg` escalates it to an uncaught exception and takes the process
  // down; with it, the pool discards the client and we get a log line.
  pool.on('error', (error: unknown) => {
    logger.error({ err: toError(error) }, 'Idle Postgres client errored');
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
    close: async (): Promise<void> => {
      await pool.end();
    },
  };
}
