import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../design';
import { OnboardingPromiseScreen } from './OnboardingPromiseScreen';

/**
 * The promise, Tier B: its copy, and that Continue heads to the narrator. The skip is
 * pinned through `RootNavigator`'s real gate in `navigation.test.tsx` (it was untested
 * until ONBOARD-3), and the whole order there too.
 *
 * **The copy assertions exist because the first version misled**: "About fifteen minutes.
 * One book." read as a book finished in a sitting. They pin what the screen must explain
 * and what it must not say — a review criterion made mechanical. What is *not* pinned is
 * the exact wording, which is the founder's to edit.
 */

const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function renderPromise(): Promise<{
  readonly navigate: jest.Mock;
  readonly reset: jest.Mock;
  readonly markSeen: jest.Mock;
}> {
  const navigate = jest.fn();
  const reset = jest.fn();
  const markSeen = jest.fn();

  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode="dark">
        <OnboardingPromiseScreen
          navigation={{ navigate, reset } as never}
          route={{ key: 'OnboardingPromise', name: 'OnboardingPromise' } as never}
          markSeen={markSeen}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

  return { navigate, reset, markSeen };
}

/** Every string on the screen, joined — for the "must not say" checks. */
function allText(): string {
  const collect = (node: unknown): string[] => {
    if (typeof node === 'string') return [node];
    if (Array.isArray(node)) return node.flatMap(collect);
    if (node !== null && typeof node === 'object' && 'children' in node) return collect(node.children);
    return [];
  };

  return collect(screen.toJSON()).join(' ');
}

afterEach(async () => {
  await cleanup();
});

describe('OnboardingPromiseScreen copy', () => {
  it('explains Leaves, sessions and XP', async () => {
    await renderPromise();

    expect(screen.getByTestId('onboarding-promise-leaves')).toHaveTextContent(/Leaves/u);
    const sessions = screen.getByTestId('onboarding-promise-sessions');
    expect(sessions).toHaveTextContent(/session/iu);
    expect(sessions).toHaveTextContent(/fifteen minutes/iu);
    expect(sessions).toHaveTextContent(/XP/u);
  });

  it('does not say or imply that one book is finished in one sitting', async () => {
    await renderPromise();

    const text = allText();

    // The old copy's two misleading claims: "One book." and "one book's worth of progress".
    expect(text).not.toMatch(/one book/iu);
    expect(text).not.toMatch(/book(’|')s worth/iu);
    // …and it says the opposite: a book takes many sessions. Loose on purpose — the
    // wording is the founder's to edit, the claim is not.
    expect(screen.getByTestId('onboarding-promise-sessions')).toHaveTextContent(/\bmany\b/iu);
  });
});

describe('OnboardingPromiseScreen navigation', () => {
  it('goes on to the narrator beat, not straight to a book', async () => {
    const { navigate, markSeen } = await renderPromise();

    await fireEvent.press(screen.getByTestId('onboarding-promise-continue'));

    expect(navigate).toHaveBeenCalledWith('OnboardingNarrator');
    // Continuing is not finishing: nothing is marked seen at the promise.
    expect(markSeen).not.toHaveBeenCalled();
  });
});
