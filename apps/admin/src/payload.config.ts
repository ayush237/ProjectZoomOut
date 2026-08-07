import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import sharp from 'sharp';

import { Admins } from './collections/Admins';
import { Leaves } from './collections/Leaves';
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
 * Expected divergences, to reconcile at the schema-freeze gate:
 *  - `trackId` is `string` in the domain model; Payload emits `string | Track`
 *    because it is a relationship that can arrive populated or as an id.
 *  - `stickyNotes.notes` is `string[]` in the domain model; Payload array rows are
 *    always objects, so it emits `{ note: string; id?: string }[]`.
 *  - `scenario.options` is a 3-tuple in the domain model; Payload emits a plain array,
 *    with the count enforced by minRows/maxRows at runtime instead.
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

  collections: [Admins, Tracks, Leaves],

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
