import { defineConfig } from 'vitest/config';

/**
 * `.mts` because Next requires this package to stay resolvable as ESM while Payload's
 * own tooling reads CommonJS-shaped configs — the explicit extension removes the
 * ambiguity rather than relying on the package `type` field winning.
 *
 * Hook timeout is generous: the integration suite starts a Postgres container and lets
 * Payload run its own migrations against it before the first assertion.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    hookTimeout: 300_000,
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
