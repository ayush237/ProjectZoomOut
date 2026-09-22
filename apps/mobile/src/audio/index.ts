/**
 * Slide narration (VO-3): the player, its audio-session setup, and the narrator
 * preference. Screens import from here, never from the individual files — the same
 * rule `src/design/index.ts` follows, for the same reason.
 */

export { DEFAULT_NARRATOR, getNarrator, setNarrator } from './narratorPreference';
export { useNarrator, type UseNarratorResult } from './useNarrator';
export { selectNarration } from './selectNarration';
export { NarrationControl, type NarrationControlProps } from './NarrationControl';
/**
 * The lower-level player `NarrationControl` is built on. `NarrationControl` picks its
 * clip from the reader's *current* narrator preference (`useNarrator` +
 * `selectNarration`, internally) and cannot be pointed at a specific narrator on
 * demand — which is exactly what ONBOARD-1's beat 3 needs, to let a reader preview a
 * voice before it becomes their preference. Exported here, not reached for via the
 * individual file, so that rule stays true even for this one exception.
 */
export { useNarration, type Narration } from './useNarration';
