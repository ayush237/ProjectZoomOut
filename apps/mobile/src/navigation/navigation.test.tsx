import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../api/tokenStore';
import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider, type ThemeMode } from '../design';
import { INTRO_HANDOFF_MS } from '../screens/intro/introBeats';
import { getIntroSeen, setIntroSeen } from '../screens/intro/introSeenStore';
import { getOnboardingSeen, setOnboardingSeen } from '../screens/onboarding/onboardingSeenStore';
import { RootNavigator } from './RootNavigator';

/** `jest.setup.js`'s in-memory keychain stand-in — reset so one test's intro-seen state
 *  cannot leak into the next. */
type ResettableSecureStore = typeof SecureStore & { __reset: () => void };

/**
 * The navigators, rendered.
 *
 * WP6 shipped `RootNavigator` and `TabShell` with no render test — the two components
 * that decide *which* screen a reader sees. Everything below is about that choice:
 * signed out lands on the auth stack, signed in lands on the tab shell, and the four
 * tabs are present and labelled.
 *
 * `TabShell` is exercised through `RootNavigator` rather than directly, because
 * mounting it alone would test a navigator nobody renders that way.
 */

const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

/**
 * Every test in this file except the `Intro` and `Onboarding` blocks below exercises
 * auth branching, not either gate. INTRO-1 made `RootNavigator` check a second,
 * independent flag before it will render `AuthStack`; ONBOARD-1 added a third — a
 * signed-in reader whose Library is empty and whose onboarding flag is unset now lands
 * on `OnboardingPromise`, not `Tabs`. Without both flags set here, every "signed in"
 * test in this file would land on an onboarding beat instead of `explore-screen`,
 * since `signedInBackend` below stubs `/library` as empty. Defaulting to "already seen"
 * on both keeps those tests testing what they have always tested; the `Intro` and
 * `Onboarding` blocks each clear their own flag.
 */
beforeEach(async () => {
  (SecureStore as ResettableSecureStore).__reset();
  await setIntroSeen();
  await setOnboardingSeen();
});

afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * The URL of a fetch call, whichever form it arrives in.
 *
 * `RequestInfo` is `string | URL | Request`, and `String()` on a `Request` yields
 * "[object Object]" — every route would silently stop matching.
 */
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

const SESSION = {
  userId: PROFILE.id,
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresIn: 900,
  tokenType: 'Bearer',
};

/** Answers everything the shell asks for on mount, so the tabs can render. */
const signedInBackend: typeof fetch = (input) => {
  const url = urlOf(input);

  if (url.includes('/auth/refresh')) return Promise.resolve(json(SESSION));
  if (url.includes('/users/me')) return Promise.resolve(json(PROFILE));
  if (url.includes('/content/tracks')) {
    return Promise.resolve(json({ tracks: [], page: 1, totalPages: 0, totalTracks: 0 }));
  }
  if (url.includes('/library')) return Promise.resolve(json({ entries: [] }));

  return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
};

/** No stored token, so the app settles signed out. */
const signedOutBackend: typeof fetch = () =>
  Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));

async function renderApp(options: {
  refreshToken: string | null;
  fetchFn: typeof fetch;
  mode?: ThemeMode;
}): Promise<ReturnType<typeof render> extends Promise<infer R> ? R : never> {
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode={options.mode ?? 'dark'}>
        <AuthProvider
          tokenStore={new MemoryTokenStore(options.refreshToken)}
          baseUrl="https://api.test"
          fetchFn={options.fetchFn}
        >
          {children}
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  const view = await render(<RootNavigator />, { wrapper });

  await act(async () => {
    await Promise.resolve();
  });

  return view;
}

describe('RootNavigator', () => {
  it('shows the auth stack when nobody is signed in', async () => {
    const view = await renderApp({ refreshToken: null, fetchFn: signedOutBackend });

    await waitFor(() => {
      expect(view.getByTestId('sign-in-screen')).toBeOnTheScreen();
    });
  });

  it('shows the tab shell to a restored session', async () => {
    const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
  });

  it('does not flash sign-in at a reader who is already signed in', async () => {
    // The reason `restoring` is a distinct state rather than an initial `signedOut`.
    const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('sign-in-screen')).toBeNull();
  });
});

describe('TabShell', () => {
  it.each(['Explore', 'Library', 'Journey', 'Profile'])(
    'offers a labelled %s tab',
    async (label) => {
      // Labelled as well as iconed, so nothing depends on reading the symbol — the
      // property that made WP6's emoji-glyph defect survivable.
      const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend });

      await waitFor(() => {
        expect(view.getByText(label)).toBeOnTheScreen();
      });
    },
  );

  it('opens on Explore', async () => {
    // Where a reader with an empty library has something to do.
    const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
  });

  it.each(['dark', 'light'] as const)('renders the shell in the %s theme', async (mode) => {
    const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend, mode });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
  });
});

