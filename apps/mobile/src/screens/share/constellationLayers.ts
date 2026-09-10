/**
 * Paint for the finished constellation on the Track-complete screen.
 *
 * **Every node here is `done`.** A finished Track has no `next`, `locked` or `revisit`
 * cell, so this is a single-state reduction of `TrackRoadmap.tsx`'s four-state
 * `buildLayers` — not a copy of it. That function is private to the roadmap screen,
 * which WP26 leaves untouched by instruction, and the paint a fully-lit graph needs is
 * simpler than the general case regardless: one colour for read tissue, one for the
 * reward ring and bud, no halo, no dash. The geometry underneath is the same real
 * `layoutRoadmap` output the roadmap screen draws, seeded the same way (`seedFromTrackId`
 * on the same Track id), so the two shapes agree by construction.
 *
 * Curves are batched into one `<Path>` per distinct (colour, width, opacity) combination
 * — same reason as the roadmap screen: dozens of paths render, thousands of individual
 * `<Path>` elements do not.
 */

import type { Theme } from '../../design';
import { curvePath, type Dot, type RoadmapGeometry } from '../track/roadmapGeometry';

export interface ConstellationLayer {
  readonly key: string;
  readonly d: string;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly opacity: number;
}

/** `graph.jsx`/`TrackRoadmap`: reached tissue is drawn back, at this opacity. */
const REACHED_PROCESS_OPACITY = 0.44;
const SPINE_OPACITY = 0.75;
const SPINE_WIDTH = 1.75;
const CORE_RADIUS = 2.9;

export function buildDoneConstellationLayers(
  geometry: RoadmapGeometry,
  theme: Theme,
): readonly ConstellationLayer[] {
  const page = theme.surfaceFor('page');
  const batch = new Map<string, { d: string; layer: Omit<ConstellationLayer, 'd'> }>();

  const add = (
    bucket: string,
    d: string,
    fill: string,
    stroke: string,
    strokeWidth: number,
    opacity: number,
  ): void => {
    const key = `${bucket}|${fill}|${stroke}|${strokeWidth.toFixed(2)}|${opacity.toFixed(2)}`;
    const existing = batch.get(key);

    if (existing === undefined) {
      batch.set(key, { d, layer: { key, fill, stroke, strokeWidth, opacity } });
      return;
    }

    existing.d = `${existing.d} ${d}`;
  };

  // Every gap is "travelled" — the whole spine is read once the Track is finished.
  for (const curve of geometry.spine) {
    add('spine', curvePath(curve), 'none', theme.palette.primary, SPINE_WIDTH, SPINE_OPACITY);
  }

  for (const node of geometry.nodes) {
    for (const dendrite of node.dendrites) {
      add(
        'dendrite',
        curvePath(dendrite),
        'none',
        theme.palette.primary,
        round(dendrite.strokeWidth),
        round(REACHED_PROCESS_OPACITY * dendrite.opacity),
      );
    }

    add(
      'axon',
      curvePath(node.axon),
      'none',
      theme.palette.primary,
      round(node.axon.strokeWidth),
      round(REACHED_PROCESS_OPACITY * node.axon.opacity),
    );

    for (const bud of node.tips) {
      add(
        'bud',
        dotPath(bud),
        theme.palette.primary,
        'none',
        0,
        round(REACHED_PROCESS_OPACITY * bud.opacity),
      );
    }
  }

  // Cell bodies last, so nothing is drawn over them.
  for (const node of geometry.nodes) {
    add('soma', curvePath(node.soma), page, 'none', 0, 1);
    add('soma-ring', curvePath(node.soma), 'none', theme.palette.reward, theme.borderWidth.hairline, 1);
    add(
      'core',
      dotPath({ centre: node.centre, radius: CORE_RADIUS, opacity: 1 }),
      theme.palette.reward,
      'none',
      0,
      1,
    );
  }

  return [...batch.values()].map((entry) => ({ ...entry.layer, d: entry.d }));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A dot as a closed path — same construction as `TrackRoadmap.tsx`'s private `dotPath`. */
function dotPath(dot: Dot): string {
  const { centre, radius } = dot;
  const k = radius * 0.5523;

  return (
    `M${(centre.x - radius).toFixed(2)},${centre.y.toFixed(2)}` +
    `C${(centre.x - radius).toFixed(2)},${(centre.y - k).toFixed(2)} ` +
    `${(centre.x - k).toFixed(2)},${(centre.y - radius).toFixed(2)} ` +
    `${centre.x.toFixed(2)},${(centre.y - radius).toFixed(2)}` +
    `C${(centre.x + k).toFixed(2)},${(centre.y - radius).toFixed(2)} ` +
    `${(centre.x + radius).toFixed(2)},${(centre.y - k).toFixed(2)} ` +
    `${(centre.x + radius).toFixed(2)},${centre.y.toFixed(2)}` +
    `C${(centre.x + radius).toFixed(2)},${(centre.y + k).toFixed(2)} ` +
    `${(centre.x + k).toFixed(2)},${(centre.y + radius).toFixed(2)} ` +
    `${centre.x.toFixed(2)},${(centre.y + radius).toFixed(2)}` +
    `C${(centre.x - k).toFixed(2)},${(centre.y + radius).toFixed(2)} ` +
    `${(centre.x - radius).toFixed(2)},${(centre.y + k).toFixed(2)} ` +
    `${(centre.x - radius).toFixed(2)},${centre.y.toFixed(2)}Z`
  );
}
