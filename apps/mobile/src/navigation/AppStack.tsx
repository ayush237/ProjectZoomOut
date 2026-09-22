import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { duration, useReducedMotion } from '../design';
import { LeafPlayerScreen } from '../screens/leaf/LeafPlayerScreen';
import { OnboardingNarratorScreen } from '../screens/onboarding/OnboardingNarratorScreen';
import { OnboardingPickBookScreen } from '../screens/onboarding/OnboardingPickBookScreen';
import { OnboardingPromiseScreen } from '../screens/onboarding/OnboardingPromiseScreen';
import { TrackDetailScreen } from '../screens/TrackDetailScreen';
import { AchievementShareScreen } from '../screens/share/AchievementShareScreen';
import { TrackCompleteScreen } from '../screens/share/TrackCompleteScreen';
import { WrapUpScreen } from '../screens/share/WrapUpScreen';
import { TabShell } from './TabShell';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export interface AppStackProps {
  /**
   * Where the stack opens (ONBOARD-1) — `RootNavigator`'s `useOnboardingGate` decides
   * which, the same `initialRouteName` mechanism `AuthStack` already uses for the
   * social-signup age gate. Defaults to today's behaviour: straight to the shell.
   */
  readonly initialRouteName?: 'Tabs' | 'OnboardingPromise' | 'OnboardingNarrator';
  /**
   * Called by whichever onboarding beat finishes or is skipped. Injected as a plain
   * prop via each screen's render-prop form below, not a param: route params are
   * serialisable state (`types.ts`'s own rule — ids and titles, never content), and a
   * function is neither serialisable nor state. Always supplied — `RootNavigator`
   * builds `useOnboardingGate` unconditionally whenever this component is on screen at
   * all, since it only ever renders once `status === 'signedIn'`.
   */
  readonly onboardingMarkSeen: () => void;
}

/**
 * The signed-in tree: the tab shell, with the Leaf player pushed over it.
 *
 * **Why the player is not inside a tab.** A Leaf is opened from Journey and from
 * Library. Given a stack per tab it would exist twice, with two back destinations and
 * two copies of its state; a reader who opened a Leaf from Journey, backgrounded the
 * app and returned via Library would find a second player mid-session. One route above
 * the shell gives it one identity, and leaves whichever tab they came from mounted
 * underneath so finishing returns them exactly where they were.
 *
 * Presented as a full-screen modal because the player is a mode, not a destination —
 * the tab bar would offer an escape hatch mid-Leaf that abandons progress silently.
 *
 * **The onboarding beats live here, not in a stack of their own (ONBOARD-1).** Beat 4 is
 * "open `LeafPlayer`", the same route above — a separate navigator would need a second
 * copy of that screen or a cross-navigator jump this codebase has no shape for. Beat 5
 * is a coach-mark inside `ScenarioSlide`, not a route. So only beats 1–3 get screens,
 * and they get them here.
 */
export function AppStack({ initialRouteName = 'Tabs', onboardingMarkSeen }: AppStackProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();

  // Swapped, not removed (`design-direction.md` §6) — the same accommodation
  // `AuthStack` already applies to its own transitions, scoped per-screen here rather
  // than at the navigator level so it touches only the three routes this package adds,
  // not AppStack's four pre-existing ones.
  const onboardingTransition = {
    animation: reducedMotion ? ('fade' as const) : ('slide_from_right' as const),
    animationDuration: reducedMotion ? duration.micro : duration.standard,
  };

  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabShell} />
      <Stack.Screen
        name="LeafPlayer"
        component={LeafPlayerScreen}
        options={{
          presentation: 'fullScreenModal',
          // The player draws its own close control and progress indicator; a native
          // header on top of them would duplicate both and eat the slide's vertical
          // space, which is the one thing the payoff slide cannot spare.
          gestureEnabled: false,
        }}
      />
      {/**
       * Both share screens sit above the shell for the same reason the player does:
       * each is reachable from more than one place — the wrap-up from Journey and from
       * finishing a Leaf, the achievement card from wherever the badge was earned — so a
       * copy inside each tab would give them several identities and a back button that
       * returns to the wrong one.
       *
       * Ordinary pushes rather than full-screen modals: unlike the player these are
       * destinations a reader should be able to swipe back out of, and neither has
       * progress to abandon.
       */}
      <Stack.Screen name="TrackDetail" component={TrackDetailScreen} />
      <Stack.Screen name="WrapUp" component={WrapUpScreen} />
      <Stack.Screen name="AchievementShare" component={AchievementShareScreen} />
      <Stack.Screen name="TrackComplete" component={TrackCompleteScreen} />

      {/* ONBOARD-1: gestureEnabled off on all three — a reader mid-activation swiping
          back out from under a native gesture would land on whichever beat preceded it
          with no "skip" intent behind the gesture at all. Each beat's own Skip control
          is the only way out, same reasoning as the player's own gestureEnabled: false.

          The children (render-prop) form of Stack.Screen, not `component`, on all
          three — it is how `markSeen` reaches a screen React Navigation itself
          instantiates: a Context would work too, but for one function used by exactly
          three screens a prop is the smaller, more traceable seam. */}
      <Stack.Screen
        name="OnboardingPromise"
        options={{ gestureEnabled: false, ...onboardingTransition }}
      >
        {(props) => <OnboardingPromiseScreen {...props} markSeen={onboardingMarkSeen} />}
      </Stack.Screen>
      <Stack.Screen
        name="OnboardingPickBook"
        options={{ gestureEnabled: false, ...onboardingTransition }}
      >
        {(props) => <OnboardingPickBookScreen {...props} markSeen={onboardingMarkSeen} />}
      </Stack.Screen>
      <Stack.Screen
        name="OnboardingNarrator"
        options={{ gestureEnabled: false, ...onboardingTransition }}
      >
        {(props) => <OnboardingNarratorScreen {...props} markSeen={onboardingMarkSeen} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
