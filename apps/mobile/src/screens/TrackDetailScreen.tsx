import { useCallback, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Track, TrackProgressSummary } from '@zoomout/shared';

import type { ApiClient, LeafSummary } from '../api/client';
import { useApi } from '../auth/AuthProvider';
import { Button, ErrorState, ProgressBar, Screen, StatusMessage, Text, TrackLegal } from '../components';
import { useTheme } from '../design';
import type { AppStackParamList } from '../navigation/types';
import { TrackRoadmap } from './track/TrackRoadmap';
import { buildRoadmapModel, type RoadmapNode } from './track/roadmapModel';
import { seedFromTrackId } from './track/roadmapGeometry';
import { useAsyncResource } from './useAsyncResource';

type DetailRoute = RouteProp<AppStackParamList, 'TrackDetail'>;
type DetailNavigation = NativeStackNavigationProp<AppStackParamList, 'TrackDetail'>;

/**
 * One book: what it is, the two things the law requires the reader to be shown, and the
 * shape of the book itself.
 *
 * **Added in WP10** because the non-endorsement disclaimer and the purchase-forward
 * links had nowhere to be rendered. **The roadmap arrived in WP22**, and it arrived
 * *here* rather than on a new screen — a Track's contents and a Track's credits are the
 * same page, and splitting them would have given the app two "about this book" screens.
 *
 * **The legal pair stays above the graph.** WP10's comment below is load-bearing and
 * survived a ruling that briefly went the other way: the graph *is* a Leaf list, so
 * putting the disclaimer under it is exactly the placement WP10 rejected. Nothing was
 * inserted above `TrackLegal` except the back control, so the fold sits where it did.
 */
export function TrackDetailScreen(): React.JSX.Element {
  const api = useApi();
  const theme = useTheme();
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<DetailNavigation>();
  const { trackId } = route.params;
  const window = useWindowDimensions();

  const load = useCallback(async (): Promise<TrackDetail> => {
    // One await, three requests. The Track and its Leaves are both required; progress
    // is not, and `readProgress` is the reason this is not a bare `Promise.all` — see
    // its own note for why a failed library read must not take the screen down.
    const [track, leaves, progress] = await Promise.all([
      api.getTrack(trackId),
      api.listLeaves(trackId),
      readProgress(api, trackId),
    ]);

    return { track, leaves, progress };
  }, [api, trackId]);

  const detail = useAsyncResource<TrackDetail>(load);

  const openLeaf = useCallback(
    (leafId: string, trackTitle: string): void => {
      navigation.navigate('LeafPlayer', { leafId, trackId, trackTitle });
    },
    [navigation, trackId],
  );

  if (detail.status === 'loading') {
    return (
      <Screen testID="track-detail-loading" scrollable={false} centred>
        <Text variant="body" tone="textMuted">
          Loading…
        </Text>
      </Screen>
    );
  }

  if (detail.status === 'error' || detail.data === null) {
    return (
      <Screen testID="track-detail-screen">
        <ErrorState
          testID="track-detail-error"
          message={detail.error ?? 'Could not load this book.'}
          onRetry={detail.reload}
        />
      </Screen>
    );
  }

  const { track: book, leaves, progress } = detail.data;

  return (
    <Screen testID="track-detail-screen">
      <TrackDetailBody
        book={book}
        leaves={leaves}
        progress={progress}
        windowWidth={window.width}
        windowHeight={window.height}
        horizontalPadding={theme.spacing.xl}
        onOpenLeaf={openLeaf}
        onBack={() => {
          navigation.goBack();
        }}
      />
    </Screen>
  );
}

/**
 * The loaded screen.
 *
 * Split out so the hooks the roadmap needs are not sitting above three early returns in
 * the screen above — a `useMemo` after a conditional `return` is a rules-of-hooks bug
 * waiting for the first Track that fails to load.
 */
