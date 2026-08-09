/**
 * A small in-memory cache with a fixed time-to-live.
 *
 * Deliberately not an LRU, not distributed, and not clever. Content changes rarely and
 * the working set is one book, so the only job here is to stop every reader request
 * becoming a Payload request.
 *
 * **The TTL is the takedown latency.** Anything cached survives an unpublish for up to
 * that long, which is why the value is configured with a hard upper bound rather than
 * left to a call site — see `CONTENT_CACHE_TTL_SECONDS`. `LEGAL.md` commits to hours;
 * minutes clears it comfortably.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  public get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (entry === undefined) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  public set(key: string, value: T): void {
    // A TTL of zero disables caching outright, which is what the integration tests
    // use to assert takedown without waiting out a real expiry.
    if (this.ttlMs <= 0) {
      return;
    }

    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Drops everything. Used by tests and available for an operational purge. */
  public clear(): void {
    this.entries.clear();
  }

  public get size(): number {
    return this.entries.size;
  }
}
