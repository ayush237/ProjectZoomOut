import { useCallback, useEffect, useState } from 'react';

import type { ApiClient } from '../../api/client';
import { getOnboardingSeen, setOnboardingSeen } from './onboardingSeenStore';

/**
 * `restoring` while the flag read and the Library check are both in flight, so
 * `RootNavigator` can hold the same blank frame it already holds for `useAuth()`'s own
 * `restoring` and for `useIntroSeen`'s — the gate must never flash `Tabs` in front of a
 * reader who has not been through either onboarding variant, nor the other way round.
 *
 * `full` and `narratorOnly` are both "unseen", in `useIntroSeen`'s sense — the
 * difference is **which** onboarding a reader who has not been through it gets, not
 * whether they see one. Every account eventually reaches `seen`; there is no fourth
 * state to re-enter either variant once it has.
 */
export type OnboardingGateStatus = 'restoring' | 'full' | 'narratorOnly' | 'seen';

export interface UseOnboardingGateResult {
  readonly status: OnboardingGateStatus;
  /** Both exit paths of both variants call this. Flips local state immediately and
   *  persists in the background, the same split `useIntroSeen.markSeen` uses. */
  readonly markSeen: () => void;
}

/**
 * Decides which onboarding variant a signed-in reader sees, if either.
 *
 * **A Library check the intro's own gate never needed.** `useIntroSeen` answers from one
 * local flag; this has to answer from that flag *and* whether the account already has
 * books, because an existing account upgrading onto this feature has never set the flag
 * either — nothing distinguishes it from a brand-new signup except its Library. Both
 * reads run together (`Promise.all`), not the flag first: sequencing them would cost a
 * network round trip on every cold start for no reason, since the flag alone can never
 * answer `full` vs `narratorOnly`.
 *
 * **Fails open, deliberately.** If the Library read fails — a network the flag's local
 * SecureStore read does not depend on — this resolves to `seen` rather than retrying
 * forever or guessing at a variant. A returning reader kept out of the app they already
 * use by a failed onboarding check is a worse outcome than an unlucky first-time reader
 * occasionally reaching `Tabs` without the flow; the flow's job is a good first
 * impression, not a gate the app cannot function without.
 *
 * @param enabled Only fetches once true. `RootNavigator` calls this unconditionally
 *   (React's own rule), but the reader may not be signed in yet — an unauthenticated
 *   `listLibrary()` call would just fail and burn the "fails open" path for no reason.
 */
export function useOnboardingGate(
  api: Pick<ApiClient, 'listLibrary'>,
  enabled: boolean,
): UseOnboardingGateResult {
  const [status, setStatus] = useState<OnboardingGateStatus>('restoring');

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;

    void Promise.all([getOnboardingSeen(), api.listLibrary()])
      .then(([seen, library]) => {
        if (!active) {
          return;
        }
        if (seen) {
          setStatus('seen');
          return;
        }
        setStatus(library.length > 0 ? 'narratorOnly' : 'full');
      })
      .catch(() => {
        if (active) {
          setStatus('seen');
        }
      });

    return () => {
      active = false;
    };
  }, [enabled, api]);

  const markSeen = useCallback(() => {
    setStatus('seen');
    void setOnboardingSeen();
  }, []);

  return { status, markSeen };
}
