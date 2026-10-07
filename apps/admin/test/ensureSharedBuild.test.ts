import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkSharedBuild,
  ensureSharedBuild,
  newestFileMtimeMs,
} from '../../../scripts/ensure-shared-build.mjs';

/**
 * The staleness test behind each app's `predev` (GUARD-1 C): is `packages/shared/dist` as
 * new as `packages/shared/src`?
 *
 * Every case builds a throwaway `packages/shared` with files whose modification times are
 * set by hand, because the rule is entirely about which time is newer — a test that wrote
 * both trees "now" would pass for the wrong reason. The script lives at the repo root and
 * belongs to no workspace, so this is where the gate can run it; the real mechanism (a
 * deleted `dist`, each documented start path, a fresh `dist` left untouched) was run
 * against a scratch copy and is in the GUARD-1 completion report.
 */

/** An arbitrary epoch second; every file time below is an offset from it. */
const T0 = 1_700_000_000;

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

interface Fixture {
  readonly repoRoot: string;
  readonly shared: string;
  /** Writes `packages/shared/<relativePath>` with the given modification time (seconds from T0). */
  readonly put: (relativePath: string, secondsFromT0: number) => string;
}

function fixture(): Fixture {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'ensure-shared-build-'));
  roots.push(repoRoot);
  const shared = path.join(repoRoot, 'packages', 'shared');
  mkdirSync(shared, { recursive: true });

  return {
    repoRoot,
    shared,
    put: (relativePath, secondsFromT0) => {
      const file = path.join(shared, relativePath);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, 'x');
      utimesSync(file, T0 + secondsFromT0, T0 + secondsFromT0);
      return file;
    },
  };
}

describe('checkSharedBuild', () => {
  it('is stale when dist does not exist, and says so', () => {
    const { shared, put } = fixture();
    put('src/index.ts', 0);

    expect(checkSharedBuild(shared)).toEqual({
      fresh: false,
      reason: 'packages/shared/dist is missing or empty',
    });
  });

  it('is stale when dist exists but holds no files', () => {
    const { shared, put } = fixture();
    put('src/index.ts', 0);
    mkdirSync(path.join(shared, 'dist', 'nested'), { recursive: true });

    expect(checkSharedBuild(shared)).toMatchObject({ fresh: false });
  });

  it('is current when dist is newer than every source file', () => {
    const { shared, put } = fixture();
    put('src/index.ts', 0);
    put('src/content.ts', 5);
    put('dist/index.js', 10);

    expect(checkSharedBuild(shared)).toEqual({ fresh: true });
  });

  it('is stale when one source file is newer than the newest file in dist', () => {
    const { shared, put } = fixture();
    put('src/index.ts', 0);
    put('dist/index.js', 10);
    put('src/content.ts', 11);

    expect(checkSharedBuild(shared)).toEqual({
      fresh: false,
      reason: 'a file in packages/shared/src is newer than everything in packages/shared/dist',
    });
  });

  it('counts equal times as current', () => {
    // `tsc` writes dist after it has read src, so a build is never *older* than its input;
    // a tie must not trigger a rebuild, or a fresh dist would be rewritten on every start.
    const { shared, put } = fixture();
    put('src/index.ts', 10);
    put('dist/index.js', 10);

    expect(checkSharedBuild(shared)).toEqual({ fresh: true });
  });

  it('is judged by the newest file in dist, not the oldest', () => {
    // A build leaves a mix of times (declaration maps, per-file output). One old file
    // beside a new one is still a build that happened after the source changed.
    const { shared, put } = fixture();
    put('src/index.ts', 5);
    put('dist/old.js', 1);
    put('dist/index.js', 10);

    expect(checkSharedBuild(shared)).toEqual({ fresh: true });
  });

  it('ignores test files, which tsconfig.build.json does not emit', () => {
    // A newer `*.test.ts` has no output to be stale against, so it must not force a rebuild.
    const { shared, put } = fixture();
    put('src/index.ts', 0);
    put('dist/index.js', 10);
    put('src/content.test.ts', 50);

    expect(checkSharedBuild(shared)).toEqual({ fresh: true });
  });

  it('still counts a source file that merely has "test" in its name', () => {
    const { shared, put } = fixture();
    put('src/index.ts', 0);
    put('dist/index.js', 10);
    put('src/latest.ts', 50);

    expect(checkSharedBuild(shared)).toMatchObject({ fresh: false });
  });

  it('looks inside nested source directories', () => {
    const { shared, put } = fixture();
    put('src/index.ts', 0);
    put('dist/index.js', 10);
    put('src/deep/er/schema.ts', 20);

    expect(checkSharedBuild(shared)).toMatchObject({ fresh: false });
  });

  it('looks inside nested dist directories', () => {
    const { shared, put } = fixture();
    put('src/index.ts', 5);
    put('dist/deep/er/schema.js', 10);

    expect(checkSharedBuild(shared)).toEqual({ fresh: true });
  });

  it('treats a package with no source files as current once something is built', () => {
    const { shared, put } = fixture();
    put('dist/index.js', 10);

    expect(checkSharedBuild(shared)).toEqual({ fresh: true });
  });
});

