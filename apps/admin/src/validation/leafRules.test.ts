import { describe, expect, it } from 'vitest';

import {
  checkAllSlidesPopulated,
  checkDinnerTableKnowledgeIsSourced,
  checkExactlyOneCorrectOption,
  validateLeaf,
} from './leafRules';
import type { LeafDocumentInput, ScenarioOptionInput } from './types';

const option = (text: string, isCorrect: boolean): ScenarioOptionInput => ({ text, isCorrect });

function completeLeaf(overrides: Partial<LeafDocumentInput> = {}): LeafDocumentInput {
  return {
    title: 'Placeholder Leaf',
    summary: { body: 'Placeholder summary.' },
    scenario: {
      prompt: 'Placeholder prompt?',
      options: [option('A', true), option('B', false), option('C', false)],
    },
    payoff: { body: 'Placeholder payoff.' },
    stickyNotes: { notes: [{ note: 'Placeholder note.' }] },
    takeaway: { body: 'Placeholder takeaway.' },
    sourceReferences: [],
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Exactly one correct option                                                  */
/* -------------------------------------------------------------------------- */

describe('checkExactlyOneCorrectOption', () => {
  it('passes with exactly one correct option', () => {
    const result = checkExactlyOneCorrectOption(completeLeaf());

    expect(result.ok).toBe(true);
  });

  it('fails when no option is correct', () => {
    const leaf = completeLeaf({
      scenario: {
        prompt: 'p',
        options: [option('A', false), option('B', false), option('C', false)],
      },
    });

    const result = checkExactlyOneCorrectOption(leaf);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.message).toMatch(/none is marked correct/u);
    }
  });

  it('fails when two options are correct', () => {
    const leaf = completeLeaf({
      scenario: {
        prompt: 'p',
        options: [option('A', true), option('B', true), option('C', false)],
      },
    });

    const result = checkExactlyOneCorrectOption(leaf);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.message).toMatch(/2 are marked correct/u);
    }
  });

  it('fails when all three options are correct', () => {
    const leaf = completeLeaf({
      scenario: {
        prompt: 'p',
        options: [option('A', true), option('B', true), option('C', true)],
      },
    });

    expect(checkExactlyOneCorrectOption(leaf).ok).toBe(false);
  });

  it('treats a null isCorrect as not correct', () => {
    const leaf = completeLeaf({
      scenario: {
        prompt: 'p',
        options: [
          { text: 'A', isCorrect: null },
          { text: 'B', isCorrect: null },
          { text: 'C', isCorrect: null },
        ],
      },
    });

    expect(checkExactlyOneCorrectOption(leaf).ok).toBe(false);
  });

  it('passes when the scenario has no options yet, leaving row count to Payload', () => {
    // minRows/maxRows already enforce "exactly three". Duplicating that here would
    // surface two errors for one authoring mistake.
    expect(checkExactlyOneCorrectOption(completeLeaf({ scenario: { prompt: 'p' } })).ok).toBe(true);
  });

  it('passes when the scenario group itself is absent', () => {
    expect(checkExactlyOneCorrectOption({}).ok).toBe(true);
  });

  it('attaches the error to the options field', () => {
    const leaf = completeLeaf({
      scenario: { prompt: 'p', options: [option('A', false), option('B', false), option('C', false)] },
    });

    const result = checkExactlyOneCorrectOption(leaf);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.path).toBe('scenario.options');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Dinner Table Knowledge must be sourced                                      */
/* -------------------------------------------------------------------------- */

describe('checkDinnerTableKnowledgeIsSourced', () => {
  it('passes when there is no Dinner Table Knowledge', () => {
    expect(checkDinnerTableKnowledgeIsSourced(completeLeaf()).ok).toBe(true);
  });

  it('fails when the fact is present with no source references at all', () => {
    const leaf = completeLeaf({
      takeaway: { body: 't', dinnerTableKnowledge: 'A striking fact.' },
      sourceReferences: [],
    });

    const result = checkDinnerTableKnowledgeIsSourced(leaf);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.message).toMatch(/Source Reference/u);
    }
  });

  it('fails when the only source reference is for a different slide', () => {
    const leaf = completeLeaf({
      takeaway: { body: 't', dinnerTableKnowledge: 'A striking fact.' },
      sourceReferences: [{ slideKey: 'summary', note: 'Chapter 2.' }],
    });

    expect(checkDinnerTableKnowledgeIsSourced(leaf).ok).toBe(false);
  });

  it('fails when the takeaway source reference has an empty note', () => {
    const leaf = completeLeaf({
      takeaway: { body: 't', dinnerTableKnowledge: 'A striking fact.' },
      sourceReferences: [{ slideKey: 'takeaway', note: '   ' }],
    });

    expect(checkDinnerTableKnowledgeIsSourced(leaf).ok).toBe(false);
  });

  it('passes when a takeaway source reference with a note exists', () => {
    const leaf = completeLeaf({
      takeaway: { body: 't', dinnerTableKnowledge: 'A striking fact.' },
      sourceReferences: [{ slideKey: 'takeaway', note: 'Chapter 4, page 87.' }],
    });

    expect(checkDinnerTableKnowledgeIsSourced(leaf).ok).toBe(true);
  });

  it('passes when a takeaway source sits alongside references for other slides', () => {
    const leaf = completeLeaf({
      takeaway: { body: 't', dinnerTableKnowledge: 'A striking fact.' },
      sourceReferences: [
        { slideKey: 'summary', note: 'Chapter 1.' },
        { slideKey: 'takeaway', note: 'Chapter 4.' },
      ],
    });

    expect(checkDinnerTableKnowledgeIsSourced(leaf).ok).toBe(true);
  });

  it('treats a whitespace-only fact as absent', () => {
    const leaf = completeLeaf({ takeaway: { body: 't', dinnerTableKnowledge: '   ' } });

    expect(checkDinnerTableKnowledgeIsSourced(leaf).ok).toBe(true);
  });

  it('tells the author how to fix it, not just that it is broken', () => {
    const leaf = completeLeaf({
      takeaway: { body: 't', dinnerTableKnowledge: 'A striking fact.' },
    });

    const result = checkDinnerTableKnowledgeIsSourced(leaf);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.message).toMatch(/Add a Source Reference/u);
      expect(result.violations[0]?.message).toMatch(/or.*remove the fact/su);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* All five slides populated                                                   */
/* -------------------------------------------------------------------------- */

describe('checkAllSlidesPopulated', () => {
  it('passes for a complete Leaf', () => {
    expect(checkAllSlidesPopulated(completeLeaf()).ok).toBe(true);
  });

  it.each([
    ['summary', { summary: null }],
    ['payoff', { payoff: null }],
    ['takeaway', { takeaway: null }],
    ['stickyNotes', { stickyNotes: { notes: [] } }],
  ] as const)('fails when the %s slide is empty', (slideKey, override) => {
    const result = checkAllSlidesPopulated(completeLeaf(override));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((v) => v.path)).toContain(slideKey);
    }
  });

  it('fails when the scenario prompt is missing', () => {
    const leaf = completeLeaf({
      scenario: { options: [option('A', true), option('B', false), option('C', false)] },
    });

    expect(checkAllSlidesPopulated(leaf).ok).toBe(false);
  });

  it('fails when a scenario option has no text', () => {
    const leaf = completeLeaf({
      scenario: { prompt: 'p', options: [option('A', true), option('', false), option('C', false)] },
    });

    expect(checkAllSlidesPopulated(leaf).ok).toBe(false);
  });

  it('reports every missing slide at once rather than one at a time', () => {
    const result = checkAllSlidesPopulated({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations).toHaveLength(5);
    }
  });

  it('treats whitespace-only content as empty', () => {
    expect(checkAllSlidesPopulated(completeLeaf({ summary: { body: '  \n ' } })).ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Composition                                                                 */
/* -------------------------------------------------------------------------- */

describe('validateLeaf', () => {
  it('allows an incomplete draft to be saved', () => {
    const draft: LeafDocumentInput = { title: 'Work in progress' };

    expect(validateLeaf(draft, false).ok).toBe(true);
  });

  it('blocks that same incomplete draft from being published', () => {
    const draft: LeafDocumentInput = { title: 'Work in progress' };

    expect(validateLeaf(draft, true).ok).toBe(false);
  });

  it('enforces the correct-option rule even on an unpublished draft', () => {
    const draft = completeLeaf({
      scenario: { prompt: 'p', options: [option('A', true), option('B', true), option('C', false)] },
    });

    expect(validateLeaf(draft, false).ok).toBe(false);
  });

  it('enforces the Dinner Table Knowledge rule even on an unpublished draft', () => {
    const draft = completeLeaf({
      takeaway: { body: 't', dinnerTableKnowledge: 'Unsourced claim.' },
    });

    expect(validateLeaf(draft, false).ok).toBe(false);
  });

  it('accumulates violations from every failing rule', () => {
    const leaf: LeafDocumentInput = {
      scenario: { prompt: '', options: [option('A', true), option('B', true), option('C', false)] },
      takeaway: { body: '', dinnerTableKnowledge: 'Unsourced claim.' },
    };

    const result = validateLeaf(leaf, true);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // one for the correct-option count, one for the unsourced fact, plus the
      // incomplete slides.
      expect(result.violations.length).toBeGreaterThan(2);
    }
  });

  it('passes a complete, correctly sourced Leaf on publish', () => {
    const leaf = completeLeaf({
      takeaway: { body: 't', dinnerTableKnowledge: 'A striking fact.' },
      sourceReferences: [{ slideKey: 'takeaway', note: 'Chapter 4.' }],
    });

    expect(validateLeaf(leaf, true).ok).toBe(true);
  });
});
