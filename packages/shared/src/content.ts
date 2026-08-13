import { z } from 'zod';

import { cmsIdSchema, isoTimestampSchema, publishStatusSchema } from './primitives.js';
import type { PublishStatus } from './primitives.js';

/**
 * ============================================================================
 * FROZEN — content model, re-frozen 2026-08-13 (Leaf v2, WP15)
 * ============================================================================
 * `Track`, `Leaf`, the five slide schemas and `SourceReference` were first frozen on
 * 2026-08-08 after the schema-freeze gate (plan §5), where one structurally complete
 * Leaf was authored through the real editor. That exercise produced four corrections,
 * all still in force: text is trimmed on save, source references require a locator
 * alongside the note, sticky notes are bounded 2–6, and `publisher` and `coverUrl`
 * are required to publish a Track.
 *
 * **Thawed once, deliberately, for WP15 (Leaf v2)** — the ruling and its reasoning are
 * in `project/proposals/content-pipeline.md` R1. Phase 2's pipeline generates three
 * things a Leaf could not previously hold, so the app had to be able to store and
 * render them before the pipeline could produce them:
 *
 *   - `scenario.image` — an illustration
 *   - `stickyNotes.diagram` — a diagram, plus the spec it was rendered from (R4)
 *   - `takeaway.applyInLife` — one concrete thing to do
 *
 * **All three are optional, and that is the migration plan.** The change is purely
 * additive: the 28 Tracks and 22 Leaves that already exist stay valid untouched, and
 * there is no backfill. Nothing here was removed, narrowed or renamed.
 *
 * Downstream code may depend on these shapes. A further change requires an Architect
 * ruling and a migration plan for content that already exists, because the CMS
 * enforces the same constraints independently and the two must not drift apart.
 * ============================================================================
 */

/**
 * The five slides of a Leaf, in fixed order.
 *
 * Exported as a value as well as a type because `SourceReference` keys off it and
 * the CMS needs the list at runtime to build its field groups.
 */
export const SLIDE_KEYS = ['summary', 'scenario', 'payoff', 'stickyNotes', 'takeaway'] as const;

export const slideKeySchema = z.enum(SLIDE_KEYS);

/**
 * Reference to a generated audio track for one slide.
 *
 * RESERVED FOR PHASE 2 — voiceover is deferred (PRODUCT.md), and nothing in Phase 1
 * reads this. It exists so that enabling audio later is a data migration rather than
 * a reshaping of the Leaf.
 */
export const audioRefSchema = z.object({
  url: z.url(),
  durationSeconds: z.number().positive().optional(),
});

/**
 * An illustration attached to a slide. Added in WP15 (Leaf v2).
 *
 * Shaped after `audioRefSchema` above — a URL plus optional metadata — because that
 * is the established precedent here for a reserved asset reference, and two asset
 * shapes that differ for no reason are two things to remember.
 *
 * **`alt` is required, and that is the whole point of it being inside this object.**
 * These are the first images in the product; the app honours OS accessibility settings
 * throughout, and an image without a text alternative is invisible to a reader using
 * one. Making it required *within* the asset means "an asset without alt" is
 * unrepresentable rather than merely discouraged — the optionality lives on the asset,
 * not on its description.
 *
 * `width`/`height` are optional and advisory: they let a renderer reserve space before
 * the image loads, and their absence must never stop it rendering.
 */
