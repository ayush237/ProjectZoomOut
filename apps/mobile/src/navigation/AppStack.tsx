import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LeafPlayerScreen } from '../screens/leaf/LeafPlayerScreen';
import { TrackDetailScreen } from '../screens/TrackDetailScreen';
import { AchievementShareScreen } from '../screens/share/AchievementShareScreen';
import { WrapUpScreen } from '../screens/share/WrapUpScreen';
import { TabShell } from './TabShell';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

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
 */
export function AppStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
    </Stack.Navigator>
  );
}
