import type { Track } from '@zoomout/shared';

import type { TrackPage } from '../../api/client';
import { fetchRealTracks } from './fetchRealTracks';

function track(id: string, isPlaceholder: boolean): Track {
  return { id, bookTitle: `Track ${id}`, isPlaceholder } as unknown as Track;
}

function page(pageNumber: number, tracks: Track[], totalPages: number): TrackPage {
  return { tracks, page: pageNumber, totalPages, totalTracks: tracks.length };
}

describe('fetchRealTracks', () => {
  it('returns only non-placeholder Tracks from a single page', async () => {
    const listTracks = jest.fn().mockResolvedValue(
      page(1, [track('1', true), track('2', false)], 1),
    );

    const result = await fetchRealTracks({ listTracks });

    expect(result.map((t) => t.id)).toEqual(['2']);
  });

  it('finds a real Track that sorts onto a later page, not just page one', async () => {
    // ONBOARD-1 finding 2, reproduced directly: the real Track is on page two.
    const listTracks = jest.fn((pageNumber: number) => {
      if (pageNumber === 1) {
        return Promise.resolve(page(1, [track('1', true), track('2', true)], 2));
      }
      return Promise.resolve(page(2, [track('3', false)], 2));
    });

    const result = await fetchRealTracks({ listTracks });

    expect(result.map((t) => t.id)).toEqual(['3']);
  });

  it('fetches page one alone first, then every remaining page', async () => {
    const listTracks = jest.fn((pageNumber: number) =>
      Promise.resolve(page(pageNumber, [track(String(pageNumber), false)], 3)),
    );

    await fetchRealTracks({ listTracks });

    expect(listTracks).toHaveBeenCalledTimes(3);
    expect(listTracks).toHaveBeenNthCalledWith(1, 1);
  });

  it('returns an empty list, not a throw, when every Track is a placeholder', async () => {
    const listTracks = jest.fn().mockResolvedValue(page(1, [track('1', true)], 1));

    await expect(fetchRealTracks({ listTracks })).resolves.toEqual([]);
  });
});
