import type { AudioRef } from '@zoomout/shared';

import { selectNarration } from './selectNarration';

const FEMALE: AudioRef = {
  narrator: 'female',
  url: 'https://cdn.example.com/female.mp3',
  durationSeconds: 12,
  textDigest: 'a'.repeat(64),
};

const MALE: AudioRef = {
  narrator: 'male',
  url: 'https://cdn.example.com/male.mp3',
  durationSeconds: 12,
  textDigest: 'b'.repeat(64),
};

describe('selectNarration — the three shapes the server can actually send', () => {
  it('picks the matching entry when both narrators are present', () => {
    expect(selectNarration([FEMALE, MALE], 'female')).toBe(FEMALE);
    expect(selectNarration([FEMALE, MALE], 'male')).toBe(MALE);
  });

  it('returns the one narrator present when it is the preferred one', () => {
    expect(selectNarration([FEMALE], 'female')).toBe(FEMALE);
  });

  it('returns undefined — never the other voice — when only the non-preferred narrator is present', () => {
    // The attach-time guard (VO-2.1) cannot prevent this at serve time; the founder's
    // rule is that a reader who picks one narrator must never be handed the other.
    expect(selectNarration([FEMALE], 'male')).toBeUndefined();
  });

  it('returns undefined for an empty array', () => {
    expect(selectNarration([], 'male')).toBeUndefined();
  });

  it('returns undefined for undefined audio', () => {
    expect(selectNarration(undefined, 'male')).toBeUndefined();
  });

  it('matches by narrator, never by array position — a positional read would fail this', () => {
    // Male listed first on purpose: `[0]` or `.find` misapplied to an index would
    // return the female entry when asked for male, or vice versa.
    expect(selectNarration([MALE, FEMALE], 'female')).toBe(FEMALE);
    expect(selectNarration([MALE, FEMALE], 'male')).toBe(MALE);
  });
});
