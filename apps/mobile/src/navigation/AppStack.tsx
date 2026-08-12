import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LeafPlayerScreen } from '../screens/leaf/LeafPlayerScreen';
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
    </Stack.Navigator>
  );
}
