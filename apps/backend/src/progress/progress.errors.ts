import { AppError } from '../errors.js';

/**
 * Failures in the learning loop.
 *
 * The distinction that runs through this file is between **a wrong answer and a broken
 * request**. A wrong answer is a successful interaction — it is most of what the
 * product is for — and it returns 200 with `correct: false`. An option id that belongs
 * to no scenario, or to a different Leaf's scenario, is a client defect: nothing was
 * graded, no attempt was recorded, and reporting it as "incorrect" would let a bug in
 * the mobile app look like a reader who keeps guessing wrong.
 */

/**
 * The submitted option id is not one of this Leaf's three options.
 *
 * Deliberately does not say whether the id exists elsewhere in the CMS. A reader
 * probing ids across Leaves learns nothing from the response either way, and there is
 * no legitimate client that would need to tell the two cases apart.
 */
export class UnknownScenarioOptionError extends AppError {
  public readonly statusCode = 400;
  public readonly code = 'UNKNOWN_SCENARIO_OPTION';

  constructor() {
    super('That answer option does not belong to this Leaf');
  }
}

/**
 * Completion was attempted before the scenario was answered correctly.
 *
 * 409 rather than 403: the request is well-formed and the reader is entitled to
 * complete this Leaf — just not yet, and the state that blocks it is one they can
 * change by answering. A 403 would suggest an access problem no retry can fix.
 *
 * This is the gate that makes XP mean something. Without it a client could skip
 * straight to completion and collect the award without ever engaging with the
 * scenario, which is the entire mechanic being bypassed in one request.
 */
export class LeafNotUnlockedError extends AppError {
  public readonly statusCode = 409;
  public readonly code = 'LEAF_NOT_UNLOCKED';

  constructor() {
    super('Answer the scenario correctly before completing this Leaf');
  }
}
