import * as SecureStore from 'expo-secure-store';

/**
 * Whether this install has been through the activation flow — SecureStore, the same
 * key/value store `introSeenStore.ts` and `SoundProvider.tsx` already use, for the same
 * reason: it is the store this app already has, and this is one boolean, not a secret.
 *
 * Set on both exit paths of **either** onboarding variant — the five-beat flow and the
 * narrator-only one an existing account sees. There is no "seen, but only the short
 * version" — once a reader has been through whichever beats applied to them, this flag
 * says so and `RootNavigator` stops checking anything else.
 */
const ONBOARDING_SEEN_KEY = 'zoomout.onboardingSeen';

/** Unset reads as not-seen — a fresh install (or a pre-ONBOARD-1 upgrade) has not been
 *  through either variant yet. */
export async function getOnboardingSeen(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(ONBOARDING_SEEN_KEY);
  return stored === 'true';
}

export async function setOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_SEEN_KEY, 'true');
}
