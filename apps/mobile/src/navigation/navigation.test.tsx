import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../api/tokenStore';
import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider, type ThemeMode } from '../design';
import { INTRO_HANDOFF_MS } from '../screens/intro/introBeats';
import { setIntroSeen } from '../screens/intro/introSeenStore';
import { getOnboardingSeen, setOnboardingSeen } from '../screens/onboarding/onboardingSeenStore';
import { CLOSING_COPY } from '../screens/share/WrapUpScreen';
import { fakeAudioPlayers, resetFakeAudio } from '../testing/fakeExpoAudio';
import {
  COMPLETION,
  CORRECT_ANSWER,
  FIRST_LEAF,
  finishTheLeaf,
  SESSION_SUMMARY,
} from '../testing/firstLeaf';
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
 * Every test in this file except the `Pre-intro` and `Onboarding` blocks below exercises
 * auth branching, not either gate. `RootNavigator` checks a per-install flag before it
 * will render `AuthStack` (INTRO-1's, and the pre-intro's since ONBOARD-3 — the same
 * SecureStore key), and ONBOARD-1 added a second — a signed-in reader whose Library is
 * empty and whose onboarding flag is unset lands on the first onboarding route, not
 * `Tabs`. Without both flags set here, every "signed in" test in this file would land
 * on an onboarding beat instead of `explore-screen`, since `signedInBackend` below stubs
 * `/library` as empty. Defaulting to "already seen" on both keeps those tests testing
 * what they have always tested; the `Pre-intro` and `Onboarding` blocks each clear their
 * own flag.
 */
