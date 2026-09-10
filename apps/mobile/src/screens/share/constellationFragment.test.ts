import type { Curve, Point, RoadmapGeometry, RoadmapNodeGeometry } from '../track/roadmapGeometry';
import { buildConstellationFragment, selectFragmentNodes } from './constellationFragment';

/**
 * Tier A. Both functions decide what a stranger sees on a card a reader posts, and
 * neither can be checked on a device without contriving an 18-Leaf account first.
 */

function flatCurve(from: Point, to: Point): Curve {
  return { from, segments: [{ c1: from, c2: to, to }], strokeWidth: 1, opacity: 1, closed: false };
}

function node(index: number, x: number, y: number): RoadmapNodeGeometry {
  return {
    index,
    state: 'done',
    centre: { x, y },
    radius: 6.5,
    soma: flatCurve({ x, y }, { x, y }),
    halo: null,
    dendrites: [],
    axon: flatCurve({ x, y }, { x, y }),
    tips: [],
    labelSide: 'left',
  };
}

/** A tall, narrow column of `count` nodes — the shape every real Track produces. */
function columnGeometry(count: number): RoadmapGeometry {
  const nodes = Array.from({ length: count }, (_, index) => node(index, 150 + (index % 2) * 10, index * 40));
  const spine: Curve[] = [];

  for (let index = 0; index < nodes.length - 1; index += 1) {
    const from = nodes[index];
    const to = nodes[index + 1];

    if (from !== undefined && to !== undefined) {
      spine.push(flatCurve(from.centre, to.centre));
    }
  }

  return { width: 320, height: count * 40, nodes, spine, web: [], webDots: [], pathCount: 0 };
}

describe('selectFragmentNodes', () => {
  it('returns every node when there are fewer than the requested count', () => {
    const nodes = [node(0, 0, 0), node(1, 0, 40)];

    expect(selectFragmentNodes(nodes, 6)).toEqual(nodes);
  });

  it('returns every node when the count matches exactly', () => {
    const nodes = [node(0, 0, 0), node(1, 0, 40), node(2, 0, 80)];

    expect(selectFragmentNodes(nodes, 3)).toEqual(nodes);
  });

  it('selects a centred, contiguous run rather than the first N', () => {
    const geometry = columnGeometry(10);

    const selected = selectFragmentNodes(geometry.nodes, 4);

    // 10 nodes, 4 wanted: start = floor((10-4)/2) = 3, so indices 3..6.
    expect(selected.map((n) => n.index)).toEqual([3, 4, 5, 6]);
  });

  it('returns nothing for an empty geometry or a non-positive count', () => {
    expect(selectFragmentNodes([], 4)).toEqual([]);
    expect(selectFragmentNodes(columnGeometry(5).nodes, 0)).toEqual([]);
  });
});

describe('buildConstellationFragment', () => {
  const BOX = { width: 280, height: 64 };

  it('produces one projected point per selected node, each inside the box', () => {
    const geometry = columnGeometry(18);

    const fragment = buildConstellationFragment(geometry, 6, BOX);

    expect(fragment.nodePoints).toHaveLength(6);

    for (const point of fragment.nodePoints) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(BOX.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(BOX.height);
    }
  });

  it('transposes a tall column into a wide band', () => {
    // The source column barely moves in x (150/160 alternating) and moves a great deal
    // in y (0..680) — a portrait shape. A fragment that did not rotate it would inherit
    // that: almost no horizontal spread, a great deal of vertical spread. The whole
    // point of the transpose is that the fragment does the opposite.
    const geometry = columnGeometry(18);

    const fragment = buildConstellationFragment(geometry, 6, BOX);
    const xs = fragment.nodePoints.map((p) => p.x);
    const ys = fragment.nodePoints.map((p) => p.y);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);

    expect(spreadX).toBeGreaterThan(spreadY);
  });

  it('connects consecutive selected nodes with one non-empty spine path', () => {
    const geometry = columnGeometry(18);

    const fragment = buildConstellationFragment(geometry, 6, BOX);

    expect(fragment.spineD.length).toBeGreaterThan(0);
    // Five gaps between six selected nodes, each an "M...C..." subpath.
    expect(fragment.spineD.match(/M/gu)).toHaveLength(5);
  });

  it('handles an empty geometry without throwing', () => {
    const empty: RoadmapGeometry = { width: 0, height: 0, nodes: [], spine: [], web: [], webDots: [], pathCount: 0 };

    expect(buildConstellationFragment(empty, 6, BOX)).toEqual({
      width: BOX.width,
      height: BOX.height,
      spineD: '',
      nodePoints: [],
    });
  });
});
