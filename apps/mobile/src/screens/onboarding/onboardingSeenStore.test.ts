import * as SecureStore from 'expo-secure-store';

import { getOnboardingSeen, setOnboardingSeen } from './onboardingSeenStore';

/** `jest.setup.js`'s in-memory stand-in for the keychain, cleared between tests so one
 *  test's write cannot leak into the next — the same store `introSeenStore.test.ts` uses. */
type ResettableSecureStore = typeof SecureStore & { __reset: () => void };

beforeEach(() => {
  (SecureStore as ResettableSecureStore).__reset();
});

describe('the onboarding seen-flag store', () => {
  it('defaults to not seen when nothing has been written', async () => {
    await expect(getOnboardingSeen()).resolves.toBe(false);
  });

  it('reads back seen after being set', async () => {
    await setOnboardingSeen();

    await expect(getOnboardingSeen()).resolves.toBe(true);
  });

  it('stores under its own key, not one another store could collide with', async () => {
    await setOnboardingSeen();

    await expect(SecureStore.getItemAsync('zoomout.onboardingSeen')).resolves.toBe('true');
  });
});
