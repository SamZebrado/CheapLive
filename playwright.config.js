// CheapLive Playwright configuration.
// Runs tests over the static site via http-server on the repo root.
// Status/doc-check tests live in tests/public-status/ and are kept
// separate from functional tests so the two categories can be run
// independently.

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  retries: 0,
  reporter: 'line',
  timeout: 30000,
  webServer: {
    command: 'npx http-server -p 8769 -s',
    url: 'http://127.0.0.1:8769/',
    timeout: 30000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://127.0.0.1:8769/',
  },
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
