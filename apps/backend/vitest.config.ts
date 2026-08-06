import { defineConfig } from 'vitest/config';

/**
 * Pulling a Postgres image and starting a container is slow the first time and not
 * instant afterwards, so the hook timeout is generous. Individual tests stay on a
 * short leash — a health check that takes 30 seconds is a failure, not a slow pass.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    hookTimeout: 180_000,
    testTimeout: 30_000,
    // Containers bind host ports; running integration files in parallel invites
    // flakes that look like product bugs.
    fileParallelism: false,
  },
});
