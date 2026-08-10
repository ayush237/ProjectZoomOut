/**
 * Typed error hierarchy for the backend.
 *
 * Every error the application raises deliberately extends `AppError` and carries the
 * HTTP status and stable machine-readable code it should surface as. That keeps the
 * mapping out of individual handlers and makes "what does the client see" a property
 * of the error rather than of whoever caught it.
 *
 * Anything that is *not* an `AppError` reaching the error handler is by definition
 * unexpected, and is reported as a generic 500 with its detail kept server-side.
 */

export abstract class AppError extends Error {
  /** HTTP status this error surfaces as. */
  public abstract readonly statusCode: number;

  /** Stable machine-readable code. Safe to expose and to branch on in clients. */
  public abstract readonly code: string;

  /**
   * Extra fields to include in the error response, beside `code` and `message`.
   *
   * Empty by default, because the safe direction is for an error to reveal nothing it
   * was not deliberately designed to reveal — `ContentInvalidError.reasons` names CMS
   * fields, and a blanket "serialise everything public" rule would have leaked them.
   *
   * An error opts in by overriding this, and whatever it returns is **client-visible**.
   * Nothing internal belongs here.
   */
  public get responseFields(): Record<string, unknown> {
    return {};
  }

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The database could not be reached or did not answer in time. */
export class DatabaseUnavailableError extends AppError {
  public readonly statusCode = 503;
  public readonly code = 'DATABASE_UNAVAILABLE';

  constructor(options?: { cause?: unknown }) {
    super('The database is unavailable', options);
  }
}

/**
 * Narrows an unknown caught value to `Error`.
 *
 * `catch` binds `unknown`, and passing a raw unknown to a logger loses the stack.
 * This keeps the original value when it is already an `Error` and wraps it otherwise,
 * so nothing is discarded on the way to the log.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }

  return new Error(`Non-Error value thrown: ${JSON.stringify(value)}`);
}
