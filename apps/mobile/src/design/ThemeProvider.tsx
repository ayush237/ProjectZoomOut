import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { themes, type Theme, type ThemeMode } from './theme';

/**
 * Supplies the active theme.
 *
 * **Dark is the default, and the fallback.** The app follows the OS appearance setting
 * when it expresses one, and renders dark when it does not — `useColorScheme()` returns
 * null on a device that has never been set either way, and defaulting that to light
 * would make ZoomOut launch in its non-default theme on a fresh install.
 *
 * `mode` overrides the system entirely. It exists for two callers: tests that assert a
 * screen in both themes, and the eventual in-app appearance setting. It is deliberately
 * not wired to a setting yet — persisting a preference is a WP7 concern once there is a
 * settings surface to hang it off.
 */

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  readonly children: ReactNode;
  /** Forces a theme. Omit to follow the OS. */
  readonly mode?: ThemeMode | undefined;
}

export function ThemeProvider({ children, mode }: ThemeProviderProps): React.JSX.Element {
  const systemScheme = useColorScheme();
  const resolved: ThemeMode = mode ?? (systemScheme === 'light' ? 'light' : 'dark');

  // Memoised on the resolved mode rather than rebuilt per render: the theme object is
  // a context value, so a new identity would re-render every consumer in the tree on
  // every parent render.
  const theme = useMemo(() => themes[resolved], [resolved]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/**
 * The active theme.
 *
 * @throws {Error} when used outside a `ThemeProvider`. Falling back to a default theme
 *   would let an unwrapped subtree render in the wrong colours and look merely odd,
 *   rather than failing where the mistake is.
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);

  if (theme === null) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }

  return theme;
}
