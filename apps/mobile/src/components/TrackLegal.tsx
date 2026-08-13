import { Linking, Pressable, View } from 'react-native';
import type { Track } from '@zoomout/shared';

import { Icon } from './Icon';
import { Text } from './Text';
import { MIN_TOUCH_TARGET, useTheme } from '../design';

/**
 * The non-endorsement disclaimer and the purchase-forward links.
 *
 * **These are legal obligations, not chrome** (`LEGAL.md`, `PRODUCT.md`). WP3 already
 * makes a Track *unservable* without both — but until WP10 nothing rendered either of
 * them anywhere in the app, so the requirement was enforced at the API and unmet on the
 * screen. Servable is not the same as visible, and it is the second one the fair-use
 * position rests on.
 *
 * One component so the pair cannot drift apart or be shown separately: a purchase link
 * without the disclaimer beside it is exactly the affiliate-looking surface the
 * disclaimer exists to disown.
 */
export function TrackLegal({
  track,
  testID = 'track-legal',
}: {
  readonly track: Track;
  readonly testID?: string;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={{
        gap: theme.spacing.lg,
        padding: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.surfaceFor('card'),
        borderWidth: theme.borderWidth.hairline,
        borderColor: theme.palette.border,
      }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="caption" tone="textMuted">
          About this book
        </Text>
        {/**
         * Rendered in full, never truncated and never behind a "more" control.
         * A disclaimer a reader has to expand is a disclaimer that was not made.
         */}
        <Text variant="small" tone="textMuted" testID={`${testID}-disclaimer`}>
          {track.disclaimer}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="caption" tone="textMuted">
          Read the book
        </Text>
        {/**
         * Purchase-forward, in the product's words: ZoomOut sends readers *to* the book
         * rather than standing in for it, and that is a load-bearing part of the fair-use
         * argument as well as the right thing to do by the author.
         */}
        {track.purchaseLinks.map((link) => (
          <Pressable
            key={`${link.retailer}-${link.url}`}
            testID={`${testID}-purchase-${link.retailer}`}
            accessibilityRole="link"
            accessibilityLabel={`Buy from ${link.retailer}`}
            onPress={() => {
              // Failure is deliberately silent: the reader can see the retailer's name
              // either way, and an error toast about a browser that would not open is
              // noise on a screen whose job is to point outward.
              void Linking.openURL(link.url);
            }}
            style={{
              minHeight: MIN_TOUCH_TARGET,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Icon name="book" size={18} color={theme.palette.primary} />
            <Text variant="body" tone="primary" style={{ flex: 1 }}>
              {link.retailer}
            </Text>
            {/* Affiliate status is disclosed where the link is, not in a policy page. */}
            {link.isAffiliate ? (
              <Text variant="small" tone="textMuted">
                affiliate
              </Text>
            ) : null}
            <Icon name="chevron" size={16} color={theme.palette.textMuted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
