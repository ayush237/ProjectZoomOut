/**
 * Where a Track's Leaves sit, and every curve that connects them.
 *
 * **A pure function, deliberately separated from the component that draws it.** The
 * question this screen has to answer is "does it still work at any Leaf count a Track
 * can have" — `PRODUCT.md` allows 15 to 30 — and the mockup this is ported from
 * hardcoded coordinates for exactly the 18 that Track 42 happens to have. A layout that
 * lives inside a React component can only be checked by looking at it on a device, one
 * Track at a time; a layout that is `(states, viewport, seed) → geometry` is checked
 * across the whole range by a unit test.
 *
 * **WP22.2 changed what this function is given, and why.** It used to take a Leaf
 * *count*, on the principle that geometry has no business knowing the reader's progress.
 * `design/claude_design/proto/graph.jsx` — the design source this screen is now ported
 * from, rather than described by — makes that principle untenable: a node's radius, the
 * number of dendritic arbors it grows and the reach of those arbors are all keyed on its
 * state there. A "done" cell is a 6.5-radius speck and the "next" cell is a 15-radius
 * body with half again as many processes. Taking the states rather than the count keeps
 * everything else true — still pure, still seeded, still checkable across 15–30 without
 * a fixture — while letting appearance follow state the way the source does.
 *
 * **Nothing here is random at render time.** Everything is drawn from a seeded PRNG, and
 * the seed comes from the Track id, so a book draws the identical graph on every render,
 * every launch and every device. `Math.random()` would make the graph reshuffle whenever
 * React re-rendered the screen — unusable to read, and impossible to assert on.
 *
 * **Every connection is a cubic Bézier with a real bow in it.** Not a stylistic
 * preference: straight segments between scattered points is literally how a star chart
 * is drawn, and "this reads as a constellation, not a neuron" was the founder's
 * rejection of the first mockup. No curve this file emits can be straight — every bow
 * magnitude is floored at `minBend` before a sign is applied — and
 * `roadmapGeometry.test.ts` asserts that for every curve the geometry emits, background
 * web included. **`graph.jsx` has no such floor** (its `bend` is a plain
 * `(rand()-0.5)*k`, which passes through zero); the floor is kept because the ruling
 * that produced it predates the mockup and still holds.
 *
 * The numbers in `GRAPH` are **algorithm parameters, not design tokens**. Colour,
 * spacing, radius and duration all come from `src/design/` and none of them are
 * redefined here; what lives below is the shape of the drawing itself — how far a
 * dendrite reaches, how much each generation tapers — which has no meaning outside this
 * file and does not belong in a design system.
 */

import { MIN_TOUCH_TARGET } from '../../design';
import type { LeafNodeState } from './roadmapModel';

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
  /**
   * How solid this curve is *relative to its node's* base opacity, which is the
   * component's to decide because it depends on state and theme. Each generation of a
   * dendritic tree fades slightly against its parent, and that fade is a property of
   * the drawing rather than of the palette.
   */
  readonly opacity: number;
  /** True for the soma outline, which closes back on itself and is filled. */
  readonly closed: boolean;
}

/** A terminal bud. Same relative-opacity rule as `Curve`. */
export interface Dot {
  readonly centre: Point;
  readonly radius: number;
  readonly opacity: number;
}

