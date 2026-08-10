/**
 * WCAG contrast, as a function rather than an assurance.
 *
 * `design-direction.md` §3 requires body text at 4.5:1 and large text at 3:1 **against
 * the surface it actually sits on** — verified per elevation level, not once against
 * `surface/0`. That is a numeric claim, so it is checked numerically: the token values
 * in `palette.ts` were tuned against this function, and `palette.test.ts` fails the
 * build if any pairing regresses.
 *
 * Implements WCAG 2.1 relative luminance and contrast ratio verbatim.
 */

export const WCAG_AA_BODY = 4.5;
export const WCAG_AA_LARGE = 3;

/** @throws {Error} if the value is not a 6-digit `#rrggbb` hex colour. */
export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsBodyContrast(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= WCAG_AA_BODY;
}

export function meetsLargeTextContrast(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= WCAG_AA_LARGE;
}

function relativeLuminance(hex: string): number {
  const { red, green, blue } = parseHex(hex);

  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** The sRGB gamma expansion from the WCAG definition. */
function channel(value: number): number {
  const normalised = value / 255;

  return normalised <= 0.03928
    ? normalised / 12.92
    : Math.pow((normalised + 0.055) / 1.055, 2.4);
}

const HEX_PATTERN = /^#([0-9a-f]{6})$/iu;

function parseHex(hex: string): { red: number; green: number; blue: number } {
  const match = HEX_PATTERN.exec(hex);

  if (match === null) {
    // Loud rather than silently returning black, which would make a failing pairing
    // look like a passing one in whichever direction the mistake happened to fall.
    throw new Error(`Expected a #rrggbb colour, received "${hex}"`);
  }

  const value = Number.parseInt(match[1] as string, 16);

  return {
    red: (value >> 16) & 0xff,
    green: (value >> 8) & 0xff,
    blue: value & 0xff,
  };
}
