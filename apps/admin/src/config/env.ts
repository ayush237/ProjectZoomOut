import { z } from 'zod';

/**
 * Validated environment for the CMS.
 *
 * Same rule as the backend: exactly one module reads `process.env`, it validates at
 * load time, and it fails with a message naming the offending variables rather than
 * surfacing as a confusing error three layers deep. The repo-wide ESLint rule that
 * bans `process.env` elsewhere is what keeps this the only door.
 */

const envSchema = z.object({
  /**
   * Signs Payload's auth tokens. Rotating it invalidates every admin session, which
   * is the intended emergency lever.
   */
  PAYLOAD_SECRET: z.string().min(32, 'PAYLOAD_SECRET must be at least 32 characters'),

  /**
   * Payload's **own** database — same Postgres instance as the app, separate database.
   *
   * Deliberately not the backend's `DATABASE_URL`. Payload manages its own migrations
   * and its own internal schema (groups flatten to columns, arrays become join tables,
   * versions live in `_leaves_v`); pointing it at the Drizzle-managed database would
   * put two migration systems in one namespace.
   */
  PAYLOAD_DATABASE_URL: z.string().min(1, 'PAYLOAD_DATABASE_URL is required'),
});

export type AdminConfig = z.infer<typeof envSchema>;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/* eslint-disable no-restricted-properties --
 * This function is the single sanctioned `process.env` read in the CMS, mirroring
 * `apps/backend/src/config/env.ts`. The rule exists so every other module has to go
 * through the validated `AdminConfig`. */
export function loadConfig(source: Record<string, string | undefined> = process.env): AdminConfig {
  /* eslint-enable no-restricted-properties */
  const result = envSchema.safeParse(source);

  if (result.success) {
    return result.data;
  }

  const detail = result.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  // Names the variables, never the values — this message reaches logs and CI output.
  throw new ConfigurationError(`Invalid CMS environment configuration:\n${detail}`);
}
