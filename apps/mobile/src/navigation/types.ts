/**
 * Navigation shapes.
 *
 * Kept in their own module so screens can type their props without importing the
 * navigators, which would make every screen a cycle back to the tree that renders it.
 */

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  /**
   * The age gate, shared by both signup paths.
   *
   * **Carries which path it is on, and nothing else.** It used to take the whole email
   * signup draft, which put a plaintext password into React Navigation's serialisable
   * navigation state — inert until state persistence or crash reporting is switched on,
   * and a credential leak the moment either is. The draft now lives in
   * `SignUpDraftProvider`; only this discriminator travels, and it is safe to persist.
   *
   * One screen rather than two because the age gate is not an email-signup step: it is
   * a compliance boundary every new account crosses, and Apple and Google supply
   * neither a date of birth nor a timezone.
   */
  AgeGate: { readonly mode: 'email' | 'social' };
  AgeRefused: undefined;
  ProviderEmailMissing: undefined;
};

export type TabParamList = {
  Profile: undefined;
  Explore: undefined;
  Library: undefined;
  Journey: undefined;
};
