/**
 * The placeholder corpus, as data.
 *
 * Pure functions returning plain objects. The script that talks to the CMS is separate,
 * so what gets written can be inspected and tested without a server, a database or a
 * network.
 *
 * **Every string here announces itself as placeholder, and that is the whole design.**
 * `PRODUCT.md` §3.4 and `LEGAL.md` both name fabricated content attributed to a real
 * author as the highest-severity risk in this product, and the realistic version of that
 * failure is not a public launch — it is a demo build shown to five people carrying
 * invented advice under a real writer's name. Prose that *reads* like a real book
 * summary is the hazard, even flagged, even internally. So:
 *
 *  - The Track is attributed to a **fictional author**, not to a real one. There is no
 *    book to misrepresent.
 *  - No sentence offers advice, a claim, or a quotation. Each one says what slot it is
 *    filling.
 *  - `isPlaceholder` is true on every record, which is what keeps all of it out of
 *    production regardless of anything written here.
 */

/* -------------------------------------------------------------------------- */
/* Shapes, as Payload's REST API accepts them                                  */
/* -------------------------------------------------------------------------- */

export interface SeedTrack {
  readonly bookTitle: string;
  readonly author: string;
  readonly publisher: string;
  readonly coverUrl: string;
  readonly description: string;
  readonly disclaimer: string;
  readonly purchaseLinks: readonly { retailer: string; url: string; isAffiliate: boolean }[];
  readonly leafCount: number;
  readonly isPlaceholder: true;
}

export interface SeedLeaf {
  readonly trackKey: string;
  readonly orderIndex: number;
  readonly title: string;
  readonly summary: { body: string };
  readonly scenario: {
    prompt: string;
    options: readonly { text: string; isCorrect: boolean }[];
  };
  readonly payoff: { body: string };
  readonly stickyNotes: { notes: readonly { note: string }[] };
  readonly takeaway: { body: string; dinnerTableKnowledge?: string };
  readonly sourceReferences: readonly {
    slideKey: string;
    chapter: string;
    note: string;
  }[];
  readonly isPlaceholder: true;
}

/**
 * A cover that actually loads.
 *
 * `placehold.co` serves a real image at a URL ending in `.png`, which is both what the
 * new CMS rule requires and what Explore needs in order to stop rendering the fallback.
 * It is also visibly a placeholder on screen, which is the point — a stock photo would
 * make mock content look finished.
 *
 * **The colours are mid-tone on purpose.** The first version used the app's own dark
 * surface (`#141A1E`), which made the cover indistinguishable from the card behind it on
 * device — a loaded image and a failed one looked identical, so the fixture could not
 * demonstrate the very thing it exists to demonstrate. A slate that is lighter than the
 * dark theme's card and darker than the light theme's reads as a cover in both.
 */
function coverFor(label: string): string {
  return `https://placehold.co/400x600/445A66/FFFFFF.png?text=${encodeURIComponent(label)}`;
}

const DISCLAIMER =
  'PLACEHOLDER CONTENT. This Track is generated sample data for development. ' +
  'It is not a summary of any book, and ZoomOut is not affiliated with or endorsed by ' +
  'any author or publisher.';

/**
 * The full-length Track: one book's worth of structure, none of its content.
 *
 * Attributed to a fictional author on purpose — see the note at the top of this file.
 *
 * **"Demo" so it sorts ahead of "Filler".** The backend orders Explore by `bookTitle`
 * ascending and serves twenty per page. Under the original title this Track sorted 26th
 * of 27 — onto page two, which the mobile app currently has no way to reach, so the one
 * Track with any Leaves on it was invisible on device. Sorting it first is what the
 * fixture wanted anyway: whoever runs the seed should land on the full-length Track, not
 * on filler. The pagination gap itself is real and recorded separately; this does not
 * paper over it, it just stops the fixture depending on it.
 */
export const PLACEHOLDER_TRACK_TITLE = 'Placeholder Demo Track — Twenty Sample Leaves';

