import type { User } from '@zoomout/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ApiClient } from '../api/client';
import { ApiError, ApiErrorCode } from '../api/errors';
import { SecureTokenStore, type TokenStore } from '../api/tokenStore';
import { appConfig } from '../config';
import { deviceTimezone } from './ageGate';
import { SocialAuthCancelled, type SocialAuthProvider, type SocialCredential } from './socialAuth';

/**
 * Session state for the whole app.
 *
 * The state machine is small on purpose, and every state exists because navigation has
 * to distinguish it:
 *
 *  - `restoring` — the launch check against the keychain. Distinct from `signedOut` so
 *    the app does not flash the sign-in screen at a reader who is already signed in.
 *  - `signedOut` — show the auth stack.
 *  - `needsSignupDetails` — a social sign-in got back far enough to be told what it is
 *    missing. Not signed in, but not starting over either: the provider token is still
 *    good and the reader only owes us a date of birth.
 *  - `signedIn` — show the tab shell.
 */

export type AuthStatus = 'restoring' | 'signedOut' | 'needsSignupDetails' | 'signedIn';

/**
 * A social sign-in the backend paused for missing details.
 *
 * Holds the provider token so completing it is one more request rather than a second
 * trip through the provider's sheet — Apple in particular will not re-issue the display
 * name, so sending the reader back through it loses information.
 */
export interface PendingSocialSignup {
  readonly provider: 'apple' | 'google';
  readonly idToken: string;
  readonly displayName: string | undefined;
  /** Machine-readable field names from the backend, e.g. `['dateOfBirth']`. */
  readonly missingFields: readonly string[];
}

export interface EmailSignUpForm {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly dateOfBirth: string;
}

/**
 * Declared as function-valued **properties**, not method shorthand.
 *
 * Screens destructure this (`const { signOut } = useAuth()`), and method shorthand
 * tells the type system these are methods with a `this` — which makes every
 * destructure an unbound-method error, correctly, because a real method would lose its
 * receiver. They are closures over the provider's state and have no `this` at all, so
 * the property form is both accurate and what lets callers pull them out.
 */
export interface AuthContextValue {
  readonly status: AuthStatus;
  readonly user: User | null;
  readonly pendingSignup: PendingSocialSignup | null;
  readonly signUpWithEmail: (form: EmailSignUpForm) => Promise<void>;
  readonly signInWithEmail: (input: { email: string; password: string }) => Promise<void>;
  /** Runs the provider sheet, then signs in. May end in `needsSignupDetails`. */
  readonly signInWithProvider: (provider: SocialAuthProvider) => Promise<void>;
  /** Finishes a `needsSignupDetails` signup with the date of birth just collected. */
  readonly completeSocialSignup: (dateOfBirth: string) => Promise<void>;
  readonly cancelSocialSignup: () => void;
  readonly signOut: () => Promise<void>;
  /**
   * Re-reads the profile from the server.
   *
   * The only authenticated request the app makes after launch, which makes it the path
   * an expired session is actually discovered on: if the access token has died and the
   * refresh token with it, this is where the client ends the session and the shell is
   * replaced by sign-in.
   *
   * @throws {SessionExpiredError} when the session could not be renewed. The status has
   *   already flipped to `signedOut` by then; the throw is for the caller's own control
   *   flow, not a second thing to handle.
   */
  readonly refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  readonly children: ReactNode;
  /** Injectable for tests. Defaults to the real keychain-backed store. */
  readonly tokenStore?: TokenStore | undefined;
  readonly baseUrl?: string | undefined;
  readonly fetchFn?: typeof fetch | undefined;
}