export interface RoadmapNodeGeometry {
  /** Position in `orderIndex` order — pairs with `RoadmapModel.nodes[index]`. */
  readonly index: number;
  readonly state: LeafNodeState;
  readonly centre: Point;
  /** The drawn cell body's radius, per state. The *touch* target is `MIN_TOUCH_TARGET`. */
  readonly radius: number;
  /** The irregular cell body. A perfect circle reads as a bullet point, not a cell. */
  readonly soma: Curve;
  /**
   * The faint aura around the Leaf the reader is up to, and nothing else. Null on every
   * other state. `graph.jsx` draws it as a second, much larger blob behind the body.
   */
  readonly halo: Curve | null;
  readonly dendrites: readonly Curve[];
  /** One longer, thinner process, thrown off across the spine, so the cell has a direction. */
  readonly axon: Curve;
  /** The fine buds the dendritic tips end in. Most of what reads as living tissue. */
  readonly tips: readonly Dot[];
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
  /** The unreached knowledge the web strings together. */
  readonly webDots: readonly Dot[];
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
 *
 * Most of what follows is transcribed from `graph.jsx` rather than chosen here, and the
 * transcription is deliberate down to the constants — that file is the spec for this
 * screen's appearance as of WP22.2, and a number "tidied" on the way across is a
 * difference nobody will be able to explain later.
 */
const GRAPH = {
  /**
   * The meander's horizontal band as a fraction of the frame.
   *
   * **Cut from two thirds to a quarter in WP22.2, and this is the single change that
   * makes labels possible.** `graph.jsx` keeps its 18 nodes between x=149 and x=244 of a
   * 390-wide frame — a band under a quarter of the width — which is what leaves ~125pt
   * of clear gutter on each side for a label to sit in. Our band was 236pt wide inside a
   * 354pt frame, leaving about 37pt: not a label, a stub. The screen did not look
   * different from the mockup because the labels were styled differently; it looked
   * different because there was nowhere to put them.
   */
  spineBand: 0.25,

  /**
   * The graph's height as a fraction of the visible viewport, before clamping.
   *
   * `graph.jsx` fits all 18 Leaves between y=212 and y=650 of an 844-tall screen — a
   * little over half of it, no scrolling. Ours ran 104–152pt *per Leaf* and produced a
   * graph some two thousand points tall. Reading the whole book meant scrolling past it,
   * and, more to the point, cells that far apart never grow into each other: the
   * overlapping dendritic fields are the entire reason the mockup reads as tissue rather
   * than as beads on a string.
   */
  spanFraction: 0.52,
  /** Below this the cell bodies themselves start to touch. */
  minStep: 24,
  maxStep: 40,

  /** Cell body radius by state, from `graph.jsx`'s `R`. */
  radius: { next: 15, done: 6.5, revisit: 12, locked: 11 } as Record<LeafNodeState, number>,
  /** The next node's aura, drawn behind its body. */
  haloRadius: 25,
  /** How far each soma vertex wanders off the nominal radius, by state. */
  somaJitter: { next: 0.13, done: 0.18, revisit: 0.15, locked: 0.16 } as Record<
    LeafNodeState,
    number
  >,
  haloJitter: 0.09,
  /** The bud at the centre of a done or revisit cell. */
  coreRadius: 2.9,
  coreJitter: 0.22,

  somaVertices: 9,
  /** `graph.jsx`'s blob wobbles each vertex's *angle* by this much, not by a full slot. */
  somaAngleJitter: 0.18,

  /**
   * Dendrite paths shared across **all** nodes, not per node.
   *
   * This is what makes density degrade before frame rate does. Recursive branching at
   * 30 nodes with a per-node budget would be half again as many paths as at 18, on the
   * Track that also scrolls furthest; a shared budget keeps the total roughly flat and
   * spends it more thinly as the book gets longer.
   *
   * **Raised from 380 in WP22.2 after measuring the source.** Transcribing `arbors()`
   * literally emits about 8,700 stroked paths at 18 Leaves — roughly twenty times what
   * this screen drew — because each of a node's four arbors is a four-deep tree whose
   * every leaf ends in three to six buds. The budget is the ceiling that keeps that from
   * scaling with book length; the value is where the density stops reading as sparse.
   * See the completion report for what was actually measured on a device.
   *
   * **The budget thins the terminal spray, it does not truncate the tree.** Stopping the
   * recursion when a counter runs out spends the whole allowance on whichever branch
   * happened to be walked first and leaves the rest of the field bald — depth-first
   * recursion makes a hard cap visibly lopsided. Scaling `tips` instead degrades the
   * field evenly, and it degrades exactly where the paths are: the spray is four fifths
   * of an arbor's cost.
   */
  dendriteBudget: 8800,
  minDendritesPerNode: 200,
  maxDendritesPerNode: 620,
  /** Never thinner than this share of the source's spray, however long the book. */
  minTipScale: 0.3,

  /** `arbors()`: six processes on the cell the reader is up to, four on every other. */
  arborsNext: 6,
  arborsOther: 4,
  /** Recursion depth, likewise. Each level below the first is `kids` wide. */
  depthNext: 4,
  depthOther: 3,
  primaryWidthNext: 1.6,
  primaryWidthOther: 1,
  /** Primary length: a base plus a spread, both wider for the next cell. */
  primaryBaseNext: 15,
  primaryBaseOther: 8,
  primarySpreadNext: 32,
  primarySpreadOther: 20,
  /** Arbors start off the body's edge, not at its centre. */
  arborOriginFraction: 0.75,

  lengthDecayBase: 0.46,
  lengthDecaySpread: 0.28,
  widthDecay: 0.58,
  minBranchWidth: 0.38,
  generationFade: 0.94,

  /** The terminal spray, which is most of the visible density. */
  minTips: 3,
  tipSpread: 4,
  tipLengthBase: 0.14,
  tipLengthSpread: 0.24,
  tipWidthDecay: 0.46,
  minTipWidth: 0.3,
  tipFade: 0.88,
  subTipChance: 0.45,
  subTipWidth: 0.32,
  subTipFade: 0.75,
  budRadius: 0.8,
  subBudRadius: 0.7,

  /** The axon: four tapering segments thrown off roughly across the spine, plus a tuft. */
  axonSegments: 4,
  axonLengthNext: 30,
  axonLengthOther: 22,
  axonTaperPerSegment: 3,
  axonWidthNext: 1,
  axonWidthOther: 0.7,
  axonMinWidth: 0.32,
  axonWidthDecay: 0.68,
  axonOriginFraction: 0.85,
  axonFade: 0.9,
  minTuft: 4,
  tuftSpread: 3,
  tuftWidth: 0.4,
  tuftFade: 0.85,

  /**
   * The ambient mesh, as a density rather than a count.
   *
   * `graph.jsx` scatters 58 points over a fixed 390×844 frame. Ours is a different width
   * and a height that depends on the book's length, so the count is derived from area at
   * the same density and capped — otherwise a 30-Leaf Track would draw a denser web than
   * an 18-Leaf one on the same screen.
   */
  webDotsPerPixel: 58 / (390 * 844),
  maxWebDots: 90,
  webLinkDistance: 74,
  webLinkChance: 0.5,
  webWispsPerDot: 26 / 58,
  webStrokeWidth: 0.9,
  wispStrokeWidth: 0.65,
  webDotMinRadius: 0.8,
  webDotSpread: 0.9,

  /**
   * How far a curve bows off its chord, as a fraction of its own length, and the floor
   * below which it may not go. The floor is the mechanism that makes a straight segment
   * unrepresentable — see the file docstring for why it survives the port.
   */
  minBend: 0.14,
  /** `grow()`'s bend range in `graph.jsx`: `(rand()-0.5)*1.8`. */
  branchBend: 0.9,
  tipBend: 1.3,
  subTipBend: 1.4,
  axonBend: 0.4,
  tuftBend: 1.4,
  webBend: 0.34,

  /**
   * The spine's bow, as a fraction of the gap between two Leaves.
   *
   * Much gentler than it was, because the gap itself is now a quarter of what it was: a
   * bow of a third of a 140pt gap reads as a meander, and the same third of a 26pt gap
   * reads as a zigzag. The sign follows the local turn rather than the PRNG, so a run of
   * near-collinear Leaves arcs consistently instead of wobbling.
   */
  spineBow: 0.12,
  spineWidthAhead: 2,
  spineWidthTravelled: 1.75,
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
 * A bend magnitude in `[minBend, range]`, with a random sign.
 *
 * `graph.jsx` writes this as `(rand()-0.5)*range*2`, which passes through zero and so
 * can emit a straight segment. The floor is the whole difference, and it costs nothing
 * visually: it removes the middle thirteen percent of a range whose typical value is
 * four times larger.
 */
function signedBend(rnd: () => number, range: number): number {
  const magnitude = GRAPH.minBend + (Math.max(range, GRAPH.minBend) - GRAPH.minBend) * rnd();
  return rnd() < 0.5 ? -magnitude : magnitude;
}

/**
 * `graph.jsx`'s `curve()`: one cubic hop of `length` from `origin` along `angle`, bowed.
 *
 * The control points sit at 34% and 68% of the way along, pushed off the chord by 30%
 * and 46% of `length * bend`. Transcribed exactly — this proportion is what gives every
 * process in the drawing its particular lazy hook, and it is not the same shape as a
 * symmetric bow.
 */
function grownCurve(
  origin: Point,
  angle: number,
  length: number,
  bend: number,
  strokeWidth: number,
  opacity: number,
): { readonly curve: Curve; readonly tip: Point } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const nx = -sin;
  const ny = cos;
  const offset = length * bend;

  const tip = { x: origin.x + cos * length, y: origin.y + sin * length };

  return {
    curve: {
      from: origin,
      segments: [
        {
          c1: {
            x: origin.x + cos * length * 0.34 + nx * offset * 0.3,
            y: origin.y + sin * length * 0.34 + ny * offset * 0.3,
          },
          c2: {
            x: origin.x + cos * length * 0.68 + nx * offset * 0.46,
            y: origin.y + sin * length * 0.68 + ny * offset * 0.46,
          },
          to: tip,
        },
      ],
      strokeWidth,
      opacity,
      closed: false,
    },
    tip,
  };
}

/** One cubic hop between two known points, bowed off the chord by a signed amount. */
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
 * A closed, slightly lopsided blob — `graph.jsx`'s `blob()`.
 *
 * Built as a Catmull-Rom loop through jittered ring points and converted to cubics, so
 * the outline is smooth everywhere and round *nowhere* — the spec's "slightly irregular
 * rounded shape rather than a perfect circle".
 */
function blob(
  rnd: () => number,
  centre: Point,
  radius: number,
  jitter: number,
  opacity = 1,
): Curve {
  const ring: Point[] = [];

  for (let index = 0; index < GRAPH.somaVertices; index += 1) {
    const angle = (index / GRAPH.somaVertices) * TAU + (rnd() - 0.5) * GRAPH.somaAngleJitter;
    const wobble = radius * (1 - jitter + rnd() * jitter * 2);

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

  return { from: at(0), segments, strokeWidth: 0, opacity, closed: true };
}

/* -------------------------------------------------------------------------- */
/* Dendrites                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * How many dendrite paths one node may spend, given how many nodes share the budget.
 *
 * The clamp matters at both ends: a 15-Leaf Track would otherwise get 213 paths per node
 * and a 30-Leaf Track 107, and the floor is what stops the longest books looking bald.
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

interface ArborOutput {
  readonly curves: Curve[];
  readonly buds: Dot[];
}

/**
 * One node's dendritic field — `graph.jsx`'s `arbors()`, minus the colour decisions.
 *
 * Four properties, all of them deliberate and all of them from the source:
 *
 *  - **Recursion, not spokes.** Each branch grows from the *tip* of its parent, so the
 *    field is a tree three or four deep. Straight processes radiating from one centre
 *    is the pattern that reads as artificial, and it is what a flat loop produces.
 *  - **Taper.** SVG strokes a path at one width, so tapering has to be a property of
 *    the generation rather than of the path: each level is `widthDecay` of its parent
 *    and a random fraction as long, and fades slightly against it.
 *  - **A terminal spray.** The deepest generation does not simply stop — it opens into
 *    three to six fine tips, half of which fork again and some of which end in a bud.
 *    **This is the bulk of the path count and almost all of the visible density**; a
 *    field pruned to its trunks is exactly what our screen drew before this package.
 *  - **Asymmetry.** Every arbor starts at a random angle off the body's edge, so no two
 *    fields mirror each other and none is radially symmetric.
 */
function arborsFor(
  rnd: () => number,
  centre: Point,
  state: LeafNodeState,
  radius: number,
  budget: number,
): ArborOutput {
  const out: ArborOutput = { curves: [], buds: [] };

  if (budget <= 0) {
    return out;
  }

  const big = state === 'next';
  const arbors = big ? GRAPH.arborsNext : GRAPH.arborsOther;
  const tipScale = clamp(budget / GRAPH.maxDendritesPerNode, GRAPH.minTipScale, 1);

  const grow = (
    origin: Point,
    angle: number,
    length: number,
    width: number,
    depth: number,
    opacity: number,
  ): void => {
    const bend = signedBend(rnd, GRAPH.branchBend);
    const { curve, tip } = grownCurve(origin, angle, length, bend, width, opacity);

    out.curves.push(curve);

    if (depth <= 0) {
      const tips = Math.max(
        1,
        Math.round((GRAPH.minTips + Math.floor(rnd() * GRAPH.tipSpread)) * tipScale),
      );

      for (let index = 0; index < tips; index += 1) {
        const tipAngle = angle + bend * 0.7 + (rnd() - 0.5) * 2.2;
        const tipLength = length * (GRAPH.tipLengthBase + rnd() * GRAPH.tipLengthSpread);
        const twig = grownCurve(
          tip,
          tipAngle,
          tipLength,
          signedBend(rnd, GRAPH.tipBend),
          Math.max(GRAPH.minTipWidth, width * GRAPH.tipWidthDecay),
          opacity * GRAPH.tipFade,
        );

        out.curves.push(twig.curve);

        if (rnd() > GRAPH.subTipChance) {
          const fork = grownCurve(
            twig.tip,
            tipAngle + (rnd() - 0.5) * 2.4,
            tipLength * (0.4 + rnd() * 0.3),
            signedBend(rnd, GRAPH.subTipBend),
            GRAPH.subTipWidth,
            opacity * GRAPH.subTipFade,
          );

          out.curves.push(fork.curve);

          if (rnd() > 0.6) {
            out.buds.push({
              centre: fork.tip,
              radius: GRAPH.subBudRadius,
              opacity: opacity * 0.7,
            });
          }
        } else if (rnd() > 0.5) {
          out.buds.push({ centre: twig.tip, radius: GRAPH.budRadius, opacity: opacity * 0.75 });
        }
      }

      return;
    }

    const kids = rnd() > 0.6 ? 3 : 2;

    for (let index = 0; index < kids; index += 1) {
      const spread = (rnd() - 0.5) * 2.6;

      grow(
        tip,
        angle + bend * 0.8 + spread,
        length * (GRAPH.lengthDecayBase + rnd() * GRAPH.lengthDecaySpread),
        Math.max(GRAPH.minBranchWidth, width * GRAPH.widthDecay),
        depth - 1,
        opacity * GRAPH.generationFade,
      );
    }
  };

  for (let index = 0; index < arbors; index += 1) {
    const angle = rnd() * TAU;
    const length =
      (big ? GRAPH.primaryBaseNext : GRAPH.primaryBaseOther) +
      rnd() * (big ? GRAPH.primarySpreadNext : GRAPH.primarySpreadOther);

    grow(
      {
        x: centre.x + Math.cos(angle) * radius * GRAPH.arborOriginFraction,
        y: centre.y + Math.sin(angle) * radius * GRAPH.arborOriginFraction,
      },
      angle,
      length,
      big ? GRAPH.primaryWidthNext : GRAPH.primaryWidthOther,
      big ? GRAPH.depthNext : GRAPH.depthOther,
      1,
    );
  }

  return out;
}

/**
 * The axon: four tapering segments, thrown off roughly *across* the spine, plus a tuft.
 *
 * **`graph.jsx` aims it away from the direction of travel, not along it** — `tangent(i)`
 * plus one to two and a half radians, sign chosen by coin flip. Our previous axon aimed
 * at the next Leaf, which made every cell lean down the page in the same direction and
 * read as an arrow. Across the spine is what fills the gutter between the meander and
 * the labels with tissue instead of leaving it empty.
 */
function axonFor(
  rnd: () => number,
  centre: Point,
  radius: number,
  state: LeafNodeState,
  tangentAngle: number,
): { readonly axon: Curve; readonly tuft: Curve[] } {
  const big = state === 'next';
  const angleOffset = (rnd() > 0.5 ? 1 : -1) * (1.9 + rnd() * 0.9);

  let angle = tangentAngle + angleOffset;
  let cursor = {
    x: centre.x + Math.cos(angle) * radius * GRAPH.axonOriginFraction,
    y: centre.y + Math.sin(angle) * radius * GRAPH.axonOriginFraction,
  };

  const from = cursor;
  const segments: CubicSegment[] = [];
  // Annotated, not inferred: `GRAPH`'s `as const` types these literals as `1 | 0.7`,
  // and the taper below assigns arbitrary numbers into it.
  let width: number = big ? GRAPH.axonWidthNext : GRAPH.axonWidthOther;

  for (let index = 0; index < GRAPH.axonSegments; index += 1) {
    const length =
      (big ? GRAPH.axonLengthNext : GRAPH.axonLengthOther) - index * GRAPH.axonTaperPerSegment;
    const { curve, tip } = grownCurve(
      cursor,
      angle,
      length,
      signedBend(rnd, GRAPH.axonBend),
      width,
      1,
    );

    // One `Curve` rather than four, so the axon serialises as a single subpath and the
    // batching downstream keeps it in one bucket. The first segment's control points are
    // already relative to `cursor`, which is this segment's own start.
    segments.push(...curve.segments);

    cursor = tip;
    angle += (rnd() - 0.5) * 0.6;
    width = Math.max(GRAPH.axonMinWidth, width * GRAPH.axonWidthDecay);
  }

  const tuftCount = GRAPH.minTuft + Math.floor(rnd() * GRAPH.tuftSpread);
  const tuft: Curve[] = [];

  for (let index = 0; index < tuftCount; index += 1) {
    tuft.push(
      grownCurve(
        cursor,
        angle + (rnd() - 0.5) * 2.4,
        4 + rnd() * 7,
        signedBend(rnd, GRAPH.tuftBend),
        GRAPH.tuftWidth,
        GRAPH.tuftFade,
      ).curve,
    );
  }

  return {
    axon: {
      from,
      segments,
      strokeWidth: big ? GRAPH.axonWidthNext : GRAPH.axonWidthOther,
      opacity: GRAPH.axonFade,
      closed: false,
    },
    tuft,
  };
}

/* -------------------------------------------------------------------------- */
/* The layout                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The whole graph, from the Leaves' states, a viewport and a seed. Nothing else.
 *
 * Takes the *states* rather than the Leaves themselves: geometry has no business knowing
 * a Leaf's title or its id, but it does have to know whether a cell is the one the
 * reader is up to, because that changes its size and how much it grows. The component
 * pairs `geometry.nodes[i]` with `model.nodes[i]`, and this function stays testable
 * across the full 15–30 range from an array of string literals.
 */
export function layoutRoadmap(
  states: readonly LeafNodeState[],
  viewport: RoadmapViewport,
  seed: number,
): RoadmapGeometry {
  const rnd = mulberry32(seed);
  const width = Math.max(viewport.width, 1);
  const count = states.length;

  const step = clamp(
    (viewport.height * GRAPH.spanFraction) / Math.max(count - 1, 1),
    GRAPH.minStep,
    GRAPH.maxStep,
  );

  // Enough room above and below for a cell's dendritic field, so the first and last
  // Leaves are not shaved off by the frame.
  const verticalPadding = GRAPH.haloRadius + GRAPH.axonLengthNext;
  const height =
    count === 0 ? verticalPadding * 2 : verticalPadding * 2 + Math.max(count - 1, 0) * step;

  const band = width * GRAPH.spineBand;
  const centreX = width / 2;
  const amplitude = band / 2;

  // Two waves at incommensurate frequencies, each with its own phase, so the meander
  // never repeats over a Track's length and no two Tracks meander alike. Their
  // amplitudes sum to exactly 1, which is what keeps the spine inside the band by
  // construction rather than by clamping it afterwards.
  const phaseA = rnd() * TAU;
  const phaseB = rnd() * TAU;

  const centres: Point[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const wave = 0.6 * Math.sin(t * TAU * 1.5 + phaseA) + 0.4 * Math.sin(t * TAU * 2.7 + phaseB);

    centres.push({
      x: clamp(centreX + wave * amplitude, centreX - amplitude, centreX + amplitude),
      y: verticalPadding + index * step,
    });
  }

  const budget = dendriteBudgetPerNode(count);
  const nodes: RoadmapNodeGeometry[] = [];

  for (let index = 0; index < centres.length; index += 1) {
    const centre = centres[index];
    const state = states[index];

    if (centre === undefined || state === undefined) {
      continue;
    }

    const radius = GRAPH.radius[state];

    // Order matters: every draw from `rnd` below is part of the sequence that makes
    // this graph reproducible, so these calls must not be reordered casually.
    const soma = blob(rnd, centre, radius, GRAPH.somaJitter[state]);
    const halo =
      state === 'next' ? blob(rnd, centre, GRAPH.haloRadius, GRAPH.haloJitter) : null;
    const field = arborsFor(rnd, centre, state, radius, budget);
    const { axon, tuft } = axonFor(rnd, centre, radius, state, tangentAt(centres, index));

    nodes.push({
      index,
      state,
      centre,
      radius,
      soma,
      halo,
      dendrites: [...field.curves, ...tuft],
      axon,
      tips: field.buds,
      // **Outward, and the reason is distribution rather than room.** `graph.jsx` sends
      // a cell left of the frame's centre to the left gutter, which is not the wider of
      // its two gutters — the band is narrow and centred, so the far side is always
      // roomier. Splitting on the centre line is what halves the number of labels
      // stacking in each gutter, and the stacking is what fails first. Our previous
      // build sent them inward, which piled every label into the same column.
      labelSide: centre.x < centreX ? 'left' : 'right',
    });
  }

  const spine: Curve[] = [];

  for (let index = 0; index + 1 < centres.length; index += 1) {
    const from = centres[index];
    const to = centres[index + 1];

    if (from === undefined || to === undefined) {
      continue;
    }

    // The bow's sign follows the local turn rather than the PRNG. This is the one curve
    // on the screen the eye is meant to follow, and a randomly-signed bow at the current
    // node spacing turns it into a zigzag.
    const side = turnSign(centres, index);
    const budgetForBow = Math.hypot(to.x - from.x, to.y - from.y) * GRAPH.spineBow;
    const bow = side * Math.max(budgetForBow, GRAPH.minBend * 4);

    spine.push({
      from,
      segments: [bowedSegment(from, to, bow, bow)],
      strokeWidth: GRAPH.spineWidthAhead,
      opacity: 1,
      closed: false,
    });
  }

  const { web, webDots } = ambient(rnd, width, height);

  return {
    width,
    height,
    nodes,
    spine,
    web,
    webDots,
    pathCount: countPaths(nodes, spine, web, webDots),
  };
}

/**
 * Everything the renderer will be asked to draw, counted once, in one place.
 *
 * Includes the buds and the ambient dots: they are `<Circle>`-shaped in the source but
 * they are batched into the same path data here, and a count that quietly omitted them
 * would under-report the drawing by a fifth.
 */
function countPaths(
  nodes: readonly RoadmapNodeGeometry[],
  spine: readonly Curve[],
  web: readonly Curve[],
  webDots: readonly Dot[],
): number {
  return (
    web.length +
    webDots.length +
    spine.length +
    nodes.reduce(
      (total, node) =>
        total +
        node.dendrites.length +
        node.tips.length +
        // soma, axon, and the halo the next cell alone carries
        2 +
        (node.halo === null ? 0 : 1),
      0,
    )
  );
}

/** The direction of travel through a node, used to aim its axon away from the spine. */
function tangentAt(centres: readonly Point[], index: number): number {
  const before = centres[Math.max(0, index - 1)];
  const after = centres[Math.min(centres.length - 1, index + 1)];

  if (before === undefined || after === undefined) {
    return Math.PI / 2;
  }

  const dx = after.x - before.x;
  const dy = after.y - before.y;

  return dx === 0 && dy === 0 ? Math.PI / 2 : Math.atan2(dy, dx);
}

/**
 * Which side of the chord the spine should bow towards, from the local turn.
 *
 * Falls back to a fixed side when three Leaves are collinear, so a straight run arcs
 * gently and consistently rather than alternating.
 */
function turnSign(centres: readonly Point[], index: number): number {
  const from = centres[index];
  const to = centres[index + 1];
  const next = centres[index + 2] ?? centres[index - 1];

  if (from === undefined || to === undefined || next === undefined) {
    return 1;
  }

  const cross = (to.x - from.x) * (next.y - from.y) - (to.y - from.y) * (next.x - from.x);

  return cross === 0 ? 1 : Math.sign(cross);
}

/**
 * The faint tissue behind everything — `graph.jsx`'s `ambient()`.
 *
 * **This is where the first mockup went wrong**, and it is worth being explicit about:
 * the background was drawn as straight `<line>` elements between scattered points,
 * which is the definition of a star chart. These are bowed arcs between scattered dots
 * instead, plus loose wisps that end in nothing — same faintness, entirely different
 * reading. Our own previous version had swung too far the other way: eighteen very long,
 * very lazy curves, which read as stray hairs rather than as a mesh.
 */
function ambient(
  rnd: () => number,
  width: number,
  height: number,
): { readonly web: Curve[]; readonly webDots: Dot[] } {
  const dotCount = Math.min(
    GRAPH.maxWebDots,
    Math.max(8, Math.round(width * height * GRAPH.webDotsPerPixel)),
  );

  const dots: Dot[] = [];

  for (let index = 0; index < dotCount; index += 1) {
    dots.push({
      centre: { x: rnd() * width, y: rnd() * height },
      radius: GRAPH.webDotMinRadius + rnd() * GRAPH.webDotSpread,
      opacity: 1,
    });
  }

  const web: Curve[] = [];

  for (let i = 0; i < dots.length; i += 1) {
    for (let j = i + 1; j < dots.length; j += 1) {
      const a = dots[i];
      const b = dots[j];

      if (a === undefined || b === undefined) {
        continue;
      }

      const distance = Math.hypot(a.centre.x - b.centre.x, a.centre.y - b.centre.y);

      if (distance >= GRAPH.webLinkDistance || rnd() <= GRAPH.webLinkChance) {
        continue;
      }

      const bow = signedBend(rnd, GRAPH.webBend) * distance;

      web.push({
        from: a.centre,
        segments: [bowedSegment(a.centre, b.centre, bow, bow)],
        strokeWidth: GRAPH.webStrokeWidth,
        opacity: 1,
        closed: false,
      });
    }
  }

  const wisps = Math.round(dots.length * GRAPH.webWispsPerDot);

  for (let index = 0; index < wisps; index += 1) {
    const anchor = dots[Math.floor(rnd() * dots.length)];

    if (anchor === undefined) {
      continue;
    }

    web.push(
      grownCurve(
        anchor.centre,
        rnd() * TAU,
        10 + rnd() * 22,
        signedBend(rnd, 1.1),
        GRAPH.wispStrokeWidth,
        0.9,
        ).curve,
    );
  }

  return { web, webDots: dots };
}

/** The tappable square centred on a node. The drawn soma is much smaller than this. */
export const NODE_TOUCH_SIZE = MIN_TOUCH_TARGET;

/** The next cell's aura, which the component also draws as a breathing ring. */
export const HALO_RADIUS = GRAPH.haloRadius;

/** How far a label sits off the edge of its node. */
export const LABEL_GAP = 12;

export const SPINE_WIDTH = {
  ahead: GRAPH.spineWidthAhead,
  travelled: GRAPH.spineWidthTravelled,
} as const;
