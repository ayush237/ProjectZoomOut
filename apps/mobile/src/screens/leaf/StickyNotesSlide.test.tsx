import { render, screen } from '@testing-library/react-native';
import type { StickyNotesSlide as StickyNotesSlideData } from '@zoomout/shared';

import { ThemeProvider } from '../../design';
import { StickyNotesSlide } from './StickyNotesSlide';

/**
 * VO-3 scope: four narrated slides only. `PRODUCT.md` and `content.mapper.ts` both
 * exclude Sticky Notes deliberately — there is no narrated field to verify a clip
 * against, so `mapAudioEntries` always omits any entry here regardless of what a
 * client sends. This component never imports `NarrationControl` at all, and this test
 * pins that even against a fixture the real mapper could never actually produce
 * (`audio` populated on sticky notes), so a future copy-paste of the control onto this
 * slide fails loudly rather than only failing to matter in production.
 */
const DATA: StickyNotesSlideData = {
  notes: ['First note', 'Second note'],
  audio: [
    {
      narrator: 'male',
      url: 'https://cdn.example.com/sticky-notes.mp3',
      durationSeconds: 5,
      textDigest: 'a'.repeat(64),
    },
  ],
};

describe('StickyNotesSlide — no narration control (VO-3)', () => {
  it('renders the notes without a narration control, even given audio data', async () => {
    await render(
      <ThemeProvider>
        <StickyNotesSlide data={DATA} />
      </ThemeProvider>,
    );

    expect(screen.getByText('First note')).toBeTruthy();
    expect(screen.queryByTestId('narration-control')).toBeNull();
  });
});
