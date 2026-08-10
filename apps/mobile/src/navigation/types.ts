/**
 * Navigation shapes.
 *
 * Kept in their own module so screens can type their props without importing the
 * navigators, which would make every screen a cycle back to the tree that renders it.
 */

export interface EmailSignUpDraft {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  /**
   * The age gate, shared by both paths.
   *
   * A draft means an email signup carrying the fields collected so far. **Undefined
   * means a social signup** the backend paused for missing details — the provider token
   * is already held in `AuthProvider`, so the screen needs nothing but the date.
   *
   * One screen rather than two because the age gate is not an email-signup step; it is
   * a compliance boundary every new account crosses, and Apple and Google supply
   * neither a date of birth nor a timezone.
   */
  AgeGate: EmailSignUpDraft | undefined;
  AgeRefused: undefined;
  ProviderEmailMissing: undefined;
};

export type TabParamList = {
  Profile: undefined;
  Explore: undefined;
  Library: undefined;
  Journey: undefined;
};
