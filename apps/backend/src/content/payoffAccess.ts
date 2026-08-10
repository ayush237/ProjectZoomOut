/**
 * Whether a reader has earned the payoff slide of a Leaf.
 *
 * Declared here, in the content module, and implemented in the progress module — a
 * port, not a dependency. Content delivery has to *ask* whether the payoff is unlocked,
 * but it must not know what unlocking involves, or the CMS boundary would start
 * carrying progress logic.
 *
 * The direction matters: without this, either `ContentService` reaches into progress
 * (coupling the CMS boundary to the reader's state) or the payoff ships to every reader
 * and the unlock gate becomes decorative — which is the failure plan §3.6 exists to
 * prevent, and with it the product's whole active-recall thesis.
 */
export interface PayoffAccessPolicy {
  /**
   * @returns true once this reader has answered this Leaf's scenario correctly.
   *
   * Answers the question for a reader who has never started the Leaf too — `false` —
   * so callers never have to distinguish "no progress" from "locked".
   */
  isPayoffUnlocked(userId: string, leafId: string): Promise<boolean>;
}
