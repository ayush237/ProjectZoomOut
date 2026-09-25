import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { NarratorId, NarratorSamples } from '@zoomout/shared';
import { NARRATOR_IDS, NARRATOR_LABELS } from '@zoomout/shared';

import { DEFAULT_NARRATOR, useNarrator, useNarration, type Narration } from '../../audio';
import { useApi } from '../../auth/AuthProvider';
import { Button, ErrorState, Icon, Screen, Text } from '../../components';
import { MIN_TOUCH_TARGET, useTheme } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { useAsyncResource } from '../useAsyncResource';
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
 * **What it is now (ONBOARD-3):** each card plays that narrator saying hello — ONBOARD-2's
 * two fixed clips, fetched through the backend's own path. It used to sample a book's
 * narration, which demoed the *book* and needed a Track with narration to exist; these
 * work whichever Tracks exist, so the card is always playable.
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
 * Neither variant sends the reader into a Leaf from here any more; that hand-off moved to
 * pick-book, where the book is actually chosen.
 */
export function OnboardingNarratorScreen({
  navigation,
  variant,
  markSeen,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const api = useApi();
  const { setNarrator } = useNarrator();

  const loadSamples = useCallback(() => api.getNarratorSamples(), [api]);
  const samples = useAsyncResource<NarratorSamples>(loadSamples);

  // The default is a real choice, not a placeholder: Continue keeps it (there is no Skip
  // on this beat, because continuing without choosing already means "the default").
  const [selected, setSelected] = useState<NarratorId>(DEFAULT_NARRATOR);

  const finish = useCallback((): void => {
    setNarrator(selected);

    if (variant === 'narratorOnly') {
      markSeen();
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
      return;
    }

    navigation.navigate('OnboardingPickBook');
  }, [markSeen, navigation, selected, setNarrator, variant]);

  if (samples.status === 'loading') {
    return (
      <Screen testID="onboarding-narrator-screen" scrollable={false} centred>
        <ActivityIndicator testID="onboarding-narrator-loading" color={theme.palette.primary} />
      </Screen>
    );
  }

  if (samples.status === 'error' || samples.data === null) {
    return (
      <Screen testID="onboarding-narrator-screen">
        <ErrorState
          testID="onboarding-narrator-error"
          message={samples.error ?? 'Something went wrong.'}
          onRetry={samples.reload}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="onboarding-narrator-screen">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" tone="textMuted">
            {variant === 'full' ? 'Step 2 of 3' : 'One more thing'}
          </Text>
          <Text variant="display">Meet your narrators</Text>
          <Text variant="body" tone="textMuted">
            Every Leaf can be read aloud, if you&rsquo;d like. Tap a card to hear each narrator say
            hello.
          </Text>
          <Text variant="body" tone="textMuted" testID="onboarding-narrator-optional">
            Narration is optional &mdash; it only plays when you tap play, and you can change your
            pick anytime from your profile.
          </Text>
        </View>

        <NarratorPicker samples={samples.data} selected={selected} onSelect={setSelected} />

        <Button testID="onboarding-narrator-continue" label="Continue" onPress={finish} />
      </View>
    </Screen>
  );
}

/**
 * Both cards, and the one player each of them drives.
 *
 * **The two `useNarration` calls live here, side by side, and not one per card** — so a
 * card can stop the other. Two five-second hellos talking over each other is not an
 * introduction, and the natural way to compare two voices is to tap one and then the
 * other. Each is called unconditionally, in a fixed order, on a closed pair of narrators
 * (`Record<NarratorId, …>` below turns a third into a compile error), so the rules of
 * hooks hold by construction and not by a runtime check.
 *
 * **Plays that narrator's clip regardless of the reader's stored preference** — the
 * reason `useNarration` is exported on its own: `NarrationControl` (built on it) picks
 * the *stored* narrator's clip, which cannot be pointed at "whichever card was tapped"
 * before any preference exists.
 */
function NarratorPicker({
  samples,
  selected,
  onSelect,
}: {
  readonly samples: NarratorSamples;
  readonly selected: NarratorId;
  readonly onSelect: (narrator: NarratorId) => void;
}): React.JSX.Element {
  const theme = useTheme();

  const female = useNarration(samples.female);
  const male = useNarration(samples.male);
  const players: Record<NarratorId, Narration> = { female, male };

  const press = (narrator: NarratorId): void => {
    onSelect(narrator);

    for (const other of NARRATOR_IDS) {
      if (other !== narrator && players[other].playing) {
        // `toggle` on a playing clip pauses it — the hook has no separate `pause`.
        players[other].toggle();
      }
    }

    players[narrator].toggle();
  };

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
      {NARRATOR_IDS.map((narrator) => (
        <NarratorCard
          key={narrator}
          narrator={narrator}
          selected={selected === narrator}
          playing={players[narrator].playing}
          onPress={() => {
            press(narrator);
          }}
        />
      ))}
    </View>
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
 */
function NarratorCard({
  narrator,
  selected,
  playing,
  onPress,
}: {
  readonly narrator: NarratorId;
  readonly selected: boolean;
  readonly playing: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const label = NARRATOR_LABELS[narrator];

  return (
    <Pressable
      testID={`onboarding-narrator-${narrator}`}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label.name}, ${label.descriptor.toLowerCase()}. Tap to hear a hello.`}
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
      <Icon name={playing ? 'pause' : 'play'} tone="primary" size={28} />
      <Text variant="h3" tone={selected ? 'primary' : 'textPrimary'}>
        {label.name}
      </Text>
    </Pressable>
  );
}
