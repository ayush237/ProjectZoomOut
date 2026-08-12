import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { TakeawaySlide as TakeawaySlideData } from '@zoomout/shared';

import { Icon, Text } from '../../components';
import { MIN_TOUCH_TARGET, useTheme } from '../../design';

/**
 * Slide 5 of 5. The one line to leave with, plus an optional fact.
 *
 * **Dinner Table Knowledge is opened by the reader, never pre-expanded.** The name is
 * the specification: it is the thing you repeat to someone else that evening, and its
 * value comes from being a small deliberate discovery at the end rather than a second
 * paragraph competing with the takeaway. Rendering it open would make the takeaway the
 * shorter of two blocks on its own slide.
 *
 * It is genuinely optional — roughly a third of Leaves have one — so the control is
 * absent, not disabled, when there is nothing behind it.
 */
export function TakeawaySlide({
  data,
  onOpenDinnerTable,
}: {
  readonly data: TakeawaySlideData;
  /**
   * Called the first time the fact is revealed (WP5b).
   *
   * Opening it is invisible server-side — the fact travels with the Leaf and is revealed
   * by this tap — so this callback is the only thing that records the deep-cut content
   * was read. Deliberately not called on the tap that *hides* it again.
   */
  readonly onOpenDinnerTable?: (() => void) | undefined;
}): React.JSX.Element {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const fact = data.dinnerTableKnowledge;

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.lg }}>
        <Text variant="caption" tone="textMuted">
          Takeaway
        </Text>
        <Text variant="h2">{data.body}</Text>
      </View>

      {fact === undefined ? null : (
        <View
          style={{
            backgroundColor: theme.surfaceFor('card'),
            borderRadius: theme.radius.lg,
            borderWidth: theme.borderWidth.hairline,
            borderColor: theme.palette.border,
            overflow: 'hidden',
          }}
        >
          <Pressable
            testID="dinner-table-toggle"
            onPress={() => {
              // Read outside the updater: a state updater must stay pure, and React
              // may invoke it twice. The one-report-per-session guard lives in
              // `useLeafSession`, so a stale read here costs nothing.
              if (!open) {
                onOpenDinnerTable?.();
              }

              setOpen((current) => !current);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityHint={
              open ? 'Hides the fact' : 'Reveals a fact worth repeating to someone else'
            }
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH_TARGET,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              padding: theme.spacing.lg,
              backgroundColor: pressed ? theme.surfaceFor('pressed') : 'transparent',
            })}
          >
            <Icon name="idea" size={20} color={theme.palette.reward} />
            {/* `flex: 1` so a long label wraps instead of pushing the chevron off the
                row — at XXXL this label is three lines on a narrow screen. */}
            <Text variant="h3" tone="reward" style={{ flex: 1 }}>
              Dinner table knowledge
            </Text>
            <Text variant="caption" tone="textMuted">
              {open ? 'Hide' : 'Show'}
            </Text>
          </Pressable>

          {open ? (
            <View
              testID="dinner-table-fact"
              style={{
                paddingHorizontal: theme.spacing.lg,
                paddingBottom: theme.spacing.lg,
              }}
            >
              <Text variant="body">{fact}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
