import { renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { LibraryEntry } from '../../api/client';

import { flush } from '../../testing/flush';
import { getOnboardingSeen, setOnboardingSeen } from './onboardingSeenStore';
import { useOnboardingGate } from './useOnboardingGate';

type ResettableSecureStore = typeof SecureStore & { __reset: () => void };

beforeEach(() => {
  (SecureStore as ResettableSecureStore).__reset();
});

const ENTRY = {} as LibraryEntry;

function apiReturning(entries: readonly LibraryEntry[]): { listLibrary: jest.Mock } {
  return { listLibrary: jest.fn().mockResolvedValue(entries) };
}

function apiRejecting(): { listLibrary: jest.Mock } {
  return { listLibrary: jest.fn().mockRejectedValue(new Error('network down')) };
}

describe('useOnboardingGate', () => {
  it('starts restoring, while the Library check is still in flight', async () => {
    // A promise that never settles, so the hook can never race past `restoring` no
    // matter how fast this environment resolves microtasks — the failure mode a
    // same-tick-resolving mock would hide.
    const api = { listLibrary: jest.fn(() => new Promise<readonly LibraryEntry[]>(() => undefined)) };
    const { result } = await renderHook(() => useOnboardingGate(api, true));

    expect(result.current.status).toBe('restoring');
  });

  it('stays restoring, and never calls the API, while disabled', async () => {
    const api = apiReturning([]);
    const { result } = await renderHook(() => useOnboardingGate(api, false));

    // Nothing to await for — the point is that nothing ever fires.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.status).toBe('restoring');
    expect(api.listLibrary).not.toHaveBeenCalled();
  });

  it('resolves to full for a signed-in reader with an empty Library and no flag', async () => {
    const { result } = await renderHook(() => useOnboardingGate(apiReturning([]), true));

    await waitFor(() => {
      expect(result.current.status).toBe('full');
    });
  });

  it('resolves to narratorOnly for a signed-in reader with a non-empty Library and no flag', async () => {
    // The Library check the intro's own gate never needed — mutation check: swap the
    // branch condition and this is the test that reds.
    const { result } = await renderHook(() => useOnboardingGate(apiReturning([ENTRY]), true));

    await waitFor(() => {
      expect(result.current.status).toBe('narratorOnly');
    });
  });

  it('resolves to seen when the flag is already set, even with an empty Library', async () => {
    // The flag wins outright — a reader who finished the full flow moments ago and
    // whose Library add has not landed yet must not be routed back into it.
    await setOnboardingSeen();

    const { result } = await renderHook(() => useOnboardingGate(apiReturning([]), true));

    await waitFor(() => {
      expect(result.current.status).toBe('seen');
    });
  });

  it('fails open to seen when the Library check errors, rather than retrying forever', async () => {
    const { result } = await renderHook(() => useOnboardingGate(apiRejecting(), true));

    await waitFor(() => {
      expect(result.current.status).toBe('seen');
    });
  });

  it('markSeen flips local state immediately and persists in the background', async () => {
    const { result } = await renderHook(() => useOnboardingGate(apiReturning([]), true));

    await waitFor(() => {
      expect(result.current.status).toBe('full');
    });

    await flush(() => {
      result.current.markSeen();
    });

    expect(result.current.status).toBe('seen');
    await expect(getOnboardingSeen()).resolves.toBe(true);
  });
});
