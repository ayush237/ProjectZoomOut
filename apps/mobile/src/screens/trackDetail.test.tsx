import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text as RNText } from 'react-native';
import { NavigationContainer, useRoute, type RouteProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../api/tokenStore';
import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider, type ThemeMode } from '../design';
import type { AppStackParamList } from '../navigation/types';
import { TrackDetailScreen } from './TrackDetailScreen';

/**
 * Tier B: the screen as a consumer of the layout and the model.
 *
 * The algorithm itself is covered exhaustively in `track/roadmapGeometry.test.ts` and
 * `track/roadmapModel.test.ts`, which is the point of having made it a pure function —
 * so what is left here is wiring: that the three requests are made, that the states
 * reach the nodes, that the legal pair survived gaining a graph beneath it, and that
 * the two ways progress can be missing produce a caveat rather than a confident map.
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
  id: '42',
  bookTitle: 'The Mountain Is You',
  author: 'Brianna Wiest',
  publisher: 'Thought Catalog Books',
  coverUrl: 'https://example.test/cover.png',
  description: 'A book about self-sabotage.',
  disclaimer: 'ZoomOut is not affiliated with the author or publisher.',
  purchaseLinks: [{ retailer: 'Example Books', url: 'https://example.test/b', isAffiliate: false }],
  status: 'published',
  leafCount: 5,
  isPlaceholder: false,
  createdAt: '2026-08-11T12:00:00.000Z',
  updatedAt: '2026-08-11T12:00:00.000Z',
};

const LEAVES = Array.from({ length: 5 }, (_, index) => ({
  id: `leaf-${String(index)}`,
  trackId: '42',
  orderIndex: index,
  title: `The Cost of Postponing Decision Number ${String(index)}`,
  isPlaceholder: false,
}));

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

/** Routes are matched in insertion order, so the longest path is registered first. */
class FakeBackend {
  private readonly routes = new Map<string, () => Response>();

  public on(path: string, handler: () => Response): this {
    this.routes.set(path, handler);
    return this;
  }

  public readonly fetch: typeof fetch = (input) => {
    const url = urlOf(input);

    for (const [path, handler] of this.routes) {
      if (url.includes(path)) {
        return Promise.resolve(handler());
      }
    }

    return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
  };
}

/** Stands in for the player, and says which Leaf it was opened with. */
function StubPlayer(): React.JSX.Element {
  const route = useRoute<RouteProp<AppStackParamList, 'LeafPlayer'>>();

  return <RNText testID="stub-player">{`leaf:${route.params.leafId}`}</RNText>;
}

const Stack = createNativeStackNavigator<AppStackParamList>();

async function renderDetail(
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
          <NavigationContainer>{children}</NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  const view = await render(
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TrackDetail" component={TrackDetailScreen} initialParams={{ trackId: '42' }} />
      <Stack.Screen name="LeafPlayer" component={StubPlayer} />
    </Stack.Navigator>,
    { wrapper },
  );

  await act(async () => {
    await Promise.resolve();
  });

  return view;
}

/** The Leaf list, the Track, and a library containing it. Order matters — see above. */
function backendWith(progress: {
  completedLeaves: number;
  nextLeafId: string | null;
  isComplete?: boolean;
}): FakeBackend {
  return new FakeBackend()
    .on('/content/tracks/42/leaves', () => json({ leaves: LEAVES }))
    .on('/content/tracks/42', () => json(TRACK))
    .on('/library', () =>
      json({
        entries: [
          {
            track: TRACK,
            addedAt: '2026-08-11T12:00:00.000Z',
            status: 'active',
            progress: {
              trackId: '42',
              totalLeaves: LEAVES.length,
              isComplete: progress.isComplete ?? false,
              ...progress,
            },
          },
        ],
      }),
    );
}

