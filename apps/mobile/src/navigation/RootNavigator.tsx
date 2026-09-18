import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { useTheme, type Theme } from '../design';
import { IntroScreen } from '../screens/intro/IntroScreen';
import { useIntroSeen } from '../screens/intro/useIntroSeen';
import { AppStack } from './AppStack';
import { AuthStack } from './AuthStack';

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
 *
 * **INTRO-1: the intro gates `AuthStack` only, not a signed-in reader.** `introSeen` is
 * a per-install SecureStore flag that did not exist before this package, so an existing
 * signed-in reader upgrading the app would otherwise see it in front of their library on
 * the next cold start — checking it only inside the "not signed in" branch means a
 * `signedIn` status short-circuits before that read is ever consulted. Both exit paths
 * (finish and skip) call `intro.markSeen`, which flips local state to `'seen'`
 * immediately and persists in the background, landing back on this same branch — which
 * now falls through to `AuthStack`, exactly as a fresh sign-out would.
 */
export function RootNavigator(): React.JSX.Element {
  const { status } = useAuth();
  const intro = useIntroSeen();
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
    return <RestoringView theme={theme} />;
  }

  if (status !== 'signedIn') {
    // The flag read must not flash the auth stack before the intro appears — same
    // `restoring` shape as `status` above, so a slow SecureStore read cannot race it.
    if (intro.status === 'restoring') {
      return <RestoringView theme={theme} />;
    }

    if (intro.status === 'unseen') {
      return <IntroScreen onExit={intro.markSeen} />;
    }
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {status === 'signedIn' ? (
        <AppStack />
      ) : (
        <AuthStack initialRouteName={status === 'needsSignupDetails' ? 'AgeGate' : 'SignIn'} />
      )}
    </NavigationContainer>
  );
}

function RestoringView({ theme }: { readonly theme: Theme }): React.JSX.Element {
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
