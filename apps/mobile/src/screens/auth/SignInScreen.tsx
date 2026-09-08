import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ApiError } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import { Button, Screen, StatusMessage, Text, TextField } from '../../components';
import { MIN_TOUCH_TARGET, useTheme } from '../../design';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

/**
 * Sign in.
 *
 * **No social sign-in affordance, deliberately** (`screen-09-sign-in-and-sign-up.txt`:
 * "there is no Google or Apple button... leaving room for it is wrong"). This screen
 * used to detect available providers at mount and render a button per one found, so a
 * later launch would be a configuration change rather than a rewrite. WP24 removes that
 * loop entirely on the founder's explicit design ruling, which overrides that reasoning.
 *
 * The capability itself is untouched — `useAuth().signInWithProvider`, `socialAuth.ts`
 * and `ProviderEmailMissingScreen` are all still there, just unreachable from here now.
 * **If social sign-in ships, this screen needs deliberate rework, not reactivation of
 * dormant code.**
 */
export function SignInScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryNoticeVisible, setRecoveryNoticeVisible] = useState(false);

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

          {/*
           * The spec requires this affordance even though no reset flow exists yet
           * (password reset itself is out of scope — WP24 handoff). Tapping it reveals
           * an honest notice rather than navigating somewhere that pretends to work.
           */}
          <Pressable
            testID="sign-in-forgot-password"
            onPress={() => {
              setRecoveryNoticeVisible(true);
            }}
            accessibilityRole="button"
            hitSlop={theme.spacing.sm}
            style={{ minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', alignSelf: 'flex-end' }}
          >
            <Text variant="small" tone="primary">
              Forgot password?
            </Text>
          </Pressable>

          {recoveryNoticeVisible ? (
            <StatusMessage
              tone="info"
              testID="sign-in-forgot-password-notice"
              message="Password reset isn't built yet — check back soon."
            />
          ) : null}

          <Button
            testID="sign-in-submit"
            label="Sign in"
            onPress={() => {
              void submit();
            }}
            busy={busy}
          />
        </View>

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
