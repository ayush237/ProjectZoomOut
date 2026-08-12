import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../design';

/**
 * The app's icon set: **Ionicons, via `@expo/vector-icons`.**
 *
 * Chosen over the alternatives for three reasons, in order of weight:
 *
 *  1. It is a font, so `color` and `size` behave like text properties and every icon
 *     takes the theme tint automatically. That is exactly what WP6's text glyphs failed
 *     at — `↗` and `☺` resolved to colour emoji, ignored `color`, and left the active
 *     tab indistinguishable from the inactive ones. The U+FE0E variation selector that
 *     fixed it was a workaround, and this replaces it.
 *  2. It is maintained by Expo against the SDK, so it does not become an upgrade
 *     hazard the way an SVG icon library with a `react-native-svg` peer would.
 *  3. It has the shapes this product needs today without a second package.
 *
 * Every icon in the app comes through here rather than importing `Ionicons` directly,
 * so the set can be swapped in one file — and so nothing bypasses the sizing rule below.
 */

/**
 * The names this app uses, mapped to Ionicons.
 *
 * A closed list rather than an open `string`: it keeps the icon vocabulary visible in
 * one place, makes an unavailable glyph a compile error rather than a blank square on
 * a device, and means swapping icon sets is a change to this map.
 */
const ICONS = {
  explore: 'compass-outline',
  library: 'library-outline',
  journey: 'trending-up-outline',
  profile: 'happy-outline',
  add: 'add-circle-outline',
  added: 'checkmark-circle',
  remove: 'remove-circle-outline',
  resume: 'play-circle',
  retry: 'refresh',
  error: 'alert-circle',
  success: 'checkmark-circle',
  info: 'information-circle',
  chevron: 'chevron-forward',
  book: 'book-outline',

  /* The Leaf player (WP8). */
  close: 'close',
  back: 'arrow-back',
  next: 'arrow-forward',
  /**
   * The payoff gate, both states.
   *
   * A padlock rather than a tint, because §6's rule is that right and wrong are never
   * signalled by colour alone — `correct` green and `primary` teal are adjacent in hue
   * and indistinguishable to a good share of readers.
   */
  locked: 'lock-closed',
  unlocked: 'lock-open',
  /** Answer feedback. Deliberately a different *shape* from `success`, not a recolour. */
  incorrect: 'close-circle',
  note: 'reader-outline',
  /** Dinner Table Knowledge — the one thing on the takeaway slide a reader opens. */
  idea: 'bulb-outline',
  soundOn: 'volume-medium',
  soundOff: 'volume-mute',

  /* Achievements (WP5b). */
  /**
   * One glyph for all nineteen rather than one each.
   *
   * Tier drives visual weight through colour and the card, per the proposal — an icon
   * per achievement would be nineteen shapes to design and to keep meaningful, and a
   * grid of nineteen different glyphs reads as noise rather than as a collection.
   */
  achievement: 'trophy',
} as const;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  readonly name: IconName;
  /** Size in points at the default text size. See the scaling note below. */
  readonly size?: number;
  /** A palette key, not a colour. Defaults to the primary text tone. */
  readonly tone?: 'textPrimary' | 'textMuted' | 'primary' | 'reward' | 'correct' | 'incorrect';
  /** Overrides `tone` with a literal colour, for callers given one by a navigator. */
  readonly color?: string;
  readonly testID?: string;
  /**
   * Whether the icon carries meaning on its own.
   *
   * Defaults to false — decorative — because most icons here sit beside a label that
   * already says the same thing, and announcing both is noise. Set it with a label when
   * the icon is the only thing conveying the state.
   */
  readonly accessibilityLabel?: string;
}

/**
 * Icons do not grow with the OS text size — and `size` is already absolute.
 *
 * Not scaling is deliberate, and the opposite of the rule for text: WP6 shipped a
 * fixed-height tab bar whose scaled glyphs were clipped to fragments at
 * `accessibilityExtraExtraExtraLarge`, and a sized container whose glyph burst out of
 * it. **The words scale; the ornament beside them does not.**
 *
 * The important part is that `@expo/vector-icons` renders with font scaling **off**, so
 * `size` lands on screen as written and needs no correction. An earlier version of this
 * component divided by the font scale to "cancel" a multiplication that never happens —
 * which made every icon *shrink* as text grew, down to about 9pt at XXXL. Caught in the
 * simulator; it is invisible in a test, because nothing asserts on rendered point size.
 */
const DEFAULT_SIZE = 24;

export function Icon({
  name,
  size = DEFAULT_SIZE,
  tone = 'textPrimary',
  color,
  testID,
  accessibilityLabel,
}: IconProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <Ionicons
      name={ICONS[name]}
      size={size}
      color={color ?? theme.palette[tone]}
      {...(testID === undefined ? {} : { testID })}
      accessible={accessibilityLabel !== undefined}
      {...(accessibilityLabel === undefined
        ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
        : { accessibilityLabel, accessibilityRole: 'image' as const })}
    />
  );
}
