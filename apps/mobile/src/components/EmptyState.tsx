import { StyleSheet, View } from 'react-native';

import { useTheme } from '../design';
import { Text } from './Text';

/**
 * An empty state, composed around the **reserved mascot slot**.
 *
 * `design-direction.md` §9 names four moments where a character will eventually live,
 * and empty states are the first of them. There is no mascot in Phase 1, so the slot is
 * filled by oversized type — but it is a real, sized region rather than absent space.
 *
 * That is the whole point: when the mascot arrives it should be an **asset swap inside
 * this component**, not a redesign of Explore, Library and Journey. Anything that
 * changes the surrounding layout defeats it.
 */

export interface EmptyStateProps {
  /** Oversized glyph standing in for the mascot. Swap for an illustration later. */
  readonly placeholderGlyph: string;
  readonly title: string;
  readonly body: string;
  readonly testID?: string;
}

/** Sized so an illustration can drop in without the text below it moving. */
const MASCOT_SLOT_SIZE = 132;

export function EmptyState({
  placeholderGlyph,
  title,
  body,
  testID,
}: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View testID={testID} style={[styles.container, { gap: theme.spacing.lg }]}>
      <View
        // Decorative: the title and body carry the meaning, so a screen reader should
        // skip straight to them rather than announce a stand-in glyph.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.mascotSlot,
          {
            backgroundColor: theme.surfaceFor('card'),
            borderRadius: theme.radius.lg,
            borderWidth: theme.borderWidth.hairline,
            borderColor: theme.palette.border,
          },
        ]}
      >
        <Text variant="display" tone="primary" style={styles.glyph}>
          {placeholderGlyph}
        </Text>
      </View>

      <Text variant="h2" align="center">
        {title}
      </Text>

      <Text variant="body" tone="textMuted" align="center" style={styles.body}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotSlot: {
    width: MASCOT_SLOT_SIZE,
    height: MASCOT_SLOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 56, lineHeight: 64 },
  // A readable measure rather than the full screen width.
  body: { maxWidth: 320 },
});
