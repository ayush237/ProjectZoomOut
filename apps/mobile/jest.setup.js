/* global jest */

/**
 * Test environment setup.
 *
 * Native modules that have no JS implementation are mocked here rather than in each
 * test, so a component test never has to know which of its children reaches for the
 * keychain. Anything whose *behaviour* is under test is faked in the test itself
 * instead — these are the modules where the real thing simply cannot run under Node.
 */

// No matcher import: React Native Testing Library has registered its Jest matchers
// automatically since v12.4, and the old `extend-expect` entry point no longer exists
// in v14. Requiring it fails the whole suite at setup rather than at a call site.

/**
 * React 19 refuses to batch updates for `act()` unless this flag is set, and
 * `jest-expo`'s preset does not set it. Without it every state update outside an
 * explicit `act()` warns, and `renderHook` returns before the tree has committed — so
 * hook tests fail with "cannot read properties of undefined" rather than with anything
 * that points at the cause.
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * `expo-secure-store` is the keychain. There is no keychain in Node, so this is an
 * in-memory stand-in with the same contract. Tests that care about storage assert
 * against it; the API client's own tests inject their own store instead.
 */
jest.mock('expo-secure-store', () => {
  const store = new Map();

  return {
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
    __reset: () => {
      store.clear();
    },
  };
});

/** Fonts load instantly and successfully; a real load needs a native bundler. */
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(async () => undefined),
  isLoaded: () => true,
}));

/**
 * Apple's native sign-in sheet cannot appear in Node. Availability defaults to false,
 * so a test that wants the Apple path has to opt in explicitly and say so.
 */
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_IN: 0, SIGN_UP: 1 },
  AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
}));
