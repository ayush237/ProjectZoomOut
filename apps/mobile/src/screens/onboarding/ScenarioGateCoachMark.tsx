import { Pressable, View } from 'react-native';

import { Icon, Text } from '../../components';
import { MIN_TOUCH_TARGET, useTheme } from '../../design';

export interface ScenarioGateCoachMarkProps {
  readonly onDismiss: () => void;
}

/**
 * Beat 5: a modest, dismissible explanation of the unlock gate — no coach-mark
 * component existed anywhere in this codebase before this (ONBOARD-1 finding 5).
 *
 * **A callout, not a spotlight overlay.** The familiar "coach-mark" visual — a cutout
 * highlighting one control against a dimmed screen — needs the target's measured
 * position (`onLayout`, a portal to draw above it) for a payoff this slide does not
 * need: the gate is not a hidden affordance a reader could miss, it is the whole slide,
 * three options and a button that are already the most prominent thing on screen. What
 * a first-time reader is missing is not *where* to look but *why* — that answering
 * unlocks the Payoff slide, and that a wrong guess costs nothing. An inline card
 * explaining that in one line does the actual job at a fraction of the engineering, and
 * `StatusMessage`'s error/success/info tones do not fit a tip that is none of the
 * three — hence a small dedicated component rather than a fourth tone bent to cover it.
 */
export function ScenarioGateCoachMark({ onDismiss }: ScenarioGateCoachMarkProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      testID="scenario-gate-coach-mark"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: theme.borderWidth.hairline,
        borderColor: theme.palette.primary,
        backgroundColor: theme.surfaceFor('raised'),
      }}
    >
      <Icon name="idea" tone="primary" size={22} />

      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text variant="small">Answer to unlock the deeper explanation below.</Text>
        <Text variant="small" tone="textMuted">
          There is no limit on tries — a wrong guess costs nothing.
        </Text>
      </View>

      <Pressable
        testID="scenario-gate-coach-mark-dismiss"
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Got it, dismiss this tip"
        style={{
          minWidth: MIN_TOUCH_TARGET,
          minHeight: MIN_TOUCH_TARGET,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -theme.spacing.sm,
          marginRight: -theme.spacing.sm,
        }}
      >
        <Icon name="close" tone="textMuted" size={18} />
      </Pressable>
    </View>
  );
}
