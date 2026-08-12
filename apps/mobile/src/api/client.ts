import type {
  AnswerOutcome,
  CompletionOutcome,
  DeliveredLeaf,
  LeafProgress,
  SessionStatus,
  StreakStatus,
  Track,
  TrackProgressSummary,
  User,
} from '@zoomout/shared';

import { ApiError, NetworkError, SessionExpiredError } from './errors';
import type { TokenStore } from './tokenStore';

/**
 * The only thing in the app that talks to the backend.
 *
 * Two responsibilities that are easy to get subtly wrong live here, together, because
 * they interact:
 *
 *  1. **Refresh is single-flight.** Five screens mounting at once behind an expired
 *     access token produce five 401s. Refreshing per 401 would fire five refreshes —
 *     and because the backend *rotates* refresh tokens and treats a replayed one as
 *     theft, four of them would present an already-rotated token and revoke the entire
 *     family. The naive implementation does not merely waste requests; it signs the
 *     reader out. All concurrent 401s await one shared refresh.
 *  2. **A retry happens once.** A request that 401s after a successful refresh is not
 *     retried again — that is the shape a refresh loop takes.
 */

export interface Session {
  readonly userId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSeconds: number;
}

export interface EmailSignUpInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly dateOfBirth: string;
  readonly timezone: string;
}

export interface EmailSignInInput {
  readonly email: string;
  readonly password: string;
}

export interface ProviderSignInInput {
  readonly provider: 'apple' | 'google';
  readonly idToken: string;
  readonly displayName?: string | undefined;
  readonly dateOfBirth?: string | undefined;
  readonly timezone?: string | undefined;
}

export interface ProfileUpdate {
  readonly displayName?: string | undefined;
  readonly timezone?: string | undefined;
}

/** One page of Explore. Mirrors the backend's `TrackPage`. */
export interface TrackPage {
  readonly tracks: readonly Track[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalTracks: number;
}

/** Leaf metadata for a Track's contents — no slide bodies, and no answer key. */
export interface LeafSummary {
  readonly id: string;
  readonly trackId: string;
  readonly orderIndex: number;
  readonly title: string;
  readonly isPlaceholder: boolean;
}

/**
 * A book on the reader's shelf, with how far through it they are.
 *
 * `progress` is derived server-side per request — see `trackProgressSummarySchema`.
 * The client displays it and never recomputes it.
 */
export interface LibraryEntry {
  readonly track: Track;
  readonly addedAt: string;
  readonly status: 'active' | 'completed' | 'archived';
  readonly progress: TrackProgressSummary;
}

/** Today's cap state and the reader's streak, in one round trip. */
export interface DayStatus {
  readonly session: SessionStatus;
  readonly streak: StreakStatus;
}

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly tokenStore: TokenStore;
  /** Injectable for tests; defaults to the platform `fetch`. */
  readonly fetchFn?: typeof fetch;
  /** Called once when the session ends and the reader must sign in again. */
  readonly onSessionEnded?: (() => void) | undefined;
}

