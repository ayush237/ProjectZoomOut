import type { TrackProgressSummary } from '@zoomout/shared';

/**
 * Rolling a reader's per-Leaf completions up to a per-Track summary.
 *
 * Pure, and separated from everything that fetches, because the interesting cases here
 * are ordering and emptiness rather than IO: which Leaf "resume" points at when the
 * completed ones are scattered through the Track, and what a Track with no Leaves means.
 *
 * The caller supplies **visible** Leaves only. This function does not know about drafts
 * or placeholders, and must not: visibility is `ContentService`'s decision, and a second
 * copy of that rule here would be one more thing to keep in step.
 */

/** The minimum a Leaf has to offer to be counted and ordered. */
export interface CountableLeaf {
  readonly id: string;
  readonly orderIndex: number;
}

export function summariseTrackProgress(
  trackId: string,
  leaves: readonly CountableLeaf[],
  completedLeafIds: ReadonlySet<string>,
): TrackProgressSummary {
  /**
   * Sorted here rather than trusted from the caller.
   *
   * `listLeavesForTrack` asks Payload to sort by `orderIndex`, but "resume points at the
   * right Leaf" is the acceptance criterion and it should not rest on a query parameter
   * in another module staying correct. Sorting a handful of Leaves costs nothing.
   */
  const ordered = [...leaves].sort((a, b) => a.orderIndex - b.orderIndex);

  const completedLeaves = ordered.filter((leaf) => completedLeafIds.has(leaf.id)).length;
  const next = ordered.find((leaf) => !completedLeafIds.has(leaf.id));

  return {
    trackId,
    totalLeaves: ordered.length,
    completedLeaves,
    nextLeafId: next?.id ?? null,
    // An empty Track is not a finished one — see the note on the shared schema.
    isComplete: ordered.length > 0 && completedLeaves === ordered.length,
  };
}
