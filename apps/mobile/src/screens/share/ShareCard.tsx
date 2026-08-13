import { forwardRef, type ReactNode } from 'react';
import { View } from 'react-native';

import { Icon, Text } from '../../components';
import { ThemeProvider, useTheme } from '../../design';

/**
 * The frame every shareable image is composed in.
 *
 * **This is the only screen surface in the app that ignores the reader's theme**, and it
 * is deliberate — `design-direction.md` §8: a dark screenshot dropped into a bright
 * social feed reads as moody rather than triumphant. The forced-light `ThemeProvider`
 * wrapper is what makes the *captured file* independent of the device, not just the
 * on-screen preview: `captureRef` photographs the rendered tree, so if the tree followed
 * the device the image would too.
 *
 * **Designed for a thumbnail, not for this screen.** Someone scrolling past sees it at
 * perhaps a fifth of its size, so the hierarchy is deliberately brutal: one enormous
 * number, one line naming the book, and the wordmark. Everything else is subordinate and
 * allowed to become texture at small sizes. If the headline number and the book are not
 * readable when this is shrunk, the card has failed at its only job — which is the
 * criterion the device check judges it against.
 *
 * **The mascot slot (§9)** is the band above the headline. It is filled here by
 * oversized type and the reward-coloured rule; dropping an illustration in later should
 * be replacing the contents of `MascotSlot` and nothing else.
 */

/** Fixed aspect, so the capture is the same shape whatever the device. */
const CARD_WIDTH = 320;

export interface ShareCardProps {
  /** Small label above the headline — "Today", "Achievement unlocked". */
  readonly eyebrow: string;
  /** The one thing that must survive being shrunk. Keep it short. */
  readonly headline: string;
  /** One supporting line. The book, or what the achievement was for. */
  readonly subtitle: string;
  /** Optional detail lines, rendered small. First to become texture at thumbnail size. */
  readonly detail?: readonly string[] | undefined;
  readonly children?: ReactNode;
}

/**
 * `forwardRef` because the parent holds the ref that `captureRef` photographs, and it
 * must point at this outer `View` — the one carrying the background and the padding. A
 * ref on anything inside would produce an image with a transparent margin.
 */
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { eyebrow, headline, subtitle, detail, children },
  ref,
) {
  return (
    <ThemeProvider mode="light">
      <ShareCardBody
        ref={ref}
        eyebrow={eyebrow}
        headline={headline}
        subtitle={subtitle}
        {...(detail === undefined ? {} : { detail })}
      >
        {children}
      </ShareCardBody>
    </ThemeProvider>
  );
});

/**
 * Split from `ShareCard` so it renders *inside* the forced-light provider.
 *
 * `useTheme` reads from the nearest provider above the component calling it — called in
 * `ShareCard` itself it would return the app's theme, and the card would be laid out in
 * light colours drawn from the dark palette.
 */
const ShareCardBody = forwardRef<View, ShareCardProps>(function ShareCardBody(
  { eyebrow, headline, subtitle, detail, children },
  ref,
) {
  const theme = useTheme();

  return (
    <View
      ref={ref}
      testID="share-card"
      // `collapsable={false}` is load-bearing on Android: without it this View can be
      // flattened out of the native hierarchy as a pure container, and there is then no
      // native view for `captureRef` to photograph.
      collapsable={false}
      style={{
        width: CARD_WIDTH,
        backgroundColor: theme.palette.surface0,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
        borderWidth: theme.borderWidth.hairline,
        borderColor: theme.palette.border,
      }}
    >
      <MascotSlot />

      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="caption" tone="reward">
          {eyebrow}
        </Text>
        {/* The headline is the thumbnail. Two lines maximum — a third means the caller
            is putting a sentence where a number or a name belongs. */}
        <Text variant="display" numberOfLines={2} testID="share-card-headline">
          {headline}
        </Text>
        {/**
         * The book, and the second thing that has to survive being shrunk.
         *
         * **Changed after looking at a real capture at 130px.** It was `body`/`textMuted`
         * over two lines, and at thumbnail size that is grey, small and fragmented —
         * three things each working against legibility, so the book dissolved into
         * texture while the streak held. It is now `h3`, full-contrast and clipped to a
         * single line: a truncated title a stranger can read beats a complete one they
         * cannot. The criterion is explicit that the streak *and the book* must survive.
         */}
        <Text variant="h3" numberOfLines={1} testID="share-card-subtitle">
          {subtitle}
        </Text>
      </View>

      {children}

      {detail === undefined || detail.length === 0 ? null : (
        <View style={{ gap: theme.spacing.xs }}>
          {detail.map((line) => (
            <Text key={line} variant="small" tone="textMuted" numberOfLines={1}>
              {line}
            </Text>
          ))}
        </View>
      )}

      <Wordmark />
    </View>
  );
});

/**
 * The reserved mascot slot, §9.
 *
 * A band of reward colour and a single glyph stands in for the character that has not
 * been drawn yet. It occupies the space an illustration would, so adding one later is an
 * asset swap rather than a re-layout — which is the whole point of reserving it now.
 */
function MascotSlot(): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      testID="share-mascot-slot"
      style={{
        height: 64,
        borderRadius: theme.radius.md,
        backgroundColor: theme.palette.rewardSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="achievement" size={34} color={theme.palette.surface0} />
    </View>
  );
}

/**
 * The wordmark, and the reason the card exists at all.
 *
 * An image that does not say where it came from is a screenshot; one that does is a
 * growth mechanic. `PRODUCT.md` is explicit that these screens spread the product, so
 * this line is not decoration and must not be cropped out by a caller.
 */
function Wordmark(): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        borderTopWidth: theme.borderWidth.hairline,
        borderTopColor: theme.palette.border,
        paddingTop: theme.spacing.md,
      }}
    >
      <Icon name="journey" size={16} color={theme.palette.primary} />
      <Text variant="caption" tone="primary" testID="share-wordmark">
        ZoomOut
      </Text>
      <View style={{ flex: 1 }} />
      <Text variant="small" tone="textMuted">
        15 minutes a day
      </Text>
    </View>
  );
}
