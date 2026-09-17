import { createHash } from 'node:crypto';

import type { TrackAcquisition } from '@zoomout/shared';
import type { Leaf as CmsLeaf, Track as CmsTrack } from '@zoomout/shared/cms';
import { describe, expect, it } from 'vitest';

import { mapLeaf, mapTrack } from './content.mapper.js';

/**
 * Fixtures are shaped the way Payload actually responds — nullable everywhere, array
 * rows as objects with their own ids, numeric document ids — rather than the way the
 * domain model wants them. Mapping tests written against tidy input would pass while
 * the real thing fails.
 */

/**
 * The `baseUrl` every test passes to `mapTrack`/`mapLeaf` (WP15.8). Real Payload's own
 * default, so a test that gets this wrong looks exactly like one that gets it right —
 * deliberately, since the fixtures below carry both relative and absolute URLs and the
 * point is that only the relative ones move.
 */
const BASE_URL = 'http://127.0.0.1:3001/api';

function cmsTrack(overrides: Partial<CmsTrack> = {}): CmsTrack {
  return {
    id: 1,
    bookTitle: 'Placeholder Book',
    author: 'Placeholder Author',
    publisher: 'Placeholder Publisher',
    coverUrl: 'https://example.test/cover.png',
    description: 'Placeholder description.',
    disclaimer: 'ZoomOut is not affiliated with or endorsed by the author or publisher.',
    purchaseLinks: [
      { retailer: 'Example Books', url: 'https://example.test/book', isAffiliate: null, id: 'r1' },
    ],
    leafCount: 20,
    acquisition: 'undocumented',
    isPlaceholder: true,
    createdAt: '2026-08-08T12:00:00.000Z',
    updatedAt: '2026-08-08T12:00:00.000Z',
    _status: 'published',
    ...overrides,
  };
}

function cmsLeaf(overrides: Partial<CmsLeaf> = {}): CmsLeaf {
  return {
    id: 42,
    trackId: 1,
    orderIndex: 0,
    title: 'Concept One',
    summary: { body: 'Placeholder summary.' },
    scenario: {
      prompt: 'Placeholder prompt?',
      options: [
        { text: 'Option A', isCorrect: true, id: 'o1' },
        { text: 'Option B', isCorrect: false, id: 'o2' },
        { text: 'Option C', isCorrect: null, id: 'o3' },
      ],
    },
    payoff: { body: 'Placeholder payoff.' },
    stickyNotes: {
      notes: [
        { note: 'Note one', id: 'n1' },
        { note: 'Note two', id: 'n2' },
      ],
    },
    takeaway: { body: 'Placeholder takeaway.', dinnerTableKnowledge: null },
    sourceReferences: [
      {
        slideKey: 'summary',
        chapter: 'Chapter 1',
        page: null,
        quote: null,
        note: 'A note.',
        id: 's1',
      },
    ],
    isPlaceholder: true,
    createdAt: '2026-08-08T12:00:00.000Z',
    updatedAt: '2026-08-08T12:00:00.000Z',
    _status: 'published',
    ...overrides,
  };
}

/** The generated type of `stickyNotes.diagram.specFormat` — the union a negative test has to escape. */
type CmsSpecFormat = NonNullable<
  NonNullable<NonNullable<CmsLeaf['stickyNotes']>['diagram']>['specFormat']
>;

const expectOk = <T>(result: { ok: boolean; value?: T; reasons?: readonly string[] }): T => {
  expect(result.ok, `expected mapping to succeed, got: ${(result.reasons ?? []).join(' | ')}`).toBe(
    true,
  );
  return result.value as T;
};

/**
 * Like `expectOk`, but also surfaces `warnings` — the non-fatal, per-entry channel
 * VO-1.1 added for dropped audio. Kept separate from `expectOk` rather than widening
 * it: most existing tests in this file have no opinion on warnings, and asserting an
 * empty array everywhere would be noise, not coverage.
 */
const expectMapped = <T>(
  result:
    | { ok: true; value: T; warnings: readonly string[] }
    | { ok: false; reasons: readonly string[] },
): { value: T; warnings: readonly string[] } => {
  expect(
    result.ok,
    `expected mapping to succeed, got: ${result.ok ? '' : result.reasons.join(' | ')}`,
  ).toBe(true);
  if (!result.ok) {
    throw new Error('unreachable — the assertion above already failed');
  }
  return result;
};

/** sha256, lowercase hex — computed the same way the mapper computes it, for building fixtures. */
const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/* -------------------------------------------------------------------------- */
/* Track                                                                       */
/* -------------------------------------------------------------------------- */

