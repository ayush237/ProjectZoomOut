import { act, cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text as RNText } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../../api/tokenStore';
import { getNarrator } from '../../audio';
import { AuthProvider } from '../../auth/AuthProvider';
import { ThemeProvider } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import { fakeAudioPlayers, resetFakeAudio } from '../../testing/fakeExpoAudio';
import { OnboardingNarratorScreen } from './OnboardingNarratorScreen';
import type { OnboardingVariant } from './useOnboardingGate';

/**
 * The narrator beat, Tier B: the greeting comes from the samples path and not from any
 * book, the names are Lara and Druv, optionality is in text, and one voice plays at a
 * time. The two variants' **Continue** semantics are Tier A and are pinned twice: here on
 * the screen, and through `RootNavigator`'s real gate in `navigation.test.tsx`.
 *
 * **No fixture keys on a Payload Media id, and none asserts on the audio's bytes or
 * duration** — the samples stub carries URLs and nothing else, because that is all the
 * endpoint returns.
 */

type ResettableSecureStore = typeof SecureStore & { __reset: () => void };

const METRICS: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

const FEMALE_URL = 'https://cdn.test/api/media/file/narrator-greeting-female.mp3';
const MALE_URL = 'https://cdn.test/api/media/file/narrator-greeting-male.mp3';

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

class FakeBackend {
  public readonly requested: string[] = [];
  private readonly routes = new Map<string, () => Response>();

  public on(path: string, handler: () => Response): this {
    this.routes.set(path, handler);
    return this;
  }

  public readonly fetch: typeof fetch = (input) => {
    const url = urlOf(input);
    this.requested.push(url);

    for (const [path, handler] of this.routes) {
      if (url.includes(path)) {
        return Promise.resolve(handler());
      }
    }

    return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'no stub' } }, 404));
  };
}

/**
 * Answers auth and the samples path, and **nothing else** — no Tracks, no Leaves. Anything
 * the screen asked of the catalogue would 404 and show; that the beat works on this is the
 * "requires no Track to have narration" criterion, made structural.
 */
function samplesBackend(): FakeBackend {
  return new FakeBackend()
    .on('/auth/refresh', () =>
      json({ userId: PROFILE.id, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, tokenType: 'Bearer' }),
    )
    .on('/users/me', () => json(PROFILE))
    .on('/content/narrator-samples', () =>
      json({ female: { url: FEMALE_URL }, male: { url: MALE_URL } }),
    );
}

/** Stands in for wherever "Continue" lands, and says which. */
function StubDestination({ label }: { readonly label: string }): React.JSX.Element {
  return <RNText testID="stub-destination">{label}</RNText>;
}

const Stack = createNativeStackNavigator<AppStackParamList>();

async function renderNarrator(
  backend: FakeBackend,
  variant: OnboardingVariant,
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
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="OnboardingNarrator">
      <Stack.Screen name="OnboardingNarrator">
        {(props) => <OnboardingNarratorScreen {...props} variant={variant} markSeen={markSeen} />}
      </Stack.Screen>
      <Stack.Screen name="Tabs">{() => <StubDestination label="tabs" />}</Stack.Screen>
      <Stack.Screen name="OnboardingPickBook">{() => <StubDestination label="pick-book" />}</Stack.Screen>
    </Stack.Navigator>,
    { wrapper },
  );

  await act(async () => {
    await Promise.resolve();
  });

  return view;
}

async function untilCardsShown(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('onboarding-narrator-female')).toBeTruthy();
  });
}

function playerFor(url: string): ReturnType<typeof fakeAudioPlayers>[number] {
  const player = fakeAudioPlayers().find((entry) => entry.source === url);

  if (player === undefined) {
    throw new Error(`no player was created for ${url}`);
  }

  return player;
}

