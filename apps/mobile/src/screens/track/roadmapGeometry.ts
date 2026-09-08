/**
 * Where a Track's Leaves sit, and every curve that connects them.
 *
 * **A pure function, deliberately separated from the component that draws it.** The
 * question this screen has to answer is "does it still work at any Leaf count a Track
 * can have" — `PRODUCT.md` allows 15 to 30 — and the mockup this is ported from
 * hardcoded coordinates for exactly the 18 that Track 42 happens to have. A layout that
 * lives inside a React component can only be checked by looking at it on a device, one
 * Track at a time; a layout that is `(leafCount, viewport, seed) → geometry` is checked
 * across the whole range by a unit test.
 *
 * **Nothing here is random at render time.** Everything is drawn from a seeded PRNG, and
 * the seed comes from the Track id, so a book draws the identical graph on every render,
 * every launch and every device. `Math.random()` would make the graph reshuffle whenever
 * React re-rendered the screen — unusable to read, and impossible to assert on.
 *
 * **Every connection is a cubic Bézier with a real bow in it.** Not a stylistic
 * preference: straight segments between scattered points is literally how a star chart
 * is drawn, and "this reads as a constellation, not a neuron" was the founder's
 * rejection of the first mockup. `emitCurve` cannot produce a straight segment — the bow
 * has a non-zero minimum — and `roadmapGeometry.test.ts` asserts that for every curve
 * the geometry emits, background web included.
 *
 * The numbers in `GRAPH` are **algorithm parameters, not design tokens**. Colour,
 * spacing, radius and duration all come from `src/design/` and none of them are
 * redefined here; what lives below is the shape of the drawing itself — how far a
 * dendrite reaches, how much each generation tapers — which has no meaning outside this
 * file and does not belong in a design system.
 */

import { MIN_TOUCH_TARGET } from '../../design';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One cubic Bézier hop. The start point is the previous segment's `to`. */
export interface CubicSegment {
  readonly c1: Point;
  readonly c2: Point;
  readonly to: Point;
}

/**
 * A stroked path made only of cubic segments.
 *
 * Structured rather than pre-serialised into an SVG `d` string so that tests can read
 * the actual control points — "is anything in this drawing a straight line" is a
 * question about geometry, and answering it by pattern-matching a string would be
 * asserting on the serializer instead.
 */
export interface Curve {
  readonly from: Point;
  readonly segments: readonly CubicSegment[];
  readonly strokeWidth: number;
  /** True for the soma outline, which closes back on itself and is filled. */
  readonly closed: boolean;
}

export interface RoadmapNodeGeometry {
  /** Position in `orderIndex` order — pairs with `RoadmapModel.nodes[index]`. */
  readonly index: number;
  readonly centre: Point;
  /** The drawn cell body's nominal radius. The *touch* target is `MIN_TOUCH_TARGET`. */
  readonly radius: number;
  /** The irregular cell body. A perfect circle reads as a bullet point, not a cell. */
  readonly soma: Curve;
  readonly dendrites: readonly Curve[];
  /** One longer, thinner process, aimed at the next Leaf, so the cell has a direction. */
  readonly axon: Curve;
  /** Which side of the spine has room for this node's label. */
  readonly labelSide: 'left' | 'right';
}

export interface RoadmapGeometry {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly RoadmapNodeGeometry[];
  /** The meandering path between consecutive Leaves, one curve per gap. */
  readonly spine: readonly Curve[];
  /** The faint tissue behind everything. Also curved — this is where star charts start. */
  readonly web: readonly Curve[];
  /** Every stroked path this geometry will produce. Reported, and budgeted against. */
  readonly pathCount: number;
}

export interface RoadmapViewport {
  readonly width: number;
  /** The *visible* height, which sets the vertical rhythm. The graph itself is taller. */
  readonly height: number;
}

/**
 * Algorithm parameters. See the file docstring: these are not design tokens.
 */
