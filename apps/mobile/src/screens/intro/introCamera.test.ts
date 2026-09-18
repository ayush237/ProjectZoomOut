import { layoutRoadmap } from '../track/roadmapGeometry';
import { INTRO_FOCUS_INDEX, INTRO_SEED, INTRO_STATES } from './introFixture';
import { fitScale, introCameraFrames, INTRO_FOCUS_SCALE } from './introCamera';

const VIEWPORT = { width: 390, height: 844 } as const;
const GEOMETRY = layoutRoadmap(INTRO_STATES, VIEWPORT, INTRO_SEED);

describe('fitScale', () => {
  it('fits the whole geometry inside the viewport, tight on at least one dimension', () => {
    const scale = fitScale(GEOMETRY, VIEWPORT);
    const scaledWidth = GEOMETRY.width * scale;
    const scaledHeight = GEOMETRY.height * scale;

    expect(scaledWidth).toBeLessThanOrEqual(VIEWPORT.width + 0.01);
    expect(scaledHeight).toBeLessThanOrEqual(VIEWPORT.height + 0.01);

    const tightOnWidth = Math.abs(scaledWidth - VIEWPORT.width) < 0.5;
    const tightOnHeight = Math.abs(scaledHeight - VIEWPORT.height) < 0.5;

    expect(tightOnWidth || tightOnHeight).toBe(true);
  });
});

describe('introCameraFrames', () => {
  const frames = introCameraFrames(GEOMETRY, INTRO_FOCUS_INDEX, VIEWPORT);

  it('starts tight on the focus node, at the configured magnification', () => {
    expect(frames.start.scale).toBe(INTRO_FOCUS_SCALE);
    expect(frames.start.focus).toEqual(GEOMETRY.nodes[INTRO_FOCUS_INDEX]?.centre);
  });

  it('ends with the whole graph fitted and centred', () => {
    expect(frames.end.scale).toBe(fitScale(GEOMETRY, VIEWPORT));
    expect(frames.end.focus).toEqual({ x: GEOMETRY.width / 2, y: GEOMETRY.height / 2 });
  });

  it('genuinely zooms out: the end is wider than the start', () => {
    // The fixture's graph is taller than one screen (roadmapGeometry.ts lays out at a
    // fixed per-node step regardless of viewport height), so `end.scale` sits well under
    // 1 — this is the product's own name showing up in the numbers, not a coincidence.
    expect(frames.end.scale).toBeLessThan(frames.start.scale);
    expect(frames.end.scale).toBeLessThan(1);
  });

  it('falls back to the graph’s own centre for a focus index with no node', () => {
    const fallback = introCameraFrames(GEOMETRY, 999, VIEWPORT);

    expect(fallback.start.focus).toEqual(fallback.end.focus);
  });
});
