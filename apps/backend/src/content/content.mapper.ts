import {
  hasSourceLocator,
  leafSchema,
  SOURCE_LOCATOR_REQUIRED_MESSAGE,
  trackSchema,
  type DiagramAsset,
  type DiagramSpecFormat,
  type ImageAsset,
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
 *  - media URLs (`scenario.image.url`, `stickyNotes.diagram.url`, `Track.coverUrl`)
 *    are stored CMS-relative (`/api/media/file/...`); `imageAssetSchema` requires
 *    absolute (WP15.8)
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

export function mapTrack(document: CmsTrack, baseUrl: string): MappingResult<Track> {
  const candidate = {
    id: String(document.id),
    bookTitle: document.bookTitle,
    author: document.author,
    publisher: document.publisher ?? undefined,
    coverUrl: isAbsent(document.coverUrl) ? undefined : resolveMediaUrl(document.coverUrl, baseUrl),
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
    // Falls back to the same default the schema and the CMS use. A Track written before
    // the field existed has no value at all here, and `undocumented` is the honest
    // reading of that — not a repair, just the answer spelled out.
    acquisition: document.acquisition ?? 'undocumented',
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

export function mapLeaf(document: CmsLeaf, baseUrl: string): MappingResult<Leaf> {
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
      ...optionalImage(document.scenario?.image, baseUrl),
      ...optionalAudio(document.scenario?.audio),
    },
    payoff: mapBodySlide(document.payoff),
    stickyNotes: {
      // Payload array rows are objects; the domain model is a plain string list.
      notes: (document.stickyNotes?.notes ?? []).map((row) => row.note ?? ''),
      ...optionalDiagram(document.stickyNotes?.diagram, baseUrl),
      ...optionalAudio(document.stickyNotes?.audio),
    },
    takeaway: {
      body: document.takeaway?.body ?? undefined,
      ...(isAbsent(document.takeaway?.dinnerTableKnowledge)
        ? {}
        : { dinnerTableKnowledge: document.takeaway.dinnerTableKnowledge }),
      ...(isAbsent(document.takeaway?.applyInLife)
        ? {}
        : { applyInLife: document.takeaway.applyInLife }),
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
  return typeof relationship === 'number' ? String(relationship) : String(relationship.id);
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

type CmsImage =
  | { url?: string | null; alt?: string | null; width?: number | null; height?: number | null }
  | undefined;

type CmsDiagram = (CmsImage & { spec?: string | null; specFormat?: string | null }) | undefined;

/**
 * Emits an `image` key only when there is a usable URL — the same rule as `optionalAudio`,
 * and for the same reason: Payload writes an empty group rather than omitting it, so
 * without this every Leaf would carry `image: { url: undefined, alt: undefined }`.
 *
 * **A URL without alt text is passed through, not repaired.** The obvious-looking
 * alternative — dropping the image when alt is missing — would make this gate agree with
 * the CMS by staying quiet, which is exactly what the two-gate design forbids: the CMS
 * refuses to publish an asset without alt, so a published one that lacks it means the
 * gates disagree and the Leaf must not ship. `''` fails `alt`'s `min(1)` and the failure
 * is reported against `scenario.image.alt`, naming the field an editor has to fix.
 */
function optionalImage(image: CmsImage, baseUrl: string): { image?: ImageAsset } {
  const asset = mapImageParts(image, baseUrl);

  return asset === null ? {} : { image: asset };
}

/**
 * The diagram is an image plus the spec it was rendered from (content-pipeline R4).
 *
 * `specFormat` is passed through unvalidated: `diagramAssetSchema` owns which formats
 * exist, and narrowing the string here would put that list in two places and let them
 * drift. An unknown format is rejected by the schema with the field named.
 */
function optionalDiagram(diagram: CmsDiagram, baseUrl: string): { diagram?: DiagramAsset } {
  const asset = mapImageParts(diagram, baseUrl);

  if (asset === null) {
    return {};
  }

  return {
    diagram: {
      ...asset,
      ...(isAbsent(diagram?.spec) || diagram.spec.length === 0 ? {} : { spec: diagram.spec }),
      ...(isAbsent(diagram?.specFormat)
        ? {}
        : // Cast, with the schema as the check: `specFormat` is a Payload `select` typed
          // as a bare string, and `diagramAssetSchema` rejects anything not in
          // `DIAGRAM_SPEC_FORMATS`. Narrowing it here instead would duplicate that list.
          { specFormat: diagram.specFormat as DiagramSpecFormat }),
    },
  };
}

/**
 * The fields every image asset shares. `null` means "no image here at all".
 *
 * **Trimmed before the schema sees it**, because `min(1)` counts `"  "` as content. The
 * CMS strips whitespace in a `beforeChange` hook, so a document authored through the
 * admin UI arrives clean — but this mapper also reads rows the Phase 2 pipeline writes
 * directly, which never pass through that hook. Untrimmed, a space-only alt would
 * satisfy both gates and reach a screen reader as silence.
 */
function mapImageParts(image: CmsImage, baseUrl: string): ImageAsset | null {
  const url = image?.url?.trim() ?? '';

  if (url.length === 0) {
    return null;
  }

  return {
    url: resolveMediaUrl(url, baseUrl),
    alt: image?.alt?.trim() ?? '',
    ...(isAbsent(image?.width) ? {} : { width: image.width }),
    ...(isAbsent(image?.height) ? {} : { height: image.height }),
  };
}

/**
 * Resolves a CMS-stored media URL to one a client can load directly (WP15.8).
 *
 * Payload stores media relatively (`/api/media/file/...`) so content stays portable
 * across environments — moving Payload to a new host must not require rewriting every
 * document. `imageAssetSchema` requires an absolute URL, because a domain object should
 * carry something a client can fetch without also knowing where the CMS lives. This is
 * the resolution step between those two, and the only thing that changes either side.
 *
 * **An already-absolute URL is returned exactly as stored**, not round-tripped through
 * `URL` — `new URL(x).toString()` can normalise a well-formed absolute URL (default
 * port, trailing slash, escaping) into a string that no longer matches the input, and a
 * value this function had no reason to touch must not appear to have changed.
 *
 * **Only a leading-slash reference is resolved — anything else is left alone.** Payload's
 * relative media URLs are always absolute-path references (`/api/media/file/...`); a
 * value that is neither that nor already-absolute is not a CMS convention, it is a
 * content defect (a typo, a hand-entered non-URL). `new URL(x, base)` would happily
 * "resolve" `'not-a-url'` into a syntactically valid absolute URL too, which would
 * launder that defect straight past `imageAssetSchema`'s `z.url()` check instead of
 * being caught by it — the opposite of what the two-gate design in this file exists to
 * do. Restricting resolution to `/`-prefixed input keeps that gate intact.
 */
function resolveMediaUrl(url: string, baseUrl: string): string {
  if (isAbsoluteUrl(url)) {
    return url;
  }

  return url.startsWith('/') ? new URL(url, baseUrl).toString() : url;
}

/** Whether a string already parses as a standalone URL, i.e. carries its own scheme. */
function isAbsoluteUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
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
