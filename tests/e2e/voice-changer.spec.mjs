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

test('voice changer toggle event triggers handler', async ({ page }) => {
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