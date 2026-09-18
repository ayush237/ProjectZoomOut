import * as SecureStore from 'expo-secure-store';

import { DEFAULT_NARRATOR, getNarrator, setNarrator } from './narratorPreference';

/** `jest.setup.js`'s in-memory stand-in for the keychain, cleared between tests so one
 *  test's write cannot leak into the next — the same store `introSeenStore.test.ts` and
 *  `SoundProvider.tsx` both read. */
type ResettableSecureStore = typeof SecureStore & { __reset: () => void };

beforeEach(() => {
  (SecureStore as ResettableSecureStore).__reset();
});

describe('the narrator preference store', () => {
  it('defaults to male with the key unset', async () => {
    // The founder's ruling, 2026-09-18: not "whichever is listed first", asserted
    // directly rather than inferred from a UI that happens to show it.
    await expect(getNarrator()).resolves.toBe('male');
    expect(DEFAULT_NARRATOR).toBe('male');
  });

  it('reads back what was set', async () => {
    await setNarrator('female');

    await expect(getNarrator()).resolves.toBe('female');
  });

  it('stores under its own key, not one another store could collide with', async () => {
    await setNarrator('female');

    await expect(SecureStore.getItemAsync('zoomout.narrator')).resolves.toBe('female');
  });

  it('falls back to the default rather than throwing on an unrecognised stored value', async () => {
    // Not reachable through `setNarrator`'s own type, but a value already on a device
    // from a future release this one does not know about must not crash the slide it
    // gates — the safe direction on a settings read is to fall back.
    await SecureStore.setItemAsync('zoomout.narrator', 'robot');

    await expect(getNarrator()).resolves.toBe(DEFAULT_NARRATOR);
  });
});
