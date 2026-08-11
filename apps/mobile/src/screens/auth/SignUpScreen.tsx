import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { View } from 'react-native';

import { useSignUpDraft } from '../../auth/SignUpDraft';
import { Button, Screen, Text, TextField } from '../../components';
import { useTheme } from '../../design';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

/** Matches the backend's rule: length only, no composition requirements (NIST 800-63B). */
const MINIMUM_PASSWORD_LENGTH = 12;

/**
 * Account details.
 *
 * Deliberately does not collect a date of birth — that is the next screen, shared with
 * the social path. Nothing is sent to the server from here: the draft is carried
 * forward and submitted once, after the age gate, so a refusal never leaves a
 * half-created account behind.
 *
 * There is no timezone field, and there never will be. It is read from the device.
 */
export function SignUpScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { setDraft } = useSignUpDraft();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmedName = displayName.trim();
  const trimmedEmail = email.trim();

  const nameError = trimmedName.length === 0 ? 'Tell us what to call you.' : undefined;
  const emailError = trimmedEmail.includes('@') ? undefined : 'That does not look like an email address.';
  const passwordError =
    password.length >= MINIMUM_PASSWORD_LENGTH
      ? undefined
      : `Use at least ${String(MINIMUM_PASSWORD_LENGTH)} characters.`;

  const valid = nameError === undefined && emailError === undefined && passwordError === undefined;

  const advance = (): void => {
    setTouched(true);

    if (valid) {
      // Into context, not into route params — the password must not reach React
      // Navigation's serialisable state. See `SignUpDraft.tsx`.
      setDraft({ email: trimmedEmail, password, displayName: trimmedName });
      navigation.navigate('AgeGate', { mode: 'email' });
    }
  };

  return (
    <Screen testID="sign-up-screen">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" tone="primary">
            Step 1 of 2
          </Text>
          <Text variant="display">Create your account</Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <TextField
            testID="sign-up-name"
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoComplete="name"
            error={touched ? nameError : undefined}
          />

          <TextField
            testID="sign-up-email"
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
            error={touched ? emailError : undefined}
          />

          <TextField
            testID="sign-up-password"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            hint={`At least ${String(MINIMUM_PASSWORD_LENGTH)} characters. Length beats symbols.`}
            error={touched ? passwordError : undefined}
          />

          <Button testID="sign-up-continue" label="Continue" onPress={advance} />
        </View>

        <Button
          testID="sign-up-to-signin"
          label="I already have an account"
          variant="quiet"
          onPress={() => {
            navigation.navigate('SignIn');
          }}
        />
      </View>
    </Screen>
  );
}
