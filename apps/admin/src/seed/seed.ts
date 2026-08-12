/**
 * Seeds the CMS with the Phase 1 placeholder corpus.
 *
 *   npm run seed --workspace=apps/admin
 *
 * Needs the CMS running (`npm run dev:admin`) and three environment variables:
 * `PAYLOAD_URL`, `PAYLOAD_ADMIN_EMAIL`, `PAYLOAD_ADMIN_PASSWORD`.
 *
 * **Idempotent.** Every record is matched on a natural key — `bookTitle` for a Track,
 * `title` within a Track for a Leaf — and updated rather than duplicated. Running it
 * twice is a no-op with the same end state, which matters because the realistic usage
 * is running it repeatedly against a database somebody is also clicking around in.
 *
 * Everything it writes carries `isPlaceholder: true`. Nothing here is publishable to
 * production: `ContentService`'s guard is what enforces that, and this script does not
 * go near it.
 */

import {
  buildDraftLeaf,
  buildDraftTrack,
  buildFillerTrack,
  buildPlaceholderLeaf,
  buildPlaceholderTrack,
  DRAFT_TRACK_TITLE,
  FILLER_TRACK_COUNT,
  PLACEHOLDER_LEAF_COUNT,
  PLACEHOLDER_TRACK_TITLE,
  RETIRED_TRACK_TITLES,
  type SeedLeaf,
  type SeedTrack,
} from './placeholderContent';
import { type PayloadDocument, PayloadRestClient, PayloadRestError } from './payloadRestClient';

/* eslint-disable no-restricted-properties --
 * A standalone script, not part of the running app. It has no access to the validated
 * config module, which is Next.js-scoped, so this is the sanctioned direct read. */
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://127.0.0.1:3001';
const ADMIN_EMAIL = process.env['PAYLOAD_ADMIN_EMAIL'];
const ADMIN_PASSWORD = process.env['PAYLOAD_ADMIN_PASSWORD'];
/* eslint-enable no-restricted-properties */

interface SeedSummary {
  tracksCreated: number;
  tracksUpdated: number;
  tracksRemoved: number;
  leavesCreated: number;
  leavesUpdated: number;
}

/**
 * Drops Tracks this fixture published under a name it no longer uses.
 *
 * Runs before the writes so the corpus total at the end is accurate. Guarded twice: the
 * title must appear in `RETIRED_TRACK_TITLES`, and the record must still carry
 * `isPlaceholder`. If someone has repurposed that title for real content, the seed says
 * so and leaves it alone rather than deleting an author's work.
 */
async function removeRetiredTracks(client: PayloadRestClient, summary: SeedSummary): Promise<void> {
  for (const title of RETIRED_TRACK_TITLES) {
    const existing = await client.findOneBy<PayloadDocument & { isPlaceholder?: boolean }>(
      'tracks',
      'bookTitle',
      title,
    );

    if (existing === null) {
      continue;
    }

    if (existing.isPlaceholder !== true) {
      console.warn(`Leaving "${title}" alone: it is no longer flagged as placeholder content.`);
      continue;
    }

    await client.delete('tracks', existing.id);
    summary.tracksRemoved += 1;
  }
}

/**
 * Writes a Track, matching on its title.
 *
 * `bookTitle` is the natural key because it is what an operator sees and what the seed
 * controls. An id would be stabler but is not knowable before the first run, and
 * storing one in the repo would make the seed specific to one database.
 */
async function upsertTrack(
  client: PayloadRestClient,
  track: SeedTrack,
  status: 'draft' | 'published',
  summary: SeedSummary,
): Promise<number> {
  const existing = await client.findOneBy('tracks', 'bookTitle', track.bookTitle);

  if (existing !== null) {
    await client.update('tracks', existing.id, { ...track }, status);
    summary.tracksUpdated += 1;
    return existing.id;
  }

  const created = await client.create('tracks', { ...track }, status);
  summary.tracksCreated += 1;
  return created.id;
}

async function upsertLeaf(
  client: PayloadRestClient,
  leaf: SeedLeaf,
  trackId: number,
  status: 'draft' | 'published',
  summary: SeedSummary,
): Promise<void> {
  const { trackKey: _trackKey, ...fields } = leaf;
  const payload = { ...fields, trackId };

  const existing = await client.findOneBy('leaves', 'title', leaf.title);

  if (existing !== null) {
    await client.update('leaves', existing.id, payload, status);
    summary.leavesUpdated += 1;
    return;
  }

  await client.create('leaves', payload, status);
  summary.leavesCreated += 1;
}

async function seed(): Promise<void> {
  if (ADMIN_EMAIL === undefined || ADMIN_PASSWORD === undefined) {
    throw new Error(
      'PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD must be set. See .env.example.',
    );
  }

  const client = new PayloadRestClient(PAYLOAD_URL);
  await client.signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

  const summary: SeedSummary = {
    tracksCreated: 0,
    tracksUpdated: 0,
    tracksRemoved: 0,
    leavesCreated: 0,
    leavesUpdated: 0,
  };

  await removeRetiredTracks(client, summary);

  /* The full-length Track — the one WP8 will actually be judged against. */
  const trackId = await upsertTrack(
    client,
    buildPlaceholderTrack(PLACEHOLDER_LEAF_COUNT),
    'published',
    summary,
  );

  // Sequentially, not in parallel: twenty concurrent writes against a local Payload
  // produce a flurry of pool contention and interleaved validation errors that are
  // miserable to read. The seed is not on anyone's critical path.
  for (let orderIndex = 0; orderIndex < PLACEHOLDER_LEAF_COUNT; orderIndex += 1) {
    await upsertLeaf(
      client,
      buildPlaceholderLeaf(PLACEHOLDER_TRACK_TITLE, orderIndex),
      trackId,
      'published',
      summary,
    );
  }

  /* Filler Tracks, so Explore has more than one page to page through. */
  for (let index = 0; index < FILLER_TRACK_COUNT; index += 1) {
    await upsertTrack(client, buildFillerTrack(index), 'published', summary);
  }

  /**
   * The draft pair, written last and left unpublished.
   *
   * These are the fixtures nothing has ever had: the corpus has been entirely published
   * until now, so `read: publishedOrAuthenticated` has never had a draft to exclude and
   * no test could prove it excludes one.
   */
  const draftTrackId = await upsertTrack(client, buildDraftTrack(), 'draft', summary);
  await upsertLeaf(client, buildDraftLeaf(DRAFT_TRACK_TITLE), draftTrackId, 'draft', summary);

  const totalTracks = await client.count('tracks');

  // `console.warn`, not `log`: the repo's lint rule allows only `warn` and `error`, and
  // a seed script's summary is the whole point of running it — writing it to stderr is
  // a better answer than exempting the rule.
  console.warn(
    [
      'Seed complete.',
      `  Tracks:  ${String(summary.tracksCreated)} created, ${String(summary.tracksUpdated)} updated, ${String(summary.tracksRemoved)} retired`,
      `  Leaves:  ${String(summary.leavesCreated)} created, ${String(summary.leavesUpdated)} updated`,
      `  Corpus:  ${String(totalTracks)} Tracks total (including the unpublished draft)`,
    ].join('\n'),
  );
}

seed().catch((error: unknown) => {
  if (error instanceof PayloadRestError) {
    // The body names the field and the rule that rejected it — the only useful part
    // when one of twenty Leaves fails validation.
    console.error(`${error.message}\n${error.body}`);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
