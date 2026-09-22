import { act, cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text as RNText } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NavigationContainer, useRoute, type RouteProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../../api/tokenStore';
import { getNarrator } from '../../audio';
import { AuthProvider } from '../../auth/AuthProvider';
import { ThemeProvider } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { fakeAudioPlayers, resetFakeAudio } from '../../testing/fakeExpoAudio';
import { OnboardingNarratorScreen } from './OnboardingNarratorScreen';

/**
 * Beat 3, Tier B: one happy path per navigation outcome, plus the one interaction that
 * is new here and not covered by `useNarration`'s own tests — that a card plays a
 * *specific* narrator's sample regardless of the reader's stored preference, since
 * `NarrationControl` (built on the same hook) cannot do that at all.
 */

type ResettableSecureStore = typeof SecureStore & { __reset: () => void };

const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

beforeEach(() => {
  resetFakeAudio();
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

const SAMPLE_TRACK = {
  id: 't1',
  bookTitle: 'Ikigai: The Japanese Secret to a Long and Happy Life',
  author: 'An Author',
  coverUrl: 'https://example.test/cover.png',
  description: 'A description.',
  isPlaceholder: false,
};

const SAMPLE_LEAF = {
  id: 'l1',
  trackId: 't1',
  orderIndex: 0,
  title: 'Leaf One',
  summary: {
    body: 'Summary.',
    audio: [
      { narrator: 'female', url: 'https://cdn.test/female.mp3', durationSeconds: 10, textDigest: 'a'.repeat(64) },
      { narrator: 'male', url: 'https://cdn.test/male.mp3', durationSeconds: 10, textDigest: 'b'.repeat(64) },
    ],
  },
  scenario: { prompt: 'Prompt?', options: [] },
  payoff: null,
  payoffUnlocked: false,
  stickyNotes: { notes: [] },
  takeaway: { body: 'Takeaway.' },
  sourceReferences: [],
};

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

function baseBackend(libraryEntries: unknown[] = []): FakeBackend {
  return new FakeBackend()
    .on('/auth/refresh', () =>
      json({ userId: PROFILE.id, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, tokenType: 'Bearer' }),
    )
    .on('/users/me', () => json(PROFILE))
    .on('/content/tracks/t1/leaves', () =>
      json({ leaves: [{ id: 'l1', trackId: 't1', orderIndex: 0, title: 'Leaf One', isPlaceholder: false }] }),
    )
    .on('/content/leaves/l1', () => json(SAMPLE_LEAF))
    .on('/content/tracks', () => json({ tracks: [SAMPLE_TRACK], page: 1, totalPages: 1, totalTracks: 1 }))
    .on('/library', () => json({ entries: libraryEntries }));
}

/** Stands in for wherever "Continue" lands — Tabs or LeafPlayer alike — and says which. */
function StubDestination({ label }: { readonly label: string }): React.JSX.Element {
  return <RNText testID="stub-destination">{label}</RNText>;
}

function StubPlayer(): React.JSX.Element {
  const route = useRoute<RouteProp<AppStackParamList, 'LeafPlayer'>>();

  return <RNText testID="stub-player">{`${route.params.leafId}:${route.params.trackId}`}</RNText>;
}

const Stack = createNativeStackNavigator<AppStackParamList>();

async function renderNarrator(
  backend: FakeBackend,
  pickedTrack: { readonly id: string; readonly title: string } | undefined,
  markSeen: () => void = jest.fn(),
): Promise<ReturnType<typeof render> extends Promise<infer R> ? R : never> {
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode="dark">
        <AuthProvider tokenStore={new MemoryTokenStore('stored-refresh')} baseUrl="https://api.test" fetchFn={backend.fetch}>
          <NavigationContainer>{children}</NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  const view = await render(
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="OnboardingNarrator"
    >
      {/* `initialParams` omitted entirely, not passed as `{}`, when there is no picked
          Track — `route.params` is `undefined` in that shape, not an empty object,
          which is exactly the distinction `OnboardingNarratorScreen` has to handle
          (`AppStack`'s real `initialRouteName="OnboardingNarrator"` carries no
          `initialParams` either). A `{}` here would test a condition the app never
          actually produces. */}
      <Stack.Screen
        name="OnboardingNarrator"
        {...(pickedTrack === undefined ? {} : { initialParams: { pickedTrack } })}
      >
        {(props) => <OnboardingNarratorScreen {...props} markSeen={markSeen} />}
      </Stack.Screen>
      <Stack.Screen name="Tabs">{() => <StubDestination label="tabs" />}</Stack.Screen>
      <Stack.Screen name="LeafPlayer" component={StubPlayer} />
    </Stack.Navigator>,
    { wrapper },
  );

  await act(async () => {
    await Promise.resolve();
  });

  return view;
}

describe('OnboardingNarratorScreen', () => {
  it('plays the female card’s own sample, regardless of the stored preference', async () => {
    // The reason `useNarration` had to be exported directly (see `audio/index.ts`):
    // `NarrationControl` would have picked the *stored* narrator's clip, which
    // defaults to male, not whichever card the reader taps.
    const user = userEvent.setup();
    await renderNarrator(baseBackend(), { id: 't1', title: SAMPLE_TRACK.bookTitle });

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-narrator-female')).toBeTruthy();
    });
    await user.press(screen.getByTestId('onboarding-narrator-female'));

    await waitFor(() => {
      const player = fakeAudioPlayers().find((entry) => entry.source === 'https://cdn.test/female.mp3');
      expect(player?.play).toHaveBeenCalledTimes(1);
    });
  });

  it('sends a picked Track into LeafPlayer at its resume target, not Tabs', async () => {
    const user = userEvent.setup();
    const libraryEntries = [
      {
        track: SAMPLE_TRACK,
        addedAt: '2026-09-01T00:00:00.000Z',
        status: 'active',
        progress: { trackId: 't1', totalLeaves: 1, completedLeaves: 0, nextLeafId: 'l1', isComplete: false },
      },
    ];
    await renderNarrator(baseBackend(libraryEntries), { id: 't1', title: SAMPLE_TRACK.bookTitle });

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-narrator-continue')).toBeTruthy();
    });
    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('stub-player')).toHaveTextContent('l1:t1');
    });
  });

  it('sends an existing reader (no picked Track) to Tabs, never the player', async () => {
    const user = userEvent.setup();
    const markSeen = jest.fn();
    await renderNarrator(baseBackend(), undefined, markSeen);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-narrator-continue')).toBeTruthy();
    });
    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('tabs');
    });
    expect(markSeen).toHaveBeenCalledTimes(1);
  });

  it('persists the chosen narrator through the same store Profile reads', async () => {
    const user = userEvent.setup();
    await renderNarrator(baseBackend(), undefined);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-narrator-female')).toBeTruthy();
    });
    await user.press(screen.getByTestId('onboarding-narrator-female'));
    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(async () => {
      await expect(getNarrator()).resolves.toBe('female');
    });
  });
});
