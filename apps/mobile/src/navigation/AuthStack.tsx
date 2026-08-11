import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SignUpDraftProvider } from '../auth/SignUpDraft';
import { duration, useReducedMotion } from '../design';
import { AgeGateScreen } from '../screens/auth/AgeGateScreen';
import { AgeRefusedScreen } from '../screens/auth/AgeRefusedScreen';
import { ProviderEmailMissingScreen } from '../screens/auth/ProviderEmailMissingScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export interface AuthStackProps {
  /**
   * Where the stack opens.
   *
   * `AgeGate` when a social sign-in came back needing a date of birth. Without this the
   * stack would open on `SignIn` and the reader would be asked to start over — with the
   * provider token still held and unusable, and Apple's display name already spent,
   * since Apple returns it on the first authorisation only.
   */
  readonly initialRouteName?: 'SignIn' | 'AgeGate';
}

/**
 * Everything before a session exists.
 *
 * Headers are off: each of these screens carries its own title as display type, which
 * keeps the register playful rather than administrative and avoids a navigation bar
 * that would need its own theming to match.
 */
export function AuthStack({ initialRouteName = 'SignIn' }: AuthStackProps = {}): React.JSX.Element {
  const reducedMotion = useReducedMotion();

  return (
    // Wraps the stack, not an individual screen: the draft is written by SignUp and
    // read by AgeGate, so it has to outlive either of them being unmounted.
    <SignUpDraftProvider>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          /**
           * **Swapped, not removed** (`design-direction.md` §6).
           *
           * A reader with Reduce Motion on gets a fade rather than a slide. The
           * alternative people reach for — `animation: 'none'` — removes the feedback
           * entirely, which leaves the reader with no confirmation that anything
           * happened and is worse than the animation it was meant to accommodate.
           */
          animation: reducedMotion ? 'fade' : 'slide_from_right',
          animationDuration: reducedMotion ? duration.micro : duration.standard,
        }}
      >
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen
          name="AgeGate"
          component={AgeGateScreen}
          // Only consulted when the stack *opens* here, which happens for exactly one
          // reason: a social sign-in the backend paused for a date of birth. Arriving
          // from the details screen passes `{ mode: 'email' }` explicitly, and
          // navigation params override initial ones.
          initialParams={{ mode: 'social' }}
        />
        <Stack.Screen name="AgeRefused" component={AgeRefusedScreen} />
        <Stack.Screen name="ProviderEmailMissing" component={ProviderEmailMissingScreen} />
      </Stack.Navigator>
    </SignUpDraftProvider>
  );
}
