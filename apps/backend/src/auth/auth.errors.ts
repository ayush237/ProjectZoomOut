import { AppError } from '../errors.js';

/**
 * Authentication failures.
 *
 * All extend the existing `AppError`, so the app-wide error handler already knows how
 * to render them and no parallel hierarchy exists to drift.
 *
 * The messages are written for a client to display. None of them reveals whether an
 * account exists — see `InvalidCredentialsError`.
 */

/**
 * Wrong email, wrong password, or no such account — deliberately indistinguishable.
 *
 * A distinct "no such user" response turns the login endpoint into a membership
 * oracle: an attacker learns which addresses are registered and can target them
 * elsewhere. The service also equalises timing, because a fast rejection leaks the
 * same fact that a different message would.
 */
export class InvalidCredentialsError extends AppError {
  public readonly statusCode = 401;
  public readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Email or password is incorrect');
  }
}

/** The access token is missing, malformed, expired, or not signed by us. */
export class InvalidTokenError extends AppError {
  public readonly statusCode = 401;
  public readonly code = 'INVALID_TOKEN';

  constructor(options?: { cause?: unknown }) {
    super('Authentication token is missing or invalid', options);
  }
}

/** The refresh token is unknown, expired, or already revoked. */
export class InvalidRefreshTokenError extends AppError {
  public readonly statusCode = 401;
  public readonly code = 'INVALID_REFRESH_TOKEN';

  constructor() {
    super('Session has expired. Please sign in again.');
  }
}

/**
 * A refresh token that had already been rotated was presented again.
 *
 * Either a stolen token is being replayed, or a legitimate client raced itself. Both
 * are handled the same way — revoke the entire family — because there is no way to
 * tell them apart, and the safe failure is to end the session.
 */
export class RefreshTokenReuseError extends AppError {
  public readonly statusCode = 401;
  public readonly code = 'REFRESH_TOKEN_REUSE';

  constructor() {
    super('Session has been revoked for security reasons. Please sign in again.');
  }
}

/** Signup refused by the age gate. */
export class BelowMinimumAgeError extends AppError {
  public readonly statusCode = 403;
  public readonly code = 'BELOW_MINIMUM_AGE';

  constructor(minimumAgeYears: number) {
    // Non-punitive on purpose: this is a compliance boundary, not a user failure.
    super(`ZoomOut is available to people aged ${String(minimumAgeYears)} and over.`);
  }
}

/** An account already exists for this email address. */
export class EmailAlreadyRegisteredError extends AppError {
  public readonly statusCode = 409;
  public readonly code = 'EMAIL_ALREADY_REGISTERED';

  constructor() {
    super('An account already exists for this email address. Try signing in instead.');
  }
}

/**
 * A social identity arrived carrying an email that belongs to someone else, and the
 * provider would not vouch for it.
 *
 * Refusing is the point: linking on an unverified claim is account takeover.
 */
export class UnverifiedEmailCollisionError extends AppError {
  public readonly statusCode = 409;
  public readonly code = 'UNVERIFIED_EMAIL_COLLISION';

  constructor() {
    super(
      'An account already exists for this email address, and your provider did not ' +
        'confirm you own it. Sign in with your password, then link this provider from ' +
        'your profile.',
    );
  }
}

/** A provider ID token failed signature, issuer, audience, or expiry verification. */
export class InvalidProviderTokenError extends AppError {
  public readonly statusCode = 401;
  public readonly code = 'INVALID_PROVIDER_TOKEN';

  constructor(options?: { cause?: unknown }) {
    super('Could not verify your sign-in with that provider', options);
  }
}

/**
 * The provider verified the identity but returned no usable email address.
 *
 * Unrecoverable in the app: the reader has to change something at Apple or Google, or
 * sign up with a password instead. Kept distinct from `SignupDetailsRequiredError`
 * below because the two need opposite client responses, and WP2 conflated them.
 */
export class ProviderEmailMissingError extends AppError {
  public readonly statusCode = 400;
  public readonly code = 'PROVIDER_EMAIL_MISSING';

  constructor() {
    super(
      'Your provider did not share an email address, which ZoomOut needs to create an ' +
        'account. Try signing up with an email address and password instead.',
    );
  }
}

/**
 * A first-time social signup arrived without the details only the reader can supply.
 *
 * Apple and Google return an identity and an email; neither returns a date of birth
 * or a timezone, and the age gate cannot be skipped. Entirely recoverable — the
 * client collects the missing fields and retries with the same ID token.
 *
 * `missingFields` is part of the contract, so WP6 can jump straight to the right
 * input rather than showing a generic form.
 */
export class SignupDetailsRequiredError extends AppError {
  public readonly statusCode = 400;
  public readonly code = 'SIGNUP_DETAILS_REQUIRED';

  public readonly missingFields: readonly string[];

  constructor(missingFields: readonly string[]) {
    super(
      `ZoomOut needs a little more to finish creating your account: ${missingFields.join(' and ')}.`,
    );
    this.missingFields = missingFields;
  }
}

/** The caller is authenticated but is not allowed to touch this resource. */
export class ForbiddenError extends AppError {
  public readonly statusCode = 403;
  public readonly code = 'FORBIDDEN';

  constructor() {
    super('You do not have access to this resource');
  }
}

/** The requested resource does not exist. */
export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly code = 'NOT_FOUND';

  constructor(message = 'Not found') {
    super(message);
  }
}
