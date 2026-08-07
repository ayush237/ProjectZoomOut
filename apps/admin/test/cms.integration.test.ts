import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integration coverage for the CMS against a real Postgres instance.
 *
 * Two things here cannot be proven by unit-testing the rules in isolation:
 *
 * 1. That the hooks are actually **wired** — a perfect rule that no collection calls
 *    protects nothing.
 * 2. That **takedown works**. `LEGAL.md` commits to pulling a Track within hours of a
 *    verified complaint. That obligation rests on read access-control dropping
 *    unpublished documents from API responses, which is Payload behaviour, not ours.
 *    Reading the docs is not verification for a legal commitment.
 *
 * Payload is booted in-process with `getPayload`, and its Local API is used rather
 * than HTTP: it runs the same access control, hooks and draft resolution, without
 * needing a Next.js server in the test process.
 *
 * Requires a running Docker daemon.
 */

const POSTGRES_IMAGE = 'postgres:16-alpine';
const TEST_SECRET = 'integration-test-secret-at-least-32-chars-long';

let container: StartedPostgreSqlContainer;
let payload: Payload;

beforeAll(async () => {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();

  /* eslint-disable no-restricted-properties --
   * The config module validates the environment when payload.config is first
   * evaluated, so the container's connection string has to be in place before that
   * import happens. Pointing the CMS at a throwaway database is the whole point of
   * this suite, and it is why the imports below are dynamic. */
  process.env['PAYLOAD_SECRET'] = TEST_SECRET;
  process.env['PAYLOAD_DATABASE_URL'] = container.getConnectionUri();
  /* eslint-enable no-restricted-properties */

  const { getPayload } = await import('payload');
  const config = (await import('../src/payload.config')).default;

  payload = await getPayload({ config });

  // Payload does not attach an `error` listener to its pool. Without one, an idle
  // client erroring is escalated by `pg` to an uncaught exception — which is exactly
  // what happens when the container is torn down at the end of the run, and vitest
  // reports it as a run-level failure that has nothing to do with any assertion.
  //
  // Note this is not merely a test concern: the same gap applies to any process that
  // boots Payload, so it is recorded as a follow-up rather than only patched here.
  const pool = (payload.db as { pool?: { on?: (event: string, cb: () => void) => void } }).pool;
  pool?.on?.('error', () => {
    // Expected when Postgres goes away underneath us. Nothing to recover.
  });
}, 300_000);

afterAll(async () => {
  // `payload.destroy()` only resets in-memory schema state — see
  // @payloadcms/drizzle/dist/destroy.js. It does not close the pool, and calling
  // `pool.end()` here hangs indefinitely because Payload keeps a client checked out.
  // The `error` listener attached at boot is what keeps the resulting teardown noise
  // from surfacing as an uncaught exception.
  if (payload) {
    await payload.destroy();
  }

  if (container) {
    await container.stop();
  }
});

/* -------------------------------------------------------------------------- */
/* Assertion helper                                                            */
/* -------------------------------------------------------------------------- */

interface PayloadFieldError {
  readonly path?: string;
  readonly message?: string;
}

/**
 * Runs an operation expected to be rejected and returns Payload's per-field errors.
 *
 * Asserting on `error.message` would only ever see Payload's generic summary ("The
 * following fields are invalid: ..."). The author-facing text our rules produce lives
 * in the structured field errors, so that is what these tests check — it verifies the
 * message an author actually sees, not just that something was rejected.
 */
async function captureFieldErrors(operation: () => Promise<unknown>): Promise<PayloadFieldError[]> {
  try {
    await operation();
  } catch (error) {
    const errors = (error as { data?: { errors?: PayloadFieldError[] } }).data?.errors;
    if (errors === undefined) {
      throw new Error(
        `Expected a Payload ValidationError with field errors, got: ${String(error)}`,
      );
    }
    return errors;
  }

  throw new Error('Expected the operation to be rejected, but it succeeded');
}

const messagesFrom = (errors: readonly PayloadFieldError[]): string =>
  errors.map((e) => `${e.path ?? ''}: ${e.message ?? ''}`).join(' | ');

/* -------------------------------------------------------------------------- */
/* Schema                                                                      */
/* -------------------------------------------------------------------------- */

