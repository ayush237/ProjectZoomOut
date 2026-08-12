/**
 * Creates a CMS operator account, or resets the password on an existing one.
 *
 *   PAYLOAD_ADMIN_EMAIL=... PAYLOAD_ADMIN_PASSWORD=... \
 *     npm run create-admin --workspace=apps/admin
 *
 * **Why this exists.** The seed (`src/seed/seed.ts`) authenticates as an operator, and
 * until now the only way to get one was clicking through Payload's create-first-user
 * screen by hand. That is fine once and unrecoverable afterwards: this instance has no
 * outbound email configured, so `forgotPassword` cannot deliver a reset link, and an
 * operator who forgets the password is locked out of their own local CMS with no path
 * back. A fresh clone had no scripted bootstrap either.
 *
 * Run through `payload run`, which calls `loadEnv()` before dispatching — so `.env` is
 * read by Payload itself and the database URL never has to be passed in by hand. That
 * path also exits via `process.exit(0)` rather than `payload.destroy()`, sidestepping the
 * pool-shutdown defect WP1 recorded against the Local API.
 *
 * **Non-destructive.** It never deletes an account. Re-running it against an existing
 * email resets that account's password and clears any login lockout, which is the
 * recovery case; anything else is left alone.
 */

import { getPayload } from 'payload';

import config from '../payload.config';

/* eslint-disable no-restricted-properties --
 * A standalone script, same exemption as the seed: it runs outside Next.js and so has
 * no access to the validated config module. The database URL and secret are read by
 * Payload's own `loadEnv()`, not here. */
const EMAIL = process.env['PAYLOAD_ADMIN_EMAIL'];
const PASSWORD = process.env['PAYLOAD_ADMIN_PASSWORD'];
const DISPLAY_NAME = process.env['PAYLOAD_ADMIN_NAME'] ?? 'ZoomOut Operator';
/* eslint-enable no-restricted-properties */

/** Payload enforces no minimum by default; this stops a typo becoming the password. */
const MINIMUM_PASSWORD_LENGTH = 8;

async function run(): Promise<void> {
  if (EMAIL === undefined || EMAIL.trim() === '') {
    throw new Error('PAYLOAD_ADMIN_EMAIL must be set.');
  }

  if (PASSWORD === undefined || PASSWORD.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error(
      `PAYLOAD_ADMIN_PASSWORD must be set and at least ${String(MINIMUM_PASSWORD_LENGTH)} characters.`,
    );
  }

  const email = EMAIL.trim().toLowerCase();
  const payload = await getPayload({ config });

  const existing = await payload.find({
    collection: 'admins',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  });

  const current = existing.docs[0];

  if (current === undefined) {
    await payload.create({
      collection: 'admins',
      data: { email, password: PASSWORD, displayName: DISPLAY_NAME },
      overrideAccess: true,
    });

    // `console.warn`, not `log`: the repo's lint rule allows only `warn` and `error`.
    // The email is echoed so the operator can see which account they just made; the
    // password is never printed.
    console.warn(`Created CMS operator ${email}.`);
    return;
  }

  await payload.update({
    collection: 'admins',
    id: current.id,
    data: { password: PASSWORD },
    overrideAccess: true,
  });

  /**
   * Clear any lockout as well as the password.
   *
   * Payload's defaults lock an account for ten minutes after five failed logins, and a
   * locked account reports "email or password provided is incorrect" — identical to a
   * wrong password. Resetting the password without clearing the lock would look like
   * the reset had failed.
   */
  await payload.unlock({ collection: 'admins', data: { email }, overrideAccess: true });

  console.warn(`Reset the password for existing CMS operator ${email} and cleared any lockout.`);
}

await run();
