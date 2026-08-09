import {
  hasSourceLocator,
  leafSchema,
  SOURCE_LOCATOR_REQUIRED_MESSAGE,
  trackSchema,
  type Leaf,
  type Track,
} from '@zoomout/shared';
import type { Leaf as CmsLeaf, Track as CmsTrack } from '@zoomout/shared/cms';
import type { ZodError } from 'zod';

/**
 * Translates Payload documents into the domain model.
 *
 * **This layer is where a CMS document is proven, not merely reshaped.** Payload's
 * generated types mark nearly every field optional and nullable — including fields the
 * collection requires — because a draft may legitimately be half-written. The domain
 * model in `packages/shared` is strictly stronger: it has no nullables, sticky notes
 * are bounded, source references need a locator, and scenario options are a 3-tuple.
 *
 * So the mapper does two jobs and the second is the important one: reshape, then hand
 * the result to `leafSchema` / `trackSchema` and refuse anything they reject. That is
 * the second of the two independent gates. The CMS enforces these rules at publish
 * time; this enforces them at serve time; when they disagree, nothing ships.
 *
 * Known divergences handled here, all recorded in `apps/admin/src/payload.config.ts`:
 *  - ids are serial integers in Payload, strings in the domain model
 *  - `trackId` arrives as a bare id or a populated object, depending on `depth`
 *  - `stickyNotes.notes` is `{ note }[]` in Payload, `string[]` in the domain model
 *  - `scenario.options` is a plain array in Payload, a 3-tuple in the domain model
 *  - Payload adds `_status`, timestamps and row ids throughout
 */

export type MappingResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reasons: readonly string[] };

/**
 * Null or undefined.
 *
 * Payload uses both and means the same thing by them — `null` for a field an author
 * cleared, `undefined` for one the response omitted. The repo bans `== null`, so this
 * names the check once instead of spelling out both comparisons at twenty call sites.
 */
function isAbsent(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * The `depth` to request from Payload.
 *
 * Zero, deliberately: relationships come back as bare ids. The domain `Leaf` only ever
 * needs `trackId` as a string, so populating the whole Track would ship a payload we
 * discard and add a second shape to defend against on every request. The mapper still
 * *accepts* a populated relationship, because a future caller may raise the depth and
 * that should not be a silent breakage.
 */
export const CONTENT_QUERY_DEPTH = 0;

/* -------------------------------------------------------------------------- */
/* Track                                                                       */
/* -------------------------------------------------------------------------- */

export function mapTrack(document: CmsTrack): MappingResult<Track> {
  const candidate = {
    id: String(document.id),
    bookTitle: document.bookTitle,
    author: document.author,
    publisher: document.publisher ?? undefined,
    coverUrl: document.coverUrl ?? undefined,
    description: document.description ?? undefined,
    disclaimer: document.disclaimer ?? undefined,
    purchaseLinks: (document.purchaseLinks ?? []).map((link) => ({
      retailer: link.retailer,
      url: link.url,
      isAffiliate: link.isAffiliate ?? false,
    })),
    status: mapStatus(document._status),
    leafCount: document.leafCount ?? 0,
    isPlaceholder: document.isPlaceholder ?? true,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };

  const parsed = trackSchema.safeParse(candidate);

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, reasons: describe(parsed.error, `Track ${String(document.id)}`) };
}

/* -------------------------------------------------------------------------- */
/* Leaf                                                                        */
/* -------------------------------------------------------------------------- */

