import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
  HALO_RADIUS,
  SPINE_WIDTH,
  curvePath,
  layoutRoadmap,
  type Curve,
  type Dot,
  type RoadmapGeometry,
  type RoadmapNodeGeometry,
} from './roadmapGeometry';
import {
  layoutRoadmapLabels,
  showsLeafNumber,
  type RoadmapCard,
  type RoadmapLabel,
} from './roadmapLabels';
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
 * **Roughly nine thousand curves are drawn as about three dozen native paths.** SVG path
 * data takes many subpaths in one `d` string, so every curve sharing a colour, a stroke
 * width and an opacity is concatenated into a single `<Path>`. One React element per
 * curve would mean thousands of native views inside a scroll view, which is where a
 * screen like this stops being a screen; this is the reason WP22.2 could raise density
 * twentyfold without touching the element count.
 *
 * **The four states differ by more than hue**, because colour alone is not a state
 * indicator for every reader:
 *
 * | state | body | outline | centre |
 * |---|---|---|---|
 * | `next` | filled, largest, aura behind it, carries its Leaf number | — | the number |
 * | `done` | page-coloured, smallest | solid reward ring | reward bud |
 * | `revisit` | page-coloured, middling | **dashed** reward ring | reward bud |
 * | `locked` | page-coloured | hairline border ring | — |
 *
 * Greyscale still reads: size, fill, dash and the presence of a bud are four independent
 * signals before colour is consulted at all.
 *
 * **Amber arrived here in WP22.2 and it is a reversal worth naming.** WP22 wrote that
 * the reward colour is reserved for something won and a finished Leaf is progress rather
 * than a prize. `graph.jsx` uses it for both `done` and `revisit`, the founder compared
 * the two screens and called ours wrong, and the design source now outranks that
 * reasoning. Recorded rather than quietly flipped, because the argument was sound and
 * only the ruling changed.
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

/** The breathing ring around the next cell, sized to the aura it sits on. */
const RING_SIZE = HALO_RADIUS * 2;

