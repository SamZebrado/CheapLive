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

test('voice changer toggle shows/hides panel', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  const panel = await page.$('#voiceChangerPanel');
  
  let isHidden = await panel?.evaluate(el => el.classList.contains('hidden'));
  expect(isHidden).toBe(true);
  
  // Toggle via change event to trigger the real handler
  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    // Set checked and dispatch change event
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  
  isHidden = await panel?.evaluate(el => el.classList.contains('hidden'));
  expect(isHidden).toBe(false);
  
  // Click again to hide
  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: false, writable: true });
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  
  isHidden = await panel?.evaluate(el => el.classList.contains('hidden'));
  expect(isHidden).toBe(true);
});

test('voice changer presets are selectable', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  // Show panel via toggle with change event
  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  
  // Wait for panel to be visible
  await page.waitForFunction(() => {
    const panel = document.getElementById('voiceChangerPanel');
    return panel && !panel.classList.contains('hidden');
  }, { timeout: 5000 });
  
  // Test all 5 presets including normal
  const presets = ['normal', 'loli', 'uncle', 'robot', 'monster'];
  for (const preset of presets) {
    await page.selectOption('#voiceChangerPreset', preset);
    const presetVal = await page.$eval('#voiceChangerPreset', el => el.value);
    expect(presetVal).toBe(preset);
    
    // Also verify via VoiceChanger instance if available
    const vcState = await page.evaluate(() => {
      const ft = window.faceTracker;
      if (ft && ft.voiceChanger) {
        return { preset: ft.voiceChanger.currentPreset };
      }
      return null;
    });
    if (vcState) {
      expect(vcState.preset).toBe(preset);
    }
  }
});

test('voice changer monitor mode selection', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  // Show panel via toggle with change event
  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  
  // Wait for panel to be visible
  await page.waitForFunction(() => {
    const panel = document.getElementById('voiceChangerPanel');
    return panel && !panel.classList.contains('hidden');
  }, { timeout: 5000 });
  
  // Test all 3 monitor modes
  const modes = ['changed', 'original', 'mute'];
  for (const mode of modes) {
    await page.selectOption('#voiceChangerMonitor', mode);
    const monitorVal = await page.$eval('#voiceChangerMonitor', el => el.value);
    expect(monitorVal).toBe(mode);
    
    // Verify via VoiceChanger instance if available
    const vcState = await page.evaluate(() => {
      const ft = window.faceTracker;
      if (ft && ft.voiceChanger) {
        return { monitorMode: ft.voiceChanger.monitorMode };
      }
      return null;
    });
    if (vcState) {
      expect(vcState.monitorMode).toBe(mode);
    }
  }
});

test('VoiceChanger class basic API in browser', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  const result = await page.evaluate(async () => {
    const { VoiceChanger } = await import('./voice-changer.js');
    
    const vc = new VoiceChanger();
    const supported = vc.isSupported();
    
    vc.applyPreset('loli');
    
    return { supported, pitch: vc.pitch, tempo: vc.tempo };
  });
  
  expect(result.supported).toBe(true);
  expect(result.pitch).toBe(1.5);
  expect(result.tempo).toBe(1.05);
});

test('VoiceChanger applyPreset updates pitch and tempo', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  const result = await page.evaluate(async () => {
    const { VoiceChanger } = await import('./voice-changer.js');
    
    const vc = new VoiceChanger();
    vc.applyPreset('monster');
    
    return { pitch: vc.pitch, tempo: vc.tempo };
  });
  
  expect(result.pitch).toBe(0.5);
  expect(result.tempo).toBe(0.8);
});