import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import type { LibraryEntry } from '../api/client';
import { useApi } from '../auth/AuthProvider';
import {
  Button,
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
 * Journey — what the reader is in the middle of, and the way back into it.
 *
 * Shows **unfinished** Tracks only. A finished book belongs on the shelf, not in a list
 * of things to continue, and leaving it here would make Journey a duplicate Library
 * that grows forever.
 *
 * Resume targets `progress.nextLeafId`, chosen by the server as the first incomplete
 * Leaf in order. **The Leaf player does not exist until WP8**, so the button carries the
 * right Leaf id to a placeholder destination — the route and the target are what WP7
 * owes WP8, not the screen behind them.
 */
export function JourneyScreen(): React.JSX.Element {
  const theme = useTheme();
  const api = useApi();

  const load = useCallback(async (): Promise<readonly LibraryEntry[]> => api.listLibrary(), [api]);
  const journey = useAsyncResource<readonly LibraryEntry[]>(load);

  // Coming back to this tab re-reads the shelf; see `useRefreshOnFocus`.
  useRefreshOnFocus(journey.refresh);

  if (journey.status === 'loading') {
    return (
      <Screen testID="journey-screen" scrollable={false} centred>
        <ActivityIndicator testID="journey-loading" color={theme.palette.primary} />
      </Screen>
    );
  }

  if (journey.status === 'error') {
    return (
      <Screen testID="journey-screen">
        <ErrorState
          testID="journey-error"
          message={journey.error ?? 'Something went wrong.'}
          onRetry={journey.reload}
        />
      </Screen>
    );
  }

  /**
   * Active means "has somewhere to resume".
   *
   * Keyed on `nextLeafId` rather than on `isComplete`, because they differ for a Track
   * with no visible Leaves: not complete, but nothing to continue either. Filtering on
   * the resume target directly means the list can never contain a card whose button
   * has nowhere to go.
   */
  const active = (journey.data ?? []).filter((entry) => entry.progress.nextLeafId !== null);

  if (active.length === 0) {
    return (
      <Screen testID="journey-screen">
        <EmptyState
          testID="journey-empty"
          icon="journey"
          title="Your journey starts with one Leaf"
          body="Streaks, XP and everything you have learned will show up here once you add a book and finish your first session."
        />
      </Screen>
    );
  }

  return (
    <Screen testID="journey-screen" scrollable={false}>
      <View style={{ gap: theme.spacing.lg, flex: 1 }}>
        {/* A refresh that failed leaves the list on screen and says so. Without this
            the spinner just retracts and the reader is looking at stale content with
            no way to know it. */}
        {journey.refreshError === null ? null : (
          <StatusMessage
            tone="error"
            testID="journey-refresh-error"
            message={journey.refreshError}
          />
        )}

        <FlatList
          testID="journey-list"
          /**
           * The screen title scrolls with the list rather than sitting fixed above it.
           * At `accessibilityExtraExtraExtraLarge` a `display` heading wraps to two
           * lines and takes half the viewport — pinned, it pushes the content the
           * reader came for off the bottom of every screen.
           */
          ListHeaderComponent={<Text variant="display">Journey</Text>}
          ListHeaderComponentStyle={{ paddingBottom: theme.spacing.sm }}
          data={active}
          keyExtractor={(entry) => entry.track.id}
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={journey.refreshing}
              onRefresh={journey.refresh}
              tintColor={theme.palette.primary}
            />
          }
          renderItem={({ item }) => (
            <TrackCard
              track={item.track}
              testID={`journey-track-${item.track.id}`}
              action={
                <Button
                  testID={`journey-resume-${item.track.id}`}
                  label={item.progress.completedLeaves === 0 ? 'Start reading' : 'Resume'}
                  onPress={() => {
                    resumeAt(item.progress.nextLeafId);
                  }}
                />
              }
            >
              <ProgressBar
                testID={`journey-progress-${item.track.id}`}
                completed={item.progress.completedLeaves}
                total={item.progress.totalLeaves}
              />
            </TrackCard>
          )}
        />
      </View>
    </Screen>
  );
}

/**
 * Where resume goes until WP8 builds the Leaf player.
 *
 * Deliberately a named function taking the Leaf id rather than an inline no-op: the id
 * is the part with an acceptance criterion on it, and WP8 replaces the body of this
 * function with a navigation call rather than hunting through JSX for the right place
 * to put one.
 */
function resumeAt(leafId: string | null): void {
  if (leafId === null) {
    return;
  }

  // eslint-disable-next-line no-console -- the placeholder destination, until WP8.
  console.log(`[journey] resume at Leaf ${leafId}`);
}
