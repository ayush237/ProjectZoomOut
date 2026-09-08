/**
 * Sign-up field validation, mirrored from the backend's schema.
 *
 * **UX only, same as `ageGate.ts`.** `apps/backend/src/auth/auth.routes.ts`'s
 * `signUpBodySchema` is the control; a rejection here only means the server hasn't been
 * asked yet. Before this module existed, `SignUpScreen` checked email with
 * `includes('@')` and never checked a password ceiling at all, so a reader could clear
 * every client-side check and still have the server refuse them at the age-gate screen
 * — after entering a date of birth — with a bare "Request body is invalid". Approximating
 * the server's rules is how that happened; these mirror them exactly instead.
 */

/**
 * Zod v4's built-in `z.email()` pattern, copied rather than imported.
 *
 * `signUpBodySchema` lives in `apps/backend`, out of this workspace's reach, so there is
 * nothing to import — and the backend places no length bound on email at all, only this
 * shape (`node_modules/zod/v4/core/regexes.js`). If the backend's email rule ever
 * changes, this drifts silently; there is no test that can catch that from this side.
 */
const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

/** `auth.routes.ts`'s `signUpBodySchema.displayName`: `z.string().trim().min(1).max(80)`. */
export const MAXIMUM_DISPLAY_NAME_LENGTH = 80;

/** `auth.routes.ts`'s `passwordSchema`: NIST 800-63B length-only, no composition rules. */
export const MINIMUM_PASSWORD_LENGTH = 12;
export const MAXIMUM_PASSWORD_LENGTH = 256;

/** Trims the way the backend's `.trim()` does before checking length. */
export function displayNameError(value: string): string | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return 'Tell us what to call you.';
  }
  if (trimmed.length > MAXIMUM_DISPLAY_NAME_LENGTH) {
    return `Keep it under ${String(MAXIMUM_DISPLAY_NAME_LENGTH)} characters.`;
  }
  return undefined;
}

/**
 * Trims before checking shape: the app sends a trimmed email on every path
 * (`SignInScreen`, `SignUpScreen`), and the backend's own schema does not trim, so a
 * value that is valid only once trimmed is exactly what this app is about to send.
 */
export function emailError(value: string): string | undefined {
  if (!EMAIL_PATTERN.test(value.trim())) {
    return 'That does not look like an email address.';
  }
  return undefined;
}

/** Not trimmed: the backend's `passwordSchema` checks the raw string, and a password's
 * leading or trailing character is not this app's business to discard. */
export function passwordError(value: string): string | undefined {
  if (value.length < MINIMUM_PASSWORD_LENGTH) {
    return `Use at least ${String(MINIMUM_PASSWORD_LENGTH)} characters.`;
  }
  if (value.length > MAXIMUM_PASSWORD_LENGTH) {
    return `Use at most ${String(MAXIMUM_PASSWORD_LENGTH)} characters.`;
  }
  return undefined;
}
