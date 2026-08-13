import { useState } from 'react';
import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { MIN_TOUCH_TARGET, useTheme } from '../design';
import { Text } from './Text';

/**
 * A labelled text input.
 *
 * The label is always visible rather than a placeholder that disappears on focus:
 * placeholder-as-label is the single most common accessibility defect in mobile forms —
 * the reader loses the question the moment they start answering it, and a screen reader
 * loses it entirely.
 *
 * An invalid field is marked by a border colour **and** a message with a glyph, never
 * by colour alone (§3).
 */

export interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly secureTextEntry?: boolean;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly autoCapitalize?: 'none' | 'sentences' | 'words';
  readonly autoComplete?: 'email' | 'password' | 'new-password' | 'name' | 'birthdate-full' | 'off';
  readonly error?: string | undefined;
  /** Guidance shown under the field while it is valid, e.g. a date format. */
  readonly hint?: string | undefined;
  /**
   * Grows to several lines for free text (WP10's error report).
   *
   * The height is set here rather than left to the platform because an auto-sizing
   * multiline input starting at one line reads as a single-line field, and readers
   * write one clause into it and stop.
   */
  readonly multiline?: boolean;
  readonly testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete = 'off',
  error,
  hint,
  multiline = false,
  testID,
}: TextFieldProps): React.JSX.Element {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColour = error !== undefined
    ? theme.palette.incorrect
    : focused
      ? theme.palette.primary
      : theme.palette.border;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>

      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        {...(placeholder === undefined ? {} : { placeholder })}
        placeholderTextColor={theme.palette.textMuted}
        secureTextEntry={secureTextEntry}
        {...(keyboardType === undefined ? {} : { keyboardType })}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        multiline={multiline}
        // `top` so text starts at the top of a tall box rather than vertically centred,
        // which on Android is the difference between a text area and an odd-looking input.
        {...(multiline ? { textAlignVertical: 'top' as const } : {})}
        accessibilityLabel={label}
        // Announced, so a screen reader reaches the field already knowing it is wrong
        // rather than discovering it from a message rendered somewhere after it.
        {...(error === undefined ? {} : { accessibilityHint: error })}
        style={[
          styles.input,
          theme.typography.body,
          {
            color: theme.palette.textPrimary,
            backgroundColor: theme.surfaceFor('raised'),
            borderColor: borderColour,
            borderRadius: theme.radius.sm,
            borderWidth: focused || error !== undefined ? theme.borderWidth.focus : theme.borderWidth.hairline,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            ...(multiline ? { minHeight: 96 } : {}),
          },
        ]}
      />

      {error === undefined ? (
        hint === undefined ? null : (
          <Text variant="small" tone="textMuted">
            {hint}
          </Text>
        )
      ) : (
        <View style={[styles.errorRow, { gap: theme.spacing.sm }]}>
          {/* The non-colour half of the signal. */}
          <Text variant="small" tone="incorrect" accessibilityElementsHidden>
            !
          </Text>
          <Text variant="small" tone="incorrect" style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    // Minimum, not fixed: the field grows with the OS font size instead of clipping.
    minHeight: MIN_TOUCH_TARGET,
  },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start' },
  errorText: { flex: 1, flexShrink: 1 },
});
