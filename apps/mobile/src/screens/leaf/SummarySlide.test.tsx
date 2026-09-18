import { render, screen } from '@testing-library/react-native';
import type { SummarySlide as SummarySlideData } from '@zoomout/shared';

import { ThemeProvider } from '../../design';
import { SummarySlide } from './SummarySlide';

const NARRATED: SummarySlideData = {
  body: 'A summary of the book.',
  audio: [
    {
      narrator: 'male',
      url: 'https://cdn.example.com/summary-male.mp3',
      durationSeconds: 10,
      textDigest: 'a'.repeat(64),
    },
  ],
};

describe('SummarySlide — narration (VO-3)', () => {
  it('plays the clip for the reader’s narrator alongside the body text', async () => {
    await render(
      <ThemeProvider>
        <SummarySlide data={NARRATED} />
      </ThemeProvider>,
    );

    expect(screen.getByText(NARRATED.body)).toBeTruthy();
    expect(screen.getByTestId('narration-control')).toBeTruthy();
  });

  it('shows no control when the server sent no audio for this slide', async () => {
    await render(
      <ThemeProvider>
        <SummarySlide data={{ body: NARRATED.body }} />
      </ThemeProvider>,
    );

    expect(screen.queryByTestId('narration-control')).toBeNull();
  });
});
