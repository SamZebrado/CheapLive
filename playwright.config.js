// @ts-check
const { defineConfig, devices } = require('playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: 'tests/e2e',

  /* 每个测试的超时时间 */
  timeout: 30000,

  /* 全局 expect 超时 */
  expect: {
    timeout: 5000,
  },

  /* 在本地运行所有文件，CI 上只运行一个 */
  fullyParallel: true,

  /* 失败时不停止 */
  forbidOnly: !!process.env.CI,

  /* 重试次数 */
  retries: process.env.CI ? 2 : 0,

  /* 并发 worker 数 */
  workers: process.env.CI ? 1 : undefined,

  /* 报告器 */
  reporter: 'html',

  /* 共享项目配置 */
  use: {
    /* 基础 URL */
    baseURL: 'http://localhost:8765',

    /* 无头模式（无图形界面环境必需） */
    headless: true,

    /* 收集 trace，失败时保留 */
    trace: 'on-first-retry',

    /* 截图，失败时保留 */
    screenshot: 'only-on-failure',
  },

  /* 多浏览器/多角色配置 */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /* Fake media device 用于自动化测试音频/摄像头 */
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
      },
    },
    {
      name: 'chromium-sender',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium-receiver',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  /* 本地开发服务器（可选） */
  webServer: {
    command: 'npx http-server . -p 8765 --cors',
    url: 'http://localhost:8765',
    reuseExistingServer: true,
  },
});
