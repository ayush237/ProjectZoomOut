import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="AgeGate" component={AgeGateScreen} />
      <Stack.Screen name="AgeRefused" component={AgeRefusedScreen} />
      <Stack.Screen name="ProviderEmailMissing" component={ProviderEmailMissingScreen} />
    </Stack.Navigator>
  );
}
