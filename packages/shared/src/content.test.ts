import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  hasSourceLocator,
  isProductionPublishable,
  leafSchema,
  leafSourceReferenceSchema,
  scenarioOptionsSchema,
  SOURCE_LOCATOR_REQUIRED_MESSAGE,
  toPublicLeaf,
  trackSchema,
} from './content.js';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const option = (id: string, isCorrect: boolean): { id: string; text: string; isCorrect: boolean } => ({
  id,
  text: `Option ${id}`,
  isCorrect,
});

function buildLeafInput(): z.input<typeof leafSchema> {
  return {
    id: 'leaf-1',
    trackId: 'track-1',
    orderIndex: 0,
    title: 'Placeholder Leaf',
    status: 'draft',
    summary: { body: 'Placeholder summary copy.' },
    scenario: {
      prompt: 'Placeholder scenario prompt?',
      options: [option('a', true), option('b', false), option('c', false)],
    },
    payoff: { body: 'Placeholder payoff copy.' },
    stickyNotes: { notes: ['Placeholder note one.', 'Placeholder note two.'] },
    takeaway: { body: 'Placeholder takeaway copy.' },
    createdAt: '2026-08-06T12:00:00.000Z',
    updatedAt: '2026-08-06T12:00:00.000Z',
  };
}

function buildTrackInput(): z.input<typeof trackSchema> {
  return {
    id: 'track-1',
    bookTitle: 'Placeholder Book',
    author: 'Placeholder Author',
    publisher: 'Placeholder Publisher',
    coverUrl: 'https://example.test/cover.png',
    description: 'Placeholder description.',
    disclaimer: 'Placeholder non-endorsement disclaimer.',
    purchaseLinks: [{ retailer: 'Example Books', url: 'https://example.test/book' }],
    status: 'draft',
    leafCount: 0,
    createdAt: '2026-08-06T12:00:00.000Z',
    updatedAt: '2026-08-06T12:00:00.000Z',
  };
}

/**
 * The option-count rules are enforced by a tuple, so an invalid count is a *compile*
 * error at a typed call site — which is the point of modelling it that way. Runtime
 * data from the CMS or an HTTP body is not typed, so these tests deliberately go in
 * through `unknown` to exercise the runtime half of the same guarantee.
 */
const asRuntimeInput = (value: unknown): unknown => value;

/* -------------------------------------------------------------------------- */
/* Scenario options — exactly 3, exactly one correct                           */
/* -------------------------------------------------------------------------- */

