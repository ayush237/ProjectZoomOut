import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Screen, StatusMessage, Text } from '../../components';
import { useTheme } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { shareView, type ShareOutcome } from '../../share/shareImage';
import { ShareCard } from './ShareCard';

type AchievementShareRoute = RouteProp<AppStackParamList, 'AchievementShare'>;
type AchievementShareNavigation = NativeStackNavigationProp<AppStackParamList, 'AchievementShare'>;

/**
 * One achievement, big enough to be worth capturing.
 *
 * **Why a screen and not the toast we already have.** `AchievementUnlock` is the right
 * weight *inside* a flow — it appears beside the XP on the completion screen and gets
 * out of the way. But the handoff's whole premise is that an unlock is "a moment worth
 * capturing rather than a toast", and a banner cannot be screenshotted into something a
 * stranger would understand: it has no book, no wordmark, and it inherits the dark
 * theme. This is the same badge given the frame that makes it shareable.
 *
 * Reached deliberately, from the completion screen — never pushed automatically. An
 * unlock that hijacks the screen mid-session interrupts the reading it was awarded for.
 */
export function AchievementShareScreen(): React.JSX.Element {
  const theme = useTheme();
  const route = useRoute<AchievementShareRoute>();
  const navigation = useNavigation<AchievementShareNavigation>();
  const { name, description, tier } = route.params;

  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const share = useCallback(() => {
    setSharing(true);
    setNotice(null);

    void (async () => {
      const outcome: ShareOutcome = await shareView({
        target: cardRef,
        dialogTitle: 'Share your achievement',
      });

      if (outcome.status === 'unavailable') {
        setNotice('Sharing is not available on this device.');
      } else if (outcome.status === 'failed') {
        setNotice(outcome.message);
      }

      setSharing(false);
    })();
  }, []);

  return (
    <Screen testID="achievement-share-screen">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" tone="reward">
            Achievement unlocked
          </Text>
          <Text variant="display">{name}</Text>
        </View>

        {notice === null ? null : (
          <StatusMessage tone="error" message={notice} testID="achievement-share-notice" />
        )}

        <View style={{ alignItems: 'center' }}>
          <ShareCard
            ref={cardRef}
            eyebrow="Achievement unlocked"
            headline={name}
            subtitle={description}
            detail={[tierLabel(tier)]}
          />
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Button testID="achievement-share-button" label="Share this" onPress={share} busy={sharing} />
          <Button
            testID="achievement-share-close"
            label="Not now"
            variant="secondary"
            onPress={() => {
              navigation.goBack();
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

/**
 * Tier as a word rather than a colour.
 *
 * §6's rule that state is never signalled by colour alone applies here too: the card's
 * amber says "reward", not "rare", so the distinction that actually differs between
 * badges is spelled out.
 */
function tierLabel(tier: 'common' | 'rare' | 'milestone'): string {
  switch (tier) {
    case 'milestone':
      return 'A milestone';
    case 'rare':
      return 'A rare one';
    default:
      return 'Earned today';
  }
}
