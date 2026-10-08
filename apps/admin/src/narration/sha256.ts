/**
 * SHA-256 of a string's UTF-8 bytes, as lowercase hex — in plain JavaScript.
 *
 * **Why this is written out rather than calling `crypto.subtle.digest`.** `crypto.subtle`
 * exists only in a *secure context*: https, or localhost. The admin opened over plain
 * http on a LAN address has no `crypto.subtle` at all, and a stale-narration warning that
 * silently never appears there is precisely the failure it exists to prevent — nobody
 * would know, and every Node test would still pass, because Node always has one. A
 * synchronous hash with no environment dependence has one code path everywhere, which is
 * also why the comparison built on it (`staleNarration.ts`) can be a plain function
 * instead of an effect racing the keystrokes.
 *
 * It is the FIPS 180-4 algorithm, nothing clever. Its correctness is not argued from
 * reading it: `sha256.test.ts` runs it against `node:crypto` on every padding boundary and
 * on a few hundred random strings (multi-byte and lone surrogates included), and against
 * the published test vectors. It is for a hint on screen, not for security — the backend
 * is what decides whether a clip is served, and it hashes with `node:crypto`.
 *
 * `TextEncoder` is not secure-context-only and is in every browser the admin runs in.
 */

/** The first 32 bits of the fractional parts of the cube roots of the first 64 primes. */
const ROUND_CONSTANTS: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** The first 32 bits of the fractional parts of the square roots of the first 8 primes. */
const INITIAL_HASH: readonly number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const BLOCK_BYTES = 64;

/** Typed-array reads are `number | undefined` under `noUncheckedIndexedAccess`; every index here is in range by construction. */
function word(values: ArrayLike<number>, index: number): number {
  return values[index] ?? 0;
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * A message length in bytes as the two 32-bit halves of its length in **bits**.
 *
 * Its own function because the high half is zero for every message under 512 MiB, which a
 * test cannot allocate: kept inline, that arithmetic could be wrong and nothing would
 * notice. `sha256.test.ts` pins the boundary values directly.
 */
export function bitLengthWords(byteLength: number): readonly [high: number, low: number] {
  return [Math.floor(byteLength / 0x20000000), (byteLength << 3) >>> 0];
}

/**
 * Appends the 0x80 marker, zero padding, and the message length in bits as a 64-bit
 * big-endian integer, so the total is a whole number of 64-byte blocks.
 */
function pad(message: Uint8Array): Uint8Array {
  const length = message.length;
  const paddedLength = Math.ceil((length + 1 + 8) / BLOCK_BYTES) * BLOCK_BYTES;
  const padded = new Uint8Array(paddedLength);

  padded.set(message);
  padded[length] = 0x80;

  const view = new DataView(padded.buffer);
  const [high, low] = bitLengthWords(length);
  view.setUint32(paddedLength - 8, high, false);
  view.setUint32(paddedLength - 4, low, false);

  return padded;
}

function digest(message: Uint8Array): Uint32Array {
  const padded = pad(message);
  const view = new DataView(padded.buffer);
  const state = Uint32Array.from(INITIAL_HASH);
  const schedule = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += BLOCK_BYTES) {
    for (let t = 0; t < 16; t += 1) {
      schedule[t] = view.getUint32(offset + t * 4, false);
    }

    for (let t = 16; t < 64; t += 1) {
      const w15 = word(schedule, t - 15);
      const w2 = word(schedule, t - 2);
      const sigma0 = rotateRight(w15, 7) ^ rotateRight(w15, 18) ^ (w15 >>> 3);
      const sigma1 = rotateRight(w2, 17) ^ rotateRight(w2, 19) ^ (w2 >>> 10);

      schedule[t] = (word(schedule, t - 16) + sigma0 + word(schedule, t - 7) + sigma1) | 0;
    }

    let a = word(state, 0);
    let b = word(state, 1);
    let c = word(state, 2);
    let d = word(state, 3);
    let e = word(state, 4);
    let f = word(state, 5);
    let g = word(state, 6);
    let h = word(state, 7);

    for (let t = 0; t < 64; t += 1) {
      const bigSigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + bigSigma1 + choose + word(ROUND_CONSTANTS, t) + word(schedule, t)) | 0;
      const bigSigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (bigSigma0 + majority) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    state[0] = (word(state, 0) + a) | 0;
    state[1] = (word(state, 1) + b) | 0;
    state[2] = (word(state, 2) + c) | 0;
    state[3] = (word(state, 3) + d) | 0;
    state[4] = (word(state, 4) + e) | 0;
    state[5] = (word(state, 5) + f) | 0;
    state[6] = (word(state, 6) + g) | 0;
    state[7] = (word(state, 7) + h) | 0;
  }

  return state;
}

/** `sha256` of the string's UTF-8 encoding, lowercase hex — the form `textDigest` is stored in. */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);

  return Array.from(digest(bytes), (value) => value.toString(16).padStart(8, '0')).join('');
}
