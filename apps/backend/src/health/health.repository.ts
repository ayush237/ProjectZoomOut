import type { DatabaseClient } from '../db/client.js';
import { DatabaseUnavailableError } from '../errors.js';

/**
 * Data-access contract for the health check.
 *
 * The service depends on this interface, not on Postgres, so "what does the app do
 * when the database is down" is testable without a broken database.
 */
export interface HealthRepository {
  /**
   * Resolves if the database answered.
   *
   * @throws {DatabaseUnavailableError} if it did not.
   */
  checkConnectivity(): Promise<void>;
}

export class PostgresHealthRepository implements HealthRepository {
  constructor(private readonly client: DatabaseClient) {}

  public async checkConnectivity(): Promise<void> {
    try {
      // Deliberately the cheapest possible round trip. This checks that a connection
      // can be acquired and the server responds — not that any particular table
      // exists, which is the migration's job to guarantee, not the health check's.
      await this.client.pool.query('select 1');
    } catch (error) {
      throw new DatabaseUnavailableError({ cause: error });
    }
  }
}
