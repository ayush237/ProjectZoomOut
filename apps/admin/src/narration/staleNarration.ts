import { NARRATED_FIELDS, type NarratedSlideKey } from '@zoomout/shared';

import { sha256Hex } from './sha256';

/**
 * Does the audio on a slide still match the words on it? (GUARD-1 B)
 *
 * The backend serves a narration clip only if its `textDigest` is the sha256 of the
 * slide's narrated field **as Payload returned it**, and it drops the clip otherwise with
 * a log line nobody reads. On 2026-09-18 a human edit to Leaf 9's payoff left that slide
 * silent for two weeks, and nothing in the admin said so. This is the comparison behind
 * the warning that now does.
 *
 * Pure and synchronous on purpose — see `sha256.ts` for why the hash is written out
 * rather than taken from `crypto.subtle`.
 */

/** One row of a slide's `audio` array as the form holds it — everything optional, nothing trusted. */
export interface AudioRowDigest {
  readonly narrator?: string | null | undefined;
  readonly textDigest?: string | null | undefined;
}

/**
 * The narrators whose clip on this slide no longer matches `text`, in the order they
 * first appear in `rows`; an empty list when nothing needs saying.
 *
 * **This is a digest check, not "everything the backend would drop".** The backend also
 * drops an entry for an unknown narrator, an empty url, a zero or missing duration, and
 * for two entries from one narrator (both are dropped). None of those is a question about
 * the text, so none is answered here: a row with no narrator cannot be named and is
 * skipped, and a narrator's rows are judged by their digests alone.
 *
 * What it does mirror, exactly as `mapAudioEntries` does it:
 *  - the text is hashed as UTF-8 and **trimmed first**, because `trimTextFields` trims
 *    every string on save and the backend hashes what was stored;
 *  - the row's digest is compared after `.trim().toLowerCase()`;
 *  - a missing or empty digest matches nothing;
 *  - rows are judged independently. A narrator is stale only when **none** of its rows
 *    matches — the backend drops a stale row and keeps a matching one, so a narrator
 *    with one of each is still heard. (The CMS refuses a save with two rows for one
 *    narrator; this is for a document that got past it.)
 *
 * **Absent or empty text, with rows present, is stale for every narrator** — the backend
 * drops those rows too (no narrated field to verify against). That is a deliberate
 * simplification at one corner: a row whose digest is exactly `sha256("")` would be
 * served by the backend for a slide whose text is `""`, and is called stale here. No
 * clip is ever made from empty text, and a slide with no words and a clip attached is
 * worth a warning either way.
 *
 * No rows: nothing to say, whatever the text.
 */
export function findStaleNarrators(
  text: string | null | undefined,
  rows: readonly AudioRowDigest[],
  hash: (text: string) => string = sha256Hex,
): readonly string[] {
  const narrators = distinctNarrators(rows);

  if (narrators.length === 0) {
    return [];
  }

  const current = (text ?? '').trim();

  if (current === '') {
    return narrators;
  }

  const expected = hash(current);

  return narrators.filter(
    (narrator) =>
      !rows.some((row) => row.narrator === narrator && normaliseDigest(row.textDigest) === expected),
  );
}

/** The backend's comparison form for a stored digest: trimmed and lower-cased. */
function normaliseDigest(digest: string | null | undefined): string {
  return digest?.trim().toLowerCase() ?? '';
}

function distinctNarrators(rows: readonly AudioRowDigest[]): readonly string[] {
  const seen = new Set<string>();

  for (const row of rows) {
    if (typeof row.narrator === 'string' && row.narrator !== '') {
      seen.add(row.narrator);
    }
  }

  return [...seen];
}

/* -------------------------------------------------------------------------- */
/* The answer the banner shows                                                  */
/* -------------------------------------------------------------------------- */

export type NarrationCheck =
  | { readonly status: 'current' }
  | { readonly status: 'stale'; readonly narrators: readonly string[] }
  /** The check could not be made. Shown, never swallowed: a banner that quietly never appears is the defect. */
  | { readonly status: 'unavailable'; readonly reason: string };

/**
 * `findStaleNarrators` with the two ways it can be unable to answer turned into an answer.
 *
 * `rows === undefined` means the slide's `audio` list is not in the form at all — the
 * banner is mounted somewhere the form does not carry the audio it is supposed to read,
 * which a changed field path would do — and a hash that throws is reported rather than
 * left to unmount the field. Either way the editor sees that the check did not run.
 */
export function checkNarration(
  text: string | null | undefined,
  rows: readonly AudioRowDigest[] | undefined,
  hash: (text: string) => string = sha256Hex,
): NarrationCheck {
  if (rows === undefined) {
    return { status: 'unavailable', reason: 'the form has no audio list for this slide' };
  }

  try {
    const narrators = findStaleNarrators(text, rows, hash);

    return narrators.length === 0 ? { status: 'current' } : { status: 'stale', narrators };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'the text could not be hashed',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Reading the form                                                             */
/* -------------------------------------------------------------------------- */

/** The part of Payload's form state this reads — a structural slice, so it can be tested without a form. */
export interface FormFieldLike {
  readonly value?: unknown;
  readonly rows?: readonly unknown[];
}

export type FormStateLike = Readonly<Record<string, FormFieldLike | undefined>>;

/**
 * Which narrated slide a field path belongs to, or `undefined` for a path that is not one
 * of the narrated fields (`payoff.body` is; `stickyNotes.notes`, `payoff.audio` and
 * `title` are not). Read off `NARRATED_FIELDS`, so the CMS and the shared list cannot
 * disagree about where narration is read from.
 */
export function narratedSlideAt(path: string): NarratedSlideKey | undefined {
  const [slide, field, ...rest] = path.split('.');

  if (slide === undefined || field === undefined || rest.length > 0) {
    return undefined;
  }

  return (Object.keys(NARRATED_FIELDS) as NarratedSlideKey[]).find(
    (key) => key === slide && NARRATED_FIELDS[key] === field,
  );
}

/**
 * A slide's `audio` rows as the form holds them: `payoff.audio` is the list (its `rows`
 * are one entry per row) and each row's fields sit at `payoff.audio.<n>.<name>`. Returns
 * `undefined` when the form has no such list, which is not the same as an empty one.
 */
export function readAudioRows(
  fields: FormStateLike,
  slide: NarratedSlideKey,
): readonly AudioRowDigest[] | undefined {
  const list = fields[`${slide}.audio`];

  if (list === undefined) {
    return undefined;
  }

  const count = list.rows?.length ?? (typeof list.value === 'number' ? list.value : 0);
  const rows: AudioRowDigest[] = [];

  for (let index = 0; index < count; index += 1) {
    rows.push({
      narrator: stringOrNull(fields[`${slide}.audio.${String(index)}.narrator`]?.value),
      textDigest: stringOrNull(fields[`${slide}.audio.${String(index)}.textDigest`]?.value),
    });
  }

  return rows;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
