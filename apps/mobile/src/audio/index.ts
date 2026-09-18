/**
 * Slide narration (VO-3): the player, its audio-session setup, and the narrator
 * preference. Screens import from here, never from the individual files — the same
 * rule `src/design/index.ts` follows, for the same reason.
 */

export { DEFAULT_NARRATOR, getNarrator, setNarrator } from './narratorPreference';
export { useNarrator, type UseNarratorResult } from './useNarrator';
export { selectNarration } from './selectNarration';
export { NarrationControl, type NarrationControlProps } from './NarrationControl';
