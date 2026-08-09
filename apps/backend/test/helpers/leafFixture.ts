import type { Leaf } from '@zoomout/shared';

/**
 * A valid domain `Leaf`, for unit tests that need one without a CMS.
 *
 * Lives under `test/helpers` rather than `src` so it cannot be compiled into `dist` —
 * `tsconfig.build.json` includes all of `src` and excludes only `*.test.ts`, so a
 * fixture placed next to the code it supports would ship to production.
 *
 * `o1` is the correct option. Tests read better asserting against a known-good id than
 * against whichever entry happens to carry the flag.
 */
export function buildLeaf(overrides: Partial<Leaf> = {}): Leaf {
  return {
    id: 'l1',
    trackId: 't1',
    orderIndex: 0,
    title: 'Concept One',
    status: 'published',
    isPlaceholder: true,
    summary: { body: 'Summary.' },
    scenario: {
      prompt: 'Prompt?',
      options: [
        { id: 'o1', text: 'The right one', isCorrect: true },
        { id: 'o2', text: 'A wrong one', isCorrect: false },
        { id: 'o3', text: 'Another wrong one', isCorrect: false },
      ],
    },
    payoff: { body: 'Payoff prose.' },
    stickyNotes: { notes: ['One', 'Two'] },
    takeaway: { body: 'Takeaway.' },
    sourceReferences: [],
    createdAt: '2026-08-08T12:00:00.000Z',
    updatedAt: '2026-08-08T12:00:00.000Z',
    ...overrides,
  };
}
