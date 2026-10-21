import { defineConfig } from '@playwright/test';
const testOrigin = `http://127.0.0.1:${process.env.TEST_PORT || 3100}`;

export default defineConfig({
  testDir: './browser-tests',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: testOrigin,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'node scripts/accessibility-server.js',
    url: testOrigin,
    reuseExistingServer: false,
  },
});
