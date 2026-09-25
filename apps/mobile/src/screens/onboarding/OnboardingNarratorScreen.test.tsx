import { act, cleanup, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text as RNText } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MemoryTokenStore } from '../../api/tokenStore';
import { getNarrator } from '../../audio';
import { AuthProvider } from '../../auth/AuthProvider';
import { ThemeProvider } from '../../design';
import type { AppStackParamList } from '../../navigation/types';
import {
  failFakePlayer,
  fakeAudioPlayers,
  releaseFakePlayer,
  resetFakeAudio,
  type FakeAudioPlayer,
} from '../../testing/fakeExpoAudio';
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
 *
 * **ONBOARD-3.1 added the failure half.** The beat fails open, the way the onboarding gate
 * does: every row of its state table is pinned below through the real screen, the same two
 * Continue semantics hold when the hellos never loaded, and a stored narrator is neither
 * overwritten nor left playing over the next screen. The `RootNavigator` versions of the
 * Continue rows are in `navigation.test.tsx`.
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
  private readonly routes = new Map<string, () => Response | Promise<Response>>();

  /** A handler may answer late, or reject — a request that never lands, or a dropped connection. */
  public on(path: string, handler: () => Response | Promise<Response>): this {
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

/**
 * The container's own ref, so a test can move the reader somewhere **without pressing
 * Continue** — the only way to show that the beat stops a clip because it lost focus, and
 * not because of something Continue itself does.
 */
const navigationRef = createNavigationContainerRef<AppStackParamList>();

async function renderNarrator(
  backend: FakeBackend,
  variant: OnboardingVariant,
  markSeen: () => void = jest.fn(),
): Promise<ReturnType<typeof render> extends Promise<infer R> ? R : never> {
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider mode="dark">
        <AuthProvider tokenStore={new MemoryTokenStore('stored-refresh')} baseUrl="https://api.test" fetchFn={backend.fetch}>
          <NavigationContainer ref={navigationRef}>{children}</NavigationContainer>
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
    // Both cards start offering "play"; the glyph changes with the state of *its* card.
    const play = glyphCode('female');
    expect(glyphCode('male')).toBe(play);

    await user.press(screen.getByTestId('onboarding-narrator-female'));
    await waitFor(() => {
      expect(playerFor(FEMALE_URL).playing).toBe(true);
    });
    await waitFor(() => {
      expect(glyphCode('female')).not.toBe(play);
    });
    expect(glyphCode('male')).toBe(play);

    await user.press(screen.getByTestId('onboarding-narrator-male'));

    await waitFor(() => {
      expect(playerFor(MALE_URL).playing).toBe(true);
    });
    expect(playerFor(FEMALE_URL).playing).toBe(false);
    // …and the glyphs swap with the voices: the first is back to "play", the second shows "pause".
    await waitFor(() => {
      expect(glyphCode('male')).not.toBe(play);
    });
    expect(glyphCode('female')).toBe(play);
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

/** The literal key, as `surfaces.test.tsx` reads it — the store is what is under test. */
const NARRATOR_KEY = 'zoomout.narrator';

function isChecked(narrator: 'female' | 'male'): boolean {
  const state = screen.getByTestId(`onboarding-narrator-${narrator}`).props['accessibilityState'] as {
    checked?: boolean;
  };

  return state.checked === true;
}

describe('OnboardingNarratorScreen — a stored narrator is not overwritten (Tier A)', () => {
  // A repeat pass is reachable through the accepted quit-mid-first-Leaf design, and so is
  // any reader who chose in Profile before meeting this beat. Before this package Continue
  // wrote the *default* back over their choice. Every assertion below reads the store, not
  // the screen: the bug was a silent write, and the screen never showed it.

  it('pre-selects the narrator already stored, not the default', async () => {
    await SecureStore.setItemAsync(NARRATOR_KEY, 'female');

    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    await waitFor(() => {
      expect(isChecked('female')).toBe(true);
    });
    expect(isChecked('male')).toBe(false);
  });

  it('keeps a stored choice when the reader continues without tapping a card', async () => {
    const user = userEvent.setup();
    await SecureStore.setItemAsync(NARRATOR_KEY, 'female');

    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    // Deliberately no wait for the stored choice to show first: Continue must leave the
    // store alone whether or not the screen has caught up with it.
    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('pick-book');
    });
    await expect(SecureStore.getItemAsync(NARRATOR_KEY)).resolves.toBe('female');
  });

  it('replaces it only when the reader taps a card', async () => {
    const user = userEvent.setup();
    await SecureStore.setItemAsync(NARRATOR_KEY, 'female');

    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-male'));
    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(async () => {
      await expect(SecureStore.getItemAsync(NARRATOR_KEY)).resolves.toBe('male');
    });
  });

  it('writes nothing when nothing is stored and the reader takes the default', async () => {
    // Nothing needs writing: the default is what `useNarrator` reads back anyway.
    const user = userEvent.setup();
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();
    expect(isChecked('male')).toBe(true);
    jest.mocked(SecureStore.setItemAsync).mockClear();

    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('pick-book');
    });
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(NARRATOR_KEY, expect.anything());
    await expect(SecureStore.getItemAsync(NARRATOR_KEY)).resolves.toBeNull();
  });
});

