import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Text } from '../../components';
import {
  MIN_TOUCH_TARGET,
  duration,
  motionPlan,
  useReducedMotion,
  useTheme,
  type Theme,
} from '../../design';
import {
  curvePath,
  layoutRoadmap,
  type Curve,
  type RoadmapGeometry,
  type RoadmapNodeGeometry,
} from './roadmapGeometry';
import { labelFor, type LeafNodeState, type RoadmapModel, type RoadmapNode } from './roadmapModel';

/**
 * A Track's Leaves as a knowledge graph.
 *
 * **A thin consumer of `layoutRoadmap`.** Every coordinate on screen comes from that
 * pure function; this file decides only what colour a curve is and what a label says.
 * The split is what makes "does the graph work at 30 Leaves" answerable without a
 * device — see `roadmapGeometry.ts` for why that mattered enough to structure the
 * package around it.
 *
 * **Roughly 450 curves are drawn as about two dozen native paths.** SVG path data takes
 * many subpaths in one `d` string, so every curve sharing a colour and a stroke width is
 * concatenated into a single `<Path>`. One React element per curve would mean ~450
 * native views inside a scroll view, which is where a screen like this stutters; this is
 * the reason density did not have to be cut to keep the scroll smooth.
 *
 * **The three states differ by more than hue**, because colour alone is not a state
 * indicator for every reader: a done cell is a *filled* body, a locked cell is a
 * *hollow* outline, and the next cell is the only one wearing a ring and the only one
 * showing its full title. Greyscale still reads.
 */

export interface TrackRoadmapProps {
  readonly model: RoadmapModel;
  /** Seeds the layout. Same Track, same graph, every launch. */
  readonly seed: number;
  readonly width: number;
  /** The visible height, which sets the vertical rhythm. The graph is taller than this. */
  readonly viewportHeight: number;
  readonly onOpenLeaf: (node: RoadmapNode) => void;
  readonly testID?: string;
}

/** The pulsing ring that marks where the reader is. Sized off the touch target. */
const RING_SIZE = MIN_TOUCH_TARGET - 4;

