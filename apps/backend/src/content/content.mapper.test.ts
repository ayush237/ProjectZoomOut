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
      { slideKey: 'summary', chapter: 'Chapter 1', page: null, quote: null, note: 'A note.', id: 's1' },
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

/* -------------------------------------------------------------------------- */
/* Track                                                                       */
/* -------------------------------------------------------------------------- */

describe('mapTrack', () => {
  it('maps a complete published Track', () => {
    const track = expectOk(mapTrack(cmsTrack()));

    expect(track.bookTitle).toBe('Placeholder Book');
    expect(track.status).toBe('published');
  });

  it('stringifies the numeric id', () => {
    // Payload's Postgres adapter uses serial integers; cmsIdSchema is a string.
    const track = expectOk(mapTrack(cmsTrack({ id: 7 })));

    expect(track.id).toBe('7');
  });

  it('defaults a null isAffiliate to false', () => {
    const track = expectOk(mapTrack(cmsTrack()));

    expect(track.purchaseLinks[0]?.isAffiliate).toBe(false);
  });

  it('treats a missing _status as draft, the safe direction', () => {
    const track = expectOk(mapTrack(cmsTrack({ _status: null })));

    expect(track.status).toBe('draft');
  });

  it.each([
    ['publisher', { publisher: null }],
    ['coverUrl', { coverUrl: null }],
    ['disclaimer', { disclaimer: null }],
    ['description', { description: null }],
  ] as const)('rejects a Track with no %s', (field, override) => {
    const result = mapTrack(cmsTrack(override));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.join(' ')).toContain(field);
    }
  });

  it('rejects a Track with no purchase links', () => {
    // Purchase-forward framing is the mitigation for the market-substitution factor.
    expect(mapTrack(cmsTrack({ purchaseLinks: [] })).ok).toBe(false);
  });

  it('rejects a non-URL cover', () => {
    expect(mapTrack(cmsTrack({ coverUrl: 'not-a-url' })).ok).toBe(false);
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
        const track = expectOk(mapTrack(cmsTrack({ acquisition: status })));

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

      expect(expectOk(mapTrack(legacy)).acquisition).toBe('undocumented');
    });

    it('rejects a status outside the four', () => {
      const result = mapTrack(cmsTrack({ acquisition: 'borrowed' as unknown as TrackAcquisition }));

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reasons.join(' ')).toContain('acquisition');
    });

    it('does not gate publishing', () => {
      // Deliberate, and the thing most likely to be "helpfully" tightened later: the
      // acquisition policy is an unmade launch decision, so enforcing one here would
      // block content on a rule nobody has written.
      const track = expectOk(
        mapTrack(cmsTrack({ acquisition: 'undocumented', _status: 'published' })),
      );

      expect(track.status).toBe('published');
    });
  });

  it('names the Track in its rejection reasons', () => {
    const result = mapTrack(cmsTrack({ id: 99, publisher: null }));

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
    const leaf = expectOk(mapLeaf(cmsLeaf()));

    expect(leaf.title).toBe('Concept One');
    expect(leaf.id).toBe('42');
  });

  describe('trackId relationship', () => {
    it('accepts a bare id, which is what depth=0 returns', () => {
      expect(expectOk(mapLeaf(cmsLeaf({ trackId: 5 }))).trackId).toBe('5');
    });

    it('accepts a populated Track, in case the depth is ever raised', () => {
      // Guards against a future depth change producing "[object Object]" as a trackId.
      const leaf = expectOk(mapLeaf(cmsLeaf({ trackId: cmsTrack({ id: 5 }) })));

      expect(leaf.trackId).toBe('5');
    });
  });

  it('flattens sticky note rows into plain strings', () => {
    const leaf = expectOk(mapLeaf(cmsLeaf()));

    expect(leaf.stickyNotes.notes).toEqual(['Note one', 'Note two']);
  });

  it('maps a null isCorrect to false', () => {
    const leaf = expectOk(mapLeaf(cmsLeaf()));

    expect(leaf.scenario.options[2].isCorrect).toBe(false);
  });

  it('omits audio entirely rather than emitting an empty group', () => {
    // exactOptionalPropertyTypes makes `{ audio: undefined }` and no key different.
    const leaf = expectOk(mapLeaf(cmsLeaf({ summary: { body: 'x', audio: { url: null } } })));

    expect(leaf.summary).not.toHaveProperty('audio');
  });

  it('maps audio through when a URL is present', () => {
    const leaf = expectOk(
      mapLeaf(
        cmsLeaf({ summary: { body: 'x', audio: { url: 'https://cdn.test/a.mp3', durationSeconds: 30 } } }),
      ),
    );

    expect(leaf.summary.audio).toEqual({ url: 'https://cdn.test/a.mp3', durationSeconds: 30 });
  });

  it('omits dinnerTableKnowledge when null rather than passing undefined through', () => {
    const leaf = expectOk(mapLeaf(cmsLeaf()));

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
        mapLeaf(cmsLeaf({ scenario: { ...cmsLeaf().scenario, image } })),
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
        ),
      );

      expect(leaf.takeaway.applyInLife).toBe('Name one cue you noticed today.');
    });

    it('omits an asset whose group Payload wrote empty', () => {
      // Payload persists the group even when an author fills nothing in, so without the
      // URL check every Leaf in the library would carry a broken image.
      const leaf = expectOk(
        mapLeaf(cmsLeaf({ scenario: { ...cmsLeaf().scenario, image: { url: null, alt: null } } })),
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
            { slideKey: 'summary', chapter: null, page: null, quote: null, note: 'reference', id: 's1' },
          ],
        }),
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

      expect(mapLeaf(cmsLeaf({ stickyNotes: { notes } })).ok).toBe(false);
    });

    it.each([2, 6])('accepts %i sticky notes', (count) => {
      const notes = Array.from({ length: count }, (_unused, index) => ({
        note: `Note ${String(index)}`,
        id: `n${String(index)}`,
      }));

      expect(mapLeaf(cmsLeaf({ stickyNotes: { notes } })).ok).toBe(true);
    });

    it('rejects Dinner Table Knowledge with no takeaway source reference', () => {
      const result = mapLeaf(
        cmsLeaf({ takeaway: { body: 't', dinnerTableKnowledge: 'An unsourced claim.' } }),
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

      expect(mapLeaf(cmsLeaf({ scenario: { prompt: 'p', options } })).ok).toBe(false);
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

    const result = mapLeaf(incomplete as unknown as CmsLeaf);

    expect(result.ok).toBe(false);
  });

  it('names the Leaf in its rejection reasons', () => {
    const result = mapLeaf(cmsLeaf({ id: 77, title: '' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons[0]).toContain('Leaf 77');
    }
  });
});
