import { describe, expect, it } from 'vitest';

import { ConfigurationError, loadConfig } from './env.js';

const VALID_DATABASE_URL = 'postgres://user:secretpassword@localhost:5432/zoomout';
const VALID_JWT_SECRET = 'x'.repeat(48);

const validEnvironment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  DATABASE_URL: VALID_DATABASE_URL,
  AUTH_JWT_SECRET: VALID_JWT_SECRET,
});

describe('loadConfig', () => {
  it('parses a valid environment', () => {
    const config = loadConfig(validEnvironment());

    expect(config.NODE_ENV).toBe('test');
    expect(config.DATABASE_URL).toBe(VALID_DATABASE_URL);
  });

  it('applies defaults for every optional variable', () => {
    const config = loadConfig(validEnvironment());

    expect(config.PORT).toBe(3000);
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.DATABASE_CONNECTION_TIMEOUT_SECONDS).toBe(5);
    expect(config.AUTH_ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(config.AUTH_REFRESH_TOKEN_TTL_SECONDS).toBe(2_592_000);
    expect(config.AUTH_MINIMUM_AGE_YEARS).toBe(13);
    expect(config.AUTH_RATE_LIMIT_MAX).toBe(10);
    expect(config.AUTH_RATE_LIMIT_WINDOW_SECONDS).toBe(60);
  });

  it('leaves the social client ids unset when no app is registered yet', () => {
    const config = loadConfig(validEnvironment());

    expect(config.AUTH_APPLE_CLIENT_ID).toBeUndefined();
    expect(config.AUTH_GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('fails fast when AUTH_JWT_SECRET is missing', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', DATABASE_URL: VALID_DATABASE_URL })).toThrow(
      ConfigurationError,
    );
  });

  it('makes the age threshold a configuration change, not a code change', () => {
    const config = loadConfig({ ...validEnvironment(), AUTH_MINIMUM_AGE_YEARS: '16' });

    expect(config.AUTH_MINIMUM_AGE_YEARS).toBe(16);
  });

  it('coerces numeric variables from their string form', () => {
    const config = loadConfig({ ...validEnvironment(), PORT: '8080' });

    expect(config.PORT).toBe(8080);
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow(ConfigurationError);
  });

  it('names the offending variable in the error', () => {
    try {
      loadConfig({ NODE_ENV: 'test' });
      expect.unreachable('loadConfig should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).issues.join('\n')).toContain('DATABASE_URL');
    }
  });

  it('never leaks a secret value into the error message', () => {
    try {
      loadConfig({ ...validEnvironment(), PORT: 'not-a-port' });
      expect.unreachable('loadConfig should have thrown');
    } catch (error) {
      expect((error as ConfigurationError).message).not.toContain('secretpassword');
    }
  });

  it('rejects a non-postgres connection string', () => {
    expect(() => loadConfig({ ...validEnvironment(), DATABASE_URL: 'mysql://localhost/zoomout' })).toThrow(
      ConfigurationError,
    );
  });

  it('rejects a DATABASE_URL that is not a URL at all', () => {
    expect(() => loadConfig({ ...validEnvironment(), DATABASE_URL: 'localhost' })).toThrow(
      ConfigurationError,
    );
  });

  it('accepts the postgresql:// scheme as well as postgres://', () => {
    const config = loadConfig({
      ...validEnvironment(),
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/zoomout',
    });

    expect(config.DATABASE_URL).toContain('postgresql://');
  });

  it('rejects an unknown NODE_ENV rather than guessing', () => {
    expect(() => loadConfig({ ...validEnvironment(), NODE_ENV: 'staging' })).toThrow(
      ConfigurationError,
    );
  });

  it('rejects a port outside the valid range', () => {
    expect(() => loadConfig({ ...validEnvironment(), PORT: '70000' })).toThrow(ConfigurationError);
  });

  it('returns a frozen object so config cannot be mutated at runtime', () => {
    const config = loadConfig(validEnvironment());

    expect(Object.isFrozen(config)).toBe(true);
  });
});
