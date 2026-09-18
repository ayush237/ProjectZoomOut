import type { Point, RoadmapGeometry } from '../track/roadmapGeometry';

/**
 * Where the camera sits: a uniform scale, centred on a world point.
 *
 * Kept as `{scale, focus}` rather than a ready-made transform matrix because
 * `IntroScreen` needs to animate `scale`, `focus.x` and `focus.y` as three independent
 * Reanimated shared values — see that file for the transform this becomes.
 */
export interface CameraFrame {
  readonly scale: number;
  readonly focus: Point;
}

/**
 * Beat 1's magnification. Chosen by looking (see the completion report): loose enough
 * that a full dendritic field is in frame, tight enough that it reads as one cell rather
 * than a neighbourhood of them.
 */
export const INTRO_FOCUS_SCALE = 6;

/** The uniform scale that fits `geometry` entirely inside `viewport`, centred. */
export function fitScale(
  geometry: RoadmapGeometry,
  viewport: { readonly width: number; readonly height: number },
): number {
  return Math.min(viewport.width / geometry.width, viewport.height / geometry.height);
}

/**
 * Beat 1's frame (tight on one node) and beat 4's (the whole graph, fitted) — the two
 * ends of the intro's single continuous camera move.
 *
 * **Zooming out, literally.** `end.scale` is almost always smaller than
 * `INTRO_FOCUS_SCALE`: `layoutRoadmap` lays out `INTRO_STATES.length` nodes at a fixed
 * per-node step regardless of viewport height (`roadmapGeometry.ts`'s own doc), so the
 * fixture's graph is taller than one screen and `end.scale` is usually the
 * height-constrained branch of `fitScale`, below 1. The product's own name is the reason
 * this is treated as a feature rather than tuned away.
 */
export function introCameraFrames(
  geometry: RoadmapGeometry,
  focusIndex: number,
  viewport: { readonly width: number; readonly height: number },
): { readonly start: CameraFrame; readonly end: CameraFrame } {
  const end: CameraFrame = {
    scale: fitScale(geometry, viewport),
    focus: { x: geometry.width / 2, y: geometry.height / 2 },
  };

  const focusNode = geometry.nodes[focusIndex];

  const start: CameraFrame = {
    scale: INTRO_FOCUS_SCALE,
    focus: focusNode?.centre ?? end.focus,
  };

  return { start, end };
}
