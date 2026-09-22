import type { Track } from '@zoomout/shared';
import { Image, StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '../../components';
import { useTheme } from '../../design';

/**
 * One book, full-bleed — beat 2's card.
 *
 * **Not `TrackCard`, and deliberately so** (ONBOARD-1 finding 1). `TrackCard` is a
 * fixed 64px row, shared by Explore, Library and Journey precisely because a Track
 * looks the same everywhere a reader *browses* one. Beat 2 is not browsing — the
 * approved design calls for "two or three full-bleed cards and nothing else on the
 * screen", closer to a cover wall than a list row, and stretching `TrackCard`'s 64px
 * frame to fill the screen would distort art sized for a thumbnail. Follows the same
 * conventions anyway (the cover-with-fallback shape, `theme.surfaceFor`, `theme.radius`)
 * so it still reads as the same design system.
 */
export interface OnboardingBookCardProps {
  readonly track: Track;
  readonly busy: boolean;
  readonly onChoose: () => void;
  readonly testID: string;
}

const COVER_ASPECT = 2 / 3;

export function OnboardingBookCard({
  track,
  busy,
  onChoose,
  testID,
}: OnboardingBookCardProps): React.JSX.Element {
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
      <View
        style={[
          styles.cover,
          {
            aspectRatio: COVER_ASPECT,
            borderRadius: theme.radius.md,
            backgroundColor: theme.surfaceFor('raised'),
          },
        ]}
      >
        <Icon name="book" tone="textMuted" size={40} />

        <Image
          source={{ uri: track.coverUrl }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.md }]}
          resizeMode="cover"
          testID={`${testID}-cover`}
        />
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h2" testID={`${testID}-title`}>
          {track.bookTitle}
        </Text>
        <Text variant="body" tone="textMuted">
          {track.author}
        </Text>
        <Text variant="small" tone="textMuted" numberOfLines={3}>
          {track.description}
        </Text>
      </View>

      <Button
        testID={`${testID}-choose`}
        label="Choose this book"
        busy={busy}
        onPress={onChoose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
