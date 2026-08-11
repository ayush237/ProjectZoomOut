import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, NetworkError } from '../api/errors';

/**
 * Loading, error and refresh for a screen that fetches once and can be retried.
 *
 * Shared because all three surfaces need the identical four states and getting one of
 * them subtly wrong on one screen is exactly how "a 503 renders a blank screen" ships.
 * The states are explicit rather than inferred from `data === null`, because "loaded
 * and empty" and "not loaded yet" look the same that way and need completely different
 * screens.
 */

export type ResourceStatus = 'loading' | 'ready' | 'error';

export interface AsyncResource<T> {
  readonly status: ResourceStatus;
  readonly data: T | null;
  /** Reader-facing text. Never a stack trace, never a raw upstream message. */
  readonly error: string | null;
  /** True during a pull-to-refresh, when stale data is still on screen. */
  readonly refreshing: boolean;
  /** Re-fetches from scratch, showing the loading state. For the retry button. */
  readonly reload: () => void;
  /** Re-fetches while keeping what is on screen. For pull-to-refresh. */
  readonly refresh: () => void;
}

export function useAsyncResource<T>(load: () => Promise<T>): AsyncResource<T> {
  const [status, setStatus] = useState<ResourceStatus>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Guards against setting state after unmount, and against a slow first request
   * landing on top of a fast retry. Each run claims a number; only the newest writes.
   */
  const generation = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (mode: 'initial' | 'refresh'): Promise<void> => {
      const run = generation.current + 1;
      generation.current = run;

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setStatus('loading');
        setError(null);
      }

      try {
        const result = await load();

        if (mounted.current && generation.current === run) {
          setData(result);
          setStatus('ready');
          setError(null);
        }
      } catch (caught) {
        if (mounted.current && generation.current === run) {
          setError(readerMessage(caught));
          // A failed *refresh* keeps the stale list on screen with an error beside it;
          // only a failed initial load takes over the screen. Throwing away content the
          // reader is looking at because a background refresh failed is worse than
          // showing them something slightly old.
          setStatus(mode === 'refresh' && data !== null ? 'ready' : 'error');
        }
      } finally {
        if (mounted.current && generation.current === run) {
          setRefreshing(false);
        }
      }
    },
    [load, data],
  );

  useEffect(() => {
    void run('initial');
    // Deliberately keyed on `load` alone. Callers memoise it, and including `run` would
    // re-fetch on every render, because `run` closes over `data` and is rebuilt each
    // time that changes. (No `react-hooks` plugin in this repo's ESLint config, so
    // there is no exhaustive-deps warning to suppress — the reasoning is the comment.)
  }, [load]);

  const reload = useCallback(() => {
    void run('initial');
  }, [run]);

  const refresh = useCallback(() => {
    void run('refresh');
  }, [run]);

  return { status, data, error, refreshing, reload, refresh };
}

/**
 * What to put on screen when a fetch fails.
 *
 * The backend's messages are written for readers, so an `ApiError` shows its own. A
 * transport failure gets the offline copy. Anything else gets a generic line rather
 * than `error.message`, which at that point is an internal string that has never been
 * read by a human — the raw-error-on-screen failure the acceptance criteria call out.
 */
function readerMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return error.message;
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
