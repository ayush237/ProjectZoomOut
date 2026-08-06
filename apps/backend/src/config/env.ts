import { z } from 'zod';

/**
 * The one and only reader of `process.env` in the backend.
 *
 * Everything downstream receives an `AppConfig` by injection. That keeps configuration
 * testable (pass a fake environment, get a config back), keeps secrets out of module
 * scope, and means a missing variable is caught once at boot rather than as an
 * `undefined` surfacing in a request handler at 3am.
 *
 * The ESLint rule banning `process.env` is disabled exactly here and nowhere else.
 */

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const environmentSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVIRONMENTS).default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('127.0.0.1'),

  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),

  DATABASE_URL: z
    .string()
    .min(1)
    .refine(isPostgresConnectionString, 'Must be a postgres:// or postgresql:// connection string'),

  DATABASE_CONNECTION_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(5),
});

function isPostgresConnectionString(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'postgres:' || protocol === 'postgresql:';
  } catch {
    // Not a parseable URL at all. The throw is the check, surfaced as a validation
    // failure rather than swallowed.
    return false;
  }
}

export type AppConfig = Readonly<z.infer<typeof environmentSchema>>;

/**
 * Raised when the environment is missing or malformed.
 *
 * The message names the offending variables and why they failed, but never their
 * values — `DATABASE_URL` carries a password, and a crash log is not a safe place
 * for it.
 */
export class ConfigurationError extends Error {
  public readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(
      [
        'Invalid environment configuration. The service will not start.',
        ...issues.map((issue) => `  - ${issue}`),
        'See .env.example for the full list of variables.',
      ].join('\n'),
    );
    this.name = 'ConfigurationError';
    this.issues = issues;
  }
}

/**
 * Parses and validates the environment, failing fast on anything malformed.
 *
 * @param source Defaults to the real process environment; tests pass their own.
 * @throws {ConfigurationError} if any variable is missing or invalid.
 */
export function loadConfig(source: NodeJS.ProcessEnv = getProcessEnv()): AppConfig {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    throw new ConfigurationError(
      result.error.issues.map((issue) => {
        const variable = issue.path.join('.') || '(root)';
        return `${variable}: ${issue.message}`;
      }),
    );
  }

  return Object.freeze(result.data);
}

/* eslint-disable no-restricted-properties --
 * This function is the single sanctioned `process.env` read in the backend. The rule
 * exists so that every other module has to go through the validated `AppConfig`. */
function getProcessEnv(): NodeJS.ProcessEnv {
  return process.env;
}
/* eslint-enable no-restricted-properties */
