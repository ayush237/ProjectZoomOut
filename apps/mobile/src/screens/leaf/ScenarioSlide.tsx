import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { PublicScenarioSlide } from '@zoomout/shared';

import { Button, Icon, Text } from '../../components';
import { MIN_TOUCH_TARGET, duration, spring, useReducedMotion, useTheme } from '../../design';

const OPTION_LABELS = ['A', 'B', 'C'] as const;

export interface ScenarioSlideProps {
  readonly data: PublicScenarioSlide;
  /** Submits an option **id**. The client never decides correctness. */
  readonly onSubmit: (optionId: string) => void;
  readonly busy: boolean;
  /** Ids already submitted and graded wrong. Owned by the player, not by this slide. */
  readonly wrongOptionIds: readonly string[];
  /** The id that graded correct, once one has. */
  readonly correctOptionId: string | null;
}

/**
 * Slide 2 of 5. The gate.
 *
 * **Two taps to answer, not one.** Selecting is separate from checking because a
 * first-try correct answer is worth more XP, and a mis-tap that silently spends that
 * bonus is a bad trade for one saved gesture. The reader confirms.
 *
 * **Wrong answers are unlimited and must not feel like a rebuke** — the stakes are XP,
 * not access. A wrong option is marked and struck out so the reader can see what they
 * have ruled out, the prompt stays put, and the copy reads as a nudge. Nothing is
 * disabled except re-submitting an option already known to be wrong, which would spend
 * an attempt to learn nothing.
 *
 * **Correctness is never signalled by colour alone** (§6). `correct` green and `primary`
 * teal are adjacent in hue, so every state carries an icon of a different *shape* and a
 * distinct motion as well as a tint.
 */
export function ScenarioSlide({
  data,
  onSubmit,
  busy,
  wrongOptionIds,
  correctOptionId,
}: ScenarioSlideProps): React.JSX.Element {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);

  const answered = correctOptionId !== null;
  const wrongCount = wrongOptionIds.length;

  /**
   * A selection stops counting the moment it is graded wrong.
   *
   * Derived rather than cleared in an effect, so the two can never disagree. Without
   * this the reader submits option A, learns it is wrong, and finds "Check answer"
   * still armed with A — one tap spends another attempt to be told the same thing,
   * which is precisely what separating select from check exists to prevent.
   */
  const selectedIsLive = selected !== null && !wrongOptionIds.includes(selected);
  const liveSelection = selectedIsLive ? selected : null;

  /**
   * A small horizontal nudge on a wrong answer, faded in instead when the reader has
   * asked for reduced motion. Keyed on the count rather than on a boolean so the second
   * wrong answer animates as visibly as the first.
   */
  const nudge = useSharedValue(0);
  const feedbackOpacity = useSharedValue(0);

  useEffect(() => {
    if (wrongCount === 0) {
      return;
    }

    feedbackOpacity.value = withTiming(1, { duration: duration.micro });

    if (!reducedMotion) {
      nudge.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 60 }),
        withSpring(0, spring.snappy),
      );
    }
  }, [wrongCount, reducedMotion, nudge, feedbackOpacity]);

  const feedbackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value }],
    opacity: feedbackOpacity.value,
  }));

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.lg }}>
        <Text variant="caption" tone="textMuted">
          Your turn
        </Text>
        <Text variant="h3">{data.prompt}</Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {data.options.map((option, index) => {
          const isWrong = wrongOptionIds.includes(option.id);
          const isCorrect = correctOptionId === option.id;
          const isSelected = liveSelection === option.id;

          return (
            <Pressable
              key={option.id}
              testID={`scenario-option-${option.id}`}
              disabled={isWrong || answered || busy}
              onPress={() => {
                setSelected(option.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled: isWrong || answered }}
              accessibilityLabel={`Option ${OPTION_LABELS[index] ?? ''}. ${option.text}`}
              {...(isWrong ? { accessibilityHint: 'Already tried, and not correct' } : {})}
              style={({ pressed }) => ({
                minHeight: MIN_TOUCH_TARGET,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                padding: theme.spacing.lg,
                borderRadius: theme.radius.lg,
                backgroundColor: pressed ? theme.surfaceFor('pressed') : theme.surfaceFor('card'),
                borderWidth: isSelected ? theme.borderWidth.focus : theme.borderWidth.hairline,
                borderColor: borderFor({ isCorrect, isWrong, isSelected, theme }),
                // Struck-through rather than hidden: a ruled-out option is information.
                opacity: isWrong ? 0.55 : 1,
              })}
            >
              <Text
                variant="caption"
                tone={isCorrect ? 'correct' : isWrong ? 'incorrect' : 'textMuted'}
              >
                {OPTION_LABELS[index]}
              </Text>

              <Text variant="body" style={{ flex: 1 }}>
                {option.text}
              </Text>

              {/* Shape, not just tint — the §6 rule made concrete. */}
              {isCorrect ? <Icon name="success" size={22} color={theme.palette.correct} /> : null}
              {isWrong ? <Icon name="incorrect" size={22} color={theme.palette.incorrect} /> : null}
            </Pressable>
          );
        })}
      </View>

      {wrongCount > 0 && !answered ? (
        <Animated.View
          testID="scenario-retry-message"
          style={[
            feedbackStyle,
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            },
          ]}
        >
          <Icon name="info" size={18} color={theme.palette.textMuted} />
          {/* Deliberately mild, and never a count of failures. "You have got this wrong
              four times" is accurate and is exactly the rebuke the ruling forbids. */}
          <Text variant="small" tone="textMuted" style={{ flex: 1 }}>
            Not that one. Have another look — there is no limit on tries.
          </Text>
        </Animated.View>
      ) : null}

      {answered ? null : (
        <Button
          testID="scenario-check"
          label="Check answer"
          onPress={() => {
            if (liveSelection !== null) {
              onSubmit(liveSelection);
            }
          }}
          disabled={liveSelection === null}
          busy={busy}
        />
      )}
    </View>
  );
}

function borderFor({
  isCorrect,
  isWrong,
  isSelected,
  theme,
}: {
  isCorrect: boolean;
  isWrong: boolean;
  isSelected: boolean;
  theme: ReturnType<typeof useTheme>;
}): string {
  if (isCorrect) {
    return theme.palette.correct;
  }
  if (isWrong) {
    return theme.palette.incorrect;
  }

  return isSelected ? theme.palette.primary : theme.palette.border;
}
