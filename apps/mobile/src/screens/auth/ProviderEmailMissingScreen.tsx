import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { Button, Screen, StatusMessage, Text } from '../../components';
import { useTheme } from '../../design';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ProviderEmailMissing'>;

/**
 * `PROVIDER_EMAIL_MISSING` — the unrecoverable provider error.
 *
 * Its own screen because it needs the **opposite** response to
 * `SIGNUP_DETAILS_REQUIRED`. That one is a missing field this app can collect; this one
 * cannot be fixed inside ZoomOut at all — the reader chose to hide their email from us
 * at Apple, or their Google account has none we can see. Sending them to a form would
 * be offering a fix that does not exist.
 *
 * So the copy does two things: says plainly that this path is closed, and points at the
 * one that is open.
 */
export function ProviderEmailMissingScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();

  return (
    <Screen testID="provider-email-missing-screen" centred>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="display">We need an email address</Text>

          <Text variant="body" tone="textMuted">
            Your sign-in provider did not share one, and ZoomOut cannot create an account
            without it.
          </Text>
        </View>

        <StatusMessage
          tone="info"
          testID="provider-email-missing-hint"
          message="If you chose to hide your email from ZoomOut, you can change that in your Apple or Google account settings and try again."
        />

        <View style={{ gap: theme.spacing.md }}>
          <Button
            testID="provider-email-missing-signup"
            label="Sign up with an email instead"
            onPress={() => {
              navigation.navigate('SignUp');
            }}
          />

          <Button
            testID="provider-email-missing-back"
            label="Back to sign in"
            variant="quiet"
            onPress={() => {
              navigation.navigate('SignIn');
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
