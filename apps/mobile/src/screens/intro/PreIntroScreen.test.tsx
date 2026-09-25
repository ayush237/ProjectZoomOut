import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ThemeProvider, type ThemeMode } from '../../design';
import { PRE_INTRO_LINE, PRE_INTRO_WORDMARK, PreIntroScreen } from './PreIntroScreen';

/**
 * The pre-intro, Tier B: what it shows, in both themes, and that a tap goes on. Its
 * once-per-install gating and its place before `AuthStack` are pinned through
 * `RootNavigator`'s real gate in `navigation.test.tsx`, against the real store.
 *
 * The assertions follow `PRE_INTRO_LINE` rather than a literal: the line is a first draft
 * the founder reads at the device gate, and a test that pinned the draft would fail on
 * their edit for no reason that is a defect.
 */

const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function renderPreIntro(
  options: { mode?: ThemeMode } = {},
): Promise<{ readonly onContinue: jest.Mock }> {
  const onContinue = jest.fn();

  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode={options.mode ?? 'dark'}>
        <PreIntroScreen onContinue={onContinue} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

  return { onContinue };
}

afterEach(async () => {
  await cleanup();
});

describe.each(['dark', 'light'] as const)('PreIntroScreen in %s', (mode) => {
  it('shows the wordmark, one line, and how to go on', async () => {
    await renderPreIntro({ mode });

    expect(screen.getByTestId('pre-intro-wordmark')).toHaveTextContent(PRE_INTRO_WORDMARK);
    expect(screen.getByTestId('pre-intro-line')).toHaveTextContent(PRE_INTRO_LINE);
    expect(screen.getByText('Tap to continue')).toBeOnTheScreen();
  });
});

describe('PreIntroScreen', () => {
  it('goes on with a tap anywhere on the screen, once', async () => {
    const { onContinue } = await renderPreIntro();

    await fireEvent.press(screen.getByTestId('pre-intro-screen'));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('is one button to a screen reader, named for what it says', async () => {
    await renderPreIntro();

    const control = screen.getByTestId('pre-intro-screen');
    expect(control.props['accessibilityRole']).toBe('button');
    expect(control.props['accessibilityLabel']).toBe(`${PRE_INTRO_WORDMARK}. ${PRE_INTRO_LINE}`);
  });
});
