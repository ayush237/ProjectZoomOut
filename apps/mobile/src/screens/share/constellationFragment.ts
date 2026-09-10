/**
 * A crop of the reader's own constellation, sized for the share card's mascot slot.
 *
 * **Selects from the real geometry; nothing here generates a shape.** `layoutRoadmap`
 * already produced the Track's constellation for the Track-complete screen — this picks
 * a centred run of nodes out of that same `RoadmapGeometry` and projects them into a
 * small box, rather than asking a second, bespoke generator for something that merely
 * *looks* related. Same seed, same nodes, same curves in, every time.
 *
 * **The projection transposes.** `layoutRoadmap` lays a Track out top-to-bottom — a
 * narrow horizontal meander down a tall column — and the mascot slot is wide and short.
 * A crop that kept the geometry's own axes would show at most one or two nodes before
 * running out of height. Swapping axes (geometry `y` becomes fragment `x`) is what makes
 * a short, wide band show a run of nodes instead of a sliver.
 *
 * **Dendrites, tips and the soma's own outline are dropped.** `ShareCard`'s docstring
 * already treats everything below the headline and the book as texture that is allowed
 * to simplify at thumbnail size; re-deriving fine detail rotated into a box it was never
 * laid out for would be new geometry wearing the old one's name. The spine and the node
 * centres are what read as "a constellation" at 64pt tall — the rest would not survive
 * the shrink anyway.
 */

import {
  curvePath,
  type Curve,
  type Point,
  type RoadmapGeometry,
  type RoadmapNodeGeometry,
} from '../track/roadmapGeometry';

export interface ConstellationFragment {
  readonly width: number;
  readonly height: number;
  /** One concatenated path, empty when there are fewer than two selected nodes. */
  readonly spineD: string;
  readonly nodePoints: readonly Point[];
}

/** How much of the box's shorter side is left as breathing room around the crop. */
const FRAGMENT_MARGIN_FRACTION = 0.12;

/**
 * A centred, contiguous run of `count` nodes.
 *
 * Centred rather than the first `count`: the first node of a Track is visually no more
 * "the constellation" than the last, and a middle slice reads as an excerpt rather than
 * as a beginning. Returns every node, in order, when there are `count` or fewer.
 */
export function selectFragmentNodes(
  nodes: readonly RoadmapNodeGeometry[],
  count: number,
): readonly RoadmapNodeGeometry[] {
  if (count <= 0 || nodes.length === 0) {
    return [];
  }

  if (nodes.length <= count) {
    return nodes;
  }

  const start = Math.floor((nodes.length - count) / 2);
  return nodes.slice(start, start + count);
}

/**
 * Projects the selected nodes and the spine segments between them into `box`.
 *
 * `box` is the fragment's own pixel size (the mascot slot), not the source geometry's —
 * the whole point is to fit a piece of a tall, narrow graph into a short, wide one.
 */
export function buildConstellationFragment(
  geometry: RoadmapGeometry,
  count: number,
  box: { readonly width: number; readonly height: number },
): ConstellationFragment {
  const selected = selectFragmentNodes(geometry.nodes, count);

  if (selected.length === 0) {
    return { width: box.width, height: box.height, spineD: '', nodePoints: [] };
  }

  // Transposed on purpose — see the file docstring. Geometry `y` (down the spine)
  // becomes the fragment's `x` (across the band); geometry `x` (the meander) becomes
  // the fragment's `y`.
  const xs = selected.map((node) => node.centre.y);
  const ys = selected.map((node) => node.centre.x);

  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), 1);
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), 1);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  const margin = Math.min(box.width, box.height) * FRAGMENT_MARGIN_FRACTION;
  const availableWidth = Math.max(box.width - margin * 2, 1);
  const availableHeight = Math.max(box.height - margin * 2, 1);
  const scale = Math.min(availableWidth / spanX, availableHeight / spanY);

  const offsetX = margin + (availableWidth - spanX * scale) / 2;
  const offsetY = margin + (availableHeight - spanY * scale) / 2;

  const project = (point: Point): Point => ({
    x: offsetX + (point.y - minX) * scale,
    y: offsetY + (point.x - minY) * scale,
  });

  const spineCurves: Curve[] = [];
  const first = selected[0];
  const last = selected[selected.length - 1];

  if (first !== undefined && last !== undefined) {
    for (let index = first.index; index < last.index; index += 1) {
      const segment = geometry.spine[index];

      if (segment !== undefined) {
        spineCurves.push(transformCurve(segment, project));
      }
    }
  }

  return {
    width: box.width,
    height: box.height,
    spineD: spineCurves.map((curve) => curvePath(curve)).join(' '),
    nodePoints: selected.map((node) => project(node.centre)),
  };
}

function transformCurve(curve: Curve, project: (point: Point) => Point): Curve {
  return {
    ...curve,
    from: project(curve.from),
    segments: curve.segments.map((segment) => ({
      c1: project(segment.c1),
      c2: project(segment.c2),
      to: project(segment.to),
    })),
  };
}
