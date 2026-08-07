import { ValidationError, type CollectionBeforeChangeHook } from 'payload';

import type { RuleResult } from '../validation/types';

/**
 * Turns a pure validation function into a Payload `beforeChange` hook.
 *
 * The hook does three things and nothing else: work out whether this save is a
 * publish, call the rule, and translate a failure into the error Payload understands.
 * All the actual content policy lives in `src/validation/`, where it can be tested
 * without a database, a CMS or a Next.js server.
 */
export function validateBeforeChange<TDocument>(
  collectionSlug: string,
  validate: (document: TDocument, isPublishing: boolean) => RuleResult,
): CollectionBeforeChangeHook {
  return ({ data }) => {
    // Payload writes the draft/published state onto `_status`. A save that sets it to
    // `published` is the moment content becomes reachable by a reader, which is what
    // the publish-gated rules key off.
    const isPublishing = (data as { _status?: unknown })._status === 'published';

    const result = validate(data as TDocument, isPublishing);

    if (result.ok) {
      return data;
    }

    throw new ValidationError({
      collection: collectionSlug,
      errors: result.violations.map((violation) => ({
        path: violation.path,
        message: violation.message,
      })),
    });
  };
}
