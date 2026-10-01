import { act, cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../../api/tokenStore';
import { AuthProvider } from '../../auth/AuthProvider';
import { ThemeProvider } from '../../design';
import { OnboardingPickBookScreen } from './OnboardingPickBookScreen';

/**
 * Pick-book, Tier B — with its **markSeen** rows Tier A. It now ends the flow's setup: it
 * adds the chosen book, works out the first Leaf and resets into the player carrying
 * `onboarding: true` (ONBOARD-3), and it deliberately does **not** mark onboarding seen
 * when it does — that waits for the first Leaf's close.
 *
 * Also the one decision the handoff asked to be proven rather than only described — the
 * achievement banner is suppressed here, unlike Explore's identical `addToLibrary` call.
 *
 * **`navigation` is a mock, not a real stack.** A real `Stack.Navigator` transition
 * unmounts this screen once `navigate` is called, which is before `act` yields back to
 * these assertions — the first version of this file learned that the hard way: a
 * mutation that re-added the achievement banner passed every test here, because the
 * banner's own screen had already been torn down by the time anything checked for it.
 * Mocking `navigation.reset` keeps the screen mounted, which is what actually lets
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

/** A second real book: the "other card" a reader could tap while the first is being added. */
const SECOND_REAL_TRACK = {
  ...REAL_TRACK,
  id: 't3',
  bookTitle: 'A Second Real Book',
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

const LIBRARY_ENTRY = {
  track: REAL_TRACK,
  addedAt: '2026-09-01T00:00:00.000Z',
  status: 'active',
  progress: { trackId: 't1', totalLeaves: 3, completedLeaves: 0, nextLeafId: 'l-resume', isComplete: false },
};

/** A response the test holds in flight and opens by hand. */
interface Gate {
  readonly opened: Promise<void>;
  readonly open: () => void;
}

function gate(): Gate {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { opened, open };
}

interface BackendOptions {
  readonly unlocked?: unknown[];
  readonly library?: () => Response;
  /** Holds `addToLibrary`'s response until the test opens it. */
  readonly addGate?: Gate;
  /** Holds the Library lookup's response (the second round trip) until the test opens it. */
  readonly lookupGate?: Gate;
  /** Every `addToLibrary` request, in order — the count of books actually added. */
  readonly added?: string[];
  /** Every Library lookup request, in order. */
  readonly lookups?: string[];
  /** Makes `addToLibrary` answer 500. */
  readonly addFails?: boolean;
}

/**
 * `library` is what `listLibrary` answers *after* the add — a fixed stub is enough,
 * because what is under test is what the screen does with the answer, not that the
 * server appended to it (the stateful version lives in `navigation.test.tsx`).
 *
 * **The gates are how a test stands *inside* the two round trips** — the window the race
 * lives in (`addToLibrary`, then `listLibrary`). Without them every request answers before
 * the test can press anything else.
 */
function backend(tracks: unknown[], options: BackendOptions = {}): typeof fetch {
  const unlocked = options.unlocked ?? [];
  const library = options.library ?? ((): Response => json({ entries: [LIBRARY_ENTRY] }));

  return (input) => {
    const url = urlOf(input);

    if (url.includes('/auth/refresh')) {
      return Promise.resolve(
        json({ userId: PROFILE.id, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, tokenType: 'Bearer' }),
      );
    }
    if (url.includes('/users/me')) return Promise.resolve(json(PROFILE));
    if (url.includes('/library/tracks/')) {
      options.added?.push(url);

      return (options.addGate?.opened ?? Promise.resolve()).then(() =>
        options.addFails === true
          ? json({ error: { code: 'INTERNAL', message: 'boom' } }, 500)
          : json({ unlocked }),
      );
    }
    if (url.includes('/library')) {
      options.lookups?.push(url);

      return (options.lookupGate?.opened ?? Promise.resolve()).then(() => library());
    }
    // A *different* first Leaf from the one the Library reports as next: a screen that
    // resumed from `listLeaves(trackId)[0]` instead of `progress.nextLeafId` would open
    // 'l-first' here and be caught.
    if (url.includes('/content/tracks/t1/leaves')) {
      return Promise.resolve(
        json({ leaves: [{ id: 'l-first', trackId: 't1', orderIndex: 0, title: 'First', isPlaceholder: false }] }),
      );
    }
    if (url.includes('/content/tracks')) {
      return Promise.resolve(json({ tracks, page: 1, totalPages: 1, totalTracks: tracks.length }));
    }

    return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
  };
}

async function renderPickBook(
  fetchFn: typeof fetch,
): Promise<{
  readonly reset: jest.Mock;
  readonly markSeen: jest.Mock;
  readonly view: ReturnType<typeof render> extends Promise<infer R> ? R : never;
}> {
  const reset = jest.fn();
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
      // Only what this screen actually reads — `reset` — rather than a full
      // `NativeStackNavigationProp`, which would need many more methods stubbed for no
      // test here to ever call.
      navigation={{ reset } as never}
      route={{ key: 'OnboardingPickBook', name: 'OnboardingPickBook' } as never}
      markSeen={markSeen}
    />,
    { wrapper },
  );

  return { reset, markSeen, view };
}

describe('OnboardingPickBookScreen', () => {
  it('shows only the real Track, not the placeholder, even though the placeholder sorts first', async () => {
    await renderPickBook(backend([PLACEHOLDER_TRACK, REAL_TRACK]));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-pickbook-t1-choose')).toBeTruthy();
    });
    expect(screen.queryByTestId('onboarding-pickbook-t2-choose')).toBeNull();
  });

  it('adds the chosen book and resets into the player at the server’s resume target, flagged as onboarding', async () => {
    const user = userEvent.setup();
    const { reset } = await renderPickBook(backend([REAL_TRACK]));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-pickbook-t1-choose')).toBeTruthy();
    });
    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));

    // `progress.nextLeafId` ('l-resume'), never `listLeaves(...)[0]` ('l-first'); the
    // exact reset, so a wrong index, a missing Tabs underneath or a dropped
    // `onboarding: true` each fail here.
    await waitFor(() => {
      expect(reset).toHaveBeenCalledWith({
        index: 1,
        routes: [
          { name: 'Tabs' },
          {
            name: 'LeafPlayer',
            params: { leafId: 'l-resume', trackId: 't1', trackTitle: REAL_TRACK.bookTitle, onboarding: true },
          },
        ],
      });
    });
  });

  it('does not mark onboarding seen when it hands the reader to their first Leaf', async () => {
    // Tier A. The reader is about to read their first Leaf, not finished; onboarding ends
    // when that Leaf's close appears. ONBOARD-1 marked seen at the equivalent moment.
    const user = userEvent.setup();
    const { reset, markSeen } = await renderPickBook(backend([REAL_TRACK]));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-pickbook-t1-choose')).toBeTruthy();
    });
    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));

    await waitFor(() => {
      expect(reset).toHaveBeenCalled();
    });
    expect(markSeen).not.toHaveBeenCalled();
  });

  it.each([
    ['the Library lookup fails', () => json({ error: { code: 'INTERNAL', message: 'boom' } }, 500), true],
    [
      'the book has no next Leaf to open',
      () =>
        json({
          entries: [{ ...LIBRARY_ENTRY, progress: { ...LIBRARY_ENTRY.progress, nextLeafId: null } }],
        }),
      false,
    ],
  ])('lands on Tabs and marks seen when %s', async (_name, library, logsAWarning) => {
    // Tier A. There is no first Leaf to carry this reader into, so nothing later will
    // close their onboarding; leaving the flag unset would send them back to the narrator
    // beat on the next launch (the Library is no longer empty). The flow is over for them.
    //
    // A failed lookup is logged, not swallowed — and asserting it is also what keeps this
    // test's output clean of the real warning.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const { reset, markSeen } = await renderPickBook(backend([REAL_TRACK], { library }));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-pickbook-t1-choose')).toBeTruthy();
    });
    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));

    await waitFor(() => {
      expect(reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs' }] });
    });
    expect(markSeen).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(logsAWarning ? 1 : 0);

    warn.mockRestore();
  });

  it('does not show the achievement banner after earning first-book here', async () => {
    // ONBOARD-1 finding 3's decision, proven rather than only described: `addToLibrary`
    // returns `first-book` from this fixture's own stub, the same response shape
    // Explore's banner reads — and this screen must not render it. Mutation-checked:
    // rendering `<AchievementUnlock achievements={unlocked} />` here left every other
    // test in this file green; only this assertion caught it.
    const user = userEvent.setup();
    const { reset } = await renderPickBook(backend([REAL_TRACK], { unlocked: UNLOCKED_FIRST_BOOK }));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-pickbook-t1-choose')).toBeTruthy();
    });
    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));

    // Waits for `choose` to have actually finished (reached `reset`, its last statement)
    // rather than for the button's own `busy` state, which flips true synchronously on
    // press and so proves nothing about whether the fetch resolved.
    await waitFor(() => {
      expect(reset).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('achievement-unlock')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* One in-flight guard for the whole screen (ONBOARD-3.1)                       */
/* -------------------------------------------------------------------------- */

const LEAF_RESET = {
  index: 1,
  routes: [
    { name: 'Tabs' },
    {
      name: 'LeafPlayer',
      params: { leafId: 'l-resume', trackId: 't1', trackTitle: REAL_TRACK.bookTitle, onboarding: true },
    },
  ],
};

async function untilBooksShown(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('onboarding-pickbook-t1-choose')).toBeTruthy();
  });
}

