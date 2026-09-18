import {
  INTRO_BEATS,
  INTRO_CROSSFADE_MS,
  INTRO_HANDOFF_MS,
  INTRO_TOTAL_DURATION_MS,
} from './introBeats';

describe('INTRO_BEATS', () => {
  it('has exactly the four lines, verbatim, in order', () => {
    // Any difference here is a defect, including punctuation — the handoff's own words.
    expect(INTRO_BEATS.map((beat) => beat.text)).toEqual([
      'Your mind is a vast landscape.',
      'Nothing grows here in a single leap.',
      'What changes you is how small things connect.',
      "Let's zoom out.",
    ]);
  });

  it('starts every beat strictly after the one before it', () => {
    for (let index = 1; index < INTRO_BEATS.length; index += 1) {
      const previous = INTRO_BEATS[index - 1];
      const current = INTRO_BEATS[index];

      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      expect(current?.startMs ?? 0).toBeGreaterThan(previous?.startMs ?? 0);
    }
  });

  it('starts beat 1 at the very first frame', () => {
    expect(INTRO_BEATS[0]?.startMs).toBe(0);
  });
});

describe('the total run time', () => {
  it('stays within the handoff’s 12–16s window', () => {
    expect(INTRO_TOTAL_DURATION_MS).toBeGreaterThanOrEqual(12_000);
    expect(INTRO_TOTAL_DURATION_MS).toBeLessThanOrEqual(16_000);
  });

  it('holds beat 4 for long enough to read before hand-off is reachable', () => {
    const holdMs = INTRO_TOTAL_DURATION_MS - INTRO_HANDOFF_MS;

    expect(holdMs).toBeGreaterThanOrEqual(3000);
  });

  it('agrees INTRO_HANDOFF_MS with beat 4’s own start', () => {
    expect(INTRO_HANDOFF_MS).toBe(INTRO_BEATS[INTRO_BEATS.length - 1]?.startMs);
  });
});

describe('the crossfade', () => {
  it('is short enough that consecutive beats do not need to overlap by more than one window', () => {
    for (let index = 1; index < INTRO_BEATS.length; index += 1) {
      const previous = INTRO_BEATS[index - 1];
      const current = INTRO_BEATS[index];
      const gap = (current?.startMs ?? 0) - (previous?.startMs ?? 0);

      expect(gap).toBeGreaterThan(INTRO_CROSSFADE_MS);
    }
  });
});
