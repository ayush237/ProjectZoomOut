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
 * state to re-enter either variant once it has. (This flag gates the *account's* first
 * run. The pre-intro and the INTRO-1 animation each have their own gate — the pre-intro's
 * is `useIntroSeen`, and INTRO-1 has none: it plays whenever this resolves `full`.)
 */
export type OnboardingGateStatus = 'restoring' | 'full' | 'narratorOnly' | 'seen';

/**
 * The two onboardings there are — the gate's answer once it is neither `restoring` nor
 * `seen`. Handed to the narrator beat **explicitly** (ONBOARD-3), because that screen is
 * the one place both variants meet and, since the reorder, nothing else distinguishes
 * them: it used to tell `narratorOnly` from `full` by whether a picked Track had been
 * passed to it, and neither variant passes one any more.
 */
export type OnboardingVariant = Exclude<OnboardingGateStatus, 'restoring' | 'seen'>;

export interface UseOnboardingGateResult {
  readonly status: OnboardingGateStatus;
  /**
   * Ends the reader's onboarding for good. Flips local state immediately and persists in
   * the background, the same split `useIntroSeen.markSeen` uses.
   *
   * **When it fires is the part that matters, and it is not "whenever a beat ends"**
   * (ONBOARD-3 — each row is pinned by a test):
   *
   * | Path | Fires |
   * |---|---|
   * | Skip on the promise, or on pick-book | immediately — an explicit skip is a decision |
   * | `narratorOnly`: narrator → Continue | at Continue — there is no first Leaf to wait for |
   * | `full`: narrator → Continue, then pick-book → into Leaf 1 | at **neither** |
   * | `full`: pick-book cannot reach Leaf 1 (its lookup failed) | at pick-book — the flow is over for them, and nothing later will close it |
   * | `full`: `WrapUp`'s closing appears | on mount — they have finished their first Leaf and been shown the close |
   * | Quits mid-first-Leaf | never — see below |
   *
   * A reader who quits mid-first-Leaf is never marked seen. Their book is already in the
   * Library, so on the next launch this gate resolves `narratorOnly`: they meet the
   * narrator beat once more, are marked seen at its Continue, and never see the closing.
   * Accepted because the alternative is persisting "onboarding in progress", which this
   * flow deliberately does not have.
   */
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
