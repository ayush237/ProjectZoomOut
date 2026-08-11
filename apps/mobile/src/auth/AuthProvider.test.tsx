import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { MemoryTokenStore } from '../api/tokenStore';
import { AuthProvider, useAuth, type AuthContextValue } from './AuthProvider';
import { deviceTimezone } from './ageGate';
import {
  SocialAuthCancelled,
  type SocialAuthProvider,
  type SocialCredential,
} from './socialAuth';

/**
 * The session state machine, and the two provider errors that need opposite responses.
 *
 * `SIGNUP_DETAILS_REQUIRED` is recoverable — hold the token, ask for one more field.
 * `PROVIDER_EMAIL_MISSING` is a dead end that needs its own copy. Handling them the
 * same way is the obvious mistake, and it sends a reader who can never finish to a
 * form that cannot help them, so both directions are asserted here.
 */

const BASE_URL = 'https://api.test';

/**
 * Unmounting is **async** in React Native Testing Library v14, so the automatic
 * cleanup between tests is not awaited and a previous test's provider can still be
 * mounted — and still finishing a `restoreSession` — while the next one renders. The
 * symptom is a suite that passes test-by-test and fails when run together, which is a
 * long way from its cause.
 */
afterEach(async () => {
  await cleanup();
});

interface Recorded {
  readonly url: string;
  readonly body: Record<string, unknown>;
}

class FakeBackend {
  public readonly calls: Recorded[] = [];
  private readonly handlers = new Map<string, () => Response>();

  public on(path: string, handler: () => Response): this {
    this.handlers.set(path, handler);
    return this;
  }

  public lastBodyFor(path: string): Record<string, unknown> | undefined {
    return this.calls.filter((call) => call.url.endsWith(path)).at(-1)?.body;
  }

  public readonly fetch: typeof fetch = (input, init) => {
    const url = urlOf(input);

    this.calls.push({
      url,
      body: typeof init?.body === 'string'
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : {},
    });

    for (const [path, handler] of this.handlers) {
      if (url.endsWith(path)) {
        return Promise.resolve(handler());
      }
    }

    return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no handler' } }, 404));
  };
}

/**
 * `fetch` accepts a string, a `URL` or a `Request`. Stringifying blindly gives
 * "[object Object]" for the last of those.
 */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const SESSION = {
  userId: 'user-1',
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresIn: 900,
  tokenType: 'Bearer',
};

const PROFILE = {
  id: 'user-1',
  email: 'reader@example.test',
  authProviders: ['email'],
  displayName: 'Test Reader',
  dateOfBirth: '1994-03-17',
  timezone: 'Europe/London',
  createdAt: '2026-08-09T12:00:00.000Z',
  updatedAt: '2026-08-09T12:00:00.000Z',
};

/** A social provider that returns a scripted credential without a native sheet. */
function fakeProvider(
  id: 'apple' | 'google',
  credential: SocialCredential | Error,
): SocialAuthProvider {
  return {
    id,
    isAvailable: () => Promise.resolve(true),
    requestCredential: () =>
      credential instanceof Error ? Promise.reject(credential) : Promise.resolve(credential),
  };
}

/**
 * `renderHook` is **async** in React Native Testing Library v14 — it returns a promise
 * of the result, not the result. Forgetting the await gives you `undefined.current`
 * from a line that looks correct, which is a slow thing to work out from the error.
 */
async function mount(
  backend: FakeBackend,
  refreshToken: string | null = null,
): Promise<{ result: { current: AuthContextValue }; store: MemoryTokenStore }> {
  const store = new MemoryTokenStore(refreshToken);

  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <AuthProvider tokenStore={store} baseUrl={BASE_URL} fetchFn={backend.fetch}>
      {children}
    </AuthProvider>
  );

  const { result } = await renderHook(() => useAuth(), { wrapper });

  return { result, store };
}

/* -------------------------------------------------------------------------- */
/* Launch                                                                      */
/* -------------------------------------------------------------------------- */

describe('at launch', () => {
  it('settles on signed-out when there is nothing stored', async () => {
    const { result } = await mount(new FakeBackend());

    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });
  });

  it('restores a stored session', async () => {
    const backend = new FakeBackend()
      .on('/auth/refresh', () => json(SESSION))
      .on('/users/me', () => json(PROFILE));

    const { result } = await mount(backend, 'refresh-stored');

    await waitFor(() => {
      expect(result.current.status).toBe('signedIn');
    });
    expect(result.current.user?.displayName).toBe('Test Reader');
  });

  it('stays in restoring while the check is still in flight', async () => {
    // The reason `restoring` is a distinct state: a returning reader must not be
    // flashed the sign-in screen on every cold start. Asserting it needs a refresh
    // that has not answered yet — `renderHook` is async in RNTL v14 and has already
    // flushed the effect by the time it returns, so a fast fake would settle first.
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const backend = new FakeBackend()
      .on('/auth/refresh', () => json(SESSION))
      .on('/users/me', () => json(PROFILE));

    const slowFetch: typeof fetch = async (input, init) => {
      await held;
      return backend.fetch(input, init);
    };

    const store = new MemoryTokenStore('refresh-stored');
    const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
      <AuthProvider tokenStore={store} baseUrl={BASE_URL} fetchFn={slowFetch}>
        {children}
      </AuthProvider>
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe('restoring');

    await act(async () => {
      release();
      await held;
    });

    await waitFor(() => {
      expect(result.current.status).toBe('signedIn');
    });
  });

  it('falls back to signed-out when the stored token is stale', async () => {
    const backend = new FakeBackend().on('/auth/refresh', () =>
      json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'gone' } }, 401),
    );

    const { result } = await mount(backend, 'refresh-stale');

    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Email signup                                                                */
