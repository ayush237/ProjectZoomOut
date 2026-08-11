/**
 * Shape and spacing, from `design-direction.md` §5.
 *
 * Generous radii carry most of the playful register on their own, and fully rounded
 * buttons are the single cheapest signal that this is a game-shaped product rather
 * than a reader. That is why `radius.full` exists as a token rather than as a `999`
 * someone types into a stylesheet.
 */

/** 4pt base. Anything not on this scale is a mistake, not a refinement. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  /** Inputs, chips. */
  sm: 8,
  /** The default for anything not named below. */
  md: 12,
  /** Cards, sheets, slide containers. */
  lg: 20,
  /** Buttons, pills, streak badges. */
  full: 999,
} as const;

/**
 * Elevation names a **surface**, never a shadow (§5).
 *
 * Shadows are invisible on a dark background, so a shadow-based depth system would
 * silently do nothing in the app's default theme — the bug would be that everything
 * looks flat, with no failing test and nothing obviously wrong in the code.
 *
 * `elevation.raised` resolves to a palette key. A component reads it and sets a
 * background colour; there is no `shadowOpacity` anywhere in this app by design.
 */
export const elevation = {
  page: 'surface0',
  card: 'surface1',
  raised: 'surface2',
  pressed: 'surface3',
} as const;

export type ElevationLevel = keyof typeof elevation;

/** Hairline separation between surfaces, which does the work a shadow would. */
export const borderWidth = {
  hairline: 1,
  focus: 2,
} as const;

/** Minimum tappable size. Below this, a control is a bug on a real device. */
export const MIN_TOUCH_TARGET = 44;
