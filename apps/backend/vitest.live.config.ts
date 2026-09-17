import { defineConfig } from 'vitest/config';

/**
 * Runs only `*.live.test.ts` files — tests that hit real Payload and the real
 * backend over HTTP (VO-1.1), never included in the normal `vitest.config.ts` gate.
 *
 * A separate config file rather than a CLI-only override: an `exclude` in the main
 * config still applies to files selected on the command line, so
 * `vitest run some.live.test.ts` against the default config would exclude the very
 * file it was asked to run. Run this one with:
 *
 *     npm run test:live --workspace=apps/backend
 */
export default defineConfig({
  test: {
    include: ['src/**/*.live.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
