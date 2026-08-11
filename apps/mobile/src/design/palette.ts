/**
 * Colour tokens for both themes.
 *
 * Structure is from `design-direction.md` §3 and should not drift; the dark hexes are
 * its starting values, unchanged. The light values are new here — §3 specifies that a
 * light theme exists from day one with **its own values**, because a colour tuned for a
 * dark background is the wrong colour on a light one.
 *
 * Two rules the structure encodes:
 *
 *  1. **Elevation is separation from the page, not a shadow.** On dark that means each
 *     level is lighter than the last. On light it means each level is *darker* — the
 *     page is already white, so the only direction away from it is down. Same rule,
 *     opposite sign, and `elevation/1` still means "render on `surface/1`" in both.
 *  2. **Nothing is shared between themes but the token names.** There is deliberately
 *     no "base palette" both themes reference; that is the mechanism by which a value
 *     tuned for one background silently ends up on the other.
 *
 * Every text-on-surface pairing here is checked against WCAG AA in `palette.test.ts`,
 * per elevation level. These values were tuned until that passed, not asserted to.
 */

export interface Palette {
  readonly surface0: string;
  readonly surface1: string;
  readonly surface2: string;
  readonly surface3: string;
  readonly border: string;

  readonly primary: string;
  readonly primaryHover: string;
  readonly primaryPress: string;
  readonly onPrimary: string;

  readonly reward: string;
  readonly rewardSoft: string;
  readonly onReward: string;

  readonly correct: string;
  readonly incorrect: string;

  readonly textPrimary: string;
  readonly textMuted: string;
}

/**
 * Dark — the default theme.
 *
 * Values as specified in §3, with one addition: `textMuted` was darkened from the
 * document's `#9AAAB5`. That value is 4.5:1 on `surface/0` but drops to 4.06:1 by
 * `surface/3`, and §3 requires the check against the surface the text actually sits
 * on. `#A7B6C0` clears 4.5:1 at every level.
 */
export const darkPalette: Palette = {
  surface0: '#0B0F12',
  surface1: '#141A1E',
  surface2: '#1C242A',
  surface3: '#26313A',
  border: '#2E3A44',

  primary: '#3DDCC8',
  primaryHover: '#5FE6D5',
  primaryPress: '#26B8A6',
  onPrimary: '#0B0F12',

  reward: '#FFB020',
  rewardSoft: '#FFC44D',
  onReward: '#0B0F12',

  correct: '#4ADE80',
  incorrect: '#FF6B6B',

  textPrimary: '#F2F5F7',
  textMuted: '#A7B6C0',
};

/**
 * Light — supported from day one, never the default.
 *
 * The accents are materially darker than their dark-theme counterparts: `#3DDCC8` on
 * white is 1.6:1, effectively invisible as text or as a fill behind white text. The
 * teal here is deep enough to carry white text, and the amber deep enough to do the
 * same — an amber that still reads as amber at AA on white has to give up most of its
 * brightness, which is why `rewardSoft` exists to carry the *decorative* half of the
 * reward moment while `reward` carries anything load-bearing.
 */
export const lightPalette: Palette = {
  surface0: '#FFFFFF',
  surface1: '#F1F5F8',
  surface2: '#E6EDF1',
  surface3: '#D8E2E8',
  border: '#C3D1DA',

  primary: '#006A5E',
  primaryHover: '#00584E',
  primaryPress: '#00443C',
  onPrimary: '#FFFFFF',

  reward: '#8A5200',
  rewardSoft: '#FFC44D',
  onReward: '#FFFFFF',

  correct: '#0F7038',
  incorrect: '#B3261E',

  textPrimary: '#0B1519',
  textMuted: '#4C5C66',
};

/** The four elevation levels, for tests and for anything iterating surfaces. */
export const SURFACE_KEYS = ['surface0', 'surface1', 'surface2', 'surface3'] as const;

export type SurfaceKey = (typeof SURFACE_KEYS)[number];
