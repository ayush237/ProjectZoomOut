import { render, screen } from '@testing-library/react-native';
import type { PayoffSlide as PayoffSlideData } from '@zoomout/shared';

import { ThemeProvider } from '../../design';
import { PayoffSlide } from './PayoffSlide';

const NARRATED: PayoffSlideData = {
  body: 'The payoff prose.',
  audio: [
    {
      narrator: 'male',
      url: 'https://cdn.example.com/payoff-male.mp3',
      durationSeconds: 14,
      textDigest: 'a'.repeat(64),
    },
  ],
};

describe('PayoffSlide — narration (VO-3)', () => {
  it('plays the clip once the payoff is unlocked', async () => {
    await render(
      <ThemeProvider>
        <PayoffSlide data={NARRATED} justUnlocked={false} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('narration-control')).toBeTruthy();
  });

  it('has nothing to play while the payoff is still locked — there is no text to narrate', async () => {
    // `data` is `null` until earned; there is no `audio` array to read either, by
    // construction — the same gate that keeps the prose off the client.
    await render(
      <ThemeProvider>
        <PayoffSlide data={null} justUnlocked={false} />
      </ThemeProvider>,
    );

    expect(screen.queryByTestId('narration-control')).toBeNull();
  });

  it('shows no control when the server sent no audio for this slide', async () => {
    await render(
      <ThemeProvider>
        <PayoffSlide data={{ body: NARRATED.body }} justUnlocked={false} />
      </ThemeProvider>,
    );

    expect(screen.queryByTestId('narration-control')).toBeNull();
  });
});
