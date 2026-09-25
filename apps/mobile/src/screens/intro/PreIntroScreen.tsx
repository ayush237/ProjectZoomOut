import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../components';
import { useTheme } from '../../design';

/**
 * The name, as it is set on screen. No logo exists in the design system, so — as the
 * approved onboarding prototype's own Welcome screen does — the wordmark is the word in
 * the display face (Nunito 700), not an image.
 */
export const PRE_INTRO_WORDMARK = 'ZoomOut';

/**
 * The one line under the wordmark.
 *
 * **A first draft, and the founder's call** — it is read at the device gate, like every
 * line of copy in the first-run flow. It is a constant so changing it is one edit and
 * the test follows it rather than pinning a string that was never final.
 */
export const PRE_INTRO_LINE = 'The big picture, one small idea at a time.';

export interface PreIntroScreenProps {
  readonly onContinue: () => void;
  readonly testID?: string;
}

/**
 * The first thing a brand-new install sees, before sign-up (ONBOARD-3): a wordmark, one
 * line, and a tap to go on. Deliberately **not** a second INTRO-1 — that is the
 * animation, and it now waits until there is an account to welcome; this is a still
 * frame that says what the app is called and gets out of the way.
 *
 * **Once per install, on the flag INTRO-1 used to own.** `RootNavigator` gates this with
 * the existing `useIntroSeen` / `introSeenStore` (same SecureStore key, same
 * once-per-install semantics), so this is a component swap in the pre-auth branch, not a
 * new gate. The known consequence is deliberate, not a bug: an install that already saw
 * the old intro has that key set and will not see this one.
 *
 * Static, so there is no motion for Reduce Motion to accommodate. The whole screen is
 * the tap target — a "Continue" button on a screen with nothing else to do would only be
 * a smaller thing to miss.
 */
export function PreIntroScreen({
  onContinue,
  testID = 'pre-intro-screen',
}: PreIntroScreenProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      testID={testID}
      onPress={onContinue}
      accessibilityRole="button"
      accessibilityLabel={`${PRE_INTRO_WORDMARK}. ${PRE_INTRO_LINE}`}
      accessibilityHint="Continues to sign in"
      style={{
        flex: 1,
        justifyContent: 'center',
        backgroundColor: theme.surfaceFor('page'),
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingHorizontal: theme.spacing.xl,
      }}
    >
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="display" testID="pre-intro-wordmark">
          {PRE_INTRO_WORDMARK}
        </Text>
        <Text variant="body" tone="textMuted" testID="pre-intro-line">
          {PRE_INTRO_LINE}
        </Text>
      </View>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: theme.spacing.xl,
          right: theme.spacing.xl,
          bottom: insets.bottom + theme.spacing.xl,
          alignItems: 'center',
        }}
      >
        <Text variant="caption" tone="textMuted">
          Tap to continue
        </Text>
      </View>
    </Pressable>
  );
}
