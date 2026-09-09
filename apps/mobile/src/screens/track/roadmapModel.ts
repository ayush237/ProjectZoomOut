/**
 * Which Leaf is done, which is next, and which is still ahead.
 *
 * **The client has no per-Leaf completion flag.** `LeafSummary` carries
 * `{id, trackId, orderIndex, title, isPlaceholder}` and `TrackProgressSummary` carries
 * counts plus `nextLeafId` — nothing joins the two. So the three node states have to be
 * *derived*, and the derivation rests on an assumption: that the reader's completions
 * have no gaps, and therefore that the first `completedLeaves` Leaves in `orderIndex`
 * order are exactly the done ones.
 *
 * **That assumption is checked rather than trusted.** `nextLeafId` is documented as "the
 * first incomplete Leaf in `orderIndex` order", which makes the check exact: the Leaf at
 * index `completedLeaves` must *be* `nextLeafId`. If it is not, the counts and the
 * pointer disagree, and this module refuses to guess — it drops every derived claim and
 * keeps only what the server asserted directly. A roadmap that confidently paints six
 * Leaves complete when the reader finished a different six is worse than one that
 * declines to say, and this project has twice been bitten by trusting a derived count.
 *
 * Kept separate from both the geometry and the component so the failure branch is a
 * unit test rather than a device session someone has to contrive a broken server for.
 */

import type { LeafSummary } from '../../api/client';
import type { TrackProgressSummary } from '@zoomout/shared';

/**
 * The four states a cell on the map can be in.
 *
 * **`revisit` is rendered but unreachable, deliberately, as of WP22.2.** The design
 * source (`design/claude_design/proto/graph.jsx`) has four node treatments and this
 * screen shipped three, because nothing the client receives says a Leaf is due for
 * review: `TrackProgressSummary` carries counts and a `nextLeafId`, and `LeafSummary`
 * carries no completion or recall data at all. The ruling that dropped it in WP22 was
 * about the *data*, and it still stands; it was never about the drawing. So the state,
 * its geometry and its paint all exist and are tested, and `buildRoadmapModel` never
 * returns it. Whatever eventually decides a Leaf needs revisiting — a spaced-repetition
 * pass, a failed payoff, an author's correction — will have a rendered state waiting for
 * it rather than a design question reopened months later.
 */
export type LeafNodeState = 'done' | 'next' | 'revisit' | 'locked';

/**
 * How much of the reader's progress this roadmap can honestly claim.
 *
 *  - `known` — a progress rollup arrived and the cross-check passed. Every state below
 *    is trustworthy.
 *  - `unknown` — there is no rollup for this Track. It is not on the reader's shelf, or
 *    the library request failed. Nothing is claimed done, and nothing is claimed next.
 *  - `inconsistent` — a rollup arrived and contradicted itself. The server's own
 *    `nextLeafId` is still honoured, because the server asserted it; every *derived*
 *    completion is dropped.
 */
export type ProgressConfidence = 'known' | 'unknown' | 'inconsistent';

export interface RoadmapNode {
  readonly leafId: string;
  readonly orderIndex: number;
  /** The Leaf's real title, verbatim. Truncation for display happens at the label. */
  readonly title: string;
  readonly isPlaceholder: boolean;
  readonly state: LeafNodeState;
}

export interface RoadmapModel {
  readonly nodes: readonly RoadmapNode[];
  readonly confidence: ProgressConfidence;
  readonly completedLeaves: number;
  readonly totalLeaves: number;
  /** Where "continue" goes. Null when there is nowhere to go, or nowhere trustworthy. */
  readonly nextLeafId: string | null;
}

/**
 * Builds the roadmap's reader-state model.
 *
 * `progress` is nullable because this screen is reachable from Explore, where the book
 * may not be on the reader's shelf at all and no rollup exists to fetch.
 */
