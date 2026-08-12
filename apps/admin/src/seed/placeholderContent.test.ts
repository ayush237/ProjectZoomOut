import { describe, expect, it } from 'vitest';

import { validateLeaf } from '../validation/leafRules';
import { validateTrack } from '../validation/trackRules';
import type { LeafDocumentInput, TrackDocumentInput } from '../validation/types';
import {
  buildDraftLeaf,
  buildDraftTrack,
  buildFillerTrack,
  buildPlaceholderLeaf,
  buildPlaceholderTrack,
  FILLER_TRACK_COUNT,
  PLACEHOLDER_LEAF_COUNT,
  PLACEHOLDER_TRACK_TITLE,
  RETIRED_TRACK_TITLES,
} from './placeholderContent';

/**
 * The seeded corpus, checked before it reaches a CMS.
 *
 * Two things matter here and they are not the same thing. **That the content is valid**
 * — every seeded Leaf must publish through the CMS's own rules, because a seed that
 * needs a rule bypassed to work is a seed that proves nothing. And **that the content
 * is unmistakably placeholder**, which is the Tier A concern: this package is the first
 * time the corpus contains material that must never escape, and the realistic failure
 * is a demo build carrying invented advice under a real author's name.
 */

const everyLeaf = Array.from({ length: PLACEHOLDER_LEAF_COUNT }, (_, index) =>
  buildPlaceholderLeaf(PLACEHOLDER_TRACK_TITLE, index),
);

describe('the seeded content is valid by the CMS’s own rules', () => {
  it('publishes the Track', () => {
    // Runs the real publish rules, including the new cover-image check.
    const track = buildPlaceholderTrack(PLACEHOLDER_LEAF_COUNT) as TrackDocumentInput;

    expect(validateTrack(track, true).ok).toBe(true);
  });

  it('publishes every filler Track', () => {
    for (let index = 0; index < 3; index += 1) {
      expect(validateTrack(buildFillerTrack(index) as TrackDocumentInput, true).ok).toBe(true);
    }
  });

  it.each(everyLeaf.map((leaf, index) => [index, leaf] as const))(
    'publishes Leaf %i',
    (_index, leaf) => {
      // Every one, not a sample: a single malformed Leaf out of twenty fails the seed
      // halfway through and leaves the corpus in a partial state.
      const result = validateLeaf(leaf, true);

      expect(result.ok).toBe(true);
    },
  );

  it('publishes the draft fixtures too, so only their status keeps them hidden', () => {
    // If the draft records were invalid they would be excluded for the wrong reason,
    // and the draft-filtering test would pass without proving anything.
    expect(validateTrack(buildDraftTrack() as TrackDocumentInput, true).ok).toBe(true);
    expect(
      validateLeaf(buildDraftLeaf(PLACEHOLDER_TRACK_TITLE) as unknown as LeafDocumentInput, true).ok,
    ).toBe(true);
  });
});

describe('the seeded content is unmistakably placeholder', () => {
  it('flags the Track and every Leaf', () => {
    expect(buildPlaceholderTrack(20).isPlaceholder).toBe(true);
    expect(buildDraftTrack().isPlaceholder).toBe(true);
    expect(buildFillerTrack(0).isPlaceholder).toBe(true);

    for (const leaf of everyLeaf) {
      expect(leaf.isPlaceholder).toBe(true);
    }
  });

  it('attributes the Track to nobody real', () => {
    /**
     * The hazard this package exists closest to. `LEGAL.md` names fabricated content
     * attributed to a real author as the highest-severity risk in the product, so the
     * seed sidesteps it entirely rather than relying on a flag: there is no real book
     * and no real author to misrepresent.
     */
    const track = buildPlaceholderTrack(20);

    expect(track.author.toLowerCase()).toContain('not a real author');
    expect(track.bookTitle.toLowerCase()).toContain('placeholder');
  });

  it('says so in every piece of prose a reader can see', () => {
    // Reader-visible prose only. A flag in the database does not help someone looking
    // at a demo build.
    for (const leaf of everyLeaf) {
      for (const prose of [
        leaf.summary.body,
        leaf.scenario.prompt,
        leaf.payoff.body,
        leaf.takeaway.body,
      ]) {
        expect(prose.toLowerCase()).toContain('placeholder');
      }
    }
  });

  it('carries a disclaimer saying the Track summarises no book', () => {
    expect(buildPlaceholderTrack(20).disclaimer.toLowerCase()).toContain('not a summary of any book');
  });
});

