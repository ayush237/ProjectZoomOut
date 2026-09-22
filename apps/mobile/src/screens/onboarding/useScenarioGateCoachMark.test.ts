import { renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { flush } from '../../testing/flush';
import { getScenarioGateCoachMarkSeen, setScenarioGateCoachMarkSeen } from './scenarioGateCoachMarkStore';
import { useScenarioGateCoachMark } from './useScenarioGateCoachMark';

type ResettableSecureStore = typeof SecureStore & { __reset: () => void };

beforeEach(() => {
  (SecureStore as ResettableSecureStore).__reset();
});

describe('useScenarioGateCoachMark', () => {
  it('becomes visible once the flag resolves not-seen', async () => {
    const { result } = await renderHook(() => useScenarioGateCoachMark());

    await waitFor(() => {
      expect(result.current.visible).toBe(true);
    });
  });

  it('stays hidden when the flag is already set', async () => {
    await setScenarioGateCoachMarkSeen();

    const { result } = await renderHook(() => useScenarioGateCoachMark());

    // Nothing to wait for reaching `true` — asserting it never does.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.visible).toBe(false);
  });

  it('dismiss hides it immediately and persists in the background', async () => {
    const { result } = await renderHook(() => useScenarioGateCoachMark());

    await waitFor(() => {
      expect(result.current.visible).toBe(true);
    });

    await flush(() => {
      result.current.dismiss();
    });

    expect(result.current.visible).toBe(false);
    await expect(getScenarioGateCoachMarkSeen()).resolves.toBe(true);
  });
});
