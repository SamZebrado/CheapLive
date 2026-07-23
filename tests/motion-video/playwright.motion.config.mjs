import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.CHEAPLIVE_TEST_PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error('CHEAPLIVE_TEST_PORT is required');

export default defineConfig({
  testDir: '.',
  testMatch: 'motion-video.spec.mjs',
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  timeout: 120_000,
  webServer: {
    command: 'node tests/support/static-server.mjs',
    env: { ...process.env, CHEAPLIVE_TEST_PORT: String(port) },
    url: `http://127.0.0.1:${port}/`,
    timeout: 30_000,
    reuseExistingServer: false,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  outputDir: '.tmp/test-evidence/motion-video/playwright-output',
  projects: [{ name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } }],
});
