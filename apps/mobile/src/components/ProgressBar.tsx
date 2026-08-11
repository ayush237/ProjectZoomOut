import { StyleSheet, View } from 'react-native';

import { useTheme } from '../design';
import { Text } from './Text';

/**
 * How far through a Track the reader is.
 *
 * **Never colour alone** (`design-direction.md` §3): the bar is accompanied by a count,
 * so a reader who cannot distinguish the fill from the track still gets the answer. The
 * count is also what a screen reader announces — the bar itself is hidden from it,
 * because "7 of 20 Leaves complete" is the information and a decorative rectangle is not.
 */

export interface ProgressBarProps {
  readonly completed: number;
  readonly total: number;
  readonly testID?: string;
}

const BAR_HEIGHT = 8;

export function ProgressBar({ completed, total, testID }: ProgressBarProps): React.JSX.Element {
  const theme = useTheme();

  // Guarded rather than assumed: a Track whose Leaves are all placeholders in
  // production has a total of zero, and dividing by it would render `NaN%` wide.
  const fraction = total === 0 ? 0 : Math.min(completed / total, 1);

  const label =
    total === 0
      ? 'No Leaves yet'
      : `${String(completed)} of ${String(total)} complete`;

  return (
    <View testID={testID} style={{ gap: theme.spacing.sm }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.track,
          { backgroundColor: theme.surfaceFor('pressed'), borderRadius: theme.radius.full },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              // Percentage rather than a measured width: no layout pass, and it stays
              // correct when the card resizes with the OS text setting. Typed as a
              // literal because React Native narrows percentage strings.
              width: `${Math.round(fraction * 100)}%` as const,
              backgroundColor: theme.palette.primary,
              borderRadius: theme.radius.full,
            },
          ]}
        />
      </View>

      <Text variant="caption" tone="textMuted" testID={`${testID ?? 'progress'}-label`}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: BAR_HEIGHT, width: '100%', overflow: 'hidden' },
  fill: { height: BAR_HEIGHT },
});
