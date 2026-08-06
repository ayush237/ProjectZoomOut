import { describe, expect, it } from 'vitest';

import type { UserRow } from '../db/schema.js';
import { toDomainUser } from './user.mapper.js';

/**
 * These tests double as the proof that `packages/shared` is genuinely consumed by the
 * backend at both compile time and runtime — `PersistedUser` is derived from the
 * shared `User`, and the validation below runs the shared schemas.
 */

const buildRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  email: 'reader@example.test',
  displayName: 'Test Reader',
  dateOfBirth: '1994-03-17',
  timezone: 'Europe/London',
  createdAt: new Date('2026-08-06T12:00:00.000Z'),
  updatedAt: new Date('2026-08-06T12:00:00.000Z'),
  ...overrides,
});

describe('toDomainUser', () => {
  it('maps a valid row to the domain shape', () => {
    const user = toDomainUser(buildRow());

    expect(user).toEqual({
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      email: 'reader@example.test',
      displayName: 'Test Reader',
      dateOfBirth: '1994-03-17',
      timezone: 'Europe/London',
      createdAt: '2026-08-06T12:00:00.000Z',
      updatedAt: '2026-08-06T12:00:00.000Z',
    });
  });

  it('serialises timestamps as ISO strings, not Date objects', () => {
    const user = toDomainUser(buildRow());

    expect(typeof user.createdAt).toBe('string');
  });

  it('preserves the birth date exactly, with no timezone drift', () => {
    const user = toDomainUser(buildRow({ dateOfBirth: '2000-01-01' }));

    expect(user.dateOfBirth).toBe('2000-01-01');
  });

  it('rejects a row whose birth date is not a real calendar date', () => {
    expect(() => toDomainUser(buildRow({ dateOfBirth: '1994-02-30' }))).toThrow();
  });

  it('rejects a row whose timezone is not a known IANA identifier', () => {
    expect(() => toDomainUser(buildRow({ timezone: 'Not/AZone' }))).toThrow();
  });

  it('rejects a row with a malformed email', () => {
    expect(() => toDomainUser(buildRow({ email: 'not-an-email' }))).toThrow();
  });

  it('does not invent authProviders that were never persisted', () => {
    expect(toDomainUser(buildRow())).not.toHaveProperty('authProviders');
  });
});
