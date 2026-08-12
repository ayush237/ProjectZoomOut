import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '@zoomout/shared';

import type { ApiClient, TrackPage } from '../api/client';
import { ApiError, NetworkError } from '../api/errors';

/**
 * Pages past the first, appended to it.
 *
 * Explore fetched page one and stopped. With twenty per page and twenty-eight Tracks in
 * the corpus, the catalogue simply ended at twenty with no control, no spinner and no
 * indication anything followed — WP11 turned that from a theoretical gap into a visible
 * one, and this closes it.
 *
 * **Layered on top of `useAsyncResource` rather than replacing it.** That hook owns the
 * first page, its loading state, its retry and its pull-to-refresh, and Explore already
 * renders all four. Re-implementing them inside a paginating hook would mean two
 * definitions of "the catalogue failed to load" — so this one owns exactly the part
 * that is new: everything after page one.
 */

export interface MoreTracks {
  /** Pages two and beyond, in order. Empty until the reader scrolls. */
  readonly tracks: readonly Track[];
  readonly loading: boolean;
  /** A failed *append*. The list stays; only the tail failed. */
  readonly error: string | null;
  readonly hasMore: boolean;
  /** A property, not a method: it is a `useCallback` and is passed to `onEndReached`. */
  readonly loadMore: () => void;
}

export function useMoreTracks(
  api: Pick<ApiClient, 'listTracks'>,
  firstPage: TrackPage | null,
): MoreTracks {
  const [tracks, setTracks] = useState<readonly Track[]>([]);
  const [loadedPage, setLoadedPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Reset when the first page's **contents** change.
   *
   * A pull-to-refresh replaces page one, and keeping the old tail would leave the
   * reader looking at a fresh first page followed by twenty stale Tracks — quite
   * possibly including one they just removed.
   *
   * **Keyed on a content signature, not on object identity.** Identity was the obvious
   * choice and it is a trap: `useAsyncResource` happens to hold a stable object, but any
   * caller that builds the page inline re-fires the effect on every render, which is an
   * infinite update loop and a hard crash rather than a wrong pixel. A signature also
   * gets the semantics right — if a refresh returns exactly the same first page, the
   * tail is still valid and throwing it away would lose the reader's scroll position
   * for nothing.
   */
  const signature =
    firstPage === null
      ? null
      : `${String(firstPage.page)}:${String(firstPage.totalPages)}:${String(firstPage.totalTracks)}:${firstPage.tracks.map((t) => t.id).join(',')}`;

  useEffect(() => {
    setTracks([]);
    setLoadedPage(firstPage?.page ?? 1);
    setError(null);
    // Keyed on the signature alone; `firstPage` is read for its page number, which the
    // signature already encodes. (No `react-hooks` plugin in this repo's ESLint config,
    // so there is no exhaustive-deps warning to suppress — this comment is the record.)
  }, [signature]);

  /**
   * Guards against `onEndReached` firing repeatedly.
   *
   * `FlatList` calls it on every scroll event once inside the threshold, not once per
   * boundary, so a slow request would otherwise queue five identical fetches and append
   * page two five times. A ref, not the `loading` state, because those events arrive
   * faster than React re-renders.
   */
  const inFlight = useRef(false);

  const totalPages = firstPage?.totalPages ?? 1;
  const hasMore = firstPage !== null && loadedPage < totalPages;

  const loadMore = useCallback(() => {
    if (!hasMore || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setLoading(true);
    setError(null);

    const wanted = loadedPage + 1;

    void (async () => {
      try {
        const page = await api.listTracks(wanted);

        setTracks((current) => [...current, ...page.tracks]);
        setLoadedPage(page.page);
      } catch (caught) {
        setError(readerMessage(caught));
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    })();
  }, [api, hasMore, loadedPage]);

  return { tracks, loading, error, hasMore, loadMore };
}

function readerMessage(error: unknown): string {
  if (error instanceof NetworkError || error instanceof ApiError) {
    return error.message;
  }

  return 'Could not load more Tracks.';
}
