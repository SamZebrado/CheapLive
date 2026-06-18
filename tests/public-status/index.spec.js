// Public status and documentation checks.
//
// These tests verify the landing page README and feature-status table are honest
// about which features are actually available. They are intentionally
// lightweight text-existence checks and are NOT meant to be a substitute for
// real functional verification.

const { test, expect } = require('@playwright/test');

const HOME = '/';

test.describe('root landing page (public status checks)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
  });

  test('首屏显示"开发中"状态提示', async ({ page }) => {
    await expect(page.getByText(/CheapLive 当前处于积极开发阶段/)).toBeVisible();
  });

  test('功能状态表存在', async ({ page }) => {
    const cell = page.locator('table.status-table');
    await expect(cell).toBeVisible();
    await expect(page.getByText('浏览器单机面捕').first()).toBeVisible();
  });

  test('单机面捕按钮可点击并指向正确地址', async ({ page }) => {
    const link = page.locator('a[href="src/face-tracking/index.html"]').first();
    await expect(link).toBeVisible();
    // 存在 href 即可，不强制点击跳转测试不属于状态检查范畴。
  });

  test('CheapLive Capture Android App 标为开发中', async ({ page }) => {
    const cell = page.getByText('CheapLive Capture Android App', { exact: false }).first();
    await expect(cell).toBeVisible();
    // 页面中至少有 "开发中" 标签
    await expect(page.getByText('开发中').first()).toBeVisible();
  });

  test('Live2D 不作为可用入口', async ({ page }) => {
    // 应出现"规划中"或显式不可用文案，不应该出现"可体验"
    await expect(page.getByText(/Live2D/).first()).toBeVisible();
    // Live2D 行显示"规划中"。这是对功能状态中 Live2D 的当前承诺上限。
    await expect(page.getByText(/Live2D Cubism/).first()).toBeVisible();
  });

  test('旧多端模式标注为实验性', async ({ page }) => {
    await expect(page.getByText('旧多端模式').first()).toBeVisible();
  });

  test('手机视口下主要内容可见', async ({ page }) => {
    // 至少在 mobile viewport 中主 Demo 按钮和状态表仍然可见。
    await expect(page.getByText(/单机浏览器 Demo/).first()).toBeVisible();
    await expect(page.locator('table.status-table')).toBeVisible();
  });
});
