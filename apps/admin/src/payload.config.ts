import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import sharp from 'sharp';

import { Admins } from './collections/Admins';
import { Leaves } from './collections/Leaves';
import { Media } from './collections/Media';
import { Tracks } from './collections/Tracks';
import { loadConfig } from './config/env';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config = loadConfig();

/**
 * Generated types land in `packages/shared`, in their **own file**.
 *
 * `packages/shared/src/content.ts` stays hand-written and authoritative — it is the
 * contract the backend and the mobile app share, and it encodes invariants Payload
 * cannot express (a 3-tuple of options, `isPlaceholder` defaulting to true on parse).
 * The generated file is the CMS's view of the same content, useful to WP3 when mapping
 * API responses, and it must never overwrite the hand-written one.
 *
 * Divergences confirmed against the generated output on 2026-08-08, after the schema
 * freeze. **WP3's mapper has to close every one of these** — they are not cosmetic.
 *
 *  - **Ids are numbers, not strings.** Payload's Postgres adapter uses serial integer
 *    primary keys, so it emits `id: number` and `trackId: number | Track`. The domain
 *    model's `cmsIdSchema` is `z.string().min(1)`. The mapper must stringify, and a
 *    relationship may arrive either populated or as a bare id depending on `depth`.
 *  - `stickyNotes.notes` is `string[]` in the domain model; Payload array rows are
 *    always objects, so it emits `{ note?: string | null; id?: string | null }[]`.
 *  - `scenario.options` is a 3-tuple in the domain model; Payload emits a plain array,
 *    with the count enforced by minRows/maxRows at runtime instead.
 *  - Payload marks almost every field optional and nullable regardless of whether the
 *    collection requires it, because a draft may legitimately be incomplete. The
 *    domain model's requiredness is therefore stricter, and the mapper is where a
 *    published document is proven to satisfy it.
 *  - Payload adds `_status`, `createdAt`, `updatedAt` and row `id`s throughout.
 */
const GENERATED_TYPES_PATH = path.resolve(
  dirname,
  '../../../packages/shared/src/cms-generated.ts',
);

export default buildConfig({
  admin: {
    user: Admins.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },

  collections: [Admins, Tracks, Leaves, Media],

  editor: lexicalEditor(),

  secret: config.PAYLOAD_SECRET,

  db: postgresAdapter({
    pool: {
      connectionString: config.PAYLOAD_DATABASE_URL,
    },
  }),

  typescript: {
    outputFile: GENERATED_TYPES_PATH,

    /**
     * Suppress the `declare module 'payload'` augmentation Payload appends by default.
     *
     * That block exists to type `payload.create(...)` calls *inside* a Payload app. Here
     * the generated file lives in `packages/shared`, which does not depend on `payload`
     * and must not — the mobile app consumes this package, and pulling a CMS (and its
     * Next-adjacent dependency tree) into it would breach the isolation requirement.
     * With the augmentation present, `tsc` fails outright: "Invalid module name in
     * augmentation, module 'payload' cannot be found."
     *
     * The cost is that this workspace's own `payload.*` calls are loosely typed on
     * collection slugs. Flagged for Architect: the alternative is emitting twice, once
     * locally with the augmentation and once into shared without it.
     */
    declare: false,
  },

  sharp,
});