export function AuthProvider({
  children,
  tokenStore,
  baseUrl,
  fetchFn,
}: AuthProviderProps): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const [pendingSignup, setPendingSignup] = useState<PendingSocialSignup | null>(null);

  /**
   * The session-ended callback has to survive into a client built once, so it reads
   * through a ref. Capturing `setStatus` directly would be fine today, but the client
   * outlives every render and a captured stale closure here would silently stop
   * signing readers out.
   */
  const onSessionEnded = useRef<() => void>(() => undefined);

  const client = useMemo(
    () =>
      new ApiClient({
        baseUrl: baseUrl ?? appConfig.apiBaseUrl,
        tokenStore: tokenStore ?? new SecureTokenStore(),
        ...(fetchFn === undefined ? {} : { fetchFn }),
        onSessionEnded: () => {
          onSessionEnded.current();
        },
      }),
    [baseUrl, tokenStore, fetchFn],
  );

  onSessionEnded.current = (): void => {
    // A refresh the server refused. The credentials are already cleared by the client;
    // this is the half that gets the reader back to sign-in instead of leaving them on
    // a screen whose every request now fails.
    setUser(null);
    setPendingSignup(null);
    setStatus('signedOut');
  };

  const adoptSignedIn = useCallback(async (): Promise<void> => {
    const profile = await client.getProfile();

    setUser(profile);
    setPendingSignup(null);
    setStatus('signedIn');
  }, [client]);

  /* Launch: try the stored refresh token before showing anything. */
  useEffect(() => {
    let active = true;

    void (async (): Promise<void> => {
      try {
        const restored = await client.restoreSession();

        if (!active) {
          return;
        }

        if (restored === null) {
          setStatus('signedOut');
          return;
        }

        await adoptSignedIn();
      } catch {
        // Offline at launch, or a profile fetch that failed. Signed-out is the honest
        // state: we cannot prove who this is, and guessing would show a shell with no
        // data in it.
        if (active) {
          setStatus('signedOut');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [client, adoptSignedIn]);

  const signUpWithEmail = useCallback(
    async (form: EmailSignUpForm): Promise<void> => {
      await client.signUpWithEmail({
        email: form.email,
        password: form.password,
        displayName: form.displayName,
        dateOfBirth: form.dateOfBirth,
        // Read from the device, never asked for. The backend needs it to roll the
        // daily cap and streaks at the reader's local midnight.
        timezone: deviceTimezone(),
      });

      await adoptSignedIn();
    },
    [client, adoptSignedIn],
  );

  const signInWithEmail = useCallback(
    async (input: { email: string; password: string }): Promise<void> => {
      await client.signInWithEmail(input);
      await adoptSignedIn();
    },
    [client, adoptSignedIn],
  );

  const exchangeCredential = useCallback(
    async (
      provider: 'apple' | 'google',
      credential: SocialCredential,
      dateOfBirth?: string,
    ): Promise<void> => {
      try {
        await client.signInWithProvider({
          provider,
          idToken: credential.idToken,
          ...(credential.displayName === undefined
            ? {}
            : { displayName: credential.displayName }),
          ...(dateOfBirth === undefined ? {} : { dateOfBirth }),
          timezone: deviceTimezone(),
        });

        await adoptSignedIn();
      } catch (error) {
        /**
         * The recoverable half of the two provider errors.
         *
         * A first-time social signup cannot succeed without a date of birth — no
         * provider supplies one — so the backend refuses and names what it needs.
         * Holding the token and routing to a single input is the difference between
         * one extra screen and starting the whole flow again.
         *
         * `PROVIDER_EMAIL_MISSING` is deliberately **not** handled here: it needs the
         * opposite response, an unrecoverable dead end with its own copy, and lumping
         * the two together would send a reader to a form that cannot help them.
         */
        if (error instanceof ApiError && error.is(ApiErrorCode.signupDetailsRequired)) {
          setPendingSignup({
            provider,
            idToken: credential.idToken,
            displayName: credential.displayName,
            missingFields: error.missingFields,
          });
          setStatus('needsSignupDetails');
          return;
        }

        throw error;
      }
    },
    [client, adoptSignedIn],
  );

  const signInWithProvider = useCallback(
    async (provider: SocialAuthProvider): Promise<void> => {
      let credential: SocialCredential;

      try {
        credential = await provider.requestCredential();
      } catch (error) {
        // Backing out of a sign-in sheet is a decision, not a failure to report.
        if (error instanceof SocialAuthCancelled) {
          return;
        }
        throw error;
      }

      await exchangeCredential(provider.id, credential);
    },
    [exchangeCredential],
  );

  const completeSocialSignup = useCallback(
    async (dateOfBirth: string): Promise<void> => {
      if (pendingSignup === null) {
        throw new Error('No social signup is waiting for details');
      }

      await exchangeCredential(
        pendingSignup.provider,
        { idToken: pendingSignup.idToken, displayName: pendingSignup.displayName },
        dateOfBirth,
      );
    },
    [pendingSignup, exchangeCredential],
  );

  const cancelSocialSignup = useCallback((): void => {
    setPendingSignup(null);
    setStatus('signedOut');
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    // No try/catch: a dead session is reported by the client through `onSessionEnded`,
    // which has already returned the app to sign-in. Catching here and setting the
    // status again would hide whether that wiring works — which is exactly how the
    // first version of this went wrong.
    setUser(await client.getProfile());
  }, [client]);

  const signOut = useCallback(async (): Promise<void> => {
    await client.logout();

    setUser(null);
    setPendingSignup(null);
    setStatus('signedOut');
  }, [client]);

  const value = useMemo(
    (): AuthContextValue => ({
      status,
      user,
      pendingSignup,
      signUpWithEmail,
      signInWithEmail,
      signInWithProvider,
      completeSocialSignup,
      cancelSocialSignup,
      signOut,
      refreshProfile,
    }),
    [
      status,
      user,
      pendingSignup,
      signUpWithEmail,
      signInWithEmail,
      signInWithProvider,
      completeSocialSignup,
      cancelSocialSignup,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** @throws {Error} when used outside an `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }

  return value;
}
