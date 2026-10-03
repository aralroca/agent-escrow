import { defineConfig } from 'vitest/config';

/** End-to-end tests against a local validator. Needs `anchor build` and the Solana CLI. */
export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    globalSetup: ['e2e/validator.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
