import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError, ApiErrorCode } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppleAuthProvider,
  GoogleAuthProvider,
  type SocialAuthProvider,
} from '../../auth/socialAuth';
import { Button, Screen, StatusMessage, Text, TextField } from '../../components';
import { useTheme } from '../../design';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

const apple = new AppleAuthProvider();
const google = new GoogleAuthProvider();

/**
 * Sign in.
 *
 * **Neither social provider renders in Phase 1** — social sign-in is deferred (roadmap,
 * 2026-08-11) and both report themselves unavailable, so the block below collapses to
 * nothing and email is the only path. The loop stays because it is how the buttons come
 * back: switching a provider on is a configuration change, not a re-write of this
 * screen.
 *
 * When they return, Apple must appear alongside Google on iOS (Guideline 4.8) — the
 * rule lives in `socialAuth.ts` with the providers themselves rather than here, so the
 * screen cannot be the thing that gets it wrong.
 */
export function SignInScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { signInWithEmail, signInWithProvider } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<SocialAuthProvider[]>([]);

  useEffect(() => {
    let active = true;

    void (async (): Promise<void> => {
      const candidates: readonly SocialAuthProvider[] = [apple, google];

      const available = await Promise.all(
        candidates.map(async (provider): Promise<SocialAuthProvider | null> =>
          (await provider.isAvailable()) ? provider : null,
        ),
      );

      if (active) {
        setProviders(
          available.filter((provider): provider is SocialAuthProvider => provider !== null),
        );
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const submit = async (): Promise<void> => {
    setError(null);
    setBusy(true);

    try {
      await signInWithEmail({ email: email.trim(), password });
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: SocialAuthProvider): Promise<void> => {
    setError(null);
    setBusy(true);

    try {
      await signInWithProvider(provider);
    } catch (caught) {
      // The unrecoverable provider error gets its own screen, with copy that explains
      // the reader has to change something at Apple or Google. Showing it inline here
      // would read as "try again", which cannot work.
      if (caught instanceof ApiError && caught.is(ApiErrorCode.providerEmailMissing)) {
        navigation.navigate('ProviderEmailMissing');
        return;
      }
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="sign-in-screen">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" tone="primary">
            ZoomOut
          </Text>
          <Text variant="display">Welcome back</Text>
        </View>

        {error === null ? null : <StatusMessage tone="error" message={error} testID="sign-in-error" />}

        <View style={{ gap: theme.spacing.lg }}>
          <TextField
            testID="sign-in-email"
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
          />

          <TextField
            testID="sign-in-password"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <Button
            testID="sign-in-submit"
            label="Sign in"
            onPress={() => {
              void submit();
            }}
            busy={busy}
          />
        </View>

        {providers.length === 0 ? null : (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="small" tone="textMuted" align="center">
              or continue with
            </Text>

            {providers.map((provider) => (
              <Button
                key={provider.id}
                testID={`sign-in-${provider.id}`}
                label={provider.id === 'apple' ? 'Continue with Apple' : 'Continue with Google'}
                variant="secondary"
                onPress={() => {
                  void social(provider);
                }}
                disabled={busy}
              />
            ))}
          </View>
        )}

        <Button
          testID="sign-in-to-signup"
          label="Create an account"
          variant="quiet"
          onPress={() => {
            navigation.navigate('SignUp');
          }}
        />
      </View>
    </Screen>
  );
}

/** Messages come from the backend where it has one; codes decide the shape, not the text. */
function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
