import { fontFamilies } from './typography';

/**
 * Tier B for WP21: one happy path, and an honest limit on what it proves.
 *
 * This asserts the token string, not that the font renders as a script face — a wrong
 * `fontFamily` value falls back to the system font silently in React Native, so this
 * test would still be green on that failure. The device gate is where that risk is
 * actually covered; this just guards against the token itself being renamed or dropped.
 */
describe('fontFamilies.handwritten', () => {
  it('names the single Caveat weight loaded in App.tsx', () => {
    expect(fontFamilies.handwritten).toBe('Caveat_400Regular');
  });
});
