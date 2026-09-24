import { act, cleanup, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import type { SessionSummary } from '@zoomout/shared';

import { MemoryTokenStore } from '../../api/tokenStore';
import { AuthProvider } from '../../auth/AuthProvider';
import { ThemeProvider } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { CLOSING_COPY, WrapUpScreen, wrapUpStats } from './WrapUpScreen';

/**
 * Tier B: one happy path per state, plus the pure stat selector at Tier A.
 *
 * The re-skin's load-bearing acceptance criterion is that the cap-hit ending and the
 * voluntary one share one layout and differ only in copy — so the render test below
 * proves that by diffing the two states, rather than eyeballing the JSX.
 */

describe('wrapUpStats', () => {
  const base: SessionSummary = {
    localDate: '2026-09-09',
    leaves: [
      { leafId: 'l1', title: 'Leaf 1', trackId: 't1', trackTitle: 'A Book', xpAwarded: 40, firstTryCorrect: true },
    ],
    xpEarned: 40,
    streak: { current: 3, longest: 5, lastActiveLocalDate: '2026-09-09' },
    achievements: [],
    session: { localDate: '2026-09-09', secondsActive: 300, xpEarned: 40, capReached: false, capSeconds: 900, capXp: 500 },
  };

  it('reports leaves, XP and the streak from the summary', () => {
    expect(wrapUpStats(base)).toEqual([
      { value: 1, label: 'Leaves today' },
      { value: 40, label: 'XP earned' },
      { value: 3, label: 'Day streak' },
    ]);
  });

  it('falls back to "Day one" rather than a zero streak (mutation check: drop the fallback)', () => {
    const noStreak: SessionSummary = { ...base, streak: { ...base.streak, current: 0 } };

    expect(wrapUpStats(noStreak)[2]).toEqual({ value: 1, label: 'Day one' });
  });
});

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

function summaryFixture(capReached: boolean): SessionSummary {
  return {
    localDate: '2026-09-09',
    leaves: [
      {
        leafId: 'l1',
        title: 'Anchoring',
        trackId: 't1',
        trackTitle: 'The Mountain Is You',
        xpAwarded: 40,
        firstTryCorrect: true,
      },
    ],
    xpEarned: 40,
    streak: { current: 4, longest: 6, lastActiveLocalDate: '2026-09-09' },
    achievements: [],
    session: {
      localDate: '2026-09-09',
      secondsActive: capReached ? 900 : 300,
      xpEarned: 40,
      capReached,
      capSeconds: 900,
      capXp: 500,
    },
  };
}

/** Every string leaf in a `toJSON()` render tree, in document order. */
function collectText(node: unknown): string[] {
  if (typeof node === 'string') {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (node !== null && typeof node === 'object' && 'children' in node) {
    return collectText(node.children);
  }

  return [];
}

/** Removes exactly one occurrence of `value`, failing loudly if it is not there. */
function withoutOne(list: readonly string[], value: string): readonly string[] {
  const index = list.indexOf(value);

  if (index === -1) {
    throw new Error(`expected to find ${JSON.stringify(value)} in ${JSON.stringify(list)}`);
  }

  return [...list.slice(0, index), ...list.slice(index + 1)];
}

const Stack = createNativeStackNavigator<AppStackParamList>();

async function renderWrapUp(
  backend: FakeBackend,
  options: { readonly onboarding?: true; readonly markSeen?: jest.Mock } = {},
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

  const markSeen = options.markSeen ?? jest.fn();

  const view = await render(
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* `initialParams` omitted entirely when there is no flag, not passed as `{}`:
          every ordinary arrival (`navigate('WrapUp')`) leaves `route.params` undefined,
          and that is the shape the screen has to handle. */}
      <Stack.Screen
        name="WrapUp"
        {...(options.onboarding === true ? { initialParams: { onboarding: true as const } } : {})}
      >
        {(props) => <WrapUpScreen {...props} markSeen={markSeen} />}
      </Stack.Screen>
    </Stack.Navigator>,
    { wrapper },
  );

  await act(async () => {
    await Promise.resolve();
  });

  return view;
}

describe('WrapUpScreen', () => {
  it('renders the day, the share card and the stat row from a real summary', async () => {
    const backend = new FakeBackend().on('/progress/summary', () => json(summaryFixture(false)));
    const { getByText, getByTestId } = await renderWrapUp(backend);

    expect(getByText('Session complete')).toBeTruthy();
    expect(getByTestId('share-card-headline').props['children']).toBe('4-day streak');
    expect(getByTestId('wrap-up-stat-Leaves today').props['children']).toBe(1);
    expect(getByTestId('wrap-up-stat-XP earned').props['children']).toBe(40);
    expect(getByTestId('wrap-up-stat-Day streak').props['children']).toBe(4);
  });

  it('shares one layout between the voluntary and cap-hit endings, differing only in the eyebrow', async () => {
    const voluntary = await renderWrapUp(
      new FakeBackend().on('/progress/summary', () => json(summaryFixture(false))),
    );
    const capped = await renderWrapUp(new FakeBackend().on('/progress/summary', () => json(summaryFixture(true))));

    // The one line the acceptance criterion says is allowed to differ.
    expect(voluntary.getByText('Today')).toBeTruthy();
    expect(capped.getByText('That is today done')).toBeTruthy();
    expect(voluntary.queryByText('That is today done')).toBeNull();
    expect(capped.queryByText('Today')).toBeNull();

    // The strong version of the criterion: every string of text anywhere in the tree
    // is identical between the two endings, once the one substitution the eyebrow is
    // allowed to make is undone. This is what actually catches a second, accidental
    // fork (e.g. the headline itself branching on `capReached`) — checking a handful
    // of named testIDs, as the block above does, cannot see a fork it did not think to
    // name, and one slipped past exactly that version of this test during writing.
    const voluntaryTexts = collectText(voluntary.toJSON());
    const cappedTexts = collectText(capped.toJSON());

    expect(withoutOne(voluntaryTexts, 'Today')).toEqual(withoutOne(cappedTexts, 'That is today done'));
  });

  it('renders the zero-Leaf day without a stat row for nothing earned yet', async () => {
    const zero: SessionSummary = {
      localDate: '2026-09-09',
      leaves: [],
      xpEarned: 0,
      streak: { current: 0, longest: 0, lastActiveLocalDate: null },
      achievements: [],
      session: { localDate: '2026-09-09', secondsActive: 0, xpEarned: 0, capReached: false, capSeconds: 900, capXp: 500 },
    };
    const backend = new FakeBackend().on('/progress/summary', () => json(zero));
    const { getByText, queryByTestId } = await renderWrapUp(backend);

    expect(getByText('Nothing yet today')).toBeTruthy();
    expect(queryByTestId('wrap-up-stats')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* The closing — a new reader's first Leaf has just ended (ONBOARD-3)          */
/* -------------------------------------------------------------------------- */

describe('WrapUpScreen as the closing', () => {
  it('shows the welcome message in place of the ordinary framing', async () => {
    const backend = new FakeBackend().on('/progress/summary', () => json(summaryFixture(false)));
    const { getByTestId, queryByText } = await renderWrapUp(backend, { onboarding: true });

    expect(getByTestId('wrap-up-eyebrow')).toHaveTextContent(CLOSING_COPY.eyebrow);
    expect(getByTestId('wrap-up-headline')).toHaveTextContent(CLOSING_COPY.headline);
    expect(getByTestId('wrap-up-message')).toHaveTextContent(CLOSING_COPY.body ?? '');
    // Not alongside it — *in place of* it.
    expect(queryByText('Session complete')).toBeNull();
    expect(queryByText('That is a session')).toBeNull();
  });

  it('marks onboarding seen on mount, exactly once', async () => {
    // Tier A. The reader has finished their first Leaf and been shown the close.
    const markSeen = jest.fn();
    const backend = new FakeBackend().on('/progress/summary', () => json(summaryFixture(false)));

    await renderWrapUp(backend, { onboarding: true, markSeen });

    expect(markSeen).toHaveBeenCalledTimes(1);
  });

  it('marks seen even when the summary fails to load, so the narrator beat cannot return', async () => {
    // Tier A. On mount, not when the message renders: a reader who has finished their
    // first Leaf must not be left un-marked by a slow or failing summary, or the next
    // launch resolves them `narratorOnly` and shows them the narrator beat again.
    const markSeen = jest.fn();
    const backend = new FakeBackend().on('/progress/summary', () =>
      json({ error: { code: 'INTERNAL', message: 'boom' } }, 500),
    );

    const { getByTestId, queryByTestId } = await renderWrapUp(backend, { onboarding: true, markSeen });

    expect(getByTestId('wrap-up-error')).toBeTruthy();
    expect(queryByTestId('wrap-up-eyebrow')).toBeNull();
    expect(markSeen).toHaveBeenCalledTimes(1);
  });

  it('is unchanged, and marks nothing, when reached any other way', async () => {
    // Tier A, the other direction: Journey, or the cap's "See your day" for an ordinary
    // reader, carry no param and must see exactly what they always saw.
    const markSeen = jest.fn();
    const backend = new FakeBackend().on('/progress/summary', () => json(summaryFixture(false)));

    const { getByTestId, queryByTestId } = await renderWrapUp(backend, { markSeen });

    expect(getByTestId('wrap-up-eyebrow')).toHaveTextContent('Session complete');
    expect(getByTestId('wrap-up-headline')).toHaveTextContent('That is a session');
    expect(queryByTestId('wrap-up-message')).toBeNull();
    expect(getByTestId('wrap-up-exit')).toHaveTextContent('Back to Journey');
    expect(markSeen).not.toHaveBeenCalled();
  });

  it('is one layout with the ordinary screen: every other string in the tree is identical', async () => {
    // WP25's principle for this screen — a copy-only diff — held for the closing too.
    // Once the closing's own words (and the exit's label) are set aside on both sides,
    // what is left must match string for string; a second, accidental fork — the stats
    // row branching on `onboarding`, say — would leave an unmatched string behind.
    const ordinary = await renderWrapUp(
      new FakeBackend().on('/progress/summary', () => json(summaryFixture(false))),
    );
    const closing = await renderWrapUp(
      new FakeBackend().on('/progress/summary', () => json(summaryFixture(false))),
      { onboarding: true },
    );

    const ordinaryTexts = collectText(ordinary.toJSON());
    const closingTexts = collectText(closing.toJSON());

    const closingWords = [CLOSING_COPY.eyebrow, CLOSING_COPY.headline, CLOSING_COPY.body ?? '', 'Done'];
    const ordinaryWords = ['Session complete', 'That is a session', 'Back to Journey'];

    expect(closingWords.reduce(withoutOne, closingTexts)).toEqual(
      ordinaryWords.reduce(withoutOne, ordinaryTexts),
    );
  });
});
