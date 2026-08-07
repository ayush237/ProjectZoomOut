import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ZoomOutApp } from '../src/app.js';
import type { DatabaseClient } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { buildTestApp, type TestApp } from './helpers/buildTestApp.js';

/**
 * Integration coverage for `GET /health` against a real Postgres instance.
 *
 * A mock here would assert nothing that matters: the point of this endpoint is that
 * it fails when the actual database is unreachable, which is precisely the part a
 * stub cannot tell us. The container is disposable and the migration runs against it
 * from empty, so this also covers the "migration applies cleanly" criterion.
 *
 * Requires a running Docker daemon.
 */

const POSTGRES_IMAGE = 'postgres:16-alpine';

/** A port with nothing listening, used to simulate an unreachable database. */
const CLOSED_PORT = 59999;

let container: StartedPostgreSqlContainer;
let harness: TestApp;
let database: DatabaseClient;
let app: ZoomOutApp;

const buildAppForDatabaseUrl = async (databaseUrl: string): Promise<TestApp> =>
  buildTestApp({ databaseUrl, env: { DATABASE_CONNECTION_TIMEOUT_SECONDS: '2' } });

beforeAll(async () => {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();

  harness = await buildAppForDatabaseUrl(container.getConnectionUri());
  app = harness.app;
  database = harness.database;

  await runMigrations(database);
  await app.ready();
});

afterAll(async () => {
  await harness?.close();
  await container?.stop();
});

describe('the initial migration', () => {
  it('creates the users table on a previously empty database', async () => {
    const result = await database.pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = 'users'`,
    );

    expect(result.rowCount).toBe(1);
  });

  it('creates every column the user model requires', async () => {
    const result = await database.pool.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'users'`,
    );

    const columns = result.rows.map((row) => row.column_name).sort();

    expect(columns).toEqual([
      'created_at',
      'date_of_birth',
      'display_name',
      'email',
      // Reserved by WP2 for a verification flow that does not exist yet.
      'email_verified_at',
      'id',
      'timezone',
      'updated_at',
    ]);
  });

  it('stores date_of_birth as a date, not a timestamp', async () => {
    const result = await database.pool.query<{ data_type: string }>(
      `select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'users' and column_name = 'date_of_birth'`,
    );

    expect(result.rows[0]?.data_type).toBe('date');
  });

  it('is idempotent — re-running it against an already-migrated database is a no-op', async () => {
    await expect(runMigrations(database)).resolves.not.toThrow();
  });

  it('enforces the unique constraint on email', async () => {
    const insert = `insert into users (email, display_name, date_of_birth, timezone)
                    values ($1, $2, $3, $4)`;
    const values = ['duplicate@example.test', 'First', '1990-01-01', 'UTC'];

    await database.pool.query(insert, values);

    await expect(database.pool.query(insert, values)).rejects.toThrow();
  });
});

describe('GET /health', () => {
  it('returns 200 when the database is reachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
  });

  it('reports the database as up', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.json()).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('returns 503 when the database is unreachable', async () => {
    const unreachable = await buildAppForDatabaseUrl(
      `postgres://postgres:postgres@127.0.0.1:${String(CLOSED_PORT)}/zoomout`,
    );

    try {
      const response = await unreachable.app.inject({ method: 'GET', url: '/health' });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ status: 'unhealthy', checks: { database: 'down' } });
    } finally {
      await unreachable.close();
    }
  });

  it('returns 503 once a previously healthy database goes away', async () => {
    const stopped = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const built = await buildAppForDatabaseUrl(stopped.getConnectionUri());

    try {
      const healthy = await built.app.inject({ method: 'GET', url: '/health' });
      expect(healthy.statusCode).toBe(200);

      await stopped.stop();

      const unhealthy = await built.app.inject({ method: 'GET', url: '/health' });
      expect(unhealthy.statusCode).toBe(503);
    } finally {
      await built.close();
    }
  });
});
