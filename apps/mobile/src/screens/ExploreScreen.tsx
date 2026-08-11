import type { Track } from '@zoomout/shared';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import type { TrackPage } from '../api/client';
import { useApi } from '../auth/AuthProvider';
import { Button, EmptyState, ErrorState, Screen, StatusMessage, Text, TrackCard } from '../components';
import { useTheme } from '../design';
import { useAsyncResource } from './useAsyncResource';
import { useRefreshOnFocus } from './useRefreshOnFocus';

/**
 * Explore — every published Track, and the way into a Library.
 *
 * Placeholder visibility is not decided here. `ContentService` already returns only
 * what this reader may see, so the screen renders what it is given; a client-side
 * filter would be a second opinion about which content is real, and the two would
 * disagree the first time one of them changed.
 */
export function ExploreScreen(): React.JSX.Element {
  const theme = useTheme();
  const api = useApi();

  const load = useCallback(async (): Promise<TrackPage> => api.listTracks(), [api]);
  const tracks = useAsyncResource<TrackPage>(load);

  /**
   * Which Tracks are already on the shelf.
   *
   * Held beside the list rather than fetched into it: Explore's job is the catalogue,
   * and asking the library for its membership is one extra request rather than a
   * per-Track lookup.
   */
  const loadLibraryIds = useCallback(async (): Promise<ReadonlySet<string>> => {
    const entries = await api.listLibrary();
    return new Set(entries.map((entry) => entry.track.id));
  }, [api]);

  const library = useAsyncResource<ReadonlySet<string>>(loadLibraryIds);

  /**
   * Both resources refresh on return, and the membership one is the reason: removing a
   * book in Library must not leave Explore still calling it added.
   */
  const refreshBoth = useCallback((): void => {
    tracks.refresh();
    library.refresh();
  }, [tracks, library]);

  useRefreshOnFocus(refreshBoth);

  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Local decisions layered over the fetched membership.
   *
   * A map rather than an "added" set, because a reader can also *remove* — and the
   * fetched set cannot be edited to record that. It is server state; mutating it in
   * place would make the next refresh silently disagree with the screen.
   */
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());

  const inLibrary = useCallback(
    (trackId: string): boolean => overrides.get(trackId) ?? library.data?.has(trackId) ?? false,
    [overrides, library.data],
  );

  const toggle = useCallback(
    async (track: Track): Promise<void> => {
      const already = inLibrary(track.id);
      setActionError(null);
      setPending((current) => new Set(current).add(track.id));

      try {
        if (already) {
          await api.removeFromLibrary(track.id);
        } else {
          await api.addToLibrary(track.id);
        }

        // Recorded locally rather than by refetching the whole library: the server call
        // has already succeeded, and a second round trip to learn what we just did
        // would make the button feel slow for no new information.
        setOverrides((current) => new Map(current).set(track.id, !already));
      } catch {
        // Adding is idempotent server-side, so the honest recovery is to say it did not
        // work and leave the button as it was, rather than guess at the true state.
        setActionError(`Could not update your library. Please try again.`);
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(track.id);
          return next;
        });
      }
    },
    [api, inLibrary],
  );

  if (tracks.status === 'loading') {
    return (
      <Screen testID="explore-screen" scrollable={false} centred>
        <ActivityIndicator testID="explore-loading" color={theme.palette.primary} />
      </Screen>
    );
  }

  if (tracks.status === 'error') {
    return (
      <Screen testID="explore-screen">
        <ErrorState
          testID="explore-error"
          message={tracks.error ?? 'Something went wrong.'}
          onRetry={tracks.reload}
        />
      </Screen>
    );
  }

  const list = tracks.data?.tracks ?? [];

  if (list.length === 0) {
    return (
      <Screen testID="explore-screen">
        <EmptyState
          testID="explore-empty"
          icon="explore"
          title="Nothing to explore yet"
          body="Tracks arrive here once there are books to read. Each one turns a non-fiction book into about fifteen minutes of active recall."
        />
      </Screen>
    );
  }

  return (
    <Screen testID="explore-screen" scrollable={false}>
      <View style={{ gap: theme.spacing.lg, flex: 1 }}>

        {actionError === null ? null : (
          <StatusMessage tone="error" message={actionError} testID="explore-action-error" />
        )}

        <FlatList
          testID="explore-list"
          /**
           * The screen title scrolls with the list rather than sitting fixed above it.
           * At `accessibilityExtraExtraExtraLarge` a `display` heading wraps to two
           * lines and takes half the viewport — pinned, it pushes the content the
           * reader came for off the bottom of every screen.
           */
          ListHeaderComponent={<Text variant="display">Explore</Text>}
          ListHeaderComponentStyle={{ paddingBottom: theme.spacing.sm }}
          data={list}
          keyExtractor={(track) => track.id}
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={tracks.refreshing}
              onRefresh={() => {
                tracks.refresh();
                library.refresh();
              }}
              tintColor={theme.palette.primary}
            />
          }
          renderItem={({ item }) => (
            <TrackCard
              track={item}
              testID={`explore-track-${item.id}`}
              action={
                <Button
                  testID={`explore-toggle-${item.id}`}
                  label={inLibrary(item.id) ? 'In your library' : 'Add to library'}
                  variant={inLibrary(item.id) ? 'secondary' : 'primary'}
                  busy={pending.has(item.id)}
                  onPress={() => {
                    void toggle(item);
                  }}
                />
              }
            />
          )}
        />
      </View>
    </Screen>
  );
}