describe('OnboardingNarratorScreen — audio stops when the beat is left (Tier A)', () => {
  // In `full`, Continue *pushes* pick-book over the beat, so the beat stays mounted and a
  // clip still playing used to finish over the next screen. `narratorOnly` resets instead,
  // which unmounts the beat and stops the clip on its own — both are pinned.

  it('full: a clip playing when Continue is tapped does not carry on over pick-book', async () => {
    const user = userEvent.setup();
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-male'));
    await waitFor(() => {
      expect(playerFor(MALE_URL).playing).toBe(true);
    });

    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('pick-book');
    });
    expect(playerFor(MALE_URL).playing).toBe(false);
  });

  it('a clip playing when the beat loses focus by any other route stops too', async () => {
    // Not through Continue: this is what shows the stop belongs to the beat losing focus,
    // and not to something the Continue handler does.
    const user = userEvent.setup();
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-female'));
    await waitFor(() => {
      expect(playerFor(FEMALE_URL).playing).toBe(true);
    });

    await act(async () => {
      navigationRef.navigate('OnboardingPickBook');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('pick-book');
    });
    expect(playerFor(FEMALE_URL).playing).toBe(false);
  });

  it('leaving the beat without having played anything starts nothing', async () => {
    // The stop is `toggle` on a clip that reports `playing` — and `toggle` on one that does
    // not *starts* it. So the guard is that a blur only ever pauses what is playing.
    const user = userEvent.setup();
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('pick-book');
    });
    expect(playerFor(FEMALE_URL).play).not.toHaveBeenCalled();
    expect(playerFor(MALE_URL).play).not.toHaveBeenCalled();
  });

  it('pauses only the clip that is playing, and leaves the other alone', async () => {
    const user = userEvent.setup();
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-male'));
    await waitFor(() => {
      expect(playerFor(MALE_URL).playing).toBe(true);
    });
    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('pick-book');
    });
    expect(playerFor(MALE_URL).pause).toHaveBeenCalled();
    expect(playerFor(FEMALE_URL).play).not.toHaveBeenCalled();
    expect(playerFor(FEMALE_URL).pause).not.toHaveBeenCalled();
  });

  it('narratorOnly: Continue while a clip plays stops it (the reset unmounts the beat)', async () => {
    const user = userEvent.setup();
    await renderNarrator(samplesBackend(), 'narratorOnly');
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-male'));
    await waitFor(() => {
      expect(playerFor(MALE_URL).playing).toBe(true);
    });

    await user.press(screen.getByTestId('onboarding-narrator-continue'));

    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('tabs');
    });
    expect(playerFor(MALE_URL).playing).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The beat fails open (ONBOARD-3.1)                                            */
/* -------------------------------------------------------------------------- */

const HELLOS_ANSWER = (): Response => json({ female: { url: FEMALE_URL }, male: { url: MALE_URL } });

