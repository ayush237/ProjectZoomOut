import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import type { StickyNotesSlide as StickyNotesSlideData } from '@zoomout/shared';

import { Icon, SlideImage, Text } from '../../components';
import { fontFamilies, useTheme, type Theme } from '../../design';
import { boardLayout } from './stickyNotesLayout';

/**
 * Slide 4 of 5. Two to six notes, pinned to a board.
 *
 * **The board now carries a real cork texture, drawn as a repeating SVG pattern
 * (ruled 2026-09-09, built in WP23.1).** The reasoning this docstring gave for a flat
 * panel — no texture asset, tokens only, a bordered rounded surface reads as "a board"
 * without either — is superseded, not deleted: an SVG `<Pattern>` needs no image asset
 * to license, ship or scale, so it satisfies the same tokens-only constraint the flat
 * panel was chosen for. `CorkTexture` below draws it from `theme.palette.border` alone
 * — no new colour value, same as the rest of this file.
 *
 * **No drop shadow, by the same rule every other surface in this app follows**
 * (`design/layout.ts`: *"there is no `shadowOpacity` anywhere in this app by
 * design"* — a shadow tuned for one theme is invisible on the other). "Raised paper"
 * comes from `elevation` instead: each note sits one step above the board itself, the
 * same mechanism `surfaceFor` uses everywhere else. "Layered" is the note's own
 * paper-plus-tape composition, not notes overlapping each other.
 *
 * **Reading order survives the stagger.** An earlier draft of this file split notes
 * into two literal column containers (all evens, then all odds) — which looks right
 * but reorders what a screen reader announces, from 0..5 to 0,2,4,1,3,5. `flexWrap`
 * keeps every note in one list, in its original order; the two-up look comes from
 * width and per-note rotation, not from two separate containers.
 */
