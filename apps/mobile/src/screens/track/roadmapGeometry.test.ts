import {
  curvePath,
  dendriteBudgetPerNode,
  layoutRoadmap,
  seedFromTrackId,
  type Curve,
  type Point,
  type RoadmapGeometry,
} from './roadmapGeometry';

/**
 * Tier A, and the reason is the whole point of the package.
 *
 * The mockup this screen is ported from hardcoded node coordinates for exactly 18
 * Leaves, which is exactly how many Track 42 has. A roadmap verified only against
 * Track 42 would look perfect on a device and prove nothing about the 15-to-30 range
 * `PRODUCT.md` allows. Because the layout is a pure function, "does it work at 22" is a
 * unit test rather than a Track someone has to author first — so it is tested at every
 * count in the range, not at the one that happens to be seeded.
 */

const VIEWPORT = { width: 354, height: 740 } as const;
const COUNTS = Array.from({ length: 16 }, (_, index) => index + 15);

/** Every stroked connection: the web, the spine, and each cell's processes. */
function connections(geometry: RoadmapGeometry): Curve[] {
  return [
    ...geometry.web,
    ...geometry.spine,
    ...geometry.nodes.flatMap((node) => [...node.dendrites, node.axon]),
  ];
}

/** How far a control point sits off the straight line between its segment's ends. */
function offChord(from: Point, to: Point, control: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return 0;
  }

  return Math.abs(dx * (from.y - control.y) - dy * (from.x - control.x)) / length;
}

describe('seedFromTrackId', () => {
  it('gives the same Track the same seed every time', () => {
    expect(seedFromTrackId('42')).toBe(seedFromTrackId('42'));
  });

  it('gives adjacent Track ids visibly different seeds', () => {
    // A `parseInt` seed would make Tracks 41 and 42 near-identical graphs, which is the
    // failure a hash exists to avoid — so this asserts separation, not just inequality.
    const a = seedFromTrackId('41');
    const b = seedFromTrackId('42');

    expect(a).not.toBe(b);
    expect(Math.abs(a - b)).toBeGreaterThan(1000);
  });
});

describe('determinism', () => {
  it('produces identical geometry across repeated calls with the same input', () => {
    const first = layoutRoadmap(18, VIEWPORT, seedFromTrackId('42'));
    const second = layoutRoadmap(18, VIEWPORT, seedFromTrackId('42'));

    // Deep equality over the whole structure — every control point of every path, not a
    // spot check on the node centres. A graph that reshuffles any of its curves between
    // renders is the failure this is guarding, and the curves are most of the drawing.
    expect(second).toEqual(first);
  });

  it('produces identical geometry on a third call after a different Track was laid out', () => {
    // Catches a generator held in module scope: the second call below would advance it
    // and the third would differ. The PRNG is per-call, and this is what says so.
    const first = layoutRoadmap(18, VIEWPORT, seedFromTrackId('42'));
    layoutRoadmap(23, VIEWPORT, seedFromTrackId('99'));
    const third = layoutRoadmap(18, VIEWPORT, seedFromTrackId('42'));

    expect(third).toEqual(first);
  });

  it('gives different Tracks different graphs', () => {
    const a = layoutRoadmap(18, VIEWPORT, seedFromTrackId('42'));
    const b = layoutRoadmap(18, VIEWPORT, seedFromTrackId('43'));

    expect(b.nodes.map((node) => node.centre)).not.toEqual(a.nodes.map((node) => node.centre));
  });
});

