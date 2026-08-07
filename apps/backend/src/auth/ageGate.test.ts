import { describe, expect, it } from 'vitest';

import { calculateAgeInYears, localDateIn, meetsAgeThreshold } from './ageGate.js';

/**
 * The gate is a compliance boundary, so the boundary itself is what gets tested:
 * exactly the threshold, one day either side, and the leap-year birthday that breaks
 * naive implementations.
 */

describe('calculateAgeInYears', () => {
  it('counts a completed year', () => {
    expect(calculateAgeInYears('2000-01-01', '2013-01-01')).toBe(13);
  });

  it('does not count the year before the birthday falls', () => {
    expect(calculateAgeInYears('2000-06-15', '2013-06-14')).toBe(12);
  });

  it('counts the year on the birthday itself', () => {
    expect(calculateAgeInYears('2000-06-15', '2013-06-15')).toBe(13);
  });

  it('counts the year the day after the birthday', () => {
    expect(calculateAgeInYears('2000-06-15', '2013-06-16')).toBe(13);
  });

  it('handles a birthday later in the same month', () => {
    expect(calculateAgeInYears('2000-06-30', '2013-06-01')).toBe(12);
  });

  it('handles a birthday in a later month', () => {
    expect(calculateAgeInYears('2000-12-31', '2013-01-01')).toBe(12);
  });

  it('returns 0 for someone born today', () => {
    expect(calculateAgeInYears('2026-08-07', '2026-08-07')).toBe(0);
  });

  it('returns a negative age for a birth date in the future', () => {
    expect(calculateAgeInYears('2030-01-01', '2026-08-07')).toBeLessThan(0);
  });

  describe('leap-year birthdays', () => {
    it('treats 29 February as not yet reached on 28 February in a non-leap year', () => {
      expect(calculateAgeInYears('2008-02-29', '2021-02-28')).toBe(12);
    });

    it('treats 29 February as reached on 1 March in a non-leap year', () => {
      expect(calculateAgeInYears('2008-02-29', '2021-03-01')).toBe(13);
    });

    it('counts the birthday on 29 February in a leap year', () => {
      expect(calculateAgeInYears('2008-02-29', '2024-02-29')).toBe(16);
    });
  });

  it('treats the boundary identically at both ends of the calendar year', () => {
    // Regression guard for the timezone bug this function exists to avoid. An
    // implementation built on `new Date('2013-01-01')` parses as midnight UTC, which
    // is the previous calendar day anywhere west of Greenwich — so the two dates most
    // exposed to that error are the first and last of the year.
    expect(calculateAgeInYears('2013-01-01', '2026-01-01')).toBe(13);
    expect(calculateAgeInYears('2013-12-31', '2026-12-31')).toBe(13);
    expect(calculateAgeInYears('2013-01-01', '2025-12-31')).toBe(12);
  });
});

describe('meetsAgeThreshold', () => {
  const THRESHOLD = 13;

  it('admits someone a day past the threshold birthday', () => {
    expect(meetsAgeThreshold('2013-08-06', THRESHOLD, '2026-08-07')).toBe(true);
  });

  it('admits someone exactly on their threshold birthday', () => {
    expect(meetsAgeThreshold('2013-08-07', THRESHOLD, '2026-08-07')).toBe(true);
  });

  it('refuses someone a day short of the threshold birthday', () => {
    expect(meetsAgeThreshold('2013-08-08', THRESHOLD, '2026-08-07')).toBe(false);
  });

  it('refuses a birth date in the future', () => {
    expect(meetsAgeThreshold('2030-01-01', THRESHOLD, '2026-08-07')).toBe(false);
  });

  it('admits comfortably older readers', () => {
    expect(meetsAgeThreshold('1990-01-01', THRESHOLD, '2026-08-07')).toBe(true);
  });

  it('changes outcome with the threshold alone, not with code', () => {
    // The legal answer is undecided (LEGAL.md). This is the property that keeps the
    // eventual decision an environment change.
    const dateOfBirth = '2010-08-07'; // exactly 16 on the reference date
    const today = '2026-08-07';

    expect(meetsAgeThreshold(dateOfBirth, 13, today)).toBe(true);
    expect(meetsAgeThreshold(dateOfBirth, 16, today)).toBe(true);
    expect(meetsAgeThreshold(dateOfBirth, 17, today)).toBe(false);
    expect(meetsAgeThreshold(dateOfBirth, 18, today)).toBe(false);
  });
});

describe('localDateIn', () => {
  it('returns YYYY-MM-DD', () => {
    expect(localDateIn('UTC', new Date('2026-08-07T12:00:00Z'))).toBe('2026-08-07');
  });

  it('resolves the local date, not the UTC one, east of Greenwich', () => {
    // 23:30 UTC is already tomorrow in Auckland.
    expect(localDateIn('Pacific/Auckland', new Date('2026-08-07T23:30:00Z'))).toBe('2026-08-08');
  });

  it('resolves the local date, not the UTC one, west of Greenwich', () => {
    // 00:30 UTC is still yesterday in Los Angeles.
    expect(localDateIn('America/Los_Angeles', new Date('2026-08-07T00:30:00Z'))).toBe('2026-08-06');
  });
});
