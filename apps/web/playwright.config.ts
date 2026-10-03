import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * Browser tests run the production build against a local validator seeded with real jobs.
 * Needs `anchor build` and the Solana CLI; see test/browser/global-setup.ts.
 */
export default defineConfig({
  testDir: 'test/browser',
  globalSetup: './test/browser/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}/agent-escrow/` },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/agent-escrow/`,
    env: { VITE_RPC_URL: 'http://127.0.0.1:8899' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
