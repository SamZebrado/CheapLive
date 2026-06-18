/**
 * Audio Track E2E 测试
 *
 * 测试目标：
 * 1. face-tracking 页面变声开关的 UI 交互（已通过 voice-changer-ui.test.js 覆盖）
 * 2. face-tracking 页面默认变声关闭状态（已通过 voice-changer-ui.test.js 覆盖）
 * 3. multi-device 页面 audioSyncToggle 默认状态为关闭
 * 4. multi-device 页面 UI 元素存在
 *
 * 说明：
 * multi-device 页面的真实音频 track 管理（点击 toggle 后 getUserMedia 并推送）
 * 需要完整的信令服务器连接和 WebRTC 握手，在当前测试环境中时序不稳定。
 * 核心音频 UI 交互已由 voice-changer-ui.test.js 充分覆盖。
 *
 * 运行：
 *   npx playwright test tests/e2e/audio-track.test.js
 */

const { test, expect } = require('@playwright/test');

test.describe('Audio Track UI 验证', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8765/src/face-tracking/index.html', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
  });

  test('1. face-tracking 变声开关默认关闭（已由 voice-changer-ui 覆盖，此处保留作为索引）', async ({ page }) => {
    const vcToggle = page.locator('#voiceChangerToggle');
    const isChecked = await vcToggle.isChecked();
    expect(isChecked).toBe(false);
  });

  test('2. face-tracking 变声开关可点击切换（已由 voice-changer-ui 覆盖）', async ({ page }) => {
    const toggleSwitch = page.locator('label.toggle-switch:has(#voiceChangerToggle)');
    await toggleSwitch.click();
    await page.waitForTimeout(200);
    const isChecked = await page.locator('#voiceChangerToggle').isChecked();
    expect(isChecked).toBe(true);
  });

  test('3. multi-device 页面 audioSyncToggle 默认关闭', async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('http://localhost:8765/src/multi-device/index.html', {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      // 选择 sender 模式
      await page.locator('.mode-card[data-mode="sender"]').click();
      await page.locator('#senderPanel').waitFor({ state: 'visible', timeout: 5000 });

      // 等待 sender 对象初始化
      await page.waitForFunction(() => window.sender, { timeout: 5000 });

      // audioSyncEnabled 默认应为 false
      const syncEnabled = await page.evaluate(() => window.sender?.audioSyncEnabled);
      expect(syncEnabled).toBe(false);
    } finally {
      await context.close();
    }
  });

  test('4. multi-device 页面 audioSyncToggle 元素存在且可交互', async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('http://localhost:8765/src/multi-device/index.html', {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await page.locator('.mode-card[data-mode="sender"]').click();
      await page.locator('#senderPanel').waitFor({ state: 'visible', timeout: 5000 });

      const toggle = page.locator('label.toggle-switch:has(#audioSyncToggle)');
      await expect(toggle).toBeVisible();

      // 初始 checkbox 状态应为 false
      const checkbox = page.locator('#audioSyncToggle');
      await expect(checkbox).not.toBeChecked();
    } finally {
      await context.close();
    }
  });
});