/**
 * Titles this fixture used to publish under, removed on the next run.
 *
 * `bookTitle` is the upsert key, so renaming a Track orphans the old record rather than
 * updating it — it would sit in the corpus with a `leafCount` of twenty and no Leaves,
 * because the Leaves are re-pointed at the new one. Deleting by name keeps the seed
 * correct across fixture revisions instead of only on a fresh database.
 */
export const RETIRED_TRACK_TITLES: readonly string[] = ['Placeholder Track — Twenty Sample Leaves'];

export function buildPlaceholderTrack(leafCount: number): SeedTrack {
  return {
    bookTitle: PLACEHOLDER_TRACK_TITLE,
    author: 'ZoomOut Sample Content (not a real author)',
    publisher: 'Independently published',
    coverUrl: coverFor('Placeholder Track'),
    description:
      'PLACEHOLDER DESCRIPTION. Generated sample data used to exercise Explore, Library, ' +
      'Journey and the progress rollup at realistic length. Contains no material from ' +
      'any book.',
    disclaimer: DISCLAIMER,
    purchaseLinks: [
      { retailer: 'Example Books (placeholder)', url: 'https://example.test/placeholder-book', isAffiliate: false },
    ],
    leafCount,
    isPlaceholder: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Leaves                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Titles of deliberately uneven length.
 *
 * Explore, Library and Journey all lay out a title beside a fixed-width cover, and a
 * corpus of uniformly short titles would never show the wrapping that a real one
 * produces — least of all at `accessibilityExtraExtraExtraLarge`. Twenty near-identical
 * strings would exercise the volume and hide the layout.
 */
const TITLE_SHAPES = [
  'Sample concept',
  'A slightly longer sample concept title',
  'Short one',
  'A deliberately long placeholder Leaf title that should wrap onto several lines on a narrow screen',
  'Sample concept with a middling title',
] as const;

/** Rotates 2–6 so the sticky-note board is exercised at both bounds and between. */
const STICKY_NOTE_COUNTS = [2, 3, 4, 5, 6] as const;

/**
 * Which option is correct, rotating through the three positions.
 *
 * A corpus where the answer is always first would let a broken grader — or a client
 * that guessed — look correct. The option *text* deliberately does not reveal which is
 * which, so the seeded Track behaves like real content when WP8 drives it.
 */
const CORRECT_INDEX_CYCLE = [0, 1, 2] as const;

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length] as T;
}

export function buildPlaceholderLeaf(trackKey: string, orderIndex: number): SeedLeaf {
  const number = orderIndex + 1;
  const noteCount = pick(STICKY_NOTE_COUNTS, orderIndex);
  const correctIndex = pick(CORRECT_INDEX_CYCLE, orderIndex);

  /**
   * Dinner Table Knowledge on every third Leaf.
   *
   * Present on some and absent on others because the two render differently and the
   * schema treats them differently — it is the one optional field on the takeaway
   * slide, and it drags a mandatory source reference along with it.
   */
  const hasDinnerTableKnowledge = orderIndex % 3 === 0;

  return {
    trackKey,
    orderIndex,
    title: `${String(number)}. ${pick(TITLE_SHAPES, orderIndex)}`,
    summary: {
      body:
        `PLACEHOLDER SUMMARY for Leaf ${String(number)}. This is generated filler text ` +
        'standing in for the summary slide. It describes no book and makes no claim. ' +
        'In the finished product this slide sets up the scenario that follows.',
    },
    scenario: {
      prompt:
        `PLACEHOLDER SCENARIO ${String(number)}. This stands in for a situation the ` +
        'reader would reason about. Exactly one option below is marked correct in the ' +
        'sample data.',
      // Text that does not betray the answer: the grader is what decides, and the
      // seeded corpus should behave like real content when WP8 drives it.
      options: [0, 1, 2].map((index) => ({
        text: `Placeholder option ${String(index + 1)} for Leaf ${String(number)}`,
        isCorrect: index === correctIndex,
      })),
    },
    payoff: {
      body:
        `PLACEHOLDER PAYOFF for Leaf ${String(number)}. This slide is what unlocks after ` +
        'a correct answer. In the finished product it explains why the answer is right; ' +
        'here it is filler and explains nothing.',
    },
    stickyNotes: {
      notes: Array.from({ length: noteCount }, (_, index) => ({
        note: `Placeholder note ${String(index + 1)} of ${String(noteCount)} (Leaf ${String(number)})`,
      })),
    },
    takeaway: {
      body:
        `PLACEHOLDER TAKEAWAY for Leaf ${String(number)}. Generated filler standing in ` +
        'for the one line a reader should leave with.',
      ...(hasDinnerTableKnowledge
        ? {
            dinnerTableKnowledge:
              `PLACEHOLDER FACT ${String(number)}. This is sample text, not a fact, and ` +
              'not drawn from any book.',
          }
        : {}),
    },
    /**
     * A source reference per slide that carries prose, each with a note **and** a
     * locator — the schema-freeze rule from 2026-08-08.
     *
     * The takeaway reference is not optional when Dinner Table Knowledge is present:
     * `leafSchema` refuses the Leaf without it, and the CMS enforces the same rule
     * independently. Seeding it correctly is what proves the seed goes through the
     * real validation rather than around it.
     */
    sourceReferences: [
      {
        slideKey: 'summary',
        chapter: `Placeholder chapter ${String(number)}`,
        note: 'Placeholder source note. No real passage is referenced.',
      },
      ...(hasDinnerTableKnowledge
        ? [
            {
              slideKey: 'takeaway',
              chapter: `Placeholder chapter ${String(number)}`,
              note: 'Placeholder source note for the sample fact above.',
            },
          ]
        : []),
    ],
    isPlaceholder: true,
  };
}

