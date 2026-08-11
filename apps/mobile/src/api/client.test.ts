import { ApiClient } from './client';
import { ApiError, NetworkError, SessionExpiredError } from './errors';
import { MemoryTokenStore } from './tokenStore';

/**
 * The API client's failure behaviour.
 *
 * The tests that matter here assert **how many times something happened**, not merely
 * that the request eventually succeeded. A client that refreshes once per in-flight
 * 401 passes every "the request works" test and still signs the reader out in
 * production, because the backend rotates refresh tokens and reads the second
 * presentation of one as theft.
 */

const BASE_URL = 'https://api.test';

interface Recorded {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

/** A scripted `fetch` that records every call. */
class FakeBackend {
  public readonly calls: Recorded[] = [];
  private readonly handlers = new Map<string, () => Response>();

  public on(path: string, handler: () => Response): this {
    this.handlers.set(path, handler);
    return this;
  }

  public countOf(path: string): number {
    return this.calls.filter((call) => call.url.endsWith(path)).length;
  }

  public readonly fetch: typeof fetch = (input, init) => {
    const url = urlOf(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;

    this.calls.push({
      url,
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
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

function sessionBody(suffix: string): Record<string, unknown> {
  return {
    userId: 'user-1',
    accessToken: `access-${suffix}`,
    refreshToken: `refresh-${suffix}`,
    expiresIn: 900,
    tokenType: 'Bearer',
  };
}

const unauthorized = (): Response =>
  json({ error: { code: 'INVALID_TOKEN', message: 'expired' } }, 401);

function buildClient(
  backend: FakeBackend,
  options: { refreshToken?: string | null; onSessionEnded?: () => void } = {},
): { client: ApiClient; store: MemoryTokenStore } {
  // `??` would swallow an explicit null, which is exactly the first-run case one of
  // these tests is about.
  const store = new MemoryTokenStore(
    'refreshToken' in options ? options.refreshToken ?? null : 'refresh-initial',
  );

  const client = new ApiClient({
    baseUrl: BASE_URL,
    tokenStore: store,
    fetchFn: backend.fetch,
    ...(options.onSessionEnded === undefined ? {} : { onSessionEnded: options.onSessionEnded }),
  });

  return { client, store };
}

/** Signs in so the client holds an access token, then clears the recorded calls. */
async function signedIn(backend: FakeBackend, client: ApiClient): Promise<void> {
  backend.on('/auth/login', () => json(sessionBody('initial')));
  await client.signInWithEmail({ email: 'a@example.test', password: 'password-1234' });
  backend.calls.length = 0;
}

/* -------------------------------------------------------------------------- */
/* Single-flight refresh — the one that matters                                */
/* -------------------------------------------------------------------------- */

describe('refresh under concurrency', () => {
  it('triggers exactly one refresh for many simultaneous 401s', async () => {
    // Five screens mounting at once behind an expired token. Refreshing per request
    // would present the rotated token four times, and the backend revokes the whole
    // family on reuse — so the naive version signs the reader out.
    const backend = new FakeBackend();
    const { client } = buildClient(backend);
    await signedIn(backend, client);

    let profileCalls = 0;
    backend
      .on('/auth/refresh', () => json(sessionBody('rotated')))
      .on('/users/me', () => {
        profileCalls += 1;
        // Every request made before the refresh lands sees the expired token.
        return profileCalls <= 5 ? unauthorized() : json({ id: 'user-1' });
      });

    const results = await Promise.all([
      client.getProfile(),
      client.getProfile(),
      client.getProfile(),
      client.getProfile(),
      client.getProfile(),
    ]);

    expect(backend.countOf('/auth/refresh')).toBe(1);
    expect(results).toHaveLength(5);
  });

  it('retries every waiting request after the shared refresh', async () => {
    const backend = new FakeBackend();
    const { client } = buildClient(backend);
    await signedIn(backend, client);

    let attempts = 0;
    backend.on('/auth/refresh', () => json(sessionBody('rotated'))).on('/users/me', () => {
      attempts += 1;
      return attempts <= 3 ? unauthorized() : json({ id: 'user-1' });
    });

    await Promise.all([client.getProfile(), client.getProfile(), client.getProfile()]);

    // Three original attempts plus three retries.
    expect(backend.countOf('/users/me')).toBe(6);
  });

  it('refreshes again on a later expiry rather than refusing forever', async () => {
    // The memoised promise has to be cleared once settled, or the client can only ever
    // refresh once per process lifetime.
    const backend = new FakeBackend();
    const { client } = buildClient(backend);
    await signedIn(backend, client);

    let profileCalls = 0;
    backend.on('/auth/refresh', () => json(sessionBody('rotated'))).on('/users/me', () => {
      profileCalls += 1;
      // Expired on the 1st and 3rd calls; the retries in between succeed.
      return profileCalls === 1 || profileCalls === 3 ? unauthorized() : json({ id: 'user-1' });
    });

    await client.getProfile();
    await client.getProfile();

    expect(backend.countOf('/auth/refresh')).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/* Refresh and retry, singly                                                   */
/* -------------------------------------------------------------------------- */

describe('refresh on a single expired request', () => {
  it('refreshes once and retries the original request', async () => {
    const backend = new FakeBackend();
    const { client } = buildClient(backend);
    await signedIn(backend, client);

    let calls = 0;
    backend.on('/auth/refresh', () => json(sessionBody('rotated'))).on('/users/me', () => {
      calls += 1;
      return calls === 1 ? unauthorized() : json({ id: 'user-1', displayName: 'Reader' });
    });

    await expect(client.getProfile()).resolves.toMatchObject({ displayName: 'Reader' });
    expect(backend.countOf('/auth/refresh')).toBe(1);
  });

  it('sends the retry with the new access token, not the stale one', async () => {
    const backend = new FakeBackend();
    const { client } = buildClient(backend);
    await signedIn(backend, client);

    let calls = 0;
    backend.on('/auth/refresh', () => json(sessionBody('rotated'))).on('/users/me', () => {
      calls += 1;
      return calls === 1 ? unauthorized() : json({ id: 'user-1' });
    });

    await client.getProfile();

    const profileCalls = backend.calls.filter((call) => call.url.endsWith('/users/me'));
    expect(profileCalls[0]?.headers['authorization']).toBe('Bearer access-initial');
    expect(profileCalls[1]?.headers['authorization']).toBe('Bearer access-rotated');
  });

  it('persists the rotated refresh token', async () => {
    // Miss this and the *next* refresh presents an already-rotated token, which the
    // backend treats as reuse and answers by revoking the family.
    const backend = new FakeBackend();
    const { client, store } = buildClient(backend);
    await signedIn(backend, client);

    let calls = 0;
    backend.on('/auth/refresh', () => json(sessionBody('rotated'))).on('/users/me', () => {
      calls += 1;
      return calls === 1 ? unauthorized() : json({ id: 'user-1' });
    });

    await client.getProfile();

    await expect(store.readRefreshToken()).resolves.toBe('refresh-rotated');
  });

  it('does not retry a second time when the fresh token is also rejected', async () => {
    // Retrying again is exactly the shape a refresh loop takes.
    const backend = new FakeBackend();
    const ended = jest.fn();
    const { client } = buildClient(backend, { onSessionEnded: ended });
    await signedIn(backend, client);

    backend.on('/auth/refresh', () => json(sessionBody('rotated'))).on('/users/me', unauthorized);

    await expect(client.getProfile()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(backend.countOf('/users/me')).toBe(2);
    expect(backend.countOf('/auth/refresh')).toBe(1);
    expect(ended).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/* A refresh the server rejects                                               */
/* -------------------------------------------------------------------------- */

describe('a rejected refresh', () => {
  it('clears the session and reports it once', async () => {
    const backend = new FakeBackend();
    const ended = jest.fn();
    const { client, store } = buildClient(backend, { onSessionEnded: ended });
    await signedIn(backend, client);

    backend
      .on('/auth/refresh', () =>
        json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'gone' } }, 401),
      )
      .on('/users/me', unauthorized);

    await expect(client.getProfile()).rejects.toBeInstanceOf(SessionExpiredError);

    await expect(store.readRefreshToken()).resolves.toBeNull();
    expect(client.isAuthenticated).toBe(false);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('does not loop', async () => {
    const backend = new FakeBackend();
    const { client } = buildClient(backend);
    await signedIn(backend, client);

    backend
      .on('/auth/refresh', () =>
        json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'gone' } }, 401),
      )
      .on('/users/me', unauthorized);

    await expect(client.getProfile()).rejects.toThrow();

    expect(backend.countOf('/auth/refresh')).toBe(1);
    expect(backend.calls.length).toBeLessThanOrEqual(3);
  });

  it('fails fast on the next request, without another refresh attempt', async () => {
    // The credentials are gone, so there is nothing left to refresh with. Trying
    // anyway is how a cleared session still manages to hammer the backend.
    const backend = new FakeBackend();
    const { client } = buildClient(backend);
    await signedIn(backend, client);

    backend
      .on('/auth/refresh', () =>
        json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'gone' } }, 401),
      )
      .on('/users/me', unauthorized);

    await expect(client.getProfile()).rejects.toThrow();
    backend.calls.length = 0;

    await expect(client.getProfile()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(backend.countOf('/auth/refresh')).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Being offline is not being signed out                                       */
/* -------------------------------------------------------------------------- */

describe('a refresh that never reaches the server', () => {
  it('keeps the session rather than signing the reader out', async () => {
    // Deliberately different from a rejected refresh. Clearing the keychain on a
    // dropped connection would sign people out on the underground.
    const backend = new FakeBackend();
    const ended = jest.fn();
    const { client, store } = buildClient(backend, { onSessionEnded: ended });
    await signedIn(backend, client);

    backend
      .on('/auth/refresh', () => {
        throw new TypeError('Network request failed');
      })
      .on('/users/me', unauthorized);

    await expect(client.getProfile()).rejects.toBeInstanceOf(NetworkError);

    await expect(store.readRefreshToken()).resolves.toBe('refresh-initial');
    expect(ended).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* Typed errors                                                                */
/* -------------------------------------------------------------------------- */

describe('errors', () => {
  it('types an error from its code, not its message', async () => {
    const backend = new FakeBackend().on('/auth/login', () =>
      json({ error: { code: 'INVALID_CREDENTIALS', message: 'anything at all' } }, 401),
    );
    const { client } = buildClient(backend);

    await expect(
      client.signInWithEmail({ email: 'a@example.test', password: 'wrong-password' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('exposes missingFields so the app can route to the right input', async () => {
    const backend = new FakeBackend().on('/auth/provider', () =>
      json(
        {
          error: {
            code: 'SIGNUP_DETAILS_REQUIRED',
            message: 'needs more',
            missingFields: ['dateOfBirth', 'timezone'],
          },
        },
        400,
      ),
    );
    const { client } = buildClient(backend);

    const error = await client
      .signInWithProvider({ provider: 'apple', idToken: 'token' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).missingFields).toEqual(['dateOfBirth', 'timezone']);
  });

  it('reports an unreadable error body as a typed error anyway', async () => {
    const backend = new FakeBackend().on('/auth/login', () => new Response('<html>502</html>', { status: 502 }));
    const { client } = buildClient(backend);

    const error = await client
      .signInWithEmail({ email: 'a@example.test', password: 'password-1234' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
  });

  it('reports a transport failure as a NetworkError', async () => {
    const backend = new FakeBackend().on('/auth/login', () => {
      throw new TypeError('Network request failed');
    });
    const { client } = buildClient(backend);

    await expect(
      client.signInWithEmail({ email: 'a@example.test', password: 'password-1234' }),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});

/* -------------------------------------------------------------------------- */
/* Session lifecycle                                                           */
/* -------------------------------------------------------------------------- */

describe('session lifecycle', () => {
  it('restores a session from the stored refresh token', async () => {
    const backend = new FakeBackend().on('/auth/refresh', () => json(sessionBody('restored')));
    const { client } = buildClient(backend, { refreshToken: 'refresh-stored' });

    await expect(client.restoreSession()).resolves.toBe('access-restored');
    expect(client.isAuthenticated).toBe(true);
  });

  it('reports no session rather than failing on a first run', async () => {
    const backend = new FakeBackend();
    const { client } = buildClient(backend, { refreshToken: null });

    await expect(client.restoreSession()).resolves.toBeNull();
    expect(backend.calls).toHaveLength(0);
  });

  it('returns null when the stored token is no longer valid', async () => {
    const backend = new FakeBackend().on('/auth/refresh', () =>
      json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'gone' } }, 401),
    );
    const { client } = buildClient(backend, { refreshToken: 'refresh-stale' });

    await expect(client.restoreSession()).resolves.toBeNull();
    expect(client.isAuthenticated).toBe(false);
  });

  it('clears local credentials on sign-out', async () => {
    const backend = new FakeBackend().on('/auth/logout', () => new Response(null, { status: 204 }));
    const { client, store } = buildClient(backend);
    await signedIn(backend, client);

    await client.logout();

    await expect(store.readRefreshToken()).resolves.toBeNull();
    expect(client.isAuthenticated).toBe(false);
  });

  it('clears local credentials even when the server call fails', async () => {
    // A reader who taps sign out on a plane must not stay signed in on the device.
    const backend = new FakeBackend().on('/auth/logout', () => {
      throw new TypeError('Network request failed');
    });
    const { client, store } = buildClient(backend);
    await signedIn(backend, client);

    await client.logout();

    await expect(store.readRefreshToken()).resolves.toBeNull();
    expect(client.isAuthenticated).toBe(false);
  });

  it('attaches the bearer token to authenticated requests only', async () => {
    const backend = new FakeBackend().on('/users/me', () => json({ id: 'user-1' }));
    const { client } = buildClient(backend);
    await signedIn(backend, client);

    await client.getProfile();

    expect(backend.calls[0]?.headers['authorization']).toBe('Bearer access-initial');
  });

  it('sends no credentials on sign-in', async () => {
    const backend = new FakeBackend().on('/auth/login', () => json(sessionBody('initial')));
    const { client } = buildClient(backend);

    await client.signInWithEmail({ email: 'a@example.test', password: 'password-1234' });

    expect(backend.calls[0]?.headers['authorization']).toBeUndefined();
  });
});
