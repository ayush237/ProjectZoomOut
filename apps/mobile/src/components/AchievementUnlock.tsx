import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { UnlockedAchievement } from '@zoomout/shared';

import { duration, spring, useReducedMotion, useTheme } from '../design';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * The celebration for an achievement, shown where the reader earned it.
 *
 * **Reward amber, never primary teal** — `design-direction.md` §6 gives celebration to
 * the reward colour, and a teal badge would read as navigation chrome rather than
 * something won. The same rule the payoff unlock follows.
 *
 * **Deliberately quieter than the payoff unlock.** The payoff is the signature moment of
 * the product and this sits next to it on the same screen; two competing celebrations
 * would make both feel cheap. This one slides and settles, and it does not overshoot as
 * far — `spring.reward` is shared, but the travel is smaller and the delay staggers it
 * behind whatever else is on screen.
 *
 * **Reduced motion fades in place.** Swap, never remove: a reader who has asked for less
 * motion still gets told they earned something, which is the whole point of the tile.
 */
export function AchievementUnlock({
  achievements,
  testID = 'achievement-unlock',
}: {
  readonly achievements: readonly UnlockedAchievement[];
  readonly testID?: string;
}): React.JSX.Element | null {
  if (achievements.length === 0) {
    return null;
  }

  return (
    <View testID={testID} style={{ gap: 8 }}>
      {achievements.map((achievement, index) => (
        <UnlockCard key={achievement.id} achievement={achievement} index={index} />
      ))}
    </View>
  );
}

/**
 * One badge.
 *
 * Staggered by position so that a reader who crosses three thresholds at once — five,
 * ten and twenty Leaves land together — sees them arrive in sequence rather than as one
 * indistinguishable block.
 */
function UnlockCard({
  achievement,
  index,
}: {
  readonly achievement: UnlockedAchievement;
  readonly index: number;
}): React.JSX.Element {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(reducedMotion ? 0 : 12);

  useEffect(() => {
    const stagger = index * 120;

    if (reducedMotion) {
      opacity.value = withDelay(stagger, withTiming(1, { duration: duration.standard }));
      return;
    }

    opacity.value = withDelay(stagger, withTiming(1, { duration: duration.micro }));
    translateY.value = withDelay(stagger, withSpring(0, spring.reward));
  }, [index, reducedMotion, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      testID={`achievement-unlock-${achievement.id}`}
      style={[
        style,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          alignSelf: 'stretch',
          padding: theme.spacing.lg,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.surfaceFor('card'),
          borderLeftWidth: theme.borderWidth.focus * 2,
          borderLeftColor: theme.palette.reward,
        },
      ]}
    >
      <Icon name="achievement" size={24} color={theme.palette.reward} />

      {/* `flex: 1` so the name and description wrap rather than pushing the icon off
          the row — at XXXL "Month of Mornings" alone is two lines on a narrow screen. */}
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text variant="caption" tone="reward">
          Achievement unlocked
        </Text>
        <Text variant="h3" testID={`achievement-name-${achievement.id}`}>
          {achievement.name}
        </Text>
        <Text variant="small" tone="textMuted">
          {achievement.description}
        </Text>
      </View>
    </Animated.View>
  );
}
