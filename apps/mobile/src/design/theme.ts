import { darkPalette, lightPalette, type Palette } from './palette';
import { borderWidth, elevation, radius, spacing, type ElevationLevel } from './layout';
import { typography } from './typography';

/**
 * A theme is a palette plus the scales that do not vary by theme.
 *
 * Spacing, radius and type are the same in both modes on purpose — only colour is
 * theme-dependent. Bundling them into the theme object anyway means a component reads
 * everything it needs from one `useTheme()` call rather than importing half its design
 * decisions directly and taking the other half from context.
 */
export interface Theme {
  readonly mode: ThemeMode;
  readonly palette: Palette;
  readonly typography: typeof typography;
  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  readonly borderWidth: typeof borderWidth;
  /** Resolves an elevation level to the surface colour it renders on. */
  surfaceFor(level: ElevationLevel): string;
}

export type ThemeMode = 'dark' | 'light';

function buildTheme(mode: ThemeMode, palette: Palette): Theme {
  return {
    mode,
    palette,
    typography,
    spacing,
    radius,
    borderWidth,
    surfaceFor: (level) => palette[elevation[level]],
  };
}

export const darkTheme: Theme = buildTheme('dark', darkPalette);
export const lightTheme: Theme = buildTheme('light', lightPalette);

export const themes: Record<ThemeMode, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};
