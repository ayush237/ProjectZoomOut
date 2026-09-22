import { useCallback, useEffect, useState } from 'react';

import { getScenarioGateCoachMarkSeen, setScenarioGateCoachMarkSeen } from './scenarioGateCoachMarkStore';

export interface UseScenarioGateCoachMarkResult {
  /** `false` until the flag read resolves, same as `visible` staying `false` once it
   *  comes back seen — either way there is nothing to show yet. No `restoring` state
   *  of its own: unlike the two gates in `RootNavigator`, nothing else on screen is
   *  waiting on this answer, so a coach-mark that pops in a beat after the slide
   *  itself renders costs nothing a blocked screen would. */
  readonly visible: boolean;
  /** Both exit paths — an explicit dismiss and submitting an answer — call this. */
  readonly dismiss: () => void;
}

/**
 * Beat 5: shown once per install, the first time *this reader* reaches the scenario
 * gate — new account or existing, whichever comes first after this flag starts
 * existing. See `scenarioGateCoachMarkStore.ts` for why that is a deliberate reading of
 * "first time a new reader reaches it", not a narrower one scoped to the five-beat flow.
 */
export function useScenarioGateCoachMark(): UseScenarioGateCoachMarkResult {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;

    void getScenarioGateCoachMarkSeen().then((seen) => {
      if (active && !seen) {
        setVisible(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    void setScenarioGateCoachMarkSeen();
  }, []);

  return { visible, dismiss };
}