export function StickyNotesSlide({
  data,
}: {
  readonly data: StickyNotesSlideData;
}): React.JSX.Element {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const layout = boardLayout(data.notes.length, fontScale);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Icon name="note" size={18} color={theme.palette.textMuted} />
        <Text variant="caption" tone="textMuted">
          {data.notes.length === 1 ? '1 note' : `${String(data.notes.length)} notes`}
        </Text>
      </View>

      {/**
       * The diagram, above and outside the board (WP15's placement, corrected for the
       * redesign rather than relitigated): "above, never instead" still holds, and
       * keeping it in its own frame rather than pinning it to the board like a note
       * is the "must not fight the board" call the handoff asked for — the board's
       * rotation and paper treatment are built for short note text, and stretching
       * that same treatment over a full illustration would either crush the image
       * into a corner or force the board to special-case its one non-paper child.
       */}
      {data.diagram === undefined ? null : (
        <SlideImage asset={data.diagram} testID="stickynotes-diagram" />
      )}

      <View
        testID="stickynotes-board"
        style={{
          backgroundColor: theme.surfaceFor('card'),
          borderRadius: theme.radius.lg,
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.palette.border,
          padding: theme.spacing.lg,
          paddingTop: theme.spacing.xl,
          // Clips the texture's rectangular fill to the board's rounded corners —
          // without it the pattern's `Rect` can show past the curve at each corner.
          overflow: 'hidden',
        }}
      >
        <CorkTexture color={theme.palette.border} />

        <View
          accessibilityRole="list"
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: theme.spacing.md,
            rowGap: theme.spacing.xl,
          }}
        >
          {data.notes.map((note, index) => (
            <Note
              // No id in the domain model and text is not guaranteed unique; safe
              // here because the list is never reordered or filtered.
              key={`note-${String(index)}`}
              text={note}
              index={index}
              full={layout === 'singleColumn'}
              fontScale={fontScale}
              theme={theme}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** The tile side, in points. A decorative constant, not a token — same precedent as
 * `PROGRESS_DOT_SIZE` on the Leaf player chrome. */
const CORK_TILE_SIZE = 28;

/**
 * Small, irregular flecks tiled behind the notes — cork, not a grid of dots.
 *
 * **Fixed coordinates, not generated.** WP22's determinism rule ("never `Math.random()`
 * at render time") was written for the roadmap, but the same reason applies here: a
 * texture that reshuffles on every re-render would be a distraction on a slide the
 * reader is meant to read notes on, not the pattern behind them. Varying radius and
 * opacity on a handful of hand-placed circles per tile is what keeps it reading as
 * texture rather than as a repeating dot grid — see the device-gate criterion that it
 * "must read as texture, not noise."
 *
 * One colour, `theme.palette.border`, at low opacity — the same token the board's own
 * hairline border already uses, so this adds no new colour value in either theme.
 */
function CorkTexture({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <Pattern
          id="stickynotes-cork"
          width={CORK_TILE_SIZE}
          height={CORK_TILE_SIZE}
          patternUnits="userSpaceOnUse"
        >
          <Circle cx={4} cy={6} r={1.4} fill={color} fillOpacity={0.55} />
          <Circle cx={14} cy={3} r={1} fill={color} fillOpacity={0.4} />
          <Circle cx={22} cy={9} r={1.7} fill={color} fillOpacity={0.5} />
          <Circle cx={9} cy={16} r={1.1} fill={color} fillOpacity={0.45} />
          <Circle cx={19} cy={19} r={1.3} fill={color} fillOpacity={0.35} />
          <Circle cx={2} cy={23} r={0.9} fill={color} fillOpacity={0.5} />
          <Circle cx={25} cy={24} r={1.2} fill={color} fillOpacity={0.4} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#stickynotes-cork)" />
    </Svg>
  );
}

/** A few degrees each way, cycling by position — enough to read as pinned by hand. */
const NOTE_ROTATIONS_DEG = [-3, 2, -4, 3, -2, 4] as const;

const NOTE_FONT_SIZE = 20;

/**
 * Generous even by this app's standards (`typography.payoff` is the previous high
 * bar at 1.76) — Caveat's loops and descenders reach further past its own baseline
 * than a geometric sans face's do, and this is the one line-height in the app that
 * has to hold up **without** relying on the fixed-number approach that clips
 * everywhere else at the largest accessibility sizes (`typography.ts`; founder
 * ruling of 2026-08-12 not to fix that app-wide). Scaled by `fontScale` below,
 * manually, because `lineHeight` is the one part of a text style RN does not scale
 * for you — `fontSize` does that on its own via `allowFontScaling`.
 */
const NOTE_LINE_HEIGHT_RATIO = 1.6;

function Note({
  text,
  index,
  full,
  fontScale,
  theme,
}: {
  readonly text: string;
  readonly index: number;
  /** Single-column mode: full board width, no stagger — the collapse itself is the accommodation. */
  readonly full: boolean;
  readonly fontScale: number;
  readonly theme: Theme;
}): React.JSX.Element {
  const rotation = NOTE_ROTATIONS_DEG[index % NOTE_ROTATIONS_DEG.length] ?? 0;

  return (
    <View
      accessibilityRole="text"
      testID={`stickynote-${String(index)}`}
      style={{
        // A touch under half, so `columnGap` on the parent has room without the
        // pair overflowing onto a third slot RN's flexbox would otherwise wrap to.
        width: full ? '100%' : '47%',
        // Every other note sits a little lower — a cheap stagger that avoids a
        // perfectly even grid without a real masonry layout for two to six items.
        marginTop: full || index % 2 === 0 ? 0 : theme.spacing.lg,
        backgroundColor: theme.surfaceFor('raised'),
        borderRadius: theme.radius.md,
        borderWidth: theme.borderWidth.hairline,
        borderColor: theme.palette.border,
        padding: theme.spacing.lg,
        paddingTop: theme.spacing.xl,
        transform: [{ rotate: `${String(rotation)}deg` }],
      }}
    >
      <Tape theme={theme} />

      <Text
        style={{
          fontFamily: fontFamilies.handwritten,
          fontSize: NOTE_FONT_SIZE,
          lineHeight: NOTE_FONT_SIZE * NOTE_LINE_HEIGHT_RATIO * fontScale,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/** A strip of tape across the top edge. Rotates with the note it is stuck to. */
function Tape({ theme }: { readonly theme: Theme }): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      // Decorative: the note's own accessibilityRole="text" already carries the
      // content, and "tape" is not information a screen reader should announce.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: -theme.spacing.sm,
        left: '50%',
        marginLeft: -theme.spacing.xl,
        width: theme.spacing.xl * 1.5,
        height: theme.spacing.lg,
        backgroundColor: theme.surfaceFor('pressed'),
        borderRadius: theme.radius.sm,
        opacity: 0.9,
      }}
    />
  );
}