describe.each(COUNTS)('at %i Leaves', (count) => {
  const geometry = layoutRoadmap(count, VIEWPORT, seedFromTrackId(`track-${String(count)}`));

  it('draws one node per Leaf, in order', () => {
    expect(geometry.nodes).toHaveLength(count);
    expect(geometry.nodes.map((node) => node.index)).toEqual(
      Array.from({ length: count }, (_, index) => index),
    );
  });

  it('keeps every node inside the frame', () => {
    for (const node of geometry.nodes) {
      expect(node.centre.x).toBeGreaterThanOrEqual(node.radius);
      expect(node.centre.x).toBeLessThanOrEqual(geometry.width - node.radius);
      expect(node.centre.y).toBeGreaterThanOrEqual(node.radius);
      expect(node.centre.y).toBeLessThanOrEqual(geometry.height - node.radius);
    }
  });

  it('keeps the spine inside the middle two thirds', () => {
    // The founder's first correction: the meander swung to both edges. The band is a
    // sixth of the frame in from each side, and it holds by construction rather than by
    // clamping — the two waves' amplitudes sum to exactly one.
    const low = geometry.width / 6;
    const high = (geometry.width * 5) / 6;

    for (const node of geometry.nodes) {
      expect(node.centre.x).toBeGreaterThanOrEqual(low - 0.5);
      expect(node.centre.x).toBeLessThanOrEqual(high + 0.5);
    }
  });

  it('actually meanders rather than running straight down', () => {
    // The band is an upper bound, and a degenerate wave would satisfy it by drawing a
    // straight column. This asserts the spine uses a real share of the room it has.
    const xs = geometry.nodes.map((node) => node.centre.x);
    const spread = Math.max(...xs) - Math.min(...xs);

    expect(spread).toBeGreaterThan((geometry.width * 2) / 3 / 2);
  });

  it('has one spine curve per gap between Leaves', () => {
    expect(geometry.spine).toHaveLength(count - 1);
  });

  it('curves every connection, background web included', () => {
    // The rejection that produced this whole revision: "it reads as a constellation, not
    // a neuron, because almost every connection is a straight line." A straight segment
    // is one whose control points lie on the chord, so that is what is asserted — for
    // every path in the drawing, not for a sample.
    for (const curve of connections(geometry)) {
      let start = curve.from;

      for (const segment of curve.segments) {
        const chord = Math.hypot(segment.to.x - start.x, segment.to.y - start.y);

        expect(chord).toBeGreaterThan(0);

        const bow = Math.max(
          offChord(start, segment.to, segment.c1),
          offChord(start, segment.to, segment.c2),
        );

        expect(bow).toBeGreaterThan(chord * 0.05);
        start = segment.to;
      }
    }
  });

  it('gives every cell a tapering, recursive dendritic field', () => {
    for (const node of geometry.nodes) {
      const widths = [...new Set(node.dendrites.map((curve) => curve.strokeWidth))].sort(
        (a, b) => b - a,
      );

      // Three distinct widths means the recursion reached at least a third generation:
      // a flat ring of spokes from one centre — the pattern the spec calls out as the
      // main thing making it look artificial — would produce exactly one.
      expect(widths.length).toBeGreaterThanOrEqual(3);

      for (let index = 1; index < widths.length; index += 1) {
        expect(widths[index]).toBeLessThan(widths[index - 1] ?? Infinity);
      }
    }
  });

  it('gives every cell one process longer and thinner than the rest', () => {
    for (const node of geometry.nodes) {
      const widest = Math.max(...node.dendrites.map((curve) => curve.strokeWidth));
      const axonReach = Math.hypot(
        (node.axon.segments.at(-1)?.to.x ?? node.centre.x) - node.centre.x,
        (node.axon.segments.at(-1)?.to.y ?? node.centre.y) - node.centre.y,
      );
      const longestDendrite = Math.max(
        ...node.dendrites.map((curve) =>
          Math.hypot(
            (curve.segments.at(-1)?.to.x ?? curve.from.x) - curve.from.x,
            (curve.segments.at(-1)?.to.y ?? curve.from.y) - curve.from.y,
          ),
        ),
      );

      expect(node.axon.strokeWidth).toBeLessThan(widest);
      expect(axonReach).toBeGreaterThan(longestDendrite);
    }
  });

  it('gives every cell an irregular body rather than a circle', () => {
    for (const node of geometry.nodes) {
      expect(node.soma.closed).toBe(true);

      const radii = node.soma.segments.map((segment) =>
        Math.hypot(segment.to.x - node.centre.x, segment.to.y - node.centre.y),
      );

      // A perfect circle would have one radius. This asserts the outline is genuinely
      // lopsided, not merely built out of curves.
      expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(node.radius * 0.1);
    }
  });

  it('serialises to cubic commands only', () => {
    for (const curve of [...connections(geometry), ...geometry.nodes.map((node) => node.soma)]) {
      const path = curvePath(curve);

      expect(path.startsWith('M')).toBe(true);
      // `L` is the straight-line command. Its absence anywhere in the drawing is the
      // serialised form of the same rule the curvature assertion makes structurally.
      expect(path).not.toMatch(/[LlHhVvQqTtAaSs]/u);
      expect(path).toMatch(/C/u);
    }
  });

  it('grows tall enough to hold every Leaf without overlapping the frame edge', () => {
    expect(geometry.height).toBeGreaterThan(0);

    const lastNode = geometry.nodes.at(-1);
    const firstNode = geometry.nodes.at(0);

    expect(firstNode?.centre.y).toBeGreaterThan(0);
    expect(lastNode?.centre.y).toBeLessThan(geometry.height);
  });
});

describe('density budget', () => {
  it('spends fewer dendrites per node as a Track gets longer', () => {
    // "Density degrades before frame rate does." A per-node budget would make the
    // longest Track — the one that also scrolls furthest — the heaviest to draw.
    expect(dendriteBudgetPerNode(30)).toBeLessThan(dendriteBudgetPerNode(18));
    expect(dendriteBudgetPerNode(18)).toBeLessThan(dendriteBudgetPerNode(15));
  });

  it('keeps the total path count roughly flat across the whole range', () => {
    const counts = COUNTS.map(
      (count) => layoutRoadmap(count, VIEWPORT, seedFromTrackId('42')).pathCount,
    );

    const smallest = Math.min(...counts);
    const largest = Math.max(...counts);

    expect(largest / smallest).toBeLessThan(1.3);
  });

  it('never asks the renderer for more paths than it was budgeted', () => {
    for (const count of COUNTS) {
      const geometry = layoutRoadmap(count, VIEWPORT, seedFromTrackId('42'));

      expect(geometry.pathCount).toBeLessThanOrEqual(560);
      expect(geometry.pathCount).toBe(
        geometry.web.length +
          geometry.spine.length +
          geometry.nodes.reduce((total, node) => total + node.dendrites.length + 2, 0),
      );
    }
  });
});

describe('degenerate Leaf counts', () => {
  it('draws nothing for a Track with no visible Leaves', () => {
    const geometry = layoutRoadmap(0, VIEWPORT, seedFromTrackId('42'));

    expect(geometry.nodes).toHaveLength(0);
    expect(geometry.spine).toHaveLength(0);
    expect(geometry.height).toBeGreaterThan(0);
  });

  it('draws a single Leaf with no spine', () => {
    const geometry = layoutRoadmap(1, VIEWPORT, seedFromTrackId('42'));

    expect(geometry.nodes).toHaveLength(1);
    expect(geometry.spine).toHaveLength(0);
    expect(geometry.nodes[0]?.dendrites.length).toBeGreaterThan(0);
  });

  it('ignores a fractional or negative count rather than producing NaN geometry', () => {
    expect(layoutRoadmap(-3, VIEWPORT, 1).nodes).toHaveLength(0);
    expect(layoutRoadmap(17.6, VIEWPORT, 1).nodes).toHaveLength(17);
  });
});
