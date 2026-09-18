import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button, Text } from '../../components';
import {
  MIN_TOUCH_TARGET,
  motionTimingConfig,
  REDUCE_MOTION_OVERRIDE,
  useReducedMotion,
  useTheme,
  type Theme,
} from '../../design';
import { layoutRoadmap } from '../track/roadmapGeometry';
import { INTRO_BEATS, INTRO_CROSSFADE_MS, INTRO_HANDOFF_MS, type IntroBeat } from './introBeats';
import { introCameraFrames } from './introCamera';
import { INTRO_FOCUS_INDEX, INTRO_SEED, INTRO_STATES } from './introFixture';
import { buildIntroLayers } from './introLayers';

/**
 * The first-run cold open: a camera pulling back from one neuron to a whole network,
 * over four lines of copy, once per install.
 *
 * **A thin consumer of `layoutRoadmap`, same split as `TrackRoadmap.tsx`.** Every
 * coordinate comes from that pure function against a fixed fixture (`introFixture.ts`);
 * this file owns only the camera move, the paint (`introLayers.ts`) and the beat clock.
 *
 * **One continuous camera move, not four slides.** `scale`/`focusX`/`focusY` each run a
 * single `withTiming` from beat 1's frame to beat 4's, over one unbroken span
 * (`CAMERA_DURATION_MS`) that ends as beat 4 begins — there is no per-beat camera
 * keyframe to stop or restart at. Beat boundaries are purely when a line's opacity
 * timeline (`IntroLine`) crosses another's; the camera does not know they exist.
 *
 * **Reduce Motion swaps the movement, not the content.** With it on, the camera and the
 * beat-4 pulse jump straight to their resting values with no animation at all — nothing
 * for Reanimated's own suppression to have a chance to cancel — while the text crossfade
 * keeps running exactly as it does in full motion, because an opacity fade is already the
 * accommodation §6 asks for. The four lines still arrive; the network is still drawn;
 * only the two things that read as *movement* are gone.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** How long the camera's one move takes — see `INTRO_HANDOFF_MS`'s own doc. */
const CAMERA_DURATION_MS = INTRO_HANDOFF_MS;

/** One loop of the beat-4 signal travelling the spine. Independent of the intro's own
 *  total length — this is the pulse's own pace, not tied to any beat boundary. */
const PULSE_DURATION_MS = 3000;
/** The travelling dash, as a fraction of the spine's length. */
const PULSE_DASH_FRACTION = 0.15;
/** The gap after it — bigger than the spine itself, so only one dash is ever on screen. */
const PULSE_GAP_FRACTION = 1.3;
const PULSE_STROKE_WIDTH = 2;

export interface IntroScreenProps {
  readonly onExit: () => void;
  readonly testID?: string;
}

