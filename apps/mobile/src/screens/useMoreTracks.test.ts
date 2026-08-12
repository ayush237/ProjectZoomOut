import { renderHook, waitFor } from '@testing-library/react-native';
import type { Track } from '@zoomout/shared';

import type { TrackPage } from '../api/client';
import { ApiError } from '../api/errors';
import { flush } from '../testing/flush';
import { useMoreTracks } from './useMoreTracks';

/**
 * Explore's pagination.
 *
 * Tier B: one happy path and one failure path, per the tiered bar. The gap this closes
 * was live rather than theoretical — the seeded corpus is twenty-eight Tracks against a
 * page size of twenty, so Explore ended at twenty with nothing to say about the rest.
 */

function track(id: string): Track {
  return { id, bookTitle: `Track ${id}` } as unknown as Track;
}

function page(pageNumber: number, ids: string[], totalPages = 2): TrackPage {
  return {
    tracks: ids.map(track),
    page: pageNumber,
    totalPages,
    totalTracks: 28,
  };
}

describe('useMoreTracks', () => {
  it('appends the next page rather than replacing the first', async () => {
    const listTracks = jest.fn(() => Promise.resolve(page(2, ['21', '22'])));
    const { result } = await renderHook(() =>
      useMoreTracks({ listTracks }, page(1, ['1', '2'])),
    );

    expect(result.current.hasMore).toBe(true);

    await flush(() => {
      result.current.loadMore();
    });

    // The hook owns pages two onward only; the screen concatenates. Returning the whole
    // list from here would mean two places believed they owned page one.
    expect(result.current.tracks.map((t) => t.id)).toEqual(['21', '22']);
    expect(listTracks).toHaveBeenCalledWith(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('does not fetch past the last page', async () => {
    const listTracks = jest.fn(() => Promise.resolve(page(1, [], 1)));
    const { result } = await renderHook(() =>
      useMoreTracks({ listTracks }, page(1, ['1'], 1)),
    );

    await flush(() => {
      result.current.loadMore();
    });

    expect(listTracks).not.toHaveBeenCalled();
    expect(result.current.hasMore).toBe(false);
  });

  it('fires one request even when the list asks repeatedly', async () => {
    /**
     * `FlatList` calls `onEndReached` on every scroll event inside the threshold, not
     * once per boundary. Without the in-flight guard a slow response appends the same
     * page several times, and the reader sees duplicates.
     */
    let resolve: ((value: TrackPage) => void) | undefined;
    const listTracks = jest.fn(
      () =>
        new Promise<TrackPage>((r) => {
          resolve = r;
        }),
    );

    const { result } = await renderHook(() =>
      useMoreTracks({ listTracks }, page(1, ['1'], 3)),
    );

    await flush(() => {
      result.current.loadMore();
      result.current.loadMore();
      result.current.loadMore();
    });

    expect(listTracks).toHaveBeenCalledTimes(1);

    await flush(() => {
      resolve?.(page(2, ['21']));
    });

    await waitFor(() => {
      expect(result.current.tracks).toHaveLength(1);
    });
  });

  it('keeps the list and surfaces a retryable message when a page fails', async () => {
    const listTracks = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'UPSTREAM', message: 'Content is unavailable.', status: 503 }),
      );

    const { result } = await renderHook(() =>
      useMoreTracks({ listTracks }, page(1, ['1'], 3)),
    );

    await flush(() => {
      result.current.loadMore();
    });

    expect(result.current.error).toBe('Content is unavailable.');
    // Still offering more: a failed tail is not the end of the catalogue.
    expect(result.current.hasMore).toBe(true);

    listTracks.mockResolvedValueOnce(page(2, ['21'], 3));

    await flush(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.tracks.map((t) => t.id)).toEqual(['21']);
    });
    expect(result.current.error).toBeNull();
  });

  it('drops the tail when a refresh changes the catalogue', async () => {
    const listTracks = jest.fn(() => Promise.resolve(page(2, ['21'], 3)));

    const { result, rerender } = await renderHook(
      ({ firstPage }: { firstPage: TrackPage }) => useMoreTracks({ listTracks }, firstPage),
      { initialProps: { firstPage: page(1, ['1'], 3) } },
    );

    await flush(() => {
      result.current.loadMore();
    });
    expect(result.current.tracks).toHaveLength(1);

    /**
     * A refresh that returns different content invalidates everything after it — the
     * tail was paged against the old ordering and may repeat or skip Tracks.
     */
    await rerender({ firstPage: page(1, ['1', '2'], 3) });

    expect(result.current.tracks).toHaveLength(0);
  });

  it('keeps the tail, and the reader’s place, when a refresh changes nothing', async () => {
    /**
     * The reason the reset is keyed on a content signature rather than on object
     * identity. Identity churns on every render for any caller that builds the page
     * inline — which is an infinite update loop, not a cosmetic bug — and it also
     * discards a perfectly valid tail every time a refresh returns the same catalogue,
     * throwing away the reader's scroll position for nothing.
     */
    const listTracks = jest.fn(() => Promise.resolve(page(2, ['21'], 3)));

    const { result, rerender } = await renderHook(
      ({ firstPage }: { firstPage: TrackPage }) => useMoreTracks({ listTracks }, firstPage),
      { initialProps: { firstPage: page(1, ['1'], 3) } },
    );

    await flush(() => {
      result.current.loadMore();
    });

    await rerender({ firstPage: page(1, ['1'], 3) });

    expect(result.current.tracks.map((t) => t.id)).toEqual(['21']);
  });
});