export function TrackRoadmap({
  model,
  seed,
  width,
  viewportHeight,
  onOpenLeaf,
  testID = 'track-roadmap',
}: TrackRoadmapProps): React.JSX.Element {
  const theme = useTheme();

  const geometry = useMemo(
    () => layoutRoadmap(model.nodes.length, { width, height: viewportHeight }, seed),
    [model.nodes.length, width, viewportHeight, seed],
  );

  const layers = useMemo(() => buildLayers(geometry, model, theme), [geometry, model, theme]);

  return (
    <View testID={testID} style={{ width: geometry.width, height: geometry.height }}>
      {/* The drawing takes no touches; the node targets below it do. Without this the
          SVG swallows every tap that lands on a curve. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={geometry.width} height={geometry.height}>
          {layers.map((layer) => (
            <Path
              key={layer.key}
              d={layer.d}
              fill={layer.fill}
              stroke={layer.stroke}
              strokeWidth={layer.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={layer.opacity}
            />
          ))}
        </Svg>
      </View>

      {geometry.nodes.map((node) => {
        const leaf = model.nodes[node.index];

        return leaf === undefined ? null : (
          <RoadmapNodeOverlay
            key={leaf.leafId}
            leaf={leaf}
            geometry={node}
            frameWidth={geometry.width}
            onOpenLeaf={onOpenLeaf}
          />
        );
      })}
    </View>
  );
}

/**
 * A node's label, its ring if it is the next one, and its touch target.
 *
 * Text is React Native's, not SVG's, deliberately: `Text.tsx` is the only component
 * allowed to touch `allowFontScaling` and it never disables it, and `<Svg><Text>` would
 * be a second text system in the app that quietly opts out of the OS font size setting.
 */
function RoadmapNodeOverlay({
  leaf,
  geometry,
  frameWidth,
  onOpenLeaf,
}: {
  readonly leaf: RoadmapNode;
  readonly geometry: RoadmapNodeGeometry;
  readonly frameWidth: number;
  readonly onOpenLeaf: (node: RoadmapNode) => void;
}): React.JSX.Element {
  const theme = useTheme();

  const target = {
    position: 'absolute',
    left: geometry.centre.x - MIN_TOUCH_TARGET / 2,
    top: geometry.centre.y - MIN_TOUCH_TARGET / 2,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: theme.radius.full,
  } as const;

  return (
    <>
      {leaf.state === 'next' ? <NextNodeRing centre={geometry.centre} /> : null}

      <NodeLabel leaf={leaf} geometry={geometry} frameWidth={frameWidth} />

      {/**
       * **Only the next Leaf opens from the map.** A locked one has not been earned,
       * and re-reading a completed one is a capability this app has deliberately not
       * shipped — `LibraryScreen` declined to offer it for want of a Leaf id, and this
       * screen is the first place that id exists on the client. Adding it here would be
       * introducing a flow on the strength of having become able to, which is a
       * different decision from this package's.
       *
       * Every node is still an accessibility node, so a screen reader can walk the
       * whole book and hear each Leaf's title and state; the others are simply not
       * buttons, rather than buttons that are disabled.
       */}
      {leaf.state === 'next' ? (
        <Pressable
          testID={`roadmap-node-${leaf.leafId}`}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabelFor(leaf)}
          onPress={() => {
            onOpenLeaf(leaf);
          }}
          style={target}
        />
      ) : (
        <View
          testID={`roadmap-node-${leaf.leafId}`}
          accessible
          accessibilityLabel={accessibilityLabelFor(leaf)}
          style={target}
        />
      )}
    </>
  );
}

/**
 * The ring around the Leaf the reader is up to.
 *
 * **Swap, never remove.** With motion allowed it breathes; with Reduce Motion on it
 * pulses in opacity instead, and never reaches zero. Removing the animation entirely
 * would leave the one node that has to be findable on a long scrolling graph looking
 * exactly like a completed one.
 *
 * **`ReduceMotion.Never` on the fade is load-bearing, not belt-and-braces.** Reanimated
 * reads the OS setting itself and disables animations by default — so with Reduce
 * Motion on it silently cancelled the *replacement* animation too, and the swap became
 * the removal the rule exists to prevent. Nothing failed and nothing warned: the ring
 * simply sat still, which is indistinguishable from a ring that was never meant to
 * move. Caught by measuring the pixels across six frames, not by looking. The decision
 * about what a reduced-motion reader gets is `motionPlan`'s and has already been made
 * by the time this runs; Reanimated must not make it a second time.
 */
function NextNodeRing({ centre }: { readonly centre: { x: number; y: number } }): React.JSX.Element {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const plan = motionPlan(reducedMotion, duration.celebration);

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (plan.kind === 'fade') {
      opacity.value = withRepeat(
        withTiming(0.4, { duration: plan.durationMs, reduceMotion: ReduceMotion.Never }),
        -1,
        true,
        undefined,
        ReduceMotion.Never,
      );
      return;
    }

    scale.value = withRepeat(withTiming(1.18, { duration: plan.durationMs }), -1, true);
  }, [plan.kind, plan.durationMs, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      testID="roadmap-next-ring"
      style={[
        style,
        {
          position: 'absolute',
          left: centre.x - RING_SIZE / 2,
          top: centre.y - RING_SIZE / 2,
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: theme.radius.full,
          borderWidth: theme.borderWidth.focus,
          borderColor: theme.palette.primary,
        },
      ]}
    />
  );
}

/**
 * What a node says.
 *
 * The next Leaf keeps its full title, beneath the node and on a card so it stays legible
 * over the dendrites. Everything else carries a short truncated label to the side —
 * enough to see the shape of the book without opening it, and shorter still when locked
 * so the map does not spoil what is ahead.
 *
 * The text is always the Leaf's own title, cut but never reworded. See `truncateTitle`.
 */
function NodeLabel({
  leaf,
  geometry,
  frameWidth,
}: {
  readonly leaf: RoadmapNode;
  readonly geometry: RoadmapNodeGeometry;
  readonly frameWidth: number;
}): React.JSX.Element {
  const theme = useTheme();
  const label = labelFor(leaf);

  if (leaf.state === 'next') {
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: geometry.centre.y + RING_SIZE / 2 + theme.spacing.sm,
          alignItems: 'center',
          paddingHorizontal: theme.spacing.lg,
        }}
      >
        <View
          style={{
            maxWidth: '100%',
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: theme.surfaceFor('card'),
            borderWidth: theme.borderWidth.hairline,
            borderColor: theme.palette.border,
          }}
        >
          <Text
            variant="small"
            align="center"
            numberOfLines={3}
            testID={`roadmap-label-${leaf.leafId}`}
          >
            {label}
          </Text>
        </View>
      </View>
    );
  }

  const gap = geometry.radius + theme.spacing.sm;
  const side =
    geometry.labelSide === 'right'
      ? { left: geometry.centre.x + gap, right: theme.spacing.xs }
      : { left: theme.spacing.xs, right: frameWidth - (geometry.centre.x - gap) };

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        ...side,
        // Centred on the node rather than hung from its top, so a label and its cell
        // read as one thing at any OS text size. `TextStyle.lineHeight` is optional in
        // React Native's type even though every variant in the scale sets one, so the
        // fallback is the token that variant actually uses rather than a bare number.
        top: geometry.centre.y - (theme.typography.small.lineHeight ?? theme.spacing.xl) / 2,
      }}
    >
      {/**
       * `small`, not `caption`. `caption` is the right weight for a label but it
       * uppercases and letter-spaces, and these labels are **book content** — seen on
       * device, eighteen shouting fragments of a real author's chapter titles read as
       * signage rather than as a table of contents, and are materially harder to scan.
       * Truncating a title is a space decision; restyling its capitalisation is not.
       */}
      <Text
        variant="small"
        tone={leaf.state === 'done' ? 'textPrimary' : 'textMuted'}
        align={geometry.labelSide === 'right' ? 'left' : 'right'}
        numberOfLines={1}
        testID={`roadmap-label-${leaf.leafId}`}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * State said out loud.
 *
 * A screen reader gets no benefit from a filled body versus a hollow one, so the thing
 * the shapes encode is spelled out here instead. The title is read in full even where
 * the visible label is truncated — truncation is a space constraint, not an editorial one.
 */
