import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit CLI configuration.
 *
 * This file is read by the `drizzle-kit` binary, not by the running application, so
 * the validated config module is not in scope here — hence the one sanctioned
 * `process.env` read outside `src/config/env.ts`. drizzle-kit fails with its own
 * error if the URL is absent, so the empty fallback never reaches a connection.
 */
/* eslint-disable no-restricted-properties */
const databaseUrl = process.env['DATABASE_URL'] ?? '';
/* eslint-enable no-restricted-properties */

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
