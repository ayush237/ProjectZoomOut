import { cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../../api/tokenStore';
import { AuthProvider } from '../../auth/AuthProvider';
import { ThemeProvider } from '../../design';
import { OnboardingPickBookScreen } from './OnboardingPickBookScreen';

/**
 * Beat 2, Tier B: one happy path (a real Track chosen, landing on beat 3 with it) plus
 * the one decision the handoff asked to be proven rather than only described — the
 * achievement banner is suppressed here, unlike Explore's identical `addToLibrary` call.
 *
 * **`navigation` is a mock, not a real stack.** A real `Stack.Navigator` transition
 * unmounts this screen once `navigate` is called, which is before `act` yields back to
 * these assertions — the first version of this file learned that the hard way: a
 * mutation that re-added the achievement banner passed every test here, because the
 * banner's own screen had already been torn down by the time anything checked for it.
 * Mocking `navigation.navigate` keeps the screen mounted, which is what actually lets
 * "did it render the banner before moving on" be answered at all.
 */

const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

afterEach(async () => {
  await cleanup();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

const PROFILE = {
  id: '55a918e0-b185-4fb7-9b08-7459aae3b8fa',
  email: 'reader@example.test',
  authProviders: ['email'],
  displayName: 'Test Reader',
  dateOfBirth: '1994-03-17',
  timezone: 'Europe/London',
  createdAt: '2026-08-11T12:00:00.000Z',
  updatedAt: '2026-08-11T12:00:00.000Z',
};

const REAL_TRACK = {
  id: 't1',
  bookTitle: 'Ikigai: The Japanese Secret to a Long and Happy Life',
  author: 'An Author',
  coverUrl: 'https://example.test/cover.png',
  description: 'A description.',
  isPlaceholder: false,
};

const PLACEHOLDER_TRACK = {
  id: 't2',
  bookTitle: 'Placeholder Filler Track 01',
  author: 'Placeholder',
  coverUrl: 'https://example.test/cover.png',
  description: 'Placeholder.',
  isPlaceholder: true,
};

const UNLOCKED_FIRST_BOOK = [
  { id: 'first-book', name: 'First Book', description: 'd', tier: 'common', unlockedAt: '2026-09-22T00:00:00.000Z' },
];

function backend(tracks: unknown[], unlocked: unknown[] = []): typeof fetch {
  return (input) => {
    const url = urlOf(input);

    if (url.includes('/auth/refresh')) {
      return Promise.resolve(
        json({ userId: PROFILE.id, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, tokenType: 'Bearer' }),
      );
    }
    if (url.includes('/users/me')) return Promise.resolve(json(PROFILE));
    if (url.includes('/library/tracks/')) return Promise.resolve(json({ unlocked }));
    if (url.includes('/content/tracks')) {
      return Promise.resolve(json({ tracks, page: 1, totalPages: 1, totalTracks: tracks.length }));
    }

    return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
  };
}

async function renderPickBook(
  fetchFn: typeof fetch,
): Promise<{
  readonly navigate: jest.Mock;
  readonly view: ReturnType<typeof render> extends Promise<infer R> ? R : never;
}> {
  const navigate = jest.fn();
  const markSeen = jest.fn();

  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode="dark">
        <AuthProvider tokenStore={new MemoryTokenStore('stored-refresh')} baseUrl="https://api.test" fetchFn={fetchFn}>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  const view = await render(
    <OnboardingPickBookScreen
      // Only what this screen actually reads — `navigate` and `reset` — rather than a
      // full `NativeStackNavigationProp`, which would need many more methods stubbed
      // for no test here to ever call.
      navigation={{ navigate, reset: jest.fn() } as never}
      route={{ key: 'OnboardingPickBook', name: 'OnboardingPickBook' } as never}
      markSeen={markSeen}
    />,
    { wrapper },
  );

  return { navigate, view };
}

describe('OnboardingPickBookScreen', () => {
  it('shows only the real Track, not the placeholder, even though the placeholder sorts first', async () => {
    await renderPickBook(backend([PLACEHOLDER_TRACK, REAL_TRACK]));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-pickbook-t1-choose')).toBeTruthy();
    });
    expect(screen.queryByTestId('onboarding-pickbook-t2-choose')).toBeNull();
  });

  it('adds the chosen book and hands its id and title to beat 3', async () => {
    const user = userEvent.setup();
    const { navigate } = await renderPickBook(backend([REAL_TRACK]));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-pickbook-t1-choose')).toBeTruthy();
    });
    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('OnboardingNarrator', {
        pickedTrack: { id: 't1', title: REAL_TRACK.bookTitle },
      });
    });
  });

  it('does not show the achievement banner after earning first-book here', async () => {
    // ONBOARD-1 finding 3's decision, proven rather than only described: `addToLibrary`
    // returns `first-book` from this fixture's own stub, the same response shape
    // Explore's banner reads — and this screen must not render it. Mutation-checked:
    // rendering `<AchievementUnlock achievements={unlocked} />` here left every other
    // test in this file green; only this assertion caught it.
    const user = userEvent.setup();
    const { navigate } = await renderPickBook(backend([REAL_TRACK], UNLOCKED_FIRST_BOOK));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-pickbook-t1-choose')).toBeTruthy();
    });
    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));

    // Waits for `choose` to have actually finished (reached `navigate`, its last
    // statement) rather than for the button's own `busy` state, which flips true
    // synchronously on press and so proves nothing about whether the fetch resolved.
    await waitFor(() => {
      expect(navigate).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('achievement-unlock')).toBeNull();
  });
});
