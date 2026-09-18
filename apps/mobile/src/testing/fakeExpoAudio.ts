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
  readonly play: jest.Mock<void, []>;
  readonly pause: jest.Mock<void, []>;
  readonly remove: jest.Mock<void, []>;
  readonly _listeners: Set<() => void>;
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
      _listeners: new Set(),
      play: jest.fn(() => {
        created.playing = true;
        notify(created);
      }),
      pause: jest.fn(() => {
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

/** Mirrors `useAudioPlayerStatus`: subscribes so a `play`/`pause` call re-renders the
 *  component watching it, the same as the real hook's native event subscription. */
export function useAudioPlayerStatus(player: FakeAudioPlayer): { playing: boolean } {
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

  return { playing: player.playing };
}

export function setAudioModeAsync(mode: unknown): Promise<void> {
  return setAudioModeAsyncMock(mode);
}
