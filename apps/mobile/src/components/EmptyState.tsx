import { PixelRatio, StyleSheet, View } from 'react-native';

import { useTheme } from '../design';
import { asTextGlyph } from './glyphs';
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
  /** Oversized glyph standing in for the mascot. Swap for an illustration later. */
  readonly placeholderGlyph: string;
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
  placeholderGlyph,
  title,
  body,
  testID,
}: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();

  const fontScale = PixelRatio.getFontScale();
  const decorativeScale = Math.min(fontScale, MAX_DECORATIVE_SCALE);
  const slotSize = MASCOT_SLOT_BASE * decorativeScale;

  /**
   * Pre-divided by the OS scale, because React Native multiplies it straight back.
   *
   * Capping the slot alone is not enough: the glyph inside it is text, so it keeps
   * scaling past the cap and bursts out of the box — visible at
   * `accessibilityExtraExtraExtraLarge`, where a 56pt glyph renders at about 130pt in a
   * 198pt slot and collides with its own border. Dividing here lands the glyph at
   * exactly `GLYPH_BASE_SIZE * decorativeScale` after RN re-applies the scale, which
   * keeps the ornament proportional to the slot at every text size — without reaching
   * for `allowFontScaling={false}`, which `Text` rightly does not offer.
   */
  const glyphSize = (GLYPH_BASE_SIZE * decorativeScale) / fontScale;

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
        <Text
          variant="display"
          tone="primary"
          style={{ fontSize: glyphSize, lineHeight: glyphSize * 1.15 }}
        >
          {asTextGlyph(placeholderGlyph)}
        </Text>
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
