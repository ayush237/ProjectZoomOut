import type { AuthProvider } from '@zoomout/shared';
import { describe, expect, it } from 'vitest';

import type { UserRow } from '../db/schema.js';
import { toDomainUser } from './user.mapper.js';

/**
 * These tests double as the proof that `packages/shared` is genuinely consumed by the
 * backend at both compile time and runtime — `User` is the shared type, and the
 * validation below runs the shared schemas.
 */

const buildRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  email: 'reader@example.test',
  displayName: 'Test Reader',
  dateOfBirth: '1994-03-17',
  timezone: 'Europe/London',
  emailVerifiedAt: null,
  createdAt: new Date('2026-08-07T12:00:00.000Z'),
  updatedAt: new Date('2026-08-07T12:00:00.000Z'),
  ...overrides,
});

const PROVIDERS: AuthProvider[] = ['email'];

describe('toDomainUser', () => {
  it('maps a valid row to the domain shape', () => {
    expect(toDomainUser(buildRow(), PROVIDERS)).toEqual({
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      email: 'reader@example.test',
      authProviders: ['email'],
      displayName: 'Test Reader',
      dateOfBirth: '1994-03-17',
      timezone: 'Europe/London',
      createdAt: '2026-08-07T12:00:00.000Z',
      updatedAt: '2026-08-07T12:00:00.000Z',
    });
  });

  it('returns a complete User, closing the WP0 authProviders gap', () => {
    const user = toDomainUser(buildRow(), ['email', 'google']);

    expect(user.authProviders).toEqual(['email', 'google']);
  });

  it('serialises timestamps as ISO strings, not Date objects', () => {
    expect(typeof toDomainUser(buildRow(), PROVIDERS).createdAt).toBe('string');
  });

  it('preserves the birth date exactly, with no timezone drift', () => {
    expect(toDomainUser(buildRow({ dateOfBirth: '2000-01-01' }), PROVIDERS).dateOfBirth).toBe(
      '2000-01-01',
    );
  });

  it('rejects a row whose birth date is not a real calendar date', () => {
    expect(() => toDomainUser(buildRow({ dateOfBirth: '1994-02-30' }), PROVIDERS)).toThrow();
  });

  it('rejects a row whose timezone is not a known IANA identifier', () => {
    expect(() => toDomainUser(buildRow({ timezone: 'Not/AZone' }), PROVIDERS)).toThrow();
  });

  it('rejects a row whose timezone is a bare UTC offset', () => {
    // A frozen offset breaks local-midnight rollover the moment DST shifts.
    expect(() => toDomainUser(buildRow({ timezone: '+05:30' }), PROVIDERS)).toThrow();
  });

  it('rejects a row with a malformed email', () => {
    expect(() => toDomainUser(buildRow({ email: 'not-an-email' }), PROVIDERS)).toThrow();
  });

  it('rejects a user with no identities, which should be impossible', () => {
    // `createUserWithIdentity` writes both in one transaction, so a user with zero
    // providers is a corrupt row and should fail loudly rather than be rendered.
    expect(() => toDomainUser(buildRow(), [])).toThrow();
  });

  it('does not leak email verification state into the profile payload', () => {
    expect(toDomainUser(buildRow({ emailVerifiedAt: new Date() }), PROVIDERS)).not.toHaveProperty(
      'emailVerifiedAt',
    );
  });
});
