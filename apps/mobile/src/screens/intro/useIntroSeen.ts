import { useCallback, useEffect, useState } from 'react';

import { getIntroSeen, setIntroSeen } from './introSeenStore';

/**
 * `restoring` while the SecureStore read is in flight, so `RootNavigator` can hold the
 * same blank frame it already holds for `useAuth()`'s own `restoring` — the flag must
 * never flash the auth stack for a reader whose install has not seen the intro yet.
 */
export type IntroSeenStatus = 'restoring' | 'unseen' | 'seen';

export interface UseIntroSeenResult {
  readonly status: IntroSeenStatus;
  /** The pre-intro's one exit calls this (INTRO-1 had two — finishing and skipping —
   *  before it moved behind sign-up). Flips local state immediately and persists in the
   *  background, the same split `SoundProvider.setEnabled` uses. */
  readonly markSeen: () => void;
}

export function useIntroSeen(): UseIntroSeenResult {
  const [status, setStatus] = useState<IntroSeenStatus>('restoring');

  useEffect(() => {
    let active = true;

    void getIntroSeen().then((seen) => {
      if (active) {
        setStatus(seen ? 'seen' : 'unseen');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const markSeen = useCallback(() => {
    setStatus('seen');
    void setIntroSeen();
  }, []);

  return { status, markSeen };
}
