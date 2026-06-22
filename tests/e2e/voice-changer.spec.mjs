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
  
  await page.evaluate(() => {
    document.getElementById('voiceChangerToggle')?.click();
  });
  await page.waitForTimeout(500);
  
  isHidden = await panel?.evaluate(el => el.classList.contains('hidden'));
  expect(isHidden).toBe(false);
  
  await page.evaluate(() => {
    document.getElementById('voiceChangerToggle')?.click();
  });
  await page.waitForTimeout(500);
  
  isHidden = await panel?.evaluate(el => el.classList.contains('hidden'));
  expect(isHidden).toBe(true);
});

test('voice changer presets are selectable', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  await page.evaluate(() => {
    document.getElementById('voiceChangerToggle')?.click();
  });
  await page.waitForTimeout(500);
  
  await page.selectOption('#voiceChangerPreset', 'loli');
  let presetVal = await page.$eval('#voiceChangerPreset', el => el.value);
  expect(presetVal).toBe('loli');
  
  await page.selectOption('#voiceChangerPreset', 'uncle');
  presetVal = await page.$eval('#voiceChangerPreset', el => el.value);
  expect(presetVal).toBe('uncle');
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