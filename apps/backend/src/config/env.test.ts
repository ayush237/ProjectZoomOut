import { describe, expect, it } from 'vitest';

import { ConfigurationError, loadConfig } from './env.js';

const VALID_DATABASE_URL = 'postgres://user:secretpassword@localhost:5432/zoomout';

const validEnvironment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  DATABASE_URL: VALID_DATABASE_URL,
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
