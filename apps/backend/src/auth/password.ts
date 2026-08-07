import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing.
 *
 * argon2id, which is what OWASP recommends and what resists both GPU cracking and the
 * side-channel weaknesses of argon2i/argon2d individually. Parameters are stated
 * explicitly rather than left to library defaults so that a dependency bump cannot
 * quietly weaken them, and so the choice is reviewable.
 *
 * The encoded output carries its own salt and parameters, which is what lets these be
 * raised later without invalidating existing hashes — an old hash still verifies
 * against the parameters baked into it.
 */

const ARGON2ID = 2;

/** OWASP's second-preference profile: 19 MiB, 2 iterations, 1 degree of parallelism. */
const HASH_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, HASH_OPTIONS);
}

/**
 * Checks a password against a stored hash.
 *
 * Returns `false` rather than throwing on a malformed hash. A corrupt row should read
 * as "these credentials do not match" — the alternative is a 500 that tells an
 * attacker they have found something interesting.
 */
export async function verifyPassword(plaintext: string, encodedHash: string): Promise<boolean> {
  try {
    return await verify(encodedHash, plaintext, HASH_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Burns roughly the same time as a real verification.
 *
 * Called on the login path when no account exists for the submitted address. Without
 * it, a missing user returns in microseconds while a real one takes ~50ms, and that
 * gap is a user-enumeration oracle regardless of how careful the response body is.
 */
export async function simulatePasswordVerification(): Promise<void> {
  await hashPassword('timing-equalisation-only-never-stored');
}
