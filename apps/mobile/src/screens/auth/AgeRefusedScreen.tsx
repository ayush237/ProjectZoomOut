import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { ASSUMED_MINIMUM_AGE_YEARS } from '../../auth/ageGate';
import { Button, Screen, Text } from '../../components';
import { useTheme } from '../../design';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'AgeRefused'>;

/**
 * Signup refused by the age gate.
 *
 * **Non-punitive, deliberately.** This is a compliance boundary, not a user failure,
 * and the copy is written to be read by a thirteen-year-old without feeling accused of
 * anything. No error styling, no red, no "denied" — the reward palette is not used
 * either, because this is not a moment to celebrate.
 *
 * No account was created. The submission happens after this check, so a refused reader
 * leaves no partial record behind.
 */
export function AgeRefusedScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();

  return (
    <Screen testID="age-refused-screen" centred>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="display">Not quite yet</Text>

          <Text variant="body" tone="textMuted">
            ZoomOut is built for readers aged {ASSUMED_MINIMUM_AGE_YEARS} and over, so we
            cannot set up an account today. Nothing has been saved.
          </Text>

          <Text variant="body" tone="textMuted">
            Come back when you are old enough — the books will still be here.
          </Text>
        </View>

        <Button
          testID="age-refused-back"
          label="Back to sign in"
          onPress={() => {
            navigation.navigate('SignIn');
          }}
        />
      </View>
    </Screen>
  );
}
