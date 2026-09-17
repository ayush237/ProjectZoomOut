import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Pulling a Postgres image and starting a container is slow the first time and not
 * instant afterwards, so the hook timeout is generous. Individual tests stay on a
 * short leash — a health check that takes 30 seconds is a failure, not a slow pass.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // `*.live.test.ts` files hit real Payload and the real backend over HTTP (VO-1.1)
    // — excluded from the normal gate the same way the pipeline's `pytest -m live`
    // is. See `vitest.live.config.ts`, which targets only that pattern. Spread onto
    // vitest's own defaults rather than replacing them — `exclude` overrides rather
    // than merges, and losing node_modules/dist from it silently would be worse.
    exclude: [...configDefaults.exclude, '**/*.live.test.ts'],
    environment: 'node',
    hookTimeout: 180_000,
    testTimeout: 30_000,
    // Containers bind host ports; running integration files in parallel invites
    // flakes that look like product bugs.
    fileParallelism: false,
  },
});
