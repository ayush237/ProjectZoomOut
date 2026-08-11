import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { appConfig } from '../config';

/**
 * Apple and Google sign-in, behind one port.
 *
 * The app talks to `SocialAuthProvider`, never to a vendor SDK directly. That is what
 * keeps the auth flow — which is the part with the acceptance criteria on it — testable
 * without a native sheet, and what makes "this provider is not configured yet" an
 * ordinary state rather than a crash.
 *
 * **Both providers are off by default: social sign-in is deferred to post-Phase-1**
 * (roadmap, 2026-08-11). The code stays because the flow around it — the age gate on
 * the social path, `SIGNUP_DETAILS_REQUIRED` routing, the held provider token — is
 * built and tested, and deleting it would mean rebuilding it later against a backend
 * contract that already exists.
 *
 * When they are switched on, **Apple must ship alongside Google on iOS**: App Store
 * Review Guideline 4.8 requires an equivalent private sign-in option wherever a
 * third-party social login appears. Enabling Google without Apple is a submission
 * blocker, which is the one thing to remember about this file.
 */

export interface SocialCredential {
  /** The provider's ID token, forwarded to the backend for verification. */
  readonly idToken: string;
  /** Supplied by Apple on first authorisation only, and never afterwards. */
  readonly displayName?: string | undefined;
}

export interface SocialAuthProvider {
  readonly id: 'apple' | 'google';
  /** False when the platform or the app's configuration cannot support this provider. */
  isAvailable(): Promise<boolean>;
  /** @throws {SocialAuthCancelled} when the reader dismisses the sheet. */
  requestCredential(): Promise<SocialCredential>;
}

/**
 * The reader backed out.
 *
 * Distinct from a failure because it needs no error message: dismissing a sign-in sheet
 * is a decision, and showing "sign-in failed" for it is the app arguing with them.
 */
export class SocialAuthCancelled extends Error {
  constructor() {
    super('Sign-in cancelled');
    this.name = 'SocialAuthCancelled';
  }
}

/**
 * The provider cannot be used.
 *
 * The message is **reader-facing** and says only that, because it is rendered verbatim
 * by the sign-in screen. Configuration detail — which client id is missing, which
 * entitlement — goes in `reason`, which is for logs and for whoever is debugging the
 * build, and is never displayed.
 */
export class SocialAuthUnavailable extends Error {
  /** Internal detail. Not shown to the reader. */
  public readonly reason: string;

  constructor(providerName: string, reason = 'not configured') {
    super(`${providerName} sign-in is not available right now.`);
    this.name = 'SocialAuthUnavailable';
    this.reason = reason;
  }
}

/* -------------------------------------------------------------------------- */
/* Apple                                                                       */
/* -------------------------------------------------------------------------- */

export class AppleAuthProvider implements SocialAuthProvider {
  public readonly id = 'apple' as const;

  constructor(private readonly enabled: boolean = appConfig.appleSignInEnabled) {}

  /**
   * Configuration first, then the device.
   *
   * The order matters. `AppleAuthentication.isAvailableAsync()` answers "can this
   * *device* do Sign in with Apple", and on any modern iPhone that is true whatever our
   * app is entitled to — so on its own it is not a usable gate. Without the
   * `com.apple.developer.applesignin` entitlement, which this app deliberately does not
   * carry, the button renders and then fails at the system sheet, which is the worst of
   * the available outcomes.
   */
  public async isAvailable(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    // iOS-only by definition, and false on a simulator without an iCloud account.
    return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
  }

  public async requestCredential(): Promise<SocialCredential> {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken === null) {
        throw new SocialAuthUnavailable('Apple', 'Apple returned no identity token');
      }

      return {
        idToken: credential.identityToken,
        // Apple returns the name **only on the very first authorisation** for an app.
        // Every later sign-in omits it, which is why the backend falls back to deriving
        // a display name rather than requiring one.
        ...(composeName(credential.fullName) === undefined
          ? {}
          : { displayName: composeName(credential.fullName) }),
      };
    } catch (error) {
      if (isCancellation(error)) {
        throw new SocialAuthCancelled();
      }
      throw error;
    }
  }
}

function composeName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string | undefined {
  const parts = [fullName?.givenName, fullName?.familyName].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );

  return parts.length === 0 ? undefined : parts.join(' ');
}

/** Apple reports a dismissed sheet as a coded error rather than a distinct type. */
function isCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_REQUEST_CANCELED'
  );
}

/* -------------------------------------------------------------------------- */
/* Google                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Google sign-in.
 *
 * `isAvailable()` is false until a client id is configured, and the UI hides the button
 * when it is — a visible button that cannot work is worse than an absent one. **No
 * client id exists yet**: neither the iOS nor the web OAuth client has been registered,
 * so this path is unexercised end to end. The flow around it is fully tested against a
 * fake provider; what is untested is Google's own half.
 *
 * Implemented against `expo-auth-session` rather than the native Google SDK because the
 * native module needs a custom development build, and Phase 1 still runs in Expo Go.
 */
export class GoogleAuthProvider implements SocialAuthProvider {
  public readonly id = 'google' as const;

  constructor(private readonly clientId: string | undefined = appConfig.googleIosClientId) {}

  public isAvailable(): Promise<boolean> {
    return Promise.resolve(this.clientId !== undefined);
  }

  public requestCredential(): Promise<SocialCredential> {
    if (this.clientId === undefined) {
      // Reached only if a caller ignores `isAvailable`.
      return Promise.reject(
        new SocialAuthUnavailable('Google', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is not set'),
      );
    }

    // Intentionally unimplemented until the OAuth client exists. Throwing beats a
    // half-written flow that looks finished in a diff and fails on a device.
    return Promise.reject(
      new SocialAuthUnavailable('Google', 'no OAuth client registered — social sign-in is deferred'),
    );
  }
}
