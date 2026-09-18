import { render, screen } from '@testing-library/react-native';
import type { TakeawaySlide as TakeawaySlideData } from '@zoomout/shared';

import { ThemeProvider } from '../../design';
import { TakeawaySlide } from './TakeawaySlide';

const NARRATED: TakeawaySlideData = {
  body: 'The one line to leave with.',
  audio: [
    {
      narrator: 'male',
      url: 'https://cdn.example.com/takeaway-male.mp3',
      durationSeconds: 8,
      textDigest: 'a'.repeat(64),
    },
  ],
};

describe('TakeawaySlide — narration (VO-3)', () => {
  it('plays the clip for the reader’s narrator alongside the takeaway', async () => {
    await render(
      <ThemeProvider>
        <TakeawaySlide data={NARRATED} />
      </ThemeProvider>,
    );

    expect(screen.getByText(NARRATED.body)).toBeTruthy();
    expect(screen.getByTestId('narration-control')).toBeTruthy();
  });

  it('shows no control when the server sent no audio for this slide', async () => {
    await render(
      <ThemeProvider>
        <TakeawaySlide data={{ body: NARRATED.body }} />
      </ThemeProvider>,
    );

    expect(screen.queryByTestId('narration-control')).toBeNull();
  });
});
