/**
 * Shared vocabulary for the content validation rules.
 *
 * Every rule is a pure function from a document to a `RuleResult`. Payload hooks are
 * thin wrappers that call these and translate a failure into the error Payload
 * expects — so the rules themselves are unit-testable without booting a CMS, a
 * database, or a Next.js server.
 *
 * The input types below deliberately mirror what Payload actually hands a
 * `beforeChange` hook, which is **not** the clean shape in `packages/shared`:
 *
 * - Fields are optional. A hook fires on partial saves and on drafts.
 * - Empty fields arrive as `null`, not `undefined`.
 * - Payload array rows are always objects, so an array of strings in the domain
 *   model (`stickyNotes.notes: string[]`) is an array of `{ note: string }` rows here.
 *
 * Modelling that honestly is the point: a rule that assumes the tidy domain shape
 * would pass its unit tests and then fail to fire against a real document.
 */

export interface RuleViolation {
  /** Dot path to the offending field, used to attach the error in the admin UI. */
  readonly path: string;
  /** Author-facing message. Must say what to do, not merely what is wrong. */
  readonly message: string;
}

export type RuleResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly violations: readonly RuleViolation[] };

export const PASSED: RuleResult = { ok: true };

export function failed(path: string, message: string): RuleResult {
  return { ok: false, violations: [{ path, message }] };
}

/* -------------------------------------------------------------------------- */
/* Document shapes as Payload delivers them                                    */
/* -------------------------------------------------------------------------- */

export interface ScenarioOptionInput {
  readonly text?: string | null;
  readonly isCorrect?: boolean | null;
}

export interface StickyNoteInput {
  readonly note?: string | null;
}

export interface SourceReferenceInput {
  readonly slideKey?: string | null;
  readonly chapter?: string | null;
  readonly page?: string | null;
  readonly quote?: string | null;
  readonly note?: string | null;
}

export interface LeafDocumentInput {
  readonly title?: string | null;
  readonly summary?: { readonly body?: string | null } | null;
  readonly scenario?:
    | {
        readonly prompt?: string | null;
        readonly options?: readonly ScenarioOptionInput[] | null;
      }
    | null;
  readonly payoff?: { readonly body?: string | null } | null;
  readonly stickyNotes?: { readonly notes?: readonly StickyNoteInput[] | null } | null;
  readonly takeaway?:
    | {
        readonly body?: string | null;
        readonly dinnerTableKnowledge?: string | null;
      }
    | null;
  readonly sourceReferences?: readonly SourceReferenceInput[] | null;
}

export interface PurchaseLinkInput {
  readonly retailer?: string | null;
  readonly url?: string | null;
  readonly isAffiliate?: boolean | null;
}

export interface TrackDocumentInput {
  readonly bookTitle?: string | null;
  readonly publisher?: string | null;
  readonly coverUrl?: string | null;
  readonly disclaimer?: string | null;
  readonly purchaseLinks?: readonly PurchaseLinkInput[] | null;
}

/** True when a value is a string with at least one non-whitespace character. */
export function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