const HTTP_UNAUTHORIZED = 401;
const HTTP_NO_CONTENT = 204;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly tokens: TokenStore;
  private readonly fetchFn: typeof fetch;
  private readonly onSessionEnded: (() => void) | undefined;

  /** In memory only, never persisted — see `tokenStore.ts`. */
  private accessToken: string | null = null;

  /** The shared refresh. Non-null exactly while one is in flight. */
  private refreshInFlight: Promise<string> | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/u, '');
    this.tokens = options.tokenStore;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.onSessionEnded = options.onSessionEnded;
  }

  /* ------------------------------------------------------------------ */
  /* Session                                                             */
  /* ------------------------------------------------------------------ */

  public async signUpWithEmail(input: EmailSignUpInput): Promise<Session> {
    return this.adopt(await this.send<SessionResponse>('POST', '/auth/signup', input, false));
  }

  public async signInWithEmail(input: EmailSignInInput): Promise<Session> {
    return this.adopt(await this.send<SessionResponse>('POST', '/auth/login', input, false));
  }

  /**
   * @throws {ApiError} `SIGNUP_DETAILS_REQUIRED` when a first-time social signup omits
   *   the date of birth or timezone the provider does not supply. Read
   *   `error.missingFields` to route; the message is copy, not a contract.
   */
  public async signInWithProvider(input: ProviderSignInInput): Promise<Session> {
    return this.adopt(await this.send<SessionResponse>('POST', '/auth/provider', input, false));
  }

  /**
   * Restores a session from the stored refresh token, if there is one.
   *
   * Called at launch. Returns null rather than throwing when there is nothing to
   * restore — a first-run app with no token is the normal case, not an error.
   */
  public async restoreSession(): Promise<string | null> {
    const stored = await this.tokens.readRefreshToken();

    if (stored === null) {
      return null;
    }

    try {
      return await this.refreshAccessToken();
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Signs out server-side, then locally.
   *
   * Local state is cleared **even if the server call fails**: a reader who taps sign
   * out on a plane must not stay signed in on the device. The server-side token
   * expires on its own, so the worst case is a revocation that lands late.
   */
  public async logout(): Promise<void> {
    const refreshToken = await this.tokens.readRefreshToken();

    if (refreshToken !== null) {
      try {
        await this.send('POST', '/auth/logout', { refreshToken }, true);
      } catch {
        // Deliberately swallowed — see above. The local clear below is what matters.
      }
    }

    await this.endSession();
  }

  public get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /* ------------------------------------------------------------------ */
  /* Profile                                                             */
  /* ------------------------------------------------------------------ */

  public async getProfile(): Promise<User> {
    return this.send<User>('GET', '/users/me', undefined, true);
  }

  public async updateProfile(update: ProfileUpdate): Promise<User> {
    return this.send<User>('PATCH', '/users/me', update, true);
  }

  /* ------------------------------------------------------------------ */
  /* Content                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * A page of Tracks for Explore.
   *
   * Placeholder visibility is **not** a client concern: `ContentService` decides what
   * this reader may see, and the app renders whatever comes back. Re-implementing that
   * rule here would give production a second, divergent opinion about which content is
   * real.
   */
  public async listTracks(page = 1, perPage = 20): Promise<TrackPage> {
    return this.send<TrackPage>(
      'GET',
      `/content/tracks?page=${String(page)}&perPage=${String(perPage)}`,
      undefined,
      true,
    );
  }

  public async getTrack(trackId: string): Promise<Track> {
    return this.send<Track>('GET', `/content/tracks/${encodeURIComponent(trackId)}`, undefined, true);
  }

  public async listLeaves(trackId: string): Promise<readonly LeafSummary[]> {
    const body = await this.send<{ leaves: readonly LeafSummary[] }>(
      'GET',
      `/content/tracks/${encodeURIComponent(trackId)}/leaves`,
      undefined,
      true,
    );

    return body.leaves;
  }

  /* ------------------------------------------------------------------ */
  /* Library                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * The reader's library, each entry carrying its own progress rollup.
   *
   * One request for the whole shelf. The alternative the backend was built to avoid —
   * a Leaf list and a progress row per Track — turns a twenty-book library into
   * hundreds of calls, which is why `progress` is on the entry rather than fetched
   * alongside it.
   */
  public async listLibrary(): Promise<readonly LibraryEntry[]> {
    const body = await this.send<{ entries: readonly LibraryEntry[] }>(
      'GET',
      '/library',
      undefined,
      true,
    );

    return body.entries;
  }

  /** Idempotent: adding a Track already in the library succeeds and changes nothing. */
  public async addToLibrary(trackId: string): Promise<void> {
    await this.send('POST', `/library/tracks/${encodeURIComponent(trackId)}`, undefined, true);
  }

  /** Also idempotent — removing something absent is the intent already satisfied. */
  public async removeFromLibrary(trackId: string): Promise<void> {
    await this.send('DELETE', `/library/tracks/${encodeURIComponent(trackId)}`, undefined, true);
  }

  /* ------------------------------------------------------------------ */
  /* The learning loop                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * One Leaf, as this reader is allowed to receive it.
   *
   * **The payoff arrives as `null` until it is earned** — absent from the object, not
   * blanked. That is the whole product differentiator expressed as a type, and the
   * reason this returns `DeliveredLeaf` rather than `PublicLeaf`. There is deliberately
   * no client-side path that reconstructs a locked payoff: if the server did not send
   * it, the app does not have it.
   *
   * The response is **not** run through `publicLeafSchema`. That parser predates the
   * Dinner Table Knowledge refinement and would reject valid takeaway slides; the
   * project constraint against pointing it at input like this is explicit.
   */
  public async getLeaf(leafId: string): Promise<DeliveredLeaf> {
    return this.send<DeliveredLeaf>(
      'GET',
      `/content/leaves/${encodeURIComponent(leafId)}`,
      undefined,
      true,
    );
  }

  /**
   * Marks a Leaf opened.
   *
   * Idempotent, and re-entering a Leaf creates nothing the second time — the existing
   * progress is the point of the response. Calling it is what makes `firstTryCorrect`
   * meaningful: an answer submitted without a start still grades, but the attempt count
   * it is measured against begins here.
   */
  public async startLeaf(leafId: string): Promise<LeafProgress> {
    const body = await this.send<{ progress: LeafProgress }>(
      'POST',
      `/progress/leaves/${encodeURIComponent(leafId)}/start`,
      undefined,
      true,
    );

    return body.progress;
  }

  /**
   * Submits an option **id** and is told the result.
   *
   * The client never sees, infers or sends `isCorrect`. It posts which option was
   * chosen; the server decides. A wrong answer is a 200 with `correct: false` — it is
   * the designed-for outcome of the mechanic, not an error, and treating it as one
   * would turn the retry loop into an error state.
   */
  public async submitAnswer(leafId: string, optionId: string): Promise<AnswerOutcome> {
    return this.send<AnswerOutcome>(
      'POST',
      `/progress/leaves/${encodeURIComponent(leafId)}/answer`,
      { optionId },
      true,
    );
  }

  /**
   * Completes a Leaf and returns what this call awarded.
   *
   * Idempotent server-side: `xpAwarded` is zero on a replay and `alreadyCompleted` says
   * so, which is what lets the player render "you earned 100" once rather than on every
   * re-entry. The client still guards against double submission — see the player — but
   * the server is what makes that guard a belt rather than the only strap.
   */
  /**
   * Today's cap state and the reader's streak.
   *
   * No date parameter, deliberately. "Today" is the server's answer, computed from the
   * reader's stored timezone — a client that sent its own date could reset its cap by
   * changing the device clock, and the cap is a wellbeing feature that has to survive
   * the reader's own worst impulses.
   */
  public async getToday(): Promise<DayStatus> {
    return this.send<DayStatus>('GET', '/progress/today', undefined, true);
  }

  public async completeLeaf(leafId: string): Promise<CompletionOutcome> {
    return this.send<CompletionOutcome>(
      'POST',
      `/progress/leaves/${encodeURIComponent(leafId)}/complete`,
      undefined,
      true,
    );
  }

  /* ------------------------------------------------------------------ */
  /* Transport                                                           */
  /* ------------------------------------------------------------------ */

  private async send<T>(
    method: string,
    path: string,
    body: unknown,
    authenticated: boolean,
  ): Promise<T> {
    const first = await this.dispatch(method, path, body, authenticated);

    if (first.status !== HTTP_UNAUTHORIZED || !authenticated) {
      return this.readBody<T>(first);
    }

    // One refresh, shared with every other request that hit 401 at the same time.
    await this.refreshAccessToken();

    const retried = await this.dispatch(method, path, body, true);

    if (retried.status === HTTP_UNAUTHORIZED) {
      // A fresh token was rejected. Retrying again is how a refresh loop starts, so
      // this ends the session instead.
      await this.endSession();
      throw new SessionExpiredError();
    }

    return this.readBody<T>(retried);
  }

  private async dispatch(
    method: string,
    path: string,
    body: unknown,
    authenticated: boolean,
  ): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json' };

    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    if (authenticated && this.accessToken !== null) {
      headers['authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      return await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      // A transport failure, not an HTTP status: no connection, DNS, TLS, timeout.
      throw new NetworkError({ cause: error });
    }
  }

  private async readBody<T>(response: Response): Promise<T> {
    if (response.status === HTTP_NO_CONTENT) {
      return undefined as T;
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw toApiError(payload, response.status);
    }

    return payload as T;
  }

  /* ------------------------------------------------------------------ */
  /* Refresh                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Renews the access token, at most once concurrently.
   *
   * The whole mechanism is the memoised promise: the first caller starts the refresh,
   * everyone else awaits the same one, and the slot is cleared afterwards so a later
   * expiry can refresh again. Clearing in `finally` — rather than only on success —
   * means a failed refresh does not poison the client forever.
   */
  private async refreshAccessToken(): Promise<string> {
    this.refreshInFlight ??= this.performRefresh().finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  private async performRefresh(): Promise<string> {
    const refreshToken = await this.tokens.readRefreshToken();

    if (refreshToken === null) {
      await this.endSession();
      throw new SessionExpiredError();
    }

    let response: SessionResponse;

    try {
      response = await this.send<SessionResponse>(
        'POST',
        '/auth/refresh',
        { refreshToken },
        false,
      );
    } catch (error) {
      /**
       * A network failure must **not** sign the reader out.
       *
       * Being briefly offline is not the same as having an invalid session, and
       * clearing the keychain on a dropped connection would log people out on the
       * underground. Only the server rejecting the token ends the session.
       */
      if (error instanceof NetworkError) {
        throw error;
      }

      await this.endSession();
      throw new SessionExpiredError();
    }

    await this.adopt(response);

    return response.accessToken;
  }

  /**
   * Takes ownership of a new session.
   *
   * The keychain write is awaited rather than fired off, because the backend **rotates**
   * the refresh token on every refresh and revokes the one it replaces. Losing the race
   * — persisting the old token, or not persisting at all before the app is killed —
   * makes the *next* refresh present a rotated token, which the backend correctly reads
   * as replay and answers by revoking the whole family.
   */
  private async adopt(response: SessionResponse): Promise<Session> {
    this.accessToken = response.accessToken;

    await this.tokens.writeRefreshToken(response.refreshToken);

    return {
      userId: response.userId,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresInSeconds: response.expiresIn,
    };
  }

  private async endSession(): Promise<void> {
    this.accessToken = null;
    await this.tokens.clear();
    this.onSessionEnded?.();
  }
}

interface SessionResponse {
  readonly userId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: string;
}

/** Reads the backend's `{ error: { code, message, ...fields } }` envelope. */
function toApiError(payload: unknown, status: number): ApiError {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const envelope: unknown = payload.error;

    if (typeof envelope === 'object' && envelope !== null) {
      const { code, message, ...fields } = envelope as Record<string, unknown>;

      return new ApiError({
        code: typeof code === 'string' ? code : 'UNKNOWN',
        message: typeof message === 'string' ? message : 'Something went wrong.',
        status,
        fields,
      });
    }
  }

  // A non-conforming body — a proxy error page, a gateway timeout. Still typed, so
  // callers never have to handle "an error that is not an ApiError but is not a
  // NetworkError either".
  return new ApiError({ code: 'UNKNOWN', message: 'Something went wrong.', status });
}
