import type { Track } from '@zoomout/shared';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../design';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * One book, as it appears in a list.
 *
 * Shared by Explore, Library and Journey so a Track looks like the same object wherever
 * a reader meets it. What differs between the three is the **action** beside it, which
 * is passed in rather than branched on here — a card that knew about libraries and
 * resume targets would be three components wearing one name.
 *
 * Elevation is a surface, never a shadow (`design-direction.md` §5).
 */

export interface TrackCardProps {
  readonly track: Track;
  /** The screen's action: add, remove, resume. Rendered under the details. */
  readonly action?: ReactNode;
  /** Progress bar or similar, rendered between the details and the action. */
  readonly children?: ReactNode;
  /**
   * Opens the book's detail page (WP10).
   *
   * Optional so a card can stay inert where there is nowhere useful to go, but every
   * list that shows a Track should pass it: the detail page is where the
   * non-endorsement disclaimer and the purchase links live, and a card with no route
   * to them leaves those obligations unreachable from that screen.
   */
  readonly onPress?: (() => void) | undefined;
  readonly testID?: string;
}

const COVER_WIDTH = 64;
/** Roughly the proportions of a printed book, so covers do not letterbox. */
const COVER_ASPECT = 2 / 3;

export function TrackCard({ track, action, children, onPress, testID }: TrackCardProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: theme.surfaceFor('card'),
        borderRadius: theme.radius.lg,
        borderWidth: theme.borderWidth.hairline,
        borderColor: theme.palette.border,
        padding: theme.spacing.lg,
        gap: theme.spacing.lg,
      }}
    >
      <Pressable
        accessibilityRole={onPress === undefined ? undefined : 'button'}
        {...(onPress === undefined
          ? {}
          : { accessibilityLabel: `${track.bookTitle}, about this book`, onPress })}
        disabled={onPress === undefined}
        testID={testID === undefined ? undefined : `${testID}-open`}
        style={[styles.row, { gap: theme.spacing.lg }]}
      >
        <Cover url={track.coverUrl} title={track.bookTitle} />

        {/* Flexes so long titles wrap instead of pushing the cover off the card, which
            is what happens at large text sizes without it. */}
        <View style={[styles.details, { gap: theme.spacing.xs }]}>
          <Text variant="h3" testID={`${testID ?? 'track'}-title`}>
            {track.bookTitle}
          </Text>
          <Text variant="small" tone="textMuted">
            {track.author}
          </Text>
        </View>
      </Pressable>

      {children}
      {action}
    </View>
  );
}

/**
 * The cover, with a fallback.
 *
 * `coverUrl` is required by `trackSchema`, so an absent one cannot reach here — but a
 * *broken* one can, and an unreachable image renders as empty space that looks like a
 * layout bug. The placeholder keeps the row's shape either way.
 */
function Cover({ url, title }: { url: string; title: string }): React.JSX.Element {
  const theme = useTheme();

  const frame = {
    width: COVER_WIDTH,
    height: COVER_WIDTH / COVER_ASPECT,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.surfaceFor('raised'),
  };

  return (
    <View style={[styles.cover, frame]}>
      <Icon name="book" tone="textMuted" size={24} />

      <Image
        source={{ uri: url }}
        // Described by the title beside it, so the image itself is decorative — an
        // "image of the cover of X" announcement after the title is pure duplication.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.sm }]}
        resizeMode="cover"
        // Distinguishes "no cover" from "wrong cover" when a screenshot is all there is.
        testID={`cover-${title}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  details: { flex: 1, flexShrink: 1 },
  cover: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
});
