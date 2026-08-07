import { describe, expect, it } from 'vitest';

import { decideAccountLink, type SocialIdentityFacts } from './accountLinking.js';

/**
 * The full decision table. Every combination of the three inputs is covered, because
 * the wrong answer in one cell is either a duplicate account or an account takeover.
 */

const facts = (overrides: Partial<SocialIdentityFacts> = {}): SocialIdentityFacts => ({
  userIdForProviderSubject: null,
  userIdForEmail: null,
  emailVerifiedByProvider: false,
  ...overrides,
});

describe('decideAccountLink', () => {
  describe('known provider subject', () => {
    it('signs in, regardless of the email verification claim', () => {
      for (const emailVerifiedByProvider of [true, false]) {
        const decision = decideAccountLink(
          facts({ userIdForProviderSubject: 'user-1', emailVerifiedByProvider }),
        );

        expect(decision).toEqual({ kind: 'sign-in', userId: 'user-1' });
      }
    });

    it('signs in even when the email now belongs to a different user', () => {
      // Providers allow address changes. The subject is the identity; the email is not.
      const decision = decideAccountLink(
        facts({
          userIdForProviderSubject: 'user-1',
          userIdForEmail: 'user-2',
          emailVerifiedByProvider: true,
        }),
      );

      expect(decision).toEqual({ kind: 'sign-in', userId: 'user-1' });
    });
  });

  describe('unknown provider subject, no user with that email', () => {
    it('creates when the provider verified the email', () => {
      expect(decideAccountLink(facts({ emailVerifiedByProvider: true }))).toEqual({
        kind: 'create',
      });
    });

    it('creates when the provider did not verify the email', () => {
      // No collision, so nothing to take over — an unverified address is only
      // dangerous when it can be used to reach an account that already exists.
      expect(decideAccountLink(facts({ emailVerifiedByProvider: false }))).toEqual({
        kind: 'create',
      });
    });
  });

  describe('unknown provider subject, email already taken', () => {
    it('links to the existing user when the provider verified the email', () => {
      const decision = decideAccountLink(
        facts({ userIdForEmail: 'user-1', emailVerifiedByProvider: true }),
      );

      expect(decision).toEqual({ kind: 'link', userId: 'user-1' });
    });

    it('refuses when the provider did not verify the email', () => {
      const decision = decideAccountLink(
        facts({ userIdForEmail: 'user-1', emailVerifiedByProvider: false }),
      );

      expect(decision).toEqual({ kind: 'reject', reason: 'unverified-email-collision' });
    });

    it('never silently creates a second account for the same address', () => {
      for (const emailVerifiedByProvider of [true, false]) {
        const decision = decideAccountLink(
          facts({ userIdForEmail: 'user-1', emailVerifiedByProvider }),
        );

        expect(decision.kind).not.toBe('create');
      }
    });
  });

  it('covers all eight input combinations without falling through', () => {
    const outcomes = new Set<string>();

    for (const subject of [null, 'user-1']) {
      for (const email of [null, 'user-2']) {
        for (const verified of [true, false]) {
          const decision = decideAccountLink({
            userIdForProviderSubject: subject,
            userIdForEmail: email,
            emailVerifiedByProvider: verified,
          });

          expect(decision.kind).toBeDefined();
          outcomes.add(decision.kind);
        }
      }
    }

    expect([...outcomes].sort()).toEqual(['create', 'link', 'reject', 'sign-in']);
  });
});
