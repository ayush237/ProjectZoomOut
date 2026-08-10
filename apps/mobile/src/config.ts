/**
 * Runtime configuration, from the environment.
 *
 * Expo inlines `EXPO_PUBLIC_*` variables at bundle time, which is the only mechanism
 * available to a client app — and it means **nothing secret may go here**. Everything
 * below ships inside the binary and can be read out of it. That is fine for what it
 * holds: a base URL and OAuth *client* identifiers, both of which are public by design.
 *
 * There is deliberately no API key or secret in this file, and there must never be one.
 */

/** Falls back to the loopback address the backend serves on in development. */
const DEFAULT_API_URL = 'http://127.0.0.1:3000';

export interface AppConfig {
  readonly apiBaseUrl: string;
  /**
   * Google OAuth client id for iOS. Absent until the app is registered, which is why
   * the sign-in button is hidden rather than broken when it is missing.
   */
  readonly googleIosClientId: string | undefined;
  readonly googleWebClientId: string | undefined;
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
    googleWebClientId: source['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'],
  };
}

/* eslint-enable no-restricted-properties */

export const appConfig = loadAppConfig();
