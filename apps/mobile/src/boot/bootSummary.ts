import type { Track } from '@zoomout/shared';

/**
 * View model for the boot screen.
 *
 * Deliberately a pure function over a shared domain type: it is what proves the
 * workspace wiring end to end — `Track` is imported from `packages/shared`, typechecks
 * under the mobile app's strict config, and is consumed at runtime — without needing
 * a rendered component to demonstrate it.
 *
 * It also carries two things that are product requirements rather than decoration:
 * the non-endorsement disclaimer, which every Track must surface, and the placeholder
 * warning, which must be impossible to miss while Phase 1 runs on mock content.
 */
export interface BootSummary {
  readonly headline: string;
  readonly byline: string;
  readonly disclaimer: string;
  /** Non-null only while the Track is flagged as mock content (plan §3.4). */
  readonly placeholderWarning: string | null;
}

const PLACEHOLDER_WARNING =
  'Placeholder content — not real claims about this book or its author.';

export function buildBootSummary(track: Track): BootSummary {
  return {
    headline: track.bookTitle,
    byline: `${track.author} · ${String(track.leafCount)} ${pluraliseLeaves(track.leafCount)}`,
    disclaimer: track.disclaimer,
    placeholderWarning: track.isPlaceholder ? PLACEHOLDER_WARNING : null,
  };
}

function pluraliseLeaves(count: number): string {
  return count === 1 ? 'Leaf' : 'Leaves';
}
