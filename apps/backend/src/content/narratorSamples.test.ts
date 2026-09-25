import { describe, expect, it } from 'vitest';

import { narratorSamples } from './narratorSamples.js';

/**
 * The two narrator self-introduction clips (ONBOARD-3, Tier B: the URL shape).
 *
 * **No assertion here touches a Payload Media id, the audio's bytes or its duration** —
 * on purpose. All three can change the day the founder re-records a greeting (a fresh
 * upload gets a new id, a new take a new length), and a test that pinned any of them
 * would fail for a reason that is not a defect. The only stable thing about these clips
 * is the filename in the URL, so that is the only thing asserted on.
 */

describe('narratorSamples', () => {
  it('names both clips by their stable filename, on the media host', () => {
    // `toEqual` on the whole object, so an extra field (a `durationSeconds` or a
    // `textDigest` somebody fabricates for a greeting) fails this test rather than
    // sliding past it.
    expect(narratorSamples('https://cdn.example.test/api')).toEqual({
      female: { url: 'https://cdn.example.test/api/media/file/narrator-greeting-female.mp3' },
      male: { url: 'https://cdn.example.test/api/media/file/narrator-greeting-male.mp3' },
    });
  });

  it('takes the host from the base it is given, whatever path the base carries', () => {
    // `MEDIA_BASE_URL` defaults to `CONTENT_API_URL`, which ends in `/api`; Payload's
    // stored paths already begin `/api/media/…`, so resolution must replace the base's
    // path rather than append to it — a doubled `/api/api/…` would 404 on a phone.
    expect(narratorSamples('http://192.168.1.20:3001/api').female.url).toBe(
      'http://192.168.1.20:3001/api/media/file/narrator-greeting-female.mp3',
    );
    expect(narratorSamples('http://192.168.1.20:3001').female.url).toBe(
      'http://192.168.1.20:3001/api/media/file/narrator-greeting-female.mp3',
    );
  });
});
