/**
 * Audio Track E2E 测试
 *
 * 测试目标：页面音频 track 管理
 * face-tracking 页面通过 webcam MediaStream 管理音频，multi-device 页面有单独的同步开关
 *
 * 运行：
 *   npx playwright test tests/e2e/audio-track.test.js
 */

const { test, expect } = require('@playwright/test');

test.describe('Audio Track 管理', () => {

  test('face-tracking 页面 webcam 元素存在', async ({ page }) => {
    await page.goto('http://localhost:8765/src/face-tracking/index.html');

    // face-tracking 页面使用 webcam video 元素
    const webcam = page.locator('#webcam');
    await expect(webcam).toBeVisible();
  });

  test('face-tracking 页面变声开关控制音频处理', async ({ page }) => {
    await page.goto('http://localhost:8765/src/face-tracking/index.html', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    // checkbox 本身是隐藏的，通过 label.toggle-switch 点击
    const toggleSwitch = page.locator('label.toggle-switch:has(#voiceChangerToggle)');

    // 默认关闭
    const vcToggle = page.locator('#voiceChangerToggle');
    await expect(vcToggle).not.toBeChecked();

    // 开启变声：点击 label
    await toggleSwitch.click();
    await page.waitForTimeout(300);
    await expect(vcToggle).toBeChecked();

    // 关闭变声：再次点击 label
    await toggleSwitch.click();
    await page.waitForTimeout(300);
    await expect(vcToggle).not.toBeChecked();
  });

  test('multi-device 页面包含音频相关功能元素', async ({ page }) => {
    await page.goto('http://localhost:8765/src/multi-device/index.html');

    // multi-device 页面应有音频相关功能
    const pageContent = await page.content();
    const hasAudioContent = pageContent.includes('audio') || pageContent.includes('mic') ||
                            pageContent.includes('Audio') || pageContent.includes('Mic');
    expect(hasAudioContent).toBe(true);
  });
});
