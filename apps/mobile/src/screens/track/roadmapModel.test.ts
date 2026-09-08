import type { TrackProgressSummary } from '@zoomout/shared';

import type { LeafSummary } from '../../api/client';
import {
  DONE_LABEL_CHARS,
  LOCKED_LABEL_CHARS,
  buildRoadmapModel,
  labelFor,
  truncateTitle,
  type LeafNodeState,
} from './roadmapModel';

/**
 * Tier A. The screen this feeds is a claim about what the reader has and has not done,
 * and the client derives that claim from two numbers rather than being told it — so the
 * failure branch is as load-bearing as the happy path and is tested at the same depth.
 */

function leaf(orderIndex: number, title = `Leaf ${String(orderIndex)}`): LeafSummary {
  return {
    id: `leaf-${String(orderIndex)}`,
    trackId: '42',
    orderIndex,
    title,
    isPlaceholder: false,
  };
}

function progress(over: Partial<TrackProgressSummary>): TrackProgressSummary {
  return {
    trackId: '42',
    totalLeaves: 5,
    completedLeaves: 0,
    nextLeafId: 'leaf-0',
    isComplete: false,
    ...over,
  };
}

const FIVE = [leaf(0), leaf(1), leaf(2), leaf(3), leaf(4)];

function states(nodes: readonly { state: LeafNodeState }[]): LeafNodeState[] {
  return nodes.map((node) => node.state);
}

