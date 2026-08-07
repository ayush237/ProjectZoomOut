/**
 * What to do when someone arrives with a social identity.
 *
 * The rule is one user per email address (ruled 2026-08-07). The awkward case is a
 * reader who signed up with a password and later taps "Sign in with Google" using the
 * same address. Two wrong answers are available and both are taken by real products:
 *
 *  - Create a second account. The reader loses their streak and library and cannot
 *    work out why, and support cannot merge them afterwards.
 *  - Merge on the strength of whatever email the provider sent. That is account
 *    takeover: anyone who can get a provider to emit an unverified address of their
 *    choosing inherits the existing account.
 *
 * So: link only when the provider *asserts the email is verified*, and otherwise
 * refuse and say why. Kept as a pure function over facts already looked up, so the
 * whole table can be tested without a database.
 */

export interface SocialIdentityFacts {
  /** User already bound to this exact (provider, subject) pair, if any. */
  readonly userIdForProviderSubject: string | null;
  /** User already holding this email address, if any. */
  readonly userIdForEmail: string | null;
  /** Whether the provider claims to have verified the address itself. */
  readonly emailVerifiedByProvider: boolean;
}

export type AccountLinkDecision =
  /** Known identity — an ordinary returning sign-in. */
  | { readonly kind: 'sign-in'; readonly userId: string }
  /** New identity for a reader we already know, and the provider vouches for the email. */
  | { readonly kind: 'link'; readonly userId: string }
  /** Nobody holds this email; create the reader and the identity together. */
  | { readonly kind: 'create' }
  /** Refuse, with a reason the client can turn into something actionable. */
  | { readonly kind: 'reject'; readonly reason: 'unverified-email-collision' };

export function decideAccountLink(facts: SocialIdentityFacts): AccountLinkDecision {
  // Known subject wins outright. The provider's `sub` is the stable identifier; the
  // email on the token may have changed since signup and must not be consulted here.
  if (facts.userIdForProviderSubject !== null) {
    return { kind: 'sign-in', userId: facts.userIdForProviderSubject };
  }

  if (facts.userIdForEmail === null) {
    return { kind: 'create' };
  }

  if (!facts.emailVerifiedByProvider) {
    return { kind: 'reject', reason: 'unverified-email-collision' };
  }

  return { kind: 'link', userId: facts.userIdForEmail };
}
