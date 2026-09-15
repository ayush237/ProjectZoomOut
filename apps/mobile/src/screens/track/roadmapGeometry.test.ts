import {
  HALO_RADIUS,
  curvePath,
  dendriteBudgetPerNode,
  layoutRoadmap,
  minStepForLabels,
  seedFromTrackId,
  type Curve,
  type Point,
  type RoadmapGeometry,
} from './roadmapGeometry';
import { typography } from '../../design';
import type { LeafNodeState } from './roadmapModel';

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

const VIEWPORT = { width: 354, height: 874 } as const;
const COUNTS = Array.from({ length: 16 }, (_, index) => index + 15);

/** A reader a third of the way through a book: some done, one next, the rest locked. */
function statesFor(count: number, done = Math.floor(count / 3)): LeafNodeState[] {
  return Array.from({ length: count }, (_, index) =>
    index < done ? 'done' : index === done ? 'next' : 'locked',
  );
}

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
    const first = layoutRoadmap(statesFor(18), VIEWPORT, seedFromTrackId('42'));
    const second = layoutRoadmap(statesFor(18), VIEWPORT, seedFromTrackId('42'));

    // Deep equality over the whole structure — every control point of every path, not a
    // spot check on the node centres. A graph that reshuffles any of its curves between
    // renders is the failure this is guarding, and the curves are most of the drawing.
    expect(second).toEqual(first);
  });

  it('produces identical geometry on a third call after a different Track was laid out', () => {
    // Catches a generator held in module scope: the second call below would advance it
    // and the third would differ. The PRNG is per-call, and this is what says so.
    const first = layoutRoadmap(statesFor(18), VIEWPORT, seedFromTrackId('42'));
    layoutRoadmap(statesFor(23), VIEWPORT, seedFromTrackId('99'));
    const third = layoutRoadmap(statesFor(18), VIEWPORT, seedFromTrackId('42'));

    expect(third).toEqual(first);
  });

  it('gives different Tracks different graphs', () => {
    const a = layoutRoadmap(statesFor(18), VIEWPORT, seedFromTrackId('42'));
    const b = layoutRoadmap(statesFor(18), VIEWPORT, seedFromTrackId('43'));

    expect(b.nodes.map((node) => node.centre)).not.toEqual(a.nodes.map((node) => node.centre));
  });

  it('redraws when progress moves, because appearance follows state', () => {
    // The consequence of WP22.2's signature change, stated so it is not mistaken for a
    // regression: the same Track at a different point in the book is a different
    // drawing, because the cell the reader is up to is larger and grows more.
    const early = layoutRoadmap(statesFor(18, 2), VIEWPORT, seedFromTrackId('42'));
    const later = layoutRoadmap(statesFor(18, 9), VIEWPORT, seedFromTrackId('42'));

    expect(later.nodes[2]?.radius).not.toBe(early.nodes[2]?.radius);
    expect(later.nodes.map((node) => node.centre)).toEqual(early.nodes.map((node) => node.centre));
  });
});

