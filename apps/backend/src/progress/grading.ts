import type { Leaf } from '@zoomout/shared';

import { UnknownScenarioOptionError } from './progress.errors.js';

/**
 * Grading — the one mechanic the whole product rests on.
 *
 * A pure function over a Leaf and a submitted option id. No database, no clock, no
 * reader: everything stateful lives in the service above it, so the rule itself can be
 * read in one screen and tested without a container.
 *
 * **This is the only place `isCorrect` is read on a request path.** It is deliberately
 * a function taking the full `Leaf` rather than a method on something that could
 * accidentally be serialised: the answer key is an argument here and never a field on
 * anything returned.
 */

/**
 * Grades a submitted answer.
 *
 * Keys on the option's id, never on its position. Option ids are Payload row ids —
 * stable hex strings that survive an author reordering the options, which array
 * positions do not. WP3 rejects a Leaf whose options lack ids for exactly this reason,
 * so an id is always present by the time a Leaf reaches here.
 *
 * @throws {UnknownScenarioOptionError} if the id is not one of this Leaf's options.
 *   Distinct from a wrong answer, and it records no attempt — see `progress.errors.ts`.
 */
export function gradeAnswer(leaf: Leaf, submittedOptionId: string): boolean {
  const option = leaf.scenario.options.find((candidate) => candidate.id === submittedOptionId);

  if (option === undefined) {
    throw new UnknownScenarioOptionError();
  }

  return option.isCorrect;
}