describe('scenarioOptionsSchema', () => {
  it('accepts exactly three options with exactly one correct', () => {
    const result = scenarioOptionsSchema.safeParse([
      option('a', true),
      option('b', false),
      option('c', false),
    ]);

    expect(result.success).toBe(true);
  });

  it('rejects two options', () => {
    const result = scenarioOptionsSchema.safeParse(
      asRuntimeInput([option('a', true), option('b', false)]),
    );

    expect(result.success).toBe(false);
  });

  it('rejects four options', () => {
    const result = scenarioOptionsSchema.safeParse(
      asRuntimeInput([option('a', true), option('b', false), option('c', false), option('d', false)]),
    );

    expect(result.success).toBe(false);
  });

  it('rejects three options with no correct answer', () => {
    const result = scenarioOptionsSchema.safeParse([
      option('a', false),
      option('b', false),
      option('c', false),
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/exactly one correct option/u);
    }
  });

  it('rejects three options with two correct answers', () => {
    const result = scenarioOptionsSchema.safeParse([
      option('a', true),
      option('b', true),
      option('c', false),
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/exactly one correct option/u);
    }
  });

  it('rejects three correct answers', () => {
    const result = scenarioOptionsSchema.safeParse([
      option('a', true),
      option('b', true),
      option('c', true),
    ]);

    expect(result.success).toBe(false);
  });

  it('rejects an empty option list', () => {
    const result = scenarioOptionsSchema.safeParse(asRuntimeInput([]));

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Leaf                                                                        */
/* -------------------------------------------------------------------------- */

describe('leafSchema', () => {
  it('parses a structurally complete Leaf', () => {
    const result = leafSchema.safeParse(buildLeafInput());

    expect(result.success).toBe(true);
  });

  it('propagates the scenario option rules through the Leaf', () => {
    const input = buildLeafInput();
    const invalid = {
      ...input,
      scenario: { ...input.scenario, options: [option('a', true), option('b', true), option('c', false)] },
    };

    expect(leafSchema.safeParse(asRuntimeInput(invalid)).success).toBe(false);
  });

  it('requires every one of the five slides', () => {
    for (const slideKey of ['summary', 'scenario', 'payoff', 'stickyNotes', 'takeaway'] as const) {
      const input: Record<string, unknown> = { ...buildLeafInput() };
      delete input[slideKey];

      expect(leafSchema.safeParse(input).success, `missing ${slideKey} should fail`).toBe(false);
    }
  });

  it('defaults isPlaceholder to true when the flag is absent', () => {
    const parsed = leafSchema.parse(buildLeafInput());

    expect(parsed.isPlaceholder).toBe(true);
  });

  it('keeps isPlaceholder false when explicitly set', () => {
    const parsed = leafSchema.parse({ ...buildLeafInput(), isPlaceholder: false });

    expect(parsed.isPlaceholder).toBe(false);
  });

  it('rejects Dinner Table Knowledge without a takeaway source reference', () => {
    const input = buildLeafInput();
    const result = leafSchema.safeParse({
      ...input,
      takeaway: { ...input.takeaway, dinnerTableKnowledge: 'A deep-cut placeholder fact.' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/requires a source reference/u);
    }
  });

  it('accepts Dinner Table Knowledge when a takeaway source reference is present', () => {
    const input = buildLeafInput();
    const result = leafSchema.safeParse({
      ...input,
      takeaway: { ...input.takeaway, dinnerTableKnowledge: 'A deep-cut placeholder fact.' },
      sourceReferences: [
        { slideKey: 'takeaway', chapter: 'Chapter 4', note: 'Placeholder source note.' },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('does not accept a source reference on a different slide as cover for the takeaway', () => {
    const input = buildLeafInput();
    const result = leafSchema.safeParse({
      ...input,
      takeaway: { ...input.takeaway, dinnerTableKnowledge: 'A deep-cut placeholder fact.' },
      sourceReferences: [
        { slideKey: 'summary', chapter: 'Chapter 2', note: 'Placeholder source note.' },
      ],
    });

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Source references — note plus a locator (frozen 2026-08-08)                 */
/* -------------------------------------------------------------------------- */

describe('leafSourceReferenceSchema', () => {
  const reference = (overrides: Record<string, unknown> = {}): unknown => ({
    slideKey: 'takeaway',
    note: 'Placeholder source note.',
    ...overrides,
  });

  it.each(['chapter', 'page', 'quote'])('accepts %s as the sole locator', (locator) => {
    expect(leafSourceReferenceSchema.safeParse(reference({ [locator]: 'Something' })).success).toBe(
      true,
    );
  });

  it('accepts several locators together', () => {
    const result = leafSourceReferenceSchema.safeParse(
      reference({ chapter: 'Chapter 4', page: '87', quote: 'A short quotation.' }),
    );

    expect(result.success).toBe(true);
  });

  it('rejects a note with no locator at all', () => {
    // The gate produced exactly this: `note: "reference"` and nothing else.
    const result = leafSourceReferenceSchema.safeParse(reference());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(SOURCE_LOCATOR_REQUIRED_MESSAGE);
    }
  });

  it('names the acceptable locators in the message, not just that it is incomplete', () => {
    for (const locator of ['chapter', 'page', 'quote']) {
      expect(SOURCE_LOCATOR_REQUIRED_MESSAGE).toContain(locator);
    }
  });

  it('rejects a locator that is only whitespace', () => {
    // Trimming turns "  " into "", so a blank locator must read as absent rather
    // than satisfying the rule on a technicality.
    expect(leafSourceReferenceSchema.safeParse(reference({ chapter: '   ' })).success).toBe(false);
  });

  it('still requires the note alongside the locator', () => {
    const result = leafSourceReferenceSchema.safeParse({
      slideKey: 'takeaway',
      chapter: 'Chapter 4',
    });

    expect(result.success).toBe(false);
  });
});

describe('hasSourceLocator', () => {
  it('is false when every locator is absent', () => {
    expect(hasSourceLocator({})).toBe(false);
  });

  it('is false when every locator is blank', () => {
    expect(hasSourceLocator({ chapter: '', page: '  ', quote: '\n' })).toBe(false);
  });

  it('is true when one locator carries content', () => {
    expect(hasSourceLocator({ page: '87' })).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Sticky notes — bounded 2–6 (frozen 2026-08-08)                              */
/* -------------------------------------------------------------------------- */

describe('stickyNotesSlideSchema bounds', () => {
  const notes = (count: number): string[] =>
    Array.from({ length: count }, (_unused, index) => `Note ${String(index + 1)}`);

  it.each([2, 3, 6])('accepts %i notes', (count) => {
    const input = buildLeafInput();
    const result = leafSchema.safeParse({ ...input, stickyNotes: { notes: notes(count) } });

    expect(result.success).toBe(true);
  });

  it.each([0, 1, 7, 12])('rejects %i notes', (count) => {
    const input = buildLeafInput();
    const result = leafSchema.safeParse({ ...input, stickyNotes: { notes: notes(count) } });

    expect(result.success).toBe(false);
  });

  it('still rejects an empty note within an otherwise valid count', () => {
    const input = buildLeafInput();
    const result = leafSchema.safeParse({
      ...input,
      stickyNotes: { notes: ['Note one.', ''] },
    });

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Track                                                                       */
/* -------------------------------------------------------------------------- */

describe('trackSchema', () => {
  it('parses a valid Track', () => {
    expect(trackSchema.safeParse(buildTrackInput()).success).toBe(true);
  });

  it('defaults isPlaceholder to true when the flag is absent', () => {
    expect(trackSchema.parse(buildTrackInput()).isPlaceholder).toBe(true);
  });

  it('rejects a Track with no non-endorsement disclaimer', () => {
    expect(trackSchema.safeParse({ ...buildTrackInput(), disclaimer: '' }).success).toBe(false);

    const withoutDisclaimer: Record<string, unknown> = { ...buildTrackInput() };
    delete withoutDisclaimer['disclaimer'];
    expect(trackSchema.safeParse(withoutDisclaimer).success).toBe(false);
  });

  it('rejects a Track with no purchase-forward link', () => {
    expect(trackSchema.safeParse({ ...buildTrackInput(), purchaseLinks: [] }).success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Server authority — the answer key never reaches the client                  */
/* -------------------------------------------------------------------------- */

describe('toPublicLeaf', () => {
  it('strips isCorrect from every option', () => {
    const leaf = leafSchema.parse(buildLeafInput());
    const publicLeaf = toPublicLeaf(leaf);

    for (const publicOption of publicLeaf.scenario.options) {
      expect(publicOption).not.toHaveProperty('isCorrect');
    }
  });

  it('leaves no trace of the answer key anywhere in the serialised payload', () => {
    const leaf = leafSchema.parse(buildLeafInput());

    expect(JSON.stringify(toPublicLeaf(leaf))).not.toContain('isCorrect');
  });

  it('preserves option identity and order so the client can submit an answer', () => {
    const leaf = leafSchema.parse(buildLeafInput());
    const publicLeaf = toPublicLeaf(leaf);

    expect(publicLeaf.scenario.options.map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });
});

/* -------------------------------------------------------------------------- */
/* Placeholder content must not reach production                               */
/* -------------------------------------------------------------------------- */

describe('isProductionPublishable', () => {
  it('blocks published placeholder content', () => {
    expect(isProductionPublishable({ status: 'published', isPlaceholder: true })).toBe(false);
  });

  it('blocks draft content', () => {
    expect(isProductionPublishable({ status: 'draft', isPlaceholder: false })).toBe(false);
  });

  it('allows published non-placeholder content', () => {
    expect(isProductionPublishable({ status: 'published', isPlaceholder: false })).toBe(true);
  });

  it('blocks a record that never declared the flag, via the safe default', () => {
    const leaf = leafSchema.parse({ ...buildLeafInput(), status: 'published' });

    expect(isProductionPublishable(leaf)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Leaf v2 — WP15                                                              */
/* -------------------------------------------------------------------------- */

describe('Leaf v2 assets', () => {
  /**
   * **The Tier A guarantee of WP15, stated as a test.**
   *
   * The schema was thawed to add three fields, and the whole justification for doing
   * it that way is that the change is additive: content authored before Leaf v2 has
   * none of them and must stay valid with no backfill. `buildLeafInput` is the
   * pre-v2 fixture — every other test in this file has been parsing it since WP0.
   */
  it('accepts a Leaf with none of the new fields', () => {
    const parsed = leafSchema.parse(buildLeafInput());

    expect(parsed.scenario.image).toBeUndefined();
    expect(parsed.stickyNotes.diagram).toBeUndefined();
    expect(parsed.takeaway.applyInLife).toBeUndefined();
  });

  it('accepts a Leaf carrying all three', () => {
    const input = buildLeafInput();

    const parsed = leafSchema.parse({
      ...input,
      scenario: {
        ...input.scenario,
        image: { url: 'https://cdn.test/scenario.png', alt: 'A person choosing a path' },
      },
      stickyNotes: {
        ...input.stickyNotes,
        diagram: {
          url: 'https://cdn.test/diagram.png',
          alt: 'Two overlapping circles',
          spec: 'graph TD; A-->B;',
          specFormat: 'mermaid',
        },
      },
      takeaway: { ...input.takeaway, applyInLife: 'Try it once before Friday.' },
    });

    expect(parsed.scenario.image?.alt).toBe('A person choosing a path');
    expect(parsed.stickyNotes.diagram?.specFormat).toBe('mermaid');
    expect(parsed.takeaway.applyInLife).toBe('Try it once before Friday.');
  });

  it('rejects an image with no alt text', () => {
    // The accessibility guarantee, made unrepresentable rather than merely reviewed.
    const input = buildLeafInput();

    const result = leafSchema.safeParse({
      ...input,
      scenario: { ...input.scenario, image: { url: 'https://cdn.test/scenario.png' } },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an image with blank alt text', () => {
    // Whitespace is trimmed on save in the CMS, so `" "` arrives as `""` — it must
    // read as absent rather than satisfying the requirement on a technicality.
    const input = buildLeafInput();

    const result = leafSchema.safeParse({
      ...input,
      scenario: { ...input.scenario, image: { url: 'https://cdn.test/x.png', alt: '' } },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a diagram spec with no specFormat', () => {
    // A spec whose language is unknown cannot be re-rendered, which is the only
    // reason to keep the spec at all (content-pipeline R4).
    const input = buildLeafInput();

    const result = leafSchema.safeParse({
      ...input,
      stickyNotes: {
        ...input.stickyNotes,
        diagram: { url: 'https://cdn.test/d.png', alt: 'A diagram', spec: 'graph TD; A-->B;' },
      },
    });

    expect(result.success).toBe(false);
  });

  it('accepts a diagram with no spec at all', () => {
    // An illustration-only diagram is legitimate; the spec is what makes it editable,
    // not what makes it valid.
    const input = buildLeafInput();

    const result = leafSchema.safeParse({
      ...input,
      stickyNotes: {
        ...input.stickyNotes,
        diagram: { url: 'https://cdn.test/d.png', alt: 'A diagram' },
      },
    });

    expect(result.success).toBe(true);
  });

  it('carries the scenario image through to the client but never the answer key', () => {
    /**
     * `toPublicLeaf` is deliberately total, so adding a field to `scenario` breaks
     * compilation until it is handled — but "handled" could have meant dropping it.
     * This asserts the choice: the illustration is what the reader is meant to see,
     * and only `isCorrect` is stripped.
     */
    const input = buildLeafInput();
    const leaf = leafSchema.parse({
      ...input,
      scenario: {
        ...input.scenario,
        image: { url: 'https://cdn.test/scenario.png', alt: 'An illustration' },
      },
    });

    const publicLeaf = toPublicLeaf(leaf);

    expect(publicLeaf.scenario.image?.alt).toBe('An illustration');
    expect(JSON.stringify(publicLeaf)).not.toContain('isCorrect');
  });
});
