import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { useTheme } from '../design';
import { AuthStack } from './AuthStack';
import { TabShell } from './TabShell';

/**
 * Chooses the tree from the session state.
 *
 * Switching whole navigators rather than navigating between them is deliberate: a
 * signed-out reader has no back-stack entry into the shell, and an expired session
 * cannot leave a stale screen mounted behind a sign-in modal. When a refresh fails,
 * `AuthProvider` flips the status and the shell is unmounted — there is no route left
 * to be on.
 *
 * `needsSignupDetails` renders the auth stack too — the reader is not signed in yet —
 * but opens it **on the age gate**, because the only thing standing between them and an
 * account is one date.
 */
export function RootNavigator(): React.JSX.Element {
  const { status } = useAuth();
  const theme = useTheme();

  // React Navigation keeps its own theme for the surfaces it draws itself — screen
  // backgrounds during transitions, most visibly. Left at its default it flashes white
  // between screens in dark mode.
  const navigationTheme: NavTheme = {
    ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: theme.surfaceFor('page'),
      card: theme.surfaceFor('card'),
      text: theme.palette.textPrimary,
      border: theme.palette.border,
      primary: theme.palette.primary,
    },
  };

  if (status === 'restoring') {
    return (
      <View
        testID="restoring"
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surfaceFor('page'),
        }}
      >
        <ActivityIndicator color={theme.palette.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {status === 'signedIn' ? (
        <TabShell />
      ) : (
        <AuthStack initialRouteName={status === 'needsSignupDetails' ? 'AgeGate' : 'SignIn'} />
      )}
    </NavigationContainer>
  );
}
