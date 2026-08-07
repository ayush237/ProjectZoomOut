import { Writable } from 'node:stream';

import { pino, type Logger } from 'pino';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config/env.js';
import { REDACTED_PATHS } from './logger.js';

/**
 * Redaction is a control, so it is tested like one.
 *
 * "No secret appears in a log line" cannot be established by reading the config — the
 * paths have to actually match the shapes the application logs. These tests build a
 * real pino instance with the real path list, write realistic objects through it, and
 * assert on the bytes that come out.
 */

const SECRET = 'super-secret-value-nobody-should-see';

/** A logger writing to a buffer, configured exactly as the app's is. */
function captureLogs(): { logger: Logger; output: () => string } {
  const chunks: string[] = [];

  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });

  const logger = pino(
    { level: 'trace', redact: { paths: [...REDACTED_PATHS], censor: '[redacted]' } },
    sink,
  );

  return { logger, output: () => chunks.join('') };
}

describe('log redaction', () => {
  it.each([
    ['password', { password: SECRET }],
    ['passwordHash', { passwordHash: SECRET }],
    ['accessToken', { accessToken: SECRET }],
    ['refreshToken', { refreshToken: SECRET }],
    ['idToken', { idToken: SECRET }],
    ['tokenHash', { tokenHash: SECRET }],
    ['token', { token: SECRET }],
  ])('redacts a top-level %s', (_label, payload) => {
    const { logger, output } = captureLogs();

    logger.info({ user: payload }, 'test');

    expect(output()).not.toContain(SECRET);
    expect(output()).toContain('[redacted]');
  });

  it('redacts an Authorization header', () => {
    const { logger, output } = captureLogs();

    logger.info({ req: { headers: { authorization: `Bearer ${SECRET}` } } }, 'request');

    expect(output()).not.toContain(SECRET);
  });

  it('redacts a password in a request body', () => {
    const { logger, output } = captureLogs();

    logger.info({ req: { body: { email: 'a@example.test', password: SECRET } } }, 'signup');

    expect(output()).not.toContain(SECRET);
  });

  it('redacts a refresh token in a request body', () => {
    const { logger, output } = captureLogs();

    logger.info({ req: { body: { refreshToken: SECRET } } }, 'refresh');

    expect(output()).not.toContain(SECRET);
  });

  it('redacts the signing secret if a whole config is ever logged', () => {
    const { logger, output } = captureLogs();
    const config = loadConfig({
      DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/zoomout',
      AUTH_JWT_SECRET: SECRET.padEnd(32, 'x'),
    });

    // Logging a whole config object is a mistake, but it is a mistake somebody will
    // make eventually. Redaction is what makes it survivable.
    logger.info({ config }, 'boot');

    expect(output()).not.toContain(SECRET);
  });

  it('redacts a database URL, which carries a password', () => {
    const { logger, output } = captureLogs();

    logger.info({ DATABASE_URL: `postgres://user:${SECRET}@host/db` }, 'boot');

    expect(output()).not.toContain(SECRET);
  });

  it('still logs the surrounding context, so redaction does not blind the log', () => {
    const { logger, output } = captureLogs();

    logger.info({ user: { id: 'user-1', password: SECRET } }, 'signup');

    expect(output()).toContain('user-1');
    expect(output()).not.toContain(SECRET);
  });
});