/**
 * Every way the hellos fetch can fail. The last two are a **200**: a captive portal's page
 * reads as `null`, and a partial body has one narrator — both would reach a player as
 * `undefined.url` if the screen trusted the type, so they must land in the same state as a
 * refused connection.
 */
const FAILURES: ReadonlyArray<{
  readonly name: string;
  readonly answer: () => Response | Promise<Response>;
}> = [
  { name: 'a network error', answer: () => Promise.reject(new TypeError('Network request failed')) },
  {
    name: 'a 404, an old backend that has never heard of the route',
    answer: () => json({ error: { code: 'NOT_FOUND', message: 'no such route' } }, 404),
  },
  { name: 'a 500', answer: () => json({ error: { code: 'INTERNAL', message: 'boom' } }, 500) },
  {
    name: 'a 200 that is not two clips, a captive portal’s page',
    answer: () => new Response('<html>sign in to the wifi</html>', { status: 200 }),
  },
  { name: 'a 200 with only one narrator', answer: () => json({ female: { url: FEMALE_URL } }) },
];

/** Auth and the samples path, with the hellos answered however the test says. */
function backendAnswering(answer: () => Response | Promise<Response>): FakeBackend {
  return samplesBackend().on('/content/narrator-samples', answer);
}

/** The play/pause control on a card — hidden from accessibility on purpose, so queried through it. */
function glyph(narrator: 'female' | 'male'): ReturnType<typeof screen.queryByTestId> {
  return screen.queryByTestId(`onboarding-narrator-${narrator}-glyph`, { includeHiddenElements: true });
}

/**
 * Which glyph a card is showing, as its character code. The icon font's codepoints differ per
 * icon (play, pause and the failure glyph are three different ones), so comparing them says
 * which control a card is offering without hard-coding a private-use codepoint.
 */
function glyphCode(narrator: 'female' | 'male'): number | undefined {
  const child = glyph(narrator)?.children[0];

  return typeof child === 'string' ? child.codePointAt(0) : undefined;
}

async function untilNoticeShown(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('onboarding-narrator-hellos-notice')).toBeTruthy();
  });
}

