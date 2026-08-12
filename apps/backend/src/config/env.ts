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

/** 256 bits of entropy, expressed as characters. Below this, HS256 is brute-forceable. */
const MINIMUM_SECRET_LENGTH = 32;

/**
 * The value shipped in `.env.example`. Rejected explicitly so a copied-and-forgotten
 * example file cannot become a production signing key that is public on GitHub.
 */
const EXAMPLE_SECRET_PLACEHOLDER = 'replace-me-with-at-least-32-random-characters';

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

  /* ---------------------------------------------------------------------- */
  /* Authentication                                                          */
  /* ---------------------------------------------------------------------- */

  /**
   * Signs access tokens. No default — the service must refuse to boot rather than
   * fall back to something guessable, because a predictable signing key means anyone
   * can mint a token for any user.
   */
  AUTH_JWT_SECRET: z
    .string()
    .min(MINIMUM_SECRET_LENGTH, `Must be at least ${String(MINIMUM_SECRET_LENGTH)} characters`)
    .refine((value) => value !== EXAMPLE_SECRET_PLACEHOLDER, {
      message: 'Still set to the .env.example placeholder — generate a real secret',
    }),

  /** Short by design: an access token cannot be revoked, so its lifetime bounds the damage. */
  AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  /** Long-lived but revocable and single-use; rotation is what keeps this safe. */
  AUTH_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),

  /**
   * Age gate threshold, in years.
   *
   * Configurable because the legal answer is undecided with no owner assigned
   * (`LEGAL.md`). When it lands, this is an environment change and a restart.
   */
  AUTH_MINIMUM_AGE_YEARS: z.coerce.number().int().min(0).max(120).default(13),

  /**
   * Client identifiers at Apple and Google, checked as the `aud` claim on incoming
   * ID tokens.
   *
   * Optional: neither app is registered yet, and requiring them would block local
   * development on WP2. A social sign-in attempt against an unconfigured provider
   * fails loudly at the request rather than silently skipping the audience check.
   */
  AUTH_APPLE_CLIENT_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_CLIENT_ID: z.string().min(1).optional(),

  /** Requests permitted per IP per window on signup, login and refresh. */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),

  /* ---------------------------------------------------------------------- */
  /* Content (the CMS boundary)                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * Base URL of Payload's REST API.
   *
   * The backend calls it **anonymously and over private networking**, which is what
   * makes published-only the default: Payload's read access control returns drafts
   * only to authenticated operators. Adding a token here would widen that and quietly
   * break takedown, so there is deliberately no token setting.
   */
  CONTENT_API_URL: z
    .string()
    .min(1)
    .refine(isHttpUrl, 'Must be an http:// or https:// URL')
    .default('http://127.0.0.1:3001/api'),

  /** Per-request timeout. Payload being slow must not become the backend hanging. */
  CONTENT_API_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

  /**
   * How long a content response may be reused from memory.
   *
   * **This value is the takedown latency.** `LEGAL.md` commits to pulling a Track
   * within hours of a verified complaint; a cache measured in minutes meets that with
   * room to spare, and the upper bound below stops anyone quietly turning it into a
   * number that would not.
   */
  CONTENT_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(600).default(60),

  /* ---------------------------------------------------------------------- */
  /* Progress and XP (the learning loop)                                     */
  /* ---------------------------------------------------------------------- */

  /**
   * XP for completing a Leaf, and the bonus for having answered its scenario
   * correctly on the first attempt.
   *
   * Configuration rather than literals because these are **placeholder economics**.
   * The loop is not playable until WP6–WP8, and the founder has said the numbers get
   * tuned once it is — so tuning must be an environment change and a restart, not a
   * code change, a review and a deploy.
   *
   * Calibrated against WP5's 500 XP daily cap, which the plan wants to land near five
   * Leaves: 80 + 20 means five first-try Leaves hit exactly 500, and a reader who
   * needs a second attempt every time reaches it in six or seven. The bonus is a
   * quarter of the base — enough that first-try correctness is visibly worth
   * something, not so much that a wrong answer feels like a wasted session, which
   * would push readers to guess-and-retry rather than think.
   *
   * The floor is 0 rather than 1: setting either to zero is a legitimate way to turn
   * an award off while the numbers are still being argued about.
   */
  XP_LEAF_COMPLETION: z.coerce.number().int().min(0).default(80),
  XP_FIRST_TRY_BONUS: z.coerce.number().int().min(0).default(20),

  /**
   * The daily session cap: **whichever of these two comes first**.
   *
   * This is positive friction, not a limit to be tuned for engagement — PRODUCT.md
   * treats stopping as a feature. Both thresholds are configuration rather than
   * literals precisely because the right numbers are a product question that will be
   * argued about with real readers, and re-arguing them should not require a deploy.
   *
   * 500 XP lands near five first-try Leaves against the 80 + 20 award above; fifteen
   * minutes is the session length the whole product is designed around.
   */
  SESSION_CAP_SECONDS: z.coerce.number().int().min(1).default(900),
  SESSION_CAP_XP: z.coerce.number().int().min(1).default(500),

  /**
   * The most any single Leaf may contribute to the daily clock.
   *
   * Session time is measured as the elapsed time between opening a Leaf and completing
   * it, which is the only signal the server has without a client heartbeat. That
   * measure is honest for a reader who works straight through and absurd for one who
   * opens a Leaf, puts the phone down, and finishes it the next morning — without a
   * clamp, a single Leaf would spend the whole day's budget.
   *
   * Five minutes is roughly twice a realistic Leaf. A reader genuinely slower than that
   * is under-counted, which errs toward letting them keep reading — the right direction
   * for a wellbeing feature to be wrong in.
   */
  SESSION_MAX_LEAF_SECONDS: z.coerce.number().int().min(1).default(300),

  /**
   * How often expired refresh tokens are swept.
   *
   * Only expired rows are removed — revoked-but-unexpired ones are what make reuse
   * detection work. Hourly is ample: this bounds table growth, it is not latency
   * sensitive.
   */
  AUTH_TOKEN_REAP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
});

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

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