describe('the corpus exercises the surfaces', () => {
  it('produces the full-length Track', () => {
    expect(everyLeaf).toHaveLength(20);
  });

  it('orders the Leaves contiguously from zero', () => {
    // The rollup picks the resume target by `orderIndex`; duplicates or gaps here would
    // make Journey's target arbitrary.
    expect(everyLeaf.map((leaf) => leaf.orderIndex)).toEqual(
      Array.from({ length: PLACEHOLDER_LEAF_COUNT }, (_, index) => index),
    );
  });

  it('varies title length enough to show wrapping', () => {
    // A corpus of uniformly short titles exercises the volume and hides the layout —
    // which is exactly what twenty Leaves are here to reveal.
    const lengths = everyLeaf.map((leaf) => leaf.title.length);

    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(40);
  });

  it('spans the full sticky-note range', () => {
    const counts = new Set(everyLeaf.map((leaf) => leaf.stickyNotes.notes.length));

    expect(Math.min(...counts)).toBe(2);
    expect(Math.max(...counts)).toBe(6);
  });

  it('includes Leaves with and without Dinner Table Knowledge', () => {
    const withFact = everyLeaf.filter((leaf) => leaf.takeaway.dinnerTableKnowledge !== undefined);

    expect(withFact.length).toBeGreaterThan(0);
    expect(withFact.length).toBeLessThan(everyLeaf.length);
  });

  it('puts the correct answer in every position across the corpus', () => {
    /**
     * A corpus where the answer is always first would let a broken grader — or a client
     * that simply guessed — look correct all the way through a demo.
     */
    const positions = new Set(
      everyLeaf.map((leaf) => leaf.scenario.options.findIndex((option) => option.isCorrect)),
    );

    expect([...positions].sort()).toEqual([0, 1, 2]);
  });

  it('never reveals the answer in the option text', () => {
    // The seeded Track should behave like real content when WP8 drives it.
    for (const leaf of everyLeaf) {
      for (const option of leaf.scenario.options) {
        expect(option.text.toLowerCase()).not.toContain('correct');
      }
    }
  });

  it('gives every Leaf exactly one correct option', () => {
    for (const leaf of everyLeaf) {
      expect(leaf.scenario.options.filter((option) => option.isCorrect)).toHaveLength(1);
    }
  });
});

describe('the full-length Track is reachable', () => {
  it('sorts ahead of every filler Track', () => {
    /**
     * Explore is ordered by `bookTitle` ascending, twenty to a page, and the app has no
     * way to reach page two. Under its first name this Track sorted 26th of 27 and was
     * invisible on device — the fixture shipped its whole point out of reach. This test
     * is what stops a future rename doing it again.
     */
    const fillers = Array.from({ length: FILLER_TRACK_COUNT }, (_, index) =>
      buildFillerTrack(index).bookTitle,
    );

    for (const filler of fillers) {
      expect(PLACEHOLDER_TRACK_TITLE.localeCompare(filler)).toBeLessThan(0);
    }
  });

  it('never lists its own current title as retired', () => {
    // The seed deletes retired titles before it writes. Listing the live one would make
    // every run delete and recreate the Track, losing its id and any progress against it.
    expect(RETIRED_TRACK_TITLES).not.toContain(PLACEHOLDER_TRACK_TITLE);
  });
});

describe('cover images', () => {
  it('point at an image, not a page', () => {
    // The WP7 defect this package inherits: the previous Track's cover was an Amazon
    // product page, so every Explore card rendered the fallback.
    for (const track of [buildPlaceholderTrack(20), buildFillerTrack(0), buildDraftTrack()]) {
      expect(new URL(track.coverUrl).pathname).toMatch(/\.png$/u);
    }
  });

  it('pass the new CMS cover rule', () => {
    expect(validateTrack(buildPlaceholderTrack(20) as TrackDocumentInput, true).ok).toBe(true);
  });
});
