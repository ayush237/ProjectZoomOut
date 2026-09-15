import {
  layoutRoadmap,
  seedFromTrackId,
  type RoadmapGeometry,
  type RoadmapViewport,
} from './track/roadmapGeometry';
import type { LeafNodeState } from './track/roadmapModel';

/**
 * A compressed strip of a Track's graph, for Journey's per-row progress indicator
 * (screen-04, WP27) — "use a compressed strip of each Track's graph as the progress
 * indicator instead of a plain bar."
 *
 * **Consumes `layoutRoadmap`, and re-derives nothing about the shape itself.** The
 * geometry's node spacing has a floor (`GRAPH.minStep`) that does not relax for a small
 * viewport, so a 20-Leaf Track is several hundred points tall regardless of what height
 * is asked for — "compressed" cannot mean "the whole graph, shrunk to fit a row." What
 * this module does instead is what a camera does: it asks for the **full** geometry, at
 * the same seed a full-size roadmap for this Track would use, and returns a small
 * vertical window of it centred on the Leaf the reader is actually up to. Same seed, same
 * states, same shape — which is what "matches the roadmap's shape for the same Track"
 * (the acceptance criterion) means in practice: this is a crop, not a re-layout.
 */

/** Fixed width for the strip's own coordinate space; the row scales the SVG to fit. */
const STRIP_VIEWPORT: RoadmapViewport = { width: 48, height: 480 };

/** How much of the cropped geometry is visible at once. */
export const STRIP_WINDOW_HEIGHT = 96;

export interface ProgressStrip {
  readonly geometry: RoadmapGeometry;
  /** The window's top edge, in the geometry's own coordinate space. */
  readonly windowY: number;
  /** Index into `geometry.nodes` the window is centred on. */
  readonly focusIndex: number;
}

/**
 * Builds the strip, or null for a Track with no Leaves — there is no graph to crop.
 */
export function buildProgressStrip(
  trackId: string,
  states: readonly LeafNodeState[],
): ProgressStrip | null {
  if (states.length === 0) {
    return null;
  }

  const geometry = layoutRoadmap(states, STRIP_VIEWPORT, seedFromTrackId(trackId));
  const focusIndex = selectFocusIndex(states);
  const focusNode = geometry.nodes[focusIndex];

  // Unreachable given the guard above and `selectFocusIndex`'s own range, but
  // `noUncheckedIndexedAccess` cannot see that from here.
  const focusY = focusNode?.centre.y ?? geometry.height / 2;

  /**
   * Not clamped against `geometry.height` on the low side: `GRAPH`'s vertical padding
   * alone (halo radius plus the next node's axon reach) is 55pt at each end, so even a
   * single-Leaf Track is 110pt tall — always taller than the 96pt window. There is no
   * real Track short enough for the window to need shrinking instead of cropping.
   */
  const maxY = Math.max(geometry.height - STRIP_WINDOW_HEIGHT, 0);
  const windowY = clamp(focusY - STRIP_WINDOW_HEIGHT / 2, 0, maxY);

  return { geometry, windowY, focusIndex };
}

/**
 * Which node the strip centres on.
 *
 * **`next` when there is one** — the Leaf the reader would resume at, which is the
 * entire reason this row is on Journey. Falls back to the last `done` node for a track
 * this function is never actually handed one for in production (Journey filters to
 * `nextLeafId !== null`), and to the middle of the track failing that — so the function
 * still returns something sensible rather than throwing, if it is ever reused somewhere
 * `next` is not guaranteed.
 */
export function selectFocusIndex(states: readonly LeafNodeState[]): number {
  const nextIndex = states.indexOf('next');

  if (nextIndex !== -1) {
    return nextIndex;
  }

  const lastDoneIndex = states.lastIndexOf('done');

  if (lastDoneIndex !== -1) {
    return lastDoneIndex;
  }

  return Math.floor((states.length - 1) / 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
