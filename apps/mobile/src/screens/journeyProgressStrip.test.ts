import { layoutRoadmap, seedFromTrackId } from './track/roadmapGeometry';
import type { LeafNodeState } from './track/roadmapModel';
import {
  buildProgressStrip,
  selectFocusIndex,
  STRIP_WINDOW_HEIGHT as WINDOW_HEIGHT,
} from './journeyProgressStrip';

/**
 * Tier A: this is "the strip's node-selection," named explicitly in WP27's testing
 * expectations, and the acceptance criterion is that the strip matches the full
 * roadmap's shape for the same Track — a claim only a test that recomputes the full
 * geometry independently can actually check.
 */

function statesFor(count: number, doneCount: number): LeafNodeState[] {
  return Array.from({ length: count }, (_, index) =>
    index < doneCount ? 'done' : index === doneCount ? 'next' : 'locked',
  );
}

describe('selectFocusIndex', () => {
  it('picks the next Leaf when there is one', () => {
    const states = statesFor(20, 7);
    expect(selectFocusIndex(states)).toBe(7);
  });

  it('falls back to the last done Leaf when nothing is next', () => {
    const states: LeafNodeState[] = ['done', 'done', 'done', 'locked', 'locked'];
    expect(selectFocusIndex(states)).toBe(2);
  });

  it('falls back to the middle when nothing is done or next', () => {
    const states: LeafNodeState[] = ['locked', 'locked', 'locked', 'locked', 'locked'];
    expect(selectFocusIndex(states)).toBe(2);
  });
});

describe('buildProgressStrip', () => {
  it('is null for a Track with no Leaves — there is no graph to crop', () => {
    expect(buildProgressStrip('track-1', [])).toBeNull();
  });

  it('matches a direct layoutRoadmap call at the same seed and states', () => {
    // The acceptance criterion in one assertion: this is a crop of the *same* geometry
    // a full-size roadmap for this Track would draw, not a second, independent layout.
    const states = statesFor(22, 9);
    const strip = buildProgressStrip('track-42', states);
    const direct = layoutRoadmap(states, { width: 48, height: 480 }, seedFromTrackId('track-42'));

    expect(strip?.geometry).toEqual(direct);
  });

  it('centres the window on the next Leaf when the track is tall enough to need cropping', () => {
    const states = statesFor(30, 15);
    const strip = buildProgressStrip('track-tall', states);

    expect(strip).not.toBeNull();
    const geometry = strip?.geometry;
    const focusNode = geometry?.nodes[strip?.focusIndex ?? -1];
    expect(focusNode?.state).toBe('next');

    // Cropping happened: the window is strictly shorter than the full graph. Every
    // real Track is tall enough for this — see the module docstring on why the window
    // is a fixed 96pt rather than something that shrinks for a short Track.
    expect(WINDOW_HEIGHT).toBeLessThan(geometry?.height ?? 0);

    // The focus node's centre falls inside the window.
    const top = strip?.windowY ?? 0;
    const bottom = top + WINDOW_HEIGHT;
    expect(focusNode?.centre.y).toBeGreaterThanOrEqual(top);
    expect(focusNode?.centre.y).toBeLessThanOrEqual(bottom);
  });

  it('does not push the window past either edge of the full graph', () => {
    // The very first Leaf: centring on it naively would ask for negative Y.
    const states = statesFor(30, 0);
    const strip = buildProgressStrip('track-start', states);

    expect(strip?.windowY).toBeGreaterThanOrEqual(0);

    // The very last Leaf (a finished Track has no `next`, so this falls back to the
    // last `done` one) — centring on it naively would run off the bottom.
    const finished = Array.from({ length: 30 }, (): LeafNodeState => 'done');
    const finishedStrip = buildProgressStrip('track-end', finished);
    const maxY = (finishedStrip?.geometry.height ?? 0) - WINDOW_HEIGHT;

    expect(finishedStrip?.windowY).toBeLessThanOrEqual(maxY);
  });
});