function TrackDetailBody({
  book,
  leaves,
  progress,
  windowWidth,
  windowHeight,
  horizontalPadding,
  onOpenLeaf,
  onBack,
}: {
  readonly book: Track;
  readonly leaves: readonly LeafSummary[];
  readonly progress: ProgressSource;
  readonly windowWidth: number;
  readonly windowHeight: number;
  readonly horizontalPadding: number;
  readonly onOpenLeaf: (leafId: string, trackTitle: string) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  const model = useMemo(
    () => buildRoadmapModel(leaves, progress.kind === 'entry' ? progress.progress : null),
    [leaves, progress],
  );

  const seed = useMemo(() => seedFromTrackId(book.id), [book.id]);

  const resume = model.nodes.find((node) => node.leafId === model.nextLeafId) ?? null;

  return (
    <View style={{ gap: theme.spacing.xl }}>
      {/**
       * Back moved to the top in WP22. It used to sit at the bottom, which was fine on
       * a screen that ended after the purchase links; with a roadmap below it, the
       * bottom of this screen is now some two thousand points down and a back control
       * there is one a reader has to scroll the whole book to reach.
       */}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          label="Back"
          variant="quiet"
          testID="track-detail-back"
          onPress={onBack}
        />
      </View>

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

      {/**
       * Progress and the way in, between the legal pair and the graph.
       *
       * Deliberately here rather than pinned over the roadmap or waiting at its far end:
       * this is the only spot a reader reaches without scrolling past the whole book,
       * and a floating pill over a scrolling graph would cover the nodes it is about.
       */}
      <View style={{ gap: theme.spacing.md }} testID="track-detail-progress">
        {model.confidence === 'known' ? (
          <ProgressBar
            testID="track-detail-progress-bar"
            completed={model.completedLeaves}
            total={model.totalLeaves}
          />
        ) : (
          <StatusMessage
            tone="info"
            testID="track-detail-progress-unknown"
            message={progressCaveat(progress, model.confidence)}
          />
        )}

        {resume === null ? null : (
          <Button
            testID="track-detail-continue"
            label={model.completedLeaves === 0 ? 'Start reading' : 'Continue'}
            onPress={() => {
              onOpenLeaf(resume.leafId, book.bookTitle);
            }}
          />
        )}
      </View>

      {model.nodes.length === 0 ? (
        <Text variant="small" tone="textMuted" testID="track-detail-no-leaves">
          There are no Leaves in this book yet.
        </Text>
      ) : (
        <TrackRoadmap
          model={model}
          seed={seed}
          width={windowWidth - horizontalPadding * 2}
          viewportHeight={windowHeight}
          onOpenLeaf={(node: RoadmapNode) => {
            onOpenLeaf(node.leafId, book.bookTitle);
          }}
        />
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

interface TrackDetail {
  readonly track: Track;
  readonly leaves: readonly LeafSummary[];
  readonly progress: ProgressSource;
}

/**
 * Why there is or is not a progress rollup for this Track.
 *
 * Three cases rather than a nullable, because they need different sentences on screen:
 * a book that is simply not on the shelf yet is a normal state, and a library request
 * that failed is not.
 */
type ProgressSource =
  | { readonly kind: 'entry'; readonly progress: TrackProgressSummary }
  | { readonly kind: 'not-in-library' }
  | { readonly kind: 'unavailable' };

/**
 * This Track's progress, from the reader's library.
 *
 * **There is no `GET /content/tracks/:id/progress`.** `TrackProgressSummary` reaches the
 * client on a `LibraryEntry` and nowhere else, so the only way to ask "how far through
 * this book am I" is to read the shelf and look for the book on it. That is one extra
 * request on this screen; the alternative is a backend change, which this package is
 * explicitly not making.
 *
 * **A failed library read must not take the screen down.** The disclaimer and the
 * purchase links are the reason this screen exists at all and they are legal
 * obligations; losing them because a *progress* request 500'd would be the wrong
 * failure. The same judgement Explore already makes about membership.
 */
async function readProgress(
  api: Pick<ApiClient, 'listLibrary'>,
  trackId: string,
): Promise<ProgressSource> {
  try {
    const entries = await api.listLibrary();
    const entry = entries.find((candidate) => candidate.track.id === trackId);

    return entry === undefined ? { kind: 'not-in-library' } : { kind: 'entry', progress: entry.progress };
  } catch {
    // Swallowed deliberately, and reported on screen rather than silently: see above.
    return { kind: 'unavailable' };
  }
}

/**
 * What to say when the map cannot show the reader's progress.
 *
 * Three different causes, three different sentences. "Inconsistent" is the one worth
 * spelling out: the server answered, and its two answers disagreed, so the honest thing
 * is to say the map is not showing progress rather than to draw a confident guess.
 */
function progressCaveat(source: ProgressSource, confidence: 'unknown' | 'inconsistent'): string {
  if (confidence === 'inconsistent') {
    return 'Your progress in this book could not be read reliably, so the map is not showing it.';
  }

  return source.kind === 'unavailable'
    ? 'Could not check your progress in this book.'
    : 'This book is not in your library yet, so the map is not showing any progress.';
}