export function TrackRoadmap({
  model,
  seed,
  width,
  viewportHeight,
  onOpenLeaf,
  testID = 'track-roadmap',
}: TrackRoadmapProps): React.JSX.Element {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();

  const states = useMemo(() => model.nodes.map((node) => node.state), [model.nodes]);

  const geometry = useMemo(
    () => layoutRoadmap(states, { width, height: viewportHeight }, seed),
    [states, width, viewportHeight, seed],
  );

  const margin = useMemo(
    () =>
      layoutRoadmapLabels({
        nodes: geometry.nodes,
        titles: model.nodes.map((node) => node.title),
        frameWidth: geometry.width,
        fontScale,
        fontSize: theme.typography.caption.fontSize ?? 12,
        lineHeight: theme.typography.caption.lineHeight ?? 16,
        cardFontSize: theme.typography.h3.fontSize ?? 18,
        cardLineHeight: theme.typography.h3.lineHeight ?? 24,
      }),
    [geometry, model.nodes, fontScale, theme],
  );

  const layers = useMemo(
    () => buildLayers(geometry, margin.labels, theme),
    [geometry, margin.labels, theme],
  );

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
              {...(layer.dash === undefined ? {} : { strokeDasharray: layer.dash })}
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
            label={margin.labels.find((candidate) => candidate.index === node.index) ?? null}
            card={margin.card}
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
 * That applies to the Leaf number on the next cell too, which `graph.jsx` draws as an
 * SVG `<text>` and this file draws as an absolutely-positioned `Text`.
 */
function RoadmapNodeOverlay({
  leaf,
  geometry,
  label,
  card,
  onOpenLeaf,
}: {
  readonly leaf: RoadmapNode;
  readonly geometry: RoadmapNodeGeometry;
  readonly label: RoadmapLabel | null;
  readonly card: RoadmapCard | null;
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

      <NodeLabel leaf={leaf} geometry={geometry} label={label} card={card} />

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
 *
 * **WP22.2 sized it to `graph.jsx`'s aura** rather than to the touch target, and dropped
 * its opacity to the source's 0.32, so the ring and the filled aura behind it are the
 * same object rather than two concentric circles at different radii.
 */
function NextNodeRing({ centre }: { readonly centre: { x: number; y: number } }): React.JSX.Element {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const plan = motionPlan(reducedMotion, duration.celebration);

  const scale = useSharedValue(1);
  const opacity = useSharedValue(HALO_STROKE_OPACITY);

  useEffect(() => {
    if (plan.kind === 'fade') {
      opacity.value = withRepeat(
        withTiming(HALO_STROKE_OPACITY * 0.4, {
          duration: plan.durationMs,
          reduceMotion: ReduceMotion.Never,
        }),
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
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.palette.primary,
        },
      ]}
    />
  );
}

/**
 * What a node says.
 *
 * The Leaf the reader is up to shows its number inside the cell and its full title on a
 * card beneath — the one place on this screen a whole sentence has room. Everything else
 * carries a wrapped, uppercased label in the gutter, laid out by `roadmapLabels.ts`,
 * which decides how much of the title fits and whether it is worth drawing at all.
 *
 * The text is always the Leaf's own title, cut but never reworded, and the capitals are
 * a style rather than a transformation of the string. See `roadmapLabels.ts`.
 */
function NodeLabel({
  leaf,
  geometry,
  label,
  card,
}: {
  readonly leaf: RoadmapNode;
  readonly geometry: RoadmapNodeGeometry;
  readonly label: RoadmapLabel | null;
  readonly card: RoadmapCard | null;
}): React.JSX.Element | null {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();

  if (leaf.state === 'next') {
    return (
      <>
        {/* Inside the cell, on the fill. `onPrimary` is the token that exists for text
            sitting on `primary`, and it is the only pairing checked for contrast.
            Dropped rather than clipped once the OS text size outgrows the cell — see
            `showsLeafNumber`. */}
        {showsLeafNumber(
          geometry.radius,
          theme.typography.h3.fontSize ?? 18,
          fontScale,
        ) ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: geometry.centre.x - MIN_TOUCH_TARGET / 2,
              top: geometry.centre.y - MIN_TOUCH_TARGET / 2,
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              variant="h3"
              align="center"
              numberOfLines={1}
              style={{ color: theme.palette.onPrimary }}
              testID={`roadmap-number-${leaf.leafId}`}
            >
              {String(leaf.orderIndex + 1)}
            </Text>
          </View>
        ) : null}

        {card === null ? null : (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: card.x,
              top: card.y,
              width: card.width,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.surfaceFor('raised'),
              borderWidth: theme.borderWidth.hairline,
              borderColor: theme.palette.border,
            }}
          >
            <Text variant="caption" tone="primary" testID={`roadmap-next-eyebrow-${leaf.leafId}`}>
              {`Leaf ${String(leaf.orderIndex + 1)} · next`}
            </Text>
            <Text
              variant="h3"
              numberOfLines={3}
              testID={`roadmap-label-${leaf.leafId}`}
            >
              {labelFor(leaf)}
            </Text>
          </View>
        )}
      </>
    );
  }

  if (label === null) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: label.top,
        // Anchored to the frame edge rather than sized to the text, so the block can be
        // right-aligned into the left gutter without measuring it first.
        ...(label.side === 'left'
          ? { left: 0, width: label.x }
          : { left: label.x, right: 0 }),
      }}
    >
      {/**
       * `caption`, which is exactly `graph.jsx`'s label: display semibold, twelve point,
       * 0.8 of tracking, uppercased.
       *
       * **This reverses WP22's ruling**, which chose `small` on the grounds that these
       * are book content and eighteen shouting fragments of a real author's chapter
       * titles read as signage. That observation was correct about *one-line stubs in a
       * 37-point gutter*, which is what the screen had. With the meander narrowed and
       * the labels wrapped to two lines in the gutter that opens up, they read as a
       * table of contents — which is what the source draws and what the founder asked
       * for twice. The capitals remain a style: the string is never uppercased, so the
       * screen reader and the accessibility label still get the author's own casing.
       */}
      <Text
        variant="caption"
        tone={leaf.state === 'locked' ? 'textMuted' : 'textPrimary'}
        align={label.side === 'left' ? 'right' : 'left'}
        testID={`roadmap-label-${leaf.leafId}`}
      >
        {label.lines.join('\n')}
      </Text>
    </View>
  );
}