export const imageAssetSchema = z.object({
  url: z.url(),
  alt: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

/** How a diagram's source spec is written. See `diagramAssetSchema`. */
export const DIAGRAM_SPEC_FORMATS = ['mermaid', 'json'] as const;

export const diagramSpecFormatSchema = z.enum(DIAGRAM_SPEC_FORMATS);

/**
 * A diagram on the sticky-notes slide, and the source it was rendered from.
 *
 * **`spec` is the reason this is not just an image** (content-pipeline R4). A flowchart
 * or Venn diagram produced by an image model has unreliable text and cannot be edited,
 * re-themed or corrected — so the pipeline emits a constrained spec, we render it, and
 * the spec travels with the result. A writer fixing a wrong label edits text and
 * re-renders instead of regenerating an image and hoping.
 *
 * Both the rendered `url` and the `spec` are kept because they answer different
 * questions: the app needs something to display today, and the editor needs something
 * to correct tomorrow.
 *
 * `specFormat` is required whenever `spec` is present — a spec whose language is
 * unknown cannot be re-rendered, which defeats the reason for storing it.
 */
export const diagramAssetSchema = imageAssetSchema
  .extend({
    spec: z.string().min(1).optional(),
    specFormat: diagramSpecFormatSchema.optional(),
  })
  .refine(
    (diagram) => diagram.spec === undefined || diagram.specFormat !== undefined,
    { message: 'A diagram spec needs a specFormat so it can be re-rendered', path: ['specFormat'] },
  );

/* -------------------------------------------------------------------------- */
/* Slides                                                                      */
/* -------------------------------------------------------------------------- */

export const summarySlideSchema = z.object({
  body: z.string().min(1),
  audio: audioRefSchema.optional(),
});

/**
 * One answer option on the scenario slide.
 *
 * `isCorrect` is authoring-side and server-side only. See `publicScenarioSlideSchema`
 * for the projection that is safe to send to a client.
 */
export const scenarioOptionSchema = z.object({
  id: cmsIdSchema,
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

/**
 * Exactly three options, exactly one of them correct.
 *
 * A tuple rather than an array so "exactly three" is enforced by the compiler as well
 * as at runtime — the same reasoning that makes the Leaf five named fields instead of
 * a slide array. Only the one-correct-option rule needs a runtime refinement, because
 * no type system is going to express it.
 */
export const scenarioOptionsSchema = z
  .tuple([scenarioOptionSchema, scenarioOptionSchema, scenarioOptionSchema])
  .refine(
    (options) => options.filter((option) => option.isCorrect).length === 1,
    'A scenario must have exactly one correct option',
  );

export const scenarioSlideSchema = z.object({
  prompt: z.string().min(1),
  options: scenarioOptionsSchema,
  /** WP15. Optional: every Leaf authored before Leaf v2 has none, and stays valid. */
  image: imageAssetSchema.optional(),
  audio: audioRefSchema.optional(),
});

export const payoffSlideSchema = z.object({
  body: z.string().min(1),
  audio: audioRefSchema.optional(),
});

export const stickyNotesSlideSchema = z.object({
  /**
   * Bounded 2–6 (ruled 2026-08-08 at the schema-freeze gate).
   *
   * Chosen by failure direction rather than by the single authored data point: too
   * tight blocks an author immediately, which is cheap and visible; too loose ships
   * content that breaks the board layout in WP8, which is expensive and late.
   * Loosening later is safe, tightening invalidates content that already exists.
   *
   * A single note is not a recap, which is why the floor is 2 rather than 1.
   */
  notes: z.array(z.string().min(1)).min(2).max(6),
  /**
   * WP15. The board can carry a diagram alongside the notes, never instead of them —
   * `notes` stays required, so a diagram that fails to load leaves a slide that still
   * says something.
   */
  diagram: diagramAssetSchema.optional(),
  audio: audioRefSchema.optional(),
});

export const takeawaySlideSchema = z.object({
  body: z.string().min(1),
  /**
   * The optional deep-cut fact. Cannot be saved without a matching `SourceReference`
   * — enforced by `leafSchema` below, not left to author discipline (LEGAL.md).
   */
  dinnerTableKnowledge: z.string().min(1).optional(),
  /**
   * WP15. One concrete thing to do with what was just learnt.
   *
   * A field on the takeaway rather than a sixth slide, ruled in content-pipeline R1:
   * the five-slide structure is a compile-time guarantee in these types, a `group` per
   * slide in Payload and the spine of the player. A sixth slide is a redesign; a field
   * is a migration.
   */
  applyInLife: z.string().min(1).optional(),
  audio: audioRefSchema.optional(),
});

/* -------------------------------------------------------------------------- */
/* Source references                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Traceability record for a factual claim on one slide.
 *
 * This is the audit trail the fair-use position and the zero-fabrication policy both
 * rest on (LEGAL.md). It requires two things, not one:
 *
 *  - `note` — what in the book supports the claim, in the author's words.
 *  - **at least one locator** — `chapter`, `page` or `quote`.
 *
 * The locator requirement was added at the schema-freeze gate (ruled 2026-08-08). A
 * note on its own is a description of where a claim came from, not a citation anyone
 * else can check, which is weaker than the audit trail LEGAL.md intends. Requiring
 * `chapter` specifically would produce junk for a Leaf synthesising across a whole
 * book, and `page` is edition-dependent false precision — so the author picks whichever
 * locator is honest for that claim.
 */
const sourceReferenceShape = {
  slideKey: slideKeySchema,
  chapter: z.string().min(1).optional(),
  page: z.string().min(1).optional(),
  quote: z.string().min(1).optional(),
  note: z.string().min(1),
} as const;

/** The locators, in the order the author-facing message names them. */
export const SOURCE_LOCATOR_FIELDS = ['chapter', 'page', 'quote'] as const;

export const SOURCE_LOCATOR_REQUIRED_MESSAGE =
  'A source reference needs a locator as well as a note. Add a chapter, a page, or a quote.';

/**
 * Whether a reference carries at least one usable locator.
 *
 * Whitespace-only counts as absent. That matters because CMS input is trimmed on
 * save, so `"  "` becomes `""` — and a blank locator should read as "not provided"
 * rather than satisfying the requirement on a technicality.
 */
export function hasSourceLocator(reference: {
  chapter?: string | undefined;
  page?: string | undefined;
  quote?: string | undefined;
}): boolean {
  return SOURCE_LOCATOR_FIELDS.some((field) => (reference[field] ?? '').trim().length > 0);
}

export const leafSourceReferenceSchema = z
  .object(sourceReferenceShape)
  .refine(hasSourceLocator, SOURCE_LOCATOR_REQUIRED_MESSAGE);

/** The same record as a standalone, persisted entity. */
export const sourceReferenceSchema = z
  .object({ ...sourceReferenceShape, id: cmsIdSchema, leafId: cmsIdSchema })
  .refine(hasSourceLocator, SOURCE_LOCATOR_REQUIRED_MESSAGE);

/* -------------------------------------------------------------------------- */
/* Leaf                                                                        */
/* -------------------------------------------------------------------------- */

const leafShape = {
  id: cmsIdSchema,
  trackId: cmsIdSchema,
  orderIndex: z.number().int().nonnegative(),
  title: z.string().min(1),
  status: publishStatusSchema,

  /**
   * Marks mock content (plan §3.4). Defaults to `true` because the safe direction is
   * to assume a record whose provenance we cannot see is placeholder: that blocks it
   * from production. Defaulting to `false` would let an un-flagged mock Leaf ship
   * fabricated-sounding advice under a real author's name, which is the exact failure
   * the flag exists to prevent.
   */
  isPlaceholder: z.boolean().default(true),

  // The five slides, named and individually typed. NOT `slides: Slide[]`.
  //
  // The 5-slide structure is fixed for the life of the product, so it is a
  // compile-time guarantee: omitting `payoff`, or adding a sixth slide, is a type
  // error rather than a runtime validation failure discovered in staging.
  summary: summarySlideSchema,
  scenario: scenarioSlideSchema,
  payoff: payoffSlideSchema,
  stickyNotes: stickyNotesSlideSchema,
  takeaway: takeawaySlideSchema,

  sourceReferences: z.array(leafSourceReferenceSchema).default([]),

  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
};

const baseLeafSchema = z.object(leafShape);

/**
 * Dinner Table Knowledge requires a source reference on the takeaway slide.
 *
 * LEGAL.md names fabricated content attributed to a real author as the
 * highest-severity risk in the product, and singles out Dinner Table Knowledge. The
 * CMS will enforce this too (WP1), but encoding it here means the backend cannot
 * accept an unsourced deep-cut fact even if the CMS rule is later misconfigured.
 */
function requireSourceForDinnerTableKnowledge(
  leaf: z.infer<typeof baseLeafSchema>,
  ctx: z.RefinementCtx,
): void {
  if (leaf.takeaway.dinnerTableKnowledge === undefined) {
    return;
  }

  const hasTakeawaySource = leaf.sourceReferences.some((ref) => ref.slideKey === 'takeaway');
  if (!hasTakeawaySource) {
    ctx.addIssue({
      code: 'custom',
      path: ['takeaway', 'dinnerTableKnowledge'],
      message: 'Dinner Table Knowledge requires a source reference with slideKey "takeaway"',
    });
  }
}

export const leafSchema = baseLeafSchema.superRefine(requireSourceForDinnerTableKnowledge);

/* -------------------------------------------------------------------------- */
/* Track                                                                       */
/* -------------------------------------------------------------------------- */

export const purchaseLinkSchema = z.object({
  retailer: z.string().min(1),
  url: z.url(),
  isAffiliate: z.boolean().default(false),
});

export const trackSchema = z.object({
  id: cmsIdSchema,
  bookTitle: z.string().min(1),
  author: z.string().min(1),
  publisher: z.string().min(1),
  coverUrl: z.url(),
  description: z.string().min(1),

  /**
   * Non-endorsement disclaimer. Required and non-empty: every Track must carry one
   * (PRODUCT.md, LEGAL.md), so a Track without it should be unrepresentable rather
   * than merely flagged in review.
   */
  disclaimer: z.string().min(1),

  /** Purchase-forward framing. At least one retailer link is mandatory, same reasoning. */
  purchaseLinks: z.array(purchaseLinkSchema).min(1),

  status: publishStatusSchema,
  leafCount: z.number().int().nonnegative(),

  /** See the note on `Leaf.isPlaceholder` — same safe default, same reason. */
  isPlaceholder: z.boolean().default(true),

  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

/* -------------------------------------------------------------------------- */
/* Client-safe projections                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The scenario slide as the client is allowed to see it.
 *
 * `isCorrect` is stripped. Plan §3.6: if the flag ships with the options the unlock
 * gate is bypassable from the client and the active-recall mechanic — the entire
 * product thesis — becomes decorative. The client submits an answer and is told the
 * result; it never holds the answer key.
 *
 * This projection is defined here, next to the type it strips from, so that WP3 and
 * WP4 have one obvious thing to reach for instead of each hand-rolling a mapper.
 */
export const publicScenarioOptionSchema = scenarioOptionSchema.omit({ isCorrect: true });

export const publicScenarioSlideSchema = z.object({
  prompt: z.string().min(1),
  options: z.tuple([
    publicScenarioOptionSchema,
    publicScenarioOptionSchema,
    publicScenarioOptionSchema,
  ]),
  /**
   * Carried through to the client. Unlike `isCorrect`, the illustration is exactly
   * what the reader is meant to see — this projection strips the answer key, not
   * everything that was added after it was written.
   */
  image: imageAssetSchema.optional(),
  audio: audioRefSchema.optional(),
});

export const publicLeafSchema = baseLeafSchema
  .omit({ scenario: true })
  .extend({ scenario: publicScenarioSlideSchema });

/**
 * Strips the answer key off a Leaf.
 *
 * Total and type-checked, so adding a field to `scenario` later cannot silently leak
 * it: the return type stops compiling until the new field is handled.
 */
export function toPublicLeaf(leaf: Leaf): PublicLeaf {
  const { scenario, ...rest } = leaf;
  const [first, second, third] = scenario.options;

  return {
    ...rest,
    scenario: {
      prompt: scenario.prompt,
      options: [stripAnswerKey(first), stripAnswerKey(second), stripAnswerKey(third)],
      ...(scenario.image === undefined ? {} : { image: scenario.image }),
      ...(scenario.audio === undefined ? {} : { audio: scenario.audio }),
    },
  };
}

function stripAnswerKey(option: ScenarioOption): PublicScenarioOption {
  return { id: option.id, text: option.text };
}

/* -------------------------------------------------------------------------- */
/* Production publishability                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Whether a content record may be served from a production environment.
 *
 * Plan §3.4 requires that placeholder content cannot reach production, enforced in
 * code rather than by memory. This is a predicate rather than a rule baked into
 * `trackSchema`/`leafSchema` on purpose: throughout Phase 1 placeholder content *is*
 * legitimately published in the CMS and rendered in development and staging. The
 * constraint is about the environment it is served from, so the environment-aware
 * caller applies it — see the content read path in WP3.
 */
export function isProductionPublishable(content: {
  status: PublishStatus;
  isPlaceholder: boolean;
}): boolean {
  return content.status === 'published' && !content.isPlaceholder;
}

/* -------------------------------------------------------------------------- */
/* Inferred types                                                              */
/* -------------------------------------------------------------------------- */

export type SlideKey = z.infer<typeof slideKeySchema>;
export type AudioRef = z.infer<typeof audioRefSchema>;
export type ImageAsset = z.infer<typeof imageAssetSchema>;
export type DiagramAsset = z.infer<typeof diagramAssetSchema>;
export type DiagramSpecFormat = z.infer<typeof diagramSpecFormatSchema>;
export type SummarySlide = z.infer<typeof summarySlideSchema>;
export type ScenarioOption = z.infer<typeof scenarioOptionSchema>;
export type ScenarioOptions = z.infer<typeof scenarioOptionsSchema>;
export type ScenarioSlide = z.infer<typeof scenarioSlideSchema>;
export type PayoffSlide = z.infer<typeof payoffSlideSchema>;
export type StickyNotesSlide = z.infer<typeof stickyNotesSlideSchema>;
export type TakeawaySlide = z.infer<typeof takeawaySlideSchema>;
export type LeafSourceReference = z.infer<typeof leafSourceReferenceSchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type Leaf = z.infer<typeof leafSchema>;
export type PurchaseLink = z.infer<typeof purchaseLinkSchema>;
export type Track = z.infer<typeof trackSchema>;
export type PublicScenarioOption = z.infer<typeof publicScenarioOptionSchema>;
export type PublicScenarioSlide = z.infer<typeof publicScenarioSlideSchema>;
export type PublicLeaf = z.infer<typeof publicLeafSchema>;
