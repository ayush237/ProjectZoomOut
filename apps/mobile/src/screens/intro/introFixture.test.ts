import { layoutRoadmap } from '../track/roadmapGeometry';
import { INTRO_FOCUS_INDEX, INTRO_SEED, INTRO_STATES } from './introFixture';

const VIEWPORT = { width: 390, height: 844 } as const;

describe('the intro fixture', () => {
  it('draws the identical graph every time it is laid out', () => {
    const first = layoutRoadmap(INTRO_STATES, VIEWPORT, INTRO_SEED);
    const second = layoutRoadmap(INTRO_STATES, VIEWPORT, INTRO_SEED);

    expect(second).toEqual(first);
  });

  it('still draws the identical graph at a different device size', () => {
    // Determinism is meant to hold per device (WP22.2's whole point), not just per call
    // with the same viewport — but the same viewport twice must still agree with itself.
    const atOneSize = layoutRoadmap(INTRO_STATES, VIEWPORT, INTRO_SEED);
    const atOneSizeAgain = layoutRoadmap(INTRO_STATES, VIEWPORT, INTRO_SEED);
    const atAnotherSize = layoutRoadmap(INTRO_STATES, { width: 428, height: 926 }, INTRO_SEED);

    expect(atOneSizeAgain).toEqual(atOneSize);
    expect(atAnotherSize).not.toEqual(atOneSize);
  });

  it('produces one node per fixture state', () => {
    const geometry = layoutRoadmap(INTRO_STATES, VIEWPORT, INTRO_SEED);

    expect(geometry.nodes).toHaveLength(INTRO_STATES.length);
  });

  it('points the focus index at a real node, and at the one `next` cell', () => {
    expect(INTRO_FOCUS_INDEX).toBeGreaterThanOrEqual(0);
    expect(INTRO_FOCUS_INDEX).toBeLessThan(INTRO_STATES.length);
    expect(INTRO_STATES[INTRO_FOCUS_INDEX]).toBe('next');
  });

  it('has exactly one `next` cell — beat 1 has exactly one subject', () => {
    expect(INTRO_STATES.filter((state) => state === 'next')).toHaveLength(1);
  });
});
