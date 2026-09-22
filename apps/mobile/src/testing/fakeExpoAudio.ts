import { useEffect, useState } from 'react';

/**
 * A hand-rolled stand-in for `expo-audio`'s `AudioPlayer` and its hooks.
 *
 * Real playback cannot run under Node, and the testing expectations for VO-3 are
 * explicit that the package should be mocked at its boundary rather than asserted on
 * for real sound — so this fakes exactly the two things a test needs to observe:
 * whether `play`/`pause` were called, and a `playing` flag that a component can
 * genuinely react to across a re-render (not just read once).
 *
 * **Not a Jest automock.** `jest.mock('expo-audio', factory)` is written per test file
 * (Jest only hoists a literal `jest.mock` call in the file it appears in), so the
 * factory reaches into this module with `jest.requireActual` at call time — after the
 * module graph has settled, which is what avoids the "used before initialization"
 * trap a closed-over `const` would hit under Jest's hoisting. The test file imports
 * the same functions normally, and both resolve to this one module instance.
 */

export interface FakeAudioPlayer {
  readonly id: string;
  /** The source it was constructed with — lets a test confirm *which* clip a
   *  component wired up, independent of anything visible in the rendered tree. */
  readonly source: unknown;
  playing: boolean;
  /** Set by `releaseFakePlayer` to reproduce `expo-audio`'s own unmount-triggered
   *  release happening before this app's code gets a chance to call `pause()`. */
  released: boolean;
  /** Set by `failFakePlayer` to reproduce an asynchronous playback failure — real
   *  `expo-audio`'s `AudioStatus.error`, which `play()` itself does not throw for. */
  error: string | null;
  readonly play: jest.Mock<void, []>;
  readonly pause: jest.Mock<void, []>;
  readonly remove: jest.Mock<void, []>;
  readonly _listeners: Set<() => void>;
}

/** The exact message observed on a real Android device — see `useNarration.ts`'s
 *  `safely` helper. */
const ALREADY_RELEASED_MESSAGE = 'Cannot use shared object that was already released';

/**
 * Reproduces `expo-audio` having already released a player by the time this app's own
 * cleanup runs — found on-device, not producible any other way under Node, since
 * nothing here models the real native release timing. Call before unmounting (or
 * before whatever should observe the release) to mutation-check `useNarration`'s
 * `safely` wrapper: remove that wrapper and the test using this goes red.
 */
export function releaseFakePlayer(player: FakeAudioPlayer): void {
  player.released = true;
}

/**
 * Reproduces `expo-audio` surfacing an asynchronous playback failure — an unreachable
 * or invalid source, the shape PILOT-1's `MEDIA_BASE_URL` defect actually took on a
 * real device. **Unlike `releaseFakePlayer`, this does not make `play()` throw**: the
 * real native player does not throw for this either, it reports the failure on
 * `status.error` instead, which `useNarration` has to be watching for a reader to see
 * anything. Call after a `play()` attempt to simulate the load failing in the
 * background. Mirrors real `expo-audio`: `AudioStatus.error`'s own doc comment says it
 * is "cleared when a new source is loaded or playback resumes successfully", modelled
 * here by the fake's own `play()` clearing it on a later, unreleased call.
 */
export function failFakePlayer(player: FakeAudioPlayer, message = 'Failed to load audio'): void {
  player.error = message;
  notify(player);
}

function newSetAudioModeAsyncMock(): jest.Mock<Promise<void>, [unknown]> {
  return jest.fn((_mode: unknown) => Promise.resolve());
}

let players: FakeAudioPlayer[] = [];
let setAudioModeAsyncMock = newSetAudioModeAsyncMock();

/** Call from `beforeEach` so one test's players and calls cannot leak into the next. */
export function resetFakeAudio(): void {
  players = [];
  setAudioModeAsyncMock = newSetAudioModeAsyncMock();
}

export function fakeAudioPlayers(): readonly FakeAudioPlayer[] {
  return players;
}

export function fakeSetAudioModeAsync(): jest.Mock {
  return setAudioModeAsyncMock;
}

function notify(player: FakeAudioPlayer): void {
  player._listeners.forEach((listener) => {
    listener();
  });
}

/** Mirrors `useAudioPlayer`: one stable player per component instance, created lazily. */
export function useAudioPlayer(source: unknown): FakeAudioPlayer {
  const [player] = useState<FakeAudioPlayer>(() => {
    const created: FakeAudioPlayer = {
      id: `fake-player-${String(players.length)}`,
      source,
      playing: false,
      released: false,
      error: null,
      _listeners: new Set(),
      play: jest.fn(() => {
        if (created.released) {
          throw new Error(ALREADY_RELEASED_MESSAGE);
        }
        created.playing = true;
        created.error = null;
        notify(created);
      }),
      pause: jest.fn(() => {
        if (created.released) {
          throw new Error(ALREADY_RELEASED_MESSAGE);
        }
        created.playing = false;
        notify(created);
      }),
      remove: jest.fn<void, []>(),
    };

    players.push(created);
    return created;
  });

  return player;
}

/** Mirrors `useAudioPlayerStatus`: subscribes so a `play`/`pause`/`failFakePlayer` call
 *  re-renders the component watching it, the same as the real hook's native event
 *  subscription. */
export function useAudioPlayerStatus(player: FakeAudioPlayer): {
  playing: boolean;
  error: string | null;
} {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = (): void => {
      rerender((count) => count + 1);
    };

    player._listeners.add(listener);

    return () => {
      player._listeners.delete(listener);
    };
  }, [player]);

  return { playing: player.playing, error: player.error };
}

export function setAudioModeAsync(mode: unknown): Promise<void> {
  return setAudioModeAsyncMock(mode);
}
