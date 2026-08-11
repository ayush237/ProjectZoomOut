/**
 * The client-side age check, and the device's timezone.
 *
 * **This check is UX only.** The server decides, every time, and its answer is the one
 * that counts — the client exists so a reader who is plainly too young is told so
 * before filling in a password, not so the app can vet anyone. Treating it as the
 * control would be trivially bypassable and, worse, would mean the app *believed* it.
 *
 * The threshold is not hardcoded to 13 anywhere here. `LEGAL.md` records the legal
 * answer as undecided, the backend already exposes it as configuration, and the client
 * takes it as a parameter so the two cannot silently disagree about a constant.
 */

/**
 * The minimum age the client assumes when it has not been told otherwise.
 *
 * Only used to shape the form before the server has spoken. If the server's threshold
 * is higher, the server refuses and the app shows the refusal screen — the flow is
 * correct either way, which is what makes an approximate local default acceptable.
 */
export const ASSUMED_MINIMUM_AGE_YEARS = 13;

interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/**
 * Whole years elapsed between two calendar dates.
 *
 * Deliberately does not go through `Date` arithmetic: `new Date('2013-08-07')` is
 * midnight UTC, which is the previous calendar day for anyone west of Greenwich, and
 * the answer would then depend on where the reader is standing. This mirrors the
 * backend's own reasoning in `ageGate.ts` for the same reason.
 */
export function calculateAgeInYears(dateOfBirth: string, on: string): number {
  const birth = parseCalendarDate(dateOfBirth);
  const today = parseCalendarDate(on);

  const hasHadBirthdayThisYear =
    today.month > birth.month || (today.month === birth.month && today.day >= birth.day);

  return today.year - birth.year - (hasHadBirthdayThisYear ? 0 : 1);
}

/**
 * Whether the form should let this date of birth through.
 *
 * Inclusive at the boundary — someone whose birthday is today is old enough — and a
 * future date yields a negative age and is refused, because it is either a typo or a
 * probe and neither should reach the server as a signup attempt.
 */
export function meetsAssumedAgeThreshold(
  dateOfBirth: string,
  thresholdYears: number = ASSUMED_MINIMUM_AGE_YEARS,
  today: string = localDateToday(),
): boolean {
  return calculateAgeInYears(dateOfBirth, today) >= thresholdYears;
}

/**
 * The device's IANA timezone, e.g. `Europe/London`.
 *
 * **Read, never asked.** The reader is not a timezone database, and a picker here would
 * be a worse answer than the device's own setting in every case. It is sent silently
 * with signup, because the backend needs it to roll streaks and the daily cap over at
 * the reader's local midnight rather than UTC's.
 */
export function deviceTimezone(): string {
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Every platform ZoomOut targets reports one. The fallback exists so a signup cannot
  // fail outright on an exotic runtime; the backend rejects bare offsets, so UTC — a
  // real IANA zone — is the only safe stand-in.
  return resolved === '' ? 'UTC' : resolved;
}

/** Today's date in the device's timezone, as `YYYY-MM-DD`. */
export function localDateToday(now: Date = new Date()): string {
  // `en-CA` formats as YYYY-MM-DD, avoiding manual assembly from parts.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: deviceTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

/** Whether a string is a real `YYYY-MM-DD` calendar date. */
export function isCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE_PATTERN.exec(value);

  if (match === null) {
    return false;
  }

  // The pattern alone accepts 2026-02-30. Round-tripping rejects it: an overflowing
  // day rolls into the next month, so the serialised form stops matching the input.
  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function parseCalendarDate(value: string): CalendarDate {
  const match = CALENDAR_DATE_PATTERN.exec(value);

  if (match === null) {
    throw new Error(`Expected a YYYY-MM-DD date, received "${value}"`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}
