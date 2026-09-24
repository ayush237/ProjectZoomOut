import * as SecureStore from 'expo-secure-store';

/**
 * Whether this install has ever shown the intro — SecureStore, same key/value store
 * `SoundProvider.tsx` uses for its sound preference, for the same reason: it is the
 * store this app already has, and this is one boolean, not a secret.
 *
 * **ONBOARD-3: this now gates the pre-intro, not INTRO-1's animation.** The key and its
 * once-per-install semantics are unchanged on purpose — the pre-intro is a component swap
 * in the same place, not a new gate. The known consequence is not a bug: an install that
 * already saw INTRO-1 under this key will not see the pre-intro, and clearing app storage
 * resets it. INTRO-1 itself has no flag any more; it plays whenever the account is `full`.
 */
const INTRO_SEEN_KEY = 'zoomout.introSeen';

/** Unset reads as not-seen — a fresh install has never played the intro. */
export async function getIntroSeen(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(INTRO_SEEN_KEY);
  return stored === 'true';
}

/** Both exit paths call this — finishing and skipping alike. There is no "seen, but…". */
export async function setIntroSeen(): Promise<void> {
  await SecureStore.setItemAsync(INTRO_SEEN_KEY, 'true');
}
