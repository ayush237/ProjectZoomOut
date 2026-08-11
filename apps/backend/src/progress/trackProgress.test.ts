import { describe, expect, it } from 'vitest';

import { summariseTrackProgress, type CountableLeaf } from './trackProgress.js';

/**
 * The rollup Library and Journey are built on.
 *
 * Two things carry acceptance criteria and both are about ordering rather than
 * counting: **which** Leaf resume points at, and what happens at the edges — a Track
 * with nothing in it, and a Track whose Leaves arrive out of order.
 */

const leaf = (id: string, orderIndex: number): CountableLeaf => ({ id, orderIndex });

const TRACK = 't1';
const THREE_LEAVES = [leaf('a', 0), leaf('b', 1), leaf('c', 2)];

describe('counting', () => {
  it('reports nothing done on an untouched Track', () => {
    const summary = summariseTrackProgress(TRACK, THREE_LEAVES, new Set());

    expect(summary).toMatchObject({
      trackId: TRACK,
      totalLeaves: 3,
      completedLeaves: 0,
      isComplete: false,
    });
  });

  it('counts partial progress', () => {
    const summary = summariseTrackProgress(TRACK, THREE_LEAVES, new Set(['a']));

    expect(summary.completedLeaves).toBe(1);
    expect(summary.isComplete).toBe(false);
  });

  it('reports a finished Track', () => {
    const summary = summariseTrackProgress(TRACK, THREE_LEAVES, new Set(['a', 'b', 'c']));

    expect(summary.completedLeaves).toBe(3);
    expect(summary.isComplete).toBe(true);
    expect(summary.nextLeafId).toBeNull();
  });

  it('ignores completions for Leaves that are not in this Track', () => {
    // A reader's completions are global; the rollup is per Track. Counting a Leaf from
    // somewhere else would show progress against a book they have not opened.
    const summary = summariseTrackProgress(TRACK, THREE_LEAVES, new Set(['a', 'x', 'y']));

    expect(summary.completedLeaves).toBe(1);
  });
});

describe('the resume target', () => {
  it('is the first Leaf of an untouched Track', () => {
    expect(summariseTrackProgress(TRACK, THREE_LEAVES, new Set()).nextLeafId).toBe('a');
  });

  it('skips past what is already done', () => {
    expect(summariseTrackProgress(TRACK, THREE_LEAVES, new Set(['a'])).nextLeafId).toBe('b');
  });

  it('picks the earliest gap, not the furthest reached', () => {
    // A reader who jumped ahead has an unfinished Leaf behind them. Resume goes back to
    // it — the Track is a sequence, and skipping the gap silently would leave a hole
    // they can only find by scrolling.
    const summary = summariseTrackProgress(TRACK, THREE_LEAVES, new Set(['a', 'c']));

    expect(summary.nextLeafId).toBe('b');
    expect(summary.completedLeaves).toBe(2);
  });

  it('orders by orderIndex, not by the order the Leaves arrived', () => {
    // The acceptance criterion is asserted on the id, so this is the case that matters:
    // if the rollup trusted arrival order, resume would point at the wrong Leaf and
    // still look plausible.
    const shuffled = [leaf('c', 2), leaf('a', 0), leaf('b', 1)];

    expect(summariseTrackProgress(TRACK, shuffled, new Set()).nextLeafId).toBe('a');
    expect(summariseTrackProgress(TRACK, shuffled, new Set(['a'])).nextLeafId).toBe('b');
  });

  it('handles non-contiguous order indices', () => {
    // Payload does not renumber when an author deletes a Leaf, so gaps are normal.
    const gappy = [leaf('later', 90), leaf('early', 10)];

    expect(summariseTrackProgress(TRACK, gappy, new Set()).nextLeafId).toBe('early');
  });
});

describe('a Track with no visible Leaves', () => {
  it('is not complete', () => {
    // The trap: `completed === total` is true for 0 === 0. Marking a reader finished
    // with an empty book would flip `user_tracks.status` for content that does not
    // exist yet, which is exactly the state Phase 1 is full of.
    const summary = summariseTrackProgress(TRACK, [], new Set());

    expect(summary.isComplete).toBe(false);
  });

  it('has nothing to resume', () => {
    expect(summariseTrackProgress(TRACK, [], new Set()).nextLeafId).toBeNull();
  });

  it('reports zero of zero rather than failing', () => {
    // Reachable in production whenever every Leaf of a Track is a placeholder, so it
    // has to render rather than throw.
    expect(summariseTrackProgress(TRACK, [], new Set())).toMatchObject({
      totalLeaves: 0,
      completedLeaves: 0,
    });
  });
});