function accessibilityLabelFor(leaf: RoadmapNode): string {
  const position = `Leaf ${String(leaf.orderIndex + 1)}`;
  const state =
    leaf.state === 'done' ? 'Completed' : leaf.state === 'next' ? 'Up next' : 'Not yet unlocked';

  return `${position}: ${leaf.title}. ${state}.`;
}

/* -------------------------------------------------------------------------- */
/* Drawing layers                                                              */
/* -------------------------------------------------------------------------- */

interface DrawLayer {
  readonly key: string;
  readonly d: string;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly opacity: number;
}

interface StatePaint {
  readonly colour: string;
  readonly processOpacity: number;
  readonly somaFill: string;
  readonly somaStroke: string;
}

/**
 * How each state is drawn.
 *
 * Amber is untouched on purpose: `design-direction.md` reserves the reward colour for
 * something won, and a finished Leaf on a map is progress rather than a prize.
 */
function paintFor(state: LeafNodeState, theme: Theme): StatePaint {
  if (state === 'locked') {
    return {
      colour: theme.palette.textMuted,
      processOpacity: 0.28,
      // Hollow. This is the state difference that survives greyscale and colour
      // blindness alike — it is a different shape, not a different hue.
      somaFill: 'none',
      somaStroke: theme.palette.textMuted,
    };
  }

  return {
    colour: theme.palette.primary,
    processOpacity: state === 'next' ? 0.85 : 0.5,
    somaFill: theme.palette.primary,
    somaStroke: 'none',
  };
}

/**
 * Collapses every curve into a handful of paths, one per colour-and-width combination.
 *
 * The ordering of the returned layers is the paint order: the faint web first, then the
 * dendritic fields, then the spine the eye follows, then the cell bodies on top.
 */
function buildLayers(
  geometry: RoadmapGeometry,
  model: RoadmapModel,
  theme: Theme,
): readonly DrawLayer[] {
  const layers: DrawLayer[] = [];
  const strokes = new Map<string, { d: string; layer: Omit<DrawLayer, 'd'> }>();

  const addStroke = (
    bucket: string,
    curve: Curve,
    colour: string,
    opacity: number,
    strokeWidth: number,
  ): void => {
    const rounded = Math.round(strokeWidth * 100) / 100;
    const key = `${bucket}|${colour}|${String(opacity)}|${String(rounded)}`;
    const existing = strokes.get(key);
    const d = curvePath(curve);

    if (existing === undefined) {
      strokes.set(key, {
        d,
        layer: { key, fill: 'none', stroke: colour, strokeWidth: rounded, opacity },
      });
      return;
    }

    existing.d = `${existing.d} ${d}`;
  };

  for (const curve of geometry.web) {
    addStroke('web', curve, theme.palette.border, 0.45, curve.strokeWidth);
  }

  for (const node of geometry.nodes) {
    const leaf = model.nodes[node.index];

    if (leaf === undefined) {
      continue;
    }

    const paint = paintFor(leaf.state, theme);

    for (const dendrite of node.dendrites) {
      addStroke('dendrite', dendrite, paint.colour, paint.processOpacity, dendrite.strokeWidth);
    }

    addStroke('axon', node.axon, paint.colour, paint.processOpacity, node.axon.strokeWidth);
  }

  /**
   * A spine segment is drawn as travelled only when the Leaf it leaves has been
   * completed, so the bright part of the path is exactly the distance the reader has
   * covered. Keyed on the *source* node: the gap after the last completed Leaf is the
   * one leading to where they are now, and it should not already look walked.
   */
  for (const [index, curve] of geometry.spine.entries()) {
    const travelled = model.nodes[index]?.state === 'done';

    addStroke(
      'spine',
      curve,
      travelled ? theme.palette.primary : theme.palette.border,
      travelled ? 0.75 : 0.6,
      curve.strokeWidth,
    );
  }

  for (const [key, entry] of strokes) {
    layers.push({ ...entry.layer, key, d: entry.d });
  }

  // Cell bodies last, so nothing is drawn over them. Fills and outlines are separate
  // buckets because a hollow locked body and a filled done body cannot share a path.
  const bodies = new Map<string, { d: string; layer: Omit<DrawLayer, 'd'> }>();

  for (const node of geometry.nodes) {
    const leaf = model.nodes[node.index];

    if (leaf === undefined) {
      continue;
    }

    const paint = paintFor(leaf.state, theme);
    const key = `soma|${paint.somaFill}|${paint.somaStroke}`;
    const d = curvePath(node.soma);
    const existing = bodies.get(key);

    if (existing === undefined) {
      bodies.set(key, {
        d,
        layer: {
          key,
          fill: paint.somaFill,
          stroke: paint.somaStroke,
          strokeWidth: theme.borderWidth.focus,
          opacity: 1,
        },
      });
      continue;
    }

    existing.d = `${existing.d} ${d}`;
  }

  for (const [key, entry] of bodies) {
    layers.push({ ...entry.layer, key, d: entry.d });
  }

  return layers;
}