beforeEach(async () => {
  (SecureStore as ResettableSecureStore).__reset();
  resetFakeAudio();
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

describe('Pre-intro', () => {
  // Undoes the file's own default (see the top-level `beforeEach`): these tests are
  // about the flag itself, so they start from "not seen", same as a fresh install.
  beforeEach(() => {
    (SecureStore as ResettableSecureStore).__reset();
  });

  it('shows the pre-intro ahead of the auth stack on an install that has not seen it', async () => {
    const view = await renderApp({ refreshToken: null, fetchFn: signedOutBackend });

    await waitFor(() => {
      expect(view.getByTestId('pre-intro-screen')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('sign-in-screen')).toBeNull();
    // INTRO-1 left the pre-auth branch: a reader with no account sees a still frame, and
    // the animation waits until there is an account to welcome.
    expect(view.queryByTestId('intro-screen')).toBeNull();
  });

  it('sets the existing introSeen flag and lands on sign-in when tapped', async () => {
    const view = await renderApp({ refreshToken: null, fetchFn: signedOutBackend });

    await waitFor(() => {
      expect(view.getByTestId('pre-intro-screen')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByTestId('pre-intro-screen'));

    await waitFor(() => {
      expect(view.getByTestId('sign-in-screen')).toBeOnTheScreen();
    });
    // The literal key, read straight from the store: "the same key `useIntroSeen` reads,
    // not a new one". A pre-intro that gated itself on a fresh key would still pass every
    // assertion above, and an install that had already seen the old intro would see it.
    await expect(SecureStore.getItemAsync('zoomout.introSeen')).resolves.toBe('true');
  });

  it('never mounts the pre-intro, and goes straight to sign-in, when the flag is already set', async () => {
    await setIntroSeen();

    const view = await renderApp({ refreshToken: null, fetchFn: signedOutBackend });

    await waitFor(() => {
      expect(view.getByTestId('sign-in-screen')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('pre-intro-screen')).toBeNull();
  });

  it('never shows it to a signed-in reader, whatever the flag says', async () => {
    // The gate sits inside the "not signed in" branch, so an existing reader upgrading
    // onto this build never meets it in front of their library.
    await setOnboardingSeen();

    const view = await renderApp({ refreshToken: 'stored', fetchFn: signedInBackend });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('pre-intro-screen')).toBeNull();
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

  const LIBRARY_ENTRY = {
    track: REAL_TRACK,
    addedAt: '2026-09-01T00:00:00.000Z',
    status: 'active',
    progress: { trackId: 't1', totalLeaves: 1, completedLeaves: 0, nextLeafId: 'l1', isComplete: false },
  };

  const FEMALE_HELLO = 'https://cdn.test/api/media/file/narrator-greeting-female.mp3';
  const MALE_HELLO = 'https://cdn.test/api/media/file/narrator-greeting-male.mp3';

  const workingHellos = (): Response => json({ female: { url: FEMALE_HELLO }, male: { url: MALE_HELLO } });

  /** An old backend that has never heard of the route — the version-skew the beat must survive. */
  const oldBackendHellos = (): Response =>
    json({ error: { code: 'NOT_FOUND', message: 'no such route' } }, 404);

  /**
   * A signed-in backend with one real Track and everything the flow touches — the
   * greetings, pick-book, the first Leaf all the way to completion, and the wrap-up — so
   * the full-flow tests below can walk end to end without a dozen separate stubs.
   * `initialLibraryEntries` is the one thing that varies per test — empty for a new
   * reader, non-empty for an existing one.
   *
   * **Stateful, not a fixed stub** — `/library/tracks/t1` (`addToLibrary`) appends to
   * the same `entries` array a later `/library` (`listLibrary`) read returns. Pick-book's
   * resume lookup depends on seeing what it just added; a static stub would silently
   * send it down the same "could not find the entry" fallback path a real failure does.
   * That state also outlives a re-render, which is what lets a test "force-quit" and
   * reopen against the same account.
   *
   * `narrator-samples` answers with two URLs and **no Track serves any narration** — the
   * beat must work without one.
   */
  function onboardingBackend(
    initialLibraryEntries: unknown[],
    /** How `/content/narrator-samples` answers. Working hellos unless a test says otherwise. */
    hellos: () => Response = workingHellos,
  ): typeof fetch {
    const entries = [...initialLibraryEntries];

    return (input) => {
      const url = urlOf(input);

      if (url.includes('/auth/refresh')) return Promise.resolve(json(SESSION));
      if (url.includes('/users/me')) return Promise.resolve(json(PROFILE));
      if (url.includes('/library/tracks/')) {
        entries.push(LIBRARY_ENTRY);
        return Promise.resolve(json({ unlocked: [] }));
      }
      if (url.includes('/content/narrator-samples')) return Promise.resolve(hellos());
      if (url.includes('/content/tracks/t1/leaves')) {
        return Promise.resolve(json({ leaves: [LEAF_SUMMARY] }));
      }
      if (url.includes('/content/leaves/l1')) return Promise.resolve(json(FIRST_LEAF));
      if (url.includes('/progress/leaves/l1/start')) {
        return Promise.resolve(json({ progress: COMPLETION.progress }));
      }
      if (url.includes('/progress/leaves/l1/answer')) return Promise.resolve(json(CORRECT_ANSWER));
      if (url.includes('/progress/leaves/l1/complete')) return Promise.resolve(json(COMPLETION));
      if (url.includes('/progress/summary')) return Promise.resolve(json(SESSION_SUMMARY));
      if (url.includes('/content/tracks')) {
        return Promise.resolve(json({ tracks: [REAL_TRACK], page: 1, totalPages: 1, totalTracks: 1 }));
      }
      if (url.includes('/library')) {
        return Promise.resolve(json({ entries }));
      }

      return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
    };
  }

  type View = Awaited<ReturnType<typeof renderApp>>;

  /** Taps Skip on INTRO-1 — the way through it that needs no timers. */
  async function skipIntro(view: View): Promise<void> {
    await waitFor(() => {
      expect(view.getByTestId('intro-skip')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByTestId('intro-skip'));
  }

  /** From the promise to the pick-book beat, choosing the default narrator. */
  async function throughPromiseAndNarrator(view: View): Promise<void> {
    await waitFor(() => {
      expect(view.getByTestId('onboarding-promise-continue')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByTestId('onboarding-promise-continue'));

    await waitFor(() => {
      expect(view.getByTestId('onboarding-narrator-continue')).toBeOnTheScreen();
    });
    await fireEvent.press(view.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(view.getByTestId(`onboarding-pickbook-${REAL_TRACK.id}-choose`)).toBeOnTheScreen();
    });
  }

  describe('INTRO-1, now inside the flow', () => {
    it('plays first for a new account (full), right after sign-in', async () => {
      const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

      await waitFor(() => {
        expect(view.getByTestId('intro-screen')).toBeOnTheScreen();
      });
      expect(view.queryByTestId('onboarding-promise-screen')).toBeNull();
    });

    it('never plays for an existing account (narratorOnly)', async () => {
      const view = await renderApp({
        refreshToken: 'stored',
        fetchFn: onboardingBackend([LIBRARY_ENTRY]),
      });

      await waitFor(() => {
        expect(view.getByTestId('onboarding-narrator-screen')).toBeOnTheScreen();
      });
      expect(view.queryByTestId('intro-screen')).toBeNull();
      expect(view.queryByTestId('onboarding-promise-screen')).toBeNull();
    });

    it('never plays for a reader whose onboarding is already seen', async () => {
      await setOnboardingSeen();

      const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

      await waitFor(() => {
        expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
      });
      expect(view.queryByTestId('intro-screen')).toBeNull();
    });

    it('advances to the promise on Skip, and does not mark onboarding seen', async () => {
      // Skipping an animation is not skipping onboarding.
      const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

      await skipIntro(view);

      await waitFor(() => {
        expect(view.getByTestId('onboarding-promise-screen')).toBeOnTheScreen();
      });
      await expect(getOnboardingSeen()).resolves.toBe(false);
    });

    it('advances to the promise on Get started too, and does not mark onboarding seen', async () => {
      // Fake timers must be live before mount: the hand-off timer is scheduled the
      // instant `IntroScreen`'s effect first runs.
      jest.useFakeTimers();
      const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

      await waitFor(() => {
        expect(view.getByTestId('intro-screen')).toBeOnTheScreen();
      });

      await act(async () => {
        jest.advanceTimersByTime(INTRO_HANDOFF_MS);
        await Promise.resolve();
        await Promise.resolve();
      });

      await fireEvent.press(view.getByTestId('intro-continue'));
      jest.useRealTimers();

      await waitFor(() => {
        expect(view.getByTestId('onboarding-promise-screen')).toBeOnTheScreen();
      });
      await expect(getOnboardingSeen()).resolves.toBe(false);
    });
  });

  it('shows only the narrator beat to a signed-in reader with a non-empty Library and no flag', async () => {
    // The Library check `useIntroSeen`'s own gate never needed — mutation check:
    // swap the branch and this is the test (alongside the INTRO-1 one above) that reds.
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

  describe('the full order, for a new account', () => {
    it('walks INTRO-1 → promise → narrator → pick-book → Leaf 1, and is not yet seen when it gets there', async () => {
      const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

      // One test for the whole order, through the real gate — not the screens in isolation.
      await skipIntro(view);

      await waitFor(() => {
        expect(view.getByTestId('onboarding-promise-screen')).toBeOnTheScreen();
      });
      await fireEvent.press(view.getByTestId('onboarding-promise-continue'));

      await waitFor(() => {
        expect(view.getByTestId('onboarding-narrator-screen')).toBeOnTheScreen();
      });
      expect(view.queryByTestId('onboarding-pickbook-screen')).toBeNull();
      await fireEvent.press(view.getByTestId('onboarding-narrator-continue'));

      // Continuing past the narrator does NOT end the onboarding of a new account — that
      // is the change from ONBOARD-1, where this was the moment it was marked seen.
      await waitFor(() => {
        expect(view.getByTestId('onboarding-pickbook-screen')).toBeOnTheScreen();
      });
      await expect(getOnboardingSeen()).resolves.toBe(false);

      await fireEvent.press(view.getByTestId(`onboarding-pickbook-${REAL_TRACK.id}-choose`));

      // The server-computed resume target (`nextLeafId: 'l1'` on the freshly-added
      // Track), not `listLeaves(trackId)[0]`.
      await waitFor(() => {
        expect(view.getByTestId('leaf-player')).toBeOnTheScreen();
      });
      // Explore is *underneath* the player — mounted and covered, not absent and not still
      // loading. Pick-book resets into `[Tabs, LeafPlayer]`, so the shell is there; waiting
      // for Explore's own list to have rendered (hidden elements included) is what makes
      // "not showing" mean "covered by the Leaf". The bare `queryByTestId('explore-screen')`
      // check this sits beside was just as true of a reset that left `Tabs` out, or of an
      // Explore that had not rendered yet, and so could not tell those from the real thing.
      await waitFor(() => {
        expect(view.getByTestId('explore-list', { includeHiddenElements: true })).toBeTruthy();
      });
      expect(view.queryByTestId('explore-screen')).toBeNull();

      // Read from the store after the reset, not inferred from the route: the seen flag
      // is *still unset* with the reader inside their first Leaf.
      await expect(getOnboardingSeen()).resolves.toBe(false);
    });

    it('ends at the closing: finishing the Leaf and tapping Done shows the welcome and marks seen', async () => {
      const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

      await skipIntro(view);
      await throughPromiseAndNarrator(view);
      await fireEvent.press(view.getByTestId(`onboarding-pickbook-${REAL_TRACK.id}-choose`));
      await finishTheLeaf();
      await expect(getOnboardingSeen()).resolves.toBe(false);

      await fireEvent.press(view.getByTestId('leaf-done'));

      await waitFor(() => {
        expect(view.getByTestId('wrap-up-headline')).toHaveTextContent(CLOSING_COPY.headline);
      });
      await waitFor(async () => {
        await expect(getOnboardingSeen()).resolves.toBe(true);
      });

      // Its own Done lands on the tabs.
      await fireEvent.press(view.getByTestId('wrap-up-exit'));
      await waitFor(() => {
        expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
      });
    });

    it('shows none of it again after the reader force-quits and reopens', async () => {
      const fetchFn = onboardingBackend([]);
      const first = await renderApp({ refreshToken: 'stored', fetchFn });

      await skipIntro(first);
      await throughPromiseAndNarrator(first);
      await fireEvent.press(first.getByTestId(`onboarding-pickbook-${REAL_TRACK.id}-choose`));
      await finishTheLeaf();
      await fireEvent.press(first.getByTestId('leaf-done'));
      await waitFor(() => {
        expect(first.getByTestId('wrap-up-headline')).toBeOnTheScreen();
      });
      await waitFor(async () => {
        await expect(getOnboardingSeen()).resolves.toBe(true);
      });

      await cleanup();
      const reopened = await renderApp({ refreshToken: 'stored', fetchFn });

      await waitFor(() => {
        expect(reopened.getByTestId('explore-screen')).toBeOnTheScreen();
      });
      expect(reopened.queryByTestId('intro-screen')).toBeNull();
      expect(reopened.queryByTestId('onboarding-promise-screen')).toBeNull();
      expect(reopened.queryByTestId('onboarding-narrator-screen')).toBeNull();
    });
  });

  describe('the narrator beat, per variant (Tier A)', () => {
    it('narratorOnly: Continue marks seen and lands on Explore, not the player', async () => {
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

    it('does not show an existing account the narrator beat again once it has continued', async () => {
      // The bug this package is most likely to ship: an existing account whose seen flag
      // is never written meets the narrator beat on every launch.
      const fetchFn = onboardingBackend([LIBRARY_ENTRY]);
      const first = await renderApp({ refreshToken: 'stored', fetchFn });

      await waitFor(() => {
        expect(first.getByTestId('onboarding-narrator-continue')).toBeOnTheScreen();
      });
      await fireEvent.press(first.getByTestId('onboarding-narrator-continue'));
      await waitFor(() => {
        expect(first.getByTestId('explore-screen')).toBeOnTheScreen();
      });

      await cleanup();
      const reopened = await renderApp({ refreshToken: 'stored', fetchFn });

      await waitFor(() => {
        expect(reopened.getByTestId('explore-screen')).toBeOnTheScreen();
      });
      expect(reopened.queryByTestId('onboarding-narrator-screen')).toBeNull();
    });
  });

  describe('the narrator beat when the hellos cannot load (Tier A)', () => {
    // The onboarding gate fails open (`useOnboardingGate`), and this beat used to be the one
    // place that did not: a failed hellos fetch showed an error screen with Retry and no way
    // onward. The backend answering 404 is the realistic cause — an old backend that has never
    // heard of `/content/narrator-samples` — which makes backend-before-mobile a hard deploy
    // order, so that is the failure used here. Every other kind is pinned on the screen itself.

    it('narratorOnly: the beat still appears, and Continue marks seen and lands on Explore', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const view = await renderApp({
        refreshToken: 'stored',
        fetchFn: onboardingBackend([LIBRARY_ENTRY], oldBackendHellos),
      });

      await waitFor(() => {
        expect(view.getByTestId('onboarding-narrator-hellos-notice')).toBeOnTheScreen();
      });
      await fireEvent.press(view.getByTestId('onboarding-narrator-continue'));

      await waitFor(() => {
        expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
      });
      await expect(getOnboardingSeen()).resolves.toBe(true);

      warn.mockRestore();
    });

    it('full: the beat still appears, and Continue goes on to pick-book without marking seen', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const view = await renderApp({
        refreshToken: 'stored',
        fetchFn: onboardingBackend([], oldBackendHellos),
      });

      await skipIntro(view);
      await waitFor(() => {
        expect(view.getByTestId('onboarding-promise-continue')).toBeOnTheScreen();
      });
      await fireEvent.press(view.getByTestId('onboarding-promise-continue'));

      await waitFor(() => {
        expect(view.getByTestId('onboarding-narrator-hellos-notice')).toBeOnTheScreen();
      });
      await fireEvent.press(view.getByTestId('onboarding-narrator-continue'));

      await waitFor(() => {
        expect(view.getByTestId('onboarding-pickbook-screen')).toBeOnTheScreen();
      });
      await expect(getOnboardingSeen()).resolves.toBe(false);

      warn.mockRestore();
    });

    it('full: a clip still playing when Continue is tapped does not carry on over pick-book', async () => {
      // The same rule as on the screen's own tests, through the real `AppStack`: in `full`
      // Continue *pushes* pick-book, so the beat stays mounted underneath it.
      const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

      await skipIntro(view);
      await waitFor(() => {
        expect(view.getByTestId('onboarding-promise-continue')).toBeOnTheScreen();
      });
      await fireEvent.press(view.getByTestId('onboarding-promise-continue'));

      await waitFor(() => {
        expect(view.getByTestId('onboarding-narrator-female')).toBeOnTheScreen();
      });
      await fireEvent.press(view.getByTestId('onboarding-narrator-female'));
      const clip = fakeAudioPlayers().find((player) => player.source === FEMALE_HELLO);
      await waitFor(() => {
        expect(clip?.playing).toBe(true);
      });

      await fireEvent.press(view.getByTestId('onboarding-narrator-continue'));

      await waitFor(() => {
        expect(view.getByTestId('onboarding-pickbook-screen')).toBeOnTheScreen();
      });
      expect(clip?.playing).toBe(false);
    });
  });

  describe('a reader who quits mid-first-Leaf', () => {
    it('meets the narrator beat once more on the next launch, is marked seen at Continue, and never sees the closing', async () => {
      // Their book is already in the Library, so the gate resolves `narratorOnly` — an
      // accepted consequence of having no "onboarding in progress" state (see the table
      // in `useOnboardingGate`), and this pins it so it stays the behaviour rather than
      // becoming a surprise.
      const fetchFn = onboardingBackend([]);
      const first = await renderApp({ refreshToken: 'stored', fetchFn });

      await skipIntro(first);
      await throughPromiseAndNarrator(first);
      await fireEvent.press(first.getByTestId(`onboarding-pickbook-${REAL_TRACK.id}-choose`));
      await waitFor(() => {
        expect(first.getByTestId('leaf-player')).toBeOnTheScreen();
      });
      await expect(getOnboardingSeen()).resolves.toBe(false);

      // Force-quit mid-Leaf.
      await cleanup();
      const reopened = await renderApp({ refreshToken: 'stored', fetchFn });

      await waitFor(() => {
        expect(reopened.getByTestId('onboarding-narrator-screen')).toBeOnTheScreen();
      });
      expect(reopened.queryByTestId('intro-screen')).toBeNull();
      expect(reopened.queryByTestId('onboarding-promise-screen')).toBeNull();
      await expect(getOnboardingSeen()).resolves.toBe(false);

      await fireEvent.press(reopened.getByTestId('onboarding-narrator-continue'));

      await waitFor(() => {
        expect(reopened.getByTestId('explore-screen')).toBeOnTheScreen();
      });
      await expect(getOnboardingSeen()).resolves.toBe(true);
      expect(reopened.queryByTestId('wrap-up-screen')).toBeNull();
    });
  });

  describe('skipping', () => {
    it('on the promise: marks seen immediately and lands on Explore’s first-run state', async () => {
      const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

      await skipIntro(view);
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
      // ONBOARD-3.1: it must not frame a book as "about fifteen minutes" (the founder's
      // objection to beat 1) — a book is read over many sessions. The claim, not the words.
      expect(view.getByTestId('explore-first-run')).not.toHaveTextContent(/fifteen minutes/iu);
      await expect(getOnboardingSeen()).resolves.toBe(true);
    });

    it('on pick-book: marks seen immediately and lands on Explore’s first-run state', async () => {
      // ONBOARD-1 never tested this skip — a handler identical to the promise's, which
      // was. It goes through the real gate here.
      const view = await renderApp({ refreshToken: 'stored', fetchFn: onboardingBackend([]) });

      await skipIntro(view);
      await throughPromiseAndNarrator(view);
      await expect(getOnboardingSeen()).resolves.toBe(false);

      await fireEvent.press(view.getByTestId('onboarding-pickbook-skip'));

      await waitFor(() => {
        expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
      });
      expect(view.getByTestId('explore-first-run')).toBeOnTheScreen();
      await expect(getOnboardingSeen()).resolves.toBe(true);
    });
  });
});

describe('Profile’s narrator hellos, through the real tabs (ONBOARD-3.1)', () => {
  const FEMALE_HELLO = 'https://cdn.test/api/media/file/narrator-greeting-female.mp3';
  const MALE_HELLO = 'https://cdn.test/api/media/file/narrator-greeting-male.mp3';

  /** A signed-in shell whose narrator hellos work, recording every request it is asked. */
  function shellWithHellos(requested: string[]): typeof fetch {
    return (input, init) => {
      const url = urlOf(input);
      requested.push(url);

      if (url.includes('/content/narrator-samples')) {
        return Promise.resolve(json({ female: { url: FEMALE_HELLO }, male: { url: MALE_HELLO } }));
      }

      return signedInBackend(input, init);
    };
  }

  /**
   * Presses a tab by its label. `getByText` alone is ambiguous once Profile has mounted (its
   * own header says "Profile" too), so this takes the label that sits in the tab bar: the
   * one whose ancestors include a pressable that is not part of a screen.
   */
  async function pressTab(view: Awaited<ReturnType<typeof renderApp>>, label: string): Promise<void> {
    const candidates = view.getAllByText(label);
    // The tab bar renders after the screens, so its label is the last match.
    const tab = candidates[candidates.length - 1];
    if (tab === undefined) {
      throw new Error(`no "${label}" tab label on screen`);
    }
    await fireEvent.press(tab);
  }

  it('stops a playing hello when the reader switches tab, and fetches the hellos once, not on every focus', async () => {
    // Both halves are properties of the tab navigator, which no screen test can see: a bare
    // `ProfileScreen` has no focus to lose, and mounts exactly once whatever the code does.
    const requested: string[] = [];
    const view = await renderApp({ refreshToken: 'stored', fetchFn: shellWithHellos(requested) });

    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
    await pressTab(view, 'Profile');
    await waitFor(() => {
      expect(view.getByTestId('narrator-option-female')).toBeOnTheScreen();
    });
    await waitFor(() => {
      expect(
        view.queryByTestId('narrator-option-female-glyph', { includeHiddenElements: true }),
      ).not.toBeNull();
    });

    await fireEvent.press(view.getByTestId('narrator-option-female'));
    const clip = fakeAudioPlayers().find((player) => player.source === FEMALE_HELLO);
    await waitFor(() => {
      expect(clip?.playing).toBe(true);
    });

    await pressTab(view, 'Explore');
    await waitFor(() => {
      expect(view.getByTestId('explore-screen')).toBeOnTheScreen();
    });
    expect(clip?.playing).toBe(false);
    // …and switching away started nothing: the other voice was never touched.
    expect(fakeAudioPlayers().find((player) => player.source === MALE_HELLO)?.play).not.toHaveBeenCalled();

    // Back to Profile: the tab was kept mounted and refocused, and nothing refetched.
    await pressTab(view, 'Profile');
    await waitFor(() => {
      expect(view.getByTestId('narrator-option-female')).toBeOnTheScreen();
    });
    expect(requested.filter((url) => url.includes('/content/narrator-samples'))).toHaveLength(1);
  });
});