describe('newestFileMtimeMs', () => {
  it('returns 0 for a directory that does not exist', () => {
    expect(newestFileMtimeMs(path.join(tmpdir(), 'no-such-directory-ensure-shared-build'))).toBe(0);
  });
});

describe('ensureSharedBuild', () => {
  function logger(): { readonly lines: string[]; readonly log: (line: string) => void } {
    const lines: string[] = [];

    return { lines, log: (line) => lines.push(line) };
  }

  it('leaves a current dist completely alone — no build, identical modification times', () => {
    // The property that keeps a second terminal from restarting the first one's backend:
    // `tsx --watch` restarts on any rewrite of a file it imports, even to identical bytes.
    const { repoRoot, put } = fixture();
    put('src/index.ts', 0);
    const dist = [put('dist/index.js', 10), put('dist/content.js', 11)];
    const before = dist.map((file) => statSync(file).mtimeMs);
    const build = vi.fn(() => 0);
    const { lines, log } = logger();

    expect(ensureSharedBuild({ repoRoot, build, log })).toBe(0);

    expect(build).not.toHaveBeenCalled();
    expect(dist.map((file) => statSync(file).mtimeMs)).toEqual(before);
    expect(lines).toEqual(['shared build: current — left alone']);
  });

  it('builds once, from the repo root, when dist is stale, and reports it', () => {
    const { repoRoot, put } = fixture();
    put('src/index.ts', 20);
    put('dist/index.js', 10);
    const build = vi.fn(() => 0);
    const { lines, log } = logger();

    expect(ensureSharedBuild({ repoRoot, build, log })).toBe(0);

    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(repoRoot);
    expect(lines).toEqual([
      'shared build: STALE (a file in packages/shared/src is newer than everything in packages/shared/dist) — rebuilding',
      'shared build: rebuilt',
    ]);
  });

  it('builds when dist is missing', () => {
    const { repoRoot, put } = fixture();
    put('src/index.ts', 0);
    const build = vi.fn(() => 0);

    ensureSharedBuild({ repoRoot, build, log: () => undefined });

    expect(build).toHaveBeenCalledTimes(1);
  });

  it('fails with the build’s own status, so a broken shared package stops the dev server', () => {
    // Starting a server against a half-written dist is the failure this guards; a build
    // that errors must not let `predev` exit 0.
    const { repoRoot, put } = fixture();
    put('src/index.ts', 0);
    const { lines, log } = logger();

    expect(ensureSharedBuild({ repoRoot, build: () => 2, log })).toBe(2);

    expect(lines.at(-1)).toBe('shared build: FAILED with status 2');
  });
});
