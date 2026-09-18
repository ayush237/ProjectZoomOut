import { AccessibilityInfo } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ThemeProvider, type ThemeMode } from '../../design';
import { INTRO_BEATS, INTRO_HANDOFF_MS } from './introBeats';
import { IntroScreen } from './IntroScreen';

/**
 * The screen itself: both themes, the four verbatim lines, the skip/hand-off swap, and
 * the Reduce Motion branch. The seen-flag's persistence and `RootNavigator`'s branching
 * are covered separately in `navigation.test.tsx`, against the real store — this file
 * exercises `IntroScreen` in isolation with a plain `onExit` spy.
 */

const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function renderIntro(
  options: { mode?: ThemeMode } = {},
): Promise<{ readonly onExit: jest.Mock }> {
  const onExit = jest.fn();

  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode={options.mode ?? 'dark'}>
        <IntroScreen onExit={onExit} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

  return { onExit };
}

function mockReducedMotion(enabled: boolean): void {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(enabled);
}

/**
 * `jest.advanceTimersByTime` fires the `setTimeout` callback and the `setState` inside
 * it synchronously, but React's own commit for that update needs a microtask tick to
 * flush through `act` — without it the state change happens and the screen still shows
 * the pre-update tree. Two empty microtask turns inside the same `act` call is the
 * smallest reliable fix found by hand (one was not enough).
 */
async function advanceTimersAndFlush(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe.each(['dark', 'light'] as const)('IntroScreen in %s', (mode) => {
  it('renders the four lines, verbatim', async () => {
    await renderIntro({ mode });

    for (const beat of INTRO_BEATS) {
      expect(screen.getByText(beat.text)).toBeOnTheScreen();
    }
  });

  it('draws the network', async () => {
    await renderIntro({ mode });

    expect(screen.getByTestId('intro-screen')).toBeOnTheScreen();
  });
});

describe('the skip and hand-off controls', () => {
  it('offers skip from the very first frame', async () => {
    await renderIntro();

    expect(screen.getByTestId('intro-skip')).toBeOnTheScreen();
    expect(screen.queryByTestId('intro-continue')).toBeNull();
  });

  it('calls onExit when skip is pressed', async () => {
    const { onExit } = await renderIntro();

    await fireEvent.press(screen.getByTestId('intro-skip'));

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('swaps skip for the sign-in hand-off once beat 4 starts, and only then', async () => {
    // Fake timers must be live before mount: the hand-off timer is scheduled the
    // instant IntroScreen's effect first runs, during `renderIntro` below.
    jest.useFakeTimers();
    const { onExit } = await renderIntro();

    expect(screen.getByTestId('intro-skip')).toBeOnTheScreen();

    await advanceTimersAndFlush(INTRO_HANDOFF_MS);

    expect(screen.queryByTestId('intro-skip')).toBeNull();
    expect(screen.getByTestId('intro-continue')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('intro-continue'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('does not yet offer hand-off just before beat 4 starts', async () => {
    jest.useFakeTimers();
    await renderIntro();

    await advanceTimersAndFlush(INTRO_HANDOFF_MS - 1);

    expect(screen.getByTestId('intro-skip')).toBeOnTheScreen();
    expect(screen.queryByTestId('intro-continue')).toBeNull();
  });
});

describe('Reduce Motion', () => {
  it('still renders all four lines and the network with the accommodation on', async () => {
    mockReducedMotion(true);
    await renderIntro();

    for (const beat of INTRO_BEATS) {
      expect(screen.getByText(beat.text)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('intro-screen')).toBeOnTheScreen();
  });

  it('still renders all four lines and the network with the accommodation off', async () => {
    mockReducedMotion(false);
    await renderIntro();

    for (const beat of INTRO_BEATS) {
      expect(screen.getByText(beat.text)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('intro-screen')).toBeOnTheScreen();
  });
});
