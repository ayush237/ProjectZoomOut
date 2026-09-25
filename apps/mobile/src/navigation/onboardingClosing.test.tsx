import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import type { CompletionOutcome } from '@zoomout/shared';

import { MemoryTokenStore } from '../api/tokenStore';
import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider } from '../design';
import { CLOSING_COPY } from '../screens/share/WrapUpScreen';
import {
  COMPLETION,
  CORRECT_ANSWER,
  FIRST_LEAF,
  FIRST_LEAF_ID,
  FIRST_TRACK_ID,
  finishTheLeaf,
  SESSION_SUMMARY,
} from '../testing/firstLeaf';
import { AppStack } from './AppStack';
import type { AppStackParamList } from './types';

/**
 * The closing moment (ONBOARD-3), **both directions, through the real player and
 * navigator** — the Tier A pair the handoff asks for:
 *
 *  - the player carries `onboarding: true`, and its completion exits reach `WrapUp` showing
 *    the closing copy and calling `markSeen` on mount;
 *  - without it, `WrapUp` is unchanged and nothing is marked.
 *
 * What is real: `AppStack`, `LeafPlayerScreen` (driven through every slide by
 * `finishTheLeaf`), the completion panel's exits, `WrapUpScreen`. What is a spy:
 * `markSeen` — so "marks nothing" is observable in a way it would not be against the real
 * gate, where the flag is already set. The same flow through `RootNavigator`'s real gate,
 * flag store and all, is in `navigation.test.tsx`.
 *
 * **Neither direction reads `first-wrap`.** That achievement unlocks when the reader *taps*
 * wrap, after `WrapUp` has opened, so it cannot be what makes the closing appear — and the
 * tests below never tap it and assert the app never asked the server about it.
 */

type ResettableSecureStore = typeof SecureStore & { __reset: () => void };

const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

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

beforeEach(() => {
  (SecureStore as ResettableSecureStore).__reset();
});

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

/** Everything the shell, the player and `WrapUp` ask for, and a record of what was asked. */
function backend(completion: CompletionOutcome = COMPLETION): {
  readonly fetch: typeof fetch;
  readonly requested: string[];
} {
  const requested: string[] = [];

  const answer: typeof fetch = (input) => {
    const url = urlOf(input);
    requested.push(url);

    if (url.includes('/auth/refresh')) {
      return Promise.resolve(
        json({ userId: PROFILE.id, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, tokenType: 'Bearer' }),
      );
    }
    if (url.includes('/users/me')) return Promise.resolve(json(PROFILE));
    if (url.includes(`/content/leaves/${FIRST_LEAF_ID}`)) return Promise.resolve(json(FIRST_LEAF));
    if (url.includes(`/progress/leaves/${FIRST_LEAF_ID}/start`)) {
      return Promise.resolve(json({ progress: COMPLETION.progress }));
    }
    if (url.includes(`/progress/leaves/${FIRST_LEAF_ID}/answer`)) return Promise.resolve(json(CORRECT_ANSWER));
    if (url.includes(`/progress/leaves/${FIRST_LEAF_ID}/complete`)) return Promise.resolve(json(completion));
    if (url.includes('/progress/summary')) return Promise.resolve(json(SESSION_SUMMARY));
    if (url.includes('/content/tracks')) {
      return Promise.resolve(json({ tracks: [], page: 1, totalPages: 0, totalTracks: 0 }));
    }
    if (url.includes('/library')) return Promise.resolve(json({ entries: [] }));

    return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
  };

  return { fetch: answer, requested };
}

/**
 * Mounts the real `AppStack` on `Tabs` (as it is for any reader who is not mid-onboarding),
 * then opens the player exactly as the pick-book beat does — with or without the flag.
 */
async function openFirstLeaf(
  options: { readonly onboarding: boolean; readonly completion?: CompletionOutcome },
): Promise<{ readonly markSeen: jest.Mock; readonly requested: string[] }> {
  const markSeen = jest.fn();
  const fake = backend(options.completion);
  const ref = createNavigationContainerRef<AppStackParamList>();

  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode="dark">
        <AuthProvider tokenStore={new MemoryTokenStore('stored')} baseUrl="https://api.test" fetchFn={fake.fetch}>
          <NavigationContainer ref={ref}>{children}</NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  await render(<AppStack initialRouteName="Tabs" onboardingMarkSeen={markSeen} />, { wrapper });

  await waitFor(() => {
    expect(screen.getByTestId('explore-screen')).toBeOnTheScreen();
  });

  await act(async () => {
    ref.navigate('LeafPlayer', {
      leafId: FIRST_LEAF_ID,
      trackId: FIRST_TRACK_ID,
      trackTitle: 'A Real Book',
      ...(options.onboarding ? { onboarding: true as const } : {}),
    });
    await Promise.resolve();
  });

  await finishTheLeaf();

  return { markSeen, requested: fake.requested };
}

