import { AppState } from 'react-native';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { AudioRef } from '@zoomout/shared';

import { ThemeProvider } from '../design';
import { flush } from '../testing/flush';
import { NarrationControl } from './NarrationControl';

/**
 * `jest.setup.js` mocks `expo-audio` globally to this same module, so importing it
 * here reaches the live mock the component under test is already using — not a copy
 * of it. No local `jest.mock('expo-audio', ...)` is needed in this file.
 */
import {
  fakeAudioPlayers,
  fakeSetAudioModeAsync,
  releaseFakePlayer,
  resetFakeAudio,
} from '../testing/fakeExpoAudio';

type ResettableSecureStore = typeof SecureStore & { __reset: () => void };

const MALE: AudioRef = {
  narrator: 'male',
  url: 'https://cdn.example.com/male-summary.mp3',
  durationSeconds: 12,
  textDigest: 'a'.repeat(64),
};

const FEMALE: AudioRef = {
  narrator: 'female',
  url: 'https://cdn.example.com/female-summary.mp3',
  durationSeconds: 12,
  textDigest: 'b'.repeat(64),
};

beforeEach(() => {
  resetFakeAudio();
  (SecureStore as ResettableSecureStore).__reset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderControl(audio: readonly AudioRef[] | undefined) {
  return render(
    <ThemeProvider>
      <NarrationControl audio={audio} label="Summary" />
    </ThemeProvider>,
  );
}

describe('NarrationControl — what renders', () => {
  it('renders nothing for a slide with no audio at all', async () => {
    await renderControl(undefined);

    expect(screen.queryByTestId('narration-control')).toBeNull();
  });

  it('renders nothing for a slide whose audio array is empty', async () => {
    await renderControl([]);

    expect(screen.queryByTestId('narration-control')).toBeNull();
  });

  it('renders nothing — never the other voice — when only the non-preferred narrator is present', async () => {
    // Default narrator is male (the founder's ruling); this Leaf carries only female.
    await renderControl([FEMALE]);

    expect(screen.queryByTestId('narration-control')).toBeNull();
  });

  it('renders the control and wires the matching clip when the preferred narrator is present', async () => {
    await renderControl([MALE, FEMALE]);

    expect(screen.getByTestId('narration-control')).toBeTruthy();
    expect(fakeAudioPlayers().find((player) => player.source === MALE.url)).toBeTruthy();
  });

  it('matches by narrator, never by array position, even when the preferred voice is second', async () => {
    /**
     * Male listed first: a positional read (`array[0]`) would silently wire up the
     * wrong clip once the reader's preference is female. `useNarrator`'s SecureStore
     * read is async, so the very first render still sees the hard-coded default
     * ('male') before it resolves — `NarrationControl` remounts its child once it
     * does (see its own docstring), so this asserts on the settled state rather than
     * on nothing-was-ever-created, which the transient first render would fail.
     */
    await SecureStore.setItemAsync('zoomout.narrator', 'female');

    await renderControl([MALE, FEMALE]);

    await waitFor(() => {
      expect(screen.getByTestId('narration-control').props['accessibilityLabel']).toBe(
        'Play Summary narration, Female voice',
      );
    });

    expect(fakeAudioPlayers().at(-1)?.source).toBe(FEMALE.url);
  });
});

describe('NarrationControl — the accessibility label', () => {
  it('names the action and the narrator, and updates when the action does', async () => {
    const user = userEvent.setup();
    await renderControl([MALE]);

    const control = screen.getByTestId('narration-control');
    expect(control.props['accessibilityLabel']).toBe('Play Summary narration, Male voice');

    await user.press(control);

    await waitFor(() => {
      expect(control.props['accessibilityLabel']).toBe('Pause Summary narration, Male voice');
    });
  });
});

describe('NarrationControl — playback', () => {
  it('plays on the first press and pauses on the second', async () => {
    const user = userEvent.setup();
    await renderControl([MALE]);

    const player = fakeAudioPlayers().find((entry) => entry.source === MALE.url);
    if (player === undefined) {
      throw new Error('expected a fake player to have been created');
    }

    await user.press(screen.getByTestId('narration-control'));
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.pause).not.toHaveBeenCalled();

    await user.press(screen.getByTestId('narration-control'));
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it('configures the audio session for silent-switch playback', async () => {
    await renderControl([MALE]);

    await waitFor(() => {
      expect(fakeSetAudioModeAsync()).toHaveBeenCalledWith({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
    });
  });

  it('stops the clip when the app backgrounds', async () => {
    let handler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      handler = listener as (state: string) => void;
      return { remove: jest.fn() };
    });

    const user = userEvent.setup();
    await renderControl([MALE]);
    await user.press(screen.getByTestId('narration-control'));

    const player = fakeAudioPlayers().find((entry) => entry.source === MALE.url);
    if (player === undefined) {
      throw new Error('expected a fake player to have been created');
    }
    expect(player.pause).not.toHaveBeenCalled();

    // `pause()` notifies `useAudioPlayerStatus`'s listener, which sets state — real
    // React, not a rendered event, so it has to run inside `act` the same way a press
    // does.
    await flush(() => {
      handler?.('background');
    });

    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it('stops the clip when the control unmounts', async () => {
    const user = userEvent.setup();
    const { unmount } = await renderControl([MALE]);
    await user.press(screen.getByTestId('narration-control'));

    const player = fakeAudioPlayers().find((entry) => entry.source === MALE.url);
    if (player === undefined) {
      throw new Error('expected a fake player to have been created');
    }

    await unmount();

    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it('stops the clip when the reader leaves the slide for another — a different path from a bare unmount', async () => {
    /**
     * Reproduces `LeafPlayerScreen`'s own mechanism: exactly one slide's ternary
     * branch renders at a time, so moving on unmounts the one just left rather than
     * hiding it. A stop wired to some other event (a screen-level unmount, say) would
     * pass the plain unmount test above and still fail this one.
     */
    const TAKEAWAY: AudioRef = { ...MALE, url: 'https://cdn.example.com/male-takeaway.mp3' };

    function TwoSlideHarness({ onSummary }: { readonly onSummary: boolean }): React.JSX.Element {
      return (
        <ThemeProvider>
          {onSummary ? <NarrationControl audio={[MALE]} label="Summary" /> : null}
          {onSummary ? null : <NarrationControl audio={[TAKEAWAY]} label="Takeaway" />}
        </ThemeProvider>
      );
    }

    const user = userEvent.setup();
    const { rerender } = await render(<TwoSlideHarness onSummary />);
    await user.press(screen.getByTestId('narration-control'));

    const summaryPlayer = fakeAudioPlayers().find((entry) => entry.source === MALE.url);
    if (summaryPlayer === undefined) {
      throw new Error('expected the summary slide to have created a player');
    }
    expect(summaryPlayer.pause).not.toHaveBeenCalled();

    await rerender(<TwoSlideHarness onSummary={false} />);

    expect(summaryPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('does not crash when expo-audio has already released the player before this app\'s own cleanup runs', async () => {
    /**
     * Found on a real Android device (not producible any other way under Node):
     * `useAudioPlayer` releases its native player on unmount on its own, and that can
     * happen before `useNarration`'s own cleanup calls `pause()`, which then throws
     * "Cannot use shared object that was already released" from the native bridge.
     * Mutation check: delete `safely(...)` around any of the three call sites in
     * `useNarration.ts` and this test fails — either this `unmount()` throws (for the
     * cleanup-effect and background-listener sites) or the earlier `press` above does.
     */
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { unmount } = await renderControl([MALE]);

    const player = fakeAudioPlayers().find((entry) => entry.source === MALE.url);
    if (player === undefined) {
      throw new Error('expected a fake player to have been created');
    }
    releaseFakePlayer(player);

    await unmount();

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('native player call failed'),
      expect.any(Error),
    );
  });
});