/* -------------------------------------------------------------------------- */

describe('email signup', () => {
  it('signs the reader in', async () => {
    const backend = new FakeBackend()
      .on('/auth/signup', () => json(SESSION, 201))
      .on('/users/me', () => json(PROFILE));

    const { result } = await mount(backend);
    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    await act(async () => {
      await result.current.signUpWithEmail({
        email: 'reader@example.test',
        password: 'a-sufficiently-long-password',
        displayName: 'Test Reader',
        dateOfBirth: '1994-03-17',
      });
    });

    expect(result.current.status).toBe('signedIn');
  });

  it('sends the device timezone without asking for it', async () => {
    const backend = new FakeBackend()
      .on('/auth/signup', () => json(SESSION, 201))
      .on('/users/me', () => json(PROFILE));

    const { result } = await mount(backend);
    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    await act(async () => {
      await result.current.signUpWithEmail({
        email: 'reader@example.test',
        password: 'a-sufficiently-long-password',
        displayName: 'Test Reader',
        dateOfBirth: '1994-03-17',
      });
    });

    expect(backend.lastBodyFor('/auth/signup')?.['timezone']).toBe(deviceTimezone());
  });

  it('surfaces an age refusal rather than swallowing it', async () => {
    const backend = new FakeBackend().on('/auth/signup', () =>
      json({ error: { code: 'BELOW_MINIMUM_AGE', message: 'too young' } }, 403),
    );

    const { result } = await mount(backend);
    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    await expect(
      result.current.signUpWithEmail({
        email: 'young@example.test',
        password: 'a-sufficiently-long-password',
        displayName: 'Young Reader',
        dateOfBirth: '2020-01-01',
      }),
    ).rejects.toMatchObject({ code: 'BELOW_MINIMUM_AGE' });

    expect(result.current.status).toBe('signedOut');
  });
});

/* -------------------------------------------------------------------------- */
/* The two provider errors                                                     */
/* -------------------------------------------------------------------------- */

describe('a social sign-in missing signup details', () => {
  const detailsRequired = (): Response =>
    json(
      {
        error: {
          code: 'SIGNUP_DETAILS_REQUIRED',
          message: 'needs more',
          missingFields: ['dateOfBirth'],
        },
      },
      400,
    );

  it('routes to the details step rather than failing', async () => {
    const backend = new FakeBackend().on('/auth/provider', detailsRequired);
    const { result } = await mount(backend);
    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    await act(async () => {
      await result.current.signInWithProvider(
        fakeProvider('apple', { idToken: 'apple-token', displayName: 'Apple Reader' }),
      );
    });

    expect(result.current.status).toBe('needsSignupDetails');
    expect(result.current.pendingSignup?.missingFields).toEqual(['dateOfBirth']);
  });

  it('keeps the provider token so the reader does not repeat the sheet', async () => {
    // Apple returns the display name on the *first* authorisation only, so sending
    // someone back through the sheet loses it permanently.
    const backend = new FakeBackend().on('/auth/provider', detailsRequired);
    const { result } = await mount(backend);
    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    await act(async () => {
      await result.current.signInWithProvider(
        fakeProvider('apple', { idToken: 'apple-token', displayName: 'Apple Reader' }),
      );
    });

    expect(result.current.pendingSignup).toMatchObject({
      idToken: 'apple-token',
      displayName: 'Apple Reader',
      provider: 'apple',
    });
  });

  it('completes the signup with the collected date of birth', async () => {
    let attempt = 0;
    const backend = new FakeBackend()
      .on('/auth/provider', () => {
        attempt += 1;
        return attempt === 1 ? detailsRequired() : json(SESSION);
      })
      .on('/users/me', () => json(PROFILE));

    const { result } = await mount(backend);
    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    await act(async () => {
      await result.current.signInWithProvider(
        fakeProvider('apple', { idToken: 'apple-token' }),
      );
    });
    await act(async () => {
      await result.current.completeSocialSignup('1994-03-17');
    });

    expect(result.current.status).toBe('signedIn');

    const body = backend.lastBodyFor('/auth/provider');
    expect(body).toMatchObject({
      idToken: 'apple-token',
      dateOfBirth: '1994-03-17',
      timezone: deviceTimezone(),
    });
  });

  it('abandons the pending signup when the reader backs out', async () => {
    const backend = new FakeBackend().on('/auth/provider', detailsRequired);
    const { result } = await mount(backend);
    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    await act(async () => {
      await result.current.signInWithProvider(fakeProvider('google', { idToken: 'g' }));
    });
    await act(async () => {
      result.current.cancelSocialSignup();
      // Cancelling is synchronous, but the act still has to be async: a sync act does
      // not flush the resulting state update in RNTL v14, and `result.current` would
      // still report the pre-cancel status.
      await Promise.resolve();
    });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.pendingSignup).toBeNull();
  });
});

