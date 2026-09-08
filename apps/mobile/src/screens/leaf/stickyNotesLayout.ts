/**
 * The sticky-notes board layout: a pure predicate over text size and note count.
 *
 * Separated from `StickyNotesSlide.tsx` for the same reason `roadmapGeometry.ts` is
 * separate from `TrackRoadmap.tsx` (WP22): "does this collapse at the right size and
 * the right note count" is answerable as a unit test rather than a device session.
 */

export type BoardLayout = 'staggered' | 'singleColumn';

/**
 * Below three notes, a wrapped two-up row is just two notes side by side — nothing to
 * stagger, and it reads as two fragments rather than a board. Always single-column
 * here, regardless of text size.
 */
const MIN_NOTES_TO_STAGGER = 3;

/**
 * The OS font-scale multiplier (`useWindowDimensions().fontScale`) at and above which
 * the board collapses to one column.
 *
 * **Chosen empirically, on a device, against the real corpus** — see the WP23
 * completion report for the reading and what was observed at each size. Set with real
 * margin below `accessibilityExtraExtraExtraLarge` (~2.85), which is where this
 * component's pre-redesign docstring already found a two-column arrangement failing
 * outright: a column roughly half the screen width stops being able to hold a note's
 * text without clipping it well before the OS reaches its largest setting.
 */
const COLLAPSE_FONT_SCALE = 1.7;

export function boardLayout(noteCount: number, fontScale: number): BoardLayout {
  if (noteCount < MIN_NOTES_TO_STAGGER) {
    return 'singleColumn';
  }

  return fontScale >= COLLAPSE_FONT_SCALE ? 'singleColumn' : 'staggered';
}
