import type { AudioRef, NarratorId } from '@zoomout/shared';

/**
 * Picks the clip for one narrator out of a slide's audio array, or none.
 *
 * **Matches on `narrator`, never on position or `id`** — array order carries no
 * meaning (the schema ruling in `packages/shared/src/content.ts`), and
 * `content.mapper.ts` fills this array per-entry: a slide can legitimately arrive with
 * only the other narrator, or with neither. There is no "closest" or "first" to fall
 * back to — the founder's rule is that a reader who picks one narrator must never be
 * handed the other mid-book, so an absent match returns `undefined`, not a substitute.
 */
export function selectNarration(
  audio: readonly AudioRef[] | undefined,
  narrator: NarratorId,
): AudioRef | undefined {
  return (audio ?? []).find((entry) => entry.narrator === narrator);
}
