import { useCallback } from 'react';
import { NARRATOR_IDS, type NarratorSamples } from '@zoomout/shared';

import { useApi } from '../auth/AuthProvider';
import { useAsyncResource } from './useAsyncResource';

/**
 * `samples` is non-null exactly when `status` is `ready` — the type says so, so a caller
 * narrows on the status and never checks the clips for `undefined`.
 */
export type NarratorSamplesResult =
  | {
      readonly status: 'loading' | 'failed';
      readonly samples: null;
      /** Fetches again from scratch — `status` goes back to `loading`, then settles. */
      readonly retry: () => void;
    }
  | {
      readonly status: 'ready';
      readonly samples: NarratorSamples;
      readonly retry: () => void;
    };

/**
 * The two narrator hellos, fetched once per mount (ONBOARD-3.1).
 *
 * **Everything that lets a reader hear a narrator before choosing reads them from here** —
 * the onboarding beat and Profile's narrator card — so one place knows the endpoint
 * (`/content/narrator-samples`), one place decides what a failure is, and neither screen
 * carries a second copy to drift.
 *
 * **`failed` is deliberately wide.** A network error, any 4xx or 5xx (an old backend that
 * has never heard of the route answers 404, which makes backend-before-mobile a hard
 * deploy order) and a **200 whose body is not two usable clips** (a captive portal's HTML
 * page reads as `null` here) all land in the one state, because a caller has one thing to
 * do about each of them: carry on without the hellos. `ready` therefore guarantees both
 * clips have a URL, which is what lets a caller hand them to a player without checking.
 *
 * A failure is `console.warn`ed rather than dropped: the reader sees a notice (or, on
 * Profile, nothing), and this is the only place a developer could learn that a deploy
 * went out in the wrong order.
 */
export function useNarratorSamples(): NarratorSamplesResult {
  const api = useApi();

  const load = useCallback(async (): Promise<NarratorSamples> => {
    let answer: unknown;

    try {
      answer = await api.getNarratorSamples();
    } catch (caught) {
      console.warn('[narrator] could not load the narrator hellos', caught);
      throw caught;
    }

    if (!isNarratorSamples(answer)) {
      console.warn('[narrator] the hellos answer was not two usable clips');
      throw new Error('The narrator hellos answer was not two usable clips.');
    }

    return answer;
  }, [api]);

  const resource = useAsyncResource<NarratorSamples>(load);

  const retry = resource.reload;

  if (resource.status === 'loading') {
    return { status: 'loading', samples: null, retry };
  }

  // `useAsyncResource` keeps the last good `data` across a later failure, so the status —
  // not the presence of data — is what says whether there are hellos to play. (`load` above
  // has already refused anything that is not two clips, so `data` is never null here; the
  // check is what lets the compiler agree.)
  if (resource.status === 'ready' && resource.data !== null) {
    return { status: 'ready', samples: resource.data, retry };
  }

  return { status: 'failed', samples: null, retry };
}

/** Narrowed from `unknown` because this is the wire: the type says what the server means to send. */
function isNarratorSamples(value: unknown): value is NarratorSamples {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const clips = value as Record<string, unknown>;

  return NARRATOR_IDS.every((narrator) => {
    const clip = clips[narrator];

    return (
      typeof clip === 'object' &&
      clip !== null &&
      typeof (clip as { readonly url?: unknown }).url === 'string' &&
      (clip as { readonly url: string }).url.length > 0
    );
  });
}
