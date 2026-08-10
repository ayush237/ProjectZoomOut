import type { TextStyle } from 'react-native';

/**
 * The type scale from `design-direction.md` §4.
 *
 * Two families, two jobs: **Nunito** for display, headings and UI — rounded geometric,
 * playful without reading juvenile — and **Nunito Sans** for body copy. Two families is
 * a deliberate ceiling; font files are startup cost in React Native.
 *
 * Sizes are unscaled. React Native multiplies them by the OS font-size setting at
 * render time, and nothing here opts out of that — see `Text.tsx`, which is the only
 * component allowed to touch `allowFontScaling` and never disables it. Users who size
 * text up are disproportionately the ones who need to (§4).
 */

export const fontFamilies = {
  /** Display, headings, buttons, labels. */
  display: {
    regular: 'Nunito_400Regular',
    semibold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
  },
  /** Body copy, and specifically the payoff slide. */
  body: {
    regular: 'NunitoSans_400Regular',
    semibold: 'NunitoSans_600SemiBold',
    bold: 'NunitoSans_700Bold',
  },
} as const;

/** Every font file the app loads at boot. Kept beside the families it names. */
export const TYPOGRAPHY_VARIANTS = [
  'display',
  'h1',
  'h2',
  'h3',
  'body',
  'payoff',
  'small',
  'caption',
] as const;

export type TypographyVariant = (typeof TYPOGRAPHY_VARIANTS)[number];

export const typography: Record<TypographyVariant, TextStyle> = {
  display: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 32,
    lineHeight: 40,
  },
  h1: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 28,
    lineHeight: 36,
  },
  h2: {
    fontFamily: fontFamilies.display.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  h3: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    fontFamily: fontFamilies.body.regular,
    fontSize: 16,
    lineHeight: 26,
  },
  /**
   * The payoff slide only (§4).
   *
   * Longer measure, more leading, slightly larger. It is the product's "slow, effortful
   * processing" moment and the one screen optimised for reading rather than tapping —
   * WP8 renders it, but the token belongs with the scale rather than with that screen.
   */
  payoff: {
    fontFamily: fontFamilies.body.regular,
    fontSize: 17,
    lineHeight: 30,
  },
  small: {
    fontFamily: fontFamilies.body.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
};
