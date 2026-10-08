import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5232',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  globalSetup: './e2e/global-setup.ts',
  webServer: [
    {
      command: 'pnpm --filter api dev',
      cwd: path.resolve(import.meta.dirname, '../..'),
      url: 'http://localhost:3062/api/v1/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm exec vite --port 5232 --strictPort',
      cwd: import.meta.dirname,
      env: {
        VITE_API_TARGET: 'http://localhost:3062',
      },
      url: 'http://localhost:5232',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
