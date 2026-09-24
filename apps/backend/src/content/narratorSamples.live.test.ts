import { describe, expect, it } from 'vitest';

import { narratorSamples } from './narratorSamples.js';

/**
 * The narrator greetings, served by **real Payload** (ONBOARD-3).
 *
 * `narratorSamples.test.ts` proves the URLs this backend builds are the ones it means to
 * build. It cannot prove Payload serves anything at them — and that seam is where the
 * defects in this area have lived: a fixture written from understanding what Payload
 * returns is not the same as what Payload returns (`contentContract.live.test.ts` has the
 * history). The stored path is a *filename convention* with the pipeline
 * (`generate-greetings` names the upload, this file names the URL), so nothing but
 * looking at the real thing notices the two drifting apart.
 *
 * **Public reads only — no credentials, and nothing written.** The greetings are public
 * media, which is the point of building on their URLs, so unlike the Leaf-audio contract
 * test this needs no Payload login and touches no data. It still lives behind the `live`
 * config and out of the normal gate, because it needs Payload running:
 *
 *     npm run test:live --workspace=apps/backend
 *
 * **What it deliberately does not assert: the audio's bytes, or its duration.** Either can
 * change the day the founder re-records a greeting — the file is replaced, the URL is not
 * — and a test that pinned them would fail for a reason that is not a defect. What has to
 * hold across a re-take is exactly what is asserted: the URL resolves, publicly, as audio,
 * with the range support a phone's player needs to seek.
 */

/* eslint-disable no-restricted-properties --
 * A live/manual test, gated on its own environment rather than the validated `AppConfig`
 * — the same exemption `contentContract.live.test.ts` uses, for the same reason. */
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://127.0.0.1:3001';
/* eslint-enable no-restricted-properties */

describe('the narrator greetings on real Payload', () => {
  const samples = narratorSamples(PAYLOAD_URL);

  it.each(['female', 'male'] as const)(
    'serves the %s greeting publicly, as audio/mpeg, with byte-range support',
    async (narrator) => {
      const { url } = samples[narrator];

      // Anonymous, on purpose: no Authorization header is ever sent.
      const whole = await fetch(url);
      expect(whole.status).toBe(200);
      expect(whole.headers.get('content-type')).toBe('audio/mpeg');
      expect(whole.headers.get('accept-ranges')).toBe('bytes');
      // Drained so the connection is released; the bytes themselves are not looked at.
      await whole.arrayBuffer();

      const part = await fetch(url, { headers: { range: 'bytes=0-99' } });
      expect(part.status).toBe(206);
      await part.arrayBuffer();
    },
  );
});
