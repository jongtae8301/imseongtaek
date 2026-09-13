import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  globalSetup: './tests/e2e/setup.ts',
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop-edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'mobile-edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 390, height: 844 } },
    },
  ],
});
