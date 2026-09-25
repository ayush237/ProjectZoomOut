import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import type { ApiClient } from '../../api/client';
import { useApi } from '../../auth/AuthProvider';
import { Button, ErrorState, Screen, StatusMessage, Text } from '../../components';
import { useTheme } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { useAsyncResource } from '../useAsyncResource';
import { fetchRealTracks } from './fetchRealTracks';
import { OnboardingBookCard } from './OnboardingBookCard';

type Props = NativeStackScreenProps<AppStackParamList, 'OnboardingPickBook'> & {
  readonly markSeen: () => void;
};

/**
 * The last beat before the first Leaf: pick your first book.
 *
 * **It ends the flow's setup, so it also does what used to happen at the narrator beat
 * (ONBOARD-3):** add the book to the Library, work out which Leaf is next, and reset into
 * `[Tabs, LeafPlayer]`. The reset carries `onboarding: true` — a serialisable flag, not
 * content — which is what lets the player's completion exits open `WrapUp` as the closing.
 *
 * **It does not mark onboarding seen when it does.** The reader is not done: they are
 * about to read their first Leaf, and onboarding ends when they have finished it and been
 * shown the close (`WrapUp`, on mount). Only **Skip** marks seen here — an explicit skip
 * is a decision — and so does the one failure path below, where there is no first Leaf to
 * carry them into. See the table in `useOnboardingGate` for every row.
 *
 * **The achievement banner is suppressed here, deliberately** (ONBOARD-1 finding 3).
 * `addToLibrary` earns `first-book` on this exact tap, and `ExploreScreen` is `first-
 * book`'s only other surface — but a reader who taps "Choose this book" a few seconds
 * into their very first session does not yet know what an achievement *is*, and a
 * celebratory banner about a mechanic they have not been introduced to competes with
 * the beat that follows rather than adding to it. The achievement itself is not lost:
 * it is recorded server-side the same as any other, and the founder's own eye can
 * decide later whether Profile's achievement grid should be where a reader who took
 * this path first meets it.
 */
export function OnboardingPickBookScreen({ navigation, markSeen }: Props): React.JSX.Element {
  const theme = useTheme();
  const api = useApi();

  const load = useCallback(() => fetchRealTracks(api), [api]);
  const tracks = useAsyncResource(load);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const choose = useCallback(
    async (trackId: string, title: string): Promise<void> => {
      setActionError(null);
      setPendingId(trackId);

      try {
        // The achievement banner is deliberately not read from this response — see
        // the component's own docstring above.
        await api.addToLibrary(trackId);
      } catch {
        setActionError('Could not add that book. Please try again.');
        setPendingId(null);
        return;
      }

      const leafId = await resumeLeafId(api, trackId);

      if (leafId === undefined) {
        // The book is in the Library either way, so nothing is lost but the hand-off
        // straight into Leaf 1 — Library's own "Start reading" makes the same lookup
        // again. But no first Leaf is coming, so nothing later will close their
        // onboarding, and leaving the flag unset would send them back to the narrator
        // beat on the next launch (the Library is no longer empty). The flow is over.
        markSeen();
        navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
        return;
      }

      // Not marked seen — see the docstring. `onboarding: true` is what carries "this is
      // the first Leaf" through to the completion panel and on to `WrapUp`.
      navigation.reset({
        index: 1,
        routes: [
          { name: 'Tabs' },
          {
            name: 'LeafPlayer',
            params: { leafId, trackId, trackTitle: title, onboarding: true },
          },
        ],
      });
    },
    [api, markSeen, navigation],
  );

  const skip = useCallback(() => {
    markSeen();
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  }, [markSeen, navigation]);

  if (tracks.status === 'loading') {
    return (
      <Screen testID="onboarding-pickbook-screen" scrollable={false} centred>
        <ActivityIndicator testID="onboarding-pickbook-loading" color={theme.palette.primary} />
      </Screen>
    );
  }

  if (tracks.status === 'error') {
    return (
      <Screen testID="onboarding-pickbook-screen">
        <ErrorState
          testID="onboarding-pickbook-error"
          message={tracks.error ?? 'Something went wrong.'}
          onRetry={tracks.reload}
        />
      </Screen>
    );
  }

  const books = tracks.data ?? [];

  return (
    <Screen testID="onboarding-pickbook-screen">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="caption" tone="textMuted">
            Step 3 of 3
          </Text>
          <Text variant="display">Pick your first book</Text>
        </View>

        {actionError === null ? null : (
          <StatusMessage tone="error" testID="onboarding-pickbook-error-banner" message={actionError} />
        )}

        <View style={{ gap: theme.spacing.lg }}>
          {books.map((track) => (
            <OnboardingBookCard
              key={track.id}
              track={track}
              testID={`onboarding-pickbook-${track.id}`}
              busy={pendingId === track.id}
              onChoose={() => {
                void choose(track.id, track.bookTitle);
              }}
            />
          ))}
        </View>

        <Button
          testID="onboarding-pickbook-skip"
          label="Skip for now"
          variant="quiet"
          onPress={skip}
        />
      </View>
    </Screen>
  );
}

/**
 * The Leaf to open first: the server-computed resume target, read from the Library entry
 * for the book just added.
 *
 * **Never `listLeaves(trackId)[0]`** (ONBOARD-1 finding 4) — that list knows nothing about
 * visibility or completion, while `progress.nextLeafId` is what `LibraryScreen`'s own
 * "Start reading" opens. `undefined` when there is no such Leaf or the lookup failed; the
 * caller treats both the same, and a failure is logged rather than swallowed silently.
 */
async function resumeLeafId(
  api: Pick<ApiClient, 'listLibrary'>,
  trackId: string,
): Promise<string | undefined> {
  try {
    const entries = await api.listLibrary();
    const entry = entries.find((candidate) => candidate.track.id === trackId);

    return entry?.progress.nextLeafId ?? undefined;
  } catch (caught) {
    console.warn('[onboarding] could not look up the first Leaf after adding the book', caught);
    return undefined;
  }
}