export function IntroScreen({
  onExit,
  testID = 'intro-screen',
}: IntroScreenProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const [canHandOff, setCanHandOff] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCanHandOff(true);
    }, INTRO_HANDOFF_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const geometry = useMemo(
    () => layoutRoadmap(INTRO_STATES, { width, height }, INTRO_SEED),
    [width, height],
  );

  const paint = useMemo(() => buildIntroLayers(geometry, theme), [geometry, theme]);

  const camera = useMemo(
    () => introCameraFrames(geometry, INTRO_FOCUS_INDEX, { width, height }),
    [geometry, width, height],
  );

  const scale = useSharedValue(camera.start.scale);
  const focusX = useSharedValue(camera.start.focus.x);
  const focusY = useSharedValue(camera.start.focus.y);
  const dashOffset = useSharedValue(0);

  // [dash, gap] — a gap bigger than the spine itself so only one dash is ever on screen.
  // Derived once here and reused both by the travelling animation below and by the
  // static `strokeDasharray` prop, so the two cannot disagree about the pattern's size.
  const dashPattern = useMemo<readonly [number, number]>(
    () => [
      paint.spineLength * PULSE_DASH_FRACTION,
      Math.max(paint.spineLength * PULSE_GAP_FRACTION, 1),
    ],
    [paint.spineLength],
  );

  useEffect(() => {
    if (reducedMotion) {
      // A direct set, not a suppressed animation: there is no Reanimated animation
      // object here at all for its own reduce-motion snapshot to (possibly wrongly)
      // cancel. The still frame *is* the accommodation — see the file docstring.
      scale.value = camera.end.scale;
      focusX.value = camera.end.focus.x;
      focusY.value = camera.end.focus.y;
      return;
    }

    const cameraConfig = {
      ...motionTimingConfig({ kind: 'spring', durationMs: CAMERA_DURATION_MS }),
      // A deliberate departure from `motion.ts`'s spring-over-linear default: the spring
      // presets are tuned for short, discrete UI feedback, not a single ~10s cinematic
      // move, and a spring stretched that long either idles at near-zero velocity for
      // most of its length or overshoots the "whole graph in frame" target and settles
      // back into it, which reads as a camera bump, not a pull-back. An eased `withTiming`
      // is the correct tool for a one-shot move with a known endpoint and duration.
      easing: Easing.out(Easing.cubic),
    };

    scale.value = withTiming(camera.end.scale, cameraConfig);
    focusX.value = withTiming(camera.end.focus.x, cameraConfig);
    focusY.value = withTiming(camera.end.focus.y, cameraConfig);

    const [dashLength, gapLength] = dashPattern;

    dashOffset.value = withRepeat(
      withTiming(-(dashLength + gapLength), {
        duration: PULSE_DURATION_MS,
        reduceMotion: REDUCE_MOTION_OVERRIDE,
      }),
      -1,
      false,
      undefined,
      REDUCE_MOTION_OVERRIDE,
    );
  }, [reducedMotion, camera, dashPattern, scale, focusX, focusY, dashOffset]);

  const cameraStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: width / 2 },
      { translateY: height / 2 },
      { scale: scale.value },
      { translateX: -focusX.value },
      { translateY: -focusY.value },
    ],
  }));

  const pulseProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  return (
    <View testID={testID} style={[styles.fill, { backgroundColor: theme.surfaceFor('page') }]}>
      {/* Takes no touches, same rule as `TrackRoadmap.tsx`'s SVG layer. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, cameraStyle]}>
        <Svg width={geometry.width} height={geometry.height}>
          {paint.layers.map((layer) => (
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

          {/* The only new visual in the package, and the only amber on this screen.
              Omitted entirely under Reduce Motion — see the file docstring. */}
          {reducedMotion ? null : (
            <AnimatedPath
              d={paint.spinePath}
              fill="none"
              stroke={theme.palette.reward}
              strokeWidth={PULSE_STROKE_WIDTH}
              strokeDasharray={dashPattern}
              strokeLinecap="round"
              animatedProps={pulseProps}
            />
          )}
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={styles.textStage}>
        {INTRO_BEATS.map((beat, index) => (
          <IntroLine
            key={beat.text}
            beat={beat}
            index={index}
            nextStartMs={INTRO_BEATS[index + 1]?.startMs ?? null}
            theme={theme}
          />
        ))}
      </View>

      {canHandOff ? (
        <View
          style={{
            position: 'absolute',
            left: theme.spacing.xl,
            right: theme.spacing.xl,
            bottom: insets.bottom + theme.spacing.xl,
          }}
        >
          <Button testID="intro-continue" label="Get started" onPress={onExit} />
        </View>
      ) : (
        <Pressable
          testID="intro-skip"
          accessibilityRole="button"
          accessibilityLabel="Skip intro"
          onPress={onExit}
          hitSlop={theme.spacing.md}
          style={{
            position: 'absolute',
            top: insets.top + theme.spacing.lg,
            right: theme.spacing.xl,
            minWidth: MIN_TOUCH_TARGET,
            minHeight: MIN_TOUCH_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="body" tone="textMuted">
            Skip
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * One line's crossfade. Fades in at `beat.startMs`; if there is a next line, fades back
 * out exactly as that line starts fading in (`nextStartMs`) — the overlap of the two
 * windows is the crossfade. The last line has no `nextStartMs` and simply holds at full
 * opacity, since nothing here ever fades it back out — the screen exits from under it.
 */
function IntroLine({
  beat,
  index,
  nextStartMs,
  theme,
}: {
  readonly beat: IntroBeat;
  readonly index: number;
  readonly nextStartMs: number | null;
  readonly theme: Theme;
}): React.JSX.Element {
  const opacity = useSharedValue(0);

  useEffect(() => {
    const fadeConfig = motionTimingConfig({ kind: 'fade', durationMs: INTRO_CROSSFADE_MS });

    if (nextStartMs === null) {
      opacity.value = withDelay(beat.startMs, withTiming(1, fadeConfig), REDUCE_MOTION_OVERRIDE);
      return;
    }

    const holdMs = Math.max(0, nextStartMs - beat.startMs - INTRO_CROSSFADE_MS);

    opacity.value = withDelay(
      beat.startMs,
      withSequence(
        REDUCE_MOTION_OVERRIDE,
        withTiming(1, fadeConfig),
        withDelay(holdMs, withTiming(0, fadeConfig), REDUCE_MOTION_OVERRIDE),
      ),
      REDUCE_MOTION_OVERRIDE,
    );
  }, [beat.startMs, nextStartMs, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.lineWrap, style]}>
      <Text
        variant="display"
        align="center"
        style={{ paddingHorizontal: theme.spacing.xl }}
        testID={`intro-line-${String(index)}`}
      >
        {beat.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  textStage: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  lineWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
