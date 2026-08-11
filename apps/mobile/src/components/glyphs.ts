/**
 * Forces **text presentation** on a glyph.
 *
 * Several of the characters this app uses as icons have an emoji form, and iOS picks it
 * by default: `↗` and `☺` render as full-colour emoji, which ignore `color` entirely.
 * The symptom is subtle and screenshot-shaped — an icon that looks fine but never takes
 * the theme tint, so an active tab looks identical to an inactive one and a teal
 * ornament renders blue.
 *
 * U+FE0E is the variation selector that asks for the monochrome glyph, which then takes
 * the tint like any other text.
 *
 * Shared rather than duplicated because it was fixed in the tab bar first and the empty
 * states kept the bug — exactly the drift a local constant invites.
 */
const TEXT_PRESENTATION_SELECTOR = '︎';

export function asTextGlyph(symbol: string): string {
  return `${symbol}${TEXT_PRESENTATION_SELECTOR}`;
}
