import { toError } from '../errors.js';
import type { AppLogger } from '../logging/logger.js';
import type { AuthRepository } from './auth.repository.js';

/**
 * Periodically removes refresh tokens that have expired.
 *
 * `refresh_tokens` gains a row on every sign-in and every rotation, and nothing ever
 * removed them — a reader refreshing every fifteen minutes writes ~35,000 rows a year
 * on their own. All but the newest are dead weight.
 *
 * A `setInterval` rather than a job queue, deliberately. The work is one indexed
 * DELETE with no ordering, retry or fan-out requirements, and adding a queue would
 * mean a broker, a worker lifecycle and another thing to run in every environment —
 * for a query. If this ever needs to coordinate across instances, that is the moment
 * to revisit, not before.
 */
export class RefreshTokenReaper {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly repository: AuthRepository,
    private readonly logger: AppLogger,
    private readonly intervalMs: number,
  ) {}

  /**
   * Runs one pass immediately, then on the configured interval.
   *
   * The first pass is immediate so a long-running deployment does not wait a full
   * interval before clearing a backlog accumulated while it was down.
   */
  public start(): void {
    if (this.timer !== undefined) {
      return;
    }

    void this.reapOnce();

    this.timer = setInterval(() => {
      void this.reapOnce();
    }, this.intervalMs);

    // Without this the interval keeps the event loop alive and the process refuses to
    // exit on SIGTERM until the timer fires.
    this.timer.unref();
  }

  public stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * One cleanup pass.
   *
   * Never throws. A failed sweep is an operational annoyance, not a reason to take
   * down a healthy server — the rows are still there and the next pass will get them.
   * It is logged at `error` rather than swallowed, so a persistently failing reaper is
   * visible instead of silent.
   */
  public async reapOnce(): Promise<number> {
    try {
      const deleted = await this.repository.deleteExpiredRefreshTokens();

      if (deleted > 0) {
        this.logger.info({ deleted }, 'Reaped expired refresh tokens');
      }

      return deleted;
    } catch (error) {
      this.logger.error({ err: toError(error) }, 'Failed to reap expired refresh tokens');
      return 0;
    }
  }
}
