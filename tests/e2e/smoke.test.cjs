/**
 * Smoke Test - CheapLive 冒烟测试
 *
 * 使用 Playwright Test runner，覆盖：
 * - 页面正常加载
 * - 关键 UI 元素存在
 *
 * 运行：
 *   npx playwright test tests/e2e/smoke.test.js
 *   npm test
 */

const { test, expect } = require('@playwright/test');

test.describe('CheapLive Smoke', () => {

  test('页面应在 src/face-tracking/ 正常加载', async ({ page }) => {
    await page.goto('http://localhost:8765/src/face-tracking/index.html');
    await page.waitForSelector('body');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('视频和控制按钮应可见', async ({ page }) => {
    await page.goto('http://localhost:8765/src/face-tracking/index.html');

    // 核心 UI 元素
    const webcam = await page.locator('#webcam').count();
    const outputCanvas = await page.locator('#output_canvas').count();
    const startBtn = await page.locator('#startBtn').count();

    expect(webcam).toBeGreaterThan(0);
    expect(outputCanvas).toBeGreaterThan(0);
    expect(startBtn).toBeGreaterThan(0);
  });

  test('数据面板（面部参数）应可见', async ({ page }) => {
    await page.goto('http://localhost:8765/src/face-tracking/index.html');

    // 数据面板关键元素
    const eyeLeft = await page.locator('#eyeLeft').count();
    const mouthOpen = await page.locator('#mouthOpen').count();
    const headYaw = await page.locator('#headYaw').count();
    const fpsCounter = await page.locator('#fps').count();

    expect(eyeLeft).toBeGreaterThan(0);
    expect(mouthOpen).toBeGreaterThan(0);
    expect(headYaw).toBeGreaterThan(0);
    expect(fpsCounter).toBeGreaterThan(0);
  });

  test('变声开关和面板存在', async ({ page }) => {
    await page.goto('http://localhost:8765/src/face-tracking/index.html');

    // 变声开关在扩展功能区域
    const vcToggle = await page.locator('#voiceChangerToggle').count();
    const vcPanel = await page.locator('#voiceChangerPanel').count();

    expect(vcToggle).toBeGreaterThan(0);
    expect(vcPanel).toBeGreaterThan(0);
  });

  test('根页面包含入口链接到面捕演示', async ({ page }) => {
    await page.goto('http://localhost:8765/index.html');

    // 根页面应有链接指向 face-tracking 演示
    const faceTrackingLink = page.locator('a[href*="face-tracking"]');
    const linkCount = await faceTrackingLink.count();

    expect(linkCount).toBeGreaterThan(0);
  });
});
