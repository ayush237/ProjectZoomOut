import { describe, expect, it } from 'vitest';

import {
  checkAllSlidesPopulated,
  checkAssetsHaveAltText,
  checkDiagramSpecHasFormat,
  checkDinnerTableKnowledgeIsSourced,
  checkExactlyOneCorrectOption,
  checkSourceReferencesHaveLocators,
  validateLeaf,
} from './leafRules';
import type { LeafDocumentInput, ScenarioOptionInput, SourceReferenceInput } from './types';

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
/* Source references need a locator (frozen 2026-08-08)                        */
/* -------------------------------------------------------------------------- */

describe('checkSourceReferencesHaveLocators', () => {
  const withRefs = (refs: readonly SourceReferenceInput[]): LeafDocumentInput =>
    completeLeaf({ sourceReferences: refs });

  it('passes when there are no source references at all', () => {
    expect(checkSourceReferencesHaveLocators(withRefs([])).ok).toBe(true);
  });

  it.each(['chapter', 'page', 'quote'] as const)('accepts %s as the sole locator', (locator) => {
    const result = checkSourceReferencesHaveLocators(
      withRefs([{ slideKey: 'takeaway', note: 'A note.', [locator]: 'Something' }]),
    );

    expect(result.ok).toBe(true);
  });

  it('rejects a reference with a note and nothing else', () => {
    // Exactly what the schema-freeze gate produced: note "reference", no locator.
    const result = checkSourceReferencesHaveLocators(
      withRefs([{ slideKey: 'takeaway', note: 'reference' }]),
    );

    expect(result.ok).toBe(false);
  });

  it('names all three acceptable locators in the message', () => {
    const result = checkSourceReferencesHaveLocators(
      withRefs([{ slideKey: 'takeaway', note: 'reference' }]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const { message } = result.violations[0] ?? { message: '' };
      expect(message).toMatch(/chapter/u);
      expect(message).toMatch(/page/u);
      expect(message).toMatch(/quote/u);
    }
  });

  it('treats a whitespace-only locator as absent', () => {
    const result = checkSourceReferencesHaveLocators(
      withRefs([{ slideKey: 'takeaway', note: 'A note.', chapter: '   ' }]),
    );

    expect(result.ok).toBe(false);
  });

  it('treats a null locator as absent, which is how Payload stores a cleared field', () => {
    const result = checkSourceReferencesHaveLocators(
      withRefs([{ slideKey: 'takeaway', note: 'A note.', chapter: null, page: null, quote: null }]),
    );

    expect(result.ok).toBe(false);
  });

  it('reports every offending reference, identified by position', () => {
    const result = checkSourceReferencesHaveLocators(
      withRefs([
        { slideKey: 'summary', note: 'Sourced.', chapter: 'Chapter 1' },
        { slideKey: 'payoff', note: 'Unsourced.' },
        { slideKey: 'takeaway', note: 'Also unsourced.' },
      ]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations).toHaveLength(2);
      expect(result.violations.map((v) => v.path)).toEqual([
        'sourceReferences.1',
        'sourceReferences.2',
      ]);
    }
  });

  it('is publish-gated, so an incomplete citation can still be saved as a draft', () => {
    // Deliberately asymmetric with the Dinner Table Knowledge rule: the existence of
    // a source is the same edit as writing the fact, but refining the citation is not.
    const leaf = withRefs([{ slideKey: 'takeaway', note: 'reference' }]);

    expect(validateLeaf(leaf, false).ok).toBe(true);
    expect(validateLeaf(leaf, true).ok).toBe(false);
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
      // Carries a locator as well as a note, per the 2026-08-08 ruling.
      sourceReferences: [{ slideKey: 'takeaway', chapter: 'Chapter 4', note: 'Placeholder note.' }],
    });

    expect(validateLeaf(leaf, true).ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Leaf v2 assets — WP15                                                       */
/* -------------------------------------------------------------------------- */

describe('checkAssetsHaveAltText', () => {
  /**
   * **The Tier A case.** An asset that reaches a reader without alt text is invisible
   * to anyone using VoiceOver, and these are the first images in the product.
   */
  it('rejects a scenario image with no alt text', () => {
    const leaf = completeLeaf({
      scenario: {
        prompt: 'p',
        options: [option('A', true), option('B', false), option('C', false)],
        image: { url: 'https://cdn.test/x.png' },
      },
    });

    const result = checkAssetsHaveAltText(leaf);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.violations[0]?.path).toBe('scenario.image.alt');
  });

  it('rejects a diagram with whitespace-only alt text', () => {
    // Trimming runs before validation, so `"  "` is stored blank — it must read as
    // absent rather than satisfying the rule on a technicality.
    const leaf = completeLeaf({
      stickyNotes: {
        notes: [{ note: 'n' }],
        diagram: { url: 'https://cdn.test/d.png', alt: '   ' },
      },
    });

    expect(checkAssetsHaveAltText(leaf).ok).toBe(false);
  });

  it('reports both assets when neither has alt text', () => {
    const leaf = completeLeaf({
      scenario: {
        prompt: 'p',
        options: [option('A', true), option('B', false), option('C', false)],
        image: { url: 'https://cdn.test/x.png' },
      },
      stickyNotes: { notes: [{ note: 'n' }], diagram: { url: 'https://cdn.test/d.png' } },
    });

    const result = checkAssetsHaveAltText(leaf);

    expect(result.ok === false && result.violations).toHaveLength(2);
  });

  it('passes when an asset has alt text', () => {
    const leaf = completeLeaf({
      scenario: {
        prompt: 'p',
        options: [option('A', true), option('B', false), option('C', false)],
        image: { url: 'https://cdn.test/x.png', alt: 'An illustration' },
      },
    });

    expect(checkAssetsHaveAltText(leaf).ok).toBe(true);
  });

  it('passes when there is no asset at all', () => {
    /**
     * **This is the state of all 22 existing Leaves**, and the reason the rule keys
     * presence off the URL: Payload sends an untouched group as an object of nulls, so
     * "no image" must not be mistaken for "an image missing its alt text".
     */
    expect(checkAssetsHaveAltText(completeLeaf()).ok).toBe(true);
  });

  it('passes when the group exists but is entirely empty', () => {
    const leaf = completeLeaf({
      scenario: {
        prompt: 'p',
        options: [option('A', true), option('B', false), option('C', false)],
        image: { url: null, alt: null, width: null, height: null },
      },
    });

    expect(checkAssetsHaveAltText(leaf).ok).toBe(true);
  });
});

describe('checkDiagramSpecHasFormat', () => {
  it('rejects a spec with no format', () => {
    const leaf = completeLeaf({
      stickyNotes: {
        notes: [{ note: 'n' }],
        diagram: { url: 'https://cdn.test/d.png', alt: 'A diagram', spec: 'graph TD; A-->B;' },
      },
    });

    expect(checkDiagramSpecHasFormat(leaf).ok).toBe(false);
  });

  it('passes with both, and with neither', () => {
    const withBoth = completeLeaf({
      stickyNotes: {
        notes: [{ note: 'n' }],
        diagram: {
          url: 'https://cdn.test/d.png',
          alt: 'A diagram',
          spec: 'graph TD; A-->B;',
          specFormat: 'mermaid',
        },
      },
    });

    expect(checkDiagramSpecHasFormat(withBoth).ok).toBe(true);
    expect(checkDiagramSpecHasFormat(completeLeaf()).ok).toBe(true);
  });
});

describe('the publish gate as a whole', () => {
  it('lets a draft save with an asset missing alt, but refuses to publish it', () => {
    /**
     * The asymmetry every publish rule here follows: a half-authored Leaf stays
     * saveable, and the gate is publication. Marking `alt` required at the field level
     * would have made an in-progress Leaf unsaveable instead.
     */
    const leaf = completeLeaf({
      scenario: {
        prompt: 'p',
        options: [option('A', true), option('B', false), option('C', false)],
        image: { url: 'https://cdn.test/x.png' },
      },
      sourceReferences: [{ slideKey: 'summary', chapter: 'Ch 1', note: 'A note.' }],
    });

    expect(validateLeaf(leaf, false).ok).toBe(true);
    expect(validateLeaf(leaf, true).ok).toBe(false);
  });
});
