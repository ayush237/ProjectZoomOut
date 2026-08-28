import type { PayloadRequest } from 'payload';
import { describe, expect, it } from 'vitest';

import { machinesCreateDraftsOnly, machinesUpdateDraftsOnly } from './publishing';

/**
 * These assert the *rule*. The proof that the rule is actually reached — that Payload
 * refuses a real API key on a real publish — is behavioural and lives in the completion
 * report, because a unit test of an access function cannot tell you it was wired to the
 * collection at all. Both halves are needed: this one says the rule is right, the
 * curl says the rule runs.
 */

type Args = Parameters<typeof machinesCreateDraftsOnly>[0];

const asRequest = (user: unknown): PayloadRequest =>
  ({ user, query: {} }) as unknown as PayloadRequest;

const machine = asRequest({ collection: 'admins', accountType: 'machine' });
const human = asRequest({ collection: 'admins', accountType: 'human' });
const anonymous = asRequest(null);

/** The same request, carrying Payload's `?draft=` flag. */
const draftWrite = (req: PayloadRequest, value: unknown = 'true'): PayloadRequest => ({
  ...req,
  query: { draft: value },
});

const call = (access: typeof machinesCreateDraftsOnly, args: Partial<Args>): unknown =>
  access({ req: anonymous, ...args });

describe('machinesCreateDraftsOnly', () => {
  it('refuses an anonymous request', () => {
    expect(call(machinesCreateDraftsOnly, { req: anonymous })).toBe(false);
  });

  it('lets a human create anything, published included', () => {
    expect(call(machinesCreateDraftsOnly, { req: human, data: { _status: 'published' } })).toBe(
      true,
    );
  });

  it('lets a machine create a draft — otherwise the key is useless', () => {
    expect(call(machinesCreateDraftsOnly, { req: machine, data: { _status: 'draft' } })).toBe(true);
  });

  it('refuses a machine creating something already published', () => {
    expect(call(machinesCreateDraftsOnly, { req: machine, data: { _status: 'published' } })).toBe(
      false,
    );
  });

  it('refuses a machine that omits _status rather than assuming draft', () => {
    // Whether an omitted status resolves to draft is Payload's decision to change in a
    // minor version. A control that a dependency bump can invert is not a control.
    expect(call(machinesCreateDraftsOnly, { req: machine, data: {} })).toBe(false);
    expect(call(machinesCreateDraftsOnly, { req: machine })).toBe(false);
  });
});

describe('machinesUpdateDraftsOnly', () => {
  it('refuses an anonymous request', () => {
    expect(call(machinesUpdateDraftsOnly, { req: anonymous })).toBe(false);
  });

  it('lets a human update anything, flag or no flag', () => {
    expect(call(machinesUpdateDraftsOnly, { req: human, data: { _status: 'published' } })).toBe(
      true,
    );
  });

  it('refuses a machine publishing an existing draft', () => {
    expect(
      call(machinesUpdateDraftsOnly, { req: draftWrite(machine), data: { _status: 'published' } }),
    ).toBe(false);
  });

  it('lets a machine update through the draft mechanism', () => {
    expect(call(machinesUpdateDraftsOnly, { req: draftWrite(machine), data: {} })).toBe(true);
  });

  it('accepts the boolean the Local API passes as well as the string REST sends', () => {
    expect(call(machinesUpdateDraftsOnly, { req: draftWrite(machine, true), data: {} })).toBe(true);
  });

  /**
   * The regression that matters. The first implementation returned a
   * `_status not_equals published` constraint, which Payload resolves against the
   * latest *version* — so a published document carrying a pending draft read as a
   * draft and was writable. These assert the refusal no longer depends on the
   * document's state at all, only on the caller opting into a draft write.
   */
  it('refuses a machine that omits the draft flag', () => {
    expect(call(machinesUpdateDraftsOnly, { req: machine, data: {} })).toBe(false);
  });

  it('refuses a machine that asks for a non-draft write explicitly', () => {
    expect(call(machinesUpdateDraftsOnly, { req: draftWrite(machine, 'false'), data: {} })).toBe(
      false,
    );
  });

  it('refuses a machine writing draft content without the flag', () => {
    // Saying "draft" in the body is not the same as writing to the drafts table.
    expect(call(machinesUpdateDraftsOnly, { req: machine, data: { _status: 'draft' } })).toBe(
      false,
    );
  });
});
