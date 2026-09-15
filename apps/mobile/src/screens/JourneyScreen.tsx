import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TrackProgressSummary } from '@zoomout/shared';

import type { LeafSummary, LibraryEntry } from '../api/client';
import { useApi } from '../auth/AuthProvider';
import type { AppStackParamList } from '../navigation/types';
import {
  Button,
  EmptyState,
  ErrorState,
  Screen,
  StatusMessage,
  Text,
  TrackCard,
} from '../components';
import { type Theme, useTheme } from '../design';
import { useAsyncResource } from './useAsyncResource';
import { useRefreshOnFocus } from './useRefreshOnFocus';
import { buildProgressStrip, STRIP_WINDOW_HEIGHT } from './journeyProgressStrip';
import { curvePath } from './track/roadmapGeometry';
import { buildRoadmapModel, type LeafNodeState } from './track/roadmapModel';

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
type AppNavigation = NativeStackNavigationProp<AppStackParamList>;

export function JourneyScreen(): React.JSX.Element {
  const theme = useTheme();
  const api = useApi();
  const navigation = useNavigation<AppNavigation>();

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
          ListHeaderComponent={
            <View style={{ gap: theme.spacing.lg }}>
              <Text variant="display">Journey</Text>
              {/**
               * The deliberate way in to the end-of-day summary (WP9).
               *
               * On Journey rather than in the tab bar because ending the day is
               * something a reader chooses at the end of one, not a place they navigate
               * to — and this is the screen they are already on when deciding whether to
               * read another. Opening it records nothing; only the button inside it does.
               */}
              <Button
                testID="journey-wrap-up"
                label="See today’s summary"
                variant="secondary"
                onPress={() => {
                  navigation.navigate('WrapUp');
                }}
              />
            </View>
          }
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
              onPress={() => {
                navigation.navigate('TrackDetail', { trackId: item.track.id });
              }}
              action={
                <Button
                  testID={`journey-resume-${item.track.id}`}
                  label={item.progress.completedLeaves === 0 ? 'Start reading' : 'Resume'}
                  onPress={() => {
                    resumeAt(navigation, item);
                  }}
                />
              }
            >
              <TrackProgressStrip
                testID={`journey-progress-${item.track.id}`}
                trackId={item.track.id}
                progress={item.progress}
              />
            </TrackCard>
          )}
        />
      </View>
    </Screen>
  );
}

/**
 * Opens the Leaf player at the server-chosen resume target.
 *
 * WP7 left this as a named function precisely so WP8 could replace its body rather than
 * hunt through JSX. The null guard stays: the list is already filtered on `nextLeafId`,
 * so a null here would mean the filter and the button had diverged, and navigating to a
 * player with no Leaf is a worse failure than doing nothing.
 */
function resumeAt(navigation: AppNavigation, entry: LibraryEntry): void {
  const leafId = entry.progress.nextLeafId;

  if (leafId === null) {
    return;
  }

  navigation.navigate('LeafPlayer', {
    leafId,
    trackId: entry.track.id,
    trackTitle: entry.track.bookTitle,
  });
}

/**
 * A compressed strip of the Track's graph, in place of a plain bar (screen-04, WP27).
 *
 * **Fetches this Track's Leaves itself**, which is the one per-row request `LibraryScreen`
 * warns against for exactly this reason — but that warning is about the whole shelf,
 * which can run to dozens of books, and Journey's list is already filtered to Tracks
 * with somewhere to resume. In practice that is a handful of requests, not the request
 * explosion `TrackProgressSummary` exists to prevent for the full library.
 *
 * **Degrades to the count alone.** The count comes straight from the rollup already on
 * `entry` and renders immediately; the graphic is additional and only appears once the
 * Leaf list arrives. A slow or failed fetch leaves the row with exactly what `ProgressBar`
 * showed before this package — never a blocked row, never a crash.
 */
function TrackProgressStrip({
  testID,
  trackId,
  progress,
}: {
  readonly testID?: string;
  readonly trackId: string;
  readonly progress: TrackProgressSummary;
}): React.JSX.Element {
  const theme = useTheme();
  const api = useApi();

  const loadLeaves = useCallback(
    async (): Promise<readonly LeafSummary[]> => api.listLeaves(trackId),
    [api, trackId],
  );
  const leaves = useAsyncResource<readonly LeafSummary[]>(loadLeaves);

  const label =
    progress.totalLeaves === 0
      ? 'No Leaves yet'
      : `${String(progress.completedLeaves)} of ${String(progress.totalLeaves)} complete`;

  const states =
    leaves.status === 'ready' && leaves.data !== null
      ? buildRoadmapModel(leaves.data, progress).nodes.map((node) => node.state)
      : null;

  const strip = states === null ? null : buildProgressStrip(trackId, states);

  return (
    <View testID={testID} style={{ gap: theme.spacing.sm }}>
      {strip === null ? null : (
        <View
          // Decorative: `label` below is the accessible statement of progress, in the
          // same words `ProgressBar` used — the graph is a picture of that fact, not a
          // second copy of it a screen reader would have to reconcile.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: STRIP_WINDOW_HEIGHT, overflow: 'hidden' }}
        >
          <Svg
            width="100%"
            height={STRIP_WINDOW_HEIGHT}
            viewBox={`0 ${String(strip.windowY)} ${String(strip.geometry.width)} ${String(STRIP_WINDOW_HEIGHT)}`}
          >
            {strip.geometry.spine.map((curve, index) => (
              <Path
                // `spine` is one static curve per gap for this render; nothing reorders
                // it, so the index is stable.
                key={index}
                d={curvePath(curve)}
                stroke={theme.palette.border}
                strokeWidth={curve.strokeWidth}
                opacity={curve.opacity}
                fill="none"
              />
            ))}
            {strip.geometry.nodes.map((node) => {
              const paint = paintFor(node.state, theme);

              return (
                <Circle
                  key={node.index}
                  cx={node.centre.x}
                  cy={node.centre.y}
                  r={paint.radius}
                  fill={paint.fill}
                  {...(paint.stroke === undefined
                    ? {}
                    : { stroke: paint.stroke, strokeWidth: 1.5 })}
                />
              );
            })}
          </Svg>
        </View>
      )}

      <Text variant="caption" tone="textMuted" testID={`${testID ?? 'journey-progress'}-label`}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Dot styling per state. `revisit` paints identically to `locked` — `buildRoadmapModel`
 * never emits it (see that module's docstring), but the union still has to be handled.
 */
function paintFor(
  state: LeafNodeState,
  theme: Theme,
): { readonly fill: string; readonly stroke?: string; readonly radius: number } {
  switch (state) {
    case 'done':
      return { fill: theme.palette.reward, radius: 3 };
    case 'next':
      return { fill: theme.palette.primary, radius: 5 };
    case 'revisit':
    case 'locked':
      return { fill: theme.surfaceFor('pressed'), stroke: theme.palette.border, radius: 2.5 };
    default:
      return unreachable(state);
  }
}

function unreachable(value: never): never {
  throw new Error(`Unhandled Leaf node state: ${String(value)}`);
}
