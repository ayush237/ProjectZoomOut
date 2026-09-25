import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';

import { useApi, useAuth } from '../auth/AuthProvider';
import { useTheme, type Theme } from '../design';
import { PreIntroScreen } from '../screens/intro/PreIntroScreen';
import { useIntroSeen } from '../screens/intro/useIntroSeen';
import {
  useOnboardingGate,
  type OnboardingVariant,
} from '../screens/onboarding/useOnboardingGate';
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
 * **The pre-intro gates `AuthStack` only, not a signed-in reader (INTRO-1's gate, kept
 * for ONBOARD-3).** `introSeen` is a per-install SecureStore flag, so an existing
 * signed-in reader must never meet it in front of their library on a cold start —
 * checking it only inside the "not signed in" branch means a `signedIn` status
 * short-circuits before that read is ever consulted. Its one exit calls
 * `preIntro.markSeen`, which flips local state to `'seen'` immediately and persists in
 * the background, landing back on this same branch — which now falls through to
 * `AuthStack`, exactly as a fresh sign-out would.
 *
 * **ONBOARD-3 swapped what this gate shows, not the gate.** It used to guard INTRO-1's
 * animation; that now belongs to a new account's onboarding (`OnboardingIntro`, the `full`
 * variant's first route, below) and this shows a still frame instead. The SecureStore key
 * is the same, so an install that already saw INTRO-1 will not see the pre-intro.
 *
 * **ONBOARD-1: the mirror image, on the signed-in side.** `useOnboardingGate` only ever
 * fetches once `status === 'signedIn'` (its own `enabled` guard), so it cannot race the
 * auth restore and cannot fire for a reader who is not signed in at all. Its `restoring`
 * gets the same blank frame `intro.status === 'restoring'` already does, for the same
 * reason: a reader whose Library check has not landed yet must not see `Tabs` flash in
 * front of a flow they have not been offered. `AppStack`'s `initialRouteName` is where
 * the decision actually lands — one prop, the same mechanism `AuthStack` already uses
 * for the social-signup age gate, not a second navigator.
 */
export function RootNavigator(): React.JSX.Element {
  const { status } = useAuth();
  const preIntro = useIntroSeen();
  const api = useApi();
  const onboarding = useOnboardingGate(api, status === 'signedIn');
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
    // The flag read must not flash the auth stack before the pre-intro appears — same
    // `restoring` shape as `status` above, so a slow SecureStore read cannot race it.
    if (preIntro.status === 'restoring') {
      return <RestoringView theme={theme} />;
    }

    if (preIntro.status === 'unseen') {
      return <PreIntroScreen onContinue={preIntro.markSeen} />;
    }
  }

  if (status === 'signedIn' && onboarding.status === 'restoring') {
    return <RestoringView theme={theme} />;
  }

  // A new account opens on INTRO-1 and walks the whole flow; an existing one opens on the
  // narrator beat alone. Which of the two it is travels to `AppStack` as its own prop,
  // beside the route — the narrator beat is where both variants meet, and it must be
  // told, not left to work it out from something incidental.
  const appInitialRoute =
    onboarding.status === 'full'
      ? 'OnboardingIntro'
      : onboarding.status === 'narratorOnly'
        ? 'OnboardingNarrator'
        : 'Tabs';

  const onboardingVariant: OnboardingVariant | undefined =
    onboarding.status === 'full' || onboarding.status === 'narratorOnly'
      ? onboarding.status
      : undefined;

  return (
    <NavigationContainer theme={navigationTheme}>
      {status === 'signedIn' ? (
        <AppStack
          initialRouteName={appInitialRoute}
          onboardingVariant={onboardingVariant}
          onboardingMarkSeen={onboarding.markSeen}
        />
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