/**
 * State said out loud.
 *
 * A screen reader gets no benefit from a filled body versus a hollow one, so the thing
 * the shapes encode is spelled out here instead. The title is read in full even where
 * the visible label is truncated or dropped entirely — truncation is a space constraint,
 * not an editorial one, and this is the guarantee that makes dropping a label at large
 * text sizes safe.
 */
function accessibilityLabelFor(leaf: RoadmapNode): string {
  const position = `Leaf ${String(leaf.orderIndex + 1)}`;
  const state = STATE_WORDS[leaf.state];

  return `${position}: ${leaf.title}. ${state}.`;
}

const STATE_WORDS: Record<LeafNodeState, string> = {
  done: 'Completed',
  next: 'Up next',
  revisit: 'Completed, worth revisiting',
  locked: 'Not yet unlocked',
};

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
  readonly dash?: readonly number[] | undefined;
}

interface StatePaint {
  /** What this cell's processes and its outline are drawn in. */
  readonly colour: string;
  readonly processOpacity: number;
  readonly somaFill: string;
  readonly somaStroke: string;
  readonly somaStrokeWidth: number;
  readonly dash?: readonly number[] | undefined;
  /** The bud at the centre of a read cell, in the reward colour. Null when there is none. */
  readonly core: string | null;
}

/** The aura behind the next cell: a wash, and a ring at the same radius. */
const HALO_FILL_OPACITY = 0.07;
const HALO_STROKE_OPACITY = 0.32;
/** `graph.jsx`: reached tissue is drawn back, unreached tissue forward. */
const REACHED_PROCESS_OPACITY = 0.44;
const UNREACHED_PROCESS_OPACITY = 0.8;
const LEADER_OPACITY = 0.55;
const LEADER_WIDTH = 0.8;
const REVISIT_DASH = [3.5, 4] as const;
const REVISIT_RING_OPACITY = 0.85;

/**
 * How each state is drawn — transcribed from `graph.jsx`'s `GraphNode`.
 *
 * The body is page-coloured rather than transparent on three of the four states, and
 * that is load-bearing rather than cosmetic: the dendritic fields are dense enough now
 * that a hollow outline over them is unreadable. The fill is what punches the cell out
 * of the tissue.
 */
function paintFor(state: LeafNodeState, theme: Theme): StatePaint {
  const page = theme.surfaceFor('page');

  if (state === 'next') {
    return {
      colour: theme.palette.primary,
      processOpacity: REACHED_PROCESS_OPACITY,
      somaFill: theme.palette.primary,
      somaStroke: 'none',
      somaStrokeWidth: 0,
      core: null,
    };
  }

  if (state === 'done') {
    return {
      colour: theme.palette.primary,
      processOpacity: REACHED_PROCESS_OPACITY,
      somaFill: page,
      somaStroke: theme.palette.reward,
      somaStrokeWidth: theme.borderWidth.hairline,
      core: theme.palette.reward,
    };
  }

  if (state === 'revisit') {
    return {
      colour: theme.palette.primary,
      processOpacity: REACHED_PROCESS_OPACITY,
      somaFill: page,
      somaStroke: theme.palette.reward,
      somaStrokeWidth: theme.borderWidth.hairline,
      // The one state whose outline is broken rather than solid. Independent of hue, so
      // it survives greyscale and it survives the light theme's much darker amber.
      dash: REVISIT_DASH,
      core: theme.palette.reward,
    };
  }

  return {
    colour: theme.palette.border,
    processOpacity: UNREACHED_PROCESS_OPACITY,
    somaFill: page,
    somaStroke: theme.palette.border,
    somaStrokeWidth: theme.borderWidth.hairline,
    core: null,
  };
}

/**
 * Collapses every curve into a few dozen paths, one per distinct paint.
 *
 * The ordering of the returned layers is the paint order: the faint web first, then the
 * dendritic fields and their buds, then the spine the eye follows, then the leader
 * lines, then the cell bodies on top of everything.
 */