describe('a provider that supplies no email', () => {
  it('is a dead end, not a details prompt', async () => {
    // The opposite recovery from SIGNUP_DETAILS_REQUIRED. The reader has to change
    // something at Apple or Google; no form in this app can fix it.
    const backend = new FakeBackend().on('/auth/provider', () =>
      json({ error: { code: 'PROVIDER_EMAIL_MISSING', message: 'no email' } }, 400),
    );

    const { result } = await mount(backend);
    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    await expect(
      result.current.signInWithProvider(fakeProvider('apple', { idToken: 'apple-token' })),
    ).rejects.toMatchObject({ code: 'PROVIDER_EMAIL_MISSING' });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.pendingSignup).toBeNull();
  });
});

describe('a dismissed provider sheet', () => {
  it('is not an error', async () => {
    const backend = new FakeBackend();
    const { result } = await mount(backend);
    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    await act(async () => {
      await result.current.signInWithProvider(
        fakeProvider('apple', new SocialAuthCancelled()),
      );
    });

    expect(result.current.status).toBe('signedOut');
    expect(backend.calls).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Sign-out and expiry                                                         */
/* -------------------------------------------------------------------------- */

describe('leaving the session', () => {
  it('returns to sign-in and clears the keychain on sign-out', async () => {
    const backend = new FakeBackend()
      .on('/auth/refresh', () => json(SESSION))
      .on('/users/me', () => json(PROFILE))
      .on('/auth/logout', () => new Response(null, { status: 204 }));

    const { result, store } = await mount(backend, 'refresh-stored');
    await waitFor(() => {
      expect(result.current.status).toBe('signedIn');
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.user).toBeNull();
    await expect(store.readRefreshToken()).resolves.toBeNull();
  });

  it('lands on sign-in when a refresh is refused mid-session', async () => {
    /**
     * Drives the **real** path: an authenticated request 401s, the client refreshes,
     * the server refuses the refresh, the client ends the session and calls
     * `onSessionEnded`, and the provider returns the app to sign-in.
     *
     * The first version of this test called `signOut()`, which sets the status
     * unconditionally — so the scripted 401 was never reached and deleting the
     * `onSessionEnded` handler entirely left the test green. It asserted the outcome
     * without exercising the mechanism.
     *
     * This one goes through `refreshProfile`, which does nothing but issue the request
     * and set the user. If the handler stops working, nothing moves the status and this
     * fails.
     */
    let profileReads = 0;
    let refreshes = 0;

    const backend = new FakeBackend()
      .on('/auth/refresh', () => {
        refreshes += 1;
        // The launch restore is allowed; the mid-session renewal is refused.
        return refreshes === 1
          ? json(SESSION)
          : json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'gone' } }, 401);
      })
      .on('/users/me', () => {
        profileReads += 1;
        // First read signs them in; the next one finds a dead access token.
        return profileReads === 1
          ? json(PROFILE)
          : json({ error: { code: 'INVALID_TOKEN', message: 'expired' } }, 401);
      });

    const { result, store } = await mount(backend, 'refresh-stored');
    await waitFor(() => {
      expect(result.current.status).toBe('signedIn');
    });

    await act(async () => {
      await result.current.refreshProfile().catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    // The client's half of the same event: local credentials gone, so a relaunch does
    // not try the dead token again.
    expect(result.current.user).toBeNull();
    await expect(store.readRefreshToken()).resolves.toBeNull();
  });

  it('does not sign the reader out when the renewal fails on the network', async () => {
    // Being briefly offline is not the same as having an invalid session. Clearing the
    // keychain on a dropped connection would sign readers out on the underground.
    let profileReads = 0;
    let refreshes = 0;

    const backend = new FakeBackend()
      .on('/auth/refresh', () => {
        refreshes += 1;
        if (refreshes > 1) {
          throw new Error('offline');
        }
        return json(SESSION);
      })
      .on('/users/me', () => {
        profileReads += 1;
        return profileReads === 1
          ? json(PROFILE)
          : json({ error: { code: 'INVALID_TOKEN', message: 'expired' } }, 401);
      });

    const { result, store } = await mount(backend, 'refresh-stored');
    await waitFor(() => {
      expect(result.current.status).toBe('signedIn');
    });

    await act(async () => {
      await result.current.refreshProfile().catch(() => undefined);
    });

    expect(result.current.status).toBe('signedIn');
    await expect(store.readRefreshToken()).resolves.not.toBeNull();
  });
});
