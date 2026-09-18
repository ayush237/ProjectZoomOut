import { useCallback, useEffect, useState } from 'react';
import type { NarratorId } from '@zoomout/shared';

import { DEFAULT_NARRATOR, getNarrator, setNarrator as persistNarrator } from './narratorPreference';

export interface UseNarratorResult {
  readonly narrator: NarratorId;
  /** Flips local state immediately and persists in the background — the same split
   *  `SoundProvider.setEnabled` and `useIntroSeen.markSeen` both use. */
  readonly setNarrator: (narrator: NarratorId) => void;
}

/**
 * The reader's narrator, read once per mount and kept in local state thereafter.
 *
 * Deliberately not a Context, unlike `SoundProvider`: nothing in this app shows the
 * narration control and the Profile setting at the same time, so there is no
 * simultaneous-consumers case that would need one shared instance. Each mount pays for
 * its own SecureStore read, the same trade `useIntroSeen` already makes for the same
 * reason — and the handoff that added this file asked for it to invent no shared
 * preferences abstraction that `introSeenStore`'s own package did not already need.
 */
export function useNarrator(): UseNarratorResult {
  const [narrator, setNarratorState] = useState<NarratorId>(DEFAULT_NARRATOR);

  useEffect(() => {
    let active = true;

    void getNarrator().then((stored) => {
      if (active) {
        setNarratorState(stored);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const updateNarrator = useCallback((next: NarratorId) => {
    setNarratorState(next);
    void persistNarrator(next);
  }, []);

  return { narrator, setNarrator: updateNarrator };
}
