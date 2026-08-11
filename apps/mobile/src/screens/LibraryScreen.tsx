import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import type { LibraryEntry } from '../api/client';
import { useApi } from '../auth/AuthProvider';
import {
  EmptyState,
  ErrorState,
  ProgressBar,
  Screen,
  StatusMessage,
  Text,
  TrackCard,
} from '../components';
import { useTheme } from '../design';
import { useAsyncResource } from './useAsyncResource';
import { useRefreshOnFocus } from './useRefreshOnFocus';

/**
 * Library — the reader's shelf, with how far through each book they are.
 *
 * The progress on each card comes from the **server's rollup**, in the same response as
 * the Track. Nothing here counts Leaves: doing that on the client would mean fetching
 * every Leaf and every progress row per book, which is the request explosion the
 * backend's `TrackProgressSummary` exists to prevent.
 */
export function LibraryScreen(): React.JSX.Element {
  const theme = useTheme();
  const api = useApi();

  const load = useCallback(async (): Promise<readonly LibraryEntry[]> => api.listLibrary(), [api]);
  const library = useAsyncResource<readonly LibraryEntry[]>(load);

  // Coming back to this tab re-reads the shelf; see `useRefreshOnFocus`.
  useRefreshOnFocus(library.refresh);

  if (library.status === 'loading') {
    return (
      <Screen testID="library-screen" scrollable={false} centred>
        <ActivityIndicator testID="library-loading" color={theme.palette.primary} />
      </Screen>
    );
  }

  if (library.status === 'error') {
    return (
      <Screen testID="library-screen">
        <ErrorState
          testID="library-error"
          message={library.error ?? 'Something went wrong.'}
          onRetry={library.reload}
        />
      </Screen>
    );
  }

  const entries = library.data ?? [];

  if (entries.length === 0) {
    return (
      <Screen testID="library-screen">
        <EmptyState
          testID="library-empty"
          icon="library"
          title="Your library is empty"
          body="Books you add from Explore will wait for you here, with your progress through each one."
        />
      </Screen>
    );
  }

  return (
    <Screen testID="library-screen" scrollable={false}>
      <View style={{ gap: theme.spacing.lg, flex: 1 }}>
        {/* A refresh that failed leaves the list on screen and says so. Without this
            the spinner just retracts and the reader is looking at stale content with
            no way to know it. */}
        {library.refreshError === null ? null : (
          <StatusMessage
            tone="error"
            testID="library-refresh-error"
            message={library.refreshError}
          />
        )}

        <FlatList
          testID="library-list"
          /**
           * The screen title scrolls with the list rather than sitting fixed above it.
           * At `accessibilityExtraExtraExtraLarge` a `display` heading wraps to two
           * lines and takes half the viewport — pinned, it pushes the content the
           * reader came for off the bottom of every screen.
           */
          ListHeaderComponent={<Text variant="display">Library</Text>}
          ListHeaderComponentStyle={{ paddingBottom: theme.spacing.sm }}
          data={entries}
          keyExtractor={(entry) => entry.track.id}
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={library.refreshing}
              onRefresh={library.refresh}
              tintColor={theme.palette.primary}
            />
          }
          renderItem={({ item }) => (
            <TrackCard track={item.track} testID={`library-track-${item.track.id}`}>
              <ProgressBar
                testID={`library-progress-${item.track.id}`}
                completed={item.progress.completedLeaves}
                total={item.progress.totalLeaves}
              />

              {item.progress.isComplete ? (
                <Text variant="small" tone="correct" testID={`library-done-${item.track.id}`}>
                  Finished
                </Text>
              ) : null}
            </TrackCard>
          )}
        />
      </View>
    </Screen>
  );
}
