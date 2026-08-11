import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../design';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * An empty state, composed around the **reserved mascot slot**.
 *
 * `design-direction.md` §9 names four moments where a character will eventually live,
 * and empty states are the first of them. There is no mascot in Phase 1, so the slot is
 * filled by oversized type — but it is a real, sized region rather than absent space.
 *
 * That is the whole point: when the mascot arrives it should be an **asset swap inside
 * this component**, not a redesign of Explore, Library and Journey.
 *
 * **Everything here scales with the OS font setting**, which is the fix for the clipping
 * this component originally caused. A fixed 132pt slot and a fixed 320pt measure look
 * right at default text and overflow a centred container at
 * `accessibilityExtraExtraExtraLarge`, clipping the title and body at both ends — the
 * exact readers who most need the words are the ones who lose them.
 */

export interface EmptyStateProps {
  /** Oversized icon standing in for the mascot. Swap for an illustration later. */
  readonly icon: IconName;
  readonly title: string;
  readonly body: string;
  readonly testID?: string;
}

/** The slot's size at default text size. Grows with the reader's setting. */
const MASCOT_SLOT_BASE = 132;
const GLYPH_BASE_SIZE = 56;

/**
 * Ceiling on how far the decoration is allowed to grow.
 *
 * The words scale without limit; the ornament does not. Past roughly this point the
 * mascot slot starts pushing the title off a small screen, and a decorative element
 * crowding out the message it decorates is the wrong trade — so the glyph stops
 * growing while the text carries on.
 */
const MAX_DECORATIVE_SCALE = 1.5;

export function EmptyState({
  icon,
  title,
  body,
  testID,
}: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();

  // Reactive, so the slot resizes when the reader changes their text setting.
  const { fontScale } = useWindowDimensions();
  const decorativeScale = Math.min(fontScale, MAX_DECORATIVE_SCALE);
  const slotSize = MASCOT_SLOT_BASE * decorativeScale;

  /**
   * Sized against the slot, not the text.
   *
   * `Icon` takes a literal point size and never scales — the icon font is rendered with
   * `allowFontScaling: false` — so multiplying by the *capped* scale here is what keeps
   * the ornament proportional to its slot as the slot grows. Capping the slot alone was
   * not enough in WP6: the text glyph it replaced kept scaling past the cap and burst
   * out of the box at `accessibilityExtraExtraExtraLarge`.
   */
  const glyphSize = GLYPH_BASE_SIZE * decorativeScale;

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
            width: slotSize,
            height: slotSize,
            backgroundColor: theme.surfaceFor('card'),
            borderRadius: theme.radius.lg,
            borderWidth: theme.borderWidth.hairline,
            borderColor: theme.palette.border,
          },
        ]}
      >
        <Icon name={icon} tone="primary" size={glyphSize} />
      </View>

      <Text variant="h2" align="center">
        {title}
      </Text>

      {/* A readable measure at default size that gives way rather than clipping when the
          text scales — `maxWidth` alone would hold 320pt and let the words overflow. */}
      <Text variant="body" tone="textMuted" align="center" style={styles.body}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // `flexGrow`, not `flex: 1`: inside a scroll view the content must be free to
    // exceed the viewport, and `flex: 1` would pin it to the visible height and clip.
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  mascotSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    // Never let the ornament squeeze the text out of a short viewport.
    flexShrink: 0,
  },
  body: { maxWidth: 320, width: '100%' },
});
