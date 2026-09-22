import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { AudioRef } from '@zoomout/shared';

import { configureNarrationAudioSession } from './audioSession';

export interface Narration {
  readonly playing: boolean;
  readonly toggle: () => void;
  /**
   * Whether the most recent attempt to start playback failed. Cleared the moment a
   * later `toggle` tries again. Always `false` on a fresh clip.
   */
  readonly playbackFailed: boolean;
}

/**
 * Calls a native `AudioPlayer` method, swallowing the exception `expo-audio` throws
 * when the underlying native object has already been released, and reporting whether
 * it had to.
 *
 * **Found on a real Android device, not in any test.** `useAudioPlayer` releases its
 * native player on unmount on its own — true of the library, not documented in its
 * `.d.ts` — and there is no signal available here for whether that has already
 * happened by the time one of this hook's own effects runs. The observed failure:
 * `Cannot use shared object that was already released`, thrown synchronously from the
 * native bridge. The state a caller here wants — this clip is not playing — is already
 * true once the player is released, so the exception carries nothing to act on; it is
 * `console.warn`ed rather than silently dropped, since it is still a real signal that
 * cleanup order surprised us, and worth seeing if it starts happening often.
 *
 * **The return value exists for exactly one caller.** `toggle`'s play branch is the
 * only call site where "the release exception fired" changes what happens next — see
 * its own comment. The other two call sites ignore it, unchanged.
 */
function safely(call: () => void): boolean {
  try {
    call();
    return true;
  } catch (caught) {
    console.warn('[narration] native player call failed — likely already released', caught);
    return false;
  }
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
 * **"Is playing" is read from the player, never tracked separately.** There is no local
 * flag for it that could drift from what `expo-audio` actually did — the control's icon
 * and label are a direct function of `useAudioPlayerStatus`, so an OS interruption (a
 * call, another app) can only ever leave the control showing "paused" or "playing",
 * never a state of its own invention stuck mid-spinner.
 *
 * **`playbackFailed` has two sources, because a failed play has two shapes.** A native
 * call can throw synchronously — the already-released case `safely` exists for — which
 * `status` never learns about, because nothing reached the player for it to report on.
 * Or the call can return normally and fail *after*, the way an unreachable
 * `MEDIA_BASE_URL` (PILOT-1) does: `status.error` is `expo-audio`'s own signal for
 * that, and it is not `null` for the already-released case, so neither source alone
 * covers both. `attemptFailed` below is local state for the first; `status.error` is
 * read live for the second; `playbackFailed` is true if either is.
 */
export function useNarration(entry: AudioRef): Narration {
  const player = useAudioPlayer(entry.url);
  const status = useAudioPlayerStatus(player);
  const [attemptFailed, setAttemptFailed] = useState(false);

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
      safely(() => {
        player.pause();
      });
    };
  }, [player]);

  // No background-audio capability is requested (product decision, see
  // `audioSession.ts`), so backgrounding the app must stop the clip explicitly rather
  // than trusting the OS to tear the session down for us.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        safely(() => {
          player.pause();
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  const toggle = useCallback(() => {
    if (status.playing) {
      // Unlike the play branch below, a failed pause here has nowhere further to go:
      // the reader asked for "not playing", and — per `safely`'s docstring — that is
      // already the true state once the native call has failed this way. Swallowed
      // like the unmount and backgrounding sites.
      safely(() => {
        player.pause();
      });
    } else {
      // The one call site where the reasoning above does not hold: the reader asked
      // for "playing", the native call failed, and leaving that unsignalled is exactly
      // how the MEDIA_BASE_URL defect (PILOT-1) presented as a dead button rather than
      // an error. Cleared optimistically first so a retry does not stay stuck on a
      // previous synchronous failure once it succeeds — `status.error` clears itself
      // the same way, on `expo-audio`'s own account of its behaviour.
      setAttemptFailed(false);
      const succeeded = safely(() => {
        player.play();
      });
      if (!succeeded) {
        setAttemptFailed(true);
      }
    }
  }, [player, status.playing]);

  return { playing: status.playing, toggle, playbackFailed: attemptFailed || status.error !== null };
}
