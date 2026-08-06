import { describe, expect, it, vi } from 'vitest';

import { DatabaseUnavailableError } from '../errors.js';
import type { AppLogger } from '../logging/logger.js';
import type { HealthRepository } from './health.repository.js';
import { HealthService } from './health.service.js';

/**
 * Unit-level coverage of the decision logic. The wiring to a real Postgres instance is
 * covered separately in `test/health.integration.test.ts`, which is where the handoff
 * requires a real database rather than a substitute.
 */

const stubLogger = (): AppLogger =>
  ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    // Only the methods the service actually calls are stubbed. Casting through
    // `unknown` avoids reproducing pino's full surface for a four-method fake.
  }) as unknown as AppLogger;

const reachableRepository = (): HealthRepository => ({
  checkConnectivity: vi.fn().mockResolvedValue(undefined),
});

const unreachableRepository = (): HealthRepository => ({
  checkConnectivity: vi.fn().mockRejectedValue(new DatabaseUnavailableError()),
});

describe('HealthService', () => {
  it('reports ok when the database answers', async () => {
    const service = new HealthService(reachableRepository(), stubLogger());

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
  });

  it('reports unhealthy when the database is unreachable', async () => {
    const service = new HealthService(unreachableRepository(), stubLogger());

    await expect(service.check()).resolves.toEqual({
      status: 'unhealthy',
      checks: { database: 'down' },
    });
  });

  it('does not propagate the database error to the caller', async () => {
    const service = new HealthService(unreachableRepository(), stubLogger());

    await expect(service.check()).resolves.toBeDefined();
  });

  it('logs the underlying error rather than swallowing it', async () => {
    const logger = stubLogger();
    const service = new HealthService(unreachableRepository(), logger);

    await service.check();

    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('reports unhealthy even when the repository rejects with a non-Error value', async () => {
    // Deliberately hostile input: a dependency that rejects with a bare string rather
    // than an Error must still produce a report instead of crashing the log call.
    const repository: HealthRepository = {
      checkConnectivity: vi.fn().mockRejectedValue('connection refused'),
    };
    const service = new HealthService(repository, stubLogger());

    await expect(service.check()).resolves.toEqual({
      status: 'unhealthy',
      checks: { database: 'down' },
    });
  });
});