describe('mapTrack', () => {
  it('maps a complete published Track', () => {
    const track = expectOk(mapTrack(cmsTrack(), BASE_URL));

    expect(track.bookTitle).toBe('Placeholder Book');
    expect(track.status).toBe('published');
  });

  it('stringifies the numeric id', () => {
    // Payload's Postgres adapter uses serial integers; cmsIdSchema is a string.
    const track = expectOk(mapTrack(cmsTrack({ id: 7 }), BASE_URL));

    expect(track.id).toBe('7');
  });

  it('defaults a null isAffiliate to false', () => {
    const track = expectOk(mapTrack(cmsTrack(), BASE_URL));

    expect(track.purchaseLinks[0]?.isAffiliate).toBe(false);
  });

  it('treats a missing _status as draft, the safe direction', () => {
    const track = expectOk(mapTrack(cmsTrack({ _status: null }), BASE_URL));

    expect(track.status).toBe('draft');
  });

  it.each([
    ['publisher', { publisher: null }],
    ['coverUrl', { coverUrl: null }],
    ['disclaimer', { disclaimer: null }],
    ['description', { description: null }],
  ] as const)('rejects a Track with no %s', (field, override) => {
    const result = mapTrack(cmsTrack(override), BASE_URL);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.join(' ')).toContain(field);
    }
  });

  it('rejects a Track with no purchase links', () => {
    // Purchase-forward framing is the mitigation for the market-substitution factor.
    expect(mapTrack(cmsTrack({ purchaseLinks: [] }), BASE_URL).ok).toBe(false);
  });

  it('rejects a non-URL cover', () => {
    expect(mapTrack(cmsTrack({ coverUrl: 'not-a-url' }), BASE_URL).ok).toBe(false);
  });

  /**
   * `acquisition` (WP15.1). Records where a Track's source text came from, so that
   * "which Tracks must be regenerated once the acquisition question resolves?" stays a
   * query rather than an act of memory.
   */
  describe('acquisition', () => {
    it.each(['public-domain', 'licensed', 'purchased', 'undocumented'] as const)(
      'carries %s through',
      (status) => {
        const track = expectOk(mapTrack(cmsTrack({ acquisition: status }), BASE_URL));

        expect(track.acquisition).toBe(status);
      },
    );

    it('defaults to undocumented when the CMS document has no value', () => {
      // The 28 Tracks that predate the field. Payload's generated type says the field is
      // always present because the collection marks it required — but that describes
      // documents written *since* the column existed, and the cast is how a row written
      // before it is expressed. `undocumented` is not a repair here; it is the honest
      // reading of a Track nobody has answered the question for.
      const legacy = { ...cmsTrack(), acquisition: undefined } as unknown as CmsTrack;

      expect(expectOk(mapTrack(legacy, BASE_URL)).acquisition).toBe('undocumented');
    });

    it('rejects a status outside the four', () => {
      const result = mapTrack(
        cmsTrack({ acquisition: 'borrowed' as unknown as TrackAcquisition }),
        BASE_URL,
      );

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reasons.join(' ')).toContain('acquisition');
    });

    it('does not gate publishing', () => {
      // Deliberate, and the thing most likely to be "helpfully" tightened later: the
      // acquisition policy is an unmade launch decision, so enforcing one here would
      // block content on a rule nobody has written.
      const track = expectOk(
        mapTrack(cmsTrack({ acquisition: 'undocumented', _status: 'published' }), BASE_URL),
      );

      expect(track.status).toBe('published');
    });
  });

  it('names the Track in its rejection reasons', () => {
    const result = mapTrack(cmsTrack({ id: 99, publisher: null }), BASE_URL);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons[0]).toContain('Track 99');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Leaf                                                                        */
/* -------------------------------------------------------------------------- */

describe('mapLeaf', () => {
  it('maps a complete published Leaf', () => {
    const leaf = expectOk(mapLeaf(cmsLeaf(), BASE_URL));

    expect(leaf.title).toBe('Concept One');
    expect(leaf.id).toBe('42');
  });

  describe('trackId relationship', () => {
    it('accepts a bare id, which is what depth=0 returns', () => {
      expect(expectOk(mapLeaf(cmsLeaf({ trackId: 5 }), BASE_URL)).trackId).toBe('5');
    });

    it('accepts a populated Track, in case the depth is ever raised', () => {
      // Guards against a future depth change producing "[object Object]" as a trackId.
      const leaf = expectOk(mapLeaf(cmsLeaf({ trackId: cmsTrack({ id: 5 }) }), BASE_URL));

      expect(leaf.trackId).toBe('5');
    });
  });

  it('flattens sticky note rows into plain strings', () => {
    const leaf = expectOk(mapLeaf(cmsLeaf(), BASE_URL));

    expect(leaf.stickyNotes.notes).toEqual(['Note one', 'Note two']);
  });

  it('maps a null isCorrect to false', () => {
    const leaf = expectOk(mapLeaf(cmsLeaf(), BASE_URL));

    expect(leaf.scenario.options[2].isCorrect).toBe(false);
  });

  it('omits dinnerTableKnowledge when null rather than passing undefined through', () => {
    const leaf = expectOk(mapLeaf(cmsLeaf(), BASE_URL));

    expect(leaf.takeaway).not.toHaveProperty('dinnerTableKnowledge');
  });

  /**
   * Leaf v2 (WP15). These three fields are the whole reason the package exists, and
   * every one of them is optional — so the mapper dropping them silently looks exactly
   * like content that has none. That is not a hypothetical: the first cut of WP15
   * shipped the CMS fields and the player components with no mapping between them, and
   * the app rendered a Leaf that had all three authored as though it had none.
   */
  describe('Leaf v2 assets', () => {
    const image = {
      url: 'https://cdn.test/scenario.png',
      alt: 'A commuter checking their phone on a platform',
      width: 800,
      height: 450,
    };

    it('carries the scenario image through', () => {
      const leaf = expectOk(
        mapLeaf(cmsLeaf({ scenario: { ...cmsLeaf().scenario, image } }), BASE_URL),
      );

      expect(leaf.scenario.image).toEqual(image);
    });

    it('carries the diagram, its spec and its format through', () => {
      const leaf = expectOk(
        mapLeaf(
          cmsLeaf({
            stickyNotes: {
              ...cmsLeaf().stickyNotes,
              diagram: {
                url: 'https://cdn.test/loop.png',
                alt: 'Cue leads to routine leads to reward',
                spec: 'graph LR; cue-->routine-->reward',
                specFormat: 'mermaid',
              },
            },
          }),
          BASE_URL,
        ),
      );

      expect(leaf.stickyNotes.diagram).toEqual({
        url: 'https://cdn.test/loop.png',
        alt: 'Cue leads to routine leads to reward',
        spec: 'graph LR; cue-->routine-->reward',
        specFormat: 'mermaid',
      });
    });

    it('carries applyInLife through', () => {
      const leaf = expectOk(
        mapLeaf(
          cmsLeaf({ takeaway: { body: 'x', applyInLife: 'Name one cue you noticed today.' } }),
          BASE_URL,
        ),
      );

      expect(leaf.takeaway.applyInLife).toBe('Name one cue you noticed today.');
    });

    it('omits an asset whose group Payload wrote empty', () => {
      // Payload persists the group even when an author fills nothing in, so without the
      // URL check every Leaf in the library would carry a broken image.
      const leaf = expectOk(
        mapLeaf(
          cmsLeaf({ scenario: { ...cmsLeaf().scenario, image: { url: null, alt: null } } }),
          BASE_URL,
        ),
      );

      expect(leaf.scenario).not.toHaveProperty('image');
    });

    it('rejects the Leaf when an image has a URL but no alt text', () => {
      // The two gates disagreeing is the failure being caught: the CMS refuses to
      // publish this, so serving it would mean one of the two is not running. Dropping
      // the image instead would hide that — and cost a reader who cannot see it the
      // only description they get.
      const result = mapLeaf(
        cmsLeaf({ scenario: { ...cmsLeaf().scenario, image: { url: image.url, alt: '  ' } } }),
        BASE_URL,
      );

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reasons.join(' ')).toContain('scenario.image.alt');
    });

    /**
     * Two cases, and the second is the one that bites.
     *
     * With a `spec` present, a Leaf carrying an unknown format is rejected even if the
     * mapper quietly drops the format — because `diagramAssetSchema` separately refuses
     * a spec with no format to re-render it from. That makes the first case pass for a
     * reason that has nothing to do with the enum. The second case removes the spec, so
     * the *only* thing left that can reject the Leaf is the format not being one of the
     * two the renderer knows.
     */
    it('rejects a diagram whose spec format is not one the renderer knows', () => {
      const result = mapLeaf(
        cmsLeaf({
          stickyNotes: {
            ...cmsLeaf().stickyNotes,
            diagram: {
              url: image.url,
              alt: 'A diagram',
              spec: 'digraph {}',
              // Invalid on purpose — the invalid value *is* the assertion, so replacing
              // it with a real format would make this file typecheck and this test
              // prove nothing. It has to arrive through a cast because Payload's
              // generated union admits only the two formats the renderer knows.
              //
              // The cast is not the test cheating. `specFormat` is a `select` column,
              // and Postgres holds whatever is written into it — a pipeline, a hand-run
              // UPDATE, or a Payload version predating a format's removal can all put a
              // string there that the generated type says is impossible. This asserts
              // the mapper rejects that row rather than serving it.
              specFormat: 'dot' as unknown as CmsSpecFormat,
            },
          },
        }),
        BASE_URL,
      );

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reasons.join(' ')).toContain(
        'stickyNotes.diagram.specFormat',
      );
    });

    it('rejects an unknown spec format even with no spec to re-render', () => {
      const result = mapLeaf(
        cmsLeaf({
          stickyNotes: {
            ...cmsLeaf().stickyNotes,
            // No `spec`, so the "a spec needs a format" refinement cannot fire and the
            // enum is the only thing standing between `'dot'` and a served Leaf.
            diagram: {
              url: image.url,
              alt: 'A diagram',
              specFormat: 'dot' as unknown as CmsSpecFormat,
            },
          },
        }),
        BASE_URL,
      );

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reasons.join(' ')).toContain(
        'stickyNotes.diagram.specFormat',
      );
    });
  });

  describe('constraints tightened at the schema freeze', () => {
    it('rejects a source reference with a note but no locator', () => {
      const result = mapLeaf(
        cmsLeaf({
          sourceReferences: [
            {
              slideKey: 'summary',
              chapter: null,
              page: null,
              quote: null,
              note: 'reference',
              id: 's1',
            },
          ],
        }),
        BASE_URL,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reasons.join(' ')).toMatch(/chapter/u);
        expect(result.reasons.join(' ')).toMatch(/source reference 1/u);
      }
    });

    it.each([1, 7])('rejects %i sticky notes', (count) => {
      const notes = Array.from({ length: count }, (_unused, index) => ({
        note: `Note ${String(index)}`,
        id: `n${String(index)}`,
      }));

      expect(mapLeaf(cmsLeaf({ stickyNotes: { notes } }), BASE_URL).ok).toBe(false);
    });

    it.each([2, 6])('accepts %i sticky notes', (count) => {
      const notes = Array.from({ length: count }, (_unused, index) => ({
        note: `Note ${String(index)}`,
        id: `n${String(index)}`,
      }));

      expect(mapLeaf(cmsLeaf({ stickyNotes: { notes } }), BASE_URL).ok).toBe(true);
    });

    it('rejects Dinner Table Knowledge with no takeaway source reference', () => {
      const result = mapLeaf(
        cmsLeaf({ takeaway: { body: 't', dinnerTableKnowledge: 'An unsourced claim.' } }),
        BASE_URL,
      );

      expect(result.ok).toBe(false);
    });
  });

  describe('scenario options', () => {
    it.each([2, 4])('rejects %i options', (count) => {
      const options = Array.from({ length: count }, (_unused, index) => ({
        text: `Option ${String(index)}`,
        isCorrect: index === 0,
        id: `o${String(index)}`,
      }));

      expect(mapLeaf(cmsLeaf({ scenario: { prompt: 'p', options } }), BASE_URL).ok).toBe(false);
    });

    it('rejects two correct options', () => {
      const result = mapLeaf(
        cmsLeaf({
          scenario: {
            prompt: 'p',
            options: [
              { text: 'A', isCorrect: true, id: 'o1' },
              { text: 'B', isCorrect: true, id: 'o2' },
              { text: 'C', isCorrect: false, id: 'o3' },
            ],
          },
        }),
        BASE_URL,
      );

      expect(result.ok).toBe(false);
    });

    it('rejects an option with no id, rather than substituting the index', () => {
      // An index-derived id silently changes meaning when an author reorders options,
      // turning a correct WP4 answer submission into a wrong one with no error.
      const result = mapLeaf(
        cmsLeaf({
          scenario: {
            prompt: 'p',
            options: [
              { text: 'A', isCorrect: true, id: null },
              { text: 'B', isCorrect: false, id: 'o2' },
              { text: 'C', isCorrect: false, id: 'o3' },
            ],
          },
        }),
        BASE_URL,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reasons[0]).toMatch(/no id/u);
        expect(result.reasons[0]).toMatch(/stable option id/u);
      }
    });
  });

  it('rejects an incomplete draft, which Payload types as valid', () => {
    // Every slide field is optional in the generated type because a draft may be
    // half-written. The domain model is strictly stronger, and this is the only place
    // that difference gets enforced.
    //
    // Built by deletion rather than `{ summary: undefined }`, because
    // exactOptionalPropertyTypes makes those two different things — and an absent key
    // is what Payload actually sends.
    const incomplete: Record<string, unknown> = { ...cmsLeaf() };
    delete incomplete['summary'];
    delete incomplete['payoff'];
    delete incomplete['takeaway'];

    const result = mapLeaf(incomplete as unknown as CmsLeaf, BASE_URL);

    expect(result.ok).toBe(false);
  });

  it('names the Leaf in its rejection reasons', () => {
    const result = mapLeaf(cmsLeaf({ id: 77, title: '' }), BASE_URL);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons[0]).toContain('Leaf 77');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Media URL resolution (WP15.8)                                              */
/* -------------------------------------------------------------------------- */

describe('media URL resolution', () => {
  /**
   * Copied verbatim from the live CMS — `GET /api/leaves?where[id][equals]=244&depth=0`
   * against the real Track 42 / Leaf 244, 2026-09-02. Not hand-written: a hand-written
   * fixture gets the shape subtly right and the URL wrong, which is exactly the bug
   * this package exists to catch. `scenario.image.url` and `stickyNotes.diagram.url`
   * are both CMS-relative here — that is the defect; every other field just rides
   * along so the document is real rather than assembled to make the test pass.
   *
   * Every `audio` field updated from `{ url: null, durationSeconds: null }` to `[]`
   * for VO-1.1's group-to-array push — confirmed against the same live Leaf 244
   * post-push (an anonymous fetch of Track 50 that day showed `"audio":[]`, the same
   * shape Payload now returns for any untouched Leaf). Nothing else in this fixture
   * changed; audio was never populated on this Leaf either before or after.
   */
  const REAL_LEAF_244: CmsLeaf = {
    id: 244,
    trackId: 42,
    orderIndex: 0,
    title: 'Real wealth comes from creating value, not competing for it',
    summary: {
      body: "Wattles argues that true wealth comes from creating new value rather than competing over existing resources. Because he views nature's supply as inexhaustible, you never need to take anything away from others to succeed.",
      audio: [],
    },
    scenario: {
      prompt:
        'You run a boutique coffee roasting business and notice a popular new cafe opening across the street, threatening your sales. How do you respond to build lasting wealth ?',
      options: [
        {
          id: '6a96fc9e38b6d4946cf67907',
          text: "Secure exclusive wholesale contracts with nearby offices and offer loyalty discounts to lock in the neighborhood's existing coffee drinkers.",
          isCorrect: false,
        },
        {
          id: '6a96fc9e38b6d4946cf67908',
          text: "Negotiate long-term exclusive distribution deals with elite bean suppliers to restrict your competitor's access to premium single-origin crops.",
          isCorrect: false,
        },
        {
          id: '6a96fc9e38b6d4946cf67909',
          text: 'Develop a unique roast profile and workshop program that teaches customers how to brew at home, expanding the market of coffee enthusiasts.',
          isCorrect: true,
        },
      ],
      image: {
        url: '/api/media/file/leaf-00-scenario-7.png',
        alt: "An illustration of the scenario: You run a boutique coffee roasting business and notice a popular new cafe opening across the street, threatening your sales. How do you respond to build lasting wealth according to Wattles' principle?. Stylised flat artwork; the figures are not identifiable.",
        width: null,
        height: null,
      },
      audio: [],
    },
    payoff: {
      body: "By introducing an offering that teaches customers new skills, you create fresh value rather than fighting over the existing pool. Wattles believes true riches are formed on this 'creative plane'\u2014giving more in use value than you take in cash\u2014making them far more permanent than wealth won through competition.",
      audio: [],
    },
    stickyNotes: {
      notes: [
        {
          id: '6a96b64738b6d4946cf6777b',
          note: 'Create new value instead of competing for existing resources.',
        },
        {
          id: '6a96b64738b6d4946cf6777c',
          note: 'Give more in use value than you take in cash value.',
        },
        {
          id: '6a96b64738b6d4946cf6777d',
          note: 'Rise entirely out of the competitive mindset.',
        },
      ],
      diagram: {
        url: '/api/media/file/leaf-00-diagram-2.png',
        alt: 'A comparison diagram contrasting Creative Mindset \u2014 Create new value, Compete for existing resources \u2014 with Competitive Mindset \u2014 Give more in use value than cash value, Rise out of competitive mindset.',
        width: null,
        height: null,
        spec: '{\n  "kind": "contrast",\n  "nodes": [\n    {\n      "label": "Create new value"\n    },\n    {\n      "label": "Compete for existing resources"\n    },\n    {\n      "label": "Give more in use value than cash value"\n    },\n    {\n      "label": "Rise out of competitive mindset"\n    }\n  ],\n  "left_heading": "Creative Mindset",\n  "right_heading": "Competitive Mindset"\n}',
        specFormat: 'json',
      },
      audio: [],
    },
    takeaway: {
      body: 'Wattles argues that you never have to beat someone else to succeed; lasting wealth comes from expanding the pie rather than fighting over the slices.',
      dinnerTableKnowledge:
        'Wattles compares competitive multi-millionaires to prehistoric monster reptiles\u2014necessary for evolutionary development, but ultimately wretched in their private lives and destined to be phased out.',
      applyInLife:
        'Before finalizing your next business deal or sale, evaluate whether what you are providing delivers more practical value to the customer than the cash value you are receiving in return.',
      audio: [],
    },
    sourceReferences: [
      {
        id: '6a96b64738b6d4946cf6777e',
        slideKey: 'summary',
        chapter: 'CHAPTER V. Increasing Life.',
        page: null,
        quote:
          'You are to become a creator, not a competitor; you are going to get what you want, but in such a way that when you get it every other man will have more than he has now.',
        note: 'Wattles explains that a person must become a creator rather than a competitor so everyone benefits.',
      },
      {
        id: '6a96b64738b6d4946cf6777f',
        slideKey: 'summary',
        chapter: 'CHAPTER V. Increasing Life.',
        page: null,
        quote: 'You are to create, not to compete for what is already created.',
        note: 'Wattles states you must create rather than compete for what is already created.',
      },
      {
        id: '6a96b64738b6d4946cf67780',
        slideKey: 'summary',
        chapter: 'CHAPTER V. Increasing Life.',
        page: null,
        quote: 'You do not have to take anything away from any one.',
        note: 'Wattles asserts you do not need to take anything from anyone.',
      },
      {
        id: '6a96b64738b6d4946cf67781',
        slideKey: 'summary',
        chapter: 'CHAPTER III. Is Opportunity Monopolized?',
        page: null,
        quote: 'Nature is an inexhaustible storehouse of riches; the supply will never run short.',
        note: "Wattles writes that nature's storehouse of riches will never run short.",
      },
      {
        id: '6a96b64738b6d4946cf67782',
        slideKey: 'payoff',
        chapter: 'CHAPTER VI. How Riches Come to You.',
        page: null,
        quote:
          'Give every man more in use value than you take from him in cash value; then you are adding to the life of the world by every business transaction.',
        note: 'Wattles instructs to give more in use value than you take in cash value to add to the life of the world.',
      },
      {
        id: '6a96b64738b6d4946cf67783',
        slideKey: 'payoff',
        chapter: 'CHAPTER V. Increasing Life.',
        page: null,
        quote:
          'Riches secured on the competitive plane are never satisfactory and permanent; they are yours to-day, and another\u2019s to-morrow.',
        note: 'Wattles states competitive riches are temporary and unsatisfactory.',
      },
      {
        id: '6a96b64738b6d4946cf67784',
        slideKey: 'takeaway',
        chapter: 'CHAPTER VI. How Riches Come to You.',
        page: null,
        quote: 'You do not have to beat anybody in business.',
        note: 'Wattles states that you do not need to defeat others in your business dealings.',
      },
      {
        id: '6a96b64738b6d4946cf67785',
        slideKey: 'takeaway',
        chapter: 'CHAPTER V. Increasing Life.',
        page: null,
        quote: 'You are to create, not to compete for what is already created.',
        note: 'He advises to create rather than compete for what has already been created, effectively expanding the total wealth.',
      },
      {
        id: '6a96b64738b6d4946cf67786',
        slideKey: 'takeaway',
        chapter: 'CHAPTER V. Increasing Life.',
        page: null,
        quote:
          'The multi-millionaires are like the monster reptiles of the prehistoric eras; they play a necessary part in the evolutionary process, but the same Power which produced them will dispose of them.',
        note: 'Wattles likens multi-millionaires to prehistoric monster reptiles that fulfill an evolutionary function before being disposed of, noting their private lives show them to be wretched.',
      },
      {
        id: '6a96b64738b6d4946cf67787',
        slideKey: 'payoff',
        chapter: 'CHAPTER VI. How Riches Come to You.',
        page: null,
        quote:
          'Give every man more in use value than you take from him in cash value; then you are adding to the life of the world by every business transaction.',
        note: 'Wattles explicitly rules that every transaction must provide more use value than cash value received.',
      },
    ],
    imageCandidates: [
      {
        id: '6a96ef3338b6d4946cf678ef',
        url: '/api/media/file/leaf-00-scenario-7.png',
        alt: "An illustration of the scenario: You run a boutique coffee roasting business and notice a popular new cafe opening across the street, threatening your sales. How do you respond to build lasting wealth according to Wattles' principle?. Stylised flat artwork; the figures are not identifiable.",
      },
      {
        id: '6a96ef3338b6d4946cf678f0',
        url: '/api/media/file/leaf-00-scenario-8.png',
        alt: "An illustration of the scenario: You run a boutique coffee roasting business and notice a popular new cafe opening across the street, threatening your sales. How do you respond to build lasting wealth according to Wattles' principle?. Stylised flat artwork; the figures are not identifiable.",
      },
      {
        id: '6a96ef3338b6d4946cf678f1',
        url: '/api/media/file/leaf-00-scenario-9.png',
        alt: "An illustration of the scenario: You run a boutique coffee roasting business and notice a popular new cafe opening across the street, threatening your sales. How do you respond to build lasting wealth according to Wattles' principle?. Stylised flat artwork; the figures are not identifiable.",
      },
    ],
    editorialFindings: [],
    isPlaceholder: false,
    gateTwoStatus: 'approved',
    updatedAt: '2026-09-02T07:47:49.223Z',
    createdAt: '2026-09-01T11:25:59.596Z',
    _status: 'published',
  };

  it('maps a real, live Leaf whose scenario image and diagram are CMS-relative', () => {
    const leaf = expectOk(mapLeaf(REAL_LEAF_244, BASE_URL));

    expect(leaf.scenario.image?.url).toBe(
      'http://127.0.0.1:3001/api/media/file/leaf-00-scenario-7.png',
    );
    expect(leaf.stickyNotes.diagram?.url).toBe(
      'http://127.0.0.1:3001/api/media/file/leaf-00-diagram-2.png',
    );
  });

  it('returns an already-absolute scenario image URL unchanged', () => {
    // A different host than BASE_URL, deliberately: if resolution touched an absolute
    // URL at all, this would come back rewritten onto BASE_URL's origin instead.
    const leaf = expectOk(
      mapLeaf(
        cmsLeaf({
          scenario: {
            ...cmsLeaf().scenario,
            image: { url: 'https://cdn.example.net/scenario.png', alt: 'Alt text' },
          },
        }),
        BASE_URL,
      ),
    );

    expect(leaf.scenario.image?.url).toBe('https://cdn.example.net/scenario.png');
  });

  /**
   * Copied verbatim from the live CMS — `GET /api/tracks?where[id][equals]=42&depth=0`,
   * 2026-09-02 — with `coverUrl` overridden to a relative value. No live Track carries
   * one yet (Track 42's is still a hotlinked third-party image); this is the sibling a
   * founder item is about to create by replacing that hotlink with a hosted asset, and
   * `mapTrack` fails on it today exactly as `mapLeaf` fails on Leaf 244.
   */
  const REAL_TRACK_42_WITH_RELATIVE_COVER: CmsTrack = {
    ...({
      id: 42,
      bookTitle: 'The Science of Getting Rich',
      author: 'W. D. Wattles',
      publisher: 'Elizabeth Towne Co',
      description:
        'Getting rich is an exact, law-governed science where anyone can systematically acquire wealth by holding a clear mental image of their desire on the creative plane, maintaining unwavering faith and gratitude, and supplementing that thought with efficient daily action in their present work.',
      disclaimer:
        "ZoomOut teaches this book's ideas; it does not endorse them. The author's claims about how the world works are presented as his, not as fact.",
      purchaseLinks: [
        {
          id: '6a970887eb8564b69dbef17d',
          retailer: 'Gutenberg',
          url: 'https://gutenberg.org/ebooks/59844',
          isAffiliate: false,
        },
      ],
      leafCount: 18,
      acquisition: 'public-domain',
      isPlaceholder: false,
      updatedAt: '2026-09-02T08:40:38.384Z',
      createdAt: '2026-08-27T15:09:53.150Z',
      _status: 'published',
    } as CmsTrack),
    coverUrl: '/api/media/file/cover.png',
  };

  it('maps a real Track whose cover is CMS-relative', () => {
    const track = expectOk(mapTrack(REAL_TRACK_42_WITH_RELATIVE_COVER, BASE_URL));

    expect(track.coverUrl).toBe('http://127.0.0.1:3001/api/media/file/cover.png');
  });

  it('returns an already-absolute cover URL unchanged', () => {
    const track = expectOk(
      mapTrack(cmsTrack({ coverUrl: 'https://cdn.example.net/cover.png' }), BASE_URL),
    );

    expect(track.coverUrl).toBe('https://cdn.example.net/cover.png');
  });

  /**
   * VO-1. Audio was never populated before this package, so `resolveMediaUrl` was
   * never wired to it — `optionalAudio` returned `audio.url` raw. A relative audio URL
   * doesn't just fail to play: `audioRefSchema` requires `z.url()`, so it fails
   * validation and can take the whole Leaf down with it.
   *
   * The pre-existing `mapLeaf` > `maps audio through when a URL is present` test
   * (above, in this file) asserts against `https://cdn.test/a.mp3` — already absolute —
   * so it passes identically with or without this resolution. **This is the case that
   * test cannot see.** Mutation-checked by hand: reverting `optionalAudio`'s
   * `resolveMediaUrl(audio.url, baseUrl)` back to raw `audio.url` turns the first test
   * below red while every other test in this file, including the absolute-URL one,
   * stays green — the contrast that proves the old coverage never reached this.
   */
  /**
   * VO-1.1: `audio` went from a single reserved reference to a narrator-keyed array,
   * each entry carrying a digest of the text it was generated from. The mapper's job
   * is to verify and resolve each entry independently and fail closed per entry,
   * never per Leaf (the handoff's own framing).
   */
  describe('VO-1.1 slide audio', () => {
    /** A row shaped the way Payload's array field actually returns it, id included. */
    const audioRow = (
      narrator: 'female' | 'male',
      narratedText: string,
      overrides: Partial<{
        url: string;
        durationSeconds: number;
        textDigest: string;
        id: string;
      }> = {},
    ): {
      narrator: 'female' | 'male';
      url: string;
      durationSeconds: number;
      textDigest: string;
      id: string;
    } => ({
      narrator,
      url: '/api/media/file/clip.mp3',
      durationSeconds: 12.5,
      textDigest: sha256(narratedText),
      id: 'row-1',
      ...overrides,
    });

    describe('omitting audio', () => {
      it('omits audio entirely when the slide field is absent', () => {
        // cmsLeaf()'s default sets no audio key at all — the shape every Leaf has
        // carried since before this package, and must keep carrying.
        const leaf = expectOk(mapLeaf(cmsLeaf(), BASE_URL));

        expect(leaf.summary).not.toHaveProperty('audio');
      });

      it('omits audio entirely when the slide carries an empty array', () => {
        const { value: leaf, warnings } = expectMapped(
          mapLeaf(cmsLeaf({ summary: { body: 'x', audio: [] } }), BASE_URL),
        );

        expect(leaf.summary).not.toHaveProperty('audio');
        expect(warnings).toEqual([]);
      });
    });

    describe('a valid entry', () => {
      it('is mapped through with its url resolved to absolute and the row id dropped', () => {
        const text = 'Placeholder summary.'; // cmsLeaf()'s default summary.body
        const { value: leaf, warnings } = expectMapped(
          mapLeaf(cmsLeaf({ summary: { body: text, audio: [audioRow('female', text)] } }), BASE_URL),
        );

        expect(leaf.summary.audio).toEqual([
          {
            narrator: 'female',
            url: 'http://127.0.0.1:3001/api/media/file/clip.mp3',
            durationSeconds: 12.5,
            textDigest: sha256(text),
          },
        ]);
        expect(warnings).toEqual([]);
      });

      it('keeps both narrators when each carries its own valid entry', () => {
        const text = 'Placeholder summary.';
        const leaf = expectOk(
          mapLeaf(
            cmsLeaf({
              summary: { body: text, audio: [audioRow('female', text), audioRow('male', text)] },
            }),
            BASE_URL,
          ),
        );

        expect(leaf.summary.audio?.map((entry) => entry.narrator).sort()).toEqual(['female', 'male']);
      });
    });

    describe('narrator validity', () => {
      it('omits an entry whose narrator is not one of the known values, with a warning', () => {
        const text = 'Placeholder summary.';
        const row = { ...audioRow('female', text), narrator: 'robot' as 'female' };
        const { value: leaf, warnings } = expectMapped(
          mapLeaf(cmsLeaf({ summary: { body: text, audio: [row] } }), BASE_URL),
        );

        expect(leaf.summary).not.toHaveProperty('audio');
        expect(warnings[0]).toMatch(/Leaf 42/u);
        expect(warnings[0]).toMatch(/not a known narrator/u);
      });
    });

    describe('durationSeconds', () => {
      /**
       * Mutation-checked: deleting this check (so a missing/non-positive duration
       * falls through to the digest comparison) still turns this red, because
       * `raw.durationSeconds` would then be spread into the mapped entry as
       * `undefined` and fail `leafSchema`'s `z.number().positive()` — but as a whole
       * *Leaf* failure, not a per-entry omission. Asserting `leaf.summary.audio` is
       * absent (not that the Leaf failed to map) is what pins the fail-closed-per-entry
       * contract rather than just fail-closed-somewhere.
       */
      it('omits an entry with no durationSeconds, with a warning', () => {
        const text = 'Placeholder summary.';
        const { durationSeconds: _durationSeconds, ...incomplete } = audioRow('female', text);
        // Cast, with the schema as the check (the same precedent as the diagram
        // specFormat tests above): Payload's generated type says every row has a
        // durationSeconds, but a hand-run write or a legacy row is not bound by
        // that, and this asserts the mapper rejects the row rather than serving it.
        const row = incomplete as unknown as ReturnType<typeof audioRow>;
        const { value: leaf, warnings } = expectMapped(
          mapLeaf(cmsLeaf({ summary: { body: text, audio: [row] } }), BASE_URL),
        );

        expect(leaf.summary).not.toHaveProperty('audio');
        expect(warnings[0]).toMatch(/durationSeconds/u);
      });

      it('omits an entry with a non-positive durationSeconds, with a warning', () => {
        const text = 'Placeholder summary.';
        const row = audioRow('female', text, { durationSeconds: 0 });
        const { value: leaf, warnings } = expectMapped(
          mapLeaf(cmsLeaf({ summary: { body: text, audio: [row] } }), BASE_URL),
        );

        expect(leaf.summary).not.toHaveProperty('audio');
        expect(warnings[0]).toMatch(/durationSeconds/u);
      });
    });

    /**
     * The point of this package: a Leaf's text can be edited after its audio is
     * generated, and this is the only thing that would notice.
     */
    describe('the digest check', () => {
      it('omits an entry whose textDigest no longer matches the current narrated text, with a warning', () => {
        const original = 'Placeholder summary.';
        const edited = 'Placeholder summary, edited after the clip was made.';
        const row = audioRow('female', original); // digest of the OLD text
        const { value: leaf, warnings } = expectMapped(
          mapLeaf(cmsLeaf({ summary: { body: edited, audio: [row] } }), BASE_URL),
        );

        expect(leaf.summary).not.toHaveProperty('audio');
        expect(leaf.summary.body).toBe(edited); // the text itself still ships
        expect(warnings[0]).toMatch(/Leaf 42/u);
        expect(warnings[0]).toMatch(/stale textDigest/u);
        expect(warnings[0]).toMatch(new RegExp(sha256(edited).slice(0, 8), 'u'));
      });

      it('hashes the narrated text exactly as stored, with no trimming or normalising', () => {
        // A digest computed against trimmed text would make this the one case where
        // an honest, unedited clip looks stale — the opposite of a false positive
        // being the safe direction everywhere else in this file.
        const textWithSpace = '  Placeholder summary with padding.  ';
        const row = audioRow('female', textWithSpace);
        const leaf = expectOk(
          mapLeaf(cmsLeaf({ summary: { body: textWithSpace, audio: [row] } }), BASE_URL),
        );

        expect(leaf.summary.audio).toHaveLength(1);
      });
    });

    describe('narrator collisions', () => {
      /**
       * Mutation-checked: removing the collision drop (so the loop's last write to
       * `survivors.set` simply wins) keeps this green on the *value* of the surviving
       * entry — a "last one wins" bug looks identical to this test's fixture unless it
       * specifically asserts the array is empty. That is why this asserts absence
       * rather than checking which of the two entries came through.
       */
      it('drops both entries when two share a narrator on the same slide, with a warning', () => {
        const text = 'Placeholder summary.';
        const first = audioRow('female', text, { url: '/api/media/file/a.mp3', id: 'row-1' });
        const second = audioRow('female', text, { url: '/api/media/file/b.mp3', id: 'row-2' });
        const { value: leaf, warnings } = expectMapped(
          mapLeaf(cmsLeaf({ summary: { body: text, audio: [first, second] } }), BASE_URL),
        );

        expect(leaf.summary).not.toHaveProperty('audio');
        expect(warnings.some((w) => /two audio entries for narrator female/u.test(w))).toBe(true);
      });

      it('keeps the other narrator when only one collides', () => {
        const text = 'Placeholder summary.';
        const femaleA = audioRow('female', text, { id: 'row-1' });
        const femaleB = audioRow('female', text, { id: 'row-2' });
        const male = audioRow('male', text, { id: 'row-3' });
        const leaf = expectOk(
          mapLeaf(cmsLeaf({ summary: { body: text, audio: [femaleA, femaleB, male] } }), BASE_URL),
        );

        expect(leaf.summary.audio).toEqual([
          expect.objectContaining({ narrator: 'male' }) as unknown,
        ]);
      });
    });

    describe('stickyNotes has no narrated field to verify against', () => {
      it('omits a stickyNotes audio entry even when it is otherwise well-formed, with a warning', () => {
        // "Well-formed" here means a digest of *something* — stickyNotes has no
        // narrated field for that digest to be checked against, so it is
        // unverifiable by construction and dropped regardless of its content.
        const row = audioRow('female', 'anything');
        const { value: leaf, warnings } = expectMapped(
          mapLeaf(
            cmsLeaf({ stickyNotes: { ...cmsLeaf().stickyNotes, audio: [row] } }),
            BASE_URL,
          ),
        );

        expect(leaf.stickyNotes).not.toHaveProperty('audio');
        expect(warnings[0]).toMatch(/stickyNotes/u);
        expect(warnings[0]).toMatch(/no narrated field/u);
      });
    });

    /**
     * One call site per narrated slide, checked independently rather than trusted by
     * inspection — `mapAudioEntries` is called from `mapBodySlide` (summary, payoff)
     * and directly for scenario and takeaway. VO-1 found this exact class of bug: a
     * fix landed on the function but missed at one call site.
     *
     * Mutation-checked by hand: reverting `resolveMediaUrl(url, baseUrl)` to raw
     * `url` inside `mapAudioEntries` turns every test below red while every
     * already-absolute fixture elsewhere in this file stays green — the contrast
     * that proves this file's coverage actually reaches the relative-URL case.
     */
    describe('per-slide relative URL resolution', () => {
      it('resolves summary audio', () => {
        const text = 'Placeholder summary.';
        const leaf = expectOk(
          mapLeaf(cmsLeaf({ summary: { body: text, audio: [audioRow('female', text)] } }), BASE_URL),
        );

        expect(leaf.summary.audio?.[0]?.url).toBe('http://127.0.0.1:3001/api/media/file/clip.mp3');
      });

      it('resolves scenario audio', () => {
        const text = 'Placeholder prompt?'; // cmsLeaf()'s default scenario.prompt
        const leaf = expectOk(
          mapLeaf(
            cmsLeaf({ scenario: { ...cmsLeaf().scenario, audio: [audioRow('female', text)] } }),
            BASE_URL,
          ),
        );

        expect(leaf.scenario.audio?.[0]?.url).toBe('http://127.0.0.1:3001/api/media/file/clip.mp3');
      });

      it('resolves payoff audio', () => {
        const text = 'Placeholder payoff.';
        const leaf = expectOk(
          mapLeaf(cmsLeaf({ payoff: { body: text, audio: [audioRow('female', text)] } }), BASE_URL),
        );

        expect(leaf.payoff.audio?.[0]?.url).toBe('http://127.0.0.1:3001/api/media/file/clip.mp3');
      });

      it('resolves takeaway audio', () => {
        const text = 'Placeholder takeaway.';
        const leaf = expectOk(
          mapLeaf(cmsLeaf({ takeaway: { body: text, audio: [audioRow('female', text)] } }), BASE_URL),
        );

        expect(leaf.takeaway.audio?.[0]?.url).toBe('http://127.0.0.1:3001/api/media/file/clip.mp3');
      });
    });
  });
});
