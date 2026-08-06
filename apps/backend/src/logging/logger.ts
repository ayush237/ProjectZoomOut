import { pino, type Logger } from 'pino';

import type { AppConfig } from '../config/env.js';

/**
 * Structured logging for the whole service.
 *
 * JSON in every environment, including development. Pretty-printing is tempting
 * locally but it means the format engineers read is not the format production emits,
 * and log-shape bugs then only appear once deployed.
 */
export type AppLogger = Logger;

/**
 * Fields that must never reach a log sink, matched at any depth.
 *
 * Redaction is configured centrally rather than trusted to call sites: the whole
 * point is to survive somebody logging a whole config or request object by mistake.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.DATABASE_URL',
  'DATABASE_URL',
];

export function createLogger(config: AppConfig): AppLogger {
  return pino({
    level: config.LOG_LEVEL,
    redact: {
      paths: REDACTED_PATHS,
      censor: '[redacted]',
    },
    base: {
      service: 'zoomout-backend',
      env: config.NODE_ENV,
    },
    formatters: {
      // Emit `"level":"info"` rather than pino's default numeric level, so log
      // aggregators read it without a mapping table.
      level: (label) => ({ level: label }),
    },
  });
}
