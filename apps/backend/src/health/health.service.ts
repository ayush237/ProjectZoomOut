import { toError } from '../errors.js';
import type { AppLogger } from '../logging/logger.js';
import type { HealthRepository } from './health.repository.js';

export type DependencyState = 'up' | 'down';

export interface HealthReport {
  readonly status: 'ok' | 'unhealthy';
  readonly checks: {
    readonly database: DependencyState;
  };
}

/**
 * Decides whether the service is healthy.
 *
 * The health endpoint's contract is to *report* a failure, not to propagate one — an
 * unreachable database is an expected state for this one route, so it is caught and
 * turned into a report. It is not swallowed: the underlying error is logged with its
 * stack before the degraded report is returned.
 */
export class HealthService {
  constructor(
    private readonly repository: HealthRepository,
    private readonly logger: AppLogger,
  ) {}

  public async check(): Promise<HealthReport> {
    try {
      await this.repository.checkConnectivity();
      return { status: 'ok', checks: { database: 'up' } };
    } catch (error) {
      this.logger.error(
        { err: toError(error) },
        'Health check failed: database is not reachable',
      );
      return { status: 'unhealthy', checks: { database: 'down' } };
    }
  }
}
