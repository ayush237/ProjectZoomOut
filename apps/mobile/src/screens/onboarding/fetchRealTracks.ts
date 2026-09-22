import type { Track } from '@zoomout/shared';

import type { ApiClient } from '../../api/client';

/**
 * Every non-placeholder Track, across every page.
 *
 * **Page one alone is not enough** (ONBOARD-1 finding 2): the corpus is mostly
 * placeholder filler — two real Tracks among 28 at the time this was written — and
 * `listTracks`'s default `perPage` of 20 means a real Track can sort onto page two.
 * Trusting page one risks showing the reader only one book to choose between, or none.
 *
 * **Filtered client-side, not via `HIDE_PLACEHOLDER_CONTENT`.** `isPlaceholder` is
 * already on the client-visible `Track` shape (`packages/shared/src/content.ts`), and
 * that backend flag is a *server* visibility control this package has no reason to
 * depend on — Explore already renders whatever `ContentService` decided to serve, and
 * onboarding narrows that same list further for its own purpose.
 *
 * Page one is fetched first, alone, because it is the only request that can answer
 * `totalPages`; every page after it fetches in parallel rather than one at a time,
 * since nothing here needs them in order.
 */
export async function fetchRealTracks(api: Pick<ApiClient, 'listTracks'>): Promise<readonly Track[]> {
  const first = await api.listTracks(1);

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_unused, index) =>
      api.listTracks(index + 2),
    ),
  );

  return [first, ...rest].flatMap((page) => page.tracks).filter((track) => !track.isPlaceholder);
}
