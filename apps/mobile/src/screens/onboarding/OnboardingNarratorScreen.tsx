import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { NARRATOR_LABELS, type NarratorId } from '@zoomout/shared';

import { useNarrator } from '../../audio';
import { Button, Icon, Screen, StatusMessage, Text } from '../../components';
import { MIN_TOUCH_TARGET, useTheme } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { NarratorPreview, type NarratorCardState } from '../NarratorPreview';
import { useNarratorSamples } from '../useNarratorSamples';
import type { OnboardingVariant } from './useOnboardingGate';

type Props = NativeStackScreenProps<AppStackParamList, 'OnboardingNarrator'> & {
  /**
   * Which onboarding this is, **passed in by `AppStack` from the gate's status** — never
   * inferred from anything on this screen. It used to be inferred from whether a picked
   * Track had arrived; since ONBOARD-3 neither variant brings one, so nothing local can
   * tell them apart. This is the bug this package is most likely to ship if it is
   * wrong: an existing account that is never marked seen meets this beat on every launch.
   */
  readonly variant: OnboardingVariant;
  readonly markSeen: () => void;
};

/**
 * Meet the narrators: the beat where two voices introduce themselves.
 *
 * **What it is (ONBOARD-3):** each card plays that narrator saying hello — ONBOARD-2's two
 * fixed clips, fetched through the backend's own path. It used to sample a book's
 * narration, which demoed the *book* and needed a Track with narration to exist; these
 * work whichever Tracks exist, so the card is always playable.
 *
 * **It fails open (ONBOARD-3.1), the way the onboarding gate does** — see "Fails open,
 * deliberately" in `useOnboardingGate`. The hellos are an extra, never a toll: if they
 * cannot be fetched (a network error, any 4xx/5xx, an old backend's 404, an answer that is
 * not two clips) the beat still appears with **the same two cards, select-only** — a tap
 * chooses that narrator, nothing plays, no play control is offered — a one-line notice, a
 * *Try again*, and Continue. Before this, a failed fetch showed an error screen with a retry
 * and no way onward, so an existing account could not reach the app at all. A greeting that
 * loads but will not play shows a "couldn't play" state on its own card and changes nothing
 * else. Only *loading* is still a spinner with nothing to press — see the report on what a
 * request that never answers does.
 *
 * **Narration's optionality is stated in text** (`onboarding-narrator-optional`), not only
 * by what a narrator says aloud — a reader who cannot hear the clip still has to be told
 * they never have to press play. It is also true: `useNarration` never starts on its own.
 *
 * **Two variants meet here and end differently.**
 *  - `narratorOnly` (an existing account): Continue is the whole of their onboarding, so
 *    it marks them seen and lands on Tabs. There is no first Leaf to wait for.
 *  - `full` (a new account): Continue goes on to pick-book and **does not mark seen** —
 *    that waits for the first Leaf's close. This is the change from ONBOARD-1, where
 *    finishing here ended the flow.
 *
 * **A stored narrator is not overwritten (ONBOARD-3.1).** `picked` stays `null` until the
 * reader taps a card, and Continue writes only a real pick. The card shown as selected is
 * `picked ?? narrator`, `narrator` being what `useNarrator` restores — so a repeat pass
 * (reachable through the accepted quit-mid-first-Leaf design, or by anyone who chose in
 * Profile first) starts from their stored choice and leaves it alone unless they change it.
 * With nothing stored it starts from the default and writes nothing: the default is what
 * `useNarrator` reads back anyway.
 *
 * Neither variant sends the reader into a Leaf from here any more; that hand-off moved to
 * pick-book, where the book is actually chosen.
 */
