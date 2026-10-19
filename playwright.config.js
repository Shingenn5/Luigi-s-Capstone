import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'node scripts/accessibility-server.js',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
  },
});