function buildLayers(
  geometry: RoadmapGeometry,
  labels: readonly RoadmapLabel[],
  theme: Theme,
): readonly DrawLayer[] {
  const batch = new Batch();

  for (const curve of geometry.web) {
    batch.stroke('web', curvePath(curve), theme.palette.border, 0.4, curve.strokeWidth);
  }

  for (const dot of geometry.webDots) {
    batch.fill('web-dot', dotPath(dot), theme.palette.surface3, 1);
  }

  for (const node of geometry.nodes) {
    const paint = paintFor(node.state, theme);

    for (const dendrite of node.dendrites) {
      batch.stroke(
        'dendrite',
        curvePath(dendrite),
        paint.colour,
        paint.processOpacity * dendrite.opacity,
        dendrite.strokeWidth,
      );
    }

    batch.stroke(
      'axon',
      curvePath(node.axon),
      paint.colour,
      paint.processOpacity * node.axon.opacity,
      node.axon.strokeWidth,
    );

    for (const bud of node.tips) {
      batch.fill('bud', dotPath(bud), paint.colour, paint.processOpacity * bud.opacity);
    }
  }

  /**
   * A spine segment is drawn as travelled only when the Leaf it leaves has been
   * completed, so the bright part of the path is exactly the distance the reader has
   * covered. Keyed on the *source* node: the gap after the last completed Leaf is the
   * one leading to where they are now, and it should not already look walked.
   */
  for (const [index, curve] of geometry.spine.entries()) {
    const travelled = isRead(geometry.nodes[index]?.state);

    batch.stroke(
      'spine',
      curvePath(curve),
      travelled ? theme.palette.primary : theme.palette.border,
      travelled ? 0.75 : 0.6,
      travelled ? SPINE_WIDTH.travelled : SPINE_WIDTH.ahead,
    );
  }

  for (const label of labels) {
    if (label.leader === null) {
      continue;
    }

    const node = geometry.nodes.find((candidate) => candidate.index === label.index);

    batch.stroke(
      'leader',
      label.leader,
      isRead(node?.state) ? theme.palette.primary : theme.palette.border,
      LEADER_OPACITY,
      LEADER_WIDTH,
    );
  }

  // Cell bodies last, so nothing is drawn over them. The aura goes underneath its own
  // body but on top of every process, which is what gives the next cell its clearing.
  for (const node of geometry.nodes) {
    if (node.halo !== null) {
      const halo = curvePath(node.halo);

      batch.fill('halo', halo, theme.palette.primary, HALO_FILL_OPACITY);
      batch.stroke('halo-ring', halo, theme.palette.primary, HALO_STROKE_OPACITY, 1.5);
    }
  }

  for (const node of geometry.nodes) {
    const paint = paintFor(node.state, theme);
    const body = curvePath(node.soma);

    if (paint.somaFill !== 'none') {
      batch.fill('soma', body, paint.somaFill, 1);
    }

    if (paint.somaStroke !== 'none') {
      batch.stroke(
        'soma-ring',
        body,
        paint.somaStroke,
        paint.dash === undefined ? 1 : REVISIT_RING_OPACITY,
        paint.somaStrokeWidth,
        paint.dash,
      );
    }

    if (paint.core !== null) {
      batch.fill('core', curvePath(coreBlob(node)), paint.core, 1);
    }
  }

  return batch.layers();
}

function isRead(state: LeafNodeState | undefined): boolean {
  return state === 'done' || state === 'revisit';
}

/**
 * The bud at a read cell's centre.
 *
 * Derived from the soma rather than generated, so it stays inside a body that is itself
 * irregular: scaling the outline down about its own centre keeps the two concentric
 * however lopsided the cell is, and costs the geometry nothing to carry.
 */
function coreBlob(node: RoadmapNodeGeometry): Curve {
  const factor = CORE_RADIUS / Math.max(node.radius, 0.01);
  const shrink = (point: { x: number; y: number }): { x: number; y: number } => ({
    x: node.centre.x + (point.x - node.centre.x) * factor,
    y: node.centre.y + (point.y - node.centre.y) * factor,
  });

  return {
    from: shrink(node.soma.from),
    segments: node.soma.segments.map((segment) => ({
      c1: shrink(segment.c1),
      c2: shrink(segment.c2),
      to: shrink(segment.to),
    })),
    strokeWidth: 0,
    opacity: 1,
    closed: true,
  };
}

