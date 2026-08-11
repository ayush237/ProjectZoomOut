/**
 * Errors typed off the backend's error **codes**, never its messages.
 *
 * The backend returns `{ error: { code, message, ...fields } }`, and `code` is
 * documented as stable and safe to branch on. Messages are copy — they get reworded,
 * and a client that matches on them breaks silently the first time someone improves
 * the wording. So nothing in this app reads `message` except to display it.
 */

/** Codes the app branches on. Anything else is handled generically. */
export const ApiErrorCode = {
  invalidCredentials: 'INVALID_CREDENTIALS',
  invalidToken: 'INVALID_TOKEN',
  invalidRefreshToken: 'INVALID_REFRESH_TOKEN',
  refreshTokenReuse: 'REFRESH_TOKEN_REUSE',
  belowMinimumAge: 'BELOW_MINIMUM_AGE',
  emailAlreadyRegistered: 'EMAIL_ALREADY_REGISTERED',
  unverifiedEmailCollision: 'UNVERIFIED_EMAIL_COLLISION',
  invalidProviderToken: 'INVALID_PROVIDER_TOKEN',
  providerEmailMissing: 'PROVIDER_EMAIL_MISSING',
  signupDetailsRequired: 'SIGNUP_DETAILS_REQUIRED',
  invalidRequest: 'INVALID_REQUEST',
  notFound: 'NOT_FOUND',
  forbidden: 'FORBIDDEN',
} as const;

export type ApiErrorCodeValue = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/** A structured error response from the backend. */
export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  /** Extra fields the backend chose to expose, e.g. `missingFields`. */
  public readonly fields: Readonly<Record<string, unknown>>;

  constructor(options: {
    code: string;
    message: string;
    status: number;
    fields?: Record<string, unknown>;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.fields = options.fields ?? {};
  }

  public is(code: ApiErrorCodeValue): boolean {
    return this.code === code;
  }

  /**
   * The fields a `SIGNUP_DETAILS_REQUIRED` response says are missing.
   *
   * Returns an empty list for any other error, so a caller can route on it without
   * first checking the code twice.
   */
  public get missingFields(): readonly string[] {
    const raw = this.fields['missingFields'];

    return Array.isArray(raw) ? raw.filter((field): field is string => typeof field === 'string') : [];
  }
}

/**
 * The request never reached the backend, or its answer was unreadable.
 *
 * Kept distinct from `ApiError` because the recoveries differ: an offline device
 * should be told to try again, while a 400 means the request itself was wrong and
 * retrying it unchanged will fail identically.
 */
export class NetworkError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Could not reach ZoomOut. Check your connection and try again.', options);
    this.name = 'NetworkError';
  }
}

/**
 * The session ended and could not be renewed.
 *
 * Raised once, by the refresh path, after local credentials have already been cleared.
 * Anything catching it should route to sign-in rather than retry — a retry is what
 * turns an expired session into a refresh loop.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.');
    this.name = 'SessionExpiredError';
  }
}
