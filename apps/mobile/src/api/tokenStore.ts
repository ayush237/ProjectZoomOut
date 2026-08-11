import * as SecureStore from 'expo-secure-store';

/**
 * Where the refresh token lives.
 *
 * **`expo-secure-store`, never `AsyncStorage`.** AsyncStorage is an unencrypted file in
 * the app container: readable from a filesystem backup, and readable outright on a
 * jailbroken device. A refresh token is a long-lived credential that mints access
 * tokens, so storing it there would make device access equivalent to account access.
 * SecureStore is the Keychain on iOS and the Keystore on Android.
 *
 * The **access token is deliberately not persisted at all** — it lives in memory in the
 * client. It expires in fifteen minutes, so persisting it buys nothing across a cold
 * start except one more copy of a credential on disk.
 */

export interface TokenStore {
  readRefreshToken(): Promise<string | null>;
  writeRefreshToken(token: string): Promise<void>;
  clear(): Promise<void>;
}

const REFRESH_TOKEN_KEY = 'zoomout.refreshToken';

export class SecureTokenStore implements TokenStore {
  public async readRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  }

  public async writeRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
      // The token is only ever used by a foreground request the reader initiated, so
      // it does not need to survive being read while the device is locked. This is the
      // narrowest accessibility level that still works after a reboot-and-unlock.
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  public async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

/**
 * In-memory store, for tests.
 *
 * Exported from the app rather than defined in each test file so there is one
 * definition of the contract, and a change to `TokenStore` breaks it once.
 */
export class MemoryTokenStore implements TokenStore {
  private token: string | null = null;

  constructor(initial: string | null = null) {
    this.token = initial;
  }

  public readRefreshToken(): Promise<string | null> {
    return Promise.resolve(this.token);
  }

  public writeRefreshToken(token: string): Promise<void> {
    this.token = token;
    return Promise.resolve();
  }

  public clear(): Promise<void> {
    this.token = null;
    return Promise.resolve();
  }
}
