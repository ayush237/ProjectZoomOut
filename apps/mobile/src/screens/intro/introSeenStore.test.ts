import * as SecureStore from 'expo-secure-store';

import { getIntroSeen, setIntroSeen } from './introSeenStore';

/** `jest.setup.js`'s in-memory stand-in for the keychain, cleared between tests so one
 *  test's write cannot leak into the next — the same store `SoundProvider.tsx` reads. */
type ResettableSecureStore = typeof SecureStore & { __reset: () => void };

beforeEach(() => {
  (SecureStore as ResettableSecureStore).__reset();
});

describe('the intro seen-flag store', () => {
  it('defaults to not seen when nothing has been written', async () => {
    await expect(getIntroSeen()).resolves.toBe(false);
  });

  it('reads back seen after being set', async () => {
    await setIntroSeen();

    await expect(getIntroSeen()).resolves.toBe(true);
  });

  it('stores under its own key, not a value another store could collide with', async () => {
    await setIntroSeen();

    await expect(SecureStore.getItemAsync('zoomout.introSeen')).resolves.toBe('true');
  });
});
