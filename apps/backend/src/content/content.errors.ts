import { AppError } from '../errors.js';

/**
 * Failures at the CMS boundary.
 *
 * The distinction that matters here is *whose fault it is*. Payload being unreachable
 * is our infrastructure failing and surfaces as a 503 the client can retry. A document
 * that fails domain validation is a content defect — it must never reach a reader, and
 * it must be loud in the logs, because the CMS accepted something our own invariants
 * reject and somebody needs to fix the content.
 */

/** Payload could not be reached, timed out, or answered with an error status. */
export class ContentUnavailableError extends AppError {
  public readonly statusCode = 503;
  public readonly code = 'CONTENT_UNAVAILABLE';

  constructor(options?: { cause?: unknown }) {
    // Deliberately says nothing about Payload, its URL, or the underlying error.
    // A client cannot act on any of that, and a stack trace here would leak the
    // internal topology of the deployment.
    super('Content is temporarily unavailable. Please try again.', options);
  }
}

/**
 * A CMS document does not satisfy the domain model.
 *
 * Surfaced as a 502 rather than a 500: the backend is working correctly and refusing
 * to serve something an upstream system produced. The reader sees a generic message;
 * the detail goes to the log, where it is actionable.
 *
 * This is the two-gate design doing its job. `packages/shared` and the CMS enforce the
 * same invariants independently, and when they disagree the content does not ship.
 */
export class ContentInvalidError extends AppError {
  public readonly statusCode = 502;
  public readonly code = 'CONTENT_INVALID';

  /** Human-readable reasons, for the log — never returned to the client. */
  public readonly reasons: readonly string[];

  constructor(reasons: readonly string[], options?: { cause?: unknown }) {
    super('This content is unavailable.', options);
    this.reasons = reasons;
  }
}

/** No published content exists with that identifier. */
export class ContentNotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly code = 'CONTENT_NOT_FOUND';

  constructor(what: string) {
    super(`${what} was not found`);
  }
}