describe.each(COUNTS)('at %i Leaves', (count) => {
  const geometry = layoutRoadmap(
    statesFor(count),
    VIEWPORT,
    seedFromTrackId(`track-${String(count)}`),
  );

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

  it('keeps the spine in a narrow central band, leaving a gutter for labels on both sides', () => {
    // **Tightened in WP22.2, and this is the assertion that changed.** It used to be the
    // middle two thirds, which was the founder's first correction to a meander that swung
    // to both edges. Two thirds still left only ~37pt of gutter, which is not enough for
    // a label — see `roadmapLabels.ts`. The band is now a quarter of the frame, as in
    // `graph.jsx`, and this asserts the *consequence* rather than the constant: whatever
    // the band is, every node must leave a usable gutter on each side of it.
    const centre = geometry.width / 2;
    const halfBand = (geometry.width * 0.25) / 2;

    for (const node of geometry.nodes) {
      expect(node.centre.x).toBeGreaterThanOrEqual(centre - halfBand - 0.5);
      expect(node.centre.x).toBeLessThanOrEqual(centre + halfBand + 0.5);

      const leftGutter = node.centre.x - node.radius;
      const rightGutter = geometry.width - node.centre.x - node.radius;

      expect(Math.min(leftGutter, rightGutter)).toBeGreaterThan(100);
    }
  });

  it('actually meanders rather than running straight down', () => {
    // The band is an upper bound, and a degenerate wave would satisfy it by drawing a
    // straight column. This asserts the spine uses a real share of the room it has.
    const xs = geometry.nodes.map((node) => node.centre.x);
    const spread = Math.max(...xs) - Math.min(...xs);

    expect(spread).toBeGreaterThan((geometry.width * 0.25) / 2);
  });

  it('never spaces two Leaves closer than a worst-case label needs (WP22.3)', () => {
    // **Supersedes the old "fits in about one screen" assertion.** WP22.2 treated a
    // ~2000pt scroll collapsing into one screen as a win; the founder has since ruled the
    // opposite — a longer scroll is an acceptable price, unreadable density is not. A
    // ceiling on `geometry.height` is exactly the thing that would reintroduce the
    // congestion this package exists to remove, so there is deliberately no ceiling here
    // any more. What is asserted instead is the actual requirement: every gap between
    // consecutive centres is at least as tall as a two-line label at this fontScale needs.
    const floor = minStepForLabels(1);

    for (let index = 0; index + 1 < geometry.nodes.length; index += 1) {
      const gap = (geometry.nodes[index + 1]?.centre.y ?? 0) - (geometry.nodes[index]?.centre.y ?? 0);

      expect(gap).toBeGreaterThanOrEqual(floor - 0.01);
    }
  });

  it('has one spine curve per gap between Leaves', () => {
    expect(geometry.spine).toHaveLength(count - 1);
  });

  it('curves every connection, background web included', () => {
    // The rejection that produced this whole revision: "it reads as a constellation, not
    // a neuron, because almost every connection is a straight line." A straight segment
    // is one whose control points lie on the chord, so that is what is asserted — for
    // every path in the drawing, not for a sample.
    //
    // **`graph.jsx` would fail this**, and knowingly: its bend is `(rand()-0.5)*k`,
    // which passes through zero. The floor in `signedBend` is the deliberate difference.
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

  it('ends its dendritic tips in a spray of fine buds', () => {
    // The single biggest visual difference WP22.2 closed: our fields were trunks with no
    // terminal detail, and the terminal detail is four fifths of what reads as tissue.
    for (const node of geometry.nodes) {
      expect(node.tips.length).toBeGreaterThan(0);

      for (const bud of node.tips) {
        expect(bud.radius).toBeGreaterThan(0);
        expect(bud.radius).toBeLessThan(node.radius);
      }
    }
  });

  it('fades each generation against its parent rather than drawing them all alike', () => {
    for (const node of geometry.nodes) {
      const opacities = new Set(node.dendrites.map((curve) => curve.opacity));

      expect(opacities.size).toBeGreaterThanOrEqual(3);

      for (const opacity of opacities) {
        expect(opacity).toBeGreaterThan(0);
        expect(opacity).toBeLessThanOrEqual(1);
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

/**
 * The four node states, and the fact that all four are drawings rather than three
 * drawings and a plan. `revisit` is unreachable through `buildRoadmapModel` by design —
 * see `roadmapModel.ts` — so this is the only place its geometry is exercised at all.
 */
describe('the four node states', () => {
  const states: LeafNodeState[] = ['done', 'revisit', 'next', 'locked', 'locked'];
  const geometry = layoutRoadmap(states, VIEWPORT, seedFromTrackId('42'));

  it('sizes each state differently, next largest and done smallest', () => {
    const radiusOf = (state: LeafNodeState): number =>
      geometry.nodes.find((node) => node.state === state)?.radius ?? 0;

    expect(radiusOf('next')).toBeGreaterThan(radiusOf('revisit'));
    expect(radiusOf('revisit')).toBeGreaterThan(radiusOf('locked'));
    expect(radiusOf('locked')).toBeGreaterThan(radiusOf('done'));
  });

  it('renders a revisit cell rather than skipping or collapsing it into done', () => {
    const revisit = geometry.nodes.find((node) => node.state === 'revisit');

    expect(revisit).toBeDefined();
    expect(revisit?.soma.closed).toBe(true);
    expect(revisit?.dendrites.length).toBeGreaterThan(0);
    // Its own radius, not a done cell's — the dashed ring is drawn at this radius and a
    // revisit cell collapsed onto `done`'s 6.5 would be a dash pattern on a speck.
    expect(revisit?.radius).not.toBe(geometry.nodes.find((node) => node.state === 'done')?.radius);
  });

  it('gives the aura to the next cell and to nothing else', () => {
    for (const node of geometry.nodes) {
      expect(node.halo === null).toBe(node.state !== 'next');
    }

    const halo = geometry.nodes.find((node) => node.state === 'next')?.halo;

    expect(halo?.closed).toBe(true);

    const radii = (halo?.segments ?? []).map((segment) =>
      Math.hypot(
        segment.to.x - (geometry.nodes.find((node) => node.state === 'next')?.centre.x ?? 0),
        segment.to.y - (geometry.nodes.find((node) => node.state === 'next')?.centre.y ?? 0),
      ),
    );

    // Drawn at the aura's radius, not the body's, so the ring has a clearing inside it.
    expect(Math.max(...radii)).toBeGreaterThan(HALO_RADIUS * 0.8);
  });

  it('grows the next cell more than any other', () => {
    const next = geometry.nodes.find((node) => node.state === 'next');
    const locked = geometry.nodes.find((node) => node.state === 'locked');

    // `graph.jsx`: six arbors on the next cell, four everywhere else, and a deeper
    // recursion on top. The reader's position is found by density before it is found by
    // colour, which is what makes it findable at a glance.
    expect(next?.dendrites.length ?? 0).toBeGreaterThan(locked?.dendrites.length ?? 0);
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
      (count) => layoutRoadmap(statesFor(count), VIEWPORT, seedFromTrackId('42')).pathCount,
    );

    const smallest = Math.min(...counts);
    const largest = Math.max(...counts);

    expect(largest / smallest).toBeLessThan(1.3);
  });

  it('never asks the renderer for more paths than it was budgeted', () => {
    // **Raised from 560 to 12,000 in WP22.2**, which is a real change in what this screen
    // costs and not a threshold nudged to make a test pass. Transcribing `graph.jsx`'s
    // `arbors()` is what produced it: ten thousand subpaths, batched into a few dozen
    // `<Path>` elements by `TrackRoadmap.tsx`. The number that matters for frame rate is
    // the element count, which did not move; this one is bounded so that a change to the
    // recursion cannot quietly multiply it again.
    for (const count of COUNTS) {
      const geometry = layoutRoadmap(statesFor(count), VIEWPORT, seedFromTrackId('42'));

      expect(geometry.pathCount).toBeLessThanOrEqual(12000);
      expect(geometry.pathCount).toBe(
        geometry.web.length +
          geometry.webDots.length +
          geometry.spine.length +
          geometry.nodes.reduce(
            (total, node) =>
              total + node.dendrites.length + node.tips.length + 2 + (node.halo === null ? 0 : 1),
            0,
          ),
      );
    }
  });

  it('draws an ambient mesh whose density does not change with book length', () => {
    // `graph.jsx` scatters a fixed 58 dots over a fixed frame. Ours is a frame whose
    // height depends on the book, so a fixed count would make a long Track's background
    // sparse and a short one's crowded — the count is derived from area instead.
    const densities = [15, 22, 30].map((count) => {
      const geometry = layoutRoadmap(statesFor(count), VIEWPORT, seedFromTrackId('42'));

      return (geometry.webDots.length / (geometry.width * geometry.height)) * 1e5;
    });

    const smallest = Math.min(...densities);
    const largest = Math.max(...densities);

    expect(largest / smallest).toBeLessThan(1.25);
  });
});

/**
 * WP22.3, Tier A: "does spacing grow when the label wraps" as a direct assertion on the
 * pure function, per the acceptance criteria and the founder's density complaint.
 */
describe('minStepForLabels', () => {
  const captionFontSize = typography.caption.fontSize ?? 12;
  const captionLineHeight = typography.caption.lineHeight ?? 16;

  it('matches two lines of the real caption token plus the stacking gap, at the default text size', () => {
    // Pinned to the actual design token rather than a hardcoded number: this is the
    // assertion a mutation on `LABEL_LINES_ASSUMED` (2 → 1) or `LABEL_STACK_GAP_ASSUMED`
    // (7 → 0) is caught by — either mutation changes this exact value.
    const scaledLine = Math.max(captionLineHeight, captionFontSize * 1 * 1.2);

    expect(minStepForLabels(1)).toBeCloseTo(scaledLine * 2 + 7, 5);
  });

  it('grows as the OS text size grows', () => {
    // The acceptance criterion's own wording: "responds to label height and text scale."
    const atDefaultScale = minStepForLabels(1);
    const larger = minStepForLabels(2);
    const accessibilityMax = minStepForLabels(3.5);

    expect(larger).toBeGreaterThan(atDefaultScale);
    expect(accessibilityMax).toBeGreaterThan(larger);
  });

  it('is comfortably larger than the old flat 24pt floor even at the default text size', () => {
    // The founder's complaint was visible at *default* text, not only at accessibility
    // sizes — WP22.2's fixed 24–40 range never responded to real label content at any
    // scale. This is the number that proves the floor actually moved.
    expect(minStepForLabels(1)).toBeGreaterThan(24);
  });

  it('scales the line height rather than trusting the unscaled design-token constant', () => {
    // `design/typography.ts` fixes `lineHeight` absolutely — React Native scales
    // `fontSize` only — so a naive `lineHeight * 2 + gap` would silently stop growing
    // once `fontSize * fontScale` overtakes the unscaled `lineHeight`. This mutation
    // (deleting the `Math.max` and using `lineHeight` alone) is exactly what this test
    // is there to kill.
    const hugeScale = 10;
    const naiveFloor = captionLineHeight * 2 + 7;

    expect(minStepForLabels(hugeScale)).toBeGreaterThan(naiveFloor);
  });
});

describe('the vertical rhythm responds to text scale end to end (WP22.3)', () => {
  it('lays a Track out taller at accessibility-max than at the default text size', () => {
    const states = statesFor(22);
    const seed = seedFromTrackId('rhythm-check');

    const atDefault = layoutRoadmap(states, VIEWPORT, seed);
    const atAccessibilityMax = layoutRoadmap(states, { ...VIEWPORT, fontScale: 3.5 }, seed);

    expect(atAccessibilityMax.height).toBeGreaterThan(atDefault.height);
  });

  it('never lets an accessibility-scale label floor collide, at either text size', () => {
    for (const fontScale of [1, 3.5]) {
      const geometry = layoutRoadmap(statesFor(20), { ...VIEWPORT, fontScale }, seedFromTrackId('42'));
      const floor = minStepForLabels(fontScale);

      for (let index = 0; index + 1 < geometry.nodes.length; index += 1) {
        const gap =
          (geometry.nodes[index + 1]?.centre.y ?? 0) - (geometry.nodes[index]?.centre.y ?? 0);

        expect(gap).toBeGreaterThanOrEqual(floor - 0.01);
      }
    }
  });

  it('leaves spineBand untouched — this package is the vertical dimension only', () => {
    // A direct assertion on the acceptance criterion, not just an absence of a diff:
    // the horizontal band this geometry keeps its meander inside is unchanged.
    const withoutFontScale = layoutRoadmap(statesFor(18), VIEWPORT, seedFromTrackId('42'));
    const withFontScale = layoutRoadmap(
      statesFor(18),
      { ...VIEWPORT, fontScale: 3.5 },
      seedFromTrackId('42'),
    );

    const bandOf = (geometry: RoadmapGeometry): number => {
      const xs = geometry.nodes.map((node) => node.centre.x);
      return Math.max(...xs) - Math.min(...xs);
    };

    // Same seed, same horizontal wave — `fontScale` must not perturb it. An exact
    // comparison, not a tolerance: nothing about the *x* dimension should move at all.
    expect(bandOf(withFontScale)).toBe(bandOf(withoutFontScale));
  });
});

describe('degenerate Leaf counts', () => {
  it('draws nothing for a Track with no visible Leaves', () => {
    const geometry = layoutRoadmap([], VIEWPORT, seedFromTrackId('42'));

    expect(geometry.nodes).toHaveLength(0);
    expect(geometry.spine).toHaveLength(0);
    expect(geometry.height).toBeGreaterThan(0);
  });

  it('draws a single Leaf with no spine', () => {
    const geometry = layoutRoadmap(['next'], VIEWPORT, seedFromTrackId('42'));

    expect(geometry.nodes).toHaveLength(1);
    expect(geometry.spine).toHaveLength(0);
    expect(geometry.nodes[0]?.dendrites.length).toBeGreaterThan(0);
  });

  it('cannot be handed a fractional or negative Leaf count at all', () => {
    // The previous version of this file asserted that `layoutRoadmap(17.6, …)` produced
    // 17 nodes and `layoutRoadmap(-3, …)` produced none. Taking an array of states
    // instead of a count makes both unrepresentable, which is a better outcome than a
    // guard — kept as a note rather than deleted silently, because "that test vanished"
    // and "that test was deleted" look identical in a diff a month later.
    expect(layoutRoadmap([], VIEWPORT, 1).nodes).toHaveLength(0);
  });
});
