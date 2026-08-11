import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError, ApiErrorCode } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import {
  ASSUMED_MINIMUM_AGE_YEARS,
  isCalendarDate,
  meetsAssumedAgeThreshold,
} from '../../auth/ageGate';
import { useSignUpDraft } from '../../auth/SignUpDraft';
import { Button, Screen, StatusMessage, Text, TextField } from '../../components';
import { useTheme } from '../../design';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'AgeGate'>;

/**
 * The age gate — one screen, both signup paths.
 *
 * Apple and Google return an identity and an email and nothing else, so a social signup
 * reaches this screen exactly as an email one does; skipping it there was the failure
 * the WP6 handoff called out.
 *
 * The route param carries **only which path this is** — safe to persist. The email
 * draft itself comes from `SignUpDraftProvider`, because it contains a password and
 * navigation state is serialisable by design.
 *
 * The local check is **UX only** — it stops a reader filling in a form they cannot
 * submit. The server decides, and when it refuses, `BELOW_MINIMUM_AGE` routes to a
 * screen written to be read without shame.
 */
export function AgeGateScreen({ navigation, route }: Props): React.JSX.Element {
  const theme = useTheme();
  const { signUpWithEmail, completeSocialSignup, cancelSocialSignup } = useAuth();
  const { readDraft, clearDraft } = useSignUpDraft();

  const isSocial = route.params.mode === 'social';

  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setError(null);

    if (!isCalendarDate(dateOfBirth)) {
      setFieldError('Use the format YYYY-MM-DD.');
      return;
    }

    if (!meetsAssumedAgeThreshold(dateOfBirth)) {
      // Advisory only. The reader is sent to the same screen the server's refusal
      // would produce, so the two paths look identical from here.
      navigation.navigate('AgeRefused');
      return;
    }

    setFieldError(undefined);
    setBusy(true);

    try {
      if (isSocial) {
        await completeSocialSignup(dateOfBirth);
      } else {
        const draft = readDraft();

        if (draft === null) {
          // Reachable only by arriving here without going through the details screen —
          // a restored navigation state, or a deep link. Sending them back is the only
          // honest option; there is nothing to submit.
          navigation.navigate('SignUp');
          return;
        }

        await signUpWithEmail({ ...draft, dateOfBirth });
        // The password has done its job; it should not outlive the request.
        clearDraft();
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.is(ApiErrorCode.belowMinimumAge)) {
        navigation.navigate('AgeRefused');
        return;
      }

      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="age-gate-screen">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" tone="primary">
            {isSocial ? 'One more thing' : 'Step 2 of 2'}
          </Text>
          <Text variant="display">When were you born?</Text>
          <Text variant="body" tone="textMuted">
            {isSocial
              ? 'Your provider does not share this, and we need it to know ZoomOut is right for you.'
              : `ZoomOut is for readers aged ${String(ASSUMED_MINIMUM_AGE_YEARS)} and over.`}
          </Text>
        </View>

        {error === null ? null : <StatusMessage tone="error" message={error} testID="age-gate-error" />}

        <View style={{ gap: theme.spacing.lg }}>
          <TextField
            testID="age-gate-dob"
            label="Date of birth"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="1994-03-17"
            autoComplete="birthdate-full"
            hint="Your timezone comes from your device — we never ask for it."
            error={fieldError}
          />

          <Button
            testID="age-gate-submit"
            label={isSocial ? 'Finish signing up' : 'Create account'}
            onPress={() => {
              void submit();
            }}
            busy={busy}
          />

          <Button
            testID="age-gate-back"
            label="Go back"
            variant="quiet"
            onPress={() => {
              // A social signup abandoned here has a held provider token to discard;
              // an email one has a password to forget.
              if (isSocial) {
                cancelSocialSignup();
                return;
              }
              clearDraft();
              navigation.goBack();
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
