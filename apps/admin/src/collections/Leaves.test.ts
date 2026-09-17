import { describe, expect, it } from 'vitest';

import { noDuplicateNarrators } from './Leaves';

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
