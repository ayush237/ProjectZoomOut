import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../design';
import type { TypographyVariant } from '../design';

/**
 * The only text component in the app.
 *
 * Two rules it exists to enforce, both of which are easy to break one screen at a time:
 *
 *  1. **Font scaling is never disabled.** `allowFontScaling` is not exposed as a prop.
 *     React Native defaults it on, and the usual way apps lose it is a developer
 *     turning it off to stop one label wrapping — which silently breaks the app for
 *     every reader who sized their text up, who are disproportionately the ones who
 *     needed to (`design-direction.md` §4). Fix the layout, not the accessibility.
 *  2. **Colour comes from the theme**, so no screen hardcodes a hex that survives a
 *     theme switch.
 */

export interface TextProps extends Omit<RNTextProps, 'allowFontScaling' | 'style'> {
  readonly variant?: TypographyVariant;
  /** A palette key, not a colour. Defaults to `textPrimary`. */
  readonly tone?: 'textPrimary' | 'textMuted' | 'primary' | 'reward' | 'correct' | 'incorrect';
  readonly align?: 'auto' | 'left' | 'right' | 'center';
  readonly style?: RNTextProps['style'];
}

export function Text({
  variant = 'body',
  tone = 'textPrimary',
  align,
  style,
  ...rest
}: TextProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <RNText
      {...rest}
      style={[
        theme.typography[variant],
        { color: theme.palette[tone] },
        align === undefined ? null : { textAlign: align },
        style,
      ]}
    />
  );
}
