import { test, expect } from '@playwright/test';

const RUN_ID = 'run-20260621-009';
const ARTIFACT_DIR = `.automation/artifacts/${RUN_ID}`;

test('subtitle page loads without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/subtitle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/subtitle-page-loaded.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('subtitle page shows waiting state', async ({ page }) => {
  await page.goto('/src/face-tracking/subtitle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const status = await page.textContent('#status');
  expect(status).toBe('等待字幕信号...');
  const subtitleArea = await page.$('#subtitleArea');
  const isEmpty = await subtitleArea?.evaluate(el => el.classList.contains('empty'));
  expect(isEmpty).toBe(true);
});

test('index.html has subtitle below toggle in DOM', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const toggle = await page.$('#subtitleBelowToggle');
  expect(toggle).not.toBeNull();
  const btn = await page.$('#openSubtitlePage');
  expect(btn).not.toBeNull();
  const subtitleBelow = await page.$('#subtitleBelowAvatar');
  expect(subtitleBelow).not.toBeNull();
  expect(errs.length).toBe(0);
});

test('subtitle page controls are interactive', async ({ page }) => {
  await page.goto('/src/face-tracking/subtitle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  
  await page.selectOption('#fontSize', '64');
  const fontSize = await page.$eval('#subtitleArea', el => el.style.fontSize);
  expect(fontSize).toBe('64px');
  
  await page.selectOption('#language', 'en-US');
  const langVal = await page.$eval('#language', el => el.value);
  expect(langVal).toBe('en-US');
  
  await page.click('input[name="position"][value="center"]');
  const centerChecked = await page.$eval('input[name="position"][value="center"]', el => el.checked);
  expect(centerChecked).toBe(true);
  
  await page.screenshot({ path: `${ARTIFACT_DIR}/subtitle-controls-interactive.png`, fullPage: true });
});

// Cross-tab BroadcastChannel test - core acceptance requirement
test('BroadcastChannel: subtitle.html receives messages from main page', async ({ context }) => {
  const main = await context.newPage();
  const sub = await context.newPage();
  
  const errs = [];
  main.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  sub.on('pageerror', e => errs.push(e.message));
  
  await main.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sub.goto('/src/face-tracking/subtitle.html', { waitUntil: 'networkidle' });
  
  // Wait for both pages to initialize BroadcastChannel
  await sub.waitForTimeout(500);
  
  // Send a test message via BroadcastChannel from main page
  await main.evaluate(() => {
    const ch = new BroadcastChannel('cheaplive-subtitle');
    ch.postMessage({
      interim: '中间字幕',
      final: '',
      timestamp: Date.now()
    });
  });
  
  // Wait for message propagation
  await sub.waitForTimeout(500);
  
  // Verify subtitle.html received and displayed the message
  const subtitleText = await sub.textContent('#subtitleArea');
  expect(subtitleText).toContain('中间字幕');
  
  // Screenshot showing cross-tab sync
  await sub.screenshot({ path: `${ARTIFACT_DIR}/broadcast-received-interim.png`, fullPage: true });
  
  // Send a final transcript
  await main.evaluate(() => {
    const ch = new BroadcastChannel('cheaplive-subtitle');
    ch.postMessage({
      interim: '',
      final: '最终字幕内容',
      timestamp: Date.now()
    });
  });
  
  await sub.waitForTimeout(500);
  const finalText = await sub.textContent('#subtitleArea');
  expect(finalText).toContain('最终字幕内容');
  
  await sub.screenshot({ path: `${ARTIFACT_DIR}/broadcast-received-final.png`, fullPage: true });
  
  // Send empty message to test clear behavior
  await main.evaluate(() => {
    const ch = new BroadcastChannel('cheaplive-subtitle');
    ch.postMessage({ interim: '', final: '', timestamp: Date.now() });
  });
  
  await sub.waitForTimeout(300);
  const clearedText = await sub.textContent('#subtitleArea');
  // Empty message should show waiting state
  expect(clearedText === '等待中...' || clearedText === '').toBeTruthy();
  
  await sub.screenshot({ path: `${ARTIFACT_DIR}/broadcast-empty-message.png`, fullPage: true });
  expect(errs.length).toBe(0);
  
  await main.close();
  await sub.close();
});

test('Below-avatar subtitle toggle controls visibility', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  const subtitleBelow = await page.$('#subtitleBelowAvatar');
  
  // Initially hidden
  let isActive = await subtitleBelow?.evaluate(el => el.classList.contains('active'));
  expect(isActive).toBe(false);
  
  // Click via JavaScript (checkbox is CSS-hidden and may be outside viewport)
  await page.evaluate(() => {
    document.getElementById('subtitleBelowToggle')?.click();
  });
  await page.waitForTimeout(300);
  
  isActive = await subtitleBelow?.evaluate(el => el.classList.contains('active'));
  expect(isActive).toBe(true);
  
  // Disable toggle
  await page.evaluate(() => {
    document.getElementById('subtitleBelowToggle')?.click();
  });
  await page.waitForTimeout(300);
  
  isActive = await subtitleBelow?.evaluate(el => el.classList.contains('active'));
  expect(isActive).toBe(false);
  
  await page.screenshot({ path: `${ARTIFACT_DIR}/below-avatar-toggle-test.png`, fullPage: true });
});

test('Open standalone subtitle page button works', async ({ context }) => {
  const mainPage = await context.newPage();
  await mainPage.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mainPage.waitForTimeout(1500);
  
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    mainPage.click('#openSubtitlePage')
  ]);
  
  // Verify popup URL contains subtitle.html
  expect(popup.url()).toContain('subtitle.html');
  
  // Verify popup loaded correctly
  await popup.waitForSelector('#subtitleArea', { timeout: 5000 });
  const status = await popup.textContent('#status');
  expect(status).toBe('等待字幕信号...');
  
  await popup.close();
  await mainPage.close();
});