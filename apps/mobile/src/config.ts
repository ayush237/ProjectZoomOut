/**
 * Runtime configuration, from the environment.
 *
 * Expo inlines `EXPO_PUBLIC_*` variables at bundle time, which is the only mechanism
 * available to a client app — and it means **nothing secret may go here**. Everything
 * below ships inside the binary and can be read out of it. That is fine for what it
 * holds: a base URL, an OAuth *client* identifier and a feature flag, all public by
 * design.
 *
 * There is deliberately no API key or secret in this file, and there must never be one.
 *
 * **Every variable read here is documented in `.env.example`.** An undocumented one is
 * worse than a missing feature: see the default below.
 */

/**
 * Loopback, which is correct on a simulator and **wrong on a physical device**.
 *
 * A simulator shares the Mac's network stack, so `127.0.0.1` reaches the backend. A
 * real phone resolves it to itself, so every request fails as a `NetworkError` with
 * nothing to suggest the URL is the problem. That is why `EXPO_PUBLIC_API_URL` is
 * documented in `.env.example` rather than left to be discovered: a second developer
 * plugging in a phone should be told to set it, not left debugging the API client.
 */
const DEFAULT_API_URL = 'http://127.0.0.1:3000';

export interface AppConfig {
  readonly apiBaseUrl: string;
  /**
   * Google OAuth client id for iOS. Absent until the app is registered, which is why
   * the sign-in button is hidden rather than broken when it is missing.
   */
  readonly googleIosClientId: string | undefined;
  /**
   * Whether to offer Sign in with Apple.
   *
   * **Defaults to false, and social sign-in is deferred to post-Phase-1** (roadmap,
   * 2026-08-11). A flag rather than a client id because Apple needs no id — it needs
   * the `com.apple.developer.applesignin` entitlement, which this app deliberately does
   * not have. `AppleAuthentication.isAvailableAsync()` reports the *device's*
   * capability and returns true on any modern iOS device regardless of our
   * entitlement, so it cannot be used to decide whether we support the feature. Without
   * this flag the button renders and dies at the system sheet.
   */
  readonly appleSignInEnabled: boolean;
}

/* eslint-disable no-restricted-properties --
 * The one sanctioned `process.env` read in the mobile app, mirroring the backend's
 * `config/env.ts`. Expo inlines `EXPO_PUBLIC_*` at bundle time, so this is the only
 * mechanism available; every other module takes the parsed `AppConfig` instead. */
export function loadAppConfig(
  source: Record<string, string | undefined> = process.env,
): AppConfig {
  return {
    apiBaseUrl: source['EXPO_PUBLIC_API_URL'] ?? DEFAULT_API_URL,
    googleIosClientId: source['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'],
    // Opt-in, and only to the exact string. Anything else — unset, "false", a typo —
    // leaves the feature off, which is the safe direction for a button that cannot
    // work without an entitlement we have not applied for.
    appleSignInEnabled: source['EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED'] === 'true',
  };
}

/* eslint-enable no-restricted-properties */

export const appConfig = loadAppConfig();
