import { render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';

import { ShareCard } from './ShareCard';

/**
 * Tier B, plus the aspect/mascot behaviour this file adds for WP26 — genuinely new
 * logic, not just wiring, and every existing caller (`WrapUpScreen`,
 * `AchievementShareScreen`) depends on the default branch staying exactly as it was.
 */
describe('ShareCard', () => {
  it('keeps the default mascot band when no override is given', async () => {
    await render(<ShareCard eyebrow="Today" headline="1 Leaf today" subtitle="A ZoomOut session" />);

    expect(screen.getByTestId('share-mascot-slot')).toBeTruthy();
  });

  it('replaces the mascot band with an override, leaving the rest of the card alone', async () => {
    await render(
      <ShareCard
        eyebrow="Track complete"
        headline="The Quiet Arithmetic"
        subtitle="Marisol Vane"
        mascot={<RNText testID="fragment-stub">fragment</RNText>}
      />,
    );

    expect(screen.getByTestId('fragment-stub')).toBeTruthy();
    expect(screen.getByTestId('share-card-headline')).toHaveTextContent('The Quiet Arithmetic');
    expect(screen.getByTestId('share-card-subtitle')).toHaveTextContent('Marisol Vane');
    expect(screen.getByTestId('share-wordmark')).toBeTruthy();
  });

  it('defaults to auto height — unchanged from before this prop existed', async () => {
    await render(<ShareCard eyebrow="Today" headline="1 Leaf today" subtitle="A ZoomOut session" />);

    const style = screen.getByTestId('share-card').props['style'] as {
      height?: number;
      justifyContent?: string;
    };

    expect(style.height).toBeUndefined();
    expect(style.justifyContent).toBeUndefined();
  });

  it('sizes a square card to 1:1', async () => {
    await render(
      <ShareCard eyebrow="Track complete" headline="720" subtitle="XP earned" aspect="square" />,
    );

    expect(screen.getByTestId('share-card')).toHaveStyle({ width: 320, height: 320 });
  });

  it('sizes a vertical card to 9:16', async () => {
    await render(
      <ShareCard eyebrow="Track complete" headline="720" subtitle="XP earned" aspect="vertical" />,
    );

    // 320 * 16 / 9, rounded.
    expect(screen.getByTestId('share-card')).toHaveStyle({ width: 320, height: 569 });
  });
});
