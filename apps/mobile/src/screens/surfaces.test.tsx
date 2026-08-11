import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../api/tokenStore';
import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider, type ThemeMode } from '../design';
import { ExploreScreen } from './ExploreScreen';
import { JourneyScreen } from './JourneyScreen';
import { LibraryScreen } from './LibraryScreen';
import { ProfileScreen } from './ProfileScreen';

/**
 * Explore, Library and Journey across every state they have.
 *
 * Four states each — loading, empty, error, populated — because they are separate
 * screens in practice and only one of them is exercised by a happy-path check. The
 * error state carries an acceptance criterion of its own: a 503 must be a readable
 * message with a retry, and the two ways to get that wrong are a blank list and a raw
 * error string.
 *
 * `ProfileScreen` is here too. WP6 shipped it with no render test at all.
 */

const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

afterEach(async () => {
  await cleanup();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
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

const TRACK = {
  id: '1',
  bookTitle: 'The Mountain Is You',
  author: 'Brianna Wiest',
  publisher: 'Thought Catalog Books',
  coverUrl: 'https://example.test/cover.png',
  description: 'A book about self-sabotage.',
  disclaimer: 'ZoomOut is not affiliated with the author or publisher.',
  purchaseLinks: [{ retailer: 'Example Books', url: 'https://example.test/b', isAffiliate: false }],
  status: 'published',
  leafCount: 3,
  isPlaceholder: true,
  createdAt: '2026-08-11T12:00:00.000Z',
  updatedAt: '2026-08-11T12:00:00.000Z',
};

const entry = (progress: {
  totalLeaves: number;
  completedLeaves: number;
  nextLeafId: string | null;
  isComplete: boolean;
}) => ({
  track: TRACK,
  addedAt: '2026-08-11T12:00:00.000Z',
  status: progress.isComplete ? 'completed' : 'active',
  progress: { trackId: TRACK.id, ...progress },
});

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

/** A backend scripted per path. Anything unrouted 404s, which surfaces a missed stub. */
class FakeBackend {
  public readonly calls: string[] = [];
  private readonly routes = new Map<string, () => Response>();

  public on(path: string, handler: () => Response): this {
    this.routes.set(path, handler);
    return this;
  }

  public readonly fetch: typeof fetch = (input) => {
    const url = urlOf(input);
    this.calls.push(url);

    for (const [path, handler] of this.routes) {
      if (url.includes(path)) {
        return Promise.resolve(handler());
      }
    }

    return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
  };
}

/** Signed in before the screen mounts, since every surface here fetches on mount. */
async function renderSignedIn(
  element: ReactElement,
  backend: FakeBackend,
  mode: ThemeMode = 'dark',
): Promise<ReturnType<typeof render> extends Promise<infer R> ? R : never> {
  backend.on('/auth/refresh', () =>
    json({
      userId: PROFILE.id,
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
      tokenType: 'Bearer',
    }),
  );
  backend.on('/users/me', () => json(PROFILE));

  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode={mode}>
        <AuthProvider
          tokenStore={new MemoryTokenStore('stored-refresh')}
          baseUrl="https://api.test"
          fetchFn={backend.fetch}
        >
          {children}
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  const view = await render(element, { wrapper });

  // Let the provider's launch restore settle inside act() before the test body runs.
  await act(async () => {
    await Promise.resolve();
  });

  return view;
}

/** Never resolves, so the screen stays in its loading state for the assertion. */
const neverResolves: typeof fetch = () => new Promise<Response>(() => undefined);

/**
 * Triggers pull-to-refresh.
 *
 * `fireEvent(list, 'refresh')` does not reach the handler — it lives on the
 * `RefreshControl` element passed as a prop, not on the list itself — so the control is
 * reached through the prop and its `onRefresh` invoked directly.
 */
async function pullToRefresh(list: {
  props: { refreshControl?: { props: { onRefresh?: () => void } } };
}): Promise<void> {
  // Typed structurally rather than as `ReactTestInstance`: `react-test-renderer` ships
  // no type declarations, and pulling in `@types/react-test-renderer` for one parameter
  // is a dependency for nothing.
  await act(async () => {
    list.props.refreshControl?.props.onRefresh?.();
    await Promise.resolve();
  });
}

/* -------------------------------------------------------------------------- */
/* Both themes, every screen                                                   */
/* -------------------------------------------------------------------------- */

describe.each(['dark', 'light'] as const)('in the %s theme', (mode) => {
  it('renders Explore', async () => {
    const backend = new FakeBackend()
      .on('/content/tracks', () =>
        json({ tracks: [TRACK], page: 1, totalPages: 1, totalTracks: 1 }),
      )
      .on('/library', () => json({ entries: [] }));

    const view = await renderSignedIn(<ExploreScreen />, backend, mode);

    await waitFor(() => {
      expect(view.getByTestId('explore-list')).toBeOnTheScreen();
    });
  });

  it('renders Library', async () => {
    const backend = new FakeBackend().on('/library', () =>
      json({
        entries: [
          entry({ totalLeaves: 3, completedLeaves: 1, nextLeafId: '11', isComplete: false }),
        ],
      }),
    );

    const view = await renderSignedIn(<LibraryScreen />, backend, mode);

    await waitFor(() => {
      expect(view.getByTestId('library-list')).toBeOnTheScreen();
    });
  });

  it('renders Journey', async () => {
    const backend = new FakeBackend().on('/library', () =>
      json({
        entries: [
          entry({ totalLeaves: 3, completedLeaves: 1, nextLeafId: '11', isComplete: false }),
        ],
      }),
    );

    const view = await renderSignedIn(<JourneyScreen />, backend, mode);

    await waitFor(() => {
      expect(view.getByTestId('journey-list')).toBeOnTheScreen();
    });
  });

  it('renders Profile', async () => {
    // WP6 shipped this screen with no render test. A token that resolves to `undefined`
    // in one theme fails silently in the other, which is the whole reason for the pair.
    const view = await renderSignedIn(<ProfileScreen />, new FakeBackend(), mode);

    await waitFor(() => {
      expect(view.getByTestId('profile-screen')).toBeOnTheScreen();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

describe('while loading', () => {
  it.each([
    ['Explore', <ExploreScreen key="e" />, 'explore-loading'],
    ['Library', <LibraryScreen key="l" />, 'library-loading'],
    ['Journey', <JourneyScreen key="j" />, 'journey-loading'],
  ])('%s shows a spinner rather than an empty state', async (_name, element, testID) => {
    // The distinction that matters: "not loaded yet" must not render as "nothing here".
    // Inferring emptiness from a null list is how a slow network becomes an empty
    // library on screen.
    const backend = new FakeBackend();
    backend.on('/library', () => json({ entries: [] }));

    const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider mode="dark">
          <AuthProvider
            tokenStore={new MemoryTokenStore(null)}
            baseUrl="https://api.test"
            fetchFn={neverResolves}
          >
            {children}
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );

    const view = await render(element, { wrapper });

    expect(view.getByTestId(testID)).toBeOnTheScreen();
  });
});

/* -------------------------------------------------------------------------- */
/* Empty                                                                       */
/* -------------------------------------------------------------------------- */

describe('when there is nothing to show', () => {
  it('Explore offers an empty state', async () => {
    const backend = new FakeBackend()
      .on('/content/tracks', () => json({ tracks: [], page: 1, totalPages: 0, totalTracks: 0 }))
      .on('/library', () => json({ entries: [] }));

    const view = await renderSignedIn(<ExploreScreen />, backend);

    await waitFor(() => {
      expect(view.getByTestId('explore-empty')).toBeOnTheScreen();
    });
  });

  it('Library offers an empty state', async () => {
    const backend = new FakeBackend().on('/library', () => json({ entries: [] }));

    const view = await renderSignedIn(<LibraryScreen />, backend);

    await waitFor(() => {
      expect(view.getByTestId('library-empty')).toBeOnTheScreen();
    });
  });

  it('Journey offers an empty state when the library is empty', async () => {
    const backend = new FakeBackend().on('/library', () => json({ entries: [] }));

    const view = await renderSignedIn(<JourneyScreen />, backend);

    await waitFor(() => {
      expect(view.getByTestId('journey-empty')).toBeOnTheScreen();
    });
  });

  it('Journey is empty when every Track is finished', async () => {
    // A finished book belongs on the shelf, not in a list of things to continue.
    const backend = new FakeBackend().on('/library', () =>
      json({
        entries: [
          entry({ totalLeaves: 3, completedLeaves: 3, nextLeafId: null, isComplete: true }),
        ],
      }),
    );

    const view = await renderSignedIn(<JourneyScreen />, backend);

    await waitFor(() => {
      expect(view.getByTestId('journey-empty')).toBeOnTheScreen();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* The CMS is unreachable                                                      */
/* -------------------------------------------------------------------------- */

describe('when the content API answers 503', () => {
  const unavailable = (): Response =>
    json(
      { error: { code: 'CONTENT_UNAVAILABLE', message: 'Content is temporarily unavailable.' } },
      503,
    );

  it.each([
    ['Explore', <ExploreScreen key="e" />, 'explore-error', '/content/tracks'],
    ['Library', <LibraryScreen key="l" />, 'library-error', '/library'],
    ['Journey', <JourneyScreen key="j" />, 'journey-error', '/library'],
  ])('%s shows a readable message with a retry', async (_name, element, testID, path) => {
    const backend = new FakeBackend().on(path, unavailable).on('/library', unavailable);

    const view = await renderSignedIn(element, backend);

    await waitFor(() => {
      expect(view.getByTestId(testID)).toBeOnTheScreen();
    });

    // The message the backend wrote, not a stack trace and not a blank screen.
    expect(view.getByText('Content is temporarily unavailable.')).toBeOnTheScreen();
    expect(view.getByTestId(`${testID}-retry`)).toBeOnTheScreen();
  });

  it('retries the request when the reader asks', async () => {
    let attempts = 0;
    const backend = new FakeBackend().on('/library', () => {
      attempts += 1;
      return attempts === 1
        ? unavailable()
        : json({
            entries: [
              entry({ totalLeaves: 2, completedLeaves: 0, nextLeafId: '10', isComplete: false }),
            ],
          });
    });

    const view = await renderSignedIn(<LibraryScreen />, backend);

    await waitFor(() => {
      expect(view.getByTestId('library-error')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByTestId('library-error-retry'));

    // A retry that does not re-request is a button that only hides the error.
    await waitFor(() => {
      expect(view.getByTestId('library-list')).toBeOnTheScreen();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Populated                                                                   */
/* -------------------------------------------------------------------------- */

describe('Library with progress', () => {
  it('shows the count from the server rollup', async () => {
    const backend = new FakeBackend().on('/library', () =>
      json({
        entries: [
          entry({ totalLeaves: 20, completedLeaves: 7, nextLeafId: '17', isComplete: false }),
        ],
      }),
    );

    const view = await renderSignedIn(<LibraryScreen />, backend);

    await waitFor(() => {
      expect(view.getByText('7 of 20 complete')).toBeOnTheScreen();
    });
  });

  it('marks a finished Track as finished', async () => {
    const backend = new FakeBackend().on('/library', () =>
      json({
        entries: [
          entry({ totalLeaves: 3, completedLeaves: 3, nextLeafId: null, isComplete: true }),
        ],
      }),
    );

    const view = await renderSignedIn(<LibraryScreen />, backend);

    await waitFor(() => {
      expect(view.getByTestId('library-done-1')).toBeOnTheScreen();
    });
  });

  it('reads zero of zero rather than NaN when a Track has no visible Leaves', async () => {
    // Reachable in production whenever every Leaf of a Track is a placeholder.
    const backend = new FakeBackend().on('/library', () =>
      json({
        entries: [
          entry({ totalLeaves: 0, completedLeaves: 0, nextLeafId: null, isComplete: false }),
        ],
      }),
    );

    const view = await renderSignedIn(<LibraryScreen />, backend);

    await waitFor(() => {
      expect(view.getByText('No Leaves yet')).toBeOnTheScreen();
    });
  });
});

describe('Explore', () => {
  it('adds a Track to the library and reflects it on the button', async () => {
    const added: string[] = [];
    const backend = new FakeBackend()
      .on('/content/tracks', () =>
        json({ tracks: [TRACK], page: 1, totalPages: 1, totalTracks: 1 }),
      )
      .on('/library/tracks/1', () => {
        added.push('1');
        return new Response(null, { status: 204 });
      })
      .on('/library', () => json({ entries: [] }));

    const view = await renderSignedIn(<ExploreScreen />, backend);

    await waitFor(() => {
      expect(view.getByTestId('explore-toggle-1')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByTestId('explore-toggle-1'));

    await waitFor(() => {
      expect(view.getByText('In your library')).toBeOnTheScreen();
    });
    expect(added).toEqual(['1']);
  });

  it('shows a Track already in the library as already added', async () => {
    const backend = new FakeBackend()
      .on('/content/tracks', () =>
        json({ tracks: [TRACK], page: 1, totalPages: 1, totalTracks: 1 }),
      )
      .on('/library', () =>
        json({
          entries: [
            entry({ totalLeaves: 3, completedLeaves: 0, nextLeafId: '10', isComplete: false }),
          ],
        }),
      );

    const view = await renderSignedIn(<ExploreScreen />, backend);

    await waitFor(() => {
      expect(view.getByText('In your library')).toBeOnTheScreen();
    });
  });

  it('reports a failed add without pretending it worked', async () => {
    const backend = new FakeBackend()
      .on('/content/tracks', () =>
        json({ tracks: [TRACK], page: 1, totalPages: 1, totalTracks: 1 }),
      )
      .on('/library/tracks/1', () =>
        json({ error: { code: 'CONTENT_UNAVAILABLE', message: 'nope' } }, 503),
      )
      .on('/library', () => json({ entries: [] }));

    const view = await renderSignedIn(<ExploreScreen />, backend);

    await waitFor(() => {
      expect(view.getByTestId('explore-toggle-1')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByTestId('explore-toggle-1'));

    await waitFor(() => {
      expect(view.getByTestId('explore-action-error')).toBeOnTheScreen();
    });
    // Still offering the action, because it did not happen.
    expect(view.getByText('Add to library')).toBeOnTheScreen();
  });
});

describe('Journey resume', () => {
  it('is labelled Start reading before anything is done', async () => {
    const backend = new FakeBackend().on('/library', () =>
      json({
        entries: [
          entry({ totalLeaves: 3, completedLeaves: 0, nextLeafId: '10', isComplete: false }),
        ],
      }),
    );

    const view = await renderSignedIn(<JourneyScreen />, backend);

    await waitFor(() => {
      expect(view.getByText('Start reading')).toBeOnTheScreen();
    });
  });

  it('is labelled Resume once the reader has started', async () => {
    const backend = new FakeBackend().on('/library', () =>
      json({
        entries: [
          entry({ totalLeaves: 3, completedLeaves: 1, nextLeafId: '11', isComplete: false }),
        ],
      }),
    );

    const view = await renderSignedIn(<JourneyScreen />, backend);

    await waitFor(() => {
      expect(view.getByText('Resume')).toBeOnTheScreen();
    });
  });

  it('targets the Leaf id the server chose', async () => {
    /**
     * Asserted on the **id**, which is what the acceptance criterion asks for.
     *
     * "Navigation succeeded" would pass against a button that resumed at the first Leaf
     * of every Track. The player does not exist until WP8, so the target is observed
     * where it currently goes — the console — rather than through a navigator that has
     * nothing to navigate to.
     */
    const logged: unknown[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logged.push(args.join(' '));
    });

    const backend = new FakeBackend().on('/library', () =>
      json({
        entries: [
          entry({ totalLeaves: 5, completedLeaves: 2, nextLeafId: '42', isComplete: false }),
        ],
      }),
    );

    try {
      const view = await renderSignedIn(<JourneyScreen />, backend);

      await waitFor(() => {
        expect(view.getByTestId('journey-resume-1')).toBeOnTheScreen();
      });

      await fireEvent.press(view.getByTestId('journey-resume-1'));

      expect(logged.join(' ')).toContain('Leaf 42');
    } finally {
      spy.mockRestore();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* A refresh that fails is not silent                                          */
/* -------------------------------------------------------------------------- */

describe('when a pull-to-refresh fails', () => {
  /** Loads once, then fails every later request — a CMS that went down mid-session. */
  function failsAfterFirstLoad(payload: unknown): FakeBackend {
    let loads = 0;
    const backend = new FakeBackend();

    backend.on('/library', () => {
      loads += 1;
      return loads === 1
        ? json(payload)
        : json(
            { error: { code: 'CONTENT_UNAVAILABLE', message: 'Content is temporarily unavailable.' } },
            503,
          );
    });

    return backend;
  }

  it('keeps the stale list and says so', async () => {
    /**
     * The failure this closes: `useAsyncResource` forces `status` back to `ready` when
     * stale data exists, and no screen read `error` unless `status === 'error'`. During
     * an outage the spinner simply retracted and the reader was left looking at stale
     * content with nothing to indicate it.
     */
    const backend = failsAfterFirstLoad({
      entries: [entry({ totalLeaves: 3, completedLeaves: 1, nextLeafId: '11', isComplete: false })],
    });

    const view = await renderSignedIn(<LibraryScreen />, backend);
    await waitFor(() => {
      expect(view.getByTestId('library-list')).toBeOnTheScreen();
    });

    await pullToRefresh(view.getByTestId('library-list'));

    await waitFor(() => {
      expect(view.getByTestId('library-refresh-error')).toBeOnTheScreen();
    });
    // The stale content stays: it is probably still right, and blanking it would be
    // a worse answer than showing it with a warning.
    expect(view.getByTestId('library-list')).toBeOnTheScreen();
  });

  it('clears the warning once a refresh succeeds again', async () => {
    let loads = 0;
    const backend = new FakeBackend().on('/library', () => {
      loads += 1;
      return loads === 2
        ? json({ error: { code: 'CONTENT_UNAVAILABLE', message: 'down' } }, 503)
        : json({
            entries: [
              entry({ totalLeaves: 3, completedLeaves: 1, nextLeafId: '11', isComplete: false }),
            ],
          });
    });

    const view = await renderSignedIn(<LibraryScreen />, backend);
    await waitFor(() => {
      expect(view.getByTestId('library-list')).toBeOnTheScreen();
    });

    await pullToRefresh(view.getByTestId('library-list'));
    await waitFor(() => {
      expect(view.getByTestId('library-refresh-error')).toBeOnTheScreen();
    });

    await pullToRefresh(view.getByTestId('library-list'));

    await waitFor(() => {
      expect(view.queryByTestId('library-refresh-error')).toBeNull();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Explore does not claim a membership it could not check                      */
/* -------------------------------------------------------------------------- */

describe('when the library fetch fails on Explore', () => {
  const catalogueOnly = (): FakeBackend =>
    new FakeBackend()
      .on('/content/tracks', () => json({ tracks: [TRACK], page: 1, totalPages: 1, totalTracks: 1 }))
      .on('/library', () => json({ error: { code: 'CONTENT_UNAVAILABLE', message: 'down' } }, 503));

  it('says the shelf could not be checked', async () => {
    // Previously `inLibrary()` fell through to false and every card read "Add to
    // library" — including books already on the shelf. Nothing was corrupted, but the
    // screen stated something false.
    const view = await renderSignedIn(<ExploreScreen />, catalogueOnly());

    await waitFor(() => {
      expect(view.getByTestId('explore-library-unknown')).toBeOnTheScreen();
    });
  });

  it('still lists the catalogue and allows adding', async () => {
    // Membership being unknown must not cost the reader the screen: adding is
    // idempotent server-side, so the action stays available.
    const view = await renderSignedIn(<ExploreScreen />, catalogueOnly());

    await waitFor(() => {
      expect(view.getByTestId('explore-list')).toBeOnTheScreen();
    });
    expect(view.getByTestId('explore-toggle-1')).toBeOnTheScreen();
  });

  it('shows no such warning when the shelf loads normally', async () => {
    const backend = new FakeBackend()
      .on('/content/tracks', () => json({ tracks: [TRACK], page: 1, totalPages: 1, totalTracks: 1 }))
      .on('/library', () => json({ entries: [] }));

    const view = await renderSignedIn(<ExploreScreen />, backend);

    await waitFor(() => {
      expect(view.getByTestId('explore-list')).toBeOnTheScreen();
    });
    expect(view.queryByTestId('explore-library-unknown')).toBeNull();
  });
});
