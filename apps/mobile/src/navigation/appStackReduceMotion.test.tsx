import { AccessibilityInfo } from 'react-native';
import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { duration, ThemeProvider } from '../design';
import { AppStack } from './AppStack';
import type { AppStackParamList } from './types';

/**
 * `AppStack`'s onboarding transitions swap to a fade under Reduce Motion (ONBOARD-3,
 * closing ONBOARD-1's Reduce Motion debt row).
 *
 * **Why this is a separate file from `reduceMotionCallSites.test.tsx`.** That guard spies
 * on Reanimated's animation factories, and a native-stack `animation` option is not one:
 * it is a string handed to the native screen, so a stack that forgot to swap it would sail
 * through that test with every Reanimated call correctly flagged. The option *is* visible
 * though — react-native-screens renders each route as an `RNSScreen` host element carrying
 * `stackAnimation` and `transitionDuration` — so this reads what the native layer is
 * actually told, per route, rather than what `AppStack`'s source says it meant to do.
 *
 * **Every route whose name starts with `Onboarding` is checked, and the list is not
 * written here.** It is read off the navigator's own route names, so an onboarding route
 * added later is walked automatically and fails this test if it forgot the transition.
 *
 * The four onboarding screens are stubbed: this is about the stack's options, not what the
 * screens fetch or draw.
 */

jest.mock('../screens/intro/IntroScreen', () => ({ IntroScreen: () => null }));
jest.mock('../screens/onboarding/OnboardingPromiseScreen', () => ({
  OnboardingPromiseScreen: () => null,
}));
jest.mock('../screens/onboarding/OnboardingNarratorScreen', () => ({
  OnboardingNarratorScreen: () => null,
}));
jest.mock('../screens/onboarding/OnboardingPickBookScreen', () => ({
  OnboardingPickBookScreen: () => null,
}));

const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

interface NativeScreen {
  readonly stackAnimation: unknown;
  readonly transitionDuration: unknown;
}

/** Every `RNSScreen` in a rendered tree, in stack order, with the two props under test. */
function nativeScreens(node: unknown, found: NativeScreen[] = []): NativeScreen[] {
  if (Array.isArray(node)) {
    node.forEach((child) => nativeScreens(child, found));
    return found;
  }

  if (node !== null && typeof node === 'object' && 'type' in node) {
    const element = node as { type: string; props: Record<string, unknown>; children?: unknown };

    if (element.type === 'RNSScreen') {
      found.push({
        stackAnimation: element.props['stackAnimation'],
        transitionDuration: element.props['transitionDuration'],
      });
    }

    nativeScreens(element.children, found);
  }

  return found;
}

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

/**
 * Mounts `AppStack`, then walks it through every onboarding route so each is on screen at
 * once, and reports what the native layer holds for them.
 */
async function walkOnboardingRoutes(reducedMotion: boolean): Promise<{
  readonly routes: readonly string[];
  readonly screens: () => readonly NativeScreen[];
}> {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reducedMotion);
  const ref = createNavigationContainerRef<AppStackParamList>();

  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode="dark">
        <NavigationContainer ref={ref}>
          <AppStack
            initialRouteName="OnboardingIntro"
            onboardingVariant="full"
            onboardingMarkSeen={jest.fn()}
          />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>,
  );

  await act(async () => {
    await Promise.resolve();
  });

  const routes = (ref.getRootState()?.routeNames ?? []).filter((name) => name.startsWith('Onboarding'));

  for (const name of routes) {
    if (name !== 'OnboardingIntro') {
      await act(async () => {
        // Every onboarding route takes no params, which is why a bare navigate is enough.
        ref.navigate(name as 'OnboardingPromise');
        await Promise.resolve();
      });
    }
  }

  return { routes, screens: () => nativeScreens(view.toJSON()) };
}

describe('AppStack onboarding transitions under Reduce Motion', () => {
  it('walks the routes it means to — a guard that found none would pass vacuously', async () => {
    const { routes, screens } = await walkOnboardingRoutes(false);

    expect(routes).toEqual([
      'OnboardingIntro',
      'OnboardingPromise',
      'OnboardingNarrator',
      'OnboardingPickBook',
    ]);
    // One native screen per route walked, and no others: the stack opened on the intro,
    // not on `Tabs`.
    expect(screens()).toHaveLength(routes.length);
  });

  it('fades every onboarding route, briefly, for a reader who asked for reduced motion', async () => {
    const { routes, screens } = await walkOnboardingRoutes(true);

    await waitFor(() => {
      expect(screens()).toEqual(
        routes.map(() => ({ stackAnimation: 'fade', transitionDuration: duration.micro })),
      );
    });
  });

  it('slides every onboarding route in otherwise', async () => {
    const { routes, screens } = await walkOnboardingRoutes(false);

    await waitFor(() => {
      expect(screens()).toEqual(
        routes.map(() => ({ stackAnimation: 'slide_from_right', transitionDuration: duration.standard })),
      );
    });
  });
});