const GRAPH = {
  /** The meander's horizontal band as a fraction of the frame — the middle two thirds. */
  spineBand: 2 / 3,
  /** Divides the visible height to set the gap between consecutive Leaves. */
  nodesPerScreen: 6,
  minStep: 104,
  maxStep: 152,

  /**
   * Dendrite paths shared across **all** nodes, not per node.
   *
   * This is what makes density degrade before frame rate does. Recursive branching at
   * 30 nodes with a per-node budget would be half again as many paths as at 18, on the
   * Track that also scrolls furthest; a shared budget keeps the total roughly flat and
   * spends it more thinly as the book gets longer.
   */
  dendriteBudget: 380,
  minDendritesPerNode: 10,
  maxDendritesPerNode: 26,

  maxDepth: 4,
  /** Each generation is this fraction of its parent. Tapering, not spokes. */
  lengthDecay: 0.62,
  widthDecay: 0.66,
  /**
   * Reach, not branch count, is what turns a chain of cells into tissue: raised from
   * 30 on the founder's call after WP22's device gate, so neighbouring dendritic
   * fields overlap rather than merely reaching toward each other. It costs no paths —
   * the density budget below is untouched — so it is free at every Leaf count.
   */
  primaryLength: 36,
  primaryWidth: 2.2,
  minStrokeWidth: 0.4,

  axonLength: 78,
  axonWidth: 1,

  webCurves: 18,
  webStrokeWidth: 1,

  somaVertices: 9,
  /** How far each soma vertex wanders off the nominal radius. */
  somaJitter: 0.24,
  somaRadius: 13,

  /**
   * How far a curve bows off its chord, as a fraction of chord length, and the floor
   * below which it may not go. The floor is the mechanism that makes a straight
   * segment unrepresentable.
   */
  bow: 0.34,
  minBowFraction: 0.4,
} as const;

const TAU = Math.PI * 2;

/* -------------------------------------------------------------------------- */
/* Determinism                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A Track id folded into a 32-bit seed (FNV-1a).
 *
 * Ids are CMS strings rather than numbers, so they need hashing before a PRNG can take
 * them. Any stable hash would do; what matters is that the same Track always produces
 * the same number, and that two adjacent ids ("41", "42") produce visibly different
 * graphs rather than near-identical ones — which a plain `parseInt` would not.
 */