/* -------------------------------------------------------------------------- */
/* The corpus                                                                  */
/* -------------------------------------------------------------------------- */

export const PLACEHOLDER_LEAF_COUNT = 20;

/** Extra Tracks so a page boundary can actually be crossed. See the seed script. */
export const FILLER_TRACK_COUNT = 25;

export function buildFillerTrack(index: number): SeedTrack {
  const label = `Filler Track ${String(index + 1)}`;

  return {
    bookTitle: `Placeholder Filler Track ${String(index + 1).padStart(2, '0')}`,
    author: 'ZoomOut Sample Content (not a real author)',
    publisher: 'Independently published',
    coverUrl: coverFor(label),
    description:
      'PLACEHOLDER FILLER. Exists only so Explore has enough Tracks to page through. ' +
      'Has no Leaves.',
    disclaimer: DISCLAIMER,
    purchaseLinks: [
      { retailer: 'Example Books (placeholder)', url: 'https://example.test/filler', isAffiliate: false },
    ],
    leafCount: 0,
    isPlaceholder: true,
  };
}

/**
 * A Track and a Leaf that are never published.
 *
 * The corpus has never contained a draft, so nothing has ever *proven* that
 * `read: publishedOrAuthenticated` keeps one from reaching an anonymous caller — the
 * rule is definitive by inspection, and completely untested by observation. These two
 * records are what let WP14 close that gap, and what the Tier A test in this package
 * asserts against.
 */
export const DRAFT_TRACK_TITLE = 'Placeholder DRAFT Track — must never be served';

export function buildDraftTrack(): SeedTrack {
  return {
    bookTitle: DRAFT_TRACK_TITLE,
    author: 'ZoomOut Sample Content (not a real author)',
    publisher: 'Independently published',
    coverUrl: coverFor('Draft'),
    description:
      'PLACEHOLDER DRAFT. Left unpublished on purpose. If this string ever appears in a ' +
      'backend response, draft filtering has failed.',
    disclaimer: DISCLAIMER,
    purchaseLinks: [
      { retailer: 'Example Books (placeholder)', url: 'https://example.test/draft', isAffiliate: false },
    ],
    leafCount: 1,
    isPlaceholder: true,
  };
}

export const DRAFT_LEAF_TITLE = 'Placeholder DRAFT Leaf — must never be served';

export function buildDraftLeaf(trackKey: string): SeedLeaf {
  return {
    ...buildPlaceholderLeaf(trackKey, 0),
    title: DRAFT_LEAF_TITLE,
    summary: {
      body:
        'PLACEHOLDER DRAFT LEAF. Left unpublished on purpose. If this string ever appears ' +
        'in a backend response, draft filtering has failed.',
    },
  };
}
