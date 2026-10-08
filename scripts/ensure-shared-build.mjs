#!/usr/bin/env node
/**
 * Makes `packages/shared/dist` current before a dev server starts — and leaves it
 * completely alone when it already is (GUARD-1 C).
 *
 * `@zoomout/shared` is consumed from a gitignored `dist` (`main` and `exports` both point
 * at it), and only some commands build it: the root `prebuild`, `pretypecheck`, `pretest`
 * and `prelint` do; the dev servers did not. A fresh checkout, or a `git pull` that changed
 * `packages/shared/src`, started the backend, Metro or the admin against no build or a
 * stale one. On 2026-09-25 a stale copy crashed the phone (`NARRATOR_LABELS` was
 * `undefined`, a red screen on the narrator beat), and the device-gate pre-flight can only
 * *detect* that (`shared build STALE`). This is the prevention, run as each app's `predev`.
 *
 * **Build only if stale, never unconditionally.** The backend's `tsx --watch` restarts when
 * a file it imports changes, and `dist` is one of them: a root `build:shared` rewriting it
 * took a running backend down (WP15.8). So a second terminal's `predev` has to leave an
 * up-to-date `dist` alone — not rewrite identical files and restart the first terminal's
 * server. The root `pre*` hooks stay unconditional on purpose: a gate that tests against a
 * build it judged "fresh" by mtime could go green wrongly. This is for `dev` starts only.
 *
 * **Stale means the pre-flight's own test**, so the two cannot disagree: `dist` is missing or
 * empty, or any non-test file under `packages/shared/src` is newer than the newest file under
 * `dist`. Test files are left out because `tsconfig.build.json` does not emit them. Equal
 * times count as current.
 *
 * Tested by `apps/admin/test/ensureSharedBuild.test.ts` (the gate runs tests inside
 * workspaces, and this script belongs to none of them).
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * The newest modification time, in milliseconds, of any file under `directory` that
 * `include` accepts: `0` when the directory does not exist or holds no such file.
 *
 * @param {string} directory
 * @param {(filePath: string) => boolean} [include]
 * @returns {number}
 */
export function newestFileMtimeMs(directory, include = () => true) {
  let entries;

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    // A missing `dist` is the ordinary first-checkout case, not a failure; anything else
    // (permissions, a file where a directory should be) is.
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return 0;
    }

    throw error;
  }

  let newest = 0;

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      newest = Math.max(newest, newestFileMtimeMs(entryPath, include));
    } else if (entry.isFile() && include(entryPath)) {
      newest = Math.max(newest, statSync(entryPath).mtimeMs);
    }
  }

  return newest;
}

/**
 * @typedef {{ fresh: true } | { fresh: false, reason: string }} SharedBuildStatus
 */

/**
 * Whether `<sharedDirectory>/dist` is current with `<sharedDirectory>/src`.
 *
 * @param {string} sharedDirectory the `packages/shared` directory
 * @returns {SharedBuildStatus}
 */
export function checkSharedBuild(sharedDirectory) {
  const newestSource = newestFileMtimeMs(
    path.join(sharedDirectory, 'src'),
    (filePath) => !filePath.endsWith('.test.ts'),
  );
  const newestBuild = newestFileMtimeMs(path.join(sharedDirectory, 'dist'));

  if (newestBuild === 0) {
    return { fresh: false, reason: 'packages/shared/dist is missing or empty' };
  }

  if (newestSource > newestBuild) {
    return {
      fresh: false,
      reason: 'a file in packages/shared/src is newer than everything in packages/shared/dist',
    };
  }

  return { fresh: true };
}

/**
 * Runs the shared package's own build — the same `npm run build --workspace` the root
 * `build:shared` runs, so there is one definition of how it is built.
 *
 * @param {string} repoRoot
 * @returns {number} the exit status
 */
function runSharedBuild(repoRoot) {
  const result = spawnSync('npm', ['run', 'build', '--workspace=@zoomout/shared'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error !== undefined) {
    writeLine(`shared build: could not start npm (${result.error.message})`);
    return 1;
  }

  // A signal-killed child has no status; that is a failure too.
  return result.status ?? 1;
}

/** @param {string} line */
function writeLine(line) {
  process.stdout.write(`${line}\n`);
}

/**
 * Leaves `packages/shared/dist` current. Returns the exit status to finish with: `0` when it
 * already was or has been rebuilt, the build's own status when the rebuild failed — so a
 * broken shared package stops the dev server from starting against a half-written `dist`.
 *
 * @param {{ repoRoot: string, build?: (repoRoot: string) => number, log?: (line: string) => void }} options
 * @returns {number}
 */
export function ensureSharedBuild({ repoRoot, build = runSharedBuild, log = writeLine }) {
  const status = checkSharedBuild(path.join(repoRoot, 'packages', 'shared'));

  if (status.fresh) {
    log('shared build: current — left alone');
    return 0;
  }

  log(`shared build: STALE (${status.reason}) — rebuilding`);

  const code = build(repoRoot);
  log(code === 0 ? 'shared build: rebuilt' : `shared build: FAILED with status ${String(code)}`);

  return code;
}

// Run as a script (`node scripts/ensure-shared-build.mjs`), not when a test imports it.
const entryPoint = process.argv[1];

if (entryPoint !== undefined && realpathSync(entryPoint) === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  process.exitCode = ensureSharedBuild({ repoRoot });
}
