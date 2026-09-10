import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Track } from '@zoomout/shared';

import type { LeafSummary } from '../../api/client';
import { useApi } from '../../auth/AuthProvider';
import { Button, ErrorState, Icon, Screen, StatusMessage, Text, TrackLegal } from '../../components';
import { MIN_TOUCH_TARGET, useTheme } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { shareView, type ShareOutcome } from '../../share/shareImage';
import { useAsyncResource } from '../useAsyncResource';
import { layoutRoadmap, seedFromTrackId, type RoadmapGeometry } from '../track/roadmapGeometry';
import { buildConstellationFragment } from './constellationFragment';
import { buildDoneConstellationLayers } from './constellationLayers';
import { ShareCard, type ShareCardAspect } from './ShareCard';
import { trackCompleteStats, type TrackCompleteStat } from './trackCompleteStats';

type TrackCompleteRoute = RouteProp<AppStackParamList, 'TrackComplete'>;
type TrackCompleteNavigation = NativeStackNavigationProp<AppStackParamList, 'TrackComplete'>;

/**
 * Finishing an entire book — the largest reward in the product, and until now the only
 * screen in it with nothing built for the moment.
 *
 * **A build, not a re-skin** (the WP26 handoff's own framing): the constellation is the
 * real `layoutRoadmap` output for this Track with every node `done`, not a redrawn
 * illustration, so it agrees with the roadmap screen's own shape for the same book by
 * construction rather than by care taken to match it.
 */
export function TrackCompleteScreen(): React.JSX.Element {
  const api = useApi();
  const route = useRoute<TrackCompleteRoute>();
  const { trackId } = route.params;

  const load = useCallback(async (): Promise<TrackCompleteData> => {
    const [track, leaves, standing] = await Promise.all([
      api.getTrack(trackId),
      api.listLeaves(trackId),
      api.getToday(),
    ]);

    return {
      track,
      // Same defensive sort as `buildRoadmapModel`: the backend already orders these,
      // but this derivation should not silently depend on that continuing to be true.
      leaves: [...leaves].sort((a, b) => a.orderIndex - b.orderIndex),
      streakCurrent: standing.streak.current,
    };
  }, [api, trackId]);

  const resource = useAsyncResource<TrackCompleteData>(load);

  if (resource.status === 'loading') {
    return (
      <Screen testID="track-complete-loading" scrollable={false} centred>
        <Text variant="body" tone="textMuted">
          Finding your constellation…
        </Text>
      </Screen>
    );
  }

  if (resource.status === 'error' || resource.data === null) {
    return (
      <Screen testID="track-complete-screen">
        <ErrorState
          testID="track-complete-error"
          message={resource.error ?? 'Could not load this book.'}
          onRetry={resource.reload}
        />
      </Screen>
    );
  }

  return <TrackCompleteView trackId={trackId} data={resource.data} />;
}

interface TrackCompleteData {
  readonly track: Track;
  /** Sorted by `orderIndex`. Zips 1:1 with `geometry.nodes` — see `openLeaf` below. */
  readonly leaves: readonly LeafSummary[];
  readonly streakCurrent: number;
}

/** How many nodes the share card's fragment shows. Matches the design's own count. */
const FRAGMENT_NODE_COUNT = 6;

/** The mascot slot's rendered width: `ShareCard`'s `CARD_WIDTH` (320) less its padding
 * on both sides (`theme.spacing.xl`, 24 — a light coupling to a constant `ShareCard`
 * does not export, noted here so it is not a mystery if that constant ever moves). */
const FRAGMENT_BOX = { width: 272, height: 64 } as const;

