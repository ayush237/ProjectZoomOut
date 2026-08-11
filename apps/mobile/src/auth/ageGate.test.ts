import {
  calculateAgeInYears,
  deviceTimezone,
  isCalendarDate,
  meetsAssumedAgeThreshold,
} from './ageGate';

/**
 * The client-side age check.
 *
 * Worth restating because it shapes what these tests are for: this check is **UX only**.
 * The server decides. These tests protect the reader's experience of the form — being
 * told early, and not being wrongly refused at a boundary — not the compliance
 * boundary itself, which is asserted in the backend's own suite.
 */

describe('calculateAgeInYears', () => {
  it('counts a birthday that has already passed this year', () => {
    expect(calculateAgeInYears('1994-03-17', '2026-08-10')).toBe(32);
  });

  it('does not count a birthday still to come this year', () => {
    expect(calculateAgeInYears('1994-12-25', '2026-08-10')).toBe(31);
  });

  it('counts the birthday itself', () => {
    expect(calculateAgeInYears('2013-08-10', '2026-08-10')).toBe(13);
  });

  it('does not count the day before the birthday', () => {
    expect(calculateAgeInYears('2013-08-11', '2026-08-10')).toBe(12);
  });

  it('handles a leap-day birth date', () => {
    expect(calculateAgeInYears('2012-02-29', '2026-02-28')).toBe(13);
    expect(calculateAgeInYears('2012-02-29', '2026-03-01')).toBe(14);
  });

  it('returns a negative age for a future date', () => {
    expect(calculateAgeInYears('2030-01-01', '2026-08-10')).toBeLessThan(0);
  });
});

describe('meetsAssumedAgeThreshold', () => {
  it('admits someone who turns the threshold age today', () => {
    // Inclusive at the boundary. The alternative refuses a legitimate signup for a day.
    expect(meetsAssumedAgeThreshold('2013-08-10', 13, '2026-08-10')).toBe(true);
  });

  it('refuses someone one day short', () => {
    expect(meetsAssumedAgeThreshold('2013-08-11', 13, '2026-08-10')).toBe(false);
  });

  it('refuses a date of birth in the future', () => {
    // A typo or a probe; neither should reach the server as a signup attempt.
    expect(meetsAssumedAgeThreshold('2030-01-01', 13, '2026-08-10')).toBe(false);
  });

  it('moves with the threshold it is given', () => {
    // The legal answer is undecided (LEGAL.md) and the backend exposes it as config.
    // The client must not bake in a number the server can disagree with.
    expect(meetsAssumedAgeThreshold('2010-01-01', 13, '2026-08-10')).toBe(true);
    expect(meetsAssumedAgeThreshold('2010-01-01', 18, '2026-08-10')).toBe(false);
  });
});

describe('isCalendarDate', () => {
  it.each(['2026-08-10', '2012-02-29', '2000-01-01'])('accepts %s', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-8-10', '10/08/2026', '', 'yesterday'])(
    'rejects %s',
    (value) => {
      expect(isCalendarDate(value)).toBe(false);
    },
  );
});

describe('deviceTimezone', () => {
  it('returns the IANA zone the device reports', () => {
    // Never presented as an input: the reader is not a timezone database, and the
    // device already knows. Sent silently with signup.
    expect(deviceTimezone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('returns a named zone rather than a UTC offset', () => {
    // The backend rejects bare offsets like "+05:30": an offset is frozen, so a reader
    // stored with one drifts an hour when their region leaves summer time and their
    // streak rolls over at the wrong midnight.
    expect(deviceTimezone()).not.toMatch(/^[+-]\d{2}/u);
  });
});
