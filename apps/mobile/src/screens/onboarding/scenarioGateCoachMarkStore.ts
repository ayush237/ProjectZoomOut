import * as SecureStore from 'expo-secure-store';

/**
 * Beat 5: whether this install has seen the coach-mark explaining the scenario gate —
 * SecureStore, the same store `onboardingSeenStore.ts` and `introSeenStore.ts` use, for
 * the same reason.
 *
 * **A separate flag from `onboardingSeenStore`'s, on purpose.** The five-beat flow ends
 * once beat 3 hands off into `LeafPlayer` (`onboardingSeenStore` is already written by
 * then) — beat 5 fires *inside* that same Leaf, the first time `ScenarioSlide` itself
 * mounts, which is a different moment for a different component to own. Keying it to
 * the main flag would mean an existing account routed straight to `Tabs` (the
 * narrator-only variant, which never opens a Leaf at all) never gets a chance to see
 * this coach-mark on their own first scenario slide either, since the flag would
 * already read "seen" by the time they got there.
 */
const SCENARIO_GATE_COACH_MARK_SEEN_KEY = 'zoomout.scenarioGateCoachMarkSeen';

export async function getScenarioGateCoachMarkSeen(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(SCENARIO_GATE_COACH_MARK_SEEN_KEY);
  return stored === 'true';
}

export async function setScenarioGateCoachMarkSeen(): Promise<void> {
  await SecureStore.setItemAsync(SCENARIO_GATE_COACH_MARK_SEEN_KEY, 'true');
}