export function OnboardingNarratorScreen({
  navigation,
  variant,
  markSeen,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { narrator, setNarrator } = useNarrator();
  const hellos = useNarratorSamples();

  // `null` until the reader taps a card. `narrator` restores asynchronously from the store,
  // so seeding state from it would either race the restore or overwrite it.
  const [picked, setPicked] = useState<NarratorId | null>(null);
  const selected = picked ?? narrator;

  const finish = useCallback((): void => {
    if (picked !== null) {
      setNarrator(picked);
    }

    if (variant === 'narratorOnly') {
      markSeen();
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
      return;
    }

    navigation.navigate('OnboardingPickBook');
  }, [markSeen, navigation, picked, setNarrator, variant]);

  if (hellos.status === 'loading') {
    return (
      <Screen testID="onboarding-narrator-screen" scrollable={false} centred>
        <ActivityIndicator testID="onboarding-narrator-loading" color={theme.palette.primary} />
      </Screen>
    );
  }

  const canHear = hellos.status === 'ready';

  return (
    <Screen testID="onboarding-narrator-screen">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" tone="textMuted">
            {variant === 'full' ? 'Step 2 of 3' : 'One more thing'}
          </Text>
          <Text variant="display">Meet your narrators</Text>
          {/* Only Ikigai has narration today, and slide 4 has no voice button — so "Leaves
              can be read aloud", not "every Leaf". The hello sentence is dropped when there
              are no hellos: it would promise a tap that plays nothing. */}
          <Text variant="body" tone="textMuted" testID="onboarding-narrator-intro">
            Leaves can be read aloud, if you&rsquo;d like.
            {canHear ? ' Tap a card to hear each narrator say hello.' : null}
          </Text>
          <Text variant="body" tone="textMuted" testID="onboarding-narrator-optional">
            Narration is optional &mdash; it only plays when you tap play, and you can change your
            pick anytime from your profile.
          </Text>
        </View>

        {canHear ? null : (
          <View style={{ gap: theme.spacing.md }}>
            <StatusMessage
              tone="info"
              testID="onboarding-narrator-hellos-notice"
              message="The hellos couldn’t load, but you can still pick a narrator."
            />
            <Button
              testID="onboarding-narrator-retry"
              label="Try again"
              variant="secondary"
              onPress={hellos.retry}
            />
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
          <NarratorPreview
            samples={hellos.samples}
            selected={selected}
            onSelect={setPicked}
            renderCard={(card) => <NarratorCard {...card} />}
          />
        </View>

        <Button testID="onboarding-narrator-continue" label="Continue" onPress={finish} />
      </View>
    </Screen>
  );
}

/**
 * One narrator. The name on the card is the name the clip speaks — that match is the
 * point of the beat (the founder checks it by ear at the device gate) — and comes from
 * the one shared map, never a provider voice id.
 *
 * The visible label is the bare name; the descriptor is in the accessibility label. A
 * reader hears this narrator before choosing, so the name is enough on screen, while a
 * screen-reader user who cannot start a clip still learns which voice each card is.
 *
 * **What the card offers follows what it can do.** With a hello loaded it shows the play
 * control and says "Tap to hear a hello"; without one it shows neither, because a card
 * that promised a hello and played nothing would be the beat's own dead tap. A hello that
 * failed to play swaps the control for the failure glyph and says so beneath the name —
 * text and glyph, never colour alone — and the accessibility label says the same, since the
 * label is all a screen reader reads from a card.
 */
function NarratorCard({
  narrator,
  selected,
  playable,
  playing,
  playbackFailed,
  onPress,
}: NarratorCardState): React.JSX.Element {
  const theme = useTheme();
  const label = NARRATOR_LABELS[narrator];
  const who = `${label.name}, ${label.descriptor.toLowerCase()}`;

  const accessibilityLabel = !playable
    ? who
    : playbackFailed
      ? `${who}. Couldn’t play the hello. Tap to try again.`
      : `${who}. Tap to hear a hello.`;

  return (
    <Pressable
      testID={`onboarding-narrator-${narrator}`}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: MIN_TOUCH_TARGET * 2,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xl,
        borderRadius: theme.radius.lg,
        borderWidth: selected ? theme.borderWidth.focus : theme.borderWidth.hairline,
        borderColor: selected ? theme.palette.primary : theme.palette.border,
        backgroundColor: pressed
          ? theme.surfaceFor('pressed')
          : selected
            ? theme.surfaceFor('raised')
            : theme.surfaceFor('card'),
      })}
    >
      {playable ? (
        <Icon
          testID={`onboarding-narrator-${narrator}-glyph`}
          name={playbackFailed ? 'unresolved' : playing ? 'pause' : 'play'}
          tone="primary"
          size={28}
        />
      ) : null}
      <Text variant="h3" tone={selected ? 'primary' : 'textPrimary'}>
        {label.name}
      </Text>
      {playbackFailed ? (
        <Text variant="small" tone="textMuted" testID={`onboarding-narrator-${narrator}-failed`}>
          Couldn&rsquo;t play
        </Text>
      ) : null}
    </Pressable>
  );
}
