import { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import type { ImageAsset } from '@zoomout/shared';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from '../design';

/**
 * An illustration on a Leaf slide (WP15).
 *
 * **Failure is a first-class state, not an edge case.** WP11 found a seeded Track whose
 * cover URL pointed at a web page rather than an image, and Phase 2 will fill this field
 * from a generation pipeline — so a URL that does not resolve to a picture is a *normal*
 * thing to receive here, not a bug to be surprised by. A broken image must never break
 * the slide it sits on: the reader loses a picture, not the concept.
 *
 * Three states, all of them deliberate:
 *
 *  - **Loading** — a spinner inside a reserved box, so the text below does not jump when
 *    the image arrives. `width`/`height` refine the box when the asset supplies them.
 *  - **Failed** — a muted placeholder carrying the alt text. The alt is the fallback
 *    content, which is the whole reason the schema makes it mandatory: a reader who
 *    cannot see the image and a reader whose image did not load need the same thing.
 *  - **Loaded** — the image, `contain`-fitted so a generated asset of unexpected
 *    proportions is letterboxed rather than cropped through its subject.
 */

/** Fixed height keeps the slide's rhythm stable across Leaves with different assets. */
const IMAGE_HEIGHT = 180;

export function SlideImage({
  asset,
  testID = 'slide-image',
}: {
  readonly asset: ImageAsset;
  readonly testID?: string;
}): React.JSX.Element {
  const theme = useTheme();
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');

  const frame = {
    height: IMAGE_HEIGHT,
    borderRadius: theme.radius.lg,
    overflow: 'hidden' as const,
    backgroundColor: theme.surfaceFor('card'),
  };

  if (state === 'failed') {
    return (
      <View
        testID={`${testID}-failed`}
        // Not `accessibilityRole="image"`: there is no image. The alt text is being
        // shown as text, so a screen reader should read it as text.
        style={{
          ...frame,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          padding: theme.spacing.lg,
        }}
      >
        <Icon name="info" size={22} color={theme.palette.textMuted} />
        <Text variant="small" tone="textMuted" align="center">
          {asset.alt}
        </Text>
      </View>
    );
  }

  return (
    <View style={frame}>
      <Image
        testID={testID}
        source={{ uri: asset.url }}
        // The alt text, as the OS reads it. Required by the schema precisely so this
        // is never empty.
        accessible
        accessibilityLabel={asset.alt}
        accessibilityRole="image"
        resizeMode="contain"
        style={{ width: '100%', height: '100%' }}
        onLoad={() => {
          setState('loaded');
        }}
        onError={() => {
          setState('failed');
        }}
      />

      {state === 'loading' ? (
        <View
          testID={`${testID}-loading`}
          // Overlaid rather than rendered instead of the image: swapping the tree on
          // load would remount the `Image` and restart the fetch it is waiting on.
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={theme.palette.primary} />
        </View>
      ) : null}
    </View>
  );
}
