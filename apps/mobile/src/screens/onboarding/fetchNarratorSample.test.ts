import type { AudioRef, DeliveredLeaf, Track } from '@zoomout/shared';

import type { LeafSummary, TrackPage } from '../../api/client';
import { fetchNarratorSample } from './fetchNarratorSample';

function track(id: string, bookTitle: string, isPlaceholder = false): Track {
  return { id, bookTitle, isPlaceholder } as unknown as Track;
}

function page(tracks: Track[]): TrackPage {
  return { tracks, page: 1, totalPages: 1, totalTracks: tracks.length };
}

function leafSummary(id: string, orderIndex: number): LeafSummary {
  return { id, trackId: 't', orderIndex, title: `Leaf ${id}`, isPlaceholder: false };
}

function audioRef(narrator: 'female' | 'male'): AudioRef {
  return { narrator, url: `https://cdn.test/${narrator}.mp3`, durationSeconds: 10, textDigest: 'a'.repeat(64) };
}

function deliveredLeaf(audio: AudioRef[] | undefined): DeliveredLeaf {
  return { summary: { body: 'Summary.', audio } } as unknown as DeliveredLeaf;
}

describe('fetchNarratorSample', () => {
  it('returns both narrators for the sample Track, from its first Leaf by orderIndex', async () => {
    const api = {
      listTracks: jest.fn().mockResolvedValue(
        page([track('1', 'Some Other Book'), track('50', 'Ikigai: The Japanese Secret')]),
      ),
      listLeaves: jest.fn().mockResolvedValue([leafSummary('l2', 1), leafSummary('l1', 0)]),
      getLeaf: jest.fn().mockResolvedValue(deliveredLeaf([audioRef('female'), audioRef('male')])),
    };

    const result = await fetchNarratorSample(api);

    expect(api.listLeaves).toHaveBeenCalledWith('50');
    // Sorted by orderIndex, not array position — 'l1' (orderIndex 0) despite arriving second.
    expect(api.getLeaf).toHaveBeenCalledWith('l1');
    expect(result.female?.narrator).toBe('female');
    expect(result.male?.narrator).toBe('male');
  });

  it('matches the sample Track by a title fragment, not the exact string', async () => {
    // ONBOARD-1's own stated reason: a copy edit to the subtitle must not break this.
    const api = {
      listTracks: jest.fn().mockResolvedValue(page([track('50', 'Ikigai: A Different Subtitle')])),
      listLeaves: jest.fn().mockResolvedValue([leafSummary('l1', 0)]),
      getLeaf: jest.fn().mockResolvedValue(deliveredLeaf([audioRef('female'), audioRef('male')])),
    };

    const result = await fetchNarratorSample(api);

    expect(result.female).toBeDefined();
  });

  it('degrades to no sample when the sample Track is not in the catalogue at all', async () => {
    const api = {
      listTracks: jest.fn().mockResolvedValue(page([track('1', 'Some Other Book')])),
      listLeaves: jest.fn(),
      getLeaf: jest.fn(),
    };

    const result = await fetchNarratorSample(api);

    expect(result).toEqual({ female: undefined, male: undefined });
    expect(api.listLeaves).not.toHaveBeenCalled();
  });

  it('degrades to no sample when the sample Track has no Leaves', async () => {
    const api = {
      listTracks: jest.fn().mockResolvedValue(page([track('50', 'Ikigai')])),
      listLeaves: jest.fn().mockResolvedValue([]),
      getLeaf: jest.fn(),
    };

    const result = await fetchNarratorSample(api);

    expect(result).toEqual({ female: undefined, male: undefined });
    expect(api.getLeaf).not.toHaveBeenCalled();
  });

  it('degrades one narrator only when the Leaf carries just the other', async () => {
    const api = {
      listTracks: jest.fn().mockResolvedValue(page([track('50', 'Ikigai')])),
      listLeaves: jest.fn().mockResolvedValue([leafSummary('l1', 0)]),
      getLeaf: jest.fn().mockResolvedValue(deliveredLeaf([audioRef('male')])),
    };

    const result = await fetchNarratorSample(api);

    expect(result.male).toBeDefined();
    expect(result.female).toBeUndefined();
  });
});
