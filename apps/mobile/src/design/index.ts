/**
 * The design system's public surface.
 *
 * Screens and components import from here, never from the individual token files. That
 * keeps the token structure free to change — merging two scales, renaming a surface —
 * without a sweep across every screen in the app.
 *
 * These tokens live in `apps/mobile`, **not** `packages/shared` (`design-direction.md`
 * §11). Shared is consumed by the backend, which has no business carrying UI concerns.
 * If a web surface ever needs them, promoting them is a later decision made with a real
 * second consumer in hand.
 */

export { darkPalette, lightPalette, SURFACE_KEYS, type Palette, type SurfaceKey } from './palette';
export { darkTheme, lightTheme, themes, type Theme, type ThemeMode } from './theme';
export { ThemeProvider, useTheme, type ThemeProviderProps } from './ThemeProvider';
export {
  borderWidth,
  elevation,
  MIN_TOUCH_TARGET,
  radius,
  spacing,
  type ElevationLevel,
} from './layout';
export {
  fontFamilies,
  typography,
  TYPOGRAPHY_VARIANTS,
  type TypographyVariant,
} from './typography';
export {
  duration,
  motionPlan,
  spring,
  useReducedMotion,
  type MotionPlan,
} from './motion';
export {
  contrastRatio,
  meetsBodyContrast,
  meetsLargeTextContrast,
  WCAG_AA_BODY,
  WCAG_AA_LARGE,
} from './contrast';
