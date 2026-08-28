import type { Access, FieldAccess, PayloadRequest } from 'payload';

/**
 * Write access for content collections — the control that keeps a machine out of
 * published content.
 *
 * **This exists to convert a promise into a permission.** The pipeline's own client
 * asserts `_status == "draft"` before every write and has no publish method at all.
 * That is a good belt, but it is the pipeline vouching for itself: a bug, a refactor
 * or a future caller reusing the credential is all it takes for the assertion to stop
 * being true, and nothing outside that process would notice. A credential that *cannot*
 * publish holds regardless of what the code holding it does.
 *
 * "Cannot publish" is deliberately read wider than the literal act, because all three
 * of these change what the public is served:
 *
 *  - **publishing** — writing `_status: 'published'`
 *  - **unpublishing** — the takedown lever in `access/published.ts`, and not a
 *    machine's to pull
 *  - **editing anything already published** — an update to a live document is a live
 *    content change even when `_status` never appears in the request
 *
 * Humans are unaffected: these return the same `true` Payload's default write access
 * would have. Human RBAC stays deferred — there is nobody to differentiate at a team
 * of one — and this is not that decision reopened. It separates people from programs,
 * which is a distinction that exists at a team of one.
 */

/** The only `_status` a machine account may write. */
const MACHINE_WRITABLE_STATUS = 'draft';

type StatusBearing = { readonly _status?: unknown };

function isMachineAccount(user: PayloadRequest['user']): boolean {
  // Bracket access, not a cast: Payload types the authenticated user loosely enough
  // that `accountType` arrives through an index signature even after narrowing on
  // `collection`. Reaching for `as Admin` would assert a shape rather than read one.
  return user?.collection === 'admins' && user['accountType'] === 'machine';
}

/**
 * Delete: never, for a machine, on anything.
 *
 * **The pipeline has no use for deletion.** Its idempotency is find-then-update, and
 * the one cleanup WP17 needed was housekeeping a human did with a login. So this costs
 * the pipeline nothing, which is the easy half of the argument.
 *
 * The half that matters is what the capability would be worth if it were wrong.
 * WP15.2's publish scoping was believed correct, had thirteen passing unit tests behind
 * it, and still let this same key unpublish a live Track. **The identical mistake on
 * `delete` does not expose content, it destroys it** — and unpublishing is how a
 * takedown is served, so a machine that can delete a Track can break a legal obligation
 * rather than merely embarrass one.
 *
 * Unconditional, with no inspection of the document or the request. There is nothing to
 * get subtly wrong: no state to resolve, no query semantics to depend on, no flag a
 * caller can send. That is the point — the previous rule failed precisely because it
 * asked a question whose answer was ambiguous.
 */
export const machinesNeverDelete: Access = ({ req }) => {
  if (!req.user) {
    return false;
  }

  return !isMachineAccount(req.user);
};

/**
 * Create: a machine must say `draft` out loud.
 *
 * Tested against `'draft'` rather than against `'published'` so the refusal does not
 * depend on knowing every value that means "live". An omitted `_status` is refused
 * too, because whether Payload defaults it to draft or resolves it from the request's
 * `draft` query parameter is Payload's decision to change, and a control that a minor
 * version can quietly invert is not a control.
 */
export const machinesCreateDraftsOnly: Access<StatusBearing> = ({ req, data }) => {
  if (!req.user) {
    return false;
  }

  if (!isMachineAccount(req.user)) {
    return true;
  }

  return data?._status === MACHINE_WRITABLE_STATUS;
};

/**
 * Update: a machine may only write drafts, and only through Payload's draft mechanism.
 *
 * **The obvious implementation of this rule is wrong, and it was wrong here first.**
 * The first cut returned a query constraint — `_status not_equals published` — on the
 * reasoning that a published document would then not be in the set the credential can
 * address. Payload does apply that constraint. It still let a machine unpublish a live
 * Track, because with drafts enabled `_status` resolves against the document's *latest
 * version*: a Track that is published but carries a pending draft edit reads as a draft
 * to the query, and is updated as one. The hole opened only on documents with a draft
 * in flight, so it was invisible on a clean fixture and present on real content.
 *
 * What replaces it does not ask what state the document is in. `draft=true` routes the
 * write into the versions table, which is a different destination rather than a
 * different value — the published row the public is served is not what is being written
 * at all. A machine may therefore propose an edit to a live Track as a draft, which is
 * correct: proposing is not publishing, and a human still has to publish it.
 *
 * Requiring the caller to opt in fails closed. A machine that forgets the flag is
 * refused rather than quietly writing to the live row, which is the direction this
 * control has to fail in.
 */
export const machinesUpdateDraftsOnly: Access<StatusBearing> = ({ req, data }) => {
  if (!req.user) {
    return false;
  }

  if (!isMachineAccount(req.user)) {
    return true;
  }

  if (data?._status !== undefined && data._status !== MACHINE_WRITABLE_STATUS) {
    return false;
  }

  // REST sends the string; the Local API passes the boolean. Both are accepted, and
  // anything else — including the flag being absent — is a refusal.
  const draft = req.query['draft'];

  return draft === true || draft === 'true';
};

/**
 * Field-level write access: only a human may set this field.
 *
 * Built for `gateTwoStatus` on Leaves (WP15.4), which sits on the same documents
 * the pipeline is meant to populate with `imageCandidates` and `editorialFindings`.
 * The collection-level functions above are too blunt for that: refusing the whole
 * write would also refuse the fields the machine is *supposed* to write. This
 * refuses one field within an otherwise-permitted write instead.
 *
 * **Silent by design, not an error — unlike everything else in this file.** Payload
 * evaluates field access after collection access, and a denial there does not throw:
 * it deletes the submitted value and re-applies the field's `defaultValue`, so the
 * request that carried it still succeeds. A machine that includes `gateTwoStatus` in
 * a write is not met with a 403 for it; that one field is just not what it asked for.
 * Verify by reading the field back after the write, not by expecting the call to fail.
 */
export const humansOnlyField: FieldAccess = ({ req }) => {
  if (!req.user) {
    return false;
  }

  return !isMachineAccount(req.user);
};
