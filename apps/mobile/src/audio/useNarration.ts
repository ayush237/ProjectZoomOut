import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { AudioRef } from '@zoomout/shared';

import { configureNarrationAudioSession } from './audioSession';

export interface Narration {
  readonly playing: boolean;
  readonly toggle: () => void;
}

/**
 * Drives one narration clip through `expo-audio`.
 *
 * **Takes a required `entry`, never `undefined`.** `NarrationControl` only mounts the
 * component that calls this once a clip has actually been selected — see its own
 * docstring for why that split matters: `useAudioPlayer` creates its native player
 * once, from a `useState` lazy initializer, and does not appear to react to the
 * `source` argument changing on a later render. If this hook instead accepted
 * `undefined` and were kept mounted across a change of narrator, a player created
 * against the wrong clip on an early render (the narrator preference loads
 * asynchronously, so the very first render always uses the hard-coded default) would
 * keep pointing at it forever. Remounting on a changed `entry.url` — `NarrationControl`
 * keys its child on it — sidesteps the question entirely: a new key means a new
 * player, created with the right source from the start.
 *
 * **State is read from the player, never tracked separately.** There is no local
 * "is playing" flag here that could drift from what `expo-audio` actually did — the
 * control's icon and label are a direct function of `useAudioPlayerStatus`, so an OS
 * interruption (a call, another app) can only ever leave the control showing "paused"
 * or "playing", never a state of its own invention stuck mid-spinner.
 */
export function useNarration(entry: AudioRef): Narration {
  const player = useAudioPlayer(entry.url);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    void configureNarrationAudioSession();
  }, []);

  // Leaving the slide and unmounting the player are the same React lifecycle event
  // here — `LeafPlayerScreen` renders exactly one slide at a time via a ternary, so
  // moving to the next slide unmounts this one — but the acceptance criteria ask for
  // both to be pinned separately, since a future refactor (e.g. keeping slides mounted
  // and toggling visibility) could silently split them.
  useEffect(() => {
    return () => {
      player.pause();
    };
  }, [player]);

  // No background-audio capability is requested (product decision, see
  // `audioSession.ts`), so backgrounding the app must stop the clip explicitly rather
  // than trusting the OS to tear the session down for us.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        player.pause();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  const toggle = useCallback(() => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, status.playing]);

  return { playing: status.playing, toggle };
}