describe('collections', () => {
  it('exposes tracks and leaves', () => {
    expect(Object.keys(payload.collections)).toEqual(
      expect.arrayContaining(['tracks', 'leaves', 'admins']),
    );
  });

  it('defaults isPlaceholder to true on a Track', async () => {
    const track = await payload.create({
      collection: 'tracks',
      data: { bookTitle: 'Defaults Probe', author: 'A' },
    });

    expect(track['isPlaceholder']).toBe(true);
  });

  it('defaults isPlaceholder to true on a Leaf', async () => {
    const track = await payload.create({
      collection: 'tracks',
      data: { bookTitle: 'Leaf Defaults Probe', author: 'A' },
    });

    const leaf = await payload.create({
      collection: 'leaves',
      data: { trackId: track.id, orderIndex: 0, title: 'Defaults Probe Leaf' },
    });

    expect(leaf['isPlaceholder']).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Hooks are wired                                                             */
/* -------------------------------------------------------------------------- */

describe('Leaf validation is enforced by the CMS, not just by the rules', () => {
  let trackId: number | string;

  beforeAll(async () => {
    const track = await payload.create({
      collection: 'tracks',
      data: { bookTitle: 'Validation Host', author: 'A' },
    });
    trackId = track.id;
  });

  it('rejects a scenario with two correct options', async () => {
    const errors = await captureFieldErrors(() =>
      payload.create({
        collection: 'leaves',
        data: {
          trackId,
          orderIndex: 1,
          title: 'Two correct',
          scenario: {
            prompt: 'p',
            options: [
              { text: 'A', isCorrect: true },
              { text: 'B', isCorrect: true },
              { text: 'C', isCorrect: false },
            ],
          },
        },
      }),
    );

    expect(messagesFrom(errors)).toMatch(/exactly one correct answer/u);
    expect(messagesFrom(errors)).toMatch(/2 are marked correct/u);
  });

  it('rejects a scenario with no correct option', async () => {
    const errors = await captureFieldErrors(() =>
      payload.create({
        collection: 'leaves',
        data: {
          trackId,
          orderIndex: 2,
          title: 'None correct',
          scenario: {
            prompt: 'p',
            options: [
              { text: 'A', isCorrect: false },
              { text: 'B', isCorrect: false },
              { text: 'C', isCorrect: false },
            ],
          },
        },
      }),
    );

    expect(messagesFrom(errors)).toMatch(/none is marked correct/u);
  });

  it('rejects Dinner Table Knowledge with no takeaway source reference', async () => {
    const errors = await captureFieldErrors(() =>
      payload.create({
        collection: 'leaves',
        data: {
          trackId,
          orderIndex: 3,
          title: 'Unsourced deep cut',
          takeaway: { body: 't', dinnerTableKnowledge: 'An unsourced claim.' },
        },
      }),
    );

    // The message must tell the author how to fix it, not merely that it is wrong.
    expect(messagesFrom(errors)).toMatch(/Add a Source Reference/u);
    expect(errors.some((e) => e.path === 'takeaway.dinnerTableKnowledge')).toBe(true);
  });

  it('accepts Dinner Table Knowledge when it is sourced', async () => {
    const leaf = await payload.create({
      collection: 'leaves',
      data: {
        trackId,
        orderIndex: 4,
        title: 'Sourced deep cut',
        takeaway: { body: 't', dinnerTableKnowledge: 'A sourced claim.' },
        sourceReferences: [{ slideKey: 'takeaway', note: 'Chapter 4, page 87.' }],
      },
    });

    expect(leaf.id).toBeDefined();
  });

  it('allows an incomplete Leaf to be saved as a draft', async () => {
    const leaf = await payload.create({
      collection: 'leaves',
      data: { trackId, orderIndex: 5, title: 'Work in progress' },
    });

    expect(leaf.id).toBeDefined();
  });

  it('refuses to publish that incomplete Leaf', async () => {
    const leaf = await payload.create({
      collection: 'leaves',
      data: { trackId, orderIndex: 6, title: 'Still incomplete' },
    });

    const errors = await captureFieldErrors(() =>
      payload.update({
        collection: 'leaves',
        id: leaf.id,
        data: { _status: 'published' },
      }),
    );

    expect(messagesFrom(errors)).toMatch(/must be filled in before a Leaf can be published/u);
    // Every incomplete slide is named, so the author fixes them in one pass.
    expect(errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(['summary', 'scenario', 'payoff', 'stickyNotes', 'takeaway']),
    );
  });
});

describe('Track validation is enforced by the CMS', () => {
  it('allows a bare Track to be saved as a draft', async () => {
    const track = await payload.create({
      collection: 'tracks',
      data: { bookTitle: 'Bare draft', author: 'A' },
    });

    expect(track.id).toBeDefined();
  });

  it('refuses to publish a Track with no disclaimer or purchase link', async () => {
    const track = await payload.create({
      collection: 'tracks',
      data: { bookTitle: 'Unpublishable', author: 'A' },
    });

    const errors = await captureFieldErrors(() =>
      payload.update({
        collection: 'tracks',
        id: track.id,
        data: { _status: 'published' },
      }),
    );

    // Both legal requirements are reported together rather than one per attempt.
    expect(errors.map((e) => e.path).sort()).toEqual(['disclaimer', 'purchaseLinks']);
    expect(messagesFrom(errors)).toMatch(/non-endorsement disclaimer/u);
    expect(messagesFrom(errors)).toMatch(/at least one purchase link/u);
  });

  it('publishes a Track that carries both legal requirements', async () => {
    const track = await payload.create({
      collection: 'tracks',
      data: {
        bookTitle: 'Publishable',
        author: 'A',
        disclaimer: 'Not affiliated with or endorsed by the author or publisher.',
        purchaseLinks: [{ retailer: 'Example Books', url: 'https://example.test/book' }],
      },
    });

    const published = await payload.update({
      collection: 'tracks',
      id: track.id,
      data: { _status: 'published' },
    });

    expect(published['_status']).toBe('published');
  });
});

/* -------------------------------------------------------------------------- */
/* Takedown — the legal requirement                                            */
/* -------------------------------------------------------------------------- */

describe('takedown', () => {
  /** Reads as an anonymous caller — no user, so access control applies. */
  const readAsPublic = async (id: number | string): Promise<number> => {
    const result = await payload.find({
      collection: 'tracks',
      where: { id: { equals: id } },
      overrideAccess: false,
      draft: false,
    });
    return result.totalDocs;
  };

  it('removes an unpublished Track from public reads immediately', async () => {
    const track = await payload.create({
      collection: 'tracks',
      data: {
        bookTitle: 'Takedown Subject',
        author: 'A',
        disclaimer: 'Not affiliated with or endorsed by the author or publisher.',
        purchaseLinks: [{ retailer: 'Example Books', url: 'https://example.test/book' }],
      },
    });

    await payload.update({
      collection: 'tracks',
      id: track.id,
      data: { _status: 'published' },
    });

    expect(await readAsPublic(track.id)).toBe(1);

    // The takedown itself: one click of Unpublish in the admin UI.
    await payload.update({
      collection: 'tracks',
      id: track.id,
      data: { _status: 'draft' },
    });

    expect(await readAsPublic(track.id)).toBe(0);
  });

  it('keeps the record visible to an authenticated operator after takedown', async () => {
    // Takedown must hide content from readers without destroying it — the record is
    // needed to fix and republish, and as an audit trail.
    const track = await payload.create({
      collection: 'tracks',
      data: {
        bookTitle: 'Recoverable',
        author: 'A',
        disclaimer: 'Not affiliated.',
        purchaseLinks: [{ retailer: 'R', url: 'https://example.test' }],
      },
    });

    await payload.update({ collection: 'tracks', id: track.id, data: { _status: 'published' } });
    await payload.update({ collection: 'tracks', id: track.id, data: { _status: 'draft' } });

    const asOperator = await payload.find({
      collection: 'tracks',
      where: { id: { equals: track.id } },
    });

    expect(asOperator.totalDocs).toBe(1);
  });

  it('hides a never-published Track from public reads', async () => {
    const track = await payload.create({
      collection: 'tracks',
      data: { bookTitle: 'Never published', author: 'A' },
    });

    expect(await readAsPublic(track.id)).toBe(0);
  });
});
