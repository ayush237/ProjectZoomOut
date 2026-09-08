import {
  MAXIMUM_DISPLAY_NAME_LENGTH,
  MAXIMUM_PASSWORD_LENGTH,
  MINIMUM_PASSWORD_LENGTH,
  displayNameError,
  emailError,
  passwordError,
} from './signUpValidation';

/**
 * Mirrors `apps/backend/src/auth/auth.routes.ts`'s `signUpBodySchema`. These tests exist
 * to prove the mirror is exact, not merely close — see `signUpValidation.ts`'s docstring
 * for the bug this replaces (`includes('@')`, no password ceiling).
 */

describe('displayNameError', () => {
  it('rejects an empty name', () => {
    expect(displayNameError('')).toBe('Tell us what to call you.');
  });

  it('rejects a name that is only whitespace', () => {
    expect(displayNameError('   ')).toBe('Tell us what to call you.');
  });

  it('accepts an ordinary name', () => {
    expect(displayNameError('Ada Lovelace')).toBeUndefined();
  });

  it('accepts exactly the maximum length', () => {
    expect(displayNameError('a'.repeat(MAXIMUM_DISPLAY_NAME_LENGTH))).toBeUndefined();
  });

  it('rejects one character past the maximum', () => {
    expect(displayNameError('a'.repeat(MAXIMUM_DISPLAY_NAME_LENGTH + 1))).toBe(
      `Keep it under ${String(MAXIMUM_DISPLAY_NAME_LENGTH)} characters.`,
    );
  });

  it('trims before measuring, matching the backend’s z.string().trim()', () => {
    const padded = ` ${'a'.repeat(MAXIMUM_DISPLAY_NAME_LENGTH)} `;
    expect(displayNameError(padded)).toBeUndefined();
  });
});

describe('emailError', () => {
  it('accepts an ordinary email', () => {
    expect(emailError('reader@example.com')).toBeUndefined();
  });

  it('rejects a value with no "@" at all', () => {
    expect(emailError('reader-example.com')).toBeDefined();
  });

  it('rejects an email with no top-level domain — the bug this closes', () => {
    // `includes('@')` accepted this and let it through to the age-gate screen, where the
    // backend's real rejection surfaced as an unrelated-looking "Request body is invalid".
    expect(emailError('reader@example')).toBe('That does not look like an email address.');
  });

  it('rejects a value with no local part', () => {
    expect(emailError('@example.com')).toBeDefined();
  });

  it('rejects consecutive dots in the local part', () => {
    expect(emailError('reader..name@example.com')).toBeDefined();
  });

  it('rejects a local part starting with a dot', () => {
    expect(emailError('.reader@example.com')).toBeDefined();
  });

  it('trims surrounding whitespace before checking shape', () => {
    // What the app actually sends is trimmed (`SignInScreen`, `SignUpScreen`), so this is
    // validating what will really be submitted, not the raw field value.
    expect(emailError('  reader@example.com  ')).toBeUndefined();
  });

  it('places no length ceiling on email, matching the backend’s bare z.email()', () => {
    // A ceiling here would be exactly the kind of approximation this module exists to
    // avoid — the backend truly has none, so neither does this.
    const longLocalPart = `${'a'.repeat(300)}@example.com`;
    expect(emailError(longLocalPart)).toBeUndefined();
  });
});

describe('passwordError', () => {
  it('rejects one character short of the minimum', () => {
    expect(passwordError('a'.repeat(MINIMUM_PASSWORD_LENGTH - 1))).toBe(
      `Use at least ${String(MINIMUM_PASSWORD_LENGTH)} characters.`,
    );
  });

  it('accepts exactly the minimum', () => {
    expect(passwordError('a'.repeat(MINIMUM_PASSWORD_LENGTH))).toBeUndefined();
  });

  it('accepts exactly the maximum', () => {
    expect(passwordError('a'.repeat(MAXIMUM_PASSWORD_LENGTH))).toBeUndefined();
  });

  it('rejects one character past the maximum — the ceiling the old check never had', () => {
    expect(passwordError('a'.repeat(MAXIMUM_PASSWORD_LENGTH + 1))).toBe(
      `Use at most ${String(MAXIMUM_PASSWORD_LENGTH)} characters.`,
    );
  });

  it('does not trim — the backend checks the raw string, not a trimmed one', () => {
    // Surprising but correct: a 12-space password is valid by `passwordSchema`'s own
    // rule. Trimming here would be this app inventing a stricter rule than the server's.
    expect(passwordError(' '.repeat(MINIMUM_PASSWORD_LENGTH))).toBeUndefined();
  });
});
