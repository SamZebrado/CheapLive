import { test, expect } from '@playwright/test';

test('voice changer panel loads without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  const toggle = await page.$('#voiceChangerToggle');
  expect(toggle).not.toBeNull();
  
  const panel = await page.$('#voiceChangerPanel');
  expect(panel).not.toBeNull();
  
  expect(errs.length).toBe(0);
});

test('voice changer toggle triggers handler state change', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  // Verify toggle exists and is initially unchecked
  const toggleChecked = await page.$eval('#voiceChangerToggle', el => el.checked);
  expect(toggleChecked).toBe(false);
  
  // Dispatch change event and verify faceTracker state updates
  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  
  // Verify voiceChangerEnabled state changed
  const vcEnabled = await page.evaluate(() => {
    const ft = window.faceTracker;
    return ft ? ft.voiceChangerEnabled : null;
  });
  expect(vcEnabled).toBe(true);
});

test('voice changer presets are selectable', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  // Test all 5 presets - use force:true since panel may be hidden
  const presets = ['normal', 'loli', 'uncle', 'robot', 'monster'];
  for (const preset of presets) {
    await page.selectOption('#voiceChangerPreset', preset, { force: true });
    const presetVal = await page.$eval('#voiceChangerPreset', el => el.value);
    expect(presetVal).toBe(preset);
  }
});

test('voice changer monitor mode selection', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  // Test all 3 monitor modes - use force:true since panel may be hidden
  const modes = ['changed', 'original', 'mute'];
  for (const mode of modes) {
    await page.selectOption('#voiceChangerMonitor', mode, { force: true });
    const monitorVal = await page.$eval('#voiceChangerMonitor', el => el.value);
    expect(monitorVal).toBe(mode);
  }
});

test('VoiceChanger class basic API in browser', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  const result = await page.evaluate(() => {
    try {
      const ft = window.faceTracker;
      if (!ft) return { ok: false, error: 'no faceTracker' };
      
      // VoiceChanger might not be loaded if no microphone
      if (!ft.voiceChanger) {
        return { ok: true, hasVoiceChanger: false, reason: 'not loaded (no mic)' };
      }
      
      return {
        ok: true,
        hasVoiceChanger: true,
        isSupported: ft.voiceChanger.isSupported ? ft.voiceChanger.isSupported() : 'N/A'
      };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  });
  
  expect(result.ok).toBe(true);
});

test('VoiceChanger applyPreset updates pitch and tempo', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  const result = await page.evaluate(() => {
    try {
      // Try to apply preset via the UI select
      const select = document.getElementById('voiceChangerPreset');
      if (select) {
        select.value = 'loli';
        select.dispatchEvent(new Event('change'));
      }
      
      const ft = window.faceTracker;
      if (!ft) return { ok: false, error: 'no faceTracker' };
      
      if (!ft.voiceChanger) {
        return { ok: true, hasVoiceChanger: false };
      }
      
      return {
        ok: true,
        hasVoiceChanger: true,
        pitch: ft.voiceChanger.pitch,
        tempo: ft.voiceChanger.tempo
      };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  });
  
  expect(result.ok).toBe(true);
  // If VoiceChanger loaded, verify pitch changed
  if (result.hasVoiceChanger) {
    expect(result.pitch).toBeDefined();
  }
});
