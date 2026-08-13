import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SlideImage } from './SlideImage';
import { ThemeProvider } from '../design';

/**
 * The slide illustration, and specifically its failure path (WP15).
 *
 * A URL that does not resolve to an image is a **normal input** here, not an edge case:
 * WP11 found a seeded Track whose cover pointed at a web page, and Phase 2 fills this
 * field from a generation pipeline. The guarantee is that the slide survives.
 */

const ASSET = {
  url: 'https://cdn.test/scenario.png',
  alt: 'A person choosing between two doors',
};

async function renderImage() {
  return render(
    <ThemeProvider mode="dark">
      <SlideImage asset={ASSET} />
    </ThemeProvider>,
  );
}

describe('SlideImage', () => {
  it('exposes the alt text to assistive technology', async () => {
    await renderImage();

    // The schema makes `alt` mandatory precisely so this is never empty.
    expect(screen.getByLabelText(ASSET.alt)).toBeOnTheScreen();
  });

  it('shows a placeholder carrying the alt text when the image fails to load', async () => {
    await renderImage();

    await fireEvent(screen.getByTestId('slide-image'), 'error');

    // The alt text becomes the visible fallback: a reader who cannot see the image and
    // a reader whose image did not load need exactly the same thing.
    await waitFor(() => {
      expect(screen.getByTestId('slide-image-failed')).toBeOnTheScreen();
    });
    expect(screen.getByText(ASSET.alt)).toBeOnTheScreen();
  });

  it('clears the loading indicator once the image loads', async () => {
    await renderImage();

    expect(screen.getByTestId('slide-image-loading')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('slide-image'), 'load');

    await waitFor(() => {
      expect(screen.queryByTestId('slide-image-loading')).toBeNull();
    });
    expect(screen.queryByTestId('slide-image-failed')).toBeNull();
  });
});
