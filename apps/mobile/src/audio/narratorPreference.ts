import * as SecureStore from 'expo-secure-store';
import { NARRATOR_IDS, type NarratorId } from '@zoomout/shared';

/**
 * Which narrator a reader hears — SecureStore, the same key/value store
 * `SoundProvider.tsx` and `introSeenStore.ts` already use, for the same reason: it is
 * the store this app already has, and this is one small value, not a secret.
 */
const NARRATOR_KEY = 'zoomout.narrator';

/** The founder's ruling, 2026-09-18, made after listening to both tracks in full. */
export const DEFAULT_NARRATOR: NarratorId = 'male';

function isNarratorId(value: string | null): value is NarratorId {
  return value !== null && (NARRATOR_IDS as readonly string[]).includes(value);
}

/**
 * Unset — or holding anything that is not one of the two known ids — reads as the
 * default rather than throwing. A stored value can only get out of step with
 * `NARRATOR_IDS` if a future release ever renamed or removed one, and the safe
 * direction on a settings read is to fall back, not to crash the slide it gates.
 */
export async function getNarrator(): Promise<NarratorId> {
  const stored = await SecureStore.getItemAsync(NARRATOR_KEY);
  return isNarratorId(stored) ? stored : DEFAULT_NARRATOR;
}

export async function setNarrator(narrator: NarratorId): Promise<void> {
  await SecureStore.setItemAsync(NARRATOR_KEY, narrator);
}
