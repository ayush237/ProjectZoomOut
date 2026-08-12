/**
 * Jest, not Vitest — resolving WP0's open decision on the component-testing stack.
 *
 * Every other workspace in this repo runs Vitest, and splitting the tooling is a real
 * cost, so the reasoning is worth recording.
 *
 * Rendering a React Native component under Vitest means transforming React Native's
 * Flow-typed source, stubbing every native module the tree touches, and maintaining a
 * custom environment — and then keeping all of that working across Expo SDK upgrades.
 * `jest-expo` is versioned against the SDK and ships exactly that: the transform, the
 * native mocks, and the platform-specific module resolution. WP6's constraint was to
 * pick a stack that stays *out of the way of Expo's own config*, and the preset that
 * Expo maintains is the only option that meets it.
 *
 * The mitigation for two runners in one repo is that there is only ever **one runner
 * per workspace**: Jest is now the sole runner in `apps/mobile`, covering pure logic
 * and components alike, and Vitest is untouched everywhere else. `npm test` at the
 * root calls each workspace's own `test` script, so nothing above this file cares.
 */
module.exports = {
  preset: 'jest-expo',
  /**
   * Reanimated 4 reaches its worklet runtime through `react-native-worklets`, whose
   * `.native.ts` entry points call into a TurboModule that does not exist under Node —
   * importing the package throws at `loadUnpackers` before any test runs, and its own
   * `mock.js` throws too, because that mock re-imports the real index.
   *
   * This resolver, shipped by the package for exactly this, drops the `.native`
   * extensions when resolving anything under `react-native-worklets`, so Jest picks up
   * the plain JS implementation instead. It has to be a resolver rather than a
   * `jest.mock`: the failure happens during module resolution, which is earlier than
   * any mock can intercept.
   */
  resolver: 'react-native-worklets/jest/resolver.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
};