describe('OnboardingNarratorScreen — the beat fails open (Tier A)', () => {
  // The onboarding gate fails open on purpose (`useOnboardingGate`: a failed Library read
  // reads as *seen*, so the flow can never lock a reader out of the app). This beat used to
  // show an error screen with a retry and **no way onward** when its fetch failed — so an
  // existing account could not reach Tabs and a new one could not reach pick-book. Each row
  // of the state table is one of the tests below, through the real screen.

  it('loading: a spinner, and nothing to press yet', async () => {
    await renderNarrator(backendAnswering(() => new Promise<Response>(() => undefined)), 'full');

    expect(screen.getByTestId('onboarding-narrator-loading')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-narrator-continue')).toBeNull();
    expect(screen.queryByTestId('onboarding-narrator-female')).toBeNull();
  });

  it('ready: two playable cards, each offering a hello, and no notice', async () => {
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    expect(glyph('female')).not.toBeNull();
    expect(glyph('male')).not.toBeNull();
    for (const narrator of ['female', 'male']) {
      expect(screen.getByTestId(`onboarding-narrator-${narrator}`).props['accessibilityLabel']).toMatch(
        /Tap to hear a hello\.$/u,
      );
    }
    expect(screen.queryByTestId('onboarding-narrator-hellos-notice')).toBeNull();
    expect(screen.queryByTestId('onboarding-narrator-retry')).toBeNull();
    expect(screen.getByTestId('onboarding-narrator-intro')).toHaveTextContent(
      /Tap a card to hear each narrator say hello\./u,
    );
  });

  it.each(FAILURES)(
    'fetch fails ($name): the beat still appears — select-only cards, the notice, Try again and Continue',
    async ({ answer }) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const user = userEvent.setup();
      await renderNarrator(backendAnswering(answer), 'full');
      await untilNoticeShown();

      // The beat, not an error screen, and everything a reader needs to carry on.
      expect(screen.queryByTestId('onboarding-narrator-error')).toBeNull();
      expect(screen.getByTestId('onboarding-narrator-hellos-notice')).toHaveTextContent(
        /hellos couldn.t load/iu,
      );
      expect(screen.getByTestId('onboarding-narrator-retry')).toBeTruthy();
      expect(screen.getByTestId('onboarding-narrator-continue')).toBeTruthy();

      // Select-only: no play control, nothing that promises a hello, and no player behind
      // either card — "nothing plays" is that no player was ever made, not a mock left uncalled.
      expect(glyph('female')).toBeNull();
      expect(glyph('male')).toBeNull();
      expect(fakeAudioPlayers()).toHaveLength(0);
      for (const narrator of ['female', 'male']) {
        expect(screen.getByTestId(`onboarding-narrator-${narrator}`).props['accessibilityLabel']).not.toMatch(
          /hello/iu,
        );
      }
      expect(screen.getByTestId('onboarding-narrator-intro')).not.toHaveTextContent(/Tap a card/u);

      // A tap chooses that narrator, and still plays nothing.
      expect(isChecked('male')).toBe(true);
      await user.press(screen.getByTestId('onboarding-narrator-female'));
      expect(isChecked('female')).toBe(true);
      expect(isChecked('male')).toBe(false);
      expect(fakeAudioPlayers()).toHaveLength(0);

      // Logged, not swallowed: this is the only place anyone could learn a deploy went out
      // in the wrong order.
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    },
  );

  it.each([
    ['narratorOnly', 'tabs', 1],
    ['full', 'pick-book', 0],
  ] as const)(
    '%s: Continue works when the hellos never loaded, with the same marks as when they did, and keeps the choice',
    async (variant, destination, marks) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const user = userEvent.setup();
      const markSeen = jest.fn();
      await renderNarrator(backendAnswering(FAILURES[2]!.answer), variant, markSeen);
      await untilNoticeShown();

      await user.press(screen.getByTestId('onboarding-narrator-female'));
      await user.press(screen.getByTestId('onboarding-narrator-continue'));

      await waitFor(() => {
        expect(screen.getByTestId('stub-destination')).toHaveTextContent(destination);
      });
      expect(markSeen).toHaveBeenCalledTimes(marks);
      await expect(SecureStore.getItemAsync(NARRATOR_KEY)).resolves.toBe('female');

      warn.mockRestore();
    },
  );

  it('Try again after a failure fetches again, turns the cards playable, and keeps the choice made meanwhile', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = userEvent.setup();
    let attempts = 0;
    await renderNarrator(
      backendAnswering(() => {
        attempts += 1;
        return attempts === 1 ? FAILURES[2]!.answer() : HELLOS_ANSWER();
      }),
      'full',
    );
    await untilNoticeShown();

    await user.press(screen.getByTestId('onboarding-narrator-female'));
    await user.press(screen.getByTestId('onboarding-narrator-retry'));

    await untilCardsShown();
    await waitFor(() => {
      expect(glyph('female')).not.toBeNull();
    });
    expect(attempts).toBe(2);
    expect(screen.queryByTestId('onboarding-narrator-hellos-notice')).toBeNull();
    // The choice made while select-only survived the reload, and the card now plays.
    expect(isChecked('female')).toBe(true);
    await user.press(screen.getByTestId('onboarding-narrator-female'));
    await waitFor(() => {
      expect(playerFor(FEMALE_URL).play).toHaveBeenCalledTimes(1);
    });

    warn.mockRestore();
  });

  it('Try again that fails again leaves the beat as it was — still able to continue', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = userEvent.setup();
    let attempts = 0;
    await renderNarrator(
      backendAnswering(() => {
        attempts += 1;
        return FAILURES[2]!.answer();
      }),
      'full',
    );
    await untilNoticeShown();

    await user.press(screen.getByTestId('onboarding-narrator-retry'));

    await waitFor(() => {
      expect(attempts).toBe(2);
    });
    await untilNoticeShown();
    await user.press(screen.getByTestId('onboarding-narrator-continue'));
    await waitFor(() => {
      expect(screen.getByTestId('stub-destination')).toHaveTextContent('pick-book');
    });

    warn.mockRestore();
  });

  /**
   * The two ways a greeting fails to play, both of which `useNarration` reports as
   * `playbackFailed` and the beat never showed: a load failure the player reports after an
   * attempt (`status.error` — `play()` itself does not throw for it), and a player that
   * throws from `play()`.
   */
  const WILL_NOT_PLAY: ReadonlyArray<{
    readonly name: string;
    readonly breakBeforePress: boolean;
    readonly breakIt: (player: FakeAudioPlayer) => void;
  }> = [
    {
      name: 'a load failure the player reports after the attempt',
      breakBeforePress: false,
      breakIt: (player) => {
        failFakePlayer(player);
      },
    },
    {
      name: 'a player that throws on play',
      breakBeforePress: true,
      breakIt: (player) => {
        releaseFakePlayer(player);
      },
    },
  ];

  it.each(WILL_NOT_PLAY)(
    'a greeting that will not play ($name) shows a failed state on that card alone, and Continue still works',
    async ({ breakBeforePress, breakIt }) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const user = userEvent.setup();
      const view = await renderNarrator(samplesBackend(), 'full');
      await untilCardsShown();
      expect(screen.queryByTestId('onboarding-narrator-female-failed')).toBeNull();

      if (breakBeforePress) {
        breakIt(playerFor(FEMALE_URL));
      }
      await user.press(screen.getByTestId('onboarding-narrator-female'));
      if (!breakBeforePress) {
        await act(async () => {
          breakIt(playerFor(FEMALE_URL));
          await Promise.resolve();
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-narrator-female-failed')).toBeTruthy();
      });
      expect(screen.queryByTestId('onboarding-narrator-male-failed')).toBeNull();
      // The control swaps for the failure glyph — text and glyph, never colour alone — and
      // only on the card that failed.
      expect(glyphCode('female')).not.toBe(glyphCode('male'));
      expect(screen.getByTestId('onboarding-narrator-female').props['accessibilityLabel']).toMatch(
        /Couldn.t play the hello\. Tap to try again\.$/u,
      );

      await user.press(screen.getByTestId('onboarding-narrator-continue'));
      await waitFor(() => {
        expect(screen.getByTestId('stub-destination')).toHaveTextContent('pick-book');
      });

      // Unmounted while the spy is still in place: a released player warns again on cleanup.
      await view.unmount();
      warn.mockRestore();
    },
  );

  it('tapping a card whose greeting failed tries again, and the failed state clears once it plays', async () => {
    const user = userEvent.setup();
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    await user.press(screen.getByTestId('onboarding-narrator-female'));
    await act(async () => {
      // `failFakePlayer` reports the error and leaves `playing` as it was. A player that
      // failed to load is not playing — say so, or the next tap would *pause* it.
      playerFor(FEMALE_URL).playing = false;
      failFakePlayer(playerFor(FEMALE_URL));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId('onboarding-narrator-female-failed')).toBeTruthy();
    });

    await user.press(screen.getByTestId('onboarding-narrator-female'));

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-narrator-female-failed')).toBeNull();
    });
    expect(playerFor(FEMALE_URL).play).toHaveBeenCalledTimes(2);
  });
});

describe('OnboardingNarratorScreen — the copy makes no false claim (ONBOARD-3.1)', () => {
  // Only Ikigai has narration today and slide 4 has no voice button, so "every Leaf can be
  // read aloud" was a factual slip. What is pinned is the claim, not the wording — the words
  // are the founder's to edit.
  it('does not say every Leaf can be read aloud', async () => {
    await renderNarrator(samplesBackend(), 'full');
    await untilCardsShown();

    expect(screen.getByTestId('onboarding-narrator-intro')).not.toHaveTextContent(/every leaf/iu);
    expect(screen.getByTestId('onboarding-narrator-intro')).toHaveTextContent(/read aloud/iu);
  });
});
