import { z } from 'zod';

/**
 * Primitives shared by every domain schema in this package.
 *
 * Convention for the whole package: the Zod schema is the source of truth and the
 * TypeScript type is inferred from it with `z.infer`. Declaring the two separately
 * lets them drift, and a validator that disagrees with its own type is worse than
 * no validator.
 */

/**
 * Identifier for entities in tables we own (users, progress, gamification).
 * We control the format here, so we require a UUID.
 */
export const uuidSchema = z.uuid();

/**
 * Identifier for content entities, whose ids are minted by the CMS.
 *
 * Payload's Postgres adapter can emit either integer or UUID ids depending on how
 * the collection is configured, and that decision is not made until WP1. Staying
 * permissive here avoids baking in a guess that the schema-freeze gate would undo.
 */
export const cmsIdSchema = z.string().min(1);

/**
 * RFC 3339 timestamp. The offset is required so a bare local wall-clock time can
 * never be stored as if it were an instant.
 */
export const isoTimestampSchema = z.iso.datetime({ offset: true });

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * A calendar date in the *user's own* timezone — never derived from a UTC instant.
 *
 * `DailySession` and `Streak` are keyed on this (plan §3.5). Deriving the key from a
 * UTC timestamp is the single most common source of streak and session-cap bugs, so
 * the type is deliberately distinct from `isoTimestampSchema` to make the mistake
 * visible at the call site.
 */
export const localDateSchema = z
  .string()
  .regex(LOCAL_DATE_PATTERN, 'Expected a YYYY-MM-DD calendar date')
  .refine(isRealCalendarDate, 'Not a real calendar date');

/**
 * The regex alone accepts impossible dates like 2026-02-30. Round-tripping through
 * `Date` rejects them: an overflowing day silently rolls into the next month, so the
 * serialised form no longer matches the input.
 */
function isRealCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/**
 * An IANA timezone identifier such as `Europe/London`.
 *
 * Validated against the host's own timezone database rather than a hardcoded list,
 * which would go stale every time IANA publishes a release.
 */
export const timeZoneSchema = z.string().refine(isSupportedTimeZone, 'Unknown IANA timezone');

const UTC_OFFSET_PATTERN = /^[+-]\d{2}(?::?\d{2})?$/u;

function isSupportedTimeZone(value: string): boolean {
  // `Intl` accepts a bare UTC offset such as "+05:30" as a time zone, and we must not.
  // An offset is frozen: a user stored as "+01:00" keeps that offset when their region
  // leaves summer time, so their local midnight silently drifts by an hour and the
  // streak and session-cap rollover go with it — the exact failure plan §3.5 warns
  // about. Only named zones carry the DST rules, so only named zones are accepted.
  if (UTC_OFFSET_PATTERN.test(value)) {
    return false;
  }

  try {
    // `Intl` throws a RangeError for identifiers the runtime does not know. The throw
    // is the check; it is converted into a validation failure rather than swallowed.
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Publish state for CMS-owned content.
 *
 * Takedown depends on this: unpublishing flips a Track to `draft` and the content
 * read path filters on `published`, which drops it from every response immediately
 * (plan §3.2).
 */
export const publishStatusSchema = z.enum(['draft', 'published']);

export type Uuid = z.infer<typeof uuidSchema>;
export type CmsId = z.infer<typeof cmsIdSchema>;
export type IsoTimestamp = z.infer<typeof isoTimestampSchema>;
export type LocalDate = z.infer<typeof localDateSchema>;
export type TimeZone = z.infer<typeof timeZoneSchema>;
export type PublishStatus = z.infer<typeof publishStatusSchema>;