describe('OnboardingNarratorScreen — the greetings', () => {
  it('plays the tapped narrator’s own greeting, regardless of the stored preference', async () => {
    // The reason `useNarration` is exported on its own (see `audio/index.ts`):
    // `NarrationControl` would have picked the *stored* narrator's clip, which defaults
    // to male, not whichever card the reader taps.
    const user = userEvent.setup();
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-female'));

    await waitFor(() => {
      expect(playerFor(FEMALE_URL).play).toHaveBeenCalledTimes(1);
    });
    expect(playerFor(MALE_URL).play).not.toHaveBeenCalled();
  });

  it('plays one voice at a time — tapping the other card stops the first', async () => {
    // Two five-second hellos talking over each other is not an introduction, and the
    // natural way to compare two voices is to tap one and then the other.
    const user = userEvent.setup();
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-female'));
    await waitFor(() => {
      expect(playerFor(FEMALE_URL).playing).toBe(true);
    });

    await user.press(screen.getByTestId('onboarding-narrator-male'));

    await waitFor(() => {
      expect(playerFor(MALE_URL).playing).toBe(true);
    });
    expect(playerFor(FEMALE_URL).playing).toBe(false);
  });

  it('sources both greetings from the samples path and asks the catalogue for nothing', async () => {
    // The stub serves no Tracks and no Leaves at all, so a screen that reached for a
    // book's narration (as this beat did before ONBOARD-3) would have nothing to play.
    const backend = samplesBackend();
    await renderNarrator(backend, 'full');
    await untilCardsShown();

    expect(backend.requested.some((url) => url.includes('/content/narrator-samples'))).toBe(true);
    expect(backend.requested.some((url) => /\/content\/(tracks|leaves)/u.test(url))).toBe(false);
    expect(fakeAudioPlayers().map((player) => player.source).sort()).toEqual([FEMALE_URL, MALE_URL].sort());
  });
});

describe('OnboardingNarratorScreen — what the reader is told', () => {
  it('names the narrators Lara and Druv, never Female or Male, never a provider voice id', async () => {
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    expect(screen.getByText('Lara')).toBeTruthy();
    expect(screen.getByText('Druv')).toBeTruthy();
    // Visible text: no bare "Female"/"Male" and neither provider voice id anywhere.
    expect(screen.queryByText(/\b(fe)?male\b/iu)).toBeNull();
    expect(screen.queryByText(/achernar|sadaltager/iu)).toBeNull();

    // The accessibility labels are what a screen reader says, and follow the same rule.
    const labels = ['female', 'male'].map(
      (narrator) => screen.getByTestId(`onboarding-narrator-${narrator}`).props['accessibilityLabel'] as string,
    );
    expect(labels[0]).toMatch(/^Lara, /u);
    expect(labels[1]).toMatch(/^Druv, /u);
    for (const label of labels) {
      expect(label).not.toMatch(/achernar|sadaltager/iu);
    }
  });

  it('says in text that narration is optional, not only in what a narrator says aloud', async () => {
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    expect(screen.getByTestId('onboarding-narrator-optional')).toHaveTextContent(/narration is optional/iu);
  });
});

describe('OnboardingNarratorScreen — Continue, per variant (Tier A)', () => {
  it('narratorOnly: marks seen exactly once and lands on Tabs', async () => {
    // An existing account: this beat is the whole of its onboarding.
    const user = userEvent.setup();
    const markSeen = jest.fn();
    await renderNarrator(samplesBackend(), 'narratorOnly', markSeen);
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('tabs');
    });
    expect(markSeen).toHaveBeenCalledTimes(1);
  });

  it('full: goes on to pick-book and does not mark seen', async () => {
    // A new account is not done: they still have to choose a book and read a Leaf.
    // Marking seen here is ONBOARD-1's behaviour, and the exact change this package makes.
    const user = userEvent.setup();
    const markSeen = jest.fn();
    await renderNarrator(samplesBackend(), 'full', markSeen);
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('pick-book');
    });
    expect(markSeen).not.toHaveBeenCalled();
  });

  it('persists the chosen narrator through the same store Profile reads', async () => {
    const user = userEvent.setup();
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-female'));
    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(async () => {
      await expect(getNarrator()).resolves.toBe('female');
    });
  });
});