describe('Intro', () => {
  // Undoes the file's own default (see the top-level `beforeEach`): these tests are
  // about the flag itself, so they start from "not seen", same as a fresh install.
  beforeEach(() => {
    (SecureStore as ResettableSecureStore).__reset();
  });

  it('shows the intro ahead of the auth stack on an install that has not seen it', async () => {
    const view = await renderApp({ refreshToken: null, fetchFn: signedOutBackend });

    await waitFor(() => {
      expect(view.getByTestId('intro-screen')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('sign-in-screen')).toBeNull();
  });

  it('sets the flag and lands on sign-in when skipped', async () => {
    const view = await renderApp({ refreshToken: null, fetchFn: signedOutBackend });

    await waitFor(() => {
      expect(view.getByTestId('intro-skip')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByTestId('intro-skip'));

    await waitFor(() => {
      expect(view.getByTestId('sign-in-screen')).toBeOnTheScreen();
    });
    await expect(getIntroSeen()).resolves.toBe(true);
  });

  it('sets the flag and lands on sign-in when driven to completion', async () => {
    // Fake timers must be live before mount: `IntroScreen`'s hand-off timer is
    // scheduled the instant its effect first runs, during `renderApp` below.
    jest.useFakeTimers();

    const view = await renderApp({ refreshToken: null, fetchFn: signedOutBackend });

    expect(view.getByTestId('intro-skip')).toBeOnTheScreen();

    // `jest.advanceTimersByTime` fires the timer's `setState` synchronously, but
    // React's own commit needs a microtask tick to flush through `act` — see
    // `IntroScreen.test.tsx`'s `advanceTimersAndFlush` for the same fix.
    await act(async () => {
      jest.advanceTimersByTime(INTRO_HANDOFF_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(view.getByTestId('intro-continue')).toBeOnTheScreen();

    await fireEvent.press(view.getByTestId('intro-continue'));

    jest.useRealTimers();

    await waitFor(() => {
      expect(view.getByTestId('sign-in-screen')).toBeOnTheScreen();
    });
    await expect(getIntroSeen()).resolves.toBe(true);
  });

  it('never mounts the intro, and goes straight to sign-in, when the flag is already set', async () => {
    await setIntroSeen();

    const view = await renderApp({ refreshToken: null, fetchFn: signedOutBackend });

    await waitFor(() => {
      expect(view.getByTestId('sign-in-screen')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('intro-screen')).toBeNull();
  });
});

describe('Onboarding', () => {
  // Undoes the file's own default (see the top-level `beforeEach`): these tests are
  // about the flag and the Library check themselves, so they start from "not seen",
  // same as a fresh install or a fresh account.
  beforeEach(async () => {
    (SecureStore as ResettableSecureStore).__reset();
    await setIntroSeen();
  });

  const REAL_TRACK = {
    id: 't1',
    bookTitle: 'Ikigai: The Japanese Secret to a Long and Happy Life',
    author: 'An Author',
    coverUrl: 'https://example.test/cover.png',
    description: 'A description.',
    isPlaceholder: false,
  };

  const LEAF_SUMMARY = { id: 'l1', trackId: 't1', orderIndex: 0, title: 'Leaf One', isPlaceholder: false };

  const DELIVERED_LEAF = {
    id: 'l1',
    trackId: 't1',
    orderIndex: 0,
    title: 'Leaf One',
    summary: { body: 'Summary.', audio: [] },
    scenario: { prompt: 'Prompt?', options: [] },
    payoff: null,
    payoffUnlocked: false,
    stickyNotes: { notes: [] },
    takeaway: { body: 'Takeaway.' },
    sourceReferences: [],
  };

  const LIBRARY_ENTRY = {
    track: REAL_TRACK,
    addedAt: '2026-09-01T00:00:00.000Z',
    status: 'active',
    progress: { trackId: 't1', totalLeaves: 1, completedLeaves: 0, nextLeafId: 'l1', isComplete: false },
  };

  /**
   * A signed-in backend with one real Track and everything beats 1–4 touch, so the
   * full-flow test below can walk end to end without a dozen separate stubs.
   * `initialLibraryEntries` is the one thing that varies per test — empty for a new
   * reader, non-empty for an existing one.
   *
   * **Stateful, not a fixed stub** — `/library/tracks/t1` (`addToLibrary`) appends to
   * the same `entries` array a later `/library` (`listLibrary`) read returns. Beat 3's
   * resume lookup depends on seeing what beat 2 just added; a static stub would silently
   * send it down the same "could not find the entry" fallback path a real failure does,
   * which is exactly the bug this backend originally shipped with in this test.
   */
  function onboardingBackend(initialLibraryEntries: unknown[]): typeof fetch {
    const entries = [...initialLibraryEntries];

    return (input) => {
      const url = urlOf(input);

      if (url.includes('/auth/refresh')) return Promise.resolve(json(SESSION));
      if (url.includes('/users/me')) return Promise.resolve(json(PROFILE));
      if (url.includes('/library/tracks/')) {
        entries.push(LIBRARY_ENTRY);
        return Promise.resolve(json({ unlocked: [] }));
      }
      if (url.includes('/content/tracks/t1/leaves')) {
        return Promise.resolve(json({ leaves: [LEAF_SUMMARY] }));
      }
      if (url.includes('/content/leaves/l1')) return Promise.resolve(json(DELIVERED_LEAF));
      if (url.includes('/progress/leaves/l1/start')) {
        return Promise.resolve(
          json({
            progress: {
              userId: PROFILE.id,
              leafId: 'l1',
              attemptCount: 0,
              firstTryCorrect: false,
              correctAt: null,
              completedAt: null,
              xpAwarded: 0,
            },
          }),
        );
      }
      if (url.includes('/content/tracks')) {
        return Promise.resolve(json({ tracks: [REAL_TRACK], page: 1, totalPages: 1, totalTracks: 1 }));
      }
      if (url.includes('/library')) {
        return Promise.resolve(json({ entries }));
      }

      return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
    };
  }

  it('shows the promise beat to a signed-in reader with an empty Library and no flag', async () => {
    const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

    await waitFor(() => {
      expect(view.getByTestId('onboarding-promise-screen')).toBeOnTheScreen();
    });
  });

  it('shows only the narrator beat to a signed-in reader with a non-empty Library and no flag', async () => {
    // The Library check `useIntroSeen`'s own gate never needed — mutation check:
    // swap the branch and this is the test (alongside the one above) that reds.
    const view = await renderApp({
      refreshToken: 'stored',
      fetchFn: onboardingBackend([LIBRARY_ENTRY]),
    });

    await waitFor(() => {
      expect(view.getByTestId('onboarding-narrator-screen')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('onboarding-promise-screen')).toBeNull();
  });

  it('goes straight to Explore when the flag is already set, even with an empty Library', async () => {
    // The flag wins outright, regardless of what the Library check would have said.
    await setOnboardingSeen();

    const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('onboarding-promise-screen')).toBeNull();
  });

  it('sets the flag and lands on Explore when the promise beat is skipped', async () => {
    const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

    await waitFor(() => {
      expect(view.getByTestId('onboarding-promise-skip')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByTestId('onboarding-promise-skip'));

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
    // Explore's first-run state (ONBOARD-1's skip ruling) — an empty Library, however
    // it got that way, lands on the same designed state, never a blank catalogue.
    expect(view.getByTestId('explore-first-run')).toBeOnTheScreen();
    await expect(getOnboardingSeen()).resolves.toBe(true);
  });

  it('walks a new reader through all three beats into Leaf 1, not the catalogue', async () => {
    const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

    await waitFor(() => {
      expect(view.getByTestId('onboarding-promise-screen')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByTestId('onboarding-promise-continue'));

    await waitFor(() => {
      expect(view.getByTestId(`onboarding-pickbook-${REAL_TRACK.id}-choose`)).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByTestId(`onboarding-pickbook-${REAL_TRACK.id}-choose`));

    await waitFor(() => {
      expect(view.getByTestId('onboarding-narrator-continue')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByTestId('onboarding-narrator-continue'));

    // The server-computed resume target (`nextLeafId: 'l1'` on the freshly-added
    // Track), not `listLeaves(trackId)[0]` — see `OnboardingNarratorScreen`'s own
    // comment on `finish`.
    await waitFor(() => {
      expect(view.getByTestId('leaf-player')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('explore-screen')).toBeNull();
    await expect(getOnboardingSeen()).resolves.toBe(true);
  });

  it('lands an existing reader on Tabs, not the player, after choosing a narrator', async () => {
    const view = await renderApp({
      refreshToken: 'stored',
      fetchFn: onboardingBackend([LIBRARY_ENTRY]),
    });

    await waitFor(() => {
      expect(view.getByTestId('onboarding-narrator-continue')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
    await expect(getOnboardingSeen()).resolves.toBe(true);
  });
});
