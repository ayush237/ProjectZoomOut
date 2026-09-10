import { act, cleanup, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import type { Track } from '@zoomout/shared';

import { MemoryTokenStore } from '../../api/tokenStore';
import { AuthProvider } from '../../auth/AuthProvider';
import { ThemeProvider } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { TrackCompleteScreen } from './TrackCompleteScreen';

/**
 * Tier B: one happy path. The pure decisions this screen depends on —
 * `trackCompleteStats`, `selectFragmentNodes`/`buildConstellationFragment` — carry their
 * own Tier A coverage; this proves the screen actually wires real data through them and
 * onto the page, which is the kind of mistake a pure-function test cannot catch.
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

class FakeBackend {
  private readonly routes: Array<{ path: string; handler: () => Response }> = [];

  public on(path: string, handler: () => Response): this {
    this.routes.push({ path, handler });
    return this;
  }

  public readonly fetch: typeof fetch = (input) => {
    const url = urlOf(input);

    for (const route of this.routes) {
      if (url.includes(route.path)) {
        return Promise.resolve(route.handler());
      }
    }

    return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
  };
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

const TRACK: Track = {
  id: 't1',
  bookTitle: 'The Quiet Arithmetic',
  author: 'Marisol Vane',
  publisher: 'Fictional Press',
  coverUrl: 'https://example.test/cover.png',
  description: 'A book about numbers.',
  disclaimer:
    'This summary reflects ZoomOut’s reading of the book’s ideas. It is not endorsed by or affiliated with the author or publisher.',
  purchaseLinks: [{ retailer: 'Bookshop', url: 'https://example.test/buy', isAffiliate: false }],
  status: 'published',
  leafCount: 3,
  isPlaceholder: false,
  acquisition: 'undocumented',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const LEAVES = [
  { id: 'l1', trackId: 't1', orderIndex: 0, title: 'First numbers', isPlaceholder: false },
  { id: 'l2', trackId: 't1', orderIndex: 1, title: 'Opening moves', isPlaceholder: false },
  { id: 'l3', trackId: 't1', orderIndex: 2, title: 'The quiet close', isPlaceholder: false },
];

const STANDING = {
  session: { localDate: '2026-09-10', secondsActive: 300, xpEarned: 40, capReached: false, capSeconds: 900, capXp: 500 },
  streak: { current: 6, longest: 6, lastActiveLocalDate: '2026-09-10' },
  totalXp: 1240,
};

const Stack = createNativeStackNavigator<AppStackParamList>();

async function renderTrackComplete(
  backend: FakeBackend,
): Promise<ReturnType<typeof render> extends Promise<infer R> ? R : never> {
  backend.on('/auth/refresh', () =>
    json({ userId: PROFILE.id, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, tokenType: 'Bearer' }),
  );
  backend.on('/users/me', () => json(PROFILE));

  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode="dark">
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
      <Stack.Screen name="TrackComplete" component={TrackCompleteScreen} initialParams={{ trackId: 't1' }} />
    </Stack.Navigator>,
    { wrapper },
  );

  await act(async () => {
    await Promise.resolve();
  });

  return view;
}

describe('TrackCompleteScreen', () => {
  it('renders the finished constellation, the real streak, and the legal pair', async () => {
    const backend = new FakeBackend()
      // More specific path registered first — `/content/tracks/t1` is a substring of
      // `/content/tracks/t1/leaves`, and the fake matches by first substring hit.
      .on('/content/tracks/t1/leaves', () => json({ leaves: LEAVES }))
      .on('/content/tracks/t1', () => json(TRACK))
      .on('/progress/today', () => json(STANDING));

    await renderTrackComplete(backend);

    expect(screen.getByTestId('track-complete-title')).toHaveTextContent('The Quiet Arithmetic');
    expect(screen.getByText('Marisol Vane')).toBeTruthy();

    // One tappable node per Leaf — the finished-Track affordance for reopening any of
    // them, wired straight onto the real geometry rather than a placeholder count.
    for (const leaf of LEAVES) {
      expect(screen.getByTestId(`track-complete-node-${leaf.id}`)).toBeTruthy();
    }

    // Only the streak is real (see `trackCompleteStats`) — this is the one stat WP26
    // can show, sourced from `GET /progress/today`, not invented.
    expect(screen.getByTestId('track-complete-stat-Day streak')).toHaveTextContent('6');

    // The legal pair, via the existing `TrackLegal` — required on this screen, reused
    // rather than rebuilt.
    expect(screen.getByTestId('track-complete-legal')).toBeTruthy();
    expect(screen.getByTestId('track-complete-legal-disclaimer')).toHaveTextContent(TRACK.disclaimer);

    expect(screen.getByTestId('track-complete-share')).toBeTruthy();
    expect(screen.getByTestId('track-complete-next-book')).toBeTruthy();

    // The shared `achievement` icon stays exactly as it is — WP26 does not touch it.
    // Reaching this screen at all with the default (no `mascot` override on the
    // *achievement* card) is exercised by `AchievementShareScreen`, not here; this
    // screen always supplies its own `mascot`, so the fragment renders instead.
    expect(screen.getByTestId('share-card-fragment')).toBeTruthy();
  });
});
