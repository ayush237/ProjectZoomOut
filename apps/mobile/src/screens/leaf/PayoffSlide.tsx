import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { PayoffSlide as PayoffSlideData } from '@zoomout/shared';

import { Icon, Text } from '../../components';
import { duration, spring, useReducedMotion, useTheme } from '../../design';

export interface PayoffSlideProps {
  /**
   * **Null means locked, and locked means absent.** The server does not send the prose
   * until it is earned, so there is no state in which this component holds text it is
   * not allowed to show — the gate is enforced by the data, not by a conditional here.
   */
  readonly data: PayoffSlideData | null;
  /** True only on the transition that earned it, which is what may animate. */
  readonly justUnlocked: boolean;
}

/**
 * Slide 3 of 5. The signature moment.
 *
 * `design-direction.md` §6: "Slide 3 opening after a correct answer is where the active
 * recall thesis becomes something a user *feels*. It should be the most crafted
 * animation in the app."
 *
 * What that means concretely, and why each part is the way it is:
 *
 *  - **Amber, not teal.** Reward colour owns celebration; primary owns navigation. A
 *    teal unlock would read as "the next screen loaded" rather than "you earned this".
 *  - **`spring.reward`, the only underdamped config in the system** (damping 10). The
 *    overshoot is the whole point — it is the difference between a panel appearing and
 *    something springing open. Overshoot on an ordinary transition reads as sloppy,
 *    which is exactly why it is reserved for here.
 *  - **The lock resolves before the prose arrives.** The icon flips and the body follows
 *    one beat later, so the reader watches the gate open rather than watching a card
 *    fade. Simultaneous is cheaper and feels like a loading state.
 *  - **Reduced motion fades; it never skips.** Removing the feedback would leave a
 *    reader who needs the accommodation with no signal that anything was earned — worse
 *    than the animation, and the mistake §6 calls out by name.
 */
export function PayoffSlide({ data, justUnlocked }: PayoffSlideProps): React.JSX.Element {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  /**
   * Start settled unless this is the earning moment.
   *
   * Re-entering a completed Leaf must not replay the celebration — the second viewing
   * is reference material, and a card that bounces every time a reader flicks back is
   * the animation wearing out its welcome.
   */
  const scale = useSharedValue(justUnlocked && !reducedMotion ? 0.9 : 1);
  const opacity = useSharedValue(justUnlocked ? 0 : 1);
  const lockScale = useSharedValue(1);

  useEffect(() => {
    if (!justUnlocked) {
      return;
    }

    if (reducedMotion) {
      opacity.value = withTiming(1, { duration: duration.standard });
      return;
    }

    // The lock reacts first — a quick squash and release, so the icon reads as having
    // been sprung rather than swapped.
    lockScale.value = withSequence(
      withTiming(0.82, { duration: 90 }),
      withSpring(1, spring.reward),
    );

    // Then the panel, one beat behind.
    opacity.value = withDelay(120, withTiming(1, { duration: duration.micro }));
    scale.value = withDelay(120, withSpring(1, spring.reward));
  }, [justUnlocked, reducedMotion, opacity, scale, lockScale]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const lockStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lockScale.value }],
  }));

  if (data === null) {
    /**
     * Defence in depth, and it should be unreachable: the player will not navigate here
     * while the payoff is locked. If it ever renders, the reader gets an explanation
     * rather than an empty slide — and, critically, there is no prose to leak because
     * the server never sent any.
     */
    return (
      <View testID="payoff-locked" style={{ alignItems: 'center', gap: theme.spacing.lg }}>
        <Icon name="locked" size={32} color={theme.palette.textMuted} />
        <Text variant="h3" align="center">
          Answer the scenario to unlock this
        </Text>
        <Text variant="small" tone="textMuted" align="center">
          There is no limit on tries.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Animated.View style={lockStyle}>
          <Icon name="unlocked" size={20} color={theme.palette.reward} />
        </Animated.View>
        <Text variant="caption" tone="reward">
          Unlocked
        </Text>
      </View>

      <Animated.View
        testID="payoff-body"
        style={[
          panelStyle,
          {
            backgroundColor: theme.surfaceFor('card'),
            borderRadius: theme.radius.lg,
            borderLeftWidth: theme.borderWidth.focus * 2,
            borderLeftColor: theme.palette.reward,
            padding: theme.spacing.xl,
          },
        ]}
      >
        {/* The `payoff` type variant exists for this one slide: longer measure, more
            leading, slightly larger. It is the product's slow-processing moment and the
            only screen optimised for reading rather than tapping. */}
        <Text variant="payoff">{data.body}</Text>
      </Animated.View>
    </View>
  );
}