describe('the Track roadmap on a book the reader is part way through', () => {
  it('draws a node per Leaf, marks where the reader is, and keeps the legal pair', async () => {
    const view = await renderDetail(backendWith({ completedLeaves: 2, nextLeafId: 'leaf-2' }));

    await waitFor(() => {
      expect(view.getByTestId('track-detail-title')).toBeOnTheScreen();
    });

    /**
     * **Every Leaf is a node; not every Leaf is a label.** WP22.2 gave the next Leaf's
     * card the mockup's behaviour of hiding whatever it would otherwise be sitting on
     * top of, so a label can legitimately be absent — see `roadmapLabels.ts`.
     *
     * What must never be absent is the Leaf itself. The node is the accessibility
     * element and it carries the **full, untruncated** title at every text size, which
     * is the guarantee that makes dropping a decorative label safe. Asserting that here
     * rather than asserting a label per Leaf, because that is the promise the module
     * makes and the one a regression would break.
     */
    for (const leaf of LEAVES) {
      expect(view.getByTestId(`roadmap-node-${leaf.id}`)).toBeOnTheScreen();
      expect(
        view.getByTestId(`roadmap-node-${leaf.id}`).props['accessibilityLabel'] as string,
      ).toContain(leaf.title);
    }

    // Most Leaves still carry a visible label; only what the card covers is dropped.
    const labelled = LEAVES.filter(
      (leaf) => view.queryByTestId(`roadmap-label-${leaf.id}`) !== null,
    );

    expect(labelled.length).toBeGreaterThanOrEqual(LEAVES.length - 2);

    // The state a reader has to be able to find on a graph two thousand points tall.
    expect(view.getByTestId('roadmap-next-ring')).toBeOnTheScreen();

    // WP10's obligation, still above the graph rather than beneath it.
    expect(view.getByTestId('track-detail-legal')).toBeOnTheScreen();
    expect(view.getByTestId('track-detail-legal-disclaimer')).toHaveTextContent(TRACK.disclaimer);

    expect(view.getByTestId('track-detail-progress-bar-label')).toHaveTextContent('2 of 5 complete');
  });

  it('shows the next Leaf its full title and wraps the rest to a verbatim prefix', async () => {
    const view = await renderDetail(backendWith({ completedLeaves: 2, nextLeafId: 'leaf-2' }));

    await waitFor(() => {
      expect(view.getByTestId('roadmap-label-leaf-2')).toBeOnTheScreen();
    });

    expect(view.getByTestId('roadmap-label-leaf-2')).toHaveTextContent(
      'The Cost of Postponing Decision Number 2',
    );

    /**
     * **This assertion changed in WP22.2 and the change is the point.** It used to read
     * `'The Cost of…'` for one named Leaf — a single line cut at a fixed eighteen
     * characters, which was all that fit in the 37pt gutter the old two-thirds meander
     * left. The narrowed band and the two-line wrap give more of the sentence back.
     *
     * **Asserted over every label that renders rather than over a named one**, for a
     * reason worth knowing: React Native's jest preset reports `fontScale: 2`, so this
     * screen renders here as though the reader had doubled their text size. Which Leaves
     * keep a label under those conditions is a property of the degradation rules, not
     * something a test should pin by id — naming one made this test fail the moment the
     * card started widening with the text scale, for no defect at all.
     *
     * What must hold at any scale: whatever text a label shows is a verbatim prefix of
     * the author's title, with the ellipsis the only thing this app added.
     */
    const titles = new Map(LEAVES.map((entry) => [entry.id, entry.title]));
    const rendered = LEAVES.map((entry) => ({
      id: entry.id,
      node: view.queryByTestId(`roadmap-label-${entry.id}`),
    })).filter((entry) => entry.node !== null);

    expect(rendered.length).toBeGreaterThan(0);

    for (const entry of rendered) {
      const shown = (entry.node?.props['children'] as string)
        .replace(/…$/u, '')
        .replace(/\n/gu, ' ');

      expect(titles.get(entry.id)?.startsWith(shown)).toBe(true);
    }
  });

  it('opens the next Leaf from the node and from Continue alike', async () => {
    const view = await renderDetail(backendWith({ completedLeaves: 2, nextLeafId: 'leaf-2' }));

    await waitFor(() => {
      expect(view.getByTestId('roadmap-node-leaf-2')).toBeOnTheScreen();
    });

    await fireEvent.press(view.getByTestId('roadmap-node-leaf-2'));

    await waitFor(() => {
      expect(view.getByTestId('stub-player')).toHaveTextContent('leaf:leaf-2');
    });
  });

  it('labels Continue as a resume rather than a start once the reader has begun', async () => {
    const view = await renderDetail(backendWith({ completedLeaves: 2, nextLeafId: 'leaf-2' }));

    await waitFor(() => {
      expect(view.getByTestId('track-detail-continue')).toBeOnTheScreen();
    });

    expect(view.getByTestId('track-detail-continue')).toHaveTextContent('Continue');
  });
});