describe('deriving the three states', () => {
  it('marks everything before the resume point done, the resume point next, the rest locked', () => {
    const model = buildRoadmapModel(FIVE, progress({ completedLeaves: 2, nextLeafId: 'leaf-2' }));

    // The exact sequence, not a spot check: this is a test about *which* states the
    // derivation produces, so anything short of the whole array could pass while a
    // state in the middle was wrong.
    expect(states(model.nodes)).toEqual(['done', 'done', 'next', 'locked', 'locked']);
    expect(model.confidence).toBe('known');
    expect(model.nextLeafId).toBe('leaf-2');
    expect(model.completedLeaves).toBe(2);
  });

  it('sorts by orderIndex rather than trusting the order the API returned them in', () => {
    const shuffled = [leaf(3), leaf(0), leaf(4), leaf(2), leaf(1)];
    const model = buildRoadmapModel(shuffled, progress({ completedLeaves: 1, nextLeafId: 'leaf-1' }));

    expect(model.nodes.map((node) => node.orderIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(states(model.nodes)).toEqual(['done', 'next', 'locked', 'locked', 'locked']);
  });

  it('marks a finished Track entirely done', () => {
    const model = buildRoadmapModel(
      FIVE,
      progress({ completedLeaves: 5, nextLeafId: null, isComplete: true }),
    );

    expect(states(model.nodes)).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(model.confidence).toBe('known');
    expect(model.nextLeafId).toBeNull();
  });

  it('accepts an empty Track without inventing a next Leaf', () => {
    const model = buildRoadmapModel(
      [],
      progress({ totalLeaves: 0, completedLeaves: 0, nextLeafId: null }),
    );

    expect(model.nodes).toEqual([]);
    expect(model.confidence).toBe('known');
    expect(model.nextLeafId).toBeNull();
  });

  it('starts an untouched Track at the first Leaf', () => {
    const model = buildRoadmapModel(FIVE, progress({ completedLeaves: 0, nextLeafId: 'leaf-0' }));

    expect(states(model.nodes)).toEqual(['next', 'locked', 'locked', 'locked', 'locked']);
  });

  it('carries the real title through untouched', () => {
    const model = buildRoadmapModel(
      [leaf(0, 'The Marshmallow Test, Revisited')],
      progress({ totalLeaves: 1, completedLeaves: 0, nextLeafId: 'leaf-0' }),
    );

    expect(model.nodes[0]?.title).toBe('The Marshmallow Test, Revisited');
  });
});

describe('when there is no progress to read', () => {
  it('claims nothing rather than guessing', () => {
    // Reached from Explore, where the book may not be on the reader's shelf at all, and
    // when the library request itself failed. Both mean the same thing: unknown.
    const model = buildRoadmapModel(FIVE, null);

    expect(states(model.nodes)).toEqual(['locked', 'locked', 'locked', 'locked', 'locked']);
    expect(model.confidence).toBe('unknown');
    expect(model.nextLeafId).toBeNull();
    expect(model.completedLeaves).toBe(0);
    expect(model.totalLeaves).toBe(5);
  });
});

describe('the nextLeafId cross-check', () => {
  /**
   * The branch that guards against a confidently wrong screen.
   *
   * "The first N are done" is only true if completion has no gaps. `nextLeafId` is
   * documented as the first incomplete Leaf in `orderIndex` order, which makes the
   * check exact — and every case below is a way for the server's two answers to
   * disagree, each of which would otherwise paint a map of a reader's progress that is
   * not their progress.
   */

  it('rejects a pointer that disagrees with the count', () => {
    // Says two are done, but points at the fourth Leaf. One of the two is wrong and
    // there is no way to tell which.
    const model = buildRoadmapModel(FIVE, progress({ completedLeaves: 2, nextLeafId: 'leaf-3' }));

    expect(model.confidence).toBe('inconsistent');
    expect(states(model.nodes)).toEqual(['locked', 'locked', 'locked', 'next', 'locked']);
    expect(model.completedLeaves).toBe(0);
  });

  it('keeps the server-asserted next Leaf while dropping every derived completion', () => {
    const model = buildRoadmapModel(FIVE, progress({ completedLeaves: 4, nextLeafId: 'leaf-1' }));

    // `nextLeafId` is the server's own answer rather than something this module worked
    // out, so it survives the degrade — the reader still has somewhere to resume.
    expect(model.nextLeafId).toBe('leaf-1');
    expect(states(model.nodes).filter((state) => state === 'done')).toEqual([]);
  });

  it('rejects a null pointer while Leaves are still incomplete', () => {
    const model = buildRoadmapModel(FIVE, progress({ completedLeaves: 2, nextLeafId: null }));

    expect(model.confidence).toBe('inconsistent');
    expect(states(model.nodes)).toEqual(['locked', 'locked', 'locked', 'locked', 'locked']);
  });

  it('rejects a pointer on a Track it claims is finished', () => {
    const model = buildRoadmapModel(
      FIVE,
      progress({ completedLeaves: 5, nextLeafId: 'leaf-2', isComplete: true }),
    );

    expect(model.confidence).toBe('inconsistent');
    expect(states(model.nodes)).toEqual(['locked', 'locked', 'next', 'locked', 'locked']);
  });

  it('rejects a count larger than the Track', () => {
    const model = buildRoadmapModel(FIVE, progress({ completedLeaves: 9, nextLeafId: null }));

    expect(model.confidence).toBe('inconsistent');
  });

  it('rejects a negative or fractional count rather than indexing with it', () => {
    expect(buildRoadmapModel(FIVE, progress({ completedLeaves: -1 })).confidence).toBe(
      'inconsistent',
    );
    expect(buildRoadmapModel(FIVE, progress({ completedLeaves: 1.5 })).confidence).toBe(
      'inconsistent',
    );
  });

  it('leaves nothing marked next when the pointer names a Leaf that is not in the Track', () => {
    const model = buildRoadmapModel(FIVE, progress({ completedLeaves: 2, nextLeafId: 'leaf-99' }));

    expect(model.confidence).toBe('inconsistent');
    expect(states(model.nodes)).toEqual(['locked', 'locked', 'locked', 'locked', 'locked']);
    // Still handed on: the screen decides what to do with a resume target it cannot
    // place on the map, and swallowing it here would hide the disagreement entirely.
    expect(model.nextLeafId).toBe('leaf-99');
  });
});

describe('labels', () => {
  const LONG = 'The Compounding Cost of a Decision You Keep Postponing';

  it('never rewords, only cuts', () => {
    // The property that matters legally as much as visually: every generated line in
    // this product is traceable to a source, so a label must be a prefix of the real
    // title and never text the app composed.
    for (const width of [4, 8, 12, 18, 26, 40, 200]) {
      const label = truncateTitle(LONG, width);
      const withoutEllipsis = label.replace(/…$/u, '').trimEnd();

      expect(LONG.startsWith(withoutEllipsis)).toBe(true);
    }
  });

  it('leaves a short title exactly as it is', () => {
    expect(truncateTitle('Loss aversion', DONE_LABEL_CHARS)).toBe('Loss aversion');
  });

  it('cuts on a word boundary when there is a usable one', () => {
    expect(truncateTitle(LONG, DONE_LABEL_CHARS)).toBe('The Compounding Cost of a…');
  });

  it('cuts mid-word rather than returning almost nothing', () => {
    // A single long word has no usable boundary; honouring one anyway would truncate
    // "Antidisestablishmentarianism" to nothing at all.
    expect(truncateTitle('Antidisestablishmentarianism', 10)).toBe('Antidisest…');
  });

  it('gives the next Leaf its full title and the others a truncated one', () => {
    const model = buildRoadmapModel(
      [leaf(0, LONG), leaf(1, LONG), leaf(2, LONG)],
      progress({ totalLeaves: 3, completedLeaves: 1, nextLeafId: 'leaf-1' }),
    );

    const [done, next, locked] = model.nodes;

    expect(next && labelFor(next)).toBe(LONG);
    expect(done && labelFor(done).length).toBeLessThanOrEqual(DONE_LABEL_CHARS + 1);
    expect(locked && labelFor(locked).length).toBeLessThanOrEqual(LOCKED_LABEL_CHARS + 1);
    // Locked is deliberately the shortest: the map should not spoil what is ahead.
    expect(locked && labelFor(locked).length).toBeLessThan(done ? labelFor(done).length : 0);
  });
});
