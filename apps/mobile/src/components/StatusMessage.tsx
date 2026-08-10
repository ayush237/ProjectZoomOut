import { StyleSheet, View } from 'react-native';

import { useTheme } from '../design';
import { Text } from './Text';

/**
 * An inline error, warning or success message.
 *
 * **Never colour alone.** Every state carries a glyph as well as a colour, which is a
 * hard requirement in `design-direction.md` §3 for two reasons: colour-blind readers,
 * and the fact that `correct` green and `primary` teal are adjacent in hue — a reader
 * must never have to distinguish them to know whether something went right.
 *
 * The glyphs are text rather than an icon font. Adding an icon dependency for three
 * shapes would cost startup time for no gain, and a text glyph scales with the OS font
 * setting for free.
 */

export type StatusTone = 'error' | 'success' | 'info';

const GLYPHS: Record<StatusTone, string> = {
  error: '!',
  success: '✓',
  info: 'i',
};

export interface StatusMessageProps {
  readonly tone: StatusTone;
  readonly message: string;
  readonly testID?: string;
}

export function StatusMessage({ tone, message, testID }: StatusMessageProps): React.JSX.Element {
  const theme = useTheme();

  const colour =
    tone === 'error'
      ? theme.palette.incorrect
      : tone === 'success'
        ? theme.palette.correct
        : theme.palette.textMuted;

  return (
    <View
      testID={testID}
      accessible
      // Announced as an alert so a screen reader does not leave the reader waiting for
      // feedback that only exists visually.
      accessibilityRole="alert"
      accessibilityLabel={`${tone}: ${message}`}
      style={[
        styles.row,
        {
          backgroundColor: theme.surfaceFor('raised'),
          borderColor: colour,
          borderRadius: theme.radius.md,
          borderWidth: theme.borderWidth.hairline,
          padding: theme.spacing.md,
          gap: theme.spacing.md,
        },
      ]}
    >
      <View
        style={[
          styles.glyph,
          { borderColor: colour, borderRadius: theme.radius.full, borderWidth: theme.borderWidth.focus },
        ]}
      >
        <Text variant="caption" style={{ color: colour }}>
          {GLYPHS[tone]}
        </Text>
      </View>

      <Text variant="small" style={[styles.message, { color: colour }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  glyph: {
    minWidth: 22,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Wraps rather than truncating: an error the reader cannot finish reading is not an
  // error message.
  message: { flex: 1, flexShrink: 1 },
});