/** The app never asked about `first-wrap`: no wrap was recorded, no achievements read. */
function neverAskedAboutFirstWrap(requested: readonly string[]): void {
  expect(requested.some((url) => url.includes('/events') || url.includes('/achievements'))).toBe(false);
}

describe('a first-Leaf reader — the player carries onboarding: true', () => {
  it('Done opens WrapUp as the closing, and marks onboarding seen on mount', async () => {
    const { markSeen, requested } = await openFirstLeaf({ onboarding: true });
    expect(markSeen).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('leaf-done'));

    await waitFor(() => {
      expect(screen.getByTestId('wrap-up-headline')).toHaveTextContent(CLOSING_COPY.headline);
    });
    expect(screen.getByTestId('wrap-up-eyebrow')).toHaveTextContent(CLOSING_COPY.eyebrow);
    expect(markSeen).toHaveBeenCalledTimes(1);
    neverAskedAboutFirstWrap(requested);
  });

  it('Wrap up today opens the same closing', async () => {
    const { markSeen, requested } = await openFirstLeaf({ onboarding: true });

    await fireEvent.press(screen.getByTestId('leaf-wrap-up'));

    await waitFor(() => {
      expect(screen.getByTestId('wrap-up-headline')).toHaveTextContent(CLOSING_COPY.headline);
    });
    expect(markSeen).toHaveBeenCalledTimes(1);
    neverAskedAboutFirstWrap(requested);
  });

  it('the cap’s "See your day" opens it too — every exit that reaches WrapUp carries the flag', async () => {
    // A slow first Leaf can hit the 15-minute cap. That exit calls the same handler, so
    // it must not be the one door through which the closing is lost.
    const capped: CompletionOutcome = { ...COMPLETION, session: { ...COMPLETION.session, capReached: true } };
    const { markSeen } = await openFirstLeaf({ onboarding: true, completion: capped });

    await fireEvent.press(screen.getByTestId('leaf-cap-wrap-up'));

    await waitFor(() => {
      expect(screen.getByTestId('wrap-up-headline')).toHaveTextContent(CLOSING_COPY.headline);
    });
    expect(markSeen).toHaveBeenCalledTimes(1);
  });

  it('WrapUp’s own exit goes back to the tabs, not into the finished Leaf', async () => {
    await openFirstLeaf({ onboarding: true });
    await fireEvent.press(screen.getByTestId('leaf-done'));
    await waitFor(() => {
      expect(screen.getByTestId('wrap-up-exit')).toBeOnTheScreen();
    });

    await fireEvent.press(screen.getByTestId('wrap-up-exit'));

    await waitFor(() => {
      expect(screen.getByTestId('explore-screen')).toBeOnTheScreen();
    });
    expect(screen.queryByTestId('leaf-complete')).toBeNull();
  });
});

describe('any other reader — no onboarding param', () => {
  it('Wrap up today opens the ordinary WrapUp, and nothing is marked', async () => {
    const { markSeen, requested } = await openFirstLeaf({ onboarding: false });

    await fireEvent.press(screen.getByTestId('leaf-wrap-up'));

    await waitFor(() => {
      expect(screen.getByTestId('wrap-up-headline')).toBeOnTheScreen();
    });
    expect(screen.getByTestId('wrap-up-eyebrow')).toHaveTextContent('Session complete');
    expect(screen.getByTestId('wrap-up-headline')).toHaveTextContent('That is a session');
    expect(screen.queryByTestId('wrap-up-message')).toBeNull();
    expect(markSeen).not.toHaveBeenCalled();
    neverAskedAboutFirstWrap(requested);
  });

  it('Done goes straight back, as it always did, and nothing is marked', async () => {
    const { markSeen } = await openFirstLeaf({ onboarding: false });

    await fireEvent.press(screen.getByTestId('leaf-done'));

    await waitFor(() => {
      expect(screen.getByTestId('explore-screen')).toBeOnTheScreen();
    });
    expect(screen.queryByTestId('wrap-up-screen')).toBeNull();
    expect(markSeen).not.toHaveBeenCalled();
  });
});