const CORE_RADIUS = 2.9;

/**
 * A dot as a closed path, so it can share a `<Path>` with everything else its colour.
 *
 * `<Circle>` would be a separate element each, and there are a couple of thousand of
 * them. Four arcs' worth of cubics is the standard circle approximation and is
 * indistinguishable at these radii.
 */
function dotPath(dot: Dot): string {
  const { centre, radius } = dot;
  const k = radius * 0.5523;

  return (
    `M${(centre.x - radius).toFixed(2)},${centre.y.toFixed(2)}` +
    `C${(centre.x - radius).toFixed(2)},${(centre.y - k).toFixed(2)} ` +
    `${(centre.x - k).toFixed(2)},${(centre.y - radius).toFixed(2)} ` +
    `${centre.x.toFixed(2)},${(centre.y - radius).toFixed(2)}` +
    `C${(centre.x + k).toFixed(2)},${(centre.y - radius).toFixed(2)} ` +
    `${(centre.x + radius).toFixed(2)},${(centre.y - k).toFixed(2)} ` +
    `${(centre.x + radius).toFixed(2)},${centre.y.toFixed(2)}` +
    `C${(centre.x + radius).toFixed(2)},${(centre.y + k).toFixed(2)} ` +
    `${(centre.x + k).toFixed(2)},${(centre.y + radius).toFixed(2)} ` +
    `${centre.x.toFixed(2)},${(centre.y + radius).toFixed(2)}` +
    `C${(centre.x - k).toFixed(2)},${(centre.y + radius).toFixed(2)} ` +
    `${(centre.x - radius).toFixed(2)},${(centre.y + k).toFixed(2)} ` +
    `${(centre.x - radius).toFixed(2)},${centre.y.toFixed(2)}Z`
  );
}

/**
 * Accumulates subpaths into one `<Path>` per distinct paint.
 *
 * Pulled out of `buildLayers` in WP22.2 because there are now five kinds of thing being
 * batched rather than two, and the bucket key grew a dash pattern. Insertion order is
 * the paint order, which `Map` guarantees.
 */
class Batch {
  private readonly buckets = new Map<string, { d: string; layer: Omit<DrawLayer, 'd'> }>();

  stroke(
    bucket: string,
    d: string,
    colour: string,
    opacity: number,
    strokeWidth: number,
    dash?: readonly number[],
  ): void {
    const width = round(strokeWidth);
    const alpha = round(opacity);
    const key = `${bucket}|${colour}|${String(alpha)}|${String(width)}|${dash?.join(',') ?? ''}`;

    this.add(key, d, {
      key,
      fill: 'none',
      stroke: colour,
      strokeWidth: width,
      opacity: alpha,
      dash,
    });
  }

  fill(bucket: string, d: string, colour: string, opacity: number): void {
    const alpha = round(opacity);
    const key = `${bucket}|${colour}|${String(alpha)}`;

    this.add(key, d, { key, fill: colour, stroke: 'none', strokeWidth: 0, opacity: alpha });
  }

  layers(): readonly DrawLayer[] {
    return [...this.buckets.values()].map((entry) => ({ ...entry.layer, d: entry.d }));
  }

  private add(key: string, d: string, layer: Omit<DrawLayer, 'd'>): void {
    const existing = this.buckets.get(key);

    if (existing === undefined) {
      this.buckets.set(key, { d, layer });
      return;
    }

    existing.d = `${existing.d} ${d}`;
  }
}

/**
 * Two decimal places, which is what collapses thousands of curves into dozens of paths.
 *
 * Each generation of a dendritic tree fades by a factor of 0.94 and thins by 0.58, so
 * the raw values are a long tail of distinct floats; rounding them is what makes two
 * curves from different nodes land in the same bucket. Coarser than this and the fade
 * banding becomes visible; finer and the element count climbs back toward the curve
 * count, which is the thing batching exists to prevent.
 */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
