/**
 * VoiceChanger UI 测试
 *
 * 测试目标：src/face-tracking/index.html 页面中的变声功能 UI
 * VoiceChanger 类在 ES module 作用域内，通过 UI 元素测试
 *
 * 运行：
 *   npx playwright test tests/e2e/voice-changer-ui.test.cjs
 */

const { test, expect } = require('@playwright/test');

// Synthetic input only: startup must not depend on a real microphone.
test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test.describe('VoiceChanger UI 测试', () => {


  async function enableVoiceChanger(page) {
    const vcToggle = page.locator('#voiceChangerToggle');
    await page.locator('label.toggle-switch:has(#voiceChangerToggle)').click();
    await expect.poll(() => page.evaluate(() => window.faceTracker?.voiceChanger?.state)).toBe('enabled');
    await expect(vcToggle).toBeChecked();
    await expect(vcToggle).toBeEnabled();
  }

  test.beforeEach(async ({ page }) => {
    // Use the real bundled module and production fallback, without CDN dependence.
    await page.route('https://cdn.jsdelivr.net/npm/soundtouchjs@0.1.29/dist/soundtouch.min.js', route => route.abort());
    await page.goto('/src/face-tracking/index.html', {
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

    await enableVoiceChanger(page);

    // Assert completed startup, not a temporary checked state while loading.
    const isChecked = await vcToggle.isChecked();
    expect(isChecked).toBe(true);
    const diagnostics = await page.evaluate(() => window.faceTracker.voiceChanger.getDiagnostics());
    expect(diagnostics.state).toBe('enabled');
    expect(diagnostics.engine.source).toBe('local');
    expect(diagnostics.engine.loaded).toBe(true);
    expect(diagnostics.audioContext.state).toBe('running');
    expect(diagnostics.mic.hasStream).toBe(true);
    expect(diagnostics.mic.tracksActive).toBe(true);
    expect(diagnostics.graph.connected).toBe(true);

    await page.locator('label.toggle-switch:has(#voiceChangerToggle)').click();
    await expect(vcToggle).not.toBeChecked();
    await expect.poll(() => page.evaluate(() => window.faceTracker.voiceChanger.state)).toBe('disabled');
    expect(await page.evaluate(() => window.faceTracker.voiceChanger.getDiagnostics().mic.hasStream)).toBe(false);
  });

  test('麦克风拒绝时回滚开关并保留失败状态', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Synthetic permission denial', 'NotAllowedError');
      };
    });
    const vcToggle = page.locator('#voiceChangerToggle');
    await page.locator('label.toggle-switch:has(#voiceChangerToggle)').click();
    await expect(page.locator('#status')).toContainText('麦克风权限被拒绝');
    await expect(vcToggle).not.toBeChecked();
    await expect(vcToggle).toBeEnabled();
    expect(await page.evaluate(() => window.faceTracker.voiceChanger.getDiagnostics().mic.hasStream)).toBe(false);
  });

  test('变声面板包含预设选项', async ({ page }) => {
    // 先展开面板
    await enableVoiceChanger(page);

    const presetSelect = page.locator('#voiceChangerPreset');
    await expect(presetSelect).toBeVisible();

    const presetOptions = await presetSelect.locator('option').allTextContents();
    expect(presetOptions).toContain('原声');
    expect(presetOptions).toContain('可爱');
    expect(presetOptions).toContain('机器人');
    expect(presetOptions).toContain('低沉');
    expect(presetOptions).toContain('收音机');
  });

  test('变声面板包含监听选项', async ({ page }) => {
    await enableVoiceChanger(page);

    const monitorSelect = page.locator('#voiceChangerMonitor');
    await expect(monitorSelect).toBeVisible();

    const monitorOptions = await monitorSelect.locator('option').allTextContents();
    expect(monitorOptions).toContain('听变声');
    expect(monitorOptions).toContain('听原声');
    expect(monitorOptions).toContain('静音');
  });

  test('可以切换预设选项', async ({ page }) => {
    await enableVoiceChanger(page);

    const presetSelect = page.locator('#voiceChangerPreset');
    await presetSelect.selectOption('cute');
    const selected = await presetSelect.inputValue();
    expect(selected).toBe('cute');

    await presetSelect.selectOption('radio');
    const selected2 = await presetSelect.inputValue();
    expect(selected2).toBe('radio');
  });
});
