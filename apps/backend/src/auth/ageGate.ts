import type { LocalDate } from '@zoomout/shared';

/**
 * The signup age gate.
 *
 * Server-side by design. A client-side check is a UX affordance — it stops someone
 * wasting their time filling in a form — but it is not the control, because the client
 * is exactly the thing an under-age user can bypass.
 *
 * The threshold is configuration, not a literal. `LEGAL.md` records it as legally
 * undecided with no owner assigned, so when the answer lands it must be an environment
 * change rather than a code change and a deploy.
 */

/** Whole years elapsed between two calendar dates. */
export function calculateAgeInYears(dateOfBirth: LocalDate, on: LocalDate): number {
  const birth = parseCalendarDate(dateOfBirth);
  const today = parseCalendarDate(on);

  let age = today.year - birth.year;

  // The birthday has not come round yet this year, so a year has not completed.
  const hasHadBirthdayThisYear =
    today.month > birth.month || (today.month === birth.month && today.day >= birth.day);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

/**
 * Whether someone born on `dateOfBirth` may create an account.
 *
 * Inclusive at the boundary: someone who turns exactly the threshold age today is old
 * enough. Turning 13 on your birthday is the ordinary reading, and the alternative
 * would refuse a legitimate signup for a day.
 *
 * A birth date in the future yields a negative age and is refused — it is either a
 * typo or a probe, and neither should produce an account.
 */
export function meetsAgeThreshold(
  dateOfBirth: LocalDate,
  thresholdYears: number,
  today: LocalDate,
): boolean {
  return calculateAgeInYears(dateOfBirth, today) >= thresholdYears;
}

interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/**
 * Splits a `YYYY-MM-DD` string into its parts without going through `Date`.
 *
 * Constructing a `Date` here would reintroduce exactly the timezone bug the `date`
 * column and `localDateSchema` exist to prevent: `new Date('2013-08-07')` is midnight
 * UTC, which is the previous calendar day for anyone west of Greenwich, and the gate
 * would then swing on where the server happens to run.
 *
 * Input has already passed `localDateSchema`, which rejects impossible dates.
 */
function parseCalendarDate(value: LocalDate): CalendarDate {
  const [year, month, day] = value.split('-').map(Number);

  /* c8 ignore next 3 -- unreachable via the schema; a guard, not a branch to test */
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Malformed calendar date: ${value}`);
  }

  return { year, month, day };
}

/** Today's date in a given IANA timezone, as `YYYY-MM-DD`. */
export function localDateIn(timeZone: string, instant: Date = new Date()): LocalDate {
  // `en-CA` formats as YYYY-MM-DD, which is the shape we want and avoids assembling
  // the string from parts.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}
