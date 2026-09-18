/**
 * Paint for the intro's neuron network — teal only, batched the way
 * `constellationLayers.ts` and `TrackRoadmap.tsx` batch theirs, for the same reason:
 * dozens of `<Path>`s render, thousands of individual ones do not.
 *
 * **Not `buildDoneConstellationLayers`, and this is the finding the handoff asked for.**
 * That function is fed all-`done` geometry and paints every soma's ring and core bud in
 * `theme.palette.reward` — the earned-progress colour. Nobody has read anything before
 * sign-in, and the handoff is explicit that amber is reserved for beat 4's travelling
 * signal and appears nowhere else. Reusing it would put reward amber on every node ring
 * in the fixture, none of which the reader has earned, so this is a new, smaller painter
 * instead: reached tissue (`done`/`next`) in `palette.primary`, unreached (`locked`) in
 * `palette.border` — the same two-tone grammar `TrackRoadmap.tsx` already draws, minus
 * every reward-coloured element (no core buds at all here, for the same reason).
 */

import type { Theme } from '../../design';
import { curvePath, type Curve, type Dot, type RoadmapGeometry } from '../track/roadmapGeometry';

export interface IntroLayer {
  readonly key: string;
  readonly d: string;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly opacity: number;
}

export interface IntroPaint {
  readonly layers: readonly IntroLayer[];
  /**
   * The spine as **one** continuous subpath, spine-gap curves joined rather than each
   * carrying its own `M` — see `IntroScreen.tsx`'s pulse. `curvePath` per curve (used for
   * the static layer above) would reset an SVG dash phase at every `M`, which reads as
   * several signals firing at once instead of one travelling the whole line.
   */
  readonly spinePath: string;
  /** Chord-length approximation (bows are gentle — `roadmapGeometry.ts`'s `spineBow` is
   *  0.12 — so this is within a few percent of the true arc length), for sizing the
   *  pulse's dash pattern to this graph's actual size rather than a guessed constant. */
  readonly spineLength: number;
}

/** `graph.jsx`/`TrackRoadmap.tsx`: reached tissue drawn back, unreached forward. */
const REACHED_PROCESS_OPACITY = 0.44;
const UNREACHED_PROCESS_OPACITY = 0.8;
const HALO_FILL_OPACITY = 0.07;
const HALO_STROKE_OPACITY = 0.32;
const SPINE_OPACITY = 0.7;
const SPINE_WIDTH = 1.75;
const SOMA_RING_OPACITY = 1;

export function buildIntroLayers(geometry: RoadmapGeometry, theme: Theme): IntroPaint {
  const page = theme.surfaceFor('page');
  const batch = new Map<string, { d: string; layer: Omit<IntroLayer, 'd'> }>();

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

  for (const curve of geometry.web) {
    add('web', curvePath(curve), 'none', theme.palette.border, curve.strokeWidth, 0.4);
  }

  for (const dot of geometry.webDots) {
    add('web-dot', dotPath(dot), theme.palette.surface3, 'none', 0, 1);
  }

  for (const node of geometry.nodes) {
    const reached = node.state === 'done' || node.state === 'next';
    const colour = reached ? theme.palette.primary : theme.palette.border;
    const processOpacity = reached ? REACHED_PROCESS_OPACITY : UNREACHED_PROCESS_OPACITY;

    for (const dendrite of node.dendrites) {
      add(
        'dendrite',
        curvePath(dendrite),
        'none',
        colour,
        round(dendrite.strokeWidth),
        round(processOpacity * dendrite.opacity),
      );
    }

    add(
      'axon',
      curvePath(node.axon),
      'none',
      colour,
      round(node.axon.strokeWidth),
      round(processOpacity * node.axon.opacity),
    );

    for (const bud of node.tips) {
      add('bud', dotPath(bud), colour, 'none', 0, round(processOpacity * bud.opacity));
    }
  }

  for (const node of geometry.nodes) {
    if (node.halo === null) {
      continue;
    }

    const halo = curvePath(node.halo);

    add('halo', halo, theme.palette.primary, 'none', 0, HALO_FILL_OPACITY);
    add('halo-ring', halo, 'none', theme.palette.primary, 1.5, HALO_STROKE_OPACITY);
  }

  // Cell bodies last, so nothing draws over them. Fill plus a hairline ring only — no
  // core bud, which in both reference files is the reward-coloured "earned" mark this
  // painter deliberately has no equivalent of.
  for (const node of geometry.nodes) {
    const reached = node.state === 'done' || node.state === 'next';
    const colour = reached ? theme.palette.primary : theme.palette.border;
    const body = curvePath(node.soma);

    add('soma', body, page, 'none', 0, 1);
    add('soma-ring', body, 'none', colour, theme.borderWidth.hairline, SOMA_RING_OPACITY);
  }

  for (const curve of geometry.spine) {
    add('spine', curvePath(curve), 'none', theme.palette.primary, SPINE_WIDTH, SPINE_OPACITY);
  }

  return {
    layers: [...batch.values()].map((entry) => ({ ...entry.layer, d: entry.d })),
    spinePath: chainedPath(geometry.spine),
    spineLength: chordLength(geometry.spine),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function fixed(value: number): string {
  return value.toFixed(2);
}

/** One continuous subpath through every spine curve — see `IntroPaint.spinePath`. */
function chainedPath(curves: readonly Curve[]): string {
  const first = curves[0];

  if (first === undefined) {
    return '';
  }

  const head = `M${fixed(first.from.x)},${fixed(first.from.y)}`;
  const body = curves
    .flatMap((curve) => curve.segments)
    .map(
      (segment) =>
        `C${fixed(segment.c1.x)},${fixed(segment.c1.y)} ${fixed(segment.c2.x)},${fixed(
          segment.c2.y,
        )} ${fixed(segment.to.x)},${fixed(segment.to.y)}`,
    )
    .join(' ');

  return `${head}${body}`;
}

/** Straight-line distance from each curve's `from` to its final `to` — see `spineLength`. */
function chordLength(curves: readonly Curve[]): number {
  return curves.reduce((total, curve) => {
    const last = curve.segments[curve.segments.length - 1];

    if (last === undefined) {
      return total;
    }

    return total + Math.hypot(last.to.x - curve.from.x, last.to.y - curve.from.y);
  }, 0);
}

/** Same construction as `TrackRoadmap.tsx`'s private `dotPath` — a dot as a closed path. */
function dotPath(dot: Dot): string {
  const { centre, radius } = dot;
  const k = radius * 0.5523;

  return (
    `M${fixed(centre.x - radius)},${fixed(centre.y)}` +
    `C${fixed(centre.x - radius)},${fixed(centre.y - k)} ` +
    `${fixed(centre.x - k)},${fixed(centre.y - radius)} ` +
    `${fixed(centre.x)},${fixed(centre.y - radius)}` +
    `C${fixed(centre.x + k)},${fixed(centre.y - radius)} ` +
    `${fixed(centre.x + radius)},${fixed(centre.y - k)} ` +
    `${fixed(centre.x + radius)},${fixed(centre.y)}` +
    `C${fixed(centre.x + radius)},${fixed(centre.y + k)} ` +
    `${fixed(centre.x + k)},${fixed(centre.y + radius)} ` +
    `${fixed(centre.x)},${fixed(centre.y + radius)}` +
    `C${fixed(centre.x - k)},${fixed(centre.y + radius)} ` +
    `${fixed(centre.x - radius)},${fixed(centre.y + k)} ` +
    `${fixed(centre.x - radius)},${fixed(centre.y)}Z`
  );
}
