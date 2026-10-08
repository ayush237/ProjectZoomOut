import { describe, expect, it } from 'vitest';

import {
  joinNames,
  narratorName,
  slideLabel,
  staleHeading,
  staleParagraphs,
  unavailableLine,
} from './narrationWarning';

describe('the stale-narration wording', () => {
  const paragraphs = staleParagraphs({
    slide: 'payoff',
    narrators: ['female', 'male'],
    orderIndex: 8,
  }).join('\n');

  it('names the slide', () => {
    expect(staleHeading('payoff')).toMatch(/Payoff/u);
    expect(paragraphs).toMatch(/Payoff slide/u);
  });

  it('names both narrators by the names a reader hears and the ids the pipeline uses', () => {
    expect(paragraphs).toMatch(/Lara \(female\) and Druv \(male\)/u);
  });

  it('says readers will get no narration once this is published', () => {
    expect(paragraphs).toMatch(/no narration/u);
    expect(paragraphs).toMatch(/once this is published/u);
  });

  it('says the clips are kept and the slide plays again when the Leaf is re-narrated', () => {
    expect(paragraphs).toMatch(/clips stay in the CMS/u);
    expect(paragraphs).toMatch(/plays again/u);
    expect(paragraphs).toMatch(/re-narrated/u);
  });

  it('gives the pipeline step with this Leaf’s own orderIndex', () => {
    expect(paragraphs).toMatch(/narrate --leaf 8\b/u);
  });

  it('says plainly that saving and publishing are not blocked', () => {
    expect(paragraphs).toMatch(/does not stop you saving or publishing/u);
  });

  it('shows a placeholder, not "undefined", while the form has no orderIndex yet', () => {
    const early = staleParagraphs({ slide: 'summary', narrators: ['male'], orderIndex: undefined });

    expect(early.join('\n')).toMatch(/narrate --leaf <orderIndex>/u);
    expect(early.join('\n')).not.toMatch(/undefined|null/u);
  });

  it('names only the narrators it is given', () => {
    const one = staleParagraphs({ slide: 'scenario', narrators: ['male'], orderIndex: 0 }).join('\n');

    expect(one).toMatch(/Druv \(male\)/u);
    expect(one).not.toMatch(/Lara/u);
  });

  it('keeps orderIndex 0, which is a real Leaf, rather than treating it as missing', () => {
    const first = staleParagraphs({ slide: 'summary', narrators: ['female'], orderIndex: 0 });

    expect(first.join('\n')).toMatch(/narrate --leaf 0\b/u);
  });
});

describe('narratorName', () => {
  it('shows the reader-facing name with the id', () => {
    expect(narratorName('female')).toBe('Lara (female)');
    expect(narratorName('male')).toBe('Druv (male)');
  });

  it('shows an id it does not know as it is', () => {
    expect(narratorName('robot')).toBe('robot');
  });
});

describe('joinNames', () => {
  it.each([
    [[], ''],
    [['A'], 'A'],
    [['A', 'B'], 'A and B'],
    [['A', 'B', 'C'], 'A, B and C'],
  ])('joins %j', (names, expected) => {
    expect(joinNames(names)).toBe(expected);
  });
});

describe('slideLabel', () => {
  it('uses the names the Leaf form uses', () => {
    expect(
      (['summary', 'scenario', 'payoff', 'takeaway'] as const).map((slide) => slideLabel(slide)),
    ).toEqual(['Summary', 'Scenario', 'Payoff', 'Takeaway']);
  });
});

describe('unavailableLine', () => {
  it('says the check could not be made, and why', () => {
    const line = unavailableLine('the form has no audio list for this slide');

    expect(line).toMatch(/unavailable/iu);
    expect(line).toMatch(/no audio list/u);
    expect(line).toMatch(/could not be checked/u);
  });
});
