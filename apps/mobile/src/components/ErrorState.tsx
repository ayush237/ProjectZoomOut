import { StyleSheet, View } from 'react-native';

import { useTheme } from '../design';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * A failed fetch, with a way out.
 *
 * The acceptance criterion is specific: a CMS-unreachable 503 must render **a readable
 * message with a retry**, never a blank screen and never a raw error. Blank is what you
 * get by rendering a null list; raw is what you get by putting `error.message` on
 * screen. This component is the third option, and every screen that fetches uses it so
 * none of them can drift into either failure.
 */

export interface ErrorStateProps {
  /** Reader-facing text. Already sanitised by `useAsyncResource`. */
  readonly message: string;
  readonly onRetry: () => void;
  readonly testID?: string;
}

export function ErrorState({ message, onRetry, testID }: ErrorStateProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View testID={testID} style={[styles.container, { gap: theme.spacing.lg }]}>
      <Icon name="error" tone="incorrect" size={48} />

      <Text variant="h2" align="center">
        That did not load
      </Text>

      <Text variant="body" tone="textMuted" align="center" style={styles.message}>
        {message}
      </Text>

      {/* The retry is the point. An error screen without one leaves the reader with
          nothing to do but close the app. */}
      <Button testID={`${testID ?? 'error'}-retry`} label="Try again" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // `flexGrow` rather than `flex`, so the message can exceed the viewport and scroll
    // at large text sizes instead of clipping.
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  message: { maxWidth: 320, width: '100%' },
});
