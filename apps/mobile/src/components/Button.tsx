import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET, useTheme } from '../design';
import { Text } from './Text';

/**
 * A pill button.
 *
 * Fully rounded on purpose: `design-direction.md` §5 calls it "the single cheapest
 * signal that this is a game-shaped product rather than a reader", and generous radii
 * carry most of the playful register without any other decoration.
 *
 * The pressed state is a **surface change**, not a shadow or an opacity dip — same rule
 * as everywhere else in this app, and the only depth cue that works on a dark
 * background.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly testID?: string;
  /** Overrides the label for screen readers where the visible text is not enough. */
  readonly accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  testID,
  accessibilityLabel,
}: ButtonProps): React.JSX.Element {
  const theme = useTheme();
  const inert = disabled || busy;

  const background = (pressed: boolean): string => {
    if (variant === 'quiet') {
      return pressed ? theme.surfaceFor('raised') : 'transparent';
    }
    if (variant === 'secondary') {
      return pressed ? theme.surfaceFor('pressed') : theme.surfaceFor('raised');
    }
    return pressed ? theme.palette.primaryPress : theme.palette.primary;
  };

  const labelTone = variant === 'primary' ? undefined : ('primary' as const);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy }}
      {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background(pressed),
          borderRadius: theme.radius.full,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          borderWidth: variant === 'secondary' ? theme.borderWidth.hairline : 0,
          borderColor: theme.palette.border,
        },
        // Dimmed rather than hidden: a disabled control the reader can still see tells
        // them the action exists and is unavailable, which a vanished one does not.
        inert && styles.inert,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={variant === 'primary' ? theme.palette.onPrimary : theme.palette.primary}
        />
      ) : (
        <View style={styles.content}>
          <Text
            variant="h3"
            align="center"
            {...(labelTone === undefined ? {} : { tone: labelTone })}
            style={variant === 'primary' ? { color: theme.palette.onPrimary } : undefined}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inert: { opacity: 0.5 },
});
