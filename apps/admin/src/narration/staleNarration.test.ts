import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  type AudioRowDigest,
  checkNarration,
  findStaleNarrators,
  type FormStateLike,
  narratedSlideAt,
  readAudioRows,
} from './staleNarration';

/**
 * Digests are made with `node:crypto`, the way the backend and the pipeline make them —
 * never with the code under test, or a wrong hash would agree with itself.
 *
 * Every text here is synthetic. The lessons are the book's ideas in our words; a fixture
 * is never copied lesson text.
 */
const digestOf = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const row = (narrator: string, text: string, overrides: Partial<AudioRowDigest> = {}): AudioRowDigest => ({
  narrator,
  textDigest: digestOf(text),
  ...overrides,
});

const TEXT = 'A synthetic payoff sentence, then a second one.';

describe('findStaleNarrators', () => {
  describe('when the audio still matches', () => {
    it('says nothing for one narrator', () => {
      expect(findStaleNarrators(TEXT, [row('female', TEXT)])).toEqual([]);
    });

    it('says nothing for both narrators', () => {
      expect(findStaleNarrators(TEXT, [row('female', TEXT), row('male', TEXT)])).toEqual([]);
    });

    it('says nothing when there are no rows, whatever the text is', () => {
      // Nothing is narrated, so nothing can be out of date.
      expect(findStaleNarrators(TEXT, [])).toEqual([]);
      expect(findStaleNarrators(null, [])).toEqual([]);
      expect(findStaleNarrators('', [])).toEqual([]);
    });
  });

  describe('when the text has changed', () => {
    it('flags every narrator when one word differs', () => {
      const edited = TEXT.replace('synthetic', 'invented');

      expect(findStaleNarrators(edited, [row('female', TEXT), row('male', TEXT)])).toEqual([
        'female',
        'male',
      ]);
    });

    it('flags only the narrator whose clip is behind — the second row', () => {
      const result = findStaleNarrators(TEXT, [row('female', TEXT), row('male', 'older words')]);

      expect(result).toEqual(['male']);
    });

    it('flags only the narrator whose clip is behind — the first row', () => {
      const result = findStaleNarrators(TEXT, [row('female', 'older words'), row('male', TEXT)]);

      expect(result).toEqual(['female']);
    });

    it('notices an extra blank line inside a multi-line payoff', () => {
      // Internal whitespace is part of the text: nothing normalises it, the backend does
      // not, and so neither does this.
      const authored = 'First paragraph.\n\nSecond paragraph.';
      const edited = 'First paragraph.\n\n\nSecond paragraph.';

      expect(findStaleNarrators(edited, [row('female', authored)])).toEqual(['female']);
    });

    it('is quiet when a multi-line payoff, blank lines and all, is unchanged', () => {
      const authored = 'First paragraph.\n\nSecond paragraph.\n\nThird.';

      expect(findStaleNarrators(authored, [row('female', authored), row('male', authored)])).toEqual([]);
    });

    it('goes quiet again when the text is put back', () => {
      const rows = [row('female', TEXT), row('male', TEXT)];

      expect(findStaleNarrators(`${TEXT}!`, rows)).toEqual(['female', 'male']);
      expect(findStaleNarrators(TEXT, rows)).toEqual([]);
    });
  });

  describe('the shapes that fool a naive hash', () => {
    const shapes: readonly (readonly [string, string])[] = [
      ['a closed-up em dash', 'The idea—stated plainly—is simple.'],
      ['curly quotes', 'She called it “the long way round” and ‘worth it’.'],
      ['multi-byte characters', 'Naïve café, 日本語, and an emoji 🎉 outside the BMP.'],
      ['a CRLF pair and a tab', 'Line one.\r\nLine two,\tindented.'],
    ];

    it.each(shapes)('matches for %s', (_name, text) => {
      expect(findStaleNarrators(text, [row('female', text)])).toEqual([]);
    });

    it('notices a closed-up em dash turned into an en dash', () => {
      const authored = 'The idea—stated plainly—is simple.';
      const edited = 'The idea–stated plainly–is simple.';

      expect(findStaleNarrators(edited, [row('female', authored)])).toEqual(['female']);
    });

    it('notices straight quotes where the clip was made from curly ones', () => {
      expect(findStaleNarrators('She said "go".', [row('female', 'She said “go”.')])).toEqual([
        'female',
      ]);
    });
  });

  describe('trimming', () => {
    it('trims the text the way the save will, so surrounding whitespace is not a change', () => {
      // `trimTextFields` trims every string on save and the backend hashes what was
      // stored, so a trailing newline typed into the editor never reaches the digest.
      const padded = `  \n${TEXT}\n\n `;

      expect(findStaleNarrators(padded, [row('female', TEXT)])).toEqual([]);
    });

    it('does not trim the inside of the text', () => {
      const withInnerSpace = 'two  spaces inside';

      expect(findStaleNarrators(withInnerSpace, [row('female', 'two spaces inside')])).toEqual([
        'female',
      ]);
    });

    it('compares a stored digest after trimming it', () => {
      const padded = row('female', TEXT, { textDigest: `  ${digestOf(TEXT)}\n` });

      expect(findStaleNarrators(TEXT, [padded])).toEqual([]);
    });
  });

  describe('digest case and form', () => {
    it('compares a stored digest case-insensitively', () => {
      const upper = row('female', TEXT, { textDigest: digestOf(TEXT).toUpperCase() });

      expect(findStaleNarrators(TEXT, [upper])).toEqual([]);
    });

    it('accepts a digest that is both upper-case and padded', () => {
      const messy = row('male', TEXT, { textDigest: ` ${digestOf(TEXT).toUpperCase()} ` });

      expect(findStaleNarrators(TEXT, [messy])).toEqual([]);
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty', ''],
      ['whitespace only', '   '],
      ['not a digest', 'not-a-digest'],
    ])('treats a digest that is %s as matching nothing', (_name, textDigest) => {
      expect(findStaleNarrators(TEXT, [{ narrator: 'female', textDigest }])).toEqual(['female']);
    });
  });

  describe('absent or empty text, with rows present', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty', ''],
      ['whitespace only', '   \n\t '],
    ])('is stale for every narrator when the text is %s', (_name, text) => {
      // The backend drops these rows too: with no narrated field there is nothing to
      // verify them against.
      expect(findStaleNarrators(text, [row('female', TEXT), row('male', TEXT)])).toEqual([
        'female',
        'male',
      ]);
    });

    it('still calls a row stale when its digest is that of the empty string', () => {
      // The one deliberate departure from the backend's arithmetic, pinned so it is a
      // decision rather than an accident: see the doc comment on `findStaleNarrators`.
      const emptyDigest = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      expect(findStaleNarrators('', [{ narrator: 'female', textDigest: emptyDigest }])).toEqual([
        'female',
      ]);
    });
  });

  describe('known vectors', () => {
    // Typed in, not computed, so these hold even if the hash and `node:crypto` were both
    // wrong in the same way.
    const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    it('matches the published sha256 of "abc"', () => {
      expect(findStaleNarrators('abc', [{ narrator: 'female', textDigest: ABC }])).toEqual([]);
    });

    it('does not match the published sha256 of the empty string against "abc"', () => {
      expect(findStaleNarrators('abc', [{ narrator: 'female', textDigest: EMPTY }])).toEqual(['female']);
    });
  });

  describe('narrators and rows', () => {
    it('lists each narrator once, in the order they first appear', () => {
      const result = findStaleNarrators('new', [
        row('male', 'old'),
        row('female', 'old'),
        row('male', 'older'),
      ]);

      expect(result).toEqual(['male', 'female']);
    });

    it('does not flag a narrator that has one current row and one stale one', () => {
      // The backend drops the stale row and keeps the current one, so this narrator is
      // still heard. (The CMS refuses to save two rows for a narrator; this is a document
      // that got past it.)
      const rows = [row('female', 'old words'), row('female', TEXT)];

      expect(findStaleNarrators(TEXT, rows)).toEqual([]);
    });

    it('flags a narrator once when both of its rows are stale', () => {
      const rows = [row('female', 'old words'), row('female', 'older words')];

      expect(findStaleNarrators(TEXT, rows)).toEqual(['female']);
    });

    it('says nothing about a narrator whose two rows both match — duplicates are a different drop', () => {
      const rows = [row('female', TEXT), row('female', TEXT)];

      expect(findStaleNarrators(TEXT, rows)).toEqual([]);
    });

    it('skips a row with no narrator, which could not be named', () => {
      const rows: AudioRowDigest[] = [
        { narrator: null, textDigest: digestOf('old words') },
        { textDigest: digestOf('old words') },
        { narrator: '', textDigest: digestOf('old words') },
        row('female', TEXT),
      ];

      expect(findStaleNarrators(TEXT, rows)).toEqual([]);
    });

    it('answers with no row-level state from the hash: the same call twice gives the same result', () => {
      const rows = [row('female', 'old'), row('male', TEXT)];

      expect(findStaleNarrators(TEXT, rows)).toEqual(findStaleNarrators(TEXT, rows));
    });
  });

  it('does not need crypto.subtle, which a plain-http page does not have', () => {
    // Node always has one, so without this the suite passes in exactly the environment
    // where nobody needs the guarantee. See `sha256.ts`.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });

    try {
      expect(globalThis.crypto).toBeUndefined();
      expect(findStaleNarrators(TEXT, [row('female', TEXT)])).toEqual([]);
      expect(findStaleNarrators(`${TEXT}!`, [row('female', TEXT)])).toEqual(['female']);
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(globalThis, 'crypto');
      } else {
        Object.defineProperty(globalThis, 'crypto', original);
      }
    }
  });
});

