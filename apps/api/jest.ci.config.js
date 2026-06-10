/**
 * CI RLS config — DB-level tenant isolation proof. Needs a real Postgres
 * (DATABASE_URL / APP_DATABASE_URL) with migrations + rls.sql applied; no
 * Firebase, no running API. Run via `pnpm --filter @hms/api test:rls`.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test-ci/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30_000,
  maxWorkers: 1,
};