function TrackCompleteView({
  trackId,
  data,
}: {
  readonly trackId: string;
  readonly data: TrackCompleteData;
}): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<TrackCompleteNavigation>();
  const window = useWindowDimensions();

  const seed = useMemo(() => seedFromTrackId(trackId), [trackId]);
  const constellationWidth = Math.min(window.width - theme.spacing.xl * 2, 360);

  const geometry = useMemo(
    () =>
      layoutRoadmap(
        data.leaves.map(() => 'done' as const),
        { width: constellationWidth, height: window.height * 0.5 },
        seed,
      ),
    [data.leaves, constellationWidth, window.height, seed],
  );

  const layers = useMemo(() => buildDoneConstellationLayers(geometry, theme), [geometry, theme]);
  const stats = useMemo(() => trackCompleteStats(data.streakCurrent), [data.streakCurrent]);
  const stat: TrackCompleteStat | undefined = stats[0];

  const openLeaf = useCallback(
    (leaf: LeafSummary): void => {
      navigation.navigate('LeafPlayer', {
        leafId: leaf.id,
        trackId,
        trackTitle: data.track.bookTitle,
      });
    },
    [navigation, trackId, data.track.bookTitle],
  );

  const findNextBook = useCallback(() => {
    navigation.navigate('Tabs', { screen: 'Explore' });
  }, [navigation]);

  const cardRef = useRef<View>(null);
  const [aspect, setAspect] = useState<Exclude<ShareCardAspect, 'auto'>>('square');
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const share = useCallback(() => {
    setSharing(true);
    setNotice(null);

    void (async () => {
      const outcome: ShareOutcome = await shareView({
        target: cardRef,
        dialogTitle: 'Share your constellation',
      });

      if (outcome.status === 'unavailable') {
        setNotice('Sharing is not available on this device.');
      } else if (outcome.status === 'failed') {
        setNotice(outcome.message);
      }

      setSharing(false);
    })();
  }, []);

  return (
    <Screen testID="track-complete-screen">
      <View style={{ gap: theme.spacing.xl }}>
        {/**
         * The only way off this screen without it — found on device in WrapUpScreen
         * (WP9) and true here for the same reason: a normal push gets the iOS edge-swipe
         * for free, but that is an invisible affordance, and Android has no equivalent
         * at all. Not a modal, so this is a close, not a trap.
         */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable
            testID="track-complete-close"
            onPress={() => {
              navigation.goBack();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={theme.spacing.md}
            style={{
              minWidth: MIN_TOUCH_TARGET,
              minHeight: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="close" size={24} color={theme.palette.textMuted} />
          </Pressable>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="caption" tone="reward">
            Track complete
          </Text>
          <Text variant="display" testID="track-complete-title">
            {data.track.bookTitle}
          </Text>
          <Text variant="body" tone="textMuted">
            {data.track.author}
          </Text>
        </View>

        <View
          testID="track-complete-constellation"
          style={{ width: geometry.width, height: geometry.height, alignSelf: 'center' }}
        >
          {/* The drawing takes no touches; the node targets below it do — same split as
              `TrackRoadmap`, and for the same reason: without this the SVG swallows every
              tap meant for a node. */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={geometry.width} height={geometry.height}>
              {layers.map((layer) => (
                <Path
                  key={layer.key}
                  d={layer.d}
                  fill={layer.fill}
                  stroke={layer.stroke}
                  strokeWidth={layer.strokeWidth}
                  opacity={layer.opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </Svg>
          </View>

          {/**
           * Every node opens its Leaf (ruled 2026-09-09) — unlike the roadmap screen,
           * where only the `next` cell is pressable. A finished Track has no `next`, so
           * that rule alone would leave nothing tappable here. `completeLeaf` is
           * idempotent and awards no XP on replay; this wires the affordance only, and
           * awards nothing itself.
           */}
          {geometry.nodes.map((node) => {
            const leaf = data.leaves[node.index];

            return leaf === undefined ? null : (
              <Pressable
                key={leaf.id}
                testID={`track-complete-node-${leaf.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Reopen "${leaf.title}"`}
                onPress={() => {
                  openLeaf(leaf);
                }}
                style={{
                  position: 'absolute',
                  left: node.centre.x - MIN_TOUCH_TARGET / 2,
                  top: node.centre.y - MIN_TOUCH_TARGET / 2,
                  width: MIN_TOUCH_TARGET,
                  height: MIN_TOUCH_TARGET,
                }}
              />
            );
          })}
        </View>

        {/**
         * Only the streak is real — see `trackCompleteStats`'s docstring for what was
         * checked and ruled out. XP earned and first-try count are not rendered rather
         * than approximated.
         */}
        <View testID="track-complete-stats" style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
          {stats.map((row) => (
            <View key={row.label} style={{ gap: theme.spacing.xs }}>
              <Text variant="h2" testID={`track-complete-stat-${row.label}`}>
                {row.value}
              </Text>
              <Text variant="caption" tone="textMuted">
                {row.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center' }}>
            <Button
              testID="track-complete-aspect-square"
              label="Square"
              variant={aspect === 'square' ? 'primary' : 'secondary'}
              onPress={() => {
                setAspect('square');
              }}
            />
            <Button
              testID="track-complete-aspect-vertical"
              label="Story"
              variant={aspect === 'vertical' ? 'primary' : 'secondary'}
              onPress={() => {
                setAspect('vertical');
              }}
            />
          </View>

          <View style={{ alignItems: 'center' }}>
            <ShareCard
              ref={cardRef}
              aspect={aspect}
              eyebrow="Track complete"
              headline={stat === undefined ? 'Finished' : shareHeadline(stat)}
              subtitle={data.track.bookTitle}
              mascot={<ConstellationFragmentView geometry={geometry} />}
            />
          </View>

          {notice === null ? null : (
            <StatusMessage tone="error" message={notice} testID="track-complete-share-notice" />
          )}

          {/* Amber leads on this screen — it is the reward moment the palette reserves
              the colour for — but the primary action stays the app's ordinary primary
              colour, per the spec's "still an accent, must not flood the screen." */}
          <Button
            testID="track-complete-share"
            label="Share your constellation"
            onPress={share}
            busy={sharing}
          />
          <Button
            testID="track-complete-next-book"
            label="Find your next book"
            variant="secondary"
            onPress={findNextBook}
          />
        </View>

        <TrackLegal track={data.track} testID="track-complete-legal" />
      </View>
    </Screen>
  );
}

function shareHeadline(stat: TrackCompleteStat): string {
  return stat.label === 'Day one' ? 'Day one' : `${String(stat.value)}-day streak`;
}

/**
 * The share card's mascot-slot content: a small, rotated crop of the same constellation
 * the screen already drew — see `constellationFragment.ts` for why it is a crop rather
 * than a second generator, and why it is rotated.
 *
 * Rendered inside `ShareCard`'s forced-light `ThemeProvider` (it arrives as the `mascot`
 * prop, mounted inside that tree), so `useTheme()` here resolves to the light palette
 * regardless of the reader's device theme — same mechanism `MascotSlot` itself relies on.
 */
function ConstellationFragmentView({
  geometry,
}: {
  readonly geometry: RoadmapGeometry;
}): React.JSX.Element {
  const theme = useTheme();

  const fragment = useMemo(
    () => buildConstellationFragment(geometry, FRAGMENT_NODE_COUNT, FRAGMENT_BOX),
    [geometry],
  );

  return (
    <Svg width={fragment.width} height={fragment.height} testID="share-card-fragment">
      <Path
        d={fragment.spineD}
        fill="none"
        stroke={theme.palette.primary}
        strokeWidth={1.5}
        opacity={0.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {fragment.nodePoints.map((point, index) => (
        <Circle
          key={`fragment-node-${String(index)}`}
          cx={point.x}
          cy={point.y}
          r={4}
          fill={theme.palette.surface0}
          stroke={theme.palette.reward}
          strokeWidth={theme.borderWidth.hairline}
        />
      ))}
    </Svg>
  );
}