describe('checkNarration', () => {
  it('reports a current slide', () => {
    expect(checkNarration(TEXT, [row('female', TEXT)])).toEqual({ status: 'current' });
  });

  it('reports a slide with no audio as current', () => {
    expect(checkNarration(TEXT, [])).toEqual({ status: 'current' });
  });

  it('reports the stale narrators', () => {
    const result = checkNarration(`${TEXT}!`, [row('female', TEXT), row('male', TEXT)]);

    expect(result).toEqual({ status: 'stale', narrators: ['female', 'male'] });
  });

  it('says it cannot check — rather than saying nothing — when the form has no audio list', () => {
    const result = checkNarration(TEXT, undefined);

    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toMatch(/no audio list/u);
    }
  });

  it('says it cannot check when the hash throws, and carries the reason', () => {
    const broken = (): string => {
      throw new Error('no TextEncoder here');
    };

    expect(checkNarration(TEXT, [row('female', TEXT)], broken)).toEqual({
      status: 'unavailable',
      reason: 'no TextEncoder here',
    });
  });

  it('says it cannot check when something that is not an Error is thrown', () => {
    const broken = (): string => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the point of the case
      throw 'boom';
    };

    expect(checkNarration(TEXT, [row('female', TEXT)], broken).status).toBe('unavailable');
  });

  it('does not call the hash at all when there are no rows', () => {
    const neverCalled = (): string => {
      throw new Error('should not be called');
    };

    expect(checkNarration(TEXT, [], neverCalled)).toEqual({ status: 'current' });
  });
});

