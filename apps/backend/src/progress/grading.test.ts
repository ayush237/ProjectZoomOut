import { describe, expect, it } from 'vitest';

import { buildLeaf } from '../../test/helpers/leafFixture.js';
import { gradeAnswer } from './grading.js';
import { UnknownScenarioOptionError } from './progress.errors.js';

/**
 * Grading — the mechanic the product rests on.
 *
 * The distinction these tests exist to protect is between **a wrong answer and a broken
 * request**. Conflating them is the easy mistake: both are "not correct" from ten feet
 * away, but one is the product working and the other is a client bug, and treating the
 * second as the first would spend a reader's first-try bonus on someone else's
 * defect — silently, and with no way to tell afterwards.
 */

describe('gradeAnswer', () => {
  it('accepts the correct option', () => {
    expect(gradeAnswer(buildLeaf(), 'o1')).toBe(true);
  });

  it.each(['o2', 'o3'])('rejects wrong option %s', (optionId) => {
    expect(gradeAnswer(buildLeaf(), optionId)).toBe(false);
  });

  it('throws rather than grading an option id that does not exist', () => {
    // Not `false`. Nothing was answered, so nothing should be counted as an attempt.
    expect(() => gradeAnswer(buildLeaf(), 'no-such-option')).toThrow(UnknownScenarioOptionError);
  });

  it('throws on an option id belonging to a different Leaf', () => {
    // The realistic version of the above: ids are globally unique CMS row ids, so a
    // client that muddles two Leaves sends a real id to the wrong scenario. If that
    // graded as "wrong", a mobile navigation bug would look like a struggling reader.
    const other = buildLeaf({
      id: 'l2',
      scenario: {
        prompt: 'A different prompt?',
        options: [
          { id: 'x1', text: 'A', isCorrect: true },
          { id: 'x2', text: 'B', isCorrect: false },
          { id: 'x3', text: 'C', isCorrect: false },
        ],
      },
    });

    expect(() => gradeAnswer(buildLeaf(), other.scenario.options[0].id)).toThrow(
      UnknownScenarioOptionError,
    );
  });

  it('rejects an empty option id', () => {
    expect(() => gradeAnswer(buildLeaf(), '')).toThrow(UnknownScenarioOptionError);
  });

  it('keys on the option id, not its position', () => {
    // An author reordering the options in the CMS must not change which answer is
    // correct. This is why WP3 refuses a Leaf whose options have no stable row ids.
    const [first, second, third] = buildLeaf().scenario.options;
    const reordered = buildLeaf({
      scenario: { prompt: 'Prompt?', options: [third, second, first] },
    });

    expect(gradeAnswer(reordered, 'o1')).toBe(true);
    expect(gradeAnswer(reordered, 'o3')).toBe(false);
  });
});
