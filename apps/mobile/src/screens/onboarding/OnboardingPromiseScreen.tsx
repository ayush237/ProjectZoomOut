import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { Button, Screen, Text } from '../../components';
import { useTheme } from '../../design';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'OnboardingPromise'> & {
  readonly markSeen: () => void;
};

/**
 * Beat 1 of 5: the promise, and nothing else.
 *
 * One static screen, on purpose — no carousel, no illustration slot. The numbers in the
 * copy below are `env.ts`'s `SESSION_CAP_SECONDS` (900) and `SESSION_CAP_XP` (500),
 * spelled out rather than read: the client has no route to the backend's config, and
 * the handoff is explicit that these are not read dynamically. If either default ever
 * changes, this copy has to change with it by hand.
 */
export function OnboardingPromiseScreen({ navigation, markSeen }: Props): React.JSX.Element {
  const theme = useTheme();

  return (
    <Screen testID="onboarding-promise-screen" centred>
      <View style={{ gap: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="caption" tone="textMuted">
            ZOOMOUT
          </Text>
          <Text variant="display">Here&rsquo;s the deal</Text>

          <Text variant="body" tone="textMuted">
            About fifteen minutes. One book. You&rsquo;ll have to think — every session ends
            with a question only you can answer, not a page you can skim.
          </Text>

          <Text variant="body" tone="textMuted">
            Each day tops out around 500 XP or fifteen minutes, whichever comes first. That
            is enough for one book&rsquo;s worth of progress, and it is meant to be — stopping
            on purpose is part of how this works, not a limit we ran out of budget for.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            testID="onboarding-promise-continue"
            label="Continue"
            onPress={() => {
              navigation.navigate('OnboardingPickBook');
            }}
          />
          <Button
            testID="onboarding-promise-skip"
            label="Skip for now"
            variant="quiet"
            onPress={() => {
              markSeen();
              navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
