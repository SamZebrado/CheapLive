// CheapLive Playwright configuration.
// Runs tests over the static site via http-server on the repo root.
// Status/doc-check tests live in tests/public-status/ and are kept
// separate from functional tests so the two categories can be run
// independently.

import { defineConfig, devices } from '@playwright/test';

const testPort = Number(process.env.CHEAPLIVE_TEST_PORT || 8769);
const baseURL = `http://127.0.0.1:${testPort}/`;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  retries: 0,
  reporter: [
    ['line'],
    ['json', { outputFile: '.tmp/test-evidence/20260723/playwright-results.json' }],
  ],
  timeout: 30000,
  webServer: {
    command: 'node tests/support/static-server.mjs',
    env: { ...process.env, CHEAPLIVE_TEST_PORT: String(testPort) },
    url: baseURL,
    timeout: 30000,
    reuseExistingServer: false,
  },
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  outputDir: '.tmp/test-evidence/20260723/playwright-output',
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
