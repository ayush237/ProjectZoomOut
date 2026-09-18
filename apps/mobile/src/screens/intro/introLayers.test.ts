import { darkTheme, lightTheme } from '../../design';
import { layoutRoadmap } from '../track/roadmapGeometry';
import { INTRO_SEED, INTRO_STATES } from './introFixture';
import { buildIntroLayers } from './introLayers';

const VIEWPORT = { width: 390, height: 844 } as const;
const GEOMETRY = layoutRoadmap(INTRO_STATES, VIEWPORT, INTRO_SEED);

describe('buildIntroLayers', () => {
  it('produces batched layers and a non-empty spine path for a real graph', () => {
    const paint = buildIntroLayers(GEOMETRY, darkTheme);

    expect(paint.layers.length).toBeGreaterThan(0);
    expect(paint.spinePath.length).toBeGreaterThan(0);
    expect(paint.spineLength).toBeGreaterThan(0);
  });

  it('never paints in the reward colour, in either theme', () => {
    // The handoff's own requirement: amber is reserved for beat 4's travelling signal
    // and appears nowhere else. Nobody has read anything before sign-in, so nothing
    // here should carry the "earned" colour `buildDoneConstellationLayers` would use.
    for (const theme of [darkTheme, lightTheme]) {
      const paint = buildIntroLayers(GEOMETRY, theme);

      for (const layer of paint.layers) {
        expect(layer.fill).not.toBe(theme.palette.reward);
        expect(layer.stroke).not.toBe(theme.palette.reward);
        expect(layer.fill).not.toBe(theme.palette.rewardSoft);
        expect(layer.stroke).not.toBe(theme.palette.rewardSoft);
      }
    }
  });

  it('joins the spine into one continuous subpath, not one `M` per gap', () => {
    const paint = buildIntroLayers(GEOMETRY, darkTheme);

    // One moveto for the whole spine — see the file docstring on why a `curvePath`-per-
    // curve concatenation (one `M` per gap) would reset the dash phase at every gap.
    expect(paint.spinePath.match(/M/g) ?? []).toHaveLength(1);
  });

  it('chains every spine curve into the path — the same number of `C` commands as segments', () => {
    const paint = buildIntroLayers(GEOMETRY, darkTheme);
    const segmentCount = GEOMETRY.spine.reduce((total, curve) => total + curve.segments.length, 0);

    expect(paint.spinePath.match(/C/g) ?? []).toHaveLength(segmentCount);
  });

  it('draws a soma for every node', () => {
    const paint = buildIntroLayers(GEOMETRY, darkTheme);
    const somaLayers = paint.layers.filter((layer) => layer.key.startsWith('soma|'));

    // Batched by paint (colour/ring), not one layer per node — reached and unreached
    // somas share a colour each, so this is at most two buckets, never one per node.
    const somaMCount = somaLayers.reduce(
      (total, layer) => total + (layer.d.match(/M/g)?.length ?? 0),
      0,
    );

    expect(somaMCount).toBe(GEOMETRY.nodes.length);
  });
});