export function buildRoadmapModel(
  leaves: readonly LeafSummary[],
  progress: TrackProgressSummary | null,
): RoadmapModel {
  // A copy, not a sort in place: `leaves` is the fetched response and other callers may
  // hold it. The backend already sorts, but sorting here means the derivation below
  // does not silently depend on that continuing to be true.
  const sorted = [...leaves].sort((a, b) => a.orderIndex - b.orderIndex);

  if (progress === null) {
    return {
      nodes: sorted.map((leaf) => toNode(leaf, 'locked')),
      confidence: 'unknown',
      completedLeaves: 0,
      totalLeaves: sorted.length,
      nextLeafId: null,
    };
  }

  if (!isConsistent(sorted, progress)) {
    return {
      nodes: sorted.map((leaf) =>
        toNode(leaf, leaf.id === progress.nextLeafId ? 'next' : 'locked'),
      ),
      confidence: 'inconsistent',
      // Reported as zero rather than as the server's count: the count is one half of
      // the contradiction, and repeating it beside a map that shows nothing complete
      // would put two different answers on the same screen.
      completedLeaves: 0,
      totalLeaves: sorted.length,
      nextLeafId: progress.nextLeafId,
    };
  }

  return {
    nodes: sorted.map((leaf, index) => toNode(leaf, stateAt(index, progress))),
    confidence: 'known',
    completedLeaves: progress.completedLeaves,
    totalLeaves: sorted.length,
    nextLeafId: progress.nextLeafId,
  };
}

function toNode(leaf: LeafSummary, state: LeafNodeState): RoadmapNode {
  return {
    leafId: leaf.id,
    orderIndex: leaf.orderIndex,
    title: leaf.title,
    isPlaceholder: leaf.isPlaceholder,
    state,
  };
}

function stateAt(index: number, progress: TrackProgressSummary): LeafNodeState {
  if (index < progress.completedLeaves) {
    return 'done';
  }

  return index === progress.completedLeaves ? 'next' : 'locked';
}

/**
 * The cross-check, stated exactly once.
 *
 * Two cases, and the second is the one that is easy to forget: a *finished* Track has
 * `completedLeaves === totalLeaves` and `nextLeafId === null`, so "the Leaf at index
 * `completedLeaves`" does not exist and the correct assertion is that the pointer is
 * null. An empty Track takes the same branch, which is right — `nextLeafId` is
 * documented as null for both.
 */
function isConsistent(sorted: readonly LeafSummary[], progress: TrackProgressSummary): boolean {
  const completed = progress.completedLeaves;

  if (!Number.isInteger(completed) || completed < 0 || completed > sorted.length) {
    return false;
  }

  if (completed === sorted.length) {
    return progress.nextLeafId === null;
  }

  return sorted[completed]?.id === progress.nextLeafId;
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * **`DONE_LABEL_CHARS` and `LOCKED_LABEL_CHARS` were removed in WP22.2.** They were
 * fixed budgets — 26 and 18 characters — chosen before anyone knew how much gutter a
 * label would have, and they were what produced a one-line stub beside every cell. The
 * budget is now derived per node from the room that node actually has and from the OS
 * text scale; see `roadmapLabels.ts`. Deliberately not replaced by a new constant: a
 * constant is the thing that was wrong.
 */

/**
 * Shortens a title to fit beside a node.
 *
 * **Truncation only.** The result is always a prefix of the input, plus an ellipsis;
 * nothing here rewords, abbreviates or paraphrases. That is not fussiness about copy:
 * every generated line in this product is traceable to a source, and a label the app
 * composed itself would be text with no provenance sitting on a screen whose whole
 * legal footing is that ZoomOut points at books rather than rewriting them.
 *
 * Breaks on a word boundary when there is one, because a title cut mid-word reads as a
 * rendering bug rather than as a deliberate abbreviation.
 */
export function truncateTitle(title: string, maxChars: number): string {
  const trimmed = title.trim();

  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');

  // Only honour the word boundary if it leaves something worth reading; otherwise a
  // long first word would truncate to almost nothing.
  const kept = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;

  return `${kept.trimEnd()}…`;
}

/**
 * What the Leaf the reader is up to says on its card.
 *
 * **Only that one node now.** Every other label goes through `roadmapLabels.ts`, which
 * wraps to the gutter it actually has rather than to a constant — see that module for
 * why a fixed character count could not survive the WP22.2 port. The card is the one
 * place on this screen with room for a whole sentence, so it gets the whole sentence.
 */
export function labelFor(node: RoadmapNode): string {
  return node.title.trim();
}