describe('when the map cannot show progress', () => {
  it('says so rather than drawing a confident guess, for a book not on the shelf', async () => {
    const backend = new FakeBackend()
      .on('/content/tracks/42/leaves', () => json({ leaves: LEAVES }))
      .on('/content/tracks/42', () => json(TRACK))
      .on('/library', () => json({ entries: [] }));

    const view = await renderDetail(backend);

    await waitFor(() => {
      expect(view.getByTestId('track-detail-progress-unknown')).toBeOnTheScreen();
    });

    expect(view.getByTestId('track-detail-progress-unknown')).toHaveTextContent(
      /not in your library/u,
    );
    expect(view.queryByTestId('track-detail-continue')).toBeNull();
    expect(view.queryByTestId('roadmap-next-ring')).toBeNull();
    // The graph still draws — the shape of the book is not a claim about the reader.
    expect(view.getByTestId('roadmap-node-leaf-0')).toBeOnTheScreen();
  });

  it('keeps the legal pair on screen when the library request fails', async () => {
    // The failure that must not take this screen down: the disclaimer and the purchase
    // links are why the screen exists, and they are not progress.
    const backend = new FakeBackend()
      .on('/content/tracks/42/leaves', () => json({ leaves: LEAVES }))
      .on('/content/tracks/42', () => json(TRACK))
      .on('/library', () => json({ error: { code: 'BOOM', message: 'nope' } }, 503));

    const view = await renderDetail(backend);

    await waitFor(() => {
      expect(view.getByTestId('track-detail-legal')).toBeOnTheScreen();
    });

    expect(view.getByTestId('track-detail-progress-unknown')).toHaveTextContent(
      /Could not check your progress/u,
    );
  });

  it('drops every completion claim when the count and the pointer disagree', async () => {
    // The cross-check reaching the screen: the server says two are done and points at
    // the fourth Leaf. Nothing is painted done, and the caveat says why.
    const view = await renderDetail(backendWith({ completedLeaves: 2, nextLeafId: 'leaf-3' }));

    await waitFor(() => {
      expect(view.getByTestId('track-detail-progress-unknown')).toBeOnTheScreen();
    });

    expect(view.getByTestId('track-detail-progress-unknown')).toHaveTextContent(
      /could not be read reliably/u,
    );
    // The server's own resume target still works; only the derived states were dropped.
    expect(view.getByTestId('track-detail-continue')).toBeOnTheScreen();
    expect(view.queryByTestId('track-detail-progress-bar')).toBeNull();
  });
});

describe('a Track with nothing in it', () => {
  it('says the book is empty instead of drawing an empty frame', async () => {
    const backend = new FakeBackend()
      .on('/content/tracks/42/leaves', () => json({ leaves: [] }))
      .on('/content/tracks/42', () => json({ ...TRACK, leafCount: 0 }))
      .on('/library', () =>
        json({
          entries: [
            {
              track: TRACK,
              addedAt: '2026-08-11T12:00:00.000Z',
              status: 'active',
              progress: {
                trackId: '42',
                totalLeaves: 0,
                completedLeaves: 0,
                nextLeafId: null,
                isComplete: false,
              },
            },
          ],
        }),
      );

    const view = await renderDetail(backend);

    await waitFor(() => {
      expect(view.getByTestId('track-detail-no-leaves')).toBeOnTheScreen();
    });

    expect(view.queryByTestId('track-detail-continue')).toBeNull();
  });
});
