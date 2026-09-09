import { View } from 'react-native';

import { useTheme } from '../../design';

/**
 * The rounded card each slide's content sits inside (WP23.1).
 *
 * `design/leaf_player/`'s screenshots wrap Summary, Scenario, Sticky notes and Takeaway
 * in one consistent panel — the compositional change that makes the player "read as one
 * screen" rather than four old slides around one new board. Payoff is the deliberate
 * exception: its own docstring explains why it keeps its existing treatment instead.
 *
 * Tokens only — `surfaceFor('card')` and `border` are the same pair `StickyNotesSlide`'s
 * board and `TakeawaySlide`'s apply-in-life panel already use, so this is reuse of an
 * established local pattern rather than a new one.
 */
export function SlideFrame({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.surfaceFor('card'),
        borderRadius: theme.radius.lg,
        borderWidth: theme.borderWidth.hairline,
        borderColor: theme.palette.border,
        padding: theme.spacing.lg,
        gap: theme.spacing.xl,
      }}
    >
      {children}
    </View>
  );
}
