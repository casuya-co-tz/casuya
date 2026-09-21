import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8765';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'python scripts/e2e_bootstrap.py && python -m uvicorn backend.main:app --host 127.0.0.1 --port 8765',
    cwd: '..',
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      JWT_SECRET: process.env.JWT_SECRET || 'ci-e2e-only-jwt-secret-value-0123456789abcdefgh',
      DATABASE_URL: `sqlite:///${path.resolve(__dirname, '..', 'e2e_casuya.db').replace(/\\/g, '/')}`,
      STORAGE_ROOT: path.resolve(__dirname, '..', 'storage-e2e'),
      REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379/15',
    },
  },
});
