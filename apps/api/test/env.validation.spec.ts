/**
 * Phase 18 — production environment validation. Pure unit test (firebase
 * presence is injected so no real credentials are touched).
 */
import { validateEnv } from '../src/common/env.validation';

const base = {
  DATABASE_URL: 'postgresql://postgres:postgres@db:5432/hms?schema=public',
  APP_DATABASE_URL: 'postgresql://hms_app:strongpw@db:5432/hms?schema=public',
  firebaseConfigured: true,
};

describe('validateEnv', () => {
  it('passes a well-formed development env', () => {
    expect(validateEnv({ ...base, NODE_ENV: 'development' })).toEqual([]);
  });

  it('passes a well-formed production env', () => {
    expect(
      validateEnv({ ...base, NODE_ENV: 'production', CORS_ORIGIN: 'https://app.hospital.com', THROTTLE_LIMIT: '300' }),
    ).toEqual([]);
  });

  it('flags missing DB and Firebase', () => {
    const problems = validateEnv({ firebaseConfigured: false } as any);
    expect(problems.some((p) => p.includes('DATABASE_URL'))).toBe(true);
    expect(problems.some((p) => p.includes('APP_DATABASE_URL'))).toBe(true);
    expect(problems.some((p) => p.includes('Firebase'))).toBe(true);
  });

  it('rejects identical owner and app DB URLs (RLS would not isolate)', () => {
    const url = 'postgresql://postgres:pw@db:5432/hms';
    expect(validateEnv({ ...base, DATABASE_URL: url, APP_DATABASE_URL: url })).toEqual(
      expect.arrayContaining([expect.stringContaining('must differ')]),
    );
  });

  it('in production requires CORS_ORIGIN and rejects localhost', () => {
    expect(validateEnv({ ...base, NODE_ENV: 'production' })).toEqual(
      expect.arrayContaining([expect.stringContaining('CORS_ORIGIN is required')]),
    );
    expect(
      validateEnv({ ...base, NODE_ENV: 'production', CORS_ORIGIN: 'http://localhost:4001' }),
    ).toEqual(expect.arrayContaining([expect.stringContaining('must not contain localhost')]));
  });

  it('in production rejects the default dev app password and E2E throttle override', () => {
    expect(
      validateEnv({
        ...base,
        APP_DATABASE_URL: 'postgresql://hms_app:app_pw@db:5432/hms',
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.hospital.com',
      }),
    ).toEqual(expect.arrayContaining([expect.stringContaining('default dev password')]));

    expect(
      validateEnv({ ...base, NODE_ENV: 'production', CORS_ORIGIN: 'https://app.hospital.com', THROTTLE_LIMIT: '100000' }),
    ).toEqual(expect.arrayContaining([expect.stringContaining('too high for production')]));
  });

  it('does not apply production guards in development', () => {
    expect(
      validateEnv({
        ...base,
        APP_DATABASE_URL: 'postgresql://hms_app:app_pw@localhost:5433/hms',
        NODE_ENV: 'development',
        THROTTLE_LIMIT: '100000',
      }),
    ).toEqual([]);
  });
});
