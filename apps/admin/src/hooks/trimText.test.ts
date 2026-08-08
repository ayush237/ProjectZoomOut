import { describe, expect, it } from 'vitest';

import { trimTextFields } from './trimText.js';

/**
 * The two cases that matter are opposite: leading and trailing whitespace must go,
 * and internal whitespace must survive completely intact. A hook that got the second
 * one wrong would silently destroy authored formatting in every payoff body.
 */

/** Invokes the hook the way Payload does, with only the argument it reads. */
const trim = <T>(data: T): T =>
  trimTextFields({ data } as unknown as Parameters<typeof trimTextFields>[0]) as T;

describe('trimTextFields', () => {
  it('trims a top-level string', () => {
    expect(trim({ title: 'concept 1 ' })).toEqual({ title: 'concept 1' });
  });

  it('trims inside a group', () => {
    // The gate found `" ; \n"` here specifically.
    expect(trim({ takeaway: { dinnerTableKnowledge: 'A fact about the book ; \n' } })).toEqual({
      takeaway: { dinnerTableKnowledge: 'A fact about the book ;' },
    });
  });

  it('trims inside an array of objects', () => {
    expect(trim({ scenario: { options: [{ text: 'option 1 ' }, { text: ' option 2' }] } })).toEqual({
      scenario: { options: [{ text: 'option 1' }, { text: 'option 2' }] },
    });
  });

  it('trims through group inside array inside group', () => {
    const input = {
      stickyNotes: { notes: [{ note: '  note 1  ' }, { note: '\tnote 2\n' }] },
    };

    expect(trim(input)).toEqual({
      stickyNotes: { notes: [{ note: 'note 1' }, { note: 'note 2' }] },
    });
  });

  it('trims an array of bare strings', () => {
    expect(trim({ tags: [' a ', 'b '] })).toEqual({ tags: ['a', 'b'] });
  });

  describe('internal whitespace', () => {
    it('preserves newlines in a multi-line body', () => {
      const body = 'First paragraph.\n\nSecond paragraph.\n\nThird.';

      expect(trim({ payoff: { body } })).toEqual({ payoff: { body } });
    });

    it('strips only the outer whitespace of a multi-line body', () => {
      const input = { payoff: { body: '\n  First line.\n\n  Indented second line.\n  \n' } };

      expect(trim(input)).toEqual({
        payoff: { body: 'First line.\n\n  Indented second line.' },
      });
    });

    it('never collapses runs of internal spaces', () => {
      const body = 'a    b\tc';

      expect(trim({ summary: { body } })).toEqual({ summary: { body } });
    });
  });

  describe('non-string values', () => {
    it('leaves null alone, which Payload writes for cleared fields', () => {
      expect(trim({ publisher: null })).toEqual({ publisher: null });
    });

    it('leaves undefined, numbers and booleans alone', () => {
      const input = { orderIndex: 0, isPlaceholder: true, coverUrl: undefined };

      expect(trim(input)).toEqual(input);
    });

    it('does not rebuild a Date into a plain object', () => {
      const createdAt = new Date('2026-08-08T12:00:00.000Z');

      expect(trim({ createdAt }).createdAt).toBeInstanceOf(Date);
    });

    it('reduces a whitespace-only string to empty, so required-field rules can catch it', () => {
      // This is why trimming and the locator rule belong in the same package: a
      // `"   "` locator must read as absent, not as present-but-blank.
      expect(trim({ note: '   ' })).toEqual({ note: '' });
    });
  });

  it('does not mutate the input object', () => {
    // Payload reuses `data` across the hook chain; a mutating hook behaves
    // differently depending on where it sits in that chain.
    const input = { title: ' padded ', nested: { body: ' also padded ' } };
    const snapshot = structuredClone(input);

    trim(input);

    expect(input).toEqual(snapshot);
  });

  it('handles an empty document', () => {
    expect(trim({})).toEqual({});
  });
});