export function mapLeaf(document: CmsLeaf): MappingResult<Leaf> {
  // Checked before the schema runs so the failure names the actual cause. Left to
  // Zod it would surface as "expected string, received undefined" on an option id,
  // which tells whoever reads the log nothing about what to fix.
  const optionIdProblem = findMissingOptionId(document);
  if (optionIdProblem !== null) {
    return { ok: false, reasons: [optionIdProblem] };
  }

  const candidate = {
    id: String(document.id),
    trackId: resolveRelationshipId(document.trackId),
    orderIndex: document.orderIndex,
    title: document.title,
    status: mapStatus(document._status),
    isPlaceholder: document.isPlaceholder ?? true,

    summary: mapBodySlide(document.summary),
    scenario: {
      prompt: document.scenario?.prompt ?? undefined,
      options: (document.scenario?.options ?? []).map((option) => ({
        id: String(option.id),
        text: option.text ?? undefined,
        isCorrect: option.isCorrect ?? false,
      })),
      ...optionalAudio(document.scenario?.audio),
    },
    payoff: mapBodySlide(document.payoff),
    stickyNotes: {
      // Payload array rows are objects; the domain model is a plain string list.
      notes: (document.stickyNotes?.notes ?? []).map((row) => row.note ?? ''),
      ...optionalAudio(document.stickyNotes?.audio),
    },
    takeaway: {
      body: document.takeaway?.body ?? undefined,
      ...(isAbsent(document.takeaway?.dinnerTableKnowledge)
        ? {}
        : { dinnerTableKnowledge: document.takeaway.dinnerTableKnowledge }),
      ...optionalAudio(document.takeaway?.audio),
    },

    sourceReferences: (document.sourceReferences ?? []).map((reference) => ({
      slideKey: reference.slideKey,
      ...(isAbsent(reference.chapter) ? {} : { chapter: reference.chapter }),
      ...(isAbsent(reference.page) ? {} : { page: reference.page }),
      ...(isAbsent(reference.quote) ? {} : { quote: reference.quote }),
      note: reference.note,
    })),

    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };

  const parsed = leafSchema.safeParse(candidate);

  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  return {
    ok: false,
    reasons: [
      ...describe(parsed.error, `Leaf ${String(document.id)}`),
      // Zod reports the locator failure as a generic refinement message on the array.
      // Naming the offending entries turns a log line into something actionable.
      ...describeMissingLocators(document),
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Resolves a relationship to its id, whichever form Payload sent.
 *
 * At `depth=0` this is a bare integer; at a higher depth it is the populated document.
 * Accepting both means raising the depth later cannot silently produce `"[object
 * Object]"` as a track id.
 */
function resolveRelationshipId(relationship: number | { id: number }): string {
  return typeof relationship === 'number'
    ? String(relationship)
    : String(relationship.id);
}

/** Payload omits `_status` on some reads; absent is treated as draft, the safe direction. */
function mapStatus(status: 'draft' | 'published' | null | undefined): 'draft' | 'published' {
  return status === 'published' ? 'published' : 'draft';
}

function mapBodySlide(slide: { body?: string | null; audio?: CmsAudio } | undefined): {
  body: string | undefined;
  audio?: { url: string; durationSeconds?: number };
} {
  return { body: slide?.body ?? undefined, ...optionalAudio(slide?.audio) };
}

type CmsAudio = { url?: string | null; durationSeconds?: number | null } | undefined;

/**
 * Emits an `audio` key only when there is a usable URL.
 *
 * Payload writes an empty group rather than omitting it, and the domain model uses
 * `exactOptionalPropertyTypes` — so `{ audio: undefined }` and no `audio` key are
 * different things, and only the latter validates.
 */
function optionalAudio(audio: CmsAudio): { audio?: { url: string; durationSeconds?: number } } {
  if (isAbsent(audio?.url) || audio.url.length === 0) {
    return {};
  }

  return {
    audio: {
      url: audio.url,
      ...(isAbsent(audio.durationSeconds) ? {} : { durationSeconds: audio.durationSeconds }),
    },
  };
}

/**
 * Payload assigns row ids to array entries, but types them optional because a draft
 * row may not have been persisted yet.
 *
 * A missing option id is rejected rather than substituted with the array index. WP4
 * has the client submit an option id to answer a scenario, and an index-derived id
 * silently changes meaning the moment an author reorders the options — turning a
 * correct answer into a wrong one with no error anywhere.
 */
function findMissingOptionId(document: CmsLeaf): string | null {
  const options = document.scenario?.options ?? [];

  const missing = options.findIndex((option) => isAbsent(option.id) || option.id.length === 0);

  if (missing === -1) {
    return null;
  }

  return (
    `Leaf ${String(document.id)}: scenario option ${String(missing + 1)} has no id. ` +
    'Answer submission needs a stable option id; re-saving the Leaf in the CMS assigns one.'
  );
}

/** Names each source reference that lacks a locator, reusing the shared predicate. */
function describeMissingLocators(document: CmsLeaf): readonly string[] {
  return (document.sourceReferences ?? [])
    .map((reference, index) => ({
      index,
      ok: hasSourceLocator({
        chapter: reference.chapter ?? undefined,
        page: reference.page ?? undefined,
        quote: reference.quote ?? undefined,
      }),
    }))
    .filter((entry) => !entry.ok)
    .map(
      (entry) =>
        `Leaf ${String(document.id)}: source reference ${String(entry.index + 1)} — ` +
        SOURCE_LOCATOR_REQUIRED_MESSAGE,
    );
}

/** Flattens a Zod error into log lines that name the field and the problem. */
function describe(error: ZodError, subject: string): readonly string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${subject}: ${path === '' ? '(root)' : path} — ${issue.message}`;
  });
}
