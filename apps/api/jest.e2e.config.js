/**
 * E2E config — runs against the LIVE dev stack (api :4000, Postgres :5433)
 * with real Firebase tokens. See test-e2e/env.js for required env files.
 * Opt-in via `pnpm --filter @hms/api test:e2e`; never part of `pnpm test`.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test-e2e/**/*.e2e.ts'],
  globalSetup: '<rootDir>/test-e2e/global-setup.js',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 120_000,
  maxWorkers: 1,
};
