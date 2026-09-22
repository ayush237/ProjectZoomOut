import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

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
 * Beat 2 of 5: pick your first book.
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
        navigation.navigate('OnboardingNarrator', { pickedTrack: { id: trackId, title } });
      } catch {
        setActionError('Could not add that book. Please try again.');
        setPendingId(null);
      }
    },
    [api, navigation],
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
            Step 2 of 3
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
