import { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Track } from '@zoomout/shared';

import { useApi } from '../auth/AuthProvider';
import { Button, ErrorState, Screen, Text, TrackLegal } from '../components';
import { useTheme } from '../design';
import type { AppStackParamList } from '../navigation/types';
import { useAsyncResource } from './useAsyncResource';

type DetailRoute = RouteProp<AppStackParamList, 'TrackDetail'>;
type DetailNavigation = NativeStackNavigationProp<AppStackParamList, 'TrackDetail'>;

/**
 * One book: what it is, and the two things the law requires the reader to be shown.
 *
 * **Added in WP10 because it did not exist and had to.** WP3 made a Track unservable
 * without a non-endorsement disclaimer and a purchase-forward link, and the app had
 * never rendered either — there was no screen where a Track was more than a cover, a
 * title and an author. The handoff's §3 asked whether these surfaces were displayed;
 * they were not, anywhere.
 *
 * Deliberately thin. It is not a contents list — Journey and Library already own
 * "where am I in this" — it is the page where a book is credited, disclaimed, and
 * pointed at.
 */
export function TrackDetailScreen(): React.JSX.Element {
  const api = useApi();
  const theme = useTheme();
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<DetailNavigation>();
  const { trackId } = route.params;

  const load = useCallback(async (): Promise<Track> => api.getTrack(trackId), [api, trackId]);
  const track = useAsyncResource<Track>(load);

  if (track.status === 'loading') {
    return (
      <Screen testID="track-detail-loading" scrollable={false} centred>
        <Text variant="body" tone="textMuted">
          Loading…
        </Text>
      </Screen>
    );
  }

  if (track.status === 'error' || track.data === null) {
    return (
      <Screen testID="track-detail-screen">
        <ErrorState
          testID="track-detail-error"
          message={track.error ?? 'Could not load this book.'}
          onRetry={track.reload}
        />
      </Screen>
    );
  }

  const book = track.data;

  return (
    <Screen testID="track-detail-screen">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" tone="primary">
            {book.author}
          </Text>
          <Text variant="display" testID="track-detail-title">
            {book.bookTitle}
          </Text>
          {book.publisher === null ? null : (
            <Text variant="small" tone="textMuted">
              {book.publisher}
            </Text>
          )}
        </View>

        <Text variant="body">{book.description}</Text>

        {/* The legal pair. Above the fold on this screen, not below a Leaf list. */}
        <TrackLegal track={book} testID="track-detail-legal" />

        <Button
          label="Back"
          variant="secondary"
          testID="track-detail-back"
          onPress={() => {
            navigation.goBack();
          }}
        />
      </View>
    </Screen>
  );
}