/**
 * Lets everything already in flight land, for an assertion that *nothing further*
 * happened. A negative assertion has no event to wait for, so this is a short real wait —
 * long enough for every promise chain here (a stubbed fetch and its body read) to finish.
 */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  });
}

describe('OnboardingPickBookScreen — one guard across the whole screen (Tier A)', () => {
  // `busy` used to disable only the pressed card, so Skip and the other card stayed live
  // across the two round trips (`addToLibrary`, then the Library lookup): Choose then Skip
  // landed on Explore with the flag set and a late `reset` then put the reader into the
  // Leaf anyway; two Choose taps added both books. Each of these stands *inside* that
  // window, which is why the backend can hold a response in flight.

  it('makes every card and Skip inert while a book is being added', async () => {
    const user = userEvent.setup();
    const addGate = gate();
    await renderPickBook(backend([REAL_TRACK, SECOND_REAL_TRACK], { addGate }));
    await untilBooksShown();

    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));

    expect(screen.getByTestId('onboarding-pickbook-t1-choose')).toBeDisabled();
    expect(screen.getByTestId('onboarding-pickbook-t3-choose')).toBeDisabled();
    expect(screen.getByTestId('onboarding-pickbook-skip')).toBeDisabled();

    addGate.open();
    await settle();
  });

  it('ignores Skip while a book is being added, and the reader still lands in the first Leaf', async () => {
    const user = userEvent.setup();
    const addGate = gate();
    const { reset, markSeen } = await renderPickBook(backend([REAL_TRACK], { addGate }));
    await untilBooksShown();

    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));
    await user.press(screen.getByTestId('onboarding-pickbook-skip'));

    // Skip did nothing: no flag, no route change — before the add has even finished.
    expect(markSeen).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();

    addGate.open();

    await waitFor(() => {
      expect(reset).toHaveBeenCalledTimes(1);
    });
    expect(reset).toHaveBeenCalledWith(LEAF_RESET);
    expect(markSeen).not.toHaveBeenCalled();
  });

  it('adds exactly one book when a second card is tapped mid-add', async () => {
    const user = userEvent.setup();
    const addGate = gate();
    const added: string[] = [];
    const { reset } = await renderPickBook(
      backend([REAL_TRACK, SECOND_REAL_TRACK], { addGate, added }),
    );
    await untilBooksShown();

    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));
    await user.press(screen.getByTestId('onboarding-pickbook-t3-choose'));
    addGate.open();

    await waitFor(() => {
      expect(reset).toHaveBeenCalledTimes(1);
    });
    expect(added).toHaveLength(1);
    expect(added[0]).toContain('/library/tracks/t1');
    expect(reset).toHaveBeenCalledWith(LEAF_RESET);
  });

  it('adds exactly one book when the same card is tapped twice', async () => {
    const user = userEvent.setup();
    const addGate = gate();
    const added: string[] = [];
    const { reset } = await renderPickBook(backend([REAL_TRACK], { addGate, added }));
    await untilBooksShown();

    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));
    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));
    addGate.open();

    await waitFor(() => {
      expect(reset).toHaveBeenCalledTimes(1);
    });
    expect(added).toHaveLength(1);
  });

  it('does nothing when the reader has left the screen before the add finishes', async () => {
    // Hardware back mid-add: the book is added (the request cannot be recalled), and that
    // is all — no further round trip, no flag, no `reset` yanking them out of wherever
    // they went.
    const user = userEvent.setup();
    const addGate = gate();
    const lookups: string[] = [];
    const { reset, markSeen, view } = await renderPickBook(backend([REAL_TRACK], { addGate, lookups }));
    await untilBooksShown();

    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));
    await view.unmount();
    addGate.open();
    await settle();

    expect(lookups).toEqual([]);
    expect(reset).not.toHaveBeenCalled();
    expect(markSeen).not.toHaveBeenCalled();
  });

  it.each([
    ['finds the first Leaf', undefined],
    [
      'cannot find one (the fallback that marks onboarding seen)',
      () => json({ error: { code: 'INTERNAL', message: 'boom' } }, 500),
    ],
  ])(
    'does nothing when the reader has left the screen before the Library lookup %s',
    async (_name, library) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const user = userEvent.setup();
      const lookupGate = gate();
      const lookups: string[] = [];
      const { reset, markSeen, view } = await renderPickBook(
        backend([REAL_TRACK], { lookupGate, lookups, ...(library === undefined ? {} : { library }) }),
      );
      await untilBooksShown();

      await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));
      await waitFor(() => {
        expect(lookups).toHaveLength(1);
      });
      await view.unmount();
      lookupGate.open();
      await settle();

      expect(reset).not.toHaveBeenCalled();
      expect(markSeen).not.toHaveBeenCalled();

      warn.mockRestore();
    },
  );

  it('lets the reader carry on after a failed add: the screen is live again and the banner says why', async () => {
    // The guard must be released on the one path where nothing is coming to unmount the
    // screen — a screen that stayed inert after a failure would strand the reader.
    const user = userEvent.setup();
    const added: string[] = [];
    const { reset, markSeen } = await renderPickBook(
      backend([REAL_TRACK, SECOND_REAL_TRACK], { addFails: true, added }),
    );
    await untilBooksShown();

    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-pickbook-error-banner')).toBeTruthy();
    });
    expect(screen.getByTestId('onboarding-pickbook-t1-choose')).not.toBeDisabled();
    expect(screen.getByTestId('onboarding-pickbook-t3-choose')).not.toBeDisabled();
    expect(screen.getByTestId('onboarding-pickbook-skip')).not.toBeDisabled();

    // The same book can be tried again, and Skip works.
    await user.press(screen.getByTestId('onboarding-pickbook-t1-choose'));
    await waitFor(() => {
      expect(added).toHaveLength(2);
    });

    await user.press(screen.getByTestId('onboarding-pickbook-skip'));
    expect(markSeen).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs' }] });
  });
});
