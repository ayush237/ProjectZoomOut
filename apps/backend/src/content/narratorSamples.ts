import type { NarratorId, NarratorSamples } from '@zoomout/shared';

import { resolveMediaUrl } from './content.mapper.js';

/**
 * Where ONBOARD-2's two narrator self-introduction clips are stored — **by filename,
 * never by Media id.**
 *
 * Payload serves an uploaded file at `/api/media/file/<filename>`, and the filename is
 * fixed by the pipeline (`generate-greetings`), so this URL is stable in a way nothing
 * else about the clip is. A re-take means the founder deletes the old Media document by
 * hand (the pipeline's machine key cannot delete Media) and uploads again: the document
 * gets a new id and the file keeps its name. Anything keyed on an id would break the day
 * that happens; nothing here can.
 *
 * Public read, no auth, `audio/mpeg`, `Range`/`206` — the same route VO-3 already plays
 * narration from, so a phone that can hear a Leaf can hear these.
 *
 * `Record<NarratorId, …>` so adding a third narrator id is a compile error here until it
 * has a clip, rather than a beat that quietly shows one card with nothing to play.
 */
const NARRATOR_SAMPLE_PATHS: Readonly<Record<NarratorId, string>> = {
  female: '/api/media/file/narrator-greeting-female.mp3',
  male: '/api/media/file/narrator-greeting-male.mp3',
};

/**
 * The two clips, as absolute URLs a reader's device can fetch.
 *
 * **Resolved through `resolveMediaUrl` against `MEDIA_BASE_URL`** — the public host a
 * phone reaches media on — and not against `CONTENT_API_URL`, the backend's private path
 * to Payload. The two coincide only while backend and client share a host (PILOT-1).
 *
 * **A URL and nothing else.** No `durationSeconds`, no `textDigest`: see `NarratorSample`
 * for why a greeting must not be dressed up as an `AudioRef`. Nothing here reads the
 * CMS, so the answer cannot depend on which Tracks exist or whether any has narration —
 * and cannot go stale, because there is no data in it to go stale.
 */
export function narratorSamples(mediaBaseUrl: string): NarratorSamples {
  return {
    female: { url: resolveMediaUrl(NARRATOR_SAMPLE_PATHS.female, mediaBaseUrl) },
    male: { url: resolveMediaUrl(NARRATOR_SAMPLE_PATHS.male, mediaBaseUrl) },
  };
}
