import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { UnlockedAchievement } from '@zoomout/shared';

import {
  duration,
  motionPlan,
  motionSpringConfig,
  motionTimingConfig,
  REDUCE_MOTION_OVERRIDE,
  spring,
  useReducedMotion,
  useTheme,
} from '../design';
import { badgeBlobPath } from './achievementBadge';
import { Icon } from './Icon';
import { Text } from './Text';

/** The badge's footprint. Big enough to read as an object, not a list icon. */
const BADGE_SIZE = 44;

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
 *
 * **The presentation is WP25's; the motion above is untouched.** `Achievement
 * unlock.html`'s four "frames" turned out to be four stills of one moment (mid-Leaf,
 * entering, resolved, handed back), not a keyframe animation — so the entrance this
 * file already ran stays exactly as built, and only what it reveals (the badge, the
 * card) changed. No queue either: `achievements` renders every entry it is given, in
 * order, which already matches screen-11's "do not stack unlocks into a dismissed
 * queue" — there is nothing to dismiss, each tile simply appears and stays.
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
      // Swap, never remove (§6). `withDelay` resolves reduce-motion independently of the
      // `withTiming` it wraps, so both need the override — see `REDUCE_MOTION_OVERRIDE`
      // in `design/motion.ts`.
      opacity.value = withDelay(
        stagger,
        withTiming(1, motionTimingConfig(motionPlan(reducedMotion, duration.standard))),
        REDUCE_MOTION_OVERRIDE,
      );
      return;
    }

    // Every nesting level carries the override here too (WP28.1) — the same
    // reasoning as the reduced-motion branch above, now applied to the branch that
    // runs when Reanimated and the OS agree that motion is fine. A stale
    // disagreement between the two (see `motion.ts`) would otherwise silence this
    // branch exactly as it would the fade one.
    opacity.value = withDelay(
      stagger,
      withTiming(1, { duration: duration.micro, reduceMotion: REDUCE_MOTION_OVERRIDE }),
      REDUCE_MOTION_OVERRIDE,
    );
    translateY.value = withDelay(stagger, withSpring(0, motionSpringConfig(spring.reward)), REDUCE_MOTION_OVERRIDE);
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
          backgroundColor: theme.surfaceFor('raised'),
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.palette.border,
        },
      ]}
    >
      <AchievementBadge />

      {/* `flex: 1` so the name and description wrap rather than pushing the badge off
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

/**
 * The badge itself: a blob, not a list icon (WP25/screen-11).
 *
 * **This is the fill case for amber's outline/fill boundary** (ruled 2026-09-09,
 * alongside the roadmap's completed-node ring): the roadmap *outlines* a finished node
 * in amber for what the reader has done, and this *fills* the same colour for what they
 * have just won. The two need to read as different weights of the same idea, which is
 * why the badge is a solid `reward` fill and not another ring.
 *
 * Always the earned badge — this component never renders a locked achievement, so
 * there is no unearned variant here. (Profile's grid, which shows both, is a later
 * package.)
 */
function AchievementBadge(): React.JSX.Element {
  const theme = useTheme();
  const centre = BADGE_SIZE / 2;
  const path = badgeBlobPath(centre, centre, centre * 0.82);

  return (
    <View style={{ width: BADGE_SIZE, height: BADGE_SIZE }}>
      <Svg width={BADGE_SIZE} height={BADGE_SIZE} viewBox={`0 0 ${String(BADGE_SIZE)} ${String(BADGE_SIZE)}`}>
        <Path d={path} fill={theme.palette.reward} stroke={theme.palette.rewardSoft} strokeWidth={2} />
      </Svg>
      <View
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="achievement" size={BADGE_SIZE * 0.45} color={theme.palette.onReward} />
        </View>
      </View>
    </View>
  );
}
