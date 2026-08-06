import { defineConfig } from 'vitest/config';

/**
 * Covers the app's pure logic only — view models, formatters, mappers.
 *
 * Component rendering is deliberately not tested here: doing so under Vitest needs a
 * React Native preset that fights Expo's own Jest setup, and WP0's mandate is to prove
 * the workspace wiring, not to pick the app's component-testing stack. That choice
 * belongs with the first real screens in WP6.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
