import { boardLayout } from './stickyNotesLayout';

describe('boardLayout', () => {
  it('stays single-column at 2 notes regardless of text size', () => {
    expect(boardLayout(2, 1)).toBe('singleColumn');
    expect(boardLayout(2, 3)).toBe('singleColumn');
  });

  it('staggers at 3–6 notes below the collapse threshold', () => {
    for (const noteCount of [3, 4, 5, 6]) {
      expect(boardLayout(noteCount, 1)).toBe('staggered');
    }
  });

  it('collapses to a single column at 3–6 notes once the threshold is reached', () => {
    for (const noteCount of [3, 4, 5, 6]) {
      expect(boardLayout(noteCount, 3)).toBe('singleColumn');
    }
  });

  it('collapses exactly at the threshold, not only past it', () => {
    // The mutation this guards: `>` instead of `>=` would let the board sit staggered
    // at precisely the size it was measured to fail at.
    expect(boardLayout(6, 1.7)).toBe('singleColumn');
    expect(boardLayout(6, 1.69)).toBe('staggered');
  });
});
