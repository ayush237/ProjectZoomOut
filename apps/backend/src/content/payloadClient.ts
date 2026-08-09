import type { AppConfig } from '../config/env.js';
import { toError } from '../errors.js';
import type { AppLogger } from '../logging/logger.js';
import { ContentUnavailableError } from './content.errors.js';

/**
 * HTTP access to Payload's REST API.
 *
 * **This is the only way the backend reads content, and it is deliberately HTTP.**
 * Reading Payload's Postgres tables directly would be faster and is a standing
 * temptation: it is also wrong three times over. Groups flatten to `summary_body`-style
 * columns, arrays become join tables, and versions live in `_leaves_v` — an
 * undocumented internal schema that changes without notice. Worse, querying it
 * bypasses draft/publish resolution, so an unpublished Track would still be readable
 * and takedown would silently stop working.
 *
 * Calls are **anonymous**. Payload's read access control returns published-only to
 * unauthenticated callers, so publishing state is enforced by the CMS rather than by
 * this client remembering to filter. There is no admin token here on purpose.
 */

export interface PayloadListResponse<T> {
  readonly docs: readonly T[];
  readonly totalDocs: number;
  readonly page: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
}

export interface PayloadQuery {
  readonly [key: string]: string | number | undefined;
}

export class PayloadClient {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
  ) {}

  /**
   * @throws {ContentUnavailableError} on timeout, transport failure, a non-2xx
   * status, or a body that is not JSON. Every one of those is "the CMS did not give
   * us usable content", and none of them is something a client can act on differently.
   */
  public async get<T>(path: string, query: PayloadQuery = {}): Promise<T> {
    const url = this.buildUrl(path, query);

    // An explicit timeout, because the default is none. Without this a slow or
    // half-open Payload turns into backend requests that never resolve, which is a
    // worse failure than a fast 503 — it exhausts the connection pool and takes down
    // endpoints that have nothing to do with content.
    const abort = AbortSignal.timeout(this.config.CONTENT_API_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: abort, headers: { accept: 'application/json' } });
    } catch (error) {
      this.logger.error({ err: toError(error), path }, 'Content API request failed');
      throw new ContentUnavailableError({ cause: error });
    }

    if (!response.ok) {
      this.logger.error(
        { path, status: response.status },
        'Content API returned a non-success status',
      );
      throw new ContentUnavailableError();
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      this.logger.error({ err: toError(error), path }, 'Content API returned malformed JSON');
      throw new ContentUnavailableError({ cause: error });
    }
  }

  private buildUrl(path: string, query: PayloadQuery): string {
    const base = this.config.CONTENT_API_URL.replace(/\/$/u, '');
    const url = new URL(`${base}${path}`);

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }
}
