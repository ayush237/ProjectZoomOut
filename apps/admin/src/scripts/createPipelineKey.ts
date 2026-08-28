/**
 * Provisions the machine account the content pipeline authenticates as, and prints its
 * API key once.
 *
 *   npm run create-pipeline-key --workspace=apps/admin
 *
 * **Why this exists.** Before it, the pipeline held a human operator's *login* — an
 * email and password in an environment variable, carrying that person's full rights,
 * including the right to publish. "The pipeline never publishes" was therefore a
 * promise the pipeline made about its own code. This account cannot publish no matter
 * what the code holding its key does; see `access/publishing.ts`.
 *
 * **The key is printed once and never stored anywhere in this repo.** Payload hashes
 * it, so it cannot be read back afterwards — re-run this script to rotate it. Rotating
 * or revoking it does not touch any human's password, which is the other half of the
 * point.
 *
 * To revoke without rotating: untick "Enable API Key" on the account in the admin UI,
 * or delete the account outright. Either takes effect immediately.
 *
 * Run through `payload run` for the same reasons as `createAdmin.ts` — `loadEnv()`
 * before dispatch, and an exit path that sidesteps the pool-shutdown defect.
 */

import { randomBytes } from 'node:crypto';

import { getPayload } from 'payload';

import config from '../payload.config';

/* eslint-disable no-restricted-properties --
 * A standalone script, same exemption as the seed and `createAdmin.ts`: it runs outside
 * Next.js and has no access to the validated config module. */
/**
 * A **separate identity** from whatever login the pipeline authenticates with today.
 *
 * Repurposing the existing `pipeline@zoomout.local` account would have been tidier by
 * one row, and wrong: converting it to a machine account changes the rights of a
 * credential another session is actively using, which is exactly what this package was
 * scoped not to do. The old login keeps working untouched until the pipeline switches
 * over, and can be deleted once it has.
 */
const EMAIL = process.env['PIPELINE_ACCOUNT_EMAIL'] ?? 'pipeline-bot@zoomout.local';
const DISPLAY_NAME = process.env['PIPELINE_ACCOUNT_NAME'] ?? 'Content Pipeline';
/* eslint-enable no-restricted-properties */

/**
 * A password is generated and immediately discarded.
 *
 * Payload requires one on an auth-enabled collection, but nothing should ever use it:
 * this account exists to hold a key. Generating a random one rather than accepting an
 * environment variable means there is no pipeline password to leak, reuse or guess —
 * the credential surface is the key alone.
 */
function unusablePassword(): string {
  return randomBytes(48).toString('base64url');
}

async function run(): Promise<void> {
  const email = EMAIL.trim().toLowerCase();
  const payload = await getPayload({ config });

  const existing = await payload.find({
    collection: 'admins',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  });

  const current = existing.docs[0];

  // Payload generates and hashes the key itself when `enableAPIKey` is set without one.
  // Supplying it here instead is what makes printing it possible: after the write it is
  // a hash, and no later read can recover it.
  const apiKey = randomBytes(32).toString('hex');

  if (current === undefined) {
    await payload.create({
      collection: 'admins',
      data: {
        email,
        password: unusablePassword(),
        displayName: DISPLAY_NAME,
        accountType: 'machine',
        enableAPIKey: true,
        apiKey,
      },
      overrideAccess: true,
    });

    console.warn(`Created machine account ${email} (accountType: machine, cannot publish).`);
  } else {
    await payload.update({
      collection: 'admins',
      id: current.id,
      data: { accountType: 'machine', enableAPIKey: true, apiKey },
      overrideAccess: true,
    });

    console.warn(`Rotated the API key for existing machine account ${email}.`);
  }

  // `console.warn`, not `log`: the repo's lint rule allows only `warn` and `error`.
  console.warn('');
  console.warn('  Authorization: admins API-Key ' + apiKey);
  console.warn('');
  console.warn('Shown once. Payload stores only a hash — re-run this script to rotate.');
  console.warn('Put it in the pipeline environment; do not commit it.');
}

await run();