describe('narratedSlideAt', () => {
  it.each([
    ['summary.body', 'summary'],
    ['scenario.prompt', 'scenario'],
    ['payoff.body', 'payoff'],
    ['takeaway.body', 'takeaway'],
  ])('recognises %s', (path, slide) => {
    expect(narratedSlideAt(path)).toBe(slide);
  });

  it.each([
    ['stickyNotes.notes', 'stickyNotes has no narrated field'],
    ['scenario.body', 'the wrong field for that slide'],
    ['summary.prompt', 'the wrong field for that slide'],
    ['payoff.audio', 'the audio list itself'],
    ['payoff.audio.0.textDigest', 'a row inside the audio list'],
    ['takeaway.dinnerTableKnowledge', 'a sibling text field'],
    ['payoff.body.extra', 'a deeper path'],
    ['title', 'a top-level field'],
    ['payoff', 'a bare slide'],
    ['', 'nothing'],
  ])('does not recognise %s (%s)', (path) => {
    expect(narratedSlideAt(path)).toBeUndefined();
  });
});

describe('readAudioRows', () => {
  const fields: FormStateLike = {
    'payoff.audio': { value: 2, rows: [{ id: 'a' }, { id: 'b' }] },
    'payoff.audio.0.narrator': { value: 'female' },
    'payoff.audio.0.textDigest': { value: 'aaaa' },
    'payoff.audio.0.url': { value: '/api/media/file/a.mp3' },
    'payoff.audio.1.narrator': { value: 'male' },
    'payoff.audio.1.textDigest': { value: 'bbbb' },
    'summary.audio': { value: 1, rows: [{ id: 'c' }] },
    'summary.audio.0.narrator': { value: 'female' },
    'summary.audio.0.textDigest': { value: 'cccc' },
  };

  it('reads each row of the slide’s own audio list, and only that slide’s', () => {
    expect(readAudioRows(fields, 'payoff')).toEqual([
      { narrator: 'female', textDigest: 'aaaa' },
      { narrator: 'male', textDigest: 'bbbb' },
    ]);
  });

  it('returns undefined — not an empty list — when the form has no audio list for the slide', () => {
    expect(readAudioRows(fields, 'takeaway')).toBeUndefined();
  });

  it('returns an empty list for a slide whose list is present and empty', () => {
    expect(readAudioRows({ 'takeaway.audio': { value: 0, rows: [] } }, 'takeaway')).toEqual([]);
  });

  it('falls back to the numeric value when the list carries no row metadata', () => {
    const state: FormStateLike = {
      'scenario.audio': { value: 1 },
      'scenario.audio.0.narrator': { value: 'male' },
      'scenario.audio.0.textDigest': { value: 'dddd' },
    };

    expect(readAudioRows(state, 'scenario')).toEqual([{ narrator: 'male', textDigest: 'dddd' }]);
  });

  it('reads a value that is not a string as absent', () => {
    const state: FormStateLike = {
      'summary.audio': { value: 1, rows: [{}] },
      'summary.audio.0.narrator': { value: 7 },
      'summary.audio.0.textDigest': {},
    };

    expect(readAudioRows(state, 'summary')).toEqual([{ narrator: null, textDigest: null }]);
  });
});