export function seedFromTrackId(trackId: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < trackId.length; index += 1) {
    hash ^= trackId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * Mulberry32 — small, fast, and good enough for decoration.
 *
 * Chosen over anything cryptographic because nothing here is a secret; chosen over
 * `Math.random()` because this one takes a seed, which is the entire point.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/* Curve construction                                                          */
/* -------------------------------------------------------------------------- */

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * One cubic hop from `from` to `to`, bowed off the chord.
 *
 * **The bow can never be zero.** `signedBow` scales the magnitude into
 * `[minBowFraction, 1]` of the budget before applying a sign, so there is no draw of the
 * PRNG that yields control points on the chord — which is what a straight line is. That
 * property is asserted in the tests rather than left as an intention.
 */
function bowedSegment(from: Point, to: Point, bow1: number, bow2: number): CubicSegment {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  // Unit normal to the chord. Both control points are pushed along it, independently,
  // so a curve can be a bow (same sign) or an S (opposite signs).
  const nx = -dy / length;
  const ny = dx / length;

  return {
    c1: { x: from.x + dx / 3 + nx * bow1, y: from.y + dy / 3 + ny * bow1 },
    c2: { x: from.x + (dx * 2) / 3 + nx * bow2, y: from.y + (dy * 2) / 3 + ny * bow2 },
    to,
  };
}

/** A bow magnitude that is never smaller than `minBowFraction` of the budget. */
function signedBow(rnd: () => number, budget: number): number {
  const magnitude = budget * (GRAPH.minBowFraction + (1 - GRAPH.minBowFraction) * rnd());
  return rnd() < 0.5 ? -magnitude : magnitude;
}

function curveBetween(
  rnd: () => number,
  from: Point,
  to: Point,
  strokeWidth: number,
  bowScale: number = GRAPH.bow,
): Curve {
  const budget = Math.hypot(to.x - from.x, to.y - from.y) * bowScale;

  return {
    from,
    segments: [bowedSegment(from, to, signedBow(rnd, budget), signedBow(rnd, budget))],
    strokeWidth,
    closed: false,
  };
}

/** Serialises a curve for `react-native-svg`. Cubic commands only — never `L`. */
export function curvePath(curve: Curve): string {
  const head = `M${fixed(curve.from.x)},${fixed(curve.from.y)}`;
  const body = curve.segments
    .map(
      (segment) =>
        `C${fixed(segment.c1.x)},${fixed(segment.c1.y)} ${fixed(segment.c2.x)},${fixed(
          segment.c2.y,
        )} ${fixed(segment.to.x)},${fixed(segment.to.y)}`,
    )
    .join(' ');

  return curve.closed ? `${head}${body}Z` : `${head}${body}`;
}

function fixed(value: number): string {
  return value.toFixed(2);
}

/* -------------------------------------------------------------------------- */
/* The cell body                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A closed, slightly lopsided blob.
 *
 * Built as a Catmull-Rom loop through jittered ring points and converted to cubics, so
 * the outline is smooth everywhere and round *nowhere* — the spec's "slightly irregular
 * rounded shape rather than a perfect circle".
 */
function somaCurve(rnd: () => number, centre: Point, radius: number): Curve {
  const ring: Point[] = [];

  for (let index = 0; index < GRAPH.somaVertices; index += 1) {
    const angle = (index / GRAPH.somaVertices) * TAU + (rnd() - 0.5) * (TAU / GRAPH.somaVertices);
    const wobble = radius * (1 + (rnd() - 0.5) * 2 * GRAPH.somaJitter);

    ring.push({ x: centre.x + Math.cos(angle) * wobble, y: centre.y + Math.sin(angle) * wobble });
  }

  const at = (index: number): Point => {
    const point = ring[((index % ring.length) + ring.length) % ring.length];
    // `noUncheckedIndexedAccess`: the modulo above makes this unreachable, but the
    // compiler cannot know that and a non-null assertion would hide a real bug later.
    return point ?? centre;
  };

  const segments: CubicSegment[] = [];

  for (let index = 0; index < ring.length; index += 1) {
    const previous = at(index - 1);
    const start = at(index);
    const end = at(index + 1);
    const next = at(index + 2);

    segments.push({
      c1: { x: start.x + (end.x - previous.x) / 6, y: start.y + (end.y - previous.y) / 6 },
      c2: { x: end.x - (next.x - start.x) / 6, y: end.y - (next.y - start.y) / 6 },
      to: end,
    });
  }

  return { from: at(0), segments, strokeWidth: 0, closed: true };
}

/* -------------------------------------------------------------------------- */
/* Dendrites                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * How many dendrite paths one node may spend, given how many nodes share the budget.
 *
 * The clamp matters at both ends: a 15-Leaf Track would otherwise get 25 paths per node
 * and a 30-Leaf Track 12, and the floor is what stops the longest books looking bald.
 */
export function dendriteBudgetPerNode(leafCount: number): number {
  if (leafCount <= 0) {
    return 0;
  }

  return clamp(
    Math.round(GRAPH.dendriteBudget / leafCount),
    GRAPH.minDendritesPerNode,
    GRAPH.maxDendritesPerNode,
  );
}

/**
 * One node's dendritic field: recursive, tapering, and lopsided.
 *
 * Three properties the first mockup got wrong, all of them deliberate here:
 *
 *  - **Recursion, not spokes.** Each branch grows from the *tip* of its parent, so the
 *    field is a tree three or four deep. Straight processes radiating from one centre
 *    is the pattern that reads as artificial, and it is what a flat loop produces.
 *  - **Taper.** SVG strokes a path at one width, so tapering has to be a property of
 *    the generation rather than of the path: each level is `widthDecay` of its parent
 *    and `lengthDecay` as long.
 *  - **Asymmetry.** Every field gets a random bias direction, and the primaries are
 *    spaced unevenly around it with varying lengths. Even angular spacing reads as a
 *    snowflake.
 */
function dendritesFor(rnd: () => number, centre: Point, budget: number): Curve[] {
  const curves: Curve[] = [];

  if (budget <= 0) {
    return curves;
  }

  const bias = rnd() * TAU;
  const primaries = 3 + Math.floor(rnd() * 3);

  const grow = (origin: Point, angle: number, length: number, width: number, depth: number): void => {
    if (curves.length >= budget || depth > GRAPH.maxDepth) {
      return;
    }

    const tip = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };

    curves.push(curveBetween(rnd, origin, tip, Math.max(width, GRAPH.minStrokeWidth)));

    if (depth === GRAPH.maxDepth) {
      return;
    }

    // Terminal density is most of what reads as organic, so the deepest generation
    // forks widest — two or three fine branches rather than one continuation.
    const children = depth >= GRAPH.maxDepth - 1 ? 2 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 2);

    for (let child = 0; child < children; child += 1) {
      if (curves.length >= budget) {
        return;
      }

      const spread = (rnd() - 0.5) * 1.5;
      grow(tip, angle + spread, length * GRAPH.lengthDecay, width * GRAPH.widthDecay, depth + 1);
    }
  };

  for (let index = 0; index < primaries; index += 1) {
    if (curves.length >= budget) {
      break;
    }

    // Uneven angular spacing around the bias, and uneven lengths: a real dendritic
    // field is lopsided, and radial symmetry is the thing that reads as a snowflake.
    const slot = (index + 0.5) / primaries;
    const angle = bias + slot * TAU + (rnd() - 0.5) * (TAU / primaries) * 0.9;
    const length = GRAPH.primaryLength * (0.7 + rnd() * 0.7);

    grow(centre, angle, length, GRAPH.primaryWidth, 1);
  }

  return curves;
}

