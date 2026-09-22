import type { AudioRef } from '@zoomout/shared';

import type { ApiClient } from '../../api/client';
import { selectNarration } from '../../audio';
import { fetchRealTracks } from './fetchRealTracks';

/**
 * The one Track with narration today, by title rather than id.
 *
 * ONBOARD-1's approved design (2026-09-18) is explicit: beat 3 samples **this** book's
 * narration regardless of which book the reader picked in beat 2, because no other
 * Track has any narration to sample from yet. A title match is a deliberate,
 * documented stand-in for a real "which Track has narration" query this backend does
 * not expose — a substring rather than the full title, so a copy edit to the subtitle
 * does not silently break sampling.
 */
const NARRATOR_SAMPLE_BOOK_TITLE_FRAGMENT = 'Ikigai';

export interface NarratorSample {
  readonly female: AudioRef | undefined;
  readonly male: AudioRef | undefined;
}

const EMPTY_SAMPLE: NarratorSample = { female: undefined, male: undefined };

/**
 * Both narrators' clips for the sample Track's first Leaf, Summary slide.
 *
 * **Degrades to "no sample" rather than throwing**, at every step: the sample Track
 * missing from the catalogue, a Track with no Leaves, or a first Leaf whose Summary
 * carries no audio for one or both narrators all return here the same way. Beat 3 can
 * still be completed — choosing a narrator does not require having heard it — so a
 * content gap here should degrade the preview, not block the flow that follows it.
 */
export async function fetchNarratorSample(
  api: Pick<ApiClient, 'listTracks' | 'listLeaves' | 'getLeaf'>,
): Promise<NarratorSample> {
  const tracks = await fetchRealTracks(api);
  const sampleTrack = tracks.find((track) =>
    track.bookTitle.includes(NARRATOR_SAMPLE_BOOK_TITLE_FRAGMENT),
  );

  if (sampleTrack === undefined) {
    return EMPTY_SAMPLE;
  }

  const leaves = await api.listLeaves(sampleTrack.id);
  const [first] = [...leaves].sort((a, b) => a.orderIndex - b.orderIndex);

  if (first === undefined) {
    return EMPTY_SAMPLE;
  }

  const leaf = await api.getLeaf(first.id);

  return {
    female: selectNarration(leaf.summary.audio, 'female'),
    male: selectNarration(leaf.summary.audio, 'male'),
  };
}
