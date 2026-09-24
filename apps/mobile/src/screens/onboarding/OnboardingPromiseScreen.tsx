import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { Button, Screen, Text } from '../../components';
import { useTheme } from '../../design';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'OnboardingPromise'> & {
  readonly markSeen: () => void;
};

/**
 * The promise, and nothing else: what a session, a Leaf and XP are, and what they are
 * not.
 *
 * One static screen, on purpose — no carousel, no illustration slot. **It stays ahead of
 * the choices as "the contract"** (ONBOARD-3): a reader agrees to how this works before
 * they are asked to pick a narrator or a book. That placement is the Architect's default.
 *
 * **The copy was rewritten in ONBOARD-3, because the first version misled** — "About
 * fifteen minutes. One book." read as *a book, in one sitting*, which is exactly what this
 * product is not. It now says what the mechanic is: a book is read in small Leaves, a
 * session is capped at about fifteen minutes, a book takes many sessions, and XP
 * accumulates across them. **A first draft, and the founder's call** — copy is a taste
 * decision, read at the device gate.
 *
 * The one number in it, fifteen minutes, is `env.ts`'s `SESSION_CAP_SECONDS` (900)
 * spelled out rather than read: the client has no route to the backend's config, and the
 * handoff is explicit that it is not read dynamically. If the default ever changes, this
 * copy changes with it by hand. (The XP cap's figure was in the first version and is
 * gone — one fewer number to drift, and the point never needed it.)
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

          <Text variant="body" tone="textMuted" testID="onboarding-promise-leaves">
            Every book here is broken into small lessons called Leaves. Each one ends with a
            question only you can answer, so you&rsquo;re thinking rather than skimming.
          </Text>

          <Text variant="body" tone="textMuted" testID="onboarding-promise-sessions">
            A session lasts up to fifteen minutes, and a book takes many of them. Every Leaf
            you finish earns XP, and it adds up across sessions so you can see how far you&rsquo;ve
            come. Stopping on purpose is part of how this works &mdash; spacing it out is what
            makes it stick.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            testID="onboarding-promise-continue"
            label="Continue"
            onPress={() => {
              navigation.navigate('OnboardingNarrator');
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
