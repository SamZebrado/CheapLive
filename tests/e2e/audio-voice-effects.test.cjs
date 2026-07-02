// @ts-check
// Voice effects on capture page - Playwright smoke test
// Note: capture/index.html uses /capture/*.js import paths which work in
// Android WebView (where assets/web/ is the base) but may 404 in
// desktop Playwright. This test verifies UI structure and DOM presence.
const { test, expect } = require('@playwright/test');

function registerErrorCollectors(page) {
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { errors, consoleErrors };
}

test.describe('audio voice effects B-track', () => {

  test('capture page has voice UI section', async ({ page }) => {
    registerErrorCollectors(page);
    await page.goto('/android-capture/app/src/main/assets/web/capture/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for voice section to be present (rendered from static HTML)
    await page.waitForSelector('.voice-section', { timeout: 10000 });

    // Core UI elements
    expect(await page.$('#voiceStatus')).not.toBeNull();
    expect(await page.$('#voiceStartBtn')).not.toBeNull();
    expect(await page.$('#voiceStopBtn')).not.toBeNull();
    expect(await page.$('#micMeterFill')).not.toBeNull();
    expect(await page.$('#processedMeterFill')).not.toBeNull();
    expect(await page.$('#monitorBtn')).not.toBeNull();

    // Preset buttons (5 presets)
    const presetBtns = await page.$$('.preset-btn[data-preset]');
    expect(presetBtns.length).toBeGreaterThanOrEqual(5);

    // Default preset is "original"
    const activePreset = await page.$('.preset-btn.active[data-preset="original"]');
    expect(activePreset).not.toBeNull();

    // Voice status starts as OFF
    const statusText = await page.textContent('#voiceStatus');
    expect(statusText).toBe('OFF');
  });

  test('voice preset buttons have correct labels', async ({ page }) => {
    await page.goto('/android-capture/app/src/main/assets/web/capture/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.preset-btn', { timeout: 10000 });

    const presets = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.preset-btn[data-preset]')).map(b => ({
        preset: b.getAttribute('data-preset'),
        text: b.textContent.trim()
      }));
    });

    const presetMap = Object.fromEntries(presets.map(p => [p.preset, p.text]));
    expect(presetMap['original']).toBeTruthy();
    expect(presetMap['cute']).toBeTruthy();
    expect(presetMap['robot']).toBeTruthy();
    expect(presetMap['deep']).toBeTruthy();
    expect(presetMap['radio']).toBeTruthy();
  });

  test('voice meters have initial zero state', async ({ page }) => {
    await page.goto('/android-capture/app/src/main/assets/web/capture/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.voice-meter', { timeout: 10000 });

    const micLevelText = await page.textContent('#micLevelValue');
    const procLevelText = await page.textContent('#processedLevelValue');

    expect(micLevelText).toMatch(/0.*%/);
    expect(procLevelText).toMatch(/0.*%/);
  });

  test('voice start/stop buttons have correct initial state', async ({ page }) => {
    await page.goto('/android-capture/app/src/main/assets/web/capture/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#voiceStartBtn', { timeout: 10000 });

    // Start button should be enabled, stop button should be disabled
    const startDisabled = await page.evaluate(() => document.getElementById('voiceStartBtn').disabled);
    const stopDisabled = await page.evaluate(() => document.getElementById('voiceStopBtn').disabled);
    const monitorDisabled = await page.evaluate(() => document.getElementById('monitorBtn').disabled);

    expect(startDisabled).toBe(false);
    expect(stopDisabled).toBe(true);
    expect(monitorDisabled).toBe(true);
  });

  test('face capture avatar and video still present with voice UI', async ({ page }) => {
    const { errors } = registerErrorCollectors(page);
    await page.goto('/android-capture/app/src/main/assets/web/capture/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const avatarCanvas = await page.$('#avatar');
    expect(avatarCanvas).not.toBeNull();

    const outputCanvas = await page.$('#output_canvas');
    expect(outputCanvas).not.toBeNull();

    const video = await page.$('#webcam');
    expect(video).not.toBeNull();

    const hudParams = await page.$$('#hud > div');
    expect(hudParams.length).toBeGreaterThan(5);
  });

  test('voice section CSS classes are present', async ({ page }) => {
    await page.goto('/android-capture/app/src/main/assets/web/capture/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.voice-section', { timeout: 10000 });

    // Check that CSS is applied by verifying element structure
    const sectionExists = await page.evaluate(() => {
      const s = document.querySelector('.voice-section');
      return s !== null && s.querySelector('.voice-row') !== null;
    });
    expect(sectionExists).toBe(true);

    const hasPresetRow = await page.evaluate(() => !!document.querySelector('.preset-row'));
    expect(hasPresetRow).toBe(true);
  });
});
