import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { bitLengthWords, sha256Hex } from './sha256';

/** What the backend computes (`sha256Hex` in `content.mapper.ts`). */
const nodeSha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * A seeded generator (mulberry32), so a failure reproduces: the same "random" strings on
 * every run, on every machine.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('sha256Hex', () => {
  // The FIPS 180-4 / NIST example messages, written out rather than computed — if both
  // this and `node:crypto` were somehow wrong in the same way, these would still say so.
  it('matches the published test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    expect(
      sha256Hex(
        'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
      ),
    ).toBe('cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1');
  });

  it('matches the million-"a" vector, which runs many blocks through the state', () => {
    expect(sha256Hex('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });

  it('agrees with node:crypto at every length across the padding boundaries', () => {
    // 55 bytes is the longest message that pads into a single block, 56 the shortest
    // that needs a second: the length field and the 0x80 marker are what move. Every
    // length from 0 to 200 covers the boundary at 55/56 and the next two at 119/120 and
    // 183/184, and a message that is an exact multiple of 64 bytes.
    for (let length = 0; length <= 200; length += 1) {
      const text = 'x'.repeat(length);

      expect(sha256Hex(text), `length ${String(length)}`).toBe(nodeSha256(text));
    }
  });

  it('agrees with node:crypto on the shapes that fool a hand-rolled hash', () => {
    const fixtures = [
      'closed-up—em dash',
      '“curly” and ‘single’ quotes',
      'a payoff\n\nwith a blank line\n\nand another',
      '  leading and trailing whitespace \n',
      'tabs\tand\r\nCRLF',
      'naïve café — déjà vu',
      '日本語のテキスト',
      '😀 emoji outside the BMP 🎉 and a ZWJ family 👨‍👩‍👧',
      'combining é and precomposed é',
      '\u0000 a NUL byte \u0000',
      '﻿leading BOM',
    ];

    for (const text of fixtures) {
      expect(sha256Hex(text), JSON.stringify(text)).toBe(nodeSha256(text));
    }
  });

  it('agrees with node:crypto on a lone surrogate, which UTF-8 encodes as U+FFFD', () => {
    // A browser's TextEncoder and node's utf8 encoder both replace it; if they ever
    // stopped agreeing, a pasted broken character would flag every clip as stale.
    for (const text of ['\uD800', 'a\uDC00b', 'trailing high \uD83D']) {
      expect(sha256Hex(text), JSON.stringify(text)).toBe(nodeSha256(text));
    }
  });

  it('agrees with node:crypto on a few hundred random strings of mixed scripts', () => {
    const random = seededRandom(20261003);
    // Code point ranges: ASCII, Latin-1, the rest of the BMP below the surrogates, and
    // the astral planes (which become surrogate pairs in a JS string).
    const ranges: readonly (readonly [number, number])[] = [
      [0x20, 0x7e],
      [0xa0, 0xff],
      [0x100, 0xd7ff],
      [0x1f300, 0x1faff],
    ];

    for (let n = 0; n < 400; n += 1) {
      const length = Math.floor(random() * 300);
      let text = '';

      for (let i = 0; i < length; i += 1) {
        const [low, high] = ranges[Math.floor(random() * ranges.length)] ?? [0x20, 0x7e];
        text += String.fromCodePoint(low + Math.floor(random() * (high - low + 1)));
      }

      expect(sha256Hex(text), `string ${String(n)}`).toBe(nodeSha256(text));
    }
  });

  it('does not need crypto.subtle, which a plain-http page does not have', () => {
    // The point of writing it out. Node always has `crypto.subtle`, so without this the
    // suite would pass in exactly the environment where nobody needs the guarantee.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });

    try {
      expect(globalThis.crypto).toBeUndefined();
      expect(sha256Hex('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(globalThis, 'crypto');
      } else {
        Object.defineProperty(globalThis, 'crypto', original);
      }
    }

    expect(globalThis.crypto).toBeDefined();
  });

  it('returns 64 lowercase hex characters', () => {
    expect(sha256Hex('anything at all')).toMatch(/^[0-9a-f]{64}$/u);
  });
});

describe('bitLengthWords', () => {
  // The length field is 64 bits of *bit* count. Below 512 MiB the high word is zero, which
  // no test can allocate to reach, so the arithmetic is pinned at its boundaries instead.
  it.each([
    [0, 0, 0],
    [1, 0, 8],
    [55, 0, 440],
    [64, 0, 512],
    [0x1fffffff, 0, 0xfffffff8],
    [0x20000000, 1, 0],
    [0x20000001, 1, 8],
    [0x3fffffff, 1, 0xfffffff8],
    [2 ** 32, 8, 0],
    [2 ** 32 + 5, 8, 40],
  ])('turns %i bytes into [%i, %i]', (byteLength, high, low) => {
    expect(bitLengthWords(byteLength)).toEqual([high, low]);
  });
});
