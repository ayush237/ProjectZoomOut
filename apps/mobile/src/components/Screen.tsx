import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../design';

/**
 * The page container.
 *
 * Scrollable by default, and that is an accessibility decision rather than a layout
 * one: at a large OS font size, content that fits on a fresh install stops fitting, and
 * a fixed screen clips it with no way to reach what is missing. Scrolling costs nothing
 * when everything fits and is the difference between usable and broken when it does not.
 */

export interface ScreenProps {
  readonly children: ReactNode;
  /** Turns off scrolling for screens that manage their own, e.g. a list. */
  readonly scrollable?: boolean;
  /** Centres content vertically. Used by the single-message screens. */
  readonly centred?: boolean;
  readonly testID?: string;
}

export function Screen({
  children,
  scrollable = true,
  centred = false,
  testID,
}: ScreenProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: insets.top + theme.spacing.lg,
    paddingBottom: insets.bottom + theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
  };

  // `elevation.page` resolves to a surface colour. There is no shadow anywhere in this
  // app — depth is surface lightness (design-direction.md §5).
  const background = { backgroundColor: theme.surfaceFor('page') };

  if (!scrollable) {
    return (
      <View testID={testID} style={[styles.fill, background, padding, centred && styles.centred]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      testID={testID}
      style={[styles.fill, background]}
      contentContainerStyle={[padding, styles.grow, centred && styles.centred]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  centred: { justifyContent: 'center' },
});
