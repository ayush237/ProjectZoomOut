import { contrastRatio, WCAG_AA_BODY, WCAG_AA_LARGE } from './contrast';
import { darkPalette, lightPalette, SURFACE_KEYS, type Palette } from './palette';

/**
 * Accessibility as a build failure, not a review comment.
 *
 * `design-direction.md` §3 requires body text at 4.5:1 **against the surface it
 * actually sits on** — checked per elevation level rather than once against
 * `surface/0`. That distinction is the whole point of this file: `textMuted` at the
 * document's original `#9AAAB5` passes on `surface/0` and fails by `surface/3`, and a
 * single-surface check would have shipped it.
 *
 * A token change that breaks contrast fails here rather than reaching a reader.
 */

const themes: readonly [name: string, palette: Palette][] = [
  ['dark', darkPalette],
  ['light', lightPalette],
];

describe.each(themes)('%s theme', (_name, palette) => {
  describe.each(SURFACE_KEYS)('on %s', (surfaceKey) => {
    const surface = palette[surfaceKey];

    it('renders body text at AA', () => {
      expect(contrastRatio(palette.textPrimary, surface)).toBeGreaterThanOrEqual(WCAG_AA_BODY);
    });

    it('renders muted text at AA', () => {
      // The pairing that fails first, and the reason this suite iterates surfaces.
      expect(contrastRatio(palette.textMuted, surface)).toBeGreaterThanOrEqual(WCAG_AA_BODY);
    });

    it.each(['primary', 'reward', 'correct', 'incorrect'] as const)(
      'renders %s at AA as text',
      (token) => {
        // Accents are used for labels and icons, not only for fills, so they are held
        // to the body threshold on every surface rather than the large-text one.
        expect(contrastRatio(palette[token], surface)).toBeGreaterThanOrEqual(WCAG_AA_BODY);
      },
    );
  });

  it('renders on-primary text against a primary fill', () => {
    expect(contrastRatio(palette.onPrimary, palette.primary)).toBeGreaterThanOrEqual(
      WCAG_AA_BODY,
    );
  });

  it('renders on-reward text against a reward fill', () => {
    expect(contrastRatio(palette.onReward, palette.reward)).toBeGreaterThanOrEqual(WCAG_AA_BODY);
  });

  it('separates each elevation level visibly from the one below', () => {
    // Depth comes from surface lightness rather than shadow (§5), so adjacent surfaces
    // that are too close collapse the entire depth system into a flat screen — and
    // nothing else in the suite would notice.
    for (let level = 1; level < SURFACE_KEYS.length; level += 1) {
      const below = palette[SURFACE_KEYS[level - 1] as (typeof SURFACE_KEYS)[number]];
      const above = palette[SURFACE_KEYS[level] as (typeof SURFACE_KEYS)[number]];

      expect(contrastRatio(above, below)).toBeGreaterThan(1.05);
    }
  });

  it('keeps the hairline border distinguishable from the page', () => {
    expect(contrastRatio(palette.border, palette.surface0)).toBeGreaterThan(1.2);
  });
});

/* -------------------------------------------------------------------------- */
/* The two themes are independent                                              */
/* -------------------------------------------------------------------------- */

describe('theme independence', () => {
  it.each(['primary', 'reward', 'correct', 'incorrect', 'textPrimary', 'textMuted'] as const)(
    'gives %s a different value in each theme',
    (token) => {
      // §3: colours are not reused across themes. A shared accent is the mechanism by
      // which a value tuned for a dark background silently ends up on a light one.
      expect(darkPalette[token]).not.toBe(lightPalette[token]);
    },
  );

  it('reverses the direction of elevation between themes', () => {
    // Dark elevates by getting lighter; light has nowhere to go but darker. Same rule —
    // increase separation from the page — with the sign flipped.
    const darkRises =
      contrastRatio(darkPalette.surface3, '#FFFFFF') < contrastRatio(darkPalette.surface0, '#FFFFFF');
    const lightFalls =
      contrastRatio(lightPalette.surface3, '#000000') <
      contrastRatio(lightPalette.surface0, '#000000');

    expect(darkRises).toBe(true);
    expect(lightFalls).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Large text                                                                  */
/* -------------------------------------------------------------------------- */

describe('large text', () => {
  it.each(themes)('clears the large-text threshold on every surface in %s', (_name, palette) => {
    for (const surfaceKey of SURFACE_KEYS) {
      expect(contrastRatio(palette.textPrimary, palette[surfaceKey])).toBeGreaterThanOrEqual(
        WCAG_AA_LARGE,
      );
    }
  });
});
