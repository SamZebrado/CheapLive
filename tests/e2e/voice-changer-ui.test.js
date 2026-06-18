/**
 * VoiceChanger UI 测试
 *
 * 测试目标：src/face-tracking/index.html 页面中的变声功能 UI
 * VoiceChanger 类在 ES module 作用域内，通过 UI 元素测试
 *
 * 运行：
 *   npx playwright test tests/e2e/voice-changer.test.js
 */

const { test, expect } = require('@playwright/test');

test.describe('VoiceChanger UI 测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8765/src/face-tracking/index.html', {
      waitUntil: 'networkidle',
      timeout: 20000,
    });
  });

  test('变声开关默认关闭', async ({ page }) => {
    const vcToggle = page.locator('#voiceChangerToggle');
    const isChecked = await vcToggle.isChecked();
    expect(isChecked).toBe(false);
  });

  test('变声开关可以点击切换', async ({ page }) => {
    const vcToggle = page.locator('#voiceChangerToggle');

    // 点击开关的 span（toggle-slider 是实际可点击区域）
    const toggleSwitch = page.locator('label.toggle-switch:has(#voiceChangerToggle)');
    await toggleSwitch.click();
    await page.waitForTimeout(200);

    // 验证 checkbox 状态已变化
    const isChecked = await vcToggle.isChecked();
    expect(isChecked).toBe(true);
  });

  test('变声面板包含预设选项', async ({ page }) => {
    // 先展开面板
    const toggleSwitch = page.locator('label.toggle-switch:has(#voiceChangerToggle)');
    await toggleSwitch.click();

    const presetSelect = page.locator('#voiceChangerPreset');
    await expect(presetSelect).toBeVisible();

    const presetOptions = await presetSelect.locator('option').allTextContents();
    expect(presetOptions).toContain('原声');
    expect(presetOptions).toContain('萝莉');
    expect(presetOptions).toContain('大叔');
    expect(presetOptions).toContain('机器人');
    expect(presetOptions).toContain('怪兽');
  });

  test('变声面板包含监听选项', async ({ page }) => {
    const toggleSwitch = page.locator('label.toggle-switch:has(#voiceChangerToggle)');
    await toggleSwitch.click();

    const monitorSelect = page.locator('#voiceChangerMonitor');
    await expect(monitorSelect).toBeVisible();

    const monitorOptions = await monitorSelect.locator('option').allTextContents();
    expect(monitorOptions).toContain('听变声');
    expect(monitorOptions).toContain('听原声');
    expect(monitorOptions).toContain('静音');
  });

  test('可以切换预设选项', async ({ page }) => {
    const toggleSwitch = page.locator('label.toggle-switch:has(#voiceChangerToggle)');
    await toggleSwitch.click();

    const presetSelect = page.locator('#voiceChangerPreset');
    await presetSelect.selectOption('loli');
    const selected = await presetSelect.inputValue();
    expect(selected).toBe('loli');

    await presetSelect.selectOption('robot');
    const selected2 = await presetSelect.inputValue();
    expect(selected2).toBe('robot');
  });
});
