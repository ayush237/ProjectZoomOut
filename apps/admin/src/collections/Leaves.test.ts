import { NARRATED_FIELDS } from '@zoomout/shared';
import { describe, expect, it } from 'vitest';

import { Leaves, noDuplicateNarrators } from './Leaves';

/**
 * `audioField`'s array-level `validate` (VO-1.1) — the CMS half of the two
 * independent gates on "at most one audio entry per narrator", the other being
 * `slideAudioSchema` in `packages/shared`. No `Leaves.ts` test file existed before
 * this; everything else in the collection is declarative Payload config with no
 * logic of its own to unit test, but this one function has real logic and is
 * exercised by nothing else — the live contract test's fixture happens to be valid,
 * so it would not notice this rule breaking.
 */
describe('noDuplicateNarrators', () => {
  it('accepts an array with one entry per narrator', () => {
    expect(noDuplicateNarrators([{ narrator: 'female' }, { narrator: 'male' }])).toBe(true);
  });

  it('accepts an empty array', () => {
    expect(noDuplicateNarrators([])).toBe(true);
  });

  it('accepts a single entry', () => {
    expect(noDuplicateNarrators([{ narrator: 'female' }])).toBe(true);
  });

  it('rejects two entries for the same narrator', () => {
    const result = noDuplicateNarrators([{ narrator: 'female' }, { narrator: 'female' }]);

    expect(result).not.toBe(true);
    expect(result).toBe('At most one audio entry per narrator.');
  });

  it('passes through a non-array value rather than rejecting it', () => {
    // Payload may call a field's validate before the value is known to be an array
    // at all (e.g. undefined on a document that has never had this field touched) —
    // this rule has nothing to say about that; required-ness is a separate concern.
    expect(noDuplicateNarrators(undefined)).toBe(true);
    expect(noDuplicateNarrators(null)).toBe(true);
  });

  it('ignores a row with no narrator rather than crashing', () => {
    // Defensive: Payload types a row's `narrator` as present, but a document written
    // before the field existed, or by a hand-run query, is not bound by that.
    expect(noDuplicateNarrators([{}, {}])).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* The stale-narration banner is on exactly the narrated fields (GUARD-1 B)    */
/* -------------------------------------------------------------------------- */

/** The part of a Payload field config this walks — enough to find a field by path and read its components. */
interface FieldShape {
  readonly name?: string;
  readonly type: string;
  readonly fields?: readonly FieldShape[];
  readonly admin?: { readonly components?: { readonly afterInput?: readonly unknown[] } };
}

const BANNER = '/components/NarrationStaleBanner#NarrationStaleBanner';

/** Every field in the Leaves config by dotted path (`payoff.body`), groups and arrays walked. */
function fieldsByPath(): ReadonlyMap<string, FieldShape> {
  const found = new Map<string, FieldShape>();

  const walk = (fields: readonly FieldShape[], prefix: string): void => {
    for (const field of fields) {
      if (field.name === undefined) {
        continue;
      }

      const path = `${prefix}${field.name}`;
      found.set(path, field);

      if (field.fields !== undefined) {
        walk(field.fields, `${path}.`);
      }
    }
  };

  // Payload's `Field` is a wide union; this walk only needs the few properties above.
  walk(Leaves.fields as unknown as readonly FieldShape[], '');

  return found;
}

describe('the narration banner on the Leaf form', () => {
  const narratedPaths = Object.entries(NARRATED_FIELDS).map(([slide, field]) => `${slide}.${field}`);

  it('is on every narrated field and on nothing else', () => {
    // The set is read off `NARRATED_FIELDS`, so this fails when either side moves alone:
    // a new narrated slide with no banner, or a banner left on a field that is no longer read aloud.
    const withBanner = [...fieldsByPath()]
      .filter(([, field]) => field.admin?.components?.afterInput?.includes(BANNER) === true)
      .map(([path]) => path);

    expect(withBanner.sort()).toEqual([...narratedPaths].sort());
  });

  it('is on a textarea in every case — the text the audio was made from', () => {
    const fields = fieldsByPath();

    for (const path of narratedPaths) {
      expect(fields.get(path)?.type, path).toBe('textarea');
    }
  });

  it('has the audio list the banner reads next to every narrated field', () => {
    const fields = fieldsByPath();

    for (const slide of Object.keys(NARRATED_FIELDS)) {
      expect(fields.get(`${slide}.audio`)?.type, `${slide}.audio`).toBe('array');
    }
  });

  it('leaves the sticky notes without one — they have no narrated field', () => {
    const stickyNotes = [...fieldsByPath()].filter(([path]) => path.startsWith('stickyNotes.'));

    for (const [path, field] of stickyNotes) {
      expect(field.admin?.components?.afterInput ?? [], path).not.toContain(BANNER);
    }
  });
});