/**
 * The axon: one process noticeably longer and thinner than the rest.
 *
 * Aimed at the **next** Leaf rather than at a random angle. It gives the cell a
 * direction, which is what the spec asks for, and the direction it gives it happens to
 * be the direction the reader is travelling — the graph leans down the page.
 */
function axonFor(rnd: () => number, centre: Point, towards: Point | null): Curve {
  const angle =
    towards === null
      ? Math.PI / 2 + (rnd() - 0.5) * 0.8
      : Math.atan2(towards.y - centre.y, towards.x - centre.x) + (rnd() - 0.5) * 0.7;

  const midpoint = {
    x: centre.x + Math.cos(angle) * GRAPH.axonLength * 0.55,
    y: centre.y + Math.sin(angle) * GRAPH.axonLength * 0.55,
  };
  const tip = {
    x: midpoint.x + Math.cos(angle + (rnd() - 0.5) * 0.9) * GRAPH.axonLength * 0.45,
    y: midpoint.y + Math.sin(angle + (rnd() - 0.5) * 0.9) * GRAPH.axonLength * 0.45,
  };

  // Two segments rather than one, so the axon can hold an S rather than a single arc.
  const firstBudget = GRAPH.axonLength * 0.55 * GRAPH.bow;
  const secondBudget = GRAPH.axonLength * 0.45 * GRAPH.bow;

  return {
    from: centre,
    segments: [
      bowedSegment(centre, midpoint, signedBow(rnd, firstBudget), signedBow(rnd, firstBudget)),
      bowedSegment(midpoint, tip, signedBow(rnd, secondBudget), signedBow(rnd, secondBudget)),
    ],
    strokeWidth: GRAPH.axonWidth,
    closed: false,
  };
}

/* -------------------------------------------------------------------------- */
/* The layout                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The whole graph, from a Leaf count, a viewport and a seed. Nothing else.
 *
 * Takes a *count* rather than the Leaves themselves on purpose: geometry has no
 * business knowing a Leaf's title or whether the reader has finished it. The component
 * pairs `geometry.nodes[i]` with `model.nodes[i]`, and this function stays testable
 * across the full 15–30 range without constructing a single fixture.
 */
