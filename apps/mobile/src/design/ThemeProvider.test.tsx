import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { ThemeProvider, useTheme } from './ThemeProvider';
import { darkPalette, lightPalette } from './palette';

/**
 * Dark is the default, and this file is what holds it there.
 *
 * The whole default rests on one expression in `ThemeProvider` — the fallback for a
 * null colour scheme. Inverting it is a one-character change that no other test in the
 * suite notices, because every other test asserts the *contents* of a theme rather than
 * which one gets chosen.
 *
 * This package already found the app pinned to light mode in `app.json` for six work
 * packages, invisible to a green test run. That was the same class of defect: a default
 * nobody had written down as an assertion.
 */

jest.mock('react-native/Libraries/Utilities/useColorScheme');

const mockedScheme = jest.mocked(useColorScheme);

/**
 * React Native types `useColorScheme()` as returning only `'light' | 'dark'`, but its
 * documented runtime behaviour on a device with no appearance preference set is `null`
 * — and `undefined` before the native module has answered. The fallback in
 * `ThemeProvider` exists for exactly those values, so the tests have to be able to
 * produce them. The cast is the subject of the test, not a way around the compiler.
 */
const asScheme = (value: unknown): ReturnType<typeof useColorScheme> =>
  value as ReturnType<typeof useColorScheme>;

/** The provider as the app mounts it — no forced mode, so the OS decides. */
const systemWrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('the default theme', () => {
  afterEach(() => {
    mockedScheme.mockReset();
  });

  /**
   * Both spellings of "no preference".
   *
   * React Native's own types say `useColorScheme()` returns `'light' | 'dark' |
   * undefined`, but the documented runtime behaviour on a device that has never been
   * set either way is `null`. The types and the runtime disagree, so the fallback is
   * asserted against both rather than against whichever one the compiler happens to
   * allow — the cast is the point, not a workaround.
   */
  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('is dark when the OS reports %s', async (_label, scheme) => {
    // Treating this as light would launch ZoomOut in its non-default theme on a fresh
    // install — the exact bug, in the exact place, that the app.json defect produced.
    mockedScheme.mockReturnValue(asScheme(scheme));

    const { result } = await renderHook(() => useTheme(), { wrapper: systemWrapper });

    expect(result.current.mode).toBe('dark');
    expect(result.current.palette).toBe(darkPalette);
  });

  it('is dark when the OS says dark', async () => {
    mockedScheme.mockReturnValue('dark');

    const { result } = await renderHook(() => useTheme(), { wrapper: systemWrapper });

    expect(result.current.mode).toBe('dark');
  });

  it('follows the OS into light', async () => {
    // Light is supported, just never the default — so this must not be dark either.
    mockedScheme.mockReturnValue('light');

    const { result } = await renderHook(() => useTheme(), { wrapper: systemWrapper });

    expect(result.current.mode).toBe('light');
    expect(result.current.palette).toBe(lightPalette);
  });

  it('lets an explicit mode override the OS in both directions', async () => {
    mockedScheme.mockReturnValue('light');

    const forcedDark = await renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider mode="dark">{children}</ThemeProvider>,
    });
    expect(forcedDark.result.current.mode).toBe('dark');

    mockedScheme.mockReturnValue('dark');

    const forcedLight = await renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider mode="light">{children}</ThemeProvider>,
    });
    expect(forcedLight.result.current.mode).toBe('light');
  });
});

describe('useTheme outside a provider', () => {
  it('throws rather than falling back to a default theme', async () => {
    // A silent fallback would let an unwrapped subtree render in the wrong colours and
    // merely look odd, instead of failing where the mistake is.
    await expect(renderHook(() => useTheme())).rejects.toThrow('ThemeProvider');
  });
});
