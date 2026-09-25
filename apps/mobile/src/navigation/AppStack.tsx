import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useState } from 'react';

import { duration, useReducedMotion } from '../design';
import { IntroScreen } from '../screens/intro/IntroScreen';
import { LeafPlayerScreen } from '../screens/leaf/LeafPlayerScreen';
import { OnboardingNarratorScreen } from '../screens/onboarding/OnboardingNarratorScreen';
import { OnboardingPickBookScreen } from '../screens/onboarding/OnboardingPickBookScreen';
import { OnboardingPromiseScreen } from '../screens/onboarding/OnboardingPromiseScreen';
import type { OnboardingVariant } from '../screens/onboarding/useOnboardingGate';
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
   * A new account opens on INTRO-1 (ONBOARD-3); an existing one on the narrator beat.
   */
  readonly initialRouteName?: 'Tabs' | 'OnboardingIntro' | 'OnboardingNarrator';
  /**
   * Which onboarding this reader is in, or none (ONBOARD-3). Handed to the narrator beat
   * as a prop — **explicitly**, because since the reorder nothing else tells it: both
   * variants arrive there without a picked Track, which is what it used to go by. Getting
   * this wrong is the bug that matters here: an existing account that is never marked
   * seen meets the narrator beat on every launch.
   *
   * Read **once**, at mount — see `variant` in the component body for why.
   */
  readonly onboardingVariant?: OnboardingVariant | undefined;
  /**
   * Called by whichever onboarding beat ends the reader's onboarding — and, since
   * ONBOARD-3, by `WrapUp` when it opens as the closing. *When* each of them calls it is
   * a table, in `useOnboardingGate`. Injected as a plain prop via each screen's
   * render-prop form below, not a param: route params are serialisable state
   * (`types.ts`'s own rule — ids and titles, never content), and a function is neither
   * serialisable nor state. Always supplied — `RootNavigator` builds `useOnboardingGate`
   * unconditionally whenever this component is on screen at all, since it only ever
   * renders once `status === 'signedIn'`.
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
 * **The onboarding beats live here, not in a stack of their own (ONBOARD-1).** Opening the
 * first Leaf is "open `LeafPlayer`", the same route above — a separate navigator would
 * need a second copy of that screen or a cross-navigator jump this codebase has no shape
 * for. The scenario-gate coach-mark is inside `ScenarioSlide`, not a route. So the beats
 * that are screens — INTRO-1 (ONBOARD-3), the promise, the narrator and pick-book — get
 * them here.
 */
export function AppStack({
  initialRouteName = 'Tabs',
  onboardingVariant,
  onboardingMarkSeen,
}: AppStackProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();

  /**
   * **Captured once, not read live.** `onboardingVariant` is derived from the gate's
   * status, and that status flips to `seen` the moment a beat calls `markSeen` — while
   * that beat is still mounted for one more render. A `narratorOnly` reader who taps
   * Continue would, for that render, be handed `undefined` as their variant. Nothing
   * observable goes wrong today, because the navigation reset that follows unmounts the
   * screen first; but "the answer changes under a screen that is in the middle of using
   * it" is the shape of a bug that costs someone an afternoon later. The beats keep the
   * answer they were opened with. (`RootNavigator` only mounts this after the gate has
   * resolved, so the first value is the real one.)
   */
  const [variant] = useState(onboardingVariant);

  // Swapped, not removed (`design-direction.md` §6) — the same accommodation
  // `AuthStack` already applies to its own transitions, scoped per-screen here rather
  // than at the navigator level so it touches only the onboarding routes, not AppStack's
  // pre-existing ones. **Every onboarding route takes it, including any added later**:
  // `appStackReduceMotion.test.tsx` reads what the native stack is actually told for each.
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
      {/* The render-prop form, for `markSeen` (ONBOARD-3): a reader who arrives carrying
          `onboarding: true` has just finished their first Leaf, and this is where their
          onboarding ends. Every other arrival passes no param and marks nothing. */}
      <Stack.Screen name="WrapUp">
        {(props) => <WrapUpScreen {...props} markSeen={onboardingMarkSeen} />}
      </Stack.Screen>
      <Stack.Screen name="AchievementShare" component={AchievementShareScreen} />
      <Stack.Screen name="TrackComplete" component={TrackCompleteScreen} />

      {/* ONBOARD-1: gestureEnabled off on every beat — a reader mid-activation swiping
          back out from under a native gesture would land on whichever beat preceded it
          with no "skip" intent behind the gesture at all. Each beat's own Skip control
          is the only way out, same reasoning as the player's own gestureEnabled: false.

          The children (render-prop) form of Stack.Screen, not `component`, on the ones
          that need a prop — it is how `markSeen` reaches a screen React Navigation itself
          instantiates: a Context would work too, but for one function used by a handful
          of screens a prop is the smaller, more traceable seam. */}

      {/* INTRO-1 (ONBOARD-3): the `full` variant's first route. It moved here from the
          pre-auth branch so a new account sees it *after* sign-up. Content unchanged —
          `IntroScreen` is the same component with the same props; only its parent moved.

          **Both of its exits — Get started and Skip — land on the promise, and neither
          marks onboarding seen.** Skipping an animation is not skipping onboarding, so the
          reader still meets the promise, the narrator and pick-book. `replace`, not a
          push: the intro is a cold open, not a place to come back to, and a push would let
          Android's back button on the promise replay the animation. */}
      <Stack.Screen
        name="OnboardingIntro"
        options={{ gestureEnabled: false, ...onboardingTransition }}
      >
        {/* Annotated, because the render-prop form types `navigation` as `any`. */}
        {({ navigation }: NativeStackScreenProps<AppStackParamList, 'OnboardingIntro'>) => (
          <IntroScreen
            onExit={() => {
              navigation.replace('OnboardingPromise');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="OnboardingPromise"
        options={{ gestureEnabled: false, ...onboardingTransition }}
      >
        {(props) => <OnboardingPromiseScreen {...props} markSeen={onboardingMarkSeen} />}
      </Stack.Screen>
      <Stack.Screen
        name="OnboardingNarrator"
        options={{ gestureEnabled: false, ...onboardingTransition }}
      >
        {/* `?? 'narratorOnly'`: reached only for a reader with no onboarding at all, who is
            never sent here — and if one ever were, the variant that marks them seen at
            Continue and lands on Tabs is the one that cannot strand them. */}
        {(props) => (
          <OnboardingNarratorScreen
            {...props}
            variant={variant ?? 'narratorOnly'}
            markSeen={onboardingMarkSeen}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="OnboardingPickBook"
        options={{ gestureEnabled: false, ...onboardingTransition }}
      >
        {(props) => <OnboardingPickBookScreen {...props} markSeen={onboardingMarkSeen} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