export function layoutRoadmap(
  leafCount: number,
  viewport: RoadmapViewport,
  seed: number,
): RoadmapGeometry {
  const rnd = mulberry32(seed);
  const width = Math.max(viewport.width, 1);

  const count = Math.max(0, Math.floor(leafCount));
  const step = clamp(viewport.height / GRAPH.nodesPerScreen, GRAPH.minStep, GRAPH.maxStep);

  // Enough room above and below for a cell's dendritic field, so the first and last
  // Leaves are not shaved off by the frame.
  const verticalPadding = GRAPH.somaRadius + GRAPH.axonLength * 0.75;
  const height = count === 0 ? verticalPadding * 2 : verticalPadding * 2 + Math.max(count - 1, 0) * step;

  const band = width * GRAPH.spineBand;
  const centreX = width / 2;
  const amplitude = band / 2;

  // Two waves at incommensurate frequencies, each with its own phase, so the meander
  // never repeats over a Track's length and no two Tracks meander alike. Their
  // amplitudes sum to exactly 1, which is what keeps the spine inside the band by
  // construction rather than by clamping it afterwards.
  const phaseA = rnd() * TAU;
  const phaseB = rnd() * TAU;

  const nodes: RoadmapNodeGeometry[] = [];
  const centres: Point[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const wave = 0.6 * Math.sin(t * TAU * 1.5 + phaseA) + 0.4 * Math.sin(t * TAU * 2.7 + phaseB);

    centres.push({
      x: clamp(centreX + wave * amplitude, centreX - amplitude, centreX + amplitude),
      y: verticalPadding + index * step,
    });
  }

  for (let index = 0; index < centres.length; index += 1) {
    const centre = centres[index];

    if (centre === undefined) {
      continue;
    }

    const radius = GRAPH.somaRadius * (0.9 + rnd() * 0.25);

    nodes.push({
      index,
      centre,
      radius,
      // Order matters: every draw from `rnd` below is part of the sequence that makes
      // this graph reproducible, so these three calls must not be reordered casually.
      soma: somaCurve(rnd, centre, radius),
      dendrites: dendritesFor(rnd, centre, dendriteBudgetPerNode(count)),
      axon: axonFor(rnd, centre, centres[index + 1] ?? null),
      labelSide: centre.x < centreX ? 'right' : 'left',
    });
  }

  const spine: Curve[] = [];

  for (let index = 0; index + 1 < centres.length; index += 1) {
    const from = centres[index];
    const to = centres[index + 1];

    if (from === undefined || to === undefined) {
      continue;
    }

    // A wider bow than a dendrite gets: this is the path the eye follows down the page,
    // and it is the one curve on the screen that has to read as deliberate.
    spine.push(curveBetween(rnd, from, to, GRAPH.primaryWidth, GRAPH.bow * 1.2));
  }

  const web = webCurves(rnd, width, height);

  return {
    width,
    height,
    nodes,
    spine,
    web,
    pathCount:
      web.length +
      spine.length +
      nodes.reduce((total, node) => total + node.dendrites.length + 2, 0),
  };
}

/**
 * The faint tissue behind everything.
 *
 * **This is where the first mockup went wrong**, and it is worth being explicit about:
 * the background was drawn as straight `<line>` elements between scattered points,
 * which is the definition of a star chart. These are long, lazy, low-curvature Béziers
 * instead — same faintness, entirely different reading.
 */
function webCurves(rnd: () => number, width: number, height: number): Curve[] {
  const curves: Curve[] = [];

  for (let index = 0; index < GRAPH.webCurves; index += 1) {
    const from = { x: rnd() * width, y: rnd() * height };
    const to = {
      x: clamp(from.x + (rnd() - 0.5) * width * 1.1, 0, width),
      y: clamp(from.y + (rnd() - 0.5) * height * 0.28, 0, height),
    };

    curves.push(curveBetween(rnd, from, to, GRAPH.webStrokeWidth, GRAPH.bow * 0.5));
  }

  return curves;
}

/** The tappable square centred on a node. The drawn soma is much smaller than this. */
export const NODE_TOUCH_SIZE = MIN_TOUCH_TARGET;
