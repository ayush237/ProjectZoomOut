import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { AudioRef, NarratorId } from '@zoomout/shared';
import { NARRATOR_IDS } from '@zoomout/shared';

import { DEFAULT_NARRATOR, useNarrator, useNarration } from '../../audio';
import { useApi } from '../../auth/AuthProvider';
import { Button, ErrorState, Icon, Screen, Text } from '../../components';
import { MIN_TOUCH_TARGET, useTheme } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { useAsyncResource } from '../useAsyncResource';
import { fetchNarratorSample, type NarratorSample } from './fetchNarratorSample';

type Props = NativeStackScreenProps<AppStackParamList, 'OnboardingNarrator'> & {
  readonly markSeen: () => void;
};

/** Reader-facing names — never the pipeline's provider voice names. Duplicated rather
 *  than imported: `NarrationControl.tsx` and `ProfileScreen.tsx` each keep their own
 *  copy of this same table already, an established convention in this codebase rather
 *  than an oversight to fix here. */
const NARRATOR_LABELS: Record<NarratorId, string> = {
  female: 'Female',
  male: 'Male',
};

/**
 * Beat 3 of 5 for a new reader — the only beat an existing account sees.
 *
 * **Always samples Ikigai, never the just-picked book** (ONBOARD-1 finding, ruled
 * 2026-09-18): only Ikigai has narration today, so the sample is fixed regardless of
 * `route.params.pickedTrack`. That param decides only where "Continue" goes next.
 */
export function OnboardingNarratorScreen({
  navigation,
  route,
  markSeen,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const api = useApi();
  const { setNarrator } = useNarrator();

  const loadSample = useCallback(() => fetchNarratorSample(api), [api]);
  const sample = useAsyncResource<NarratorSample>(loadSample);

  const [selected, setSelected] = useState<NarratorId>(DEFAULT_NARRATOR);
  const [continuing, setContinuing] = useState(false);

  // `route.params` is `undefined`, not `{}`, when this screen is the stack's own
  // `initialRouteName` and nobody passed params — exactly the narrator-only variant's
  // real shape (`AppStack` opens here directly, with no `initialParams`).
  const pickedTrack = route.params?.pickedTrack;

  const finish = useCallback(async (): Promise<void> => {
    setContinuing(true);
    setNarrator(selected);
    markSeen();

    if (pickedTrack === undefined) {
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
      return;
    }

    // The server-computed resume target (ONBOARD-1 finding 4) — never
    // `listLeaves(trackId)[0]`, which knows nothing about visibility or completion.
    try {
      const entries = await api.listLibrary();
      const entry = entries.find((candidate) => candidate.track.id === pickedTrack.id);
      const leafId = entry?.progress.nextLeafId;

      if (leafId === undefined || leafId === null) {
        navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
        return;
      }

      navigation.reset({
        index: 1,
        routes: [
          { name: 'Tabs' },
          {
            name: 'LeafPlayer',
            params: { leafId, trackId: pickedTrack.id, trackTitle: pickedTrack.title },
          },
        ],
      });
    } catch {
      // The book is already in the Library either way (beat 2's own addToLibrary
      // succeeded before this screen could even open) — a failed resume lookup loses
      // the "straight into Leaf 1" hand-off, not the reader's progress. Landing on
      // Tabs leaves Library's own "Start reading" button to try the same lookup again.
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    }
  }, [api, markSeen, navigation, pickedTrack, selected, setNarrator]);

  if (sample.status === 'loading') {
    return (
      <Screen testID="onboarding-narrator-screen" scrollable={false} centred>
        <ActivityIndicator testID="onboarding-narrator-loading" color={theme.palette.primary} />
      </Screen>
    );
  }

  if (sample.status === 'error') {
    return (
      <Screen testID="onboarding-narrator-screen">
        <ErrorState
          testID="onboarding-narrator-error"
          message={sample.error ?? 'Something went wrong.'}
          onRetry={sample.reload}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="onboarding-narrator-screen">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="caption" tone="textMuted">
            {pickedTrack === undefined ? 'One more thing' : 'Step 3 of 3'}
          </Text>
          <Text variant="display">Choose your narrator</Text>
          <Text variant="body" tone="textMuted">
            Tap a voice to hear it. You can change this anytime from your profile.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
          {NARRATOR_IDS.map((narrator) => (
            <NarratorSampleCard
              key={narrator}
              narrator={narrator}
              audio={sample.data?.[narrator]}
              selected={selected === narrator}
              onSelect={() => {
                setSelected(narrator);
              }}
            />
          ))}
        </View>

        <Button
          testID="onboarding-narrator-continue"
          label={pickedTrack === undefined ? 'Continue' : 'Start reading'}
          busy={continuing}
          onPress={() => {
            void finish();
          }}
        />
      </View>
    </Screen>
  );
}

interface NarratorCardProps {
  readonly narrator: NarratorId;
  readonly audio: AudioRef | undefined;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

/**
 * Picks which card renders, so the play-capable one is the only place `useNarration` is
 * ever called — an `audio` that starts `undefined` and later becomes defined would be a
 * hook conditionally appearing on the same component across renders, which the rules of
 * hooks forbid. `audio` is settled once, before either card mounts (the parent gates on
 * `sample.status`), so the choice below never actually flips — this is what keeps it
 * safe by construction rather than by accident.
 */
function NarratorSampleCard(props: NarratorCardProps): React.JSX.Element {
  if (props.audio === undefined) {
    return <StaticNarratorCard {...props} />;
  }

  return <PlayableNarratorCard {...props} audio={props.audio} />;
}

function PlayableNarratorCard({
  narrator,
  audio,
  selected,
  onSelect,
}: NarratorCardProps & { readonly audio: AudioRef }): React.JSX.Element {
  const narration = useNarration(audio);

  return (
    <CardShell
      narrator={narrator}
      selected={selected}
      onSelect={() => {
        onSelect();
        narration.toggle();
      }}
    >
      <Icon name={narration.playing ? 'pause' : 'play'} tone="primary" size={28} />
    </CardShell>
  );
}

/** No sample for this narrator (a content gap, not an error) — still selectable, with
 *  no play affordance rather than a disabled-looking one for a control that was never
 *  going to work anyway. */
function StaticNarratorCard({ narrator, selected, onSelect }: NarratorCardProps): React.JSX.Element {
  return (
    <CardShell narrator={narrator} selected={selected} onSelect={onSelect}>
      <Icon name="book" tone="textMuted" size={28} />
    </CardShell>
  );
}

function CardShell({
  narrator,
  selected,
  onSelect,
  children,
}: {
  readonly narrator: NarratorId;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      testID={`onboarding-narrator-${narrator}`}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${NARRATOR_LABELS[narrator]} narrator, tap to hear a sample`}
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
      {children}
      <Text variant="h3" tone={selected ? 'primary' : 'textPrimary'}>
        {NARRATOR_LABELS[narrator]}
      </Text>
    </Pressable>
  );
}
