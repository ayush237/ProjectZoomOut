import { describe, expect, it } from 'vitest';

import { isoTimestampSchema, localDateSchema, timeZoneSchema } from './primitives.js';

/**
 * Local-date and timezone handling is called out in plan §3.5 as the single most
 * common source of streak and session-cap bugs, so the primitives that encode it are
 * tested here rather than being left for WP5 to discover.
 */

describe('localDateSchema', () => {
  it('accepts a real calendar date', () => {
    expect(localDateSchema.safeParse('2026-08-06').success).toBe(true);
  });

  it('accepts a leap day in a leap year', () => {
    expect(localDateSchema.safeParse('2024-02-29').success).toBe(true);
  });

  it('rejects a leap day in a non-leap year', () => {
    expect(localDateSchema.safeParse('2026-02-29').success).toBe(false);
  });

  it('rejects a day that overflows its month', () => {
    expect(localDateSchema.safeParse('2026-04-31').success).toBe(false);
  });

  it('rejects an impossible month', () => {
    expect(localDateSchema.safeParse('2026-13-01').success).toBe(false);
  });

  it('rejects a timestamp, which would smuggle in a UTC instant', () => {
    expect(localDateSchema.safeParse('2026-08-06T00:00:00.000Z').success).toBe(false);
  });

  it('rejects unpadded components', () => {
    expect(localDateSchema.safeParse('2026-8-6').success).toBe(false);
  });
});

describe('timeZoneSchema', () => {
  it('accepts an IANA identifier', () => {
    expect(timeZoneSchema.safeParse('Europe/London').success).toBe(true);
  });

  it('accepts UTC', () => {
    expect(timeZoneSchema.safeParse('UTC').success).toBe(true);
  });

  it('rejects an unknown identifier', () => {
    expect(timeZoneSchema.safeParse('Mars/Olympus_Mons').success).toBe(false);
  });

  it('accepts a non-canonical alias, which clients legitimately send', () => {
    expect(timeZoneSchema.safeParse('Asia/Calcutta').success).toBe(true);
  });

  it.each(['+05:30', '-0800', '+01'])(
    'rejects the bare UTC offset %s, which does not track DST',
    (offset) => {
      expect(timeZoneSchema.safeParse(offset).success).toBe(false);
    },
  );

  it('rejects an empty string', () => {
    expect(timeZoneSchema.safeParse('').success).toBe(false);
  });
});

describe('isoTimestampSchema', () => {
  it('accepts a UTC instant', () => {
    expect(isoTimestampSchema.safeParse('2026-08-06T12:00:00.000Z').success).toBe(true);
  });

  it('accepts an explicit offset', () => {
    expect(isoTimestampSchema.safeParse('2026-08-06T12:00:00.000+05:30').success).toBe(true);
  });

  it('rejects a timestamp with no timezone designator', () => {
    expect(isoTimestampSchema.safeParse('2026-08-06T12:00:00.000').success).toBe(false);
  });

  it('rejects a bare calendar date', () => {
    expect(isoTimestampSchema.safeParse('2026-08-06').success).toBe(false);
  });
});
