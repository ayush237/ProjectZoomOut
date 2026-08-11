/**
 * A minimal client for Payload's REST API.
 *
 * **REST rather than the Local API, deliberately.** WP1 documented two upstream defects
 * that a script booting Payload in-process inherits: `payload.destroy()` does not close
 * its database pool, and `pool.end()` then hangs because Payload keeps a client checked
 * out; and Payload attaches no `error` listener to that pool, so an idle-client error
 * becomes an uncaught exception. A seed script that cannot exit cleanly is a seed script
 * that hangs CI. Talking to the running server over HTTP sidesteps both, and has the
 * further advantage of going through exactly the same path the backend does — including
 * every validation hook, which is the point.
 */

export interface PayloadDocument {
  readonly id: number;
  readonly _status?: 'draft' | 'published';
}

interface ListResponse<T> {
  readonly docs: readonly T[];
  readonly totalDocs: number;
}

export class PayloadRestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = 'PayloadRestError';
  }
}

export class PayloadRestClient {
  private token: string | null = null;

  constructor(private readonly baseUrl: string) {}

  /**
   * Authenticates as a CMS operator.
   *
   * The seed writes through the same authenticated path an author would, so every
   * `beforeChange` hook and publish rule fires exactly as it does in the admin UI. A
   * seed that bypassed them would prove nothing about whether the content is valid —
   * and the acceptance criterion is specifically that no rule is bypassed to make it
   * work.
   */
  public async signIn(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/admins/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new PayloadRestError(
        'Could not sign in to the CMS. Check PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD.',
        response.status,
        await response.text(),
      );
    }

    const body = (await response.json()) as { token?: string };

    if (typeof body.token !== 'string') {
      throw new PayloadRestError('CMS login returned no token', response.status, '');
    }

    this.token = body.token;
  }

  /** Finds one document by an exact field match, or null. The idempotency key. */
  public async findOneBy<T extends PayloadDocument>(
    collection: string,
    field: string,
    value: string,
  ): Promise<T | null> {
    const query = new URLSearchParams({
      [`where[${field}][equals]`]: value,
      limit: '1',
      depth: '0',
      // Without this an unpublished document is invisible even to an authenticated
      // request, so the draft records would be recreated on every run.
      draft: 'true',
    });

    const body = await this.request<ListResponse<T>>('GET', `/api/${collection}?${String(query)}`);

    return body.docs[0] ?? null;
  }

  public async count(collection: string): Promise<number> {
    const body = await this.request<ListResponse<PayloadDocument>>(
      'GET',
      `/api/${collection}?limit=0&depth=0&draft=true`,
    );

    return body.totalDocs;
  }

  /**
   * Creates a document, published or left as a draft.
   *
   * `_status` is Payload's own publish flag — the same one the Unpublish button sets,
   * and the one `read: publishedOrAuthenticated` filters on. Setting it here is how the
   * draft fixtures come into being.
   */
  public async create<T extends PayloadDocument>(
    collection: string,
    data: Record<string, unknown>,
    status: 'draft' | 'published',
  ): Promise<T> {
    return this.request<T>('POST', `/api/${collection}`, { ...data, _status: status });
  }

  public async update<T extends PayloadDocument>(
    collection: string,
    id: number,
    data: Record<string, unknown>,
    status: 'draft' | 'published',
  ): Promise<T> {
    return this.request<T>('PATCH', `/api/${collection}/${String(id)}`, {
      ...data,
      _status: status,
    });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };

    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    if (this.token !== null) {
      headers['authorization'] = `JWT ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = await response.text();

    if (!response.ok) {
      /**
       * The body is included in full, and that is the useful part.
       *
       * When a seeded Leaf fails, it fails on a content rule — a missing locator, two
       * correct options — and Payload's response names the field and says why. Throwing
       * a tidy message and swallowing that would leave whoever runs this guessing at
       * which of twenty Leaves is malformed.
       */
      throw new PayloadRestError(
        `CMS ${method} ${path} failed with ${String(response.status)}`,
        response.status,
        text,
      );
    }

    // Payload wraps writes as `{ doc, message }` and reads as the document or list.
    const parsed: unknown = text === '' ? {} : JSON.parse(text);

    if (typeof parsed === 'object' && parsed !== null && 'doc' in parsed) {
      return (parsed as { doc: T }).doc;
    }

    return parsed as T;
  }
}
